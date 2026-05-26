/**
 * Overlay — container fullscreen TOPMOST do agent.
 *
 * Layout grid 3-rows: header (deadline + queue), main (sprintcard), footer (ack).
 * `role="alertdialog"` + `aria-live="assertive"` para leitores de tela.
 * Quando não há sprint atual (mount inicial antes do pull responder),
 * mostra placeholder discreto.
 *
 * Gate 5 vai adicionar comportamento de minimização visual; Gate 6 ack
 * functional.
 */

import { useCurrentSprintStore } from '../../stores';
import { AckButton } from '../AckButton';
import { DeadlineBadge } from '../DeadlineBadge';
import { QueueIndicator } from '../QueueIndicator';
import { SprintCard } from '../SprintCard';

import styles from './Overlay.module.css';

export function Overlay(): JSX.Element {
  const sprint = useCurrentSprintStore((s) => s.sprint);

  if (sprint === null) {
    return (
      <div className={styles.empty} role="status" aria-live="polite">
        <p>Aguardando sprint…</p>
      </div>
    );
  }

  return (
    <main
      className={styles.overlay}
      role="alertdialog"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby="sprint-title"
    >
      <header className={styles.header}>
        <DeadlineBadge deadlineIso={sprint.deadline_at} />
        <QueueIndicator />
      </header>
      <SprintCard sprint={sprint} />
      <footer className={styles.footer}>
        {/* key force remount em troca de sprint — reseta loading/error
            local do AckButton sem useEffect/cleanup manual. */}
        <AckButton key={sprint.sprint_id} sprintId={sprint.sprint_id} userId={sprint.user_id} />
      </footer>
    </main>
  );
}
