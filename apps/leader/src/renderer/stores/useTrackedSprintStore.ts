/**
 * Store da sprint sendo acompanhada na tela de Acompanhamento (BL-C2-008
 * + BL-C2-009).
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
 * `cancelled` (BL-C2-009): após `CancelSprintButton` chamar
 * `api.cancelSprint` com sucesso, o renderer chama `markCancelled()`.
 * `Acompanhamento` interrompe o polling e renderiza o estado
 * pós-cancelamento (badge "cancelada"); o Agent (BL-C3-011) processa
 * o `cancel-*.json` e fecha o overlay no operador.
 *
 * @see Requisitos UC-04, UC-05
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
  /**
   * Verdadeiro após o líder cancelar a sprint via UC-05 (BL-C2-009).
   * O polling de acks deve parar e a UI marca visualmente o estado
   * "cancelada". O ack mais recente fica visível como auditoria.
   */
  readonly cancelled: boolean;
}

export interface TrackedSprintState {
  /** Sprint sendo acompanhada, ou `null` se nenhuma foi disparada na sessão. */
  readonly current: TrackedSprint | null;

  /** Registra a sprint como ativa (chamado após dispatch bem-sucedido). */
  setCurrent: (sprint: Omit<TrackedSprint, 'cancelled'>) => void;
  /** Marca a sprint atual como cancelada (BL-C2-009). No-op se não há sprint. */
  markCancelled: () => void;
  /** Limpa o tracking — útil para testes e logout futuro. */
  clear: () => void;
}

const INITIAL: Pick<TrackedSprintState, 'current'> = {
  current: null,
};

export const useTrackedSprintStore = create<TrackedSprintState>((set) => ({
  ...INITIAL,

  setCurrent: (sprint) => {
    set({ current: { ...sprint, cancelled: false } });
  },

  markCancelled: () => {
    set((state) => {
      if (state.current === null) return state;
      if (state.current.cancelled) return state;
      return { current: { ...state.current, cancelled: true } };
    });
  },

  clear: () => {
    set(INITIAL);
  },
}));

// =============================================================================
// Selectors puros
// =============================================================================

/** Verdadeiro quando há sprint sendo acompanhada (cancelada ou não). */
export function selectHasCurrentSprint(state: TrackedSprintState): boolean {
  return state.current !== null;
}

/**
 * Verdadeiro quando há sprint ativa NÃO-cancelada — o polling deve
 * continuar e o botão "Cancelar Sprint" deve aparecer (BL-C2-009).
 */
export function selectIsSprintActive(state: TrackedSprintState): boolean {
  return state.current !== null && !state.current.cancelled;
}
