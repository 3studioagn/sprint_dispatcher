/**
 * Testes do HistoryService — cache em memória + filesystem.
 *
 * **Gate 3:** `isAlreadyArchived`, `markProcessed`, snapshot, seed.
 * **Gate 5:** `ensureFolder` + `getHistoricoPath`.
 * **Gate 6:** `archive` (escrita atômica em `historico/YYYY-MM-DD/`) +
 *            `initializeFromDisk` (scan recursivo do cache no boot).
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { format } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HistoryService } from './historyService';

const TEST_USER_DATA = '/test/userData';
const TMP_ROOT = path.join(os.tmpdir(), `sprint-agent-history-${Date.now()}`);

describe('HistoryService — Gate 3 (cache em memória)', () => {
  it('cache começa vazio', () => {
    const h = new HistoryService(TEST_USER_DATA);
    expect(h.snapshot()).toEqual([]);
    expect(h.isAlreadyArchived('qualquer.json')).toBe(false);
  });

  it('markProcessed adiciona ao cache', () => {
    const h = new HistoryService(TEST_USER_DATA);
    h.markProcessed('01HX...-joao.json');
    expect(h.isAlreadyArchived('01HX...-joao.json')).toBe(true);
  });

  it('markProcessed é idempotente', () => {
    const h = new HistoryService(TEST_USER_DATA);
    h.markProcessed('a.json');
    h.markProcessed('a.json');
    expect(h.snapshot()).toEqual(['a.json']);
  });

  it('isAlreadyArchived diferencia filenames distintos', () => {
    const h = new HistoryService(TEST_USER_DATA);
    h.markProcessed('a.json');
    expect(h.isAlreadyArchived('a.json')).toBe(true);
    expect(h.isAlreadyArchived('b.json')).toBe(false);
  });

  it('_seedForTests popula múltiplos filenames de uma vez', () => {
    const h = new HistoryService(TEST_USER_DATA);
    h._seedForTests(['a.json', 'b.json', 'c.json']);
    expect(h.isAlreadyArchived('a.json')).toBe(true);
    expect(h.isAlreadyArchived('b.json')).toBe(true);
    expect(h.isAlreadyArchived('c.json')).toBe(true);
    expect(h.isAlreadyArchived('d.json')).toBe(false);
  });

  it('snapshot retorna cópia imutável', () => {
    const h = new HistoryService(TEST_USER_DATA);
    h.markProcessed('a.json');
    const snap = h.snapshot();
    expect(snap).toEqual(['a.json']);
    (snap as string[]).push('b.json');
    expect(h.isAlreadyArchived('b.json')).toBe(false);
  });

  it('getUserDataPath retorna o path passado ao construtor', () => {
    const h = new HistoryService(TEST_USER_DATA);
    expect(h.getUserDataPath()).toBe(TEST_USER_DATA);
  });
});

describe('HistoryService — Gate 5: ensureFolder + getHistoricoPath', () => {
  beforeEach(async () => {
    await fs.mkdir(TMP_ROOT, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TMP_ROOT, { recursive: true, force: true });
  });

  it('getHistoricoPath retorna <userData>/historico', () => {
    const h = new HistoryService(TEST_USER_DATA);
    expect(h.getHistoricoPath()).toBe(path.join(TEST_USER_DATA, 'historico'));
  });

  it('ensureFolder cria a pasta histórico quando não existe', async () => {
    const userData = path.join(TMP_ROOT, 'app');
    await fs.mkdir(userData, { recursive: true });
    const h = new HistoryService(userData);
    const target = path.join(userData, 'historico');
    expect(
      await fs
        .stat(target)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
    await h.ensureFolder();
    const stats = await fs.stat(target);
    expect(stats.isDirectory()).toBe(true);
  });

  it('ensureFolder é idempotente (chamada dupla não joga)', async () => {
    const userData = path.join(TMP_ROOT, 'app2');
    await fs.mkdir(userData, { recursive: true });
    const h = new HistoryService(userData);
    await h.ensureFolder();
    await expect(h.ensureFolder()).resolves.toBeUndefined();
  });

  it('ensureFolder cria pais recursivamente se userData não existe', async () => {
    const userData = path.join(TMP_ROOT, 'deep', 'nested', 'app');
    const h = new HistoryService(userData);
    await h.ensureFolder();
    const target = path.join(userData, 'historico');
    const stats = await fs.stat(target);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe('HistoryService — Gate 6: archive', () => {
  let userData: string;
  let h: HistoryService;

  beforeEach(async () => {
    userData = path.join(TMP_ROOT, `archive-${Math.random().toString(36).slice(2, 10)}`);
    await fs.mkdir(userData, { recursive: true });
    h = new HistoryService(userData);
  });

  afterEach(async () => {
    await fs.rm(TMP_ROOT, { recursive: true, force: true });
  });

  it('cria <userData>/historico/YYYY-MM-DD/<filename> com o rawContent', async () => {
    const filename = '01HX9K2M4F8N7P2Q5R3S6T7V8W-joao.json';
    const rawContent = '{"foo":"bar"}';
    await h.archive({}, filename, rawContent);

    const day = format(new Date(), 'yyyy-MM-dd');
    const expected = path.join(userData, 'historico', day, filename);
    const written = await fs.readFile(expected, 'utf-8');
    expect(written).toBe(rawContent);
  });

  it('marca o filename no cache após archive (dedup automático)', async () => {
    const filename = 'sprint-x-joao.json';
    expect(h.isAlreadyArchived(filename)).toBe(false);
    await h.archive({}, filename, '{}');
    expect(h.isAlreadyArchived(filename)).toBe(true);
  });

  it('arquivos do mesmo dia caem na mesma subpasta', async () => {
    await h.archive({}, 'a-joao.json', '{"a":1}');
    await h.archive({}, 'b-joao.json', '{"b":2}');

    const day = format(new Date(), 'yyyy-MM-dd');
    const dayFolder = path.join(userData, 'historico', day);
    const files = (await fs.readdir(dayFolder)).filter((f) => f.endsWith('.json'));
    expect(files.sort()).toEqual(['a-joao.json', 'b-joao.json']);
  });

  it('escrita atômica não deixa arquivos .tmp órfãos no caso feliz', async () => {
    await h.archive({}, 'x-joao.json', '{}');
    const day = format(new Date(), 'yyyy-MM-dd');
    const dayFolder = path.join(userData, 'historico', day);
    const all = await fs.readdir(dayFolder);
    expect(all.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('overwrite no MESMO filename do mesmo dia substitui o conteúdo', async () => {
    const filename = 'sprint-y-joao.json';
    await h.archive({}, filename, '{"v":1}');
    await h.archive({}, filename, '{"v":2}');

    const day = format(new Date(), 'yyyy-MM-dd');
    const written = await fs.readFile(path.join(userData, 'historico', day, filename), 'utf-8');
    expect(written).toBe('{"v":2}');
  });
});

describe('HistoryService — Gate 6: initializeFromDisk', () => {
  let userData: string;

  beforeEach(async () => {
    userData = path.join(TMP_ROOT, `init-${Math.random().toString(36).slice(2, 10)}`);
    await fs.mkdir(userData, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TMP_ROOT, { recursive: true, force: true });
  });

  it('no-op silencioso se historico/ não existe (primeiro boot)', async () => {
    const h = new HistoryService(userData);
    await expect(h.initializeFromDisk()).resolves.toBeUndefined();
    expect(h.snapshot()).toEqual([]);
  });

  it('popula cache com filenames .json de cada subpasta YYYY-MM-DD', async () => {
    const historico = path.join(userData, 'historico');
    await fs.mkdir(path.join(historico, '2026-05-25'), { recursive: true });
    await fs.mkdir(path.join(historico, '2026-05-26'), { recursive: true });
    await fs.writeFile(path.join(historico, '2026-05-25', 'a-joao.json'), '{}', 'utf-8');
    await fs.writeFile(path.join(historico, '2026-05-25', 'b-joao.json'), '{}', 'utf-8');
    await fs.writeFile(path.join(historico, '2026-05-26', 'c-joao.json'), '{}', 'utf-8');

    const h = new HistoryService(userData);
    await h.initializeFromDisk();

    expect(h.isAlreadyArchived('a-joao.json')).toBe(true);
    expect(h.isAlreadyArchived('b-joao.json')).toBe(true);
    expect(h.isAlreadyArchived('c-joao.json')).toBe(true);
    expect([...h.snapshot()].sort()).toEqual(['a-joao.json', 'b-joao.json', 'c-joao.json']);
  });

  it('ignora arquivos não-.json (e.g. .tmp órfãos)', async () => {
    const historico = path.join(userData, 'historico');
    await fs.mkdir(path.join(historico, '2026-05-26'), { recursive: true });
    await fs.writeFile(path.join(historico, '2026-05-26', 'ok-joao.json'), '{}', 'utf-8');
    await fs.writeFile(path.join(historico, '2026-05-26', 'orfao.tmp'), '', 'utf-8');
    await fs.writeFile(path.join(historico, '2026-05-26', '.DS_Store'), '', 'utf-8');

    const h = new HistoryService(userData);
    await h.initializeFromDisk();
    expect(h.snapshot()).toEqual(['ok-joao.json']);
  });

  it('ignora arquivos soltos na raiz do historico/ (não tem subpasta de dia)', async () => {
    const historico = path.join(userData, 'historico');
    await fs.mkdir(historico, { recursive: true });
    // Arquivo solto direto em historico/ (não dentro de YYYY-MM-DD/)
    await fs.writeFile(path.join(historico, 'solto.json'), '{}', 'utf-8');

    const h = new HistoryService(userData);
    await h.initializeFromDisk();
    expect(h.snapshot()).toEqual([]);
  });

  it('idempotente — chamadas duplas não duplicam', async () => {
    const historico = path.join(userData, 'historico');
    await fs.mkdir(path.join(historico, '2026-05-26'), { recursive: true });
    await fs.writeFile(path.join(historico, '2026-05-26', 'a.json'), '{}', 'utf-8');

    const h = new HistoryService(userData);
    await h.initializeFromDisk();
    await h.initializeFromDisk();
    expect(h.snapshot()).toEqual(['a.json']);
  });

  it('archive após initializeFromDisk preserva cache existente + adiciona', async () => {
    const historico = path.join(userData, 'historico');
    await fs.mkdir(path.join(historico, '2026-05-25'), { recursive: true });
    await fs.writeFile(path.join(historico, '2026-05-25', 'old.json'), '{}', 'utf-8');

    const h = new HistoryService(userData);
    await h.initializeFromDisk();
    expect(h.isAlreadyArchived('old.json')).toBe(true);

    await h.archive({}, 'new-joao.json', '{}');
    expect(h.isAlreadyArchived('old.json')).toBe(true);
    expect(h.isAlreadyArchived('new-joao.json')).toBe(true);
  });
});

describe('HistoryService — BL-C3-009: loadLastArchived', () => {
  const VALID_SPRINT_OLD = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
  const VALID_SPRINT_MID = '01HXAAABBBCCCDDDEEEFFFGGGH';
  const VALID_SPRINT_NEW = '01HXBBBCCCDDDEEEFFFGGGHHHJ';

  function makeSprintJson(sprintId: string, userId = 'joao'): string {
    return JSON.stringify({
      schema_version: '1.0',
      sprint_id: sprintId,
      criado_por: 'Renan',
      criado_em: '2026-05-26T10:00:00.000Z',
      user_id: userId,
      title: 'Meta de teste',
      body_html: 'corpo',
      meta: 5,
      deadline_at: '2026-05-26T21:00:00.000Z',
    });
  }

  let userData: string;

  beforeEach(async () => {
    userData = path.join(TMP_ROOT, `loadlast-${Math.random().toString(36).slice(2, 10)}`);
    await fs.mkdir(userData, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TMP_ROOT, { recursive: true, force: true });
  });

  it('retorna null quando historico/ não existe', async () => {
    const h = new HistoryService(userData);
    expect(await h.loadLastArchived()).toBeNull();
  });

  it('retorna null quando historico/ existe mas vazio', async () => {
    await fs.mkdir(path.join(userData, 'historico'), { recursive: true });
    const h = new HistoryService(userData);
    expect(await h.loadLastArchived()).toBeNull();
  });

  it('retorna a única sprint quando há apenas 1 arquivo', async () => {
    const filename = `${VALID_SPRINT_OLD}-joao.json`;
    const dayPath = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(dayPath, { recursive: true });
    await fs.writeFile(path.join(dayPath, filename), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result).not.toBeNull();
    expect(result?.filename).toBe(filename);
    expect(result?.payload.sprint_id).toBe(VALID_SPRINT_OLD);
  });

  it('retorna a sprint do dia mais recente quando há múltiplos dias', async () => {
    const oldFile = `${VALID_SPRINT_OLD}-joao.json`;
    const newFile = `${VALID_SPRINT_NEW}-joao.json`;
    const oldDay = path.join(userData, 'historico', '2026-05-25');
    const newDay = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(oldDay, { recursive: true });
    await fs.mkdir(newDay, { recursive: true });
    await fs.writeFile(path.join(oldDay, oldFile), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');
    await fs.writeFile(path.join(newDay, newFile), makeSprintJson(VALID_SPRINT_NEW), 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result?.filename).toBe(newFile);
  });

  it('retorna ULID mais novo (sort desc) dentro do mesmo dia', async () => {
    const oldFile = `${VALID_SPRINT_OLD}-joao.json`;
    const midFile = `${VALID_SPRINT_MID}-joao.json`;
    const newFile = `${VALID_SPRINT_NEW}-joao.json`;
    const day = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(day, { recursive: true });
    await fs.writeFile(path.join(day, oldFile), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');
    await fs.writeFile(path.join(day, midFile), makeSprintJson(VALID_SPRINT_MID), 'utf-8');
    await fs.writeFile(path.join(day, newFile), makeSprintJson(VALID_SPRINT_NEW), 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result?.filename).toBe(newFile);
  });

  it('ignora arquivos cancel-*.json (não faz sentido reabrir sprint cancelada)', async () => {
    const sprintFile = `${VALID_SPRINT_OLD}-joao.json`;
    const cancelFile = `cancel-${VALID_SPRINT_NEW}.json`;
    const day = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(day, { recursive: true });
    await fs.writeFile(path.join(day, sprintFile), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');
    await fs.writeFile(path.join(day, cancelFile), '{"type":"cancel"}', 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result?.filename).toBe(sprintFile);
  });

  it('pula arquivos corrompidos (JSON inválido)', async () => {
    const corrupt = `${VALID_SPRINT_NEW}-joao.json`;
    const valid = `${VALID_SPRINT_OLD}-joao.json`;
    const day = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(day, { recursive: true });
    await fs.writeFile(path.join(day, corrupt), '{ broken json', 'utf-8');
    await fs.writeFile(path.join(day, valid), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result?.filename).toBe(valid);
  });

  it('pula arquivos com schema inválido (faltando campo)', async () => {
    const incomplete = `${VALID_SPRINT_NEW}-joao.json`;
    const valid = `${VALID_SPRINT_OLD}-joao.json`;
    const day = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(day, { recursive: true });
    await fs.writeFile(path.join(day, incomplete), '{"missing":"everything"}', 'utf-8');
    await fs.writeFile(path.join(day, valid), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result?.filename).toBe(valid);
  });

  it('NÃO atualiza cache (leitura passiva — não chama markProcessed)', async () => {
    const filename = `${VALID_SPRINT_OLD}-joao.json`;
    const day = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(day, { recursive: true });
    await fs.writeFile(path.join(day, filename), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');

    const h = new HistoryService(userData);
    expect(h.isAlreadyArchived(filename)).toBe(false);
    await h.loadLastArchived();
    expect(h.isAlreadyArchived(filename)).toBe(false);
  });

  it('retorna null se todos os dias só têm cancels', async () => {
    const cancel = `cancel-${VALID_SPRINT_NEW}.json`;
    const day = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(day, { recursive: true });
    await fs.writeFile(path.join(day, cancel), '{"type":"cancel"}', 'utf-8');

    const h = new HistoryService(userData);
    expect(await h.loadLastArchived()).toBeNull();
  });

  it('busca em dias anteriores se dia mais recente só tem cancels', async () => {
    const sprintFile = `${VALID_SPRINT_OLD}-joao.json`;
    const cancelFile = `cancel-${VALID_SPRINT_NEW}.json`;
    const oldDay = path.join(userData, 'historico', '2026-05-25');
    const newDay = path.join(userData, 'historico', '2026-05-26');
    await fs.mkdir(oldDay, { recursive: true });
    await fs.mkdir(newDay, { recursive: true });
    await fs.writeFile(path.join(oldDay, sprintFile), makeSprintJson(VALID_SPRINT_OLD), 'utf-8');
    await fs.writeFile(path.join(newDay, cancelFile), '{"type":"cancel"}', 'utf-8');

    const h = new HistoryService(userData);
    const result = await h.loadLastArchived();
    expect(result?.filename).toBe(sprintFile);
  });
});
