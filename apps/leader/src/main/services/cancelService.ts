/**
 * CancelService — orquestra o cancelamento de uma sprint pelo líder
 * (BL-C2-009).
 *
 * Compõe `CancelStore` (com `PendingStore` injetado para remoção de
 * originais) e `LeaderConfig` (origem do `cancelado_por`). Monta o
 * `SprintCancel` (Anexo E) e delega para `CancelStore.writeCancel`.
 *
 * O Agent (BL-C3-011, pollingService.processCancel) detecta o
 * `cancel-*.json` em `pending/` e fecha o overlay sem ack — last
 * write wins (RN-06).
 *
 * @see Requisitos UC-05, RF-11, Anexo E
 * @see ipc-types.ts (`CancelSprintRequest`, `CancelSprintResponse`)
 * @see CancelStore (packages/fs-adapter/src/domain/cancel-store.ts)
 */

import { parseSprintCancel, SCHEMA_VERSION } from '@sprint/contracts';
import type { CancelStore } from '@sprint/fs-adapter';

import type { CancelSprintRequest, CancelSprintResponse } from '../../shared/ipc-types';
import type { LeaderConfig } from '../config';

export class CancelService {
  constructor(
    private readonly cancelStore: CancelStore,
    private readonly config: LeaderConfig,
  ) {}

  /**
   * Grava `cancel-<sprintId>.json` e remove originais ainda em `pending/`.
   *
   * Validações:
   * - `sprint_id` é validado via `parseSprintCancel` (schema do Anexo E —
   *   `sprint_id_ref` exige ULID branded). Erros estruturados
   *   (`ContractValidationError`) sobem para o handler IPC, que serializa
   *   para o renderer.
   * - `motivo` opcional — quando ausente ou whitespace, fica omitido do
   *   payload (Zod `optional()`).
   */
  async cancel(request: CancelSprintRequest): Promise<CancelSprintResponse> {
    const cancel = parseSprintCancel({
      schema_version: SCHEMA_VERSION,
      type: 'cancel',
      // sprint_id_ref do schema (sprintIdSchema branded) faz a validação.
      // Cast intencional para permitir runtime check no parser; valor
      // inválido lança ContractValidationError com contexto do campo.
      sprint_id_ref: request.sprint_id,
      cancelado_por: this.config.criado_por,
      cancelado_em: new Date().toISOString(),
      ...(request.motivo !== undefined && request.motivo.trim().length > 0
        ? { motivo: request.motivo.trim() }
        : {}),
    });

    const result = await this.cancelStore.writeCancel(cancel);

    return {
      filename: result.filename,
      removed_originals: result.removedOriginals,
    };
  }
}
