import { useOperatorsStore } from '../../stores/useOperatorsStore';

import styles from './OperatorList.module.css';
import { OperatorRow } from './OperatorRow';

export function OperatorList() {
  const operators = useOperatorsStore((s) => s.operators);

  if (operators.length === 0) {
    return <p className={styles.empty}>Nenhum usuário ativo cadastrado.</p>;
  }

  return (
    <ul className={styles.list} aria-label="Lista de usuários">
      {operators.map((op) => (
        <li key={op.user_id} className={styles.item}>
          <OperatorRow operator={op} />
        </li>
      ))}
    </ul>
  );
}
