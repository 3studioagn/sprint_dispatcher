---
'@sprint/contracts': patch
---

test(C8): expand contracts test suite to 100% coverage with property-based tests
[BL-C8-002]

Ampliação da suíte de testes do `@sprint/contracts` (W1.C8 — Gate 2 + Gate 3)
com property-based testing (fast-check), curadoria de vetores XSS adversariais e
asserts explícitos sobre mensagens de erro Zod como API pública.

Adicionados:

- **`fast-check@^3.20.0`** como devDependency.
- **`src/__helpers__/arbitraries.ts`** — arbitraries reutilizáveis:
  `ulidArbitrary`, `userIdArbitrary`, `isoDatetimeArbitrary`, `semverArbitrary`,
  `sprintPayloadArbitrary`, `sprintAckArbitrary`, `sprintCancelArbitrary`,
  `agentConfigArbitrary`.
- **`src/__helpers__/xssVectors.ts`** — 21 vetores XSS curados em 5 categorias
  (mutation, encoding, polyglot, unicode, combining) com `reason` documentado.
- **Expansão de `sanitize.test.ts`** — 40 → 80 testes (+40):
  - 21 vetores XSS curados iterados via `it.each`
  - 4 properties universais (`<script` ausente, `javascript:` ausente, `on*=`
    ausente, idempotência)
  - 6 unicode edge cases (zero-width, RTL, ZWJ family, NFC, NFD, NFC≠NFD)
  - 3 inputs gigantes (1MB <2s, 10MB <10s, 10k scripts aninhados)
  - 5 variantes vazias/whitespace/control + curadoria guard rail
- **`src/ids.property.test.ts`** (NOVO, 9 testes) — 1000 sequenciais únicos, 100
  paralelos via `Promise.all`, properties de `isValidUlid` ↔ arbitrary.
- **`src/filenames.property.test.ts`** (NOVO, 16 testes) — 3 roundtrip
  properties (100 runs), 3 cross-discriminação properties (50 runs), edge cases
  userId.
- **`src/schemas/property.test.ts`** (NOVO, 22 testes) — 8 properties (parse
  - JSON roundtrip para 4 schemas), 13 asserts sobre mensagens de erro Zod
    específicas (`ULID`, `não pode ser vazio`, `[a-z0-9_-]`, `ISO 8601`,
    `MAJOR.MINOR.PATCH`, `>= 1`, `<= 60`).
- **Thresholds elevados** em `vitest.config.ts`: 98/95/98/98 (era 95/90/95/95).

Cobertura final: **100% lines / 100% branches / 100% functions / 100%
statements** em todos os arquivos (`constants`, `errors`, `filenames`, `ids`,
`sanitize` + 5 schemas). 230 → 317 testes (+87).

Zero modificação em código de produção.
