/**
 * Loader de leader-config.json do Sprint Leader.
 *
 * Localização: `app.getPath('userData')/config.json` que em Windows resolve
 * para `%APPDATA%\Sprint Leader\config.json` (productName do
 * `electron-builder.yml`). No primeiro setup, a TI da fábrica grava o
 * arquivo manualmente seguindo o template em `dev-fixtures/config-example.json`
 * (instalador C5 vai automatizar em W3).
 *
 * Schema local (`leaderConfigSchema`) — não em `@sprint/contracts` —
 * porque o tipo é exclusivo do Leader (Agent tem seu próprio
 * `AgentConfig`). Promover quando outro consumer (instalador C5?)
 * precisar.
 *
 * Comportamento fail-fast espelhando o Operator Agent (ADR-012):
 * qualquer falha vira um `ConfigError` específico. O caller (`main/ipc.ts`)
 * converte em `GetConfigResult { ok: false }` para o renderer renderizar a
 * `ConfigErrorScreen`.
 *
 * Schema do payload:
 * - `shared_path`: string não-vazia (UNC `\\\\srv\\share` ou letra de drive)
 * - `criado_por`: string 1-100 chars (vai literal no `criado_por` do SprintPayload)
 *
 * @see DECISIONS.md ADR-012 (loader fail-fast — Agent precedent)
 * @see CLAUDE.md §2 (P-01: nada de sockets, só FS para comunicação)
 *
 * TODO(C4 — refactor futuro): considerar usar IFilesystemAdapter aqui
 * também (consistência com operatorsService e PendingStore). Por ora
 * `fs/promises` direto — mesma decisão do Agent ADR-012.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { app } from 'electron';
import { z } from 'zod';

const CONFIG_FILENAME = 'config.json';

export const leaderConfigSchema = z
  .object({
    shared_path: z.string().min(1),
    criado_por: z.string().min(1).max(100),
  })
  .strict();

export type LeaderConfig = z.infer<typeof leaderConfigSchema>;

// =============================================================================
// Erros tipados — mesma hierarquia abstrata do Agent ConfigError (ADR-012).
// =============================================================================

export type LeaderConfigErrorCode =
  | 'NOT_FOUND'
  | 'JSON_INVALID'
  | 'SCHEMA_INVALID'
  | 'READ_ERROR'
  | 'SHARED_PATH_INACCESSIBLE';

export abstract class ConfigError extends Error {
  abstract override readonly name: string;
  abstract readonly code: LeaderConfigErrorCode;
  readonly configPath: string;

  constructor(configPath: string, message: string) {
    super(message);
    this.configPath = configPath;
  }
}

export class ConfigNotFoundError extends ConfigError {
  override readonly name = 'ConfigNotFoundError';
  override readonly code = 'NOT_FOUND' as const;

  constructor(configPath: string) {
    super(
      configPath,
      `Configuração ausente em:\n${configPath}\n\n` +
        `Crie o arquivo com:\n` +
        `{\n  "shared_path": "\\\\\\\\servidor\\\\compartilhada",\n  "criado_por": "Seu Nome"\n}`,
    );
  }
}

export class ConfigJsonError extends ConfigError {
  override readonly name = 'ConfigJsonError';
  override readonly code = 'JSON_INVALID' as const;

  constructor(
    configPath: string,
    public override readonly cause: Error,
  ) {
    super(configPath, `JSON inválido em ${configPath}:\n${cause.message}`);
  }
}

export class ConfigSchemaError extends ConfigError {
  override readonly name = 'ConfigSchemaError';
  override readonly code = 'SCHEMA_INVALID' as const;

  constructor(
    configPath: string,
    public override readonly cause: z.ZodError,
  ) {
    super(configPath, `Schema inválido em ${configPath}:\n${cause.message}`);
  }
}

export class ConfigReadError extends ConfigError {
  override readonly name = 'ConfigReadError';
  override readonly code = 'READ_ERROR' as const;

  constructor(
    configPath: string,
    public override readonly cause: Error,
  ) {
    super(configPath, `Falha ao ler ${configPath}:\n${cause.message}`);
  }
}

export class SharedPathInaccessibleError extends ConfigError {
  override readonly name = 'SharedPathInaccessibleError';
  override readonly code = 'SHARED_PATH_INACCESSIBLE' as const;
  readonly sharedPath: string;

  constructor(
    configPath: string,
    sharedPath: string,
    public override readonly cause?: Error,
  ) {
    super(
      configPath,
      `shared_path declarado em ${configPath} está inacessível:\n${sharedPath}` +
        (cause !== undefined ? `\n${cause.message}` : ''),
    );
    this.sharedPath = sharedPath;
  }
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Caminho absoluto do `config.json` no sistema atual.
 *
 * Windows: `C:\Users\<user>\AppData\Roaming\Sprint Leader\config.json`.
 */
export function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

/**
 * Carrega e valida o `config.json` do Leader.
 *
 * Sequência: resolve path → lê arquivo → JSON parse → schema validate →
 * verifica que `shared_path` existe E é diretório. Cada falha lança o
 * `ConfigError` correspondente.
 *
 * @throws {ConfigNotFoundError} Arquivo ausente (ENOENT).
 * @throws {ConfigReadError} Falha de I/O distinta de ENOENT (EACCES, EISDIR, etc.).
 * @throws {ConfigJsonError} JSON malformado.
 * @throws {ConfigSchemaError} Schema violado (campo faltando, tipo errado, extra).
 * @throws {SharedPathInaccessibleError} `shared_path` não existe ou não é diretório.
 */
export async function loadLeaderConfig(): Promise<LeaderConfig> {
  const configPath = getConfigPath();

  // 1. Ler arquivo
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      throw new ConfigNotFoundError(configPath);
    }
    throw new ConfigReadError(configPath, e);
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (err) {
    throw new ConfigJsonError(configPath, err as Error);
  }

  // 3. Validar schema
  const result = leaderConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigSchemaError(configPath, result.error);
  }
  const config = result.data;

  // 4. Validar shared_path existe e é diretório
  try {
    const stats = await fs.stat(config.shared_path);
    if (!stats.isDirectory()) {
      throw new SharedPathInaccessibleError(
        configPath,
        config.shared_path,
        new Error('Path existe mas não é diretório'),
      );
    }
  } catch (err) {
    if (err instanceof SharedPathInaccessibleError) throw err;
    throw new SharedPathInaccessibleError(configPath, config.shared_path, err as Error);
  }

  return config;
}
