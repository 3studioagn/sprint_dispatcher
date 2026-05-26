// @vitest-environment node
import { MemoryFilesystemAdapter, PendingStore } from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LeaderConfig } from '../config';

import { DispatchService, resolveDeadlineIso, substituteMeta } from './dispatchService';
import { OperatorsService } from './operatorsService';

const SHARED = '/shared';
const OPERATORS_JSON = {
  operators: [
    { user_id: 'joao', user_nome_exibicao: 'João Silva', hostname: 'PC-04', ativo: true },
    { user_id: 'mario', user_nome_exibicao: 'Mario Souza', hostname: 'PC-05', ativo: true },
    { user_id: 'carlos', user_nome_exibicao: 'Carlos Pereira', hostname: 'PC-06', ativo: true },
  ],
};

const SAMPLE_CONFIG: LeaderConfig = { shared_path: SHARED, criado_por: 'Renan' };

let adapter: MemoryFilesystemAdapter;
let pendingStore: PendingStore;
let operatorsService: OperatorsService;
let service: DispatchService;

beforeEach(() => {
  adapter = new MemoryFilesystemAdapter();
  adapter.seed({ [`${SHARED}/operators.json`]: JSON.stringify(OPERATORS_JSON) });
  pendingStore = new PendingStore(adapter, SHARED);
  operatorsService = new OperatorsService(adapter, SHARED);
  service = new DispatchService(pendingStore, operatorsService, SAMPLE_CONFIG);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// resolveDeadlineIso — helper puro com regra D1 (Gate 1)
// =============================================================================

describe('resolveDeadlineIso', () => {
  it('usa hoje quando deadline está no futuro', () => {
    // Local: 25/mai/2026 10:00 — deadline 18:00 está 8h no futuro
    const now = new Date(2026, 4, 25, 10, 0, 0);
    const expected = new Date(2026, 4, 25, 18, 0, 0);
    expect(resolveDeadlineIso('18:00', now)).toBe(expected.toISOString());
  });

  it('usa hoje quando deadline passou em ≤30min (tolerância)', () => {
    // Local: 25/mai/2026 18:20 — deadline 18:00 passou 20min → usa hoje
    const now = new Date(2026, 4, 25, 18, 20, 0);
    const expected = new Date(2026, 4, 25, 18, 0, 0);
    expect(resolveDeadlineIso('18:00', now)).toBe(expected.toISOString());
  });

  it('usa hoje quando deadline passou exatos 30min', () => {
    // 30min === threshold; ainda usa hoje
    const now = new Date(2026, 4, 25, 18, 30, 0);
    const expected = new Date(2026, 4, 25, 18, 0, 0);
    expect(resolveDeadlineIso('18:00', now)).toBe(expected.toISOString());
  });

  it('avança para amanhã quando deadline passou >30min', () => {
    // Local: 25/mai/2026 18:35 — passou 35min → amanhã 18:00
    const now = new Date(2026, 4, 25, 18, 35, 0);
    const expected = new Date(2026, 4, 26, 18, 0, 0);
    expect(resolveDeadlineIso('18:00', now)).toBe(expected.toISOString());
  });

  it('cruza fim do mês quando avança', () => {
    // 31/mai/2026 19:00 — deadline 18:00 passou 1h → 1/jun/2026 18:00
    const now = new Date(2026, 4, 31, 19, 0, 0);
    const expected = new Date(2026, 5, 1, 18, 0, 0);
    expect(resolveDeadlineIso('18:00', now)).toBe(expected.toISOString());
  });

  it('lança em HH:MM inválido — hora >23', () => {
    expect(() => resolveDeadlineIso('25:00', new Date())).toThrow();
  });

  it('lança em HH:MM inválido — minuto >59', () => {
    expect(() => resolveDeadlineIso('18:75', new Date())).toThrow();
  });

  it('lança em HH:MM inválido — sem separador', () => {
    expect(() => resolveDeadlineIso('1800', new Date())).toThrow();
  });

  it('lança em HH:MM inválido — texto', () => {
    expect(() => resolveDeadlineIso('xyz', new Date())).toThrow();
  });

  it('aceita 00:00 (meia-noite)', () => {
    const now = new Date(2026, 4, 25, 23, 0, 0);
    // 00:00 == hoje 00:00 que já passou 23h → amanhã 00:00
    const expected = new Date(2026, 4, 26, 0, 0, 0);
    expect(resolveDeadlineIso('00:00', now)).toBe(expected.toISOString());
  });

  it('aceita 23:59 (último minuto)', () => {
    const now = new Date(2026, 4, 25, 10, 0, 0);
    const expected = new Date(2026, 4, 25, 23, 59, 0);
    expect(resolveDeadlineIso('23:59', now)).toBe(expected.toISOString());
  });
});

// =============================================================================
// substituteMeta — helper puro (D2 do Gate 1)
// =============================================================================

describe('substituteMeta', () => {
  it('substitui {meta} pelo valor numérico', () => {
    expect(substituteMeta('Meta: <b>{meta} artes</b>', 7)).toBe('Meta: <b>7 artes</b>');
  });

  it('substitui múltiplas ocorrências', () => {
    expect(substituteMeta('{meta}/{meta}', 3)).toBe('3/3');
  });

  it('retorna body inalterado se não há placeholder', () => {
    expect(substituteMeta('Meta fixa sem placeholder', 5)).toBe('Meta fixa sem placeholder');
  });

  it('aceita meta = 1', () => {
    expect(substituteMeta('Faça {meta} arte hoje', 1)).toBe('Faça 1 arte hoje');
  });
});

// =============================================================================
// DispatchService.dispatch — orquestração completa
// =============================================================================

describe('DispatchService.dispatch — happy path', () => {
  it('3 operadores → 3 sucessos, mesmo sprint_id, 3 arquivos em pending/', async () => {
    const result = await service.dispatch({
      selected: [
        { user_id: 'joao', meta: 5 },
        { user_id: 'maria', meta: 8 },
        { user_id: 'carlos', meta: 3 },
      ],
      deadline: '18:00',
    });

    expect(result.summary).toEqual({ total: 3, success: 3, failed: 0 });
    expect(result.per_operator).toHaveLength(3);
    expect(result.per_operator.every((p) => p.status === 'success')).toBe(true);
    expect(result.sprint_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const pending = await adapter.listDir(`${SHARED}/pending`);
    expect(pending).toHaveLength(3);
    expect(pending.every((f) => f.startsWith(result.sprint_id))).toBe(true);
  });

  it('resolve user_nome_exibicao via operatorsService', async () => {
    const result = await service.dispatch({
      selected: [{ user_id: 'joao', meta: 5 }],
      deadline: '18:00',
    });
    expect(result.per_operator[0]?.user_nome_exibicao).toBe('João Silva');
  });

  it('payload tem todos os campos obrigatórios do schema (Anexo C)', async () => {
    await service.dispatch({
      selected: [{ user_id: 'joao', meta: 5 }],
      deadline: '18:00',
    });
    const pending = await adapter.listDir(`${SHARED}/pending`);
    const filename = pending[0];
    if (filename === undefined) {
      expect.unreachable('deveria ter pelo menos 1 arquivo em pending/');
    }
    const raw = await adapter.readFile(`${SHARED}/pending/${filename}`);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.schema_version).toBe('1.0');
    expect(parsed.criado_por).toBe('Renan');
    expect(parsed.user_id).toBe('joao');
    expect(parsed.title).toBe('É hora de correr');
    expect(parsed.meta).toBe(5);
    expect(typeof parsed.criado_em).toBe('string');
    expect(parsed.criado_em as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof parsed.deadline_at).toBe('string');
    expect(parsed.deadline_at as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.persistent_popup).toBe(true);
    expect(parsed.show_duration_seconds).toBe(5);
    expect(typeof parsed.body_html).toBe('string');
    expect(typeof parsed.sprint_id).toBe('string');
  });

  it('substitui {meta} no body_html antes da escrita (D2)', async () => {
    await service.dispatch({
      selected: [{ user_id: 'joao', meta: 7 }],
      deadline: '18:00',
    });
    const pending = await adapter.listDir(`${SHARED}/pending`);
    const filename = pending[0];
    if (filename === undefined) {
      expect.unreachable('deveria ter 1 arquivo');
    }
    const raw = await adapter.readFile(`${SHARED}/pending/${filename}`);
    const parsed = JSON.parse(raw) as { body_html: string };
    expect(parsed.body_html).toContain('7');
    expect(parsed.body_html).not.toContain('{meta}');
  });

  it('body_html é sanitizado (preserva <b>, sem <script>)', async () => {
    await service.dispatch({
      selected: [{ user_id: 'joao', meta: 5 }],
      deadline: '18:00',
    });
    const pending = await adapter.listDir(`${SHARED}/pending`);
    const filename = pending[0];
    if (filename === undefined) {
      expect.unreachable('deveria ter 1 arquivo');
    }
    const raw = await adapter.readFile(`${SHARED}/pending/${filename}`);
    const parsed = JSON.parse(raw) as { body_html: string };
    expect(parsed.body_html).toContain('<b>');
    expect(parsed.body_html).not.toMatch(/<script/i);
  });

  it('mesmo sprint_id em todos os arquivos da sprint', async () => {
    const result = await service.dispatch({
      selected: [
        { user_id: 'joao', meta: 5 },
        { user_id: 'maria', meta: 8 },
      ],
      deadline: '18:00',
    });
    const pending = await adapter.listDir(`${SHARED}/pending`);
    for (const f of pending) {
      const raw = await adapter.readFile(`${SHARED}/pending/${f}`);
      const parsed = JSON.parse(raw) as { sprint_id: string };
      expect(parsed.sprint_id).toBe(result.sprint_id);
    }
  });

  it('selected vazio retorna 0 ops', async () => {
    const result = await service.dispatch({ selected: [], deadline: '18:00' });
    expect(result.summary).toEqual({ total: 0, success: 0, failed: 0 });
    expect(result.per_operator).toHaveLength(0);
  });

  it('operador não encontrado em operators.json usa user_id como display', async () => {
    const result = await service.dispatch({
      selected: [{ user_id: 'desconhecido', meta: 5 }],
      deadline: '18:00',
    });
    const op = result.per_operator[0];
    expect(op?.user_id).toBe('desconhecido');
    expect(op?.user_nome_exibicao).toBe('desconhecido');
  });
});

describe('DispatchService.dispatch — falhas isoladas', () => {
  it('falha em 1 operador não impede os outros 2', async () => {
    const originalWrite = pendingStore.writePendingSprint.bind(pendingStore);
    vi.spyOn(pendingStore, 'writePendingSprint').mockImplementation(async (payload) => {
      if (payload.user_id === 'maria') {
        throw new Error('Simulated EACCES');
      }
      return originalWrite(payload);
    });

    const result = await service.dispatch({
      selected: [
        { user_id: 'joao', meta: 5 },
        { user_id: 'maria', meta: 8 },
        { user_id: 'carlos', meta: 3 },
      ],
      deadline: '18:00',
    });

    expect(result.summary).toEqual({ total: 3, success: 2, failed: 1 });
    const mariaResult = result.per_operator.find((p) => p.user_id === 'maria');
    expect(mariaResult?.status).toBe('error');
    expect(mariaResult?.error_message).toContain('EACCES');
    const joaoResult = result.per_operator.find((p) => p.user_id === 'joao');
    expect(joaoResult?.status).toBe('success');
    expect(joaoResult?.filename).toBeDefined();
  });

  it('falha total: todos os writes falham', async () => {
    vi.spyOn(pendingStore, 'writePendingSprint').mockRejectedValue(new Error('disk full'));
    const result = await service.dispatch({
      selected: [
        { user_id: 'joao', meta: 5 },
        { user_id: 'maria', meta: 8 },
      ],
      deadline: '18:00',
    });
    expect(result.summary).toEqual({ total: 2, success: 0, failed: 2 });
    expect(result.per_operator.every((p) => p.status === 'error')).toBe(true);
  });

  it('falha em parseSprintPayload é capturada como erro per-operator', async () => {
    // Meta negativa quebra validação Zod (.positive())
    const result = await service.dispatch({
      selected: [{ user_id: 'joao', meta: -5 }],
      deadline: '18:00',
    });
    expect(result.summary).toEqual({ total: 1, success: 0, failed: 1 });
    expect(result.per_operator[0]?.status).toBe('error');
  });
});
