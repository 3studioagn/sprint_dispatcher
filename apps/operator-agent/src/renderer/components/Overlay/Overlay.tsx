/**
 * Overlay — root visual do renderer, consumindo `@sprint/ui-kit`
 * (BL-C3-015).
 *
 * **Chrome do overlay vem do ui-kit** (`<Overlay>` exporta header com
 * título, body slot, botão de acknowledge). O Agent supre:
 *
 * - Conteúdo estruturado no body slot: `<DeadlineBadge>` +
 *   `<QueueIndicator>` (header secundário) + corpo HTML via
 *   `<TextBlock>` do ui-kit + meta gigante.
 * - Handler `onAcknowledge` que invoca o IPC apropriado:
 *   - Modo normal: `window.api.sprint.acknowledge` → main `handleAck`
 *     (ack final + archive + dequeue + próxima).
 *   - Modo reaberto (BL-C3-009): `window.api.overlay.closeReopened` →
 *     main apenas `hide()` (sem ack adicional).
 * - Label do botão dinâmico: "Confirmando…" (durante invoke), "Fechar"
 *   (reaberto), "Recebi" (normal). "Recebi" no Agent diverge do default
 *   "Recebido" do ui-kit por convenção de UX consolidada no W1.
 * - Surface de erro/warning inline no body slot (preserva UX do W1).
 *
 * **Auto-close:** `autoCloseSeconds={0}` desabilita o timer interno do
 * `<Overlay>` do ui-kit. O ciclo de vida da janela permanece no main
 * (`overlayService.minimizeAfterMs`) — única fonte de verdade evita
 * race entre timer do renderer e timer do main (que mostra balloon e
 * minimiza para tray). Decisão documentada em DECISIONS.md.
 *
 * **Window management permanece no Agent (main):** fullscreen, TOPMOST
 * (`alwaysOnTop: 'screen-saver'`), skipTaskbar, multi-monitor. Ver
 * `overlayService.createWindow`. Este componente renderiza dentro da
 * BrowserWindow já configurada.
 */

import type { SprintPayload } from '@sprint/contracts';
import { Overlay as UIOverlay, TextBlock } from '@sprint/ui-kit';
import { useState } from 'react';

import { useCurrentSprintStore } from '../../stores';
import { DeadlineBadge } from '../DeadlineBadge';
import { QueueIndicator } from '../QueueIndicator';

import styles from './Overlay.module.css';

interface SprintBodyProps {
  sprint: SprintPayload;
  error: string | null;
  warning: string | null;
}

function SprintBody({ sprint, error, warning }: SprintBodyProps): JSX.Element {
  return (
    <div className={styles.sprintBody}>
      <div className={styles.statusRow}>
        <DeadlineBadge deadlineIso={sprint.deadline_at} />
        <QueueIndicator />
      </div>
      <TextBlock bodyHtml={sprint.body_html} className={styles.bodyText ?? ''} />
      <div className={styles.metaWrapper} aria-label={`Meta: ${sprint.meta}`}>
        <span className={styles.metaLabel}>META</span>
        <span className={styles.metaValue}>{sprint.meta}</span>
      </div>
      {error !== null && (
        <p className={styles.error} role="alert">
          Falha ao confirmar — tente de novo. ({error})
        </p>
      )}
      {warning !== null && (
        <p className={styles.warning} role="status">
          {warning}
        </p>
      )}
    </div>
  );
}

export function Overlay(): JSX.Element {
  const sprint = useCurrentSprintStore((s) => s.sprint);
  const isReopened = useCurrentSprintStore((s) => s.isReopened);

  // Estado local do ciclo de ack/close. Reseta automaticamente quando
  // o React remonta este componente via key={sprint?.sprint_id} no
  // componente pai (App.tsx). Mantém o pattern de "remount via nova
  // sprint" estabelecido no W1 (BL-C3-007 / F-024).
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  if (sprint === null) {
    return (
      <div className={styles.empty} role="status" aria-live="polite">
        <p>Aguardando sprint…</p>
      </div>
    );
  }

  async function handleAck(currentSprint: SprintPayload, reopened: boolean): Promise<void> {
    if (loading) return; // guard contra double-click (ui-kit button não tem disabled prop)
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      if (reopened) {
        // BL-C3-009: fecha overlay sem novo ack.
        await window.api.overlay.closeReopened();
        // Main faz hide(); o renderer aguarda próxima sprint:incoming
        // (que via key remonta este componente) — loading permanece
        // até remount/unmount, prevenindo double-click visualmente.
        return;
      }
      // Fluxo normal — BL-C3-007.
      const result = await window.api.sprint.acknowledge({
        sprint_id: currentSprint.sprint_id,
        user_id: currentSprint.user_id,
      });
      if (!result.ok) {
        setError(result.error.message);
        setLoading(false);
        return;
      }
      // F-024: archive falhou silenciosamente — surface antes do remount.
      if (!result.data.moved_to_history) {
        setWarning(
          'Histórico local não foi atualizado. A rodada foi confirmada com sucesso, mas pode não aparecer em "Histórico".',
        );
      }
      // Sucesso — não toca em loading; React remonta via key quando
      // chega próxima sprint:incoming ou overlay:minimize.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  const ackLabel = loading ? 'Confirmando…' : isReopened ? 'Fechar' : 'Recebi';

  return (
    <UIOverlay
      title={sprint.title}
      body={<SprintBody sprint={sprint} error={error} warning={warning} />}
      onAcknowledge={() => {
        void handleAck(sprint, isReopened);
      }}
      acknowledgeLabel={ackLabel}
      autoCloseSeconds={0}
      variant="default"
    />
  );
}
