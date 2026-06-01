import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

import { isDevelopment, resolveLevel } from './config';
import type { ChildBindings, Logger, LoggerOptions } from './types';

/**
 * Opções passadas para `pino-pretty` no fluxo dev. Centralizadas
 * para facilitar tweak futuro sem reescrever createLogger.
 */
const PRETTY_OPTIONS = {
  colorize: true,
  translateTime: 'HH:MM:ss.l',
  ignore: 'pid,hostname',
};

/**
 * Cria um logger nomeado com configuração inteligente baseada no
 * `NODE_ENV` e em `LOG_LEVEL`.
 *
 * Comportamento por modo:
 * - **dev** (`NODE_ENV !== 'production'`) sem `destination`: output
 *   pretty-printed via `pino-pretty` (worker thread), default
 *   level `'debug'`.
 * - **prod** (`NODE_ENV === 'production'`) sem `destination`: output
 *   JSON estruturado em `process.stdout`, default level `'info'`.
 * - **Qualquer modo** com `destination` em `options`: sempre JSON,
 *   escrito sincronamente no stream fornecido (caminho usado em
 *   testes).
 *
 * @param name - identificador do componente (kebab-case
 *   recomendado, e.g. `'polling-service'`, `'leader-main'`).
 * @param options - overrides opcionais.
 * @returns Logger tipado, com 5 níveis + `child` + `name`.
 *
 * @example
 * ```ts
 * const log = createLogger('polling-service');
 * log.info({ found: 3 }, 'polling cycle complete');
 * log.error({ err }, 'failed to read shared folder');
 *
 * const userLog = log.child({ userId: 'joao' });
 * userLog.warn('deadline approaching');
 * // → output inclui { name: 'polling-service', userId: 'joao' }
 * ```
 */
export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  let pinoInstance = buildPinoInstance(name, options);

  if (options.bindings !== undefined) {
    pinoInstance = pinoInstance.child(options.bindings);
  }

  return wrap(pinoInstance, name);
}

function buildPinoInstance(name: string, options: LoggerOptions): PinoLogger {
  const level = resolveLevel(options.level);

  if (options.destination !== undefined) {
    return pino({ name, level }, options.destination);
  }
  if (isDevelopment()) {
    return pino({
      name,
      level,
      transport: {
        target: 'pino-pretty',
        options: PRETTY_OPTIONS,
      },
    });
  }
  return pino({ name, level });
}

/**
 * Wrappa uma instância Pino em nossa interface `Logger`. Esconde
 * métodos extras (`trace`, `silent`, `flush`, `bindings`, ...) e
 * faz o dispatch das 2 formas de chamada (string-only vs object+msg)
 * para a forma certa do `pino.LogFn`.
 *
 * `child(bindings)` recursa via `wrap` para que o sub-logger
 * também enxergue só nossa interface.
 */
function wrap(pinoInstance: PinoLogger, name: string): Logger {
  return {
    name,

    debug(objOrMsg: object | string, msg?: string): void {
      if (typeof objOrMsg === 'string') {
        pinoInstance.debug(objOrMsg);
      } else if (msg !== undefined) {
        pinoInstance.debug(objOrMsg, msg);
      } else {
        pinoInstance.debug(objOrMsg);
      }
    },

    info(objOrMsg: object | string, msg?: string): void {
      if (typeof objOrMsg === 'string') {
        pinoInstance.info(objOrMsg);
      } else if (msg !== undefined) {
        pinoInstance.info(objOrMsg, msg);
      } else {
        pinoInstance.info(objOrMsg);
      }
    },

    warn(objOrMsg: object | string, msg?: string): void {
      if (typeof objOrMsg === 'string') {
        pinoInstance.warn(objOrMsg);
      } else if (msg !== undefined) {
        pinoInstance.warn(objOrMsg, msg);
      } else {
        pinoInstance.warn(objOrMsg);
      }
    },

    error(objOrMsg: object | string, msg?: string): void {
      if (typeof objOrMsg === 'string') {
        pinoInstance.error(objOrMsg);
      } else if (msg !== undefined) {
        pinoInstance.error(objOrMsg, msg);
      } else {
        pinoInstance.error(objOrMsg);
      }
    },

    fatal(objOrMsg: object | string, msg?: string): void {
      if (typeof objOrMsg === 'string') {
        pinoInstance.fatal(objOrMsg);
      } else if (msg !== undefined) {
        pinoInstance.fatal(objOrMsg, msg);
      } else {
        pinoInstance.fatal(objOrMsg);
      }
    },

    child(bindings: ChildBindings): Logger {
      return wrap(pinoInstance.child(bindings), name);
    },
  };
}
