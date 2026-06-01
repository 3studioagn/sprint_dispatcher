/**
 * Testes do AckService — writeDisplayed (Gate 6) + writeAcknowledged.
 *
 * Estratégia:
 * - `MemoryFilesystemAdapter` + `AckStore` reais.
 * - `vi.spyOn(ackStore, 'writeAck')` para casos de erro.
 * - `now` injectada para timestamps determinísticos.
 *
 * Cobre os 4 cenários do prompt § Gate 6:
 * - writeDisplayed sucesso.
 * - writeDisplayed falha (não throw).
 * - writeAcknowledged sucesso.
 * - writeAcknowledged preserva displayed_at original.
 */

import { buildAckFilename, parseSprintPayload, type SprintPayload } from '@sprint/contracts';
import { AckStore, MemoryFilesystemAdapter } from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AckService } from './ackService';

const SHARED_PATH = '/test/shared';
const HOSTNAME = 'ART-DESIGN-04';
const AGENT_VERSION = '1.0.0';

const VALID_SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const USER_ID = 'joao';

function makePayload(): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: VALID_SPRINT_ID,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: USER_ID,
    title: 'Teste',
    body_html: 'corpo',
    meta: 5,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
}

interface TestKit {
  adapter: MemoryFilesystemAdapter;
  ackStore: AckStore;
  service: AckService;
  log: { warn: ReturnType<typeof vi.fn> };
}

function makeKit(now: Date): TestKit {
  const adapter = new MemoryFilesystemAdapter();
  const ackStore = new AckStore(adapter, SHARED_PATH);
  const log = { warn: vi.fn() };
  const service = new AckService({
    ackStore,
    hostname: HOSTNAME,
    agentVersion: AGENT_VERSION,
    now: () => now,
    log,
  });
  return { adapter, ackStore, service, log };
}

describe('AckService — writeDisplayed', () => {
  let kit: TestKit;
  const fixedNow = new Date('2026-05-26T10:00:00.000Z');

  beforeEach(() => {
    kit = makeKit(fixedNow);
  });

  it('grava ack inicial com displayed_at + retorna ISO string', async () => {
    const result = await kit.service.writeDisplayed(makePayload());
    expect(result).toBe(fixedNow.toISOString());
  });

  it('ack escrito tem schema_version, sprint_id, user_id, hostname, agent_version', async () => {
    await kit.service.writeDisplayed(makePayload());
    const entries = await kit.ackStore.listAcks();
    expect(entries.length).toBe(1);
    const entry = entries[0];
    expect(entry?.kind).toBe('ack');
    if (entry?.kind === 'ack') {
      expect(entry.payload.schema_version).toBe('1.0');
      expect(entry.payload.sprint_id).toBe(VALID_SPRINT_ID);
      expect(entry.payload.user_id).toBe(USER_ID);
      expect(entry.payload.hostname).toBe(HOSTNAME);
      expect(entry.payload.agent_version).toBe(AGENT_VERSION);
      expect(entry.payload.displayed_at).toBe(fixedNow.toISOString());
      expect(entry.payload.acknowledged_at).toBeUndefined();
    }
  });

  it('filename gravado segue convenção <sprintId>-<userId>.ack.json', async () => {
    await kit.service.writeDisplayed(makePayload());
    const entries = await kit.ackStore.listAcks();
    expect(entries[0]?.filename).toBe(buildAckFilename(VALID_SPRINT_ID, USER_ID));
  });

  it('falha do ackStore.writeAck NÃO throw + retorna null + loga warn', async () => {
    vi.spyOn(kit.ackStore, 'writeAck').mockRejectedValueOnce(new Error('SMB caiu'));
    const result = await kit.service.writeDisplayed(makePayload());
    expect(result).toBeNull();
    expect(kit.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('writeDisplayed falhou'),
      expect.objectContaining({ sprint_id: VALID_SPRINT_ID }),
    );
  });

  it('hostname mojibake/unicode é preservado literal', async () => {
    const k = makeKit(fixedNow);
    const svc = new AckService({
      ackStore: k.ackStore,
      hostname: 'PC-JOÃO-04', // caractere não-ASCII
      agentVersion: AGENT_VERSION,
      now: () => fixedNow,
    });
    await svc.writeDisplayed(makePayload());
    const entries = await k.ackStore.listAcks();
    if (entries[0]?.kind === 'ack') {
      expect(entries[0].payload.hostname).toBe('PC-JOÃO-04');
    }
  });
});

describe('AckService — writeAcknowledged', () => {
  let kit: TestKit;
  const displayedNow = new Date('2026-05-26T10:00:00.000Z');
  const ackedNow = new Date('2026-05-26T10:05:00.000Z');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    kit = makeKit(displayedNow);
  });

  it('preserva displayed_at original do ack inicial (re-lê via listAcks)', async () => {
    // 1. writeDisplayed em displayedNow
    await kit.service.writeDisplayed(makePayload());

    // 2. Avança "now" para o momento do ack final
    const svc = new AckService({
      ackStore: kit.ackStore,
      hostname: HOSTNAME,
      agentVersion: AGENT_VERSION,
      now: () => ackedNow,
      log: kit.log,
    });

    const result = await svc.writeAcknowledged(VALID_SPRINT_ID, USER_ID);
    expect(result.displayedAt).toBe(displayedNow.toISOString());
    expect(result.acknowledgedAt).toBe(ackedNow.toISOString());

    const entries = await kit.ackStore.listAcks();
    if (entries[0]?.kind === 'ack') {
      expect(entries[0].payload.displayed_at).toBe(displayedNow.toISOString());
      expect(entries[0].payload.acknowledged_at).toBe(ackedNow.toISOString());
    }
  });

  it('fallback para `now` se ack inicial não foi gravado (writeDisplayed falhou)', async () => {
    // Sem chamar writeDisplayed antes — listAcks retorna vazio
    const svc = new AckService({
      ackStore: kit.ackStore,
      hostname: HOSTNAME,
      agentVersion: AGENT_VERSION,
      now: () => ackedNow,
      log: kit.log,
    });
    const result = await svc.writeAcknowledged(VALID_SPRINT_ID, USER_ID);
    expect(result.displayedAt).toBe(ackedNow.toISOString());
    expect(result.acknowledgedAt).toBe(ackedNow.toISOString());
  });

  it('fallback se listAcks throw (filesystem flaky)', async () => {
    vi.spyOn(kit.ackStore, 'listAcks').mockRejectedValueOnce(new Error('SMB transient'));
    const result = await kit.service.writeAcknowledged(VALID_SPRINT_ID, USER_ID);
    expect(result.displayedAt).toBe(displayedNow.toISOString());
    expect(kit.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('fallback para now'),
      expect.objectContaining({ sprint_id: VALID_SPRINT_ID }),
    );
  });

  it('THROW se writeAck do ack final falhar (operador precisa saber)', async () => {
    vi.spyOn(kit.ackStore, 'writeAck').mockRejectedValueOnce(new Error('SMB caiu'));
    await expect(kit.service.writeAcknowledged(VALID_SPRINT_ID, USER_ID)).rejects.toThrow(
      'SMB caiu',
    );
  });

  it('sobrescreve o ack file (mesmo filename, conteúdo expandido)', async () => {
    await kit.service.writeDisplayed(makePayload());
    const filenameAfterDisplayed = (await kit.ackStore.listAcks())[0]?.filename;

    const svc = new AckService({
      ackStore: kit.ackStore,
      hostname: HOSTNAME,
      agentVersion: AGENT_VERSION,
      now: () => ackedNow,
    });
    await svc.writeAcknowledged(VALID_SPRINT_ID, USER_ID);

    const entries = await kit.ackStore.listAcks();
    expect(entries.length).toBe(1); // ainda 1 arquivo (overwrite)
    expect(entries[0]?.filename).toBe(filenameAfterDisplayed);
    if (entries[0]?.kind === 'ack') {
      expect(entries[0].payload.acknowledged_at).toBeDefined();
    }
  });
});
