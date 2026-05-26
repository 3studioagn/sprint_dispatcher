/**
 * Helper de fixtures para testes de componentes/hooks do renderer.
 *
 * Re-exporta `parseSprintPayload` aplicando defaults para campos não-overridados
 * por opts — branded types (SprintId, UserId) são produzidos sem cast.
 */

import { parseSprintPayload, type SprintPayload } from '@sprint/contracts';

export const VALID_SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

export interface MakePayloadOpts {
  sprintId?: string;
  userId?: string;
  bodyHtml?: string;
  title?: string;
  meta?: number;
  deadlineIso?: string;
}

export function makePayload(opts: MakePayloadOpts = {}): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId ?? VALID_SPRINT_ID,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: opts.userId ?? 'joao',
    title: opts.title ?? 'É hora de correr',
    body_html: opts.bodyHtml ?? 'Meta do dia',
    meta: opts.meta ?? 5,
    deadline_at: opts.deadlineIso ?? '2026-05-26T21:00:00.000Z',
  });
}
