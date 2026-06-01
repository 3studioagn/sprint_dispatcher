/**
 * CancelStore — operações de domínio sobre arquivos de cancelamento
 * de sprint na pasta compartilhada SMB.
 *
 * Escreve `<sharedPath>/pending/cancel-<sprintId>.json` espelhando o
 * padrão de {@link PendingStore.writePendingSprint}, sem sanitização
 * (cancel não tem `body_html`). Opcionalmente remove os arquivos
 * `<sprintId>-<userId>.json` da sprint cancelada que ainda estão em
 * `pending/` (caller injeta `PendingStore` no construtor).
 *
 * **Last-write-wins** (RN-06): cancel substitui o estado anterior. O
 * Agent (BL-C3-011, pollingService.processCancel) detecta o
 * `cancel-*.json` e fecha o overlay/remove da fila sem ack. Race
 * condition tratada: se o Agent já processou e removeu um original
 * entre o `listPending` e o `deletePending` desta CancelStore, o
 * `FileNotFoundError` é silenciosamente ignorado.
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter; domain layer)
 * @see Requisitos UC-05, RN-06, Anexo E (schema SprintCancel)
 * @see CLAUDE.md §1 — ciclo de cancelamento ponta-a-ponta
 */
import path from 'node:path';

import {
  buildCancelFilename,
  parseSprintCancel,
  SHARED_DIRS,
  type SprintCancel,
} from '@sprint/contracts';

import { FileNotFoundError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

import type { PendingStore } from './pending-store';

/**
 * Metadados retornados por {@link CancelStore.writeCancel}.
 * Espelha {@link WritePendingResult}/{@link WriteAckResult}.
 */
export interface WriteCancelResult {
  /** Nome do arquivo gravado, no formato `cancel-<sprintId>.json`. */
  filename: string;
  /** Caminho absoluto gravado, com separadores POSIX. */
  filepath: string;
  /**
   * Filenames de pending originais da sprint cancelada que foram
   * removidos. Vazio se `pendingStore` não foi injetado, ou se nenhum
   * arquivo da sprint estava mais em `pending/` (Agent já processou).
   */
  removedOriginals: readonly string[];
}

export class CancelStore {
  constructor(
    private readonly adapter: IFilesystemAdapter,
    private readonly sharedPath: string,
    /**
     * `PendingStore` opcional. Quando injetado (uso de produção),
     * `writeCancel` localiza e remove os arquivos `<sprintId>-<userId>.json`
     * da sprint cancelada que ainda estão em `pending/`. Quando ausente
     * (testes isolados de escrita pura), apenas grava o `cancel-*.json`.
     */
    private readonly pendingStore?: PendingStore,
  ) {}

  /**
   * Escreve `<sharedPath>/pending/cancel-<sprintId>.json` na pasta
   * compartilhada e (opcionalmente) remove os originais pendentes da
   * sprint cancelada.
   *
   * Sequência:
   * 1. Re-valida payload via `parseSprintCancel` — defesa em profundidade
   *    contra callers que façam cast (`as SprintCancel`) bypassando o
   *    sistema de tipos.
   * 2. Deriva filename via `buildCancelFilename` (ADR-006).
   * 3. `mkdir(<sharedPath>/pending)` — idempotente (G-018).
   * 4. `writeFileAtomic` com `JSON.stringify(cancel, null, 2)`. Pretty-print
   *    consistente com pending para diagnóstico manual em campo.
   * 5. Se `pendingStore` foi injetado: `listPending({ sprintId })` filtra
   *    entries da sprint cancelada (sprint + cancel — o cancel recém-gravado
   *    é ignorado). Para cada entry com `kind: 'sprint'`, tenta
   *    `deletePending(filename)`. `FileNotFoundError` é ignorado (Agent
   *    pode ter processado entre o list e o delete).
   *
   * @throws {ContractValidationError} se o cancel não passar pelo Zod.
   * @throws {FilesystemError} se a escrita falhar (permissão, disco cheio).
   */
  async writeCancel(cancel: SprintCancel): Promise<WriteCancelResult> {
    const validated = parseSprintCancel(cancel);
    const filename = buildCancelFilename(validated.sprint_id_ref);
    const pendingDir = path.posix.join(this.sharedPath, SHARED_DIRS.PENDING);
    const filepath = path.posix.join(pendingDir, filename);
    await this.adapter.mkdir(pendingDir);
    await this.adapter.writeFileAtomic(filepath, JSON.stringify(validated, null, 2));

    const removedOriginals = await this.removeOriginalsForSprint(validated.sprint_id_ref);

    return { filename, filepath, removedOriginals };
  }

  /**
   * Localiza e remove arquivos `<sprintId>-<userId>.json` da sprint
   * cancelada ainda presentes em `pending/`. No-op se `pendingStore`
   * não foi injetado no construtor.
   *
   * Race-safe: arquivos que desapareceram entre `listPending` e
   * `deletePending` (Agent processou) são silenciosamente pulados.
   * Outros erros propagam.
   */
  private async removeOriginalsForSprint(sprintId: string): Promise<readonly string[]> {
    if (this.pendingStore === undefined) return [];

    const entries = await this.pendingStore.listPending({ sprintId });
    const removed: string[] = [];

    for (const entry of entries) {
      if (entry.kind !== 'sprint') continue;
      try {
        await this.pendingStore.deletePending(entry.filename);
        removed.push(entry.filename);
      } catch (err) {
        if (err instanceof FileNotFoundError) continue;
        throw err;
      }
    }

    return removed;
  }
}
