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
import {
  DirectoryNotFoundError,
  FilesystemIOError,
  MemoryFilesystemAdapter,
  PendingStore,
  type PendingEntry,
} from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import type { QueueItem } from '../../shared/types/queue';

import type { ConnectionStatus } from './connectivity';
import { HistoryService } from './historyService';
import { PollingService, type PollingDeps } from './pollingService';
import { QueueService } from './queueService';

/** Constrói um ErrnoException cru com `code` — espelha o que `fs` lança. */
function errno(code: string): NodeJS.ErrnoException {
  const e = new Error(`boom ${code}`) as NodeJS.ErrnoException;
  e.code = code;
  return e;
}

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
  log: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  /** Eventos de transição de conexão capturados (BL-C3-013). */
  connectionEvents: ConnectionStatus[];
}

function makeKit(opts: { now?: Date } = {}): TestKit {
  const adapter = new MemoryFilesystemAdapter();
  const pendingStore = new PendingStore(adapter, SHARED_PATH);
  const queueService = new QueueService();
  const historyService = new HistoryService('/test/userData');
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const fixedNow = opts.now ?? new Date('2026-05-26T10:00:00.000Z');
  // Passa como função literal (não Mock) — variance do `Mock<[], Date>` vs
  // a assinatura `() => Date` da PollingDeps quebra type-check estrito.
  // Nenhum teste atual precisa do callcount de `now`.
  const now: () => Date = () => fixedNow;
  const connectionEvents: ConnectionStatus[] = [];
  const pollingService = new PollingService({
    pendingStore,
    adapter,
    sharedPath: SHARED_PATH,
    queueService,
    historyService,
    userId: USER_ID,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    now,
    // RNG fixo no meio → fator de jitter 1.0 (atrasos = agenda base exata).
    rng: () => 0.5,
    onConnectionChange: (status) => connectionEvents.push(status),
    log,
  });
  return {
    adapter,
    pendingStore,
    queueService,
    historyService,
    pollingService,
    log,
    connectionEvents,
  };
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

describe('PollingService — deadline passado (BL-C3-012)', () => {
  let kit: TestKit;
  let archiveSpy: MockInstance<
    Parameters<HistoryService['archive']>,
    ReturnType<HistoryService['archive']>
  >;

  beforeEach(() => {
    kit = makeKit({ now: new Date('2026-05-26T22:00:00.000Z') });
    vi.useFakeTimers();
    // archive() escreveria em disk via fs/promises (HistoryService usa
    // fs nativo, não o adapter). Mock evita poluir /test/userData e
    // simula o efeito do cache update. Cobertura real de archive() está
    // em historyService.test.ts.
    archiveSpy = vi.spyOn(kit.historyService, 'archive');
    archiveSpy.mockImplementation((_payload, filename, _rawContent) => {
      kit.historyService.markProcessed(filename);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('descarta sprint com deadline_at no passado + chama deletePending + archive', async () => {
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

  it('move arquivo para histórico local via archive (BL-C3-012 AC)', async () => {
    const payload = makePayload({ deadlineIso: '2026-05-26T21:00:00.000Z' });
    await kit.pendingStore.writePendingSprint(payload);
    const filename = buildPendingFilename(VALID_SPRINT_ID_1, USER_ID);

    await kit.pollingService.pollOnce();

    // archive deve ser chamado com payload + filename + rawContent pretty-printed
    expect(archiveSpy).toHaveBeenCalledTimes(1);
    expect(archiveSpy).toHaveBeenCalledWith(
      payload,
      filename,
      expect.stringContaining(`"sprint_id": "${VALID_SPRINT_ID_1}"`),
    );
  });

  it('falha em archive NÃO derruba o ciclo: fallback markProcessed + log error', async () => {
    const payload = makePayload({ deadlineIso: '2026-05-26T21:00:00.000Z' });
    await kit.pendingStore.writePendingSprint(payload);
    const filename = buildPendingFilename(VALID_SPRINT_ID_1, USER_ID);
    archiveSpy.mockRejectedValueOnce(new Error('disco cheio'));

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();

    // Fallback: cache ainda foi populado via markProcessed
    expect(kit.historyService.isAlreadyArchived(filename)).toBe(true);
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('arquivar sprint expirada'),
      expect.any(Object),
    );
  });

  it('NÃO grava ack de visualização para sprint expirada (BL-C3-012 AC)', async () => {
    // Sprint expirada nunca é enfileirada → onNextSprint nunca dispara →
    // ackService.writeDisplayed (wired via main/index.ts) nunca é chamado.
    // Aqui validamos a precondição: queue não recebe a sprint.
    const payload = makePayload({ deadlineIso: '2026-05-26T21:00:00.000Z' });
    await kit.pendingStore.writePendingSprint(payload);

    const onNext = vi.fn();
    kit.queueService.onNextSprint(onNext);

    await kit.pollingService.pollOnce();

    expect(onNext).not.toHaveBeenCalled();
    expect(kit.queueService.length()).toBe(0);
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
  let archiveSpy: MockInstance<
    Parameters<HistoryService['archive']>,
    ReturnType<HistoryService['archive']>
  >;

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
    // Mock archive para evitar disk write em /test/userData (BL-C3-011
    // adicionou archive() em processCancel). Cobertura real está em
    // historyService.test.ts.
    archiveSpy = vi.spyOn(kit.historyService, 'archive');
    archiveSpy.mockImplementation((_p, filename) => {
      kit.historyService.markProcessed(filename);
      return Promise.resolve();
    });
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

describe('PollingService — detecção de cancelamento (BL-C3-011)', () => {
  let kit: TestKit;
  let archiveSpy: MockInstance<
    Parameters<HistoryService['archive']>,
    ReturnType<HistoryService['archive']>
  >;
  let mockOverlayService: {
    getCurrentEvent: ReturnType<
      typeof vi.fn<[], { sprint: SprintPayload; queueLength: number } | null>
    >;
    hide: ReturnType<typeof vi.fn>;
    showSprint: ReturnType<typeof vi.fn>;
  };

  function makeCancelEntry(sprintId: string): PendingEntry {
    return {
      kind: 'cancel',
      filename: `cancel-${sprintId}.json`,
      modifiedAt: new Date('2026-05-26T10:00:00.000Z'),
      payload: parseSprintCancel({
        schema_version: '1.0',
        type: 'cancel',
        sprint_id_ref: sprintId,
        cancelado_por: 'Renan',
        cancelado_em: '2026-05-26T10:00:00.000Z',
        motivo: 'Mudança de prioridade',
      }),
    };
  }

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
    archiveSpy = vi.spyOn(kit.historyService, 'archive');
    archiveSpy.mockImplementation((_p, filename) => {
      kit.historyService.markProcessed(filename);
      return Promise.resolve();
    });
    mockOverlayService = {
      getCurrentEvent: vi.fn<[], { sprint: SprintPayload; queueLength: number } | null>(() => null),
      hide: vi.fn(),
      showSprint: vi.fn(),
    };
    // Recria pollingService com overlayService injetado.
    const ps = new PollingService({
      pendingStore: kit.pendingStore,
      adapter: kit.adapter,
      sharedPath: SHARED_PATH,
      queueService: kit.queueService,
      historyService: kit.historyService,
      overlayService: mockOverlayService as unknown as NonNullable<PollingDeps['overlayService']>,
      userId: USER_ID,
      pollingIntervalMs: POLLING_INTERVAL_MS,
      now: () => new Date('2026-05-26T10:00:00.000Z'),
      log: kit.log,
    });
    kit.pollingService = ps;
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('cancel para sprint na fila (não exibida): removeBySprintId + archive + delete', async () => {
    // Sprint enfileirada (não exibida — overlay.getCurrentEvent retorna null)
    const sprintPayload = makePayload({ sprintId: VALID_SPRINT_ID_1 });
    kit.queueService.enqueue({
      payload: sprintPayload,
      filename: `${VALID_SPRINT_ID_1}-${USER_ID}.json`,
      rawContent: JSON.stringify(sprintPayload, null, 2),
    });
    expect(kit.queueService.length()).toBe(1);

    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);
    const deleteSpy = vi.spyOn(kit.pendingStore, 'deletePending');

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(0);
    expect(mockOverlayService.hide).not.toHaveBeenCalled(); // não estava exibida
    expect(archiveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sprint_id_ref: VALID_SPRINT_ID_1 }),
      `cancel-${VALID_SPRINT_ID_1}.json`,
      expect.any(String),
    );
    expect(deleteSpy).toHaveBeenCalledWith(`cancel-${VALID_SPRINT_ID_1}.json`);
  });

  it('cancel para sprint EXIBIDA no overlay: hide + remove fila (sem ack)', async () => {
    // Sprint exibida (overlay.getCurrentEvent retorna ela)
    const sprintPayload = makePayload({ sprintId: VALID_SPRINT_ID_1 });
    kit.queueService.enqueue({
      payload: sprintPayload,
      filename: `${VALID_SPRINT_ID_1}-${USER_ID}.json`,
      rawContent: JSON.stringify(sprintPayload, null, 2),
    });
    mockOverlayService.getCurrentEvent.mockReturnValue({
      sprint: sprintPayload,
      queueLength: 1,
    });

    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(0);
    expect(mockOverlayService.hide).toHaveBeenCalledTimes(1);
  });

  it('cancel para sprint exibida COM próxima na fila: hide + showSprint da próxima', async () => {
    const sprintA = makePayload({ sprintId: VALID_SPRINT_ID_1 });
    const sprintB = makePayload({ sprintId: VALID_SPRINT_ID_2 });
    kit.queueService.enqueue({
      payload: sprintA,
      filename: `${VALID_SPRINT_ID_1}-${USER_ID}.json`,
      rawContent: JSON.stringify(sprintA, null, 2),
    });
    kit.queueService.enqueue({
      payload: sprintB,
      filename: `${VALID_SPRINT_ID_2}-${USER_ID}.json`,
      rawContent: JSON.stringify(sprintB, null, 2),
    });
    mockOverlayService.getCurrentEvent.mockReturnValue({
      sprint: sprintA,
      queueLength: 2,
    });

    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(1);
    expect(mockOverlayService.hide).toHaveBeenCalledTimes(1);
    expect(mockOverlayService.showSprint).toHaveBeenCalledTimes(1);
    // Inspeção direta evita unsafe-assignment do nested objectContaining
    const [showSprintArg, queueLengthArg] = mockOverlayService.showSprint.mock.calls[0] as [
      { payload: { sprint_id: string } },
      number,
    ];
    expect(showSprintArg.payload.sprint_id).toBe(VALID_SPRINT_ID_2);
    expect(queueLengthArg).toBe(1);
  });

  it('cancel da sprint exibida promove a próxima COM ack inicial displayed_at [AUD-W2-003]', async () => {
    // Regressão: antes, processCancel promovia a próxima via showSprint direto,
    // sem gravar displayed_at — o líder via a sprint promovida como `nao_visto`
    // permanentemente. Agora o ackService.writeDisplayed é chamado p/ a próxima.
    const sprintA = makePayload({ sprintId: VALID_SPRINT_ID_1 });
    const sprintB = makePayload({ sprintId: VALID_SPRINT_ID_2 });
    kit.queueService.enqueue({
      payload: sprintA,
      filename: `${VALID_SPRINT_ID_1}-${USER_ID}.json`,
      rawContent: JSON.stringify(sprintA, null, 2),
    });
    kit.queueService.enqueue({
      payload: sprintB,
      filename: `${VALID_SPRINT_ID_2}-${USER_ID}.json`,
      rawContent: JSON.stringify(sprintB, null, 2),
    });
    mockOverlayService.getCurrentEvent.mockReturnValue({ sprint: sprintA, queueLength: 2 });

    const writeDisplayed = vi.fn<[SprintPayload], Promise<string | null>>(() =>
      Promise.resolve('2026-05-26T10:00:00.000Z'),
    );
    const ps = new PollingService({
      pendingStore: kit.pendingStore,
      adapter: kit.adapter,
      sharedPath: SHARED_PATH,
      queueService: kit.queueService,
      historyService: kit.historyService,
      overlayService: mockOverlayService as unknown as NonNullable<PollingDeps['overlayService']>,
      ackService: { writeDisplayed } as unknown as NonNullable<PollingDeps['ackService']>,
      userId: USER_ID,
      pollingIntervalMs: POLLING_INTERVAL_MS,
      now: () => new Date('2026-05-26T10:00:00.000Z'),
      log: kit.log,
    });

    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);

    await ps.pollOnce();

    // A próxima (B) foi promovida ao overlay E recebeu o ack inicial displayed_at.
    expect(mockOverlayService.showSprint).toHaveBeenCalledTimes(1);
    expect(writeDisplayed).toHaveBeenCalledTimes(1);
    const [ackedPayload] = writeDisplayed.mock.calls[0] as [{ sprint_id: string }];
    expect(ackedPayload.sprint_id).toBe(VALID_SPRINT_ID_2);
  });

  it('cancel para sprint INEXISTENTE (já ackeada/expirada): archive + delete, sem touch fila/overlay', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_3),
    ]);
    const deleteSpy = vi.spyOn(kit.pendingStore, 'deletePending');

    await kit.pollingService.pollOnce();

    expect(kit.queueService.length()).toBe(0);
    expect(mockOverlayService.hide).not.toHaveBeenCalled();
    expect(mockOverlayService.showSprint).not.toHaveBeenCalled();
    expect(archiveSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith(`cancel-${VALID_SPRINT_ID_3}.json`);
  });

  it('cancel já processado (dedup via historyService): skip silencioso', async () => {
    kit.historyService.markProcessed(`cancel-${VALID_SPRINT_ID_1}.json`);
    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);
    const deleteSpy = vi.spyOn(kit.pendingStore, 'deletePending');

    await kit.pollingService.pollOnce();

    expect(archiveSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('falha em archive: fallback markProcessed + log error + ciclo continua', async () => {
    archiveSpy.mockRejectedValueOnce(new Error('disco cheio'));
    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();

    expect(kit.historyService.isAlreadyArchived(`cancel-${VALID_SPRINT_ID_1}.json`)).toBe(true);
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('arquivar cancel'),
      expect.any(Object),
    );
  });

  it('falha em deletePending de cancel: log error + ciclo continua', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);
    vi.spyOn(kit.pendingStore, 'deletePending').mockRejectedValueOnce(new Error('SMB caiu'));

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('deletar cancel'),
      expect.any(Object),
    );
  });

  it('cancel sem overlayService injetado (cenário de teste): processCancel não crash', async () => {
    // Reproduz cenário sem overlayService — branches defensivos.
    const psSemOverlay = new PollingService({
      pendingStore: kit.pendingStore,
      adapter: kit.adapter,
      sharedPath: SHARED_PATH,
      queueService: kit.queueService,
      historyService: kit.historyService,
      // overlayService omitido (?:)
      userId: USER_ID,
      pollingIntervalMs: POLLING_INTERVAL_MS,
      now: () => new Date('2026-05-26T10:00:00.000Z'),
      log: kit.log,
    });
    vi.spyOn(kit.pendingStore, 'listPending').mockResolvedValueOnce([
      makeCancelEntry(VALID_SPRINT_ID_1),
    ]);

    await expect(psSemOverlay.pollOnce()).resolves.toBeUndefined();
    expect(archiveSpy).toHaveBeenCalled();
  });

  it('lista pending sem filter userId — cancels NÃO são filtrados pelo store', async () => {
    // BL-C3-011 mudou listPending para SEM filter — verificamos que
    // o pollingService consegue ver cancels broadcast deixados no shared.
    await kit.adapter.mkdir(`${SHARED_PATH}/pending`);
    const cancelFile = `cancel-${VALID_SPRINT_ID_1}.json`;
    await kit.adapter.writeFileAtomic(
      `${SHARED_PATH}/pending/${cancelFile}`,
      JSON.stringify({
        schema_version: '1.0',
        type: 'cancel',
        sprint_id_ref: VALID_SPRINT_ID_1,
        cancelado_por: 'Renan',
        cancelado_em: '2026-05-26T10:00:00.000Z',
      }),
    );

    await kit.pollingService.pollOnce();

    expect(archiveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sprint_id_ref: VALID_SPRINT_ID_1 }),
      cancelFile,
      expect.any(String),
    );
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

  beforeEach(async () => {
    kit = makeKit();
    // Marca a raiz do share como existente (em produção `shared_path` é um
    // diretório real do servidor). Sem isso o MemoryAdapter trata a pasta
    // vazia como inexistente (G-019) e o 1º ciclo viraria "desconectado",
    // mudando o agendamento de pollingIntervalMs para o backoff — estes
    // testes exercitam a cadência NORMAL. O `.keep` é ignorado pelo
    // listPending (safeParseFilename não casa o padrão de sprint).
    await kit.adapter.writeFileAtomic(`${SHARED_PATH}/pending/.keep`, '');
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
      adapter,
      sharedPath: SHARED_PATH,
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

describe('PollingService — reconexão com backoff (BL-C3-013)', () => {
  let kit: TestKit;

  /** Erro de conectividade espelhando o que o C4 lança em queda de SMB. */
  function connErr(code = 'ETIMEDOUT'): FilesystemIOError {
    return new FilesystemIOError(`${SHARED_PATH}/pending`, `falha ${code}`, errno(code));
  }

  beforeEach(() => {
    kit = makeKit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    kit.pollingService.stop();
    vi.useRealTimers();
  });

  it('erro de conectividade → desconectado + onConnectionChange(offline) + warn', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValueOnce(connErr());

    await kit.pollingService.pollOnce();

    expect(kit.pollingService.getConnection().online).toBe(false);
    expect(kit.connectionEvents.at(-1)?.online).toBe(false);
    expect(kit.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('conexão com a pasta compartilhada perdida'),
      expect.any(Object),
    );
  });

  it('DirectoryNotFound + raiz do share acessível → conectado (pending/ ainda não criada)', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValueOnce(
      new DirectoryNotFoundError(`${SHARED_PATH}/pending`, errno('ENOENT')),
    );
    const existsSpy = vi.spyOn(kit.adapter, 'exists').mockResolvedValue(true);

    await kit.pollingService.pollOnce();

    expect(existsSpy).toHaveBeenCalledWith(SHARED_PATH);
    expect(kit.pollingService.getConnection().online).toBe(true);
    expect(kit.log.warn).not.toHaveBeenCalled();
  });

  it('DirectoryNotFound + raiz do share inacessível → desconectado', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValueOnce(
      new DirectoryNotFoundError(`${SHARED_PATH}/pending`, errno('ENOENT')),
    );
    vi.spyOn(kit.adapter, 'exists').mockResolvedValue(false);

    await kit.pollingService.pollOnce();

    expect(kit.pollingService.getConnection().online).toBe(false);
    expect(kit.connectionEvents.at(-1)?.online).toBe(false);
  });

  it('erro NÃO-conectividade (EACCES) → NÃO desconecta (loga error, mantém estado)', async () => {
    // Conecta primeiro — `.keep` faz a raiz do share existir e o listPending
    // retornar [] (no Memory, dir vazio = inexistente, G-019).
    await kit.adapter.writeFileAtomic(`${SHARED_PATH}/pending/.keep`, '');
    await kit.pollingService.pollOnce();
    expect(kit.pollingService.getConnection().online).toBe(true);
    const eventsBefore = kit.connectionEvents.length;

    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValueOnce(connErr('EACCES'));
    await kit.pollingService.pollOnce();

    // EACCES não é conectividade — permanece online, sem novo evento de conexão.
    expect(kit.pollingService.getConnection().online).toBe(true);
    expect(kit.connectionEvents.length).toBe(eventsBefore);
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('não-conectividade'),
      expect.any(Object),
    );
  });

  it('reconexão: ciclo bem-sucedido processa o que acumulou + onConnectionChange(online) + info', async () => {
    // Acumula uma sprint enquanto "fora do ar".
    const payload = makePayload();
    await kit.pendingStore.writePendingSprint(payload);

    // 1º ciclo: queda de conectividade.
    const spy = vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValueOnce(connErr());
    await kit.pollingService.pollOnce();
    expect(kit.pollingService.getConnection().online).toBe(false);
    expect(kit.queueService.length()).toBe(0);

    // 2º ciclo: o spy esgotou o `once` → chama o listPending real (share voltou).
    spy.mockRestore();
    await kit.pollingService.pollOnce();

    expect(kit.pollingService.getConnection().online).toBe(true);
    expect(kit.queueService.length()).toBe(1); // fila acumulada processada
    expect(kit.log.info).toHaveBeenCalledWith(
      expect.stringContaining('restabelecida'),
      expect.any(Object),
    );
    expect(kit.connectionEvents.map((e) => e.online)).toEqual([false, true]);
  });

  it('anti-spam: queda + N retries → 1 warn na borda, retries em debug', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValue(connErr());

    await kit.pollingService.pollOnce(); // borda connected→disconnected
    await kit.pollingService.pollOnce(); // retry
    await kit.pollingService.pollOnce(); // retry

    expect(kit.log.warn).toHaveBeenCalledTimes(1);
    expect(kit.log.debug).toHaveBeenCalledTimes(2);
    // Um único evento de transição (não um por ciclo).
    expect(kit.connectionEvents.filter((e) => !e.online).length).toBe(1);
  });

  it('scheduler usa a agenda de backoff 5/10/30/60 (cap 60) enquanto desconectado', async () => {
    const spy = vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValue(connErr());

    await kit.pollingService.start(); // poll imediato → falha #1
    expect(spy).toHaveBeenCalledTimes(1);

    // rng fixo 0.5 → sem jitter → atrasos exatos da agenda.
    await vi.advanceTimersByTimeAsync(4999);
    expect(spy).toHaveBeenCalledTimes(1); // ainda não (backoff = 5000)
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(2); // 5s

    await vi.advanceTimersByTimeAsync(10000);
    expect(spy).toHaveBeenCalledTimes(3); // 10s

    await vi.advanceTimersByTimeAsync(30000);
    expect(spy).toHaveBeenCalledTimes(4); // 30s

    await vi.advanceTimersByTimeAsync(60000);
    expect(spy).toHaveBeenCalledTimes(5); // 60s

    await vi.advanceTimersByTimeAsync(60000);
    expect(spy).toHaveBeenCalledTimes(6); // cap 60s
  });

  it('reconexão reseta o backoff: próximo ciclo volta ao intervalo normal', async () => {
    const spy = vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValue(connErr());

    await kit.pollingService.start(); // falha #1 → backoff 5s agendado
    await vi.advanceTimersByTimeAsync(5000); // falha #2 → backoff 10s agendado
    expect(spy).toHaveBeenCalledTimes(2);

    // Share volta — próximo ciclo (em 10s) terá sucesso.
    spy.mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(10000);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(kit.pollingService.getConnection().online).toBe(true);

    // Agora o agendamento volta ao intervalo NORMAL (3s), não ao backoff.
    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS - 1);
    expect(spy).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('boot resiliente: start() com share fora não joga e sobe desconectado', async () => {
    vi.spyOn(kit.pendingStore, 'listPending').mockRejectedValue(connErr('ENOTFOUND'));

    await expect(kit.pollingService.start()).resolves.toBeUndefined();
    expect(kit.pollingService.getConnection().online).toBe(false);
    expect(kit.connectionEvents.at(-1)?.online).toBe(false);
  });

  it('erro AO PROCESSAR entry (não no listPending) NÃO afeta conexão: loga error, segue conectado', async () => {
    // listPending teve sucesso (share OK) → conectado. Um erro inesperado ao
    // processar a entry é logado mas não deve marcar "sem conexão".
    await kit.pendingStore.writePendingSprint(makePayload());
    vi.spyOn(kit.queueService, 'enqueue').mockImplementationOnce(() => {
      throw new Error('falha inesperada de domínio');
    });

    await expect(kit.pollingService.pollOnce()).resolves.toBeUndefined();

    expect(kit.pollingService.getConnection().online).toBe(true);
    expect(kit.log.error).toHaveBeenCalledWith(
      expect.stringContaining('processar entries'),
      expect.any(Object),
    );
  });
});
