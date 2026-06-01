import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from './errors';
import { NodeFilesystemAdapter } from './node-adapter';

describe('NodeFilesystemAdapter (específico)', () => {
  let tmpRoot: string;
  let adapter: NodeFilesystemAdapter;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-adapter-node-'));
    adapter = new NodeFilesystemAdapter();
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('writeFileAtomic', () => {
    it('escreve conteúdo UTF-8 corretamente', async () => {
      const target = path.join(tmpRoot, 'data.json');
      const content = JSON.stringify({ hello: 'mundo', emoji: '🚀' });
      await adapter.writeFileAtomic(target, content);
      const read = await fs.readFile(target, 'utf-8');
      expect(read).toBe(content);
    });

    it('não deixa .tmp órfão em caso de sucesso', async () => {
      const target = path.join(tmpRoot, 'data.json');
      await adapter.writeFileAtomic(target, 'x');
      const entries = await fs.readdir(tmpRoot);
      expect(entries).toEqual(['data.json']);
      expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
    });

    it('sobrescreve arquivo existente', async () => {
      const target = path.join(tmpRoot, 'data.json');
      await fs.writeFile(target, 'original', 'utf-8');
      await adapter.writeFileAtomic(target, 'novo');
      const read = await fs.readFile(target, 'utf-8');
      expect(read).toBe('novo');
    });

    it('concorrência: 2 escritas simultâneas produzem conteúdo válido', async () => {
      const target = path.join(tmpRoot, 'data.json');
      const writes = [
        adapter.writeFileAtomic(target, 'A'.repeat(100)),
        adapter.writeFileAtomic(target, 'B'.repeat(100)),
      ];
      await Promise.all(writes);
      const read = await fs.readFile(target, 'utf-8');
      // Vence quem renomeia por último; resultado é A ou B inteiro, nunca misturado
      expect(read === 'A'.repeat(100) || read === 'B'.repeat(100)).toBe(true);
    });

    it('escreve em path com caracteres especiais (espaço, acento, emoji)', async () => {
      const target = path.join(tmpRoot, 'arquivo com acento ção 🎯.json');
      await adapter.writeFileAtomic(target, 'ok');
      const read = await fs.readFile(target, 'utf-8');
      expect(read).toBe('ok');
    });

    it('escreve conteúdo grande (1MB)', async () => {
      const target = path.join(tmpRoot, 'big.txt');
      const content = 'x'.repeat(1024 * 1024);
      await adapter.writeFileAtomic(target, content);
      const stats = await fs.stat(target);
      expect(stats.size).toBe(content.length);
    });

    it('escreve string vazia', async () => {
      const target = path.join(tmpRoot, 'empty.txt');
      await adapter.writeFileAtomic(target, '');
      const read = await fs.readFile(target, 'utf-8');
      expect(read).toBe('');
    });

    it('falha se diretório pai não existe (FileNotFoundError)', async () => {
      const target = path.join(tmpRoot, 'nao-existe', 'data.json');
      // ENOENT no open mapeia para FileNotFoundError — componente do
      // path não existe.
      await expect(adapter.writeFileAtomic(target, 'x')).rejects.toBeInstanceOf(FileNotFoundError);
      const entries = await fs.readdir(tmpRoot);
      expect(entries).toEqual([]);
    });

    it('falha de rename: limpa .tmp órfão e relança o erro', async () => {
      const target = path.join(tmpRoot, 'data.json');
      const renameErr = Object.assign(new Error('access denied'), {
        code: 'EACCES',
      }) as NodeJS.ErrnoException;
      vi.spyOn(fs, 'rename').mockRejectedValueOnce(renameErr);

      await expect(adapter.writeFileAtomic(target, 'conteudo')).rejects.toBeInstanceOf(
        FilesystemIOError,
      );

      // .tmp foi limpo — não há *.tmp órfão
      const entries = await fs.readdir(tmpRoot);
      expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
    });

    it('falha de rename com cleanup também falhando: ainda relança erro original', async () => {
      const target = path.join(tmpRoot, 'data.json');
      const renameErr = Object.assign(new Error('access denied'), {
        code: 'EACCES',
      }) as NodeJS.ErrnoException;
      vi.spyOn(fs, 'rename').mockRejectedValueOnce(renameErr);
      // Cleanup do .tmp também falha — não deve impedir o relance do
      // erro original do rename
      vi.spyOn(fs, 'unlink').mockRejectedValueOnce(
        Object.assign(new Error('busy'), { code: 'EBUSY' }),
      );

      await expect(adapter.writeFileAtomic(target, 'conteudo')).rejects.toBeInstanceOf(
        FilesystemIOError,
      );
    });
  });

  describe('readFile', () => {
    it('lê arquivo existente', async () => {
      const file = path.join(tmpRoot, 'data.json');
      await fs.writeFile(file, '{"ok":true}', 'utf-8');
      expect(await adapter.readFile(file)).toBe('{"ok":true}');
    });

    it('FileNotFoundError tem propriedade filepath correta', async () => {
      const target = path.join(tmpRoot, 'nao-existe.json');
      try {
        await adapter.readFile(target);
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect(err).toBeInstanceOf(FileNotFoundError);
        expect((err as FileNotFoundError).filepath).toBe(target);
      }
    });

    it('preserva cause do Node em FileNotFoundError', async () => {
      const target = path.join(tmpRoot, 'nao-existe.json');
      try {
        await adapter.readFile(target);
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FileNotFoundError).cause).toBeDefined();
        expect(((err as FileNotFoundError).cause as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });

    it('EISDIR: readFile em diretório → FilesystemIOError', async () => {
      // tmpRoot é um diretório existente
      await expect(adapter.readFile(tmpRoot)).rejects.toBeInstanceOf(FilesystemIOError);
    });
  });

  describe('listDir', () => {
    it('lista 3 arquivos', async () => {
      await fs.writeFile(path.join(tmpRoot, 'a.txt'), '1', 'utf-8');
      await fs.writeFile(path.join(tmpRoot, 'b.txt'), '2', 'utf-8');
      await fs.writeFile(path.join(tmpRoot, 'c.txt'), '3', 'utf-8');
      const entries = await adapter.listDir(tmpRoot);
      expect(entries.sort()).toEqual(['a.txt', 'b.txt', 'c.txt']);
    });

    it('DirectoryNotFoundError em vez de FileNotFoundError para dir ausente', async () => {
      await expect(adapter.listDir(path.join(tmpRoot, 'nao-existe'))).rejects.toBeInstanceOf(
        DirectoryNotFoundError,
      );
    });

    it('FilesystemIOError para path que é arquivo (ENOTDIR)', async () => {
      const file = path.join(tmpRoot, 'file.txt');
      await fs.writeFile(file, 'x', 'utf-8');
      await expect(adapter.listDir(file)).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('listDir mapeia EACCES via mapError', async () => {
      const accessErr = Object.assign(new Error('access denied'), {
        code: 'EACCES',
      }) as NodeJS.ErrnoException;
      vi.spyOn(fs, 'readdir').mockRejectedValueOnce(accessErr);
      await expect(adapter.listDir(tmpRoot)).rejects.toBeInstanceOf(FilesystemIOError);
    });
  });

  describe('exists', () => {
    it('true para arquivo existente', async () => {
      const file = path.join(tmpRoot, 'x.txt');
      await fs.writeFile(file, '1', 'utf-8');
      expect(await adapter.exists(file)).toBe(true);
    });

    it('false para path inexistente', async () => {
      expect(await adapter.exists(path.join(tmpRoot, 'nope'))).toBe(false);
    });

    it('true para diretório existente', async () => {
      expect(await adapter.exists(tmpRoot)).toBe(true);
    });
  });

  describe('rename', () => {
    it('move arquivo', async () => {
      const from = path.join(tmpRoot, 'a.txt');
      const to = path.join(tmpRoot, 'b.txt');
      await fs.writeFile(from, 'x', 'utf-8');
      await adapter.rename(from, to);
      expect(await fs.readFile(to, 'utf-8')).toBe('x');
    });

    it('FileNotFoundError se origem não existe', async () => {
      await expect(
        adapter.rename(path.join(tmpRoot, 'nope'), path.join(tmpRoot, 'destino')),
      ).rejects.toBeInstanceOf(FileNotFoundError);
    });
  });

  describe('unlink', () => {
    it('remove arquivo', async () => {
      const file = path.join(tmpRoot, 'temp.txt');
      await fs.writeFile(file, 'x', 'utf-8');
      await adapter.unlink(file);
      expect(await adapter.exists(file)).toBe(false);
    });

    it('FileNotFoundError em arquivo inexistente', async () => {
      await expect(adapter.unlink(path.join(tmpRoot, 'nope'))).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });
  });

  describe('mkdir', () => {
    it('cria parents recursivamente', async () => {
      const deep = path.join(tmpRoot, 'a', 'b', 'c');
      await adapter.mkdir(deep);
      const stats = await fs.stat(deep);
      expect(stats.isDirectory()).toBe(true);
    });

    it('idempotente — não lança se já existe', async () => {
      const dir = path.join(tmpRoot, 'a');
      await adapter.mkdir(dir);
      await expect(adapter.mkdir(dir)).resolves.not.toThrow();
    });

    it('mkdir mapeia EACCES via mapError', async () => {
      const accessErr = Object.assign(new Error('access denied'), {
        code: 'EACCES',
      }) as NodeJS.ErrnoException;
      vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(accessErr);
      await expect(adapter.mkdir(path.join(tmpRoot, 'x'))).rejects.toBeInstanceOf(
        FilesystemIOError,
      );
    });
  });

  describe('stat', () => {
    it('retorna size e modifiedAt corretos', async () => {
      const file = path.join(tmpRoot, 'data.txt');
      const content = 'abcdef';
      await fs.writeFile(file, content, 'utf-8');
      const stat = await adapter.stat(file);
      expect(stat.size).toBe(content.length);
      expect(stat.modifiedAt).toBeInstanceOf(Date);
      expect(stat.isFile).toBe(true);
      expect(stat.isDirectory).toBe(false);
    });

    it('distingue file vs directory', async () => {
      const dir = path.join(tmpRoot, 'sub');
      await fs.mkdir(dir);
      const stat = await adapter.stat(dir);
      expect(stat.isFile).toBe(false);
      expect(stat.isDirectory).toBe(true);
    });

    it('FileNotFoundError em path inexistente', async () => {
      await expect(adapter.stat(path.join(tmpRoot, 'nope'))).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });
  });

  describe('mapError (branches via spy)', () => {
    // Cobre cada código de erro mapeado, garantindo que NodeFilesystemAdapter
    // emite a mensagem específica esperada. Usa spy em fs.readFile (caminho
    // mais simples) — qualquer outro método dispararia o mesmo mapError.

    function makeNodeErr(code: string, message = 'fake'): NodeJS.ErrnoException {
      const err = new Error(message) as NodeJS.ErrnoException;
      err.code = code;
      return err;
    }

    it('ENOTDIR via spy em readFile → "não é diretório"', async () => {
      // listDir tem caminho próprio para ENOTDIR; readFile cai no
      // mapError genérico — exercita o branch ENOTDIR do mapper.
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('ENOTDIR'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect(err).toBeInstanceOf(FilesystemIOError);
        expect((err as FilesystemIOError).message).toContain('não é diretório');
      }
    });

    it('EISDIR via spy → "é diretório (esperava arquivo)"', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('EISDIR'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect(err).toBeInstanceOf(FilesystemIOError);
        expect((err as FilesystemIOError).message).toContain('é diretório (esperava arquivo)');
      }
    });

    it('EACCES via spy → "permissão negada (EACCES)"', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('EACCES'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FilesystemIOError).message).toContain('EACCES');
      }
    });

    it('EPERM via spy → "permissão negada (EPERM)"', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('EPERM'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FilesystemIOError).message).toContain('EPERM');
      }
    });

    it('EEXIST via spy → "já existe"', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('EEXIST'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FilesystemIOError).message).toContain('já existe');
      }
    });

    it('ENOSPC via spy → "sem espaço em disco"', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('ENOSPC'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FilesystemIOError).message).toContain('sem espaço em disco');
      }
    });

    it('EBUSY via spy → "arquivo bloqueado"', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(makeNodeErr('EBUSY'));
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FilesystemIOError).message).toContain('arquivo bloqueado');
      }
    });

    it('código desconhecido via spy → "erro de I/O" com message do Node', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(
        makeNodeErr('EUNKNOWN', 'mensagem qualquer do node'),
      );
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (err) {
        expect((err as FilesystemIOError).message).toContain('erro de I/O');
        expect((err as FilesystemIOError).message).toContain('mensagem qualquer do node');
      }
    });

    it('erro sem message nem code → "desconhecido"', async () => {
      const err = new Error() as NodeJS.ErrnoException;
      // message = '' (vazio), code = undefined → cai no fallback "desconhecido"
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(err);
      try {
        await adapter.readFile('/qualquer');
        expect.fail('deveria ter lançado');
      } catch (caught) {
        expect((caught as FilesystemIOError).message).toContain('desconhecido');
      }
    });
  });
});
