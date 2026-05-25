# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Added

- Monorepo pnpm 10 + workspaces (`apps/*`, `packages/*`) com Turborepo 2.x
  (chave `tasks`) [BL-C0-001, BL-C0-002]
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`) com path aliases `@sprint/*` [BL-C0-003]
- Toolchain de qualidade: ESLint 10 flat config, Prettier 3, Husky 9,
  lint-staged 17, commitlint 21 (escopos `C0..C8`, `repo`) [BL-C0-004]
- Pipeline CI no GitHub Actions: install + format:check + lint + type-check +
  test + build, com cache pnpm e cache Turbo [BL-C0-005]
- Changesets 2.x configurado (`baseBranch=develop`, `access=restricted`);
  `linked`/`ignore` documentados em `.changeset/README.md` como pendência
  até os packages existirem [BL-C0-006]
- ADR-001..004 em `DECISIONS.md`: monorepo, Electron, pasta compartilhada
  SMB, polling [BL-C0-007]
- `README.md` "Como rodar localmente" completo + badge CI [BL-C0-007]
- Package `@sprint/contracts` com schemas Zod e tipos inferidos via
  `z.infer` [BL-C1-001, BL-C1-002]
- `generateSprintId()` e `isValidUlid()` com ULID Crockford Base32
  (defensivo contra entradas não-string) [BL-C1-005]
- Helpers de filename: `buildPending/Ack/CancelFilename`, `parseFilename`,
  `safeParseFilename` com `ParsedFilename` discriminated union
  [BL-C1-003]
- Constantes compartilhadas: `SCHEMA_VERSION`, `DEFAULT_POLLING_INTERVAL_MS`,
  `SHARED_DIRS`, `LOCAL_DIRS`, `ALLOWED_HTML_TAGS`,
  `MAX_DEADLINE_HORIZON_HOURS`, etc [BL-C1-006]
- `ContractValidationError` (com `cause: ZodError`, `.issues`, `.format()`)
  e `FilenameParseError` tipados [BL-C1-002, BL-C1-003]
- Branded types `SprintId` e `UserId` (via `z.brand`) para evitar trocas
  acidentais entre IDs [BL-C1-002]
- ADR-005 em `DECISIONS.md`: schema-first com `z.infer<>`
- ADR-006 em `DECISIONS.md`: filenames com ULID completo (esclarece Anexo A
  do Requisitos)
- ADR-007 em `DECISIONS.md`: ratifica baseline de versões instaladas
  (endereça audit FINDING-M1)
- README do package `@sprint/contracts` com tabela de API, branded types,
  cobertura e roadmap
- Workspace `apps/leader`: app desktop Electron 30 + React 18 + TypeScript,
  bundling via vite-plugin-electron [BL-C2-001]
- Main process com `BrowserWindow` segura (CLAUDE.md §8.1) + hardening de
  navegação (`will-navigate`, `setWindowOpenHandler`) [BL-C2-001]
- Preload + bridge IPC contract-first via `contextBridge`; `LeaderAPI` em
  `src/shared/ipc-types.ts` [BL-C2-001]
- Renderer React placeholder com CSS Modules + tokens e CSP estrita no
  `index.html` [BL-C2-001]
- `electron-builder.yml` do Leader: targets portable + NSIS, instalador pt-BR,
  `requestExecutionLevel: user` [BL-C5-001]
- ADR-008 (bundling com vite-plugin-electron) e ADR-009 (IPC contract-first) em
  `DECISIONS.md`
- Workspace `apps/operator-agent`: app desktop Electron 42 tray-resident,
  React 18 + TypeScript (CJS) [BL-C3-001]
- Main process com single instance lock; `window-all-closed` apenas subscrito
  (sem `preventDefault()` — ADR-011, G-013); tray icon + menu placeholder
  Sobre/Sair; `tray.ico` 16×16 32bpp gerado via Node [BL-C3-001]
- `createOverlayWindow` declarado (TOPMOST, `closable: false`, §8.1) para uso
  em W1 [BL-C3-001]
- Preload + bridge IPC contract-first; `AgentAPI` + `SafeAgentConfigView` em
  `src/shared/ipc-types.ts` (defense-in-depth) [BL-C3-001]
- Renderer placeholder React + CSS Modules; tokens espelham o Leader; CSP
  estrita endurecida (`object-src 'none'`, `base-uri 'self'`) [BL-C3-001]
- Loader de `config.json` fail-fast com 4 `ConfigError` tipados (NotFound,
  Json, Invalid, Read); validação via `safeParseAgentConfig` do
  `@sprint/contracts`; integração no `bootstrap` com diálogo + `app.quit()` em
  erro; handler IPC `getConfig` expõe só `SafeAgentConfigView` [BL-C3-002]
- 13 testes de `config.ts` + 2 de `single-instance.ts` (fs temp real, EISDIR
  via path-como-diretório); cobertura 100% [BL-C3-002]
- `electron-builder.yml` do Agent: portable + NSIS pt-BR, `runAfterFinish`,
  sem desktop shortcut, preserva `config.json` na desinstalação [BL-C5-002]
- ADR-011 (arquitetura tray-resident) e ADR-012 (loader fail-fast) em
  `DECISIONS.md`
- Package `@sprint/fs-adapter` (port-and-adapter hexagonal): library de
  filesystem com port + 2 adapters [BL-C4-001]
- `IFilesystemAdapter` interface com 8 métodos primitivos (`readFile`,
  `writeFileAtomic`, `listDir`, `exists`, `rename`, `unlink`, `mkdir`,
  `stat`) + tipo `FileStat` [BL-C4-001]
- `FilesystemError` abstract base + `FileNotFoundError`,
  `DirectoryNotFoundError`, `FilesystemIOError` concretos; `new.target`
  check enforce abstractness em runtime [BL-C4-001]
- `NodeFilesystemAdapter` usando `node:fs/promises` com escrita atômica
  (open→writeFile→fsync→close→rename) e sufixo aleatório de 6 bytes hex
  no `.tmp` para isolar escritas concorrentes [BL-C4-007]
- `mapError` exhaustive cobrindo ENOENT, ENOTDIR, EISDIR, EACCES, EPERM,
  EEXIST, ENOSPC, EBUSY e fallback `desconhecido` [BL-C4-007]
- `MemoryFilesystemAdapter` in-memory (`Map<string, MemoryFileEntry>`)
  com diretórios implícitos, `mkdir` no-op idempotente, helpers
  `seed()`/`reset()` para fixtures [BL-C4-006]
- Suite de contrato compartilhada (`describeContract` em
  `src/__tests__/contract.test.ts`): 26 testes × 2 adapters = 52 testes
  garantindo paridade Node↔Memory [BL-C4-001]
- ADR-013 (filesystem adapter port-and-adapter hexagonal) em
  `DECISIONS.md`
- README raiz definitivo do monorepo (onboarding ≤ 10 min, visão geral,
  estrutura, componentes C0-C8, comandos, padrões, status) [BL-C7-001]
- Vitest consolidado via Turborepo: `pnpm test` e `pnpm test:coverage`
  na raiz orquestram todos os packages [BL-C8-001]
- Task `test:coverage` em `turbo.json` com `outputs: ["coverage/**"]`
  [BL-C8-001]
- Tabela formal de coverage thresholds por package em CLAUDE.md §7.7.1
  [BL-C8-001]
- ESLint regra customizada: `apps/leader` proibido de importar
  `apps/operator-agent` (e vice-versa) [BL-C8-005]
- ESLint regra customizada: imports de `packages/*` devem usar alias
  `@sprint/<pkg>` (sem path relativo cross-package) [BL-C8-005]
- Seção "Débitos técnicos pendentes" em CLAUDE.md §12 — registra a
  3ª regra ESLint (no-console estrito) como pendente para W1
  [BL-C8-005]
- ADR-002 complementado com alternativa Web/PWA (incompatibilidade
  com RF-07 TOPMOST, RF-19 auto-start) [BL-C7-005]
- ADR-003 complementado com alternativa A5 mensageria (RabbitMQ /
  MQTT / ActiveMQ) e tabela de critérios estendida [BL-C7-004]
- `@sprint/contracts`: `sanitizeBodyHtml(html)` — sanitização de
  `body_html` via `isomorphic-dompurify` (^2.36.0); whitelist estrita
  via `ALLOWED_HTML_TAGS`, zero atributos permitidos, `KEEP_CONTENT`
  preserva texto de tags removidas; idempotente; defesa em
  profundidade (Leader sanitiza ao escrever, Agent ao renderizar);
  40 testes adversariais (XSS clássicos, edge cases) com cobertura
  100% no módulo [BL-C1-004]
- ADR-014 (sanitização de `body_html` via isomorphic-dompurify) em
  `DECISIONS.md`
- CLAUDE.md §7.9 (convenção de uso obrigatório de `sanitizeBodyHtml`
  em toda escrita e leitura de `body_html`)
- `apps/leader`: layout base com 3 rotas (Nova Sprint, Acompanhamento,
  Histórico) via `react-router-dom` ^6.30 em hash mode + sidebar persistente
  com identidade ARTFLEXÍVEIS [BL-C2-002]
- `apps/leader`: stores Zustand ^4.5 — `useSprintComposerStore` (draft do
  composer com operadores + metas + deadline + title + body, ações
  imutáveis) e `useOperatorsStore` (cache filtrando `ativo: true`); selectors
  puros top-level `selectIsValid`, `selectSelectedCount`, `selectFormPayload`
  [BL-C2-011]
- `apps/leader`: `composerFormSchema` Zod (RN-07: meta inteira ≥ 1; deadline
  regex HH:MM 00–23) como fonte única de regras do composer; `selectIsValid`
  delega para `selectFormPayload(state) !== null` (schema-first ADR-005)
  [BL-C2-011]
- `apps/leader`: tela "Nova Sprint" com `OperatorList` (4 operadores ativos
  do mock, filtro por `ativo: true`), `OperatorRow` com checkbox + label
  clicável + nome + hostname, e `BulkSelectButtons` "Marcar todos" /
  "Desmarcar todos" (desabilitam quando lista vazia) [BL-C2-003]
- `apps/leader`: input numérico de meta inline em `OperatorRow` (renderiza
  quando `isSelected`); `aria-invalid` + `aria-describedby` + mensagem
  inline "Meta ≥ 1" quando inválida (null/0/negativa/fracionária) [BL-C2-004]
- `apps/leader`: `DeadlineInput` com `<input type="time">`, default '18:00'
  da store, warning visual `role="alert"` quando deadline está no passado
  (não-bloqueante); helper puro `isDeadlineInPast(hhmm, now?)` exportado
  para reuso [BL-C2-005]
- `apps/leader`: botão "Enviar" como stub desabilitado, controlado pela flag
  `DISPATCH_ENABLED = false` em `NovaSprint.tsx`; tooltip aponta para
  BL-C2-007; `console.warn` de stub no handler (permitido pela regra atual).
  **Ativação prevista em BL-C2-007 (parte 2 desta sessão) após C4 entregar
  operações de domínio do fs-adapter**
- `apps/leader`: tooling de teste de componente — `@testing-library/react`
  ^16.3, `@testing-library/user-event` ^14.6, `@testing-library/jest-dom`
  ^6.9 como devDeps; `test-setup.ts` com `cleanup()` em `afterEach` e
  matchers globais via `jest-dom/vitest`
- `apps/leader`: 84 testes unitários em 7 arquivos (era 0); cobertura
  agregada **96.64% lines / 94.89% branches / 92.59% funcs**; stores
  individuais 100%, componentes 96-100% individuais, rotas 93-100%
- ADR-015 (arquitetura do composer da app Líder — W1.C2 parte 1) em
  `DECISIONS.md`
- CLAUDE.md §3 atualizada (tabela de stack): zustand **4.5.7**,
  react-router-dom **6.30.3**, isomorphic-dompurify **2.36.0**, Electron
  **42.2.0** (corrige stale), @testing-library/{react,user-event,jest-dom}
- CLAUDE.md §4 ganhou nova subseção "Estrutura interna do Leader (W1.C2
  parte 1)" documentando organização do `renderer/` e convenções
  específicas (selectors puros, schema-first, flag DISPATCH_ENABLED,
  decisão de não usar RHF)
- `@sprint/fs-adapter`: camada de domínio em `src/domain/` (port-and-adapter
  per ADR-013) — `PendingStore` (`writePendingSprint`, `listPending`,
  `deletePending`), `AckStore` (`writeAck`, `listAcks`), stubs `CancelStore`
  (W2 / BL-C4-004) e `ArchiveStore` (W3 / BL-C4-005). Todos com construtor
  uniforme `(adapter, sharedPath)` [BL-C4-002, BL-C4-003, BL-C4-006]
- `@sprint/fs-adapter`: utility interno `readAndParseJson` com
  discriminador `kind: 'not-found' | 'invalid'` em `ok: false` —
  consumers distinguem race condition (skip) de corrupção (`kind: invalid`)
  sem string match
- `@sprint/fs-adapter`: `NotImplementedError` na hierarquia
  `FilesystemError` — usado pelos stubs `CancelStore.writeCancel` e
  `ArchiveStore.moveToArchive` com `operationName` exposto
- `@sprint/fs-adapter`: `writePendingSprint` sanitiza `body_html` antes
  de gravar (CLAUDE.md §7.9 + ADR-014); re-valida via `parseSprintPayload`
  como defesa em profundidade contra cast bypass; idem `writeAck` via
  `parseSprintAck`
- `@sprint/fs-adapter`: tipos exportados —
  `PendingEntry`/`AckEntry` (discriminated unions com `kind` e `modifiedAt`),
  `ListPendingFilter`/`ListAcksFilter`, `WritePendingResult`/`WriteAckResult`/
  `WriteCancelResult`/`MoveToArchiveResult`
- `@sprint/fs-adapter`: nova runtime dep `@sprint/contracts` (`workspace:*`)
  para parsers, sanitizer e filename builders
- `@sprint/fs-adapter`: sanity test em `src/__tests__/barrel.test.ts`
  importando via barrel raiz — captura early o erro de adicionar símbolo
  público sem atualizar `index.ts`
- ADR-016 (domain layer do `@sprint/fs-adapter` — W1) em `DECISIONS.md`
- CLAUDE.md §4 ganhou nova subseção "Estrutura interna de
  `@sprint/fs-adapter` (W1 domain layer)" documentando convenções
  (construtor uniforme, `path.posix.join`, RN-09 no domain layer,
  race-safe via FileNotFoundError skip, JSON pretty-print, stubs W2/W3)

### Changed

- `apps/leader/package.json`: adicionado script `test:coverage` e
  devDep `@vitest/coverage-v8` para consistência com os demais
  workspaces [BL-C8-001]
- `apps/leader/vitest.config.ts` e `apps/operator-agent/vitest.config.ts`:
  reporters padronizados (`text`, `json`, `json-summary`, `html`,
  `lcov`) para uso por ferramentas externas de coverage agregada
  [BL-C8-001]

- `eslint.config.mjs`: corrige merge de `rules` no override
  `disableTypeChecked` (bug latente em C0 exposto pelo primeiro `.ts`
  lintado em config files — `vitest.config.ts`)
- `packages/contracts/tsconfig.json`: não exclui `*.test.ts` nem
  `__fixtures__/**` (projectService da typescript-eslint v8 exige
  cobertura por tsconfig; type-check de testes captura erros)
- `package.json` raiz: `esbuild` adicionado a `pnpm.onlyBuiltDependencies`
  (necessário para Vitest funcionar)
- `.changeset/README.md`: marca `@sprint/contracts` como criado;
  `linked`/`ignore` continuam vazios em `config.json` até `fs-adapter` e
  `logger` existirem (endereçamento parcial de audit FINDING-M2)
- `package.json` raiz: `electron` adicionado a `pnpm.onlyBuiltDependencies`
  (postinstall baixa o binário do Electron); `--no-warn-ignored` no comando
  eslint do `lint-staged` (evita falha ao commitar arquivos `.d.ts`) [BL-C2-001]
- `eslint.config.mjs` e `.prettierignore`: ignoram `dist-electron` (saída do
  vite-plugin-electron) [BL-C2-001]
- `.gitignore` raiz: `!apps/*/build/` — não ignora o diretório `buildResources`
  do electron-builder [BL-C5-001]

### Fixed

- Testes diretos para `errors.ts` e `schemas/shared.ts`: fecha a heurística de
  par `.test.ts` 1-para-1 do package `@sprint/contracts` (164 → 190 testes,
  cobertura 100% mantida) [audit-v1-FINDING-001]
- JSDoc consistente nos parsers e types de `sprintAck`, `sprintCancel` e
  `agentConfig`, replicado da referência `sprintPayload` [audit-v1-FINDING-002]
- Upgrade do Electron 30.5.1 → 42.2.0 e override de `tar` para `^7.5.11`
  (`pnpm.overrides`): `pnpm audit` cai de 10 advisories High para 0; ADR-010
  registra a decisão [audit-v1-FINDING-001]
- Entrada morta `electron-builder.yml.d.ts` removida do `include` do
  `apps/leader/tsconfig.json` [audit-v1-FINDING-002]
- CSP do `apps/leader/index.html` endurecida com `object-src 'none'` e
  `base-uri 'self'` [audit-v1-FINDING-003]
- `rfc3161TimeStampServer` comentado no `electron-builder.yml` do Leader — code
  signing diferido para a Wave 3 (BL-C0-008) [audit-v1-FINDING-004]

### Deprecated

### Removed

### Security

---

<!--
Quando um release acontecer, mova o conteúdo de [Unreleased] para uma nova seção
versionada, mantendo [Unreleased] vazia com a estrutura acima.

Exemplo:

## [1.0.0] - 2026-07-15

### Added
- Aplicação do Líder com fluxo completo de disparo de sprint [BL-C2-001..007]
- Agente do Operador com overlay TOPMOST e ack [BL-C3-001..007]
- Pacote @sprint/contracts com schemas Zod [BL-C1-001..006]
- Pacote @sprint/fs-adapter com escrita atômica [BL-C4-001..007]

### Changed
- (nada na primeira release)

### Fixed
- (nada na primeira release)
-->

---

## Convenções

- **Entradas referenciam o item do backlog** entre colchetes: `[BL-CX-NNN]`
- **Categorias seguem Keep a Changelog**: Added, Changed, Fixed, Deprecated, Removed, Security
- **Datas em ISO**: `YYYY-MM-DD`
- **Versões seguem SemVer**: MAJOR.MINOR.PATCH

## Quando atualizar

Atualize esta `[Unreleased]` ao concluir e mergear cada item do backlog em `develop`. Não espere o final da wave.
