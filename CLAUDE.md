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

| Categoria          | Tecnologia            | Versão (alvo / instalada)                          |
| ------------------ | --------------------- | -------------------------------------------------- |
| Linguagem          | TypeScript            | 5.4+ — instalada **6.0.3**                         |
| Runtime Node       | Node.js               | engine `>=20.0.0` — `.nvmrc` **24.10.0**           |
| Runtime Desktop    | Electron              | 30.x — instalada **30.5.1** (`sprint-leader`)      |
| UI Framework       | React                 | 18.3+ — instalada **18.3.x** (`sprint-leader`)     |
| Estado global      | Zustand               | 4.5+ — _pendente (C2/C3)_                          |
| Styling            | CSS Modules + PostCSS | nativo Vite — em uso em `sprint-leader`            |
| Forms              | react-hook-form       | 7.51+ — _pendente (C2)_                            |
| Validation         | Zod                   | 3.23+ — instalada **3.25.x** (`@sprint/contracts`) |
| Icons              | lucide-react          | 0.380+ — _pendente (C2/C3)_                        |
| Date/Time          | date-fns              | 3.6+ — _pendente_                                  |
| IDs                | ulid                  | 2.3+ — instalada **2.4.x** (`@sprint/contracts`)   |
| HTML Sanitization  | isomorphic-dompurify  | 2.10+ — _pendente (BL-C1-004, W1)_                 |
| Logging            | Pino + pino-roll      | 9.x / 1.1+ — _pendente (C6)_                       |
| Testing (unit)     | Vitest                | 1.6+ — instalada **1.6.1** (`@sprint/contracts`)   |
| Testing (E2E)      | Playwright (Electron) | 1.44+ — _pendente (C8)_                            |
| Package Manager    | pnpm                  | engine `>=10.0.0` — instalada **10.18.2**          |
| Build Orchestrator | Turborepo             | 2.x — instalada **2.9.14**                         |
| Renderer Bundler   | Vite                  | 5.x — instalada **5.4.21** (`sprint-leader`)       |
| Electron Builder   | electron-builder      | 24+ — instalada **24.13.3** (`sprint-leader`)      |
| Versionamento      | Changesets            | 2.27+ — instalada **2.31.0**                       |
| Lint               | ESLint                | 9.x (flat) — instalada **10.4.0** (flat nativo)    |
| Format             | Prettier              | 3.x — instalada **3.8.3**                          |
| Git hooks          | Husky + lint-staged   | 9.x / 15.x — instaladas **9.1.7 / 17.0.5**         |
| CI                 | GitHub Actions        | configurado em `.github/workflows/ci.yml`          |

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

Detalhes de cada componente e itens do backlog estão no documento externo de
Backlog (perguntar a Renan se necessário).

---

## 6. Waves de Desenvolvimento

| Wave | Nome                     | Duração est. | Status     |
| ---- | ------------------------ | ------------ | ---------- |
| W0   | Foundation               | 1 semana     | 🔄 atual   |
| W1   | MVP Core                 | 2 semanas    | ⏸️ próxima |
| W2   | Refinement               | 1 semana     | ⏸️         |
| W3   | Production Readiness     | 1 semana     | ⏸️         |
| W4   | Hardening & Future-proof | 1 semana     | ⏸️         |

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
| `@sprint/contracts`            |   95% |       95% |      90% |        95% |
| `@sprint/fs-adapter`           |   95% |       95% |      90% |        95% |
| `sprint-operator-agent` (main) |   90% |       90% |      85% |        90% |
| `sprint-leader`                |   n/a |       n/a |      n/a |        n/a |

Cobertura realmente exercida (Sessão 11): `@sprint/contracts` 100/100/100/100,
`@sprint/fs-adapter` 99.05/100/96.69/99.05, `sprint-operator-agent`
100/100/100/100.

`sprint-leader` em W0 é scaffold sem lógica testável (main/preload via E2E em W3
— Playwright). À medida que código de domínio for adicionado em W1+, thresholds
serão introduzidos via PR dedicado. Reporters padronizados nos 4 workspaces:
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
