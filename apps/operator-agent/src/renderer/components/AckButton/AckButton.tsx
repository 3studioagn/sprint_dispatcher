/**
 * AckButton — botão "Recebi" funcional (Gate 6).
 *
 * Click → `window.api.sprint.acknowledge({ sprint_id, user_id })` →
 * main `handleAck` orquestra ack + archive + deletePending + dequeue +
 * próxima sprint OU hide.
 *
 * **Estados visuais:**
 * - Idle: "Recebi" + autoFocus.
 * - Loading (invoke em vôo): "Confirmando…" + disabled.
 * - Erro: button volta a habilitado + mensagem inline em vermelho.
 * - Sucesso com `moved_to_history: false` (regressão F-024): warning
 *   visível até remount — ack OK mas arquivamento local falhou.
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
}

export function AckButton({ sprintId, userId }: AckButtonProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
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

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        autoFocus
        disabled={loading}
        onClick={() => {
          void handleClick();
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
