/**
 * QueueService — fila em memória de sprints aguardando exibição,
 * ordenada por `criado_em` ascendente (BL-C3-010, RF-16).
 *
 * Estrutura interna: array ordenado (índice 0 = sprint atualmente
 * exibida pelo overlay quando há ao menos 1 item) + `Set<string>`
 * paralelo para deduplicação O(1) por chave `sprint_id|user_id` (RN
 * única de "1 sprint por operador por sprint").
 *
 * **Ordem (BL-C3-010, RF-16, UC-02 A4):**
 *
 * - Sprints aguardando processamento são exibidas em ordem cronológica
 *   ascendente de `payload.criado_em` (timestamp ISO-8601 de emissão
 *   pelo Leader). Comparação via `Date.parse()` — timezone-aware.
 * - Empate em `criado_em` (sprints emitidas no mesmo instante) mantém a
 *   ordem de chegada (FIFO no empate).
 * - **`items[0]` (sprint atualmente exibida) NÃO é preempted.** Sprints
 *   novas que chegam com `criado_em` MAIS antigo que `items[0]` são
 *   inseridas em `items[1]` (próxima da fila), nunca em `items[0]`.
 *   Trocar o overlay no meio da exibição seria confuso para o operador
 *   (ele clicou esperando ack da sprint que estava vendo).
 *
 * **Eventos emitidos:**
 *
 * - `nextSprint(item)` — disparado quando a fila vai de **vazia →
 *   não-vazia** via `enqueue`. Consumidor típico: `overlayService` cria
 *   a BrowserWindow do overlay. NÃO dispara em enqueues subsequentes
 *   (overlay já está exibindo a primeira; UI atualiza a contagem via
 *   `queueUpdated`).
 *
 * - `queueUpdated(length)` — disparado em **qualquer mudança** (enqueue,
 *   dequeue, clear, removeBySprintId). Consumidor típico: `trayService`
 *   atualiza estado visual (idle ↔ sprint_active) + renderer recebe
 *   push para UI de "+N na fila".
 *
 * **O QueueService NÃO emite `nextSprint` após `dequeue` mesmo se há
 * próximo item.** O caller (overlayService) é responsável por chamar
 * `peek()` após `dequeue` e iniciar a exibição manualmente. Mantém a
 * service como data structure pura — sem side-effects ocultos.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first (events fluem para
 *   renderer via main↔renderer push em Gate 4-5)
 * @see Requisitos RF-16, UC-02 A4 — ordenação cronológica
 */

import { EventEmitter } from 'node:events';

import type { QueueItem, QueueSnapshot } from '../../shared/types/queue';

const NEXT_SPRINT_EVENT = 'nextSprint';
const QUEUE_UPDATED_EVENT = 'queueUpdated';

/**
 * Função de unsubscribe retornada pelos `onX` para uso em cleanup.
 */
export type QueueUnsubscribe = () => void;

function makeDedupKey(sprintId: string, userId: string): string {
  return `${sprintId}|${userId}`;
}

export class QueueService {
  private readonly items: QueueItem[] = [];
  private readonly keys = new Set<string>();
  private readonly emitter = new EventEmitter();

  /**
   * Insere item na fila respeitando ordem cronológica de `criado_em`
   * (BL-C3-010, RF-16). Idempotente para chaves duplicadas
   * (`sprint_id + user_id`) — segundo enqueue do mesmo identificador
   * retorna `false` sem mutar a fila.
   *
   * **Inserção ordenada:** a posição é a primeira `i >= 1` cujo
   * `items[i].criado_em > item.criado_em` — empate mantém ordem de
   * chegada (FIFO). `items[0]` (sprint atualmente exibida) é sempre
   * preservada, mesmo se o novo item tem `criado_em` mais antigo —
   * preempção do overlay no meio da exibição seria má UX.
   *
   * @returns `true` se enfileirou, `false` se duplicado (dedup).
   */
  enqueue(item: QueueItem): boolean {
    const key = makeDedupKey(item.payload.sprint_id, item.payload.user_id);
    if (this.keys.has(key)) {
      return false;
    }
    const wasEmpty = this.items.length === 0;
    if (wasEmpty) {
      this.items.push(item);
    } else {
      const insertAt = this.findInsertPosition(item);
      this.items.splice(insertAt, 0, item);
    }
    this.keys.add(key);
    this.emitter.emit(QUEUE_UPDATED_EVENT, this.items.length);
    if (wasEmpty) {
      this.emitter.emit(NEXT_SPRINT_EVENT, item);
    }
    return true;
  }

  /**
   * Calcula a posição de inserção para um novo item respeitando ordem
   * por `criado_em`. Caller garante que `items.length >= 1` (chamado
   * apenas no ramo not-empty do enqueue). Sempre retorna >= 1 (preserva
   * items[0] — sprint atualmente exibida — de preempção).
   */
  private findInsertPosition(item: QueueItem): number {
    const itemTs = Date.parse(item.payload.criado_em);
    for (let i = 1; i < this.items.length; i++) {
      const existing = this.items[i]!;
      if (Date.parse(existing.payload.criado_em) > itemTs) {
        return i;
      }
    }
    return this.items.length;
  }

  /**
   * Remove e retorna o item do início da fila. Emite `queueUpdated`.
   *
   * @returns Próximo item da fila, ou `null` se vazia.
   */
  dequeue(): QueueItem | null {
    const item = this.items.shift();
    if (item === undefined) {
      return null;
    }
    const key = makeDedupKey(item.payload.sprint_id, item.payload.user_id);
    this.keys.delete(key);
    this.emitter.emit(QUEUE_UPDATED_EVENT, this.items.length);
    return item;
  }

  /**
   * Retorna o item do início da fila sem removê-lo. Não emite eventos.
   *
   * Uso típico: overlayService consulta após `dequeue` para iniciar a
   * exibição do próximo se houver.
   */
  peek(): QueueItem | null {
    return this.items[0] ?? null;
  }

  /** Número atual de itens na fila. */
  length(): number {
    return this.items.length;
  }

  /**
   * Remove o item cujo `payload.sprint_id` casa com `sprintId` (BL-C3-011 —
   * detecção de cancelamento). Idempotente — retorna `false` se não havia
   * sprint com esse id na fila.
   *
   * Emite `queueUpdated` quando remove. NÃO emite `nextSprint` mesmo se
   * a sprint removida estava em `items[0]` (caller — handler de cancel
   * no main — é responsável por orquestrar próxima exibição ou hide,
   * mesma semântica de `dequeue`).
   *
   * @param sprintId ULID da sprint a remover (vem do `sprint_id_ref` do
   *                 `SprintCancel`).
   * @returns `true` se removeu; `false` se não havia sprint com esse id.
   */
  removeBySprintId(sprintId: string): boolean {
    const idx = this.items.findIndex((i) => i.payload.sprint_id === sprintId);
    if (idx === -1) return false;
    const removed = this.items[idx]!;
    const key = makeDedupKey(removed.payload.sprint_id, removed.payload.user_id);
    this.items.splice(idx, 1);
    this.keys.delete(key);
    this.emitter.emit(QUEUE_UPDATED_EVENT, this.items.length);
    return true;
  }

  /**
   * Esvazia a fila. Emite `queueUpdated(0)`. Uso primário em testes;
   * em produção, dequeues seriais cobrem o caso.
   */
  clear(): void {
    if (this.items.length === 0 && this.keys.size === 0) {
      return;
    }
    this.items.length = 0;
    this.keys.clear();
    this.emitter.emit(QUEUE_UPDATED_EVENT, 0);
  }

  /**
   * Snapshot imutável da fila — útil para diagnóstico/logs/testes
   * integrados. Renderer NÃO recebe o snapshot via IPC (recebe apenas
   * `queueLength` via push).
   */
  snapshot(): QueueSnapshot {
    return { length: this.items.length, items: [...this.items] };
  }

  // ===========================================================================
  // Event API tipada (compõe EventEmitter ao invés de estender — evita
  // herdar overloads não-tipados de `on`/`off` que confundem o consumer).
  // ===========================================================================

  /**
   * Registra callback para nova sprint que ativa o overlay (fila
   * vazia → 1 item via enqueue). Retorna função de unsubscribe.
   */
  onNextSprint(cb: (item: QueueItem) => void): QueueUnsubscribe {
    this.emitter.on(NEXT_SPRINT_EVENT, cb);
    return () => {
      this.emitter.off(NEXT_SPRINT_EVENT, cb);
    };
  }

  /**
   * Registra callback para qualquer mudança no tamanho da fila.
   * Retorna função de unsubscribe.
   */
  onQueueUpdated(cb: (length: number) => void): QueueUnsubscribe {
    this.emitter.on(QUEUE_UPDATED_EVENT, cb);
    return () => {
      this.emitter.off(QUEUE_UPDATED_EVENT, cb);
    };
  }
}
