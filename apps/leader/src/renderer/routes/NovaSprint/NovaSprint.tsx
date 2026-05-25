import { useEffect } from 'react';

import { BulkSelectButtons } from '../../components/BulkSelectButtons';
import { DeadlineInput } from '../../components/DeadlineInput';
import { OperatorList } from '../../components/OperatorList';
import { useOperatorsStore } from '../../stores/useOperatorsStore';
import {
  selectIsValid,
  selectSelectedCount,
  useSprintComposerStore,
} from '../../stores/useSprintComposerStore';

import styles from './NovaSprint.module.css';

/**
 * Stub flag — controla o botão "Enviar". Falso até BL-C2-007 (parte 2 da
 * W1.C2) integrar o dispatch real via `@sprint/fs-adapter`. **Remover esta
 * constante quando o dispatch real estiver disponível.**
 */
const DISPATCH_ENABLED = false;

export function NovaSprint() {
  const isLoaded = useOperatorsStore((s) => s.isLoaded);
  const loadOperators = useOperatorsStore((s) => s.loadOperators);
  const selectedCount = useSprintComposerStore(selectSelectedCount);
  const isFormValid = useSprintComposerStore(selectIsValid);

  useEffect(() => {
    if (!isLoaded) {
      loadOperators();
    }
  }, [isLoaded, loadOperators]);

  const buttonTitle = !DISPATCH_ENABLED
    ? 'Aguardando integração com filesystem adapter (BL-C2-007, parte 2)'
    : isFormValid
      ? 'Disparar sprint'
      : 'Preencha todos os campos obrigatórios';

  const handleDispatchClick = (): void => {
    // Stub: BL-C2-007 (parte 2 da W1.C2) substitui pelo dispatch real via fs-adapter.
    console.warn('[stub] Dispatch ainda não implementado — aguardando C4');
  };

  const countLabel =
    selectedCount === 0
      ? 'Nenhum operador selecionado'
      : selectedCount === 1
        ? '1 operador selecionado'
        : `${String(selectedCount)} operadores selecionados`;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nova Sprint</h1>
        <p className={styles.pageSubtitle}>Selecione operadores, defina metas e horário limite.</p>
      </header>
      <section className={styles.composer} aria-label="Composer de sprint">
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Operadores</h2>
            <BulkSelectButtons />
          </div>
          <OperatorList />
        </div>
        <div className={styles.section}>
          <DeadlineInput />
        </div>
      </section>
      <footer className={styles.footer}>
        <div className={styles.status}>
          <span className={styles.statusCount}>{countLabel}</span>
          <span className={isFormValid ? styles.statusReady : styles.statusPending}>
            {isFormValid ? 'Pronto para enviar' : 'Preencha todos os campos para enviar'}
          </span>
        </div>
        <button
          type="button"
          className={styles.dispatchButton}
          disabled={!DISPATCH_ENABLED || !isFormValid}
          title={buttonTitle}
          onClick={handleDispatchClick}
        >
          Enviar
        </button>
      </footer>
    </div>
  );
}
