/**
 * Contratos IPC compartilhados entre main process e renderer (overlay).
 *
 * Toda comunicação main↔renderer passa por estes tipos. O preload script
 * implementa `AgentAPI` e a expõe via `contextBridge.exposeInMainWorld`.
 * O renderer consome via `window.api: AgentAPI`.
 *
 * Convenção: cada canal IPC corresponde 1-to-1 ao nome do método.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

/**
 * Subconjunto seguro do `AgentConfig` exposto ao renderer.
 *
 * O renderer não precisa de `shared_path`, `polling_interval_seconds` nem
 * `log_level` — apenas dos dados do operador para exibição no overlay.
 * Expor só este subset é defesa em profundidade (ver ADR-012).
 */
export interface SafeAgentConfigView {
  user_id: string;
  user_nome_exibicao: string;
  hostname: string;
}

/**
 * API exposta pelo main process ao renderer do overlay.
 *
 * W0: `ping` (smoke do bridge) e `getConfig` (campos seguros do config).
 * W1+: receber o sprint payload, enviar o ack, dispensar o overlay.
 */
export interface AgentAPI {
  /**
   * Smoke test do bridge IPC. Retorna `'pong'`.
   */
  ping(): Promise<string>;

  /**
   * Retorna os campos seguros do config (sem paths internos nem polling).
   */
  getConfig(): Promise<SafeAgentConfigView>;
}
