/**
 * Store da tela de Histórico (BL-C2-010, UC-07).
 *
 * Mantém os itens crus retornados por `api.listArchive` (já filtrados por
 * **data na fonte**), os filtros de UI e a sprint selecionada para detalhe.
 * Os filtros de **operador** e **líder** são aplicados **client-side** via
 * selectors puros (sem reabrir o C4), e a listagem é **agrupada por
 * `sprint_id`** (uma "rodada" = N targets que compartilham o ULID).
 *
 * Read-only: nenhuma ação muta o `arquivo/`. A busca por data re-consulta
 * o IPC (`setDate` → `loadList`); operador/líder só recomputam selectors.
 *
 * @see Requisitos UC-07, RF-15, US-05.01
 */

import { create } from 'zustand';

import type { ArchivedSprintListItem } from '../../shared/ipc-types';
import { api } from '../services/api';

export interface ArchiveFilters {
  /** Pasta de data `YYYY-MM-DD`; `''` = todas (filtro na fonte). */
  readonly date: string;
  /** `user_id` do operador; `''` = todos (filtro client-side). */
  readonly operador: string;
  /** `criado_por` do líder; `''` = todos (filtro client-side). */
  readonly lider: string;
}

/** Uma "rodada" arquivada — targets agrupados pelo mesmo `sprint_id`. */
export interface GroupedSprint {
  readonly sprint_id: string;
  readonly date: string;
  readonly criado_em: string;
  readonly criado_por: string;
  readonly title: string;
  readonly deadline_at: string;
  readonly targets: readonly ArchivedSprintListItem[];
  readonly counts: { confirmado: number; visto: number; nao_visto: number };
}

export interface ArchiveState {
  readonly filters: ArchiveFilters;
  readonly items: readonly ArchivedSprintListItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly checkedAt: string | null;
  readonly selectedSprintId: string | null;

  /** Define a data e re-consulta o histórico na fonte. */
  setDate: (date: string) => Promise<void>;
  /** Filtro client-side por operador (`user_id`). */
  setOperador: (operador: string) => void;
  /** Filtro client-side por líder (`criado_por`). */
  setLider: (lider: string) => void;
  /** (Re)carrega a lista com a data atual. */
  loadList: () => Promise<void>;
  /** Seleciona uma rodada para detalhe (`null` fecha). */
  selectSprint: (sprintId: string | null) => void;
  /** Limpa filtros, lista e seleção (testes/reset de sessão). */
  reset: () => void;
}

const INITIAL: Pick<
  ArchiveState,
  'filters' | 'items' | 'loading' | 'error' | 'checkedAt' | 'selectedSprintId'
> = {
  filters: { date: '', operador: '', lider: '' },
  items: [],
  loading: false,
  error: null,
  checkedAt: null,
  selectedSprintId: null,
};

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  ...INITIAL,

  loadList: async () => {
    const { filters } = get();
    set({ loading: true, error: null });
    try {
      const result = await api.listArchive(filters.date === '' ? {} : { date: filters.date });
      if (result.ok) {
        set({ items: result.data.items, checkedAt: result.data.checked_at, loading: false });
      } else {
        set({ items: [], error: result.error.message, loading: false });
      }
    } catch (err) {
      set({
        items: [],
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  setDate: async (date) => {
    set((s) => ({ filters: { ...s.filters, date }, selectedSprintId: null }));
    await get().loadList();
  },

  setOperador: (operador) => {
    set((s) => ({ filters: { ...s.filters, operador } }));
  },

  setLider: (lider) => {
    set((s) => ({ filters: { ...s.filters, lider } }));
  },

  selectSprint: (sprintId) => {
    set({ selectedSprintId: sprintId });
  },

  reset: () => {
    set(INITIAL);
  },
}));

// =============================================================================
// Derivações puras (args explícitos → consumidas via useMemo no componente,
// evitando o pitfall de selector Zustand que retorna nova referência a cada
// render). Testáveis isoladamente sem montar o store.
// =============================================================================

/** Agrupa itens por `sprint_id`, ordenando rodadas mais recentes primeiro. */
function groupBySprintId(items: readonly ArchivedSprintListItem[]): GroupedSprint[] {
  const byId = new Map<string, ArchivedSprintListItem[]>();
  for (const item of items) {
    const bucket = byId.get(item.sprint_id);
    if (bucket === undefined) {
      byId.set(item.sprint_id, [item]);
    } else {
      bucket.push(item);
    }
  }

  const groups: GroupedSprint[] = [];
  for (const targets of byId.values()) {
    const first = targets[0];
    if (first === undefined) continue; // inalcançável (buckets nunca vazios)
    const counts = { confirmado: 0, visto: 0, nao_visto: 0 };
    for (const t of targets) counts[t.state] += 1;
    groups.push({
      sprint_id: first.sprint_id,
      date: first.date,
      criado_em: first.criado_em,
      criado_por: first.criado_por,
      title: first.title,
      deadline_at: first.deadline_at,
      targets: [...targets].sort((a, b) =>
        a.user_nome_exibicao.localeCompare(b.user_nome_exibicao),
      ),
      counts,
    });
  }
  groups.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return groups;
}

/** Aplica os filtros client-side (operador/líder) e agrupa por `sprint_id`. */
export function filterAndGroupSprints(
  items: readonly ArchivedSprintListItem[],
  operador: string,
  lider: string,
): GroupedSprint[] {
  const filtered = items.filter(
    (item) =>
      (operador === '' || item.user_id === operador) && (lider === '' || item.criado_por === lider),
  );
  return groupBySprintId(filtered);
}

/** Opções para o filtro de operador (distintas, ordenadas por nome). */
export function collectOperatorOptions(
  items: readonly ArchivedSprintListItem[],
): { user_id: string; user_nome_exibicao: string }[] {
  const byId = new Map<string, string>();
  for (const item of items) byId.set(item.user_id, item.user_nome_exibicao);
  return [...byId.entries()]
    .map(([user_id, user_nome_exibicao]) => ({ user_id, user_nome_exibicao }))
    .sort((a, b) => a.user_nome_exibicao.localeCompare(b.user_nome_exibicao));
}

/** Opções para o filtro de líder (`criado_por` distintos, ordenados). */
export function collectLiderOptions(items: readonly ArchivedSprintListItem[]): string[] {
  return [...new Set(items.map((item) => item.criado_por))].sort((a, b) => a.localeCompare(b));
}

/** A rodada selecionada (do conjunto completo, ignorando filtros), ou `null`. */
export function findGroupBySprintId(
  items: readonly ArchivedSprintListItem[],
  sprintId: string | null,
): GroupedSprint | null {
  if (sprintId === null) return null;
  return groupBySprintId(items).find((g) => g.sprint_id === sprintId) ?? null;
}
