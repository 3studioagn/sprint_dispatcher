/**
 * Store do progresso e resultado de dispatch da sprint (W1.C2 parte 2).
 *
 * Mantém o estado da janela entre o clique em "Enviar" e o fechamento
 * do modal de resumo:
 *
 * - `idle` — nenhum dispatch em curso (estado inicial e pós-`reset`).
 * - `in_progress` — chamou `api.dispatchSprint(...)`, aguardando main.
 * - `completed` — main respondeu com sucesso (pode conter falhas
 *   per-operator em `result.per_operator`); modal mostra resumo.
 * - `error` — falha fatal (config inválida, fs inacessível); modal
 *   mostra mensagem e botão Fechar.
 *
 * `DispatchModal` (Gate 5) consome esta store. Quando o líder fecha o
 * modal, `NovaSprint` chama `reset()` para voltar ao estado inicial.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader)
 * @see CLAUDE.md §4 (estrutura interna do Leader)
 */

import { create } from 'zustand';

import type { DispatchSprintResponse } from '../../shared/ipc-types';

export type DispatchStatus = 'idle' | 'in_progress' | 'completed' | 'error';

export interface DispatchState {
  readonly status: DispatchStatus;
  readonly result: DispatchSprintResponse | null;
  readonly globalError: string | null;

  /** Inicia um novo dispatch. Limpa `result` e `globalError` anteriores. */
  start: () => void;
  /** Registra resposta bem-sucedida do main (pode conter falhas per-operator). */
  setResult: (result: DispatchSprintResponse) => void;
  /** Registra falha fatal. **Preserva `result` anterior** para o modal. */
  setError: (message: string) => void;
  /** Volta ao estado inicial — chamado quando o líder fecha o modal. */
  reset: () => void;
}

const INITIAL: Pick<DispatchState, 'status' | 'result' | 'globalError'> = {
  status: 'idle',
  result: null,
  globalError: null,
};

export const useDispatchStore = create<DispatchState>((set) => ({
  ...INITIAL,

  start: () => {
    set({ status: 'in_progress', result: null, globalError: null });
  },

  setResult: (result) => {
    set({ status: 'completed', result, globalError: null });
  },

  setError: (message) => {
    // Shallow merge — `result` permanece intocado (spec: setError preserva
    // resultado anterior para que o modal possa mostrar parciais + erro).
    set({ status: 'error', globalError: message });
  },

  reset: () => {
    set(INITIAL);
  },
}));

// =============================================================================
// Selectors puros — recebem state, retornam derivações sem side effects.
// =============================================================================

/** Verdadeiro quando uma chamada de dispatch está em vôo. */
export function selectIsDispatching(state: DispatchState): boolean {
  return state.status === 'in_progress';
}

/** Verdadeiro quando o último dispatch teve ≥ 1 falha per-operator. */
export function selectHasFailures(state: DispatchState): boolean {
  return state.result !== null && state.result.summary.failed > 0;
}
