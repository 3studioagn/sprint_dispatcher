/**
 * Preload do Sprint Operator Agent.
 *
 * Roda em contexto isolado e sandboxed. Expõe `window.api` ao renderer
 * via `contextBridge.exposeInMainWorld`.
 *
 * O renderer acessa exclusivamente `window.api.*` — tipado pelo
 * `Window['api']` declarado em `src/renderer/env.d.ts`.
 *
 * **Convenção:** properties são arrow functions (não method-shorthand) —
 * ADR-017. Evita lint `@typescript-eslint/unbound-method` quando testes
 * fazem `vi.mocked(window.api.config.get)`.
 *
 * **Gate 2 (W1):** apenas `config:get` está registrado como handler no
 * main process. Outros canais (`sprint:acknowledge`, `sprint:incoming`,
 * `queue:updated`, `overlay:minimize`) terão handlers/emissores nos Gates
 * 3-6. A surface da `window.api` permanece estável desde já — listeners
 * registrados antes do main emitir nada simplesmente nunca disparam.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import type {
  AcknowledgeSprintRequest,
  AcknowledgeSprintResponse,
  Api,
  ConfigStatusResponse,
  IncomingSprintEvent,
  IpcResult,
  QueueUpdatedEvent,
  Unsubscribe,
} from '../shared/ipc-types';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Registra um listener de canal push (main → renderer) e retorna função
 * de unsubscribe. Padrão usado por todas as APIs `on*` da `Api`.
 *
 * O wrapper interno casa a assinatura genérica de `ipcRenderer.on` com a
 * assinatura específica do callback do consumer — evita o consumer ter
 * que lidar com `IpcRendererEvent`.
 */
function subscribePush<TPayload>(channel: string, cb: (payload: TPayload) => void): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: TPayload): void => {
    cb(payload);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

// =============================================================================
// API
// =============================================================================

const api: Api = {
  config: {
    get: (): Promise<ConfigStatusResponse> =>
      ipcRenderer.invoke('config:get') as Promise<ConfigStatusResponse>,
  },

  sprint: {
    requestCurrent: (): Promise<IncomingSprintEvent | null> =>
      ipcRenderer.invoke('sprint:request-current') as Promise<IncomingSprintEvent | null>,
    acknowledge: (req: AcknowledgeSprintRequest): Promise<IpcResult<AcknowledgeSprintResponse>> =>
      ipcRenderer.invoke('sprint:acknowledge', req) as Promise<
        IpcResult<AcknowledgeSprintResponse>
      >,
    onIncoming: (cb: (event: IncomingSprintEvent) => void): Unsubscribe =>
      subscribePush<IncomingSprintEvent>('sprint:incoming', cb),
  },

  queue: {
    onUpdated: (cb: (event: QueueUpdatedEvent) => void): Unsubscribe =>
      subscribePush<QueueUpdatedEvent>('queue:updated', cb),
  },

  overlay: {
    onMinimize: (cb: () => void): Unsubscribe =>
      subscribePush<Record<string, never>>('overlay:minimize', () => {
        cb();
      }),
    closeReopened: (): Promise<void> =>
      ipcRenderer.invoke('overlay:close-reopened') as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('api', api);
