import type { ZodError, ZodIssue } from 'zod';

/**
 * Erro lançado pelos parsers do `@sprint/contracts` quando dados não
 * batem com o schema.
 *
 * Envolve o `ZodError` original em `cause` (padrão Error com `cause`,
 * ES2022) para permitir inspeção detalhada via `error.cause.issues`,
 * ao mesmo tempo que oferece nome e mensagem semânticos via
 * `error.schemaName`.
 *
 * @example
 * ```ts
 * try {
 *   parseSprintPayload(unknownData);
 * } catch (err) {
 *   if (err instanceof ContractValidationError) {
 *     console.error(`${err.schemaName} inválido:`, err.issues);
 *   }
 * }
 * ```
 */
export class ContractValidationError extends Error {
  override readonly name = 'ContractValidationError';
  override readonly cause: ZodError;

  constructor(
    public readonly schemaName: string,
    cause: ZodError,
  ) {
    super(`${schemaName} validation failed: ${String(cause.issues.length)} issue(s)`);
    this.cause = cause;
  }

  /**
   * Atalho para `cause.issues`. Lista os problemas de validação.
   */
  get issues(): ZodIssue[] {
    return this.cause.issues;
  }

  /**
   * Mensagem amigável formatada com `path → mensagem` por issue.
   *
   * Útil para logs e UIs onde mostrar o `ZodError` cru seria barulhento.
   */
  format(): string {
    return this.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
  }
}
