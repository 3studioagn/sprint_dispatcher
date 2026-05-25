import type { ChangeEvent } from 'react';

import { useSprintComposerStore } from '../../stores/useSprintComposerStore';
import type { Operator } from '../../types/operator';

import styles from './OperatorRow.module.css';

interface OperatorRowProps {
  readonly operator: Operator;
}

export function OperatorRow({ operator }: OperatorRowProps) {
  const isSelected = useSprintComposerStore((s) => s.selectedOperators.has(operator.user_id));
  const meta = useSprintComposerStore((s) => s.selectedOperators.get(operator.user_id) ?? null);
  const toggleOperator = useSprintComposerStore((s) => s.toggleOperator);
  const setMeta = useSprintComposerStore((s) => s.setMeta);

  const checkboxId = `operator-checkbox-${operator.user_id}`;
  const metaId = `operator-meta-${operator.user_id}`;
  const metaErrorId = `${metaId}-error`;

  const handleMetaChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value;
    if (raw === '') {
      setMeta(operator.user_id, null);
      return;
    }
    const parsed = Number.parseFloat(raw);
    setMeta(operator.user_id, Number.isNaN(parsed) ? null : parsed);
  };

  const metaInvalid = isSelected && (meta === null || !Number.isInteger(meta) || meta < 1);
  const displayValue = meta === null ? '' : String(meta);

  return (
    <div className={styles.row}>
      <label htmlFor={checkboxId} className={styles.label}>
        <input
          id={checkboxId}
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => {
            toggleOperator(operator.user_id);
          }}
        />
        <span className={styles.info}>
          <span className={styles.name}>{operator.user_nome_exibicao}</span>
          <span className={styles.hostname}>{operator.hostname}</span>
        </span>
      </label>
      {isSelected ? (
        <div className={styles.metaField}>
          <label htmlFor={metaId} className={styles.metaLabel}>
            Meta
          </label>
          <input
            id={metaId}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className={styles.metaInput}
            value={displayValue}
            onChange={handleMetaChange}
            aria-invalid={metaInvalid ? 'true' : undefined}
            aria-describedby={metaInvalid ? metaErrorId : undefined}
            placeholder="—"
          />
          {metaInvalid ? (
            <span id={metaErrorId} className={styles.metaError}>
              Meta ≥ 1
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
