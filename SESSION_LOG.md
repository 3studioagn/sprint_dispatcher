# SESSION_LOG.md — Diário de Sessões

Registro cronológico de cada sessão de desenvolvimento do Claude Code neste
projeto.

> **Claude Code:** o objetivo deste arquivo é resolver o problema do **"onde
> paramos?"** entre sessões. Você lê a entrada mais recente no início de toda
> sessão pra retomar de onde a anterior parou. Você escreve uma nova entrada no
> fim de toda sessão, sem exceção.

---

## Formato de cada entrada

```markdown
## Sessão NN — YYYY-MM-DD

**Wave atual:** W0 / W1 / W2 / W3 / W4 **Duração estimada:** ~Xh **Itens
trabalhados:** [BL-CX-NNN, BL-CX-NNN, ...]

### Objetivo da sessão

<O que era pra ser feito quando começamos>

### O que foi feito

<Lista do trabalho efetivamente realizado, com refs a commits relevantes>

### Estado atual

<Em que ponto exato o trabalho está agora?>

- BL-CX-NNN: ✅ concluído, mergeado em develop
- BL-CX-NNN: 🔄 70% — falta X, testes Y passando
- BL-CX-NNN: ⏸️ não iniciado

### Decisões tomadas

<Decisões da sessão. Se virou ADR, referencie DECISIONS.md ADR-NNN>

### Bloqueios encontrados

<O que travou? Espera input de Renan? Aguarda decisão externa?>

### Próximo passo

<O que a próxima sessão deve fazer primeiro. Seja específico.>

### Observações para a próxima sessão

<Contexto implícito que não cabe nos outros lugares. Gotchas frescos, libs que
não funcionaram, atalhos descobertos, cuidados a tomar. Use sem culpa.>
```

### Convenções de status

- ✅ — item totalmente concluído e mergeado
- 🔄 — em andamento
- ⏸️ — pausado ou não iniciado
- ❌ — abortado ou bloqueado
- ⚠️ — concluído mas com débito técnico ou observação importante

---

## Histórico

<!-- Adicione novas entradas ABAIXO desta linha, mais recente NO TOPO da lista (ordem reversa cronológica). -->

## Sessão 01 — 2026-05-21

**Wave atual:** W0 **Duração estimada:** ~3h **Itens trabalhados:** [BL-C0-001,
BL-C0-002, BL-C0-003, BL-C0-004, BL-C0-005, BL-C0-006, BL-C0-007]

### Objetivo da sessão

Executar a totalidade do Componente C0 (Foundation & Infrastructure) da Wave 0:
bootstrap do monorepo, toolchain de qualidade, CI no GitHub Actions, Changesets
e os 4 ADRs fundacionais.

### O que foi feito

- `git init -b main`, commit inicial dos 5 `.md` de contexto em `main`, criação
  de `develop` a partir dele, remote `origin` apontando pra
  `https://github.com/3studioagn/sprint_dispatcher.git`, push de `main` e
  `develop`.
- Monorepo pnpm + workspaces (`apps/*`, `packages/*`); `.editorconfig`,
  `.gitignore`, `.gitattributes` (LF), `.nvmrc` (`24.10.0`), `.npmrc`
  (`auto-install-peers + strict-peer-dependencies`), estrutura vazia com
  `.gitkeep` em `apps/`, `packages/`, `installer/`, `docs/`, `tests/e2e/`.
- TypeScript strict com `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; `tsconfig.base.json` +
  `tsconfig.json` raiz com path aliases `@sprint/*`.
- Turborepo 2.9.14 com chave `tasks` (não `pipeline`); 5 tasks:
  build/test/lint/type-check/dev.
- ESLint 10.4.0 (flat) + typescript-eslint 8.59.4 + import-x + promise +
  eslint-config-prettier; Prettier 3.8.3 com `proseWrap=always` em MD; Husky
  9.1.7 com `pre-commit` (lint-staged) e `commit-msg` (commitlint); lint-staged
  17.0.5; commitlint 21.0.1 com type-enum + scope-enum (`C0..C8`, `repo`) +
  header max 100.
- Changesets 2.31.0 com `baseBranch=develop`, `access=restricted`,
  `updateInternalDependencies=patch`. `linked` e `ignore` vazios por enquanto
  (ver gotcha G-003); `.changeset/README.md` documenta a config alvo e os itens
  BL responsáveis por re-popular.
- CI `.github/workflows/ci.yml` em `ubuntu-latest`: install → format:check →
  lint → type-check → test → build, com cache pnpm + cache Turbo, concurrency
  cancelando duplicados em branches efêmeras, timeout 15 min. Badge no README.
  Primeiro run rodou verde (confirmado pelo Renan).
- `DECISIONS.md`: ADRs 001 (monorepo pnpm + Turborepo), 002 (Electron), 003
  (pasta compartilhada SMB), 004 (polling). Índice navegável no topo.
- `README.md`: seção "Como rodar localmente" completa (pré-requisitos, setup,
  tabela de comandos, convenção de commits, branches); badge CI no topo.
- 7 commits squashed em `develop` via fast-forward, todos pushados pro GitHub.

### Estado atual

- **BL-C0-001:** ✅ Inicializar monorepo com pnpm workspaces
- **BL-C0-002:** ✅ Configurar Turborepo
- **BL-C0-003:** ✅ Configurar TypeScript com paths e strict mode
- **BL-C0-004:** ✅ Setup ESLint + Prettier + lint-staged + commitlint + Husky
- **BL-C0-005:** ✅ Pipeline CI no GitHub Actions (workflow verde no GitHub)
- **BL-C0-006:** ⚠️ Setup Changesets — concluído com débito documentado
  (`linked`/`ignore` vazios até os packages existirem; ver G-003)
- **BL-C0-007:** ✅ Criar arquivos de contexto persistente + ADRs 001..004
- **BL-C0-008:** ⏸️ Code signing — Wave 3
- **BL-C0-009:** ⏸️ Pipeline de release automatizada — Wave 3

**Gate W0 → W1:** ainda **não atingido**. C0 fechou; faltam scaffolds dos
packages (C1, C4, C6) e dos apps (C2, C3).

### Decisões tomadas

- Adotada chave `tasks` no `turbo.json` (não `pipeline`, depreciada em Turbo
  2.x). Registrado como gotcha G-001 e documentado em ADR-001.
- Ambiente real usa **Node 24.10.0** e **pnpm 10.18.2** — superior ao plano
  original (Node 20 LTS, pnpm 9.x). Decisão validada com o Renan; CLAUDE.md §3 e
  `.nvmrc` refletem o que está instalado. `engines.pnpm: ">=10.0.0"`.
- **ESLint 10** e **TypeScript 6** entraram naturalmente via `pnpm add` —
  versões mais novas que o plano (9.x e 5.4+). Sem regressão observada;
  CLAUDE.md §3 atualizado.
- **Changesets `linked`/`ignore` vazios** até os packages existirem, por
  imposição do próprio Changesets (validação contra workspaces reais). Ver G-003
  e `.changeset/README.md`.
- Apps Electron (`sprint-leader`, `sprint-operator-agent`) ficarão **fora do
  versionamento Changesets** (versionam pelo `electron-builder`); decisão
  documentada em ADR-001 e na config alvo do `.changeset/README.md`.
- ADRs registrados em `DECISIONS.md`: ADR-001 a ADR-004 (todos Status: Accepted,
  decisor: Renan/3Studio).

### Bloqueios encontrados

Nenhum.

### Próximo passo

Iniciar próxima sessão executando os scaffolds dos packages internos:

1. `packages/contracts/` (BL-C1-001 a BL-C1-006) — tipos TS + schemas Zod +
   sanitização HTML + parsers.
2. Provavelmente seguido por `packages/fs-adapter/` (BL-C4-001..007) e
   `packages/logger/` (BL-C6-001..007), mas confirmar ordem com Renan.

Quando o primeiro package (`@sprint/contracts`) entrar:

- atualizar `.changeset/config.json` com
  `linked: [["@sprint/contracts", "@sprint/fs-adapter", "@sprint/logger"]]` (e
  `ignore` quando os apps entrarem).
- validar `pnpm changeset status` sem ValidationError.
- atualizar tabela de `CLAUDE.md` §3 com Zod, ulid, isomorphic-dompurify
  instalados.

Sugestão pro Renan: gerar prompt master para o C1 equivalente ao desta sessão.

### Observações para a próxima sessão

- **PowerShell bloqueia `pnpm.ps1`** (G-002). Toda invocação de pnpm/turbo/
  changeset durante esta sessão foi feita via Git Bash. Se a próxima sessão
  rodar comandos pnpm direto no PowerShell, vai topar com `UnauthorizedAccess`.
- Stack doc externa §11.2 ainda mostra `pipeline` no `turbo.json`. Sugerir ao
  Renan atualizar pra `tasks` (Turbo 2.x). G-001 documenta isso.
- Os path aliases em `tsconfig.json` apontam pra arquivos que ainda não existem
  (`packages/contracts/src/index.ts` etc.). Isso **não quebra** `tsc --noEmit`
  porque o `include` raiz é `[]`. Será ativado quando os packages forem
  implementados.
- `pnpm lint`, `pnpm test`, `pnpm type-check` e `pnpm build` retornam exit 0
  mesmo sem workspaces — o Turbo loga "0 packages". Não confundir com silêncio.
  Quando o primeiro package entrar, Turbo passa a invocar ESLint/Vitest/tsc
  dentro dele.
- Hook `pre-commit` usa `lint-staged`; `commit-msg` usa `commitlint`. Ambos
  funcionam. Se alguém clonar o repo e os hooks não dispararem, rodar
  `pnpm install` (o script `prepare` re-instala husky).
- Warning recorrente: `Ignored build scripts: unrs-resolver` (subdep do
  `eslint-plugin-import-x`). Não impactou ESLint nas validações; já declarado em
  `pnpm.onlyBuiltDependencies: ["unrs-resolver"]` no `package.json`. Se ainda
  aparecer, rodar `pnpm rebuild unrs-resolver`.
- O `pnpm format` foi aplicado nos 4 `.md` de contexto na Sessão 01 (re-wrap em
  80 cols, alinhamento de tabelas). Mudança puramente cosmética, com OK
  explícito do Renan. Próximas edições já saem em 80-col wrap automaticamente
  via lint-staged.
- Em PowerShell 5.1, `git push` printa stderr como `NativeCommandError` mesmo
  quando o push é bem-sucedido. **Ignorar essas linhas** — o exit code do git é
  o que importa. Isso é gotcha do shell, não do projeto.

---

## Regras críticas

1. **Atualize sempre, mesmo em sessão curta.** Mesmo que tenha sido improdutiva,
   registre.
2. **Seja específico no "Próximo passo".** "Continuar onde paramos" é inútil.
   "Implementar `parseSprintPayload` em `packages/contracts/src/parse.ts` com
   testes em `parse.test.ts`" é útil.
3. **Use a seção "Observações" sem economia.** É o lugar onde você passa
   contexto implícito que economiza horas da próxima sessão.
4. **Se a sessão termina abruptamente** (interrupção, fim de tempo), pelo menos
   registre uma entrada mínima com data e o que foi feito até onde se lembra.
