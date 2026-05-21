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

### Changed

### Fixed

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
