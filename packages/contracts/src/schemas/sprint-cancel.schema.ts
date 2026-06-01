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

/**
 * Tipo do cancelamento de sprint, inferido do schema.
 *
 * Use em assinaturas de função, props de componentes, etc.
 */
export type SprintCancel = z.infer<typeof sprintCancelSchema>;

/**
 * Tipo de entrada (antes de defaults serem aplicados) — necessário para
 * uso com `react-hook-form` onde campos com default podem estar ausentes.
 */
export type SprintCancelInput = z.input<typeof sprintCancelSchema>;

/**
 * Parser estrito: lança `ContractValidationError` em cancelamento inválido.
 *
 * Use quando o caller espera dados válidos e tratar erro como excepcional.
 */
export function parseSprintCancel(data: unknown): SprintCancel {
  const result = sprintCancelSchema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError('SprintCancel', result.error);
  }
  return result.data;
}

/**
 * Parser não-throwable: retorna discriminated union `{ success, data | error }`.
 *
 * Use quando validação faz parte do fluxo normal (UI form, polling de
 * arquivos potencialmente corrompidos).
 */
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
