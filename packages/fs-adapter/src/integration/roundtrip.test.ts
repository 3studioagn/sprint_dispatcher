/**
 * Integration tests cross-package: PendingStore/AckStore + Contracts
 * + (opcionalmente) NodeFilesystemAdapter.
 *
 * Property-based via fast-check garante invariantes universais:
 * para qualquer payload arbitrary válido, write → list retorna os
 * campos críticos preservados. Sanitização do `body_html` é
 * testada em isolado (XSS injetado vira sanitizado pós-write).
 *
 * Memória in-memory é a escolha default — rápido, determinístico,
 * suficiente para validar a interação Contracts + Domain Layer.
 * 2 testes finais usam NodeFilesystemAdapter para validar o
 * caminho real end-to-end em FS de produção.
 *
 * Nota arquitetural sobre `body_html`:
 *   PendingStore.writePendingSprint chama `sanitizeBodyHtml` antes de
 *   gravar (CLAUDE §7.9 + ADR-014). Logo o body lido de volta NÃO é
 *   byte-a-byte igual ao input quando o input contém HTML não-whitelist.
 *   `safeBodyHtmlArbitrary` abaixo gera apenas conteúdo que SOBREVIVE
 *   sanitização (texto plain sem `<`/`>`/`&`, ou HTML da whitelist).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  generateSprintId,
  parseSprintAck,
  parseSprintPayload,
  sanitizeBodyHtml,
  type SprintAck,
  type SprintPayload,
} from '@sprint/contracts';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ulidArbitrary, userIdArbitrary } from '../__helpers__/arbitraries';
import { setupTmpShared, type TmpSharedContext } from '../__helpers__/tmpFixtures';
import { AckStore, PendingStore } from '../index';
import { MemoryFilesystemAdapter } from '../memory-adapter';
import { NodeFilesystemAdapter } from '../node-adapter';

// =====================================================================
// Arbitraries locais
//
// Body que sobrevive sanitização byte-a-byte:
// - texto ASCII sem `<`, `>`, `&`, aspas
// - OU whitelist HTML pré-formado
// =====================================================================

const SANITIZE_SAFE_CHARS = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ...' .,!?-_:;/',
];

const plainTextBodyArbitrary: fc.Arbitrary<string> = fc
  .array(fc.constantFrom<string>(...SANITIZE_SAFE_CHARS), { minLength: 1, maxLength: 200 })
  .map((chars) => chars.join(''));

const whitelistHtmlBodyArbitrary: fc.Arbitrary<string> = fc.constantFrom(
  '<p>Meta diaria</p>',
  '<b>250 unidades</b>',
  '<h1>Atencao</h1><p>Meta urgente</p>',
  '<span>ate 18:00</span>',
  '<i>obs:</i> validar antes',
  '<p>Linha 1</p><p>Linha 2</p>',
  '<b>Importante</b>',
);

const safeBodyHtmlArbitrary: fc.Arbitrary<string> = fc.oneof(
  plainTextBodyArbitrary,
  whitelistHtmlBodyArbitrary,
);

const isoDatetimeArbitrary: fc.Arbitrary<string> = fc
  .date({ min: new Date(Date.UTC(2020, 0, 1)), max: new Date(Date.UTC(2030, 11, 31)) })
  .map((d) => d.toISOString());

const semverArbitrary: fc.Arbitrary<string> = fc
  .tuple(fc.nat(99), fc.nat(99), fc.nat(99))
  .map(([major, minor, patch]) => `${String(major)}.${String(minor)}.${String(patch)}`);

const safeSprintPayloadArbitrary: fc.Arbitrary<SprintPayload> = fc
  .record({
    sprint_id: ulidArbitrary,
    user_id: userIdArbitrary,
    criado_por: plainTextBodyArbitrary.map((s) => s.slice(0, 100)).filter((s) => s.length > 0),
    criado_em: isoDatetimeArbitrary,
    title: plainTextBodyArbitrary.map((s) => s.slice(0, 200)).filter((s) => s.length > 0),
    body_html: safeBodyHtmlArbitrary,
    meta: fc.integer({ min: 1, max: 100_000 }),
    deadline_at: isoDatetimeArbitrary,
    show_duration_seconds: fc.integer({ min: 1, max: 60 }),
    persistent_popup: fc.boolean(),
  })
  .map((raw) =>
    parseSprintPayload({
      schema_version: '1.0',
      ...raw,
    }),
  );

const safeSprintAckArbitrary: fc.Arbitrary<SprintAck> = fc
  .record({
    sprint_id: ulidArbitrary,
    user_id: userIdArbitrary,
    hostname: plainTextBodyArbitrary.map((s) => s.slice(0, 100)).filter((s) => s.length > 0),
    displayed_at: isoDatetimeArbitrary,
    agent_version: semverArbitrary,
  })
  .map((raw) =>
    parseSprintAck({
      schema_version: '1.0',
      ...raw,
    }),
  );

// =====================================================================
// PROPERTY: roundtrip writePendingSprint → listPending (Memory)
// =====================================================================

describe('roundtrip cross-package — PendingStore + Contracts (Memory adapter)', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: PendingStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new PendingStore(adapter, '/shared');
  });

  it('property: para qualquer payload válido, listPending recupera os campos críticos', async () => {
    await fc.assert(
      fc.asyncProperty(safeSprintPayloadArbitrary, async (payload) => {
        adapter.reset();

        await store.writePendingSprint(payload);
        const entries = await store.listPending();
        if (entries.length !== 1) return false;
        const [entry] = entries;
        if (entry?.kind !== 'sprint') return false;

        const got = entry.payload;
        return (
          got.sprint_id === payload.sprint_id &&
          got.user_id === payload.user_id &&
          got.meta === payload.meta &&
          got.title === payload.title &&
          got.criado_por === payload.criado_por &&
          got.criado_em === payload.criado_em &&
          got.deadline_at === payload.deadline_at &&
          got.body_html === payload.body_html &&
          got.show_duration_seconds === payload.show_duration_seconds &&
          got.persistent_popup === payload.persistent_popup &&
          got.schema_version === payload.schema_version
        );
      }),
      { numRuns: 50 },
    );
  });

  it('property: filtro userId retorna apenas as entries daquele user', async () => {
    await fc.assert(
      fc.asyncProperty(safeSprintPayloadArbitrary, async (payload) => {
        adapter.reset();
        await store.writePendingSprint(payload);

        const entries = await store.listPending({ userId: payload.user_id });
        return (
          entries.length === 1 &&
          entries[0]?.kind === 'sprint' &&
          entries[0].payload.user_id === payload.user_id
        );
      }),
      { numRuns: 50 },
    );
  });
});

// =====================================================================
// PROPERTY: roundtrip writeAck → listAcks (Memory)
// =====================================================================

describe('roundtrip cross-package — AckStore + Contracts (Memory adapter)', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: AckStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new AckStore(adapter, '/shared');
  });

  it('property: para qualquer ack válido, listAcks recupera os campos críticos', async () => {
    await fc.assert(
      fc.asyncProperty(safeSprintAckArbitrary, async (ack) => {
        adapter.reset();

        await store.writeAck(ack);
        const entries = await store.listAcks();
        if (entries.length !== 1) return false;
        const [entry] = entries;
        if (entry?.kind !== 'ack') return false;

        const got = entry.payload;
        return (
          got.sprint_id === ack.sprint_id &&
          got.user_id === ack.user_id &&
          got.hostname === ack.hostname &&
          got.displayed_at === ack.displayed_at &&
          got.agent_version === ack.agent_version
        );
      }),
      { numRuns: 50 },
    );
  });
});

// =====================================================================
// XSS end-to-end — body é sanitizado pelo PendingStore antes de gravar
// =====================================================================

describe('roundtrip cross-package — sanitização end-to-end (Memory adapter)', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: PendingStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new PendingStore(adapter, '/shared');
  });

  function buildPayload(body: string): SprintPayload {
    return parseSprintPayload({
      schema_version: '1.0',
      sprint_id: generateSprintId(),
      criado_por: 'Renan',
      criado_em: new Date().toISOString(),
      user_id: 'joao',
      title: 'Sprint XSS test',
      body_html: body,
      meta: 100,
      deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }

  it('body com <script>alert(1)</script>: arquivo lido não contém <script', async () => {
    const dirty = '<p>Atencao</p><script>alert(1)</script>';
    await store.writePendingSprint(buildPayload(dirty));

    const entries = await store.listPending();
    expect(entries).toHaveLength(1);
    if (entries[0]?.kind === 'sprint') {
      expect(entries[0].payload.body_html).not.toContain('<script');
      expect(entries[0].payload.body_html).toContain('<p>Atencao</p>');
    }
  });

  it('body com handler inline (onerror) é neutralizado, tag removida', async () => {
    const dirty = '<p>OK</p><img src=x onerror=alert(1)>';
    await store.writePendingSprint(buildPayload(dirty));

    const entries = await store.listPending();
    if (entries[0]?.kind === 'sprint') {
      expect(entries[0].payload.body_html).not.toContain('onerror');
      expect(entries[0].payload.body_html).not.toContain('<img');
    }
  });

  it('body já sanitizado é preservado byte-a-byte (idempotência via PendingStore)', async () => {
    const clean = '<p>Meta diaria: <b>200 unidades</b></p>';
    // Pre-sanitiza (deve ser no-op)
    expect(sanitizeBodyHtml(clean)).toBe(clean);

    await store.writePendingSprint(buildPayload(clean));

    const entries = await store.listPending();
    if (entries[0]?.kind === 'sprint') {
      expect(entries[0].payload.body_html).toBe(clean);
    }
  });
});

// =====================================================================
// Unicode + payloads grandes (Memory)
// =====================================================================

describe('roundtrip cross-package — unicode e payloads grandes (Memory adapter)', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: PendingStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new PendingStore(adapter, '/shared');
  });

  function buildPayload(body: string, title = 'Sprint unicode'): SprintPayload {
    return parseSprintPayload({
      schema_version: '1.0',
      sprint_id: generateSprintId(),
      criado_por: 'Renan',
      criado_em: new Date().toISOString(),
      user_id: 'joao',
      title,
      body_html: body,
      meta: 100,
      deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
  }

  it('body com acentos + emojis + caractere especial é preservado byte-a-byte', async () => {
    // Conteúdo entirely whitelist-safe — só tags <b>, texto unicode
    const body = '<b>Atenção: meta de hoje é 250 ✓ urgência alta!</b>';
    await store.writePendingSprint(buildPayload(body));

    const entries = await store.listPending();
    if (entries[0]?.kind === 'sprint') {
      expect(entries[0].payload.body_html).toBe(body);
    }
  });

  it('body com emoji ZWJ family (👨‍👩‍👧‍👦) preservado dentro de <p>', async () => {
    const family = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}';
    const body = `<p>Meta ${family} hoje</p>`;
    await store.writePendingSprint(buildPayload(body));

    const entries = await store.listPending();
    if (entries[0]?.kind === 'sprint') {
      expect(entries[0].payload.body_html).toContain(family);
    }
  });

  it('body próximo ao limite (1900 chars de texto plain) preservado', async () => {
    // Schema limita body_html a 2000 chars; 1900 fica seguro
    const body = `<p>${'a'.repeat(1900)}</p>`;
    expect(body.length).toBeLessThanOrEqual(2000);

    await store.writePendingSprint(buildPayload(body));

    const entries = await store.listPending();
    if (entries[0]?.kind === 'sprint') {
      expect(entries[0].payload.body_html).toBe(body);
    }
  });
});

// =====================================================================
// End-to-end com Node real FS (validação extra)
// =====================================================================

describe('roundtrip cross-package — end-to-end Node real FS', () => {
  let ctx: TmpSharedContext;
  let nodeAdapter: NodeFilesystemAdapter;
  let pendingStore: PendingStore;
  let ackStore: AckStore;

  beforeEach(async () => {
    ctx = await setupTmpShared('roundtrip-e2e');
    nodeAdapter = new NodeFilesystemAdapter();
    pendingStore = new PendingStore(nodeAdapter, ctx.sharedPath);
    ackStore = new AckStore(nodeAdapter, ctx.sharedPath);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('writePendingSprint grava arquivo .json válido em disk com schema preservado', async () => {
    const payload = parseSprintPayload({
      schema_version: '1.0',
      sprint_id: generateSprintId(),
      criado_por: 'Renan',
      criado_em: new Date().toISOString(),
      user_id: 'maria',
      title: 'Sprint E2E',
      body_html: '<p>Meta diaria</p>',
      meta: 250,
      deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    await pendingStore.writePendingSprint(payload);

    // Verifica arquivo em disco e parsing direto
    const filenames = await fs.readdir(path.join(ctx.sharedPath, 'pending'));
    expect(filenames).toHaveLength(1);

    const raw = await fs.readFile(path.join(ctx.sharedPath, 'pending', filenames[0]!), 'utf-8');
    const reparsed = parseSprintPayload(JSON.parse(raw));
    expect(reparsed.sprint_id).toBe(payload.sprint_id);
    expect(reparsed.meta).toBe(250);
    expect(reparsed.body_html).toBe('<p>Meta diaria</p>');
  });

  it('writeAck grava arquivo .ack.json válido em disk com schema preservado', async () => {
    const ack = parseSprintAck({
      schema_version: '1.0',
      sprint_id: generateSprintId(),
      user_id: 'joao',
      hostname: 'PC-DEV',
      displayed_at: new Date().toISOString(),
      agent_version: '1.2.3',
    });

    await ackStore.writeAck(ack);

    const filenames = await fs.readdir(path.join(ctx.sharedPath, 'acks'));
    expect(filenames).toHaveLength(1);
    expect(filenames[0]).toMatch(/\.ack\.json$/);

    const raw = await fs.readFile(path.join(ctx.sharedPath, 'acks', filenames[0]!), 'utf-8');
    const reparsed = parseSprintAck(JSON.parse(raw));
    expect(reparsed.agent_version).toBe('1.2.3');
  });

  it('XSS injetado no body é gravado em disco já sanitizado', async () => {
    const payload = parseSprintPayload({
      schema_version: '1.0',
      sprint_id: generateSprintId(),
      criado_por: 'Renan',
      criado_em: new Date().toISOString(),
      user_id: 'joao',
      title: 'XSS E2E',
      body_html: '<p>OK</p><script>alert(1)</script>',
      meta: 100,
      deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    await pendingStore.writePendingSprint(payload);

    // Lê o arquivo cru do disco — confirma que o XSS NÃO atingiu o disk
    const filenames = await fs.readdir(path.join(ctx.sharedPath, 'pending'));
    const raw = await fs.readFile(path.join(ctx.sharedPath, 'pending', filenames[0]!), 'utf-8');
    expect(raw).not.toContain('<script');
    expect(raw).not.toContain('alert(1)');
    expect(raw).toContain('<p>OK</p>');
  });
});
