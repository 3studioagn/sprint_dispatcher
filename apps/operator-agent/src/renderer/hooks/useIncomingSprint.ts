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
 * **BL-C3-014 — som de notificação:** ao receber um evento com
 * `playSound === true` (exibição inicial; nunca reabertura), toca o som curto
 * via {@link playNotificationSound} (fail-safe). Deduplica por `sprint_id`
 * (ref local) para não tocar duas vezes a mesma sprint quando pull e push
 * coincidem.
 *
 * Cleanup: cancela pull em vôo (via flag `cancelled`) + unsubscribe do push.
 */

import { useEffect, useRef } from 'react';

import type { IncomingSprintEvent } from '../../shared/ipc-types';
import { playNotificationSound } from '../sound/notificationSound';
import { useCurrentSprintStore } from '../stores/useCurrentSprintStore';
import { useQueueStore } from '../stores/useQueueStore';

export function useIncomingSprint(): void {
  const setCurrent = useCurrentSprintStore((s) => s.setCurrent);
  const setLength = useQueueStore((s) => s.setLength);
  // Último sprint_id que disparou som — evita tocar de novo quando pull e
  // push trazem a MESMA sprint (cenário comum no mount inicial da janela).
  const lastPlayedSprintId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function maybePlaySound(event: IncomingSprintEvent): void {
      // Só na exibição inicial (playSound) e nunca em reabertura via tray.
      if (event.playSound !== true || event.reopened === true) return;
      if (lastPlayedSprintId.current === event.sprint.sprint_id) return;
      lastPlayedSprintId.current = event.sprint.sprint_id;
      playNotificationSound();
    }

    async function pullInitial(): Promise<void> {
      try {
        const current = await window.api.sprint.requestCurrent();
        if (cancelled || current === null) return;
        // Pull sempre vem do `currentItem` do main — fluxo normal de
        // fila, nunca reopen (reopen não toca em currentItem).
        setCurrent(current.sprint, current.reopened ?? false);
        setLength(current.queueLength);
        maybePlaySound(current);
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
      maybePlaySound(event);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [setCurrent, setLength]);
}
