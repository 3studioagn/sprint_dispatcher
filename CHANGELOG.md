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

### Changed

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
