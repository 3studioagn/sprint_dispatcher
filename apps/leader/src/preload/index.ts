/**
 * Preload script — Sprint Leader.
 *
 * Roda em contexto isolado e sandboxed. Expõe API limitada ao renderer
 * via `contextBridge.exposeInMainWorld('api', impl)`.
 *
 * O renderer acessa exclusivamente `window.api.*` — tipado pelo
 * `Window['api']: LeaderAPI` declarado em `src/renderer/env.d.ts`.
 *
 * Métodos são **arrow functions** (não method-shorthand) — alinha com a
 * convenção do `LeaderAPI` (`shared/ipc-types.ts`) para que
 * `vi.mocked(window.api.foo)` em testes não dispare a regra
 * `unbound-method`.
 *
 * Os casts `as` em cada handler são necessários porque
 * `ipcRenderer.invoke` retorna `Promise<any>`. O bridge tipado vive
 * em `shared/ipc-types.ts` — o type checker garante que `LeaderAPI`
 * casa entre preload e renderer.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import { contextBridge, ipcRenderer } from 'electron';

import type {
  ArchiveFilter,
  CanDispatchResponse,
  CancelSprintRequest,
  CancelSprintResponse,
  DispatchSprintRequest,
  DispatchSprintResponse,
  GetConfigResult,
  IpcResult,
  LeaderAPI,
  ListAcksResponse,
  ListArchiveResponse,
  OperatorsListResponse,
  ReadArchivedSprintRequest,
  ReadArchivedSprintResponse,
} from '../shared/ipc-types';

const api: LeaderAPI = {
  ping: async (): Promise<string> => {
    const result: unknown = await ipcRenderer.invoke('ping');
    if (typeof result !== 'string') {
      throw new TypeError('ping handler retornou tipo inesperado');
    }
    return result;
  },

  getConfig: async (): Promise<GetConfigResult> => {
    return (await ipcRenderer.invoke('getConfig')) as GetConfigResult;
  },

  listOperators: async (): Promise<IpcResult<OperatorsListResponse>> => {
    return (await ipcRenderer.invoke('listOperators')) as IpcResult<OperatorsListResponse>;
  },

  dispatchSprint: async (
    request: DispatchSprintRequest,
  ): Promise<IpcResult<DispatchSprintResponse>> => {
    return (await ipcRenderer.invoke(
      'dispatchSprint',
      request,
    )) as IpcResult<DispatchSprintResponse>;
  },

  listAcks: async (
    sprintId: string,
    targets: readonly { user_id: string }[],
  ): Promise<IpcResult<ListAcksResponse>> => {
    return (await ipcRenderer.invoke('listAcks', sprintId, targets)) as IpcResult<ListAcksResponse>;
  },

  cancelSprint: async (request: CancelSprintRequest): Promise<IpcResult<CancelSprintResponse>> => {
    return (await ipcRenderer.invoke('cancelSprint', request)) as IpcResult<CancelSprintResponse>;
  },

  listArchive: async (filter: ArchiveFilter): Promise<IpcResult<ListArchiveResponse>> => {
    return (await ipcRenderer.invoke('listArchive', filter)) as IpcResult<ListArchiveResponse>;
  },

  readArchivedSprint: async (
    request: ReadArchivedSprintRequest,
  ): Promise<IpcResult<ReadArchivedSprintResponse>> => {
    return (await ipcRenderer.invoke(
      'readArchivedSprint',
      request,
    )) as IpcResult<ReadArchivedSprintResponse>;
  },

  canDispatch: async (): Promise<IpcResult<CanDispatchResponse>> => {
    return (await ipcRenderer.invoke('canDispatch')) as IpcResult<CanDispatchResponse>;
  },
};

contextBridge.exposeInMainWorld('api', api);
