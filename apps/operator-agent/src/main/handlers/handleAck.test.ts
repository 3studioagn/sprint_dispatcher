/**
 * Testes do handleAck — orquestração ack final.
 *
 * Foco: wire do pillService (BL-C3-017). Cobertura completa do fluxo
 * end-to-end (filesystem, archive, pending delete) está em
 * services/integration.test.ts; aqui testamos isoladamente o ramo
 * pill via mocks finos.
 */

import { parseSprintPayload, type SprintPayload } from '@sprint/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PillService } from '../services/pillService';
import { QueueService } from '../services/queueService';

import { handleAck, type HandleAckDeps } from './handleAck';

const SPRINT_ID_1 = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const SPRINT_ID_2 = '01HXAAABBBCCCDDDEEEFFFGGGH';
const USER_ID = 'joao';

function makePayload(sprintId: string): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: sprintId,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: USER_ID,
    title: 'Teste',
    body_html: 'corpo',
    meta: 5,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
}

function makeMocks() {
  return {
    queueService: new QueueService(),
    historyService: {
      archive: vi.fn(() => Promise.resolve()),
    },
    overlayService: {
      clearTimer: vi.fn(),
      showSprint: vi.fn(),
      hide: vi.fn(),
    },
    pendingStore: {
      deletePending: vi.fn(() => Promise.resolve()),
    },
    ackService: {
      writeAcknowledged: vi.fn(() =>
        Promise.resolve({
          displayedAt: '2026-05-26T09:59:00.000Z',
          acknowledgedAt: '2026-05-26T10:00:00.000Z',
        }),
      ),
      writeDisplayed: vi.fn(() => Promise.resolve('2026-05-26T10:00:01.000Z')),
    },
    pillService: {
      show: vi.fn(),
      hide: vi.fn(),
    },
  };
}

type Mocks = ReturnType<typeof makeMocks>;

function buildDeps(m: Mocks): HandleAckDeps {
  return {
    queueService: m.queueService,
    historyService: m.historyService as unknown as HandleAckDeps['historyService'],
    overlayService: m.overlayService as unknown as HandleAckDeps['overlayService'],
    pendingStore: m.pendingStore as unknown as HandleAckDeps['pendingStore'],
    ackService: m.ackService as unknown as HandleAckDeps['ackService'],
    // Cast to PillService (não a versão | undefined) — exactOptionalPropertyTypes
    // rejeita assignment de undefined explícito mesmo em campo opcional.
    pillService: m.pillService as unknown as PillService,
  };
}

describe('handleAck — wire do pillService (BL-C3-017)', () => {
  let m: Mocks;
  let item1: { payload: SprintPayload; filename: string; rawContent: string };

  beforeEach(() => {
    m = makeMocks();
    const payload = makePayload(SPRINT_ID_1);
    item1 = {
      payload,
      filename: `${SPRINT_ID_1}-${USER_ID}.json`,
      rawContent: JSON.stringify(payload, null, 2),
    };
    m.queueService.enqueue(item1);
  });

  it('queue esvazia após ack → pillService.show(payload) + overlay.hide', async () => {
    await handleAck(buildDeps(m), SPRINT_ID_1, USER_ID);

    expect(m.overlayService.hide).toHaveBeenCalledTimes(1);
    expect(m.pillService.show).toHaveBeenCalledTimes(1);
    expect(m.pillService.show).toHaveBeenCalledWith(item1.payload);
    expect(m.pillService.hide).not.toHaveBeenCalled();
  });

  it('próxima sprint na fila após ack → pillService.hide + overlay.showSprint', async () => {
    const payload2 = makePayload(SPRINT_ID_2);
    m.queueService.enqueue({
      payload: payload2,
      filename: `${SPRINT_ID_2}-${USER_ID}.json`,
      rawContent: JSON.stringify(payload2, null, 2),
    });

    await handleAck(buildDeps(m), SPRINT_ID_1, USER_ID);

    expect(m.overlayService.hide).not.toHaveBeenCalled();
    expect(m.overlayService.showSprint).toHaveBeenCalledTimes(1);
    expect(m.pillService.show).not.toHaveBeenCalled();
    expect(m.pillService.hide).toHaveBeenCalledTimes(1);
  });

  it('pillService omitido (deps sem pill): comportamento legado preservado (sem crash)', async () => {
    const depsSemPill: HandleAckDeps = {
      queueService: m.queueService,
      historyService: m.historyService as unknown as HandleAckDeps['historyService'],
      overlayService: m.overlayService as unknown as HandleAckDeps['overlayService'],
      pendingStore: m.pendingStore as unknown as HandleAckDeps['pendingStore'],
      ackService: m.ackService as unknown as HandleAckDeps['ackService'],
      // pillService omitido propositalmente
    };

    await expect(handleAck(depsSemPill, SPRINT_ID_1, USER_ID)).resolves.toBeDefined();
    expect(m.overlayService.hide).toHaveBeenCalledTimes(1);
    // pillService.show NUNCA chamado porque omitido
    expect(m.pillService.show).not.toHaveBeenCalled();
  });

  it('pill recebe o item ackeado, NÃO o próximo item da fila', async () => {
    // Cenário onde queue ainda terá item1 mas vamos validar que se
    // remover item1 e fila esvaziar, show recebe item1 (ackeado), não item2.
    // O setup base já tem só item1 → ack → pill.show(item1.payload).
    await handleAck(buildDeps(m), SPRINT_ID_1, USER_ID);

    const calls = m.pillService.show.mock.calls as [SprintPayload][];
    const showCallArg = calls[0]?.[0];
    expect(showCallArg).toBeDefined();
    expect(showCallArg?.sprint_id).toBe(SPRINT_ID_1);
  });
});
