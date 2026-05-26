import { beforeEach, describe, expect, it } from 'vitest';

import { makePayload } from '../__test-fixtures__/sprint';

import { selectHasSprint, useCurrentSprintStore } from './useCurrentSprintStore';

describe('useCurrentSprintStore', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: null });
  });

  it('estado inicial: sprint = null', () => {
    expect(useCurrentSprintStore.getState().sprint).toBeNull();
  });

  it('setCurrent atualiza para a sprint passada', () => {
    const sample = makePayload();
    useCurrentSprintStore.getState().setCurrent(sample);
    expect(useCurrentSprintStore.getState().sprint).toBe(sample);
  });

  it('clearCurrent reseta para null', () => {
    useCurrentSprintStore.getState().setCurrent(makePayload());
    useCurrentSprintStore.getState().clearCurrent();
    expect(useCurrentSprintStore.getState().sprint).toBeNull();
  });

  it('selectHasSprint reflete corretamente', () => {
    expect(selectHasSprint(useCurrentSprintStore.getState())).toBe(false);
    useCurrentSprintStore.getState().setCurrent(makePayload());
    expect(selectHasSprint(useCurrentSprintStore.getState())).toBe(true);
  });
});
