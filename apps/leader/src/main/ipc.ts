/**
 * Handlers IPC do main process do Leader.
 *
 * Cada handler usa `IpcResult<T>` (envelope) ou um discriminated union
 * dedicado (`GetConfigResult`) — erros são serializados para o renderer
 * em vez de relançados (exceptions não cruzam o IPC do Electron).
 *
 * `IpcDependencies` é injetada pelo `main/index.ts` durante o bootstrap.
 * Se a config falhar no boot, `operatorsService` e `dispatchService`
 * ficam `null` — os handlers correspondentes retornam erro
 * `CONFIG_REQUIRED`. O handler `getConfig` invoca o `rebuildDeps`
 * callback quando o líder corrige a config e a janela é recarregada,
 * destravando os outros handlers sem precisar reiniciar o app.
 *
 * @see DECISIONS.md ADR-009 (IPC contract-first)
 */

import { ipcMain } from 'electron';

import type {
  DispatchSprintRequest,
  DispatchSprintResponse,
  GetConfigResult,
  IpcResult,
  ListAcksResponse,
  OperatorsListResponse,
} from '../shared/ipc-types';

import { ConfigError, getConfigPath, type LeaderConfig, loadLeaderConfig } from './config';
import type { AckTrackingService, AckTrackingTarget } from './services/ackTrackingService';
import type { DispatchService } from './services/dispatchService';
import type { OperatorsService } from './services/operatorsService';

/**
 * Estado mutável compartilhado entre o `main/index.ts` (bootstrap) e os
 * handlers IPC. `null` reflete "config falhou no boot — handlers
 * correspondentes retornam CONFIG_REQUIRED até `rebuildDeps` rodar".
 */
export interface IpcDependencies {
  operatorsService: OperatorsService | null;
  dispatchService: DispatchService | null;
  ackTrackingService: AckTrackingService | null;
}

/**
 * Callback que tenta carregar a config e popular `IpcDependencies`.
 *
 * Retorna o `LeaderConfig` carregado — usado pelo handler `getConfig`
 * para responder sem precisar fazer `loadLeaderConfig` duas vezes.
 *
 * Lança `ConfigError` se a config ainda falhar.
 */
export type RebuildDepsFn = () => Promise<LeaderConfig>;

/**
 * Registra todos os handlers IPC do Leader. Chamado uma vez durante o
 * bootstrap, após `app.whenReady()`.
 */
export function registerIpcHandlers(deps: IpcDependencies, rebuildDeps: RebuildDepsFn): void {
  ipcMain.handle('ping', () => 'pong');

  // ===========================================================================
  // getConfig — discriminated union tipado para ConfigErrorScreen.
  //
  // Tenta carregar config; se deps ainda estão null (boot falhou), invoca
  // rebuildDeps para destravar listOperators/dispatchSprint. Idempotente.
  // ===========================================================================
  ipcMain.handle('getConfig', async (): Promise<GetConfigResult> => {
    try {
      const config: LeaderConfig =
        deps.operatorsService === null ? await rebuildDeps() : await loadLeaderConfig();
      return {
        ok: true,
        config: { shared_path: config.shared_path, criado_por: config.criado_por },
      };
    } catch (err) {
      if (err instanceof ConfigError) {
        return {
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            expectedPath: err.configPath,
          },
        };
      }
      // Erro inesperado (nunca deveria ocorrer — loadLeaderConfig sempre
      // emite ConfigError). Defensive fallback.
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: { code: 'READ_ERROR', message, expectedPath: getConfigPath() },
      };
    }
  });

  // ===========================================================================
  // listOperators — IpcResult<OperatorsListResponse>.
  // ===========================================================================
  ipcMain.handle('listOperators', async (): Promise<IpcResult<OperatorsListResponse>> => {
    if (deps.operatorsService === null) {
      return {
        ok: false,
        error: {
          code: 'CONFIG_REQUIRED',
          message: 'config.json ausente ou inválido — corrija antes de listar operadores',
        },
      };
    }
    try {
      const data = await deps.operatorsService.list();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: toIpcError(err) };
    }
  });

  // ===========================================================================
  // dispatchSprint — IpcResult<DispatchSprintResponse>.
  // ===========================================================================
  ipcMain.handle(
    'dispatchSprint',
    async (_event, request: DispatchSprintRequest): Promise<IpcResult<DispatchSprintResponse>> => {
      if (deps.dispatchService === null) {
        return {
          ok: false,
          error: {
            code: 'CONFIG_REQUIRED',
            message: 'config.json ausente ou inválido — corrija antes de despachar',
          },
        };
      }
      try {
        const data = await deps.dispatchService.dispatch(request);
        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: toIpcError(err) };
      }
    },
  );

  // ===========================================================================
  // listAcks — IpcResult<ListAcksResponse>. Endpoint de polling 3s da
  // tela de acompanhamento (BL-C2-008).
  // ===========================================================================
  ipcMain.handle(
    'listAcks',
    async (
      _event,
      sprintId: string,
      targets: readonly AckTrackingTarget[],
    ): Promise<IpcResult<ListAcksResponse>> => {
      if (deps.ackTrackingService === null) {
        return {
          ok: false,
          error: {
            code: 'CONFIG_REQUIRED',
            message: 'config.json ausente ou inválido — corrija antes de consultar acks',
          },
        };
      }
      try {
        const data = await deps.ackTrackingService.list(sprintId, targets);
        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: toIpcError(err) };
      }
    },
  );
}

function toIpcError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error ? err.name : 'UNKNOWN';
  return { code, message };
}
