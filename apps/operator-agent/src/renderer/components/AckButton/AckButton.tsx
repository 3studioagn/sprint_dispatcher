/**
 * AckButton — botão de ação no rodapé do overlay.
 *
 * **Modo normal (fluxo de fila):** botão "Recebi" funcional (Gate 6).
 * Click → `window.api.sprint.acknowledge({ sprint_id, user_id })` →
 * main `handleAck` orquestra ack + archive + deletePending + dequeue +
 * próxima sprint OU hide.
 *
 * **Modo reaberto (BL-C3-009):** prop `reopened: true` (sprint vinda do
 * histórico via tray) → botão "Fechar" + handler chama
 * `window.api.overlay.closeReopened()`. NÃO escreve ack — sprint já foi
 * ackeada anteriormente; reabertura é apenas re-visualização.
 *
 * **Estados visuais (modo normal):**
 * - Idle: "Recebi" + autoFocus.
 * - Loading (invoke em vôo): "Confirmando…" + disabled.
 * - Erro: button volta a habilitado + mensagem inline em vermelho.
 * - Sucesso com `moved_to_history: false` (regressão F-024): warning
 *   visível até remount — ack OK mas arquivamento local falhou.
 *
 * **Modo reaberto não tem erro/warning** — closeReopened é sempre
 * sucesso (apenas hide() no main).
 *
 * **Reset por nova sprint:** o Overlay passa `key={sprint.sprint_id}` —
 * quando a sprint troca via push `sprint:incoming`, React remonta o
 * componente do zero (loading=false, error=null, warning=null). Cleaner
 * que useEffect dep array.
 */

import { useState } from 'react';

import styles from './AckButton.module.css';

export interface AckButtonProps {
  sprintId: string;
  userId: string;
  /**
   * `true` quando o overlay está exibindo um aviso reaberto via tray
   * (BL-C3-009). Substitui o botão "Recebi" por "Fechar" e o handler
   * de close — NÃO grava ack adicional. Default `false` (fluxo normal).
   */
  reopened?: boolean;
}

export function AckButton({ sprintId, userId, reopened = false }: AckButtonProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleAcknowledge(): Promise<void> {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const result = await window.api.sprint.acknowledge({
        sprint_id: sprintId,
        user_id: userId,
      });
      if (!result.ok) {
        setError(result.error.message);
        setLoading(false);
        return;
      }
      // Sucesso — main vai disparar `sprint:incoming` da próxima sprint
      // (que via key={sprint_id} remonta este componente) OU `overlay:minimize`
      // se a fila esvaziou. Não tocar no state de loading — o React handle
      // isso via remount.
      //
      // F-024: archive falhou silenciosamente — surface ao operador antes
      // do remount/minimize. Não-bloqueante (ack já foi escrito no shared).
      if (!result.data.moved_to_history) {
        setWarning(
          'Histórico local não foi atualizado. A rodada foi confirmada com sucesso, mas pode não aparecer em "Histórico".',
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  async function handleCloseReopened(): Promise<void> {
    // Modo reaberto — apenas fecha overlay; sem ack adicional (BL-C3-009).
    // Main hide() leva o overlay para 'hidden'. Próxima sprint do fluxo
    // normal segue inalterada.
    try {
      await window.api.overlay.closeReopened();
    } catch (err: unknown) {
      // Defensivo — closeReopened no main é praticamente no-op (hide),
      // não é esperado falhar. Surface inline para o operador saber.
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (reopened) {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          className={styles.button}
          autoFocus
          onClick={() => {
            void handleCloseReopened();
          }}
        >
          Fechar
        </button>
        {error !== null && (
          <p className={styles.error} role="alert">
            Falha ao fechar — tente de novo. ({error})
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        autoFocus
        disabled={loading}
        onClick={() => {
          void handleAcknowledge();
        }}
      >
        {loading ? 'Confirmando…' : 'Recebi'}
      </button>
      {error !== null && (
        <p className={styles.error} role="alert">
          Falha ao confirmar — tente de novo. ({error})
        </p>
      )}
      {warning !== null && (
        <p className={styles.warning} role="status">
          {warning}
        </p>
      )}
    </div>
  );
}
