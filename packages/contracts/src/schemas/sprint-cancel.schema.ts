import { z } from 'zod';

import { ContractValidationError } from '../errors';

import { isoDatetimeSchema, schemaVersionSchema, sprintIdSchema } from './shared';

/**
 * Schema do arquivo de cancelamento gravado em `pending/` pelo Leader.
 *
 * @see Requisitos Anexo E, UC-05
 */
export const sprintCancelSchema = z
  .object({
    schema_version: schemaVersionSchema,
    type: z.literal('cancel'),
    sprint_id_ref: sprintIdSchema,
    cancelado_por: z.string().min(1).max(100),
    cancelado_em: isoDatetimeSchema,
    motivo: z.string().min(1).max(500).optional(),
  })
  .strict();

export type SprintCancel = z.infer<typeof sprintCancelSchema>;
export type SprintCancelInput = z.input<typeof sprintCancelSchema>;

export function parseSprintCancel(data: unknown): SprintCancel {
  const result = sprintCancelSchema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError('SprintCancel', result.error);
  }
  return result.data;
}

export function safeParseSprintCancel(
  data: unknown,
): { success: true; data: SprintCancel } | { success: false; error: ContractValidationError } {
  const result = sprintCancelSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: new ContractValidationError('SprintCancel', result.error),
    };
  }
  return { success: true, data: result.data };
}
