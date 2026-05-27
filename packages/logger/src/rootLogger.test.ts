import { afterEach, describe, expect, it } from 'vitest';

import { _resetRootLoggerForTesting, rootLogger } from './rootLogger';

describe('rootLogger', () => {
  afterEach(() => {
    _resetRootLoggerForTesting();
  });

  it('cria a instância na primeira chamada', () => {
    const log = rootLogger();
    expect(log.name).toBe('root');
  });

  it('retorna a mesma instância em chamadas subsequentes (singleton)', () => {
    const a = rootLogger();
    const b = rootLogger();
    expect(a).toBe(b);
  });

  it('_resetRootLoggerForTesting força recriação na próxima chamada', () => {
    const a = rootLogger();
    _resetRootLoggerForTesting();
    const b = rootLogger();
    expect(a).not.toBe(b);
    expect(b.name).toBe('root');
  });
});
