/**
 * Loader de config.json do Operator Agent ("Metas - Desenhistas").
 *
 * Localização (ADR-028, BL-C5-006): `getAgentDataDir()/config.json`, que em
 * Windows resolve para `C:\ProgramData\Metas - Desenhistas\config.json`
 * (machine-wide, criado no first-run pelo wizard) e, fora de Windows (dev/CI),
 * cai para `app.getPath('userData')/config.json`. Ver `main/paths.ts`. Isto
 * supersede o `app.getPath('userData')` do W1 (ADR-012) — o data root migrou
 * para `ProgramData` por coerência com Anexo B / Stack §15.3.
 *
 * Schema canônico: `agentConfigSchema` de `@sprint/contracts` (strict).
 * **Extensão local W1**: campo opcional `minimize_after_seconds` (1-300s,
 * default 30s). Como o schema do contracts é `.strict()`, extraímos esse
 * campo do JSON cru ANTES de validar o resto — `@sprint/contracts` fica
 * intocado (proibido modificar por §2.2 do prompt da sessão).
 *
 * **Comportamento fail-soft (W1, mudança do W0 fail-fast)**: erros não
 * derrubam o app. O caller (`main/index.ts`) captura o `ConfigError`,
 * atualiza o tray para estado de erro (vermelho + balloon), e expõe via
 * IPC `config:get` para que o renderer renderize tela de instrução. Este
 * padrão espelha o `rebuildDeps` callback do Leader (ADR-017) — o
 * operador pode criar/corrigir o config e o agente "destrava" via
 * próxima chamada de `config:get` sem precisar reiniciar.
 *
 * **Acessibilidade do `shared_path` NÃO é mais validada aqui (ADR-027,
 * BL-C3-013).** A reachability da pasta compartilhada virou uma condição de
 * *runtime* — propriedade da máquina de reconexão do {@link PollingService}
 * (tray vermelho + backoff + retomada automática), e não mais um erro de
 * boot permanente. Assim o Agent **sobe mesmo com o share fora** (boot
 * resiliente — RNF-07) e auto-conecta quando o servidor volta. `loadConfig`
 * agora valida apenas a forma do `config.json` (e o I/O do próprio arquivo).
 *
 * Os 3 códigos de erro mapeiam 1-para-1 ao `ConfigErrorCode` do IPC:
 *
 * | Cenário                                | Erro                     | code            |
 * | -------------------------------------- | ------------------------ | --------------- |
 * | Arquivo ausente (ENOENT)               | ConfigNotFoundError      | NOT_FOUND       |
 * | JSON malformado, schema violado,       | ConfigInvalidError       | INVALID         |
 * | minimize_after_seconds fora de [1,300] |                          |                 |
 * | I/O no config.json (EISDIR / EACCES)   | ConfigInaccessibleError  | INACCESSIBLE    |
 *
 * @see DECISIONS.md ADR-012 (fail-fast precedent — superseded por fail-soft em W1)
 * @see DECISIONS.md ADR-017 (rebuildDeps callback no Leader)
 * @see DECISIONS.md ADR-027 (reachability do share virou estado de runtime)
 * @see Requisitos Anexo F
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { safeParseAgentConfig, type AgentConfig } from '@sprint/contracts';
import { z } from 'zod';

import type { ConfigErrorCode } from '../shared/ipc-types';

import { getAgentDataDir } from './paths';

const CONFIG_FILENAME = 'config.json';

/**
 * Default em segundos para o timer de minimização do overlay. 30s alinha
 * com prompt §4.3 (BL-C3-005) e UX do MVP. Configurável via
 * `minimize_after_seconds` em `config.json` (faixa 1-300s).
 */
export const DEFAULT_MINIMIZE_AFTER_SECONDS = 30;

/**
 * Schema do campo opcional W1-only `minimize_after_seconds`. Validado
 * separadamente do `agentConfigSchema` (que é strict — rejeita campos
 * extras). Faixa pragmática: 1s (mínimo razoável pra UX) a 300s (5min, já
 * é "permanente" do ponto de vista do operador).
 */
const minimizeAfterSecondsSchema = z
  .number()
  .int()
  .min(1, 'minimize_after_seconds deve ser >= 1')
  .max(300, 'minimize_after_seconds deve ser <= 300');

/**
 * Config "resolvida" para consumo dos services do main: valores em
 * millissegundos, defaults aplicados, todos os campos obrigatórios.
 *
 * Vira `ConfigView` no IPC via mapeamento direto (ver
 * `buildConfigView(rt)` em main/index.ts ou ipc.ts).
 */
export interface RuntimeConfig {
  /** Espelha `agentConfigSchema.user_id` (branded — narrowed para string aqui). */
  readonly userId: string;
  readonly userNomeExibicao: string;
  readonly hostname: string;
  readonly sharedPath: string;
  /** Em millissegundos. Default `DEFAULT_POLLING_INTERVAL_MS` (3000ms). */
  readonly pollingIntervalMs: number;
  /** Em millissegundos. Default 30000ms. */
  readonly minimizeAfterMs: number;
  /**
   * Espelha `agentConfigSchema.som_notificacao` (default `true`). Controla
   * se o overlay toca o som curto ao ser exibido (BL-C3-014). Consumido pelo
   * `OverlayService`, que repassa ao renderer no push de exibição inicial.
   */
  readonly somNotificacao: boolean;
}

// =============================================================================
// Hierarquia de erros — 3 códigos (vs 5 do Leader; ver ipc-types.ts ConfigErrorCode)
// =============================================================================

export abstract class ConfigError extends Error {
  abstract override readonly name: string;
  abstract readonly code: ConfigErrorCode;
  readonly configPath: string;

  constructor(configPath: string, message: string) {
    super(message);
    this.configPath = configPath;
  }
}

/**
 * `config.json` não foi encontrado em `app.getPath('userData')`. Renderer
 * mostra mensagem instruindo operador a criar o arquivo.
 */
export class ConfigNotFoundError extends ConfigError {
  override readonly name = 'ConfigNotFoundError';
  override readonly code = 'NOT_FOUND' as const;

  constructor(configPath: string) {
    super(
      configPath,
      `Configuração ausente em:\n${configPath}\n\n` +
        `Crie o arquivo seguindo o template do Anexo F do doc de Requisitos.`,
    );
  }
}

/**
 * `config.json` existe, mas tem JSON malformado, schema violado, OU
 * campo `minimize_after_seconds` fora de [1, 300]. Renderer mostra
 * mensagem específica de erro para o operador corrigir.
 */
export class ConfigInvalidError extends ConfigError {
  override readonly name = 'ConfigInvalidError';
  override readonly code = 'INVALID' as const;

  constructor(
    configPath: string,
    public override readonly cause: Error,
  ) {
    super(configPath, `Configuração inválida em ${configPath}:\n${cause.message}`);
  }
}

/**
 * `config.json` é válido, mas:
 * - O `shared_path` declarado não existe / não é diretório / sem acesso.
 * - O próprio `config.json` deu erro de I/O distinto de ENOENT
 *   (EISDIR — alguém criou o `config.json` como pasta; EACCES — permissão).
 *
 * Renderer mostra `expectedPath` (o `shared_path` ou o `configPath`,
 * dependendo do contexto) e instrui sobre verificação de rede/SMB.
 */
export class ConfigInaccessibleError extends ConfigError {
  override readonly name = 'ConfigInaccessibleError';
  override readonly code = 'INACCESSIBLE' as const;
  readonly inaccessiblePath: string;

  constructor(
    configPath: string,
    inaccessiblePath: string,
    public override readonly cause?: Error,
  ) {
    super(
      configPath,
      `Caminho inacessível: ${inaccessiblePath}` +
        (cause !== undefined ? `\n${cause.message}` : ''),
    );
    this.inaccessiblePath = inaccessiblePath;
  }
}

// =============================================================================
// API pública
// =============================================================================

/**
 * Caminho absoluto do `config.json` no sistema atual — `getAgentDataDir()` +
 * `config.json` (ADR-028).
 *
 * Em testes, a env `SPRINT_AGENT_DATA_DIR` (ver `main/paths.ts`) aponta o data
 * root para um tmp dir, tornando o caminho determinístico independente da
 * plataforma do runner.
 */
export function getConfigPath(): string {
  return path.join(getAgentDataDir(), CONFIG_FILENAME);
}

/**
 * Carrega e valida `config.json`. Retorna `RuntimeConfig` com millis
 * resolvidos OU lança `ConfigError` específico.
 *
 * Sequência:
 *  1. Resolve path → `fs.readFile`. ENOENT → `ConfigNotFoundError`;
 *     outros (EISDIR/EACCES) → `ConfigInaccessibleError(configPath)`.
 *  2. `JSON.parse`. Falha → `ConfigInvalidError`.
 *  3. Extrai `minimize_after_seconds` do raw (campo extra). Se presente,
 *     valida via `minimizeAfterSecondsSchema`. Falha → `ConfigInvalidError`.
 *  4. Strip do campo extra + `safeParseAgentConfig` no resto. Falha →
 *     `ConfigInvalidError`.
 *  5. Retorna `RuntimeConfig` com defaults aplicados. A acessibilidade do
 *     `shared_path` NÃO é verificada aqui (ADR-027) — é a máquina de
 *     reconexão do `PollingService` que cuida disso em runtime.
 */
export async function loadConfig(): Promise<RuntimeConfig> {
  const configPath = getConfigPath();

  // 1. Read file
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      throw new ConfigNotFoundError(configPath);
    }
    throw new ConfigInaccessibleError(configPath, configPath, e);
  }

  // 2. Parse JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch (err) {
    throw new ConfigInvalidError(configPath, err as Error);
  }

  if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
    throw new ConfigInvalidError(
      configPath,
      new Error('Conteúdo deve ser um objeto JSON (`{ ... }`)'),
    );
  }

  // 3. Extrai e valida `minimize_after_seconds` (campo extra W1-only).
  // Reading via index access para evitar `as Record<string, unknown>` no
  // path principal — o type narrow acima já garantiu objeto plain.
  const rawObject = parsedJson as Record<string, unknown>;
  const minimizeAfterRaw = rawObject.minimize_after_seconds;
  let minimizeAfterSeconds = DEFAULT_MINIMIZE_AFTER_SECONDS;
  if (minimizeAfterRaw !== undefined) {
    const result = minimizeAfterSecondsSchema.safeParse(minimizeAfterRaw);
    if (!result.success) {
      throw new ConfigInvalidError(configPath, result.error);
    }
    minimizeAfterSeconds = result.data;
  }

  // 4. Strip campo extra antes do safeParse (agentConfigSchema é strict).
  const { minimize_after_seconds: _strip, ...canonicalRaw } = rawObject;
  const canonical = safeParseAgentConfig(canonicalRaw);
  if (!canonical.success) {
    throw new ConfigInvalidError(configPath, canonical.error);
  }
  const config: AgentConfig = canonical.data;

  // 5. Resolve millis + retorna RuntimeConfig.
  //
  // NÃO validamos a acessibilidade do `shared_path` aqui (ADR-027): a
  // reachability da pasta compartilhada é condição de runtime, tratada pela
  // máquina de reconexão do PollingService (tray vermelho + backoff). Isso
  // torna o boot resiliente — o Agent sobe mesmo com o servidor fora e
  // conecta sozinho quando ele voltar (RNF-07, BL-C3-013).
  return {
    userId: config.user_id,
    userNomeExibicao: config.user_nome_exibicao,
    hostname: config.hostname,
    sharedPath: config.shared_path,
    pollingIntervalMs: config.polling_interval_seconds * 1000,
    minimizeAfterMs: minimizeAfterSeconds * 1000,
    somNotificacao: config.som_notificacao,
  };
}
