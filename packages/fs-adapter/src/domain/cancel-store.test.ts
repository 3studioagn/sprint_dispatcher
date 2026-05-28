import path from 'node:path';

import {
  ContractValidationError,
  generateSprintId,
  parseSprintCancel,
  parseSprintPayload,
  type SprintCancel,
  type SprintPayload,
} from '@sprint/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileNotFoundError, FilesystemError, FilesystemIOError } from '../errors';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { CancelStore } from './cancel-store';
import { PendingStore } from './pending-store';

const SHARED = '/shared';
const PENDING_DIR = path.posix.join(SHARED, 'pending');

function buildCancel(
  overrides: Partial<{
    sprint_id_ref: ReturnType<typeof generateSprintId>;
    cancelado_por: string;
    motivo: string;
  }> = {},
): SprintCancel {
  return parseSprintCancel({
    schema_version: '1.0',
    type: 'cancel',
    sprint_id_ref: overrides.sprint_id_ref ?? generateSprintId(),
    cancelado_por: overrides.cancelado_por ?? 'Renan',
    cancelado_em: new Date().toISOString(),
    motivo: overrides.motivo,
  });
}

function buildPayload(
  overrides: Partial<{
    sprint_id: ReturnType<typeof generateSprintId>;
    user_id: string;
    meta: number;
  }> = {},
): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: overrides.sprint_id ?? generateSprintId(),
    criado_por: 'Renan',
    criado_em: new Date().toISOString(),
    user_id: overrides.user_id ?? 'joao',
    title: 'Meta diária',
    body_html: '<p>Produzir 200</p>',
    meta: overrides.meta ?? 200,
    deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

describe('CancelStore.writeCancel — happy path (sem pendingStore)', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: CancelStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new CancelStore(adapter, SHARED);
  });

  it('escreve arquivo em /pending/cancel-<sprintId>.json', async () => {
    const sprintId = generateSprintId();
    const cancel = buildCancel({ sprint_id_ref: sprintId });

    const result = await store.writeCancel(cancel);

    expect(result.filename).toBe(`cancel-${sprintId}.json`);
    expect(result.filepath).toBe(`/shared/pending/cancel-${sprintId}.json`);
    await expect(adapter.exists(result.filepath)).resolves.toBe(true);
  });

  it('conteúdo gravado é JSON parseável com todos os campos do Anexo E', async () => {
    const sprintId = generateSprintId();
    const cancel = buildCancel({
      sprint_id_ref: sprintId,
      cancelado_por: 'Renan',
      motivo: 'Reset diário',
    });

    const { filepath } = await store.writeCancel(cancel);

    const raw = await adapter.readFile(filepath);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.schema_version).toBe('1.0');
    expect(parsed.type).toBe('cancel');
    expect(parsed.sprint_id_ref).toBe(sprintId);
    expect(parsed.cancelado_por).toBe('Renan');
    expect(parsed.motivo).toBe('Reset diário');
    expect(typeof parsed.cancelado_em).toBe('string');
  });

  it('omite motivo quando não informado (opcional)', async () => {
    const cancel = buildCancel();

    const { filepath } = await store.writeCancel(cancel);

    const parsed = JSON.parse(await adapter.readFile(filepath)) as { motivo?: unknown };
    expect(parsed.motivo).toBeUndefined();
  });

  it('JSON gravado é pretty-printed (2-space indent) para inspeção manual', async () => {
    const cancel = buildCancel();

    const { filepath } = await store.writeCancel(cancel);

    const raw = await adapter.readFile(filepath);
    expect(raw).toContain('\n');
    expect(raw).toMatch(/\n {2}"/);
  });

  it('chama mkdir(<sharedPath>/pending) antes de writeFileAtomic', async () => {
    const mkdirSpy = vi.spyOn(adapter, 'mkdir');
    const writeSpy = vi.spyOn(adapter, 'writeFileAtomic');

    await store.writeCancel(buildCancel());

    expect(mkdirSpy).toHaveBeenCalledWith('/shared/pending');
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const mkdirOrder = mkdirSpy.mock.invocationCallOrder[0];
    const writeOrder = writeSpy.mock.invocationCallOrder[0];
    expect(mkdirOrder).toBeDefined();
    expect(writeOrder).toBeDefined();
    expect(mkdirOrder!).toBeLessThan(writeOrder!);
  });

  it('aceita sharedPath com trailing slash', async () => {
    const storeWithSlash = new CancelStore(adapter, '/shared/');
    const sprintId = generateSprintId();
    const cancel = buildCancel({ sprint_id_ref: sprintId });

    const result = await storeWithSlash.writeCancel(cancel);

    expect(result.filepath).toBe(`/shared/pending/cancel-${sprintId}.json`);
  });

  it('sem pendingStore, removedOriginals é sempre []', async () => {
    const result = await store.writeCancel(buildCancel());

    expect(result.removedOriginals).toEqual([]);
  });
});

describe('CancelStore.writeCancel — defesa em profundidade', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: CancelStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new CancelStore(adapter, SHARED);
  });

  it('lança ContractValidationError em sprint_id_ref inválido (cast bypassed)', async () => {
    const bad = {
      ...buildCancel(),
      sprint_id_ref: 'NOT-A-VALID-ULID',
    } as unknown as SprintCancel;

    await expect(store.writeCancel(bad)).rejects.toBeInstanceOf(ContractValidationError);
  });

  it('lança ContractValidationError em type diferente de "cancel"', async () => {
    const bad = {
      ...buildCancel(),
      type: 'sprint',
    } as unknown as SprintCancel;

    await expect(store.writeCancel(bad)).rejects.toBeInstanceOf(ContractValidationError);
  });

  it('lança ContractValidationError em cancelado_por vazio', async () => {
    const bad: SprintCancel = {
      ...buildCancel(),
      cancelado_por: '',
    };

    await expect(store.writeCancel(bad)).rejects.toBeInstanceOf(ContractValidationError);
  });
});

describe('CancelStore.writeCancel — remoção de originais (com pendingStore)', () => {
  let adapter: MemoryFilesystemAdapter;
  let pendingStore: PendingStore;
  let cancelStore: CancelStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    pendingStore = new PendingStore(adapter, SHARED);
    cancelStore = new CancelStore(adapter, SHARED, pendingStore);
  });

  it('remove arquivos pending da sprint cancelada (mesmo sprint_id)', async () => {
    const sprintId = generateSprintId();
    const w1 = await pendingStore.writePendingSprint(
      buildPayload({ sprint_id: sprintId, user_id: 'joao' }),
    );
    const w2 = await pendingStore.writePendingSprint(
      buildPayload({ sprint_id: sprintId, user_id: 'maria' }),
    );

    const result = await cancelStore.writeCancel(buildCancel({ sprint_id_ref: sprintId }));

    expect(result.removedOriginals).toHaveLength(2);
    expect(result.removedOriginals).toContain(w1.filename);
    expect(result.removedOriginals).toContain(w2.filename);
    await expect(adapter.exists(w1.filepath)).resolves.toBe(false);
    await expect(adapter.exists(w2.filepath)).resolves.toBe(false);
  });

  it('preserva pendings de outras sprints (filtro por sprintId)', async () => {
    const targetSprint = generateSprintId();
    const otherSprint = generateSprintId();
    const targetWrite = await pendingStore.writePendingSprint(
      buildPayload({ sprint_id: targetSprint, user_id: 'joao' }),
    );
    const otherWrite = await pendingStore.writePendingSprint(
      buildPayload({ sprint_id: otherSprint, user_id: 'maria' }),
    );

    const result = await cancelStore.writeCancel(buildCancel({ sprint_id_ref: targetSprint }));

    expect(result.removedOriginals).toEqual([targetWrite.filename]);
    await expect(adapter.exists(targetWrite.filepath)).resolves.toBe(false);
    await expect(adapter.exists(otherWrite.filepath)).resolves.toBe(true);
  });

  it('removedOriginals vazio quando nenhum pending da sprint existe (Agent já processou)', async () => {
    const sprintId = generateSprintId();

    const result = await cancelStore.writeCancel(buildCancel({ sprint_id_ref: sprintId }));

    expect(result.removedOriginals).toEqual([]);
    await expect(adapter.exists(result.filepath)).resolves.toBe(true);
  });

  it('arquivo cancel recém-gravado não é deletado por si mesmo (kind cancel, não sprint)', async () => {
    const sprintId = generateSprintId();
    await pendingStore.writePendingSprint(buildPayload({ sprint_id: sprintId, user_id: 'joao' }));

    const result = await cancelStore.writeCancel(buildCancel({ sprint_id_ref: sprintId }));

    await expect(adapter.exists(result.filepath)).resolves.toBe(true);
    expect(result.removedOriginals).not.toContain(result.filename);
  });

  it('race: arquivo desaparece entre listPending e deletePending → skip silencioso', async () => {
    const sprintId = generateSprintId();
    const w1 = await pendingStore.writePendingSprint(
      buildPayload({ sprint_id: sprintId, user_id: 'joao' }),
    );
    const w2 = await pendingStore.writePendingSprint(
      buildPayload({ sprint_id: sprintId, user_id: 'maria' }),
    );

    // Simula Agent processando w1 entre o list e o delete: 1ª chamada de unlink
    // falha como race; 2ª passa.
    const realUnlink = adapter.unlink.bind(adapter);
    let call = 0;
    vi.spyOn(adapter, 'unlink').mockImplementation((filepath: string): Promise<void> => {
      call += 1;
      if (call === 1) return Promise.reject(new FileNotFoundError(filepath));
      return realUnlink(filepath);
    });

    const result = await cancelStore.writeCancel(buildCancel({ sprint_id_ref: sprintId }));

    // 1 efetivamente removido (o que não deu race). O cancel em si grava OK.
    expect(result.removedOriginals).toHaveLength(1);
    await expect(adapter.exists(result.filepath)).resolves.toBe(true);
    // w2 foi removido (real); w1 ficou (mas a race-simulação não restaurou —
    // o que importa é que writeCancel não levantou).
    const remaining = await adapter.listDir(PENDING_DIR).catch(() => [] as readonly string[]);
    expect(remaining).not.toContain(w2.filename);
    // w1 pode ou não estar listado — depende do path do filenamea — basta validar não-throw.
    void w1;
  });

  it('propaga FilesystemIOError não-FileNotFoundError em delete', async () => {
    const sprintId = generateSprintId();
    await pendingStore.writePendingSprint(buildPayload({ sprint_id: sprintId, user_id: 'joao' }));

    vi.spyOn(adapter, 'unlink').mockRejectedValueOnce(
      new FilesystemIOError('/x', 'permissão negada'),
    );

    await expect(
      cancelStore.writeCancel(buildCancel({ sprint_id_ref: sprintId })),
    ).rejects.toBeInstanceOf(FilesystemIOError);
  });
});

describe('CancelStore — hierarquia de erros (compat com testes legados)', () => {
  it('CancelStore continua exportando NotImplementedError do barrel? Não — implementado', () => {
    // Sanity check: o stub anterior lançava NotImplementedError. Agora não
    // lança mais nada no happy path. Mantém o teste para documentar que a
    // assinatura mudou de "sempre reject" para "resolve com WriteCancelResult".
    expect(typeof new CancelStore(new MemoryFilesystemAdapter(), '/x').writeCancel).toBe(
      'function',
    );
  });

  it('ContractValidationError em payload inválido NÃO é FilesystemError', async () => {
    const store = new CancelStore(new MemoryFilesystemAdapter(), SHARED);
    const bad = { ...buildCancel(), sprint_id_ref: 'BAD' } as unknown as SprintCancel;

    try {
      await store.writeCancel(bad);
      expect.fail('writeCancel deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ContractValidationError);
      expect(err).not.toBeInstanceOf(FilesystemError);
    }
  });
});

describe('CancelStore.writeCancel — overwrite', () => {
  it('overwrite do mesmo sprint_id_ref substitui conteúdo anterior (last-write-wins)', async () => {
    const adapter = new MemoryFilesystemAdapter();
    const store = new CancelStore(adapter, SHARED);
    const sprintId = generateSprintId();
    const c1 = buildCancel({ sprint_id_ref: sprintId, cancelado_por: 'Renan' });
    const c2 = buildCancel({
      sprint_id_ref: sprintId,
      cancelado_por: 'Otavio',
      motivo: 'Override',
    });

    const r1 = await store.writeCancel(c1);
    const r2 = await store.writeCancel(c2);

    expect(r1.filepath).toBe(r2.filepath);
    const final = JSON.parse(await adapter.readFile(r2.filepath)) as {
      cancelado_por: string;
      motivo?: string;
    };
    expect(final.cancelado_por).toBe('Otavio');
    expect(final.motivo).toBe('Override');
  });
});
