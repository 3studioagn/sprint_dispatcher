# CLAUDE.md — Contexto Operacional

> **Você (Claude Code): este é o seu documento de operação para o projeto Sprint
> Dispatcher.** Leia integralmente no início de toda sessão. Em caso de dúvida
> durante o desenvolvimento, esta é a fonte de verdade.

---

## 0. Protocolo de Início de Sessão (obrigatório)

Antes de qualquer ação no projeto, execute esta sequência:

1. Leia este documento (`CLAUDE.md`) integralmente.
2. Leia `SESSION_LOG.md` — entrada mais recente diz onde paramos.
3. Leia `DECISIONS.md` se a sessão envolver trabalho arquitetural.
4. Execute `git status` e `git log --oneline -20` para confirmar estado real do
   repo.
5. Confirme com Renan o plano da sessão antes de começar a codar.

Esta sequência leva 2-3 minutos. **Não pule.**

---

## 1. Missão

Construir o **Sprint Dispatcher**, sistema de comunicação ativa de metas para a
ARTFLEXÍVEIS. Quando um líder de setor dispara uma sprint:

1. EXE do Líder grava arquivos JSON na pasta compartilhada
   `\\servidor\sprint-dispatcher\pending\`
2. Agentes nas estações dos operadores selecionados (rodando em background desde
   o boot do Windows) detectam os arquivos via polling de 3 segundos
3. Cada agente renderiza um overlay fullscreen TOPMOST com título e meta
4. Após 5 segundos, overlay minimiza para ícone na bandeja (clicável pra
   reabrir)
5. Cada agente escreve ack em `\\servidor\sprint-dispatcher\acks\`
6. EXE do Líder pollea os acks e atualiza o status em tempo quase-real

**Sem backend. Sem servidor de aplicação. Sem conexão externa.** A pasta
compartilhada SMB é o único canal de comunicação.

---

## 2. Arquitetura

```
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  Aplicação do Líder  │ ───▶  │  Pasta Compartilhada │ ───▶  │  Agente do Operador  │
│  (interface ativa)   │       │  \\servidor\...      │       │  (residente)         │
└──────────────────────┘ ◀───  └──────────────────────┘ ◀───  └──────────────────────┘
   Renan,                          pending/, acks/,           Estações de João,
   outros líderes                  arquivo/                   Maria, Carlos...
```

> **Path real da pasta compartilhada (anotado 2026-05-25):**
> `\\srv-alpha\TEMP\Metas_3Studio` (UNC) — montado como `Z:\Metas_3Studio` no PC
> dev de Renan. Subpastas `pending/`, `acks/`, `arquivo/` já criadas. Cada
> estação dos operadores pode mapear letra diferente ou nem mapear; o instalador
> (BL-C5-002) deve escrever o **UNC** no `config.json` do Agent
> (`shared_path: "\\\\srv-alpha\\TEMP\\Metas_3Studio"`), nunca a letra. Idem
> para o setup do Leader (BL-C2-007+).

### Princípios arquiteturais inegociáveis

- **P-01.** Toda comunicação Leader ↔ Agent passa pela pasta compartilhada via
  filesystem. Nada de sockets, HTTP, IPC entre máquinas.
- **P-02.** Permissões NTFS controlam quem pode escrever em `pending/` (apenas
  líderes) e em `acks/` (todos).
- **P-03.** O Agent NÃO é iniciado pelo evento. Ele já está rodando desde o boot
  do Windows, fazendo polling. Esta é a premissa central do design.
- **P-04.** Polling é a escolha deliberada, NÃO use `fs.watch` ou bibliotecas
  como chokidar — eles são errados em pastas SMB.
- **P-05.** Toda escrita é atômica: escreva em `.tmp` e faça rename.

---

## 3. Stack Tecnológica

| Categoria            | Tecnologia                                   | Versão (alvo / instalada)                                                 |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| Linguagem            | TypeScript                                   | 5.4+ — instalada **6.0.3**                                                |
| Runtime Node         | Node.js                                      | engine `>=20.0.0` — `.nvmrc` **24.10.0**                                  |
| Runtime Desktop      | Electron                                     | 30.x — instalada **42.2.0** (`sprint-leader`, `sprint-operator-agent`)    |
| UI Framework         | React                                        | 18.3+ — instalada **18.3.x** (`sprint-leader`)                            |
| Routing              | react-router-dom                             | 6.23+ — instalada **6.30.3** (`sprint-leader`)                            |
| Estado global        | Zustand                                      | 4.5+ — instalada **4.5.7** (`sprint-leader`)                              |
| Styling              | CSS Modules + PostCSS                        | nativo Vite — em uso em `sprint-leader`                                   |
| Forms                | react-hook-form                              | 7.51+ — _pendente (avaliar em BL-C2-006, W2)_                             |
| Validation           | Zod                                          | 3.23+ — instalada **3.25.x** (`@sprint/contracts`, `sprint-leader`)       |
| Icons                | lucide-react                                 | 0.380+ — _pendente (avaliar em W2)_                                       |
| Date/Time            | date-fns                                     | 3.6+ — _pendente_                                                         |
| IDs                  | ulid                                         | 2.3+ — instalada **2.4.x** (`@sprint/contracts`)                          |
| HTML Sanitization    | isomorphic-dompurify                         | 2.10+ — instalada **2.36.0** (`@sprint/contracts`)                        |
| Logging              | Pino + pino-roll                             | 9.x / 1.1+ — _pendente (C6)_                                              |
| Testing (unit)       | Vitest                                       | 1.6+ — instalada **1.6.1** (`@sprint/contracts`, `sprint-leader`, demais) |
| Testing (componente) | @testing-library/{react,user-event,jest-dom} | 16+/14+/6+ — instaladas **16.3.2 / 14.6.1 / 6.9.1** (`sprint-leader`)     |
| Testing (E2E)        | Playwright (Electron)                        | 1.44+ — _pendente (C8)_                                                   |
| Package Manager      | pnpm                                         | engine `>=10.0.0` — instalada **10.18.2**                                 |
| Build Orchestrator   | Turborepo                                    | 2.x — instalada **2.9.14**                                                |
| Renderer Bundler     | Vite                                         | 5.x — instalada **5.4.21** (`sprint-leader`)                              |
| Electron Builder     | electron-builder                             | 24+ — instalada **24.13.3** (`sprint-leader`)                             |
| Versionamento        | Changesets                                   | 2.27+ — instalada **2.31.0**                                              |
| Lint                 | ESLint                                       | 9.x (flat) — instalada **10.4.0** (flat nativo)                           |
| Format               | Prettier                                     | 3.x — instalada **3.8.3**                                                 |
| Git hooks            | Husky + lint-staged                          | 9.x / 15.x — instaladas **9.1.7 / 17.0.5**                                |
| CI                   | GitHub Actions                               | configurado em `.github/workflows/ci.yml`                                 |

> **Como ler a coluna:** "_pendente (CX)_" significa que a dependência ainda não
> foi adicionada — entra na sessão do componente indicado. Quando ESLint, TS,
> pnpm ou lint-staged divergem do alvo do plano original, é porque o ambiente
> real do Renan tinha versão mais nova quando o monorepo foi inicializado
> (Sessão 01); funcionou sem regressão e foi mantido. Atualize esta tabela à
> medida que cada package/app entrar.

### Decisões de stack que importam saber sem precisar consultar DECISIONS.md

- **Electron** (não Tauri, não WPF) — single tech stack pro time, suporte
  robusto a TOPMOST.
- **Polling** (não fs.watch) — pastas SMB tratam eventos de filesystem de forma
  errática.
- **Zustand** (não Redux) — escala o suficiente, API minimal.
- **CSS Modules** (não Tailwind) — consistência com outros projetos do 3Studio.
- **Vitest** (não Jest) — ESM-first, significativamente mais rápido.
- **ULID** (não UUID) — ordenação cronológica natural por timestamp embutido.

---

## 4. Estrutura do Monorepo

```
sprint-dispatcher/
├── apps/
│   ├── leader/                 # C2 — Leader Application
│   └── operator-agent/         # C3 — Operator Agent
│
├── packages/
│   ├── contracts/              # C1 — schemas Zod, types, sanitização HTML
│   ├── fs-adapter/             # C4 — abstração de filesystem
│   └── logger/                 # C6 — Pino wrapper
│
├── installer/                  # C5 — electron-builder config
├── tests/                      # C8 — E2E com Playwright
├── .github/workflows/          # CI/CD
│
├── README.md
├── CLAUDE.md                   # ← este arquivo
├── DECISIONS.md
├── CHANGELOG.md
├── SESSION_LOG.md
├── pnpm-workspace.yaml
└── package.json
```

### Princípio de comunicação entre packages

Componentes só se comunicam através de **interfaces tipadas** definidas em
`@sprint/contracts`. Apps (C2, C3) podem importar de:

- `@sprint/contracts` (tipos e schemas)
- `@sprint/fs-adapter` (I/O)
- `@sprint/logger` (logs)

Apps **nunca** importam um do outro. Use ESLint rule pra forçar isso.

### Estrutura interna do Leader (W1.C2 parte 1)

A app `sprint-leader` segue esta convenção dentro de
`apps/leader/src/renderer/`:

```
renderer/
├── App.tsx                # HashRouter + layout grid (sidebar + main)
├── main.tsx               # entry React (StrictMode)
├── env.d.ts               # Window['api']: LeaderAPI
├── test-setup.ts          # jest-dom matchers + RTL cleanup
├── components/
│   ├── Sidebar/           # nav persistente
│   ├── OperatorList/      # lista + OperatorRow + input de meta inline
│   ├── BulkSelectButtons/ # Marcar todos / Desmarcar todos
│   └── DeadlineInput/     # time picker + warning anti-passado
├── routes/
│   ├── NovaSprint/        # composer (Operadores + Deadline + título/corpo + Disparar)
│   ├── Acompanhamento/    # tela de acks (BL-C2-008) + cancelamento (BL-C2-009)
│   └── Historico/         # placeholder W3 (BL-C2-010)
├── stores/
│   ├── useSprintComposerStore.ts  # draft + selectors puros
│   ├── useOperatorsStore.ts       # cache (mock → fs-adapter em W1.C4)
│   └── sprintComposerSchema.ts    # composerFormSchema Zod + selectFormPayload
├── types/operator.ts      # Operator local (promover a @sprint/contracts quando C3/C4 consumir)
├── data/operators.mock.ts # mock substituído pelo fs-adapter em W1.C4
└── styles/global.css      # tokens CSS (cores ARTFLEXÍVEIS, espaçamentos, tipografia)
```

**Convenções específicas do Leader:**

- **Selectors puros separados das stores** — `selectIsValid`,
  `selectSelectedCount`, `selectFormPayload` são funções top-level (fora do
  `create()`), recebem state e retornam derivações sem side effects.
- **`composerFormSchema` (Zod) é fonte única de regras de forma** —
  `selectIsValid` delega para `selectFormPayload(state) !== null`, alinhado com
  schema-first ADR-005.
- **Stores não validam** — `setMeta`, `setDeadline` guardam valor cru; validação
  fica nos selectors. Permite UI armazenar valor parcial enquanto o usuário
  digita.
- **`react-hook-form` NÃO é usado** (decisão arquitetural em ADR-015) — a store
  Zustand já é fonte única; RHF brilharia em forms estruturados, não em composer
  dinâmico com `useFieldArray`. Reavaliar quando BL-C2-006 (W2) trouxer
  customização de title/body via editor rico.
- ~~Flag `DISPATCH_ENABLED = false` em `routes/NovaSprint/NovaSprint.tsx`~~ —
  removida em **Sessão 15 Gate 5** quando BL-C2-007 fechou. Dispatch real via
  `api.dispatchSprint` → main process → `PendingStore.writePendingSprint`.

> **Atualização Sessão 15 — visual + W1.C2 parte 2:**
>
> - `components/Sidebar/` foi substituído por `components/TopNav/` (redesign
>   Renan, ADR-018) — top nav horizontal com logo `3STUDIO` SVG inline.
> - `data/operators.mock.ts` deletado — `useOperatorsStore.loadOperators` agora
>   é async via `api.listOperators` (IPC).
> - `types/operator.ts` movido para `shared/types/operator.ts` (compartilhado
>   main↔renderer).
> - Novos componentes: `Logo`, `TopNav`, `ConfigErrorScreen`, `DispatchModal`.
> - Novas stores: `useDispatchStore` (status do dispatch + result).
> - Novo wrapper: `renderer/services/api.ts` (tipa `window.api`).
> - Vocabulário UI mudou (ADR-018): "Sprint"→"Rodada", "Operadores"→"Usuários",
>   "Enviar"→"Disparar evento". Schema/IPC permanecem com termos originais.
> - As convenções desta subseção (selectors puros, schema-first, decisão de não
>   usar RHF, tipo `Operator` local) continuam válidas após o redesign.

### Estrutura interna do main process do Leader (W1.C2 parte 2)

A app `sprint-leader` ganhou main process completo na Sessão 15 (Gate 3),
consumindo o domain layer do `@sprint/fs-adapter` (W0+W1):

```
apps/leader/src/
├── shared/
│   ├── ipc-types.ts                # IpcResult<T> + LeaderAPI (property-with-arrow)
│   └── types/operator.ts           # tipo compartilhado main↔renderer
├── main/
│   ├── index.ts                    # composition root + rebuildDeps
│   ├── config.ts                   # loadLeaderConfig() fail-fast + 5 ConfigError
│   ├── config.test.ts
│   ├── ipc.ts                      # registerIpcHandlers(deps, rebuildDeps)
│   └── services/
│       ├── index.ts                # barrel
│       ├── operatorsService.ts     # lê operators.json via IFilesystemAdapter
│       ├── operatorsService.test.ts
│       ├── dispatchService.ts      # orquestra dispatch (try/catch isolado por operador)
│       └── dispatchService.test.ts # helpers resolveDeadlineIso + substituteMeta
└── preload/index.ts                # contextBridge expõe window.api (arrow props)
```

**Convenções específicas do main process do Leader:**

- **Composition root no `main/index.ts`** — `rebuildDeps()` instancia
  `NodeFilesystemAdapter` (W0) → `PendingStore` (W1.C4) → `OperatorsService` →
  `DispatchService`. Injeta tudo via `IpcDependencies` mutável.
- **Padrão fail-fast espelhando o Agent (ADR-012)** — `loadLeaderConfig` usa
  `fs/promises` direto (NÃO via `IFilesystemAdapter` — config é boot state).
  Decisão consciente; uniformizar é débito futuro.
- **5 ConfigError tipados** (`NotFound`, `JsonInvalid`, `SchemaInvalid`, `Read`,
  `SharedPathInaccessible`) — cada um com `code: LeaderConfigErrorCode` que vai
  literal no IPC para a `ConfigErrorScreen` discriminar mensagens específicas.
- **`rebuildDeps` callback para config-recovery sem restart** — se config falha
  no boot, `deps.operatorsService` e `deps.dispatchService` ficam `null`. O
  handler `getConfig` invoca `rebuildDeps` quando o renderer chama de novo (após
  `window.location.reload`) — destrava o app sem matar o processo. UX: líder
  corrige config + clica "Reabrir" no ConfigErrorScreen → app funcional.
- **`IpcResult<T>` envelope** para `listOperators` e `dispatchSprint`;
  **`GetConfigResult` dedicado** para `getConfig` (renderer precisa de
  `expectedPath` + `code` tipado).
- **`LeaderAPI` é property-with-arrow, não method-shorthand** — evita lint
  `@typescript-eslint/unbound-method` em `vi.mocked(window.api.X)` no
  test-setup. Preload e wrapper seguem o mesmo padrão.
- **`CONFIG_REQUIRED` é o code de bloqueio** — handlers retornam esse code
  quando `deps.X === null`. Renderer pode mostrar ConfigErrorScreen via
  `getConfig` que tenta de novo.
- **Try/catch isolado por operador em `dispatchService.dispatch`** — falha de 1
  (`writePendingSprint` lança) não impede os outros. Cada resultado vai em
  `per_operator: DispatchSprintPerOperatorResult[]`.
- **`resolveDeadlineIso(hhmm, now)`** — regra D1 da Sessão 15: se HH:MM
  passou >30min, vira amanhã; senão hoje (tolerância de drift). Helper exportado
  para testabilidade isolada.
- **`substituteMeta(body, meta)`** — regra D2 da Sessão 15: substitui `{meta}`
  no main antes da sanitização e da escrita. Agent fica "burro" (não processa
  template). Helper exportado.
- **`window.api` mock global em `test-setup.ts`** com `vi.fn(impl)` defaults —
  `beforeEach` reseta cada vi.fn() entre testes. Pattern estabelecido na Sessão
  15 Gate 4.
- **Coverage**: `main/config.ts` 100%; `main/services/*` 92-99%;
  `main/index.ts` + `main/ipc.ts` excluídos do coverage (boot + envelope;
  testados via E2E em W3 com Playwright).

> **Atualização W2 — BL-C4-004 + BL-C2-006/008/009 (Sessão 43):**
>
> Encerra o C2 (Leader) na Wave 2 com 4 BLs entregues + a fundação `writeCancel`
> no fs-adapter. Marco: **ciclo de cancelamento ponta-a-ponta funcionando**
> (Leader escreve `cancel-*.json` → Agent já mergeado em BL-C3-011 detecta e
> fecha overlay sem ack).
>
> **Novos services no main process:**
>
> - `AckTrackingService` (BL-C2-008) — agrega `AckStore` + `OperatorsService`,
>   devolve `AckStateView[]` com 3 estados (Anexo D:
>   `displayed_at`/`acknowledged_at`/sem ack). Trata `DirectoryNotFoundError` de
>   `acks/` como benigno. Endpoint leve usado em polling 3s pela tela
>   `/acompanhamento`.
> - `CancelService` (BL-C2-009) — monta `SprintCancel` (Anexo E) com
>   `cancelado_por` do `LeaderConfig.criado_por`, `cancelado_em` ISO, `motivo`
>   opcional trimmed. Validação via `parseSprintCancel` (sprint_id inválido →
>   `ContractValidationError` com contexto do campo). Delega para
>   `CancelStore.writeCancel`.
>
> **Novos handlers IPC** (em `main/ipc.ts`):
>
> - `listAcks(sprintId, targets)` → `IpcResult<ListAcksResponse>`.
> - `cancelSprint(request)` → `IpcResult<CancelSprintResponse>`.
> - Ambos retornam `CONFIG_REQUIRED` quando o respectivo service é null.
>
> **`rebuildDeps()` estendido**: instancia `AckStore` (para o
> AckTrackingService) e `CancelStore` (recebendo `pendingStore` para o
> writeCancel remover originais idempotentemente).
>
> **DispatchService refinado (BL-C2-006 — título-only após `0b01ec3`):**
>
> - Helper exportado `resolveTitle(requestTitle?)`: aplica `.trim()` antes de
>   comparar com vazio, caindo pro default `'É hora de correr'`. Líder que apaga
>   o input ou deixa só whitespace cai pro default. Exportado para teste
>   isolado.
> - `dispatch()` usa `request.title` quando presente (via helper). O **corpo do
>   aviso NÃO é customizável** — usa o template fixo do sistema
>   (`BODY_TEMPLATE`, com `{meta}`); `substituteMeta` + `sanitizeBodyHtml`
>   permanecem no pipeline final (Agent fica "burro").
>
> **Renderer (BL-C2-006/008/009):**
>
> - `useSprintComposerStore` ganha `setTitle` action; `composerFormSchema`
>   valida title (1..80). Selector propaga title no `DispatchSprintRequest` (sem
>   `body_template` — corpo não é customizável).
> - `useTrackedSprintStore` (Zustand novo): persiste sprint disparada na sessão
>   `{sprint_id, dispatched_at, targets, title, deadline_hhmm, cancelled}`.
>   Setada por `NovaSprint.handleDispatchClick` quando
>   `result.summary.success > 0` (targets com falha ficam fora).
> - **Input de título inline** (BL-C2-006): `<input>` simples no header da
>   NovaSprint (`placeholder` "Título do aviso", `maxLength={80}`,
>   `aria-label`). NÃO há `<MessageCustomizer>` dedicado nem campo de
>   corpo/preview — removidos no commit `0b01ec3` (descopo registrado no
>   SESSION_LOG da remediação 2026-05-29; ver AUD-W2-007).
> - `Acompanhamento.tsx` funcional (BL-C2-008): polling 3s com cleanup via
>   `signal = { cancelled: false }` + `clearInterval`. Renderiza summary + lista
>   de targets com 3 estados coloridos + timestamp. Polling para automaticamente
>   em `current.cancelled` (BL-C2-009).
> - `<CancelSprintButton />` (BL-C2-009): botão destrutivo + modal de
>   confirmação com motivo opcional. Click no backdrop fecha; submitting
>   desabilita botões; sucesso chama `markCancelled()`; erro inline
>   `role="alert"`. Integrado em Acompanhamento, visível enquanto
>   `selectIsSprintActive`.
> - `LeaderAPI` ganha `listAcks` e `cancelSprint`. Preload + api wrapper
>   - test-setup mock alinhados.
>
> **Convenções específicas adicionadas:**
>
> - **Validação de IDs via parseSprintCancel/Payload (não `sprintIdSchema.parse`
>   direto)** — o parse direto lança `ZodError`. Em vez disso, passar o
>   sprint_id ao parser completo, que internamente faz safeParse e converte para
>   `ContractValidationError`. Mesma semântica do `DispatchService.dispatch`.
> - **`exactOptionalPropertyTypes: true`** — passar `acknowledged_at: undefined`
>   falha. Padrão da sessão: spread condicional
>   `...(x !== undefined ? { x } : {})`. Aplica a qualquer novo tipo opcional.
> - **Polling com cleanup em flag**: declarar `signal = { cancelled: false }` no
>   escopo do `useEffect`; passar para a função async; checar
>   `if (signal.cancelled) return` antes de setState; no cleanup,
>   `signal.cancelled = true` + `clearInterval`. Pattern reutilizável.
>
> **Testes (contagens reais em `develop` — corrige AUD-W2-006):** Leader **280**
> (o commit `0b01ec3` removeu o `<MessageCustomizer>` e ~25 testes; docs antigas
> alegavam 332); fs-adapter **308**; Agent **298** (chegou a 298 nas Sessões
> 21-42 do C3, não 240); ui-kit **60**.

### Estrutura interna de `@sprint/fs-adapter` (W1 domain layer)

O package segue port-and-adapter hexagonal (ADR-013). Após W1.C4
(BL-C4-002/003/006):

```
packages/fs-adapter/src/
├── interface.ts                 # port — IFilesystemAdapter + FileStat (W0)
├── errors.ts                    # FilesystemError abstract + 4 concretos (W0+W1)
├── node-adapter.ts              # adapter de produção (W0)
├── memory-adapter.ts            # adapter de teste (W0)
├── index.ts                     # barrel — public API
├── __tests__/
│   ├── contract.test.ts         # paridade Node↔Memory (W0)
│   ├── barrel.test.ts           # sanity check do public API
│   └── helpers.ts
└── domain/                      # camada de domínio (W1)
    ├── read-and-parse.ts        # utility read + JSON + Zod safeParse
    ├── pending-store.ts         # writePendingSprint, listPending, deletePending
    ├── ack-store.ts             # writeAck, listAcks
    ├── cancel-store.ts          # writeCancel (BL-C4-004 W2) + remoção de originais
    └── archive-store.ts         # moveToArchive — stub W3 (BL-C4-005)
```

**Convenções específicas do fs-adapter (W1):**

- **Domain stores compartilham construtor uniforme** —
  `new XxxStore(adapter: IFilesystemAdapter, sharedPath: string)`. Caller
  (Leader, Agent) injeta tudo; stores não lêem config.
- **Paths internos via `path.posix.join`** — uniformidade entre Linux CI,
  Windows dev e MemoryFilesystemAdapter (que normaliza só `/`, ver G-019).
  Windows aceita ambos os separadores em `fs/promises`.
- **Re-validação Zod em writes** — `writePendingSprint` chama
  `parseSprintPayload`; `writeAck` chama `parseSprintAck`. Defesa em
  profundidade contra `as SprintPayload` cast bypass. Erros viram
  `ContractValidationError`, não `FilesystemError`.
- **`writePendingSprint` sanitiza `body_html`** antes de gravar (ADR-014, §7.9).
  Idempotente.
- **JSON sempre pretty-printed** (`JSON.stringify(payload, null, 2)`) — pasta
  compartilhada é inspecionada manualmente pela TI da fábrica via
  `notepad`/`type`.
- **`mkdir(parent)` antes de cada `writeFileAtomic`** — convenção do contrato
  (G-018). Node cria recursivo idempotente; Memory é no-op.
- **`listPending`/`listAcks` aplicam RN-09** — arquivos malformados viram entry
  com `kind: 'invalid'`, não lançam. Único throw é `DirectoryNotFoundError`
  (pasta inexistente — precondição do polling).
- **Race-safe via `FileNotFoundError` skip** — se arquivo desaparece entre
  `listDir` e `stat`/`readFile` (Agent processou em outro lugar), entry é pulada
  silenciosamente. Outros `FilesystemError` propagam.
- **`readAndParseJson` retorna discriminated union** com
  `kind: 'not-found' | 'invalid'` em `ok: false` — consumers distinguem race
  condition (skip) de corrupção (entry `kind: 'invalid'`) sem string match.
- **`deletePending` aceita pending E cancel** (ambos vivem em `pending/`),
  rejeita ack e path traversal via `safeParseFilename` antes do `unlink`.
- **`CancelStore.writeCancel` (BL-C4-004 W2, Sessão 43)** — escreve atômico
  `cancel-<sprintId>.json` em `pending/` espelhando
  `PendingStore.writePendingSprint`. Re-valida via `parseSprintCancel`.
  Construtor opcional `pendingStore?` injeta dependência para remover arquivos
  `<sprintId>-<userId>.json` da sprint cancelada como parte do writeCancel
  (race-safe — `FileNotFoundError` silenciado).
  `WriteCancelResult.removedOriginals` reporta filenames limpos.
- **`ArchiveStore.moveToArchive` continua stub W3** com `NotImplementedError`
  (estende `FilesystemError`). Assinatura final preservada. **Remover stub em
  BL-C4-005 (W3).**
- **MemoryFilesystemAdapter é o mock de fato** — não há classe paralela.
  Paridade Node↔Memory garantida pela contract suite W0; testes do domain layer
  usam Memory direto (sem tmpdir, sem flakiness).

### Estrutura interna do Operator Agent (W1.C3 — Sessão 16)

A app `sprint-operator-agent` entregou todos os BLs C3 (003-008) em uma única
sessão (16). Arquitetura tri-camada Electron + state machine explícita no
overlay + orquestração de ack centralizada em `main/handlers/handleAck.ts`.
Pré-requisitos: contracts (W0/W1) + fs-adapter domain layer (W1).

```
apps/operator-agent/src/
├── shared/                              # tipos main↔renderer
│   ├── ipc-types.ts                     # Api nested (config/sprint/queue/overlay)
│   ├── types/queue.ts                   # QueueItem + QueueSnapshot
│   └── index.ts                         # barrel
│
├── main/
│   ├── index.ts                         # composition root + rebuildDeps + boot 7-step
│   ├── config.ts                        # loadConfig fail-soft + 3 ConfigError
│   ├── config.test.ts
│   ├── single-instance.ts               # W0 mantido
│   ├── single-instance.test.ts
│   ├── handlers/
│   │   └── handleAck.ts                 # orquestração ack — extraído para testabilidade
│   └── services/
│       ├── index.ts                     # barrel
│       ├── trayStateService.ts          # puro — computeTrayIconColor/Menu/Tooltip
│       ├── trayStateService.test.ts
│       ├── trayService.ts               # integra Electron Tray (boot/setState/balloon)
│       ├── queueService.ts              # FIFO + dedup + EventEmitter
│       ├── queueService.test.ts
│       ├── historyService.ts            # cache + ensureFolder + archive + initializeFromDisk
│       ├── historyService.test.ts
│       ├── pollingService.ts            # setTimeout recursivo (não setInterval)
│       ├── pollingService.test.ts
│       ├── overlayService.ts            # state machine + timer + IPC push
│       ├── overlayService.test.ts
│       ├── ackService.ts                # writeDisplayed (não-throw) + writeAcknowledged (throw)
│       ├── ackService.test.ts
│       └── integration.test.ts          # E2E mock OverlayService + real domain
│
├── preload/
│   └── index.ts                         # contextBridge expõe window.api = Api
│
└── renderer/
    ├── App.tsx                          # orquestra hooks + <Overlay />
    ├── env.d.ts                         # Window['api']: Api
    ├── main.tsx                         # entry React + StrictMode
    ├── test-setup.ts                    # window.api mock global + cleanup RTL
    ├── styles/global.css                # dark theme + accent yellow + font-size-meta 160px
    ├── __test-fixtures__/sprint.ts      # makePayload helper
    ├── stores/                          # useCurrentSprintStore + useQueueStore + barrel
    ├── hooks/                           # useIncomingSprint (pull+push) + useQueueUpdated
    └── components/
        ├── Overlay/                     # grid 3-rows (header + sprint + footer)
        ├── SprintCard/                  # h1 + body sanitizado + meta gigante
        ├── AckButton/                   # functional + loading + erro inline
        ├── DeadlineBadge/               # HH:MM estático (countdown ao vivo é W2)
        └── QueueIndicator/              # "+N aguardando" condicional
```

**Convenções específicas do Agent (W1.C3):**

- **Boot 7-step** ordenado em `main/index.ts`: single-instance → `app.whenReady`
  → `trayService.boot('loading')` → try `rebuildDeps()` → catch ConfigError vira
  `config_error` + balloon → registerIpcHandlers → `pollingService.start()`
  interno do rebuildDeps.
- **`rebuildDeps()` instantiate-once** — pattern do Leader (ADR-017). Services
  criados no primeiro sucesso; chamadas subsequentes (recovery) apenas validam
  config e atualizam tray. Limitação conhecida: mudança de `shared_path` exige
  restart do app.
- **Fail-soft em vez de fail-fast** (D3 da sessão) — supersede ADR-012 W0 que
  terminava o app. Agora tray vermelho + balloon, polling NÃO inicia, processo
  persiste. Recovery via IPC `config:get` quando renderer reabrir.
- **State machine do overlay** — `hidden | showing | minimized` com transitions
  documentadas no `overlayService`. Timer resetado em
  `showSprint`/`restoreCurrent`; cancelado em `minimize`/`hide`/
  `clearTimer`/`destroy`. `notifyStateChange` via EventEmitter composto (não
  estendido).
- **Pull pattern `sprint:request-current`** — renderer pulla currentItem no
  mount; resolve race entre `webContents.send` e useEffect register. Push
  `sprint:incoming` cobre updates subsequentes (ack → próxima).
- **Re-sanitização defensiva no renderer** (CLAUDE.md §7.9) — `SprintCard` chama
  `sanitizeBodyHtml` mesmo sabendo que Leader já sanitizou via
  `PendingStore.writePendingSprint`. Idempotência (ADR-014) garante segundo
  passe não muta o output. 4 XSS adversariais no test confirmam.
- **Campo `minimize_after_seconds` extra-schema** — `@sprint/contracts` é
  imutável; `loadConfig` extrai via spread+rest ANTES de `safeParseAgentConfig`.
  Validação 1-300s local; default 30s.
- **Dedup pós-restart via cache** (D5 da sessão) —
  `historyService.initializeFromDisk` faz `fs.readdir` recursivo no
  `<userData>/historico/<dia>/*.json` no boot. Polling consulta
  `isAlreadyArchived(filename)` antes de enfileirar.
- **Ack em 2 momentos** (BL-C3-007) — `writeDisplayed` na exibição (não-throw,
  log warn) + `writeAcknowledged` no "Recebi" (throw — operador precisa saber).
  `writeAcknowledged` re-lê via `listAcks` para preservar `displayed_at`
  original; fallback `now`.
- **`handleAck` extraído em `main/handlers/`** — testabilidade. `main/index.ts`
  faz `void bootstrap()` no top-level, importar daria side effect. Função pura
  recebe `HandleAckDeps`.
- **Polling com `setTimeout` recursivo, não `setInterval`** — evita overlap se
  ciclo demorar. `DirectoryNotFoundError` em `pending/` é benigno (catch
  específico, não loga error).
- **`OverlayService` mockado em testes** — `BrowserWindow` real exige Electron
  runtime + display. Para `overlayService.test.ts`, mock via `vi.hoisted()`
  (G-015 atualizado). Para integration test, OverlayService inteiro é mockado.
- **`now: () => Date` injetável** em ackService + historyService +
  pollingService — integration test determinístico sem `vi.useFakeTimers` (que
  dá race com `void writeDisplayed` microtasks).
- **Tray "Sair" oculto** (RN-04 W1) — menu tem "Mostrar sprint atual" +
  "Histórico local" + "Sobre". Fortificação com senha admin em W3.
- **Workflow CI `build-agent.yml`** espelhando `build-leader.yml` — runner
  windows-latest, `pnpm --filter ... run make`, upload-artifact. Build local
  falha pelo ESET (G-009).

> **Atualização W2 — BL-C3-009/010/011/012/015/016 (Sessão 21):**
>
> Refinamento completo do C3 na W2. Mudanças por camada:
>
> - **`components/SprintCard/` e `components/AckButton/` deletados** —
>   funcionalidade (loading state, error inline, warning F-024, title + body
>   - meta gigante) subsumida pelo novo `Overlay.tsx` que consome `<Overlay>` do
>     `@sprint/ui-kit` (BL-C3-015). `<DeadlineBadge>` e `<QueueIndicator>`
>     preservados (reused no body slot).
> - **`<ThemeProvider>` do `@sprint/ui-kit` envolve App.tsx** — tokens
>   `--sprint-*` em `:root` por cascata. `styles/global.css` reduzido a reset +
>   body básico via tokens do ui-kit. Zero hex/px hardcoded fora de tokens
>   (BL-C3-016).
> - **Meta gigante usa `--sprint-font-size-4xl` (120px)** — antes 160px local.
>   Tier canônico "métrica gigante" definido no C9.
> - **PollingService refatorado** (BL-C3-011): `listPending` sem filter userId
>   (capta cancels broadcast); sprints de outros operadores filtradas inline em
>   `processSprint`. Adiciona `processCancel`: `queueService.removeBySprintId` +
>   `overlayService.hide()` se exibida
>   - archive + delete. `overlayService?` agora em PollingDeps.
> - **QueueService ordenação por `criado_em`** (BL-C3-010): insert ordenado
>   preservando items[0] (sprint exibida não-preempted).
>   `removeBySprintId(sprintId)` adicionado (BL-C3-011).
> - **HistoryService.loadLastArchived** (BL-C3-009): lê último JSON válido em
>   `<userData>/historico/<dia>/`, filtrando cancels via `safeParseFilename`.
>   NÃO atualiza cache (leitura passiva).
> - **OverlayService.reopenFromHistory + closeReopened** (BL-C3-009): abre
>   janela em modo "reopen" sem timer e sem currentItem; flag `reopenedMode`
>   rastreia para closeReopened ser no-op fora do modo.
>   `showSprint`/`hide`/`destroy` resetam o flag.
> - **PollingService.processSprint chama `historyService.archive` em
>   deadline-passed** (BL-C3-012): antes só `markProcessed`; agora arquiva
>   localmente para auditoria. Fallback markProcessed em falha.
> - **TrayState ganha ação `'reopen-last'`** (BL-C3-009): enabled iff
>   `kind === 'idle'`. Item "Reabrir último aviso" no menu.
>   `trayService.displayInfoBalloon` para feedback "nenhum aviso para reabrir".
> - **IPC novos** (BL-C3-009): `IncomingSprintEvent.reopened?` (opcional);
>   `Api.overlay.closeReopened()`; handler `overlay:close-reopened` →
>   `overlayService.closeReopened()`.
> - **Renderer**: `useCurrentSprintStore` ganha `isReopened`.
>   `useIncomingSprint` passa `event.reopened ?? false`. Label do botão do
>   `<Overlay>` dinâmico: "Confirmando…" (loading), "Fechar" (reopened),
>   "Recebi" (normal). Guard `if (loading) return;` contra double-click — ui-kit
>   button não tem disabled prop.
> - **Auto-close decision**: `autoCloseSeconds={0}` no `<Overlay>` do ui-kit.
>   Timer permanece no main (`overlayService.minimizeAfterMs`). Única fonte de
>   verdade evita race entre timers.
> - **Total testes do Agent**: 199 (W1) → 240 (W2). +41 testes cobrindo
>   ordenação por criado_em, archive em deadline-passed, loadLastArchived,
>   reopenFromHistory/closeReopened, tray "reopen-last", processCancel
>   (queue/overlay/archive), Overlay refatorado (loading/error/warning/ reopen).
>   Coverage thresholds inalterados (W1.C8 baseline).

> **Atualização W2 — Overlay realmente transparente + drag horizontal + refino
> (Sessão 26):**
>
> Sessão 26 atende 4 issues reportadas após validar a Sessão 25:
>
> **(1) Overlay continuava com fundo dark** — Sessão 25 fix do ThemeProvider div
> era necessário mas insuficiente; `body` ainda tinha
> `background: var(--sprint-color-background)` (dark) bloqueando a transparência
> da BrowserWindow. Fix: `main.tsx` adiciona `body.overlay-mode` (paralelo a
> `body.pill-mode`); `global.css` regra combinada → transparent. Operador agora
> vê APENAS o card central.
>
> **(2) Drag horizontal da pill** — Renan queria "drag-and-drop, mas somente
> horizontal". Implementação:
>
> - `pillService` ganha `beginDrag(screenX)` / `dragTo(screenX)` / `endDrag()` /
>   `isDragging()` — `screen.X` absoluto evita feedback loop. Clamp ao display
>   primário.
> - IPC `pill:begin-drag` / `pill:drag-to` / `pill:end-drag`.
> - `<Pill>` ui-kit aceita `onPointerDown/Move/Up/Cancel` props.
> - PillApp substitui `onClick` por pointer events. Threshold 5px distingue
>   click (toggle expand) de drag (IPC, sem toggle). `setPointerCapture` no
>   pointerdown garante eventos contínuos.
> - `touch-action: none` no `.pill` evita interferência do browser.
>
> **(3) "Suas metas" quebrando linha** — `.label` no `<Pill>` ui-kit ganha
> `white-space: nowrap`. Pill expande horizontalmente conforme necessário.
>
> **(4) Animação tosca/bouncy** — substitui `cubic-bezier(0.34, 1.4, 0.64, 1)`
> (spring overshoot) por `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out expo, sem
> overshoot). Duração 320ms → 360ms. Adiciona content fade-in animation 280ms no
> `.compactLayout`/`.expandedLayout` (translateY 4px → 0 + opacity). Respeita
> `prefers-reduced-motion`.
>
> **Total testes:** Agent 283 → 297 (+14 drag); ui-kit 60 estável.

> **Atualização W2 — Canvas transparentes + animações fluidas (Sessão 25):**
>
> Sessão 25 atende 3 issues visuais reportadas por Renan após validar a Sessão
> 24:
>
> **(1) Pill com retângulo dark em volta** — `ThemeProvider.module.css` do
> ui-kit aplica `background: var(--sprint-color-background)` no `.themeProvider`
> div. PillApp passa `className="transparent-theme"`; `global.css` override
> garante background transparente. Pill window agora mostra APENAS a pill no
> canvas 340×160 (resto transparent).
>
> **(2) Overlay com backdrop dark cobrindo a tela inteira** — `overlayService`
> adiciona `transparent: true` no BrowserWindow. App.tsx passa
> `className="overlay-transparent-theme"`. `global.css` sobrescreve
> `--sprint-color-backdrop` para `transparent` no escopo da div — propaga para o
> `.overlay` do ui-kit que usa esse token via `var(--sprint-color-backdrop)`.
> Operador vê APENAS o card central; apps abaixo permanecem visíveis ao redor.
>
> **(3) Pill com prop position** — `<Pill>` ganha
> `position?: 'left' | 'center' | 'right' | number` (atalhos para 0/50/100% +
> percent contínuo 0-100). Pill é estruturada em 3 spans: positioner outer
> (inline style com left% + translateX), entrance middle (animação), pill button
> (transitions). PillApp passa `'center'` por ora; futuro (W3) traz
> drag-and-drop ou config UI.
>
> **Animações fluidas (bônus pedido pelo Renan):**
>
> - **Overlay card**: entrance `overlay-card-enter` 420ms cubic-bezier expo
>   (fade + slide do topo + scale 0.96→1).
> - **Overlay botão "Recebi"**: pulse sutil 2400ms infinito no glow do shadow.
> - **Pill entrance**: `pill-enter` 480ms cubic-bezier expo (slide do topo +
>   fade).
> - **Pill transitions compact ↔ expanded**: cubic-bezier(0.34, 1.4, 0.64, 1)
>   com overshoot pequeno = spring imersivo. Duração 320ms (antes era 250ms
>   ease-in-out).
> - Todas respeitam `@media (prefers-reduced-motion: reduce)`.
>
> **Total testes:** Agent 283 estável; ui-kit 60 (+7 do prop position).

> **Atualização W2 — Redesign pill standalone (Sessão 24):**
>
> Sessão 24 redesigna o pill conforme feedback visual e comportamental do Renan
> após validação manual. Substitui `<OverlayMinimized>` (com bar full-width) por
> novo `<Pill>` standalone no `@sprint/ui-kit` — só a badge pendurada do topo,
> sem bar atrás. BrowserWindow encolhe de full-screen-width × 100px → 340×160
> transparent top-center. Apps abaixo permanecem visíveis/clicáveis fora da
> pill.
>
> **Comportamento:**
>
> - **Click no pill NÃO reabre overlay** — alterna entre compact (linha única) e
>   expanded (grid 2×2 com métrica + "Até: HH:MMh" + label + data badge)
>   puramente local no renderer.
> - **Auto-collapse após 5s** sem novo click — `useEffect` agenda `setTimeout`
>   quando expanded vira true; cleanup cancela em re-click, unmount, ou push de
>   nova sprint.
> - **Overlay fullscreen aparece APENAS em dispatch novo** — elimina o bug "não
>   consigo fechar a overlay novamente" reportado.
>
> **API IPC removida** (breaking interno): `Api.pill.expand`,
> `ipcMain.handle('pill:expand', ...)`,
> `pillService.hideWindow/showWindow/ getFullPayload` (split temporário da
> Sessão 23 não precisa mais existir).
>
> **PillService API simplificada:** `show(payload)` / `dismiss()` / `hide()`
> (alias) / `getCurrent()` / `isShown()` / `destroy()`. Window 340×160
> transparent top-center via `screen.getPrimaryDisplay().bounds`. Deadline timer
> mantido. `PillCurrentInfo` ganha `deadline_at` para o renderer formatar
> "HH:MMh" + "DD/MM" badge.
>
> **Wires limpos em main/index.ts:** `overlay:close-reopened` não chama mais
> `pillService.showWindow()`; `handleReopenLast` não chama mais
> `pillService.hideWindow()` (pill permanece atrás do overlay; mesmo z-level
> screen-saver, pill ocupa só topo 160px).
>
> **Total testes:** Agent 283 estável; ui-kit 53 (+14 do `<Pill>`).

> **Atualização W2 — BL-C3-017 + fix CSS (Sessão 22):**
>
> Continuação da Sessão 21, incorporando: (a) fix do CSS bundle do
> `@sprint/ui-kit` que não estava sendo carregado em runtime; (b) implementação
> completa do BL-C3-017 (orquestração Overlay ↔ OverlayMinimized via novo
> `pillService`).
>
> **Fix CSS:**
>
> - `packages/ui-kit/package.json#exports` ganha subpath `./styles.css`
>   apontando para `./dist/assets/style.css` (bundle extraído pelo Vite library
>   mode com as classes dos componentes).
> - `apps/operator-agent/src/renderer/main.tsx` adiciona
>   `import '@sprint/ui-kit/styles.css'` como side-effect antes do App.
> - Sem isso, em produção o JS do ui-kit carregava mas as classes
>   (.overlay/.card/.acknowledgeButton/etc) e os tokens `--sprint-*` ficavam
>   órfãos em `node_modules/@sprint/ui-kit/dist/assets/style.css`.
> - Bundle CSS do Agent foi de 2.45 kB → 9.51 kB (+7 kB) após o fix.
>
> **BL-C3-017 — orquestração Overlay ↔ OverlayMinimized:**
>
> - **`pillService.ts` (novo, em main/services/)** — gerencia BrowserWindow
>   dedicada do pill. Quando aparece: handleAck final + queue vazia. Quando
>   some: clique no pill (expand → reopen overlay full), nova sprint via polling
>   (queueService.onNextSprint hide), ou clique "Reabrir último aviso" no tray.
>   Métodos públicos: `show(payload)`, `hide()`, `getCurrent()`,
>   `getFullPayload()`, `isShown()`, `destroy()`.
> - **Window strategy**: nova BrowserWindow (não reusa a do overlay).
>   `frame: false`, `transparent: true`, `alwaysOnTop screen-saver`,
>   `skipTaskbar: true`, `focusable: false` (não rouba foco), largura = primary
>   display workAreaSize.width, altura 100px ancorada em top:0.
> - **Renderer separado**: `PillApp.tsx` renderiza `<ThemeProvider>` +
>   `<OverlayMinimized>` (ui-kit). `main.tsx` detecta `?pill` em
>   `window.location.search` e monta `<PillApp>` em vez de `<App>`. Mesmo
>   preload, mesma surface IPC.
> - **Pull + push**: PillApp pulla via `window.api.pill.requestCurrent` no
>   mount; subscribe a `pill.onUpdate` para atualizações (sprint A acked → pill
>   A, sprint B acked → push atualiza para B sem destruir janela).
> - **`body.pill-mode { background: transparent }`** — main.tsx adiciona classe
>   quando `?pill` para canvas do BrowserWindow do pill ficar transparente fora
>   da bar do OverlayMinimized.
> - **Wire em handleAck**: `pillService?` opcional em `HandleAckDeps`. Após
>   ack + success: `next === null` → `overlayService.hide()` +
>   `pillService.show(item.payload)`; `next !== null` →
>   `overlayService.showSprint(next)` + `pillService.hide()`. Sem pillService
>   injetado, comportamento legado preservado (backward compat).
> - **IPC novos**: `pill:request-current` (renderer pulls), `pill:expand`
>   (renderer click → main reabre overlay full e esconde pill), `pill:update`
>   (main → renderer push para troca de sprint).
> - **Click no pill** (decisão Renan via AskUserQuestion): "Reabre overlay
>   fullscreen para revisão" — pattern BL-C3-009 reopen. Operador clica "Fechar"
>   no overlay reaberto → fim do ciclo, pill não volta.
> - **Pill só após ack** (decisão Renan): auto-close por timeout (sem ack)
>   continua hide() invisível → tray como antes; pill = "concluída" matching
>   check pontilhado do design.
> - **Total testes do Agent**: 240 → 269. +29 (18 pillService + 7 PillApp + 4
>   handleAck wire).

### Estrutura interna de `@sprint/logger` (W1.C6 — Sessão 17)

Pacote enxuto, source-first. Espelha a estrutura de `contracts` e `fs-adapter`
(módulos top-level + barrel `src/index.ts`). Entregue inteiro em uma sessão
(BL-C6-001):

```
packages/logger/src/
├── types.ts             # Logger, LogLevel, LoggerOptions, ChildBindings (export type only)
├── config.ts            # isDevelopment, isValidLevel, resolveLevel (internos)
├── config.test.ts       # 25 testes
├── createLogger.ts      # factory + helpers privados (buildPinoInstance, wrap)
├── createLogger.test.ts # 29 testes (incl. it.each para 5 níveis × 3 formas de chamada)
├── rootLogger.ts        # singleton lazy + _resetRootLoggerForTesting
├── rootLogger.test.ts   # 3 testes
└── index.ts             # barrel: createLogger, rootLogger, 4 tipos
```

**Convenções específicas do logger:**

- **API estreita por design** — barrel exporta `createLogger` + `rootLogger` + 4
  tipos. Helpers internos (`isDevelopment`, `isValidLevel`, `resolveLevel`,
  `_resetRootLoggerForTesting`) ficam privados. Pino expõe ~30 métodos; nós
  expomos 7 (5 níveis + `child` + `name`). Trocar Pino futuramente afeta só esse
  pacote.
- **Wrapper opaco em torno do Pino** — `wrap(pinoInstance, name)` em
  `createLogger.ts` retorna objeto com superfície reduzida. `child(bindings)`
  recursa via `wrap` para que o sub-logger também enxergue só nossa interface.
- **Dispatch explícito por nível** — cada método (`debug/info/warn/error/fatal`)
  tem 3 ramos (string-only / obj+msg / obj-only) para preservar type-safety sem
  `any`. Verboso (~30 linhas para 5 níveis) mas determinístico.
- **`options.bindings` aplicado via `.child()` após criação** — preserva o
  default `base: { pid, hostname }` do Pino (vs. sobrescrever via
  `options.base`).
- **Convenção de naming dos loggers**: `componente-servico` em kebab-case. Ex:
  `polling-service`, `leader-main`, `dispatch-service`, `overlay-service`.
- **Detecção dev/prod via `NODE_ENV`** — `!= 'production'` → pretty print via
  `pino-pretty` (worker thread); `production` → JSON estruturado em stdout. Com
  `options.destination` customizado (testes), sempre JSON síncrono no stream
  fornecido.
- **`LOG_LEVEL` env var override** — case-insensitive. Precedência:
  `options.level` > env > default por `NODE_ENV` (`'debug'` em dev, `'info'` em
  prod). Valor inválido em `LOG_LEVEL` (ex.: `verbose`, `silly`) é ignorado
  silenciosamente, fallback para o default.
- **`rootLogger()` é singleton lazy** — primeira chamada cria; subsequentes
  retornam a mesma instância. Lazy permite que código de boot stub env vars
  antes do primeiro uso. `_resetRootLoggerForTesting()` força reconstrução em
  testes que mudam `NODE_ENV`/`LOG_LEVEL`.
- **Captura de output em testes via `PassThrough`** — pattern documentado no
  README do pacote (seção "Para testes"). Pino com stream customizado escreve
  síncrono, mas o evento `data` propaga no próximo tick —
  `await new Promise(r => setImmediate(r))` é suficiente para flush.
- **Coverage**: 100% nos 3 arquivos com runtime (config.ts, createLogger.ts,
  rootLogger.ts). `types.ts` (zero statements de runtime — só `export type`) e
  `index.ts` (barrel, excluído por config) não aparecem.

**Pendência conhecida da W3 (BL-C6-002):**

Integração nos apps fica para W3 — refactor sistemático de `console.*` no Agent
e adição de logging onde o Leader hoje lança silenciosamente. Locais exatos
apurados na Sessão 17:

- `apps/operator-agent/src/renderer/hooks/useIncomingSprint.ts:39` —
  console.warn
- `apps/operator-agent/src/main/index.ts:75-77` — console.error
  (uncaughtException)
- `apps/operator-agent/src/main/index.ts:88` — console.error
  (unhandledRejection)
- `apps/operator-agent/src/main/index.ts:171, 204` — console.warn (handleAck
  deps)
- `apps/operator-agent/src/main/index.ts:216, 219` — console.warn/error (polling
  deps)
- `apps/operator-agent/src/main/index.ts:319` — console.error (handleAck
  fallback)

O `PollingService` já tem o slot de injeção pronto (`PollingLogger` interface
com `SILENT_LOG` default) — refactor BL-C6-002 será literalmente trocar o
wrapper inline `{warn: console.warn, error: console.error}` por wrapper
construído a partir do `createLogger`. **Leader** tem ZERO `console.*` hoje, mas
ganha logging onde só lança erro silenciosamente (`dispatchService.dispatch`
try/catch isolado por operador, `loadLeaderConfig` 5 ConfigError,
`OperatorsService.list`).

Pendências adicionais (W3+): BL-C6-003 (file transport com `pino-roll` e rotação
diária em `<userData>/logs/`), BL-C6-004 (Sentry / serviço externo — W4+).

### Estrutura interna de `@sprint/ui-kit` (W2.C9 — sessão BL-C9-completo)

Quarto package compartilhado. **Diverge do padrão source-first** dos outros
(contracts/fs-adapter/logger) — é o primeiro com React + CSS Modules, então
adota Vite library mode + `vite-plugin-dts` (rollupTypes) para isolar processing
de CSS e gerar `.d.ts` agrupado. Entregue inteiro em uma sessão (6 BLs).

```
packages/ui-kit/
├── dev/
│   ├── SCOPE_QUESTION.md             # audit trail BL-C9-006 (criado p/ Renan)
│   └── palette-preview.html          # preview standalone DARK theme
├── src/
│   ├── components/
│   │   ├── Overlay/                  # BL-C9-003 — chrome do overlay fullscreen
│   │   ├── OverlayMinimized/         # BL-C9-006 — pill compacto pós minimize
│   │   ├── TextBlock/                # BL-C9-004 — HTML sanitizado com tipografia
│   │   └── index.ts                  # barrel
│   ├── theme/
│   │   ├── ThemeProvider/            # BL-C9-005 — wrapper + tokens.css + reset
│   │   ├── reset.css                 # CSS reset mínimo (sem font/color)
│   │   └── index.ts                  # barrel
│   ├── tokens/
│   │   ├── tokens.css                # BL-C9-002 — DARK theme (--sprint-* prefix)
│   │   └── tokens.test.ts            # structure + anti-regression DARK
│   ├── css.d.ts                      # tipos para CSS Modules + side-effect CSS
│   ├── test-setup.ts                 # @testing-library/jest-dom/vitest
│   ├── index.ts                      # barrel raiz (Overlay + OverlayMinimized
│   │                                 #   + TextBlock + ThemeProvider + tipos)
│   └── index.test.ts                 # smoke (UI_KIT_PACKAGE_VERSION)
├── package.json                      # ESM + exports tree-shakeable + ./tokens.css
├── tsconfig.json                     # rootDir ./src + references tsconfig.node
├── tsconfig.node.json                # vite.config.ts + vitest.config.ts (G-010)
├── vite.config.ts                    # library mode + dts + static-copy tokens.css
├── vitest.config.ts                  # jsdom + plugin-react (coverage off, W3)
└── README.md
```

**Convenções específicas do ui-kit (W2.C9):**

- **Vite library mode (não source-first)** — diverge do padrão de
  contracts/fs-adapter/logger porque CSS Modules + tree-shaking de barrel não
  são triviais com tsc puro. Build produz
  `dist/{index.js, index.d.ts, tokens.css}`. Consumers (Agent em BL-C3-015)
  referenciarão via `dist/` em produção; em dev/test podem usar source via path
  alias em seu próprio tsconfig (não em `tsconfig.base.json` — decisão Renan).
- **`react` e `react-dom` como peerDependencies** (`^18.3.0`) — versão fica com
  os apps. Em devDependencies as mesmas versões para Vite/Vitest standalone.
- **`@sprint/contracts` como `dependency` workspace** (`workspace:*`) — primeira
  ligação inter-package partindo de C9. Usado apenas pelo `<TextBlock>` para
  `sanitizeBodyHtml`. Externalizado em `rollupOptions.external` no vite.config
  (não vai pro bundle).
- **Tokens com prefixo `--sprint-` obrigatório** (RNF-23) — `tokens.test.ts`
  valida no CI. Zero hex hardcoded em `.module.css` de componentes.
- **Tema DARK** extraído da imagem 'Hora do Rush!' anexada à sessão: background
  `#1A1A1A` (card), text `#FFFFFF`, primary `#F5A557` (warm orange). Test
  anti-regressão para light theme em `tokens.test.ts`.
- **`<ThemeProvider>` sem Context API** — design tokens propagam por cascata
  CSS. Múltiplas instâncias aninhadas são idempotentes (tokens resolvem na
  cadeia de herança natural).
- **CSS reset em arquivo separado** (`theme/reset.css`) importado pelo
  ThemeProvider — separa responsabilidades (reset zera ambiente, tokens povoam).
  Reset NÃO toca font/color/background (esses ficam no `.module.css` do
  ThemeProvider para serem rastreáveis via tokens).
- **`<TextBlock>` sanitiza em todo render** (defesa em profundidade, CLAUDE.md
  §7.9) — sem memoização. Otimização tardia (BL-C8-008 ou wave 4).
- **`<Overlay>` body é slot (`ReactNode | string`)** — chrome genérico; host
  (Agent em BL-C3-015) renderiza conteúdo estruturado (métrica gigante,
  deadline, status row, etc.) como children. `acknowledgeLabel` default
  `'Recebido'` matching design da imagem.
- **`<OverlayMinimized>` (BL-C9-006, NOVO)** — componente adicional aprovado
  pelo Renan via SCOPE_QUESTION.md após análise da segunda imagem anexada
  mostrar pill on-screen (não tray icon como CLAUDE.md §1 sugeria). Props
  `label`, `value`, `onClick`, `variant?`. **Sem prop `icon`** (SVG check
  pontilhado fixo) e **sem positioning CSS** (host decide). Coordenação Overlay
  ↔ OverlayMinimized fica no Agent em BL-C3-017.
- **fireEvent em vez de userEvent para tests de click** — userEvent v14 conflita
  com `vi.useFakeTimers` (delays internos pendurados aguardando relógio real).
  `fakeTimers` escopado por teste com try/finally, NÃO global em beforeEach
  (evita contaminação cruzada).
- **`tsconfig.node.json`** para `vite.config.ts` e `vitest.config.ts` (padrão
  leader, G-010). Sem isso, ESLint `projectService: true` rejeita os arquivos
  com "not found by the project service".
- **`src/test-setup.ts` dentro de `src/`** (não na raiz) — match
  `include: ["src/**/*.ts"]` do tsconfig.json sem precisar de exception.
- **Coverage thresholds OFF** nesta sessão — apenas 31 smoke tests. Meta de 85%+
  entregue em BL-C8-008 (sessão dedicada).
- **`commitlint.config.cjs`** ampliado para aceitar scope `C9` (sem isso, todos
  os commits desta sessão seriam rejeitados).

**Pendências conhecidas (waves futuras):**

- **BL-C3-015 (W2)** — Operator Agent refatora overlay para consumir
  `@sprint/ui-kit`. Adiciona path alias `@sprint/ui-kit` em
  `apps/operator-agent/tsconfig.json`. Substitui markup atual por
  `<ThemeProvider>` + `<Overlay>` + `<TextBlock>`.
- **BL-C3-017 (W2)** — orquestração `<Overlay>` ↔ `<OverlayMinimized>` no Agent
  (state machine + window management — BrowserWindow frameless+topmost para o
  pill).
- **BL-C7-008 (W3)** — ADR-022: adoção do C9.
- **BL-C7-009 (W3)** — ADR-023: não adoção de Storybook na v1.0.
- **BL-C8-008 (W3)** — testes unitários ≥ 85% no ui-kit.

---

## 5. Componentes

| ID  | Nome                        | Tipo          | Artefato                  |
| --- | --------------------------- | ------------- | ------------------------- |
| C0  | Foundation & Infrastructure | Infra         | Monorepo, CI/CD, build    |
| C1  | Shared Contracts            | Library       | `@sprint/contracts`       |
| C2  | Leader Application          | Desktop App   | `SprintLeader.exe`        |
| C3  | Operator Agent              | Desktop App   | `SprintAgent.exe`         |
| C4  | Filesystem Adapter          | Library       | `@sprint/fs-adapter`      |
| C5  | Installer & Deployment      | Package       | `.msi`/`.exe` instalador  |
| C6  | Observability & Logging     | Library       | `@sprint/logger`          |
| C7  | Documentation               | Docs          | `/docs` (futuro), READMEs |
| C8  | Quality Assurance           | Cross-cutting | Testes + relatórios       |
| C9  | Design System / UI Kit      | Library       | `@sprint/ui-kit`          |

Detalhes de cada componente e itens do backlog estão no documento externo de
Backlog (perguntar a Renan se necessário).

---

## 6. Waves de Desenvolvimento

| Wave | Nome                     | Duração est. | Status       |
| ---- | ------------------------ | ------------ | ------------ |
| W0   | Foundation               | 1 semana     | ✅ concluída |
| W1   | MVP Core                 | 2 semanas    | ✅ concluída |
| W2   | Refinement + Design Sys  | 1 semana     | 🔄 em curso  |
| W3   | Production Readiness     | 1 semana     | ⏸️           |
| W4   | Hardening & Future-proof | 1 semana     | ⏸️           |

> **Atualize esta tabela ao fim de cada wave.**

### Wave 0 — Foundation (atual)

**Objetivo:** Bootstrap completo do projeto. Repositório funcional, CI verde,
arquivos de contexto criados e commitados.

**Entregáveis:**

- Estrutura de diretórios (seção 4 deste documento)
- `pnpm install` funciona sem erros
- `pnpm turbo build` funciona (mesmo com apps vazios)
- CI no GitHub passa em push pra `develop`
- ESLint + Prettier + Husky + commitlint configurados
- Changesets inicializado
- `CLAUDE.md` consolidado e revisado
- `DECISIONS.md` com pelo menos ADR-001 (monorepo) e ADR-002 (Electron)
  registrados
- `CHANGELOG.md` com seção `[Unreleased]` preparada
- `SESSION_LOG.md` com primeira entrada

### Gate W0 → W1

Verificar:

- [ ] Monorepo funcional, `pnpm install` sem erros
- [ ] CI rodando lint + build + test em todo push
- [ ] Apps `leader` e `operator-agent` iniciam (mesmo vazios) e geram EXE
- [ ] 4 arquivos de contexto persistidos no commit

---

## 7. Convenções de Código

### 7.1. Nomenclatura

| Elemento            | Convenção                                 |
| ------------------- | ----------------------------------------- |
| Arquivos TypeScript | `kebab-case.ts`                           |
| Componentes React   | `PascalCase.tsx`                          |
| Interfaces          | `PascalCase` (sem prefixo `I`)            |
| Tipos               | `PascalCase`                              |
| Constantes          | `SCREAMING_SNAKE_CASE`                    |
| Funções e variáveis | `camelCase`                               |
| Schemas Zod         | `camelCaseSchema` (`sprintPayloadSchema`) |
| Branches Git        | `feature/BL-CX-NNN-descricao-curta`       |

### 7.2. TypeScript

- `strict: true` sempre
- `any` proibido exceto quando justificado em comentário
- Erros tipados (`class FsAdapterError extends Error`), nunca strings
- `import type` explícito pra type-only imports

### 7.3. Imports

- Imports absolutos via path aliases:
  `import { SprintPayload } from '@sprint/contracts'`
- Nunca `../../../`
- Ordem: 1) libs externas, 2) packages internos `@sprint/*`, 3) imports
  relativos

### 7.4. Async

Sempre `async/await`. Nunca `.then().catch()`.

### 7.5. Logging

Sempre via `@sprint/logger`. Nunca `console.log` — ESLint rule bloqueia.

### 7.6. Estado React

Zustand para estado global. `useState`/`useReducer` para local. **Não use
Context para estado mutável** (apenas pra injeção de dependência).

### 7.7. Testes

- Vitest com `describe` / `it`
- Arrange / Act / Assert separados
- Nome descreve comportamento, não implementação
- Cobertura mínima: C1, C4, C6 ≥ 80%; C2, C3 ≥ 60%

#### 7.7.1. Coverage thresholds por package

Thresholds materializados nos `vitest.config.ts` de cada workspace. `pnpm test`
(raiz) e `pnpm test:coverage` (raiz) orquestram via Turborepo.

| Package                        | Lines | Functions | Branches | Statements |
| ------------------------------ | ----: | --------: | -------: | ---------: |
| `@sprint/contracts`            |   98% |       98% |      95% |        98% |
| `@sprint/fs-adapter`           |   95% |       95% |      95% |        95% |
| `@sprint/logger`               |   95% |       95% |      90% |        95% |
| `sprint-operator-agent` (main) |   90% |       90% |      85% |        90% |
| `sprint-leader`                |   95% |       90% |      90% |        95% |

Cobertura realmente exercida (Sessão 18 — pós W1.C8 expansion):
`@sprint/contracts` **100/100/100/100** (230 → 317 testes; threshold 98/95/98/98
com folga); `@sprint/fs-adapter` **100/99.53/100/100** (235 → 294 testes;
threshold 95/95/95/95 com folga); `@sprint/logger` **100/100/100/100** (57
testes); `sprint-operator-agent` **97.76/91.47/95.4/97.76** (190 testes);
`sprint-leader` **96.89/94.51/93.84/96.89** (198 testes).

**Total monorepo: 1056 testes verdes.** Thresholds materializados — build falha
automaticamente se cobertura regredir.

Thresholds do `sprint-leader` materializados em sessão pós-auditoria W1
(2026-05-27, fix de F-017) — 95/90/90/95, com folga sobre o real
96.89/94.51/93.84/96.89. `main/index.ts` (boot) e `main/ipc.ts` (envelope)
seguem excluídos do coverage; testados via E2E em W3 (Playwright). Reporters
padronizados nos 4 workspaces:
`['text', 'json', 'json-summary', 'html', 'lcov']`.

### 7.8. Commits (Conventional Commits)

Formato:

```
<tipo>(<componente>): <descrição> [BL-CX-NNN]

[body opcional]
[footer opcional]
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`,
`perf`, `style`. Componente: `C0` a `C8`.

Exemplo: `feat(C1): zod schemas para SprintPayload [BL-C1-002]`

### 7.9. Sanitização de HTML

O campo `body_html` do `SprintPayload` é a única superfície de HTML controlada
pelo líder que vai parar num overlay renderizado. **Toda escrita e toda
leitura** do `body_html` passa por `sanitizeBodyHtml(html)` de
`@sprint/contracts` — não há exceção.

- **No Leader (C2):** sanitizar antes de gravar JSON em
  `pending/<sprintId>-<userId>.json` (BL-C2-007, W1).
- **No Agent (C3):** sanitizar antes de renderizar no overlay (BL-C3-004, W1). É
  idempotente — o segundo passe não muta o output do primeiro; defende contra
  adulteração do arquivo em trânsito.
- **Whitelist de tags:** `ALLOWED_HTML_TAGS` em `@sprint/contracts/constants`
  (RN-10): `<b>`, `<i>`, `<br>`, `<p>`, `<h1>`, `<span>`. **Não duplicar a
  whitelist** — sempre importar a constante. Mudança na whitelist exige ADR +
  bump em `SCHEMA_VERSION` se for incompatível.
- **Atributos:** zero permitidos. Nem `class`, nem `id`, nem `style`, nem
  `data-*`. Defesa contra handlers inline e `style: url(javascript:...)`.
- **Schema NÃO sanitiza.** Aceitar `<script>alert(1)</script>` em `body_html` é
  comportamento documentado do schema (ver `schemas/security.test.ts`).
  Sanitização é responsabilidade exclusiva de `sanitizeBodyHtml`.
- **Não usar `USE_PROFILES` no DOMPurify** — sobrescreve `ALLOWED_TAGS` e abre a
  whitelist inteira do profile HTML (`<div>`, `<table>`, etc). Ver ADR-014.

Ver ADR-014 para justificativa completa.

---

## 8. Configurações Críticas

### 8.1. Electron — segurança obrigatória

Toda `BrowserWindow` é criada com:

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true, // OBRIGATÓRIO
    nodeIntegration: false, // OBRIGATÓRIO
    sandbox: true, // OBRIGATÓRIO
    webSecurity: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

Comunicação main ↔ renderer **exclusivamente** via preload + IPC tipado.

### 8.2. Overlay TOPMOST (Agent)

```typescript
const overlay = new BrowserWindow({
  fullscreen: true,
  frame: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  webPreferences: {
    /* segurança da 8.1 */
  },
});

overlay.setAlwaysOnTop(true, 'screen-saver'); // nível máximo
```

### 8.3. Escrita atômica em filesystem

```typescript
import { writeFile, rename } from 'fs/promises';

async function writeAtomic(filepath: string, content: string) {
  const tmp = `${filepath}.tmp`;
  await writeFile(tmp, content, { encoding: 'utf-8' });
  await rename(tmp, filepath);
}
```

### 8.4. tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx"
  }
}
```

---

## 9. Regras Absolutas

Não interprete, não relativize.

### 9.1. Backlog é externo e imutável pra você

O backlog do projeto **não está neste repositório**. Renan o gerencia
manualmente. Você:

- Não cria itens BL-\*
- Não marca itens como concluídos
- Não altera estimativas ou prioridades
- Se identificar necessidade de mudança, registra observação em `SESSION_LOG.md`
  e comunica a Renan

### 9.2. Gates entre waves são manuais

Você nunca inicia uma wave sem confirmação explícita de Renan que a anterior
fechou.

### 9.3. Nada vai pra `develop` sem PR + review

Mesmo trabalho seu. Renan é o revisor padrão.

### 9.4. Testes não são opcionais

Item BL-\* "Must" exige testes unitários. Sem testes, item não fecha.

### 9.5. Senior engineering standards

Aplique padrões de produção crítica:

- Erros tipados, não strings
- Funções pequenas, responsabilidade única
- Comentários explicam **porquê**, não **o quê**
- Sem `any`, sem `// @ts-ignore`, sem `console.log`

### 9.6. Atomicidade de commits

Cada commit faz uma coisa. Refactor e feature em commits separados.

### 9.7. Mocks não vão pra `main`

Se você cria mock pra destravar trabalho, registra em `SESSION_LOG.md` e
comunica a Renan. Não merge sem remover.

---

## 10. Protocolo de Sessão (completo)

### 10.1. Início

Já descrito na seção 0.

### 10.2. Durante

- Trabalhe em **um item por vez** (ou pequeno grupo dependente)
- Atualize `DECISIONS.md` no momento da decisão arquitetural
- Atualize esta CLAUDE.md quando descobrir gotcha relevante ou mudar convenção
- Atualize `CHANGELOG.md` ao concluir item entregável
- Commits pequenos, conventional commits, com ID do item no scope

### 10.3. Fim

Antes de encerrar a sessão, sem exceção:

1. **Atualize `SESSION_LOG.md`** com nova entrada (formato no próprio arquivo)
2. **Garanta CI verde** se houve push
3. **Confirme arquivos de contexto persistidos** no commit final
4. **Resuma a sessão pro Renan** em 3-5 linhas

Se a sessão termina abruptamente, pelo menos `SESSION_LOG.md` deve ser
atualizado com entrada curta.

---

## 11. Onde está o resto da especificação

Os documentos detalhados (Requisitos completos, Stack expandida, Backlog
item-a-item, Plan operacional completo) **não estão no repositório**. Renan os
mantém externamente.

Quando precisar de detalhes específicos não cobertos aqui:

- **Itens BL-\*** → pedir a Renan o trecho relevante do backlog
- **Requisitos funcionais detalhados (RF-XX)** → pedir o documento de Requisitos
- **Justificativas profundas de stack** → consultar `DECISIONS.md` ou pedir o
  documento de Stack
- **Critérios de gate** → pedir a Renan ou consultar Backlog seção 4.2

> **Localização externa dos specs (preencher):** `_______________________`

---

## 12. Gotchas Conhecidos

Descobertas durante o desenvolvimento que economizam tempo da próxima sessão.
**Adicione aqui imediatamente ao descobrir.**

### G-001: `turbo.json` usa chave `tasks`, não `pipeline`

- **Sintoma:** warning de deprecação ao rodar `pnpm turbo build` se a chave
  `pipeline` for usada.
- **Causa:** Turborepo 2.0 renomeou `pipeline` → `tasks`. O documento de Stack
  externa (§11.2) ainda mostra `pipeline` no snippet de exemplo.
- **Solução:** sempre usar `tasks` no `turbo.json` (ver o arquivo na raiz como
  referência). `pipeline` segue funcionando com aviso, mas é dívida técnica.
- **Descoberto em:** Sessão 01 (2026-05-21), durante BL-C0-002.

### G-002: PowerShell bloqueia execução de `pnpm.ps1`

- **Sintoma:** `pnpm --version` no PowerShell retorna
  `UnauthorizedAccess: ...pnpm.ps1 não pode ser carregado...`.
- **Causa:** Execution policy padrão do Windows é `Undefined`/`Restricted`, que
  bloqueia scripts `.ps1` não-assinados. O shim do pnpm é `.ps1`.
- **Solução:** invocar pnpm via **Git Bash / WSL / cmd.exe** (todos funcionam).
  Alternativa permanente: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  (mexe na config do usuário Windows — pedir antes).
- **Descoberto em:** Sessão 01 (2026-05-21), durante a verificação de versões na
  Fase 1.

### G-003: Changesets recusa packages que não existem ainda

- **Sintoma:** `pnpm changeset status` falha com
  `ValidationError: The package or glob expression "@sprint/contracts" specified in the linked option does not match any package in the project`.
- **Causa:** Changesets valida `linked` e `ignore` contra o set real de
  workspaces presentes em `apps/*` e `packages/*`. Glob patterns tampouco passam
  se não casarem com nada.
- **Solução:** no momento do bootstrap (W0), `linked` e `ignore` ficam vazios em
  `.changeset/config.json`. O `.changeset/README.md` documenta a config alvo
  (`linked: [["@sprint/contracts", "@sprint/fs-adapter", "@sprint/logger"]]`,
  `ignore: ["sprint-leader", "sprint-operator-agent"]`) e aponta os itens BL que
  devem re-popular: BL-C1-001, BL-C4-001, BL-C6-001, BL-C2-001, BL-C3-001.
- **Descoberto em:** Sessão 01 (2026-05-21), durante BL-C0-006.

### G-004: ULID canônico que circula em prompts/docs é inválido

- **Sintoma:** Regex Crockford Base32 rejeita `01HX9K2M4F8N7P2Q5R3S6T7U8V` (a
  string "padrão de exemplo" que aparece em vários prompts, snippets e
  documentação).
- **Causa:** O índice 23 é `U`. Crockford Base32 **exclui** `I, L, O, U` (para
  reduzir ambiguidade visual). Strings que terminam em `...T7U8V`, `...T7UOI`,
  `...T7U8I`, etc, **não são ULIDs válidos**.
- **Solução:** use `01HX9K2M4F8N7P2Q5R3S6T7V8W` como exemplo canônico em testes,
  fixtures e documentação. Caracteres válidos: `0-9, A-H, J, K, M, N, P-T, V-Z`
  (32 chars no total, sem I/L/O/U).
- **Descoberto em:** Sessão 03 (2026-05-21), durante BL-C1-005 quando o primeiro
  teste de `isValidUlid` rejeitou a string do prompt.

### G-005: Branded types vs `react-hook-form`

- **Sintoma:** Atribuir uma `string` raw a um campo cujo tipo é `SprintId` (ou
  `UserId`) gera erro de tipo. Em `react-hook-form`, o `defaultValues` com
  `id: ''` falha porque `'' as SprintId` é inválido.
- **Causa:** Zod `.brand<'SprintId'>()` produz tipo
  `string & { brand: 'SprintId' }` — o brand é uma marca de tipo que só existe
  após validação. Strings cruas não têm o brand.
- **Solução:** em formulários, **use o tipo `*Input`**
  (`z.input<typeof schema>`) em vez de `*` no `Resolver`/`defaultValues`.
  Converta o valor via `sprintIdSchema.parse(rawString)` no `onSubmit` para
  obter `SprintId` real.
- **Descoberto em:** Sessão 03 (2026-05-21), antecipado em BL-C1-002 mas ainda
  não exercitado em UI real (a validar quando C2 entrar).

### G-006: `tseslint.configs.disableTypeChecked` precisa de merge de rules explícito

- **Sintoma:** ESLint erra
  `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires type information...`
  ao lintar config files como `vitest.config.ts`, apesar do flat config ter um
  override com `...tseslint.configs.disableTypeChecked`.
- **Causa:** o padrão original do C0:
  ```js
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  }
  ```
  o spread copia `rules` do `disableTypeChecked`, mas a próxima linha
  `rules: {...}` **substitui** esse objeto inteiro (semântica padrão de objeto
  JS). Resultado: as rules type-aware ficam ativas para config files. Era
  invisível em C0 porque nenhum `.ts` era lintado.
- **Solução:** merge explícito de rules:
  ```js
  rules: {
    ...tseslint.configs.disableTypeChecked.rules,
    '@typescript-eslint/no-require-imports': 'off',
  }
  ```
- **Descoberto em:** Sessão 03 (2026-05-21), F2 — primeiro arquivo `.ts` lintado
  em config file expôs o bug latente.

### G-007: Preload sandboxed tem de ser CommonJS — app sem `"type": "module"`

- **Sintoma:**
  `Unable to load preload script ... SyntaxError: Cannot use import statement outside a module`;
  `window.api` fica `undefined` no renderer.
- **Causa:** o Electron avalia o preload sandboxed (`sandbox: true`, §8.1) como
  CommonJS. Com `"type": "module"` no `package.json` do app, o
  `vite-plugin-electron` compila os entries como ESM e o preload quebra. O
  plugin sobrescreve `rollupOptions.output.format` — não dá pra forçar CJS só no
  preload por essa via.
- **Solução:** o `package.json` do app Electron **não** leva `"type": "module"`
  (fica CommonJS, o modo padrão do vite-plugin-electron) — main e preload
  compilam CJS. No main, use o global `__dirname` em vez de
  `fileURLToPath(import.meta.url)`.
- **Descoberto em:** Sessão 06 (2026-05-22), smoke E2E do BL-C2-001.

### G-008: electron-builder no Windows exige Developer Mode (winCodeSign)

- **Sintoma:** `electron-builder` falha com
  `Cannot create symbolic link : O cliente não tem o privilégio necessário` ao
  extrair o `winCodeSign`.
- **Causa:** o `winCodeSign` contém symlinks de libs macOS; criar symlink no
  Windows exige Developer Mode ligado **ou** processo elevado (admin).
- **Solução:** habilitar o Windows Developer Mode (Configurações → Sistema →
  Para desenvolvedores). Vale para processos novos. Se restar cache parcial,
  limpar `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.
- **Descoberto em:** Sessão 06 (2026-05-22), BL-C5-001.

### G-009: Antivírus (ESET) trava o `app.asar` no electron-builder

- **Sintoma:** `electron-builder` falha em `EnsureEmptyDir` —
  `remove ...app.asar: The process cannot access the file because it is being used by another process`.
  Nenhum processo do projeto está rodando.
- **Causa:** a proteção em tempo real de um antivírus de terceiros (ESET, na
  máquina do Renan) abre/trava o `app.asar` recém-escrito; o passo seguinte do
  electron-builder não consegue removê-lo.
- **Solução:** excluir a pasta do projeto da proteção em tempo real do AV; ou
  buildar em ambiente sem o AV — idealmente um runner de CI Windows (ver
  BL-C0-009). Não é contornável só com config.
- **Descoberto em:** Sessão 06 (2026-05-22), BL-C5-001 — geração do `.exe`
  adiada.

### G-010: `vite.config.ts` não pode estar em dois tsconfig (TS6305)

- **Sintoma:**
  `error TS6305: Output file 'vite.config.d.ts' has not been built from source file 'vite.config.ts'`.
- **Causa:** `vite.config.ts` listado no `include` do `tsconfig.json` **e** no
  `tsconfig.node.json` (composite, referenciado) — dupla posse entre projetos.
- **Solução:** `vite.config.ts` fica apenas no `tsconfig.node.json` (padrão do
  template Vite). O `tsconfig.json` do app tem `references`, então não emite
  TS18003 mesmo com o `include` casando nada.
- **Descoberto em:** Sessão 06 (2026-05-22), BL-C2-001 scaffold.

### G-011: vitest `environment: 'jsdom'` exige o pacote `jsdom`; scaffold vazio precisa de `passWithNoTests`

- **Sintoma:** `MISSING DEPENDENCY Cannot find dependency 'jsdom'`; ou, sem
  testes, `vitest run` sai com exit 1 (`No test files found`) e derruba o
  `turbo test`.
- **Causa:** o vitest **não** empacota o `jsdom` — `environment: 'jsdom'` exige
  o pacote instalado. E `vitest run` sem nenhum teste sai exit 1 por padrão.
- **Solução:** `jsdom` nas `devDependencies` do app; `passWithNoTests: true` no
  `vitest.config.ts` enquanto o app/package ainda não tem testes.
- **Descoberto em:** Sessão 06 (2026-05-22), Fase 7 (validação) do BL-C2-001.

### G-012: `pnpm install` não restaura o binário do Electron após `rm -rf node_modules`

- **Sintoma:** depois de `rm -rf node_modules`, um `pnpm install` (mesmo
  `--frozen-lockfile`) recria `node_modules/electron/` mas **não** o
  `node_modules/electron/dist/` (o `electron.exe`, ~226 MB). `pnpm dev` e o
  `electron-builder` então não encontram o runtime. `pnpm rebuild electron` é
  no-op.
- **Causa:** o postinstall do `electron` (que baixa o binário para `dist/`) não
  é re-executado nesse cenário — o pnpm re-linka o package a partir do store sem
  re-rodar o build script, e o `dist/` não faz parte do conteúdo publicado do
  package nem é capturado pelo cache de side-effects.
- **Solução:** rodar o instalador do Electron diretamente —
  `node apps/leader/node_modules/electron/install.js` (extrai do cache em
  `%LOCALAPPDATA%\electron\Cache`, rápido; ajuste o caminho por app). Num runner
  de CI realmente limpo (sem store pnpm pré-existente) o postinstall roda
  normalmente no `pnpm install`.
- **Descoberto em:** Sessão 08 (2026-05-22), Fase 6 da remediação
  audit-v1-FINDING-001.

### G-013: `window-all-closed` no Electron NÃO recebe `event` nem suporta `preventDefault()`

- **Sintoma:** o padrão "tray-resident" escrito como
  `app.on('window-all-closed', (e) => e.preventDefault())` **crash em runtime**
  com
  `TypeError: Cannot read properties of undefined (reading 'preventDefault')` na
  primeira vez que todas as janelas fecham — `e` é `undefined`. Em alguns casos
  pode falhar em compile (overload específica rejeita), mas o overload genérico
  herdado de `EventEmitter` permite compilar e estourar só em runtime.
- **Causa:** a tipagem do Electron 42 é
  `on(event: 'window-all-closed', listener: () => void): this;` — listener sem
  parâmetros. A doc do próprio `electron.d.ts` (~linha 999) diz: _"by default,
  if all windows are closed, the application quits. However, if you subscribe to
  this event, you control whether the app quits or not"_. **Subscrever ao evento
  já cancela o quit automático**; `preventDefault()` não faz parte do contrato.
- **Solução:** listener com corpo comentado, sem chamar `app.quit()`:
  ```ts
  app.on('window-all-closed', () => {
    // Agent tray-resident: NÃO encerra quando as janelas fecham.
    // Subscrever já cancela o quit automático do Electron.
  });
  ```
  O ponto "load-bearing" é a EXISTÊNCIA do listener — deletá-lo faz o app voltar
  ao default (auto-quit). Documentar inline.
- **Descoberto em:** Sessão 09 (2026-05-25), Fase 3 do BL-C3-001 — antes de
  escrever o `index.ts` do Agent, ao auditar o snippet do prompt contra o
  `electron.d.ts` instalado.

### G-014: `tsc --noEmit` em app que importa `@sprint/*` source-first emite TS6059 com `rootDir` no pacote

- **Sintoma:** ao importar `@sprint/contracts` num app, `tsc --noEmit` falha com
  `error TS6059: File '…/packages/contracts/src/…' is not under 'rootDir' '…/apps/operator-agent/src'. 'rootDir' is expected to contain all source files.`
  Acontece tanto com `rootDir: "./src"` explícito quanto sem `rootDir` (o tsc
  infere `rootDir` como o dir do pacote — `references` ao `tsconfig.node.json`
  composite parece forçar a checagem mesmo com `noEmit: true`).
- **Causa:** o monorepo é source-first (Sessão 03 / `@sprint/contracts` com
  `main: src/index.ts`, sem `dist`). O tsconfig do app aliasa
  `@sprint/contracts` → `packages/contracts/src/index.ts` (path alias). Ao
  type-checar, `tsc` puxa a fonte do contracts pro program; com `rootDir`
  apontando para o dir do app, esses arquivos ficam fora.
- **Solução:** `"rootDir": "../.."` no tsconfig do app (raiz do monorepo). Como
  `noEmit: true`, `rootDir` só serve pra checagem TS6059 — apontar para a raiz
  cobre todos os pacotes do monorepo. Alternativa "ortodoxa" (project references
  com `composite: true` no contracts) é mudança arquitetural maior, deixada para
  sessão futura. **O Leader vai precisar do mesmo ajuste quando importar
  `@sprint/contracts` em W1.**
- **Descoberto em:** Sessão 09 (2026-05-25), Fase 4 do BL-C3-002 —
  `apps/operator-agent` é o primeiro app a importar `@sprint/contracts`.

### G-015: `vi.mock` é hoisted; referências a vars externas precisam de prefixo `mock`

- **Sintoma:** vitest em `transform` falha com
  `There are some variables that are not allowed to be referenced inside vi.mock(...) factory because they are not hoisted. Variables need to be prefixed with 'mock'.`
  quando a factory do `vi.mock` referencia uma variável declarada no escopo do
  módulo.
- **Causa:** vitest hoista as chamadas `vi.mock(...)` pro topo do arquivo (acima
  dos imports). A factory é uma closure, mas vitest faz análise estática e
  rejeita identificadores externos não-globais e não-prefixados com `mock` — pra
  evitar TDZ bugs sutis.
- **Solução:** prefixar a variável com `mock` (case-sensitive):

  ```ts
  // ✗ ruim — vitest barra no transform
  const tmpRoot = path.join(os.tmpdir(), `…-${Date.now()}`);
  vi.mock('electron', () => ({ app: { getPath: () => tmpRoot } }));

  // ✓ ok — `mock*` é exemption explícito
  const mockTmpRoot = path.join(os.tmpdir(), `…-${Date.now()}`);
  vi.mock('electron', () => ({ app: { getPath: () => mockTmpRoot } }));
  ```

  A factory é chamada **lazily** (no 1º import do módulo mockado), então
  `mockTmpRoot` já estará inicializada quando rodar — basta o nome calar a
  checagem estática.

- **Descoberto em:** Sessão 09 (2026-05-25), Fase 4 do BL-C3-002 — ao escrever
  `config.test.ts` que mocka `electron.app.getPath` apontando pro tmp dir.

### G-016: `abstract class` em TS é compile-time only; `new.target` no constructor enforça em runtime

- **Sintoma:** `expect(() => new FilesystemError('/x', 'msg')).toThrow()` falha
  porque `new FilesystemError(...)` **não joga** em runtime — a classe é
  instanciável mesmo com `abstract`. O `@ts-expect-error` no teste só silencia o
  erro de tipo, não valida comportamento.
- **Causa:** A keyword `abstract` em TypeScript é puramente compile-time. Em JS
  compilado, `abstract` desaparece — a classe é uma `class` normal, e
  `new AbstractClass(...)` retorna uma instância funcional (com fields abstract
  ficando `undefined`).
- **Solução:** check de `new.target` no constructor base, lançando `TypeError`
  quando instanciada diretamente:
  ```ts
  export abstract class FilesystemError extends Error {
    abstract override readonly name: string;
    constructor(public readonly filepath: string, message: string, ...) {
      super(message);
      if (new.target === FilesystemError) {
        throw new TypeError('FilesystemError é abstract; use subclasses.');
      }
    }
  }
  ```
  `new.target` dentro do constructor base aponta para a classe usada com `new`
  (ex.: `new FileNotFoundError(...)` → `new.target = FileNotFoundError`, passa
  pelo check). Subclasses funcionam normalmente; instanciação direta joga.
- **Descoberto em:** Sessão 10 (2026-05-25), Fase 3 do BL-C4-001, quando o teste
  de abstract enforcement do prompt falhou em runtime.

### G-017: `writeFileAtomic` com `.tmp` compartilhado colide em escritas concorrentes

- **Sintoma:** 2 chamadas concorrentes a `writeFileAtomic(path, ...)` ao mesmo
  destino: uma renomeia primeiro (removendo o `.tmp` compartilhado), a outra
  joga `ENOENT: no such file or directory, rename '...tmp' -> '...'`.
- **Causa:** Implementação ingênua usa `${filepath}.tmp` como sufixo fixo —
  todas as escritas ao mesmo `filepath` compartilham o mesmo `.tmp`. A primeira
  que termina o `rename` deleta o `.tmp` que a segunda ainda precisa.
- **Solução:** sufixo aleatório no `.tmp`. Use `randomBytes(6).toString('hex')`
  (48 bits de entropia, suficiente para isolar):
  ```ts
  const tmpPath = `${filepath}.${randomBytes(6).toString('hex')}.tmp`;
  ```
  Em testes que verificam ausência de `.tmp` órfão, use
  `entries.filter(e => e.endsWith('.tmp'))` (não checar nome fixo).
- **Descoberto em:** Sessão 10 (2026-05-25), Fase 5 do BL-C4-007, quando o teste
  de concorrência do prompt falhou na 1ª execução.

### G-018: `writeFileAtomic` com diretório pai inexistente joga `FileNotFoundError` (não IOError)

- **Sintoma:** `await adapter.writeFileAtomic('/dir/nao-existe/file.json', 'x')`
  joga `FileNotFoundError`, não `FilesystemIOError` — apesar de intuitivamente
  parecer "erro de I/O" (path final não pôde ser criado).
- **Causa:** O `open(tmpPath, 'w')` na implementação Node falha com `ENOENT`
  porque o componente do diretório pai não existe. `mapError` é genérico e
  mapeia ENOENT → `FileNotFoundError` consistentemente, independente do contexto
  (read vs write).
- **Solução:** comportamento intencional, documentado no JSDoc da interface.
  Consumers que precisam discriminar "arquivo não existe" (read) de "componente
  do path não existe" (write) devem inspecionar o `cause`
  (`NodeJS.ErrnoException` com `code: 'ENOENT'`) ou usar
  `adapter.exists(parent)` antes da escrita.
- **Convenção:** caller é responsável por `mkdir(parent)` antes de
  `writeFileAtomic` em paths aninhados. Em Node isso evita o erro; em Memory é
  no-op idempotente. Suite de contrato compartilhada assume essa convenção.
- **Descoberto em:** Sessão 10 (2026-05-25), Fase 5 do BL-C4-007.

### G-019: `MemoryFilesystemAdapter` usa diretórios implícitos; testes podem divergir do Node em corner cases

- **Sintoma:** após
  `await adapter.rename('/pending/x.json', '/archive/x.json')`,
  `await adapter.listDir('/pending')` retorna `[]` no Node (diretório vazio
  existe) mas lança `DirectoryNotFoundError` no Memory (sem filhos → "não
  existe").
- **Causa:** decisão de design do MemoryFilesystemAdapter — diretórios são
  representados implicitamente via presença de filhos no
  `Map<string, MemoryFileEntry>`. Sem entry de arquivo dentro, o diretório
  "deixa de existir". `mkdir` é no-op porque não há como criar diretório
  explicitamente sem arquivo dentro.
- **Solução:** testes que dependem de "diretório vazio existente" devem ou (a)
  tratar ambos os outcomes como equivalentes ("sprint não está em pending"); ou
  (b) escrever um arquivo placeholder antes para forçar existência. Suite de
  contrato compartilhada faz (a) explicitamente:
  ```ts
  try {
    const stillPending = await adapter.listDir(resolvePath('pending'));
    expect(stillPending).not.toContain('01HX-joao.json');
  } catch (err) {
    expect(err).toBeInstanceOf(DirectoryNotFoundError);
  }
  ```
- **Descoberto em:** Sessão 10 (2026-05-25), Fase 7 do BL-C4-001 (suite de
  contrato).

### G-020: `jsdom`/`canvas` no bundle do Electron main exige externalize em vite-plugin-electron

- **Sintoma:** ao rodar `pnpm dev` (ou ao iniciar o `.exe` empacotado), o
  Electron mostra um dialog
  `Uncaught Exception: Could not resolve "canvas" imported by "jsdom"`. Stack
  trace aponta para `dist-electron/main/index.js` em runtime de module-load (não
  no primeiro dispatch).
- **Causa:** o main process importa `sanitizeBodyHtml` de `@sprint/contracts`
  (via `dispatchService.ts` no Leader ou `PendingStore.writePendingSprint` que
  sanitiza internamente — qualquer caminho que termine em
  `@sprint/contracts/src/sanitize.ts`), que transitivamente importa
  `isomorphic-dompurify` → `jsdom` → `canvas` (peer opcional). Vite/Rollup
  bundla o `jsdom` mas o `require('canvas')` interno não resolve em build-time
  porque `canvas` não está instalado (peer opcional do jsdom). Vite injeta um
  stub que lança o erro acima quando o módulo é carregado em runtime.
- **Solução:** externalizar `jsdom` e `canvas` no `rollupOptions.external` do
  main em `apps/leader/vite.config.ts` (e em
  `apps/operator-agent/vite.config.ts` quando BL-C3-004 W1 integrar
  `sanitizeBodyHtml` no overlay do Agent):

  ```ts
  rollupOptions: {
    external: ['electron', 'jsdom', 'canvas'],
  }
  ```

  Em runtime, `require('jsdom')` resolve via `node_modules` (jsdom faz parte da
  dep tree transitiva via `@sprint/contracts`). O `canvas` ausente é tratado
  silenciosamente pelo jsdom (peer opcional → features de canvas desabilitadas,
  log de warning). Bundle do main fica ~21 kB menor (era 116 kB com jsdom
  inlined + stub canvas, virou 95 kB).

- **Em produção (electron-builder):** `node_modules` é incluído NO `.asar` — mas
  exige **2 ajustes adicionais** descobertos em produção (Sessão 16 pós-deploy):
  1. `.npmrc` raiz com `shamefully-hoist=true` — pnpm default usa symlinks em
     `.pnpm/` que electron-builder não navega; sem hoist, subdeps de `jsdom`
     (e.g. `tough-cookie`) ficam fora do `.asar` e o app crasha em runtime com
     `Cannot find module 'tough-cookie'`.
  2. `electron-builder.yml` precisa de `'node_modules/**/*'` explícito no
     `files` — o default `**/*` é substituído quando `files` é especificado,
     então `node_modules/` precisa ser listado de novo (electron-builder aplica
     filtro automático de production deps via package.json).
- **Descoberto em:** Sessão 15 (2026-05-26), Gate 3 do W1.C2 parte 2 — primeiro
  consumer real de `sanitizeBodyHtml` no main process do Leader (via
  `DispatchService` → `PendingStore` → `sanitizeBodyHtml`). Os 2 ajustes de
  produção (shamefully-hoist + node_modules em files) só apareceram na Sessão 16
  ao tentar instalar o `.exe` empacotado num PC remoto que não tinha o
  `node_modules` global de dev.

### G-021: `Set-Content -Encoding utf8` no PowerShell 5.1 adiciona BOM que quebra `JSON.parse`

- **Sintoma:** `loadConfig` falha com `ConfigInvalidError` mesmo após gravar um
  `config.json` com schema correto. Mensagem específica:
  `Unexpected token '﻿', "﻿{\n  ..."` (note o `﻿` invisível antes do `{`).
- **Causa:** Windows PowerShell 5.1 grava arquivos UTF-8 **com BOM** (`EF BB BF`
  prefix de 3 bytes) por default em `Set-Content -Encoding utf8` e
  `Out-File -Encoding utf8`. O `JSON.parse` do V8 trata BOM como caractere
  inválido na primeira posição. O parser Zod nunca chega a ser chamado.
- **Solução:**
  ```powershell
  [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
  ```
  O `$false` no construtor do `UTF8Encoding` desabilita o BOM. Resultado: bytes
  iniciais do arquivo viram `7B 0A 20` (`{`, `\n`, ` `) em vez de
  `EF BB BF 7B 0A 20`.
- **Alternativa em Notepad:** "Save As" → escolher "UTF-8" (não "UTF-8 with
  BOM"). PowerShell 7+ resolveu — `Set-Content -Encoding utf8` é sem BOM por
  default.
- **Como verificar:** `[System.IO.File]::ReadAllBytes($path)[0..2]` deve
  retornar `7B 0A 20` (ou os primeiros chars do JSON), NÃO `EF BB BF`.
- **Descoberto em:** Sessão 16 (2026-05-26), Gate 4 do W1.C3 — primeiro smoke
  real do `loadConfig` do Agent com config gravado via PowerShell. O config.json
  existia, schema parecia OK no Notepad (BOM é invisível), mas `JSON.parse`
  rejeitava. Solução documentada em `apps/operator-agent/SETUP.md` §2.3 e §6.6.3
  — operadores da fábrica vão cair nesse buraco se editarem via `Set-Content`.

### G-022: `productName` do electron-builder.yml NÃO afeta `app.getName()` em runtime

- **Sintoma:** docs do SETUP.md prometiam que o app empacotado usaria
  `%APPDATA%\Sprint Leader\config.json` (com espaço), mas em runtime real o
  ConfigErrorScreen mostra `%APPDATA%\sprint-leader\config.json` (lowercase do
  `name` do package.json — mesmo do modo dev). Idem para o Agent
  (`%APPDATA%\sprint-operator-agent\`).
- **Causa:** `productName` no `electron-builder.yml` configura **apenas**:
  - Nome do executável final (`SprintLeader.exe` / `Sprint Leader.exe`).
  - Diretório de instalação (`Program Files\Sprint Leader\`).
  - Atalho do Start Menu.
  - **NÃO afeta** `app.getName()` em runtime — esse continua retornando o `name`
    do package.json. E `app.getPath('userData')` usa `app.getName()`.
- **Resultado:** path do userData é IDÊNTICO entre dev e build packaged (ambos
  usam lowercase do package.json `name`).
- **Fix correto (W3 polish):** adicionar `extraMetadata.productName` ao
  `electron-builder.yml` — isso injeta `productName` no package.json final do
  `.asar` e o Electron passa a usar como `app.getName()`. Aceito como débito
  porque o comportamento atual funciona (paths apenas menos "polidos"
  visualmente).
- **Como o usuário descobre o path real:** `ConfigErrorScreen` (Leader) ou
  balloon do tray (Agent) mostram o path EXATO esperado. Sempre confiar no que o
  app diz, não no que a doc dizia.
- **Descoberto em:** Sessão 16 (2026-05-26), pós-deploy do Leader empacotado no
  PC do Otávio — ConfigErrorScreen mostrou `sprint-leader\` em vez do
  `Sprint Leader\` documentado no SETUP.md.

### G-023: `electron-builder.yml` com `files` explícito EXCLUI `build/` do asar — Tray icon ausente mata boot silencioso

- **Sintoma:** Operator Agent instalado em PC de produção (`.exe` gerado via
  Actions, instalado limpo via NSIS) abre e **nada acontece** — sem janela, sem
  ícone tray na bandeja, sem balloon de erro, sem dialog. Apenas o processo
  morre em background. Em dev (`pnpm dev`) funciona normalmente.
- **Causa:** `trayService.ts` resolve o ícone via
  `path.join(__dirname, '../../build/tray.ico')`. Em dev `__dirname` =
  `apps/operator-agent/dist-electron/main/` → resolve para
  `apps/operator-agent/build/tray.ico` ✓. Em prod empacotada, `__dirname` =
  `resources/app.asar/dist-electron/main/` → resolve para
  `resources/app.asar/build/tray.ico` que **não existe** porque o
  `electron-builder.yml` declara `files` explicitamente (`dist/**/*`,
  `dist-electron/**/*`, `package.json`, `node_modules/**/*`) e o default `**/*`
  é **completamente substituído** — `build/` fica de fora. `new Tray()` joga
  `Error: Failed to load image from path '...'`, throw escapa do bootstrap, mata
  o processo. Sem `uncaughtException` handler global, é invisível pro operador.
- **Por que `directories.buildResources: build` engana:** o `buildResources` do
  electron-builder é a pasta de ícones do INSTALADOR (NSIS, .exe icon,
  background do DMG) — **NÃO** vai pro asar. Pra arquivo ser acessível em
  runtime via `__dirname + '../../build/X'`, ele precisa estar no `files` do
  asar OU em `extraResources` (fora do asar, ao lado dele).
- **Solução:** adicionar `'build/**/*'` ao array `files` do
  `electron-builder.yml`. Aplica apenas ao Agent (Leader não tem tray em W1).
  Replicar no Leader se ele algum dia precisar de ícones em runtime.
  ```yaml
  files:
    - 'dist/**/*'
    - 'dist-electron/**/*'
    - 'build/**/*' # tray.ico — sem isso, new Tray() crash silencioso
    - 'package.json'
    - 'node_modules/**/*'
  ```
- **Defesa em profundidade adicionada na mesma sessão:**
  `process.on('uncaughtException')` + `dialog.showErrorBox` no topo de
  `main/index.ts`. Garante que qualquer throw não-capturado no boot vire popup
  visível ao operador da fábrica — não morre silenciosamente nunca mais. Vale
  também pra `unhandledRejection`.
- **Como detectar em CI:** smoke test que extrai `.asar` gerado e verifica
  presença de `build/tray.ico` (e qualquer outro asset esperado por
  `__dirname + '../../...'` resolves). Débito pra W3 polish.
- **Descoberto em:** Sessão 17 (2026-05-26), pós-deploy do Agent no PC do Otávio
  — Renan reportou "Agent não fica em segundo plano e não mostra overlay".
  Auditoria do `trayService.ts:57` + `electron-builder.yml:files` expôs a
  inconsistência.

### G-024: Windows EPERM em renames concorrentes ao mesmo destino

- **Sintoma:** `writeFileAtomic` rodando 10× em paralelo ao MESMO path no
  Windows produz `EPERM: operation not permitted, rename ...`. 2 concorrentes
  funcionam; 10 não.
- **Causa:** `rename` no Win32 não tem a serialização atômica do POSIX. Sob alta
  contenção, o destination file fica brevemente "locked" e renames concorrentes
  falham com EPERM. Issue conhecido: nodejs/node#30075.
- **Solução:** tests que exercitam alta contenção ao mesmo destino → marcar com
  `it.runIf(os.platform() !== 'win32')`. Em produção, o caso de uso real (cada
  operador grava no próprio filename = paths distintos) não dispara — o cenário
  "mesmo path 10×" é apenas adversarial.
- **Descoberto em:** Sessão 18 (2026-05-27), Gate 4 do BL-C8-003 — primeiro test
  adversarial de 10 escritas simultâneas exibiu EPERM no Windows. Linux/macOS
  passa.

### G-025: `align-items: flex-end` alinha BOTTOM da box, não baseline visual — use `last baseline` quando line-heights divergem

- **Sintoma:** em `<Overlay>` do Agent, com `flex-direction: row` e
  `align-items: flex-end`, o bloco "Até 18:00h" (column) caía visivelmente
  abaixo da baseline do "Artes" (do metricGroup row baseline ao lado).
- **Causa:** `flex-end` alinha pelo BOTTOM da margin box do flex child. Mas o
  `.valueBig` 4xl (120px) com `line-height: tight` (1.2 = 144px) cria gap entre
  a baseline real do texto e o bottom da box (~24px). O conteúdo da outra coluna
  fica ANCORADO no bottom — então mais baixo que a baseline visual.
- **Solução:** `align-items: last baseline` (CSS Box Alignment Module Level 3).
  Alinha pela baseline do ÚLTIMO item baseline-participating de cada flex child.
  Para metricGroup (row baseline) → baseline única. Para deadlineGroup (column)
  → baseline do último item (ex.: "18:00h" no bottom). Ambas as baselines
  visuais alinham.
- **Suporte:** Chromium 92+ / Firefox 86+ / Safari 16+. Electron 42 usa Chromium
  ~129; seguro.
- **Variantes:** `first baseline` para a primeira baseline (default em
  `baseline` em column). `last baseline` é o que normalmente queremos quando o
  conteúdo importante fica no bottom.
- **Descoberto em:** Sessão 40 (2026-05-28), após 3 iterações falhas de
  `flex-start` / `flex-end` / `baseline` no `.metricRow`.

### G-026: `pnpm dev` na raiz exige predev + `emptyOutDir: !isWatchMode` para library workspaces consumidos por dev server

- **Sintoma:** `pnpm dev` (root, `turbo dev`) sobe os 3 watches em paralelo
  (`@sprint/ui-kit#dev` + `sprint-leader#dev` + `sprint-operator-agent#dev`).
  Apps consumidores (Agent/Leader) falham com Vite Pre-transform error:
  `Failed to load url .../packages/ui-kit/dist/index.js / styles.css`. Erro
  intermitente, mas recorrente em starts frios.
- **Causa raiz dupla:**
  1. **Race entre predev e watch concorrente:** se `predev` do consumer dispara
     `pnpm --filter @sprint/ui-kit build` (one-shot), o turbo já está rodando
     `@sprint/ui-kit#dev` (watch) em paralelo. Dois `vite build` no mesmo
     `dist/` → race no `vite-plugin-dts` reading intermediate files.
  2. **`emptyOutDir: true` (default) em watch:** `vite build --watch` esvazia
     `dist/` no startup antes do primeiro re-bundle. Apps consumidores fazem
     Pre-transform exatamente nesse intervalo de ~2s e falham com "Failed to
     load".
- **Solução em 3 camadas:**
  1. **Predev no root `package.json`**:
     `predev: pnpm --filter @sprint/ui-kit build`. Roda one-shot ANTES de
     `turbo dev`. Garante `dist/` populado.
  2. **Sem predev no consumer**: predev no Agent/Leader entra em race com o
     watch paralelo. Manter SÓ no root.
  3. **`emptyOutDir: !isWatchMode`** no `ui-kit/vite.config.ts`. Detecta
     `process.argv.includes('--watch')`. Watch não esvazia mais; apenas
     sobrescreve arquivos. One-shot build (sem --watch) segue limpando.
- **Aplicabilidade futura:** se outro package C\* virar Vite library mode
  (consumido por dev server downstream), replicar `emptyOutDir` condicional +
  predev no root.
- **Descoberto em:** Sessão 42c (2026-05-28), após múltiplas iterações com
  `predev` no consumer e `dependsOn: ["^build"]` no turbo dev (cada uma falhando
  por motivos diferentes).

### Débitos técnicos pendentes

Itens conhecidos que **deveriam** existir mas dependem de pré-requisito ainda
não entregue. Cada um tem disparador explícito que reabre o trabalho.

#### Débito: regra ESLint `no-console` estrita (apenas `@sprint/logger`)

- **Status:** pendente — disparador é a entrega do BL-C6-001 (`@sprint/logger`)
  em W1.
- **Estado atual:** `eslint.config.mjs` permite `console.warn` e `console.error`
  (`'no-console': ['error', { allow: ['warn', 'error'] }]`). `console.log` já é
  proibido.
- **Plano:** quando `@sprint/logger` estiver disponível, endurecer para
  `'no-console': 'error'` (zero allow), e refatorar os `console.warn`/`error`
  remanescentes (main/preload do Leader e Agent) para usar o logger.
- **Por que adiar:** sem `@sprint/logger`, banir `console.*` removeria o único
  canal de logging em ramos de erro críticos (ex: `handleConfigError` no Agent).
- **Referências:** BL-C8-005 (terceira regra planejada — adiada por ADR
  implícito), BL-C6-001 (entrega o logger).

#### Débito: `rootDir` do Leader em `apps/leader/tsconfig.json`

- **Status:** pendente — disparador é o início do BL-C2-007 (integração do
  `sanitizeBodyHtml` no fluxo de dispatch do Leader) ou de qualquer outro
  consumer real de `@sprint/contracts` no Leader em W1.
- **Sintoma:** `tsc --noEmit` no Leader emite TS6059 ao importar qualquer
  símbolo de `@sprint/contracts` source-first
  (`File '...packages/contracts/...' is not under 'rootDir' '...apps/leader/src'`).
- **Causa:** ver G-014. O `tsconfig.json` do Leader ainda tem
  `"rootDir": "./src"` (herança do scaffold da Sessão 06, anterior à descoberta
  de G-014 na Sessão 09). O Agent já foi ajustado para `"rootDir": "../.."` em
  BL-C3-002.
- **Plano:** fix de 1 linha em `apps/leader/tsconfig.json` —
  `"rootDir": "./src"` → `"rootDir": "../.."`. Pode ser feito como Fase 0 de
  BL-C2-007 ou como BL micro dedicado.
- **Exercitado em:** Sessão 12 (2026-05-25), Gate 4 do BL-C1-004 — smoke do
  import `sanitizeBodyHtml` via `@sprint/contracts` no Leader falhou; smoke foi
  pivotado para o Agent (já com `rootDir` correto).

---

## 13. Como atualizar este arquivo

`CLAUDE.md` é vivo. Atualize quando:

- Adicionar ou remover componente
- Mudar versão major de tecnologia (Electron 30 → 31)
- Estabelecer nova convenção de código
- Descobrir gotcha relevante (seção 12)
- Wave fechar (atualizar status da seção 6)

Mudanças significativas em `CLAUDE.md` viram entrada em `DECISIONS.md`.

---

## 14. Comunicação com Renan

### Quando perguntar

- Decisão arquitetural com trade-offs relevantes
- Conflito entre requisitos
- Bloqueio que exige decisão de negócio
- Mudança de escopo (mesmo pequena)

### Quando informar (sem perguntar)

- Status de progresso ao fim de sessão
- Decisões táticas com justificativa
- Bugs descobertos e corrigidos

### Tom

Direto, técnico, sem floreios. Renan prefere comunicação eficiente. Não pedir
desculpas por dúvidas legítimas. Sem formalidade excessiva.

---

**Fim do CLAUDE.md.**

> **Ao chegar aqui:** se você é Claude Code iniciando uma sessão, agora leia
> `SESSION_LOG.md` pra saber onde paramos.
