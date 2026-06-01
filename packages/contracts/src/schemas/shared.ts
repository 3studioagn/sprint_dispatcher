import { z } from 'zod';

import { SCHEMA_VERSION } from '../constants';
import { ULID_REGEX } from '../ids';

/**
 * Schema branded para Sprint IDs.
 *
 * Garante que strings só sejam tratadas como `SprintId` após validação
 * contra `ULID_REGEX`. Use `sprintIdSchema.parse(rawString)` para
 * converter, ou `import type { SprintId }` para usar como tipo.
 */
export const sprintIdSchema = z
  .string()
  .regex(ULID_REGEX, {
    message: 'sprint_id deve ser um ULID válido (26 chars, Crockford Base32)',
  })
  .brand<'SprintId'>();
export type SprintId = z.infer<typeof sprintIdSchema>;

/**
 * Schema branded para User IDs (identifica um operador unicamente).
 *
 * Regras: lowercase, dígitos, underscores e hífens; 1-50 chars; sem
 * espaços nem caracteres especiais.
 *
 * @see Requisitos RN-02
 */
export const userIdSchema = z
  .string()
  .min(1, 'user_id não pode ser vazio')
  .max(50, 'user_id deve ter no máximo 50 caracteres')
  .regex(/^[a-z0-9_-]+$/, 'user_id aceita apenas [a-z0-9_-]')
  .brand<'UserId'>();
export type UserId = z.infer<typeof userIdSchema>;

/**
 * Datetime ISO 8601 com offset obrigatório (timezone-aware).
 *
 * Aceita formato `2026-05-21T14:32:10-03:00` (com offset numérico) ou
 * `2026-05-21T14:32:10Z` (UTC). Rejeita strings sem offset (ambiguidade
 * de fuso causaria bugs sutis em uma fábrica que opera 24h).
 */
export const isoDatetimeSchema = z.string().datetime({
  offset: true,
  message: 'deve ser datetime ISO 8601 com offset (ex: 2026-05-21T14:32:10-03:00)',
});

/**
 * Versão do schema. Literal `'1.0'` enquanto não bumpamos.
 *
 * @see constants.SCHEMA_VERSION
 */
export const schemaVersionSchema = z.literal(SCHEMA_VERSION);
