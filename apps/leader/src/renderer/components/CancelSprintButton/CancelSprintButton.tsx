/**
 * CancelSprintButton — botão "Cancelar Sprint" + modal de confirmação
 * (BL-C2-009).
 *
 * Renderiza um botão destrutivo no header da tela de Acompanhamento.
 * Ao clicar, abre um modal pedindo confirmação obrigatória + motivo
 * opcional. Ao confirmar, chama `api.cancelSprint` e marca a sprint
 * como cancelada no `useTrackedSprintStore` (que faz o
 * `Acompanhamento` parar o polling e mostrar o estado pós-cancelamento).
 *
 * O Agent (BL-C3-011, pollingService.processCancel) detecta o
 * `cancel-*.json` em `pending/` e fecha o overlay do operador sem
 * ack — last write wins (RN-06).
 *
 * Auto-desliga depois do markCancelled: a Acompanhamento esconde o
 * botão via `selectIsSprintActive`.
 *
 * @see Requisitos UC-05, RF-11
 * @see useTrackedSprintStore.markCancelled
 */

import { useCallback, useState } from 'react';

import { api } from '../../services/api';
import { useTrackedSprintStore } from '../../stores/useTrackedSprintStore';

import styles from './CancelSprintButton.module.css';

type DialogState =
  | { status: 'closed' }
  | { status: 'open' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

export function CancelSprintButton() {
  const current = useTrackedSprintStore((s) => s.current);
  const markCancelled = useTrackedSprintStore((s) => s.markCancelled);
  const [dialog, setDialog] = useState<DialogState>({ status: 'closed' });
  const [motivo, setMotivo] = useState('');

  const openDialog = useCallback(() => {
    setMotivo('');
    setDialog({ status: 'open' });
  }, []);

  const closeDialog = useCallback(() => {
    if (dialog.status === 'submitting') return;
    setDialog({ status: 'closed' });
  }, [dialog.status]);

  const confirmCancel = useCallback(async (): Promise<void> => {
    if (current === null) return;
    setDialog({ status: 'submitting' });
    try {
      const trimmed = motivo.trim();
      const response = await api.cancelSprint({
        sprint_id: current.sprint_id,
        ...(trimmed.length > 0 ? { motivo: trimmed } : {}),
      });
      if (response.ok) {
        markCancelled();
        setDialog({ status: 'closed' });
      } else {
        setDialog({ status: 'error', message: response.error.message });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDialog({ status: 'error', message: msg });
    }
  }, [current, motivo, markCancelled]);

  if (current === null) return null;

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={openDialog}
        aria-label="Cancelar rodada"
      >
        Cancelar rodada
      </button>

      {dialog.status !== 'closed' && (
        <div className={styles.backdrop} onClick={closeDialog} role="presentation">
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h2 id="cancel-dialog-title" className={styles.title}>
              Cancelar esta rodada?
            </h2>
            <p className={styles.body}>
              Os avisos exibidos nas estações dos operadores serão fechados sem confirmação. Esta
              ação não pode ser desfeita.
            </p>

            <label className={styles.field}>
              <span className={styles.label}>Motivo (opcional)</span>
              <textarea
                className={styles.textarea}
                value={motivo}
                maxLength={500}
                rows={3}
                placeholder="Ex.: meta atualizada, encerramento antecipado…"
                disabled={dialog.status === 'submitting'}
                onChange={(e) => {
                  setMotivo(e.target.value);
                }}
                aria-label="Motivo do cancelamento"
              />
            </label>

            {dialog.status === 'error' && (
              <p className={styles.error} role="alert">
                Erro ao cancelar: {dialog.message}
              </p>
            )}

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={closeDialog}
                disabled={dialog.status === 'submitting'}
              >
                Voltar
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => {
                  void confirmCancel();
                }}
                disabled={dialog.status === 'submitting'}
              >
                {dialog.status === 'submitting' ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
