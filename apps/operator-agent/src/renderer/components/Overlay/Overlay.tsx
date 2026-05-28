/**
 * Overlay — root visual do renderer, consumindo `<Overlay>` do
 * `@sprint/ui-kit` (BL-C3-015, redesenhado na Sessão 31).
 *
 * **Chrome do overlay vem do ui-kit** (`<Overlay>` exporta card preto
 * com header bar surface-elevated, body slot e botão "Recebido" laranja
 * com glow). O Agent supre no body slot:
 *
 * - Conteúdo estruturado matching design 'Hora do Rush!': metricRow
 *   ("20 Artes" baseline + "Até 18:00h" coluna) + footerRow
 *   (✓ "Suas metas" + badge "27/05").
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
 *
 * **Sessão 31:** redesign do body matching imagem-alvo enviada pelo
 * Renan. Mudanças vs estado anterior:
 *
 * - Layout: metricRow (value+unit baseline + deadline coluna) +
 *   footerRow (✓ + label + data badge). Mesmo padrão da `<Pill>`
 *   expanded (consistência cross-component).
 * - Remove: `<DeadlineBadge>`, `<QueueIndicator>`, `<TextBlock>` com
 *   `body_html`, bloco "META" gigante laranja. Esses componentes
 *   continuam exportados; podem ser reusados em telas futuras
 *   (histórico, queue overlay) sem precisar reescrever.
 * - Hardcoded: label "Suas metas" + unit "Artes" (não existem no
 *   `SprintPayload` schema — débito a resolver em W3+ com bump de
 *   `schema_version`).
 */

import type { SprintPayload } from '@sprint/contracts';
import { Overlay as UIOverlay } from '@sprint/ui-kit';
import { useState } from 'react';

import { useCurrentSprintStore } from '../../stores';

import styles from './Overlay.module.css';

/** Label hardcoded — não existe no SprintPayload (W3+ adiciona `kind`). */
const SPRINT_LABEL = 'Suas metas';
/** Unit hardcoded — não existe no SprintPayload (W3+ adiciona `unit`). */
const SPRINT_UNIT = 'Artes';

/**
 * Formata deadline ISO em "HH:MMh" no horário local do operador.
 * Mesmo helper do PillApp — duplicado intencionalmente para evitar
 * acoplamento prematuro entre módulos; promover para `utils/` quando
 * 3º consumer aparecer.
 */
function formatDeadline(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--:--h';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}h`;
  } catch {
    return '--:--h';
  }
}

/**
 * Formata deadline ISO em "DD/MM" (sem ano — informação supérflua
 * para meta do dia). Mesmo helper do PillApp.
 */
function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--/--';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  } catch {
    return '--/--';
  }
}

/**
 * Ícone check pontilhado — SVG inline. Mesmo design do `<Pill>` no
 * ui-kit (canônico ARTFLEXÍVEIS). Duplicado intencionalmente para
 * manter o Agent self-contained; promover para `@sprint/ui-kit`
 * quando houver 3º consumer.
 */
function DottedCheckIcon(): JSX.Element {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="3 3" />
      <path
        d="M8 12.5 L11 15.5 L16.5 9.5"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface SprintBodyProps {
  sprint: SprintPayload;
  error: string | null;
  warning: string | null;
}

function SprintBody({ sprint, error, warning }: SprintBodyProps): JSX.Element {
  return (
    <div className={styles.sprintBody}>
      <div className={styles.metricRow}>
        <div className={styles.metricGroup} aria-label={`Meta: ${sprint.meta} ${SPRINT_UNIT}`}>
          <span className={styles.valueBig}>{sprint.meta}</span>
          <span className={styles.unit}>{SPRINT_UNIT}</span>
        </div>
        <div className={styles.deadlineGroup}>
          <span className={styles.deadlineLabel}>Até</span>
          <span className={styles.deadlineValue}>{formatDeadline(sprint.deadline_at)}</span>
        </div>
      </div>
      <div className={styles.footerRow}>
        <div className={styles.labelGroup}>
          <DottedCheckIcon />
          <span className={styles.label}>{SPRINT_LABEL}</span>
        </div>
        <span className={styles.dateBadge}>{formatDate(sprint.deadline_at)}</span>
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
        try {
          await window.api.overlay.closeReopened();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          // CRÍTICO (Sessão 23 fix): main hide() apenas oculta a janela
          // — o renderer continua mounted e preserva state. Sem reset
          // explícito de loading, button fica preso em "Confirmando…" +
          // disabled, e quando operador clica no pill de novo (re-show
          // do MESMO renderer), button continua bloqueado e overlay
          // não fecha "novamente". Reset garante UX recuperável.
          setLoading(false);
        }
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
