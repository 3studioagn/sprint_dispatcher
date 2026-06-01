/**
 * AckTrackingService — agrega acks para a tela de acompanhamento
 * (BL-C2-008).
 *
 * Composição (injeção de dependência via construtor):
 * - `AckStore` (@sprint/fs-adapter) — lê `<shared_path>/acks/` filtrado
 *   por `sprintId`.
 * - `OperatorsService` — resolve `user_nome_exibicao` para cada target,
 *   espelhando o que `DispatchService` faz no momento do envio.
 *
 * Estado derivado por target (Anexo D):
 * - `nao_visto`: nenhum ack para o par (sprint_id, user_id).
 * - `visto`: ack existe com `displayed_at` mas sem `acknowledged_at`.
 * - `confirmado`: ack existe com `acknowledged_at` populado.
 *
 * Endpoint leve — chamado em polling 3s pela tela. Tolerante a entries
 * `kind: 'invalid'` (RN-09): pulam silenciosamente, não derrubam o response.
 *
 * @see Requisitos UC-04, RF-10, Anexo D
 * @see ipc-types.ts (`AckStateView`, `ListAcksResponse`)
 */

import { DirectoryNotFoundError, type AckStore } from '@sprint/fs-adapter';

import type { AckStateView, ListAcksResponse } from '../../shared/ipc-types';

import type { OperatorsService } from './operatorsService';

export interface AckTrackingTarget {
  /** ID do operador participante da sprint. */
  user_id: string;
}

export class AckTrackingService {
  constructor(
    private readonly ackStore: AckStore,
    private readonly operatorsService: OperatorsService,
  ) {}

  /**
   * Consulta acks da sprint e devolve o estado de cada target.
   *
   * Sequência:
   * 1. `operatorsService.list()` para resolver `user_nome_exibicao`. Falha
   *    é propagada (config inválida ou operators.json corrompido — main
   *    serializa via IpcResult).
   * 2. `ackStore.listAcks({ sprintId })` para puxar acks da sprint.
   * 3. Mapa `user_id → SprintAck` a partir das entries `kind: 'ack'`. Entries
   *    `kind: 'invalid'` são ignoradas (RN-09 — UI não sabe que existem;
   *    audit fica no log futuro do main).
   * 4. Itera targets na ordem informada pelo caller, derivando estado por
   *    presença de `displayed_at`/`acknowledged_at` no ack correspondente.
   */
  async list(sprintId: string, targets: readonly AckTrackingTarget[]): Promise<ListAcksResponse> {
    const operatorsResponse = await this.operatorsService.list();
    const operatorById = new Map(
      operatorsResponse.operators.map((op) => [op.user_id, op] as const),
    );

    // Pasta `acks/` pode ainda não existir (nenhum operador rodou polling
    // do Agent + escreveu ack ainda). Cenário benigno — todos os targets
    // ficam `nao_visto` até algum ack aparecer.
    let ackEntries: Awaited<ReturnType<typeof this.ackStore.listAcks>> = [];
    try {
      ackEntries = await this.ackStore.listAcks({ sprintId });
    } catch (err) {
      if (!(err instanceof DirectoryNotFoundError)) {
        throw err;
      }
    }
    const ackByUserId = new Map<string, AckStateView>();
    for (const entry of ackEntries) {
      if (entry.kind !== 'ack') continue;
      const payload = entry.payload;
      const operator = operatorById.get(payload.user_id);
      const displayName = operator?.user_nome_exibicao ?? payload.user_id;
      const view: AckStateView = {
        user_id: payload.user_id,
        user_nome_exibicao: displayName,
        state: payload.acknowledged_at !== undefined ? 'confirmado' : 'visto',
        displayed_at: payload.displayed_at,
        hostname: payload.hostname,
        ...(payload.acknowledged_at !== undefined
          ? { acknowledged_at: payload.acknowledged_at }
          : {}),
      };
      ackByUserId.set(payload.user_id, view);
    }

    const targetsView: AckStateView[] = targets.map((target) => {
      const ack = ackByUserId.get(target.user_id);
      if (ack !== undefined) {
        return ack;
      }
      const operator = operatorById.get(target.user_id);
      return {
        user_id: target.user_id,
        user_nome_exibicao: operator?.user_nome_exibicao ?? target.user_id,
        state: 'nao_visto',
      };
    });

    return {
      targets: targetsView,
      checked_at: new Date().toISOString(),
    };
  }
}
