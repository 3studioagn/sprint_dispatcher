/**
 * `handleAck` — orquestração do ack final do operador.
 *
 * Extraído do `main/index.ts` para permitir teste integrado (`main/services/
 * integration.test.ts`) sem importar o composition root (que faz
 * `void bootstrap()` no top-level e iniciaria Electron em testes).
 *
 * @see DECISIONS.md ADR-013 — port-and-adapter do fs-adapter
 * @see Requisitos RF-09, RF-10, RN-08
 */

import type { PendingStore } from '@sprint/fs-adapter';

import type { AcknowledgeSprintResponse } from '../../shared/ipc-types';
import type { AckService } from '../services/ackService';
import type { HistoryService } from '../services/historyService';
import type { OverlayService } from '../services/overlayService';
import type { PillService } from '../services/pillService';
import type { QueueService } from '../services/queueService';

export interface HandleAckLogger {
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
}

const SILENT_LOG: HandleAckLogger = {
  warn: () => undefined,
};

export interface HandleAckDeps {
  queueService: QueueService;
  historyService: HistoryService;
  overlayService: OverlayService;
  pendingStore: PendingStore;
  ackService: AckService;
  /**
   * `pillService` opcional — quando presente, é chamado após ack final
   * para mostrar o pill (badge minimizado, BL-C3-017) se a fila esvazia,
   * ou esconder se há próxima sprint na fila. Omitido em alguns
   * caminhos de teste isolado; em produção sempre injetado.
   */
  pillService?: PillService;
  log?: HandleAckLogger;
}

/**
 * Fluxo "Recebi" — operador clicou e o ack final foi requisitado via IPC.
 *
 *  1. Valida que a sprint pedida bate com a `queueService.peek()`
 *     (proteção contra clicks stale ou IPC adulterado).
 *  2. Cancela timer de minimize do overlay (race protection).
 *  3. `ackService.writeAcknowledged` — grava `acknowledged_at`
 *     preservando `displayed_at` original. **THROW em falha** — operador
 *     precisa saber (toast vermelho via IpcResult).
 *  4. `historyService.archive` — copia o JSON para
 *     `<userData>/historico/YYYY-MM-DD/`. Não-fatal em erro
 *     (`moved_to_history: false` na response).
 *  5. `pendingStore.deletePending` — remove do shared. Não-fatal.
 *  6. `queueService.dequeue` — remove da fila + emit queueUpdated.
 *  7. Se `queueService.peek()` retorna próxima sprint: chama
 *     `overlayService.showSprint(next)` que envia push + reseta timer;
 *     também dispara `writeDisplayed` da próxima.
 *     Senão: `overlayService.hide()`.
 */
export async function handleAck(
  deps: HandleAckDeps,
  sprintId: string,
  userId: string,
): Promise<AcknowledgeSprintResponse> {
  const log = deps.log ?? SILENT_LOG;
  const { queueService, historyService, overlayService, pendingStore, ackService, pillService } =
    deps;

  const item = queueService.peek();
  if (item === null) {
    throw new Error('Não há sprint na fila para confirmar');
  }
  if (item.payload.sprint_id !== sprintId || item.payload.user_id !== userId) {
    throw new Error(
      `Ack mismatch: pedido (${sprintId}, ${userId}) não bate com a sprint atual ` +
        `(${item.payload.sprint_id}, ${item.payload.user_id})`,
    );
  }

  // 2. Cancel timer ANTES do ack — evita race entre minimize automático
  // e mudança de currentItem via showSprint(next).
  overlayService.clearTimer();

  // 3. Ack final — throw se falhar.
  const { acknowledgedAt } = await ackService.writeAcknowledged(sprintId, userId);

  // 4. Archive local — não-fatal.
  let movedToHistory = false;
  try {
    await historyService.archive(item.payload, item.filename, item.rawContent);
    movedToHistory = true;
  } catch (err) {
    log.warn('archive falhou — ack OK mas histórico local não gravado', {
      filename: item.filename,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Delete do shared — não-fatal.
  try {
    await pendingStore.deletePending(item.filename);
  } catch (err) {
    log.warn('deletePending falhou — sprint pode re-aparecer no shared', {
      filename: item.filename,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 6. Dequeue — emit queueUpdated (refreshTrayState + sendQueueUpdate).
  queueService.dequeue();

  // 7. Próxima sprint OU pill (BL-C3-017) + hide overlay.
  const next = queueService.peek();
  if (next !== null) {
    // Há próxima — exibe direto sem passar pelo pill. Pill some se
    // estivesse exibida (cenário: ack A → pill A → nova B chegou no
    // polling antes do operador clicar pill → próxima B substitui).
    overlayService.showSprint(next, queueService.length());
    void ackService.writeDisplayed(next.payload);
    pillService?.hide();
  } else {
    // Fila vazia → overlay esconde; pill mostra "última sprint acked"
    // (BL-C3-017). Operador vê badge persistente no topo da tela.
    overlayService.hide();
    pillService?.show(item.payload);
  }

  return {
    acknowledged_at: acknowledgedAt,
    moved_to_history: movedToHistory,
  };
}
