import {
  buildAckFilename,
  buildCancelFilename,
  buildPendingFilename,
  decodeUlidTime,
  FilenameParseError,
  formatArchiveDate,
  parseSprintAck,
  parseSprintPayload,
  type SprintAck,
  type SprintPayload,
} from '@sprint/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { DirectoryNotFoundError, FileNotFoundError, FilesystemIOError } from '../errors';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { AckStore } from './ack-store';
import { ArchiveStore } from './archive-store';
import { PendingStore } from './pending-store';

const SHARED = '/shared';

// ULIDs fixos com timestamps conhecidos → datas determinísticas.
const ULID_1970 = '0000000000TSV4RRFFQ69G5FAV'; // 1970-01-01
const ULID_2016 = '01ARYZ6S41TSV4RRFFQ69G5FAV'; // 2016-07-30
const ULID_2024 = '01J0000000TSV4RRFFQ69G5FAV'; // 2024-06-10

function dateOf(sprintId: string): string {
  return formatArchiveDate(decodeUlidTime(sprintId));
}

function makePayload(sprintId: string, userId: string): SprintPayload {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: sprintId,
    criado_por: 'Renan',
    criado_em: new Date().toISOString(),
    user_id: userId,
    title: 'Meta',
    body_html: '<p>Conteúdo</p>',
    meta: 100,
    deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

function makeAck(sprintId: string, userId: string): SprintAck {
  return parseSprintAck({
    schema_version: '1.0',
    sprint_id: sprintId,
    user_id: userId,
    hostname: 'PC-1',
    displayed_at: new Date().toISOString(),
    agent_version: '0.1.0',
  });
}

/** Adapter que simula um filesystem cross-device: `rename` sempre falha
 *  com EXDEV (como quando `arquivo/` está em outro mount). */
class ExdevMemoryAdapter extends MemoryFilesystemAdapter {
  override rename(from: string, _to: string): Promise<void> {
    const cause = Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
    return Promise.reject(new FilesystemIOError(from, 'cross-device link', cause as Error));
  }
}

/** `rename` falha com um erro NÃO-EXDEV (ex.: disco cheio) — sem fallback. */
class RenameFailsAdapter extends MemoryFilesystemAdapter {
  override rename(from: string, _to: string): Promise<void> {
    return Promise.reject(new FilesystemIOError(from, 'sem espaço em disco'));
  }
}

/** `unlink` sempre rejeita com o erro fornecido — exercita `safeUnlink`. */
class UnlinkFailsAdapter extends MemoryFilesystemAdapter {
  constructor(private readonly error: Error) {
    super();
  }
  override unlink(_filepath: string): Promise<void> {
    return Promise.reject(this.error);
  }
}

/** `listDir` da pasta de data (`arquivo/<YYYY-MM-DD>`) rejeita com o erro
 *  fornecido; demais paths delegam — simula corrida durante `listArchive`. */
class DateDirListThrows extends MemoryFilesystemAdapter {
  constructor(private readonly error: Error) {
    super();
  }
  override listDir(dirpath: string): Promise<string[]> {
    if (/\/arquivo\/\d{4}-\d{2}-\d{2}$/.test(dirpath)) {
      return Promise.reject(this.error);
    }
    return super.listDir(dirpath);
  }
}

/** `listDir` da raiz `arquivo/` rejeita com erro NÃO-benigno (ex.: permissão). */
class RootListThrows extends MemoryFilesystemAdapter {
  override listDir(dirpath: string): Promise<string[]> {
    if (dirpath.endsWith('/arquivo')) {
      return Promise.reject(new FilesystemIOError(dirpath, 'permissão negada'));
    }
    return super.listDir(dirpath);
  }
}

describe('ArchiveStore (BL-C4-005)', () => {
  let adapter: MemoryFilesystemAdapter;
  let store: ArchiveStore;
  let pending: PendingStore;
  let acks: AckStore;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    store = new ArchiveStore(adapter, SHARED);
    pending = new PendingStore(adapter, SHARED);
    acks = new AckStore(adapter, SHARED);
  });

  describe('construtor', () => {
    it('não lança', () => {
      expect(() => new ArchiveStore(new MemoryFilesystemAdapter(), SHARED)).not.toThrow();
    });
  });

  describe('archiveSprint', () => {
    it('move sprint + ack pareado para arquivo/<data-de-origem>/', async () => {
      const userId = 'joao';
      const date = dateOf(ULID_2016);
      await pending.writePendingSprint(makePayload(ULID_2016, userId));
      await acks.writeAck(makeAck(ULID_2016, userId));

      const sprintFilename = buildPendingFilename(ULID_2016, userId);
      const result = await store.archiveSprint(sprintFilename);

      expect(result.outcome).toBe('archived');
      expect(result.date).toBe(date);
      expect(result.sprintFilename).toBe(sprintFilename);
      expect(result.sprintArchivedTo).toBe(`${SHARED}/arquivo/${date}/${sprintFilename}`);
      expect(result.ackFilename).toBe(buildAckFilename(ULID_2016, userId));
      expect(result.ackArchivedTo).toBe(
        `${SHARED}/arquivo/${date}/${buildAckFilename(ULID_2016, userId)}`,
      );

      // Originais saíram, destino populado.
      await expect(adapter.exists(`${SHARED}/pending/${sprintFilename}`)).resolves.toBe(false);
      await expect(
        adapter.exists(`${SHARED}/acks/${buildAckFilename(ULID_2016, userId)}`),
      ).resolves.toBe(false);
      await expect(adapter.exists(result.sprintArchivedTo!)).resolves.toBe(true);
      await expect(adapter.exists(result.ackArchivedTo!)).resolves.toBe(true);
    });

    it('arquiva a sprint mesmo sem ack pareado (ackFilename null)', async () => {
      const userId = 'maria';
      await pending.writePendingSprint(makePayload(ULID_2024, userId));
      const sprintFilename = buildPendingFilename(ULID_2024, userId);

      const result = await store.archiveSprint(sprintFilename);

      expect(result.outcome).toBe('archived');
      expect(result.ackFilename).toBeNull();
      expect(result.ackArchivedTo).toBeNull();
      await expect(adapter.exists(result.sprintArchivedTo!)).resolves.toBe(true);
    });

    it('source ausente → outcome source-missing, não lança (idempotência/corrida)', async () => {
      const sprintFilename = buildPendingFilename(ULID_2016, 'fantasma');
      const result = await store.archiveSprint(sprintFilename);

      expect(result.outcome).toBe('source-missing');
      expect(result.sprintArchivedTo).toBeNull();
      expect(result.ackFilename).toBeNull();
    });

    it('idempotente: rodar 2x não duplica nem falha (2ª vez source-missing)', async () => {
      const userId = 'joao';
      await pending.writePendingSprint(makePayload(ULID_2016, userId));
      const sprintFilename = buildPendingFilename(ULID_2016, userId);

      const first = await store.archiveSprint(sprintFilename);
      const second = await store.archiveSprint(sprintFilename);

      expect(first.outcome).toBe('archived');
      expect(second.outcome).toBe('source-missing');
    });

    it('colisão: destino já existe → não sobrescreve, remove source redundante (already-archived)', async () => {
      const userId = 'joao';
      const date = dateOf(ULID_2016);
      const sprintFilename = buildPendingFilename(ULID_2016, userId);
      const dest = `${SHARED}/arquivo/${date}/${sprintFilename}`;
      const source = `${SHARED}/pending/${sprintFilename}`;

      // Destino pré-existente com conteúdo canônico; source redundante.
      await adapter.writeFileAtomic(dest, 'CONTEUDO-ARQUIVADO');
      await adapter.writeFileAtomic(source, 'CONTEUDO-PENDENTE-DUP');

      const result = await store.archiveSprint(sprintFilename);

      expect(result.outcome).toBe('already-archived');
      // Destino preservado (NÃO sobrescrito).
      await expect(adapter.readFile(dest)).resolves.toBe('CONTEUDO-ARQUIVADO');
      // Source redundante removido.
      await expect(adapter.exists(source)).resolves.toBe(false);
    });

    it('fallback EXDEV: rename falha cross-device → copy + unlink', async () => {
      const exdevAdapter = new ExdevMemoryAdapter();
      const exdevStore = new ArchiveStore(exdevAdapter, SHARED);
      const exdevPending = new PendingStore(exdevAdapter, SHARED);
      const userId = 'joao';
      const date = dateOf(ULID_2016);
      const sprintFilename = buildPendingFilename(ULID_2016, userId);

      await exdevPending.writePendingSprint(makePayload(ULID_2016, userId));

      const result = await exdevStore.archiveSprint(sprintFilename);

      expect(result.outcome).toBe('archived');
      const dest = `${SHARED}/arquivo/${date}/${sprintFilename}`;
      await expect(exdevAdapter.exists(dest)).resolves.toBe(true);
      await expect(exdevAdapter.exists(`${SHARED}/pending/${sprintFilename}`)).resolves.toBe(false);
      // Conteúdo preservado pela cópia.
      const parsed = JSON.parse(await exdevAdapter.readFile(dest)) as Record<string, unknown>;
      expect(parsed.sprint_id).toBe(ULID_2016);
    });

    it('rejeita filename de ack', async () => {
      await expect(store.archiveSprint(buildAckFilename(ULID_2016, 'joao'))).rejects.toBeInstanceOf(
        FilenameParseError,
      );
    });

    it('rejeita filename de cancel', async () => {
      await expect(store.archiveSprint(buildCancelFilename(ULID_2016))).rejects.toBeInstanceOf(
        FilenameParseError,
      );
    });

    it('rejeita filename inválido', async () => {
      await expect(store.archiveSprint('lixo.txt')).rejects.toBeInstanceOf(FilenameParseError);
    });
  });

  describe('archiveAck', () => {
    it('move ack órfão para arquivo/<data-de-origem>/', async () => {
      const userId = 'carlos';
      const date = dateOf(ULID_2024);
      await acks.writeAck(makeAck(ULID_2024, userId));
      const ackFilename = buildAckFilename(ULID_2024, userId);

      const result = await store.archiveAck(ackFilename);

      expect(result.outcome).toBe('archived');
      expect(result.date).toBe(date);
      expect(result.ackArchivedTo).toBe(`${SHARED}/arquivo/${date}/${ackFilename}`);
      await expect(adapter.exists(`${SHARED}/acks/${ackFilename}`)).resolves.toBe(false);
      await expect(adapter.exists(result.ackArchivedTo!)).resolves.toBe(true);
    });

    it('source ausente → source-missing', async () => {
      const result = await store.archiveAck(buildAckFilename(ULID_2016, 'ninguem'));
      expect(result.outcome).toBe('source-missing');
      expect(result.ackArchivedTo).toBeNull();
    });

    it('colisão → already-archived, remove source', async () => {
      const userId = 'ana';
      const date = dateOf(ULID_2016);
      const ackFilename = buildAckFilename(ULID_2016, userId);
      const dest = `${SHARED}/arquivo/${date}/${ackFilename}`;
      const source = `${SHARED}/acks/${ackFilename}`;
      await adapter.writeFileAtomic(dest, 'ACK-ARQUIVADO');
      await adapter.writeFileAtomic(source, 'ACK-DUP');

      const result = await store.archiveAck(ackFilename);

      expect(result.outcome).toBe('already-archived');
      await expect(adapter.readFile(dest)).resolves.toBe('ACK-ARQUIVADO');
      await expect(adapter.exists(source)).resolves.toBe(false);
    });

    it('rejeita filename de sprint (não-ack)', async () => {
      await expect(
        store.archiveAck(buildPendingFilename(ULID_2016, 'joao')),
      ).rejects.toBeInstanceOf(FilenameParseError);
    });

    it('rejeita filename inválido (não-parseável)', async () => {
      await expect(store.archiveAck('lixo.txt')).rejects.toBeInstanceOf(FilenameParseError);
    });
  });

  describe('listArchive', () => {
    it('retorna [] quando arquivo/ não existe', async () => {
      await expect(store.listArchive()).resolves.toEqual([]);
    });

    it('lista sprints arquivadas com hasAck correto', async () => {
      // Sprint A com ack; sprint B sem ack — ambas mesma data.
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await acks.writeAck(makeAck(ULID_2016, 'joao'));
      await pending.writePendingSprint(makePayload(ULID_2016, 'maria')); // mesmo dia (mesmo ULID base de tempo)
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'maria'));

      const refs = await store.listArchive();
      expect(refs).toHaveLength(2);
      const joao = refs.find((r) => r.userId === 'joao');
      const maria = refs.find((r) => r.userId === 'maria');
      expect(joao?.hasAck).toBe(true);
      expect(maria?.hasAck).toBe(false);
      expect(joao?.date).toBe(dateOf(ULID_2016));
    });

    it('ignora log-limpeza.txt e outras entradas não-data', async () => {
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'joao'));
      // Sujeira na raiz de arquivo/.
      await adapter.writeFileAtomic(`${SHARED}/arquivo/log-limpeza.txt`, 'log...');
      await adapter.writeFileAtomic(`${SHARED}/arquivo/leiame.md`, 'nota');

      const refs = await store.listArchive();
      expect(refs).toHaveLength(1);
      expect(refs[0]?.userId).toBe('joao');
    });

    it('filtra por data', async () => {
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await pending.writePendingSprint(makePayload(ULID_2024, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2024, 'joao'));

      const refs = await store.listArchive({ date: dateOf(ULID_2024) });
      expect(refs).toHaveLength(1);
      expect(refs[0]?.sprintId).toBe(ULID_2024);
    });

    it('filtra por userId', async () => {
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await pending.writePendingSprint(makePayload(ULID_2016, 'maria'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'maria'));

      const refs = await store.listArchive({ userId: 'maria' });
      expect(refs).toHaveLength(1);
      expect(refs[0]?.userId).toBe('maria');
    });

    it('ordena por data e depois por sprintId', async () => {
      await pending.writePendingSprint(makePayload(ULID_2024, 'joao'));
      await pending.writePendingSprint(makePayload(ULID_1970, 'joao'));
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2024, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_1970, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'joao'));

      const refs = await store.listArchive();
      expect(refs.map((r) => r.date)).toEqual([
        dateOf(ULID_1970),
        dateOf(ULID_2016),
        dateOf(ULID_2024),
      ]);
    });
  });

  describe('readArchivedSprint', () => {
    it('retorna payload + ack quando ambos presentes', async () => {
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await acks.writeAck(makeAck(ULID_2016, 'joao'));
      await store.archiveSprint(buildPendingFilename(ULID_2016, 'joao'));

      const [ref] = await store.listArchive();
      expect(ref).toBeDefined();
      const detail = await store.readArchivedSprint(ref!);

      expect(detail.payload.sprint_id).toBe(ULID_2016);
      expect(detail.payload.user_id).toBe('joao');
      expect(detail.ack?.sprint_id).toBe(ULID_2016);
    });

    it('retorna só payload quando ack ausente', async () => {
      await pending.writePendingSprint(makePayload(ULID_2024, 'maria'));
      await store.archiveSprint(buildPendingFilename(ULID_2024, 'maria'));

      const [ref] = await store.listArchive();
      const detail = await store.readArchivedSprint(ref!);

      expect(detail.payload.sprint_id).toBe(ULID_2024);
      expect(detail.ack).toBeUndefined();
    });

    it('lança FileNotFoundError quando o .json da sprint sumiu', async () => {
      const ref = {
        date: dateOf(ULID_2016),
        sprintId: ULID_2016,
        userId: 'joao',
        sprintFilename: buildPendingFilename(ULID_2016, 'joao'),
        hasAck: false,
      };
      await expect(store.readArchivedSprint(ref)).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('lança FilesystemIOError quando o .json da sprint está corrompido', async () => {
      const date = dateOf(ULID_2016);
      const sprintFilename = buildPendingFilename(ULID_2016, 'joao');
      await adapter.writeFileAtomic(`${SHARED}/arquivo/${date}/${sprintFilename}`, '{ não é json');

      const ref = { date, sprintId: ULID_2016, userId: 'joao', sprintFilename, hasAck: false };
      await expect(store.readArchivedSprint(ref)).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('ignora ack corrompido e retorna só o payload', async () => {
      const date = dateOf(ULID_2016);
      const sprintFilename = buildPendingFilename(ULID_2016, 'joao');
      const ackFilename = buildAckFilename(ULID_2016, 'joao');
      // payload válido no arquivo; ack corrompido ao lado.
      await pending.writePendingSprint(makePayload(ULID_2016, 'joao'));
      await store.archiveSprint(sprintFilename);
      await adapter.writeFileAtomic(`${SHARED}/arquivo/${date}/${ackFilename}`, 'ack corrompido');

      const ref = { date, sprintId: ULID_2016, userId: 'joao', sprintFilename, hasAck: true };
      const detail = await store.readArchivedSprint(ref);
      expect(detail.payload.sprint_id).toBe(ULID_2016);
      expect(detail.ack).toBeUndefined();
    });
  });

  describe('robustez (corrida / I/O)', () => {
    it('archiveSprint propaga erro de rename NÃO-EXDEV (sem fallback)', async () => {
      const a = new RenameFailsAdapter();
      const p = new PendingStore(a, SHARED);
      await p.writePendingSprint(makePayload(ULID_2016, 'joao'));
      const s = new ArchiveStore(a, SHARED);
      await expect(s.archiveSprint(buildPendingFilename(ULID_2016, 'joao'))).rejects.toBeInstanceOf(
        FilesystemIOError,
      );
    });

    it('relocate tolera source que some antes do unlink (FileNotFoundError benigno)', async () => {
      const a = new UnlinkFailsAdapter(new FileNotFoundError('race'));
      const date = dateOf(ULID_2016);
      const file = buildPendingFilename(ULID_2016, 'joao');
      await a.writeFileAtomic(`${SHARED}/pending/${file}`, 'src');
      await a.writeFileAtomic(`${SHARED}/arquivo/${date}/${file}`, 'dest'); // destino existe → already-archived

      const result = await s_archive(a).archiveSprint(file);
      expect(result.outcome).toBe('already-archived');
    });

    it('relocate propaga erro de unlink NÃO-benigno', async () => {
      const a = new UnlinkFailsAdapter(new FilesystemIOError('x', 'permissão negada'));
      const date = dateOf(ULID_2016);
      const file = buildPendingFilename(ULID_2016, 'joao');
      await a.writeFileAtomic(`${SHARED}/pending/${file}`, 'src');
      await a.writeFileAtomic(`${SHARED}/arquivo/${date}/${file}`, 'dest');

      await expect(s_archive(a).archiveSprint(file)).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('listArchive pula pasta de data que sumiu na corrida (DirectoryNotFoundError)', async () => {
      const a = new DateDirListThrows(
        new DirectoryNotFoundError(`${SHARED}/arquivo/${dateOf(ULID_2016)}`),
      );
      await a.writeFileAtomic(
        `${SHARED}/arquivo/${dateOf(ULID_2016)}/${buildPendingFilename(ULID_2016, 'joao')}`,
        '{}',
      );
      await expect(s_archive(a).listArchive()).resolves.toEqual([]);
    });

    it('listArchive propaga erro de I/O não-benigno na pasta de data', async () => {
      const a = new DateDirListThrows(
        new FilesystemIOError(`${SHARED}/arquivo/${dateOf(ULID_2016)}`, 'perm'),
      );
      await a.writeFileAtomic(
        `${SHARED}/arquivo/${dateOf(ULID_2016)}/${buildPendingFilename(ULID_2016, 'joao')}`,
        '{}',
      );
      await expect(s_archive(a).listArchive()).rejects.toBeInstanceOf(FilesystemIOError);
    });

    it('listArchive propaga erro de I/O não-benigno na raiz de arquivo/', async () => {
      const a = new RootListThrows();
      await a.writeFileAtomic(
        `${SHARED}/arquivo/${dateOf(ULID_2016)}/${buildPendingFilename(ULID_2016, 'joao')}`,
        '{}',
      );
      await expect(s_archive(a).listArchive()).rejects.toBeInstanceOf(FilesystemIOError);
    });
  });
});

function s_archive(adapter: MemoryFilesystemAdapter): ArchiveStore {
  return new ArchiveStore(adapter, SHARED);
}
