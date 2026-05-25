import { generateSprintId, parseSprintCancel, type SprintCancel } from '@sprint/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { FilesystemError, NotImplementedError } from '../errors';
import { MemoryFilesystemAdapter } from '../memory-adapter';

import { CancelStore } from './cancel-store';

function buildCancel(): SprintCancel {
  return parseSprintCancel({
    schema_version: '1.0',
    type: 'cancel',
    sprint_id_ref: generateSprintId(),
    cancelado_por: 'Renan',
    cancelado_em: new Date().toISOString(),
  });
}

describe('CancelStore (stub W2 — BL-C4-004)', () => {
  let store: CancelStore;

  beforeEach(() => {
    store = new CancelStore(new MemoryFilesystemAdapter(), '/shared');
  });

  it('construtor não lança', () => {
    expect(() => new CancelStore(new MemoryFilesystemAdapter(), '/shared')).not.toThrow();
  });

  it('writeCancel lança NotImplementedError', async () => {
    await expect(store.writeCancel(buildCancel())).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('NotImplementedError é também FilesystemError (hierarquia única)', async () => {
    await expect(store.writeCancel(buildCancel())).rejects.toBeInstanceOf(FilesystemError);
  });

  it('operationName do erro identifica a operação como writeCancel', async () => {
    try {
      await store.writeCancel(buildCancel());
      expect.fail('writeCancel deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedError);
      if (err instanceof NotImplementedError) {
        expect(err.operationName).toBe('writeCancel');
        expect(err.message).toContain('writeCancel');
      }
    }
  });
});
