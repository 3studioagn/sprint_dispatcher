/**
 * Cache da lista de operadores da fábrica (W1.C2 parte 2).
 *
 * Lê de `<shared_path>/operators.json` via IPC (`api.listOperators`) ao
 * ser chamada `loadOperators`. A leitura real e a validação Zod
 * acontecem no main (`operatorsService.list`) — o renderer apenas
 * cacheia o resultado.
 *
 * Filtragem `ativo: true` acontece **aqui** (mesma decisão da W1.C2
 * parte 1) — o service retorna lista completa para auditing; a UI
 * consome apenas ativos. O Rafael Costa do `operators.json` em
 * `dev-fixtures/` permanece na fonte mas é escondido pela UI.
 *
 * Status discriminado (`idle | loading | loaded | error`) substitui o
 * boolean `isLoaded` da W1.C2 parte 1 — permite a UI distinguir
 * "nunca tentei carregar" de "tentei e falhei" e mostrar mensagens
 * apropriadas.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader)
 * @see DECISIONS.md ADR-013 (filesystem adapter port-and-adapter)
 */

import { create } from 'zustand';

import type { Operator } from '../../shared/types/operator';
import { api } from '../services/api';

export type OperatorsLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface OperatorsState {
  readonly operators: readonly Operator[];
  readonly status: OperatorsLoadStatus;
  readonly error: string | null;
  /**
   * Carrega `operators.json` via IPC. Idempotente — pode ser chamado
   * várias vezes (ex.: re-tentativa após erro). Em vôo, `status` fica
   * `loading`; ao terminar, `loaded` com os operadores ou `error` com
   * a mensagem.
   */
  loadOperators: () => Promise<void>;
  /** Volta ao estado inicial — utility para testes e logout futuro. */
  reset: () => void;
}

const INITIAL: Pick<OperatorsState, 'operators' | 'status' | 'error'> = {
  operators: [],
  status: 'idle',
  error: null,
};

export const useOperatorsStore = create<OperatorsState>((set) => ({
  ...INITIAL,

  loadOperators: async () => {
    set({ status: 'loading', error: null });
    try {
      const result = await api.listOperators();
      if (!result.ok) {
        set({ status: 'error', error: result.error.message, operators: [] });
        return;
      }
      const active = result.data.operators.filter((op) => op.ativo);
      set({ status: 'loaded', operators: active, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: 'error', error: msg, operators: [] });
    }
  },

  reset: () => {
    set(INITIAL);
  },
}));
