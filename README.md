# Sprint Dispatcher

[![CI](https://github.com/3studioagn/sprint_dispatcher/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/3studioagn/sprint_dispatcher/actions/workflows/ci.yml)

Sistema desktop interno para disparo e acompanhamento de **metas de produção**
(sprints) na ARTFLEXÍVEIS.

## Visão geral

Quando um líder dispara uma meta, todos os operadores selecionados recebem, no
mesmo segundo, um aviso visual irrecusável (overlay fullscreen TOPMOST sobre
qualquer aplicação aberta) com título e descrição da meta. Cada operador dá
acknowledgement; o líder acompanha o status em tempo quase-real.

Arquitetura simples e robusta: dois apps desktop (Leader e Agent) que se
comunicam **via pasta compartilhada na rede local**. Sem backend, sem
mensageria, sem nuvem. As permissões NTFS já existentes na fábrica controlam
quem escreve onde; a TI já opera o canal há anos para artes e specs.

Casos de uso principais:

- Líder dispara meta para uma ou várias estações simultaneamente
- Operadores recebem overlay TOPMOST e dão ack
- Líder acompanha status em tempo quase-real (polling de 3 s)
- Cancelamento de sprint propaga para todos os agentes

Detalhes técnicos: ver [`CLAUDE.md`](./CLAUDE.md) e
[`DECISIONS.md`](./DECISIONS.md).

## Quick start

```bash
git clone https://github.com/3studioagn/sprint_dispatcher.git
cd sprint_dispatcher
pnpm install
```

Bateria completa de validação:

```bash
pnpm format:check && pnpm lint && pnpm type-check && pnpm test && pnpm build
```

Modo dev (Wave 0: scaffolds dos dois apps já rodam):

```bash
pnpm --filter sprint-leader run dev          # porta 5173
pnpm --filter sprint-operator-agent run dev  # porta 5174
```

**Pré-requisitos:**

- **Node.js** ≥ 20 (recomendado: a versão fixada em `.nvmrc` — 24.10.0)
- **pnpm** ≥ 10 — `corepack enable && corepack use pnpm@10`
- **Git** ≥ 2.40
- **Windows** com Developer Mode habilitado para empacotamento Electron local
  (G-008 em [`CLAUDE.md`](./CLAUDE.md))

## Estrutura do monorepo

```
sprint-dispatcher/
├── apps/                       # Aplicações desktop (Electron 42 + React 18)
│   ├── leader/                 # C2 — Leader Application
│   └── operator-agent/         # C3 — Operator Agent (residente em tray)
│
├── packages/                   # Libraries internas (workspace:*)
│   ├── contracts/              # C1 — schemas Zod + tipos compartilhados
│   └── fs-adapter/             # C4 — adapter de filesystem (port + 2 impls)
│   # logger/ chega em Wave 1 (C6)
│
├── .github/workflows/          # CI (ci.yml) + build Windows (build-leader.yml)
├── .changeset/                 # Versionamento dos packages internos
│
├── CLAUDE.md                   # Guia de desenvolvimento (lei do projeto)
├── DECISIONS.md                # ADRs (Architecture Decision Records)
├── CHANGELOG.md                # Histórico de mudanças (Keep a Changelog)
├── SESSION_LOG.md              # Diário de sessões de desenvolvimento
├── README.md                   # ← este arquivo
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

Documentos de especificação completa (Requisitos, Stack, Backlog) ficam **fora
do repositório**, gerenciados externamente por Renan.

## Componentes

| ID  | Nome                                       | Tipo          | Status W0                     |
| --- | ------------------------------------------ | ------------- | ----------------------------- |
| C0  | Foundation & Infrastructure                | Infra         | ✅ Wave 0                     |
| C1  | Shared Contracts (`@sprint/contracts`)     | Library       | ✅ Wave 0                     |
| C2  | Leader Application                         | Desktop App   | ✅ Composer W1 (sem dispatch) |
| C3  | Operator Agent                             | Desktop App   | ✅ Scaffold + config          |
| C4  | Filesystem Adapter (`@sprint/fs-adapter`)  | Library       | ✅ Wave 0                     |
| C5  | Installer & Deployment                     | Package       | ✅ Config validada            |
| C6  | Observability & Logging (`@sprint/logger`) | Library       | ⏸️ Wave 1                     |
| C7  | Documentation                              | Docs          | 🔄 Em fechamento da Wave 0    |
| C8  | Quality Assurance                          | Cross-cutting | 🔄 Em fechamento da Wave 0    |

Detalhes operacionais de cada componente: ver os `README.md` em
[`apps/leader`](./apps/leader/README.md),
[`apps/operator-agent`](./apps/operator-agent/README.md),
[`packages/contracts`](./packages/contracts/README.md) e
[`packages/fs-adapter`](./packages/fs-adapter/README.md).

## Comandos comuns

| Comando                                         | O que faz                                            |
| ----------------------------------------------- | ---------------------------------------------------- |
| `pnpm install`                                  | Instala dependências de todos os workspaces          |
| `pnpm format`                                   | Aplica Prettier em tudo                              |
| `pnpm format:check`                             | Apenas verifica formatação (CI usa este)             |
| `pnpm lint`                                     | ESLint via Turborepo (inclui regras customizadas)    |
| `pnpm type-check`                               | `tsc --noEmit` em todos os workspaces                |
| `pnpm test`                                     | Vitest em todos os packages (via Turborepo)          |
| `pnpm test:coverage`                            | Idem, com cobertura agregada por package             |
| `pnpm build`                                    | Build de produção (via Turborepo)                    |
| `pnpm changeset`                                | Cria um changeset descrevendo a próxima release      |
| `pnpm --filter sprint-leader run dev`           | Leader em modo dev (hot reload)                      |
| `pnpm --filter sprint-operator-agent run dev`   | Agent em modo dev                                    |
| `pnpm --filter sprint-leader run make:portable` | Empacota Leader como portable `.exe` (Windows local) |
| `pnpm --filter sprint-operator-agent run make`  | Empacota Agent (NSIS + portable, Windows local)      |

## Padrões obrigatórios

Toda contribuição deve seguir os padrões definidos em
[`CLAUDE.md`](./CLAUDE.md). Os não-negociáveis:

- **Conventional Commits** com scope de componente: `feat(C2): ... [BL-C2-001]`
- **Branches por BL:** `feature/BL-CX-NNN-descricao`, `fix/BL-CX-NNN-descricao`,
  `docs/BL-CX-NNN-...`
- **Atomicidade:** um BL por commit (squash em PR)
- **PR review obrigatório** — sem self-merge em `develop`/`main`
- **CI verde obrigatório** antes de merge
- **TypeScript `strict: true`**, zero `any`, zero `@ts-ignore`, zero
  `console.log`
- **ESLint flat config com 2 regras customizadas:** separação Leader↔Agent (sem
  cross-import), alias `@sprint/*` obrigatório (sem path relativo cross-package)
- **Zod schemas via `z.infer<>`** (ADR-005)
- **Escrita atômica** via `writeFileAtomic` do `@sprint/fs-adapter` (ADR-013)
- **Electron security baseline** (CLAUDE.md §8.1): `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true` em **toda** `BrowserWindow`
- **IPC contract-first** com `contextBridge` (ADR-009)

## Documentação interna

| Arquivo                              | Propósito                                              |
| ------------------------------------ | ------------------------------------------------------ |
| [`CLAUDE.md`](./CLAUDE.md)           | Guia de desenvolvimento — padrões, gotchas, convenções |
| [`DECISIONS.md`](./DECISIONS.md)     | ADRs (Architecture Decision Records) numerados         |
| [`CHANGELOG.md`](./CHANGELOG.md)     | Histórico de mudanças (Keep a Changelog)               |
| [`SESSION_LOG.md`](./SESSION_LOG.md) | Diário de sessões de desenvolvimento                   |

## Status do projeto

**Wave atual:** W0 (fechamento em andamento — aguardando auditoria)

| Wave | Foco                                            | Status        |
| ---- | ----------------------------------------------- | ------------- |
| W0   | Foundation, contracts, scaffolds dos apps       | 🔄 Fechamento |
| W1   | MVP Core (fluxo ponta-a-ponta dispatch → ack)   | ⏸️ Próxima    |
| W2   | Refinement (ack tracking, cancelamento, polish) | ⏸️            |
| W3   | Production readiness (installer, logs, E2E)     | ⏸️            |
| W4   | Hardening (watchdog, perf, futuro-proof)        | ⏸️            |

Histórico de sessões: [`SESSION_LOG.md`](./SESSION_LOG.md).

## Para devs novos

Onboarding em ≤ 10 minutos:

1. Clone o repo, rode `pnpm install`
2. Leia [`CLAUDE.md`](./CLAUDE.md) integralmente (lei do projeto)
3. Folheie [`DECISIONS.md`](./DECISIONS.md) (entenda o **por quê** das escolhas)
4. Olhe a entrada mais recente de [`SESSION_LOG.md`](./SESSION_LOG.md) (estado
   atual)
5. Rode `pnpm test` — deve estar verde
6. Pegue um BL do backlog (gerenciado por Renan), crie branch, abra PR

## Para TI da ARTFLEXÍVEIS

Documentação de instalação e operação ainda em desenvolvimento (Wave 3). Por
enquanto:

- Apps são desktop Windows (Electron 42+)
- Comunicação via pasta compartilhada SMB/CIFS
- Sem backend, sem nuvem, sem auto-update no MVP
- Permissões NTFS controlam quem escreve em `pending/` (líderes) e em `acks/`
  (operadores)

## Licença e propriedade

Software interno da ARTFLEXÍVEIS, desenvolvido por 3Studio. Não distribuído
publicamente.

---

- **Desenvolvimento:** 3Studio
- **Stakeholder principal:** Renan
- **Cliente interno:** ARTFLEXÍVEIS
