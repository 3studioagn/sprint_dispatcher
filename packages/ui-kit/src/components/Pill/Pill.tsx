import styles from './Pill.module.css';

export type PillVariant = 'default' | 'urgent';

export interface PillProps {
  /**
   * Label muted apresentado junto ao check (ex.: "Suas metas"). Conteúdo
   * compartilhado entre modos compact e expanded.
   */
  label: string;
  /**
   * Valor primário destacado (ex.: `20`). Exibido grande no canto superior
   * esquerdo em expanded e em linha em compact.
   */
  value: string | number;
  /**
   * Unidade da meta (ex.: "Artes"). Exibida sob o `value` apenas em modo
   * expanded — em compact a unidade é omitida para preservar densidade.
   */
  unit?: string;
  /**
   * Deadline formatado para humanos (ex.: "18:00h"). Exibido com o prefixo
   * "Até:" no quadrante superior direito do expanded. Omitido em compact.
   */
  deadline?: string;
  /**
   * Data abreviada (ex.: "27/05"). Exibida como badge muted no rodapé do
   * expanded. Omitido em compact.
   */
  date?: string;
  /**
   * Indica modo expanded — host (Operator Agent em BL-C3-017+) controla
   * via state local + auto-collapse. Default `false` (compact).
   */
  expanded?: boolean;
  /**
   * Click handler — invocado quando o operador clica em qualquer área do
   * pill. Host alterna `expanded` (ou ignora se desejar UX read-only).
   */
  onClick?: () => void;
  /**
   * Reservado — variant `urgent` será estilizado em wave futura (W4).
   * Hoje renderiza igual ao default.
   */
  variant?: PillVariant;
}

/**
 * Badge informativa standalone que ancora no topo da tela do operador
 * (Operator Agent · BL-C3-017+). Pendura do borda superior; cantos
 * inferiores arredondados; topo reto (continuidade visual com o limite
 * do monitor). Sem bar full-width — apenas a própria pill.
 *
 * **Modos:**
 *
 * - **Compact:** linha única com check pontilhado + label muted + valor
 *   destacado. Densidade alta — não consome área vertical significativa
 *   no monitor do operador.
 * - **Expanded:** quadrante 2×2 — métrica + unidade no canto sup-esq,
 *   "Até: HH:MMh" no canto sup-dir, "✓ label" no canto inf-esq, data
 *   badge no canto inf-dir. Mesmo design da imagem entregue por Renan
 *   na sessão 23.
 *
 * **Transição compact ↔ expanded** é puramente CSS (padding/font-size
 * transitions) — host alterna `expanded` via state local; este
 * componente é stateless. Auto-collapse após N segundos fica no host
 * (Agent PillApp implementa `setTimeout`).
 *
 * **Acessibilidade:** botão com `aria-label` legível por leitor de
 * tela (ex.: "Suas metas: 20 Artes") e `aria-expanded` reflete o modo.
 *
 * Diferente do `<OverlayMinimized>` (que tem bar full-width + corner
 * SVGs), este componente é completamente standalone — host posiciona
 * a janela onde quiser.
 *
 * @see DECISIONS.md — nota técnica Pill (Sessão 24)
 * @see BL-C3-017 — orquestração no Agent
 */
export function Pill({
  label,
  value,
  unit,
  deadline,
  date,
  expanded = false,
  onClick,
  variant = 'default',
}: PillProps) {
  const containerClass =
    variant === 'urgent' ? `${styles.pill} ${styles['pill--urgent']}` : styles.pill;
  const stateClass = expanded ? styles['pill--expanded'] : styles['pill--compact'];
  const ariaLabel = unit ? `${label}: ${String(value)} ${unit}` : `${label}: ${String(value)}`;

  return (
    <button
      type="button"
      className={`${containerClass} ${stateClass}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      data-mode={expanded ? 'expanded' : 'compact'}
    >
      {expanded ? (
        <ExpandedContent
          label={label}
          value={value}
          {...(unit !== undefined ? { unit } : {})}
          {...(deadline !== undefined ? { deadline } : {})}
          {...(date !== undefined ? { date } : {})}
        />
      ) : (
        <CompactContent label={label} value={value} />
      )}
    </button>
  );
}

interface CompactProps {
  label: string;
  value: string | number;
}

function CompactContent({ label, value }: CompactProps) {
  return (
    <div className={styles.compactLayout}>
      <DottedCheckIcon />
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

interface ExpandedProps extends CompactProps {
  unit?: string;
  deadline?: string;
  date?: string;
}

function ExpandedContent({ label, value, unit, deadline, date }: ExpandedProps) {
  return (
    <div className={styles.expandedLayout}>
      <div className={styles.metricRow}>
        <div className={styles.metricGroup}>
          <span className={styles.valueBig}>{value}</span>
          {unit !== undefined && <span className={styles.unit}>{unit}</span>}
        </div>
        {deadline !== undefined && (
          <div className={styles.deadlineGroup}>
            <span className={styles.deadlineLabel}>Até:</span>
            <span className={styles.deadlineValue}>{deadline}</span>
          </div>
        )}
      </div>
      <div className={styles.footerRow}>
        <div className={styles.labelGroup}>
          <DottedCheckIcon />
          <span className={styles.label}>{label}</span>
        </div>
        {date !== undefined && <span className={styles.dateBadge}>{date}</span>}
      </div>
    </div>
  );
}

/**
 * Ícone check pontilhado — SVG inline. Mesmo design do `<OverlayMinimized>`
 * (canônico ARTFLEXÍVEIS). Duplicado intencionalmente para manter este
 * componente self-contained sem export interno de Icon.
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
