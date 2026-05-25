// === Interface (port) ===
export type { FileStat, IFilesystemAdapter } from './interface';

// === Errors ===
export {
  DirectoryNotFoundError,
  FileNotFoundError,
  FilesystemError,
  FilesystemIOError,
} from './errors';

// === Adapters ===
export { MemoryFilesystemAdapter } from './memory-adapter';
export { NodeFilesystemAdapter } from './node-adapter';
