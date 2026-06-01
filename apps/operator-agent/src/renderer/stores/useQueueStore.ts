/**
 * Store espelho da queue length do main process. Read-only do ponto de
 * vista do renderer — atualizada pelos hooks `useIncomingSprint` e
 * `useQueueUpdated` que recebem push do main.
 *
 * O `length` representa o TOTAL na fila (incluindo a sprint atualmente
 * exibida). Para o badge "+N aguardando", use `selectExtraInQueue` que
 * subtrai 1.
 */

import { create } from 'zustand';

export interface QueueState {
  length: number;
  setLength: (length: number) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  length: 0,
  setLength: (length) => {
    set({ length });
  },
}));

/**
 * Quantidade de sprints AGUARDANDO além da atualmente exibida. Usado pelo
 * `QueueIndicator` — quando 0, não renderiza nada.
 */
export const selectExtraInQueue = (state: QueueState): number => Math.max(0, state.length - 1);
