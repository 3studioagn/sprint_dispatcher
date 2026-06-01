import { useEffect, type ReactNode } from 'react';

import styles from './Overlay.module.css';

export type OverlayVariant = 'default' | 'urgent';

export interface OverlayProps {
  title: string;
  body: ReactNode | string;
  onAcknowledge: () => void;
  /** Label do botão de acknowledge. Default: "Recebido" (matching design). */
  acknowledgeLabel?: string;
  /** Segundos até onAcknowledge automático. `<= 0` desabilita. Default: 5. */
  autoCloseSeconds?: number;
  variant?: OverlayVariant;
}

/**
 * Aviso visual reutilizável usado pelo Operator Agent para comunicar
 * sprints ao operador. Replica o design ARTFLEXÍVEIS conforme imagem
 * 'Hora do Rush!' anexada na sessão de implementação.
 *
 * Comportamento:
 * - Renderiza header (título), body (conteúdo do host) e botão de ack.
 * - Se `autoCloseSeconds > 0`, dispara `onAcknowledge` após o timeout
 *   (com cleanup no unmount).
 * - Click no botão também dispara `onAcknowledge` imediatamente.
 *
 * Acessibilidade:
 * - role='alertdialog' + aria-modal + aria-labelledby para o título.
 *
 * NÃO depende de `window` management (alwaysOnTop, fullscreen,
 * multi-monitor). Window placement fica no Operator Agent (BL-C3-004
 * / BL-C3-015). Componente é 100% testável em jsdom.
 *
 * O `body` é o slot principal — o host (Agent) renderiza o conteúdo
 * estruturado (métrica gigante, deadline, status, etc.) como children.
 */
export function Overlay({
  title,
  body,
  onAcknowledge,
  acknowledgeLabel = 'Recebido',
  autoCloseSeconds = 5,
  variant = 'default',
}: OverlayProps) {
  useEffect(() => {
    if (autoCloseSeconds <= 0) return;
    const id = window.setTimeout(onAcknowledge, autoCloseSeconds * 1000);
    return () => {
      window.clearTimeout(id);
    };
  }, [autoCloseSeconds, onAcknowledge]);

  const containerClass =
    variant === 'urgent' ? `${styles.overlay} ${styles['overlay--urgent']}` : styles.overlay;

  return (
    <div
      className={containerClass}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sprint-overlay-title"
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 id="sprint-overlay-title" className={styles.title}>
            {title}
          </h1>
        </header>
        <div className={styles.body}>{body}</div>
        <button type="button" className={styles.acknowledgeButton} onClick={onAcknowledge}>
          {acknowledgeLabel}
        </button>
      </div>
    </div>
  );
}
