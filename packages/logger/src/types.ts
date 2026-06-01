/**
 * Tipos públicos do `@sprint/logger`.
 *
 * @see DECISIONS.md ADR-020 (@sprint/logger com Pino — wrapper enxuto).
 */

/**
 * Níveis de log suportados, em ordem crescente de severidade.
 *
 * Pino também suporta `trace` e `silent`, mas o wrapper os omite —
 * `trace` é ruidoso demais em produção e `silent` é melhor expresso
 * via `LOG_LEVEL` setado para `fatal` (logger continua funcional sem
 * emitir nada que importe).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Bindings anexados a um logger filho. Cada chave aparece como campo
 * em cada linha de log emitida por aquele logger.
 *
 * Restringimos a primitivos para manter o shape do JSON previsível.
 * Pino aceita estruturas aninhadas, mas a v1 do wrapper troca isso
 * por clareza — expandir é mudança não-quebrante.
 */
export type ChildBindings = Readonly<Record<string, string | number | boolean | null>>;

/**
 * Opções para `createLogger(name, options?)`.
 */
export interface LoggerOptions {
  /**
   * Nível mínimo a logar. Default:
   * - dev (`NODE_ENV !== 'production'`): `'debug'`
   * - prod (`NODE_ENV === 'production'`): `'info'`
   *
   * Env var `LOG_LEVEL` (case-insensitive) sobrescreve o default;
   * `level` em options sobrescreve ambos.
   */
  readonly level?: LogLevel;

  /**
   * Stream de destino. Default: `process.stdout` com pretty print em
   * dev (via `pino-pretty`) ou JSON estruturado em prod.
   *
   * Usado primariamente em testes — capture via
   * `new PassThrough()` para fazer parse das linhas JSON emitidas.
   * Sempre escreve JSON cru quando passado explicitamente
   * (não passa por `pino-pretty`).
   */
  readonly destination?: NodeJS.WritableStream;

  /**
   * Bindings extras — campos sempre presentes nas linhas deste
   * logger, além do `name`.
   */
  readonly bindings?: ChildBindings;
}

/**
 * Logger tipado retornado por `createLogger`. Wrappa uma instância
 * Pino com superfície reduzida para 5 níveis + `child` + `name`.
 *
 * Cada método aceita duas formas:
 * - `log.info('mensagem')` — apenas string
 * - `log.info({ key: value }, 'mensagem')` — objeto + string
 *
 * O `name` (e quaisquer `bindings` do logger ou de ancestrais via
 * `child`) é incluído automaticamente em cada linha.
 */
export interface Logger {
  debug(obj: object, msg?: string): void;
  debug(msg: string): void;
  info(obj: object, msg?: string): void;
  info(msg: string): void;
  warn(obj: object, msg?: string): void;
  warn(msg: string): void;
  error(obj: object, msg?: string): void;
  error(msg: string): void;
  fatal(obj: object, msg?: string): void;
  fatal(msg: string): void;

  /**
   * Cria um sub-logger com bindings adicionais. Herda nível e
   * destino do logger pai. Bindings se acumulam — sub-logger de
   * sub-logger inclui tanto os bindings do filho quanto do pai.
   */
  child(bindings: ChildBindings): Logger;

  /** Nome do logger (campo `name` em cada linha de output). */
  readonly name: string;
}
