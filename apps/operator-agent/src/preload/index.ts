/**
 * Preload do Sprint Operator Agent.
 *
 * Roda em contexto isolado e sandboxed. Expõe uma API limitada ao
 * renderer do overlay via `contextBridge.exposeInMainWorld('api', impl)`.
 *
 * O renderer acessa exclusivamente `window.api.*` — tipado pelo
 * `Window['api']` declarado em `src/renderer/env.d.ts`.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import { contextBridge, ipcRenderer } from 'electron';

import type { AgentAPI, SafeAgentConfigView } from '../shared/ipc-types';

/**
 * Type guard runtime para `SafeAgentConfigView` — defesa em profundidade
 * caso o main process retorne um shape inesperado.
 */
function isSafeAgentConfigView(value: unknown): value is SafeAgentConfigView {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.user_id === 'string' &&
    typeof v.user_nome_exibicao === 'string' &&
    typeof v.hostname === 'string'
  );
}

const api: AgentAPI = {
  async ping(): Promise<string> {
    const result: unknown = await ipcRenderer.invoke('ping');
    if (typeof result !== 'string') {
      throw new TypeError('ping: o handler retornou um tipo inesperado');
    }
    return result;
  },

  async getConfig(): Promise<SafeAgentConfigView> {
    const result: unknown = await ipcRenderer.invoke('getConfig');
    if (!isSafeAgentConfigView(result)) {
      throw new TypeError('getConfig: o handler retornou um shape inesperado');
    }
    return result;
  },
};

contextBridge.exposeInMainWorld('api', api);
