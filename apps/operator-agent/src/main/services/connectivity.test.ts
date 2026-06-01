/**
 * Testes do módulo puro de conectividade (BL-C3-013).
 *
 * Cobre o classificador `isConnectivityError` (cada código de queda + erros
 * pontuais que NÃO devem virar desconexão) e a agenda de backoff
 * `nextBackoffDelayMs` (progressão dos passos, cap, e jitter via RNG injetável).
 * Sem mocks — funções puras.
 */

import { DirectoryNotFoundError, FilesystemIOError } from '@sprint/fs-adapter';
import { describe, expect, it } from 'vitest';

import {
  BACKOFF_JITTER,
  BACKOFF_SCHEDULE_MS,
  CONNECTIVITY_ERROR_CODES,
  isConnectivityError,
  nextBackoffDelayMs,
} from './connectivity';

/** Constrói um ErrnoException cru com `code`. */
function errno(code: string): NodeJS.ErrnoException {
  const e = new Error(`boom ${code}`) as NodeJS.ErrnoException;
  e.code = code;
  return e;
}

describe('isConnectivityError', () => {
  it('classifica como conectividade quando cause.code é de queda do share', () => {
    for (const code of CONNECTIVITY_ERROR_CODES) {
      // Espelha o que o C4 produz: FilesystemError com o ErrnoException em cause.
      const err = new FilesystemIOError('/share/pending', `falha ${code}`, errno(code));
      expect(isConnectivityError(err), `code ${code}`).toBe(true);
    }
  });

  it('classifica DirectoryNotFoundError (ENOENT) como conectividade', () => {
    // ENOENT entra no set — a desambiguação "pending/ ausente vs share fora"
    // é responsabilidade do PollingService (sonda a raiz), não do classificador.
    const err = new DirectoryNotFoundError('/share/pending', errno('ENOENT'));
    expect(isConnectivityError(err)).toBe(true);
  });

  it('lê o code direto do erro (sem wrap em cause)', () => {
    expect(isConnectivityError(errno('ETIMEDOUT'))).toBe(true);
  });

  it('NÃO classifica erros pontuais de arquivo/permissão como conectividade', () => {
    for (const code of ['EACCES', 'EPERM', 'ENOSPC', 'EISDIR', 'ENOTDIR', 'EEXIST']) {
      const err = new FilesystemIOError('/share/pending/x.json', `falha ${code}`, errno(code));
      expect(isConnectivityError(err), `code ${code}`).toBe(false);
    }
  });

  it('retorna false para não-erros e erros sem code', () => {
    expect(isConnectivityError(null)).toBe(false);
    expect(isConnectivityError(undefined)).toBe(false);
    expect(isConnectivityError('string')).toBe(false);
    expect(isConnectivityError(new Error('sem code'))).toBe(false);
    expect(isConnectivityError({ cause: { code: 123 } })).toBe(false);
  });
});

describe('nextBackoffDelayMs', () => {
  // RNG fixo no meio → fator 1.0 (sem jitter), facilita asserts exatos.
  const noJitter = (): number => 0.5;

  it('segue a agenda 5/10/30/60 por falha consecutiva', () => {
    expect(nextBackoffDelayMs(1, noJitter)).toBe(5000);
    expect(nextBackoffDelayMs(2, noJitter)).toBe(10000);
    expect(nextBackoffDelayMs(3, noJitter)).toBe(30000);
    expect(nextBackoffDelayMs(4, noJitter)).toBe(60000);
  });

  it('mantém o cap de 60s após o 4º passo', () => {
    expect(nextBackoffDelayMs(5, noJitter)).toBe(60000);
    expect(nextBackoffDelayMs(10, noJitter)).toBe(60000);
    expect(nextBackoffDelayMs(999, noJitter)).toBe(60000);
  });

  it('trata 0/negativo como o primeiro passo (5s)', () => {
    expect(nextBackoffDelayMs(0, noJitter)).toBe(5000);
    expect(nextBackoffDelayMs(-3, noJitter)).toBe(5000);
  });

  it('aplica jitter dentro de ±10% do passo base', () => {
    // rng=0 → fator mínimo (1 - J); rng→1 → fator máximo (1 + J).
    for (let attempt = 1; attempt <= BACKOFF_SCHEDULE_MS.length; attempt++) {
      const base = BACKOFF_SCHEDULE_MS[attempt - 1]!;
      const low = nextBackoffDelayMs(attempt, () => 0);
      const high = nextBackoffDelayMs(attempt, () => 0.999999);
      expect(low).toBe(Math.round(base * (1 - BACKOFF_JITTER)));
      expect(high).toBeGreaterThan(low);
      expect(high).toBeLessThanOrEqual(Math.round(base * (1 + BACKOFF_JITTER)));
    }
  });

  it('usa Math.random por default sem quebrar (resultado dentro dos limites)', () => {
    const v = nextBackoffDelayMs(1);
    expect(v).toBeGreaterThanOrEqual(Math.round(5000 * (1 - BACKOFF_JITTER)));
    expect(v).toBeLessThanOrEqual(Math.round(5000 * (1 + BACKOFF_JITTER)));
  });
});
