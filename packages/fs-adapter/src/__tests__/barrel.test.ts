import { describe, expect, it } from 'vitest';

// Importa via barrel raiz (../index.ts) — sanity check de que tudo o
// que consumers (Leader, Agent) vão precisar está realmente exportado.
// Quebra cedo se alguém adicionar um símbolo público sem atualizar o
// barrel; e a forma `import { X } from '..'` espelha exatamente o
// que `import { X } from '@sprint/fs-adapter'` resolverá em runtime
// (workspace package source-first com `main: ./src/index.ts`).
import {
  AckStore,
  ArchiveStore,
  CancelStore,
  DirectoryNotFoundError,
  FileNotFoundError,
  FilesystemError,
  FilesystemIOError,
  MemoryFilesystemAdapter,
  NodeFilesystemAdapter,
  NotImplementedError,
  PendingStore,
} from '..';
import { CLEANUP_USAGE, formatCleanupLogLine, parseCleanupArgs, planCleanup, runCleanup } from '..';
import type {
  AckEntry,
  ArchiveAckResult,
  ArchivedSprint,
  ArchivedSprintRef,
  ArchiveSprintResult,
  CleanupPlan,
  CleanupSummary,
  FileStat,
  IFilesystemAdapter,
  ListAcksFilter,
  ListArchiveFilter,
  ListPendingFilter,
  PendingEntry,
  RetentionMode,
  WriteAckResult,
  WriteCancelResult,
  WritePendingResult,
} from '..';

describe('@sprint/fs-adapter — barrel', () => {
  it('exporta os 2 adapters concretos', () => {
    expect(MemoryFilesystemAdapter).toBeDefined();
    expect(NodeFilesystemAdapter).toBeDefined();
  });

  it('exporta toda a hierarquia de erros', () => {
    expect(FilesystemError).toBeDefined();
    expect(FileNotFoundError).toBeDefined();
    expect(DirectoryNotFoundError).toBeDefined();
    expect(FilesystemIOError).toBeDefined();
    expect(NotImplementedError).toBeDefined();
  });

  it('exporta os 4 domain stores', () => {
    expect(PendingStore).toBeDefined();
    expect(AckStore).toBeDefined();
    expect(CancelStore).toBeDefined();
    expect(ArchiveStore).toBeDefined();
  });

  it('domain stores instanciam com o construtor uniforme (adapter, sharedPath)', () => {
    const adapter = new MemoryFilesystemAdapter();
    expect(() => new PendingStore(adapter, '/shared')).not.toThrow();
    expect(() => new AckStore(adapter, '/shared')).not.toThrow();
    expect(() => new CancelStore(adapter, '/shared')).not.toThrow();
    expect(() => new ArchiveStore(adapter, '/shared')).not.toThrow();
  });

  it('exporta a API do job de limpeza (BL-C4-008)', () => {
    expect(planCleanup).toBeDefined();
    expect(runCleanup).toBeDefined();
    expect(parseCleanupArgs).toBeDefined();
    expect(formatCleanupLogLine).toBeDefined();
    expect(typeof CLEANUP_USAGE).toBe('string');
  });

  it('tipos públicos podem ser usados em assinaturas (type-only check)', () => {
    // Este teste compila se os tipos estão exportados; corpo é
    // intencionalmente trivial — o valor vem do type-check passar.
    const _stat: FileStat | undefined = undefined;
    const _entry: PendingEntry | undefined = undefined;
    const _ackEntry: AckEntry | undefined = undefined;
    const _pendingFilter: ListPendingFilter = {};
    const _acksFilter: ListAcksFilter = {};
    const _writeResult: WritePendingResult | undefined = undefined;
    const _ackResult: WriteAckResult | undefined = undefined;
    const _cancelResult: WriteCancelResult | undefined = undefined;
    const _archiveSprint: ArchiveSprintResult | undefined = undefined;
    const _archiveAck: ArchiveAckResult | undefined = undefined;
    const _archiveRef: ArchivedSprintRef | undefined = undefined;
    const _archived: ArchivedSprint | undefined = undefined;
    const _archiveFilter: ListArchiveFilter = {};
    const _cleanupPlan: CleanupPlan | undefined = undefined;
    const _cleanupSummary: CleanupSummary | undefined = undefined;
    const _retentionMode: RetentionMode = 'both';
    const _adapter: IFilesystemAdapter | undefined = undefined;
    expect(_stat).toBeUndefined();
    expect(_entry).toBeUndefined();
    expect(_ackEntry).toBeUndefined();
    expect(_pendingFilter).toEqual({});
    expect(_acksFilter).toEqual({});
    expect(_writeResult).toBeUndefined();
    expect(_ackResult).toBeUndefined();
    expect(_cancelResult).toBeUndefined();
    expect(_archiveSprint).toBeUndefined();
    expect(_archiveAck).toBeUndefined();
    expect(_archiveRef).toBeUndefined();
    expect(_archived).toBeUndefined();
    expect(_archiveFilter).toEqual({});
    expect(_cleanupPlan).toBeUndefined();
    expect(_cleanupSummary).toBeUndefined();
    expect(_retentionMode).toBe('both');
    expect(_adapter).toBeUndefined();
  });
});
