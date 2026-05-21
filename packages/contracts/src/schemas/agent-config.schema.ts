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

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentConfigInput = z.input<typeof agentConfigSchema>;

export function parseAgentConfig(data: unknown): AgentConfig {
  const result = agentConfigSchema.safeParse(data);
  if (!result.success) {
    throw new ContractValidationError('AgentConfig', result.error);
  }
  return result.data;
}

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
