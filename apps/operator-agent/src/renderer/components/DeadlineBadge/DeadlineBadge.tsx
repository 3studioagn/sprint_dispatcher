/**
 * DeadlineBadge — exibe deadline como HH:mm estático.
 *
 * **Gate 4 — estático**: apenas formata `deadline_at` ISO via `date-fns`.
 * **BL-C3-012 W2** vai expandir para countdown ao vivo (ex.: "faltam 1h 30min").
 */

import { format } from 'date-fns';

import styles from './DeadlineBadge.module.css';

export interface DeadlineBadgeProps {
  deadlineIso: string;
}

export function DeadlineBadge({ deadlineIso }: DeadlineBadgeProps): JSX.Element {
  const hhmm = format(new Date(deadlineIso), 'HH:mm');
  return (
    <div className={styles.badge} aria-label={`Prazo: ${hhmm}`}>
      <span className={styles.label}>PRAZO</span>
      <span className={styles.time}>{hhmm}</span>
    </div>
  );
}
