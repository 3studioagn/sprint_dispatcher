/**
 * Testes adversariais do PendingStore — concorrência em larga escala,
 * mtime ordering com fs.utimes real, race de pasta removida.
 *
 * Separado de `pending-store.test.ts` (cenários enumeráveis) para que
 * a leitura mantenha contrato uniforme: tests existentes usam
 * MemoryFilesystemAdapter (rápido, determinístico); estes usam
 * NodeFilesystemAdapter contra tmp dir real (necessário para `fs.utimes`
 * e race conditions reais).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildAckFilename,
  buildCancelFilename,
  buildPendingFilename,
  generateSprintId,
  parseSprintCancel,
  parseSprintPayload,
  type SprintCancelInput,
  type SprintPayload,
} from '@sprint/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupTmpShared, type TmpSharedContext } from '../__helpers__/tmpFixtures';
import { DirectoryNotFoundError } from '../errors';
import { NodeFilesystemAdapter } from '../node-adapter';

import { PendingStore } from './pending-store';

function buildPayload(
  overrides: Partial<{
    sprint_id: ReturnType<typeof generateSprintId>;
    user_id: string;
    criado_por: string;
    criado_em: string;
    title: string;
    body_html: string;
    meta: number;
    deadline_at: string;
  }> = {},
): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: overrides.sprint_id ?? generateSprintId(),
    criado_por: overrides.criado_por ?? 'Renan',
    criado_em: overrides.criado_em ?? new Date().toISOString(),
    user_id: overrides.user_id ?? 'joao',
    title: overrides.title ?? 'Meta diária',
    body_html: overrides.body_html ?? '<p>Produzir 200 unidades</p>',
    meta: overrides.meta ?? 200,
    deadline_at: overrides.deadline_at ?? new Date(Date.now() + 3_600_000).toISOString(),
  });
}

describe('PendingStore — adversarial (Gate 4)', () => {
  let ctx: TmpSharedContext;
  let adapter: NodeFilesystemAdapter;
  let store: PendingStore;

  beforeEach(async () => {
    ctx = await setupTmpShared('pending-adversarial');
    adapter = new NodeFilesystemAdapter();
    store = new PendingStore(adapter, ctx.sharedPath);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===================================================================
  // Concorrência em larga escala
  // ===================================================================

  describe('10 writePendingSprint concorrentes', () => {
    it('10 sprints distintas (users diferentes) em paralelo: listPending retorna 10', async () => {
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
      const payloads = users.map((user_id) => buildPayload({ user_id }));

      const results = await Promise.all(payloads.map((p) => store.writePendingSprint(p)));

      expect(new Set(results.map((r) => r.filename)).size).toBe(10);

      // Nenhum `.tmp` órfão na pasta
      const filenames = await fs.readdir(path.join(ctx.sharedPath, 'pending'));
      expect(filenames.filter((f) => f.endsWith('.tmp'))).toEqual([]);

      const entries = await store.listPending();
      expect(entries).toHaveLength(10);
      expect(entries.every((e) => e.kind === 'sprint')).toBe(true);
    });

    it('10 sprints iguais (mesmo user, sprint_ids diferentes) em paralelo: nada se mistura', async () => {
      const sprintIds = Array.from({ length: 10 }, () => generateSprintId());
      const payloads = sprintIds.map((sprint_id) => buildPayload({ sprint_id, user_id: 'joao' }));

      const results = await Promise.all(payloads.map((p) => store.writePendingSprint(p)));

      expect(new Set(results.map((r) => r.filename)).size).toBe(10);

      const entries = await store.listPending();
      expect(entries).toHaveLength(10);
      const seenSprintIds = new Set(
        entries.flatMap((e) => (e.kind === 'sprint' ? [e.payload.sprint_id] : [])),
      );
      expect(seenSprintIds.size).toBe(10);
    });
  });

  // ===================================================================
  // mtime ordering real — fs.utimes
  // ===================================================================

  describe('listPending ordering com fs.utimes real', () => {
    it('reordena por modifiedAt mesmo quando readdir retorna ordem natural', async () => {
      const sprintA = generateSprintId();
      const sprintB = generateSprintId();
      const sprintC = generateSprintId();

      // Escreve A, B, C nessa ordem (modifiedAt natural seria A < B < C)
      const rA = await store.writePendingSprint(
        buildPayload({ sprint_id: sprintA, user_id: 'aaaa' }),
      );
      const rB = await store.writePendingSprint(
        buildPayload({ sprint_id: sprintB, user_id: 'bbbb' }),
      );
      const rC = await store.writePendingSprint(
        buildPayload({ sprint_id: sprintC, user_id: 'cccc' }),
      );

      // Inverte mtime via fs.utimes: A vira o mais novo, C o mais antigo
      const now = Date.now();
      await fs.utimes(rA.filepath, new Date(now - 1000), new Date(now)); // mtime: now
      await fs.utimes(rB.filepath, new Date(now - 1000), new Date(now - 5000)); // mtime: 5s atrás
      await fs.utimes(rC.filepath, new Date(now - 1000), new Date(now - 10_000)); // mtime: 10s atrás

      const entries = await store.listPending();

      expect(entries).toHaveLength(3);
      // Sort ascendente por mtime → C (mais antigo) primeiro, A (mais novo) último
      expect(entries[0]?.filename).toBe(`${sprintC}-cccc.json`);
      expect(entries[1]?.filename).toBe(`${sprintB}-bbbb.json`);
      expect(entries[2]?.filename).toBe(`${sprintA}-aaaa.json`);
    });
  });

  // ===================================================================
  // Race condition: pasta removida entre operações
  // ===================================================================

  describe('race: pasta pending/ removida', () => {
    it('listPending lança DirectoryNotFoundError após rm da pasta', async () => {
      await store.writePendingSprint(buildPayload());

      // Remove a pasta entre operações
      await fs.rm(path.join(ctx.sharedPath, 'pending'), { recursive: true });

      await expect(store.listPending()).rejects.toBeInstanceOf(DirectoryNotFoundError);
    });

    it('recriar a pasta + listPending volta a funcionar (0 entries)', async () => {
      await store.writePendingSprint(buildPayload());

      await fs.rm(path.join(ctx.sharedPath, 'pending'), { recursive: true });
      await expect(store.listPending()).rejects.toBeInstanceOf(DirectoryNotFoundError);

      await fs.mkdir(path.join(ctx.sharedPath, 'pending'));
      const entries = await store.listPending();
      expect(entries).toEqual([]);
    });
  });

  // ===================================================================
  // Cenário "mistura grande" (8 arquivos diferentes em pending/)
  //
  // 3 sprint válidos + 2 cancel + 1 malformado + 1 .tmp + 1 não-.json
  // listPending deve retornar 6 entries (3 sprint + 2 cancel + 1 invalid);
  // .tmp e arquivos não-reconhecidos são ignorados via safeParseFilename.
  // ===================================================================

  describe('cenário "mistura 8 arquivos"', () => {
    async function seedMixedFolder(): Promise<{
      sprintIds: readonly string[];
      cancelIds: readonly string[];
      badFilename: string;
    }> {
      const pendingDir = path.join(ctx.sharedPath, 'pending');
      const store = new PendingStore(adapter, ctx.sharedPath);

      // 3 sprint files válidos
      const sprintIds = [generateSprintId(), generateSprintId(), generateSprintId()];
      await store.writePendingSprint(buildPayload({ sprint_id: sprintIds[0]!, user_id: 'joao' }));
      await store.writePendingSprint(buildPayload({ sprint_id: sprintIds[1]!, user_id: 'maria' }));
      await store.writePendingSprint(buildPayload({ sprint_id: sprintIds[2]!, user_id: 'joao' }));

      // 2 cancel files válidos (gravados diretos no FS — CancelStore é stub W2)
      const cancelIds = [generateSprintId(), generateSprintId()];
      const cancelFn1 = buildCancelFilename(cancelIds[0]!);
      const cancelFn2 = buildCancelFilename(cancelIds[1]!);
      await fs.writeFile(
        path.join(pendingDir, cancelFn1),
        JSON.stringify(
          parseSprintCancel({
            schema_version: '1.0',
            type: 'cancel',
            sprint_id_ref: cancelIds[0]!,
            cancelado_por: 'Renan',
            cancelado_em: new Date().toISOString(),
          } satisfies SprintCancelInput),
        ),
      );
      await fs.writeFile(
        path.join(pendingDir, cancelFn2),
        JSON.stringify(
          parseSprintCancel({
            schema_version: '1.0',
            type: 'cancel',
            sprint_id_ref: cancelIds[1]!,
            cancelado_por: 'Renan',
            cancelado_em: new Date().toISOString(),
          } satisfies SprintCancelInput),
        ),
      );

      // 1 arquivo malformado (filename válido, conteúdo corrompido)
      const badSprintId = generateSprintId();
      const badFilename = buildPendingFilename(badSprintId, 'corrupto');
      await fs.writeFile(path.join(pendingDir, badFilename), '{ json corrompido sem fechar');

      // 1 arquivo `.tmp` (não deve ser listado)
      await fs.writeFile(path.join(pendingDir, `${generateSprintId()}-joao.json.abc123.tmp`), '{}');

      // 1 arquivo não-`.json` (não casa com regex de filename)
      await fs.writeFile(path.join(pendingDir, 'README.txt'), 'documentação');

      // 1 ack file (não deve aparecer em listPending — pertence a acks/)
      const ackFn = buildAckFilename(sprintIds[0]!, 'joao');
      await fs.writeFile(path.join(pendingDir, ackFn), '{}');

      return { sprintIds, cancelIds, badFilename };
    }

    it('listPending retorna 6 entries (3 sprint + 2 cancel + 1 invalid) ignorando .tmp/junk/ack', async () => {
      await seedMixedFolder();
      const store = new PendingStore(adapter, ctx.sharedPath);

      const entries = await store.listPending();

      expect(entries).toHaveLength(6);
      const kinds = entries.map((e) => e.kind).sort();
      expect(kinds).toEqual(['cancel', 'cancel', 'invalid', 'sprint', 'sprint', 'sprint']);
    });

    it('filtro userId=joao retorna apenas as 2 sprints de joao (cancels excluídos por design)', async () => {
      await seedMixedFolder();
      const store = new PendingStore(adapter, ctx.sharedPath);

      const entries = await store.listPending({ userId: 'joao' });

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.kind === 'sprint')).toBe(true);
      for (const entry of entries) {
        if (entry.kind === 'sprint') {
          expect(entry.payload.user_id).toBe('joao');
        }
      }
    });

    it('filtro userId=maria retorna 1 sprint de maria', async () => {
      await seedMixedFolder();
      const store = new PendingStore(adapter, ctx.sharedPath);

      const entries = await store.listPending({ userId: 'maria' });

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry?.kind).toBe('sprint');
      if (entry?.kind === 'sprint') {
        expect(entry.payload.user_id).toBe('maria');
      }
    });

    it('filtro userId=inexistente retorna []', async () => {
      await seedMixedFolder();
      const store = new PendingStore(adapter, ctx.sharedPath);

      const entries = await store.listPending({ userId: 'fantasma' });

      expect(entries).toEqual([]);
    });

    it('filtro sprintId de cancel retorna apenas esse cancel', async () => {
      const { cancelIds } = await seedMixedFolder();
      const store = new PendingStore(adapter, ctx.sharedPath);

      const entries = await store.listPending({ sprintId: cancelIds[0]! });

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry?.kind).toBe('cancel');
    });

    it('filtro sprintId inexistente retorna []', async () => {
      await seedMixedFolder();
      const store = new PendingStore(adapter, ctx.sharedPath);

      const entries = await store.listPending({ sprintId: generateSprintId() });

      expect(entries).toEqual([]);
    });
  });

  // ===================================================================
  // Race: arquivo desaparece entre listDir e stat (real FS)
  // ===================================================================

  describe('race: arquivo deletado entre listDir e stat', () => {
    it('listPending skipa silenciosamente arquivo que sumiu mid-listing', async () => {
      const sprintA = generateSprintId();
      const sprintB = generateSprintId();
      await store.writePendingSprint(buildPayload({ sprint_id: sprintA, user_id: 'aaaa' }));
      await store.writePendingSprint(buildPayload({ sprint_id: sprintB, user_id: 'bbbb' }));

      // Simula race: deleta um dos arquivos APÓS listDir, ANTES de stat.
      // Como listDir é síncrono no eventloop, intervir entre listDir e
      // stat requer monkey-patching. Em alternativa, usamos um filename
      // que NÃO existe mas casa o regex: cria → lista → deleta entre
      // ciclos. Aqui usamos abordagem mais simples: pre-escreve um
      // pending mockado via filename válido, depois deleta DURANTE o
      // listPending via setImmediate.
      const ghostFilename = buildPendingFilename(generateSprintId(), 'ghost');
      const ghostPath = path.join(ctx.sharedPath, 'pending', ghostFilename);
      await fs.writeFile(ghostPath, JSON.stringify(buildPayload()));

      // Schedule a deletion na próxima tick — listPending vai stat-ar
      // depois de ler dir mas pode pegar o arquivo já removido
      const deletePromise = (async () => {
        await new Promise((resolve) => setImmediate(resolve));
        await fs.rm(ghostPath, { force: true });
      })();

      const [entries] = await Promise.all([store.listPending(), deletePromise]);

      // A, B sempre presentes; ghost pode ou não estar (depende do timing)
      const filenames = entries.map((e) => e.filename);
      expect(filenames).toContain(`${sprintA}-aaaa.json`);
      expect(filenames).toContain(`${sprintB}-bbbb.json`);
      // No worst case (ghost foi pego antes do delete): 3 entries
      // No happy case (ghost foi deletado a tempo): 2 entries
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries.length).toBeLessThanOrEqual(3);
    });
  });
});
