/**
 * QueueService — fila FIFO em memória de sprints aguardando exibição.
 *
 * Estrutura interna: array ordenado (índice 0 = próxima a exibir) +
 * `Set<string>` paralelo para deduplicação O(1) por chave
 * `sprint_id|user_id` (RN única de "1 sprint por operador por sprint").
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
 *   dequeue, clear). Consumidor típico: `trayService` atualiza estado
 *   visual (idle ↔ sprint_active) + renderer recebe push para UI de
 *   "+N na fila".
 *
 * **O QueueService NÃO emite `nextSprint` após `dequeue` mesmo se há
 * próximo item.** O caller (overlayService) é responsável por chamar
 * `peek()` após `dequeue` e iniciar a exibição manualmente. Mantém a
 * service como data structure pura — sem side-effects ocultos.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first (events fluem para
 *   renderer via main↔renderer push em Gate 4-5)
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
   * Adiciona item ao fim da fila. Idempotente para chaves duplicadas
   * (`sprint_id + user_id`) — segundo enqueue do mesmo identificador
   * retorna `false` sem mutar a fila.
   *
   * @returns `true` se enfileirou, `false` se duplicado (dedup).
   */
  enqueue(item: QueueItem): boolean {
    const key = makeDedupKey(item.payload.sprint_id, item.payload.user_id);
    if (this.keys.has(key)) {
      return false;
    }
    const wasEmpty = this.items.length === 0;
    this.items.push(item);
    this.keys.add(key);
    this.emitter.emit(QUEUE_UPDATED_EVENT, this.items.length);
    if (wasEmpty) {
      this.emitter.emit(NEXT_SPRINT_EVENT, item);
    }
    return true;
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
