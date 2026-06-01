/**
 * Tipos relacionados à fila FIFO de sprints pendentes de exibição.
 *
 * Compartilhados entre main process (queueService) e renderer (read-only
 * via push events em `window.api.queue.onUpdated`).
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import type { SprintPayload } from '@sprint/contracts';

/**
 * Estado serializável da fila para diagnóstico/logs.
 *
 * Renderer NÃO recebe a fila inteira — apenas `queueLength` via eventos
 * push (`sprint:incoming`, `queue:updated`). O snapshot é uso interno do
 * main e/ou inspeção em testes integrados.
 */
export interface QueueSnapshot {
  length: number;
  items: readonly QueueItem[];
}

/**
 * Item da fila. Mantém o payload validado + metadados de origem para o
 * fluxo de ack/historico:
 *
 * - `payload`: o `SprintPayload` já parseado (não re-parse no consumo).
 * - `filename`: nome do arquivo em `<shared>/pending/` — necessário para
 *   `pendingStore.deletePending(filename)` e para arquivar com o mesmo
 *   nome no histórico local.
 * - `rawContent`: conteúdo bruto do JSON lido do pending. Usado para
 *   escrever no histórico local sem re-serializar (preserva formatting,
 *   alinha com inspeção manual da TI).
 */
export interface QueueItem {
  payload: SprintPayload;
  filename: string;
  rawContent: string;
}
