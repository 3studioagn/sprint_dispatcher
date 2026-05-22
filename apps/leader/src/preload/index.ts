/**
 * Preload script — Sprint Leader.
 *
 * Roda em contexto isolado e sandboxed. Expõe API limitada ao renderer
 * via `contextBridge.exposeInMainWorld('api', impl)`.
 *
 * O renderer acessa exclusivamente `window.api.*` — tipado pelo
 * `Window['api']` declarado em `src/renderer/env.d.ts`.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import { contextBridge, ipcRenderer } from 'electron';

import type { LeaderAPI } from '../shared/ipc-types';

const api: LeaderAPI = {
  async ping(): Promise<string> {
    const result: unknown = await ipcRenderer.invoke('ping');
    if (typeof result !== 'string') {
      throw new TypeError('ping handler retornou tipo inesperado');
    }
    return result;
  },
};

contextBridge.exposeInMainWorld('api', api);
