/**
 * SprintCard — bloco principal do overlay: title + body_html (sanitizado)
 * + meta GIGANTE (operador "vê de longe").
 *
 * **Re-sanitização defensiva (defesa em profundidade — ADR-014 + §7.9):**
 * o `body_html` já foi sanitizado pelo Leader em
 * `PendingStore.writePendingSprint`, MAS o agent não confia: chama
 * `sanitizeBodyHtml` de novo aqui antes de injetar via
 * `dangerouslySetInnerHTML`. Cobre adulteração do JSON em trânsito
 * (alguém editando manualmente o `pending/` via notepad). Como o
 * sanitizer é idempotente (ADR-014), o segundo passe não muta o output
 * do primeiro.
 */

import { sanitizeBodyHtml, type SprintPayload } from '@sprint/contracts';

import styles from './SprintCard.module.css';

export interface SprintCardProps {
  sprint: SprintPayload;
}

export function SprintCard({ sprint }: SprintCardProps): JSX.Element {
  const safeHtml = sanitizeBodyHtml(sprint.body_html);

  return (
    <section className={styles.card}>
      <h1 id="sprint-title" className={styles.title}>
        {sprint.title}
      </h1>
      <div className={styles.body} dangerouslySetInnerHTML={{ __html: safeHtml }} />
      <div className={styles.metaWrapper} aria-label={`Meta: ${sprint.meta}`}>
        <span className={styles.metaLabel}>META</span>
        <span className={styles.metaValue}>{sprint.meta}</span>
      </div>
    </section>
  );
}
