/**
 * DispatchService — orquestra construção e escrita de `SprintPayload`
 * por operador.
 *
 * Composição (injeção de dependência via construtor):
 * - `PendingStore` (@sprint/fs-adapter) — escreve atomicamente em
 *   `<shared_path>/pending/<sprintId>-<userId>.json`.
 * - `OperatorsService` — resolve `user_nome_exibicao` para o feedback
 *   `per_operator` exibido no DispatchModal.
 * - `LeaderConfig` — fornece `criado_por` para o payload.
 *
 * Cada operador é processado em **try/catch isolado** — falha de 1
 * (permissão, disco cheio, race) não impede os outros. Retorna
 * `DispatchSprintResponse` com summary agregado.
 *
 * Helpers `resolveDeadlineIso` e `substituteMeta` exportados para
 * teste isolado.
 *
 * @see CLAUDE.md §4 (estrutura interna do Leader)
 * @see DECISIONS.md ADR-015 (composer Leader)
 * @see DECISIONS.md ADR-016 (domain layer fs-adapter)
 */

import {
  generateSprintId,
  parseSprintPayload,
  sanitizeBodyHtml,
  SCHEMA_VERSION,
} from '@sprint/contracts';
import type { PendingStore } from '@sprint/fs-adapter';

import type {
  DispatchSprintPerOperatorResult,
  DispatchSprintRequest,
  DispatchSprintResponse,
} from '../../shared/ipc-types';
import type { LeaderConfig } from '../config';

import type { OperatorsService } from './operatorsService';

const DEFAULT_TITLE = 'É hora de correr';
const DEFAULT_BODY_TEMPLATE = 'Sua meta até o final do dia é de: <b>{meta} artes</b>';

/** Regex HH:MM 00–23:00–59. Exportado para reuso e teste. */
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Threshold (ms) acima do qual deadline "passado" avança para amanhã. */
const DEADLINE_PAST_TOLERANCE_MS = 30 * 60 * 1000;

/**
 * Converte `HH:MM` em ISO datetime relativo a `now`.
 *
 * Regra D1 (Gate 1 desta sessão): se `HH:MM` já passou em **mais de 30
 * minutos** de `now`, avança para o mesmo horário no dia seguinte;
 * senão (futuro ou passado ≤30min) usa o dia de hoje. Cobre os
 * cenários:
 * - 14:00 com deadline 18:00 → hoje 18:00 (futuro)
 * - 18:05 com deadline 18:00 → hoje 18:00 (passou ≤30min)
 * - 19:30 com deadline 18:00 → amanhã 18:00 (passou >30min)
 *
 * @throws {Error} Se `hhmm` não casa com `HH:MM` 24h.
 */
export function resolveDeadlineIso(hhmm: string, now: Date): string {
  const match = HHMM_REGEX.exec(hhmm);
  if (match === null) {
    throw new Error(`Formato HH:MM inválido: "${hhmm}"`);
  }
  const hoursStr = match[1];
  const minutesStr = match[2];
  if (hoursStr === undefined || minutesStr === undefined) {
    throw new Error(`Formato HH:MM inválido: "${hhmm}"`);
  }
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);

  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);

  const elapsedMs = now.getTime() - candidate.getTime();
  if (elapsedMs > DEADLINE_PAST_TOLERANCE_MS) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString();
}

/**
 * Substitui ocorrências de `{meta}` no body por o valor numérico
 * literal. Decisão D2 (Gate 1): substituição acontece no main, antes
 * da escrita, para manter o Agent "burro" (renderiza HTML já final).
 */
export function substituteMeta(body: string, meta: number): string {
  return body.replaceAll('{meta}', String(meta));
}

export class DispatchService {
  constructor(
    private readonly pendingStore: PendingStore,
    private readonly operatorsService: OperatorsService,
    private readonly config: LeaderConfig,
  ) {}

  /**
   * Orquestra dispatch para a lista de operadores selecionados.
   *
   * Sequência:
   * 1. Lê `operators.json` para resolver `user_nome_exibicao` no feedback.
   * 2. Gera `sprint_id` (ULID) **uma única vez** — compartilhado entre
   *    todos os operadores.
   * 3. Resolve `deadline_at` ISO via `resolveDeadlineIso`.
   * 4. Para cada operador: substitui `{meta}`, sanitiza, valida via
   *    `parseSprintPayload`, escreve via `PendingStore.writePendingSprint`.
   *    try/catch isolado por user — falha em 1 não impede os outros.
   *
   * Não lança — todos os caminhos retornam `DispatchSprintResponse`.
   * Falhas individuais ficam em `per_operator[i].status: 'error'` com
   * `error_message` legível.
   */
  async dispatch(request: DispatchSprintRequest): Promise<DispatchSprintResponse> {
    const operatorsResponse = await this.operatorsService.list();
    const operatorById = new Map(
      operatorsResponse.operators.map((op) => [op.user_id, op] as const),
    );

    const sprintId = generateSprintId();
    const createdAt = new Date().toISOString();
    const deadlineIso = resolveDeadlineIso(request.deadline, new Date());

    const perOperator: DispatchSprintPerOperatorResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const sel of request.selected) {
      const operator = operatorById.get(sel.user_id);
      const displayName = operator?.user_nome_exibicao ?? sel.user_id;

      try {
        const sanitizedBody = sanitizeBodyHtml(substituteMeta(DEFAULT_BODY_TEMPLATE, sel.meta));
        const payload = parseSprintPayload({
          schema_version: SCHEMA_VERSION,
          sprint_id: sprintId,
          criado_por: this.config.criado_por,
          criado_em: createdAt,
          user_id: sel.user_id,
          title: DEFAULT_TITLE,
          body_html: sanitizedBody,
          meta: sel.meta,
          deadline_at: deadlineIso,
        });
        const { filename } = await this.pendingStore.writePendingSprint(payload);
        perOperator.push({
          user_id: sel.user_id,
          user_nome_exibicao: displayName,
          status: 'success',
          filename,
        });
        successCount += 1;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        perOperator.push({
          user_id: sel.user_id,
          user_nome_exibicao: displayName,
          status: 'error',
          error_message: errMsg,
        });
        failedCount += 1;
      }
    }

    return {
      sprint_id: sprintId,
      per_operator: perOperator,
      summary: {
        total: request.selected.length,
        success: successCount,
        failed: failedCount,
      },
    };
  }
}
