import { beforeEach, describe, expect, it } from 'vitest';

import type { DispatchSprintResponse } from '../../shared/ipc-types';

import { selectHasFailures, selectIsDispatching, useDispatchStore } from './useDispatchStore';

const SAMPLE_SUCCESS: DispatchSprintResponse = {
  sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
  per_operator: [
    {
      user_id: 'joao',
      user_nome_exibicao: 'João Silva',
      status: 'success',
      filename: '01HX9K2M4F8N7P2Q5R3S6T7V8W-joao.json',
    },
    {
      user_id: 'maria',
      user_nome_exibicao: 'Maria Souza',
      status: 'success',
      filename: '01HX9K2M4F8N7P2Q5R3S6T7V8W-maria.json',
    },
  ],
  summary: { total: 2, success: 2, failed: 0 },
};

const SAMPLE_PARTIAL: DispatchSprintResponse = {
  sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
  per_operator: [
    {
      user_id: 'joao',
      user_nome_exibicao: 'João Silva',
      status: 'success',
      filename: '01HX9K2M4F8N7P2Q5R3S6T7V8W-joao.json',
    },
    {
      user_id: 'maria',
      user_nome_exibicao: 'Maria Souza',
      status: 'error',
      error_message: 'EACCES: permissão negada ao escrever em pending/',
    },
  ],
  summary: { total: 2, success: 1, failed: 1 },
};

describe('useDispatchStore — transitions', () => {
  beforeEach(() => {
    useDispatchStore.getState().reset();
  });

  it('inicia em idle com result e globalError nulos', () => {
    const s = useDispatchStore.getState();
    expect(s.status).toBe('idle');
    expect(s.result).toBeNull();
    expect(s.globalError).toBeNull();
  });

  it('start() transita para in_progress e limpa estado anterior', () => {
    useDispatchStore.getState().setResult(SAMPLE_PARTIAL);
    useDispatchStore.getState().setError('previous fatal');
    useDispatchStore.getState().start();
    const s = useDispatchStore.getState();
    expect(s.status).toBe('in_progress');
    expect(s.result).toBeNull();
    expect(s.globalError).toBeNull();
  });

  it('setResult() transita para completed e armazena o resultado', () => {
    useDispatchStore.getState().start();
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    const s = useDispatchStore.getState();
    expect(s.status).toBe('completed');
    expect(s.result).toEqual(SAMPLE_SUCCESS);
    expect(s.globalError).toBeNull();
  });

  it('setError() transita para error e armazena a mensagem', () => {
    useDispatchStore.getState().start();
    useDispatchStore.getState().setError('Config inválida');
    const s = useDispatchStore.getState();
    expect(s.status).toBe('error');
    expect(s.globalError).toBe('Config inválida');
  });

  it('setError() preserva result anterior (spec §6.6)', () => {
    useDispatchStore.getState().setResult(SAMPLE_PARTIAL);
    useDispatchStore.getState().setError('Falha tardia');
    const s = useDispatchStore.getState();
    expect(s.status).toBe('error');
    expect(s.result).toEqual(SAMPLE_PARTIAL);
    expect(s.globalError).toBe('Falha tardia');
  });

  it('reset() retorna a idle limpando result e globalError', () => {
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    useDispatchStore.getState().setError('something');
    useDispatchStore.getState().reset();
    const s = useDispatchStore.getState();
    expect(s.status).toBe('idle');
    expect(s.result).toBeNull();
    expect(s.globalError).toBeNull();
  });

  it('fluxo happy path: start → setResult', () => {
    useDispatchStore.getState().start();
    expect(useDispatchStore.getState().status).toBe('in_progress');
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    expect(useDispatchStore.getState().status).toBe('completed');
    expect(useDispatchStore.getState().result).toEqual(SAMPLE_SUCCESS);
  });

  it('fluxo de erro fatal: start → setError', () => {
    useDispatchStore.getState().start();
    useDispatchStore.getState().setError('Fatal');
    const s = useDispatchStore.getState();
    expect(s.status).toBe('error');
    expect(s.globalError).toBe('Fatal');
  });

  it('fluxo de retry: start() entre dois setResult limpa o anterior', () => {
    useDispatchStore.getState().setResult(SAMPLE_PARTIAL);
    expect(useDispatchStore.getState().result).toEqual(SAMPLE_PARTIAL);
    useDispatchStore.getState().start();
    expect(useDispatchStore.getState().result).toBeNull();
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    expect(useDispatchStore.getState().result).toEqual(SAMPLE_SUCCESS);
  });

  it('start() limpa globalError de tentativa anterior', () => {
    useDispatchStore.getState().setError('prev');
    useDispatchStore.getState().start();
    expect(useDispatchStore.getState().globalError).toBeNull();
  });

  it('setResult() limpa globalError de tentativa anterior', () => {
    useDispatchStore.getState().setError('prev');
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    expect(useDispatchStore.getState().globalError).toBeNull();
  });
});

describe('selectIsDispatching', () => {
  beforeEach(() => {
    useDispatchStore.getState().reset();
  });

  it('retorna false em idle', () => {
    expect(selectIsDispatching(useDispatchStore.getState())).toBe(false);
  });

  it('retorna true durante in_progress', () => {
    useDispatchStore.getState().start();
    expect(selectIsDispatching(useDispatchStore.getState())).toBe(true);
  });

  it('retorna false após completed', () => {
    useDispatchStore.getState().start();
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    expect(selectIsDispatching(useDispatchStore.getState())).toBe(false);
  });

  it('retorna false após error', () => {
    useDispatchStore.getState().start();
    useDispatchStore.getState().setError('fatal');
    expect(selectIsDispatching(useDispatchStore.getState())).toBe(false);
  });
});

describe('selectHasFailures', () => {
  beforeEach(() => {
    useDispatchStore.getState().reset();
  });

  it('retorna false quando nao ha result', () => {
    expect(selectHasFailures(useDispatchStore.getState())).toBe(false);
  });

  it('retorna false quando todas as operacoes sucederam', () => {
    useDispatchStore.getState().setResult(SAMPLE_SUCCESS);
    expect(selectHasFailures(useDispatchStore.getState())).toBe(false);
  });

  it('retorna true quando pelo menos uma per-operator falhou', () => {
    useDispatchStore.getState().setResult(SAMPLE_PARTIAL);
    expect(selectHasFailures(useDispatchStore.getState())).toBe(true);
  });
});
