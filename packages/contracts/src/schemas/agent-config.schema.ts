import { z } from 'zod';

import { DEFAULT_POLLING_INTERVAL_MS } from '../constants';
import { ContractValidationError } from '../errors';

import { schemaVersionSchema, userIdSchema } from './shared';

/**
 * Schema do `config.json` local em cada estação do operador.
 *
 * @see Requisitos Anexo F
 */
export const agentConfigSchema = z
  .object({
    schema_version: schemaVersionSchema,
    user_id: userIdSchema,
    user_nome_exibicao: z.string().min(1).max(100),
    hostname: z.string().min(1).max(100),
    shared_path: z.string().min(1).max(500),
    polling_interval_seconds: z
      .number()
      .int()
      .min(1, 'polling_interval_seconds deve ser >= 1')
      .max(60, 'polling_interval_seconds deve ser <= 60')
      .default(Math.round(DEFAULT_POLLING_INTERVAL_MS / 1000)),
    som_notificacao: z.boolean().default(true),
    log_level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  })
  .strict();

/**
 * Tipo da configuração do agente, inferido do schema.
 *
 * Use em assinaturas de função, props de componentes, etc.
 */
export type AgentConfig = z.infer<typeof agentConfigSchema>;

/**
 * Tipo de entrada (antes de defaults serem aplicados) — necessário para
 * uso com `react-hook-form` onde campos com default podem estar ausentes.
 */
export type AgentConfigInput = z.input<typeof agentConfigSchema>;

/**
 * Parser estrito: lança `ContractValidationError` em configuração inválida.
 *
 * Use quando o caller espera dados válidos e tratar erro como excepcional.
 */
export function parseAgentConfig(data: unknown): AgentConfig {
  const result = agentConfigSchema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError('AgentConfig', result.error);
  }
  return result.data;
}

/**
 * Parser não-throwable: retorna discriminated union `{ success, data | error }`.
 *
 * Use quando validação faz parte do fluxo normal (UI form, polling de
 * arquivos potencialmente corrompidos).
 */
export function safeParseAgentConfig(
  data: unknown,
): { success: true; data: AgentConfig } | { success: false; error: ContractValidationError } {
  const result = agentConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: new ContractValidationError('AgentConfig', result.error),
    };
  }
  return { success: true, data: result.data };
}
