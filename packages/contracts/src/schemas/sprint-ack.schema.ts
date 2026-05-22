import { z } from 'zod';

import { ContractValidationError } from '../errors';

import { isoDatetimeSchema, schemaVersionSchema, sprintIdSchema, userIdSchema } from './shared';

/**
 * Schema do ack gravado em `acks/` pelo Agent após exibir overlay.
 *
 * `acknowledged_at` é opcional: só preenchido se o operador clicar em
 * "OK, entendi" antes do timeout.
 *
 * @see Requisitos Anexo D, RF-09
 */
export const sprintAckSchema = z
  .object({
    schema_version: schemaVersionSchema,
    sprint_id: sprintIdSchema,
    user_id: userIdSchema,
    hostname: z.string().min(1).max(100),
    displayed_at: isoDatetimeSchema,
    acknowledged_at: isoDatetimeSchema.optional(),
    agent_version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, 'agent_version deve ser semver MAJOR.MINOR.PATCH'),
  })
  .strict();

/**
 * Tipo do ack de sprint, inferido do schema.
 *
 * Use em assinaturas de função, props de componentes, etc.
 */
export type SprintAck = z.infer<typeof sprintAckSchema>;

/**
 * Tipo de entrada (antes de defaults serem aplicados) — necessário para
 * uso com `react-hook-form` onde campos com default podem estar ausentes.
 */
export type SprintAckInput = z.input<typeof sprintAckSchema>;

/**
 * Parser estrito: lança `ContractValidationError` em ack inválido.
 *
 * Use quando o caller espera dados válidos e tratar erro como excepcional.
 */
export function parseSprintAck(data: unknown): SprintAck {
  const result = sprintAckSchema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError('SprintAck', result.error);
  }
  return result.data;
}

/**
 * Parser não-throwable: retorna discriminated union `{ success, data | error }`.
 *
 * Use quando validação faz parte do fluxo normal (UI form, polling de
 * arquivos potencialmente corrompidos).
 */
export function safeParseSprintAck(
  data: unknown,
): { success: true; data: SprintAck } | { success: false; error: ContractValidationError } {
  const result = sprintAckSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: new ContractValidationError('SprintAck', result.error),
    };
  }
  return { success: true, data: result.data };
}
