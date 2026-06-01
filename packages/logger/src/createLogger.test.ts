import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from './createLogger';

/**
 * Estrutura mínima de uma linha de log emitida pelo Pino (JSON).
 * Pino sempre inclui `level` (numérico), `time` (ms epoch) e `pid`.
 * `hostname` vem do `os.hostname()` por default.
 */
interface LogLine {
  level: number;
  time: number;
  pid: number;
  hostname?: string;
  name?: string;
  msg?: string;
  [key: string]: unknown;
}

/**
 * Captura de linhas escritas no destination — padrão usado em todos
 * os testes. Junta chunks (pino pode flushar em pedaços) e divide
 * por `\n` antes de fazer JSON.parse.
 */
function captureLines(): {
  destination: PassThrough;
  lines: () => LogLine[];
} {
  const chunks: string[] = [];
  const destination = new PassThrough();
  destination.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf-8')));
  return {
    destination,
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((s) => s.length > 0)
        .map((s) => JSON.parse(s) as LogLine),
  };
}

/**
 * Pino com destination customizado escreve sincronamente, mas o
 * evento `data` do PassThrough propaga no próximo tick. Um único
 * `setImmediate` é suficiente para o nosso uso.
 */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Códigos numéricos dos níveis do Pino (constante interna). */
const PINO_LEVELS = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

describe('createLogger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('superfície da API', () => {
    it('retorna objeto com name + 5 níveis + child', () => {
      const { destination } = captureLines();
      const log = createLogger('foo', { destination, level: 'debug' });

      expect(log.name).toBe('foo');
      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.fatal).toBe('function');
      expect(typeof log.child).toBe('function');
    });
  });

  describe('emissão de logs', () => {
    it('inclui name + level numérico + msg em chamada string-only', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('hello', { destination, level: 'debug' });

      log.info('mundo');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        name: 'hello',
        level: PINO_LEVELS.info,
        msg: 'mundo',
      });
    });

    it('merge object bindings + msg em chamada com 2 args', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('app', { destination, level: 'debug' });

      log.info({ requestId: 'abc-123' }, 'request handled');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        name: 'app',
        requestId: 'abc-123',
        msg: 'request handled',
      });
    });

    it.each(['debug', 'info', 'warn', 'error', 'fatal'] as const)(
      'método %s aceita objeto sem msg (1 arg)',
      async (method) => {
        const { destination, lines } = captureLines();
        const log = createLogger('obj-only', {
          destination,
          level: 'debug',
        });

        log[method]({ deadline: '18:00' });
        await flush();

        const parsed = lines();
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toMatchObject({
          name: 'obj-only',
          deadline: '18:00',
        });
      },
    );

    it.each([
      ['debug', PINO_LEVELS.debug],
      ['info', PINO_LEVELS.info],
      ['warn', PINO_LEVELS.warn],
      ['error', PINO_LEVELS.error],
      ['fatal', PINO_LEVELS.fatal],
    ] as const)('método %s emite level numérico %d', async (method, expectedLevel) => {
      const { destination, lines } = captureLines();
      const log = createLogger('lvl', { destination, level: 'debug' });

      log[method]('msg');
      await flush();

      expect(lines()[0]?.level).toBe(expectedLevel);
    });

    it.each([
      ['debug', PINO_LEVELS.debug],
      ['info', PINO_LEVELS.info],
      ['warn', PINO_LEVELS.warn],
      ['error', PINO_LEVELS.error],
      ['fatal', PINO_LEVELS.fatal],
    ] as const)('método %s aceita (obj, msg) e produz level %d', async (method, expectedLevel) => {
      const { destination, lines } = captureLines();
      const log = createLogger('lvl-obj', { destination, level: 'debug' });

      log[method]({ k: 'v' }, 'msg');
      await flush();

      expect(lines()[0]).toMatchObject({
        level: expectedLevel,
        k: 'v',
        msg: 'msg',
      });
    });
  });

  describe('filtragem por nível', () => {
    it('com level=warn, descarta debug e info; emite warn/error/fatal', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('filter', { destination, level: 'warn' });

      log.debug('descarta');
      log.info('descarta');
      log.warn('passa-warn');
      log.error('passa-error');
      log.fatal('passa-fatal');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(3);
      expect(parsed.map((l) => l.msg)).toEqual(['passa-warn', 'passa-error', 'passa-fatal']);
    });

    it('LOG_LEVEL env sobrescreve default quando options.level ausente', async () => {
      vi.stubEnv('LOG_LEVEL', 'error');
      const { destination, lines } = captureLines();
      const log = createLogger('env', { destination });

      log.warn('descarta');
      log.error('passa');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.msg).toBe('passa');
    });

    it('options.level tem precedência sobre LOG_LEVEL env', async () => {
      vi.stubEnv('LOG_LEVEL', 'fatal');
      const { destination, lines } = captureLines();
      const log = createLogger('prec', { destination, level: 'debug' });

      log.debug('passa');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.msg).toBe('passa');
    });
  });

  describe('options.bindings', () => {
    it('bindings extras aparecem em todas as linhas', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('bindings', {
        destination,
        level: 'debug',
        bindings: { env: 'staging', region: 'br-east' },
      });

      log.info('a');
      log.warn('b');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toMatchObject({
        name: 'bindings',
        env: 'staging',
        region: 'br-east',
        msg: 'a',
      });
      expect(parsed[1]).toMatchObject({
        name: 'bindings',
        env: 'staging',
        region: 'br-east',
        msg: 'b',
      });
    });
  });

  describe('child', () => {
    it('cria sub-logger; linhas incluem bindings e name do pai', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('parent', { destination, level: 'debug' });
      const child = log.child({ userId: 'joao' });

      child.info('child line');
      await flush();

      const parsed = lines();
      expect(parsed[0]).toMatchObject({
        name: 'parent',
        userId: 'joao',
        msg: 'child line',
      });
    });

    it('child preserva o name do pai na propriedade .name', () => {
      const { destination } = captureLines();
      const log = createLogger('p', { destination, level: 'debug' });
      const child = log.child({ x: 1 });

      expect(child.name).toBe('p');
    });

    it('child aninhado acumula bindings (a + b)', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('chain', { destination, level: 'debug' });
      const a = log.child({ a: 1 });
      const b = a.child({ b: 2 });

      b.info('chained');
      await flush();

      const parsed = lines();
      expect(parsed[0]).toMatchObject({
        name: 'chain',
        a: 1,
        b: 2,
        msg: 'chained',
      });
    });

    it('child herda o level do pai (filtragem mantida)', async () => {
      const { destination, lines } = captureLines();
      const log = createLogger('filter-child', {
        destination,
        level: 'warn',
      });
      const child = log.child({ userId: 'x' });

      child.info('descarta');
      child.error('passa');
      await flush();

      const parsed = lines();
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.msg).toBe('passa');
    });

    it('child de child preserva name original mesmo após N chamadas', () => {
      const { destination } = captureLines();
      const log = createLogger('orig', { destination, level: 'debug' });
      const deep = log.child({ a: 1 }).child({ b: 2 }).child({ c: 3 });

      expect(deep.name).toBe('orig');
    });
  });

  describe('fluxos de default destination (sem options.destination)', () => {
    // Estes testes não inspecionam output (per prompt §6.3 — não tentar parse
    // de output colorido). Apenas validam que cada modo cria sem crash.
    // Pino-pretty em dev usa worker thread; cleanup é responsabilidade do GC.

    it('em dev, createLogger sem destination configura pino-pretty transport sem crash', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => createLogger('dev-mode')).not.toThrow();
    });

    it('em prod, createLogger sem destination usa stdout JSON sem crash', () => {
      vi.stubEnv('NODE_ENV', 'production');

      expect(() => createLogger('prod-mode')).not.toThrow();
    });
  });
});
