import { createLogger } from './createLogger';
import type { Logger } from './types';

let _rootLogger: Logger | null = null;

/**
 * Logger raiz para uso no boot dos apps ou em contextos sem um
 * componente específico (e.g. fatal error handlers globais).
 *
 * Lazy-initialized — só cria a instância Pino na primeira chamada.
 * Isso permite que código de boot que customize `NODE_ENV` ou
 * `LOG_LEVEL` antes do primeiro uso seja respeitado.
 *
 * Sempre nomeado `'root'`.
 *
 * @example
 * ```ts
 * import { rootLogger } from '@sprint/logger';
 *
 * process.on('uncaughtException', (err) => {
 *   rootLogger().fatal({ err }, 'uncaught exception, terminating');
 *   process.exit(1);
 * });
 * ```
 */
export function rootLogger(): Logger {
  _rootLogger ??= createLogger('root');
  return _rootLogger;
}

/**
 * Reseta o singleton. **Uso exclusivo em testes** — em produção
 * o root deve permanecer o mesmo durante todo o ciclo de vida
 * do processo.
 *
 * Útil para testes que stubam env vars (`NODE_ENV`, `LOG_LEVEL`)
 * e precisam forçar reconstrução da instância com o novo env.
 */
export function _resetRootLoggerForTesting(): void {
  _rootLogger = null;
}
