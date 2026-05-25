/**
 * NodeFilesystemAdapter — implementação de produção de
 * {@link IFilesystemAdapter}.
 *
 * Usa `node:fs/promises`. Mapeia erros do Node para `FilesystemError`
 * concretos via inspection de `error.code`.
 *
 * @see DECISIONS.md ADR-013
 */
import { randomBytes } from 'node:crypto';
import { promises as fs, type Stats } from 'node:fs';
import { open } from 'node:fs/promises';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from './errors';
import type { FileStat, IFilesystemAdapter } from './interface';

const TMP_SUFFIX_BYTES = 6;
const TMP_EXTENSION = '.tmp';

export class NodeFilesystemAdapter implements IFilesystemAdapter {
  async readFile(filepath: string): Promise<string> {
    try {
      return await fs.readFile(filepath, 'utf-8');
    } catch (err) {
      throw mapError(filepath, err as NodeJS.ErrnoException);
    }
  }

  async writeFileAtomic(filepath: string, content: string): Promise<void> {
    // Sufixo aleatório no .tmp isola escritas concorrentes ao mesmo
    // destino — sem isso, 2 writers ao mesmo `filepath` colidiriam no
    // mesmo `.tmp` e o rename de um removeria o `.tmp` do outro.
    const tmpPath = `${filepath}.${randomBytes(TMP_SUFFIX_BYTES).toString('hex')}${TMP_EXTENSION}`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let writeFailed = false;
    try {
      handle = await open(tmpPath, 'w');
      await handle.writeFile(content, 'utf-8');
      // fsync força flush ao disco — sem isso, crash pós-rename pode
      // resultar em arquivo final apontando para inode com conteúdo
      // zerado (data sync ainda em buffer do SO).
      await handle.sync();
    } catch (err) {
      writeFailed = true;
      // Cleanup do .tmp se algo falhou na escrita
      try {
        await handle?.close();
        handle = undefined;
      } catch {
        // Ignora erros de close em path de erro
      }
      try {
        await fs.unlink(tmpPath);
      } catch {
        // Ignora — .tmp pode não existir
      }
      throw mapError(filepath, err as NodeJS.ErrnoException);
    } finally {
      if (!writeFailed && handle) {
        try {
          await handle.close();
        } catch {
          // close pode falhar se já foi fechado no path de erro
        }
      }
    }

    try {
      await fs.rename(tmpPath, filepath);
    } catch (err) {
      // Rename falhou — tenta limpar o .tmp órfão; se cleanup falhar,
      // ainda assim relança o erro original do rename
      try {
        await fs.unlink(tmpPath);
      } catch {
        // .tmp pode não existir ou cleanup pode falhar — ignorar
      }
      throw mapError(filepath, err as NodeJS.ErrnoException);
    }
  }

  async listDir(dirpath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirpath);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new DirectoryNotFoundError(dirpath, nodeErr);
      }
      if (nodeErr.code === 'ENOTDIR') {
        throw new FilesystemIOError(dirpath, 'não é diretório', nodeErr);
      }
      throw mapError(dirpath, nodeErr);
    }
  }

  async exists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    try {
      await fs.rename(from, to);
    } catch (err) {
      throw mapError(from, err as NodeJS.ErrnoException);
    }
  }

  async unlink(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (err) {
      throw mapError(filepath, err as NodeJS.ErrnoException);
    }
  }

  async mkdir(dirpath: string): Promise<void> {
    try {
      await fs.mkdir(dirpath, { recursive: true });
    } catch (err) {
      throw mapError(dirpath, err as NodeJS.ErrnoException);
    }
  }

  async stat(filepath: string): Promise<FileStat> {
    let stats: Stats;
    try {
      stats = await fs.stat(filepath);
    } catch (err) {
      throw mapError(filepath, err as NodeJS.ErrnoException);
    }
    return {
      size: stats.size,
      modifiedAt: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  }
}

/**
 * Mapeia erros de Node (com `code`) para `FilesystemError` concretos.
 * Códigos não-reconhecidos viram `FilesystemIOError` genéricos com
 * `cause` preservado.
 */
function mapError(filepath: string, err: NodeJS.ErrnoException): Error {
  if (err.code === 'ENOENT') {
    return new FileNotFoundError(filepath, err);
  }
  if (err.code === 'ENOTDIR') {
    return new FilesystemIOError(filepath, 'não é diretório', err);
  }
  if (err.code === 'EISDIR') {
    return new FilesystemIOError(filepath, 'é diretório (esperava arquivo)', err);
  }
  if (err.code === 'EACCES' || err.code === 'EPERM') {
    return new FilesystemIOError(filepath, `permissão negada (${err.code})`, err);
  }
  if (err.code === 'EEXIST') {
    return new FilesystemIOError(filepath, 'já existe', err);
  }
  if (err.code === 'ENOSPC') {
    return new FilesystemIOError(filepath, 'sem espaço em disco', err);
  }
  if (err.code === 'EBUSY') {
    return new FilesystemIOError(filepath, 'arquivo bloqueado', err);
  }
  // err.message é sempre string (default '' em Error); cair para code se
  // vazio, e para 'desconhecido' como último recurso.
  const detail = err.message.length > 0 ? err.message : (err.code ?? 'desconhecido');
  return new FilesystemIOError(filepath, `erro de I/O: ${detail}`, err);
}
