/**
 * ArchiveStore — histórico compartilhado de sprints/acks processados.
 *
 * Move arquivos de `pending/` e `acks/` para `arquivo/<YYYY-MM-DD>/`,
 * onde `<YYYY-MM-DD>` é a **data de origem da sprint** (derivada do
 * timestamp embutido no ULID do `sprint_id` — UTC). Sprint e seu ack
 * pareado terminam juntos na mesma pasta de data (Anexo A). Também expõe
 * a **leitura** do histórico (`listArchive`/`readArchivedSprint`) que
 * destrava a tela de histórico do Leader (BL-C2-010).
 *
 * Distinção importante: este `arquivo/` é o histórico **compartilhado no
 * servidor** (auditoria, UC-07). É diferente do histórico **local** de
 * cada estação (`<userData>/historico/`, BL-C3-008/009, responsabilidade
 * do Agent). Não confundir os dois.
 *
 * Robustez (ADR-025):
 * - **Move atômico**: tenta `rename` (atômico no mesmo volume). Se falhar
 *   com `EXDEV` (`arquivo/` em mount diferente de `pending/`), faz
 *   fallback copy (read + writeFileAtomic com fsync) + unlink.
 * - **Anti-overwrite**: nunca sobrescreve um arquivo já no destino. Se já
 *   existe (move interrompido / idempotência), apenas remove o original
 *   redundante e reporta `already-archived`.
 * - **Tolerância a corrida**: `source-missing` (arquivo já consumido por
 *   outra execução / Agent) é benigno, não lança.
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter; domain layer)
 * @see DECISIONS.md ADR-025 (política de arquivamento e retenção)
 * @see Requisitos Anexo A (estrutura `arquivo/<YYYY-MM-DD>/`), UC-07
 */
import path from 'node:path';

import {
  buildAckFilename,
  decodeUlidTime,
  FilenameParseError,
  formatArchiveDate,
  isArchiveDateFolder,
  safeParseFilename,
  safeParseSprintAck,
  safeParseSprintPayload,
  SHARED_DIRS,
  type SprintAck,
  type SprintPayload,
} from '@sprint/contracts';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

import { readAndParseJson } from './read-and-parse';

/**
 * Desfecho de uma operação de arquivamento.
 *
 * - `'archived'`: arquivo movido agora para `arquivo/<data>/`.
 * - `'already-archived'`: destino já existia (move interrompido ou
 *   chamada idempotente); o original redundante foi removido sem
 *   sobrescrever o destino.
 * - `'source-missing'`: nada havia para mover (já processado / corrida);
 *   benigno.
 */
export type ArchiveOutcome = 'archived' | 'already-archived' | 'source-missing';

/** Resultado de {@link ArchiveStore.archiveSprint}. */
export interface ArchiveSprintResult {
  outcome: ArchiveOutcome;
  /** Pasta de data (YYYY-MM-DD) derivada do ULID da sprint. */
  date: string;
  /** Nome do arquivo de sprint (`<sprintId>-<userId>.json`). */
  sprintFilename: string;
  /** Path de destino do `.json`, ou `null` se `source-missing`. */
  sprintArchivedTo: string | null;
  /** Nome do ack movido junto, ou `null` se não havia ack pareado. */
  ackFilename: string | null;
  /** Path de destino do `.ack.json`, ou `null` se não havia ack. */
  ackArchivedTo: string | null;
}

/** Resultado de {@link ArchiveStore.archiveAck}. */
export interface ArchiveAckResult {
  outcome: ArchiveOutcome;
  /** Pasta de data (YYYY-MM-DD) derivada do ULID embutido no ack. */
  date: string;
  /** Nome do arquivo de ack (`<sprintId>-<userId>.ack.json`). */
  ackFilename: string;
  /** Path de destino do `.ack.json`, ou `null` se `source-missing`. */
  ackArchivedTo: string | null;
}

/** Filtro opcional aplicado a {@link ArchiveStore.listArchive}. */
export interface ListArchiveFilter {
  /** Filtra para uma pasta de data específica (`YYYY-MM-DD`). */
  date?: string;
  /** Filtra para sprints de um operador específico. */
  userId?: string;
}

/**
 * Referência leve a uma sprint arquivada, retornada por
 * {@link ArchiveStore.listArchive}. Contém o suficiente para a UI listar
 * e para {@link ArchiveStore.readArchivedSprint} ler os detalhes.
 */
export interface ArchivedSprintRef {
  /** Pasta de data (`YYYY-MM-DD`). */
  date: string;
  /** ULID da sprint. */
  sprintId: string;
  /** userId do operador. */
  userId: string;
  /** Nome do arquivo da sprint. */
  sprintFilename: string;
  /** `true` se o ack pareado existe na mesma pasta de data. */
  hasAck: boolean;
}

/**
 * Detalhes de uma sprint arquivada, retornados por
 * {@link ArchiveStore.readArchivedSprint}.
 */
export interface ArchivedSprint {
  /** Payload da sprint (sempre presente). */
  payload: SprintPayload;
  /** Ack pareado, quando existe e é válido. */
  ack?: SprintAck;
}

export class ArchiveStore {
  constructor(
    private readonly adapter: IFilesystemAdapter,
    private readonly sharedPath: string,
  ) {}

  /**
   * Arquiva uma sprint de `pending/` (e seu ack pareado de `acks/`, se
   * existir) para `arquivo/<data-de-origem>/`.
   *
   * A data é derivada do ULID embutido no `sprint_id` (UTC) — **não lê o
   * conteúdo do arquivo**, então funciona mesmo para sprints com JSON
   * corrompido. Cria a pasta de data (recursivo, idempotente). Move
   * atômico com fallback `EXDEV`. Não sobrescreve destino existente.
   *
   * @param sprintFilename - nome `<sprintId>-<userId>.json` (de `pending/`).
   * @throws {FilenameParseError} se o nome não for de uma sprint pending.
   * @throws {FilesystemError} em erros de I/O não-benignos.
   */
  async archiveSprint(sprintFilename: string): Promise<ArchiveSprintResult> {
    const parsed = safeParseFilename(sprintFilename);
    if (!parsed.success) {
      throw parsed.error;
    }
    if (parsed.data.type !== 'pending') {
      throw new FilenameParseError(
        sprintFilename,
        'archiveSprint espera um arquivo de sprint pending (<sprintId>-<userId>.json)',
      );
    }
    const { sprintId, userId } = parsed.data;
    const date = formatArchiveDate(decodeUlidTime(sprintId));
    const dateDir = this.dateDir(date);

    const sprintFrom = path.posix.join(this.sharedPath, SHARED_DIRS.PENDING, sprintFilename);
    const sprintTo = path.posix.join(dateDir, sprintFilename);

    // Corrida: outra execução (ou o Agent) já processou — benigno.
    if (!(await this.adapter.exists(sprintFrom))) {
      return {
        outcome: 'source-missing',
        date,
        sprintFilename,
        sprintArchivedTo: null,
        ackFilename: null,
        ackArchivedTo: null,
      };
    }

    await this.adapter.mkdir(dateDir);
    const outcome = await this.relocate(sprintFrom, sprintTo);

    // Ack pareado (mesmo <sprintId>-<userId>, em acks/).
    const ackFilename = buildAckFilename(sprintId, userId);
    const ackFrom = path.posix.join(this.sharedPath, SHARED_DIRS.ACKS, ackFilename);
    const ackTo = path.posix.join(dateDir, ackFilename);
    let movedAckFilename: string | null = null;
    let ackArchivedTo: string | null = null;
    if (await this.adapter.exists(ackFrom)) {
      await this.relocate(ackFrom, ackTo);
      movedAckFilename = ackFilename;
      ackArchivedTo = ackTo;
    }

    return {
      outcome,
      date,
      sprintFilename,
      sprintArchivedTo: sprintTo,
      ackFilename: movedAckFilename,
      ackArchivedTo,
    };
  }

  /**
   * Arquiva um ack **órfão** de `acks/` (cuja sprint já não está em
   * `pending/`, p.ex. já processada e deletada pelo Agent) para
   * `arquivo/<data-de-origem>/`. A data vem do ULID embutido no ack, de
   * modo que o ack órfão cai na mesma pasta de data que sua sprint teria.
   *
   * @param ackFilename - nome `<sprintId>-<userId>.ack.json` (de `acks/`).
   * @throws {FilenameParseError} se o nome não for de um ack.
   * @throws {FilesystemError} em erros de I/O não-benignos.
   */
  async archiveAck(ackFilename: string): Promise<ArchiveAckResult> {
    const parsed = safeParseFilename(ackFilename);
    if (!parsed.success) {
      throw parsed.error;
    }
    if (parsed.data.type !== 'ack') {
      throw new FilenameParseError(
        ackFilename,
        'archiveAck espera um arquivo de ack (<sprintId>-<userId>.ack.json)',
      );
    }
    const date = formatArchiveDate(decodeUlidTime(parsed.data.sprintId));
    const dateDir = this.dateDir(date);
    const from = path.posix.join(this.sharedPath, SHARED_DIRS.ACKS, ackFilename);
    const to = path.posix.join(dateDir, ackFilename);

    if (!(await this.adapter.exists(from))) {
      return { outcome: 'source-missing', date, ackFilename, ackArchivedTo: null };
    }

    await this.adapter.mkdir(dateDir);
    const outcome = await this.relocate(from, to);
    return { outcome, date, ackFilename, ackArchivedTo: to };
  }

  /**
   * Lista as sprints arquivadas, opcionalmente filtradas por data e/ou
   * operador. Varre `arquivo/`, ignora entradas que não são pastas de
   * data (`log-limpeza.txt`, `.tmp` órfãos) e, em cada pasta, parea cada
   * sprint com a existência do seu ack.
   *
   * Não lança se `arquivo/` ainda não existe (histórico vazio → `[]`).
   * Ordenado por data e depois por `sprintId` (ULID = ordem cronológica).
   *
   * @throws {FilesystemError} em erros de I/O não-benignos.
   */
  async listArchive(filter: ListArchiveFilter = {}): Promise<readonly ArchivedSprintRef[]> {
    const archiveDir = path.posix.join(this.sharedPath, SHARED_DIRS.ARCHIVE);
    let folders: string[];
    try {
      folders = await this.adapter.listDir(archiveDir);
    } catch (err) {
      if (err instanceof DirectoryNotFoundError) return [];
      throw err;
    }

    const refs: ArchivedSprintRef[] = [];
    for (const folder of folders) {
      if (!isArchiveDateFolder(folder)) continue;
      if (filter.date !== undefined && folder !== filter.date) continue;

      const dateDir = path.posix.join(archiveDir, folder);
      let files: string[];
      try {
        files = await this.adapter.listDir(dateDir);
      } catch (err) {
        // Pasta sumiu entre os dois listDir (corrida) — pula.
        if (err instanceof DirectoryNotFoundError || err instanceof FileNotFoundError) continue;
        throw err;
      }

      const ackStems = new Set<string>();
      const sprints: { sprintId: string; userId: string; filename: string }[] = [];
      for (const file of files) {
        const p = safeParseFilename(file);
        if (!p.success) continue;
        if (p.data.type === 'ack') {
          ackStems.add(`${p.data.sprintId}-${p.data.userId}`);
        } else if (p.data.type === 'pending') {
          sprints.push({ sprintId: p.data.sprintId, userId: p.data.userId, filename: file });
        }
        // 'cancel' e nomes desconhecidos não aparecem no histórico de sprints.
      }

      for (const s of sprints) {
        if (filter.userId !== undefined && s.userId !== filter.userId) continue;
        refs.push({
          date: folder,
          sprintId: s.sprintId,
          userId: s.userId,
          sprintFilename: s.filename,
          hasAck: ackStems.has(`${s.sprintId}-${s.userId}`),
        });
      }
    }

    refs.sort((a, b) =>
      a.date === b.date ? a.sprintId.localeCompare(b.sprintId) : a.date.localeCompare(b.date),
    );
    return refs;
  }

  /**
   * Lê os detalhes de uma sprint arquivada (payload + ack, se presente e
   * válido) a partir de uma {@link ArchivedSprintRef} obtida via
   * {@link listArchive}.
   *
   * @throws {FileNotFoundError} se o `.json` da sprint não existe mais.
   * @throws {FilesystemIOError} se o `.json` da sprint está corrompido.
   */
  async readArchivedSprint(ref: ArchivedSprintRef): Promise<ArchivedSprint> {
    const dateDir = this.dateDir(ref.date);
    const sprintPath = path.posix.join(dateDir, ref.sprintFilename);

    const sprintResult = await readAndParseJson(this.adapter, sprintPath, safeParseSprintPayload);
    if (!sprintResult.ok) {
      if (sprintResult.kind === 'not-found') {
        throw new FileNotFoundError(sprintPath);
      }
      throw new FilesystemIOError(sprintPath, `sprint arquivada inválida: ${sprintResult.reason}`);
    }

    const ackFilename = buildAckFilename(ref.sprintId, ref.userId);
    const ackPath = path.posix.join(dateDir, ackFilename);
    const ackResult = await readAndParseJson(this.adapter, ackPath, safeParseSprintAck);
    if (ackResult.ok) {
      return { payload: sprintResult.data, ack: ackResult.data };
    }
    // Ack ausente ou inválido → retorna só o payload.
    // `exactOptionalPropertyTypes`: omitir a chave em vez de `ack: undefined`.
    return { payload: sprintResult.data };
  }

  private dateDir(date: string): string {
    return path.posix.join(this.sharedPath, SHARED_DIRS.ARCHIVE, date);
  }

  /**
   * Move `from` → `to` aplicando a política anti-overwrite. Se `to` já
   * existe, NÃO sobrescreve; remove o original redundante (move
   * interrompido / idempotência — `sprint_id` é ULID único, então o
   * destino é a cópia canônica) e reporta `already-archived`.
   */
  private async relocate(from: string, to: string): Promise<ArchiveOutcome> {
    if (await this.adapter.exists(to)) {
      await this.safeUnlink(from);
      return 'already-archived';
    }
    await this.moveFile(from, to);
    return 'archived';
  }

  /**
   * Move atômico com fallback cross-device. Tenta `rename`; em `EXDEV`
   * (origem e destino em volumes diferentes), copia (read + writeFileAtomic
   * com fsync) e remove o original.
   */
  private async moveFile(from: string, to: string): Promise<void> {
    try {
      await this.adapter.rename(from, to);
    } catch (err) {
      if (!isCrossDeviceError(err)) throw err;
      const content = await this.adapter.readFile(from);
      await this.adapter.writeFileAtomic(to, content);
      await this.safeUnlink(from);
    }
  }

  /** `unlink` que trata `FileNotFoundError` (corrida) como benigno. */
  private async safeUnlink(filepath: string): Promise<void> {
    try {
      await this.adapter.unlink(filepath);
    } catch (err) {
      if (err instanceof FileNotFoundError) return;
      throw err;
    }
  }
}

/**
 * `true` se o erro é um cross-device link (`EXDEV`) — `arquivo/` em mount
 * diferente de `pending/`/`acks/`. O `NodeFilesystemAdapter` mapeia `EXDEV`
 * para {@link FilesystemIOError} preservando o `cause` original do Node.
 */
function isCrossDeviceError(err: unknown): boolean {
  if (!(err instanceof FilesystemIOError)) return false;
  const cause = err.cause as NodeJS.ErrnoException | undefined;
  return cause?.code === 'EXDEV';
}
