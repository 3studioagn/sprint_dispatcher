import type { App } from 'electron';
import { describe, expect, it } from 'vitest';

import { acquireSingleInstanceLock } from './single-instance';

describe('acquireSingleInstanceLock', () => {
  it('retorna true quando o lock é adquirido (instância primária)', () => {
    const app = { requestSingleInstanceLock: () => true } as unknown as App;
    expect(acquireSingleInstanceLock(app)).toBe(true);
  });

  it('retorna false quando o lock já está tomado por outra instância', () => {
    const app = { requestSingleInstanceLock: () => false } as unknown as App;
    expect(acquireSingleInstanceLock(app)).toBe(false);
  });
});
