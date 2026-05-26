/**
 * QueueIndicator — badge "+N aguardando" quando há mais de uma sprint na fila.
 *
 * - `queueLength <= 1` → não renderiza nada (atual está sendo exibida; nada esperando).
 * - `queueLength = 2` → "+ 1 sprint aguardando" (singular).
 * - `queueLength >= 3` → "+ N sprints aguardando" (plural).
 *
 * Consume `useQueueStore` que é atualizado via `useIncomingSprint` (no mount
 * + cada nova sprint) e `useQueueUpdated` (mudanças de length sem nova sprint).
 */

import { selectExtraInQueue, useQueueStore } from '../../stores';

import styles from './QueueIndicator.module.css';

export function QueueIndicator(): JSX.Element | null {
  const extra = useQueueStore(selectExtraInQueue);

  if (extra === 0) return null;

  return (
    <div className={styles.indicator} aria-live="polite">
      + {extra} {extra === 1 ? 'sprint aguardando' : 'sprints aguardando'}
    </div>
  );
}
