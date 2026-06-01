/**
 * AckStore — operações de domínio sobre a pasta `acks/` da pasta
 * compartilhada SMB.
 *
 * Composição (port-and-adapter): recebe um {@link IFilesystemAdapter}
 * e o `sharedPath` da config como dependências. Espelha o padrão de
 * {@link PendingStore} — diferenças:
 *
 * 1. Sem sanitização: `SprintAck` não tem `body_html`.
 * 2. Overwrite é caso de uso explícito (BL-C4-006): Agent escreve o
 *    ack inicial com `displayed_at` quando o overlay aparece; reescreve
 *    o mesmo arquivo com `acknowledged_at` adicionado quando o operador
 *    clica em "OK, entendi". `writeFileAtomic` do adapter sobrescreve
 *    naturalmente via `rename`.
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter)
 * @see Requisitos RF-09 (Anexo D)
 * @see CLAUDE.md §7.9 — sanitização não se aplica a ack
 */
import path from 'node:path';

import {
  buildAckFilename,
  parseSprintAck,
  safeParseFilename,
  safeParseSprintAck,
  SHARED_DIRS,
  type SprintAck,
} from '@sprint/contracts';

import { FileNotFoundError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

import { readAndParseJson } from './read-and-parse';

/**
 * Metadados retornados por {@link AckStore.writeAck}. Caller (Agent)
 * usa para logging e tracking opcional.
 */
export interface WriteAckResult {
  /** Nome do arquivo gravado, no formato `<sprintId>-<userId>.ack.json`. */
  filename: string;
  /** Caminho absoluto gravado, com separadores POSIX. */
  filepath: string;
}

/**
 * Filtro opcional aplicado a {@link AckStore.listAcks}.
 *
 * Diferente de {@link ListPendingFilter}, ack tem `user_id` no filename
 * sempre — `userId` filtra normalmente.
 */
export interface ListAcksFilter {
  /** Filtra para acks cujo filename embute este `userId`. */
  userId?: string;
  /** Filtra para acks cujo filename embute este `sprintId`. */
  sprintId?: string;
}

/**
 * Entry retornada por {@link AckStore.listAcks}.
 *
 * Discriminated union pelo campo `kind`:
 * - `'ack'` — ack válido, com payload parseado.
 * - `'invalid'` — arquivo malformado (JSON ou schema). RN-09: listar
 *   continua, caller decide quarentena/log.
 */
export type AckEntry =
  | { kind: 'ack'; filename: string; modifiedAt: Date; payload: SprintAck }
  | { kind: 'invalid'; filename: string; modifiedAt: Date; reason: string };

export class AckStore {
  constructor(
    private readonly adapter: IFilesystemAdapter,
    private readonly sharedPath: string,
  ) {}

  /**
   * Escreve `<sharedPath>/acks/<sprintId>-<userId>.ack.json`.
   *
   * Sequência:
   * 1. Re-valida via `parseSprintAck` — defesa em profundidade contra
   *    callers que façam cast (`as SprintAck`) bypassando o sistema de
   *    tipos.
   * 2. Deriva filename via `buildAckFilename` (ADR-006).
   * 3. `mkdir(<sharedPath>/acks)` — Node cria recursivo idempotente;
   *    Memory é no-op (G-018).
   * 4. `writeFileAtomic` com `JSON.stringify(ack, null, 2)`. Pretty-print
   *    consistente com pending para diagnóstico manual em campo.
   *
   * **Overwrite explícito** (BL-C4-006): chamadas sucessivas com mesmo
   * `sprint_id` + `user_id` produzem o mesmo path; o `writeFileAtomic`
   * sobrescreve o anterior via `rename`. Use para atualizar o ack
   * adicionando `acknowledged_at` depois do `displayed_at`.
   *
   * @throws {ContractValidationError} se o ack não passar pelo Zod.
   * @throws {FilesystemError} se a escrita falhar.
   */
  async writeAck(ack: SprintAck): Promise<WriteAckResult> {
    const validated = parseSprintAck(ack);
    const filename = buildAckFilename(validated.sprint_id, validated.user_id);
    const acksDir = path.posix.join(this.sharedPath, SHARED_DIRS.ACKS);
    const filepath = path.posix.join(acksDir, filename);
    await this.adapter.mkdir(acksDir);
    await this.adapter.writeFileAtomic(filepath, JSON.stringify(validated, null, 2));
    return { filename, filepath };
  }

  /**
   * Lista entries da pasta `acks/`. Algoritmo espelha
   * {@link PendingStore.listPending} — só ack files, sem cancel.
   *
   * @throws {DirectoryNotFoundError} se `<sharedPath>/acks` não existe.
   * @throws {FilesystemError} para outros erros de I/O.
   */
  async listAcks(filter: ListAcksFilter = {}): Promise<readonly AckEntry[]> {
    const acksDir = path.posix.join(this.sharedPath, SHARED_DIRS.ACKS);
    const filenames = await this.adapter.listDir(acksDir);

    const entries: AckEntry[] = [];

    for (const filename of filenames) {
      const parsed = safeParseFilename(filename);
      if (!parsed.success) continue;
      if (parsed.data.type !== 'ack') continue;

      // Filtros pré-I/O
      if (filter.sprintId !== undefined && parsed.data.sprintId !== filter.sprintId) {
        continue;
      }
      if (filter.userId !== undefined && parsed.data.userId !== filter.userId) {
        continue;
      }

      const filepath = path.posix.join(acksDir, filename);

      // Race-safe stat
      let modifiedAt: Date;
      try {
        const stats = await this.adapter.stat(filepath);
        modifiedAt = stats.modifiedAt;
      } catch (err) {
        if (err instanceof FileNotFoundError) continue;
        throw err;
      }

      const result = await readAndParseJson(this.adapter, filepath, safeParseSprintAck);
      if (!result.ok) {
        if (result.kind === 'not-found') continue;
        entries.push({ kind: 'invalid', filename, modifiedAt, reason: result.reason });
        continue;
      }
      entries.push({ kind: 'ack', filename, modifiedAt, payload: result.data });
    }

    entries.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime());
    return entries;
  }
}
