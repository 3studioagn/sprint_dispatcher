/**
 * `@sprint/logger` — public API.
 *
 * Wrapper enxuto em torno do Pino. Dev: pretty-printed via
 * `pino-pretty`. Prod: JSON estruturado. Suporta loggers nomeados
 * com herança via `child(bindings)`.
 *
 * @see DECISIONS.md ADR-020 (@sprint/logger com Pino — wrapper enxuto).
 *
 * @example
 * ```ts
 * import { createLogger } from '@sprint/logger';
 *
 * const log = createLogger('polling-service');
 * log.info({ found: 3 }, 'polling cycle complete');
 *
 * const userLog = log.child({ userId: 'joao' });
 * userLog.warn('deadline approaching');
 * ```
 */

// === Factory + singleton ===
export { createLogger } from './createLogger';
export { rootLogger } from './rootLogger';

// === Types ===
export type { ChildBindings, Logger, LoggerOptions, LogLevel } from './types';
