import { generateSprintId, parseSprintPayload, safeParseSprintPayload } from '@sprint/contracts';
import { describe, expect, it, vi } from 'vitest';

import { FileNotFoundError, FilesystemIOError } from '../errors';
import type { FileStat, IFilesystemAdapter } from '../interface';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { readAndParseJson, type SafeParser } from './read-and-parse';

interface User {
  name: string;
}

const parseUser: SafeParser<User> = (raw) => {
  if (typeof raw === 'object' && raw !== null && 'name' in raw && typeof raw.name === 'string') {
    return { success: true, data: { name: raw.name } };
  }
  return { success: false, error: new Error('expected { name: string }') };
};

/**
 * Helper: cria stub mínimo de adapter que joga um erro pré-definido no
 * `readFile`. Os demais métodos são no-ops (não exercitados pelos testes
 * que usam este stub).
 */
function adapterRejectingReadFile(err: Error): IFilesystemAdapter {
  const stub: IFilesystemAdapter = {
    readFile: () => Promise.reject(err),
    writeFileAtomic: () => Promise.resolve(),
    listDir: () => Promise.resolve([]),
    exists: () => Promise.resolve(false),
    rename: () => Promise.resolve(),
    unlink: () => Promise.resolve(),
    mkdir: () => Promise.resolve(),
    stat: (): Promise<FileStat> =>
      Promise.resolve({
        size: 0,
        modifiedAt: new Date(0),
        isFile: true,
        isDirectory: false,
      }),
    probeWritePermission: () => Promise.resolve(true),
  };
  return stub;
}

describe('readAndParseJson', () => {
  describe('happy path', () => {
    it('retorna ok: true com data parseada para arquivo + JSON + schema válidos', async () => {
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/u.json', JSON.stringify({ name: 'João' }));

      const result = await readAndParseJson(adapter, '/u.json', parseUser);

      expect(result).toEqual({ ok: true, data: { name: 'João' } });
    });

    it('aceita conteúdo com caracteres acentuados (UTF-8)', async () => {
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic(
        '/u.json',
        JSON.stringify({ name: 'Conceição — produção 200 ✓' }),
      );

      const result = await readAndParseJson(adapter, '/u.json', parseUser);

      expect(result).toEqual({ ok: true, data: { name: 'Conceição — produção 200 ✓' } });
    });
  });

  describe('falhas convertidas em ok: false', () => {
    it('arquivo inexistente retorna kind: not-found', async () => {
      const adapter = new MemoryFilesystemAdapter();

      const result = await readAndParseJson(adapter, '/missing.json', parseUser);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe('not-found');
        expect(result.reason).toContain('não encontrado');
        expect(result.reason).toContain('/missing.json');
      }
    });

    it('JSON malformado retorna kind: invalid + reason "JSON inválido"', async () => {
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/broken.json', '{ not valid json');

      const result = await readAndParseJson(adapter, '/broken.json', parseUser);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe('invalid');
        expect(result.reason).toContain('JSON inválido');
      }
    });

    it('arquivo vazio retorna kind: invalid + reason "JSON inválido"', async () => {
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/empty.json', '');

      const result = await readAndParseJson(adapter, '/empty.json', parseUser);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe('invalid');
        expect(result.reason).toContain('JSON inválido');
      }
    });

    it('JSON válido mas schema falha retorna kind: invalid + reason "schema inválido"', async () => {
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/wrong.json', JSON.stringify({ wrong: 'field' }));

      const result = await readAndParseJson(adapter, '/wrong.json', parseUser);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe('invalid');
        expect(result.reason).toContain('schema inválido');
        expect(result.reason).toContain('expected { name: string }');
      }
    });

    it('JSON é null (válido para JSON.parse) mas schema rejeita', async () => {
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/null.json', 'null');

      const result = await readAndParseJson(adapter, '/null.json', parseUser);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('schema inválido');
      }
    });

    it('JSON.parse jogando valor não-Error é tratado defensivamente', async () => {
      // JSON.parse na realidade SEMPRE joga SyntaxError (extends Error). Este
      // teste exercita o fallback defensivo `String(err)` via mock — garante
      // 100% de branch coverage e blinda contra mudanças futuras no
      // comportamento do JSON.parse (ex: VM/runtime customizado).
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/x.json', 'qualquer-coisa');
      const spy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
        // Joga uma string crua (não-Error) — caso TS-extremo, mas possível
        // em runtimes não-conformes.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'algo crú não-Error';
      });
      try {
        const result = await readAndParseJson(adapter, '/x.json', parseUser);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('JSON inválido');
          expect(result.reason).toContain('algo crú não-Error');
        }
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('erros que propagam', () => {
    it('FilesystemIOError (permissão negada, etc) propaga sem conversão', async () => {
      const adapter = adapterRejectingReadFile(new FilesystemIOError('/x', 'permissão negada'));

      await expect(readAndParseJson(adapter, '/x', parseUser)).rejects.toBeInstanceOf(
        FilesystemIOError,
      );
    });

    it('erro não-Filesystem propaga sem encapsular', async () => {
      const adapter = adapterRejectingReadFile(new Error('algo totalmente inesperado'));

      await expect(readAndParseJson(adapter, '/x', parseUser)).rejects.toThrow(
        'algo totalmente inesperado',
      );
    });

    it('FileNotFoundError NÃO propaga — vira ok: false', async () => {
      const adapter = adapterRejectingReadFile(new FileNotFoundError('/x'));

      const result = await readAndParseJson(adapter, '/x', parseUser);

      expect(result.ok).toBe(false);
    });
  });

  describe('integração com safeParseSprintPayload', () => {
    it('roundtrip: escreve SprintPayload sintético, lê e parseia via safeParseSprintPayload', async () => {
      const sprintId = generateSprintId();
      // parseSprintPayload aplica o branding em sprint_id/user_id e o
      // literal '1.0' em schema_version — evita o gotcha G-005 (CLAUDE
      // §12: branded types vs literal de objeto cru).
      const payload = parseSprintPayload({
        schema_version: '1.0',
        sprint_id: sprintId,
        criado_por: 'Renan',
        criado_em: new Date().toISOString(),
        user_id: 'joao',
        title: 'Meta diária',
        body_html: '<p>Produzir 200 unidades</p>',
        meta: 200,
        deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const adapter = new MemoryFilesystemAdapter();
      await adapter.writeFileAtomic('/p.json', JSON.stringify(payload));

      const result = await readAndParseJson(adapter, '/p.json', safeParseSprintPayload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.sprint_id).toBe(sprintId);
        expect(result.data.user_id).toBe('joao');
        expect(result.data.meta).toBe(200);
      }
    });

    it('SprintPayload corrompido (campo ausente) retorna ok: false com reason de schema', async () => {
      const adapter = new MemoryFilesystemAdapter();
      // Falta sprint_id, user_id, etc — schema vai rejeitar.
      await adapter.writeFileAtomic('/p.json', JSON.stringify({ title: 'só título' }));

      const result = await readAndParseJson(adapter, '/p.json', safeParseSprintPayload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('schema inválido');
      }
    });
  });
});
