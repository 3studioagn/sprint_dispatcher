/**
 * Paridade Node ↔ Memory para o domain layer.
 *
 * O `__tests__/contract.test.ts` (W0) cobre paridade para os 8
 * primitivos do {@link IFilesystemAdapter}. Este arquivo cobre a
 * camada acima — `PendingStore`, `AckStore`, `CancelStore`,
 * `ArchiveStore` (stub W3) — garantindo que consumers (Leader, Agent)
 * podem trocar Node por Memory em testes sem mudar comportamento.
 *
 * Padrão: cada teste roda 1× contra cada adapter via `describeParity`.
 * Diferenças intencionais (G-019: Memory perde diretório quando fica
 * vazio) são tratadas com `try/catch` aceitando ambos os outcomes.
 */
import {
  buildPendingFilename,
  decodeUlidTime,
  formatArchiveDate,
  generateSprintId,
  parseSprintAck,
  parseSprintCancel,
  parseSprintPayload,
  type SprintAck,
  type SprintPayload,
} from '@sprint/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTmpShared } from '../__helpers__/tmpFixtures';
import { DirectoryNotFoundError } from '../errors';
import { AckStore, ArchiveStore, CancelStore, PendingStore } from '../index';
import type { IFilesystemAdapter } from '../interface';
import { MemoryFilesystemAdapter } from '../memory-adapter';
import { NodeFilesystemAdapter } from '../node-adapter';

interface ParityContext {
  adapter: IFilesystemAdapter;
  sharedPath: string;
  cleanup: () => Promise<void>;
}

type AdapterFactory = () => Promise<ParityContext>;

function buildPayload(overrides: { user_id?: string; sprint_id?: string } = {}): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: overrides.sprint_id ?? generateSprintId(),
    criado_por: 'Renan',
    criado_em: new Date().toISOString(),
    user_id: overrides.user_id ?? 'joao',
    title: 'Meta paridade',
    body_html: '<p>Conteúdo válido</p>',
    meta: 100,
    deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

function buildAck(overrides: { sprint_id?: string; user_id?: string } = {}): SprintAck {
  return parseSprintAck({
    schema_version: '1.0',
    sprint_id: overrides.sprint_id ?? generateSprintId(),
    user_id: overrides.user_id ?? 'joao',
    hostname: 'PC-PARIDADE',
    displayed_at: new Date().toISOString(),
    agent_version: '0.1.0',
  });
}

/**
 * Executa o bloco completo de testes do domain layer contra a factory
 * de adapter fornecida. Chamada duas vezes (Node + Memory) abaixo
 * permite checar paridade lado-a-lado.
 */
function describeParity(label: string, factory: AdapterFactory): void {
  describe(`paridade Node↔Memory [${label}]`, () => {
    let ctx: ParityContext;

    beforeEach(async () => {
      ctx = await factory();
    });

    afterEach(async () => {
      await ctx.cleanup();
    });

    // ===================================================================
    // PendingStore
    // ===================================================================

    describe('PendingStore', () => {
      it('writePendingSprint produz o mesmo filename e content em ambos adapters', async () => {
        const sprintId = generateSprintId();
        const userId = 'maria';
        const payload = buildPayload({ sprint_id: sprintId, user_id: userId });
        const store = new PendingStore(ctx.adapter, ctx.sharedPath);

        const { filename, filepath } = await store.writePendingSprint(payload);

        expect(filename).toBe(`${sprintId}-${userId}.json`);
        expect(filepath.endsWith(filename)).toBe(true);
        await expect(ctx.adapter.exists(filepath)).resolves.toBe(true);

        const raw = await ctx.adapter.readFile(filepath);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        expect(parsed.sprint_id).toBe(sprintId);
        expect(parsed.user_id).toBe(userId);
      });

      it('listPending após write retorna 1 entry com kind sprint e payload idêntico', async () => {
        const sprintId = generateSprintId();
        const payload = buildPayload({ sprint_id: sprintId, user_id: 'joao' });
        const store = new PendingStore(ctx.adapter, ctx.sharedPath);

        await store.writePendingSprint(payload);
        const entries = await store.listPending();

        expect(entries).toHaveLength(1);
        const [entry] = entries;
        expect(entry?.kind).toBe('sprint');
        if (entry?.kind === 'sprint') {
          expect(entry.payload.sprint_id).toBe(sprintId);
          expect(entry.payload.user_id).toBe('joao');
          expect(entry.payload.meta).toBe(payload.meta);
        }
      });

      it('deletePending remove arquivo (Memory pode perder diretório — G-019)', async () => {
        const payload = buildPayload();
        const store = new PendingStore(ctx.adapter, ctx.sharedPath);

        const { filename, filepath } = await store.writePendingSprint(payload);
        await expect(ctx.adapter.exists(filepath)).resolves.toBe(true);

        await store.deletePending(filename);
        await expect(ctx.adapter.exists(filepath)).resolves.toBe(false);

        // Memory: dir desaparece (G-019). Node: dir vazio fica. Ambos OK.
        try {
          const entries = await store.listPending();
          expect(entries).toEqual([]);
        } catch (err) {
          expect(err).toBeInstanceOf(DirectoryNotFoundError);
        }
      });

      it('listPending propaga DirectoryNotFoundError quando pending/ não existe', async () => {
        // Ambos adapters: pasta nunca criada → DirectoryNotFoundError
        const memoryOnlySharedPath = '/never-created';
        const store = new PendingStore(ctx.adapter, memoryOnlySharedPath);

        await expect(store.listPending()).rejects.toBeInstanceOf(DirectoryNotFoundError);
      });
    });

    // ===================================================================
    // AckStore
    // ===================================================================

    describe('AckStore', () => {
      it('writeAck produz o mesmo filename e content em ambos adapters', async () => {
        const sprintId = generateSprintId();
        const ack = buildAck({ sprint_id: sprintId, user_id: 'carlos' });
        const store = new AckStore(ctx.adapter, ctx.sharedPath);

        const { filename, filepath } = await store.writeAck(ack);

        expect(filename).toBe(`${sprintId}-carlos.ack.json`);
        await expect(ctx.adapter.exists(filepath)).resolves.toBe(true);
      });

      it('listAcks após write retorna 1 entry com kind ack e payload idêntico', async () => {
        const sprintId = generateSprintId();
        const ack = buildAck({ sprint_id: sprintId, user_id: 'ana' });
        const store = new AckStore(ctx.adapter, ctx.sharedPath);

        await store.writeAck(ack);
        const entries = await store.listAcks();

        expect(entries).toHaveLength(1);
        const [entry] = entries;
        expect(entry?.kind).toBe('ack');
        if (entry?.kind === 'ack') {
          expect(entry.payload.sprint_id).toBe(sprintId);
          expect(entry.payload.user_id).toBe('ana');
        }
      });

      it('writeAck overwrite produz 1 entry final (não append)', async () => {
        const sprintId = generateSprintId();
        const userId = 'overwriter';
        const store = new AckStore(ctx.adapter, ctx.sharedPath);

        await store.writeAck(buildAck({ sprint_id: sprintId, user_id: userId }));
        await store.writeAck(buildAck({ sprint_id: sprintId, user_id: userId }));

        const entries = await store.listAcks();
        expect(entries).toHaveLength(1);
      });
    });

    // ===================================================================
    // CancelStore (BL-C4-004)
    // ===================================================================

    describe('CancelStore', () => {
      it('writeCancel produz o mesmo filename e content em ambos adapters', async () => {
        const sprintId = generateSprintId();
        const cancel = parseSprintCancel({
          schema_version: '1.0',
          type: 'cancel',
          sprint_id_ref: sprintId,
          cancelado_por: 'Renan',
          cancelado_em: new Date().toISOString(),
          motivo: 'Paridade',
        });
        const store = new CancelStore(ctx.adapter, ctx.sharedPath);

        const { filename, filepath, removedOriginals } = await store.writeCancel(cancel);

        expect(filename).toBe(`cancel-${sprintId}.json`);
        expect(filepath.endsWith(filename)).toBe(true);
        expect(removedOriginals).toEqual([]);
        await expect(ctx.adapter.exists(filepath)).resolves.toBe(true);

        const raw = await ctx.adapter.readFile(filepath);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        expect(parsed.sprint_id_ref).toBe(sprintId);
        expect(parsed.type).toBe('cancel');
        expect(parsed.motivo).toBe('Paridade');
      });

      it('writeCancel remove pendings da mesma sprint quando PendingStore injetado', async () => {
        const sprintId = generateSprintId();
        const pendingStore = new PendingStore(ctx.adapter, ctx.sharedPath);
        const cancelStore = new CancelStore(ctx.adapter, ctx.sharedPath, pendingStore);

        const w1 = await pendingStore.writePendingSprint(
          buildPayload({ sprint_id: sprintId, user_id: 'joao' }),
        );

        const result = await cancelStore.writeCancel(
          parseSprintCancel({
            schema_version: '1.0',
            type: 'cancel',
            sprint_id_ref: sprintId,
            cancelado_por: 'Renan',
            cancelado_em: new Date().toISOString(),
          }),
        );

        expect(result.removedOriginals).toEqual([w1.filename]);
        await expect(ctx.adapter.exists(w1.filepath)).resolves.toBe(false);
        await expect(ctx.adapter.exists(result.filepath)).resolves.toBe(true);
      });
    });

    // ===================================================================
    // ArchiveStore (BL-C4-005)
    // ===================================================================

    describe('ArchiveStore', () => {
      it('archiveSprint move sprint + ack para arquivo/<data>/ em ambos adapters', async () => {
        const sprintId = generateSprintId();
        const userId = 'joao';
        const expectedDate = formatArchiveDate(decodeUlidTime(sprintId));
        const pendingStore = new PendingStore(ctx.adapter, ctx.sharedPath);
        const ackStore = new AckStore(ctx.adapter, ctx.sharedPath);
        const archiveStore = new ArchiveStore(ctx.adapter, ctx.sharedPath);

        const { filename: sprintFilename } = await pendingStore.writePendingSprint(
          buildPayload({ sprint_id: sprintId, user_id: userId }),
        );
        const { filename: ackFilename } = await ackStore.writeAck(
          buildAck({ sprint_id: sprintId, user_id: userId }),
        );

        const result = await archiveStore.archiveSprint(sprintFilename);

        expect(result.outcome).toBe('archived');
        expect(result.date).toBe(expectedDate);
        expect(result.ackFilename).toBe(ackFilename);

        // Originais saíram de pending/ e acks/, destino populado.
        await expect(ctx.adapter.exists(result.sprintArchivedTo!)).resolves.toBe(true);
        await expect(ctx.adapter.exists(result.ackArchivedTo!)).resolves.toBe(true);
        const sprintFrom = `${ctx.sharedPath}/pending/${sprintFilename}`.replace(/\/+/g, '/');
        await expect(ctx.adapter.exists(sprintFrom)).resolves.toBe(false);
      });

      it('listArchive + readArchivedSprint round-trip em ambos adapters', async () => {
        const sprintId = generateSprintId();
        const userId = 'maria';
        const pendingStore = new PendingStore(ctx.adapter, ctx.sharedPath);
        const ackStore = new AckStore(ctx.adapter, ctx.sharedPath);
        const archiveStore = new ArchiveStore(ctx.adapter, ctx.sharedPath);

        await pendingStore.writePendingSprint(
          buildPayload({ sprint_id: sprintId, user_id: userId }),
        );
        await ackStore.writeAck(buildAck({ sprint_id: sprintId, user_id: userId }));
        await archiveStore.archiveSprint(buildPendingFilename(sprintId, userId));

        const refs = await archiveStore.listArchive();
        expect(refs).toHaveLength(1);
        const [ref] = refs;
        expect(ref?.sprintId).toBe(sprintId);
        expect(ref?.userId).toBe(userId);
        expect(ref?.hasAck).toBe(true);

        if (ref !== undefined) {
          const detail = await archiveStore.readArchivedSprint(ref);
          expect(detail.payload.sprint_id).toBe(sprintId);
          expect(detail.ack?.sprint_id).toBe(sprintId);
        }
      });

      it('listArchive retorna [] quando arquivo/ não existe (ambos adapters)', async () => {
        const archiveStore = new ArchiveStore(ctx.adapter, ctx.sharedPath);
        await expect(archiveStore.listArchive()).resolves.toEqual([]);
      });
    });
  });
}

// =====================================================================
// Invocação das duas instâncias da suite de paridade
// =====================================================================

describeParity('Node (real FS)', async () => {
  const tmp = await setupTmpShared('parity-node');
  return {
    adapter: new NodeFilesystemAdapter(),
    sharedPath: tmp.sharedPath,
    cleanup: tmp.cleanup,
  };
});

describeParity('Memory (mock)', () =>
  Promise.resolve({
    adapter: new MemoryFilesystemAdapter(),
    sharedPath: '/shared',
    cleanup: () => Promise.resolve(),
  }),
);
