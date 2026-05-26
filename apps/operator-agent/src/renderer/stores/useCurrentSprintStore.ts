/**
 * Store da sprint atualmente exibida no overlay.
 *
 * Atualizada por:
 * - `useIncomingSprint` hook ao receber `sprint:incoming` push ou ao
 *   pullar via `sprint:request-current` no mount inicial.
 * - Gate 6: limpa após ack final (junto com dequeue do queueService).
 *
 * Selector puro `selectHasSprint` separado do `create()` (padrão estabelecido
 * em ADR-015 do Leader).
 */

import type { SprintPayload } from '@sprint/contracts';
import { create } from 'zustand';

export interface CurrentSprintState {
  sprint: SprintPayload | null;
  setCurrent: (sprint: SprintPayload) => void;
  clearCurrent: () => void;
}

export const useCurrentSprintStore = create<CurrentSprintState>((set) => ({
  sprint: null,
  setCurrent: (sprint) => {
    set({ sprint });
  },
  clearCurrent: () => {
    set({ sprint: null });
  },
}));

/** True quando há sprint a exibir; false quando o overlay deveria mostrar placeholder. */
export const selectHasSprint = (state: CurrentSprintState): boolean => state.sprint !== null;
