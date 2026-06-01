import type { CSSProperties } from 'react';

import styles from './OverlayMinimized.module.css';

export type OverlayMinimizedVariant = 'default' | 'urgent';

/**
 * Posição horizontal da badge dentro da faixa.
 * - Strings nomeadas (`'left'`, `'center'`, `'right'`): atalhos para
 *   0, 50, 100 respectivamente.
 * - Number (0..100): percentual horizontal. Útil para hosts que
 *   implementam drag livre (Agent em BL-C3-017 — captura pointer
 *   events e passa o valor numérico).
 */
export type OverlayMinimizedPosition = 'left' | 'center' | 'right' | number;

export interface OverlayMinimizedProps {
  /** Label muted exibido antes do valor (ex: "Suas metas"). */
  label: string;
  /** Valor destacado (ex: "20" ou "20 artes"). */
  value: string | number;
  /** Handler invocado quando a badge é clicada. Host decide o que fazer
   *  (reabrir <Overlay>, disparar ack, etc.). */
  onClick: () => void;
  /** Posicionamento horizontal da badge. Default: 'center'. Aceita
   *  enum nomeado ou number 0-100 (percent) para drag livre. */
  position?: OverlayMinimizedPosition;
  variant?: OverlayMinimizedVariant;
}

/**
 * Converte position (enum ou number) em percent horizontal 0-100.
 * Clamp aplicado em values fora do range.
 */
function resolvePercent(position: OverlayMinimizedPosition): number {
  if (position === 'left') return 0;
  if (position === 'right') return 100;
  if (position === 'center') return 50;
  if (typeof position === 'number') {
    if (Number.isNaN(position)) return 50;
    return Math.max(0, Math.min(100, position));
  }
  return 50;
}

/**
 * Faixa horizontal dark com badge "pendurada" que substitui o
 * `<Overlay>` fullscreen após minimização. Replica o design entregue
 * por Renan na sessão BL-C9-completo:
 *
 * ```
 * ═══════════════════════════════════════════════ ← bar (full-width, dark)
 *              ╮   ✓  Suas metas  20   ╭            ← curvas CÔNCAVAS via SVG corners
 *              │                       │
 *              ╰───────────────────────╯           ← cantos inferiores arredondados (pill)
 * ```
 *
 * **Curvas côncavas** desenhadas via SVG path arc (vetor preciso,
 * sem artifacts de gradient). Cada lado da badge tem um `<svg>` de
 * 28×32px com path em forma de "L" com curva quarter-elipse no canto
 * interno (lado da badge). SVGs flanqueiam o button via flex row.
 *
 * **Drag livre**: prop `position` aceita number 0-100 (percent
 * horizontal). Host (Agent em BL-C3-017) implementa pointer/mouse
 * events e passa o valor calculado. Componente apenas renderiza
 * na posição informada.
 *
 * **Positioning vertical da bar é responsabilidade do host** — o
 * componente assume container de largura plena (ex: `BrowserWindow`
 * frameless+topmost ancorado em top:0).
 *
 * Ícone NÃO é customizável via prop — SVG check pontilhado fixo é
 * identidade canônica do design ARTFLEXÍVEIS.
 *
 * Uso típico:
 *
 * ```tsx
 * import { OverlayMinimized } from '@sprint/ui-kit';
 *
 * // Posição discreta:
 * <OverlayMinimized label="Suas metas" value={20} position="center" onClick={...} />
 *
 * // Posição contínua (drag controlado pelo host):
 * const [percent, setPercent] = useState(50);
 * <OverlayMinimized label="Suas metas" value={20} position={percent} onClick={...} />
 * ```
 */
export function OverlayMinimized({
  label,
  value,
  onClick,
  position = 'center',
  variant = 'default',
}: OverlayMinimizedProps) {
  const percent = resolvePercent(position);

  const positionerStyle: CSSProperties = {
    left: `${percent}%`,
    transform: `translateX(-${percent}%)`,
  };

  const badgeClass =
    variant === 'urgent' ? `${styles.badge} ${styles['badge--urgent']}` : styles.badge;

  return (
    <div className={styles.bar}>
      <div
        className={styles.badgePositioner}
        data-position={typeof position === 'number' ? 'numeric' : position}
        style={positionerStyle}
      >
        <CornerLeft />
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
        <CornerRight />
      </div>
    </div>
  );
}

/**
 * Corner esquerdo — SVG L-shape com arc quarter-elíptico no canto
 * INFERIOR-DIREITO, criando a curva côncava simples que conecta a
 * faixa preta ao lado esquerdo da badge.
 *
 * viewBox 28×32 = (corner-width × bar-height). Fill via currentColor
 * controlado pelo CSS Module (cor da bar).
 */
function CornerLeft() {
  return (
    <svg
      className={styles.cornerLeft}
      viewBox="0 0 28 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* M 0 0       → top-left
       *  H 28        → top edge (continua bar)
       *  V 32        → right edge desce até a base (encosta no badge)
       *  A 28 32 0 0 1 0 0 → arc de volta a (0, 0), sweep=1 (CW)
       *                      cria curva côncava simples no canto interno
       *  Z           → close */}
      <path d="M 0 0 H 28 V 32 A 28 32 0 0 1 0 0 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Corner direito — espelho horizontal do esquerdo. Mesma curva
 * côncava simples do lado oposto.
 */
function CornerRight() {
  return (
    <svg
      className={styles.cornerRight}
      viewBox="0 0 28 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M 28 0 H 0 V 32 A 28 32 0 0 0 28 0 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Ícone check pontilhado — SVG inline com cor herdada via currentColor
 * (controlada pelo .icon do .module.css → token --sprint-color-primary).
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
