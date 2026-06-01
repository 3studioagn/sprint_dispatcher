import path from 'node:path';

import {
  buildAckFilename,
  buildCancelFilename,
  ContractValidationError,
  FilenameParseError,
  generateSprintId,
  parseSprintCancel,
  parseSprintPayload,
  type SprintCancel,
  type SprintPayload,
} from '@sprint/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from '../errors';
import type { FileStat, IFilesystemAdapter } from '../interface';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { PendingStore } from './pending-store';

/**
 * Constrói um SprintPayload válido para testes. Permite override de
 * qualquer campo via `overrides`. Usa `parseSprintPayload` para garantir
 * branding correto (G-005).
 */
function buildPayload(
  overrides: Partial<{
    sprint_id: ReturnType<typeof generateSprintId>;
    user_id: string;
    title: string;
    body_html: string;
    meta: number;
    criado_por: string;
  }> = {},
): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: overrides.sprint_id ?? generateSprintId(),
    criado_por: overrides.criado_por ?? 'Renan',
    criado_em: new Date().toISOString(),
    user_id: overrides.user_id ?? 'joao',
    title: overrides.title ?? 'Meta diária',
    body_html: overrides.body_html ?? '<p>Produzir 200 unidades</p>',
    meta: overrides.meta ?? 200,
    deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

/**
 * Constrói um SprintCancel válido. Cancel não tem método write na
 * PendingStore desta sessão (BL-C4-004 é W2/Gate 6 stub), então testes
 * gravam cancels diretamente via adapter.
 */
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

const SHARED = '/shared';
const PENDING_DIR = path.posix.join(SHARED, 'pending');

/**
 * Grava um cancel file diretamente via adapter (PendingStore não tem
 * writeCancel até BL-C4-004 W2).
 */
async function seedCancel(adapter: IFilesystemAdapter, cancel: SprintCancel): Promise<string> {
  const filename = buildCancelFilename(cancel.sprint_id_ref);
  const filepath = path.posix.join(PENDING_DIR, filename);
  await adapter.mkdir(PENDING_DIR);
  await adapter.writeFileAtomic(filepath, JSON.stringify(cancel, null, 2));
  return filename;
}

/**
 * Helper: pausa para garantir que `modifiedAt` do próximo write difere
 * em pelo menos 1ms (MemoryFilesystemAdapter usa `new Date()` ms-precision).
 */
async function tick(ms = 5): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('PendingStore.writePendingSprint', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: PendingStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new PendingStore(adapter, SHARED);
  });

  describe('happy path', () => {
    it('escreve arquivo em /pending/<sprintId>-<userId>.json', async () => {
      const sprintId = generateSprintId();
      const payload = buildPayload({ sprint_id: sprintId, user_id: 'maria' });

      const result = await store.writePendingSprint(payload);

      expect(result.filename).toBe(`${sprintId}-maria.json`);
      expect(result.filepath).toBe(`/shared/pending/${sprintId}-maria.json`);
      await expect(adapter.exists(result.filepath)).resolves.toBe(true);
    });

    it('conteúdo gravado é JSON parseável com todos os campos do payload', async () => {
      const payload = buildPayload({ user_id: 'carlos', meta: 350 });

      const { filepath } = await store.writePendingSprint(payload);

      const raw = await adapter.readFile(filepath);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed.schema_version).toBe('1.0');
      expect(parsed.sprint_id).toBe(payload.sprint_id);
      expect(parsed.user_id).toBe('carlos');
      expect(parsed.meta).toBe(350);
      expect(parsed.title).toBe(payload.title);
      expect(parsed.criado_em).toBe(payload.criado_em);
      expect(parsed.deadline_at).toBe(payload.deadline_at);
    });

    it('JSON gravado é pretty-printed (2-space indent) para inspeção manual', async () => {
      const payload = buildPayload();

      const { filepath } = await store.writePendingSprint(payload);

      const raw = await adapter.readFile(filepath);
      expect(raw).toContain('\n');
      expect(raw).toMatch(/\n {2}"/);
    });

    it('preserva caracteres UTF-8 no title e body_html', async () => {
      const payload = buildPayload({
        title: 'Produção urgente — meta diária',
        body_html: '<p>Atenção: meta de hoje é 250 ✓</p>',
      });

      const { filepath } = await store.writePendingSprint(payload);

      const raw = await adapter.readFile(filepath);
      const parsed = JSON.parse(raw) as { title: string; body_html: string };
      expect(parsed.title).toBe('Produção urgente — meta diária');
      expect(parsed.body_html).toContain('Atenção');
      expect(parsed.body_html).toContain('✓');
    });
  });

  describe('sanitização de body_html (CLAUDE §7.9)', () => {
    it('remove <script> mantendo o conteúdo textual', async () => {
      const payload = buildPayload({
        body_html: '<p>Aviso</p><script>alert("xss")</script>',
      });

      const { filepath } = await store.writePendingSprint(payload);

      const parsed = JSON.parse(await adapter.readFile(filepath)) as { body_html: string };
      expect(parsed.body_html).not.toContain('<script');
      expect(parsed.body_html).not.toContain('alert');
      expect(parsed.body_html).toContain('<p>Aviso</p>');
    });

    it('remove handlers inline (onerror, onclick) preservando tag-base', async () => {
      const payload = buildPayload({
        body_html: '<p onclick="evil()">Texto</p>',
      });

      const { filepath } = await store.writePendingSprint(payload);

      const parsed = JSON.parse(await adapter.readFile(filepath)) as { body_html: string };
      expect(parsed.body_html).not.toContain('onclick');
      expect(parsed.body_html).not.toContain('evil');
      expect(parsed.body_html).toContain('Texto');
    });

    it('é idempotente — body_html já sanitizado passa intacto', async () => {
      const cleanHtml = '<p>Conteúdo limpo</p>';
      const payload = buildPayload({ body_html: cleanHtml });

      const { filepath } = await store.writePendingSprint(payload);

      const parsed = JSON.parse(await adapter.readFile(filepath)) as { body_html: string };
      expect(parsed.body_html).toBe(cleanHtml);
    });
  });

  describe('defesa em profundidade — re-validação via parseSprintPayload', () => {
    it('lança ContractValidationError em sprint_id inválido (cast bypassed)', async () => {
      const bad = {
        ...buildPayload(),
        sprint_id: 'NOT-A-VALID-ULID',
      } as unknown as SprintPayload;

      await expect(store.writePendingSprint(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em user_id inválido', async () => {
      const bad = {
        ...buildPayload(),
        user_id: 'INVALID_UPPERCASE',
      } as unknown as SprintPayload;

      await expect(store.writePendingSprint(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em meta <= 0 (estrutural OK; Zod refinement quebra)', async () => {
      const bad = {
        ...buildPayload(),
        meta: 0,
      };

      await expect(store.writePendingSprint(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em body_html vazio (min 1 no Zod)', async () => {
      const bad = {
        ...buildPayload(),
        body_html: '',
      };

      await expect(store.writePendingSprint(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });
  });

  describe('estrutura de diretório', () => {
    it('chama mkdir(<sharedPath>/pending) antes de writeFileAtomic', async () => {
      const mkdirSpy = vi.spyOn(adapter, 'mkdir');
      const writeSpy = vi.spyOn(adapter, 'writeFileAtomic');

      await store.writePendingSprint(buildPayload());

      expect(mkdirSpy).toHaveBeenCalledWith('/shared/pending');
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const mkdirOrder = mkdirSpy.mock.invocationCallOrder[0];
      const writeOrder = writeSpy.mock.invocationCallOrder[0];
      expect(mkdirOrder).toBeDefined();
      expect(writeOrder).toBeDefined();
      expect(mkdirOrder!).toBeLessThan(writeOrder!);
    });

    it('aceita sharedPath com trailing slash', async () => {
      const storeWithSlash = new PendingStore(adapter, '/shared/');
      const sprintId = generateSprintId();
      const payload = buildPayload({ sprint_id: sprintId, user_id: 'ana' });

      const result = await storeWithSlash.writePendingSprint(payload);

      expect(result.filepath).toBe(`/shared/pending/${sprintId}-ana.json`);
      await expect(adapter.exists(result.filepath)).resolves.toBe(true);
    });
  });

  describe('write concorrente e overwrite', () => {
    it('3 sprints diferentes em paralelo não colidem', async () => {
      const payloads = [
        buildPayload({ user_id: 'joao' }),
        buildPayload({ user_id: 'maria' }),
        buildPayload({ user_id: 'carlos' }),
      ];

      const results = await Promise.all(payloads.map((p) => store.writePendingSprint(p)));

      expect(new Set(results.map((r) => r.filename)).size).toBe(3);
      for (const result of results) {
        await expect(adapter.exists(result.filepath)).resolves.toBe(true);
      }
    });

    it('overwrite do mesmo sprint/user substitui conteúdo anterior', async () => {
      const sprintId = generateSprintId();
      const p1 = buildPayload({ sprint_id: sprintId, user_id: 'joao', meta: 100 });
      const p2 = buildPayload({ sprint_id: sprintId, user_id: 'joao', meta: 999 });

      const r1 = await store.writePendingSprint(p1);
      const r2 = await store.writePendingSprint(p2);

      expect(r1.filepath).toBe(r2.filepath);
      const final = JSON.parse(await adapter.readFile(r2.filepath)) as { meta: number };
      expect(final.meta).toBe(999);
    });
  });
});

describe('PendingStore.listPending', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: PendingStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new PendingStore(adapter, SHARED);
  });

  describe('happy path', () => {
    it('lista 1 sprint válido como kind: sprint', async () => {
      const sprintId = generateSprintId();
      await store.writePendingSprint(buildPayload({ sprint_id: sprintId, user_id: 'joao' }));

      const entries = await store.listPending();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      expect(entry!.kind).toBe('sprint');
      if (entry?.kind === 'sprint') {
        expect(entry.payload.sprint_id).toBe(sprintId);
        expect(entry.payload.user_id).toBe('joao');
        expect(entry.filename).toBe(`${sprintId}-joao.json`);
        expect(entry.modifiedAt).toBeInstanceOf(Date);
      }
    });

    it('lista 3 sprints distintos', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));
      await store.writePendingSprint(buildPayload({ user_id: 'maria' }));
      await store.writePendingSprint(buildPayload({ user_id: 'carlos' }));

      const entries = await store.listPending();

      expect(entries).toHaveLength(3);
      expect(entries.every((e) => e.kind === 'sprint')).toBe(true);
    });

    it('lista cancel files (gravados direto via adapter) como kind: cancel', async () => {
      const sprintId = generateSprintId();
      const cancel = buildCancel({ sprint_id_ref: sprintId, motivo: 'Reset diário' });
      await seedCancel(adapter, cancel);

      const entries = await store.listPending();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('cancel');
      if (entry?.kind === 'cancel') {
        expect(entry.payload.sprint_id_ref).toBe(sprintId);
        expect(entry.payload.motivo).toBe('Reset diário');
      }
    });

    it('lista mix de sprint + cancel com kinds corretos', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));
      await seedCancel(adapter, buildCancel());

      const entries = await store.listPending();

      expect(entries).toHaveLength(2);
      const kinds = entries.map((e) => e.kind).sort();
      expect(kinds).toEqual(['cancel', 'sprint']);
    });

    it('retorna [] quando pasta contém apenas arquivos não-reconhecidos', async () => {
      // safeParseFilename rejeita: junk names, .tmp, hidden files, .ack.json
      // em pending/ (apesar de ack.json ser válido como tipo, ele NÃO é
      // pending nem cancel, então listPending ignora).
      await adapter.mkdir(PENDING_DIR);
      await adapter.writeFileAtomic(`${PENDING_DIR}/foo.json`, '{}');
      await adapter.writeFileAtomic(`${PENDING_DIR}/.hidden`, '{}');
      await adapter.writeFileAtomic(`${PENDING_DIR}/README.txt`, 'text');
      await adapter.writeFileAtomic(
        `${PENDING_DIR}/${buildAckFilename(generateSprintId(), 'joao')}`,
        '{}',
      );

      const entries = await store.listPending();

      expect(entries).toEqual([]);
    });
  });

  describe('arquivos malformados (RN-09)', () => {
    it('arquivo com JSON malformado retorna kind: invalid', async () => {
      const sprintId = generateSprintId();
      const filename = `${sprintId}-joao.json`;
      await adapter.mkdir(PENDING_DIR);
      await adapter.writeFileAtomic(`${PENDING_DIR}/${filename}`, '{ corrompido');

      const entries = await store.listPending();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('invalid');
      if (entry?.kind === 'invalid') {
        expect(entry.filename).toBe(filename);
        expect(entry.reason).toContain('JSON inválido');
      }
    });

    it('arquivo com JSON válido mas schema falho retorna kind: invalid', async () => {
      const sprintId = generateSprintId();
      const filename = `${sprintId}-joao.json`;
      await adapter.mkdir(PENDING_DIR);
      await adapter.writeFileAtomic(
        `${PENDING_DIR}/${filename}`,
        JSON.stringify({ wrong: 'shape' }),
      );

      const entries = await store.listPending();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('invalid');
      if (entry?.kind === 'invalid') {
        expect(entry.reason).toContain('schema inválido');
      }
    });

    it('1 sprint válido + 1 arquivo malformado: entrega 1 sprint + 1 invalid', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));
      const badId = generateSprintId();
      await adapter.writeFileAtomic(`${PENDING_DIR}/${badId}-broken.json`, '{ broken');

      const entries = await store.listPending();

      expect(entries).toHaveLength(2);
      const kinds = entries.map((e) => e.kind).sort();
      expect(kinds).toEqual(['invalid', 'sprint']);
    });

    it('arquivo cancel com JSON malformado também retorna kind: invalid', async () => {
      const sprintId = generateSprintId();
      const filename = buildCancelFilename(sprintId);
      await adapter.mkdir(PENDING_DIR);
      await adapter.writeFileAtomic(`${PENDING_DIR}/${filename}`, '{ cancel-corrompido');

      const entries = await store.listPending();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('invalid');
      if (entry?.kind === 'invalid') {
        expect(entry.filename).toBe(filename);
        expect(entry.reason).toContain('JSON inválido');
      }
    });
  });

  describe('filtros', () => {
    it('filtro userId retorna só pending do user (cancel sempre excluído)', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));
      await store.writePendingSprint(buildPayload({ user_id: 'maria' }));
      await seedCancel(adapter, buildCancel());

      const entries = await store.listPending({ userId: 'joao' });

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('sprint');
      if (entry?.kind === 'sprint') {
        expect(entry.payload.user_id).toBe('joao');
      }
    });

    it('filtro sprintId retorna pending e cancel daquele sprint_id', async () => {
      const target = generateSprintId();
      await store.writePendingSprint(buildPayload({ sprint_id: target, user_id: 'joao' }));
      await store.writePendingSprint(buildPayload({ user_id: 'maria' }));
      await seedCancel(adapter, buildCancel({ sprint_id_ref: target }));

      const entries = await store.listPending({ sprintId: target });

      expect(entries).toHaveLength(2);
      const kinds = entries.map((e) => e.kind).sort();
      expect(kinds).toEqual(['cancel', 'sprint']);
    });

    it('filtros combinados (userId + sprintId) aplicam ambos', async () => {
      const target = generateSprintId();
      await store.writePendingSprint(buildPayload({ sprint_id: target, user_id: 'joao' }));
      await store.writePendingSprint(buildPayload({ sprint_id: target, user_id: 'maria' }));
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));

      const entries = await store.listPending({ userId: 'joao', sprintId: target });

      expect(entries).toHaveLength(1);
      if (entries[0]?.kind === 'sprint') {
        expect(entries[0].payload.user_id).toBe('joao');
        expect(entries[0].payload.sprint_id).toBe(target);
      }
    });

    it('filtros não-matchantes retornam []', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));

      const entries = await store.listPending({ userId: 'inexistente' });

      expect(entries).toEqual([]);
    });
  });

  describe('ordenação cronológica', () => {
    it('ordena por modifiedAt ascendente — mais antigo primeiro', async () => {
      const sprintA = generateSprintId();
      const sprintB = generateSprintId();
      const sprintC = generateSprintId();

      // Insere em ordem A (mais antigo), B, C (mais novo) com mtime diferente
      await store.writePendingSprint(buildPayload({ sprint_id: sprintA, user_id: 'aaaa' }));
      await tick();
      await store.writePendingSprint(buildPayload({ sprint_id: sprintB, user_id: 'bbbb' }));
      await tick();
      await store.writePendingSprint(buildPayload({ sprint_id: sprintC, user_id: 'cccc' }));

      // Spy em listDir para forçar ordem REVERSA — comprova que o sort faz
      // o trabalho, não a ordem natural do adapter
      const listDirSpy = vi
        .spyOn(adapter, 'listDir')
        .mockResolvedValueOnce([
          `${sprintC}-cccc.json`,
          `${sprintB}-bbbb.json`,
          `${sprintA}-aaaa.json`,
        ]);

      const entries = await store.listPending();

      expect(listDirSpy).toHaveBeenCalled();
      expect(entries).toHaveLength(3);
      // Sort ascendente por mtime → A primeiro, C último
      expect(entries[0]?.filename).toBe(`${sprintA}-aaaa.json`);
      expect(entries[1]?.filename).toBe(`${sprintB}-bbbb.json`);
      expect(entries[2]?.filename).toBe(`${sprintC}-cccc.json`);
    });
  });

  describe('erros e race conditions', () => {
    it('lança DirectoryNotFoundError quando /pending não existe', async () => {
      await expect(store.listPending()).rejects.toBeInstanceOf(DirectoryNotFoundError);
    });

    it('propaga FilesystemIOError não-FileNotFoundError do stat', async () => {
      await store.writePendingSprint(buildPayload());
      vi.spyOn(adapter, 'stat').mockRejectedValueOnce(
        new FilesystemIOError('/x', 'permissão negada'),
      );

      await expect(store.listPending()).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('race no stat (FileNotFoundError) skipa o arquivo silenciosamente', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));
      await store.writePendingSprint(buildPayload({ user_id: 'maria' }));
      // 1ª chamada de stat falha como race; 2ª retorna normal
      const realStat = adapter.stat.bind(adapter);
      let call = 0;
      vi.spyOn(adapter, 'stat').mockImplementation((filepath: string): Promise<FileStat> => {
        call += 1;
        if (call === 1) return Promise.reject(new FileNotFoundError(filepath));
        return realStat(filepath);
      });

      const entries = await store.listPending();

      expect(entries).toHaveLength(1);
    });

    it('race no readFile (FileNotFoundError) skipa silenciosamente, não vira invalid', async () => {
      await store.writePendingSprint(buildPayload({ user_id: 'joao' }));
      vi.spyOn(adapter, 'readFile').mockRejectedValueOnce(new FileNotFoundError('/race'));

      const entries = await store.listPending();

      expect(entries).toEqual([]);
    });

    it('race no readFile de cancel também skipa silenciosamente', async () => {
      await seedCancel(adapter, buildCancel());
      vi.spyOn(adapter, 'readFile').mockRejectedValueOnce(new FileNotFoundError('/race'));

      const entries = await store.listPending();

      expect(entries).toEqual([]);
    });
  });
});

describe('PendingStore.deletePending', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: PendingStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new PendingStore(adapter, SHARED);
  });

  it('remove arquivo de pending existente', async () => {
    const sprintId = generateSprintId();
    const { filename, filepath } = await store.writePendingSprint(
      buildPayload({ sprint_id: sprintId, user_id: 'joao' }),
    );
    await expect(adapter.exists(filepath)).resolves.toBe(true);

    await store.deletePending(filename);

    await expect(adapter.exists(filepath)).resolves.toBe(false);
  });

  it('remove arquivo de cancel (também vive em pending/)', async () => {
    const cancel = buildCancel();
    const filename = await seedCancel(adapter, cancel);
    const filepath = path.posix.join(PENDING_DIR, filename);
    await expect(adapter.exists(filepath)).resolves.toBe(true);

    await store.deletePending(filename);

    await expect(adapter.exists(filepath)).resolves.toBe(false);
  });

  it('rejeita filename ack (defesa em profundidade — ack pertence a acks/)', async () => {
    const ackFilename = buildAckFilename(generateSprintId(), 'joao');

    await expect(store.deletePending(ackFilename)).rejects.toBeInstanceOf(FilenameParseError);
  });

  it('rejeita filename mal-formado com FilenameParseError', async () => {
    await expect(store.deletePending('foo.json')).rejects.toBeInstanceOf(FilenameParseError);
  });

  it('rejeita filename com path traversal', async () => {
    await expect(store.deletePending('../../etc/passwd')).rejects.toBeInstanceOf(
      FilenameParseError,
    );
  });

  it('propaga FileNotFoundError quando arquivo não existe', async () => {
    const filename = `${generateSprintId()}-fantasma.json`;

    await expect(store.deletePending(filename)).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
