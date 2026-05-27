---
'@sprint/logger': patch
---

feat(C6): add @sprint/logger with Pino — pretty in dev, JSON in prod [BL-C6-001]

Pacote novo `@sprint/logger` em `packages/logger/`. Wrapper enxuto em torno do
Pino expondo 5 níveis (`debug`, `info`, `warn`, `error`, `fatal`) + `child` para
herança de contexto + `name` readonly. API estreita por design: trocar Pino
futuramente afeta só esse pacote, nunca os apps consumidores.

Entregues:

- **`createLogger(name, options?)`** — factory de logger nomeado. Em dev
  (`NODE_ENV !== 'production'`) sem `destination`, ativa `pino-pretty` em worker
  thread para output colorido legível. Em prod, JSON estruturado em
  `process.stdout`. Com `destination` customizado (usado em testes), sempre JSON
  síncrono no stream fornecido.
- **`rootLogger()`** — singleton lazy com `name === 'root'`. Pensado para boot
  do app e fatal handlers globais (`uncaughtException`).
- **Tipos públicos**: `Logger`, `LogLevel`, `LoggerOptions`, `ChildBindings`.
- **Configuração via env vars**: `NODE_ENV` (dev vs prod) + `LOG_LEVEL`
  (case-insensitive, ignorado se inválido). Precedência: `options.level` > env >
  default por `NODE_ENV` (`'debug'` em dev, `'info'` em prod).

Deps runtime: `pino@^9` + `pino-pretty@^11` (regular dep — usado em runtime dev
mode dos apps, não só em testes).

Coverage 100% em `config.ts`, `createLogger.ts` e `rootLogger.ts` (57 testes em
3 arquivos). Thresholds `vitest.config.ts`: 95/95/90/95.

**Fora do escopo**: integração nos apps (BL-C6-002 — W3 — refactor de
`console.*` no Agent e adição de logging no Leader) e file transport com rotação
(BL-C6-003 — W3 — via `pino-roll`). README do pacote tem seção "Uso esperado nos
apps (W3 / BL-C6-002)" com exemplos copy-pasteáveis e lista exata dos 8
`console.*` no Agent (apurada nesta sessão).
