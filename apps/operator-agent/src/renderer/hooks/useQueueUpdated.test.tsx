/**
 * Testes do hook useQueueUpdated — assina queue.onUpdated.
 *
 * Cobre subscribe no mount + push atualiza store + cleanup unsubscribe.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueUpdatedEvent } from '../../shared/ipc-types';
import { useQueueStore } from '../stores/useQueueStore';

import { useQueueUpdated } from './useQueueUpdated';

describe('useQueueUpdated', () => {
  beforeEach(() => {
    useQueueStore.setState({ length: 0 });
  });

  it('assina queue.onUpdated no mount', () => {
    renderHook(() => {
      useQueueUpdated();
    });
    expect(window.api.queue.onUpdated).toHaveBeenCalledTimes(1);
  });

  it('push de queue:updated atualiza store', async () => {
    let captured: ((event: QueueUpdatedEvent) => void) | undefined;
    vi.mocked(window.api.queue.onUpdated).mockImplementationOnce((cb) => {
      captured = cb;
      return () => undefined;
    });

    renderHook(() => {
      useQueueUpdated();
    });

    await waitFor(() => {
      expect(captured).toBeDefined();
    });

    act(() => {
      captured?.({ queueLength: 5 });
    });

    expect(useQueueStore.getState().length).toBe(5);
  });

  it('cleanup chama unsubscribe', () => {
    const unsub = vi.fn();
    vi.mocked(window.api.queue.onUpdated).mockReturnValueOnce(unsub);

    const { unmount } = renderHook(() => {
      useQueueUpdated();
    });

    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
