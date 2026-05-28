import { useCallback, useEffect, useState } from 'react';

import { BulkSelectButtons } from '../../components/BulkSelectButtons';
import { DeadlineInput } from '../../components/DeadlineInput';
import { DispatchModal } from '../../components/DispatchModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MessageCustomizer } from '../../components/MessageCustomizer';
import { OperatorList } from '../../components/OperatorList';
import { api } from '../../services/api';
import { selectIsDispatching, useDispatchStore } from '../../stores/useDispatchStore';
import { useOperatorsStore } from '../../stores/useOperatorsStore';
import {
  selectDispatchRequest,
  selectIsValid,
  selectSelectedCount,
  useSprintComposerStore,
} from '../../stores/useSprintComposerStore';
import { useTrackedSprintStore } from '../../stores/useTrackedSprintStore';

import styles from './NovaSprint.module.css';

type ToastKind = 'success' | 'warning';
interface ToastState {
  readonly kind: ToastKind;
  readonly message: string;
}

const TOAST_TIMEOUT_MS = 4000;

export function NovaSprint() {
  const loadStatus = useOperatorsStore((s) => s.status);
  const loadError = useOperatorsStore((s) => s.error);
  const loadOperators = useOperatorsStore((s) => s.loadOperators);
  const selectedCount = useSprintComposerStore(selectSelectedCount);
  const isFormValid = useSprintComposerStore(selectIsValid);
  const isDispatching = useDispatchStore(selectIsDispatching);

  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (loadStatus === 'idle') {
      void loadOperators();
    }
  }, [loadStatus, loadOperators]);

  useEffect(() => {
    if (toast === null) return undefined;
    const timer = setTimeout(() => {
      setToast(null);
    }, TOAST_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  const handleDispatchClick = useCallback(async (): Promise<void> => {
    const composerState = useSprintComposerStore.getState();
    const request = selectDispatchRequest(composerState);
    if (request === null) {
      return;
    }
    useDispatchStore.getState().start();
    try {
      const result = await api.dispatchSprint(request);
      if (result.ok) {
        useDispatchStore.getState().setResult(result.data);
        // BL-C2-008: registra a sprint para a tela de acompanhamento se
        // pelo menos 1 operador recebeu (caso contrário não há nada para
        // acompanhar). Targets que falharam ficam de fora — o líder não
        // vai polling acks de quem nunca recebeu o arquivo.
        if (result.data.summary.success > 0) {
          const successfulTargets = result.data.per_operator
            .filter((op) => op.status === 'success')
            .map((op) => {
              const sel = request.selected.find((s) => s.user_id === op.user_id);
              return { user_id: op.user_id, meta: sel?.meta ?? 0 };
            });
          useTrackedSprintStore.getState().setCurrent({
            sprint_id: result.data.sprint_id,
            dispatched_at: new Date().toISOString(),
            targets: successfulTargets,
            title: composerState.title.trim() || 'É hora de correr',
            deadline_hhmm: request.deadline,
          });
        }
      } else {
        useDispatchStore.getState().setError(result.error.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useDispatchStore.getState().setError(msg);
    }
  }, []);

  const handleModalClose = useCallback((): void => {
    const dispatchResult = useDispatchStore.getState().result;
    if (dispatchResult !== null && dispatchResult.summary.failed === 0) {
      useSprintComposerStore.getState().reset();
      setToast({ kind: 'success', message: 'Rodada disparada com sucesso.' });
    } else if (dispatchResult !== null) {
      setToast({
        kind: 'warning',
        message: 'Algumas falhas — formulário preservado para nova tentativa.',
      });
    }
    useDispatchStore.getState().reset();
  }, []);

  const buttonTitle = isDispatching
    ? 'Disparando…'
    : isFormValid
      ? 'Disparar evento'
      : 'Preencha todos os campos para disparar';

  const countLabel =
    selectedCount === 0
      ? 'Nenhum usuário selecionado'
      : selectedCount === 1
        ? '1 usuário selecionado'
        : `${String(selectedCount)} usuários selecionados`;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>
          Escolher pessoas
          <br />
          para <span className={styles.titleAccent}>rodada de metas</span>
        </h1>
        <div className={styles.actions}>
          <DeadlineInput />
          <button
            type="button"
            className={styles.dispatchButton}
            disabled={!isFormValid || isDispatching}
            title={buttonTitle}
            onClick={() => {
              void handleDispatchClick();
            }}
          >
            <span>{isDispatching ? 'Disparando…' : 'Disparar evento'}</span>
            <svg
              className={styles.dispatchArrow}
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14M13 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </header>

      <section className={styles.listSection} aria-label="Composer de rodada">
        <div className={styles.listHeader}>
          <div className={styles.listLabelGroup}>
            <h2 className={styles.listLabel}>Usuários</h2>
            <span className={styles.listCount}>{countLabel}</span>
          </div>
          <BulkSelectButtons />
        </div>
        {loadStatus === 'error' && loadError !== null ? (
          <ErrorBanner message={loadError} onRetry={loadOperators} />
        ) : (
          <OperatorList />
        )}
        <p className={isFormValid ? styles.statusReady : styles.statusPending} aria-live="polite">
          {isFormValid ? 'Pronto para disparar' : 'Preencha todos os campos para disparar'}
        </p>
      </section>

      <MessageCustomizer />

      {toast !== null && (
        <div
          className={`${styles.toast} ${
            toast.kind === 'success' ? styles.toastSuccess : styles.toastWarning
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <DispatchModal onClose={handleModalClose} />
    </div>
  );
}
