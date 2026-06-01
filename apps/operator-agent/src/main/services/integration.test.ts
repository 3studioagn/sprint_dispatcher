/**
 * Teste integrado do fluxo end-to-end do Operator Agent (Gate 7).
 *
 * **Cenário coberto:**
 * - 2 sprints válidas pre-seeded em `<shared>/pending/`.
 * - Boot dos services + wire de eventos (espelha o `rebuildDeps` do
 *   `main/index.ts`, sem incluir o composition root para não disparar
 *   `void bootstrap()` no top-level).
 * - `pollOnce` manual → queue cresce para 2.
 * - Sprint 1 entra em exibição: `overlayService.showSprint` + ack inicial
 *   (`displayed_at`) gravado no shared.
 * - Simula ack via `handleAck(sprint1)`: ack final + archive + delete +
 *   dequeue → segunda sprint exibida automaticamente + ack inicial dela.
 * - Simula ack via `handleAck(sprint2)`: ack final + archive + delete +
 *   queue vazia → overlay esconde.
 *
 * **Estratégia de timing:** sem fake timers. `pollingService.pollOnce()`
 * é chamado manualmente em vez de aguardar setTimeout. `now` é injetado
 * em historyService, ackService, pollingService para timestamps
 * determinísticos. Trade-off: não exercita o loop recursivo (já coberto
 * em `pollingService.test.ts` com fake timers + `vi.advanceTimersByTime`).
 *
 * **Assertions finais:**
 * - 2 arquivos em `<userData>/historico/YYYY-MM-DD/`.
 * - 2 chamadas a `pendingStore.deletePending` (verificado indiretamente:
 *   `<shared>/pending/` esvazia).
 * - 4 chamadas a `ackStore.writeAck` total (2 displayed + 2 acknowledged
 *   sobre os mesmos 2 arquivos — overwrites).
 * - `overlayService.showSprint` chamado 2× (uma por sprint).
 * - `overlayService.hide` chamado 1× (após esvaziar a fila).
 *
 * **OverlayService mockado** — o real cria `BrowserWindow` real do Electron,
 * o que demanda runtime Electron + display. Os outros services (queueService,
 * historyService, ackService, pollingService, AckStore, PendingStore,
 * MemoryFilesystemAdapter) são reais. A fronteira do teste é: tudo do lado
 * "domínio" é real; só a thin layer Electron Window é mockada.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseSprintPayload, type SprintPayload } from '@sprint/contracts';
import { AckStore, MemoryFilesystemAdapter, PendingStore } from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAck } from '../handlers/handleAck';

import { AckService } from './ackService';
import { HistoryService } from './historyService';
import type { OverlayService } from './overlayService';
import { PollingService } from './pollingService';
import { QueueService } from './queueService';

const SHARED_PATH = '/test/shared';
const USER_ID = 'joao';
const HOSTNAME = 'ART-DESIGN-04';
const AGENT_VERSION = '1.0.0';
const POLLING_INTERVAL_MS = 999_999; // longe — testes chamam pollOnce manual
const FIXED_NOW = new Date('2026-05-26T10:00:00.000Z');
const EXPECTED_DAY = '2026-05-26';

const SPRINT_ID_1 = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const SPRINT_ID_2 = '01HXAAABBBCCCDDDEEEFFFGGGH';

function makePayload(opts: { sprintId: string }): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: USER_ID,
    title: 'Teste integrado',
    body_html: 'corpo',
    meta: 5,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
}

/**
 * Mock OverlayService — spies para os métodos chamados pelo handleAck +
 * wires. Outros métodos da interface viram stubs no-op (cast via unknown
 * para narrow TS check).
 */
function makeOverlayMock(): OverlayService & {
  __spies: {
    showSprint: ReturnType<typeof vi.fn>;
    sendQueueUpdate: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    clearTimer: ReturnType<typeof vi.fn>;
  };
} {
  const showSprint = vi.fn();
  const sendQueueUpdate = vi.fn();
  const hide = vi.fn();
  const clearTimer = vi.fn();
  const mock = {
    showSprint,
    sendQueueUpdate,
    hide,
    clearTimer,
    getCurrentEvent: vi.fn(() => null),
    getState: vi.fn(() => 'hidden' as const),
    minimize: vi.fn(),
    restoreCurrent: vi.fn(),
    destroy: vi.fn(),
    onStateChange: vi.fn(() => () => undefined),
    __spies: { showSprint, sendQueueUpdate, hide, clearTimer },
  };
  return mock as unknown as OverlayService & typeof mock;
}

interface Harness {
  adapter: MemoryFilesystemAdapter;
  pendingStore: PendingStore;
  ackStore: AckStore;
  queueService: QueueService;
  historyService: HistoryService;
  ackService: AckService;
  pollingService: PollingService;
  overlay: ReturnType<typeof makeOverlayMock>;
  userDataDir: string;
}

async function makeHarness(): Promise<Harness> {
  const adapter = new MemoryFilesystemAdapter();
  const pendingStore = new PendingStore(adapter, SHARED_PATH);
  const ackStore = new AckStore(adapter, SHARED_PATH);

  const userDataDir = path.join(
    os.tmpdir(),
    `sprint-agent-integration-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(userDataDir, { recursive: true });

  const queueService = new QueueService();
  const historyService = new HistoryService(userDataDir, () => FIXED_NOW);
  await historyService.ensureFolder();
  await historyService.initializeFromDisk();

  const ackService = new AckService({
    ackStore,
    hostname: HOSTNAME,
    agentVersion: AGENT_VERSION,
    now: () => FIXED_NOW,
  });

  const overlay = makeOverlayMock();

  // Wire — espelha rebuildDeps do main/index.ts.
  queueService.onNextSprint((item) => {
    overlay.showSprint(item, queueService.length());
    void ackService.writeDisplayed(item.payload);
  });
  queueService.onQueueUpdated((length) => {
    overlay.sendQueueUpdate(length);
  });

  const pollingService = new PollingService({
    pendingStore,
    adapter,
    sharedPath: SHARED_PATH,
    queueService,
    historyService,
    userId: USER_ID,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    now: () => FIXED_NOW,
  });

  return {
    adapter,
    pendingStore,
    ackStore,
    queueService,
    historyService,
    ackService,
    pollingService,
    overlay,
    userDataDir,
  };
}

/**
 * Flush microtasks pendentes (e.g. `void ackService.writeDisplayed`)
 * sem fake timers. Múltiplas iterações de `Promise.resolve()` cobrem
 * chains de Promises com 2-3 níveis de await.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('Integration — fluxo end-to-end (2 sprints, 2 acks, queue esvazia)', () => {
  let h: Harness;

  beforeEach(async () => {
    h = await makeHarness();
  });

  afterEach(async () => {
    h.pollingService.stop();
    await fs.rm(h.userDataDir, { recursive: true, force: true });
  });

  it('boot ordenado → polling → 2 enqueues → 2 acks → queue vazia + overlay hide', async () => {
    // === 1. Pre-seed 2 sprints válidas em <shared>/pending/ ===
    await h.pendingStore.writePendingSprint(makePayload({ sprintId: SPRINT_ID_1 }));
    // Pequeno delay para diferenciar modifiedAt no MemoryAdapter
    // — listPending ordena ASC por modifiedAt; sprint 1 vem antes.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await h.pendingStore.writePendingSprint(makePayload({ sprintId: SPRINT_ID_2 }));

    // === 2. Executa um ciclo de polling manualmente ===
    const writeAckSpy = vi.spyOn(h.ackStore, 'writeAck');
    await h.pollingService.pollOnce();
    await flushMicrotasks();

    expect(h.queueService.length()).toBe(2);
    expect(h.overlay.__spies.showSprint).toHaveBeenCalledTimes(1);
    // showSprint recebe length=1 — sprint 1 é enqueueada PRIMEIRO no loop
    // do pollOnce, dispara nextSprint, e só DEPOIS sprint 2 é enqueueada.
    // O queueLength=2 chega via sendQueueUpdate logo após.
    // Acessamos os args via mock.calls + cast tipado (nested objectContaining
    // produz `any` que viola @typescript-eslint/no-unsafe-assignment).
    const firstShowCall = h.overlay.__spies.showSprint.mock.calls[0] as [
      { payload: { sprint_id: string } },
      number,
    ];
    expect(firstShowCall[0].payload.sprint_id).toBe(SPRINT_ID_1);
    expect(firstShowCall[1]).toBe(1);

    // sendQueueUpdate chamado 2× (uma por enqueue) — última com length=2.
    expect(h.overlay.__spies.sendQueueUpdate).toHaveBeenCalledTimes(2);
    expect(h.overlay.__spies.sendQueueUpdate).toHaveBeenLastCalledWith(2);

    // Após showSprint do wire onNextSprint, o writeDisplayed da sprint 1
    // já deve ter completado (await da microtask de void writeDisplayed).
    expect(writeAckSpy).toHaveBeenCalledTimes(1);

    // === 3. Ack da primeira sprint ===
    const result1 = await handleAck(
      {
        queueService: h.queueService,
        historyService: h.historyService,
        overlayService: h.overlay,
        pendingStore: h.pendingStore,
        ackService: h.ackService,
      },
      SPRINT_ID_1,
      USER_ID,
    );
    await flushMicrotasks();

    expect(result1.acknowledged_at).toBe(FIXED_NOW.toISOString());
    expect(result1.moved_to_history).toBe(true);

    // Após ack 1: queue=1, overlay.showSprint chamado novamente com sprint 2.
    expect(h.queueService.length()).toBe(1);
    expect(h.overlay.__spies.showSprint).toHaveBeenCalledTimes(2);
    const secondShowCall = h.overlay.__spies.showSprint.mock.calls[1] as [
      { payload: { sprint_id: string } },
      number,
    ];
    expect(secondShowCall[0].payload.sprint_id).toBe(SPRINT_ID_2);
    expect(secondShowCall[1]).toBe(1);

    // Pending no shared: só sprint 2 deve estar.
    const pendingAfter1 = await h.adapter.listDir(`${SHARED_PATH}/pending`);
    expect(pendingAfter1.length).toBe(1);
    expect(pendingAfter1[0]).toContain(SPRINT_ID_2);

    // === 4. Ack da segunda sprint ===
    const result2 = await handleAck(
      {
        queueService: h.queueService,
        historyService: h.historyService,
        overlayService: h.overlay,
        pendingStore: h.pendingStore,
        ackService: h.ackService,
      },
      SPRINT_ID_2,
      USER_ID,
    );
    await flushMicrotasks();

    expect(result2.moved_to_history).toBe(true);

    // Após ack 2: queue=0, overlay.hide chamado.
    expect(h.queueService.length()).toBe(0);
    expect(h.overlay.__spies.hide).toHaveBeenCalledTimes(1);

    // === 5. Assertions finais — filesystem state ===

    // Pending no shared: vazio.
    try {
      const pendingFinal = await h.adapter.listDir(`${SHARED_PATH}/pending`);
      expect(pendingFinal).toEqual([]);
    } catch (err) {
      // MemoryAdapter pode lançar DirectoryNotFoundError se pasta esvazia
      // por completo (semântica de "diretório implícito" — G-019).
      // Ambos os resultados (lista vazia ou pasta inexistente) indicam
      // que não há sprints pendentes; ambos são aceitáveis.
      expect((err as Error).message).toContain('pending');
    }

    // Acks no shared: 2 arquivos (overwrites preservados — 1 por sprint).
    const acks = await h.adapter.listDir(`${SHARED_PATH}/acks`);
    expect(acks.length).toBe(2);
    expect(acks.some((f) => f.includes(SPRINT_ID_1))).toBe(true);
    expect(acks.some((f) => f.includes(SPRINT_ID_2))).toBe(true);

    // writeAck total: 4 chamadas (2 displayed + 2 acknowledged).
    expect(writeAckSpy).toHaveBeenCalledTimes(4);

    // Cada ack final tem acknowledged_at preenchido + displayed_at preservado.
    const ack1Entries = await h.ackStore.listAcks({ sprintId: SPRINT_ID_1 });
    expect(ack1Entries.length).toBe(1);
    if (ack1Entries[0]?.kind === 'ack') {
      expect(ack1Entries[0].payload.acknowledged_at).toBe(FIXED_NOW.toISOString());
      expect(ack1Entries[0].payload.displayed_at).toBe(FIXED_NOW.toISOString());
    }
    const ack2Entries = await h.ackStore.listAcks({ sprintId: SPRINT_ID_2 });
    if (ack2Entries[0]?.kind === 'ack') {
      expect(ack2Entries[0].payload.acknowledged_at).toBe(FIXED_NOW.toISOString());
    }

    // Histórico local: 2 arquivos em <userData>/historico/2026-05-26/.
    const historicoDay = path.join(h.userDataDir, 'historico', EXPECTED_DAY);
    const archived = await fs.readdir(historicoDay);
    expect(archived.length).toBe(2);
    expect(archived.some((f) => f.includes(SPRINT_ID_1))).toBe(true);
    expect(archived.some((f) => f.includes(SPRINT_ID_2))).toBe(true);

    // Cache do historyService inclui ambas (dedup pós-restart).
    expect(h.historyService.isAlreadyArchived(archived[0] ?? '')).toBe(true);
    expect(h.historyService.isAlreadyArchived(archived[1] ?? '')).toBe(true);

    // clearTimer chamado 2× (uma por ack).
    expect(h.overlay.__spies.clearTimer).toHaveBeenCalledTimes(2);
  });

  it('handleAck rejeita ack mismatch (sprint diferente do peek)', async () => {
    await h.pendingStore.writePendingSprint(makePayload({ sprintId: SPRINT_ID_1 }));
    await h.pollingService.pollOnce();
    await flushMicrotasks();

    await expect(
      handleAck(
        {
          queueService: h.queueService,
          historyService: h.historyService,
          overlayService: h.overlay,
          pendingStore: h.pendingStore,
          ackService: h.ackService,
        },
        SPRINT_ID_2, // sprint que NÃO está na fila
        USER_ID,
      ),
    ).rejects.toThrow(/Ack mismatch/);
  });

  it('handleAck rejeita quando queue está vazia', async () => {
    await expect(
      handleAck(
        {
          queueService: h.queueService,
          historyService: h.historyService,
          overlayService: h.overlay,
          pendingStore: h.pendingStore,
          ackService: h.ackService,
        },
        SPRINT_ID_1,
        USER_ID,
      ),
    ).rejects.toThrow(/Não há sprint na fila/);
  });

  it('polling re-detecta após ack → dedup via cache (sprint não re-aparece)', async () => {
    // 1. Boot inicial, ack da sprint 1 — arquiva.
    await h.pendingStore.writePendingSprint(makePayload({ sprintId: SPRINT_ID_1 }));
    await h.pollingService.pollOnce();
    await flushMicrotasks();

    await handleAck(
      {
        queueService: h.queueService,
        historyService: h.historyService,
        overlayService: h.overlay,
        pendingStore: h.pendingStore,
        ackService: h.ackService,
      },
      SPRINT_ID_1,
      USER_ID,
    );
    await flushMicrotasks();

    // 2. Simula "deletePending falhou" — sprint 1 ainda no pending após archive.
    await h.pendingStore.writePendingSprint(makePayload({ sprintId: SPRINT_ID_1 }));

    // 3. Novo ciclo — historyService cache já marcou o filename como
    // processado, então o polling NÃO enfileira de novo.
    h.overlay.__spies.showSprint.mockClear();
    await h.pollingService.pollOnce();
    await flushMicrotasks();

    expect(h.queueService.length()).toBe(0);
    expect(h.overlay.__spies.showSprint).not.toHaveBeenCalled();
  });
});
