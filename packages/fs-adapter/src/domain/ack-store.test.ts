import path from 'node:path';

import {
  buildPendingFilename,
  ContractValidationError,
  generateSprintId,
  parseSprintAck,
  type SprintAck,
} from '@sprint/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from '../errors';
import type { FileStat } from '../interface';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { AckStore } from './ack-store';

/**
 * Constrói um SprintAck válido. Permite override de qualquer campo.
 * Usa `parseSprintAck` para garantir branding (G-005).
 */
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

const SHARED = '/shared';
const ACKS_DIR = path.posix.join(SHARED, 'acks');

async function tick(ms = 5): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AckStore.writeAck', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: AckStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new AckStore(adapter, SHARED);
  });

  describe('happy path', () => {
    it('escreve arquivo em /acks/<sprintId>-<userId>.ack.json', async () => {
      const sprintId = generateSprintId();
      const ack = buildAck({ sprint_id: sprintId, user_id: 'maria' });

      const result = await store.writeAck(ack);

      expect(result.filename).toBe(`${sprintId}-maria.ack.json`);
      expect(result.filepath).toBe(`/shared/acks/${sprintId}-maria.ack.json`);
      await expect(adapter.exists(result.filepath)).resolves.toBe(true);
    });

    it('conteúdo gravado é JSON parseável com todos os campos do ack', async () => {
      const ack = buildAck({
        user_id: 'carlos',
        hostname: 'PC-PRODUCAO-42',
        agent_version: '1.2.3',
      });

      const { filepath } = await store.writeAck(ack);

      const parsed = JSON.parse(await adapter.readFile(filepath)) as Record<string, unknown>;
      expect(parsed.schema_version).toBe('1.0');
      expect(parsed.sprint_id).toBe(ack.sprint_id);
      expect(parsed.user_id).toBe('carlos');
      expect(parsed.hostname).toBe('PC-PRODUCAO-42');
      expect(parsed.agent_version).toBe('1.2.3');
      expect(parsed.displayed_at).toBe(ack.displayed_at);
    });

    it('JSON gravado é pretty-printed (2-space indent) consistente com pending-store', async () => {
      const ack = buildAck();

      const { filepath } = await store.writeAck(ack);

      const raw = await adapter.readFile(filepath);
      expect(raw).toContain('\n');
      expect(raw).toMatch(/\n {2}"/);
    });

    it('preserva caracteres UTF-8 no hostname', async () => {
      const ack = buildAck({ hostname: 'PC-Joaõ-Confecção' });

      const { filepath } = await store.writeAck(ack);

      const parsed = JSON.parse(await adapter.readFile(filepath)) as { hostname: string };
      expect(parsed.hostname).toBe('PC-Joaõ-Confecção');
    });

    it('omite acknowledged_at quando não foi setado (campo opcional)', async () => {
      const ack = buildAck();

      const { filepath } = await store.writeAck(ack);

      const parsed = JSON.parse(await adapter.readFile(filepath)) as Record<string, unknown>;
      expect(parsed.acknowledged_at).toBeUndefined();
    });
  });

  describe('overwrite — caso de uso explícito BL-C4-006', () => {
    it('escreve ack só com displayed_at, depois reescreve com acknowledged_at adicionado', async () => {
      const sprintId = generateSprintId();
      const displayedAt = new Date('2026-05-25T10:00:00.000Z').toISOString();
      const acknowledgedAt = new Date('2026-05-25T10:00:03.500Z').toISOString();

      const initial = buildAck({
        sprint_id: sprintId,
        user_id: 'joao',
        displayed_at: displayedAt,
      });
      const r1 = await store.writeAck(initial);
      const firstContent = JSON.parse(await adapter.readFile(r1.filepath)) as Record<
        string,
        unknown
      >;
      expect(firstContent.acknowledged_at).toBeUndefined();
      expect(firstContent.displayed_at).toBe(displayedAt);

      const updated = buildAck({
        sprint_id: sprintId,
        user_id: 'joao',
        displayed_at: displayedAt,
        acknowledged_at: acknowledgedAt,
      });
      const r2 = await store.writeAck(updated);

      expect(r1.filepath).toBe(r2.filepath);
      const finalContent = JSON.parse(await adapter.readFile(r2.filepath)) as Record<
        string,
        unknown
      >;
      expect(finalContent.displayed_at).toBe(displayedAt);
      expect(finalContent.acknowledged_at).toBe(acknowledgedAt);
    });
  });

  describe('defesa em profundidade — re-validação via parseSprintAck', () => {
    it('lança ContractValidationError em sprint_id inválido (cast bypassed)', async () => {
      const bad = {
        ...buildAck(),
        sprint_id: 'NOT-A-VALID-ULID',
      } as unknown as SprintAck;

      await expect(store.writeAck(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em user_id inválido', async () => {
      const bad = {
        ...buildAck(),
        user_id: 'INVALID_UPPERCASE',
      } as unknown as SprintAck;

      await expect(store.writeAck(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em hostname vazio (min 1)', async () => {
      const bad = {
        ...buildAck(),
        hostname: '',
      };

      await expect(store.writeAck(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em agent_version fora do formato semver', async () => {
      const bad = {
        ...buildAck(),
        agent_version: 'not-semver',
      };

      await expect(store.writeAck(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });

    it('lança ContractValidationError em displayed_at não-ISO', async () => {
      const bad = {
        ...buildAck(),
        displayed_at: 'ontem às 3 da tarde',
      };

      await expect(store.writeAck(bad)).rejects.toBeInstanceOf(ContractValidationError);
    });
  });

  describe('estrutura de diretório', () => {
    it('chama mkdir(<sharedPath>/acks) antes de writeFileAtomic', async () => {
      const mkdirSpy = vi.spyOn(adapter, 'mkdir');
      const writeSpy = vi.spyOn(adapter, 'writeFileAtomic');

      await store.writeAck(buildAck());

      expect(mkdirSpy).toHaveBeenCalledWith('/shared/acks');
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const mkdirOrder = mkdirSpy.mock.invocationCallOrder[0];
      const writeOrder = writeSpy.mock.invocationCallOrder[0];
      expect(mkdirOrder).toBeDefined();
      expect(writeOrder).toBeDefined();
      expect(mkdirOrder!).toBeLessThan(writeOrder!);
    });

    it('aceita sharedPath com trailing slash', async () => {
      const storeWithSlash = new AckStore(adapter, '/shared/');
      const sprintId = generateSprintId();
      const ack = buildAck({ sprint_id: sprintId, user_id: 'ana' });

      const result = await storeWithSlash.writeAck(ack);

      expect(result.filepath).toBe(`/shared/acks/${sprintId}-ana.ack.json`);
    });
  });

  describe('write concorrente', () => {
    it('3 acks de operadores diferentes em paralelo não colidem', async () => {
      const sprintId = generateSprintId();
      const acks = [
        buildAck({ sprint_id: sprintId, user_id: 'joao' }),
        buildAck({ sprint_id: sprintId, user_id: 'maria' }),
        buildAck({ sprint_id: sprintId, user_id: 'carlos' }),
      ];

      const results = await Promise.all(acks.map((a) => store.writeAck(a)));

      expect(new Set(results.map((r) => r.filename)).size).toBe(3);
      for (const result of results) {
        await expect(adapter.exists(result.filepath)).resolves.toBe(true);
      }
    });
  });
});

describe('AckStore.listAcks', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: AckStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new AckStore(adapter, SHARED);
  });

  describe('happy path', () => {
    it('lista 1 ack válido como kind: ack', async () => {
      const sprintId = generateSprintId();
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'joao' }));

      const entries = await store.listAcks();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('ack');
      if (entry?.kind === 'ack') {
        expect(entry.payload.sprint_id).toBe(sprintId);
        expect(entry.payload.user_id).toBe('joao');
        expect(entry.filename).toBe(`${sprintId}-joao.ack.json`);
        expect(entry.modifiedAt).toBeInstanceOf(Date);
      }
    });

    it('lista 3 acks distintos', async () => {
      const sprintId = generateSprintId();
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'joao' }));
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'maria' }));
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'carlos' }));

      const entries = await store.listAcks();

      expect(entries).toHaveLength(3);
      expect(entries.every((e) => e.kind === 'ack')).toBe(true);
    });

    it('retorna [] quando pasta contém apenas arquivos não-ack', async () => {
      // Pending file na pasta de acks (anormal) deve ser ignorado
      await adapter.mkdir(ACKS_DIR);
      await adapter.writeFileAtomic(
        `${ACKS_DIR}/${buildPendingFilename(generateSprintId(), 'joao')}`,
        '{}',
      );
      await adapter.writeFileAtomic(`${ACKS_DIR}/junk.json`, '{}');
      await adapter.writeFileAtomic(`${ACKS_DIR}/.hidden`, '{}');

      const entries = await store.listAcks();

      expect(entries).toEqual([]);
    });
  });

  describe('arquivos malformados (RN-09)', () => {
    it('arquivo com JSON malformado retorna kind: invalid', async () => {
      const sprintId = generateSprintId();
      const filename = `${sprintId}-joao.ack.json`;
      await adapter.mkdir(ACKS_DIR);
      await adapter.writeFileAtomic(`${ACKS_DIR}/${filename}`, '{ corrompido');

      const entries = await store.listAcks();

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
      const filename = `${sprintId}-joao.ack.json`;
      await adapter.mkdir(ACKS_DIR);
      await adapter.writeFileAtomic(`${ACKS_DIR}/${filename}`, JSON.stringify({ wrong: 'shape' }));

      const entries = await store.listAcks();

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry!.kind).toBe('invalid');
      if (entry?.kind === 'invalid') {
        expect(entry.reason).toContain('schema inválido');
      }
    });
  });

  describe('filtros', () => {
    it('filtro userId retorna só acks daquele user', async () => {
      const sprintId = generateSprintId();
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'joao' }));
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'maria' }));

      const entries = await store.listAcks({ userId: 'joao' });

      expect(entries).toHaveLength(1);
      if (entries[0]?.kind === 'ack') {
        expect(entries[0].payload.user_id).toBe('joao');
      }
    });

    it('filtro sprintId retorna acks daquele sprint', async () => {
      const target = generateSprintId();
      await store.writeAck(buildAck({ sprint_id: target, user_id: 'joao' }));
      await store.writeAck(buildAck({ user_id: 'maria' }));

      const entries = await store.listAcks({ sprintId: target });

      expect(entries).toHaveLength(1);
      if (entries[0]?.kind === 'ack') {
        expect(entries[0].payload.sprint_id).toBe(target);
      }
    });

    it('filtros combinados (userId + sprintId)', async () => {
      const target = generateSprintId();
      await store.writeAck(buildAck({ sprint_id: target, user_id: 'joao' }));
      await store.writeAck(buildAck({ sprint_id: target, user_id: 'maria' }));
      await store.writeAck(buildAck({ user_id: 'joao' }));

      const entries = await store.listAcks({ userId: 'joao', sprintId: target });

      expect(entries).toHaveLength(1);
      if (entries[0]?.kind === 'ack') {
        expect(entries[0].payload.user_id).toBe('joao');
        expect(entries[0].payload.sprint_id).toBe(target);
      }
    });
  });

  describe('ordenação cronológica', () => {
    it('ordena por modifiedAt ascendente — mais antigo primeiro', async () => {
      const sprintId = generateSprintId();
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'aaaa' }));
      await tick();
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'bbbb' }));
      await tick();
      await store.writeAck(buildAck({ sprint_id: sprintId, user_id: 'cccc' }));

      // Spy em listDir para forçar ordem REVERSA
      vi.spyOn(adapter, 'listDir').mockResolvedValueOnce([
        `${sprintId}-cccc.ack.json`,
        `${sprintId}-bbbb.ack.json`,
        `${sprintId}-aaaa.ack.json`,
      ]);

      const entries = await store.listAcks();

      expect(entries).toHaveLength(3);
      expect(entries[0]?.filename).toBe(`${sprintId}-aaaa.ack.json`);
      expect(entries[1]?.filename).toBe(`${sprintId}-bbbb.ack.json`);
      expect(entries[2]?.filename).toBe(`${sprintId}-cccc.ack.json`);
    });
  });

  describe('erros e race conditions', () => {
    it('lança DirectoryNotFoundError quando /acks não existe', async () => {
      await expect(store.listAcks()).rejects.toBeInstanceOf(DirectoryNotFoundError);
    });

    it('propaga FilesystemIOError não-FileNotFoundError do stat', async () => {
      await store.writeAck(buildAck());
      vi.spyOn(adapter, 'stat').mockRejectedValueOnce(
        new FilesystemIOError('/x', 'permissão negada'),
      );

      await expect(store.listAcks()).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('race no stat (FileNotFoundError) skipa silenciosamente', async () => {
      await store.writeAck(buildAck({ user_id: 'joao' }));
      await store.writeAck(buildAck({ user_id: 'maria' }));
      const realStat = adapter.stat.bind(adapter);
      let call = 0;
      vi.spyOn(adapter, 'stat').mockImplementation((filepath: string): Promise<FileStat> => {
        call += 1;
        if (call === 1) return Promise.reject(new FileNotFoundError(filepath));
        return realStat(filepath);
      });

      const entries = await store.listAcks();

      expect(entries).toHaveLength(1);
    });

    it('race no readFile (FileNotFoundError) skipa, não vira invalid', async () => {
      await store.writeAck(buildAck());
      vi.spyOn(adapter, 'readFile').mockRejectedValueOnce(new FileNotFoundError('/race'));

      const entries = await store.listAcks();

      expect(entries).toEqual([]);
    });
  });
});
