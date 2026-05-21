/**
 * `@sprint/contracts` — public API.
 *
 * Library compartilhada de contratos JSON do Sprint Dispatcher.
 * Schemas Zod são source of truth; tipos TS derivam deles via `z.infer`.
 *
 * @see DECISIONS.md ADR-005 (schema-first com z.infer)
 * @see DECISIONS.md ADR-006 (filename com ULID completo)
 */

// === Constantes ===
export {
  ALLOWED_HTML_TAGS,
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_SHOW_DURATION_SECONDS,
  DEFAULT_SPRINT_TITLE,
  LOCAL_DIRS,
  MAX_DEADLINE_HORIZON_HOURS,
  SCHEMA_VERSION,
  SHARED_DIRS,
} from './constants';

// === IDs ===
export { generateSprintId, isValidUlid, ULID_REGEX } from './ids';

// === Errors ===
export { ContractValidationError } from './errors';
export { FilenameParseError } from './filenames';

// === Branded types e schemas compartilhados ===
export {
  isoDatetimeSchema,
  schemaVersionSchema,
  sprintIdSchema,
  userIdSchema,
  type SprintId,
  type UserId,
} from './schemas/shared';

// === SprintPayload ===
export {
  parseSprintPayload,
  safeParseSprintPayload,
  sprintPayloadSchema,
  type SprintPayload,
  type SprintPayloadInput,
} from './schemas/sprint-payload.schema';

// === SprintAck ===
export {
  parseSprintAck,
  safeParseSprintAck,
  sprintAckSchema,
  type SprintAck,
  type SprintAckInput,
} from './schemas/sprint-ack.schema';

// === SprintCancel ===
export {
  parseSprintCancel,
  safeParseSprintCancel,
  sprintCancelSchema,
  type SprintCancel,
  type SprintCancelInput,
} from './schemas/sprint-cancel.schema';

// === AgentConfig ===
export {
  agentConfigSchema,
  parseAgentConfig,
  safeParseAgentConfig,
  type AgentConfig,
  type AgentConfigInput,
} from './schemas/agent-config.schema';

// === Filename helpers ===
export {
  buildAckFilename,
  buildCancelFilename,
  buildPendingFilename,
  parseFilename,
  safeParseFilename,
  type ParsedFilename,
} from './filenames';
