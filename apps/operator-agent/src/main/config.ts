/**
 * Loader de config.json do Sprint Operator Agent.
 *
 * Localização: `app.getPath('userData')/config.json`, que em Windows
 * resolve para `%APPDATA%\sprint-operator-agent\config.json`.
 *
 * Schema validado por `@sprint/contracts` via `safeParseAgentConfig`.
 *
 * Comportamento fail-fast (ADR-012): qualquer erro — arquivo ausente,
 * falha de I/O, JSON quebrado ou schema violado — lança um `ConfigError`
 * específico. O caller (`main/index.ts`) mostra um diálogo e encerra o
 * app. Sem retry, sem fallback, sem auto-criação de template.
 *
 * @see DECISIONS.md ADR-012
 * @see Requisitos Anexo F
 *
 * TODO(C4): refatorar para usar `IFilesystemAdapter` quando o C4 estiver
 *           pronto. Por ora usa `fs/promises` direto — o Agent é o
 *           primeiro consumer de I/O do projeto.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { safeParseAgentConfig } from '@sprint/contracts';
import type { AgentConfig, ContractValidationError } from '@sprint/contracts';
import { app } from 'electron';

const CONFIG_FILENAME = 'config.json';

/**
 * Erro base de carregamento de config. O caller usa `instanceof
 * ConfigError` para distinguir um erro de config de um erro inesperado.
 */
export abstract class ConfigError extends Error {
  abstract override readonly name: string;
}

/**
 * O `config.json` não foi encontrado no caminho esperado.
 */
export class ConfigNotFoundError extends ConfigError {
  override readonly name = 'ConfigNotFoundError';

  constructor(public readonly configPath: string) {
    super(
      `Config não encontrado em:\n${configPath}\n\n` +
        `Crie o arquivo seguindo o modelo do Anexo F do doc de Requisitos.`,
    );
  }
}

/**
 * O `config.json` existe, mas não é JSON válido.
 */
export class ConfigJsonError extends ConfigError {
  override readonly name = 'ConfigJsonError';

  constructor(
    public readonly configPath: string,
    public override readonly cause: Error,
  ) {
    super(`Config em ${configPath} não é JSON válido:\n${cause.message}`);
  }
}

/**
 * O `config.json` é JSON válido, mas não bate com o schema AgentConfig.
 */
export class ConfigInvalidError extends ConfigError {
  override readonly name = 'ConfigInvalidError';

  constructor(
    public readonly configPath: string,
    public override readonly cause: ContractValidationError,
  ) {
    super(`Config em ${configPath} é inválido:\n\n${cause.format()}`);
  }
}

/**
 * Erro de I/O distinto de "não existe" — permissão negada, o path é um
 * diretório, etc.
 */
export class ConfigReadError extends ConfigError {
  override readonly name = 'ConfigReadError';

  constructor(
    public readonly configPath: string,
    public override readonly cause: Error,
  ) {
    super(`Falha ao ler o config em ${configPath}:\n${cause.message}`);
  }
}

/**
 * Retorna o caminho absoluto do `config.json` no sistema atual.
 *
 * Windows: `C:\Users\<user>\AppData\Roaming\sprint-operator-agent\config.json`.
 */
export function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

/**
 * Carrega e valida o `config.json` da estação.
 *
 * Sequência: resolve o caminho → lê o arquivo → faz o parse do JSON →
 * valida o schema. Cada falha lança o `ConfigError` correspondente.
 *
 * @throws {ConfigNotFoundError} O arquivo não existe.
 * @throws {ConfigReadError} Falha de I/O distinta de "não existe".
 * @throws {ConfigJsonError} O conteúdo não é JSON válido.
 * @throws {ConfigInvalidError} O JSON não bate com o schema AgentConfig.
 */
export async function loadAgentConfig(): Promise<AgentConfig> {
  const configPath = getConfigPath();

  let rawContent: string;
  try {
    rawContent = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigNotFoundError(configPath);
    }
    throw new ConfigReadError(configPath, err as Error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent) as unknown;
  } catch (err) {
    throw new ConfigJsonError(configPath, err as Error);
  }

  const result = safeParseAgentConfig(parsed);
  if (!result.success) {
    throw new ConfigInvalidError(configPath, result.error);
  }
  return result.data;
}
