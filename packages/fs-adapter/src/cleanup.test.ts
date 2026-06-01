import {
  buildAckFilename,
  buildCancelFilename,
  buildPendingFilename,
  generateSprintId,
  parseSprintAck,
  parseSprintCancel,
  parseSprintPayload,
  type SprintAck,
  type SprintCancel,
  type SprintPayload,
} from '@sprint/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CleanupEvent,
  formatCleanupLogLine,
  parseCleanupArgs,
  planCleanup,
  runCleanup,
} from './cleanup';
import { AckStore } from './domain/ack-store';
import type { AckEntry } from './domain/ack-store';
import { ArchiveStore } from './domain/archive-store';
import type { PendingEntry } from './domain/pending-store';
import { PendingStore } from './domain/pending-store';
import { MemoryFilesystemAdapter } from './memory-adapter';

const SHARED = '/shared';
const NOW = new Date('2026-06-01T12:00:00.000Z');
const DAY = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function makePayload(sprintId: string, userId: string, deadlineAt: string): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: sprintId,
    criado_por: 'Renan',
    criado_em: '2026-05-21T14:00:00.000Z',
    user_id: userId,
    title: 'Meta',
    body_html: '<p>x</p>',
    meta: 50,
    deadline_at: deadlineAt,
  });
}

function makeAck(sprintId: string, userId: string): SprintAck {
  return parseSprintAck({
    schema_version: '1.0',
    sprint_id: sprintId,
    user_id: userId,
    hostname: 'PC',
    displayed_at: '2026-05-21T14:05:00.000Z',
    agent_version: '0.1.0',
  });
}

function makeCancel(sprintId: string): SprintCancel {
  return parseSprintCancel({
    schema_version: '1.0',
    type: 'cancel',
    sprint_id_ref: sprintId,
    cancelado_por: 'Renan',
    cancelado_em: '2026-05-21T15:00:00.000Z',
  });
}

function sprintEntry(
  sprintId: string,
  userId: string,
  opts: { modifiedAt: Date; deadlineAt: string },
): PendingEntry {
  return {
    kind: 'sprint',
    filename: buildPendingFilename(sprintId, userId),
    modifiedAt: opts.modifiedAt,
    payload: makePayload(sprintId, userId, opts.deadlineAt),
  };
}

function ackEntry(sprintId: string, userId: string, modifiedAt: Date): AckEntry {
  return {
    kind: 'ack',
    filename: buildAckFilename(sprintId, userId),
    modifiedAt,
    payload: makeAck(sprintId, userId),
  };
}

const FUTURE = '2026-06-10T18:00:00.000Z'; // depois de NOW
const PAST = '2026-05-30T18:00:00.000Z'; // antes de NOW

describe('planCleanup', () => {
  describe('modo age', () => {
    it('arquiva sprint mais velha que a retenção (reason age)', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(10), deadlineAt: FUTURE })],
        [],
        { mode: 'age', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive).toHaveLength(1);
      expect(plan.sprintsToArchive[0]?.reason).toBe('age');
    });

    it('não arquiva sprint recente, mesmo com deadline passado', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(1), deadlineAt: PAST })],
        [],
        { mode: 'age', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive).toHaveLength(0);
    });
  });

  describe('modo deadline', () => {
    it('arquiva sprint com deadline passado (reason deadline), mesmo recente', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(1), deadlineAt: PAST })],
        [],
        { mode: 'deadline', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive).toHaveLength(1);
      expect(plan.sprintsToArchive[0]?.reason).toBe('deadline');
    });

    it('não arquiva sprint velha se o deadline ainda não passou', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(30), deadlineAt: FUTURE })],
        [],
        { mode: 'deadline', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive).toHaveLength(0);
    });
  });

  describe('modo both (padrão)', () => {
    it('deadline passado tem prioridade no motivo, mesmo arquivo recente', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(1), deadlineAt: PAST })],
        [],
        { mode: 'both', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive[0]?.reason).toBe('deadline');
    });

    it('arquiva por idade quando o deadline ainda não passou', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(10), deadlineAt: FUTURE })],
        [],
        { mode: 'both', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive[0]?.reason).toBe('age');
    });

    it('não arquiva sprint recente com deadline futuro', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(1), deadlineAt: FUTURE })],
        [],
        { mode: 'both', retentionDays: 7, now: NOW },
      );
      expect(plan.sprintsToArchive).toHaveLength(0);
    });
  });

  describe('arquivos de cancelamento', () => {
    it('são ignorados (skip) — não arquivados por este job', () => {
      const id = generateSprintId();
      const cancel: PendingEntry = {
        kind: 'cancel',
        filename: buildCancelFilename(id),
        modifiedAt: daysAgo(30),
        payload: makeCancel(id),
      };
      const plan = planCleanup([cancel], [], { mode: 'both', retentionDays: 7, now: NOW });
      expect(plan.sprintsToArchive).toHaveLength(0);
      expect(plan.skipped).toHaveLength(1);
      expect(plan.skipped[0]?.filename).toBe(buildCancelFilename(id));
    });
  });

  describe('arquivos inválidos', () => {
    it('ignora entry inválida cujo nome não é de sprint (ex.: cancel corrompido)', () => {
      const id = generateSprintId();
      const invalidCancel: PendingEntry = {
        kind: 'invalid',
        filename: buildCancelFilename(id),
        modifiedAt: daysAgo(30),
        reason: 'JSON inválido',
      };
      const plan = planCleanup([invalidCancel], [], { mode: 'both', retentionDays: 7, now: NOW });
      expect(plan.sprintsToArchive).toHaveLength(0);
      expect(plan.skipped).toHaveLength(1);
      expect(plan.skipped[0]?.reason).toMatch(/não é um arquivo de sprint/);
    });

    it('gera aviso e arquiva por idade (modo both)', () => {
      const id = generateSprintId();
      const invalid: PendingEntry = {
        kind: 'invalid',
        filename: buildPendingFilename(id, 'joao'),
        modifiedAt: daysAgo(10),
        reason: 'schema inválido: meta ausente',
      };
      const plan = planCleanup([invalid], [], { mode: 'both', retentionDays: 7, now: NOW });
      expect(plan.warnings).toHaveLength(1);
      expect(plan.sprintsToArchive).toHaveLength(1);
      expect(plan.sprintsToArchive[0]?.reason).toBe('age');
    });

    it('avisa mas não arquiva em modo deadline (sem deadline legível)', () => {
      const id = generateSprintId();
      const invalid: PendingEntry = {
        kind: 'invalid',
        filename: buildPendingFilename(id, 'joao'),
        modifiedAt: daysAgo(30),
        reason: 'JSON inválido',
      };
      const plan = planCleanup([invalid], [], { mode: 'deadline', retentionDays: 7, now: NOW });
      expect(plan.warnings).toHaveLength(1);
      expect(plan.sprintsToArchive).toHaveLength(0);
    });

    it('avisa mas não arquiva inválido recente (idade não qualifica)', () => {
      const id = generateSprintId();
      const invalid: PendingEntry = {
        kind: 'invalid',
        filename: buildPendingFilename(id, 'joao'),
        modifiedAt: daysAgo(1),
        reason: 'JSON inválido',
      };
      const plan = planCleanup([invalid], [], { mode: 'both', retentionDays: 7, now: NOW });
      expect(plan.warnings).toHaveLength(1);
      expect(plan.sprintsToArchive).toHaveLength(0);
    });
  });

  describe('acks órfãos', () => {
    it('arquiva ack órfão velho por idade', () => {
      const id = generateSprintId();
      const plan = planCleanup([], [ackEntry(id, 'joao', daysAgo(10))], {
        mode: 'both',
        retentionDays: 7,
        now: NOW,
      });
      expect(plan.acksToArchive).toHaveLength(1);
      expect(plan.acksToArchive[0]?.reason).toBe('age');
    });

    it('não arquiva ack órfão recente', () => {
      const id = generateSprintId();
      const plan = planCleanup([], [ackEntry(id, 'joao', daysAgo(1))], {
        mode: 'both',
        retentionDays: 7,
        now: NOW,
      });
      expect(plan.acksToArchive).toHaveLength(0);
    });

    it('NÃO arquiva ack cuja sprint ainda está em pending (movido junto)', () => {
      const id = generateSprintId();
      const plan = planCleanup(
        [sprintEntry(id, 'joao', { modifiedAt: daysAgo(10), deadlineAt: FUTURE })],
        [ackEntry(id, 'joao', daysAgo(10))],
        { mode: 'both', retentionDays: 7, now: NOW },
      );
      // A sprint será arquivada (move o ack junto); o ack não entra em acksToArchive.
      expect(plan.sprintsToArchive).toHaveLength(1);
      expect(plan.acksToArchive).toHaveLength(0);
    });

    it('não arquiva ack órfão em modo deadline (acks não têm deadline)', () => {
      const id = generateSprintId();
      const plan = planCleanup([], [ackEntry(id, 'joao', daysAgo(30))], {
        mode: 'deadline',
        retentionDays: 7,
        now: NOW,
      });
      expect(plan.acksToArchive).toHaveLength(0);
    });

    it('avisa sobre ack órfão inválido e arquiva por idade', () => {
      const id = generateSprintId();
      const invalidAck: AckEntry = {
        kind: 'invalid',
        filename: buildAckFilename(id, 'joao'),
        modifiedAt: daysAgo(10),
        reason: 'JSON inválido',
      };
      const plan = planCleanup([], [invalidAck], { mode: 'age', retentionDays: 7, now: NOW });
      expect(plan.warnings).toHaveLength(1);
      expect(plan.acksToArchive).toHaveLength(1);
    });
  });
});

describe('runCleanup', () => {
  let adapter: MemoryFilesystemAdapter;
  let pendingStore: PendingStore;
  let ackStore: AckStore;
  let archiveStore: ArchiveStore;
  let events: CleanupEvent[];

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    pendingStore = new PendingStore(adapter, SHARED);
    ackStore = new AckStore(adapter, SHARED);
    archiveStore = new ArchiveStore(adapter, SHARED);
    events = [];
  });

  const onEvent = (e: CleanupEvent): void => {
    events.push(e);
  };

  it('arquiva sprints expiradas e emite start/archived/done', async () => {
    const id = generateSprintId();
    // mtime do Memory = agora real; usamos NOW grande no futuro p/ qualificar idade.
    await pendingStore.writePendingSprint(makePayload(id, 'joao', PAST));
    await ackStore.writeAck(makeAck(id, 'joao'));

    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 0, mode: 'both', dryRun: false, now: NOW },
      { pendingStore, ackStore, archiveStore, onEvent },
    );

    expect(summary.archived).toBe(1);
    expect(summary.archivedFilenames).toContain(buildPendingFilename(id, 'joao'));
    expect(events.some((e) => e.kind === 'start')).toBe(true);
    expect(events.some((e) => e.kind === 'archived')).toBe(true);
    expect(events.some((e) => e.kind === 'done')).toBe(true);
    // Sprint saiu de pending/.
    await expect(
      adapter.exists(`${SHARED}/pending/${buildPendingFilename(id, 'joao')}`),
    ).resolves.toBe(false);
  });

  it('dry-run não move nada e emite candidate (sem archived)', async () => {
    const id = generateSprintId();
    await pendingStore.writePendingSprint(makePayload(id, 'joao', PAST));

    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 0, mode: 'both', dryRun: true, now: NOW },
      { pendingStore, ackStore, archiveStore, onEvent },
    );

    expect(summary.dryRun).toBe(true);
    expect(summary.archived).toBe(1); // "seria arquivado"
    expect(events.some((e) => e.kind === 'candidate')).toBe(true);
    expect(events.some((e) => e.kind === 'archived')).toBe(false);
    // Nada movido — sprint segue em pending/.
    await expect(
      adapter.exists(`${SHARED}/pending/${buildPendingFilename(id, 'joao')}`),
    ).resolves.toBe(true);
  });

  it('pending/ e acks/ inexistentes são benignos (scanned 0, sem throw)', async () => {
    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 7, mode: 'both', dryRun: false, now: NOW },
      { pendingStore, ackStore, archiveStore, onEvent },
    );
    expect(summary.scanned).toBe(0);
    expect(summary.archived).toBe(0);
  });

  it('funciona sem onEvent (logging por injeção opcional)', async () => {
    await expect(
      runCleanup(
        { sharedPath: SHARED, retentionDays: 7, mode: 'both', dryRun: false, now: NOW },
        { pendingStore, ackStore, archiveStore },
      ),
    ).resolves.toBeDefined();
  });

  it('falha por arquivo (archiveSprint lança) vira aviso e o job continua', async () => {
    const id = generateSprintId();
    await pendingStore.writePendingSprint(makePayload(id, 'joao', PAST));
    // archiveStore que sempre lança em archiveSprint.
    const brokenArchive = {
      archiveSprint: () => Promise.reject(new Error('boom')),
      archiveAck: () =>
        Promise.resolve({
          outcome: 'source-missing' as const,
          date: '',
          ackFilename: '',
          ackArchivedTo: null,
        }),
    } as unknown as ArchiveStore;

    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 0, mode: 'both', dryRun: false, now: NOW },
      { pendingStore, ackStore, archiveStore: brokenArchive, onEvent },
    );

    expect(summary.archived).toBe(0);
    expect(summary.warnings).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.kind === 'warn')).toBe(true);
  });

  it('propaga erro fatal de I/O não-benigno (ex.: share inacessível)', async () => {
    const fatalPending = {
      listPending: () => Promise.reject(new Error('EHOSTUNREACH')),
    } as unknown as PendingStore;
    await expect(
      runCleanup(
        { sharedPath: SHARED, retentionDays: 7, mode: 'both', dryRun: false, now: NOW },
        { pendingStore: fatalPending, ackStore, archiveStore, onEvent },
      ),
    ).rejects.toThrow('EHOSTUNREACH');
  });

  it('arquiva ack órfão (sem sprint em pending) em modo age', async () => {
    const id = generateSprintId();
    await ackStore.writeAck(makeAck(id, 'joao')); // ack sem sprint → órfão
    // `now` no futuro distante garante que a idade qualifica
    // independentemente do relógio de parede do CI.
    const future = new Date('2099-01-01T00:00:00.000Z');

    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 7, mode: 'age', dryRun: false, now: future },
      { pendingStore, ackStore, archiveStore, onEvent },
    );

    expect(summary.archived).toBe(1);
    expect(summary.archivedFilenames).toContain(buildAckFilename(id, 'joao'));
    await expect(adapter.exists(`${SHARED}/acks/${buildAckFilename(id, 'joao')}`)).resolves.toBe(
      false,
    );
  });

  it('dry-run lista ack órfão como candidato, sem mover', async () => {
    const id = generateSprintId();
    await ackStore.writeAck(makeAck(id, 'joao'));
    const future = new Date('2099-01-01T00:00:00.000Z');

    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 7, mode: 'age', dryRun: true, now: future },
      { pendingStore, ackStore, archiveStore, onEvent },
    );

    expect(summary.archived).toBe(1);
    expect(
      events.some((e) => e.kind === 'candidate' && e.filename === buildAckFilename(id, 'joao')),
    ).toBe(true);
    await expect(adapter.exists(`${SHARED}/acks/${buildAckFilename(id, 'joao')}`)).resolves.toBe(
      true,
    );
  });

  it('falha em archiveAck vira aviso e o job continua', async () => {
    const id = generateSprintId();
    await ackStore.writeAck(makeAck(id, 'joao'));
    const future = new Date('2099-01-01T00:00:00.000Z');
    const brokenArchive = {
      archiveSprint: () => Promise.reject(new Error('nunca chamado aqui')),
      archiveAck: () => Promise.reject(new Error('boom-ack')),
    } as unknown as ArchiveStore;

    const summary = await runCleanup(
      { sharedPath: SHARED, retentionDays: 7, mode: 'age', dryRun: false, now: future },
      { pendingStore, ackStore, archiveStore: brokenArchive, onEvent },
    );

    expect(summary.archived).toBe(0);
    expect(summary.warnings).toBeGreaterThanOrEqual(1);
  });
});

describe('parseCleanupArgs', () => {
  it('exige --share', () => {
    const r = parseCleanupArgs([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/--share/);
  });

  it('aplica defaults (retention 7, mode both, sem dry-run)', () => {
    const r = parseCleanupArgs(['--share', '\\\\srv\\share']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.share).toBe('\\\\srv\\share');
      expect(r.args.retentionDays).toBe(7);
      expect(r.args.mode).toBe('both');
      expect(r.args.dryRun).toBe(false);
      expect(r.args.help).toBe(false);
    }
  });

  it('parseia todas as opções', () => {
    const r = parseCleanupArgs([
      '--share',
      '/s',
      '--retention-days',
      '14',
      '--mode',
      'age',
      '--dry-run',
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.retentionDays).toBe(14);
      expect(r.args.mode).toBe('age');
      expect(r.args.dryRun).toBe(true);
    }
  });

  it('--help retorna ok com help=true mesmo sem --share', () => {
    const r = parseCleanupArgs(['--help']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args.help).toBe(true);
  });

  it('aceita -h como alias de --help', () => {
    const r = parseCleanupArgs(['-h']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args.help).toBe(true);
  });

  it('rejeita retention-days não-inteiro ou negativo', () => {
    expect(parseCleanupArgs(['--share', '/s', '--retention-days', 'abc']).ok).toBe(false);
    expect(parseCleanupArgs(['--share', '/s', '--retention-days', '-1']).ok).toBe(false);
    expect(parseCleanupArgs(['--share', '/s', '--retention-days', '1.5']).ok).toBe(false);
  });

  it('aceita retention-days 0', () => {
    const r = parseCleanupArgs(['--share', '/s', '--retention-days', '0']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args.retentionDays).toBe(0);
  });

  it('rejeita mode inválido', () => {
    expect(parseCleanupArgs(['--share', '/s', '--mode', 'xpto']).ok).toBe(false);
  });

  it('rejeita argumento desconhecido', () => {
    expect(parseCleanupArgs(['--share', '/s', '--bogus']).ok).toBe(false);
  });

  it('rejeita opções sem valor obrigatório', () => {
    expect(parseCleanupArgs(['--share']).ok).toBe(false);
    expect(parseCleanupArgs(['--share', '/s', '--retention-days']).ok).toBe(false);
    expect(parseCleanupArgs(['--share', '/s', '--mode']).ok).toBe(false);
  });

  it('rejeita --share vazio', () => {
    expect(parseCleanupArgs(['--share', '']).ok).toBe(false);
  });
});

describe('formatCleanupLogLine', () => {
  it('formata start', () => {
    const line = formatCleanupLogLine({
      kind: 'start',
      sharedPath: '/s',
      mode: 'both',
      retentionDays: 7,
      dryRun: false,
      at: '2026-06-01T12:00:00.000Z',
    });
    expect(line).toContain('INÍCIO');
    expect(line).toContain('modo=both');
  });

  it('formata candidate com e sem deadline', () => {
    const withDl = formatCleanupLogLine({
      kind: 'candidate',
      filename: 'a.json',
      reason: 'deadline',
      ageDays: 2.5,
      deadlineAt: '2026-05-30T18:00:00.000Z',
    });
    expect(withDl).toContain('candidato');
    expect(withDl).toContain('deadline=');
    const noDl = formatCleanupLogLine({
      kind: 'candidate',
      filename: 'a.json',
      reason: 'age',
      ageDays: 9,
      deadlineAt: null,
    });
    expect(noDl).not.toContain('deadline=');
  });

  it('formata archived com e sem ack', () => {
    const withAck = formatCleanupLogLine({
      kind: 'archived',
      filename: 'a.json',
      outcome: 'archived',
      date: '2026-05-21',
      ackFilename: 'a.ack.json',
    });
    expect(withAck).toContain('arquivado');
    expect(withAck).toContain('+ack');
    const noAck = formatCleanupLogLine({
      kind: 'archived',
      filename: 'a.json',
      outcome: 'already-archived',
      date: '2026-05-21',
      ackFilename: null,
    });
    expect(noAck).not.toContain('+ack');
  });

  it('formata skip, warn (com e sem filename) e done', () => {
    expect(formatCleanupLogLine({ kind: 'skip', filename: 'c.json', reason: 'cancel' })).toContain(
      'ignorado',
    );
    expect(
      formatCleanupLogLine({ kind: 'warn', filename: 'x.json', message: 'corrompido' }),
    ).toContain('AVISO');
    expect(formatCleanupLogLine({ kind: 'warn', filename: null, message: 'geral' })).toContain(
      '(geral)',
    );
    expect(
      formatCleanupLogLine({
        kind: 'done',
        scanned: 3,
        archived: 1,
        skipped: 1,
        warnings: 0,
        dryRun: false,
        at: '2026-06-01T12:00:00.000Z',
      }),
    ).toContain('FIM');
  });
});
