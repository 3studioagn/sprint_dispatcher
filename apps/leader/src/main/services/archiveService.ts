/**
 * ArchiveService — leitura do histórico compartilhado para a tela de
 * Histórico do Leader (BL-C2-010, UC-07, RF-15).
 *
 * Composição (injeção de dependência via construtor):
 * - `ArchiveStore` (@sprint/fs-adapter) — lê `<shared_path>/arquivo/` (C4
 *   BL-C4-005): `listArchive(filter)` + `readArchivedSprint(ref)`.
 * - `OperatorsService` — resolve `user_nome_exibicao` (best-effort: se o
 *   `operators.json` sumiu, cai para o `user_id`, sem derrubar a tela).
 *
 * **Read-only:** nenhum método muta o `arquivo/`. `list` enriquece cada
 * ref (`ArchivedSprintRef`) com metadados do payload + estado do ack para
 * a UI listar/agrupar/filtrar; `read` devolve o payload completo (com
 * `body_html`) para o detalhe.
 *
 * Distinção (não confundir): este `arquivo/` é o histórico **compartilhado
 * no servidor**, diferente do `historico/` **local** do Agent (C3-008).
 *
 * @see Requisitos UC-07, RF-15, US-05.01
 * @see DECISIONS.md ADR-013 (filesystem adapter port-and-adapter)
 */

import { buildPendingFilename } from '@sprint/contracts';
import {
  FileNotFoundError,
  FilesystemIOError,
  type ArchivedSprintRef,
  type ArchiveStore,
} from '@sprint/fs-adapter';

import type {
  AckState,
  ArchiveFilter,
  ArchivedSprintListItem,
  ListArchiveResponse,
  ReadArchivedSprintRequest,
  ReadArchivedSprintResponse,
} from '../../shared/ipc-types';

import type { OperatorsService } from './operatorsService';

export class ArchiveService {
  constructor(
    private readonly archiveStore: ArchiveStore,
    private readonly operatorsService: OperatorsService,
  ) {}

  /**
   * Lista as sprints arquivadas, uma entrada por par (sprint_id, user_id),
   * enriquecida com payload + estado de ack. `filter.date` filtra na fonte
   * (C4); operador/líder ficam para o renderer (client-side).
   *
   * Sprints corrompidas ou sumidas entre o `listArchive` e o
   * `readArchivedSprint` (corrida) são puladas — o histórico não quebra
   * por um arquivo ruim (RN-09). Erros de I/O não-benignos (ex.:
   * compartilhamento inacessível) propagam para o handler.
   *
   * @throws {FilesystemError} em erros de I/O não-benignos.
   */
  async list(filter: ArchiveFilter): Promise<ListArchiveResponse> {
    const refs = await this.archiveStore.listArchive(
      filter.date !== undefined ? { date: filter.date } : {},
    );
    const nameById = await this.resolveNames();

    const items: ArchivedSprintListItem[] = [];
    for (const ref of refs) {
      let payload;
      let ack;
      try {
        ({ payload, ack } = await this.archiveStore.readArchivedSprint(ref));
      } catch (err) {
        // Arquivo corrompido (FilesystemIOError) ou sumido em corrida
        // (FileNotFoundError) — não aparece no histórico, não derruba.
        if (err instanceof FilesystemIOError || err instanceof FileNotFoundError) continue;
        throw err;
      }

      const state: AckState =
        ack === undefined
          ? 'nao_visto'
          : ack.acknowledged_at !== undefined
            ? 'confirmado'
            : 'visto';

      items.push({
        date: ref.date,
        sprint_id: ref.sprintId,
        user_id: ref.userId,
        user_nome_exibicao: nameById.get(ref.userId) ?? ref.userId,
        title: payload.title,
        criado_por: payload.criado_por,
        criado_em: payload.criado_em,
        deadline_at: payload.deadline_at,
        meta: payload.meta,
        state,
        ...(ack !== undefined ? { displayed_at: ack.displayed_at, hostname: ack.hostname } : {}),
        ...(ack?.acknowledged_at !== undefined ? { acknowledged_at: ack.acknowledged_at } : {}),
      });
    }

    return { items, checked_at: new Date().toISOString() };
  }

  /**
   * Lê o payload completo + ack de uma sprint arquivada específica. O ref
   * do C4 é reconstruído a partir de (date, sprint_id, user_id) via
   * `buildPendingFilename` — os inputs já vêm validados (Zod no main).
   *
   * @throws {FileNotFoundError} se a sprint não existe mais no arquivo.
   * @throws {FilesystemIOError} se a sprint arquivada está corrompida.
   */
  async read(request: ReadArchivedSprintRequest): Promise<ReadArchivedSprintResponse> {
    const ref: ArchivedSprintRef = {
      date: request.date,
      sprintId: request.sprint_id,
      userId: request.user_id,
      sprintFilename: buildPendingFilename(request.sprint_id, request.user_id),
      // `readArchivedSprint` lê o ack por conta própria; `hasAck` é ignorado.
      hasAck: false,
    };
    const { payload, ack } = await this.archiveStore.readArchivedSprint(ref);
    return { payload, ...(ack !== undefined ? { ack } : {}) };
  }

  /**
   * Mapa `user_id → user_nome_exibicao` para os nomes de exibição. Falha
   * de leitura do `operators.json` é benigna no histórico — retorna mapa
   * vazio e a UI cai para o `user_id`.
   */
  private async resolveNames(): Promise<Map<string, string>> {
    try {
      const { operators } = await this.operatorsService.list();
      return new Map(operators.map((op) => [op.user_id, op.user_nome_exibicao] as const));
    } catch {
      return new Map();
    }
  }
}
