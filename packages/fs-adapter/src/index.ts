// === Interface (port) ===
export type { FileStat, IFilesystemAdapter } from './interface';

// === Errors ===
export {
  DirectoryNotFoundError,
  FileNotFoundError,
  FilesystemError,
  FilesystemIOError,
  NotImplementedError,
} from './errors';

// === Adapters ===
export { MemoryFilesystemAdapter } from './memory-adapter';
export { NodeFilesystemAdapter } from './node-adapter';

// === Domain — Pending (BL-C4-002, BL-C4-003) ===
export {
  PendingStore,
  type ListPendingFilter,
  type PendingEntry,
  type WritePendingResult,
} from './domain/pending-store';

// === Domain — Ack (BL-C4-006, BL-C4-003) ===
export {
  AckStore,
  type AckEntry,
  type ListAcksFilter,
  type WriteAckResult,
} from './domain/ack-store';

// === Domain — Cancel (BL-C4-004 — W2) ===
export { CancelStore, type WriteCancelResult } from './domain/cancel-store';

// === Domain — Archive (BL-C4-005 — W3) ===
export {
  ArchiveStore,
  type ArchiveAckResult,
  type ArchivedSprint,
  type ArchivedSprintRef,
  type ArchiveOutcome,
  type ArchiveSprintResult,
  type ListArchiveFilter,
} from './domain/archive-store';
