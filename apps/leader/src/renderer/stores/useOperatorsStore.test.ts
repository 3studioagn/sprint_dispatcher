import { beforeEach, describe, expect, it } from 'vitest';

import { useOperatorsStore } from './useOperatorsStore';

const store = useOperatorsStore;

describe('useOperatorsStore', () => {
  beforeEach(() => {
    store.setState({ operators: [], isLoaded: false });
  });

  it('estado inicial: lista vazia e isLoaded=false', () => {
    const state = store.getState();
    expect(state.operators).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });

  it('loadOperators preenche apenas operadores com ativo: true', () => {
    store.getState().loadOperators();
    const state = store.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.operators).toHaveLength(4);
    expect(state.operators.every((op) => op.ativo)).toBe(true);
  });

  it('loadOperators filtra rafael (ativo: false) e mantém os 4 ativos do mock', () => {
    store.getState().loadOperators();
    const ids = store.getState().operators.map((op) => op.user_id);
    expect(ids).toEqual(['joao', 'maria', 'carlos', 'beatriz']);
    expect(ids).not.toContain('rafael');
  });

  it('loadOperators é idempotente — chamar duas vezes resulta no mesmo conteúdo', () => {
    store.getState().loadOperators();
    const first = store.getState().operators;
    store.getState().loadOperators();
    const second = store.getState().operators;
    expect(second).toEqual(first);
  });
});
