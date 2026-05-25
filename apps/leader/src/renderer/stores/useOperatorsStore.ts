/**
 * Cache da lista de operadores da fábrica (W1.C2 parte 1).
 *
 * Nesta sessão a lista vem do mock `data/operators.mock.ts`. Em BL-C4-002+
 * (W1.C4), `loadOperators` passa a ler `operators.json` da pasta compartilhada
 * via `@sprint/fs-adapter` (assíncrono); a assinatura desta action vira async.
 *
 * Filtragem por `ativo === true` acontece aqui — UI consome apenas operadores
 * ativos. O mock inclui um inativo (`rafael`) justamente para exercitar.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 */

import { create } from 'zustand';

import { MOCK_OPERATORS } from '../data/operators.mock';
import type { Operator } from '../types/operator';

export interface OperatorsState {
  readonly operators: readonly Operator[];
  readonly isLoaded: boolean;
  /** Carrega a lista (atualmente do mock; async em W1.C4). */
  loadOperators: () => void;
}

export const useOperatorsStore = create<OperatorsState>((set) => ({
  operators: [],
  isLoaded: false,
  loadOperators: () => {
    const active = MOCK_OPERATORS.filter((op) => op.ativo);
    set({ operators: active, isLoaded: true });
  },
}));
