/**
 * PendingStore — operações de domínio sobre a pasta `pending/` da
 * pasta compartilhada SMB.
 *
 * Composição (port-and-adapter): recebe um {@link IFilesystemAdapter}
 * e o `sharedPath` da config como dependências. Não lê config nem
 * descobre paths sozinho — caller (Leader / Agent) injeta tudo.
 *
 * Paths internos usam separador `/` (POSIX). Windows aceita ambos os
 * separadores nas APIs `fs/promises`, e a uniformidade elimina drift
 * entre Linux CI, Windows dev e MemoryFilesystemAdapter (que normaliza
 * só `/` — ver G-019).
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter; domain layer separado do port)
 * @see DECISIONS.md ADR-014 (sanitização de body_html via DOMPurify)
 * @see CLAUDE.md §7.9 (sanitizeBodyHtml obrigatório em toda escrita)
 */
import path from 'node:path';

import {
  buildPendingFilename,
  FilenameParseError,
  parseSprintPayload,
  safeParseFilename,
  safeParseSprintCancel,
  safeParseSprintPayload,
  sanitizeBodyHtml,
  SHARED_DIRS,
  type SprintCancel,
  type SprintPayload,
} from '@sprint/contracts';

import { FileNotFoundError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

import { readAndParseJson } from './read-and-parse';

/**
 * Metadados retornados por {@link PendingStore.writePendingSprint}.
 * Caller (Leader) usa para logging e tracking opcional.
 */
export interface WritePendingResult {
  /** Nome do arquivo gravado (sem path), no formato `<sprintId>-<userId>.json`. */
  filename: string;
  /** Caminho absoluto gravado, com separadores POSIX. */
  filepath: string;
}

/**
 * Filtro opcional aplicado a {@link PendingStore.listPending}.
 *
 * Filtragem acontece antes do I/O por entry (skip cedo). `userId` não
 * filtra entries `kind: 'cancel'` porque cancel é broadcast (sem
 * user_id no filename); um filtro por userId implica "só pending para
 * este user".
 */
export interface ListPendingFilter {
  /** Filtra para arquivos cujo filename embute este `userId`. */
  userId?: string;
  /** Filtra para arquivos cujo filename embute este `sprintId`. */
  sprintId?: string;
}

/**
 * Entry retornada por {@link PendingStore.listPending}.
 *
 * Discriminated union pelo campo `kind`:
 * - `'sprint'` — arquivo de sprint válido, com payload parseado.
 * - `'cancel'` — arquivo de cancelamento válido (broadcast — sem user_id).
 * - `'invalid'` — arquivo malformado (JSON ou schema). Aplica RN-09:
 *   listar continua, caller decide quarentena/log.
 */
export type PendingEntry =
  | { kind: 'sprint'; filename: string; modifiedAt: Date; payload: SprintPayload }
  | { kind: 'cancel'; filename: string; modifiedAt: Date; payload: SprintCancel }
  | { kind: 'invalid'; filename: string; modifiedAt: Date; reason: string };

export class PendingStore {
  constructor(
    private readonly adapter: IFilesystemAdapter,
    private readonly sharedPath: string,
  ) {}

  /**
   * Escreve `<sharedPath>/pending/<sprintId>-<userId>.json` na pasta
   * compartilhada.
   *
   * Sequência (atômica end-to-end via `writeFileAtomic` do adapter):
   * 1. Re-valida payload via `parseSprintPayload` — defesa em profundidade
   *    contra callers que façam cast (`as SprintPayload`) bypassando o
   *    sistema de tipos.
   * 2. Sanitiza `body_html` via `sanitizeBodyHtml` — idempotente, então
   *    é seguro mesmo se o Leader já sanitizou antes (CLAUDE.md §7.9).
   * 3. Deriva filename via `buildPendingFilename` (ADR-006).
   * 4. `mkdir(<sharedPath>/pending)` — Node cria recursivo idempotente;
   *    Memory é no-op. Convenção do contrato (G-018).
   * 5. `writeFileAtomic` com `JSON.stringify(payload, null, 2)`. JSON
   *    pretty-printed (2 espaços) porque a pasta é compartilhada com TI
   *    da fábrica para diagnóstico manual via `notepad`/`type`.
   *
   * @throws {ContractValidationError} se o payload não passar pelo Zod.
   * @throws {FilesystemError} se a escrita falhar (permissão, disco
   *   cheio, etc).
   */
  async writePendingSprint(payload: SprintPayload): Promise<WritePendingResult> {
    const validated = parseSprintPayload(payload);
    const sanitized: SprintPayload = {
      ...validated,
      body_html: sanitizeBodyHtml(validated.body_html),
    };
    const filename = buildPendingFilename(validated.sprint_id, validated.user_id);
    const pendingDir = path.posix.join(this.sharedPath, SHARED_DIRS.PENDING);
    const filepath = path.posix.join(pendingDir, filename);
    await this.adapter.mkdir(pendingDir);
    await this.adapter.writeFileAtomic(filepath, JSON.stringify(sanitized, null, 2));
    return { filename, filepath };
  }

  /**
   * Lista entries da pasta `pending/` (sprint payloads + cancels).
   *
   * Algoritmo:
   * 1. `adapter.listDir(<sharedPath>/pending)` — propaga
   *    `DirectoryNotFoundError` se pasta não existe (precondição do
   *    polling — caller trata).
   * 2. Para cada filename: `safeParseFilename` discrimina pending /
   *    cancel / ack / outro. Acks e nomes desconhecidos são ignorados
   *    silenciosamente (não pertencem ao listing de pending).
   * 3. Filtros (`userId`, `sprintId`) aplicados antes do I/O por entry
   *    para evitar leituras desnecessárias.
   * 4. `adapter.stat(filepath)` para `modifiedAt`. Se arquivo
   *    desapareceu entre `listDir` e `stat` (race em polling
   *    concorrente), skip silencioso.
   * 5. `readAndParseJson` com o parser correto. Race condition
   *    (`kind: 'not-found'`) → skip; corrupção (`kind: 'invalid'`) →
   *    entry com `kind: 'invalid'` aplicando RN-09.
   * 6. Sort ascendente por `modifiedAt` — Agent processa em ordem
   *    cronológica.
   *
   * @throws {DirectoryNotFoundError} se `<sharedPath>/pending` não existe.
   * @throws {FilesystemError} para outros erros de I/O.
   */
  async listPending(filter: ListPendingFilter = {}): Promise<readonly PendingEntry[]> {
    const pendingDir = path.posix.join(this.sharedPath, SHARED_DIRS.PENDING);
    const filenames = await this.adapter.listDir(pendingDir);

    const entries: PendingEntry[] = [];

    for (const filename of filenames) {
      const parsed = safeParseFilename(filename);
      if (!parsed.success) continue;
      if (parsed.data.type === 'ack') continue;

      // Filtros pré-I/O — evita stat+read desnecessários.
      if (filter.sprintId !== undefined && parsed.data.sprintId !== filter.sprintId) {
        continue;
      }
      if (filter.userId !== undefined) {
        // Cancel é broadcast (sem user_id no filename) — filtro por
        // userId implica "só pending deste user, sem cancels".
        if (parsed.data.type === 'cancel') continue;
        if (parsed.data.userId !== filter.userId) continue;
      }

      const filepath = path.posix.join(pendingDir, filename);

      // Race-safe stat
      let modifiedAt: Date;
      try {
        const stats = await this.adapter.stat(filepath);
        modifiedAt = stats.modifiedAt;
      } catch (err) {
        if (err instanceof FileNotFoundError) continue;
        throw err;
      }

      if (parsed.data.type === 'pending') {
        const result = await readAndParseJson(this.adapter, filepath, safeParseSprintPayload);
        if (!result.ok) {
          if (result.kind === 'not-found') continue;
          entries.push({ kind: 'invalid', filename, modifiedAt, reason: result.reason });
          continue;
        }
        entries.push({ kind: 'sprint', filename, modifiedAt, payload: result.data });
      } else {
        // parsed.data.type === 'cancel'
        const result = await readAndParseJson(this.adapter, filepath, safeParseSprintCancel);
        if (!result.ok) {
          if (result.kind === 'not-found') continue;
          entries.push({ kind: 'invalid', filename, modifiedAt, reason: result.reason });
          continue;
        }
        entries.push({ kind: 'cancel', filename, modifiedAt, payload: result.data });
      }
    }

    entries.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime());
    return entries;
  }

  /**
   * Remove arquivo de `pending/` por filename. Caller (Agent, BL-C3-008)
   * usa após processar a sprint (ack escrito, histórico local gravado).
   *
   * Aceita filenames de **pending** e **cancel** (ambos vivem em
   * `pending/`). Rejeita filenames de ack (devem viver em `acks/`) e
   * filenames inválidos.
   *
   * Defesa em profundidade contra path traversal: valida via
   * `safeParseFilename` antes do `unlink` — só nomes que casam com a
   * regex de ULID + userId chegam ao adapter.
   *
   * @throws {FilenameParseError} se o filename não casa com pending ou
   *   cancel.
   * @throws {FileNotFoundError} se o arquivo não existe (do adapter).
   * @throws {FilesystemError} para outros erros de I/O.
   */
  async deletePending(filename: string): Promise<void> {
    const parsed = safeParseFilename(filename);
    if (!parsed.success) {
      throw parsed.error;
    }
    if (parsed.data.type === 'ack') {
      throw new FilenameParseError(filename, 'esperava pending ou cancel, recebeu ack');
    }
    const filepath = path.posix.join(this.sharedPath, SHARED_DIRS.PENDING, filename);
    await this.adapter.unlink(filepath);
  }
}
