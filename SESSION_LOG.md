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

## Sessão 06 — 2026-05-22 — Execução de C2 (Leader Application scaffold) + BL-C5-001 · W0

**Wave atual:** W0 **Duração estimada:** ~6h **Itens trabalhados:** [BL-C2-001,
BL-C5-001]

### Objetivo da sessão

Executar a parte W0 do Componente C2 (Leader Application) — o scaffold do app
Electron `apps/leader` — junto com BL-C5-001 (electron-builder do Leader),
deixando uma aplicação Electron + React + TypeScript funcional, buildável e com
segurança aplicada.

### O que foi feito

- **Scaffold `apps/leader`** (Fase 2): `package.json` (sprint-leader),
  `tsconfig.json` + `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`,
  `README.md`, `.gitignore`. Deps: electron 30.5.1, react 18, vite 5,
  vite-plugin-electron, vitest, jsdom.
- **Main process + preload** (Fase 3): `BrowserWindow` com webPreferences
  seguras (CLAUDE.md §8.1) + hardening (`will-navigate`,
  `setWindowOpenHandler`); preload com bridge tipado via
  `contextBridge.exposeInMainWorld('api')`; `LeaderAPI` em
  `src/shared/ipc-types.ts`; handler smoke `ping`.
- **Renderer React** (Fase 4): `index.html` com CSP estrita, `main.tsx`
  (StrictMode), `App.tsx` placeholder consumindo `window.api.ping()`, CSS
  Modules e tokens em `global.css`, `env.d.ts` tipando `window.api`.
- **Smoke E2E** (Fase 5): `pnpm dev` abre a janela, bridge IPC responde `pong`,
  console limpo, hot reload confirmado (renderer + main).
- **electron-builder** (Fase 6): `electron-builder.yml` (portable + NSIS, pt-BR,
  `requestExecutionLevel: user`), `build/.gitkeep`.
- **ADR-008** (bundling com vite-plugin-electron) e **ADR-009** (IPC
  contract-first) em `DECISIONS.md`.

### Estado atual

- **BL-C2-001:** ✅ concluído — scaffold funcional, smoke E2E aprovado (bridge
  IPC + hot reload).
- **BL-C5-001:** ⚠️ config concluída e validada (o electron-builder carrega o
  YAML e roda até a etapa de packaging); **a geração do `.exe` não foi validada
  nesta sessão** — bloqueada pelo ESET (ver Bloqueios).
- **BL-C2-002..012:** ⏸️ W1+ (telas, Zustand, Router, dispatch — dependem de
  C4).
- Bateria final (Fase 7): `format:check`, `lint`, `type-check`, `test`, `build`
  todos exit 0; `@sprint/contracts` coverage 100% (regressão zero).
- **C2 (W0) consolidado em `develop`:** os 10 commits foram mergeados via PR #1
  (merge commit `2578a36`, 2026-05-22) — review e merge pelo Renan no GitHub.

### Decisões tomadas

- **ADR-008** e **ADR-009** registrados. O prompt pedia ADR-007/ADR-008, mas o
  ADR-007 já existia (baseline de versões); renumerados para 008/009 com aval do
  Renan no início da sessão.
- **App em CommonJS** (sem `"type": "module"` no `package.json`): o preload
  sandboxado (`sandbox: true`) tem de ser CJS — ESM quebra com "Cannot use
  import statement outside a module". O main passou a usar o global `__dirname`
  em vez de `import.meta.url`. Ver ADR-008 e CLAUDE.md §12 G-007.
- **`.exe` adiado:** o ESET trava o `app.asar` durante o electron-builder; sem
  como excluir/desativar o ESET, a geração foi adiada (prompt §6). Validar em CI
  ou ambiente sem ESET.
- Tipos IPC vivem dentro do app, não em `@sprint/contracts` (ADR-009).

### Bloqueios encontrados

- **ESET (antivírus) trava o `app.asar`** — o `electron-builder` falha em
  `EnsureEmptyDir` ("file used by another process"). O ESET não é excluível nem
  desativável pelo Renan. Decisão conjunta: adiar a geração do `.exe` — o config
  está pronto e validado, só o artefato falta.
- **winCodeSign exigia privilégio de symlink** — resolvido: Renan habilitou o
  Windows Developer Mode.

### Próximo passo

Iniciar o **prompt de auditoria do C2** (mesmo padrão das auditorias C0/C1, com
ênfase em segurança Electron: CSP, `contextIsolation`/`sandbox`, hardening de
`will-navigate`, bridge IPC). Validar o `.exe` baixando o artifact do workflow
**Build Leader** (que dispara no merge do PR #1) e testando numa máquina
Windows.

### Observações para a próxima sessão

- **Branches (7, encadeadas) — mergeadas em `develop` via PR #1:**
  `feature/BL-C2-001-leader-scaffold` → `feature/BL-C2-001-main-and-preload` →
  `feature/BL-C2-001-renderer` → `fix/BL-C2-001-preload-cjs` →
  `feature/BL-C5-001-electron-builder-leader` → `fix/BL-C2-001-vitest-setup` →
  `chore/BL-C2-session-close`. Cada uma parte da anterior (dependência
  sequencial real — Fase N precisa dos arquivos da Fase N-1). Os 10 commits
  foram para `develop` no PR #1, com merge commit (`2578a36`). As branches
  locais podem ser apagadas com segurança.
- **Desvios do código do prompt** (todos por necessidade técnica, validados):
  `tsconfig.json` sem `vite.config.ts` no `include` (TS6305 — G-010);
  `app.whenReady().then()` e o `.then()/.catch()` do `App.tsx` viraram
  `async/await` (CLAUDE.md §7.4 + ESLint `promise/prefer-await-to-then`);
  `process.env` em dot notation; app em CommonJS (G-007).
- **Mudanças na toolchain da raiz** (integração do 1º app Electron): `electron`
  em `pnpm.onlyBuiltDependencies`; `eslint.config.mjs` e `.prettierignore`
  ignoram `dist-electron`; `--no-warn-ignored` no comando eslint do lint-staged;
  `.gitignore` com `!apps/*/build/`. Todas beneficiam o C3 também.
- **5 gotchas novas** no CLAUDE.md §12: G-007 (preload CJS), G-008 (winCodeSign
  / Developer Mode), G-009 (ESET trava app.asar), G-010 (TS6305 vite.config),
  G-011 (vitest jsdom + passWithNoTests).
- O leftover `apps/leader/release/win-unpacked/resources/app.asar` ficou travado
  pelo ESET (gitignored, inofensivo) — um reboot libera.
- `apps/leader` ainda não importa `@sprint/contracts` (declarado como dep para
  W1+); o smoke `ping` é placeholder.
- A próxima sessão de C2 (W1) introduz Zustand, React Router e telas reais — os
  tokens CSS e a estrutura já estão preparados para isso.
- **Pós-Fase 8 (a pedido do Renan):** adicionado
  `.github/workflows/build-leader.yml` — workflow do GitHub Actions que builda o
  `.exe` num runner Windows limpo (sem ESET), contornando o bloqueio do
  BL-C5-001. Dispara no `push` para `develop` (paths de `apps/leader`) e também
  manualmente via `workflow_dispatch`. Foi o 10º commit; mergeado no PR #1, e o
  merge para `develop` já disparou a primeira execução do workflow.

---

## Sessão 05 — 2026-05-22 — Remediação pós-auditoria v1 de C1

**Wave atual:** W0 (remediação, não execução) **Duração estimada:** ~2h **Itens
trabalhados:** Remediação dos achados FINDING-001 e FINDING-002 de
`docs/audits/C1_AUDIT_REPORT_v1.md`

### Objetivo da sessão

Remediar os achados da auditoria v1 do C1 conforme o prompt de remediação
formal. A auditoria v1 fechou 🟢 APROVADO (0 Critical, 0 High), então o escopo
obrigatório era vazio; por decisão do Renan, os 2 achados Medium (opt-in) foram
remediados. Produzir `C1_REMEDIATION_REPORT_v1.md` e a branch
`fix/c1-audit-v1-remediation` pronta para PR.

### O que foi feito

- Triagem do relatório: 0 Critical, 0 High, 2 Medium, 2 Low, 5 Info. Escopo
  confirmado com Renan: remediar os 2 Medium.
- **FINDING-001 (Medium, D1)** — Fixed, commit `f8b2736`: criados
  `packages/contracts/src/errors.test.ts` (10 testes) e
  `packages/contracts/src/schemas/shared.test.ts` (16 testes), fechando a
  heurística de par `.test.ts` 1-para-1. Puramente aditivo.
- **FINDING-002 (Medium, D2/D4)** — Fixed, commit `a33cdbb`: replicados 12
  blocos JSDoc de `sprint-payload.schema.ts` para `sprint-ack`, `sprint-cancel`
  e `agent-config` (só comentários — zero alteração de schema/tipo/parser).
- Re-validação completa após `rm -rf node_modules` + `--frozen-lockfile`:
  bateria raiz e package exit 0; coverage 100%; smoke adversarial 10/10;
  adversarial type-check confirmando branded types (TS2322). Zero regressões.
- Relatório criado: `docs/audits/C1_REMEDIATION_REPORT_v1.md`.

### Estado atual

- Branch `fix/c1-audit-v1-remediation` mergeada em `develop` por fast-forward (4
  commits: 2 de fix + 2 de docs), a pedido explícito do Renan — ver Decisões
  tomadas.
- Findings: Critical 0/0, High 0/0, **Medium 2/2 Fixed**, Low 0/2 (Deferred),
  Info 5 (n/a). 0 Disputed.
- Package `@sprint/contracts`: 190 testes em 10 arquivos (era 164 em 8),
  cobertura 100% em stmts/branches/funcs/lines.

### Decisões tomadas

Nenhuma decisão arquitetural — remediação corrige apenas o que o relatório
listou. Nenhum finding disputado. Os 2 Low e 5 Info ficam como débito
documentado / não-acionável (fora do escopo opt-in do §3 do prompt).

Decisão de processo: a pedido explícito do Renan, a branch foi mergeada direto
em `develop` por fast-forward, dispensando o PR + review exigidos pela Regra
Absoluta §9.3 do CLAUDE.md (e o critério "nenhum merge unilateral" do §13 do
prompt de remediação). O conflito foi sinalizado antes da ação; o Renan, como
lead, autorizou o override de forma consciente. Registrado aqui por
transparência — é uma exceção pontual e não altera a §9.3.

### Bloqueios encontrados

Nenhum.

### Próximo passo

Remediação já mergeada em `develop`. Abrir a sessão de **Auditoria v2 do C1**
(mesmo prompt da v1, com aviso de re-auditoria) — idealmente após mergear também
`docs/BL-C1-audit-v1`, para reconciliar o histórico do SESSION_LOG (ver
Observações).

### Observações para a próxima sessão

- A **Auditoria v2** deve validar: (a) FINDING-001 e FINDING-002 efetivamente
  sumiram; (b) nenhum check que passava na v1 regrediu; (c) smoke adversarial
  continua 10/10; (d) não há Disputed para reaparecer.
- **Numeração / branches:** esta é a Sessão 05 (execução C1 = 03, auditoria C1 =
  04, remediação = 05). A entrada da Sessão 04 e o relatório
  `C1_AUDIT_REPORT_v1.md` vivem na branch `docs/BL-C1-audit-v1`, ainda não
  mergeada em `develop` — por isso este log salta de 03 para 05 nesta branch.
  Mergear `docs/BL-C1-audit-v1` reconcilia o histórico.
- **Não iniciar o C4 antes da Auditoria v2 aprovar** — o C4
  (`@sprint/fs-adapter`) é o primeiro consumidor cross-package real de
  `@sprint/contracts`.

---

## Sessão 03 — 2026-05-21 — Execução de C1 (Shared Contracts) · W0

**Wave atual:** W0 **Duração estimada:** ~4h **Itens trabalhados:** [BL-C1-001,
BL-C1-002, BL-C1-003, BL-C1-005, BL-C1-006]

### Objetivo da sessão

Executar a totalidade da Wave 0 do Componente C1 (Shared Contracts): scaffold do
package `@sprint/contracts`, constantes, geração de ULID, schemas Zod com tipos
inferidos, helpers de filename, public API consolidada e cobertura de testes ≥
95%. Endereçar em paralelo as ressalvas Medium da auditoria do C0 (Sessão 02),
conforme path (a) aceito por Renan no início desta sessão.

### O que foi feito

- **F2 (scaffold):**
  `packages/contracts/{package,tsconfig,vitest.config,README,.gitignore}`
  - `src/index.ts` placeholder; deps `zod ^3.23`, `ulid ^2.3`, `vitest ^1.6`,
    `@vitest/coverage-v8 ^1.6`. Commit `d67c296`.
- **F3 (BL-C1-006):** `src/constants.ts` com 8 constantes públicas
  (`SCHEMA_VERSION`, `DEFAULT_POLLING_INTERVAL_MS`,
  `DEFAULT_SHOW_DURATION_SECONDS`, `DEFAULT_SPRINT_TITLE`, `SHARED_DIRS`,
  `LOCAL_DIRS`, `ALLOWED_HTML_TAGS`, `MAX_DEADLINE_HORIZON_HOURS`) + 8 testes,
  100% cobertura. Commit `29f7a29`.
- **F4 (BL-C1-005):** `src/ids.ts` (`generateSprintId`, `isValidUlid`,
  `ULID_REGEX`) + 12 testes (incluindo `@ts-expect-error` para defesa de
  runtime). Commit `6460d7a`.
- **F5 (BL-C1-001 + BL-C1-002):** `src/errors.ts` (`ContractValidationError`),
  `src/schemas/shared.ts` (branded `SprintId`, `UserId`, `isoDatetimeSchema`,
  `schemaVersionSchema`), 4 schemas `.strict()` (`sprintPayloadSchema`,
  `sprintAckSchema`, `sprintCancelSchema`, `agentConfigSchema`) com tipos via
  `z.infer`/`z.input` e pares `parseXxx`/`safeParseXxx`. Fixtures válidas. 115
  novos testes (114 unitários + 6 security). Commit `7a73e7d`.
- **F6 (BL-C1-003):** `src/filenames.ts`
  (`buildPendingFilename`/`buildAckFilename`/`buildCancelFilename` +
  `parseFilename`/`safeParseFilename`, `ParsedFilename` discriminated union,
  `FilenameParseError`) + 29 testes (incluindo round-trip e defesa contra
  `.tmp`). Commit `0d1a990`.
- **F7 (BL-C1-001 consolidação):** `src/index.ts` re-escrito com exports
  nomeados explícitos (sem `export *`), `type` keyword inline para respeitar
  `verbatimModuleSyntax: true`. README do package expandido com tabela de
  schemas/parsers, branded types, helpers, constantes, cobertura, roadmap e nota
  de naming sobre ULID inválido. Commit `557ce59`.
- **F8 (validação geral):** limpeza de `node_modules` + reinstall com
  `--frozen-lockfile`, bateria completa exit 0, cobertura `100%` em todos
  módulos. Auditoria de padrões: zero `console.log`, zero `any`, zero
  `@ts-ignore`.
- **F9 (encerramento):** ADR-005, ADR-006, ADR-007 registrados; esta entrada;
  `CHANGELOG` atualizado; `CLAUDE.md` §12 com novos gotchas.

### Estado atual

- **BL-C1-001:** ✅ concluído (tipos via `z.infer`, public API consolidada)
- **BL-C1-002:** ✅ concluído (schemas Zod + parsers +
  `ContractValidationError`)
- **BL-C1-003:** ✅ concluído (filename helpers)
- **BL-C1-004:** ⏸️ Wave 1 (sanitizador HTML com DOMPurify)
- **BL-C1-005:** ✅ concluído (ULID)
- **BL-C1-006:** ✅ concluído (constantes)

Cobertura final do package: **100%** em stmts/funcs/branches/lines em todos os 9
módulos. **164 testes** (8 arquivos).

**Gate W0 → W1:** ainda **não atingido**. C0 e C1 fecharam (módulo BL-C1-004).
Faltam scaffolds dos packages C4 (`fs-adapter`) e C6 (`logger`) e dos apps C2
(`leader`) e C3 (`operator-agent`).

### Decisões tomadas

- **ADR-005:** schema-first com `z.infer` (formaliza padrão obrigatório do
  package).
- **ADR-006:** filenames usam ULID completo (`<sprintId>-<userId>.json`),
  esclarecendo a ambiguidade do Anexo A do Requisitos v1.1.
- **ADR-007:** ratifica formalmente o baseline de versões instaladas (endereça
  **FINDING-M1** da auditoria do C0).
- Path (a) do audit C0 escolhido por Renan: endereçar Medium no fluxo natural do
  C1 (sem sessão dedicada de remediação).
- Branded types (`SprintId`, `UserId`) adotados para evitar trocas acidentais
  entre IDs.
- `.strict()` em todos os schemas (rejeita campos extras — defesa contra
  payloads adulterados e `__proto__` injection).
- Source-first no monorepo: `main` aponta para `src/index.ts`, sem etapa de
  `dist/` (apps consomem TS direto via Vite/Electron bundler).
- Lint do package restrito a `src/` (config files cobertos por Prettier).

### Bloqueios encontrados

Nenhum bloqueador. Algumas decisões pequenas exigiram conversa rápida com Renan
(path do audit, naming de filename), todas resolvidas via `AskUserQuestion` no
início.

### Próximo passo

Iniciar **prompt de auditoria de C1** (mesmo padrão da Sessão 02 — auditor
independente). Após aprovação, próxima sessão lógica é o package que desbloqueia
o maior número de consumidores: provavelmente `@sprint/fs-adapter` (BL-C4-\*) —
sem ele, nem o Leader nem o Agent têm como ler/escrever na pasta compartilhada.

### Observações para a próxima sessão

- **ULID canônico inválido.** A string `01HX9K2M4F8N7P2Q5R3S6T7U8V` que circula
  em prompts, exemplos e issues **não é um ULID válido** — contém um `U` no
  índice 23, e Crockford Base32 exclui `I, L, O, U`. Use
  `01HX9K2M4F8N7P2Q5R3S6T7V8W` (sem I/L/O/U). Documentado em CLAUDE §12 G-004 e
  usado em todas as fixtures/tests do C1.
- **Bug latente no `eslint.config.mjs`** corrigido em F2: o spread
  `...tseslint.configs.disableTypeChecked` seguido de `rules: {...}`
  sobrescrevia o objeto rules do disable, deixando regras type-aware ativas em
  config files. Era invisível em C0 porque não havia `.ts` lintado. Documentado
  em CLAUDE §12 G-006.
- **Desvio do prompt de C1 §5.2:** `tsconfig.json` do package **não exclui**
  `*.test.ts` e `__fixtures__/**`. Justificativa: `projectService: true` da
  typescript-eslint v8 exige que arquivos estejam em algum tsconfig; custo de
  type-check de testes é ~ms e captura erros de tipo em código de teste (Vitest
  não type-checka por padrão — usa esbuild).
- **Turbo loga "no output files found"** para `@sprint/contracts#build` —
  esperado, package usa `tsc --noEmit`. Pode ser silenciado adicionando
  `packages/contracts/turbo.json` com `outputs: []` em sessão futura.
  Não-bloqueante.
- **FINDING-M2 parcialmente endereçado.** `.changeset/README.md` atualizado para
  marcar `@sprint/contracts` como criado; `config.json` continua com
  `linked: []` e `ignore: []` porque Changesets exige que todos os packages do
  array existam. Endereçamento final em BL-C4-001 ou BL-C6-001.
- **Limite de 2000 chars em `body_html`** é defensável (UI overlay tem espaço
  finito) mas não tem fonte formal nos Requisitos. Confirmar com Renan ao
  revisar.
- **Branded types em forms.** `SprintId`/`UserId` aparecem como
  `string & { brand }` na inferência. Em UIs com `react-hook-form` pode exigir
  cast explícito no valor inicial — use o tipo `*Input` no formulário e converta
  via `sprintIdSchema.parse(value)` no submit. Não validado nesta sessão (sem UI
  ainda). Gotcha G-005.
- **Schema NÃO sanitiza HTML.** Documentado em `security.test.ts`. A sanitização
  de `body_html` é responsabilidade exclusiva de BL-C1-004 (W1) com
  `isomorphic-dompurify`. Schema aceita qualquer string em `body_html`
  (verificado com `<script>alert(1)</script>` no test).
- **Header de commit cap.** commitlint configurado para max 100 chars no header.
  Mensagens longas devem ir para o body (separado por linha em branco).

## Sessão 02 — 2026-05-21 — Auditoria de C0

**Wave atual:** W0 (auditoria, não execução) **Duração estimada:** ~1h **Itens
trabalhados:** Auditoria de [BL-C0-001..007]

### Objetivo da sessão

Auditoria técnica independente do Componente C0 entregue na Sessão 01, contra
spec consolidada (CLAUDE.md + Requisitos v1.1 + Stack v1.0 + Backlog v1.0). Por
instrução de Renan, os 3 docx externos não foram lidos — auditoria opera com
CLAUDE.md como spec consolidada e diferenças do plano original tratadas como
desvio explícito.

### O que foi feito

- 6 dimensões auditadas com evidência direta:
  - **D1 Estrutural** ✅ Pass — todos arquivos raiz, estrutura intacta, hooks no
    padrão Husky 9 (trampolim em `.husky/_/`)
  - **D2 Conteúdo** ⚠️ Pass with reservations — 2 Medium documentados
  - **D3 Funcional** ✅ Pass — 5 scripts agregados exit 0, hooks disparam, Turbo
    sem warnings de deprecation, YAML válido
  - **D4 Documental** ✅ Pass — SESSION_LOG, CHANGELOG e ADRs batem com commits
    reais
  - **D5 Segurança/Padrões** ✅ Pass — zero secrets, `pnpm audit` zero CVEs
  - **D6 Reprodutibilidade** ✅ Pass — clone limpo em pasta temp passou todo o
    pipeline
- 10 achados consolidados (0 Critical, 0 High, 2 Medium, 3 Low, 5 Info)
- Relatório integral em
  [`docs/audits/C0_AUDIT_REPORT_v1.md`](./docs/audits/C0_AUDIT_REPORT_v1.md)
- Veredito: 🟡 **APROVADO COM RESSALVAS** — liberado para Wave 1 com débitos
  Medium endereçados no fluxo natural de C1

### Estado atual

- Nenhuma alteração de código ou config (auditor não corrige).
- `docs/audits/C0_AUDIT_REPORT_v1.md` criado, aguardando review do Renan.
- Branch dedicada `docs/BL-C0-audit-v1` a ser aberta no fim desta sessão para
  conter o relatório + esta entrada de log, sem tocar `develop` diretamente.

### Decisões tomadas

Nenhuma decisão arquitetural — auditoria apenas reporta. Decisões sobre
remediação ficam com Renan a partir do relatório.

### Bloqueios encontrados

Nenhum bloqueio absoluto. Limitações de cobertura registradas no relatório:

- Validação funcional das regras ESLint não foi possível (tsconfig raiz com
  `include: []` impede lint de arquivos avulsos) — re-validar pós-C1.
- Documentos externos (Stack v1.0, Backlog v1.0, Requisitos v1.1) não foram
  lidos por instrução de Renan; ADRs validados por consistência interna +
  referências declaradas.
- Execução real do workflow no GitHub Actions não foi disparada por esta sessão;
  SESSION_LOG da Sessão 01 já afirma "primeiro run rodou verde confirmado pelo
  Renan" — aceito como evidência indireta.

### Próximo passo

Renan revisa `docs/audits/C0_AUDIT_REPORT_v1.md`. Três caminhos possíveis:

- (a) avanço direto pra Wave 1 — abrir prompt master para C1
  (`packages/contracts`), instruindo a sessão de C1 a:
  1. Re-popular `linked`/`ignore` em `.changeset/config.json` no mesmo commit
     que cria `@sprint/contracts` (FINDING-002).
  2. Considerar abrir ADR-005 ratificando o baseline de versões da Sessão 01 ou
     aguardar o Stack externo virar v1.1 (FINDING-001).
- (b) sessão de remediação dedicada — apenas se Renan quiser fechar Medium/Low
  antes do C1. Não recomendado, porque ambos Medium se endereçam naturalmente no
  fluxo de C1.
- (c) aceite formal dos débitos Low/Medium — registrar em DECISIONS.md (novo
  ADR) e seguir direto para Wave 1.

### Observações para a próxima sessão

- **Se for sessão de C1**, ler primeiro
  [`docs/audits/C0_AUDIT_REPORT_v1.md`](./docs/audits/C0_AUDIT_REPORT_v1.md)
  integralmente. Os FINDING-001 e FINDING-002 viram guard rails no início do
  trabalho — não esquecer de atualizar `.changeset/config.json` no commit que
  cria `@sprint/contracts/package.json`.
- **Se for sessão de remediação**, achados Critical/High não existem, então o
  fluxo é light. Commits de fix devem referenciar
  `fix(C0): ... [audit-v1-FINDING-NNN]` no scope/footer pra rastreabilidade.
- **Padrão de validação para próximas auditorias**: as regras ESLint
  configuradas (no-console, no-explicit-any, no-floating-promises, etc) só podem
  ser exercidas com arquivos `.ts` dentro de TS project. Re-validar
  funcionalmente assim que `packages/contracts/src/*.ts` existir.
- **Nome do package vs nome do repo**: `sprint-dispatcher` (hífen, no
  `package.json`) ≠ `sprint_dispatcher` (underscore, no GitHub). Não é
  bloqueador (FINDING-004), mas vale alinhar quando der.

---

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
