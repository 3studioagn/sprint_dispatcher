/**
 * Contratos IPC compartilhados entre main process e renderer.
 *
 * Toda comunicação main↔renderer passa por este tipo. O preload script
 * implementa LeaderAPI e expõe via `contextBridge.exposeInMainWorld`.
 * O renderer consome via `window.api: LeaderAPI`.
 *
 * Convenção de nomes IPC:
 * - Métodos imperativos no infinitivo (camelCase) → `ping`, `dispatchSprint`,
 *   `listAcks`, `cancelSprint`
 * - Canais correspondem 1-to-1 ao nome do método
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

/**
 * API exposta pelo main process ao renderer.
 *
 * W0: apenas smoke test (`ping`).
 * W1+: métodos reais virão com BL-C2-007 (dispatch), BL-C2-008 (acks), etc.
 */
export interface LeaderAPI {
  /**
   * Smoke test do bridge IPC. Retorna 'pong'.
   */
  ping(): Promise<string>;
}

/**
 * (Placeholder para W1+: eventos main → renderer.)
 *
 * Quando houver streams reais (ex: novos acks chegando), definir aqui:
 * `interface LeaderEvents { 'ack-received': SprintAck }` e usar
 * `ipcRenderer.on(channel, listener)` no preload.
 */
