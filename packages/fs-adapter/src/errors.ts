/**
 * Erros base e específicos do filesystem adapter.
 *
 * Pattern: `FilesystemError` abstract base, 3 erros concretos para
 * casos comuns. Consumers usam `instanceof` para discriminar.
 *
 * @see DECISIONS.md ADR-013
 */

/**
 * Erro base de filesystem. Sempre prefira erros concretos.
 *
 * Abstract tanto em compile-time (`abstract` keyword) quanto em runtime
 * (`new.target` check no constructor) — instanciação direta lança
 * `TypeError`, forçando uso das subclasses concretas.
 */
export abstract class FilesystemError extends Error {
  abstract override readonly name: string;

  constructor(
    public readonly filepath: string,
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    if (new.target === FilesystemError) {
      throw new TypeError(
        'FilesystemError é abstract; use FileNotFoundError, DirectoryNotFoundError ou FilesystemIOError.',
      );
    }
  }
}

/**
 * Arquivo não encontrado no caminho especificado.
 *
 * Mapeia `ENOENT` do Node.js `fs/promises`.
 */
export class FileNotFoundError extends FilesystemError {
  override readonly name = 'FileNotFoundError';

  constructor(filepath: string, cause?: Error) {
    super(filepath, `Arquivo não encontrado: ${filepath}`, cause);
  }
}

/**
 * Diretório não encontrado no caminho especificado.
 *
 * Distinto de `FileNotFoundError` porque consumers podem tratar
 * "diretório vazio" vs. "diretório ausente" de formas diferentes.
 */
export class DirectoryNotFoundError extends FilesystemError {
  override readonly name = 'DirectoryNotFoundError';

  constructor(filepath: string, cause?: Error) {
    super(filepath, `Diretório não encontrado: ${filepath}`, cause);
  }
}

/**
 * Erro genérico de I/O — permissão negada, disco cheio, lock, path é
 * diretório quando esperava arquivo, etc.
 *
 * Cause original sempre preservada para diagnóstico (campo `.cause`).
 */
export class FilesystemIOError extends FilesystemError {
  override readonly name = 'FilesystemIOError';

  constructor(filepath: string, message: string, cause?: Error) {
    super(filepath, `Erro de I/O em ${filepath}: ${message}`, cause);
  }
}
