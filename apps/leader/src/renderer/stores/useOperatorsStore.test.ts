import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_OPERATORS } from '../__test-fixtures__/operators';

import { useOperatorsStore } from './useOperatorsStore';

const store = useOperatorsStore;

describe('useOperatorsStore — estado inicial', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('lista vazia, status idle, error null', () => {
    const state = store.getState();
    expect(state.operators).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });
});

describe('useOperatorsStore.loadOperators — sucesso', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('transita para loaded e filtra ativo:true', async () => {
    await store.getState().loadOperators();
    const state = store.getState();
    expect(state.status).toBe('loaded');
    expect(state.operators).toHaveLength(4);
    expect(state.operators.every((op) => op.ativo)).toBe(true);
    expect(state.error).toBeNull();
  });

  it('filtra rafael (ativo:false) e mantém os 4 ativos', async () => {
    await store.getState().loadOperators();
    const ids = store.getState().operators.map((op) => op.user_id);
    expect(ids).toEqual(['joao', 'maria', 'carlos', 'beatriz']);
    expect(ids).not.toContain('rafael');
  });

  it('chamado novamente substitui o cache (idempotente)', async () => {
    await store.getState().loadOperators();
    const first = store.getState().operators;
    await store.getState().loadOperators();
    const second = store.getState().operators;
    expect(second).toEqual(first);
  });

  it('passa por status=loading durante a chamada', async () => {
    let resolveListOps!: (value: {
      ok: true;
      data: { operators: typeof TEST_OPERATORS; source: string; lastModified: string };
    }) => void;
    vi.mocked(window.api.listOperators).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveListOps = resolve;
      }),
    );

    const loadPromise = store.getState().loadOperators();
    expect(store.getState().status).toBe('loading');
    expect(store.getState().error).toBeNull();

    resolveListOps({
      ok: true,
      data: { operators: TEST_OPERATORS, source: '/x', lastModified: '2026-05-25T10:00:00Z' },
    });
    await loadPromise;
    expect(store.getState().status).toBe('loaded');
  });
});

describe('useOperatorsStore.loadOperators — falhas', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('transita para error quando IPC retorna ok:false', async () => {
    vi.mocked(window.api.listOperators).mockResolvedValueOnce({
      ok: false,
      error: { code: 'OperatorsFileNotFoundError', message: 'arquivo não existe' },
    });
    await store.getState().loadOperators();
    const state = store.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('arquivo não existe');
    expect(state.operators).toEqual([]);
  });

  it('transita para error quando IPC lança exceção', async () => {
    vi.mocked(window.api.listOperators).mockRejectedValueOnce(new Error('IPC crashed'));
    await store.getState().loadOperators();
    const state = store.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('IPC crashed');
    expect(state.operators).toEqual([]);
  });

  it('error retry: chamar de novo após erro tenta novamente', async () => {
    vi.mocked(window.api.listOperators).mockResolvedValueOnce({
      ok: false,
      error: { code: 'X', message: 'primeira falha' },
    });
    await store.getState().loadOperators();
    expect(store.getState().status).toBe('error');

    // 2ª tentativa usa o default mock (sucesso)
    await store.getState().loadOperators();
    expect(store.getState().status).toBe('loaded');
    expect(store.getState().error).toBeNull();
    expect(store.getState().operators).toHaveLength(4);
  });
});

describe('useOperatorsStore.reset', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('volta a estado inicial limpando operators, status e error', async () => {
    await store.getState().loadOperators();
    expect(store.getState().status).toBe('loaded');
    store.getState().reset();
    const state = store.getState();
    expect(state.operators).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });
});
