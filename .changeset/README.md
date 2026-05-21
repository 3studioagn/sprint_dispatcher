# Changesets

Esta pasta é gerenciada pelo
[`@changesets/cli`](https://github.com/changesets/changesets). Cada arquivo
`.md` aqui dentro representa uma mudança que entrará em uma futura release dos
packages internos do monorepo.

## Como criar um changeset

```bash
pnpm changeset
```

O CLI vai te perguntar quais packages mudaram e qual tipo de bump (`patch` /
`minor` / `major`). O arquivo gerado entra no commit junto com a mudança de
código.

## Como publicar uma release

```bash
pnpm version-packages   # consome todos os changesets pendentes e bumpa as versions
pnpm release            # build + publish (publish só roda em CI com NPM_TOKEN)
```

## Configuração desta pasta — decisões e pendências

### Decisões já tomadas (ver `config.json`)

- **`baseBranch: "develop"`** — releases sempre comparam com `develop`, não com
  `main`. Reflete o fluxo do projeto.
- **`access: "restricted"`** — impede publicação acidental em registry público.
  Os packages internos são privados.
- **`updateInternalDependencies: "patch"`** — quando um package interno bump, os
  que dependem dele recebem um patch bump automático.

### Pendências para sessões futuras

Os campos `linked` e `ignore` estão **vazios neste momento** porque o Changesets
se recusa a validar packages que ainda não existem no monorepo (W0 fechou apenas
o C0 — packages C1, C4, C6 e apps C2, C3 ainda virão).

Quando os packages forem criados, atualize esta config:

```jsonc
"linked": [["@sprint/contracts", "@sprint/fs-adapter", "@sprint/logger"]],
"ignore": ["sprint-leader", "sprint-operator-agent"]
```

- **`linked`** agrupa os 3 packages internos para que bumpem juntos. Evita drift
  de compatibilidade entre `@sprint/contracts`, `@sprint/fs-adapter` e
  `@sprint/logger` — todos sobem `0.2.0 → 0.3.0` em conjunto, mesmo se só um
  mudou.
- **`ignore`** exclui os apps Electron (`sprint-leader`,
  `sprint-operator-agent`) do versionamento via Changesets. Eles versionam pelo
  `electron-builder` no artefato final (`SprintLeader-Setup-X.Y.Z.exe`), não via
  npm SemVer.

**Itens do backlog que devem atualizar este arquivo:** BL-C1-001 (cria
`@sprint/contracts`), BL-C4-001 (cria `@sprint/fs-adapter`), BL-C6-001 (cria
`@sprint/logger`), BL-C2-001 (cria `sprint-leader`), BL-C3-001 (cria
`sprint-operator-agent`).

## Referências

- [Common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)
- [Schema da config](https://unpkg.com/@changesets/config@3.1.4/schema.json)
