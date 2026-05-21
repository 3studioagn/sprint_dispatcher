# @sprint/contracts

Library compartilhada de contratos JSON do Sprint Dispatcher.

Schemas Zod, tipos TypeScript inferidos, helpers de naming, geração de IDs e
constantes — tudo o que viaja entre Leader e Agent via filesystem.

## Princípios

- **Schema-first.** Schemas Zod são a única fonte de verdade. Tipos TS derivam
  via `z.infer<>`. Impossível drift. Ver [`DECISIONS.md`](../../DECISIONS.md)
  ADR-005.
- **Library pura.** Sem I/O, sem efeitos colaterais, sem dependências de
  Electron/Node específicas. Roda em qualquer runtime JS.
- **Strict by default.** Todos os schemas usam `.strict()`, rejeitando campos
  extras — defesa contra payloads adulterados.
- **Source-first no monorepo.** Apps consomem TypeScript direto via bundler
  (Vite). Sem etapa de build de `dist/`.

## Uso básico

```ts
import {
  parseSprintPayload,
  generateSprintId,
  buildPendingFilename,
  type SprintPayload,
} from '@sprint/contracts';

// Validação de dados externos (JSON.parse de arquivo da pasta compartilhada)
const payload: SprintPayload = parseSprintPayload(jsonFromFile);

// Geração de ID novo (no Leader, ao disparar uma sprint)
const sprintId = generateSprintId();
// → "01HX9K2M4F8N7P2Q5R3S6T7V8W"

// Construção determinística de nome de arquivo
const filename = buildPendingFilename(sprintId, 'joao');
// → "01HX9K2M4F8N7P2Q5R3S6T7V8W-joao.json"
```

## API pública

### Schemas e parsers

| Schema                | Parser estrito       | Parser seguro            | Tipo            | Tipo de entrada      |
| --------------------- | -------------------- | ------------------------ | --------------- | -------------------- |
| `sprintPayloadSchema` | `parseSprintPayload` | `safeParseSprintPayload` | `SprintPayload` | `SprintPayloadInput` |
| `sprintAckSchema`     | `parseSprintAck`     | `safeParseSprintAck`     | `SprintAck`     | `SprintAckInput`     |
| `sprintCancelSchema`  | `parseSprintCancel`  | `safeParseSprintCancel`  | `SprintCancel`  | `SprintCancelInput`  |
| `agentConfigSchema`   | `parseAgentConfig`   | `safeParseAgentConfig`   | `AgentConfig`   | `AgentConfigInput`   |

- **Parser estrito** lança `ContractValidationError` em dado inválido. Use
  quando o caller espera dados válidos e tratar erro como excepcional.
- **Parser seguro** retorna `{ success, data | error }` discriminated union. Use
  quando validação é parte do fluxo normal (UI form, polling de arquivos
  potencialmente corrompidos).
- **Tipo de entrada** (`*Input`) é o tipo antes de defaults aplicados — use em
  formulários com `react-hook-form` onde defaults ainda não foram preenchidos.

### Branded types

`SprintId` e `UserId` são branded para evitar confusão acidental entre IDs.

```ts
import { sprintIdSchema, type SprintId } from '@sprint/contracts';

function processSprint(id: SprintId) {
  /* ... */
}

const raw = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
processSprint(raw); // ❌ erro de tipo (string ≠ SprintId)
processSprint(sprintIdSchema.parse(raw)); // ✅ valida e converte
```

### Filename helpers

| Função                                   | Padrão produzido                 |
| ---------------------------------------- | -------------------------------- |
| `buildPendingFilename(sprintId, userId)` | `<ulid>-<user>.json`             |
| `buildAckFilename(sprintId, userId)`     | `<ulid>-<user>.ack.json`         |
| `buildCancelFilename(sprintId)`          | `cancel-<ulid>.json`             |
| `parseFilename(name)`                    | `ParsedFilename` (lança em erro) |
| `safeParseFilename(name)`                | `{ success, data \| error }`     |

Os builds validam `sprintId` e `userId` antes de compor a string — emitem nomes
garantidos roundtrip-compatíveis com o parser.

### Geração de IDs

| Função               | Descrição                                     |
| -------------------- | --------------------------------------------- |
| `generateSprintId()` | Gera ULID novo (26 chars Crockford Base32)    |
| `isValidUlid(value)` | Valida string contra `ULID_REGEX` (defensivo) |
| `ULID_REGEX`         | Regex literal para validação manual           |

### Erros

- `ContractValidationError` — schema Zod rejeitou input. Tem `.schemaName`,
  `.issues` e `.format()` para mensagens humanas.
- `FilenameParseError` — nome de arquivo não bate com nenhum padrão conhecido.
  Tem `.filename`.

### Constantes

| Constante                              | Valor                            | Uso                                 |
| -------------------------------------- | -------------------------------- | ----------------------------------- |
| `SCHEMA_VERSION`                       | `'1.0'`                          | Versão de todos os schemas JSON     |
| `DEFAULT_POLLING_INTERVAL_MS`          | `3000`                           | Intervalo de polling padrão         |
| `DEFAULT_SHOW_DURATION_SECONDS`        | `5`                              | Tempo padrão do overlay             |
| `DEFAULT_SPRINT_TITLE`                 | `'É hora de correr'`             | Título padrão                       |
| `SHARED_DIRS.PENDING / ACKS / ARCHIVE` | `'pending' / 'acks' / 'arquivo'` | Subpastas da pasta compartilhada    |
| `LOCAL_DIRS.HISTORY / LOGS`            | `'historico' / 'logs'`           | Subpastas locais da estação         |
| `ALLOWED_HTML_TAGS`                    | `['b','i','br','p','h1','span']` | Whitelist HTML (usado em C1-004 W1) |
| `MAX_DEADLINE_HORIZON_HOURS`           | `24`                             | Limite de "deadline razoável"       |

## Tabela de cobertura de testes

| Módulo         | Linhas | Branches | Funcs | Statements |
| -------------- | -----: | -------: | ----: | ---------: |
| `constants.ts` |   100% |     100% |  100% |       100% |
| `errors.ts`    |   100% |     100% |  100% |       100% |
| `filenames.ts` |   100% |     100% |  100% |       100% |
| `ids.ts`       |   100% |     100% |  100% |       100% |
| `schemas/*.ts` |   100% |     100% |  100% |       100% |
| **Global**     |   100% |     100% |  100% |       100% |

Thresholds configurados em `vitest.config.ts`: ≥ 95% lines/funcs/statements, ≥
90% branches. Cobertura **ultrapassa thresholds em todos os módulos**.

## Roadmap interno

- **BL-C1-004 (Wave 1):** `sanitizeBodyHtml()` com DOMPurify para sanear o campo
  `body_html` antes da exibição. **Schema não sanitiza** — sanitização é
  responsabilidade explícita do sanitizador, documentado em `security.test.ts`.
- **Branded types em forms.** Com `react-hook-form`, use o tipo `*Input` em vez
  de `*` (com brand) — defaults e brand-checks só são aplicados após parse.

## Notas de naming

O ULID canônico `01HX9K2M4F8N7P2Q5R3S6T7U8V` que aparece em alguns prompts e
docs **não é válido** — contém um `U` no índice 23, e Crockford Base32 exclui
`I`, `L`, `O`, `U`. Em testes e exemplos deste package usamos
`01HX9K2M4F8N7P2Q5R3S6T7V8W` como referência válida.
