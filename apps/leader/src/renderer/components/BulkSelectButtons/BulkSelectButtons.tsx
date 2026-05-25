import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import styles from './BulkSelectButtons.module.css';

export function BulkSelectButtons() {
  const operators = useOperatorsStore((s) => s.operators);
  const selectAll = useSprintComposerStore((s) => s.selectAll);
  const deselectAll = useSprintComposerStore((s) => s.deselectAll);

  const handleSelectAll = () => {
    selectAll(operators.map((op) => op.user_id));
  };

  const disabled = operators.length === 0;

  return (
    <div className={styles.bulk} role="group" aria-label="Seleção em massa">
      <button type="button" className={styles.button} onClick={handleSelectAll} disabled={disabled}>
        Marcar todos
      </button>
      <button type="button" className={styles.button} onClick={deselectAll} disabled={disabled}>
        Desmarcar todos
      </button>
    </div>
  );
}
