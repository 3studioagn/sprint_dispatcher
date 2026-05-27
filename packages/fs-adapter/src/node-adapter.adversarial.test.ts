/**
 * Testes adversariais do `NodeFilesystemAdapter`.
 *
 * Separado de `node-adapter.test.ts` (cenários enumeráveis) para
 * concentrar:
 * - Escala (10 concorrentes, 10MB)
 * - Cobertura defensiva de catches (lines 50-51 e 63-64 do source —
 *   ramo `handle.close()` rejeitando)
 * - Linux/macOS-only (permission revoked)
 */
import { promises as fs } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FilesystemIOError } from './errors';
import { NodeFilesystemAdapter } from './node-adapter';

// Mock seletivo de `open` para conseguir injetar FileHandle "ruim" em
// testes de cleanup. Default deixa a implementação real funcionando —
// `mockResolvedValueOnce` em cada teste sobrescreve só a próxima chamada.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    default: actual,
    open: vi.fn(actual.open),
  };
});

/**
 * Constrói um FileHandle mock cujos métodos críticos são `vi.fn()`.
 * `as unknown as FileHandle` é necessário porque o tipo real tem 15+
 * métodos que não precisamos para estes testes.
 */
function makeFakeFileHandle(opts: {
  writeFileRejects?: Error;
  syncRejects?: Error;
  closeRejects?: Error;
}): FileHandle {
  return {
    writeFile: opts.writeFileRejects
      ? vi.fn().mockRejectedValue(opts.writeFileRejects)
      : vi.fn().mockResolvedValue(undefined),
    sync: opts.syncRejects
      ? vi.fn().mockRejectedValue(opts.syncRejects)
      : vi.fn().mockResolvedValue(undefined),
    close: opts.closeRejects
      ? vi.fn().mockRejectedValue(opts.closeRejects)
      : vi.fn().mockResolvedValue(undefined),
    fd: 0,
  } as unknown as FileHandle;
}

describe('NodeFilesystemAdapter — adversarial (Gate 4)', () => {
  let tmpRoot: string;
  let adapter: NodeFilesystemAdapter;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-adversarial-'));
    adapter = new NodeFilesystemAdapter();
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ===================================================================
  // Concorrência em larga escala
  // ===================================================================

  describe('writeFileAtomic — concorrência em larga escala', () => {
    // Nota Windows (gotcha): rename simultâneo ao mesmo destino dá EPERM
    // em alta contenção — o Win32 não serializa renames atômicos como o
    // POSIX. Por isso o cenário "10 escritas concorrentes ao MESMO path"
    // só roda em Linux/macOS. Em Windows o cenário equivalente é o de
    // paths distintos (próximo teste), que sempre passa.
    it.runIf(os.platform() !== 'win32')(
      '10 escritas simultâneas ao mesmo path: vence o último, sem .tmp órfão',
      async () => {
        const target = path.join(tmpRoot, 'shared.txt');
        const writes = Array.from({ length: 10 }, (_, i) =>
          adapter.writeFileAtomic(target, `WRITER-${String(i)}-${'x'.repeat(1000)}`),
        );
        await Promise.all(writes);

        const entries = await fs.readdir(tmpRoot);
        expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
        expect(entries).toEqual(['shared.txt']);

        const finalContent = await fs.readFile(target, 'utf-8');
        const validInputs = Array.from(
          { length: 10 },
          (_, i) => `WRITER-${String(i)}-${'x'.repeat(1000)}`,
        );
        expect(validInputs).toContain(finalContent);
      },
    );

    it('10 escritas a paths DIFERENTES em paralelo: todas sucedem, sem .tmp', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        adapter.writeFileAtomic(
          path.join(tmpRoot, `file-${String(i)}.txt`),
          `content-${String(i)}`,
        ),
      );
      await Promise.all(writes);

      const entries = await fs.readdir(tmpRoot);
      const sorted = entries.sort();
      expect(sorted).toHaveLength(10);
      expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
    });

    it('estado FINAL após 20 writes concorrentes a paths distintos é .tmp-livre', async () => {
      // Importante: `.tmp` pode aparecer EM listDir DURANTE a janela
      // entre `open(tmpPath, 'w')` e `rename(tmpPath, filepath)` —
      // atomicidade do writeFileAtomic é sobre o CONTEÚDO (sem leitura
      // de arquivo parcial), não sobre invisibilidade do `.tmp`. O
      // domain layer (`listPending`, `listAcks`) é quem filtra `.tmp`
      // via `safeParseFilename`. Aqui validamos só o estado pós-conclusão.

      // 5 pré-existentes + 20 concorrentes = 25 finais
      for (let i = 0; i < 5; i++) {
        await adapter.writeFileAtomic(
          path.join(tmpRoot, `pre-${String(i)}.txt`),
          `pre-${String(i)}`,
        );
      }
      const writePromises = Array.from({ length: 20 }, (_, i) =>
        adapter.writeFileAtomic(path.join(tmpRoot, `w-${String(i)}.txt`), 'x'.repeat(2000)),
      );
      await Promise.all(writePromises);

      const entries = await fs.readdir(tmpRoot);
      expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
      expect(entries).toHaveLength(25);
    });
  });

  // ===================================================================
  // Payloads grandes
  // ===================================================================

  describe('writeFileAtomic — payloads grandes', () => {
    it('escreve 10 MB em < 5s e read-back é byte-a-byte idêntico', async () => {
      const target = path.join(tmpRoot, 'huge.bin');
      const content = 'A'.repeat(10 * 1024 * 1024); // 10 MB
      const start = performance.now();
      await adapter.writeFileAtomic(target, content);
      const elapsedMs = performance.now() - start;

      expect(elapsedMs).toBeLessThan(5000);

      const stats = await fs.stat(target);
      expect(stats.size).toBe(content.length);

      const readBack = await fs.readFile(target, 'utf-8');
      expect(readBack).toBe(content);
    });

    it('preserva surrogate pairs (emoji) byte-a-byte em 100 KB de conteúdo', async () => {
      const target = path.join(tmpRoot, 'emojis.txt');
      // Cada emoji ZWJ family ocupa ~25 chars UTF-16; 4000 deles = ~100KB
      const family = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}';
      const content = family.repeat(4000);

      await adapter.writeFileAtomic(target, content);
      const readBack = await fs.readFile(target, 'utf-8');
      expect(readBack).toBe(content);
    });
  });

  // ===================================================================
  // Cobertura defensiva: handle.close() rejeita
  //
  // Lines 50-51 e 63-64 do node-adapter.ts. São catches que ignoram
  // erros de `close()` em paths de cleanup — defesa contra handle já
  // fechado ou recurso descartado pelo SO. Atingidos via mock de
  // FileHandle.
  // ===================================================================

  describe('cobertura defensiva — handle.close() rejeitando', () => {
    it('writeFile falha + close também falha (catch L50-51): mapError ainda é lançado', async () => {
      const writeFailedErr = Object.assign(new Error('disk full'), {
        code: 'ENOSPC',
      }) as NodeJS.ErrnoException;
      const closeFailedErr = new Error('handle already invalid');

      const fakeHandle = makeFakeFileHandle({
        writeFileRejects: writeFailedErr,
        closeRejects: closeFailedErr,
      });
      vi.mocked(open).mockResolvedValueOnce(fakeHandle);

      const target = path.join(tmpRoot, 'data.json');
      await expect(adapter.writeFileAtomic(target, 'x')).rejects.toBeInstanceOf(FilesystemIOError);

      // close DEVE ter sido chamada na catch — mesmo rejeitando, o
      // erro original (writeFile) é o que propaga via mapError
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fakeHandle.close).toHaveBeenCalled();
    });

    it('sync falha + close também falha (mesmo catch L50-51): comportamento idêntico', async () => {
      const syncFailedErr = Object.assign(new Error('sync io error'), {
        code: 'EIO',
      }) as NodeJS.ErrnoException;
      const closeFailedErr = new Error('close after sync failure');

      const fakeHandle = makeFakeFileHandle({
        syncRejects: syncFailedErr,
        closeRejects: closeFailedErr,
      });
      vi.mocked(open).mockResolvedValueOnce(fakeHandle);

      const target = path.join(tmpRoot, 'data.json');
      await expect(adapter.writeFileAtomic(target, 'x')).rejects.toBeInstanceOf(FilesystemIOError);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fakeHandle.close).toHaveBeenCalled();
    });

    it('writeFile/sync sucesso + close no finally falha (catch L63-64): write não relança', async () => {
      // writeFailed = false (writeFile e sync OK); finally executa close,
      // close rejeita, catch L63-64 silencia. O rename subsequente deve
      // funcionar porque o `.tmp` real existe (foi aberto via open real).
      const closeFailedErr = new Error('close in finally failed');
      let closeAttempts = 0;

      const realOpen = (await vi.importActual<typeof FsPromises>('node:fs/promises')).open;

      // Mock retorna handle real aberto no path EXATO que o adapter passa,
      // mas com `close` substituído para rejeitar UMA vez (o finally) e
      // depois delegar ao close real (para garantir cleanup do FD).
      vi.mocked(open).mockImplementationOnce(async (filepath, flags): Promise<FileHandle> => {
        const handle = await realOpen(filepath, flags);
        const realClose = handle.close.bind(handle);
        Object.defineProperty(handle, 'close', {
          configurable: true,
          value: vi.fn().mockImplementation(() => {
            closeAttempts += 1;
            if (closeAttempts === 1) {
              return Promise.reject(closeFailedErr);
            }
            return realClose();
          }),
        });
        return handle;
      });

      const target = path.join(tmpRoot, 'data.json');
      await expect(adapter.writeFileAtomic(target, 'conteúdo final')).resolves.toBeUndefined();

      const readBack = await fs.readFile(target, 'utf-8');
      expect(readBack).toBe('conteúdo final');
      expect(closeAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  // ===================================================================
  // Linux/macOS only — chmod 0o000
  // ===================================================================

  describe.runIf(os.platform() !== 'win32')('permissão revogada (Linux/macOS)', () => {
    it('writeFileAtomic em pasta com chmod 0o000 lança FilesystemIOError', async () => {
      const restrictedDir = path.join(tmpRoot, 'locked');
      await fs.mkdir(restrictedDir);

      // Pre-existing file required para que o chmod 0o000 negue o write
      const target = path.join(restrictedDir, 'data.txt');

      try {
        await fs.chmod(restrictedDir, 0o000);
        await expect(adapter.writeFileAtomic(target, 'x')).rejects.toBeInstanceOf(
          FilesystemIOError,
        );
      } finally {
        // Restaura permissões pra cleanup poder remover o dir
        await fs.chmod(restrictedDir, 0o755);
      }
    });

    it('listDir em pasta com chmod 0o000 lança FilesystemIOError', async () => {
      const restrictedDir = path.join(tmpRoot, 'locked');
      await fs.mkdir(restrictedDir);
      await fs.writeFile(path.join(restrictedDir, 'a.txt'), 'x');

      try {
        await fs.chmod(restrictedDir, 0o000);
        await expect(adapter.listDir(restrictedDir)).rejects.toBeInstanceOf(FilesystemIOError);
      } finally {
        await fs.chmod(restrictedDir, 0o755);
      }
    });
  });
});
