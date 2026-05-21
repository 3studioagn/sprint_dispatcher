/**
 * Versão do schema dos contratos JSON.
 *
 * Mudanças incompatíveis em qualquer schema (SprintPayload, SprintAck,
 * SprintCancel, AgentConfig) exigem bump desta constante. Apps lendo
 * payloads com versão maior devem rejeitar com erro claro; apps lendo
 * versão menor devem aplicar compatibility shims.
 *
 * @see DECISIONS.md ADR-005 (schema-first)
 */
export const SCHEMA_VERSION = '1.0' as const;

/**
 * Intervalo padrão entre verificações de polling da pasta compartilhada.
 *
 * Valor em milissegundos. Pode ser sobrescrito via
 * AgentConfig.polling_interval_seconds.
 *
 * @see Requisitos RNF-01, RNF-03
 */
export const DEFAULT_POLLING_INTERVAL_MS = 3000;

/**
 * Duração padrão da exibição do overlay antes de minimizar para tray.
 *
 * Valor em segundos. Pode ser sobrescrito por sprint via
 * SprintPayload.show_duration_seconds.
 *
 * @see Requisitos RF-07, US-02.02
 */
export const DEFAULT_SHOW_DURATION_SECONDS = 5;

/**
 * Título padrão exibido no overlay quando o líder não customiza.
 *
 * @see Requisitos US-01.04
 */
export const DEFAULT_SPRINT_TITLE = 'É hora de correr';

/**
 * Nomes das subpastas da pasta compartilhada do Sprint Dispatcher.
 *
 * Estrutura fixa: `<shared_path>/pending/`, `<shared_path>/acks/`,
 * `<shared_path>/arquivo/<YYYY-MM-DD>/`. Não usar strings hardcoded em
 * outros lugares do código — sempre importar destas constantes.
 *
 * @see Requisitos Anexo A
 */
export const SHARED_DIRS = {
  PENDING: 'pending',
  ACKS: 'acks',
  ARCHIVE: 'arquivo',
} as const;

/**
 * Diretórios locais da estação do operador.
 *
 * Caminhos absolutos finais (com `ProgramData/...`) são compostos por C3
 * (operator-agent), não aqui.
 *
 * @see Requisitos Anexo B
 */
export const LOCAL_DIRS = {
  HISTORY: 'historico',
  LOGS: 'logs',
} as const;

/**
 * Tags HTML permitidas no `body_html` da sprint (whitelist).
 *
 * Usada pelo sanitizador (BL-C1-004, W1) e referência para a validação
 * de tamanho do schema. O schema em si **não** sanitiza — sanitização
 * é responsabilidade explícita de BL-C1-004.
 *
 * @see Requisitos RF-17, RN-10
 */
export const ALLOWED_HTML_TAGS = ['b', 'i', 'br', 'p', 'h1', 'span'] as const;

/**
 * Limite máximo, em horas, para `deadline_at` no futuro.
 *
 * Sprints com deadline mais de 24h no futuro são suspeitas — fim de
 * expediente é o caso de uso real. Não rejeitamos no schema, mas
 * permitimos que a UI alerte.
 */
export const MAX_DEADLINE_HORIZON_HOURS = 24;
