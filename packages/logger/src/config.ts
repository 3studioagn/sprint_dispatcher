import type { LogLevel } from './types';

const VALID_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

/**
 * Retorna `true` quando `NODE_ENV` é qualquer coisa exceto
 * `'production'`. Comportamento default (dev) cobre `NODE_ENV`
 * ausente, `'development'`, `'test'`, etc.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Type guard para `LogLevel`. Case-sensitive — caller normaliza
 * antes (e.g. `s.toLowerCase()`) se precisar.
 */
export function isValidLevel(s: string): s is LogLevel {
  return (VALID_LEVELS as readonly string[]).includes(s);
}

/**
 * Resolve o nível efetivo de log usando a precedência:
 *
 * 1. `override` explícito do caller (e.g. `LoggerOptions.level`).
 * 2. Env var `LOG_LEVEL` (case-insensitive; ignorada se inválida).
 * 3. Default do `NODE_ENV`: `'debug'` em dev, `'info'` em prod.
 */
export function resolveLevel(override?: LogLevel): LogLevel {
  if (override !== undefined) return override;

  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel !== undefined && isValidLevel(envLevel)) return envLevel;

  return isDevelopment() ? 'debug' : 'info';
}
