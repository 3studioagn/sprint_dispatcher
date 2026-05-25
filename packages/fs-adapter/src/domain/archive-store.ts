/**
 * ArchiveStore — operações de arquivamento histórico de sprints
 * processadas. Move arquivos de `pending/` para `arquivo/YYYY-MM-DD/`.
 *
 * **Status atual: STUB.** A entrega completa é BL-C4-005 (W3).
 *
 * Em produção, `moveToArchive` executará:
 * 1. Determina data corrente (`YYYY-MM-DD`).
 * 2. `mkdir(<sharedPath>/arquivo/YYYY-MM-DD)` — idempotente.
 * 3. `rename(<sharedPath>/pending/<filename>, <sharedPath>/arquivo/YYYY-MM-DD/<filename>)`.
 *
 * Caller será o job de limpeza periódico (BL-C4-008, W3) ou o
 * close-de-sprint do Leader (W2+).
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter; domain layer)
 * @see Requisitos Anexo A (estrutura `arquivo/YYYY-MM-DD/`)
 */
import { NotImplementedError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

/**
 * Metadados retornados por {@link ArchiveStore.moveToArchive}.
 */
export interface MoveToArchiveResult {
  /** Nome do arquivo movido (preservado de pending/). */
  filename: string;
  /** Caminho original (em `<sharedPath>/pending/`). */
  fromFilepath: string;
  /** Caminho de destino (em `<sharedPath>/arquivo/YYYY-MM-DD/`). */
  toFilepath: string;
}

export class ArchiveStore {
  // Parâmetros preservados na assinatura para uso em W3. Em runtime
  // ficam atribuídos mas não acessados até moveToArchive ter corpo real.
  constructor(
    private readonly _adapter: IFilesystemAdapter,
    private readonly _sharedPath: string,
  ) {
    void this._adapter;
    void this._sharedPath;
  }

  /**
   * **STUB — entrega final em BL-C4-005 (W3).**
   *
   * Moverá arquivo de `<sharedPath>/pending/<filename>` para
   * `<sharedPath>/arquivo/<YYYY-MM-DD>/<filename>`, criando o subdir
   * de data se necessário.
   *
   * Por enquanto, lança {@link NotImplementedError} com
   * `operationName: 'moveToArchive'`.
   *
   * @throws {NotImplementedError} sempre — método ainda não implementado.
   */
  moveToArchive(_filename: string): Promise<MoveToArchiveResult> {
    return Promise.reject(new NotImplementedError('moveToArchive'));
  }
}
