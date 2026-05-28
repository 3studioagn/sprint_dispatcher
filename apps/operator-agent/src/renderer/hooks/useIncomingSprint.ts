/**
 * Hook que pulla a sprint atual no mount + assina pushes futuros.
 *
 * **Por que pull + push:** `window.webContents.send` do main pode disparar
 * ANTES de o renderer ter registrado o listener (race entre window load e
 * useEffect do React, que roda após primeira pintura). O pull via
 * `requestCurrent` no mount garante que se o main já tem state, o renderer
 * o vê. O push via `onIncoming` cobre as próximas sprints (ack → próxima
 * da fila, Gate 6).
 *
 * Atualiza:
 * - `useCurrentSprintStore.setCurrent` (sprint payload).
 * - `useQueueStore.setLength` (total na fila, inclui a atual).
 *
 * Cleanup: cancela pull em vôo (via flag `cancelled`) + unsubscribe do push.
 */

import { useEffect } from 'react';

import { useCurrentSprintStore } from '../stores/useCurrentSprintStore';
import { useQueueStore } from '../stores/useQueueStore';

export function useIncomingSprint(): void {
  const setCurrent = useCurrentSprintStore((s) => s.setCurrent);
  const setLength = useQueueStore((s) => s.setLength);

  useEffect(() => {
    let cancelled = false;

    async function pullInitial(): Promise<void> {
      try {
        const current = await window.api.sprint.requestCurrent();
        if (cancelled || current === null) return;
        // Pull sempre vem do `currentItem` do main — fluxo normal de
        // fila, nunca reopen (reopen não toca em currentItem).
        setCurrent(current.sprint, current.reopened ?? false);
        setLength(current.queueLength);
      } catch (err) {
        // Falha no pull não bloqueia o renderer — o push via onIncoming
        // ainda pode disparar. Logamos para diagnose.
        console.warn('[useIncomingSprint] requestCurrent falhou', err);
      }
    }
    void pullInitial();

    const unsub = window.api.sprint.onIncoming((event) => {
      // event.reopened === true → overlay em modo reabertura
      // (BL-C3-009 — botão "Fechar" em vez de "Recebi").
      setCurrent(event.sprint, event.reopened ?? false);
      setLength(event.queueLength);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [setCurrent, setLength]);
}
