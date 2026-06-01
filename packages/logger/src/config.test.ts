import { afterEach, describe, expect, it, vi } from 'vitest';

import { isDevelopment, isValidLevel, resolveLevel } from './config';

describe('config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isDevelopment', () => {
    it('retorna true quando NODE_ENV é "development"', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(isDevelopment()).toBe(true);
    });

    it('retorna true quando NODE_ENV é "test"', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isDevelopment()).toBe(true);
    });

    it('retorna false quando NODE_ENV é "production"', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(isDevelopment()).toBe(false);
    });

    it('retorna true quando NODE_ENV é string vazia', () => {
      vi.stubEnv('NODE_ENV', '');
      expect(isDevelopment()).toBe(true);
    });

    it('retorna true para valores arbitrários (não-production)', () => {
      vi.stubEnv('NODE_ENV', 'staging');
      expect(isDevelopment()).toBe(true);
    });
  });

  describe('isValidLevel', () => {
    it.each(['debug', 'info', 'warn', 'error', 'fatal'] as const)(
      'retorna true para nível válido "%s"',
      (level) => {
        expect(isValidLevel(level)).toBe(true);
      },
    );

    it.each(['verbose', 'trace', 'silly', 'log', '', 'WARN', 'INFO', 'silent'])(
      'retorna false para "%s"',
      (level) => {
        expect(isValidLevel(level)).toBe(false);
      },
    );
  });

  describe('resolveLevel', () => {
    it('retorna o override explícito quando fornecido', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', 'fatal');
      expect(resolveLevel('warn')).toBe('warn');
    });

    it('cai para LOG_LEVEL quando override ausente', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', 'fatal');
      expect(resolveLevel()).toBe('fatal');
    });

    it('trata LOG_LEVEL como case-insensitive', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', 'DEBUG');
      expect(resolveLevel()).toBe('debug');
    });

    it('ignora LOG_LEVEL inválido e cai para default do NODE_ENV', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', 'verbose');
      expect(resolveLevel()).toBe('info');
    });

    it('default em dev (NODE_ENV=development) é "debug"', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('LOG_LEVEL', '');
      expect(resolveLevel()).toBe('debug');
    });

    it('default em prod (NODE_ENV=production) é "info"', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', '');
      expect(resolveLevel()).toBe('info');
    });

    it('LOG_LEVEL string vazia é ignorada (não passa em isValidLevel)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('LOG_LEVEL', '');
      expect(resolveLevel()).toBe('debug');
    });
  });
});
