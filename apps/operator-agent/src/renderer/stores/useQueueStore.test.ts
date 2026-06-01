import { beforeEach, describe, expect, it } from 'vitest';

import { selectExtraInQueue, useQueueStore } from './useQueueStore';

describe('useQueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ length: 0 });
  });

  it('estado inicial: length = 0', () => {
    expect(useQueueStore.getState().length).toBe(0);
  });

  it('setLength atualiza', () => {
    useQueueStore.getState().setLength(5);
    expect(useQueueStore.getState().length).toBe(5);
  });

  it('selectExtraInQueue: length 0 → 0 (nenhuma aguardando)', () => {
    expect(selectExtraInQueue(useQueueStore.getState())).toBe(0);
  });

  it('selectExtraInQueue: length 1 → 0 (só a atual)', () => {
    useQueueStore.setState({ length: 1 });
    expect(selectExtraInQueue(useQueueStore.getState())).toBe(0);
  });

  it('selectExtraInQueue: length 3 → 2 (2 aguardando)', () => {
    useQueueStore.setState({ length: 3 });
    expect(selectExtraInQueue(useQueueStore.getState())).toBe(2);
  });

  it('selectExtraInQueue nunca retorna negativo (edge case)', () => {
    useQueueStore.setState({ length: 0 });
    expect(selectExtraInQueue(useQueueStore.getState())).toBe(0);
  });
});
