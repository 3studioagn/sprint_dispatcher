/**
 * CancelStore — operações de domínio sobre arquivos de cancelamento
 * de sprint na pasta compartilhada SMB.
 *
 * **Status atual: STUB.** A entrega completa é BL-C4-004 (W2).
 *
 * Em produção, `writeCancel` escreverá
 * `<sharedPath>/pending/cancel-<sprintId>.json` — espelhando o padrão
 * de {@link PendingStore.writePendingSprint}, sem sanitização (cancel
 * não tem `body_html`).
 *
 * O Agent já consegue **ler** arquivos de cancel via
 * {@link PendingStore.listPending} (que devolve `kind: 'cancel'`),
 * então essa parte do fluxo já é exercitável end-to-end via
 * MemoryFilesystemAdapter pré-populado em testes — falta apenas o
 * **caminho de escrita** do Leader, que é o escopo de W2.
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter; domain layer)
 * @see Requisitos UC-05, Anexo E (schema SprintCancel)
 */
import type { SprintCancel } from '@sprint/contracts';

import { NotImplementedError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

/**
 * Metadados retornados por {@link CancelStore.writeCancel}.
 * Espelha {@link WritePendingResult}/{@link WriteAckResult}.
 */
export interface WriteCancelResult {
  /** Nome do arquivo gravado, no formato `cancel-<sprintId>.json`. */
  filename: string;
  /** Caminho absoluto gravado, com separadores POSIX. */
  filepath: string;
}

export class CancelStore {
  // Os parâmetros são preservados na assinatura porque a implementação
  // de W2 vai usá-los. Em runtime ficam atribuídos mas não acessados
  // até writeCancel ter corpo real.
  constructor(
    private readonly _adapter: IFilesystemAdapter,
    private readonly _sharedPath: string,
  ) {
    // Suprime "declared but never used" — campos serão consumidos em W2.
    void this._adapter;
    void this._sharedPath;
  }

  /**
   * **STUB — entrega final em BL-C4-004 (W2).**
   *
   * Escreverá `<sharedPath>/pending/cancel-<sprintId>.json` com o
   * payload de cancelamento. Não sanitiza (sem `body_html`).
   *
   * Por enquanto, lança {@link NotImplementedError} com
   * `operationName: 'writeCancel'`.
   *
   * @throws {NotImplementedError} sempre — método ainda não implementado.
   */
  writeCancel(_cancel: SprintCancel): Promise<WriteCancelResult> {
    return Promise.reject(new NotImplementedError('writeCancel'));
  }
}
