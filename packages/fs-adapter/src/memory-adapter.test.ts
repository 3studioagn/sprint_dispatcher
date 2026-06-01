import { describe, expect, it } from 'vitest';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from './errors';
import { MemoryFilesystemAdapter } from './memory-adapter';

describe('MemoryFilesystemAdapter (específico)', () => {
  describe('seed() / reset() (helpers de teste)', () => {
    it('seed() popula entries de teste', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({
        '/sprint/pending/01HX-joao.json': '{"meta":5}',
        '/sprint/acks/01HX-joao.ack.json': '{"acknowledged_at":"..."}',
      });
      expect(await fs.readFile('/sprint/pending/01HX-joao.json')).toBe('{"meta":5}');
      expect(await fs.exists('/sprint/acks/01HX-joao.ack.json')).toBe(true);
    });

    it('reset() limpa todos os entries', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({ '/a.txt': 'x', '/b.txt': 'y' });
      fs.reset();
      expect(await fs.exists('/a.txt')).toBe(false);
      expect(await fs.exists('/b.txt')).toBe(false);
    });

    it('seed() normaliza paths', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({ '//a///b/': 'normalized' });
      expect(await fs.readFile('/a/b')).toBe('normalized');
    });
  });

  describe('semântica de diretório implícito', () => {
    it('diretório implícito existe se há arquivos dentro', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/sprint/pending/01HX-joao.json', 'x');
      expect(await fs.exists('/sprint/pending')).toBe(true);
      expect(await fs.exists('/sprint')).toBe(true);
    });

    it('diretório implícito retorna isDirectory: true em stat()', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/sprint/file.txt', 'x');
      const stat = await fs.stat('/sprint');
      expect(stat.isDirectory).toBe(true);
      expect(stat.isFile).toBe(false);
      expect(stat.size).toBe(0);
    });

    it('mkdir é no-op idempotente', async () => {
      const fs = new MemoryFilesystemAdapter();
      await expect(fs.mkdir('/qualquer/path')).resolves.not.toThrow();
      await expect(fs.mkdir('/qualquer/path')).resolves.not.toThrow();
    });

    it('raiz `/` é sempre considerada diretório existente', async () => {
      const fs = new MemoryFilesystemAdapter();
      expect(await fs.exists('/')).toBe(true);
      const stat = await fs.stat('/');
      expect(stat.isDirectory).toBe(true);
    });
  });

  describe('listDir', () => {
    it('retorna apenas filhos diretos (não recursivo)', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({
        '/sprint/pending/a.json': '1',
        '/sprint/pending/b.json': '2',
        '/sprint/pending/sub/c.json': '3',
        '/sprint/acks/d.json': '4',
      });
      const entries = await fs.listDir('/sprint/pending');
      expect(entries.sort()).toEqual(['a.json', 'b.json', 'sub']);
    });

    it('DirectoryNotFoundError em path inexistente', async () => {
      const fs = new MemoryFilesystemAdapter();
      await expect(fs.listDir('/inexistente')).rejects.toBeInstanceOf(DirectoryNotFoundError);
    });

    it('FilesystemIOError se path é arquivo (não diretório)', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/x.txt', 'y');
      await expect(fs.listDir('/x.txt')).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('listDir da raiz retorna entries de primeiro nível', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({
        '/a.txt': '1',
        '/b/x.txt': '2',
        '/c/d/y.txt': '3',
      });
      const entries = await fs.listDir('/');
      expect(entries.sort()).toEqual(['a.txt', 'b', 'c']);
    });
  });

  describe('rename', () => {
    it('move conteúdo, atualiza modifiedAt', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({ '/a.txt': 'hello' });
      const statBefore = await fs.stat('/a.txt');
      await new Promise((resolve) => setTimeout(resolve, 5));
      await fs.rename('/a.txt', '/b.txt');
      expect(await fs.exists('/a.txt')).toBe(false);
      expect(await fs.readFile('/b.txt')).toBe('hello');
      const statAfter = await fs.stat('/b.txt');
      expect(statAfter.modifiedAt.getTime()).toBeGreaterThan(statBefore.modifiedAt.getTime());
    });

    it('FileNotFoundError se origem não existe', async () => {
      const fs = new MemoryFilesystemAdapter();
      await expect(fs.rename('/nao-existe', '/destino')).rejects.toBeInstanceOf(FileNotFoundError);
    });
  });

  describe('readFile', () => {
    it('lê conteúdo de arquivo', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({ '/a.txt': 'hello' });
      expect(await fs.readFile('/a.txt')).toBe('hello');
    });

    it('FileNotFoundError em arquivo inexistente', async () => {
      const fs = new MemoryFilesystemAdapter();
      await expect(fs.readFile('/nope')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('FilesystemIOError ao tentar ler diretório implícito', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/sprint/data.json', 'x');
      await expect(fs.readFile('/sprint')).rejects.toBeInstanceOf(FilesystemIOError);
    });
  });

  describe('writeFileAtomic', () => {
    it('sobrescreve entrada existente', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/a.txt', 'first');
      await fs.writeFileAtomic('/a.txt', 'second');
      expect(await fs.readFile('/a.txt')).toBe('second');
    });

    it('FilesystemIOError se path é diretório implícito', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/dir/file.txt', 'x');
      await expect(fs.writeFileAtomic('/dir', 'y')).rejects.toBeInstanceOf(FilesystemIOError);
    });
  });

  describe('unlink', () => {
    it('remove arquivo', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({ '/a.txt': 'x' });
      await fs.unlink('/a.txt');
      expect(await fs.exists('/a.txt')).toBe(false);
    });

    it('FileNotFoundError em arquivo inexistente', async () => {
      const fs = new MemoryFilesystemAdapter();
      await expect(fs.unlink('/nope')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('FilesystemIOError ao tentar unlink de diretório implícito', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/dir/file.txt', 'x');
      await expect(fs.unlink('/dir')).rejects.toBeInstanceOf(FilesystemIOError);
    });
  });

  describe('stat', () => {
    it('FileNotFoundError em path inexistente', async () => {
      const fs = new MemoryFilesystemAdapter();
      await expect(fs.stat('/nope')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('retorna size correto para arquivos', async () => {
      const fs = new MemoryFilesystemAdapter();
      fs.seed({ '/a.txt': 'abcdef' });
      const stat = await fs.stat('/a.txt');
      expect(stat.size).toBe(6);
      expect(stat.isFile).toBe(true);
    });
  });

  describe('normalização de paths', () => {
    it('normaliza barras duplas', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('//sprint///pending//a.json', 'x');
      expect(await fs.readFile('/sprint/pending/a.json')).toBe('x');
    });

    it('normaliza trailing slash', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/sprint/pending/a.json/', 'x');
      expect(await fs.readFile('/sprint/pending/a.json')).toBe('x');
    });

    it('paths equivalentes resolvem ao mesmo entry', async () => {
      const fs = new MemoryFilesystemAdapter();
      await fs.writeFileAtomic('/a.txt', 'original');
      await fs.writeFileAtomic('//a.txt//', 'overwrite');
      expect(await fs.readFile('/a.txt')).toBe('overwrite');
    });
  });

  describe('isolamento entre instâncias', () => {
    it('duas instâncias têm filesystems independentes', async () => {
      const fs1 = new MemoryFilesystemAdapter();
      const fs2 = new MemoryFilesystemAdapter();
      await fs1.writeFileAtomic('/a.txt', 'em fs1');
      expect(await fs1.exists('/a.txt')).toBe(true);
      expect(await fs2.exists('/a.txt')).toBe(false);
    });
  });
});
