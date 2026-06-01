/**
 * TargetStatusList — lista de operadores com o estado do ack
 * ("não visto / visto / confirmado") + timestamp.
 *
 * Extraído do markup inline do Acompanhamento (BL-C2-008) para ser
 * **reaproveitado** no detalhe do Histórico (BL-C2-010) — mesma UI de
 * status em ambas as telas, sem duplicação (§6.7). Componente puro de
 * apresentação: recebe os targets já resolvidos e renderiza.
 *
 * O estado segue a semântica do Anexo D:
 * - `nao_visto`: operador ainda não viu o overlay.
 * - `visto`: overlay exibido (`displayed_at`), sem confirmação.
 * - `confirmado`: operador clicou "Recebi" (`acknowledged_at`).
 *
 * @see Requisitos Anexo D, UC-04, UC-07
 */

import type { AckState } from '../../../shared/ipc-types';

import styles from './TargetStatusList.module.css';

/** Shape mínimo de um target com estado de ack — compartilhado por
 * `AckStateView` (Acompanhamento) e `ArchivedSprintListItem` (Histórico). */
export interface TargetStatusItem {
  readonly user_id: string;
  readonly user_nome_exibicao: string;
  readonly state: AckState;
  readonly displayed_at?: string;
  readonly acknowledged_at?: string;
}

interface TargetStatusListProps {
  readonly targets: readonly TargetStatusItem[];
  /** Texto exibido quando `targets` está vazio. */
  readonly emptyLabel: string;
}

const STATE_LABEL: Record<AckState, string> = {
  nao_visto: 'Não visto',
  visto: 'Visto',
  confirmado: 'Confirmado',
};

const STATE_CLASS: Record<AckState, string> = {
  nao_visto: styles.stateNaoVisto ?? '',
  visto: styles.stateVisto ?? '',
  confirmado: styles.stateConfirmado ?? '',
};

/** Formata um ISO em HH:MM:SS (pt-BR). Retorna `null` em entrada inválida. */
export function formatAckTime(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  const date = new Date(iso);
  // `toLocaleTimeString` em Invalid Date devolve "Invalid Date" (não lança);
  // guardamos para devolver null em entrada malformada.
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

export function TargetStatusList({ targets, emptyLabel }: TargetStatusListProps) {
  return (
    <ul className={styles.list}>
      {targets.map((target) => {
        const displayTime =
          target.state === 'confirmado'
            ? formatAckTime(target.acknowledged_at)
            : target.state === 'visto'
              ? formatAckTime(target.displayed_at)
              : null;
        const stateClass = STATE_CLASS[target.state];
        return (
          <li
            key={target.user_id}
            className={`${styles.targetRow} ${stateClass}`}
            data-state={target.state}
          >
            <span className={styles.targetName}>{target.user_nome_exibicao}</span>
            <span className={styles.targetStatus}>
              <span className={styles.stateDot} aria-hidden="true" />
              <span className={styles.stateLabel}>{STATE_LABEL[target.state]}</span>
              {displayTime !== null && <span className={styles.stateTime}>às {displayTime}</span>}
            </span>
          </li>
        );
      })}
      {targets.length === 0 && <li className={styles.emptyTargets}>{emptyLabel}</li>}
    </ul>
  );
}
