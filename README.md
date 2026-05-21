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

> ⚠️ A ser preenchido durante a Wave 0 (bootstrap do projeto).

```bash
pnpm install
pnpm turbo dev
```

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
