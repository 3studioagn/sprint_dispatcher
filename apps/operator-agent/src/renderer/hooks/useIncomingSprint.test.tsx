/**
 * Testes do hook useIncomingSprint — pull + push pattern.
 *
 * Cobre:
 * - Pull inicial via requestCurrent atualiza stores quando retorna evento.
 * - Pull inicial com retorno null não muta stores.
 * - Push via onIncoming atualiza stores.
 * - Cleanup chama unsubscribe.
 * - requestCurrent throw é capturado (log warn) sem crash.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IncomingSprintEvent } from '../../shared/ipc-types';
import { makePayload } from '../__test-fixtures__/sprint';
import { useCurrentSprintStore } from '../stores/useCurrentSprintStore';
import { useQueueStore } from '../stores/useQueueStore';

import { useIncomingSprint } from './useIncomingSprint';

describe('useIncomingSprint', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: null });
    useQueueStore.setState({ length: 0 });
  });

  it('pull inicial via requestCurrent atualiza stores quando retorna evento', async () => {
    const sample = makePayload();
    vi.mocked(window.api.sprint.requestCurrent).mockResolvedValueOnce({
      sprint: sample,
      queueLength: 2,
    });

    renderHook(() => {
      useIncomingSprint();
    });

    await waitFor(() => {
      expect(useCurrentSprintStore.getState().sprint).toBe(sample);
      expect(useQueueStore.getState().length).toBe(2);
    });
  });

  it('pull com retorno null não muta stores', async () => {
    vi.mocked(window.api.sprint.requestCurrent).mockResolvedValueOnce(null);

    renderHook(() => {
      useIncomingSprint();
    });

    await waitFor(() => {
      expect(window.api.sprint.requestCurrent).toHaveBeenCalled();
    });
    expect(useCurrentSprintStore.getState().sprint).toBeNull();
    expect(useQueueStore.getState().length).toBe(0);
  });

  it('push via onIncoming atualiza stores', async () => {
    let captured: ((event: IncomingSprintEvent) => void) | undefined;
    vi.mocked(window.api.sprint.onIncoming).mockImplementationOnce((cb) => {
      captured = cb;
      return () => undefined;
    });

    renderHook(() => {
      useIncomingSprint();
    });

    await waitFor(() => {
      expect(captured).toBeDefined();
    });

    const sample = makePayload();
    act(() => {
      captured?.({ sprint: sample, queueLength: 3 });
    });

    expect(useCurrentSprintStore.getState().sprint).toBe(sample);
    expect(useQueueStore.getState().length).toBe(3);
  });

  it('cleanup do useEffect chama unsubscribe', async () => {
    const unsub = vi.fn();
    vi.mocked(window.api.sprint.onIncoming).mockReturnValueOnce(unsub);

    const { unmount } = renderHook(() => {
      useIncomingSprint();
    });

    await waitFor(() => {
      expect(window.api.sprint.onIncoming).toHaveBeenCalled();
    });

    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('requestCurrent throw é capturado sem crash', async () => {
    vi.mocked(window.api.sprint.requestCurrent).mockRejectedValueOnce(new Error('IPC boom'));

    const { result } = renderHook(() => {
      useIncomingSprint();
    });

    await waitFor(() => {
      expect(window.api.sprint.requestCurrent).toHaveBeenCalled();
    });

    // Hook não throws; renderHook ainda exporta um result válido (void).
    expect(result.current).toBeUndefined();
    expect(useCurrentSprintStore.getState().sprint).toBeNull();
  });
});
