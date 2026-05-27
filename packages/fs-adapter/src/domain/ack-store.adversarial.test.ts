/**
 * Testes adversariais do AckStore — overwrite progressivo,
 * concorrência com filesystem real.
 *
 * Separado de `ack-store.test.ts` (cenários enumeráveis) — usa
 * NodeFilesystemAdapter contra tmp dir real para validar comportamento
 * em FS de produção.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildAckFilename,
  buildPendingFilename,
  generateSprintId,
  parseSprintAck,
  type SprintAck,
} from '@sprint/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTmpShared, type TmpSharedContext } from '../__helpers__/tmpFixtures';
import { NodeFilesystemAdapter } from '../node-adapter';

import { AckStore } from './ack-store';

function buildAck(
  overrides: Partial<{
    sprint_id: ReturnType<typeof generateSprintId>;
    user_id: string;
    hostname: string;
    displayed_at: string;
    acknowledged_at: string;
    agent_version: string;
  }> = {},
): SprintAck {
  return parseSprintAck({
    schema_version: '1.0',
    sprint_id: overrides.sprint_id ?? generateSprintId(),
    user_id: overrides.user_id ?? 'joao',
    hostname: overrides.hostname ?? 'PC-PRODUCAO-01',
    displayed_at: overrides.displayed_at ?? new Date().toISOString(),
    acknowledged_at: overrides.acknowledged_at,
    agent_version: overrides.agent_version ?? '0.1.0',
  });
}

describe('AckStore — adversarial (Gate 4)', () => {
  let ctx: TmpSharedContext;
  let adapter: NodeFilesystemAdapter;
  let store: AckStore;

  beforeEach(async () => {
    ctx = await setupTmpShared('ack-adversarial');
    adapter = new NodeFilesystemAdapter();
    store = new AckStore(adapter, ctx.sharedPath);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===================================================================
  // Overwrite progressivo (3 writes consecutivos)
  // ===================================================================

  describe('overwrite progressivo (3 writes consecutivos)', () => {
    it('3 writes ao mesmo sprint/user: listAcks retorna 1 entry com campos do último write', async () => {
      const sprintId = generateSprintId();
      const userId = 'joao';
      const displayedAt = '2026-05-27T10:00:00.000Z';
      const ack1Time = '2026-05-27T10:00:03.000Z';
      const ack2Time = '2026-05-27T10:00:05.500Z';

      // Write 1: só displayed_at
      const r1 = await store.writeAck(
        buildAck({ sprint_id: sprintId, user_id: userId, displayed_at: displayedAt }),
      );
      // Write 2: +acknowledged_at (primeiro)
      const r2 = await store.writeAck(
        buildAck({
          sprint_id: sprintId,
          user_id: userId,
          displayed_at: displayedAt,
          acknowledged_at: ack1Time,
        }),
      );
      // Write 3: re-acknowledged com tempo final (simula operador reclicar)
      const r3 = await store.writeAck(
        buildAck({
          sprint_id: sprintId,
          user_id: userId,
          displayed_at: displayedAt,
          acknowledged_at: ack2Time,
        }),
      );

      expect(r1.filepath).toBe(r2.filepath);
      expect(r2.filepath).toBe(r3.filepath);

      // listAcks retorna apenas 1 entry — overwrite, não append
      const entries = await store.listAcks();
      expect(entries).toHaveLength(1);

      const [entry] = entries;
      expect(entry?.kind).toBe('ack');
      if (entry?.kind === 'ack') {
        // Campos do ÚLTIMO write
        expect(entry.payload.displayed_at).toBe(displayedAt);
        expect(entry.payload.acknowledged_at).toBe(ack2Time);
        expect(entry.payload.sprint_id).toBe(sprintId);
      }

      // Sanidade: arquivo em disco bate com a entry
      const raw = await fs.readFile(r3.filepath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, string>;
      expect(parsed.acknowledged_at).toBe(ack2Time);

      // Nenhum `.tmp` órfão pós-overwrite
      const filenames = await fs.readdir(path.join(ctx.sharedPath, 'acks'));
      expect(filenames.filter((f) => f.endsWith('.tmp'))).toEqual([]);
    });

    it('progressivo simula UC real: displayed_at → +acknowledged_at → atualização de displayed_at', async () => {
      const sprintId = generateSprintId();
      const userId = 'maria';

      const t1 = '2026-05-27T11:00:00.000Z';
      const t2 = '2026-05-27T11:00:02.000Z';
      const t3_displayed = '2026-05-27T11:01:00.000Z'; // re-exibição
      const t4_acked = '2026-05-27T11:01:01.500Z';

      // Estado 1: overlay aparece
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: userId, displayed_at: t1 }));
      // Estado 2: operador clica recebi
      await store.writeAck(
        buildAck({
          sprint_id: sprintId,
          user_id: userId,
          displayed_at: t1,
          acknowledged_at: t2,
        }),
      );
      // Estado 3: re-exibição do overlay (BL-C3-010 W2) — displayed_at atualizado
      await store.writeAck(
        buildAck({
          sprint_id: sprintId,
          user_id: userId,
          displayed_at: t3_displayed,
          acknowledged_at: t4_acked,
        }),
      );

      const entries = await store.listAcks();
      expect(entries).toHaveLength(1);
      if (entries[0]?.kind === 'ack') {
        expect(entries[0].payload.displayed_at).toBe(t3_displayed);
        expect(entries[0].payload.acknowledged_at).toBe(t4_acked);
      }
    });
  });

  // ===================================================================
  // Cenário "mistura 6 arquivos" em acks/
  //
  // 3 ack válidos + 1 arquivo malformado + 1 pending file (errado, lá)
  // + 1 não-`.json` → listAcks deve retornar 4 entries (3 ack + 1 invalid);
  // pending file e junk são ignorados via safeParseFilename.
  // ===================================================================

  describe('cenário "mistura 6 arquivos"', () => {
    async function seedMixedFolder(): Promise<{ sprintIds: readonly string[] }> {
      const acksDir = path.join(ctx.sharedPath, 'acks');

      const sprintIds = [generateSprintId(), generateSprintId(), generateSprintId()];

      await store.writeAck(buildAck({ sprint_id: sprintIds[0]!, user_id: 'joao' }));
      await store.writeAck(buildAck({ sprint_id: sprintIds[1]!, user_id: 'maria' }));
      await store.writeAck(buildAck({ sprint_id: sprintIds[2]!, user_id: 'joao' }));

      // 1 ack malformado (filename válido, conteúdo corrompido)
      const badSprintId = generateSprintId();
      const badFilename = buildAckFilename(badSprintId, 'corrupto');
      await fs.writeFile(path.join(acksDir, badFilename), '{ json corrompido');

      // 1 pending file (não pertence a acks/, deve ser ignorado)
      const pendingFn = buildPendingFilename(generateSprintId(), 'pending');
      await fs.writeFile(path.join(acksDir, pendingFn), '{}');

      // 1 arquivo não-`.json`
      await fs.writeFile(path.join(acksDir, 'NOTES.md'), 'observações');

      return { sprintIds };
    }

    it('listAcks retorna 4 entries (3 ack + 1 invalid) ignorando pending/junk', async () => {
      await seedMixedFolder();

      const entries = await store.listAcks();

      expect(entries).toHaveLength(4);
      const kinds = entries.map((e) => e.kind).sort();
      expect(kinds).toEqual(['ack', 'ack', 'ack', 'invalid']);
    });

    it('filtro userId=joao retorna apenas os 2 acks de joao', async () => {
      await seedMixedFolder();

      const entries = await store.listAcks({ userId: 'joao' });

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.kind === 'ack')).toBe(true);
      for (const entry of entries) {
        if (entry.kind === 'ack') {
          expect(entry.payload.user_id).toBe('joao');
        }
      }
    });

    it('filtro sprintId retorna apenas o ack daquele sprint', async () => {
      const { sprintIds } = await seedMixedFolder();

      const entries = await store.listAcks({ sprintId: sprintIds[0]! });

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry?.kind).toBe('ack');
      if (entry?.kind === 'ack') {
        expect(entry.payload.sprint_id).toBe(sprintIds[0]);
      }
    });

    it('filtro userId=inexistente retorna []', async () => {
      await seedMixedFolder();

      const entries = await store.listAcks({ userId: 'fantasma' });

      expect(entries).toEqual([]);
    });
  });

  // ===================================================================
  // Concorrência em larga escala
  // ===================================================================

  describe('10 writeAck concorrentes (sprint compartilhada)', () => {
    it('10 operadores ackando a MESMA sprint em paralelo: listAcks retorna 10', async () => {
      const sprintId = generateSprintId();
      const users = [
        'op01',
        'op02',
        'op03',
        'op04',
        'op05',
        'op06',
        'op07',
        'op08',
        'op09',
        'op10',
      ];
      const acks = users.map((user_id) =>
        buildAck({ sprint_id: sprintId, user_id, acknowledged_at: new Date().toISOString() }),
      );

      const results = await Promise.all(acks.map((a) => store.writeAck(a)));

      expect(new Set(results.map((r) => r.filename)).size).toBe(10);

      const entries = await store.listAcks();
      expect(entries).toHaveLength(10);
      expect(entries.every((e) => e.kind === 'ack')).toBe(true);

      // Nenhum `.tmp` órfão
      const filenames = await fs.readdir(path.join(ctx.sharedPath, 'acks'));
      expect(filenames.filter((f) => f.endsWith('.tmp'))).toEqual([]);
    });
  });
});
