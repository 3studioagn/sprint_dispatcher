import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArchivedSprintListItem } from '../../shared/ipc-types';

import {
  collectLiderOptions,
  collectOperatorOptions,
  filterAndGroupSprints,
  findGroupBySprintId,
  useArchiveStore,
} from './useArchiveStore';

const ULID_A = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const ULID_B = '01J0ABCDEF1234567890ABCDEF';

function item(overrides: Partial<ArchivedSprintListItem> = {}): ArchivedSprintListItem {
  return {
    date: '2026-05-28',
    sprint_id: ULID_A,
    user_id: 'joao',
    user_nome_exibicao: 'João Silva',
    title: 'Rush',
    criado_por: 'Renan',
    criado_em: '2026-05-28T13:00:00.000Z',
    deadline_at: '2026-05-28T21:00:00.000Z',
    meta: 5,
    state: 'nao_visto',
    ...overrides,
  };
}

describe('useArchiveStore — derivações puras', () => {
  describe('filterAndGroupSprints', () => {
    it('agrupa targets por sprint_id', () => {
      const items = [
        item({ user_id: 'joao' }),
        item({ user_id: 'maria', user_nome_exibicao: 'Maria' }),
        item({ sprint_id: ULID_B, user_id: 'joao', criado_em: '2026-05-29T10:00:00.000Z' }),
      ];
      const groups = filterAndGroupSprints(items, '', '');
      expect(groups).toHaveLength(2);
      const a = groups.find((g) => g.sprint_id === ULID_A);
      expect(a?.targets).toHaveLength(2);
    });

    it('ordena rodadas mais recentes primeiro (por criado_em)', () => {
      const items = [
        item({ sprint_id: ULID_A, criado_em: '2026-05-28T13:00:00.000Z' }),
        item({ sprint_id: ULID_B, criado_em: '2026-05-29T10:00:00.000Z' }),
      ];
      const groups = filterAndGroupSprints(items, '', '');
      expect(groups[0]?.sprint_id).toBe(ULID_B);
    });

    it('conta estados por rodada', () => {
      const items = [
        item({ user_id: 'a', state: 'confirmado' }),
        item({ user_id: 'b', state: 'visto' }),
        item({ user_id: 'c', state: 'nao_visto' }),
      ];
      const [group] = filterAndGroupSprints(items, '', '');
      expect(group?.counts).toEqual({ confirmado: 1, visto: 1, nao_visto: 1 });
    });

    it('filtra por operador (user_id)', () => {
      const items = [item({ user_id: 'joao' }), item({ user_id: 'maria' })];
      const groups = filterAndGroupSprints(items, 'maria', '');
      expect(groups).toHaveLength(1);
      expect(groups[0]?.targets[0]?.user_id).toBe('maria');
    });

    it('filtra por líder (criado_por)', () => {
      const items = [
        item({ sprint_id: ULID_A, criado_por: 'Renan' }),
        item({ sprint_id: ULID_B, criado_por: 'Otavio' }),
      ];
      const groups = filterAndGroupSprints(items, '', 'Otavio');
      expect(groups).toHaveLength(1);
      expect(groups[0]?.criado_por).toBe('Otavio');
    });
  });

  it('collectOperatorOptions retorna operadores distintos ordenados por nome', () => {
    const items = [
      item({ user_id: 'maria', user_nome_exibicao: 'Maria' }),
      item({ user_id: 'joao', user_nome_exibicao: 'João' }),
      item({ user_id: 'joao', user_nome_exibicao: 'João' }),
    ];
    expect(collectOperatorOptions(items)).toEqual([
      { user_id: 'joao', user_nome_exibicao: 'João' },
      { user_id: 'maria', user_nome_exibicao: 'Maria' },
    ]);
  });

  it('collectLiderOptions retorna líderes distintos ordenados', () => {
    const items = [
      item({ criado_por: 'Renan' }),
      item({ criado_por: 'Otavio' }),
      item({ criado_por: 'Renan' }),
    ];
    expect(collectLiderOptions(items)).toEqual(['Otavio', 'Renan']);
  });

  it('findGroupBySprintId localiza a rodada ou retorna null', () => {
    const items = [item({ sprint_id: ULID_A })];
    expect(findGroupBySprintId(items, ULID_A)?.sprint_id).toBe(ULID_A);
    expect(findGroupBySprintId(items, ULID_B)).toBeNull();
    expect(findGroupBySprintId(items, null)).toBeNull();
  });
});

describe('useArchiveStore — ações', () => {
  beforeEach(() => {
    useArchiveStore.getState().reset();
  });

  it('loadList popula items no sucesso', async () => {
    vi.mocked(window.api.listArchive).mockResolvedValueOnce({
      ok: true,
      data: { items: [item()], checked_at: '2026-06-01T10:00:00.000Z' },
    });
    await useArchiveStore.getState().loadList();
    expect(useArchiveStore.getState().items).toHaveLength(1);
    expect(useArchiveStore.getState().error).toBeNull();
    expect(useArchiveStore.getState().loading).toBe(false);
  });

  it('loadList registra erro quando IPC retorna ok=false', async () => {
    vi.mocked(window.api.listArchive).mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFIG_REQUIRED', message: 'config faltando' },
    });
    await useArchiveStore.getState().loadList();
    expect(useArchiveStore.getState().error).toBe('config faltando');
    expect(useArchiveStore.getState().items).toEqual([]);
  });

  it('loadList registra erro quando IPC lança', async () => {
    vi.mocked(window.api.listArchive).mockRejectedValueOnce(new Error('IPC down'));
    await useArchiveStore.getState().loadList();
    expect(useArchiveStore.getState().error).toBe('IPC down');
  });

  it('setDate atualiza a data e re-consulta passando a data à fonte', async () => {
    await useArchiveStore.getState().setDate('2026-05-28');
    expect(useArchiveStore.getState().filters.date).toBe('2026-05-28');
    expect(vi.mocked(window.api.listArchive)).toHaveBeenLastCalledWith({ date: '2026-05-28' });
  });

  it('loadList sem data passa filtro vazio à fonte', async () => {
    await useArchiveStore.getState().loadList();
    expect(vi.mocked(window.api.listArchive)).toHaveBeenLastCalledWith({});
  });

  it('setOperador e setLider só atualizam filtros (sem nova consulta)', () => {
    vi.mocked(window.api.listArchive).mockClear();
    useArchiveStore.getState().setOperador('joao');
    useArchiveStore.getState().setLider('Renan');
    expect(useArchiveStore.getState().filters.operador).toBe('joao');
    expect(useArchiveStore.getState().filters.lider).toBe('Renan');
    expect(vi.mocked(window.api.listArchive)).not.toHaveBeenCalled();
  });

  it('selectSprint e reset funcionam', () => {
    useArchiveStore.getState().selectSprint(ULID_A);
    expect(useArchiveStore.getState().selectedSprintId).toBe(ULID_A);
    useArchiveStore.getState().reset();
    expect(useArchiveStore.getState().selectedSprintId).toBeNull();
    expect(useArchiveStore.getState().filters.date).toBe('');
  });
});
