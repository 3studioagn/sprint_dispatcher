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

| Categoria          | Tecnologia            | Versão (alvo / instalada)                       |
| ------------------ | --------------------- | ----------------------------------------------- |
| Linguagem          | TypeScript            | 5.4+ — instalada **6.0.3**                      |
| Runtime Node       | Node.js               | engine `>=20.0.0` — `.nvmrc` **24.10.0**        |
| Runtime Desktop    | Electron              | 30.x — _pendente (C2/C3)_                       |
| UI Framework       | React                 | 18.3+ — _pendente (C2/C3)_                      |
| Estado global      | Zustand               | 4.5+ — _pendente (C2/C3)_                       |
| Styling            | CSS Modules + PostCSS | nativo Vite — _pendente (C2/C3)_                |
| Forms              | react-hook-form       | 7.51+ — _pendente (C2)_                         |
| Validation         | Zod                   | 3.23+ — _pendente (C1)_                         |
| Icons              | lucide-react          | 0.380+ — _pendente (C2/C3)_                     |
| Date/Time          | date-fns              | 3.6+ — _pendente_                               |
| IDs                | ulid                  | 2.3+ — _pendente (C1)_                          |
| HTML Sanitization  | isomorphic-dompurify  | 2.10+ — _pendente (C1)_                         |
| Logging            | Pino + pino-roll      | 9.x / 1.1+ — _pendente (C6)_                    |
| Testing (unit)     | Vitest                | 1.6+ — _pendente (C8)_                          |
| Testing (E2E)      | Playwright (Electron) | 1.44+ — _pendente (C8)_                         |
| Package Manager    | pnpm                  | engine `>=10.0.0` — instalada **10.18.2**       |
| Build Orchestrator | Turborepo             | 2.x — instalada **2.9.14**                      |
| Renderer Bundler   | Vite                  | 5.x — _pendente (C2/C3)_                        |
| Electron Builder   | electron-builder      | 24+ — _pendente (C5)_                           |
| Versionamento      | Changesets            | 2.27+ — instalada **2.31.0**                    |
| Lint               | ESLint                | 9.x (flat) — instalada **10.4.0** (flat nativo) |
| Format             | Prettier              | 3.x — instalada **3.8.3**                       |
| Git hooks          | Husky + lint-staged   | 9.x / 15.x — instaladas **9.1.7 / 17.0.5**      |
| CI                 | GitHub Actions        | configurado em `.github/workflows/ci.yml`       |

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
