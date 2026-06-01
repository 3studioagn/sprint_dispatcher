import type {
  AgentConfigInput,
  SprintAckInput,
  SprintCancelInput,
  SprintPayloadInput,
} from '../index';

/**
 * ULID válido de referência usado pelas fixtures.
 *
 * Nota: o exemplo `01HX9K2M4F8N7P2Q5R3S6T7U8V` que circula em prompts e
 * issues contém um `U` no índice 23 — inválido em Crockford Base32, que
 * exclui I, L, O, U. Usamos `...V8W` (sem caracteres ambíguos).
 */
const SAMPLE_SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

export const validSprintPayload: SprintPayloadInput = {
  schema_version: '1.0',
  sprint_id: SAMPLE_SPRINT_ID,
  criado_por: 'renan',
  criado_em: '2026-05-21T14:32:10-03:00',
  user_id: 'joao',
  title: 'É hora de correr',
  body_html: 'Sua meta até o final do dia é de: <b>8 artes</b>',
  meta: 8,
  deadline_at: '2026-05-21T18:00:00-03:00',
  show_duration_seconds: 5,
  persistent_popup: true,
};

export const validSprintAck: SprintAckInput = {
  schema_version: '1.0',
  sprint_id: SAMPLE_SPRINT_ID,
  user_id: 'joao',
  hostname: 'ART-DESIGN-04',
  displayed_at: '2026-05-21T14:32:13-03:00',
  acknowledged_at: '2026-05-21T14:32:18-03:00',
  agent_version: '1.0.0',
};

export const validSprintCancel: SprintCancelInput = {
  schema_version: '1.0',
  type: 'cancel',
  sprint_id_ref: SAMPLE_SPRINT_ID,
  cancelado_por: 'renan',
  cancelado_em: '2026-05-21T15:00:00-03:00',
  motivo: 'Reprogramação por urgência de cliente',
};

export const validAgentConfig: AgentConfigInput = {
  schema_version: '1.0',
  user_id: 'joao',
  user_nome_exibicao: 'João Silva',
  hostname: 'ART-DESIGN-04',
  shared_path: '\\\\servidor\\sprint-dispatcher',
  polling_interval_seconds: 3,
  som_notificacao: true,
  log_level: 'info',
};
