/**
 * Modal exibido após o líder clicar em "Disparar evento". Consome
 * `useDispatchStore` (Gate 2) e renderiza um de 3 estados:
 *
 * - `in_progress` — spinner + texto enquanto `api.dispatchSprint` está em vôo.
 *   Sem botão de fechar (cancelamento mid-flight seria complexo).
 * - `completed` — tabela `per_operator` com ✓/✗ e mensagens de erro por
 *   usuário + summary (total/sucesso/falha). Botão "Fechar".
 * - `error` — falha fatal (ex.: `CONFIG_REQUIRED` se o config sumiu no
 *   meio do app). Mensagem + botão "Fechar".
 *
 * `onClose` é fornecido pelo `NovaSprint` — chamado no clique do botão
 * "Fechar". O `NovaSprint` decide se reseta o composer (sucesso total) ou
 * mantém o form para retry (falhas parciais ou erro fatal).
 *
 * @see DECISIONS.md ADR-015 (composer Leader)
 * @see src/renderer/stores/useDispatchStore.ts
 */

import { useDispatchStore } from '../../stores/useDispatchStore';

import styles from './DispatchModal.module.css';

interface DispatchModalProps {
  readonly onClose: () => void;
}

export function DispatchModal({ onClose }: DispatchModalProps) {
  const status = useDispatchStore((s) => s.status);
  const result = useDispatchStore((s) => s.result);
  const globalError = useDispatchStore((s) => s.globalError);

  if (status === 'idle') return null;

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-modal-title"
      >
        {status === 'in_progress' && (
          <>
            <h2 id="dispatch-modal-title" className={styles.title}>
              Disparando rodada…
            </h2>
            <div className={styles.spinner} role="status" aria-label="Despachando" />
            <p className={styles.subtitle}>Gravando arquivos na pasta compartilhada.</p>
          </>
        )}

        {status === 'completed' && result !== null && (
          <>
            <h2 id="dispatch-modal-title" className={styles.title}>
              Resultado da rodada
            </h2>
            <div className={styles.summary}>
              <span className={styles.summaryItem}>
                Total: <strong>{result.summary.total}</strong>
              </span>
              <span className={`${styles.summaryItem} ${styles.summarySuccess}`}>
                Sucesso: <strong>{result.summary.success}</strong>
              </span>
              <span
                className={`${styles.summaryItem} ${
                  result.summary.failed > 0 ? styles.summaryFailed : ''
                }`}
              >
                Falhas: <strong>{result.summary.failed}</strong>
              </span>
            </div>
            <ul className={styles.list} aria-label="Resultado por usuário">
              {result.per_operator.map((op) => (
                <li
                  key={op.user_id}
                  className={`${styles.item} ${
                    op.status === 'success' ? styles.itemSuccess : styles.itemError
                  }`}
                >
                  <span className={styles.itemIcon} aria-hidden="true">
                    {op.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className={styles.itemName}>{op.user_nome_exibicao}</span>
                  {op.status === 'error' && op.error_message !== undefined && (
                    <span className={styles.itemError}>{op.error_message}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className={styles.footer}>
              <button type="button" className={styles.closeButton} onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 id="dispatch-modal-title" className={styles.title}>
              Erro ao disparar
            </h2>
            <p className={styles.errorMessage}>
              {globalError ?? 'Erro inesperado ao disparar rodada.'}
            </p>
            <div className={styles.footer}>
              <button type="button" className={styles.closeButton} onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
