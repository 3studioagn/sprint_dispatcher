/**
 * Testes da QueueService — comportamento FIFO + dedup + eventos.
 *
 * Sem mocks de FS — testa apenas a estrutura de dados e o EventEmitter.
 */

import { parseSprintPayload, type SprintPayload } from '@sprint/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem } from '../../shared/types/queue';

import { QueueService } from './queueService';

const VALID_SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const ANOTHER_SPRINT_ID = '01HXAAABBBCCCDDDEEEFFFGGGH';

function makePayload(
  opts: { sprintId?: string; userId?: string; meta?: number } = {},
): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId ?? VALID_SPRINT_ID,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T10:00:00.000Z',
    user_id: opts.userId ?? 'joao',
    title: 'Teste',
    body_html: 'corpo',
    meta: opts.meta ?? 5,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
}

function makeItem(opts: { sprintId?: string; userId?: string; meta?: number } = {}): QueueItem {
  const payload = makePayload(opts);
  return {
    payload,
    filename: `${payload.sprint_id}-${payload.user_id}.json`,
    rawContent: JSON.stringify(payload, null, 2),
  };
}

describe('QueueService — operações básicas', () => {
  let q: QueueService;
  beforeEach(() => {
    q = new QueueService();
  });

  it('length inicial é 0', () => {
    expect(q.length()).toBe(0);
  });

  it('peek de fila vazia retorna null', () => {
    expect(q.peek()).toBeNull();
  });

  it('dequeue de fila vazia retorna null', () => {
    expect(q.dequeue()).toBeNull();
  });

  it('enqueue aumenta length e retorna true', () => {
    expect(q.enqueue(makeItem())).toBe(true);
    expect(q.length()).toBe(1);
  });

  it('peek retorna o primeiro item sem remover', () => {
    const item = makeItem();
    q.enqueue(item);
    expect(q.peek()).toBe(item);
    expect(q.length()).toBe(1);
  });

  it('dequeue remove do início (FIFO)', () => {
    const a = makeItem({ sprintId: VALID_SPRINT_ID });
    const b = makeItem({ sprintId: ANOTHER_SPRINT_ID });
    q.enqueue(a);
    q.enqueue(b);
    expect(q.dequeue()).toBe(a);
    expect(q.length()).toBe(1);
    expect(q.peek()).toBe(b);
  });

  it('snapshot retorna cópia imutável dos itens', () => {
    const item = makeItem();
    q.enqueue(item);
    const snap = q.snapshot();
    expect(snap.length).toBe(1);
    expect(snap.items).toEqual([item]);
    // Mutação no snapshot não afeta a fila interna
    (snap.items as QueueItem[]).pop();
    expect(q.length()).toBe(1);
  });
});

describe('QueueService — deduplicação por sprint_id+user_id', () => {
  let q: QueueService;
  beforeEach(() => {
    q = new QueueService();
  });

  it('enqueue do mesmo (sprint_id+user_id) duas vezes não duplica', () => {
    const a = makeItem({ sprintId: VALID_SPRINT_ID, userId: 'joao', meta: 5 });
    const b = makeItem({ sprintId: VALID_SPRINT_ID, userId: 'joao', meta: 99 });
    expect(q.enqueue(a)).toBe(true);
    expect(q.enqueue(b)).toBe(false); // dedup
    expect(q.length()).toBe(1);
  });

  it('mesmo sprint_id com user_id diferente NÃO dedup (broadcast)', () => {
    expect(q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, userId: 'joao' }))).toBe(true);
    expect(q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, userId: 'maria' }))).toBe(true);
    expect(q.length()).toBe(2);
  });

  it('user_id idêntico com sprint_id diferente NÃO dedup', () => {
    expect(q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, userId: 'joao' }))).toBe(true);
    expect(q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, userId: 'joao' }))).toBe(true);
    expect(q.length()).toBe(2);
  });

  it('após dequeue, mesmo (sprint_id+user_id) PODE ser re-enfileirado', () => {
    const item = makeItem();
    q.enqueue(item);
    q.dequeue();
    expect(q.enqueue(item)).toBe(true); // re-enqueue OK após sair da fila
  });
});

describe('QueueService — clear', () => {
  it('clear esvazia a fila', () => {
    const q = new QueueService();
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    expect(q.length()).toBe(2);
    q.clear();
    expect(q.length()).toBe(0);
    expect(q.peek()).toBeNull();
  });

  it('clear permite re-enqueue do mesmo identificador (limpou também o Set)', () => {
    const q = new QueueService();
    const item = makeItem();
    q.enqueue(item);
    q.clear();
    expect(q.enqueue(item)).toBe(true);
  });

  it('clear em fila vazia não emite queueUpdated (no-op)', () => {
    const q = new QueueService();
    const cb = vi.fn();
    q.onQueueUpdated(cb);
    q.clear();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('QueueService — eventos', () => {
  let q: QueueService;
  beforeEach(() => {
    q = new QueueService();
  });

  it('primeiro enqueue (fila vazia) dispara nextSprint com o item', () => {
    const onNext = vi.fn();
    q.onNextSprint(onNext);
    const item = makeItem();
    q.enqueue(item);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(item);
  });

  it('enqueues subsequentes NÃO disparam nextSprint', () => {
    const onNext = vi.fn();
    q.onNextSprint(onNext);
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: '01HXBBBBCCCCDDDDEEEEFFGGHH' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('dequeue NÃO emite nextSprint mesmo se há próximo item', () => {
    const onNext = vi.fn();
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    q.onNextSprint(onNext); // subscribe APÓS o enqueue inicial
    q.dequeue();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('cada enqueue, dequeue e clear emite queueUpdated com length atual', () => {
    const onUpdated = vi.fn<[number], void>();
    q.onQueueUpdated(onUpdated);
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    q.dequeue();
    q.clear();
    expect(onUpdated.mock.calls.map((c) => c[0])).toEqual([1, 2, 1, 0]);
  });

  it('enqueue dedup NÃO emite eventos', () => {
    const onNext = vi.fn();
    const onUpdated = vi.fn();
    const item = makeItem();
    q.enqueue(item);
    q.onNextSprint(onNext);
    q.onQueueUpdated(onUpdated);
    expect(q.enqueue(item)).toBe(false);
    expect(onNext).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('unsubscribe remove o listener (não chama mais)', () => {
    const cb = vi.fn();
    const unsub = q.onNextSprint(cb);
    unsub();
    q.enqueue(makeItem());
    expect(cb).not.toHaveBeenCalled();
  });

  it('múltiplos listeners do mesmo evento são chamados', () => {
    const a = vi.fn();
    const b = vi.fn();
    q.onNextSprint(a);
    q.onNextSprint(b);
    q.enqueue(makeItem());
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
