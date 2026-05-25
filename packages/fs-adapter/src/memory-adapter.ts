/**
 * MemoryFilesystemAdapter — implementação in-memory de
 * {@link IFilesystemAdapter}.
 *
 * Para testes. Mantém estado em `Map<string, MemoryFileEntry>`. Não
 * persiste. Cada instância é independente — não há "filesystem global".
 *
 * Comportamento dos paths:
 * - Normalização mínima: barras únicas (sem duplicação), sem trailing
 *   slash (exceto raiz)
 * - Sem distinção entre Windows e Unix paths (input é tratado
 *   literalmente após normalização)
 * - **Diretórios são representados implicitamente**: se existe
 *   `/a/b/file`, então `/a` e `/a/b` são considerados diretórios
 *   existentes. `mkdir` é no-op idempotente
 *
 * @see DECISIONS.md ADR-013
 */
import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from './errors';
import type { FileStat, IFilesystemAdapter } from './interface';

interface MemoryFileEntry {
  content: string;
  modifiedAt: Date;
}

export class MemoryFilesystemAdapter implements IFilesystemAdapter {
  private readonly files = new Map<string, MemoryFileEntry>();

  async readFile(filepath: string): Promise<string> {
    const norm = normalize(filepath);
    const entry = this.files.get(norm);
    if (entry === undefined) {
      if (this.isImpliedDirectory(norm)) {
        throw new FilesystemIOError(filepath, 'é diretório (esperava arquivo)');
      }
      throw new FileNotFoundError(filepath);
    }
    return Promise.resolve(entry.content);
  }

  async writeFileAtomic(filepath: string, content: string): Promise<void> {
    const norm = normalize(filepath);
    if (this.isImpliedDirectory(norm)) {
      throw new FilesystemIOError(filepath, 'path é diretório');
    }
    this.files.set(norm, { content, modifiedAt: new Date() });
    return Promise.resolve();
  }

  async listDir(dirpath: string): Promise<string[]> {
    const norm = normalize(dirpath);
    // Se path é arquivo, lança ENOTDIR equivalente
    if (this.files.has(norm)) {
      throw new FilesystemIOError(dirpath, 'não é diretório');
    }

    const prefix = norm === '/' ? '/' : norm + '/';
    const directChildren = new Set<string>();

    for (const filepath of this.files.keys()) {
      if (!filepath.startsWith(prefix)) continue;
      const rest = filepath.slice(prefix.length);
      const firstSegment = rest.split('/')[0];
      if (firstSegment !== undefined && firstSegment.length > 0) {
        directChildren.add(firstSegment);
      }
    }

    if (directChildren.size === 0 && norm !== '/' && norm !== '') {
      // Sem filhos diretos E sem ser a raiz → diretório não existe
      throw new DirectoryNotFoundError(dirpath);
    }

    return Promise.resolve(Array.from(directChildren));
  }

  async exists(filepath: string): Promise<boolean> {
    const norm = normalize(filepath);
    return Promise.resolve(this.files.has(norm) || this.isImpliedDirectory(norm));
  }

  async rename(from: string, to: string): Promise<void> {
    const fromNorm = normalize(from);
    const toNorm = normalize(to);
    const entry = this.files.get(fromNorm);
    if (entry === undefined) {
      throw new FileNotFoundError(from);
    }
    this.files.delete(fromNorm);
    this.files.set(toNorm, { content: entry.content, modifiedAt: new Date() });
    return Promise.resolve();
  }

  async unlink(filepath: string): Promise<void> {
    const norm = normalize(filepath);
    if (!this.files.has(norm)) {
      if (this.isImpliedDirectory(norm)) {
        throw new FilesystemIOError(filepath, 'é diretório (esperava arquivo)');
      }
      throw new FileNotFoundError(filepath);
    }
    this.files.delete(norm);
    return Promise.resolve();
  }

  async mkdir(_dirpath: string): Promise<void> {
    // Diretórios são implícitos via paths de arquivos. mkdir é no-op
    // idempotente — não cria entry explícito, mas não lança.
    return Promise.resolve();
  }

  async stat(filepath: string): Promise<FileStat> {
    const norm = normalize(filepath);
    const entry = this.files.get(norm);
    if (entry !== undefined) {
      return Promise.resolve({
        size: entry.content.length,
        modifiedAt: entry.modifiedAt,
        isFile: true,
        isDirectory: false,
      });
    }
    if (this.isImpliedDirectory(norm)) {
      return Promise.resolve({
        size: 0,
        modifiedAt: new Date(0),
        isFile: false,
        isDirectory: true,
      });
    }
    throw new FileNotFoundError(filepath);
  }

  /**
   * Helper de teste — limpa o filesystem in-memory.
   * Útil em `beforeEach` para isolar testes.
   */
  reset(): void {
    this.files.clear();
  }

  /**
   * Helper de teste — popula o filesystem com conteúdo predefinido.
   * Útil em fixtures.
   */
  seed(entries: Record<string, string>): void {
    for (const [filepath, content] of Object.entries(entries)) {
      this.files.set(normalize(filepath), {
        content,
        modifiedAt: new Date(),
      });
    }
  }

  private isImpliedDirectory(norm: string): boolean {
    if (norm === '/' || norm === '') return true;
    const prefix = norm + '/';
    for (const filepath of this.files.keys()) {
      if (filepath.startsWith(prefix)) return true;
    }
    return false;
  }
}

function normalize(filepath: string): string {
  // Substitui múltiplas barras consecutivas por uma só
  let n = filepath.replace(/\/{2,}/g, '/');
  // Remove trailing slash (exceto raiz)
  if (n.length > 1 && n.endsWith('/')) {
    n = n.slice(0, -1);
  }
  return n;
}
