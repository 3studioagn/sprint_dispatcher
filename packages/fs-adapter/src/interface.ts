/**
 * Port (interface) do filesystem adapter.
 *
 * Define operações primitivas de I/O. Operações de domínio
 * (`writePendingSprint`, `listAcks`, `moveToArchive`, etc.) ficam em
 * módulos separados que injetam `IFilesystemAdapter` como dependência —
 * **fora desta interface**.
 *
 * Implementações:
 * - `NodeFilesystemAdapter` (produção): `fs/promises`
 * - `MemoryFilesystemAdapter` (testes): in-memory `Map`
 *
 * Erros lançados (`FileNotFoundError`, `DirectoryNotFoundError`,
 * `FilesystemIOError`) estão em `./errors`.
 *
 * @see DECISIONS.md ADR-013
 */

/**
 * Metadados de arquivo ou diretório.
 *
 * `modifiedAt` é fonte primária de detecção de mudança em pollers
 * (W1+) — comparar contra o último valor visto.
 */
export interface FileStat {
  /** Tamanho em bytes. */
  size: number;
  /** Última modificação. */
  modifiedAt: Date;
  /** True se é arquivo regular. */
  isFile: boolean;
  /** True se é diretório. */
  isDirectory: boolean;
}

/**
 * Port para operações de filesystem.
 *
 * Toda operação retorna `Promise`. Erros são lançados como instâncias
 * concretas de {@link FilesystemError} — use `instanceof` para
 * discriminar.
 *
 * Codificação assumida em todas as operações de texto: UTF-8.
 */
export interface IFilesystemAdapter {
  /**
   * Lê arquivo como texto UTF-8.
   *
   * @throws {FileNotFoundError} se o arquivo não existe
   * @throws {FilesystemIOError} em outros erros de I/O (path é
   *   diretório, permissão negada, etc.)
   */
  readFile(filepath: string): Promise<string>;

  /**
   * Escreve arquivo atomicamente (write → fsync → rename).
   *
   * Usa um `.tmp` com sufixo aleatório durante a escrita — isola
   * escritas concorrentes ao mesmo destino. Em caso de crash
   * mid-write, o arquivo final original (se existir) permanece
   * intacto; apenas o `.tmp` órfão fica no disco. Sobrescreve
   * destino se existir.
   *
   * @throws {FileNotFoundError} se algum componente do diretório pai
   *   não existe (ENOENT no open)
   * @throws {FilesystemIOError} em outros erros de I/O (sem espaço
   *   em disco, permissão negada, etc.)
   */
  writeFileAtomic(filepath: string, content: string): Promise<void>;

  /**
   * Lista entries do diretório (não-recursivo).
   *
   * Retorna apenas nomes (sem path completo). Ordem
   * não-determinística — consumers devem ordenar se necessário.
   *
   * @throws {DirectoryNotFoundError} se o diretório não existe
   * @throws {FilesystemIOError} se path é arquivo (não diretório) ou
   *   outros erros
   */
  listDir(dirpath: string): Promise<string[]>;

  /**
   * Verifica se path existe.
   *
   * **Não lança exceção** — retorna `false` para qualquer erro
   * (ENOENT, EACCES, path inválido, etc.). Use para checks rápidos.
   * Para discriminar tipo de erro, use `stat()`.
   */
  exists(filepath: string): Promise<boolean>;

  /**
   * Renomeia (ou move) arquivo.
   *
   * Atômico se origem e destino estão no mesmo volume (geralmente
   * sim para arquivos da pasta compartilhada do Sprint Dispatcher).
   * Sobrescreve `to` se existir.
   *
   * @throws {FileNotFoundError} se origem não existe
   * @throws {FilesystemIOError} em outros erros (cross-device,
   *   permissão, etc.)
   */
  rename(from: string, to: string): Promise<void>;

  /**
   * Remove arquivo.
   *
   * @throws {FileNotFoundError} se arquivo não existe
   * @throws {FilesystemIOError} se path é diretório (use `rmdir` —
   *   ausente da interface por ora) ou outros erros
   */
  unlink(filepath: string): Promise<void>;

  /**
   * Cria diretório (recursivo, idempotente).
   *
   * Não lança se já existe. Cria parents conforme necessário.
   *
   * @throws {FilesystemIOError} em erros (permissão, etc.)
   */
  mkdir(dirpath: string): Promise<void>;

  /**
   * Retorna metadados do arquivo/diretório.
   *
   * @throws {FileNotFoundError} se path não existe
   * @throws {FilesystemIOError} em outros erros
   */
  stat(filepath: string): Promise<FileStat>;

  /**
   * Testa a permissão **efetiva** de escrita em `dirpath` escrevendo um
   * arquivo temporário e removendo-o em seguida.
   *
   * Por que probe em vez de `fs.access(W_OK)`: em shares SMB/NTFS o
   * `access` reporta a permissão do *modo* do arquivo, não a ACL efetiva
   * — frequentemente diz "ok" onde a escrita real falha. O probe write +
   * unlink reflete o que o dispatch realmente faz (ADR-007).
   *
   * Capability primitiva (como {@link IFilesystemAdapter.exists}/`stat`):
   * Node faz a checagem real no FS; Memory devolve um stub configurável.
   * Quem decide *qual* diretório probar (ex.: `pending/`) é a camada de
   * domínio/serviço — esta primitiva só recebe o path já resolvido.
   *
   * **Nunca lança** e **sempre faz cleanup** do temporário (inclusive em
   * erro). O nome do temporário (`.permcheck-<rand>.tmp`) **não casa** com
   * o padrão de sprint (`<sprintId>-<userId>.json`), então o polling do
   * Agent não o confunde com uma sprint durante a janela em que existe.
   *
   * @param dirpath - diretório onde testar a escrita.
   * @returns `true` se conseguiu escrever **e** remover; `false` se a
   *   escrita falhou (permissão negada, diretório inexistente, disco
   *   cheio, etc.).
   */
  probeWritePermission(dirpath: string): Promise<boolean>;
}
