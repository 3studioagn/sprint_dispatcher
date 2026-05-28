// @vitest-environment node
import { ContractValidationError, generateSprintId, parseSprintPayload } from '@sprint/contracts';
import { CancelStore, MemoryFilesystemAdapter, PendingStore } from '@sprint/fs-adapter';
import { beforeEach, describe, expect, it } from 'vitest';

import type { LeaderConfig } from '../config';

import { CancelService } from './cancelService';

const SHARED = '/shared';
const CONFIG: LeaderConfig = { shared_path: SHARED, criado_por: 'Renan' };

let adapter: MemoryFilesystemAdapter;
let pendingStore: PendingStore;
let cancelStore: CancelStore;
let service: CancelService;

beforeEach(() => {
  adapter = new MemoryFilesystemAdapter();
  pendingStore = new PendingStore(adapter, SHARED);
  cancelStore = new CancelStore(adapter, SHARED, pendingStore);
  service = new CancelService(cancelStore, CONFIG);
});

describe('CancelService.cancel', () => {
  it('grava cancel-<sprintId>.json em pending/ com schema Anexo E', async () => {
    const sprintId = generateSprintId();

    const result = await service.cancel({ sprint_id: sprintId });

    expect(result.filename).toBe(`cancel-${sprintId}.json`);
    const raw = await adapter.readFile(`${SHARED}/pending/${result.filename}`);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.schema_version).toBe('1.0');
    expect(parsed.type).toBe('cancel');
    expect(parsed.sprint_id_ref).toBe(sprintId);
    expect(parsed.cancelado_por).toBe('Renan');
    expect(typeof parsed.cancelado_em).toBe('string');
    expect(parsed.motivo).toBeUndefined();
  });

  it('inclui motivo quando informado', async () => {
    const sprintId = generateSprintId();

    await service.cancel({ sprint_id: sprintId, motivo: 'Reset diário' });

    const raw = await adapter.readFile(`${SHARED}/pending/cancel-${sprintId}.json`);
    const parsed = JSON.parse(raw) as { motivo?: string };
    expect(parsed.motivo).toBe('Reset diário');
  });

  it('motivo whitespace-only é tratado como ausente (omite do payload)', async () => {
    const sprintId = generateSprintId();

    await service.cancel({ sprint_id: sprintId, motivo: '   ' });

    const raw = await adapter.readFile(`${SHARED}/pending/cancel-${sprintId}.json`);
    const parsed = JSON.parse(raw) as { motivo?: string };
    expect(parsed.motivo).toBeUndefined();
  });

  it('motivo é trimmed antes de gravar', async () => {
    const sprintId = generateSprintId();

    await service.cancel({ sprint_id: sprintId, motivo: '  Motivo com espaços  ' });

    const raw = await adapter.readFile(`${SHARED}/pending/cancel-${sprintId}.json`);
    const parsed = JSON.parse(raw) as { motivo?: string };
    expect(parsed.motivo).toBe('Motivo com espaços');
  });

  it('remove arquivos pending originais da sprint cancelada', async () => {
    const sprintId = generateSprintId();
    const payload = parseSprintPayload({
      schema_version: '1.0',
      sprint_id: sprintId,
      criado_por: 'Renan',
      criado_em: new Date().toISOString(),
      user_id: 'joao',
      title: 'Meta',
      body_html: '<p>Conteúdo</p>',
      meta: 10,
      deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const original = await pendingStore.writePendingSprint(payload);

    const result = await service.cancel({ sprint_id: sprintId });

    expect(result.removed_originals).toEqual([original.filename]);
    await expect(adapter.exists(original.filepath)).resolves.toBe(false);
  });

  it('lança ContractValidationError em sprint_id inválido (não-ULID)', async () => {
    await expect(service.cancel({ sprint_id: 'NOT-A-ULID' })).rejects.toBeInstanceOf(
      ContractValidationError,
    );
  });

  it('cancelado_por usa config.criado_por do líder', async () => {
    const localService = new CancelService(cancelStore, {
      shared_path: SHARED,
      criado_por: 'Otavio',
    });
    const sprintId = generateSprintId();

    await localService.cancel({ sprint_id: sprintId });

    const raw = await adapter.readFile(`${SHARED}/pending/cancel-${sprintId}.json`);
    const parsed = JSON.parse(raw) as { cancelado_por: string };
    expect(parsed.cancelado_por).toBe('Otavio');
  });

  it('cancelado_em é ISO timestamp próximo ao momento da chamada', async () => {
    const sprintId = generateSprintId();
    const before = Date.now();

    await service.cancel({ sprint_id: sprintId });

    const after = Date.now();
    const raw = await adapter.readFile(`${SHARED}/pending/cancel-${sprintId}.json`);
    const parsed = JSON.parse(raw) as { cancelado_em: string };
    const canceledMs = new Date(parsed.cancelado_em).getTime();
    expect(canceledMs).toBeGreaterThanOrEqual(before);
    expect(canceledMs).toBeLessThanOrEqual(after);
  });
});
