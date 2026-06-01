/**
 * Histórico — lista de rodadas arquivadas (BL-C2-010, UC-07, RF-15).
 *
 * Consome `api.listArchive`/`api.readArchivedSprint` (fs só no MAIN). A
 * data filtra na fonte; operador e líder filtram client-side. As entradas
 * (uma por par sprint_id+operador) são **agrupadas por `sprint_id`** numa
 * "rodada" com a lista de targets. Read-only.
 *
 * Detalhe (modal): metadados + corpo do aviso (`body_html`, re-sanitizado
 * — §7.9) + lista de targets reaproveitando `TargetStatusList` do
 * Acompanhamento (não duplica UI de status).
 *
 * @see Requisitos UC-07, RF-15, US-05.01
 */

import { sanitizeBodyHtml } from '@sprint/contracts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, Calendar, ChevronRight, Inbox, RotateCcw, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { TargetStatusList } from '../../components/TargetStatusList';
import { api } from '../../services/api';
import {
  collectLiderOptions,
  collectOperatorOptions,
  filterAndGroupSprints,
  findGroupBySprintId,
  useArchiveStore,
  type GroupedSprint,
} from '../../stores/useArchiveStore';

import styles from './Historico.module.css';

/** Formata um ISO com date-fns/ptBR, com fallback para o valor cru. */
function fmt(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern, { locale: ptBR });
  } catch {
    return iso;
  }
}

export function Historico() {
  const loading = useArchiveStore((s) => s.loading);
  const error = useArchiveStore((s) => s.error);
  const items = useArchiveStore((s) => s.items);
  const filters = useArchiveStore((s) => s.filters);
  const setDate = useArchiveStore((s) => s.setDate);
  const setOperador = useArchiveStore((s) => s.setOperador);
  const setLider = useArchiveStore((s) => s.setLider);
  const loadList = useArchiveStore((s) => s.loadList);
  const selectSprint = useArchiveStore((s) => s.selectSprint);
  const selectedSprintId = useArchiveStore((s) => s.selectedSprintId);

  const groups = useMemo(
    () => filterAndGroupSprints(items, filters.operador, filters.lider),
    [items, filters.operador, filters.lider],
  );
  const operatorOptions = useMemo(() => collectOperatorOptions(items), [items]);
  const liderOptions = useMemo(() => collectLiderOptions(items), [items]);
  const selected = useMemo(
    () => findGroupBySprintId(items, selectedSprintId),
    [items, selectedSprintId],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const hasActiveSecondaryFilter = filters.operador !== '' || filters.lider !== '';

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Histórico</h1>
        <p className={styles.pageSubtitle}>Rodadas arquivadas — somente leitura.</p>
      </header>

      <section className={styles.filters} aria-label="Filtros do histórico">
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>
            <Calendar size={14} aria-hidden="true" /> Data
          </span>
          <input
            type="date"
            className={styles.filterInput}
            value={filters.date}
            onChange={(e) => {
              void setDate(e.target.value);
            }}
            aria-label="Filtrar por data"
          />
        </label>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>
            <User size={14} aria-hidden="true" /> Operador
          </span>
          <select
            className={styles.filterInput}
            value={filters.operador}
            onChange={(e) => {
              setOperador(e.target.value);
            }}
            aria-label="Filtrar por operador"
          >
            <option value="">Todos os operadores</option>
            {operatorOptions.map((op) => (
              <option key={op.user_id} value={op.user_id}>
                {op.user_nome_exibicao}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>
            <User size={14} aria-hidden="true" /> Líder
          </span>
          <select
            className={styles.filterInput}
            value={filters.lider}
            onChange={(e) => {
              setLider(e.target.value);
            }}
            aria-label="Filtrar por líder"
          >
            <option value="">Todos os líderes</option>
            {liderOptions.map((lider) => (
              <option key={lider} value={lider}>
                {lider}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <p className={styles.loading} role="status">
          Carregando histórico…
        </p>
      ) : error !== null ? (
        <section className={styles.error} role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <p className={styles.errorTitle}>Não foi possível ler o histórico</p>
            <p className={styles.errorHint}>{error}</p>
          </div>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => {
              void loadList();
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Tentar novamente
          </button>
        </section>
      ) : groups.length === 0 ? (
        <section className={styles.empty} aria-label="Histórico vazio">
          <Inbox size={28} aria-hidden="true" />
          <p className={styles.emptyTitle}>
            {items.length === 0
              ? 'Nenhuma rodada arquivada'
              : 'Nenhuma rodada corresponde aos filtros'}
          </p>
          <p className={styles.emptyHint}>
            {hasActiveSecondaryFilter
              ? 'Ajuste ou limpe os filtros de operador/líder.'
              : 'Rodadas concluídas ou expiradas aparecem aqui após o arquivamento.'}
          </p>
        </section>
      ) : (
        <ul className={styles.list} aria-label="Rodadas arquivadas">
          {groups.map((group) => (
            <li key={group.sprint_id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => {
                  selectSprint(group.sprint_id);
                }}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowDate}>
                    {fmt(group.criado_em, "dd/MM/yyyy 'às' HH:mm")}
                  </span>
                  <span className={styles.rowTitle}>{group.title}</span>
                </span>
                <span className={styles.rowMeta}>
                  <span className={styles.rowLider}>
                    <User size={13} aria-hidden="true" /> {group.criado_por}
                  </span>
                  <span className={styles.rowCount}>
                    {group.targets.length} {group.targets.length === 1 ? 'operador' : 'operadores'}
                  </span>
                  <StatusSummary counts={group.counts} />
                  <ChevronRight size={16} aria-hidden="true" className={styles.rowChevron} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected !== null && (
        <SprintDetail
          group={selected}
          onClose={() => {
            selectSprint(null);
          }}
        />
      )}
    </div>
  );
}

/** Resumo compacto de status (confirmado/visto/não visto) de uma rodada. */
function StatusSummary({ counts }: { counts: GroupedSprint['counts'] }) {
  return (
    <span className={styles.statusSummary}>
      <span className={`${styles.badge} ${styles.badgeConfirmado}`}>{counts.confirmado} ✓</span>
      <span className={`${styles.badge} ${styles.badgeVisto}`}>{counts.visto} 👁</span>
      <span className={`${styles.badge} ${styles.badgeNaoVisto}`}>{counts.nao_visto} —</span>
    </span>
  );
}

type BodyState =
  | { status: 'loading' }
  | { status: 'ok'; html: string }
  | { status: 'error'; message: string };

/** Modal de detalhe de uma rodada arquivada (read-only). */
function SprintDetail({ group, onClose }: { group: GroupedSprint; onClose: () => void }) {
  const [body, setBody] = useState<BodyState>({ status: 'loading' });

  useEffect(() => {
    const first = group.targets[0];
    if (first === undefined) {
      setBody({ status: 'error', message: 'Rodada sem operadores.' });
      return undefined;
    }
    const signal = { cancelled: false };
    setBody({ status: 'loading' });
    void (async () => {
      try {
        const result = await api.readArchivedSprint({
          date: group.date,
          sprint_id: group.sprint_id,
          user_id: first.user_id,
        });
        if (signal.cancelled) return;
        if (result.ok) {
          setBody({ status: 'ok', html: sanitizeBodyHtml(result.data.payload.body_html) });
        } else {
          setBody({ status: 'error', message: result.error.message });
        }
      } catch (err) {
        if (signal.cancelled) return;
        setBody({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [group]);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhe da rodada: ${group.title}`}
      >
        <header className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{group.title}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <dl className={styles.modalMeta}>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Líder</dt>
            <dd className={styles.metaValue}>{group.criado_por}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Disparada em</dt>
            <dd className={styles.metaValue}>
              {fmt(group.criado_em, "dd 'de' MMMM 'de' yyyy 'às' HH:mm")}
            </dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Deadline</dt>
            <dd className={styles.metaValue}>{fmt(group.deadline_at, "dd/MM 'às' HH:mm")}</dd>
          </div>
        </dl>

        <section className={styles.modalBody} aria-label="Conteúdo do aviso">
          {body.status === 'loading' ? (
            <p className={styles.loading} role="status">
              Carregando conteúdo…
            </p>
          ) : body.status === 'error' ? (
            <p className={styles.bodyError} role="alert">
              Não foi possível ler o conteúdo: {body.message}
            </p>
          ) : (
            <div
              className={styles.bodyHtml}
              // body_html já foi sanitizado na escrita (PendingStore) e é
              // re-sanitizado aqui na leitura (§7.9, defesa em profundidade).
              dangerouslySetInnerHTML={{ __html: body.html }}
            />
          )}
        </section>

        <section className={styles.modalTargets} aria-label="Operadores e status">
          <h3 className={styles.modalSubtitle}>Operadores</h3>
          <TargetStatusList
            targets={group.targets}
            emptyLabel="Nenhum operador registrado nesta rodada."
          />
        </section>
      </div>
    </div>
  );
}
