import type { ChangeEvent } from 'react';

import type { Operator } from '../../../shared/types/operator';
import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import styles from './OperatorRow.module.css';

interface OperatorRowProps {
  readonly operator: Operator;
}

/** Inicial para o avatar — primeira letra do nome em uppercase. */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase() || '?';
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
    <div className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}>
      {/*
        Dupla `<label htmlFor={checkboxId}>` aponta para o mesmo input — uma
        cobre avatar + nome (clicar no nome marca o operador, preservando o
        teste "clicar no label clica no checkbox"), outra cobre o quadrado
        visual à direita. O input em si fica visualmente escondido dentro do
        2º label (opacity:0 sobre o quadrado).
      */}
      <label htmlFor={checkboxId} className={styles.namePart}>
        <span className={styles.avatar} aria-hidden="true">
          {getInitial(operator.user_nome_exibicao)}
        </span>
        <span className={styles.name} title={operator.hostname}>
          {operator.user_nome_exibicao}
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
            aria-errormessage={metaInvalid ? metaErrorId : undefined}
            placeholder="0"
          />
          {/*
            Mensagem de erro sr-only — visual fica só com borda vermelha
            (aria-invalid="true" via .metaInput[aria-invalid='true']).
            Mantida no DOM para acessibilidade: aria-errormessage aponta
            para ela quando inválida.
          */}
          <span id={metaErrorId} className={styles.metaErrorSrOnly}>
            {metaInvalid ? 'Meta deve ser maior ou igual a 1' : ''}
          </span>
        </div>
      ) : (
        <span className={styles.metaPlaceholder} aria-hidden="true">
          0
        </span>
      )}

      <label htmlFor={checkboxId} className={styles.checkboxLabel}>
        <input
          id={checkboxId}
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => {
            toggleOperator(operator.user_id);
          }}
          aria-label={operator.user_nome_exibicao}
        />
        <span className={styles.checkboxBox} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.checkboxIcon}>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 12l5 5 9-11"
            />
          </svg>
        </span>
      </label>
    </div>
  );
}
