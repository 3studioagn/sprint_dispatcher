/**
 * Acompanhamento — tela que mostra os acks da última sprint disparada
 * (BL-C2-008). Polling a cada 3s em `<shared_path>/acks/` via IPC
 * `api.listAcks(sprintId, targets)`.
 *
 * Estados por target (Anexo D, derivados pelo `AckTrackingService`):
 * - `nao_visto` — operador ainda não viu o overlay (Agent offline,
 *   sprint nova, ou polling do Agent ainda não rodou).
 * - `visto` — overlay foi exibido (Agent gravou ack com `displayed_at`).
 * - `confirmado` — operador clicou "Recebi" (Agent atualizou ack com
 *   `acknowledged_at`).
 *
 * Polling para nos casos:
 * - Não há sprint sendo acompanhada na sessão (`current === null`).
 * - Componente desmontou (cleanup do useEffect).
 *
 * BL-C2-009 (Phase 4) adicionará o botão "Cancelar Sprint" e o
 * estado pós-cancelamento.
 *
 * @see Requisitos UC-04, RF-10
 */
import { useCallback, useEffect, useState } from 'react';

import type { AckStateView } from '../../../shared/ipc-types';
import { CancelSprintButton } from '../../components/CancelSprintButton';
import { api } from '../../services/api';
import {
  selectHasCurrentSprint,
  selectIsSprintActive,
  useTrackedSprintStore,
} from '../../stores/useTrackedSprintStore';

import styles from './Acompanhamento.module.css';

/** Intervalo de polling em ms (RF-10, UC-04 — 3s). */
const POLLING_INTERVAL_MS = 3000;

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; targets: readonly AckStateView[]; checked_at: string }
  | { status: 'error'; message: string };

const STATE_LABEL: Record<AckStateView['state'], string> = {
  nao_visto: 'Não visto',
  visto: 'Visto',
  confirmado: 'Confirmado',
};

const STATE_CLASS: Record<AckStateView['state'], string> = {
  nao_visto: styles.stateNaoVisto ?? '',
  visto: styles.stateVisto ?? '',
  confirmado: styles.stateConfirmado ?? '',
};

function formatTime(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

export function Acompanhamento() {
  const current = useTrackedSprintStore((s) => s.current);
  const hasCurrent = useTrackedSprintStore(selectHasCurrentSprint);
  const isActive = useTrackedSprintStore(selectIsSprintActive);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  const fetchAcks = useCallback(
    async (
      sprintId: string,
      targets: readonly { user_id: string }[],
      signal: { cancelled: boolean },
    ): Promise<void> => {
      try {
        const response = await api.listAcks(sprintId, targets);
        if (signal.cancelled) return;
        if (response.ok) {
          setLoad({
            status: 'ok',
            targets: response.data.targets,
            checked_at: response.data.checked_at,
          });
        } else {
          setLoad({ status: 'error', message: response.error.message });
        }
      } catch (err) {
        if (signal.cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoad({ status: 'error', message: msg });
      }
    },
    [],
  );

  useEffect(() => {
    if (current === null) {
      setLoad({ status: 'idle' });
      return undefined;
    }
    if (current.cancelled) {
      // BL-C2-009: sprint cancelada — mantém última leitura visível,
      // mas não pollea mais.
      return undefined;
    }
    const signal = { cancelled: false };
    setLoad({ status: 'loading' });
    void fetchAcks(current.sprint_id, current.targets, signal);
    const intervalId = setInterval(() => {
      void fetchAcks(current.sprint_id, current.targets, signal);
    }, POLLING_INTERVAL_MS);
    return () => {
      signal.cancelled = true;
      clearInterval(intervalId);
    };
  }, [current, fetchAcks]);

  if (!hasCurrent || current === null) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Acompanhamento</h1>
          <p className={styles.pageSubtitle}>Status das sprints ativas em tempo quase-real.</p>
        </header>
        <section className={styles.empty} aria-label="Estado vazio">
          <p className={styles.emptyTitle}>Nenhuma rodada disparada nesta sessão</p>
          <p className={styles.emptyHint}>
            Vá para <strong>Nova Rodada</strong> para disparar uma rodada de metas. Os acks
            aparecerão aqui em tempo quase-real.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Acompanhamento</h1>
          {isActive && <CancelSprintButton />}
        </div>
        <p className={styles.pageSubtitle}>
          {current.cancelled ? (
            <>
              Esta rodada foi <strong>cancelada</strong>. O polling foi encerrado.
            </>
          ) : (
            <>
              Atualizando a cada 3s — status dos avisos para esta rodada (
              <code className={styles.sprintIdHint}>{current.sprint_id.slice(0, 8)}…</code>).
            </>
          )}
        </p>
      </header>

      <section className={styles.summary} aria-label="Resumo da rodada">
        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>Título</dt>
            <dd className={styles.summaryValue}>{current.title}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>Deadline</dt>
            <dd className={styles.summaryValue}>{current.deadline_hhmm}h</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt className={styles.summaryLabel}>Operadores</dt>
            <dd className={styles.summaryValue}>{String(current.targets.length)}</dd>
          </div>
          {load.status === 'ok' && (
            <div className={styles.summaryItem}>
              <dt className={styles.summaryLabel}>Atualizado</dt>
              <dd className={styles.summaryValue}>{formatTime(load.checked_at) ?? '—'}</dd>
            </div>
          )}
        </dl>
      </section>

      {load.status === 'error' && (
        <p className={styles.error} role="alert">
          Erro ao consultar acks: {load.message}
        </p>
      )}

      <section className={styles.targets} aria-label="Status por operador">
        {load.status === 'loading' ? (
          <p className={styles.loading} role="status">
            Consultando acks…
          </p>
        ) : (
          <ul className={styles.list}>
            {(load.status === 'ok' ? load.targets : []).map((target) => {
              const displayTime =
                target.state === 'confirmado'
                  ? formatTime(target.acknowledged_at)
                  : target.state === 'visto'
                    ? formatTime(target.displayed_at)
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
                    {displayTime !== null && (
                      <span className={styles.stateTime}>às {displayTime}</span>
                    )}
                  </span>
                </li>
              );
            })}
            {load.status === 'ok' && load.targets.length === 0 && (
              <li className={styles.emptyTargets}>Nenhum operador nesta rodada.</li>
            )}
          </ul>
        )}
      </section>

      {current.cancelled && (
        <p className={styles.cancelledNote} role="status">
          Rodada cancelada. Os acks acima refletem o último estado antes do cancelamento.
        </p>
      )}
    </div>
  );
}
