// @vitest-environment node
/**
 * Testes do ArchiveService (BL-C2-010) — leitura do histórico compartilhado.
 *
 * Usa MemoryFilesystemAdapter + ArchiveStore reais (paridade garantida pela
 * contract suite do C4). Seeda `arquivo/<data>/` diretamente e exercita o
 * enriquecimento (payload + estado de ack + nome de exibição), o filtro de
 * data na fonte, a robustez a arquivos corrompidos e o `read`.
 */
import { ArchiveStore, MemoryFilesystemAdapter } from '@sprint/fs-adapter';
import { beforeEach, describe, expect, it } from 'vitest';

import { ArchiveService } from './archiveService';
import { OperatorsService } from './operatorsService';

const SHARED = '/shared';
const ULID_A = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const ULID_B = '01J0ABCDEF1234567890ABCDEF';

const OPERATORS_JSON = {
  operators: [
    { user_id: 'joao', user_nome_exibicao: 'João Silva', hostname: 'PC-04', ativo: true },
    { user_id: 'maria', user_nome_exibicao: 'Maria Souza', hostname: 'PC-05', ativo: true },
  ],
};

interface SprintOpts {
  criado_por?: string;
  criado_em?: string;
  title?: string;
  meta?: number;
  deadline_at?: string;
  body_html?: string;
}

interface AckOpts {
  displayed_at?: string;
  acknowledged_at?: string;
  hostname?: string;
}

function seedSprint(
  adapter: MemoryFilesystemAdapter,
  date: string,
  sprintId: string,
  userId: string,
  opts: SprintOpts = {},
): void {
  const payload = {
    schema_version: '1.0',
    sprint_id: sprintId,
    criado_por: opts.criado_por ?? 'Renan',
    criado_em: opts.criado_em ?? '2026-05-28T13:00:00.000Z',
    user_id: userId,
    title: opts.title ?? 'É hora de correr',
    body_html: opts.body_html ?? 'Meta: <b>5 artes</b>',
    meta: opts.meta ?? 5,
    deadline_at: opts.deadline_at ?? '2026-05-28T21:00:00.000Z',
    show_duration_seconds: 5,
    persistent_popup: true,
  };
  adapter.seed({
    [`${SHARED}/arquivo/${date}/${sprintId}-${userId}.json`]: JSON.stringify(payload),
  });
}

function seedAck(
  adapter: MemoryFilesystemAdapter,
  date: string,
  sprintId: string,
  userId: string,
  opts: AckOpts = {},
): void {
  const ack = {
    schema_version: '1.0',
    sprint_id: sprintId,
    user_id: userId,
    hostname: opts.hostname ?? 'PC-04',
    displayed_at: opts.displayed_at ?? '2026-05-28T13:30:00.000Z',
    ...(opts.acknowledged_at !== undefined ? { acknowledged_at: opts.acknowledged_at } : {}),
    agent_version: '0.1.0',
  };
  adapter.seed({
    [`${SHARED}/arquivo/${date}/${sprintId}-${userId}.ack.json`]: JSON.stringify(ack),
  });
}

function makeService(adapter: MemoryFilesystemAdapter): ArchiveService {
  return new ArchiveService(
    new ArchiveStore(adapter, SHARED),
    new OperatorsService(adapter, SHARED),
  );
}

describe('ArchiveService.list', () => {
  let adapter: MemoryFilesystemAdapter;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    adapter.seed({ [`${SHARED}/operators.json`]: JSON.stringify(OPERATORS_JSON) });
  });

  it('retorna lista vazia quando arquivo/ não existe', async () => {
    const result = await makeService(adapter).list({});
    expect(result.items).toEqual([]);
    expect(result.checked_at).toBeTypeOf('string');
  });

  it('enriquece cada item com payload + nome de exibição', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao', {
      title: 'Rush!',
      meta: 8,
      criado_por: 'Renan',
    });

    const result = await makeService(adapter).list({});

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item).toMatchObject({
      date: '2026-05-28',
      sprint_id: ULID_A,
      user_id: 'joao',
      user_nome_exibicao: 'João Silva',
      title: 'Rush!',
      criado_por: 'Renan',
      meta: 8,
      state: 'nao_visto',
    });
    expect(item?.displayed_at).toBeUndefined();
  });

  it('deriva estado "visto" quando há ack sem acknowledged_at', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao');
    seedAck(adapter, '2026-05-28', ULID_A, 'joao', { displayed_at: '2026-05-28T13:31:00.000Z' });

    const [item] = (await makeService(adapter).list({})).items;

    expect(item?.state).toBe('visto');
    expect(item?.displayed_at).toBe('2026-05-28T13:31:00.000Z');
    expect(item?.acknowledged_at).toBeUndefined();
    expect(item?.hostname).toBe('PC-04');
  });

  it('deriva estado "confirmado" quando há acknowledged_at', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'maria');
    seedAck(adapter, '2026-05-28', ULID_A, 'maria', {
      displayed_at: '2026-05-28T13:31:00.000Z',
      acknowledged_at: '2026-05-28T13:32:00.000Z',
    });

    const [item] = (await makeService(adapter).list({})).items;

    expect(item?.state).toBe('confirmado');
    expect(item?.acknowledged_at).toBe('2026-05-28T13:32:00.000Z');
  });

  it('retorna um item por par (sprint_id, user_id) da mesma rodada', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao');
    seedSprint(adapter, '2026-05-28', ULID_A, 'maria');

    const result = await makeService(adapter).list({});

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.user_id).sort()).toEqual(['joao', 'maria']);
    expect(new Set(result.items.map((i) => i.sprint_id))).toEqual(new Set([ULID_A]));
  });

  it('filtra por data na fonte', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao');
    seedSprint(adapter, '2026-05-29', ULID_B, 'maria');

    const result = await makeService(adapter).list({ date: '2026-05-29' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.date).toBe('2026-05-29');
    expect(result.items[0]?.user_id).toBe('maria');
  });

  it('cai para user_id quando operators.json está ausente', async () => {
    const bare = new MemoryFilesystemAdapter();
    seedSprint(bare, '2026-05-28', ULID_A, 'joao');

    const [item] = (await makeService(bare).list({})).items;

    expect(item?.user_nome_exibicao).toBe('joao');
  });

  it('pula sprints arquivadas corrompidas sem derrubar a lista', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao');
    adapter.seed({ [`${SHARED}/arquivo/2026-05-28/${ULID_B}-maria.json`]: '{ json quebrado' });

    const result = await makeService(adapter).list({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sprint_id).toBe(ULID_A);
  });
});

describe('ArchiveService.read', () => {
  let adapter: MemoryFilesystemAdapter;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    adapter.seed({ [`${SHARED}/operators.json`]: JSON.stringify(OPERATORS_JSON) });
  });

  it('devolve payload + ack quando ambos existem', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao', { body_html: 'Meta: <b>9</b>' });
    seedAck(adapter, '2026-05-28', ULID_A, 'joao', {
      acknowledged_at: '2026-05-28T13:40:00.000Z',
    });

    const result = await makeService(adapter).read({
      date: '2026-05-28',
      sprint_id: ULID_A,
      user_id: 'joao',
    });

    expect(result.payload.body_html).toBe('Meta: <b>9</b>');
    expect(result.ack?.acknowledged_at).toBe('2026-05-28T13:40:00.000Z');
  });

  it('devolve só o payload quando não há ack', async () => {
    seedSprint(adapter, '2026-05-28', ULID_A, 'joao');

    const result = await makeService(adapter).read({
      date: '2026-05-28',
      sprint_id: ULID_A,
      user_id: 'joao',
    });

    expect(result.payload.sprint_id).toBe(ULID_A);
    expect(result.ack).toBeUndefined();
  });

  it('propaga erro quando a sprint arquivada não existe', async () => {
    await expect(
      makeService(adapter).read({ date: '2026-05-28', sprint_id: ULID_A, user_id: 'joao' }),
    ).rejects.toThrow();
  });
});
