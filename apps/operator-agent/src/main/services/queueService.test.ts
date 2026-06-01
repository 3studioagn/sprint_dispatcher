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
  opts: {
    sprintId?: string;
    userId?: string;
    meta?: number;
    criadoEm?: string;
  } = {},
): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId ?? VALID_SPRINT_ID,
    criado_por: 'TestRenan',
    criado_em: opts.criadoEm ?? '2026-05-26T10:00:00.000Z',
    user_id: opts.userId ?? 'joao',
    title: 'Teste',
    body_html: 'corpo',
    meta: opts.meta ?? 5,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
}

function makeItem(
  opts: { sprintId?: string; userId?: string; meta?: number; criadoEm?: string } = {},
): QueueItem {
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

describe('QueueService — ordenação por criado_em (BL-C3-010)', () => {
  const VALID_SPRINT_ID_3 = '01HXBBBCCCDDDEEEFFFGGGHHHJ';
  const VALID_SPRINT_ID_4 = '01HXCCCDDDEEEFFFGGGHHHJKMN';

  let q: QueueService;
  beforeEach(() => {
    q = new QueueService();
  });

  it('primeira sprint vai para [0] independente de criado_em', () => {
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T15:00:00.000Z' }));
    expect(q.peek()?.payload.sprint_id).toBe(VALID_SPRINT_ID);
  });

  it('sprint mais antiga que items[0] vai para [1], preservando exibida', () => {
    // A em [0] (exibida, criado_em=10:05)
    // B chega com criado_em=10:00 — MAIS ANTIGA
    // Esperado: A permanece em [0], B em [1] (próxima na fila)
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T10:05:00.000Z' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T10:00:00.000Z' }));

    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID, // exibida (mais nova) preservada
      ANOTHER_SPRINT_ID, // próxima (mais antiga)
    ]);
  });

  it('sprint com criado_em entre duas existentes vai para o meio', () => {
    // A em [0] (criado_em=10:00, exibida)
    // C em [1] (criado_em=10:10)
    // Chega B com criado_em=10:05 — entre A e C
    // Esperado: A[0], B[1], C[2]
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T10:00:00.000Z' }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_3, criadoEm: '2026-05-26T10:10:00.000Z' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T10:05:00.000Z' }));

    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID,
      ANOTHER_SPRINT_ID,
      VALID_SPRINT_ID_3,
    ]);
  });

  it('sprint mais nova vai para o final', () => {
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T10:00:00.000Z' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T10:05:00.000Z' }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_3, criadoEm: '2026-05-26T10:10:00.000Z' }));

    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID,
      ANOTHER_SPRINT_ID,
      VALID_SPRINT_ID_3,
    ]);
  });

  it('empate em criado_em mantém ordem de chegada (FIFO no empate)', () => {
    const sameTs = '2026-05-26T10:00:00.000Z';
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: sameTs }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: sameTs }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_3, criadoEm: sameTs }));

    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID,
      ANOTHER_SPRINT_ID,
      VALID_SPRINT_ID_3,
    ]);
  });

  it('inserção ordenada com timezone offset (não-UTC) funciona', () => {
    // criado_em pode vir com offset (-03:00). Date.parse normaliza.
    // 2026-05-26T07:00:00-03:00 == 2026-05-26T10:00:00Z
    // 2026-05-26T08:00:00-03:00 == 2026-05-26T11:00:00Z
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T08:00:00.000-03:00' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T07:00:00.000-03:00' }));

    const snap = q.snapshot();
    // A (08:00-03 = 11Z) exibida; B (07:00-03 = 10Z) mais antiga vai para [1]
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID,
      ANOTHER_SPRINT_ID,
    ]);
  });

  it('múltiplas sprints fora de ordem chegam ordenadas (preservando [0])', () => {
    // A em [0] (criado_em=10:00, exibida)
    // Chegam D (10:30), B (10:05), C (10:20) em ordem aleatória
    // Esperado: A[0], B[1], C[2], D[3]
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T10:00:00.000Z' }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_4, criadoEm: '2026-05-26T10:30:00.000Z' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T10:05:00.000Z' }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_3, criadoEm: '2026-05-26T10:20:00.000Z' }));

    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID,
      ANOTHER_SPRINT_ID,
      VALID_SPRINT_ID_3,
      VALID_SPRINT_ID_4,
    ]);
  });

  it('após dequeue, próxima exibida [0] é a anterior [1] — invariante mantida', () => {
    // A exibida, B e C aguardando ordenadas. Ack A → B vira exibida ([0])
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T10:00:00.000Z' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T10:05:00.000Z' }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_3, criadoEm: '2026-05-26T10:10:00.000Z' }));

    expect(q.dequeue()?.payload.sprint_id).toBe(VALID_SPRINT_ID);
    expect(q.peek()?.payload.sprint_id).toBe(ANOTHER_SPRINT_ID);

    // Chega D mais antiga que peek atual mas DEPOIS de B [0]: vai para [1]
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_4, criadoEm: '2026-05-26T10:01:00.000Z' }));
    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      ANOTHER_SPRINT_ID, // exibida agora (preservada)
      VALID_SPRINT_ID_4, // D mais antiga que C mas posicionada após exibida
      VALID_SPRINT_ID_3,
    ]);
  });
});

describe('QueueService — removeBySprintId (BL-C3-011)', () => {
  const VALID_SPRINT_ID_3 = '01HXBBBCCCDDDEEEFFFGGGHHHJ';

  let q: QueueService;
  beforeEach(() => {
    q = new QueueService();
  });

  it('remove item por sprint_id e retorna true', () => {
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    expect(q.length()).toBe(2);

    expect(q.removeBySprintId(VALID_SPRINT_ID)).toBe(true);

    expect(q.length()).toBe(1);
    expect(q.peek()?.payload.sprint_id).toBe(ANOTHER_SPRINT_ID);
  });

  it('retorna false quando sprint_id não está na fila (idempotência)', () => {
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    expect(q.removeBySprintId(ANOTHER_SPRINT_ID)).toBe(false);
    expect(q.length()).toBe(1);
  });

  it('remove permite re-enqueue do mesmo identificador (limpou Set)', () => {
    const item = makeItem({ sprintId: VALID_SPRINT_ID });
    q.enqueue(item);
    q.removeBySprintId(VALID_SPRINT_ID);
    expect(q.enqueue(item)).toBe(true);
  });

  it('remove emite queueUpdated com novo length', () => {
    const cb = vi.fn<[number], void>();
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    q.onQueueUpdated(cb);

    q.removeBySprintId(VALID_SPRINT_ID);

    expect(cb).toHaveBeenCalledWith(1);
  });

  it('remove do meio preserva ordem das demais', () => {
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID, criadoEm: '2026-05-26T10:00:00.000Z' }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID, criadoEm: '2026-05-26T10:05:00.000Z' }));
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID_3, criadoEm: '2026-05-26T10:10:00.000Z' }));

    expect(q.removeBySprintId(ANOTHER_SPRINT_ID)).toBe(true);

    const snap = q.snapshot();
    expect(snap.items.map((i) => i.payload.sprint_id)).toEqual([
      VALID_SPRINT_ID,
      VALID_SPRINT_ID_3,
    ]);
  });

  it('remove items[0] (sprint exibida) NÃO emite nextSprint (caller orquestra)', () => {
    const onNext = vi.fn();
    q.enqueue(makeItem({ sprintId: VALID_SPRINT_ID }));
    q.enqueue(makeItem({ sprintId: ANOTHER_SPRINT_ID }));
    q.onNextSprint(onNext); // subscribe APÓS enqueues iniciais

    q.removeBySprintId(VALID_SPRINT_ID); // remove a "exibida"

    expect(onNext).not.toHaveBeenCalled();
    // peek deve agora retornar a próxima
    expect(q.peek()?.payload.sprint_id).toBe(ANOTHER_SPRINT_ID);
  });

  it('remove em fila vazia: false sem emit', () => {
    const cb = vi.fn();
    q.onQueueUpdated(cb);
    expect(q.removeBySprintId(VALID_SPRINT_ID)).toBe(false);
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
