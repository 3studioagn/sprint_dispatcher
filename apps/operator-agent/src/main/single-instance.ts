/**
 * Garantia de instância única para o Sprint Operator Agent.
 *
 * Múltiplas instâncias do agent na mesma estação causariam:
 * - Acks duplicados (operador "responde" 2 vezes)
 * - Polling concorrente do mesmo arquivo (corrida)
 * - Tray icons duplicados (UX confusa)
 *
 * Uso: chamar `acquireSingleInstanceLock(app)` no início do main process,
 * antes de qualquer outra coisa. Se retornar `false`, o app deve sair
 * imediatamente.
 *
 * @see DECISIONS.md ADR-011
 */

import type { App } from 'electron';

/**
 * Tenta adquirir o lock de instância única.
 *
 * @param app - O objeto `app` do Electron.
 * @returns `true` se este processo é a instância primária; `false` caso
 *          contrário (e o processo deve sair imediatamente).
 */
export function acquireSingleInstanceLock(app: App): boolean {
  return app.requestSingleInstanceLock();
}
