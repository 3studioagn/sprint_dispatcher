/**
 * Lógica pura do wizard de configuração inicial (BL-C5-006, ADR-028).
 *
 * Concentra o que é testável isoladamente, sem Electron nem janelas:
 *  - {@link buildAgentConfigFromInput} — monta + valida o `AgentConfig` a
 *    partir do input do wizard (deriva display name, aplica defaults do
 *    Anexo F, valida via Zod do C1).
 *  - {@link writeConfigAtomic} — grava o `config.json` (escrita atômica,
 *    JSON pretty, mkdir recursivo do data root).
 *  - {@link probeSharedPathConnection} — sonda a pasta compartilhada
 *    reaproveitando o `listPending` (C4) + `isConnectivityError` (C3-013),
 *    com a mesma desambiguação de `pending/` ausente do `PollingService`.
 *
 * A orquestração (instanciar adapter/PendingStore reais, chamar `rebuildDeps`,
 * fechar a janela) vive no `main/index.ts` — excluída do coverage como o
 * `ipc.ts`/boot (testada por E2E no C8).
 *
 * @see DECISIONS.md ADR-028
 * @see Requisitos Anexo F (schema do config), UC-06 (configurar estação)
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_POLLING_INTERVAL_MS,
  SCHEMA_VERSION,
  safeParseAgentConfig,
  type AgentConfig,
} from '@sprint/contracts';
import { DirectoryNotFoundError } from '@sprint/fs-adapter';

import type { SetupProbeResult, SetupSaveInput } from '../../shared/ipc-types';

import { isConnectivityError } from './connectivity';

/** Defaults do Anexo F aplicados pelo wizard para os campos não coletados. */
const DEFAULT_POLLING_INTERVAL_SECONDS = Math.round(DEFAULT_POLLING_INTERVAL_MS / 1000);
const DEFAULT_SOM_NOTIFICACAO = true;
const DEFAULT_LOG_LEVEL = 'info' as const;

/**
 * Monta e valida o `AgentConfig` a partir do input do wizard.
 *
 * Deriva `user_nome_exibicao` (default = `user_id` quando ausente/vazio),
 * injeta o `hostname` (vindo de `os.hostname()` no caller), aplica os defaults
 * do Anexo F e valida com `safeParseAgentConfig` (C1). Strings são `.trim()`-adas.
 *
 * @returns `{ ok: true, config }` válido, ou `{ ok: false, message }` com a
 *   mensagem de validação (Zod) pronta para o renderer exibir.
 */
export function buildAgentConfigFromInput(
  input: SetupSaveInput,
  hostname: string,
): { ok: true; config: AgentConfig } | { ok: false; message: string } {
  const userId = input.user_id.trim();
  const displayNameRaw = input.user_nome_exibicao?.trim();
  const displayName =
    displayNameRaw !== undefined && displayNameRaw.length > 0 ? displayNameRaw : userId;

  const candidate = {
    schema_version: SCHEMA_VERSION,
    user_id: userId,
    user_nome_exibicao: displayName,
    hostname: hostname.trim(),
    shared_path: input.shared_path.trim(),
    polling_interval_seconds: DEFAULT_POLLING_INTERVAL_SECONDS,
    som_notificacao: DEFAULT_SOM_NOTIFICACAO,
    log_level: DEFAULT_LOG_LEVEL,
  };

  const result = safeParseAgentConfig(candidate);
  if (!result.success) {
    return { ok: false, message: result.error.message };
  }
  return { ok: true, config: result.data };
}

/**
 * Grava o `config.json` de forma atômica (`.tmp` + rename, sufixo aleatório
 * contra colisão — G-017) com JSON pretty-printed (inspeção manual pelo TI).
 * Cria o diretório pai recursivamente (first-run cria o data root).
 */
export async function writeConfigAtomic(configPath: string, config: AgentConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const tmp = `${configPath}.${randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  await fs.rename(tmp, configPath);
}

/** Dependências de I/O da sondagem — injetadas pelo caller (testável). */
export interface ProbeDeps {
  /** Lista `pending/` da pasta compartilhada (C4 `PendingStore.listPending`). */
  listPending: () => Promise<unknown>;
  /** Verifica se a RAIZ do share existe (C4 `adapter.exists(sharedPath)`). */
  existsRoot: () => Promise<boolean>;
}

/**
 * Sonda a pasta compartilhada e classifica o resultado (BL-C5-006).
 *
 * `listPending` é o sinal primário (sucesso, mesmo `[]`, = acessível). Um
 * `DirectoryNotFoundError` (a subpasta `pending/` ainda não existe) é
 * **ambíguo** — desambiguado sondando a RAIZ do share (`existsRoot`), espelhando
 * o `PollingService` (BL-C3-013): raiz no ar = acessível (o líder cria
 * `pending/` no 1º disparo); raiz ausente = inacessível. Demais erros de
 * conectividade (via `isConnectivityError`) = inacessível.
 */
export async function probeSharedPathConnection(deps: ProbeDeps): Promise<SetupProbeResult> {
  try {
    await deps.listPending();
    return { reachable: true, message: 'Conexão OK — a pasta compartilhada está acessível.' };
  } catch (err) {
    if (err instanceof DirectoryNotFoundError) {
      let rootUp: boolean;
      try {
        rootUp = await deps.existsRoot();
      } catch {
        rootUp = false;
      }
      if (rootUp) {
        return {
          reachable: true,
          message:
            'Conexão OK — a pasta existe. A subpasta "pending" será criada pelo líder no primeiro disparo.',
        };
      }
      return {
        reachable: false,
        message:
          'Pasta não encontrada. Verifique o caminho e se a pasta compartilhada está acessível na rede.',
      };
    }
    if (isConnectivityError(err)) {
      return {
        reachable: false,
        message: 'Sem acesso à pasta compartilhada. Verifique a rede, o caminho e as permissões.',
      };
    }
    return {
      reachable: false,
      message: `Falha ao acessar a pasta: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
