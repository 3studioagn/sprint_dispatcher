/**
 * PermissionService — gate de permissão do líder antes do dispatch
 * (BL-C2-012, RN-01, US-04.02, RNF-19).
 *
 * O controle de quem dispara é a **permissão de escrita NTFS** em
 * `<shared_path>/pending/`, governada pelo grupo "Sprint Leaders" no AD.
 * **Não consultamos o AD** — testamos a permissão *efetiva* com um probe
 * write+unlink via `IFilesystemAdapter.probeWritePermission` (ADR-007),
 * mais confiável que `fs.access(W_OK)` em shares SMB/NTFS.
 *
 * Composição (injeção de dependência via construtor):
 * - `IFilesystemAdapter` (@sprint/fs-adapter) — o mesmo adapter do
 *   dispatch; centraliza o I/O para a futura migração HTTP.
 * - `Logger` (@sprint/logger) — registra o resultado com o usuário Windows
 *   (RNF-19). `getUsername` é injetável para testabilidade.
 *
 * @see DECISIONS.md ADR-007 (probe write em vez de fs.access / consulta AD)
 * @see Requisitos RN-01, US-04.02, RNF-19
 */

import os from 'node:os';
import path from 'node:path';

import { SHARED_DIRS } from '@sprint/contracts';
import type { IFilesystemAdapter } from '@sprint/fs-adapter';
import type { Logger } from '@sprint/logger';

import type { CanDispatchResponse } from '../../shared/ipc-types';

/** Mensagem exibida ao líder sem permissão (BL-C2-012). */
export const PERMISSION_DENIED_REASON =
  'Você não tem permissão para disparar sprints — sem acesso de escrita à pasta de sprints. Contate o TI.';

export class PermissionService {
  constructor(
    private readonly adapter: IFilesystemAdapter,
    private readonly sharedPath: string,
    private readonly logger: Logger,
    private readonly getUsername: () => string = defaultUsername,
  ) {}

  /**
   * Verifica se o usuário Windows pode escrever em `pending/`. Loga o
   * resultado com o usuário (info quando permitido, warn quando negado) e
   * devolve `{ allowed, reason? }` para dirigir o gate do botão "Disparar".
   *
   * Não lança — `probeWritePermission` já absorve erros de I/O e os
   * traduz em `false` (= sem permissão).
   */
  async canDispatch(): Promise<CanDispatchResponse> {
    const pendingDir = path.posix.join(this.sharedPath, SHARED_DIRS.PENDING);
    const username = this.safeUsername();
    const allowed = await this.adapter.probeWritePermission(pendingDir);

    if (allowed) {
      this.logger.info(
        { username, pendingDir },
        'gate de dispatch: permissão de escrita confirmada',
      );
    } else {
      this.logger.warn(
        { username, pendingDir },
        'gate de dispatch: sem permissão de escrita em pending/',
      );
    }

    return allowed ? { allowed: true } : { allowed: false, reason: PERMISSION_DENIED_REASON };
  }

  /** Usuário Windows, com fallback se `os.userInfo()` falhar (raro). */
  private safeUsername(): string {
    try {
      return this.getUsername();
    } catch {
      return 'desconhecido';
    }
  }
}

function defaultUsername(): string {
  return os.userInfo().username;
}
