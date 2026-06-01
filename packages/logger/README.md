# @sprint/logger

Logger estruturado baseado em Pino para o Sprint Dispatcher.

Wrapper enxuto em torno do Pino com 5 níveis (`debug`, `info`, `warn`, `error`,
`fatal`), child loggers para herança de contexto, detecção automática
dev/produção, e API estreita pensada para resistir a 5+ anos de evolução do
projeto sem quebrar consumidores.

## Princípios

- **Wrapper enxuto, API estreita.** Pino expõe ~30 métodos; nós expomos 7 (5
  níveis + `child` + `name`). Trocar Pino futuramente (e.g. por OpenTelemetry)
  afeta só esse pacote, nunca os apps consumidores.
- **Dev vs prod automático.** `NODE_ENV !== 'production'` ativa `pino-pretty`
  (output colorido legível); produção emite JSON estruturado uma linha por log.
- **Library pura.** Sem I/O em disco, sem state global além de um singleton
  lazy. File transport e Sentry ficam para
  [BL-C6-003 (W3)](#o-que-está-fora-do-escopo) e BL-C6-004 (W4).
- **Source-first no monorepo.** Apps consomem TypeScript direto via bundler. Sem
  etapa de build de `dist/`.

## Por que Pino

Pino é o logger mais rápido do ecossistema Node — emite ~5× mais linhas/s que
Winston graças ao formato JSON nativo e ao worker thread opcional para
transports. É auditado, mantido, default em frameworks como Fastify, e tem
ecossistema robusto de transports (file rotation, Datadog, Loki, etc.) que abrem
a porta para W3/W4 sem reescrever o wrapper.

Decisão completa em [`DECISIONS.md`](../../DECISIONS.md) ADR-020.

## Quickstart

### Logger nomeado

```ts
import { createLogger } from '@sprint/logger';

const log = createLogger('polling-service');

log.info({ found: 3 }, 'polling cycle complete');
log.error({ err }, 'failed to read shared folder');
log.debug('cycle started'); // só aparece se LOG_LEVEL=debug ou em dev
```

### Sub-logger com contexto

```ts
const log = createLogger('overlay-service');
const sprintLog = log.child({ sprintId, userId });

sprintLog.info('overlay shown');
// → { name: 'overlay-service', sprintId: '01HX...', userId: 'joao',
//     msg: 'overlay shown', level: 30, time: 1716796800000 }
```

`child` recursa — `log.child({a:1}).child({b:2})` produz linhas com ambos `a` e
`b` presentes, mantendo o `name` original do logger raiz.

### Boot do app + fatal handler

```ts
import { rootLogger, createLogger } from '@sprint/logger';

const log = createLogger('agent-main');
log.info('boot complete');

process.on('uncaughtException', (err) => {
  rootLogger().fatal({ err }, 'uncaught exception, terminating');
  process.exit(1);
});
```

`rootLogger()` é um singleton lazy — primeira chamada cria com nome `'root'`,
chamadas subsequentes retornam a mesma instância.

## API pública

| Export                         | Tipo   | Descrição                                               |
| ------------------------------ | ------ | ------------------------------------------------------- |
| `createLogger(name, options?)` | Função | Factory de logger nomeado                               |
| `rootLogger()`                 | Função | Singleton lazy, name = `'root'`                         |
| `Logger`                       | Type   | Interface retornada por `createLogger`                  |
| `LogLevel`                     | Type   | `'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'`     |
| `LoggerOptions`                | Type   | Opções de `createLogger` (level, destination, bindings) |
| `ChildBindings`                | Type   | Shape dos bindings em `.child({...})`                   |

### Métodos do `Logger`

| Método            | Forma 1                                              | Forma 2                        |
| ----------------- | ---------------------------------------------------- | ------------------------------ |
| `debug(...)`      | `(msg: string)`                                      | `(obj: object, msg?: string)`  |
| `info(...)`       | `(msg: string)`                                      | `(obj: object, msg?: string)`  |
| `warn(...)`       | `(msg: string)`                                      | `(obj: object, msg?: string)`  |
| `error(...)`      | `(msg: string)`                                      | `(obj: object, msg?: string)`  |
| `fatal(...)`      | `(msg: string)`                                      | `(obj: object, msg?: string)`  |
| `child(bindings)` | retorna `Logger` (mesmo `name`, bindings acumulados) |                                |
| `name`            | readonly string                                      | nome passado em `createLogger` |

**Não exposto** (intencionalmente): `trace`, `silent`, `flush`, `bindings()`,
`levels`. Se um caller precisar de algum desses, abra discussão arquitetural
antes de expor.

## Configuração via env vars

| Variável    | Valores                                                              | Efeito                                                                        |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`  | qualquer string                                                      | `'production'` → JSON em stdout; qualquer outra coisa → pretty print colorido |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` \| `fatal` (case-insensitive) | Filtra logs abaixo desse nível                                                |

Precedência (do mais forte para o mais fraco):

1. `options.level` em `createLogger(name, { level })`
2. Env var `LOG_LEVEL`
3. Default por `NODE_ENV`: `'debug'` em dev, `'info'` em prod

Valores inválidos em `LOG_LEVEL` (e.g. `verbose`, `silly`) são **ignorados
silenciosamente** — fallback para o default do `NODE_ENV`.

## Uso esperado nos apps (W3 / BL-C6-002)

Esta sessão entrega **apenas o pacote** (BL-C6-001). A integração nos apps
acontece em **W3 (BL-C6-002)** — quando vai entrar substituindo os `console.*`
espalhados no Leader/Agent. Exemplos prontos para essa sessão:

### No main process do Leader (`apps/leader/src/main/index.ts`)

```ts
import { createLogger } from '@sprint/logger';

const log = createLogger('leader-main');

log.info('Leader booting');

app.whenReady().then(async () => {
  try {
    rebuildDeps();
    log.info({ sharedPath: deps.config?.shared_path }, 'config loaded');
  } catch (err) {
    log.error({ err }, 'failed to load config');
  }
});
```

### No serviço de polling do Agent (`apps/operator-agent/src/main/services/pollingService.ts`)

```ts
import { createLogger } from '@sprint/logger';

const log = createLogger('polling-service');

// PollingDeps.log: PollingLogger — já tem o slot pronto.
const pollingService = new PollingService({
  pendingStore,
  queueService,
  historyService,
  userId: config.user_id,
  pollingIntervalMs: config.polling_interval_seconds * 1000,
  log: {
    warn: (msg, ctx) => log.warn(ctx ?? {}, msg),
    error: (msg, ctx) => log.error(ctx ?? {}, msg),
  },
});
```

### Sub-logger por sprint no overlay (Agent)

```ts
const log = createLogger('overlay-service');

function showSprint(item: QueueItem, queueLength: number) {
  const sprintLog = log.child({
    sprintId: item.payload.sprint_id,
    userId: item.payload.user_id,
  });

  sprintLog.info({ queueLength }, 'overlay shown');
  // → toda chamada subsequente em sprintLog inclui sprintId + userId

  // ... lógica ...

  sprintLog.debug('timer started');
}
```

### Locais que aguardam refactor (apurados na Sessão 17 / Gate 1)

**Agent (`apps/operator-agent/`):**

- `src/renderer/hooks/useIncomingSprint.ts:39` — `console.warn`
- `src/main/index.ts:75-77` — `console.error` (uncaughtException fatal)
- `src/main/index.ts:88` — `console.error` (unhandledRejection)
- `src/main/index.ts:171` — `console.warn` (handleAck deps logger)
- `src/main/index.ts:204` — `console.warn` (handleAck deps logger)
- `src/main/index.ts:216` — `console.warn` (polling deps logger)
- `src/main/index.ts:219` — `console.error` (polling deps logger)
- `src/main/index.ts:319` — `console.error` (handleAck fallback)

**Leader (`apps/leader/`):** ZERO `console.*` hoje. BL-C6-002 vai **adicionar**
logging onde o Leader hoje lança erro silenciosamente
(`dispatchService.dispatch` try/catch isolado por operador, `loadLeaderConfig` 5
ConfigError, `OperatorsService.list`).

## Para testes

Use o pattern abaixo para capturar linhas e fazer asserts sobre o JSON emitido.
`destination` customizado **sempre** escreve JSON puro (não passa por
`pino-pretty`), independentemente do `NODE_ENV`.

```ts
import { PassThrough } from 'node:stream';
import { createLogger } from '@sprint/logger';

function captureLines() {
  const chunks: string[] = [];
  const destination = new PassThrough();
  destination.on('data', (chunk: Buffer) =>
    chunks.push(chunk.toString('utf-8')),
  );
  return {
    destination,
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((s) => s.length > 0)
        .map((s) => JSON.parse(s)),
  };
}

const { destination, lines } = captureLines();
const log = createLogger('test', { destination, level: 'debug' });

log.info({ foo: 'bar' }, 'hello');

// Pino escreve sincronamente em stream customizado, mas o evento `data`
// do PassThrough propaga no próximo tick.
await new Promise((r) => setImmediate(r));

expect(lines()[0]).toMatchObject({
  name: 'test',
  foo: 'bar',
  msg: 'hello',
  level: 30, // info = 30 no Pino
});
```

Códigos numéricos dos níveis do Pino: `debug=20`, `info=30`, `warn=40`,
`error=50`, `fatal=60`.

## O que está FORA do escopo

| Item                                               | BL        | Wave  |
| -------------------------------------------------- | --------- | ----- |
| Integração nos apps (refactor console.\*)          | BL-C6-002 | W3    |
| Rotação de logs em arquivo (`pino-roll`)           | BL-C6-003 | W3    |
| Envio para serviço externo (Sentry, Loki, Datadog) | BL-C6-004 | W4+   |
| Loggers tipados por bindings (e.g. `child<T>`)     | —         | YAGNI |
| Color schemes customizados                         | —         | YAGNI |
| Métricas / log aggregation interno                 | —         | YAGNI |

## Cobertura de testes

| Módulo            | Linhas | Branches | Funcs | Statements |
| ----------------- | -----: | -------: | ----: | ---------: |
| `config.ts`       |   100% |     100% |  100% |       100% |
| `createLogger.ts` |   100% |     100% |  100% |       100% |
| `rootLogger.ts`   |   100% |     100% |  100% |       100% |
| **Global**        |   100% |     100% |  100% |       100% |

Thresholds em `vitest.config.ts`: ≥ 95% lines/funcs/statements, ≥ 90% branches.
Cobertura **ultrapassa thresholds em todos os módulos**.

`types.ts` não aparece porque consiste apenas de `export type` (zero statements
de runtime — v8 não mede). `index.ts` é excluído por config (barrel
transparente, mesma escolha de `contracts` e `fs-adapter`).

## Referências

- [`DECISIONS.md`](../../DECISIONS.md) ADR-XXX (Sessão 17 — a ser adicionado em
  Gate 6)
- Backlog BL-C6-001 (este pacote), BL-C6-002 (integração — W3), BL-C6-003 (file
  transport — W3), BL-C6-004 (Sentry — W4+)
- RNF-03 (observabilidade) — esta sessão cumpre a fundação; integração fica para
  W3
- [Pino docs](https://getpino.io)
- [`pino-pretty` docs](https://github.com/pinojs/pino-pretty)
