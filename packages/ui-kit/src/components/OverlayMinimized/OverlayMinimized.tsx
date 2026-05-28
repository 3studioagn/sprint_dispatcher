import styles from './OverlayMinimized.module.css';

export type OverlayMinimizedVariant = 'default' | 'urgent';

export interface OverlayMinimizedProps {
  /** Label muted exibido antes do valor (ex: "Suas metas"). */
  label: string;
  /** Valor destacado (ex: "20" ou "20 artes"). */
  value: string | number;
  /** Handler invocado quando o pill é clicado. Host decide o que fazer
   *  (reabrir <Overlay>, disparar ack, etc.). */
  onClick: () => void;
  variant?: OverlayMinimizedVariant;
}

/**
 * Pill compacto que substitui o <Overlay> fullscreen após minimização.
 * Replica o design da imagem "minimizada" anexada à sessão (BL-C9-006,
 * novo item aprovado pelo Renan via SCOPE_QUESTION.md).
 *
 * Composição visual: ícone check pontilhado laranja (SVG inline, fixo)
 * + label muted + valor branco bold em pill dark com sombra.
 *
 * **Positioning é responsabilidade do host** (Agent em BL-C3-017) —
 * componente renderiza só o pill sem CSS de `position`. O host pode
 * envolver em BrowserWindow frameless+topmost, portal fixed, ou
 * qualquer outro mecanismo de placement em tela.
 *
 * **Ícone NÃO é customizável via prop** — SVG check pontilhado faz
 * parte da identidade canônica do design ARTFLEXÍVEIS. Adicionar
 * prop icon futuramente seria backwards-compatible se necessário.
 *
 * Uso típico (no Agent — sessão futura BL-C3-015/017):
 *
 * ```tsx
 * import { OverlayMinimized } from '@sprint/ui-kit';
 *
 * <OverlayMinimized
 *   label="Suas metas"
 *   value={20}
 *   onClick={() => reopenOverlay()}
 * />
 * ```
 */
export function OverlayMinimized({
  label,
  value,
  onClick,
  variant = 'default',
}: OverlayMinimizedProps) {
  const className = variant === 'urgent' ? `${styles.pill} ${styles['pill--urgent']}` : styles.pill;

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={`${label}: ${String(value)}`}
    >
      <DottedCheckIcon />
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </button>
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
