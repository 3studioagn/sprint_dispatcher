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
import { playNotificationSound } from '../sound/notificationSound';
import { useCurrentSprintStore } from '../stores/useCurrentSprintStore';
import { useQueueStore } from '../stores/useQueueStore';

import { useIncomingSprint } from './useIncomingSprint';

// BL-C3-014: mocka o som — verificamos QUANDO ele é chamado, não o áudio em si
// (coberto por notificationSound.test.ts).
vi.mock('../sound/notificationSound', () => ({
  playNotificationSound: vi.fn(),
}));

describe('useIncomingSprint', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: null });
    useQueueStore.setState({ length: 0 });
    vi.mocked(playNotificationSound).mockClear();
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

  describe('som de notificação (BL-C3-014)', () => {
    /** Renderiza o hook e devolve o callback capturado do onIncoming. */
    async function renderAndCaptureIncoming(): Promise<(e: IncomingSprintEvent) => void> {
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
      return captured as (e: IncomingSprintEvent) => void;
    }

    it('toca o som quando o push tem playSound=true', async () => {
      const push = await renderAndCaptureIncoming();
      act(() => {
        push({ sprint: makePayload(), queueLength: 1, playSound: true });
      });
      expect(playNotificationSound).toHaveBeenCalledTimes(1);
    });

    it('NÃO toca quando playSound ausente/false', async () => {
      const push = await renderAndCaptureIncoming();
      act(() => {
        push({ sprint: makePayload(), queueLength: 1 });
      });
      expect(playNotificationSound).not.toHaveBeenCalled();
    });

    it('NÃO toca em reabertura via tray (reopened=true), mesmo com playSound', async () => {
      const push = await renderAndCaptureIncoming();
      act(() => {
        // playSound nunca vem true junto de reopened pelo main, mas o guard
        // do renderer é defesa em profundidade.
        push({ sprint: makePayload(), queueLength: 0, reopened: true, playSound: true });
      });
      expect(playNotificationSound).not.toHaveBeenCalled();
    });

    it('dedup: a MESMA sprint (pull+push) toca o som só uma vez', async () => {
      const sample = makePayload();
      const push = await renderAndCaptureIncoming();
      act(() => {
        push({ sprint: sample, queueLength: 1, playSound: true });
      });
      act(() => {
        push({ sprint: sample, queueLength: 1, playSound: true });
      });
      expect(playNotificationSound).toHaveBeenCalledTimes(1);
    });

    it('toca de novo para uma sprint DIFERENTE', async () => {
      const push = await renderAndCaptureIncoming();
      act(() => {
        push({
          sprint: makePayload({ sprintId: '01HX9K2M4F8N7P2Q5R3S6T7V8W' }),
          queueLength: 1,
          playSound: true,
        });
      });
      act(() => {
        push({
          sprint: makePayload({ sprintId: '01HXAAABBBCCCDDDEEEFFFGGGH' }),
          queueLength: 1,
          playSound: true,
        });
      });
      expect(playNotificationSound).toHaveBeenCalledTimes(2);
    });
  });
});
