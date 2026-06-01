import { beforeEach, describe, expect, it } from 'vitest';

import {
  selectHasCurrentSprint,
  selectIsSprintActive,
  useTrackedSprintStore,
} from './useTrackedSprintStore';

const store = useTrackedSprintStore;

const SAMPLE_SPRINT = {
  sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
  dispatched_at: '2026-05-28T14:00:00.000Z',
  targets: [
    { user_id: 'joao', meta: 5 },
    { user_id: 'mario', meta: 8 },
  ],
  title: 'É hora de correr',
  deadline_hhmm: '18:00',
};

describe('useTrackedSprintStore', () => {
  beforeEach(() => {
    store.getState().clear();
  });

  describe('defaults', () => {
    it('inicia com current = null', () => {
      expect(store.getState().current).toBeNull();
    });
  });

  describe('setCurrent', () => {
    it('grava a sprint como current com cancelled = false', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      expect(store.getState().current).toEqual({ ...SAMPLE_SPRINT, cancelled: false });
    });

    it('sobrescreve sprint anterior ao chamar de novo', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      const novo = { ...SAMPLE_SPRINT, sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7VYZ' };
      store.getState().setCurrent(novo);
      expect(store.getState().current?.sprint_id).toBe('01HX9K2M4F8N7P2Q5R3S6T7VYZ');
      expect(store.getState().current?.cancelled).toBe(false);
    });
  });

  describe('markCancelled (BL-C2-009)', () => {
    it('marca current.cancelled = true', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      store.getState().markCancelled();
      expect(store.getState().current?.cancelled).toBe(true);
    });

    it('no-op quando current é null', () => {
      store.getState().markCancelled();
      expect(store.getState().current).toBeNull();
    });

    it('idempotente — chamar 2× não muda state após primeira', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      store.getState().markCancelled();
      const after1 = store.getState().current;
      store.getState().markCancelled();
      const after2 = store.getState().current;
      expect(after1).toBe(after2);
    });
  });

  describe('clear', () => {
    it('zera current para null', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      store.getState().clear();
      expect(store.getState().current).toBeNull();
    });
  });

  describe('selectors', () => {
    it('selectHasCurrentSprint reflete presença', () => {
      expect(selectHasCurrentSprint(store.getState())).toBe(false);
      store.getState().setCurrent(SAMPLE_SPRINT);
      expect(selectHasCurrentSprint(store.getState())).toBe(true);
    });

    it('selectIsSprintActive falso após cancelamento', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      expect(selectIsSprintActive(store.getState())).toBe(true);
      store.getState().markCancelled();
      expect(selectIsSprintActive(store.getState())).toBe(false);
    });

    it('selectIsSprintActive falso quando current é null', () => {
      expect(selectIsSprintActive(store.getState())).toBe(false);
    });
  });
});
