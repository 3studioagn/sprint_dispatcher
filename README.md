# Sprint Dispatcher

[![CI](https://github.com/3studioagn/sprint_dispatcher/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/3studioagn/sprint_dispatcher/actions/workflows/ci.yml)

Sistema interno de comunicação ativa de metas de produção para a ARTFLEXÍVEIS.

Permite que líderes de setor disparem avisos visuais imediatos (overlay
fullscreen) nas estações de operadores selecionados, comunicando metas
individuais com prazos definidos. A comunicação acontece via pasta compartilhada
na rede interna — sem backend, sem servidor, sem dependência de internet.

## Componentes

- **Aplicação do Líder** (`apps/leader`) — interface para composição e disparo
  de sprints
- **Agente do Operador** (`apps/operator-agent`) — residente nas estações,
  renderiza overlays

## Stack

Monorepo TypeScript com pnpm + Turborepo, apps Electron (React + Zustand),
validação com Zod, testes com Vitest e Playwright. Detalhes completos em
[`CLAUDE.md`](./CLAUDE.md).

## Como rodar localmente

### Pré-requisitos

- **Node.js** ≥ 20.0.0 (recomendado: a versão fixada em `.nvmrc`). Use
  `nvm-windows`, `fnm` ou Volta para gerenciar.
- **pnpm** ≥ 10.0.0 — `corepack enable && corepack use pnpm@10` ou
  `npm install -g pnpm`.
- **Git** ≥ 2.40.

### Setup inicial

```bash
git clone https://github.com/3studioagn/sprint_dispatcher.git
cd sprint_dispatcher
pnpm install
```

Os Git hooks (Husky) são instalados automaticamente pelo script `prepare`. Se
algum dia não dispararem, rode `pnpm install` de novo.

### Comandos do dia a dia

| Comando             | O que faz                                       |
| ------------------- | ----------------------------------------------- |
| `pnpm lint`         | Roda ESLint em todos os workspaces              |
| `pnpm format`       | Aplica Prettier em tudo                         |
| `pnpm format:check` | Apenas verifica formatação (CI usa este)        |
| `pnpm type-check`   | `tsc --noEmit` em todos os packages             |
| `pnpm test`         | Roda suítes Vitest (a serem adicionadas em W1)  |
| `pnpm build`        | Build agregado via Turborepo                    |
| `pnpm dev`          | Watch mode dos apps (a partir de W1)            |
| `pnpm changeset`    | Cria um changeset descrevendo a próxima release |

### Convenção de commits

Conventional Commits com escopo de componente:

```
feat(C1): zod schemas para SprintPayload [BL-C1-002]
```

- **Tipos válidos:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
  `build`, `ci`, `perf`, `style`, `revert`.
- **Escopos válidos:** `C0` a `C8`, `repo`.
- **Header:** máximo 100 chars.

A regra é validada por `commitlint` no hook `commit-msg`.

### Branches

- `main` — produção (protegida)
- `develop` — integração da wave atual (protegida)
- `feature/BL-CX-NNN-<slug>` — features
- `hotfix/BL-CX-NNN-<slug>` — correções urgentes em produção

## Documentação

- [`CLAUDE.md`](./CLAUDE.md) — contexto técnico completo, arquitetura,
  convenções
- [`DECISIONS.md`](./DECISIONS.md) — Architecture Decision Records (ADRs)
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões
- [`SESSION_LOG.md`](./SESSION_LOG.md) — diário de sessões de desenvolvimento

Documentos de especificação completa (Requisitos, Stack, Backlog, Plan Claude
Code) ficam **fora do repositório**, com Renan.

## Status

🚧 Em desenvolvimento — Wave 0 (Foundation)

## Time

- **Desenvolvimento:** 3Studio
- **Stakeholder principal:** Renan
- **Cliente interno:** ARTFLEXÍVEIS
