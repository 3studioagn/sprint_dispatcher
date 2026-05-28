/**
 * Store da sprint sendo acompanhada na tela de Acompanhamento (BL-C2-008).
 *
 * Persiste os metadados da última sprint disparada com sucesso pelo
 * líder na sessão atual. Setada por `NovaSprint.handleDispatchClick`
 * (quando `summary.success > 0`); lida por `Acompanhamento` para
 * orientar o polling de acks via `api.listAcks(sprint_id, targets)`.
 *
 * **Escopo de sessão (não-persistido):** ao fechar/recarregar o app, a
 * sprint sai do tracking. Persistência em disco fica fora de escopo
 * (W3+ via histórico no fs-adapter).
 *
 * BL-C2-009 (Phase 4) estenderá esta store com um flag `cancelled`
 * para representar o estado pós-cancelamento.
 *
 * @see Requisitos UC-04
 */

import { create } from 'zustand';

export interface TrackedTarget {
  readonly user_id: string;
  /** Meta despachada para esse operador (uso futuro: comparar contra produzido). */
  readonly meta: number;
}

export interface TrackedSprint {
  /** ULID da sprint. Mesmo `sprint_id` que vai no ack do operador. */
  readonly sprint_id: string;
  /** ISO timestamp do disparo (= local do clique em "Disparar"). */
  readonly dispatched_at: string;
  /** Lista de user_ids da sprint, na ordem em que o líder selecionou. */
  readonly targets: readonly TrackedTarget[];
  /** Título do aviso enviado (para contexto na tela de acompanhamento). */
  readonly title: string;
  /** Deadline (HH:MM 24h) enviado no dispatch (sem conversão para ISO). */
  readonly deadline_hhmm: string;
}

export interface TrackedSprintState {
  /** Sprint sendo acompanhada, ou `null` se nenhuma foi disparada na sessão. */
  readonly current: TrackedSprint | null;

  /** Registra a sprint como ativa (chamado após dispatch bem-sucedido). */
  setCurrent: (sprint: TrackedSprint) => void;
  /** Limpa o tracking — útil para testes e logout futuro. */
  clear: () => void;
}

const INITIAL: Pick<TrackedSprintState, 'current'> = {
  current: null,
};

export const useTrackedSprintStore = create<TrackedSprintState>((set) => ({
  ...INITIAL,

  setCurrent: (sprint) => {
    set({ current: sprint });
  },

  clear: () => {
    set(INITIAL);
  },
}));

// =============================================================================
// Selectors puros
// =============================================================================

/** Verdadeiro quando há sprint sendo acompanhada. */
export function selectHasCurrentSprint(state: TrackedSprintState): boolean {
  return state.current !== null;
}
