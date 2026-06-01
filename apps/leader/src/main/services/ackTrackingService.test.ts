// @vitest-environment node
import { AckStore, MemoryFilesystemAdapter, type IFilesystemAdapter } from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AckTrackingService } from './ackTrackingService';
import { OperatorsService } from './operatorsService';

const SHARED = '/shared';
const OPERATORS_JSON = {
  operators: [
    { user_id: 'joao', user_nome_exibicao: 'João Silva', hostname: 'PC-04', ativo: true },
    { user_id: 'mario', user_nome_exibicao: 'Mario Souza', hostname: 'PC-05', ativo: true },
    { user_id: 'carlos', user_nome_exibicao: 'Carlos Pereira', hostname: 'PC-06', ativo: true },
  ],
};
const SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

function buildAckPayload(overrides: {
  user_id: string;
  displayed_at?: string;
  acknowledged_at?: string;
  hostname?: string;
}): Record<string, unknown> {
  return {
    schema_version: '1.0',
    sprint_id: SPRINT_ID,
    user_id: overrides.user_id,
    hostname: overrides.hostname ?? 'PC-04',
    displayed_at: overrides.displayed_at ?? '2026-05-28T14:00:00.000Z',
    ...(overrides.acknowledged_at !== undefined
      ? { acknowledged_at: overrides.acknowledged_at }
      : {}),
    agent_version: '0.1.0',
  };
}

async function seedAck(
  adapter: IFilesystemAdapter,
  payload: Record<string, unknown>,
): Promise<void> {
  await adapter.mkdir(`${SHARED}/acks`);
  await adapter.writeFileAtomic(
    `${SHARED}/acks/${payload.sprint_id as string}-${payload.user_id as string}.ack.json`,
    JSON.stringify(payload),
  );
}

let adapter: MemoryFilesystemAdapter;
let ackStore: AckStore;
let operatorsService: OperatorsService;
let service: AckTrackingService;

beforeEach(() => {
  adapter = new MemoryFilesystemAdapter();
  adapter.seed({ [`${SHARED}/operators.json`]: JSON.stringify(OPERATORS_JSON) });
  ackStore = new AckStore(adapter, SHARED);
  operatorsService = new OperatorsService(adapter, SHARED);
  service = new AckTrackingService(ackStore, operatorsService);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AckTrackingService.list', () => {
  it('todos os targets sem ack → state "nao_visto"', async () => {
    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }, { user_id: 'mario' }]);

    expect(result.targets).toHaveLength(2);
    expect(result.targets[0]?.state).toBe('nao_visto');
    expect(result.targets[0]?.user_nome_exibicao).toBe('João Silva');
    expect(result.targets[0]?.displayed_at).toBeUndefined();
    expect(result.targets[1]?.state).toBe('nao_visto');
  });

  it('ack com displayed_at apenas → state "visto"', async () => {
    await seedAck(
      adapter,
      buildAckPayload({ user_id: 'joao', displayed_at: '2026-05-28T14:00:00.000Z' }),
    );

    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }]);

    expect(result.targets[0]?.state).toBe('visto');
    expect(result.targets[0]?.displayed_at).toBe('2026-05-28T14:00:00.000Z');
    expect(result.targets[0]?.acknowledged_at).toBeUndefined();
  });

  it('ack com acknowledged_at → state "confirmado"', async () => {
    await seedAck(
      adapter,
      buildAckPayload({
        user_id: 'joao',
        displayed_at: '2026-05-28T14:00:00.000Z',
        acknowledged_at: '2026-05-28T14:00:05.000Z',
      }),
    );

    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }]);

    expect(result.targets[0]?.state).toBe('confirmado');
    expect(result.targets[0]?.acknowledged_at).toBe('2026-05-28T14:00:05.000Z');
  });

  it('mix de estados nos targets (nao_visto / visto / confirmado)', async () => {
    await seedAck(adapter, buildAckPayload({ user_id: 'joao' })); // visto
    await seedAck(
      adapter,
      buildAckPayload({
        user_id: 'mario',
        acknowledged_at: '2026-05-28T14:00:05.000Z',
      }),
    ); // confirmado

    const result = await service.list(SPRINT_ID, [
      { user_id: 'joao' },
      { user_id: 'mario' },
      { user_id: 'carlos' }, // nao_visto
    ]);

    expect(result.targets[0]?.state).toBe('visto');
    expect(result.targets[1]?.state).toBe('confirmado');
    expect(result.targets[2]?.state).toBe('nao_visto');
  });

  it('preserva ordem dos targets informados pelo caller', async () => {
    const result = await service.list(SPRINT_ID, [
      { user_id: 'carlos' },
      { user_id: 'joao' },
      { user_id: 'mario' },
    ]);

    expect(result.targets.map((t) => t.user_id)).toEqual(['carlos', 'joao', 'mario']);
  });

  it('ignora acks de OUTRAS sprints (filtro sprintId)', async () => {
    const OTHER_SPRINT = '01HX9K2M4F8N7P2Q5R3S6T7VYZ';
    await seedAck(adapter, {
      ...buildAckPayload({ user_id: 'joao' }),
      sprint_id: OTHER_SPRINT,
    });

    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }]);

    expect(result.targets[0]?.state).toBe('nao_visto');
  });

  it('hostname propaga para a view quando ack existe', async () => {
    await seedAck(adapter, buildAckPayload({ user_id: 'joao', hostname: 'PC-04-DEPLOY' }));

    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }]);

    expect(result.targets[0]?.hostname).toBe('PC-04-DEPLOY');
  });

  it('checked_at é ISO timestamp atual', async () => {
    const before = Date.now();
    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }]);
    const after = Date.now();

    const checkedMs = new Date(result.checked_at).getTime();
    expect(checkedMs).toBeGreaterThanOrEqual(before);
    expect(checkedMs).toBeLessThanOrEqual(after);
  });

  it('user_id sem entry em operators.json usa user_id como fallback de display', async () => {
    const result = await service.list(SPRINT_ID, [{ user_id: 'desconhecido' }]);
    expect(result.targets[0]?.user_nome_exibicao).toBe('desconhecido');
  });

  it('acks invalidos (RN-09) são ignorados, target fica "nao_visto"', async () => {
    await adapter.mkdir(`${SHARED}/acks`);
    await adapter.writeFileAtomic(`${SHARED}/acks/${SPRINT_ID}-joao.ack.json`, '{ malformed');

    const result = await service.list(SPRINT_ID, [{ user_id: 'joao' }]);

    expect(result.targets[0]?.state).toBe('nao_visto');
  });

  it('targets vazio retorna []', async () => {
    const result = await service.list(SPRINT_ID, []);
    expect(result.targets).toEqual([]);
  });

  it('propaga erro do operatorsService.list (config inválida)', async () => {
    vi.spyOn(operatorsService, 'list').mockRejectedValue(new Error('operators.json missing'));

    await expect(service.list(SPRINT_ID, [{ user_id: 'joao' }])).rejects.toThrow(
      'operators.json missing',
    );
  });
});
