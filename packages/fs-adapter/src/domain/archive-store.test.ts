import { beforeEach, describe, expect, it } from 'vitest';

import { FilesystemError, NotImplementedError } from '../errors';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { ArchiveStore } from './archive-store';

describe('ArchiveStore (stub W3 — BL-C4-005)', () => {
  let store: ArchiveStore;

  beforeEach(() => {
    store = new ArchiveStore(new MemoryFilesystemAdapter(), '/shared');
  });

  it('construtor não lança', () => {
    expect(() => new ArchiveStore(new MemoryFilesystemAdapter(), '/shared')).not.toThrow();
  });

  it('moveToArchive lança NotImplementedError', async () => {
    await expect(store.moveToArchive('foo.json')).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('NotImplementedError é também FilesystemError (hierarquia única)', async () => {
    await expect(store.moveToArchive('foo.json')).rejects.toBeInstanceOf(FilesystemError);
  });

  it('operationName do erro identifica a operação como moveToArchive', async () => {
    try {
      await store.moveToArchive('foo.json');
      expect.fail('moveToArchive deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedError);
      if (err instanceof NotImplementedError) {
        expect(err.operationName).toBe('moveToArchive');
        expect(err.message).toContain('moveToArchive');
      }
    }
  });
});
