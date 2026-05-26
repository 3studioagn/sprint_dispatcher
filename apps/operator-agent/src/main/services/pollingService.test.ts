/**
 * Testes do PollingService — ciclo de detecção em `<shared>/pending/`.
 *
 * Estratégia:
 *
 * - `MemoryFilesystemAdapter` + `PendingStore` reais para os caminhos
 *   positivos (write sprints reais, listPending retorna entries reais).
 * - `vi.spyOn(pendingStore, 'listPending')` para casos de erro (throw)
 *   e para forçar `kind: 'cancel'` (que listPending filtra-out quando
 *   userId é passado — branch defensivo).
 * - `vi.useFakeTimers()` controla `setTimeout` do loop recursivo.
 *
 * Cobre os 9 cenários do prompt § Gate 3.
 */

import {
  buildPendingFilename,
  parseSprintCancel,
  parseSprintPayload,
  type SprintPayload,
} from '@sprint/contracts';
import { MemoryFilesystemAdapter, PendingStore, type PendingEntry } from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem } from '../../shared/types/queue';

import { HistoryService } from './historyService';
import { PollingService } from './pollingService';
import { QueueService } from './queueService';

const SHARED_PATH = '/test/shared';
const USER_ID = 'joao';
const POLLING_INTERVAL_MS = 3000;

const VALID_SPRINT_ID_1 = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const VALID_SPRINT_ID_2 = '01HXAAABBBCCCDDDEEEFFFGGGH';
const VALID_SPRINT_ID_3 = '01HXBBBCCCDDDEEEFFFGGGHHHJ';

interface TestKit {
  adapter: MemoryFilesystemAdapter;
  pendingStore: PendingStore;
  queueService: QueueService;
  historyService: HistoryService;
  pollingService: PollingService;
  log: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function makeKit(opts: { now?: Date } = {}): TestKit {
  const adapter = new MemoryFilesystemAdapter();
  const pendingStore = new PendingStore(adapter, SHARED_PATH);
  const queueService = new QueueService();
  const historyService = new HistoryService('/test/userData');
  const log: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } = {
    warn: vi.fn(),
    error: vi.fn(),
  };
  const fixedNow = opts.now ?? new Date('2026-05-26T10:00:00.000Z');
  // Passa como função literal (não Mock) — variance do `Mock<[], Date>` vs
  // a assinatura `() => Date` da PollingDeps quebra type-check estrito.
  // Nenhum teste atual precisa do callcount de `now`.
  const now: () => Date = () => fixedNow;
  const pollingService = new PollingService({
    pendingStore,
    queueService,
    historyService,
    userId: USER_ID,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    now,
    log,
  });
  return { adapter, pendingStore, queueService, historyService, pollingService, log };
}

function makePayload(
  opts: {
    sprintId?: string;
    userId?: string;
    deadlineIso?: string;
  } = {},
): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId ?? VALID_SPRINT_ID_1,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: opts.userId ?? USER_ID,
    title: 'Teste',
    body_html: 'corpo <b>tag</b>',
    meta: 5,
    deadline_at: opts.deadlineIso ?? '2026-05-26T21:00:00.000Z',
  });
}

describe('PollingService — ciclos positivos', () => {
  let kit: TestKit;

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('polling em pasta vazia: queue continua vazia', async () => {
    await kit.adapter.mkdir(`${SHARED_PATH}/pending`);
    await kit.pollingService.pollOnce();
    expect(kit.queueService.length()).toBe(0);
    expect(kit.log.error).not.toHaveBeenCalled();
  });

  it('1 sprint válida: enqueue + dispara nextSprint', async () => {
    const payload = makePayload();
    await kit.pendingStore.writePendingSprint(payload);

    const onNext = vi.fn<[QueueItem], void>();
    kit.queueService.onNextSprint(onNext);

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    const enqueued = onNext.mock.calls[0]?.[0];
    expect(enqueued?.payload.sprint_id).toBe(VALID_SPRINT_ID_1);
    expect(enqueued?.filename).toBe(buildPendingFilename(VALID_SPRINT_ID_1, USER_ID));
  });

  it('3 sprints no mesmo ciclo: queue cresce para 3', async () => {
    await kit.pendingStore.writePendingSprint(makePayload({ sprintId: VALID_SPRINT_ID_1 }));
    await kit.pendingStore.writePendingSprint(makePayload({ sprintId: VALID_SPRINT_ID_2 }));
    await kit.pendingStore.writePendingSprint(makePayload({ sprintId: VALID_SPRINT_ID_3 }));

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(3);
  });

  it('queue mantém ordem cronológica (modifiedAt asc)', async () => {
    const p1 = makePayload({ sprintId: VALID_SPRINT_ID_1 });
    const p2 = makePayload({ sprintId: VALID_SPRINT_ID_2 });

    // Controla `Date.now()` via fake timers para diferenciar modifiedAt
    // dos dois writes (MemoryAdapter usa `Date.now()` para stamp).
    vi.setSystemTime(new Date('2026-05-26T10:00:00.000Z'));
    await kit.pendingStore.writePendingSprint(p1);
    vi.setSystemTime(new Date('2026-05-26T10:00:00.010Z'));
    await kit.pendingStore.writePendingSprint(p2);

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(2);
    expect(kit.queueService.peek()?.payload.sprint_id).toBe(VALID_SPRINT_ID_1);
  });

  it('sprint de OUTRO operador NÃO é enfileirada (filter userId)', async () => {
    await kit.pendingStore.writePendingSprint(makePayload({ userId: 'maria' }));
    await kit.pollingService.pollOnce();
    expect(kit.queueService.length()).toBe(0);
  });
});

describe('PollingService — deadline passado', () => {
  let kit: TestKit;

  beforeEach(() => {
    kit = makeKit({ now: new Date('2026-05-26T22:00:00.000Z') });
    vi.useFakeTimers();
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('descarta sprint com deadline_at no passado + chama deletePending + markProcessed', async () => {
    const payload = makePayload({ deadlineIso: '2026-05-26T21:00:00.000Z' }); // 1h passado
    await kit.pendingStore.writePendingSprint(payload);
    const filename = buildPendingFilename(VALID_SPRINT_ID_1, USER_ID);

    const deleteSpy = vi.spyOn(kit.pendingStore, 'deletePending');

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(0);
    expect(kit.historyService.isAlreadyArchived(filename)).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith(filename);
    expect(kit.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('deadline passado'),
      expect.objectContaining({ filename }),
    );
  });

  it('falha em deletePending NÃO derruba o ciclo (apenas loga error)', async () => {
    const payload = makePayload({ deadlineIso: '2026-05-26T21:00:00.000Z' });
    await kit.pendingStore.writePendingSprint(payload);
    vi.spyOn(kit.pendingStore, 'deletePending').mockRejectedValueOnce(new Error('SMB caiu'));

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('deletar pending expirado'),
      expect.any(Object),
    );
  });

  it('aceita deadline_at exatamente agora como "passado" (<=)', async () => {
    const nowIso = '2026-05-26T22:00:00.000Z';
    const payload = makePayload({ deadlineIso: nowIso });
    await kit.pendingStore.writePendingSprint(payload);
    await kit.pollingService.pollOnce();
    expect(kit.queueService.length()).toBe(0);
  });

  it('deadline 1ms no futuro NÃO é descartado', async () => {
    const payload = makePayload({ deadlineIso: '2026-05-26T22:00:00.001Z' });
    await kit.pendingStore.writePendingSprint(payload);
    await kit.pollingService.pollOnce();
    expect(kit.queueService.length()).toBe(1);
  });
});

describe('PollingService — entries especiais', () => {
  let kit: TestKit;

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('arquivo malformado (kind: invalid): log warn, NÃO crash, continua', async () => {
    // Escreve JSON inválido com nome de arquivo válido (pending pattern)
    const filename = buildPendingFilename(VALID_SPRINT_ID_1, USER_ID);
    await kit.adapter.mkdir(`${SHARED_PATH}/pending`);
    await kit.adapter.writeFileAtomic(`${SHARED_PATH}/pending/${filename}`, '{ broken json');

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();
    expect(kit.queueService.length()).toBe(0);
    expect(kit.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('malformado'),
      expect.objectContaining({ filename }),
    );
  });

  it('cancel entry (branch defensivo): log warn + skip', async () => {
    // listPending com userId filtra cancels naturalmente. Para exercitar
    // o branch, mockamos um cancel entry direto. Schema do SprintCancel
    // confere com `sprintCancelSchema` (sprint_id_ref + cancelado_por +
    // cancelado_em + motivo opcional + discriminador `type: 'cancel'`).
    const cancelEntry: PendingEntry = {
      kind: 'cancel',
      filename: `cancel-${VALID_SPRINT_ID_1}.json`,
      modifiedAt: new Date('2026-05-26T10:00:00.000Z'),
      payload: parseSprintCancel({
        schema_version: '1.0',
        type: 'cancel',
        sprint_id_ref: VALID_SPRINT_ID_1,
        cancelado_por: 'Renan',
        cancelado_em: '2026-05-26T10:00:00.000Z',
        motivo: 'Mudança de prioridade',
      }),
    };
    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([cancelEntry]);

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(0);
    expect(kit.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('cancel'),
      expect.objectContaining({ filename: cancelEntry.filename }),
    );
  });

  it('sprint já em histórico: ignorada sem log de erro', async () => {
    const payload = makePayload();
    const filename = buildPendingFilename(payload.sprint_id, payload.user_id);
    await kit.pendingStore.writePendingSprint(payload);
    kit.historyService.markProcessed(filename);

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(0);
    expect(kit.log.error).not.toHaveBeenCalled();
  });

  it('dedup via queue: 2 polls do MESMO arquivo só enfileira 1 vez', async () => {
    const payload = makePayload();
    await kit.pendingStore.writePendingSprint(payload);

    await kit.pollingService.pollOnce();
    expect(kit.queueService.length()).toBe(1);
    await kit.pollingService.pollOnce();
    expect(kit.queueService.length()).toBe(1); // dedup via queueService
  });
});

describe('PollingService — resiliência', () => {
  let kit: TestKit;

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('listPending throw: log error + ciclo termina sem crash', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValueOnce(new Error('SMB down'));

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('polling'),
      expect.any(Object),
    );
  });

  it('listPending throw em um ciclo, próximo ciclo continua normalmente', async () => {
    const payload = makePayload();
    await kit.pendingStore.writePendingSprint(payload);

    const spy = vi
      .spyOn(kit.pendingStore, 'listPending')
      .mockRejectedValueOnce(new Error('SMB transient'));

    await kit.pollingService.pollOnce(); // throw caught
    expect(kit.queueService.length()).toBe(0);
    expect(kit.log.error).toHaveBeenCalledTimes(1);

    spy.mockRestore();

    await kit.pollingService.pollOnce(); // normal
    expect(kit.queueService.length()).toBe(1);
  });
});

describe('PollingService — loop com fake timers', () => {
  let kit: TestKit;

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('start() executa um pollOnce imediato', async () => {
    const payload = makePayload();
    await kit.pendingStore.writePendingSprint(payload);

    await kit.pollingService.start();

    expect(kit.queueService.length()).toBe(1);
  });

  it('start() agenda próximo ciclo após pollingIntervalMs', async () => {
    await kit.pollingService.start();
    expect(kit.queueService.length()).toBe(0);

    // Seed após o primeiro poll mas antes do segundo timer
    await kit.pendingStore.writePendingSprint(makePayload());

    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS);

    expect(kit.queueService.length()).toBe(1);
  });

  it('stop() cancela o próximo ciclo agendado', async () => {
    await kit.pollingService.start();
    kit.pollingService.stop();

    // Seed após stop — não deve ser processado
    await kit.pendingStore.writePendingSprint(makePayload());
    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS * 5);

    expect(kit.queueService.length()).toBe(0);
  });

  it('start() chamado duas vezes é idempotente', async () => {
    await kit.pollingService.start();
    await kit.pollingService.start(); // no-op
    await kit.pendingStore.writePendingSprint(makePayload());

    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS);

    expect(kit.queueService.length()).toBe(1);
  });

  it('múltiplos ciclos consecutivos detectam sprints sequenciais', async () => {
    await kit.pollingService.start();
    expect(kit.queueService.length()).toBe(0);

    await kit.pendingStore.writePendingSprint(makePayload({ sprintId: VALID_SPRINT_ID_1 }));
    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS);
    expect(kit.queueService.length()).toBe(1);

    await kit.pendingStore.writePendingSprint(makePayload({ sprintId: VALID_SPRINT_ID_2 }));
    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS);
    expect(kit.queueService.length()).toBe(2);
  });

  it('logger default (silent) não joga ao ser usado sem caller injection', async () => {
    const adapter = new MemoryFilesystemAdapter();
    const pendingStore = new PendingStore(adapter, SHARED_PATH);
    const service = new PollingService({
      pendingStore,
      queueService: new QueueService(),
      historyService: new HistoryService('/test'),
      userId: USER_ID,
      pollingIntervalMs: POLLING_INTERVAL_MS,
      // sem `log` — testa default SILENT_LOG
    });
    vi.spyOn(pendingStore, 'listPending').mockRejectedValueOnce(new Error('x'));
    await expect(service.pollOnce()).resolves.toBeUndefined();
  });
});
