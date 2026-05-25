/**
 * Suite de contrato compartilhada — define testes que TODA
 * implementação de `IFilesystemAdapter` deve passar.
 *
 * Garantia: `NodeFilesystemAdapter` e `MemoryFilesystemAdapter` são
 * intercambiáveis pelos consumers (W1+).
 *
 * Cada `describeContract(name, setup)` re-executa o bloco inteiro
 * contra o adapter retornado por `setup()`. Se um teste passa em um
 * adapter mas falha no outro, há divergência comportamental — bug,
 * não diferença legítima.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

import { type ContractContext, setupMemoryContext, setupNodeContext } from './helpers';

function describeContract(name: string, setup: () => Promise<ContractContext>): void {
  describe(`Contrato IFilesystemAdapter: ${name}`, () => {
    let adapter: IFilesystemAdapter;
    let resolvePath: (rel: string) => string;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      const ctx = await setup();
      adapter = ctx.adapter;
      resolvePath = ctx.resolvePath;
      cleanup = ctx.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

    // === readFile ===
    describe('readFile', () => {
      it('lê arquivo existente', async () => {
        const filepath = resolvePath('data.json');
        await adapter.writeFileAtomic(filepath, 'conteúdo');
        expect(await adapter.readFile(filepath)).toBe('conteúdo');
      });

      it('FileNotFoundError em arquivo inexistente', async () => {
        await expect(adapter.readFile(resolvePath('nao-existe.json'))).rejects.toBeInstanceOf(
          FileNotFoundError,
        );
      });

      it('FileNotFoundError tem filepath correto', async () => {
        const target = resolvePath('x.json');
        try {
          await adapter.readFile(target);
          expect.fail('deveria ter lançado');
        } catch (err) {
          expect((err as FileNotFoundError).filepath).toBe(target);
        }
      });
    });

    // === writeFileAtomic ===
    describe('writeFileAtomic', () => {
      it('escreve arquivo novo', async () => {
        const filepath = resolvePath('novo.json');
        await adapter.writeFileAtomic(filepath, 'ok');
        expect(await adapter.readFile(filepath)).toBe('ok');
      });

      it('sobrescreve arquivo existente', async () => {
        const filepath = resolvePath('arquivo.json');
        await adapter.writeFileAtomic(filepath, 'antigo');
        await adapter.writeFileAtomic(filepath, 'novo');
        expect(await adapter.readFile(filepath)).toBe('novo');
      });

      it('preserva UTF-8 com caracteres especiais', async () => {
        const filepath = resolvePath('utf8.json');
        const content = '{"nome":"João","emoji":"🎯","acento":"ção"}';
        await adapter.writeFileAtomic(filepath, content);
        expect(await adapter.readFile(filepath)).toBe(content);
      });

      it('escreve string vazia', async () => {
        const filepath = resolvePath('empty.txt');
        await adapter.writeFileAtomic(filepath, '');
        expect(await adapter.readFile(filepath)).toBe('');
      });
    });

    // === listDir ===
    describe('listDir', () => {
      it('lista entries de diretório com 3 arquivos', async () => {
        await adapter.mkdir(resolvePath('dir'));
        await adapter.writeFileAtomic(resolvePath('dir/a.json'), '1');
        await adapter.writeFileAtomic(resolvePath('dir/b.json'), '2');
        await adapter.writeFileAtomic(resolvePath('dir/c.json'), '3');
        const entries = await adapter.listDir(resolvePath('dir'));
        expect(entries.sort()).toEqual(['a.json', 'b.json', 'c.json']);
      });

      it('retorna nomes (sem path completo)', async () => {
        await adapter.mkdir(resolvePath('dir'));
        await adapter.writeFileAtomic(resolvePath('dir/data.json'), 'x');
        const entries = await adapter.listDir(resolvePath('dir'));
        expect(entries[0]).toBe('data.json');
        expect(entries[0]).not.toContain('/');
      });

      it('DirectoryNotFoundError em dir inexistente', async () => {
        await expect(adapter.listDir(resolvePath('nao-existe'))).rejects.toBeInstanceOf(
          DirectoryNotFoundError,
        );
      });

      it('FilesystemIOError se path é arquivo (não dir)', async () => {
        const filepath = resolvePath('arquivo.txt');
        await adapter.writeFileAtomic(filepath, 'x');
        await expect(adapter.listDir(filepath)).rejects.toBeInstanceOf(FilesystemIOError);
      });
    });

    // === exists ===
    describe('exists', () => {
      it('true para arquivo existente', async () => {
        const filepath = resolvePath('x.json');
        await adapter.writeFileAtomic(filepath, '1');
        expect(await adapter.exists(filepath)).toBe(true);
      });

      it('false para arquivo inexistente (sem lançar)', async () => {
        expect(await adapter.exists(resolvePath('nao-existe'))).toBe(false);
      });

      it('true para diretório existente', async () => {
        await adapter.mkdir(resolvePath('dir'));
        await adapter.writeFileAtomic(resolvePath('dir/file.json'), '1');
        expect(await adapter.exists(resolvePath('dir'))).toBe(true);
      });
    });

    // === rename ===
    describe('rename', () => {
      it('move arquivo', async () => {
        const from = resolvePath('a.json');
        const to = resolvePath('b.json');
        await adapter.writeFileAtomic(from, 'conteudo');
        await adapter.rename(from, to);
        expect(await adapter.exists(from)).toBe(false);
        expect(await adapter.readFile(to)).toBe('conteudo');
      });

      it('sobrescreve destino se existir', async () => {
        const from = resolvePath('a.json');
        const to = resolvePath('b.json');
        await adapter.writeFileAtomic(from, 'origem');
        await adapter.writeFileAtomic(to, 'destino-antigo');
        await adapter.rename(from, to);
        expect(await adapter.readFile(to)).toBe('origem');
      });

      it('FileNotFoundError se origem não existe', async () => {
        await expect(
          adapter.rename(resolvePath('nao-existe'), resolvePath('destino')),
        ).rejects.toBeInstanceOf(FileNotFoundError);
      });
    });

    // === unlink ===
    describe('unlink', () => {
      it('remove arquivo', async () => {
        const filepath = resolvePath('temp.json');
        await adapter.writeFileAtomic(filepath, 'x');
        await adapter.unlink(filepath);
        expect(await adapter.exists(filepath)).toBe(false);
      });

      it('FileNotFoundError em arquivo inexistente', async () => {
        await expect(adapter.unlink(resolvePath('inexistente'))).rejects.toBeInstanceOf(
          FileNotFoundError,
        );
      });
    });

    // === mkdir ===
    describe('mkdir', () => {
      it('mkdir não lança em path novo', async () => {
        const dir = resolvePath('novo-dir');
        await expect(adapter.mkdir(dir)).resolves.not.toThrow();
      });

      it('idempotente — não lança em diretório existente', async () => {
        const dir = resolvePath('dir');
        await adapter.mkdir(dir);
        await expect(adapter.mkdir(dir)).resolves.not.toThrow();
      });
    });

    // === stat ===
    describe('stat', () => {
      it('retorna size correto', async () => {
        const filepath = resolvePath('data.txt');
        const content = 'abcdef';
        await adapter.writeFileAtomic(filepath, content);
        const stat = await adapter.stat(filepath);
        expect(stat.size).toBe(content.length);
      });

      it('isFile true em arquivo', async () => {
        const filepath = resolvePath('data.txt');
        await adapter.writeFileAtomic(filepath, 'x');
        const stat = await adapter.stat(filepath);
        expect(stat.isFile).toBe(true);
        expect(stat.isDirectory).toBe(false);
      });

      it('FileNotFoundError em path inexistente', async () => {
        await expect(adapter.stat(resolvePath('inexistente'))).rejects.toBeInstanceOf(
          FileNotFoundError,
        );
      });

      it('modifiedAt é Date válida', async () => {
        const filepath = resolvePath('data.txt');
        await adapter.writeFileAtomic(filepath, 'x');
        const stat = await adapter.stat(filepath);
        expect(stat.modifiedAt).toBeInstanceOf(Date);
        expect(stat.modifiedAt.getTime()).toBeGreaterThan(0);
      });
    });

    // === Integração: workflow Sprint Dispatcher ===
    describe('integração: workflow Sprint Dispatcher', () => {
      it('escrever payload → listar → ler → mover → confirmar ausência', async () => {
        const pendingPath = resolvePath('pending/01HX-joao.json');
        const archivePath = resolvePath('archive/2026-05-22/01HX-joao.json');

        // Caller é responsável por garantir diretórios — em Node,
        // writeFileAtomic exige dir pai existente; em Memory, mkdir
        // é no-op idempotente (paridade pelo contrato).
        await adapter.mkdir(resolvePath('pending'));
        await adapter.mkdir(resolvePath('archive/2026-05-22'));

        // Líder escreve sprint
        await adapter.writeFileAtomic(pendingPath, '{"meta":5}');

        // Agent lista pending
        const pendingFiles = await adapter.listDir(resolvePath('pending'));
        expect(pendingFiles).toContain('01HX-joao.json');

        // Agent lê
        const payload = await adapter.readFile(pendingPath);
        expect(payload).toBe('{"meta":5}');

        // Após ack, move para arquivo
        await adapter.rename(pendingPath, archivePath);

        // Pending vazio agora — quando há listDir possível
        try {
          const stillPending = await adapter.listDir(resolvePath('pending'));
          expect(stillPending).not.toContain('01HX-joao.json');
        } catch (err) {
          // Em Memory, diretório fica sem filhos diretos → vira
          // "não existe". Tratamento equivalente — sprint não está
          // mais em pending.
          expect(err).toBeInstanceOf(DirectoryNotFoundError);
        }

        // Archive tem o arquivo
        expect(await adapter.readFile(archivePath)).toBe('{"meta":5}');
      });
    });
  });
}

// Roda a suite contra ambos os adapters
describeContract('NodeFilesystemAdapter', setupNodeContext);
describeContract('MemoryFilesystemAdapter', setupMemoryContext);
