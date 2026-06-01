/**
 * Store do gate de permissão do líder (BL-C2-012).
 *
 * Guarda o resultado da verificação de permissão de escrita em `pending/`
 * (probe via IPC `api.canDispatch`). Dirige o estado do botão "Disparar" na
 * Nova Rodada: bloqueia + mostra mensagem quando o usuário Windows não tem
 * acesso de escrita à pasta de sprints; oferece "Verificar novamente".
 *
 * `allowed === null` = ainda não verificado (não bloqueia por permissão —
 * a validade do formulário já gateia). `false` = bloqueado. `true` = ok.
 *
 * @see Requisitos RN-01, US-04.02, RNF-19
 * @see DECISIONS.md ADR-007 (probe write em vez de consulta AD)
 */

import { create } from 'zustand';

import { api } from '../services/api';

/** Fallback caso o main retorne `allowed:false` sem `reason`. */
const FALLBACK_REASON =
  'Você não tem permissão para disparar sprints — sem acesso de escrita à pasta de sprints. Contate o TI.';

export interface PermissionState {
  /** `null` = não verificado; `true`/`false` = resultado da última checagem. */
  readonly allowed: boolean | null;
  /** Verificação em andamento. */
  readonly checking: boolean;
  /** Motivo exibido quando `allowed === false`. */
  readonly reason: string | null;

  /** Dispara/repete a verificação via IPC. Usado no mount e no "Verificar novamente". */
  check: () => Promise<void>;
  /** Reset (testes/sessão). */
  reset: () => void;
}

const INITIAL: Pick<PermissionState, 'allowed' | 'checking' | 'reason'> = {
  allowed: null,
  checking: false,
  reason: null,
};

export const usePermissionStore = create<PermissionState>((set) => ({
  ...INITIAL,

  check: async () => {
    set({ checking: true });
    try {
      const result = await api.canDispatch();
      if (result.ok) {
        set({
          allowed: result.data.allowed,
          reason: result.data.allowed ? null : (result.data.reason ?? FALLBACK_REASON),
          checking: false,
        });
      } else {
        // CONFIG_REQUIRED ou outro erro de IPC — bloqueia com a mensagem.
        set({ allowed: false, reason: result.error.message, checking: false });
      }
    } catch (err) {
      set({
        allowed: false,
        reason: err instanceof Error ? err.message : String(err),
        checking: false,
      });
    }
  },

  reset: () => {
    set(INITIAL);
  },
}));

// =============================================================================
// Selectors puros
// =============================================================================

/** `true` quando o dispatch está bloqueado por falta de permissão. */
export function selectIsDispatchBlocked(state: PermissionState): boolean {
  return state.allowed === false;
}
