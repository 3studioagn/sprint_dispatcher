# Relatório de Auditoria — Componente C0 (Foundation & Infrastructure) · Wave 0

| Campo               | Valor                                   |
| ------------------- | --------------------------------------- |
| Versão do relatório | v1                                      |
| Data                | 2026-05-21                              |
| Auditor             | Claude Code (sessão independente)       |
| Sessão auditada     | Sessão 01 (`SESSION_LOG.md`)            |
| Commits avaliados   | `a96a10d` (seed) → `c1873db` (HEAD)     |
| Itens BL auditados  | BL-C0-001..007                          |
| Branch              | `develop`                               |
| Working tree        | limpa antes, durante e após a auditoria |

---

## 1. Sumário Executivo

O componente C0 (Foundation & Infrastructure) foi entregue em padrão de produção
sênior. A estrutura do monorepo está intacta (todos arquivos raiz obrigatórios
presentes, pastas vazias com `.gitkeep`, sem violação de escopo em `apps/`,
`packages/`, `installer/`); todos os 5 scripts agregados (`format:check`,
`lint`, `type-check`, `test`, `build`) passam com exit 0; o `tsconfig.base.json`
carrega as 14 flags estritas do CLAUDE.md §8.4 sem omissões; `turbo.json` usa a
chave moderna `tasks` (G-001 honrado) e não emite warnings de deprecação; os
hooks Git disparam (mensagem de commit inválida é rejeitada pelo commitlint,
válida passa); o CI YAML é sintaticamente válido, autocontido em
`actions/*-setup@v4`, com cache de pnpm-store + cache de Turbo e timeout
declarado; `pnpm audit` reporta zero vulnerabilidades; uma simulação de clone
limpo em `/tmp` executou todo o pipeline (install → format:check → lint →
type-check → test → build) sem nenhum erro. Documentação coerente: SESSION_LOG e
CHANGELOG batem 1-para-1 com os commits reais e com as decisões nos ADRs.

Os dois débitos médios são **conhecidos e documentados** (divergência aceita de
versões maiores; `linked`/`ignore` vazios do Changesets como gotcha G-003), sem
nenhum bloqueador para a Wave 1.

### Veredito final

🟡 **APROVADO COM RESSALVAS**

Critério aplicado: 0 Critical, 0 High, 2 Medium, 3 Low, 5 Info — dentro do
limite "≤ 3 Medium" do §6 do prompt de auditoria. Adotada a interpretação
restritiva: "APROVADO COM RESSALVAS" sinaliza que há débitos Medium documentados
que precisam de ratificação formal antes de fechar a Wave 0, mesmo não
bloqueando o início da Wave 1.

> **Nota meta sobre o critério.** O texto do §6 do prompt define "APROVADO COM
> RESSALVAS" como "livre de Medium/Low", o que é logicamente mais restritivo que
> "APROVADO" e parece erro de redação. Aplicamos a interpretação mais coerente:
> APROVADO = 0 débitos, APROVADO COM RESSALVAS = débitos Medium/Low documentados
> e endereçáveis, REPROVADO = ≥1 Critical ou ≥3 High. Renan decide se aceita
> esta interpretação.

### Recomendação operacional

- [x] **Liberar avanço para Wave 1** (próximo: prompt para C1) com as ressalvas
      Medium endereçadas em paralelo:
  - FINDING-M1: ratificar formalmente as versões instaladas em DECISIONS.md
    (novo ADR-005 sugerido) ou atualizar Stack v1.0 → v1.1 externamente.
  - FINDING-M2: re-popular `linked`/`ignore` em `.changeset/config.json` no
    primeiro commit que crie `@sprint/contracts` (BL-C1-001).
- [ ] Liberar avanço com sessão de remediação prévia das ressalvas Medium/Low.
      Não recomendado — débitos são leves e endereçáveis no fluxo normal de C1.
- [ ] Não liberar. Sessão de remediação obrigatória antes da Wave 1. Não
      aplicável — sem achados Critical/High.

---

## 2. Resumo por Dimensão

| Dimensão               | Veredito  | Críticas | Altas | Médias | Baixas | Info  |
| ---------------------- | --------- | -------- | ----- | ------ | ------ | ----- |
| D1 — Estrutural        | ✅ Pass   | 0        | 0     | 0      | 0      | 0     |
| D2 — Conteúdo          | ⚠️ Pass\* | 0        | 0     | 2      | 0      | 1     |
| D3 — Funcional         | ✅ Pass   | 0        | 0     | 0      | 1      | 1     |
| D4 — Documental        | ✅ Pass   | 0        | 0     | 0      | 1      | 0     |
| D5 — Segurança/Padrões | ✅ Pass   | 0        | 0     | 0      | 0      | 2     |
| D6 — Reprodutibilidade | ✅ Pass   | 0        | 0     | 0      | 1      | 1     |
| **Total**              |           | **0**    | **0** | **2**  | **3**  | **5** |

\* ⚠️ Pass with reservations em D2 pela presença das 2 Medium (ambas
documentadas como débito conhecido em CLAUDE.md §12 e SESSION_LOG).

---

## 3. Achados detalhados

Ordenação: severidade decrescente, depois dimensão (D1→D6).

### FINDING-001 · 🟡 Medium · D2 — Divergência de versões major do plano original

**Descrição:** O ambiente real opera em versões maiores que as definidas no
documento de Stack v1.0 original. Aceito explicitamente por Renan na Sessão 01 e
refletido em CLAUDE.md §3, mas o documento externo de Stack ainda não foi
atualizado e o desvio carece de ratificação formal em DECISIONS.md.

**Evidência:**

```
$ node --version
v24.10.0
$ pnpm --version
10.18.2
$ node -e "console.log(require('./package.json').packageManager)"
pnpm@10.18.2
$ cat .nvmrc
24.10.0
```

`package.json` (linhas 6-10, 42-53):

```
"packageManager": "pnpm@10.18.2",
"engines": { "node": ">=20.0.0", "pnpm": ">=10.0.0" },
"@eslint/js": "^10.0.1",
"eslint": "^10.4.0",
"lint-staged": "^17.0.5",
"prettier": "^3.8.3",
"turbo": "^2.9.14",
"typescript": "^6.0.3",
"typescript-eslint": "^8.59.4",
"@commitlint/cli": "^21.0.1"
```

Comparativo Plano (Stack v1.0) × Real:

| Tecnologia  | Plano original | Instalado | Status            |
| ----------- | -------------- | --------- | ----------------- |
| Node.js     | 20 LTS         | 24.10.0   | major bump        |
| pnpm        | 9.x            | 10.18.2   | major bump        |
| TypeScript  | 5.4+           | 6.0.3     | major bump        |
| ESLint      | 9.x (flat)     | 10.4.0    | major bump        |
| @eslint/js  | 9.x            | 10.0.1    | major bump        |
| lint-staged | 15.x           | 17.0.5    | duas majors acima |
| commitlint  | 19.x           | 21.0.1    | duas majors acima |
| Husky       | 9.x            | 9.1.7     | alinhado          |
| Prettier    | 3.x            | 3.8.3     | alinhado          |
| Turborepo   | 2.x            | 2.9.14    | alinhado          |
| Changesets  | 2.27+          | 2.31.0    | alinhado          |

**Impacto:** Funcional zero — CI verde, clone limpo passa, todos os scripts
agregados em exit 0, `pnpm audit` sem CVEs. Risco real é **documental e
contratual**: sessões/auditorias futuras que consultarem Stack v1.0 podem
reportar falsos positivos ("ESLint deveria ser 9.x"). Adicionalmente, o salto de
duas majors em `lint-staged` (15→17) e `commitlint` (19→21) merece registro
explícito de "validado, sem regressão" porque normalmente esse tipo de bump
exige migração de config.

**Recomendação:** Uma das duas (não ambas):

1. Criar **ADR-005** em `DECISIONS.md` — "Adoção do baseline de versões
   instalado em Sessão 01" — formalizando o desvio como decisão arquitetural
   ratificada, com nota de re-avaliação se algum bug específico de versão
   surgir.
2. Atualizar externamente Stack v1.0 → v1.1 com as versões reais e referenciar o
   documento atualizado em CLAUDE.md §3.

A opção 1 mantém o repo como fonte de verdade; opção 2 mantém o documento
externo como cânone. Renan decide qual prefere.

**Item BL relacionado:** transversal (afeta BL-C0-001..007).

---

### FINDING-002 · 🟡 Medium · D2 — `.changeset/config.json` com `linked` e `ignore` vazios

**Descrição:** A configuração final esperada do Changesets (`linked` agrupando
os 3 packages internos, `ignore` excluindo os 2 apps Electron) **não está
aplicada** porque o próprio Changesets rejeita validação de packages que ainda
não existem no monorepo (gotcha G-003). O débito está documentado em três
lugares — CLAUDE.md §12 G-003, `.changeset/README.md` "Pendências para sessões
futuras", e em SESSION_LOG.md "Próximo passo" — com plano de remediação
concreto.

**Evidência:** `.changeset/config.json` (linhas 5-10):

```
"commit": false,
"fixed": [],
"linked": [],
"access": "restricted",
"baseBranch": "develop",
"updateInternalDependencies": "patch",
"ignore": []
```

Config alvo (declarada em `.changeset/README.md` linhas 44-46):

```
"linked": [["@sprint/contracts", "@sprint/fs-adapter", "@sprint/logger"]],
"ignore": ["sprint-leader", "sprint-operator-agent"]
```

`pnpm changeset status` retorna exit 0 com "NO packages to be bumped" em todos
os níveis (patch/minor/major), evidenciando que o tooling opera em modo "no-op
benigno" — não há proteção real contra um bump acidental cruzando os 3 packages
sem `linked`.

**Impacto:** Enquanto não houver packages no monorepo, débito é inerte. No
momento em que BL-C1-001 (cria `@sprint/contracts`) entrar, será
**trivialmente** possível gerar um changeset que afete só 1 dos 3 packages —
quebrando a invariante de versionamento conjunto que ADR-001 estabelece. O risco
é janelar: existe entre o primeiro commit de C1 e o commit que re-popula a
config.

**Recomendação:** Aceitar como débito de janela curta. No primeiro commit de C1
que crie `packages/contracts/package.json` com `name: "@sprint/contracts"`,
atualizar `.changeset/config.json` no mesmo commit (não em commit separado) para
re-popular `linked` e `ignore` conforme a config alvo em `.changeset/README.md`.
Validar com `pnpm changeset status` (sem ValidationError).

Marcar como guard rail no prompt da próxima sessão (C1).

**Item BL relacionado:** BL-C0-006 (concluído com débito marcado ⚠️ em
SESSION_LOG.md linha 121), remediação em BL-C1-001.

---

### FINDING-003 · 🟢 Low · D3 — Turbo retorna exit 0 com "0 packages" em scripts agregados

**Descrição:** Com workspaces vazios (esperado em W0), `pnpm lint`,
`pnpm type-check`, `pnpm test` e `pnpm build` emitem o warning "No tasks were
executed as part of this run" e retornam **exit 0**. Comportamento documentado
em SESSION_LOG observações, mas representa fragilidade futura: se algum erro de
configuração em `pnpm-workspace.yaml` ou nos `package.json` dos packages quebrar
a descoberta de workspaces, o CI passa verde silenciosamente.

**Evidência:**

```
$ pnpm lint
> turbo lint
• turbo 2.9.14
   • Packages in scope:
   • Running lint in 0 packages
 WARNING  No tasks were executed as part of this run.
 Tasks:    0 successful, 0 total
exit=0
```

(Comportamento idêntico em `pnpm type-check`, `pnpm test`, `pnpm build`.)

**Impacto:** Hoje, nenhum — em W0 isso é a única saída possível, e o SESSION_LOG
já alerta sobre isso. Pós-W1, quando packages existirem, "0 packages" passa a
ser sintoma de bug — e nesse momento o CI deveria falhar, não passar verde.

**Recomendação:** Pós-W1 (não em C0): adicionar guard no CI, por exemplo:

```yaml
- name: Verify packages discovered
  run: |
    COUNT=$(pnpm list -r --depth=-1 --parseable | wc -l)
    [ "$COUNT" -ge 2 ] || { echo "Expected ≥2 workspaces, got $COUNT"; exit 1; }
```

Não é ação para C0. Anotar para futura sessão de hardening de CI.

**Item BL relacionado:** transversal (não bloqueia BL-C0-005).

---

### FINDING-004 · 🟢 Low · D4 — Discrepância entre nome do repo GitHub e do package npm

**Descrição:** Repositório GitHub: `sprint_dispatcher` (underscore). Nome do
package em `package.json`: `sprint-dispatcher` (hífen). `README.md` linha 38-39
instrui `git clone .../sprint_dispatcher.git` seguido de `cd sprint_dispatcher`
— coerente com o nome do repo no GitHub, mas inconsistente com o nome do
package.

**Evidência:**

```
$ node -e "console.log(require('./package.json').name)"
sprint-dispatcher

$ grep -n "sprint_dispatcher\|sprint-dispatcher" README.md
3: badge GitHub Actions aponta para 3studioagn/sprint_dispatcher
38: git clone https://github.com/3studioagn/sprint_dispatcher.git
39: cd sprint_dispatcher
```

**Impacto:** Cosmético/cognitivo. Ninguém quebra nada; eventualmente confunde
quem busca o package por nome ou tenta deduzir o nome do repo a partir do
`package.json`.

**Recomendação:** Decidir um padrão e aplicar no outro lado. Se manter
`sprint-dispatcher` no `package.json`, considerar renomear o repo GitHub para
`sprint-dispatcher` (`gh repo rename`). Se manter o underscore no GitHub,
ajustar `package.json` para `sprint_dispatcher`. Recomendação fraca pelo hífen —
alinhamento com padrões npm e dos packages internos (`@sprint/...`).

Sem ação obrigatória.

**Item BL relacionado:** N/A (cosmético).

---

### FINDING-005 · 🟢 Low · D6 — CI executa apenas em `ubuntu-latest`

**Descrição:** O `ci.yml` define `runs-on: ubuntu-latest` sem matrix de OS,
apesar de o projeto-alvo ser Windows (apps Electron para estações ARTFLEXÍVEIS
rodando Windows 11).

**Evidência:** `.github/workflows/ci.yml` linha 19:

```
runs-on: ubuntu-latest
```

**Impacto:** Em W0, irrelevante (workspaces vazios, nada platform-specific). A
partir de C2/C3 (apps Electron) e C4 (`fs-adapter` para SMB), bugs Windows-only
— line endings, separadores de path, file locking, NTFS — só serão pegos por
testes locais em estações Windows ou no momento do release manual.

**Recomendação:** Não é ação para C0. Marcar para Wave 3 / BL-C0-008 / BL-C0-009
(code signing e release pipeline) — esses items vão exigir matriz com
`windows-latest`. Em W1/W2, manter o CI Linux-only é razoável porque mantém o
ciclo dev → push → green rápido.

**Item BL relacionado:** N/A em C0; relevante para BL-C0-008 / BL-C0-009 (W3).

---

### FINDING-006 · ⚪ Info · D2 — `no-console` permite `warn` e `error`

**Descrição:** A regra ESLint configurada em `eslint.config.mjs` permite
`console.warn` e `console.error`:

```
'no-console': ['error', { allow: ['warn', 'error'] }]
```

CLAUDE.md §7.5 diz "Sempre via @sprint/logger. Nunca console.log — ESLint rule
bloqueia." A redação fala em `console.log` especificamente, mas o espírito do
padrão sênior é bloquear todos os canais de `console.*` para forçar logging
estruturado pelo Pino.

**Evidência:** `eslint.config.mjs` linha 40:

```
'no-console': ['error', { allow: ['warn', 'error'] }],
```

CLAUDE.md §7.5:

```
Sempre via @sprint/logger. Nunca console.log — ESLint rule bloqueia.
```

**Impacto:** Hoje, nenhum — `@sprint/logger` ainda não existe (C6). Quando
entrar, devs podem escapar do logger usando `console.warn`/`console.error` sem o
ESLint acender.

**Recomendação:** Observação. Decidir se a regra deve ser `'error'` (sem
`allow`) quando C6 entrar. Não bloquear C0 por isso.

**Item BL relacionado:** BL-C6-001 (futuro).

---

### FINDING-007 · ⚪ Info · D3 — Husky 9 instalado com padrão moderno (trampolim)

**Descrição:** Husky 9 está corretamente configurado via trampolim em
`.husky/_/` (auto- gerado pelo script `prepare`, gitignored). Os hooks de
usuário em `.husky/pre-commit` e `.husky/commit-msg` são one-liners sem shebang
antigo (`#!/usr/bin/env sh` + `. "$(dirname "$0")/_/husky.sh"`) e sem chmod +x —
o que **é o padrão correto** em Husky 9. As permissões POSIX nos hooks de
usuário (`100644` no Git, `rw-r--r--` em disco) não impactam execução, porque o
git invoca os arquivos em `.husky/_/` (com chmod 755 e shebang) que por sua vez
invocam os hooks de usuário via `sh -e`.

**Evidência:**

```
$ git config core.hooksPath
.husky/_

$ ls -la .husky/_/pre-commit .husky/_/commit-msg
-rwxr-xr-x .husky/_/commit-msg
-rwxr-xr-x .husky/_/pre-commit

$ cat .husky/_/h
...
sh -e "$s" "$@"
```

`.husky/pre-commit` e `.husky/commit-msg` são chamados por `.husky/_/h` via
`sh -e`, então chmod é dispensável.

**Impacto:** Positivo. Padrão moderno, sem dívida de migração v8→v9, hooks
funcionando em Windows, Linux e Mac.

**Recomendação:** Nenhuma. Manter como está. Apenas anotação positiva.

**Item BL relacionado:** BL-C0-004 (entregue com excelência).

---

### FINDING-008 · ⚪ Info · D5 — Padrões ESLint configurados mas não validados funcionalmente

**Descrição:** As regras restritivas pedidas (`no-console`,
`@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-floating-promises`,
`consistent-type-imports`, `import-x/order`) estão **configuradas corretamente**
em `eslint.config.mjs` (validado em D2.6) mas não puderam ser **validadas
funcionalmente** com arquivos trapdoor em D5.3 porque o `tsconfig.json` raiz tem
`include: []` (intencional — sem packages ainda) e o `projectService: true` do
typescript-eslint rejeita arquivos fora de TS project com parsing error.

**Evidência:**

```
$ echo 'console.log("trap");' > tmp-audit-trap-console.ts
$ pnpm exec eslint tmp-audit-trap-console.ts
0:0  error  Parsing error: ...tmp-audit-trap-console.ts was not found by the
  project service. Consider either including it in the tsconfig.json or
  including it in allowDefaultProject
```

A regra `no-console` configurada **não foi acionada** porque o ESLint nem chegou
a parsear o arquivo. Comportamento defensivo: ESLint não silencia problemas, ele
falha. Mas a validação funcional fica pendente.

**Impacto:** Cobertura parcial nesta auditoria. As regras vão ser exercidas
**necessariamente** quando o primeiro package (`@sprint/contracts`) entrar com
arquivos `.ts` reais. Re-validar nessa janela.

**Recomendação:** Re-auditar D5.3 funcionalmente em sessão pós-C1 (quando
primeiro arquivo `.ts` de package existir). Não é débito do C0.

**Item BL relacionado:** BL-C8-001 (futuro — auditoria de qualidade pós-MVP).

---

### FINDING-009 · ⚪ Info · D5 — Cache do Turbo configurado de forma exemplar no CI

**Descrição:** O workflow `.github/workflows/ci.yml` configura **dois caches
independentes** — pnpm store e `.turbo/` — ambos com `restore-keys` parciais
para hit rate elevado em PRs subsequentes.

**Evidência:** `.github/workflows/ci.yml` linhas 44-58:

```yaml
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-

- name: Cache Turbo
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

**Impacto:** Positivo. Build incremental em PR ganhará minutos quando packages e
apps existirem; pnpm install em hit de cache cai para segundos.

**Recomendação:** Nenhuma. Manter como está. Anotação positiva.

**Item BL relacionado:** BL-C0-005 (entregue com excelência).

---

### FINDING-010 · ⚪ Info · D6 — Simulação de clone limpo passou integralmente

**Descrição:** Clone do repo em `/tmp` seguido de
`pnpm install --frozen-lockfile` + pipeline completo executou sem nenhum erro.
Validação forte de reprodutibilidade.

**Evidência:**

```
$ cd $(mktemp -d) && git clone "C:/Users/mario.souza/sprint-dispatcher" sprint-dispatcher-clone
$ cd sprint-dispatcher-clone
$ pnpm install --frozen-lockfile  # exit=0
$ pnpm format:check               # exit=0
$ pnpm lint                       # exit=0
$ pnpm type-check                 # exit=0
$ pnpm test                       # exit=0
$ pnpm build                      # exit=0
```

**Impacto:** Positivo. Confirma que o lockfile é fiel e o setup não depende de
estado local (cache, env vars, paths fora do repo).

**Recomendação:** Nenhuma.

**Item BL relacionado:** BL-C0-001..007 (todos consistentes).

---

## 4. Cobertura da auditoria

### Auditado

- **D1.1** — 20 arquivos raiz obrigatórios (todos presentes)
- **D1.2** — Estrutura de diretórios `apps/`, `packages/`, `installer/`,
  `docs/`, `tests/e2e/`, `.github/workflows/`, `.changeset/`, `.husky/`,
  `.vscode/` (todas corretas, sem violação de escopo)
- **D1.3** — Permissões dos hooks (confirmado: padrão Husky 9 dispensa chmod nos
  hooks de usuário porque o trampolim em `.husky/_/` executa via `sh -e`)
- **D1.4** — `.gitkeep` presente em todas as pastas que dele dependem
- **D1.5** — Working tree limpa
- **D2.1 a D2.19** — Conteúdo de todos os arquivos de config (package.json,
  pnpm-workspace.yaml, tsconfig.base.json, tsconfig.json, turbo.json,
  eslint.config.mjs, prettier.config.cjs, .prettierignore,
  commitlint.config.cjs, .husky/pre-commit, .husky/commit-msg,
  .changeset/config.json, .github/workflows/ci.yml, .gitignore, README.md,
  DECISIONS.md, CHANGELOG.md, SESSION_LOG.md, CLAUDE.md)
- **D3.1** — `pnpm install --frozen-lockfile` (exit 0)
- **D3.2** — Os 5 scripts agregados (todos exit 0)
- **D3.3** — `pnpm turbo build --dry=json`, `pnpm turbo lint --dry=json`,
  `pnpm turbo run build` (sem warnings de deprecation, sem menção a `pipeline`)
- **D3.4** — Hooks Git via dois commits dummy (`--allow-empty` com mensagem
  inválida BLOQUEADA, mensagem válida ACEITA; reset --soft pra desfazer commit
  válido de teste)
- **D3.5** — `pnpm changeset --empty` e `pnpm changeset status` (status OK,
  `--empty` falha por não haver packages — comportamento esperado em W0)
- **D3.6** — Validação YAML do workflow (`yaml.safe_load` exit 0)
- **D4.1 a D4.5** — Cross-check entre ADRs, README, CHANGELOG, SESSION_LOG,
  commits reais; gotchas G-001..003 referenciados em múltiplos lugares
- **D5.1** — Busca por padrões de secret (`secret|api[_-]?key|password|token`
  com `[:=]`) em `*.{json,yml,yaml,ts,js,mjs,cjs,md}` (zero matches)
- **D5.1** — Busca por IPs internos e hostnames
  (`servidor|192.168|10.0.| artflexiveis.local`) — apenas matches documentais
  esperados em CLAUDE.md / DECISIONS.md
- **D5.2** — `.gitignore` cobre `.env`, `.env.*` (com `!.env.example`)
- **D5.3** — ESLint regras configuradas (validação por leitura; trapdoor
  funcional bloqueada por `include: []`)
- **D5.4** — `pnpm audit --audit-level=high` (zero vulnerabilidades)
- **D6.1** — `pnpm-lock.yaml` versionado
- **D6.2** — Versões pinadas em `packageManager` e `.nvmrc`
- **D6.3** — Clone limpo em pasta temporária + pipeline completo (exit 0 em
  todos os passos)
- **D6.4** — Leitura do `ci.yml`: não depende de secrets ainda não configurados,
  não referencia arquivos inexistentes, actions todas em v4

### Não auditado (e razão)

- **Execução real do workflow no GitHub Actions** — auditor não pode push.
  SESSION_LOG afirma "Primeiro run rodou verde (confirmado pelo Renan)" — aceita
  como evidência indireta.
- **Comportamento do code signing** — pertence a BL-C0-008 (Wave 3), fora de
  escopo.
- **Performance de cache do Turbo em segundo build** — sem packages para
  cachear; revisitar quando primeiro package existir.
- **Conteúdo de packages e apps** — vazios por design no C0 (cada pasta contém
  apenas `.gitkeep`).
- **Validação funcional das regras ESLint via trapdoor** — bloqueada pela
  `projectService: true` exigindo arquivo em TS project. Re-validar em pós-C1.
- **Comparação texto-a-texto com Stack v1.0 / Requisitos v1.1 / Backlog v1.0** —
  os docx externos foram explicitamente excluídos da auditoria por Renan;
  validação dos ADRs feita por consistência interna e referência declarada (sem
  cross-check com o documento-fonte).

---

## 5. Observações fora de escopo

Não são achados de C0, mas valem ser anotados para Renan decidir.

- **W0 → W1 — gate operacional.** O C0 fechou, mas a Wave 0 não. Para fechar W0
  (gate W0→W1 em CLAUDE.md §6), faltam scaffolds vazios de C1, C4, C6 (packages)
  e C2, C3 (apps). Hoje, abrir prompt para C1 é o caminho mais natural —
  `@sprint/contracts` é a única dependência de praticamente tudo do MVP.

- **Stack doc externa pede atualização.** Várias decisões corretas tomadas na
  Sessão 01 divergem do Stack v1.0 — `tasks` em vez de `pipeline` no Turbo
  (G-001), versões de tooling (FINDING-001), e outras. Renan já foi alertado em
  SESSION_LOG observações. Considerar produzir Stack v1.1 externamente em bloco
  único depois do C0 (e referenciar de CLAUDE.md).

- **Renomeação de hooks pode acontecer em qualquer hora.** Caso o repo GitHub
  seja renomeado de `sprint_dispatcher` para `sprint-dispatcher` (FINDING-004),
  só lembrar de atualizar o badge do CI no README.md linha 3.

- **CI Windows como guard rail futuro.** Em sessão pós-C2/C3, considerar matrix
  `[ubuntu-latest, windows-latest]` somente para os apps Electron (não para
  packages puros), porque é onde o risco real está.

- **`@sprint/logger` ainda não existe (C6) mas CLAUDE.md §7.5 já fala dele como
  se existisse.** Aceitável — é forward-reference para padrão. Apenas alertar
  próxima sessão para criar logger antes de ESLint começar a apontar imports
  faltantes.

---

## 6. Comandos executados (apêndice)

```
$ git status                                                              # clean
$ git log --oneline -30 --all                                             # 8 commits
$ git branch -a                                                           # develop, main, origin/*
$ node --version                                                          # v24.10.0
$ pnpm --version                                                          # 10.18.2
$ ls -la                                                                  # OK
$ ls -la .github/ .github/workflows/ .changeset/ .husky/ .vscode/         # OK
$ ls -la apps packages installer docs tests tests/e2e                     # só .gitkeep
$ find . -maxdepth 3 -type f -name "*.json" -o ...                        # config inventory
$ for f in [20 arquivos raiz]; do test -f $f; done                        # todos OK
$ ls -la .husky/_/                                                        # trampolim 9.x
$ git config core.hooksPath                                               # .husky/_
$ git status --porcelain                                                  # vazio
$ pnpm install --frozen-lockfile                                          # exit 0
$ pnpm format:check                                                       # exit 0
$ pnpm lint                                                               # exit 0 (0 packages)
$ pnpm type-check                                                         # exit 0 (0 packages)
$ pnpm test                                                               # exit 0 (0 packages)
$ pnpm build                                                              # exit 0 (0 packages)
$ pnpm turbo build --dry=json                                             # exit 0, sem warnings
$ pnpm turbo lint --dry=json                                              # exit 0, sem warnings
$ git commit --allow-empty -m "mensagem ruim sem escopo"                  # BLOQUEADO (commitlint)
$ git commit --allow-empty -m "chore(C0): smoke test [audit-v1]"          # ACEITO
$ git reset --soft HEAD~1                                                 # desfez teste
$ pnpm changeset --empty                                                  # falha esperada
$ pnpm changeset status                                                   # exit 0
$ python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" # YAML OK
$ grep -rEn "(secret|api[_-]?key|password|token)\s*[:=]" ...              # No matches
$ grep -rEn "(servidor|192\.168|10\.0\.|artflexiveis\.local)" ...         # docs only
$ pnpm audit --audit-level=high                                           # No known vulnerabilities
$ pnpm exec eslint tmp-audit-trap-console.ts                              # parsing error (expected)
$ pnpm exec eslint tmp-audit-trap-any.ts                                  # parsing error (expected)
$ test -f pnpm-lock.yaml && git ls-files pnpm-lock.yaml                   # OK, versionado
$ cd $(mktemp -d) && git clone "C:/.../sprint-dispatcher" clone           # OK
$ (in clone) pnpm install --frozen-lockfile                               # exit 0
$ (in clone) pnpm format:check && pnpm lint && pnpm type-check && pnpm test && pnpm build  # exit 0
$ rm -rf "$TMPDIR_AUDIT"                                                  # cleanup
```

---

## 7. Assinatura

Auditoria realizada por sessão independente do Claude Code em **2026-05-21**,
sem leitura dos documentos externos `sprint_dispatcher_backlog.docx`,
`sprint_dispatcher_stack.docx` e `sprint_dispatcher_requisitos.docx` (excluídos
por instrução explícita de Renan).

Estado do repositório no momento da auditoria: branch `develop`, commit SHA
`c1873db`.

**Próxima auditoria recomendada:** após Sessão 03 de C1 (ou após sessão de
remediação se houver), para revalidar:

1. FINDING-001 — registro formal das versões instaladas.
2. FINDING-002 — `linked`/`ignore` re-populados em `.changeset/config.json`.
3. FINDING-008 — regras ESLint exercidas em arquivos `.ts` reais.
