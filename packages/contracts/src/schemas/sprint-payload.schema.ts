import { z } from 'zod';

import { ContractValidationError } from '../errors';

import { isoDatetimeSchema, schemaVersionSchema, sprintIdSchema, userIdSchema } from './shared';

/**
 * Schema do payload de sprint gravado em `pending/` pelo Leader e lido
 * pelo Operator Agent.
 *
 * `.strict()` rejeita campos extras — defesa contra payloads adulterados.
 *
 * @see Requisitos Anexo C
 */
export const sprintPayloadSchema = z
  .object({
    schema_version: schemaVersionSchema,
    sprint_id: sprintIdSchema,
    criado_por: z.string().min(1).max(100),
    criado_em: isoDatetimeSchema,
    user_id: userIdSchema,
    title: z.string().min(1).max(200),
    body_html: z.string().min(1).max(2000),
    meta: z.number().int().positive().finite(),
    deadline_at: isoDatetimeSchema,
    show_duration_seconds: z.number().int().min(1).max(60).default(5),
    persistent_popup: z.boolean().default(true),
  })
  .strict();

/**
 * Tipo do payload de sprint, inferido do schema.
 *
 * Use em assinaturas de função, props de componentes, etc.
 */
export type SprintPayload = z.infer<typeof sprintPayloadSchema>;

/**
 * Tipo de entrada (antes de defaults serem aplicados) — necessário para
 * uso com `react-hook-form` onde campos com default podem estar ausentes.
 */
export type SprintPayloadInput = z.input<typeof sprintPayloadSchema>;

/**
 * Parser estrito: lança `ContractValidationError` em payload inválido.
 *
 * Use quando o caller espera dados válidos e tratar erro como excepcional.
 */
export function parseSprintPayload(data: unknown): SprintPayload {
  const result = sprintPayloadSchema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError('SprintPayload', result.error);
  }
  return result.data;
}

/**
 * Parser não-throwable: retorna discriminated union `{ success, data | error }`.
 *
 * Use quando validação faz parte do fluxo normal (UI form, polling de
 * arquivos potencialmente corrompidos).
 */
export function safeParseSprintPayload(
  data: unknown,
): { success: true; data: SprintPayload } | { success: false; error: ContractValidationError } {
  const result = sprintPayloadSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: new ContractValidationError('SprintPayload', result.error),
    };
  }
  return { success: true, data: result.data };
}
