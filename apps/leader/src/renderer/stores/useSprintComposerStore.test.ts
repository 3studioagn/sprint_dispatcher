import { beforeEach, describe, expect, it } from 'vitest';

import {
  selectDispatchRequest,
  selectFormPayload,
  selectIsValid,
  selectSelectedCount,
  useSprintComposerStore,
} from './useSprintComposerStore';

const store = useSprintComposerStore;

describe('useSprintComposerStore', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  describe('defaults', () => {
    it('inicia com Map vazio, deadline 18:00, título "É hora de correr" e body vazio', () => {
      const state = store.getState();
      expect(state.selectedOperators.size).toBe(0);
      expect(state.deadline).toBe('18:00');
      expect(state.title).toBe('É hora de correr');
      expect(state.body).toBe('');
    });
  });

  describe('toggleOperator', () => {
    it('marca um operador desmarcado com meta inicial null', () => {
      store.getState().toggleOperator('joao');
      const state = store.getState();
      expect(state.selectedOperators.has('joao')).toBe(true);
      expect(state.selectedOperators.get('joao')).toBeNull();
    });

    it('desmarca um operador previamente marcado', () => {
      store.getState().toggleOperator('joao');
      store.getState().toggleOperator('joao');
      expect(store.getState().selectedOperators.has('joao')).toBe(false);
    });

    it('limpa meta ao desmarcar + remarcar', () => {
      store.getState().toggleOperator('joao');
      store.getState().setMeta('joao', 5);
      store.getState().toggleOperator('joao');
      store.getState().toggleOperator('joao');
      expect(store.getState().selectedOperators.get('joao')).toBeNull();
    });

    it('cria nova referência do Map a cada toggle (imutabilidade)', () => {
      const before = store.getState().selectedOperators;
      store.getState().toggleOperator('joao');
      const after = store.getState().selectedOperators;
      expect(after).not.toBe(before);
    });
  });

  describe('setMeta', () => {
    it('atualiza meta de operador selecionado', () => {
      store.getState().toggleOperator('joao');
      store.getState().setMeta('joao', 10);
      expect(store.getState().selectedOperators.get('joao')).toBe(10);
    });

    it('aceita null para limpar a meta', () => {
      store.getState().toggleOperator('joao');
      store.getState().setMeta('joao', 10);
      store.getState().setMeta('joao', null);
      expect(store.getState().selectedOperators.get('joao')).toBeNull();
    });

    it('é no-op para operador não selecionado', () => {
      const before = store.getState().selectedOperators;
      store.getState().setMeta('joao', 10);
      const after = store.getState().selectedOperators;
      expect(after.has('joao')).toBe(false);
      expect(after).toBe(before);
    });
  });

  describe('selectAll', () => {
    it('marca todos os userIds com meta null quando todos estavam livres', () => {
      store.getState().selectAll(['joao', 'maria', 'carlos']);
      const state = store.getState();
      expect(state.selectedOperators.size).toBe(3);
      expect(state.selectedOperators.get('joao')).toBeNull();
      expect(state.selectedOperators.get('maria')).toBeNull();
      expect(state.selectedOperators.get('carlos')).toBeNull();
    });

    it('preserva metas já preenchidas ao re-selecionar', () => {
      store.getState().toggleOperator('joao');
      store.getState().setMeta('joao', 7);
      store.getState().selectAll(['joao', 'maria']);
      const state = store.getState();
      expect(state.selectedOperators.get('joao')).toBe(7);
      expect(state.selectedOperators.get('maria')).toBeNull();
    });

    it('é idempotente em chamadas seguidas com o mesmo input', () => {
      store.getState().selectAll(['joao', 'maria']);
      const snapshot = Array.from(store.getState().selectedOperators.entries());
      store.getState().selectAll(['joao', 'maria']);
      expect(Array.from(store.getState().selectedOperators.entries())).toEqual(snapshot);
    });
  });

  describe('deselectAll', () => {
    it('limpa todos os operadores selecionados', () => {
      store.getState().selectAll(['joao', 'maria']);
      store.getState().deselectAll();
      expect(store.getState().selectedOperators.size).toBe(0);
    });
  });

  describe('setDeadline', () => {
    it('atualiza o deadline com a string informada (sem validação na store)', () => {
      store.getState().setDeadline('20:00');
      expect(store.getState().deadline).toBe('20:00');
    });

    it('aceita strings malformadas — validação é responsabilidade do selector', () => {
      store.getState().setDeadline('abc');
      expect(store.getState().deadline).toBe('abc');
    });
  });

  describe('reset', () => {
    it('volta tudo ao default', () => {
      store.getState().toggleOperator('joao');
      store.getState().setMeta('joao', 5);
      store.getState().setDeadline('20:00');
      store.getState().reset();
      const state = store.getState();
      expect(state.selectedOperators.size).toBe(0);
      expect(state.deadline).toBe('18:00');
      expect(state.title).toBe('É hora de correr');
      expect(state.body).toBe('');
    });
  });
});

describe('selectSelectedCount (selector puro)', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('retorna 0 quando Map está vazio', () => {
    expect(selectSelectedCount(store.getState())).toBe(0);
  });

  it('retorna o tamanho do Map', () => {
    store.getState().selectAll(['joao', 'maria']);
    expect(selectSelectedCount(store.getState())).toBe(2);
  });

  it('é puro — sem mutação do state', () => {
    store.getState().toggleOperator('joao');
    const before = store.getState();
    selectSelectedCount(before);
    const after = store.getState();
    expect(after).toBe(before);
  });

  it('é determinístico — mesma entrada, mesma saída', () => {
    store.getState().toggleOperator('joao');
    const state = store.getState();
    expect(selectSelectedCount(state)).toBe(selectSelectedCount(state));
  });
});

describe('selectIsValid (selector puro)', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('falso quando nenhum operador está selecionado', () => {
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando algum operador tem meta null', () => {
    store.getState().toggleOperator('joao');
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando alguma meta é zero (RN-07: meta ≥ 1)', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 0);
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando alguma meta é negativa', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', -1);
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando alguma meta é fracionária', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 1.5);
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando alguma meta é NaN', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', Number.NaN);
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando deadline tem formato inválido', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    store.getState().setDeadline('abc');
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando hora ultrapassa 23', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    store.getState().setDeadline('27:00');
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('falso quando minutos ultrapassam 59', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    store.getState().setDeadline('18:60');
    expect(selectIsValid(store.getState())).toBe(false);
  });

  it('verdadeiro quando todos os operadores têm meta válida e deadline OK', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    store.getState().toggleOperator('maria');
    store.getState().setMeta('maria', 10);
    expect(selectIsValid(store.getState())).toBe(true);
  });

  it('aceita deadline na borda 23:59', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 1);
    store.getState().setDeadline('23:59');
    expect(selectIsValid(store.getState())).toBe(true);
  });

  it('aceita deadline na borda 00:00', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 1);
    store.getState().setDeadline('00:00');
    expect(selectIsValid(store.getState())).toBe(true);
  });

  it('é puro — sem mutação do state', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    const before = store.getState();
    selectIsValid(before);
    const after = store.getState();
    expect(after).toBe(before);
  });
});

describe('selectFormPayload (selector puro)', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('retorna null quando o draft é inválido', () => {
    expect(selectFormPayload(store.getState())).toBeNull();
  });

  it('retorna payload validado quando o draft passa', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    store.getState().toggleOperator('maria');
    store.getState().setMeta('maria', 10);

    const payload = selectFormPayload(store.getState());
    expect(payload).not.toBeNull();
    expect(payload?.deadline).toBe('18:00');
    expect(payload?.selectedOperators).toEqual([
      { user_id: 'joao', meta: 5 },
      { user_id: 'maria', meta: 10 },
    ]);
  });

  it('converte meta null para 0 (que falha em positive)', () => {
    store.getState().toggleOperator('joao');
    expect(selectFormPayload(store.getState())).toBeNull();
  });

  it('é puro — sem mutação do state', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    const before = store.getState();
    selectFormPayload(before);
    const after = store.getState();
    expect(after).toBe(before);
  });
});

describe('selectDispatchRequest (selector puro)', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  it('retorna null quando o draft é inválido', () => {
    expect(selectDispatchRequest(store.getState())).toBeNull();
  });

  it('retorna DispatchSprintRequest com selected (não selectedOperators)', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    store.getState().toggleOperator('maria');
    store.getState().setMeta('maria', 10);

    const request = selectDispatchRequest(store.getState());
    expect(request).not.toBeNull();
    expect(request?.selected).toEqual([
      { user_id: 'joao', meta: 5 },
      { user_id: 'maria', meta: 10 },
    ]);
    expect(request?.deadline).toBe('18:00');
  });

  it('preserva deadline customizado', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 1);
    store.getState().setDeadline('20:30');
    const request = selectDispatchRequest(store.getState());
    expect(request?.deadline).toBe('20:30');
  });

  it('é puro — sem mutação do state', () => {
    store.getState().toggleOperator('joao');
    store.getState().setMeta('joao', 5);
    const before = store.getState();
    selectDispatchRequest(before);
    const after = store.getState();
    expect(after).toBe(before);
  });
});
