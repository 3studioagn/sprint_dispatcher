/**
 * Store da sprint atualmente exibida no overlay.
 *
 * Atualizada por:
 * - `useIncomingSprint` hook ao receber `sprint:incoming` push ou ao
 *   pullar via `sprint:request-current` no mount inicial.
 * - Gate 6: limpa após ack final (junto com dequeue do queueService).
 *
 * **`isReopened` (BL-C3-009):** `true` quando o último push veio com
 * `reopened: true` — overlay está exibindo um aviso reaberto via tray.
 * Renderer muda o botão "Recebi" por "Fechar" e usa o handler
 * `closeReopened` em vez de `acknowledge`.
 *
 * Selector puro `selectHasSprint` separado do `create()` (padrão estabelecido
 * em ADR-015 do Leader).
 */

import type { SprintPayload } from '@sprint/contracts';
import { create } from 'zustand';

export interface CurrentSprintState {
  sprint: SprintPayload | null;
  isReopened: boolean;
  setCurrent: (sprint: SprintPayload, isReopened?: boolean) => void;
  clearCurrent: () => void;
}

export const useCurrentSprintStore = create<CurrentSprintState>((set) => ({
  sprint: null,
  isReopened: false,
  setCurrent: (sprint, isReopened = false) => {
    set({ sprint, isReopened });
  },
  clearCurrent: () => {
    set({ sprint: null, isReopened: false });
  },
}));

/** True quando há sprint a exibir; false quando o overlay deveria mostrar placeholder. */
export const selectHasSprint = (state: CurrentSprintState): boolean => state.sprint !== null;
