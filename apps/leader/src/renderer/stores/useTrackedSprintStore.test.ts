import { beforeEach, describe, expect, it } from 'vitest';

import { selectHasCurrentSprint, useTrackedSprintStore } from './useTrackedSprintStore';

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
    it('grava a sprint como current', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      expect(store.getState().current).toEqual(SAMPLE_SPRINT);
    });

    it('sobrescreve sprint anterior ao chamar de novo', () => {
      store.getState().setCurrent(SAMPLE_SPRINT);
      const novo = { ...SAMPLE_SPRINT, sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7VYZ' };
      store.getState().setCurrent(novo);
      expect(store.getState().current?.sprint_id).toBe('01HX9K2M4F8N7P2Q5R3S6T7VYZ');
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
  });
});
