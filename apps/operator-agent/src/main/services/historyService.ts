/**
 * HistoryService — gestão do histórico local de sprints processadas.
 *
 * Mantém cache em memória de filenames já arquivados ou descartados,
 * usado pelo pollingService para deduplicação ("já processei essa
 * sprint, não enfileira de novo").
 *
 * **Gate 3:** estrutura em memória + `markProcessed`.
 * **Gate 5:** `ensureFolder()` cria `<userData>/historico/` para o tray
 * menu "Histórico local" ter pasta válida via `shell.openPath`.
 * **Gate 6 (esta sessão):** `archive(payload, filename, rawContent)` grava
 * o JSON em `<userData>/historico/YYYY-MM-DD/<filename>` + escrita atômica
 * (.tmp + rename) + cache populado. `initializeFromDisk()` faz scan recursivo
 * do `historico/` no boot, populando o cache para dedup pós-restart.
 *
 * Decisão D5 do Gate 1: cache em memória populado no boot via scan
 * recursivo. Resultado: após restart, sprints já arquivadas não são
 * re-enfileiradas pelo polling (que consulta `isAlreadyArchived`).
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { safeParseFilename, safeParseSprintPayload, type SprintPayload } from '@sprint/contracts';
import { format } from 'date-fns';

const HISTORICO_DIR = 'historico';

/**
 * Resultado de {@link HistoryService.loadLastArchived}. `payload` já passou
 * pelo schema Zod — caller pode usar diretamente sem re-parse.
 */
export interface LoadLastArchivedResult {
  filename: string;
  payload: SprintPayload;
}

export class HistoryService {
  private readonly processedFilenames = new Set<string>();
  private readonly userDataPath: string;
  private readonly now: () => Date;

  constructor(userDataPath: string, now?: () => Date) {
    this.userDataPath = userDataPath;
    this.now = now ?? ((): Date => new Date());
  }

  /**
   * Verifica se um filename já foi processado (arquivado ou descartado
   * por deadline). Consulta O(1) em memória.
   */
  isAlreadyArchived(filename: string): boolean {
    return this.processedFilenames.has(filename);
  }

  /**
   * Cria `<userData>/historico/` se ainda não existir. Idempotente.
   * Uso no boot do main — garante que o tray menu "Histórico local"
   * tenha pasta válida para abrir via `shell.openPath`.
   */
  async ensureFolder(): Promise<void> {
    await fs.mkdir(this.getHistoricoPath(), { recursive: true });
  }

  /** Path absoluto da pasta de histórico — `<userData>/historico/`. */
  getHistoricoPath(): string {
    return path.join(this.userDataPath, HISTORICO_DIR);
  }

  /**
   * Marca um filename como processado SEM escrever em disco. Uso primário
   * por `pollingService` quando uma sprint com deadline passado é
   * descartada. `archive` chama isto internamente após gravar.
   *
   * Idempotente.
   */
  markProcessed(filename: string): void {
    this.processedFilenames.add(filename);
  }

  /**
   * Snapshot do cache para diagnóstico/testes integrados. Retorna cópia
   * imutável.
   */
  snapshot(): readonly string[] {
    return [...this.processedFilenames];
  }

  /**
   * Arquiva sprint processada em `<userData>/historico/YYYY-MM-DD/<filename>`.
   *
   * Sequência (RN-08 — sprint não pode ser reprocessada):
   *  1. Determina pasta do dia via `date-fns format(now, 'yyyy-MM-dd')`.
   *  2. `mkdir({ recursive: true })` — idempotente.
   *  3. Escreve atomicamente: `.tmp` com sufixo aleatório (6 bytes hex)
   *     → fsync via `fs.writeFile` (Node força flush no rename) → `rename`.
   *     Mesmo padrão do `NodeFilesystemAdapter.writeFileAtomic` (G-017
   *     — sufixo aleatório isola escritas concorrentes).
   *  4. `markProcessed(filename)` — cache atualizado para dedup imediato
   *     do próximo ciclo de polling.
   *
   * `payload` é declarado para futuros usos (Gate 8 polish: enriquecer
   * com metadados de archive). Em Gate 6 não é lido — `rawContent` é
   * gravado tal qual chega (preserva o JSON exato que veio do shared/).
   */
  async archive(_payload: unknown, filename: string, rawContent: string): Promise<void> {
    const dayFolder = path.join(this.getHistoricoPath(), this.formatDay());
    await fs.mkdir(dayFolder, { recursive: true });

    const targetPath = path.join(dayFolder, filename);
    const tmpPath = `${targetPath}.${randomBytes(6).toString('hex')}.tmp`;

    await fs.writeFile(tmpPath, rawContent, 'utf-8');
    await fs.rename(tmpPath, targetPath);

    this.processedFilenames.add(filename);
  }

  /**
   * Popula o cache `processedFilenames` lendo recursivamente
   * `<userData>/historico/`. Cada subpasta `YYYY-MM-DD/` contém arquivos
   * `.json` (sprints arquivadas). Idempotente.
   *
   * No-op se `historico/` ainda não existe (pré-Gate 5 ou primeiro boot).
   * Outros erros de I/O propagam — caller (boot do main) decide se trata
   * como fatal (atualmente é fatal: cache inválido pode levar a sprints
   * duplicadas exibidas).
   */
  async initializeFromDisk(): Promise<void> {
    const root = this.getHistoricoPath();
    let dayDirs: string[];
    try {
      dayDirs = await fs.readdir(root);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return; // pasta não existe — cache permanece vazio.
      }
      throw err;
    }

    for (const dayDir of dayDirs) {
      const dayPath = path.join(root, dayDir);
      let stats;
      try {
        stats = await fs.stat(dayPath);
      } catch {
        continue; // race condition entre readdir e stat — skip
      }
      if (!stats.isDirectory()) continue;

      let files: string[];
      try {
        files = await fs.readdir(dayPath);
      } catch {
        continue;
      }
      for (const f of files) {
        // Só `.json` (ignora .tmp órfãos, .DS_Store, etc.)
        if (f.endsWith('.json')) {
          this.processedFilenames.add(f);
        }
      }
    }
  }

  /**
   * Carrega o último aviso (sprint) arquivado no histórico local — usado
   * pelo BL-C3-009 (reabertura via tray).
   *
   * Algoritmo:
   *  1. Lista subpastas em `<userData>/historico/`.
   *  2. Ordena `YYYY-MM-DD` desc — pasta mais recente primeiro.
   *  3. Para cada dia (do mais recente ao mais antigo):
   *     a. Lista `.json` válidos como filename de PENDING (exclui
   *        `cancel-*.json` — não faz sentido reabrir uma sprint
   *        cancelada).
   *     b. Ordena por nome desc — ULID encode timestamp, então sort
   *        lexicográfico desc retorna o mais recente primeiro.
   *     c. Para cada arquivo do mais recente ao mais antigo: lê, parse
   *        JSON, valida via Zod. Em sucesso → retorna. Em corrupção
   *        → pula silenciosamente.
   *  4. Se nenhum arquivo válido em nenhum dia: retorna `null` (caller
   *     mostra balloon "nenhum aviso para reabrir").
   *
   * **Não atualiza o cache `processedFilenames`** — leitura passiva.
   * **Não lança em pasta inexistente** (retorna `null`).
   */
  async loadLastArchived(): Promise<LoadLastArchivedResult | null> {
    const root = this.getHistoricoPath();
    let dayDirs: string[];
    try {
      dayDirs = await fs.readdir(root);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }

    // YYYY-MM-DD ordena lexicograficamente como cronologicamente.
    // Desc → mais recente primeiro.
    const sortedDays = [...dayDirs].sort().reverse();

    for (const day of sortedDays) {
      const dayPath = path.join(root, day);
      let stats;
      try {
        stats = await fs.stat(dayPath);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;

      let files: string[];
      try {
        files = await fs.readdir(dayPath);
      } catch {
        continue;
      }

      const sprintFiles = files
        .filter((f) => f.endsWith('.json'))
        .filter((f) => {
          const parsed = safeParseFilename(f);
          return parsed.success && parsed.data.type === 'pending';
        })
        .sort()
        .reverse();

      for (const filename of sprintFiles) {
        const filepath = path.join(dayPath, filename);
        let raw: string;
        try {
          raw = await fs.readFile(filepath, 'utf-8');
        } catch {
          continue;
        }
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          continue;
        }
        const result = safeParseSprintPayload(json);
        if (!result.success) continue;
        return { filename, payload: result.data };
      }
    }

    return null;
  }

  /**
   * @internal — exposto para testes integrados poderem semear o cache
   * sem depender de I/O.
   */
  _seedForTests(filenames: readonly string[]): void {
    for (const f of filenames) {
      this.processedFilenames.add(f);
    }
  }

  /** @internal — exposto para testes (helper na ausência de getter). */
  getUserDataPath(): string {
    return this.userDataPath;
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /**
   * Formata o dia atual como YYYY-MM-DD via date-fns. Usa o `now` injetado
   * no construtor (default `new Date()` — produção) — em testes
   * integrados, passa-se `() => FIXED_NOW` para timestamps determinísticos
   * sem depender de fake timers.
   */
  private formatDay(): string {
    return format(this.now(), 'yyyy-MM-dd');
  }
}
