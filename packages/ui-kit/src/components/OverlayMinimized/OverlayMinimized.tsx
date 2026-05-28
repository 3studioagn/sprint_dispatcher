import styles from './OverlayMinimized.module.css';

export type OverlayMinimizedVariant = 'default' | 'urgent';
export type OverlayMinimizedPosition = 'left' | 'center' | 'right';

export interface OverlayMinimizedProps {
  /** Label muted exibido antes do valor (ex: "Suas metas"). */
  label: string;
  /** Valor destacado (ex: "20" ou "20 artes"). */
  value: string | number;
  /** Handler invocado quando a badge é clicada. Host decide o que fazer
   *  (reabrir <Overlay>, disparar ack, etc.). */
  onClick: () => void;
  /** Posicionamento horizontal da badge dentro da faixa.
   *  Default: 'center'. */
  position?: OverlayMinimizedPosition;
  variant?: OverlayMinimizedVariant;
}

/**
 * Faixa horizontal dark com badge "pendurada" que substitui o
 * `<Overlay>` fullscreen após minimização. Replica o design entregue
 * por Renan na sessão BL-C9-completo (refinamento pós-screenshot):
 *
 * ```
 * ┌─────────────────────────────────────────────┐
 * │  bar (full-width, dark, fina)               │
 * └────────────┐  ┌───────────┐  ┌──────────────┘
 *              │  │  ✓  Suas  │  │
 *              │  │  metas 20 │  │  ← badge "pendurada"
 *              └──┴───────────┴──┘
 * ```
 *
 * A bar e a badge compartilham a mesma cor de background — visualmente,
 * a badge parece uma aba/saliência pendurada da faixa.
 *
 * Prop `position` permite mover a badge dentro da bar:
 * - `'center'` (default) — badge centralizada
 * - `'left'` — alinhada à esquerda com gutter mínimo
 * - `'right'` — alinhada à direita com gutter mínimo
 *
 * **Positioning da bar é responsabilidade do host** (Agent em
 * BL-C3-017) — componente assume container de largura plena (ex:
 * BrowserWindow frameless+topmost ancorado no topo, portal fixed).
 *
 * **Ícone NÃO é customizável via prop** — SVG check pontilhado fixo
 * faz parte da identidade canônica do design ARTFLEXÍVEIS.
 *
 * Uso típico (no Agent — sessão futura BL-C3-015/017):
 *
 * ```tsx
 * import { OverlayMinimized } from '@sprint/ui-kit';
 *
 * <OverlayMinimized
 *   label="Suas metas"
 *   value={20}
 *   position="center"
 *   onClick={() => reopenOverlay()}
 * />
 * ```
 */
export function OverlayMinimized({
  label,
  value,
  onClick,
  position = 'center',
  variant = 'default',
}: OverlayMinimizedProps) {
  const positionerClass = `${styles.badgePositioner} ${styles[`badgePositioner--${position}`]}`;

  const badgeClass =
    variant === 'urgent' ? `${styles.badge} ${styles['badge--urgent']}` : styles.badge;

  return (
    <div className={styles.bar}>
      <div className={positionerClass} data-position={position}>
        <button
          type="button"
          className={badgeClass}
          onClick={onClick}
          aria-label={`${label}: ${String(value)}`}
        >
          <DottedCheckIcon />
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{value}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Ícone check pontilhado — SVG inline com cor herdada via currentColor
 * (controlada pelo .icon do .module.css → token --sprint-color-primary).
 *
 * Design: círculo com borda dashed/dotted + check sólido no centro.
 * Replica a composição visual da imagem anexada à sessão.
 */
function DottedCheckIcon() {
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
