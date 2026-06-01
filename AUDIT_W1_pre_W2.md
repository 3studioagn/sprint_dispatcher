# AUDITORIA — WAVE 1 — Sprint Dispatcher

**Data:** 2026-05-27 **Auditor:** Claude Code (sessão de auditoria adversarial,
read-only) **Status:** ✅ CONCLUÍDA + 🔧 CORREÇÕES PÓS-AUDITORIA APLICADAS
(2026-05-27)

---

## Sumário Executivo

> **Atualização 2026-05-27 (pós-correções, Caminho 2):** F-002, F-017, F-020,
> F-024 e F-025 fechados nesta sessão. Veredito reavaliado para ✅ **PRONTO PARA
> W2** (0 Critical, **2 High** restantes — F-003 e F-006 — ambos
> Renan-dependentes e formalmente DEFERIDOS para ADRs futuros). 18 findings
> DEFERRED catalogados em `TECH_DEBT.md`. Suíte global: 1056 → **1069 testes
> verdes** (+13). Detalhes na seção "Histórico de correções" ao final do
> documento.

- **Status da auditoria:** ✅ **CONCLUÍDA** (12 gates executados, 2026-05-27)
- **Itens auditados:** 20 BLs W1 (C1×1, C2×6, C3×6, C4×4, C6×1, C8×2) + 22 RF +
  13 RN + 22 RNF + 16 US + 8 UC + 21 ADRs + 5 packages
- **Comandos baseline (auditoria):** 5 PASS (install, type-check, lint, build,
  test:coverage); 1056 testes verde
- **Comandos pós-correções (2026-05-27):** 6 PASS (install, type-check, lint,
  build, test, format:check); **1069 testes verde**;
  `pnpm audit --audit-level=high` exit 0 (1 HIGH eliminado)
- **Findings totais:** **25**
  - **Critical: 0**
  - **High: 5** → **2 abertos** (F-002 ✅ / F-003 ⏸️ DEFERRED / F-006 ⏸️
    DEFERRED / F-017 ✅ / F-020 ✅)
  - **Medium: 8** → **6 abertos** (F-004, F-005, F-007, F-011, F-012, F-018 ⏸️
    DEFERRED / F-024 ✅ / F-025 ✅)
  - **Low: 12** → todos **DEFERRED** (F-001, F-008, F-009, F-010, F-013, F-014,
    F-015, F-016, F-019, F-021, F-022, F-023)
- **Veredito original:** ⚠️ **AVANÇAR COM RESSALVAS** (5 High > 3)
- **Veredito atualizado (pós-correções):** ✅ **PRONTO PARA W2**
  - Critério: 0 Critical (✅) e 2 High ≤ 3 (✅) — per § 7.5 do prompt
  - Os 2 High restantes (F-003, F-006) são Renan-dependentes (exigem ADR-022 /
    ADR-023) e foram formalmente DEFERIDOS para W2; podem entrar em paralelo com
    as primeiras BLs (BL-C2-008 / BL-C3-009).
- **Recomendação em 3 linhas:**
  1. Corrigir 2-3 dos 5 High findings (F-002 + F-017 + F-020 — todos S size,
     ~2-3h totais) baixa para ≤ 3 High e qualifica como ✅ **PRONTO PARA W2**.
  2. Os 3 High restantes (F-003, F-006) exigem **decisão arquitetural de Renan**
     (ADR-022, -023) — podem entrar em paralelo com as primeiras BLs da W2
     (BL-C2-008 / BL-C3-009 do ack-tracking + cancel).
  3. **Categorias mais limpas:** C1 (contracts), C4 (fs-adapter), security
     baseline, type safety. **Categoria com maior débito:** C3 (Agent) — 9
     findings concentrados (overlay/tray/timer/history) refletem maior
     superfície funcional entregue.

---

## Metodologia

### Princípios

Auditoria **adversarial, read-only, evidence-based**. Premissas de operação:

- **"Show me it works" em vez de "I think it works"** — toda finding cita
  `arquivo:linha`, output de comando capturado, ou cenário reproduzível.
- Comentários no código não são evidência. Documentação não é evidência (mas é
  auditável contra o código).
- Ausência de teste = ausência de garantia.
- Comentário dizendo "this is sanitized" sem `sanitize` no código = **FAIL**.
- ADR dizendo "decidimos X" + código fazendo Y sem ADR contrário = finding
  crítico de inconsistência.

### Fontes da verdade consultadas (Gate 1)

| Documento                                                 | 1-frase de hook                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `sprint_dispatcher_backlog.docx`                          | 87 itens BL totais, 20 W1; tabelas de wave/prioridade/dependências por item; 5 waves (W0–W4).                         |
| `sprint_dispatcher_requisitos.docx`                       | 22 RF + 22 RNF + 13 RN + 8 UC + 5 épicos US + Anexos A–G (estruturas, schemas JSON, mecanismo de auto-start).         |
| `sprint_dispatcher_stack.docx`                            | Stack 3Studio — TypeScript 5.4+, Electron 30.x, React 18.3+, Zustand 4.5+, Zod 3.23+, ULID, Pino, Vitest, Playwright. |
| `DECISIONS.md`                                            | 21 ADRs documentados (ADR-001 a ADR-021) cobrindo monorepo, Electron, polling, schemas, IPC, etc.                     |
| `CLAUDE.md`                                               | Operacional — convenções, gotchas (G-001 a G-024), débitos técnicos, estrutura interna dos packages.                  |
| `SESSION_LOG.md`                                          | 18 sessões registradas. W1 = sessões 12–18 (7 sessões absolutas).                                                     |
| `CHANGELOG.md`                                            | Bloco `[Unreleased]` consolida W0+W1 com referências a BLs.                                                           |
| `README.md`                                               | Status declarado: W1 fechada, aguardando W2. Componentes C1–C8 com status.                                            |
| `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | Fundação — 2 workspaces globs, turbo tasks corretos (`tasks`, não `pipeline`), TS strict completo.                    |

### Snapshot de baseline (Gate 1)

#### Versões coletadas

| Item                    | Versão                                                |
| ----------------------- | ----------------------------------------------------- |
| Node                    | 24.10.0 (matches `.nvmrc`)                            |
| pnpm                    | 10.18.2 (matches `packageManager` + engines)          |
| Workspace raiz          | `sprint-dispatcher@0.0.0` private                     |
| `@sprint/contracts`     | `0.0.0` private                                       |
| `@sprint/fs-adapter`    | `0.0.0` private                                       |
| `@sprint/logger`        | `0.0.0` private                                       |
| `sprint-leader`         | `0.0.0` private (Electron `^42.2.0`, React `^18.3.0`) |
| `sprint-operator-agent` | `0.0.0` private (Electron `^42.2.0`, React `^18.3.0`) |

#### Comandos baseline executados

| Comando                          | Resultado | Tempo | Notas                                                                                                                     |
| -------------------------------- | --------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | ✅ PASS   | ~1s   | Lockfile up to date, no resolution step.                                                                                  |
| `pnpm type-check` (via turbo)    | ✅ PASS   | 7.5s  | 7 tasks (1 cached, 6 executadas); 2 warnings benignos sobre `outputs` de C1/C4 (build é `tsc --noEmit` sem emissão).      |
| `pnpm lint` (via turbo)          | ✅ PASS   | 15.8s | 5 tasks (3 cached, 2 executadas). 0 erros, 0 warnings.                                                                    |
| `pnpm build` (via turbo)         | ✅ PASS   | 17.4s | 5 tasks (2 cached, 3 executadas). Bundles do Leader (~95KB main / 244KB renderer) e Agent (~128KB main / 196KB renderer). |
| `pnpm test:coverage` (via turbo) | ✅ PASS   | 28s   | 7 tasks (2 cached, 5 executadas).                                                                                         |

#### Cobertura por package (captura direta da execução)

| Package                 |                 Tests | Lines % | Branches % | Funcs % | Stmts % | Threshold configurado                                |
| ----------------------- | --------------------: | ------: | ---------: | ------: | ------: | ---------------------------------------------------- |
| `@sprint/contracts`     |                   317 |     100 |        100 |     100 |     100 | 98/95/98/98                                          |
| `@sprint/fs-adapter`    | 291 (+3 skip Windows) |     100 |      99.53 |     100 |     100 | 95/95/95/95                                          |
| `@sprint/logger`        |                    57 |     100 |        100 |     100 |     100 | 95/95/90/95 (per SESSION_LOG; confirmar Gate 6)      |
| `sprint-leader`         |                   198 |   96.89 |      94.51 |   93.84 |   96.89 | n/a (sem thresholds — confirmar Gate 6)              |
| `sprint-operator-agent` |                   190 |   97.76 |      91.47 |    95.4 |   97.76 | 90/85/90/90 (per CLAUDE.md §7.7.1; confirmar Gate 6) |

**Total monorepo**: 1053 tests verde (190+317+291+57+198 = 1053; SESSION_LOG
menciona 1056, diferença de 3 = skipped no Windows).

### BLs W1 esperados (do backlog) vs reportados (SESSION_LOG / CHANGELOG)

| BL        | Componente | Wave (backlog) | Status reportado (SESSION_LOG / CHANGELOG) | Sessão (absoluta)                                                                          |
| --------- | ---------- | -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| BL-C1-004 | C1         | W1             | ✅ concluído                               | Sessão 12                                                                                  |
| BL-C2-002 | C2         | W1             | ✅ concluído                               | Sessão 13                                                                                  |
| BL-C2-003 | C2         | W1             | ✅ concluído                               | Sessão 13                                                                                  |
| BL-C2-004 | C2         | W1             | ✅ concluído                               | Sessão 13                                                                                  |
| BL-C2-005 | C2         | W1             | ✅ concluído                               | Sessão 13                                                                                  |
| BL-C2-007 | C2         | W1             | ✅ concluído                               | Sessão 15                                                                                  |
| BL-C2-011 | C2         | W1             | ✅ concluído                               | Sessão 13                                                                                  |
| BL-C3-003 | C3         | W1             | ✅ concluído                               | Sessão 16                                                                                  |
| BL-C3-004 | C3         | W1             | ✅ concluído                               | Sessão 16                                                                                  |
| BL-C3-005 | C3         | W1             | ✅ concluído                               | Sessão 16                                                                                  |
| BL-C3-006 | C3         | W1             | ✅ concluído                               | Sessão 16                                                                                  |
| BL-C3-007 | C3         | W1             | ✅ concluído                               | Sessão 16                                                                                  |
| BL-C3-008 | C3         | W1             | ✅ concluído                               | Sessão 16                                                                                  |
| BL-C4-002 | C4         | W1             | ✅ concluído                               | Sessão 14                                                                                  |
| BL-C4-003 | C4         | W1             | ✅ concluído                               | Sessão 14                                                                                  |
| BL-C4-006 | C4         | W1             | ✅ concluído                               | Sessão 14                                                                                  |
| BL-C4-007 | C4         | W1             | ✅ concluído                               | Sessão 10 W0 (entregue antes do esperado — backlog marca W1 mas SESSION_LOG entrega em W0) |
| BL-C6-001 | C6         | W1             | ✅ concluído                               | Sessão 17                                                                                  |
| BL-C8-002 | C8         | W1             | ✅ concluído                               | Sessão 18                                                                                  |
| BL-C8-003 | C8         | W1             | ✅ concluído                               | Sessão 18                                                                                  |

**Total: 20 BLs W1 esperados, 20 reportados como concluídos.** Confirmação
inicial de paridade. Validação ponto-a-ponto contra arquivos = Gate 2.

**Divergência menor detectada:** BL-C4-007 (mock adapter) marcado W1 no backlog
mas entregue na Sessão 10 (W0 conforme título do SESSION_LOG header). Não é
finding — entrega antecipada, sem impacto operacional; o que importa para o gate
é estar feito. Reportado aqui apenas para rastreabilidade.

---

## Resultados por categoria

### Categoria 1 — Backlog Compliance

Auditoria item-a-item dos 20 BLs W1 contra Backlog § 6. Cada AC mapeada para
`arquivo:linha`. Convenção: ✅ = atende, ⚠️ = atende parcial / com lacuna, ❌ =
não atende.

#### BL-C1-004 — Sanitizador de HTML para corpo do aviso

- **AC1** "Tags permitidas preservadas: `<b>`, `<i>`, `<br>`, `<p>`, `<h1>`,
  `<span>`"
  - Status: ✅
  - Evidência:
    [packages/contracts/src/sanitize.ts:43](packages/contracts/src/sanitize.ts:43)
    usa `ALLOWED_TAGS: [...ALLOWED_HTML_TAGS]` apontando para a constante em
    [packages/contracts/src/constants.ts:77](packages/contracts/src/constants.ts:77).
    Match exato.
- **AC2** "Tags `<script>` removidas mesmo com tentativas de bypass conhecidas"
  - Status: ✅
  - Evidência: 21 vetores adversariais em
    [packages/contracts/src/**helpers**/xssVectors.ts](packages/contracts/src/__helpers__/xssVectors.ts),
    5 categorias (mutation/encoding/polyglot/unicode/combining). Cobertura 100%
    em sanitize.ts.
- **AC3** "Atributos `on*` removidos"
  - Status: ✅ (mais estrito que a AC — zero atributos)
  - Evidência:
    [packages/contracts/src/sanitize.ts:44](packages/contracts/src/sanitize.ts:44)
    `ALLOWED_ATTR: []` (não só `on*` — tudo).
- **AC4** "Testes com vetores de XSS clássicos"
  - Status: ✅
  - Evidência: [sanitize.test.ts](packages/contracts/src/sanitize.test.ts) (80
    testes) + [xssVectors.ts](packages/contracts/src/__helpers__/xssVectors.ts)
    (21 vetores curados) + 4 properties universais via fast-check.

**Veredito BL-C1-004:** ✅ Todos os ACs atendidos com margem. Defesa em
profundidade documentada em ADR-014 e CLAUDE.md §7.9.

---

#### BL-C2-002 — Layout base e roteamento

- **AC1** "Navegação funciona entre as 3 telas"
  - Status: ✅
  - Evidência:
    [apps/leader/src/renderer/App.tsx:72-82](apps/leader/src/renderer/App.tsx:72)
    — HashRouter com 3 rotas (`/nova`, `/acompanhamento`, `/historico`) +
    redirect default e catch-all.
- **AC2** "Layout com sidebar ou tabs persistente"
  - Status: ✅ (forma mudou: TopNav horizontal substituiu Sidebar — ADR-018)
  - Evidência: [App.tsx:74](apps/leader/src/renderer/App.tsx:74) — `<TopNav />`
    persistente no shell, antes do `<main>` com `<Routes>`.
- **AC3** "Identidade visual mínima (logo, cores ARTFLEXÍVEIS)"
  - Status: ⚠️
  - Evidência: Logo presente
    ([apps/leader/src/renderer/components/Logo/Logo.tsx](apps/leader/src/renderer/components/Logo/Logo.tsx)),
    accent color `#EBC76A` (per CHANGELOG Sessão 15 e ADR-018). MAS — logo é
    "3STUDIO" (marca do desenvolvedor), não ARTFLEXÍVEIS (marca do cliente).
    Backlog AC diz explicitamente "cores ARTFLEXÍVEIS". ADR-018 documenta o
    redesign mas não justifica o desvio de marca.
  - **Finding: F-008** (Low)

**Veredito BL-C2-002:** ⚠️ AC3 atende parcial — visual presente mas marca
diverge da AC. F-008 (Low).

---

#### BL-C2-003 — Tela: lista de operadores com checkbox

- **AC1** (descrição + US-01.01) "Lista exibe operadores `ativo: true`, vem de
  `operators.json` na pasta compartilhada"
  - Status: ✅
  - Evidência:
    [apps/leader/src/main/services/operatorsService.ts:81-116](apps/leader/src/main/services/operatorsService.ts:81)
    lê `<sharedPath>/operators.json` via adapter; filtro `ativo: true` aplicado
    no renderer em
    [apps/leader/src/renderer/stores/useOperatorsStore.ts:62](apps/leader/src/renderer/stores/useOperatorsStore.ts:62).
- **AC2** "Cada item tem checkbox individual"
  - Status: ✅
  - Evidência:
    [OperatorRow.tsx:92-114](apps/leader/src/renderer/components/OperatorList/OperatorRow.tsx:92)
    — `<input type="checkbox">` por operador.
- **AC3** "Botões 'Marcar todos' / 'Desmarcar todos' disponíveis"
  - Status: ✅
  - Evidência:
    [BulkSelectButtons.tsx:18-29](apps/leader/src/renderer/components/BulkSelectButtons/BulkSelectButtons.tsx:18)
    — dois botões com handlers no store.
- **AC4** (US-01.01) "Estado da seleção é preservado se o líder voltar à tela
  anterior"
  - Status: ✅
  - Evidência: `useSprintComposerStore` Zustand global — sobrevive navegação
    React Router.

**Veredito BL-C2-003:** ✅ Todos os ACs atendidos.

---

#### BL-C2-004 — Input de meta por operador

- **AC1** "Quando operador é marcado, exibe campo numérico ao lado para meta"
  - Status: ✅
  - Evidência:
    [OperatorRow.tsx:58-85](apps/leader/src/renderer/components/OperatorList/OperatorRow.tsx:58)
    — campo `<input type="number">` renderiza condicional `isSelected ?`.
- **AC2** "Validação: inteiro positivo ≥ 1"
  - Status: ✅
  - Evidência:
    [sprintComposerSchema.ts:24](apps/leader/src/renderer/stores/sprintComposerSchema.ts:24)
    `z.number().int().positive()`.
    [OperatorRow.tsx:37](apps/leader/src/renderer/components/OperatorList/OperatorRow.tsx:37)
    checa `!Number.isInteger(meta) || meta < 1`.
- **AC3** (US-01.02) "Campo aceita apenas números inteiros positivos"
  - Status: ✅ (input HTML `type="number"` + validação schema)
- **AC4** (US-01.02) "Valor default é vazio (obriga preenchimento explícito)"
  - Status: ✅
  - Evidência:
    [OperatorRow.tsx:38](apps/leader/src/renderer/components/OperatorList/OperatorRow.tsx:38)
    `displayValue = meta === null ? '' : ...`. Store inicia meta como `null` ao
    marcar.
- **AC5** (US-01.02) "Validação impede envio com meta zerada ou em branco"
  - Status: ✅
  - Evidência: `selectIsValid` delega para `selectFormPayload`, que falha schema
    se meta não positiva
    ([useSprintComposerStore.ts:119-143](apps/leader/src/renderer/stores/useSprintComposerStore.ts:119)).

**Veredito BL-C2-004:** ✅ Todos os ACs atendidos.

---

#### BL-C2-005 — Input de deadline (horário)

- **AC1** "Time picker para horário limite"
  - Status: ✅
  - Evidência:
    [DeadlineInput.tsx:39-47](apps/leader/src/renderer/components/DeadlineInput/DeadlineInput.tsx:39)
    `<input type="time">`.
- **AC2** "Default: 18:00"
  - Status: ✅
  - Evidência:
    [useSprintComposerStore.ts:21](apps/leader/src/renderer/stores/useSprintComposerStore.ts:21)
    `const DEFAULT_DEADLINE = '18:00'`.
- **AC3** "Validação: não pode ser no passado (com confirmação override)"
  - Status: ⚠️
  - Evidência:
    [DeadlineInput.tsx:48-53](apps/leader/src/renderer/components/DeadlineInput/DeadlineInput.tsx:48)
    mostra warning inline mas SEM confirmação explícita. Usuário pode disparar
    normalmente (não há checkbox "tenho certeza"). US-01.03 ("alerta opcional
    para forçar") é mais lenient — implementação alinha com US, não com backlog
    AC.
  - **Finding: F-009** (Low)

**Veredito BL-C2-005:** ⚠️ AC3 atende a US-01.03 mas não a literal do backlog AC
(sem confirmação explícita). F-009 (Low).

---

#### BL-C2-007 — Dispatch da sprint (gravar arquivos)

- **AC1** "Arquivos gerados com nomenclatura correta"
  - Status: ✅
  - Evidência:
    [packages/fs-adapter/src/domain/pending-store.ts:111](packages/fs-adapter/src/domain/pending-store.ts:111)
    usa `buildPendingFilename(sprint_id, user_id)` — convenção
    `<sprintId>-<userId>.json` ADR-006.
- **AC2** "Escrita atômica (write temp + rename)"
  - Status: ✅
  - Evidência:
    [pending-store.ts:115](packages/fs-adapter/src/domain/pending-store.ts:115)
    chama `adapter.writeFileAtomic`, que em Node usa `.tmp` com sufixo
    aleatório + `rename` (G-017).
- **AC3** "Erro de I/O é capturado e exibido claramente"
  - Status: ✅
  - Evidência:
    [dispatchService.ts:136-167](apps/leader/src/main/services/dispatchService.ts:136)
    try/catch por operador → `error_message` no
    `DispatchSprintPerOperatorResult`;
    [NovaSprint.tsx:60-68](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx:60)
    consome via `useDispatchStore` → DispatchModal.
- **AC4** "Falha parcial reportada (X de Y operadores enviados)"
  - Status: ✅
  - Evidência:
    [dispatchService.ts:172-176](apps/leader/src/main/services/dispatchService.ts:172)
    — `summary: { total, success, failed }` agregado per-operator.
- **Validação Zod antes** (descrição)
  - Status: ✅
  - Evidência:
    [dispatchService.ts:138](apps/leader/src/main/services/dispatchService.ts:138)
    `parseSprintPayload(...)` antes do `writePendingSprint`. Sanitização também
    aplicada antes (line 137).

**Veredito BL-C2-007:** ✅ Todos os ACs atendidos com defesa em profundidade.

---

#### BL-C2-011 — Estado global (Zustand)

- **AC** (descrição) "Configurar Zustand para estado compartilhado entre telas
  (sprint atual em composição, sprint em acompanhamento, lista de operadores
  cached)"
  - Status: ✅ (composer + operators) ⚠️ (acompanhamento)
  - Evidência:
    - [useSprintComposerStore.ts](apps/leader/src/renderer/stores/useSprintComposerStore.ts)
      — composer ✅
    - [useOperatorsStore.ts](apps/leader/src/renderer/stores/useOperatorsStore.ts)
      — operators cache ✅
    - [useDispatchStore.ts](apps/leader/src/renderer/stores/useDispatchStore.ts)
      — dispatch state ✅
    - "Sprint em acompanhamento" deferida para W2 (BL-C2-008 — Acompanhamento
      route é placeholder)

**Veredito BL-C2-011:** ✅ AC W1 atendida; rastro "acompanhamento" deferido
legitimamente para BL-C2-008 (W2). Não é finding.

---

#### BL-C3-003 — Loop de polling em `pending/`

- **AC1** "Polling não trava UI thread"
  - Status: ✅
  - Evidência:
    [pollingService.ts:153-156](apps/operator-agent/src/main/services/pollingService.ts:153)
    usa `setTimeout` recursivo em main process — separado do renderer.
- **AC2** "Erro de I/O é logado e ignorado (continua tentando)"
  - Status: ✅
  - Evidência:
    [pollingService.ts:122-143](apps/operator-agent/src/main/services/pollingService.ts:122)
    try/catch global no `pollOnce`; próximo ciclo agendado normalmente.
    `DirectoryNotFoundError` tratado como benigno (linha 136-138).
- **AC3** "Não processa o mesmo arquivo duas vezes"
  - Status: ✅
  - Evidência:
    [pollingService.ts:185](apps/operator-agent/src/main/services/pollingService.ts:185)
    `historyService.isAlreadyArchived(filename)` dedup;
    [historyService.ts:120-155](apps/operator-agent/src/main/services/historyService.ts:120)
    `initializeFromDisk` popula cache no boot para dedup pós-restart.
- **Default 3s** (descrição "polling_interval_seconds, default 3")
  - Status: ✅ (per ADR-004 e schema default)
- **Filtra por `*-{user_id}.json`** (descrição)
  - Status: ✅
  - Evidência:
    [pollingService.ts:124](apps/operator-agent/src/main/services/pollingService.ts:124)
    passa `userId` para `listPending`.
- **Processa em ordem cronológica** (descrição)
  - Status: ✅
  - Evidência: `PendingStore.listPending` ordena por `modifiedAt` ascendente
    ([pending-store.ts:197](packages/fs-adapter/src/domain/pending-store.ts:197)).

**Veredito BL-C3-003:** ✅ Todos os ACs atendidos.

---

#### BL-C3-004 — Renderer do overlay fullscreen TOPMOST

- **AC1** "`alwaysOnTop: true`"
  - Status: ✅
  - Evidência:
    [overlayService.ts:238](apps/operator-agent/src/main/services/overlayService.ts:238)
- **AC2** "`fullscreen: true`"
  - Status: ✅
  - Evidência:
    [overlayService.ts:236](apps/operator-agent/src/main/services/overlayService.ts:236)
- **AC3** "`frame: false`"
  - Status: ✅
  - Evidência:
    [overlayService.ts:237](apps/operator-agent/src/main/services/overlayService.ts:237)
- **AC4** "`skipTaskbar: true`"
  - Status: ❌
  - Evidência:
    [overlayService.ts:239](apps/operator-agent/src/main/services/overlayService.ts:239)
    — `skipTaskbar: false`. **Contradiz diretamente AC do backlog E o exemplo em
    CLAUDE.md §8.2**.
  - **Finding: F-002** (High)
- **AC5** "Janela aparece em todas as telas (multi-monitor)"
  - Status: ✅
  - Evidência:
    [overlayService.ts:259](apps/operator-agent/src/main/services/overlayService.ts:259)
    `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`.
- **AC6** "Funciona com `setAlwaysOnTop('screen-saver')`"
  - Status: ✅
  - Evidência:
    [overlayService.ts:258](apps/operator-agent/src/main/services/overlayService.ts:258).
- **AC7** "Testado contra Illustrator 2025, CorelDRAW 2024, Chrome em
  fullscreen"
  - Status: ⚠️ (não auditável via código — exige validação manual; ver Gate 9)
- **AC8** "Não causa flash branco no início"
  - Status: ✅
  - Evidência:
    [overlayService.ts:246-264](apps/operator-agent/src/main/services/overlayService.ts:246)
    `show: false` + `once('ready-to-show', () => win.show())`.

**Veredito BL-C3-004:** ❌ AC4 violada (skipTaskbar: false vs true). F-002
(High).

---

#### BL-C3-005 — Timer de minimização para tray

- **AC1** "Após `show_duration_seconds` (default 5), janela fecha"
  - Status: ❌
  - Evidência: Implementação usa `minimizeAfterMs` derivado de
    `minimize_after_seconds` em `agent-config.json` (campo extra-schema, default
    **30s**, per CLAUDE.md §4 C3 e ADR-019 D2) — NÃO usa o campo
    `show_duration_seconds` do `SprintPayload`. Resultado: (a) default 30s vs 5s
    da AC; (b) per-sprint customização documentada no schema é IGNORADA pelo
    Agent.
  - **Finding: F-003** (High)
- **AC2** "Ícone aparece na bandeja"
  - Status: ✅
  - Evidência: trayState transita para `sprint_active` quando há sprint na fila
    ([trayStateService.ts:76-77](apps/operator-agent/src/main/services/trayStateService.ts:76)).
- **AC3** "Botão 'OK, entendi' no overlay fecha antes do timeout"
  - Status: ⚠️ (semântica diverge — botão é "Recebi" e DISPARA o ack, não só
    fecha)
  - Evidência: O botão atual é `AckButton` com label "Recebi" — clique grava
    `acknowledged_at` (via `handleAck`). Backlog separa "fechar antes do
    timeout" (sem ack) vs "ack ao interagir" — implementação conflate ambos.
    UC-02 A1 alinha com a implementação ("ack inclui acknowledged_at"); US-02.02
    AC menciona "Botão 'OK, entendi'" especificamente.
  - **Finding: F-010** (Low) — copy diverge

**Veredito BL-C3-005:** ❌ AC1 violada (timer source e default). F-003 (High),
F-010 (Low).

---

#### BL-C3-006 — System tray icon e menu

- **AC1** "Ícone permanente na bandeja desde o boot do agente"
  - Status: ✅
  - Evidência:
    [trayService.ts:100-111](apps/operator-agent/src/main/services/trayService.ts:100)
    `boot()` chamado em `main/index.ts` após `app.whenReady`.
- **AC2** "Click esquerdo reabre último aviso"
  - Status: ❌
  - Evidência:
    [trayService.ts:107-111](apps/operator-agent/src/main/services/trayService.ts:107)
    — `new Tray(iconPath)` sem `.on('click', ...)`. Não há handler de
    left-click; default Windows abre o menu. Backlog AC explícita.
  - **Finding: F-005** (Medium)
- **AC3** "Click direito abre menu"
  - Status: ✅
  - Evidência:
    [trayService.ts:180](apps/operator-agent/src/main/services/trayService.ts:180)
    `tray.setContextMenu(...)`.
- **AC4** "Menu: 'Reabrir último aviso', 'Status da conexão', 'Sobre', 'Sair
  (admin)'"
  - Status: ⚠️
  - Evidência:
    [trayStateService.ts:119-143](apps/operator-agent/src/main/services/trayStateService.ts:119)
    — Implementação tem: "Sprint Operator Agent" (header), "Mostrar sprint
    atual" (≈ "Reabrir"), "Histórico local" (não está no backlog), "Sobre" ✅.
    **Falta "Status da conexão" e "Sair (admin)"**. CLAUDE.md justifica "Sair"
    oculto via RN-04 mas backlog AC não foi atualizado.
  - **Finding: F-004** (Medium)

**Veredito BL-C3-006:** ⚠️ ACs principais violadas (AC2 click esquerdo, AC4
itens do menu). F-004 (Medium), F-005 (Medium).

---

#### BL-C3-007 — Escrita de ack após exibição

- **AC1** "Imediatamente após renderizar o overlay, escreve
  `{sprint_id}-{user_id}.ack.json` em `acks/`"
  - Status: ✅
  - Evidência:
    [ackService.ts:85-106](apps/operator-agent/src/main/services/ackService.ts:85)
    `writeDisplayed` chamado em sequência ao `showSprint` (via main/index.ts
    wiring); filename derivado de `buildAckFilename` no AckStore.
- **AC2** "com `displayed_at` preenchido"
  - Status: ✅
  - Evidência:
    [ackService.ts:86-93](apps/operator-agent/src/main/services/ackService.ts:86)
    `displayed_at = this.now().toISOString()` injetado no payload do
    `parseSprintAck`.
- **AC3** "Atualiza ack com `acknowledged_at` ao fechar"
  - Status: ✅
  - Evidência:
    [ackService.ts:116-134](apps/operator-agent/src/main/services/ackService.ts:116)
    `writeAcknowledged` re-lê via `listAcks` para preservar `displayed_at`
    original, adiciona `acknowledged_at`, escreve overwrite via
    `AckStore.writeAck` (BL-C4-006 caso de uso explícito).

**Veredito BL-C3-007:** ✅ Todos os ACs atendidos com fluxo bem desenhado.

---

#### BL-C3-008 — Movimentação de arquivo processado para histórico local

- **AC1** "Move arquivo de `pending/` para histórico local"
  - Status: ✅ (operação composta — copy via JSON serialize + delete)
  - Evidência:
    [handleAck.ts](apps/operator-agent/src/main/handlers/handleAck.ts) orquestra
    `historyService.archive` (escreve em historico/) +
    `pendingStore.deletePending` (remove de pending/).
- **AC2** "Para `C:\ProgramData\SprintAgent\historico\`"
  - Status: ❌
  - Evidência:
    [historyService.ts:57](apps/operator-agent/src/main/services/historyService.ts:57)
    `getHistoricoPath()` retorna `path.join(this.userDataPath, 'historico')`.
    `userDataPath` vem de `app.getPath('userData')` que resolve para
    `%APPDATA%\sprint-operator-agent\` (per-user), NÃO
    `C:\ProgramData\SprintAgent\` (all-users). Requisitos Anexo B explícito
    ("C:\ProgramData\SprintAgent\historico\"). CLAUDE.md G-022 documenta a
    divergência de paths mas Requisitos não foi atualizado.
  - **Finding: F-006** (High) — também afeta config.json, logs (todos em
    userData, não ProgramData)
- **AC3** "Garante que não será processado de novo"
  - Status: ✅
  - Evidência:
    [historyService.ts:107](apps/operator-agent/src/main/services/historyService.ts:107)
    `markProcessed(filename)` adiciona ao cache; `initializeFromDisk` re-popula
    em restart; `pollingService.processSprint` consulta `isAlreadyArchived`
    antes de enfileirar.

**Veredito BL-C3-008:** ❌ AC2 viola Requisitos Anexo B. F-006 (High).

---

#### BL-C4-002 — Implementação: writePending

- **AC** (descrição) "Escreve arquivo JSON em `pending/`. Escrita atômica: cria
  `.tmp`, depois `rename`. Garante visibilidade imediata."
  - Status: ✅
  - Evidência:
    [pending-store.ts:105-117](packages/fs-adapter/src/domain/pending-store.ts:105)
    `writePendingSprint` chama `adapter.writeFileAtomic` que em Node usa `.tmp`
    com sufixo aleatório de 6 bytes hex + `rename` (G-017). Validação Zod
    re-aplicada antes (line 106); sanitização de `body_html` aplicada (line 109)
    — defesa em profundidade.

**Veredito BL-C4-002:** ✅ Atende descrição com folga (defesa em profundidade
extra).

---

#### BL-C4-003 — Implementação: listPending e listAcks

- **AC** (descrição) "Lista arquivos das pastas `pending/acks` com opção de
  filtro por `user_id` ou `sprint_id`. Ordena por `mtime` crescente."
  - Status: ✅
  - Evidência:
    - [pending-store.ts:143-199](packages/fs-adapter/src/domain/pending-store.ts:143)
      `listPending({ userId, sprintId })` — filtros pré-I/O (linhas 154-163),
      sort por `modifiedAt` ascending (line 197).
    - [ack-store.ts:116-158](packages/fs-adapter/src/domain/ack-store.ts:116)
      `listAcks({ userId, sprintId })` — mesma estrutura, sort ascending (line
      156).
    - Ambos race-safe (`FileNotFoundError` skip em stat/read) e aplicam RN-09
      (arquivos malformados viram `kind: 'invalid'`).

**Veredito BL-C4-003:** ✅ Atende e excede descrição.

---

#### BL-C4-006 — Implementação: writeAck

- **AC** (descrição) "Escreve ack em `acks/`. Permite atualização (sobrescrita)
  para incluir `acknowledged_at` depois."
  - Status: ✅
  - Evidência:
    [ack-store.ts:99-107](packages/fs-adapter/src/domain/ack-store.ts:99)
    `writeAck`. Overwrite documentado nas linhas 91-94 da própria função:
    "chamadas sucessivas com mesmo `sprint_id` + `user_id` produzem o mesmo
    path; o `writeFileAtomic` sobrescreve o anterior via `rename`". Exercitado
    em
    [ack-store.adversarial.test.ts](packages/fs-adapter/src/domain/ack-store.adversarial.test.ts)
    ("overwrite progressivo 3×").

**Veredito BL-C4-006:** ✅ Caso de uso de overwrite implementado e testado.

---

#### BL-C4-007 — Mock adapter para testes

- **AC** (descrição) "Implementação in-memory do `IFilesystemAdapter` para
  testes unitários. Permite simular concorrência, falhas, latência."
  - Status: ⚠️
  - Evidência:
    - In-memory: ✅
      [memory-adapter.ts:27-164](packages/fs-adapter/src/memory-adapter.ts:27)
      implementa `IFilesystemAdapter` via `Map`.
    - Concorrência: ✅ múltiplas operações async funcionam em memory.
    - Falhas + latência: ❌ NÃO há API explícita `injectFailure(method, error)`
      nem `setLatencyMs(ms)`. Workaround documentado em CLAUDE.md (subseção
      fs-adapter, linha ~262): "use
      `vi.spyOn(adapter, 'metodo').mockRejectedValueOnce(err)`". Decisão
      consciente (SESSão 18 ADR-021) mas backlog AC literal não foi atualizada.
  - **Finding: F-001** (Low — workaround documentado em CLAUDE.md, sem impacto
    operacional)

**Veredito BL-C4-007:** ⚠️ Concorrência cobre; falhas/latência via workaround
externo (vi.spyOn). F-001 (Low).

---

#### BL-C6-001 — Pacote `@sprint/logger` com Pino

- **AC** (descrição) "Wrapper sobre Pino com transports configurados para
  arquivo local rotacionado (1 arquivo por dia, retenção 30 dias). API simples:
  `logger.info(msg, ctx)`, `logger.error(...)`."
  - Status: ⚠️ (API ✅, transports/rotação ❌)
  - Evidência:
    - Wrapper Pino: ✅ [createLogger.ts](packages/logger/src/createLogger.ts) +
      barrel.
    - API `info`/`error` + 5 níveis: ✅ wrap em createLogger.
    - **File transport rotacionado (1/dia, 30 dias)**: ❌ NÃO IMPLEMENTADO.
      Deferido para "BL-C6-003 W3" per SESSION_LOG Sessão 17 e CHANGELOG, mas o
      BL-C6-003 do backlog é "Logs no Agent" (integração) — não "file
      transport". Drift de numeração/escopo entre backlog e implementação.
  - **Finding: F-007** (Medium — falta feature explícita do backlog)

**Veredito BL-C6-001:** ⚠️ API atende; transport rotacionado ausente. F-007
(Medium).

---

#### BL-C8-002 — Testes unitários C1 (contracts)

- **AC** (descrição) "Cobertura ≥ 90% em validação de schemas, sanitização HTML,
  naming, geração de ULID."
  - Status: ✅
  - Evidência: Baseline Gate 1 — `@sprint/contracts` em **100/100/100/100** (317
    testes em 14 arquivos). Threshold configurado 98/95/98/98 com folga. Cobre
    todos os domínios listados: schemas (4 arquivos), sanitize, filenames, ids.

**Veredito BL-C8-002:** ✅ Excede AC com folga (10 pontos acima).

---

#### BL-C8-003 — Testes unitários C4 (filesystem adapter)

- **AC** (descrição) "Testar usando mock adapter (BL-C4-007) e adapter real
  apontando para diretório temporário. Cobertura ≥ 80%."
  - Status: ✅
  - Evidência:
    - Mock adapter usado: ✅ `MemoryFilesystemAdapter` em
      [contract.test.ts](packages/fs-adapter/src/__tests__/contract.test.ts) +
      [parity.test.ts](packages/fs-adapter/src/integration/parity.test.ts).
    - Real adapter em tmpdir: ✅ via
      [**helpers**/tmpFixtures.ts](packages/fs-adapter/src/__helpers__/tmpFixtures.ts)
      `setupTmpShared`.
    - Cobertura: 100% lines / 99.53% branch / 100% funcs / 100% stmts (threshold
      configurado 95/95/95/95) — 19 pontos de folga sobre AC.

**Veredito BL-C8-003:** ✅ Excede AC com folga substancial.

---

#### Resumo Gate 2 — Backlog Compliance

Status agregado dos 20 BLs W1:

| Comp | BL        | Veredito   | Findings                       |
| ---- | --------- | ---------- | ------------------------------ |
| C1   | BL-C1-004 | ✅         | —                              |
| C2   | BL-C2-002 | ⚠️ AC3     | F-008 (Low)                    |
| C2   | BL-C2-003 | ✅         | —                              |
| C2   | BL-C2-004 | ✅         | —                              |
| C2   | BL-C2-005 | ⚠️ AC3     | F-009 (Low)                    |
| C2   | BL-C2-007 | ✅         | —                              |
| C2   | BL-C2-011 | ✅         | —                              |
| C3   | BL-C3-003 | ✅         | —                              |
| C3   | BL-C3-004 | ❌ AC4     | F-002 (High)                   |
| C3   | BL-C3-005 | ❌ AC1     | F-003 (High), F-010 (Low)      |
| C3   | BL-C3-006 | ⚠️ AC2+AC4 | F-004 (Medium), F-005 (Medium) |
| C3   | BL-C3-007 | ✅         | —                              |
| C3   | BL-C3-008 | ❌ AC2     | F-006 (High)                   |
| C4   | BL-C4-002 | ✅         | —                              |
| C4   | BL-C4-003 | ✅         | —                              |
| C4   | BL-C4-006 | ✅         | —                              |
| C4   | BL-C4-007 | ⚠️         | F-001 (Low)                    |
| C6   | BL-C6-001 | ⚠️         | F-007 (Medium)                 |
| C8   | BL-C8-002 | ✅         | —                              |
| C8   | BL-C8-003 | ✅         | —                              |

- **✅ Totalmente atendidos:** 12 BLs (60%)
- **⚠️ Atende parcial:** 5 BLs (25%)
- **❌ Falha em AC obrigatória:** 3 BLs (15%) — todos em C3 (Agent)

**Findings novos neste gate: 10 (3 High, 3 Medium, 4 Low).** Todos os 3 High
estão no C3 (Agent) — concentração relevante a tratar antes da W2.

### Categoria 2 — Rastreabilidade de Requisitos

Matriz bidirecional entre requisitos (RF/RN/RNF/US) extraídos de
`requisitos.docx` e implementação no W1. Convenção de status: ✅ atende; ⚠️
parcial; ❌ falta; ⏸️ deferido legitimamente para wave futura.

#### Requisitos Funcionais (RF-01 a RF-22)

| RF    | Texto resumido                                            | Prioridade | BL                                         | Wave             | Status | Arquivo:linha / Notas                                                                                                                                                                                   |
| ----- | --------------------------------------------------------- | ---------- | ------------------------------------------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-01 | Seleção múltipla de operadores via checkbox               | Must       | BL-C2-003                                  | W1               | ✅     | [OperatorList.tsx](apps/leader/src/renderer/components/OperatorList/OperatorList.tsx) + [OperatorRow.tsx:92-114](apps/leader/src/renderer/components/OperatorList/OperatorRow.tsx:92)                   |
| RF-02 | Meta numérica individual por operador                     | Must       | BL-C2-004                                  | W1               | ✅     | [OperatorRow.tsx:58-85](apps/leader/src/renderer/components/OperatorList/OperatorRow.tsx:58) + [sprintComposerSchema.ts:24](apps/leader/src/renderer/stores/sprintComposerSchema.ts:24)                 |
| RF-03 | Definição de horário limite (deadline)                    | Must       | BL-C2-005                                  | W1               | ⚠️     | [DeadlineInput.tsx:39-47](apps/leader/src/renderer/components/DeadlineInput/DeadlineInput.tsx:39) — F-009 (warning sem confirmação)                                                                     |
| RF-04 | Gera arquivo JSON por operador em `pending/`              | Must       | BL-C2-007                                  | W1               | ✅     | [dispatchService.ts:118-178](apps/leader/src/main/services/dispatchService.ts:118) + [pending-store.ts:105-117](packages/fs-adapter/src/domain/pending-store.ts:105)                                    |
| RF-05 | Agente detecta em ≤ 5s arquivos do seu user_id            | Must       | BL-C3-003                                  | W1               | ✅     | [pollingService.ts:122-156](apps/operator-agent/src/main/services/pollingService.ts:122) — default 3s                                                                                                   |
| RF-06 | Overlay fullscreen TOPMOST com título + body HTML         | Must       | BL-C3-004                                  | W1               | ❌     | [overlayService.ts:234-274](apps/operator-agent/src/main/services/overlayService.ts:234) — F-002 (`skipTaskbar: false`)                                                                                 |
| RF-07 | Minimiza após `show_duration_seconds`                     | Must       | BL-C3-005                                  | W1               | ❌     | [overlayService.ts:220-225](apps/operator-agent/src/main/services/overlayService.ts:220) — F-003 (campo `show_duration_seconds` IGNORADO; usa `minimize_after_seconds` config-level, default 30s vs 5s) |
| RF-08 | Reabertura do aviso via ícone da bandeja                  | Must       | BL-C3-009 (W2) parcial em W1 via BL-C3-006 | W1+W2            | ⚠️     | [trayService.ts:107-111](apps/operator-agent/src/main/services/trayService.ts:107) — menu funciona; F-005 (left-click sem handler)                                                                      |
| RF-09 | Escreve ack em `acks/` com `displayed_at`                 | Must       | BL-C3-007                                  | W1               | ✅     | [ackService.ts:85-106](apps/operator-agent/src/main/services/ackService.ts:85) + [ack-store.ts:99-107](packages/fs-adapter/src/domain/ack-store.ts:99)                                                  |
| RF-10 | Líder vê status de ack em tempo quase-real                | Must       | BL-C2-008                                  | W2               | ⏸️     | Acompanhamento route é placeholder. Backlog explícito W2.                                                                                                                                               |
| RF-11 | Cancelamento de sprint ativa                              | Should     | BL-C2-009                                  | W2               | ⏸️     | Backlog W2                                                                                                                                                                                              |
| RF-12 | Preserva histórico em `arquivo/`                          | Should     | BL-C4-005                                  | W3               | ⏸️     | `ArchiveStore` é stub (`NotImplementedError`) — backlog W3                                                                                                                                              |
| RF-13 | Customização de texto do aviso                            | Should     | BL-C2-006                                  | W2               | ⏸️     | Title/body fixos em [dispatchService.ts:41-42](apps/leader/src/main/services/dispatchService.ts:41) — backlog W2                                                                                        |
| RF-14 | Som de notificação ao receber aviso                       | Could      | BL-C3-014                                  | W3               | ⏸️     | Backlog W3                                                                                                                                                                                              |
| RF-15 | Consulta de histórico via interface                       | Could      | BL-C2-010                                  | W3               | ⏸️     | Historico route é placeholder. Tray "Histórico local" abre folder via shell.openPath (parcial).                                                                                                         |
| RF-16 | Enfileira múltiplos avisos pendentes em ordem cronológica | Must       | BL-C3-010 (W2)                             | W1 _(adiantado)_ | ✅     | [queueService.ts:46-152](apps/operator-agent/src/main/services/queueService.ts:46) — FIFO + dedup; entregue em W1 apesar do backlog tagear W2. **Discrepância: backlog/SESSION_LOG não atualizado.**    |
| RF-17 | Sanitiza HTML do corpo do aviso (whitelist tags)          | Must       | BL-C1-004                                  | W1               | ✅     | [sanitize.ts](packages/contracts/src/sanitize.ts)                                                                                                                                                       |
| RF-18 | Ignora sprints com `deadline_at` no passado               | Must       | BL-C3-012 (W2)                             | W1 _(adiantado)_ | ✅     | [pollingService.ts:191-206](apps/operator-agent/src/main/services/pollingService.ts:191) — implementado em W1 apesar do backlog tagear W2. **Discrepância: backlog não atualizado.**                    |
| RF-19 | Agent inicia automaticamente a cada logon                 | Must       | BL-C5-003                                  | W3               | ⏸️     | Backlog W3 — afeta validade do MVP smoke em produção (instalação manual usada em Sessão 16)                                                                                                             |
| RF-20 | Inicialização do agente silenciosa                        | Must       | BL-C5-003                                  | W3               | ⏸️     | Backlog W3                                                                                                                                                                                              |
| RF-21 | Ícone na bandeja confirmando execução                     | Must       | BL-C3-006                                  | W1               | ⚠️     | [trayService.ts](apps/operator-agent/src/main/services/trayService.ts) — F-004 (menu diverge) + F-005 (sem left-click)                                                                                  |
| RF-22 | Instalador permite escolha de mecanismo (Anexo G)         | Should     | BL-C5-007                                  | W4               | ⏸️     | Backlog W4                                                                                                                                                                                              |

**Discrepâncias RF detectadas:**

- **RF-16** entregue em W1 (queueService) mas backlog/SESSION_LOG marca
  BL-C3-010 como W2 (não-concluído). **Adiantamento não documentado.** Finding
  adicional? Já é benefício; documento atualizado seria suficiente.
- **RF-18** mesmo padrão — entregue em W1 (pollingService) mas BL-C3-012 marcado
  W2.

#### Regras de Negócio (RN-01 a RN-13)

| RN    | Texto resumido                                        | BL                           | Wave  | Status | Arquivo:linha / Notas                                                                                                                                                                                       |
| ----- | ----------------------------------------------------- | ---------------------------- | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RN-01 | Apenas grupo "Sprint Leaders" do AD pode disparar     | BL-C2-012                    | W3    | ⏸️     | Backlog W3                                                                                                                                                                                                  |
| RN-02 | Cada operador tem user_id único                       | implícito                    | W1    | ✅     | [userIdSchema](packages/contracts/src/schemas/shared.ts) + `operatorsService` valida `operators.json`                                                                                                       |
| RN-03 | Sprint com `deadline_at` no passado é expirada        | implícito via BL-C3-012/-018 | W1    | ✅     | [pollingService.ts:215-218](apps/operator-agent/src/main/services/pollingService.ts:215)                                                                                                                    |
| RN-04 | Reabertura de aviso via ícone NÃO gera novo ack       | BL-C3-009                    | W1+W2 | ✅     | [overlayService.ts:123-131](apps/operator-agent/src/main/services/overlayService.ts:123) `restoreCurrent` apenas mostra/foca; ack não é tocado                                                              |
| RN-05 | Cancelamento só pelo líder que disparou               | BL-C2-009                    | W2    | ⏸️     | Backlog W2                                                                                                                                                                                                  |
| RN-06 | Nova sprint cancela anterior (last-write-wins)        | BL-C2-009/-011               | W2    | ⏸️     | Backlog W2 — queueService dedupa por sprint_id, não substitui                                                                                                                                               |
| RN-07 | Meta inteiro positivo ≥ 1                             | BL-C2-004                    | W1    | ✅     | [sprintComposerSchema.ts:24](apps/leader/src/renderer/stores/sprintComposerSchema.ts:24) `z.number().int().positive()`                                                                                      |
| RN-08 | Arquivos > 7 dias arquivados automaticamente          | BL-C4-008                    | W4    | ⏸️     | Backlog W4                                                                                                                                                                                                  |
| RN-09 | Malformado: log + ignora silenciosamente              | implícito em fs-adapter      | W1    | ✅     | [pending-store.ts:181](packages/fs-adapter/src/domain/pending-store.ts:181) — entry com `kind: 'invalid'`; [pollingService.ts:162](apps/operator-agent/src/main/services/pollingService.ts:162) loga e skip |
| RN-10 | HTML aceita apenas tags whitelisted                   | BL-C1-004                    | W1    | ✅     | [constants.ts:77](packages/contracts/src/constants.ts:77) `ALLOWED_HTML_TAGS`                                                                                                                               |
| RN-11 | Agent inicia auto com Windows — nunca abertura manual | BL-C5-003                    | W3    | ⏸️     | Backlog W3 — afeta validade operacional (smoke W1 fez launch manual)                                                                                                                                        |
| RN-12 | EXE do líder é aberto manualmente                     | n/a                          | W1    | ✅     | implícito (Leader não tem auto-start)                                                                                                                                                                       |
| RN-13 | Agent encerrado → reinicia via admin ou watchdog      | BL-C3-013                    | W3    | ⏸️     | Backlog W3                                                                                                                                                                                                  |

#### Requisitos Não-Funcionais (RNF-01 a RNF-22) — apenas W1 e foco do prompt

| RNF       | Texto resumido                               | Prioridade | Wave  | Status | Arquivo:linha / Notas                                                                                                                                                                 |
| --------- | -------------------------------------------- | ---------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01    | Aviso aparece em ≤ 5s                        | Must       | W1    | ✅     | polling 3s default                                                                                                                                                                    |
| RNF-02    | Ack refletido no painel do líder em ≤ 5s     | Must       | W2    | ⏸️     | depende BL-C2-008 (W2)                                                                                                                                                                |
| RNF-03    | Polling < 1% CPU em média                    | Must       | W1    | ⚠️     | Designed for (listing pasta pequena via fs/promises). Não medido empiricamente — Gate 9.                                                                                              |
| RNF-04    | Tráfego polling < 10 KB/min por agente       | Must       | W1    | ⚠️     | Designed for. Não medido — Gate 9.                                                                                                                                                    |
| RNF-05    | 100% rede local, sem internet                | Must       | W1    | ✅     | Sem `fetch`, sem WebSocket — apenas fs                                                                                                                                                |
| RNF-06    | Agentes desligados processam ao ligar        | Must       | W1    | ✅     | Polling no boot via [pollingService.start()](apps/operator-agent/src/main/services/pollingService.ts:96)                                                                              |
| RNF-07    | Sobrevive queda do servidor de arquivos      | Must       | W1+W3 | ⚠️     | Parcial: pollingService tolera DirectoryNotFoundError; **mas sem backoff/red tray** (BL-C3-013 W3)                                                                                    |
| RNF-08/09 | Compatível com Windows 10 (1809+) e 11       | Must       | W1    | ⚠️     | Build target Electron 42 — não validado em estação real (Gate 9)                                                                                                                      |
| RNF-10    | Funciona com Adobe CC e CorelDRAW abertos    | Must       | W1    | ⚠️     | Não validado — Gate 9                                                                                                                                                                 |
| RNF-11    | Interface do líder em pt-BR                  | Must       | W1    | ✅     | Strings em pt-BR ("Disparar evento", "Carregando configuração", "rodada de metas")                                                                                                    |
| RNF-12    | Avisos em pt-BR                              | Must       | W1    | ✅     | Default "É hora de correr", body "Sua meta até o final do dia é de..."                                                                                                                |
| RNF-13/14 | Sem treinamento necessário                   | Must       | W1    | UX     | Não auditável via código                                                                                                                                                              |
| RNF-15    | Sistema não abre portas                      | Must       | W1    | ✅     | Sem servidor, sem listening                                                                                                                                                           |
| RNF-16    | Sem conexões externas à rede                 | Must       | W1    | ✅     | Apenas fs (shared SMB + userData local)                                                                                                                                               |
| RNF-17    | Agent valida formato JSON antes de processar | Must       | W1    | ✅     | [PendingStore.listPending](packages/fs-adapter/src/domain/pending-store.ts:143-199) parsa via Zod                                                                                     |
| RNF-18    | Sanitização HTML contra injeção              | Must       | W1    | ✅     | [sanitize.ts](packages/contracts/src/sanitize.ts) + re-sanitize defensivo no renderer ([SprintCard.tsx:24](apps/operator-agent/src/renderer/components/SprintCard/SprintCard.tsx:24)) |
| RNF-19    | NTFS restringe escrita em pending            | Must       | W1    | infra  | Responsabilidade da TI (não código)                                                                                                                                                   |
| RNF-20    | Logs gerados em arquivo local                | Must       | W1    | ❌     | **NÃO IMPLEMENTADO** — F-007 (file rotation deferido para "BL-C6-003 W3"). Agent em prod (NSIS, sem console) não tem log persistido.                                                  |
| RNF-21    | Config em arquivo único editável             | Must       | W1    | ✅     | `config.json` único                                                                                                                                                                   |
| RNF-22    | Atualização via substituição do EXE          | Must       | W1    | ✅     | electron-builder portable + NSIS                                                                                                                                                      |

#### User Stories — épicos E-01 a E-04 (W1 obligations)

| US       | Texto                                            | Prioridade | Status | Notas                                                             |
| -------- | ------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------- |
| US-01.01 | Selecionar múltiplos operadores via checkbox     | Must       | ✅     | RF-01 OK                                                          |
| US-01.02 | Definir meta numérica por operador               | Must       | ✅     | RF-02 OK                                                          |
| US-01.03 | Definir horário limite                           | Must       | ⚠️     | F-009 (warning sem confirmação)                                   |
| US-01.04 | Customizar texto do aviso                        | Should     | ⏸️ W2  | BL-C2-006 deferido                                                |
| US-01.05 | Confirmação de disparo                           | Must       | ✅     | DispatchModal feedback                                            |
| US-02.01 | Aviso aparece sobre qualquer programa (TOPMOST)  | Must       | ⚠️     | F-002 (skipTaskbar) — TOPMOST funciona; janela visível na taskbar |
| US-02.02 | Aviso minimiza sozinho após N segundos           | Must       | ⚠️     | F-003 (timer source) + F-010 (button label)                       |
| US-02.03 | Reabrir aviso pelo ícone da bandeja              | Must       | ⚠️     | F-005 (left-click sem handler) — workaround via menu              |
| US-02.04 | Ack para feedback do líder                       | Should     | ✅     | `displayed_at` + `acknowledged_at`                                |
| US-04.01 | Instalador único para nova estação               | Must       | ⏸️ W3  | NSIS configurado mas auto-start não — BL-C5-003 W3                |
| US-04.02 | Definir quem pode disparar sprints               | Must       | ⏸️ W3  | RN-01 deferido                                                    |
| US-04.03 | Agent inicia auto após logon                     | Must       | ⏸️ W3  | RF-19 deferido                                                    |
| US-04.04 | Escolher mecanismo de auto-start                 | Should     | ⏸️ W4  | RF-22 deferido                                                    |
| US-05.01 | Consultar sprints disparadas em datas anteriores | Could      | ⏸️ W3  | RF-15 deferido                                                    |

#### Casos de Uso (UC-01 a UC-08)

| UC    | Nome                | Status W1 | Notas                                                                                                  |
| ----- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| UC-01 | Disparar Sprint     | ✅        | BL-C2-007 cobre fluxo principal + alternativas A1/A2                                                   |
| UC-02 | Visualizar Aviso    | ⚠️        | Fluxo principal funciona; F-003 (timer) afeta UX; A1 ("OK, entendi") → F-010                           |
| UC-03 | Reabrir Aviso       | ⚠️        | F-005 (left-click broken); workaround via tray menu                                                    |
| UC-04 | Acompanhar Acks     | ⏸️ W2     | Placeholder route — BL-C2-008                                                                          |
| UC-05 | Cancelar Sprint     | ⏸️ W2     | Deferido                                                                                               |
| UC-06 | Configurar Estação  | ⚠️        | Instalador NSIS existe, mas sem wizard de config (BL-C5-006 W3); requer edição manual de `config.json` |
| UC-07 | Consultar Histórico | ⏸️ W3     | Deferido                                                                                               |
| UC-08 | Limpar Expiradas    | ⏸️ W4     | Deferido                                                                                               |

#### Auditoria inversa — implementações sem requisito explícito

| Implementação                                           | Requisito que justifica                                                                 | Status                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Tray menu item "Histórico local" → `shell.openPath`     | Nenhum RF W1; RF-15 é Could W3                                                          | ⚠️ scope creep menor — útil mas não solicitado |
| `dev-fixtures/` (operators.json + estrutura shared)     | Apoio a Gate 9 (Sessão 16) — não vai pra produção                                       | ✅ infraestrutura de dev                       |
| Re-sanitização no SprintCard (defesa em profundidade)   | ADR-014 + RNF-18                                                                        | ✅ legítimo                                    |
| Composition root pattern `rebuildDeps` (Agent + Leader) | ADR-017 — config recovery sem restart                                                   | ✅ legítimo                                    |
| Campo `minimize_after_seconds` (agent-config extra)     | Nenhum — substitui `show_duration_seconds` do schema sem ADR direta cobrindo a INVERSÃO | ⚠️ → F-003 já cobre                            |

#### Auditoria inversa — campos do schema não consumidos pela implementação

| Campo                                 | Schema                                                                                    | Default | Implementação                                                   | Finding        |
| ------------------------------------- | ----------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------- | -------------- |
| `SprintPayload.show_duration_seconds` | [sprint-payload.schema.ts:26](packages/contracts/src/schemas/sprint-payload.schema.ts:26) | 5       | **NÃO LIDO** — Agent usa `minimize_after_seconds` do config     | F-003          |
| `SprintPayload.persistent_popup`      | [sprint-payload.schema.ts:27](packages/contracts/src/schemas/sprint-payload.schema.ts:27) | `true`  | **NÃO LIDO** — overlay sempre permanece reabrível via tray menu | **F-011 novo** |

#### Resumo Gate 3 — Rastreabilidade

- **22 RFs auditados:** 10 atendidos ✅, 4 parcial ⚠️, 2 falha ❌ (RF-06,
  RF-07), 8 deferidos ⏸️ legítimos (W2/W3/W4)
- **13 RNs auditados:** 7 ativos no W1 (6 ✅ + 1 ⚠️ via UC), 6 deferidos
- **22 RNFs auditados:** 14 W1-aplicáveis: 11 ✅, 2 ⚠️ não-medidos (RNF-03,
  RNF-04), 1 ❌ (RNF-20 — F-007), 4 não-código (infra/UX)
- **14 USs W1 obligation:** 5 ✅, 4 ⚠️, 5 ⏸️ legítimos
- **8 UCs:** 1 ✅, 3 ⚠️, 4 ⏸️ legítimos

**1 novo finding criado:** F-011 (Medium) — campo `persistent_popup` ignorado.

**2 discrepâncias notáveis (não-findings — beneficiam o produto, mas dignas de
registro):** RF-16 e RF-18 entregues em W1 apesar do backlog tagear
BL-C3-010/-012 como W2. Documentação (backlog/SESSION_LOG) deveria atualizar.

### Categoria 3 — Conformidade Arquitetural

Auditoria das 11 verificações específicas + 21 ADRs do `DECISIONS.md`.

#### Verificações específicas obrigatórias (do prompt §5 Gate 4)

| #   | Verificação                                                                                                 | Resultado | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `nodeIntegration: false` em todo BrowserWindow                                                              | ✅        | [apps/leader/src/main/index.ts:73](apps/leader/src/main/index.ts:73), [apps/operator-agent/src/main/services/overlayService.ts:250](apps/operator-agent/src/main/services/overlayService.ts:250)                                                                                                                                                                                                                                                                                                                                 |
| 2   | `contextIsolation: true` em todo BrowserWindow                                                              | ✅        | [apps/leader/src/main/index.ts:72](apps/leader/src/main/index.ts:72), [overlayService.ts:249](apps/operator-agent/src/main/services/overlayService.ts:249)                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | `sandbox: true` em todo BrowserWindow                                                                       | ✅        | [leader/index.ts:74](apps/leader/src/main/index.ts:74), [overlayService.ts:251](apps/operator-agent/src/main/services/overlayService.ts:251)                                                                                                                                                                                                                                                                                                                                                                                     |
| 3a  | `webSecurity: true` + `allowRunningInsecureContent: false` + `experimentalFeatures: false` (CLAUDE.md §8.1) | ✅        | Ambas as windows têm todas as flags explícitas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | `contextBridge.exposeInMainWorld` em ambos os preloads                                                      | ✅        | [apps/leader/src/preload/index.ts:61](apps/leader/src/preload/index.ts:61), [apps/operator-agent/src/preload/index.ts:92](apps/operator-agent/src/preload/index.ts:92). Ambos expõem objeto tipado `api`.                                                                                                                                                                                                                                                                                                                        |
| 5   | IPC channels naming consistente                                                                             | ⚠️        | **Inconsistência detectada** — Leader usa camelCase (`ping`, `getConfig`, `listOperators`, `dispatchSprint`); Agent usa `scope:action` (`config:get`, `sprint:request-current`, `sprint:acknowledge`). **F-013 (Low)**                                                                                                                                                                                                                                                                                                           |
| 6   | IpcResult envelope em todos os handlers                                                                     | ⚠️        | Maioria envelopada via `IpcResult<T>` ou discriminated union dedicado. **Exceções:** `ping` retorna `string` puro ([leader/main/ipc.ts:57](apps/leader/src/main/ipc.ts:57)); `sprint:request-current` retorna `IncomingSprintEvent \| null` bare ([agent/main/index.ts:301-304](apps/operator-agent/src/main/index.ts:301)). **F-014 (Low)**                                                                                                                                                                                     |
| 7   | **Renderer isolation** — sem `fs`/`path`/`@sprint/fs-adapter` em renderer                                   | ✅        | `grep` em `apps/*/src/renderer/**/*.{ts,tsx}` retornou ZERO matches. Crítico passa.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | Atomic writes — toda escrita em path persistente via adapter                                                | ⚠️        | `NodeFilesystemAdapter.writeFileAtomic` ([node-adapter.ts:29-80](packages/fs-adapter/src/node-adapter.ts:29)) — write → fsync → rename — implementado. **Mas:** Agent `historyService.archive` ([historyService.ts:97-108](apps/operator-agent/src/main/services/historyService.ts:97)) usa `fs.writeFile` + `fs.rename` DIRETO (sem passar pelo `IFilesystemAdapter`). Config loaders (Leader + Agent) idem (documentado em CLAUDE.md §4 como exceção W0). HistoryService NÃO está documentado como exceção. **F-012 (Medium)** |
| 9   | Sanitização no Leader antes do `writePending`                                                               | ✅        | Duas camadas: [dispatchService.ts:137](apps/leader/src/main/services/dispatchService.ts:137) sanitiza antes do `pendingStore.writePendingSprint`; [pending-store.ts:109](packages/fs-adapter/src/domain/pending-store.ts:109) re-sanitiza (defesa em profundidade).                                                                                                                                                                                                                                                              |
| 10  | Re-sanitização no Agent renderer antes de `dangerouslySetInnerHTML`                                         | ✅        | [SprintCard.tsx:24](apps/operator-agent/src/renderer/components/SprintCard/SprintCard.tsx:24) `const safeHtml = sanitizeBodyHtml(sprint.body_html)` antes de [SprintCard.tsx:31](apps/operator-agent/src/renderer/components/SprintCard/SprintCard.tsx:31) `dangerouslySetInnerHTML={{ __html: safeHtml }}`.                                                                                                                                                                                                                     |
| 11  | Selectors puros separados das stores                                                                        | ✅        | `selectIsValid`, `selectSelectedCount`, `selectFormPayload`, `selectDispatchRequest`, `selectIsDispatching`, `selectExtraInQueue` — todos exportados top-level, recebem state, retornam derivações sem mutar.                                                                                                                                                                                                                                                                                                                    |

#### Auditoria por ADR (21 ADRs em `DECISIONS.md`)

| ADR     | Tema                                   | Conformidade | Notas                                                                                                                                                                    |
| ------- | -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ADR-001 | Monorepo pnpm + Turborepo + Changesets | ✅           | `pnpm-workspace.yaml` + `turbo.json` (chave `tasks`) + `.changeset/` presentes.                                                                                          |
| ADR-002 | Electron como runtime desktop          | ✅           | Ambos apps Electron. Single tech stack honrado.                                                                                                                          |
| ADR-003 | Pasta compartilhada SMB                | ✅           | Toda comunicação via `<sharedPath>/pending/` + `/acks/`. Sem sockets, sem HTTP.                                                                                          |
| ADR-004 | Polling (sem fs.watch)                 | ✅           | `pollingService` usa `setTimeout` recursivo; `grep fs.watch\|chokidar` retorna apenas JSDoc explicando proibição.                                                        |
| ADR-005 | Schema-first via `z.infer`             | ✅           | Schemas Zod em `packages/contracts/src/schemas/`; tipos via `z.infer<typeof X>`. Sem interface paralela.                                                                 |
| ADR-006 | Naming de arquivos com ULID completo   | ✅           | `buildPendingFilename`/`buildAckFilename` consumidos em `pending-store.ts:111` + `ack-store.ts:101`.                                                                     |
| ADR-007 | Baseline de versões ratificado         | ✅           | TS 6.0.3, pnpm 10.18.2, ESLint 10.4.0, lint-staged 17.0.5, commitlint 21.0.1 — todos majors recentes ratificados por este ADR.                                           |
| ADR-008 | Bundling com vite-plugin-electron      | ✅           | `apps/*/vite.config.ts` usa `vite-plugin-electron`. CommonJS preload (G-007).                                                                                            |
| ADR-009 | IPC contract-first                     | ⚠️           | Tipos em `shared/ipc-types.ts` ✅; **convenções de naming divergem entre Leader e Agent — ver F-013 (Low)**.                                                             |
| ADR-010 | Upgrade Electron 42.x (security)       | ✅           | `electron: ^42.2.0` em ambos apps + `pnpm.overrides.tar: ^7.5.11`.                                                                                                       |
| ADR-011 | Tray-resident architecture             | ✅           | `app.on('window-all-closed', () => { /* no quit */ })` em [agent/main/index.ts:360-363](apps/operator-agent/src/main/index.ts:360); single instance lock ativo.          |
| ADR-012 | Loader de config fail-fast (Agent W0)  | ⚠️           | Superseded por fail-soft no Agent (ADR-019 D3); Leader mantém fail-fast (ADR-017). Decisão documentada — CLAUDE.md §4 reconhece a evolução.                              |
| ADR-013 | fs-adapter port-and-adapter            | ⚠️           | Port `IFilesystemAdapter` + 2 adapters (Node + Memory) ✅. **Mas:** historyService bypassa adapter — F-012 (Medium). Config loaders bypassam (documentado como exceção). |
| ADR-014 | Sanitização via isomorphic-dompurify   | ✅           | `sanitize.ts` usa `ALLOWED_TAGS` constante; `ALLOWED_ATTR: []`; idempotente (test cobre).                                                                                |
| ADR-015 | Composer arquitetura Leader            | ✅           | Selectors puros + composerFormSchema Zod fonte única + sem react-hook-form (decisão explícita).                                                                          |
| ADR-016 | Domain layer fs-adapter (W1)           | ✅           | `packages/fs-adapter/src/domain/` com PendingStore + AckStore + stubs Cancel/Archive.                                                                                    |
| ADR-017 | Main process Leader (W1.C2 parte 2)    | ✅           | `rebuildDeps` callback ativo em [leader/main/index.ts](apps/leader/src/main/index.ts); `IpcDependencies` mutable injetada; property-with-arrow no LeaderAPI.             |
| ADR-018 | Redesign visual Leader                 | ✅           | TopNav substituiu Sidebar; vocabulário UI ("Rodada"/"Usuário"/"Disparar evento") — código backstage preserva nomes originais ("Sprint"/"Operator"/"Dispatch").           |
| ADR-019 | Operator Agent W1.C3 inteiro           | ✅           | rebuildDeps fail-soft + state machine overlay + pull pattern + dedup pós-restart + writeDisplayed/Acknowledged.                                                          |
| ADR-020 | @sprint/logger Pino wrapper            | ✅           | API estreita (5 níveis + child + name); pino-pretty em dev; singleton lazy rootLogger.                                                                                   |
| ADR-021 | Testes production-grade W1.C8          | ✅           | Coverage 100% em contracts + fs-adapter + logger; property-based tests; XSS vectors curados.                                                                             |

#### Verificação de versões da stack (vs `sprint_dispatcher_stack.docx`)

| Tecnologia             | Stack alvo | Instalada                                          | Status                                                                                            |
| ---------------------- | ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| TypeScript             | 5.4+       | 6.0.3                                              | ⚠️ major drift — **ADR-007 ratifica**                                                             |
| Node.js                | 20 LTS     | 24.10.0                                            | ⚠️ — **ADR-007 ratifica**                                                                         |
| Electron               | 30.x       | 42.2.0                                             | ⚠️ — **ADR-010 documenta**                                                                        |
| React                  | 18.3+      | 18.3.0                                             | ✅                                                                                                |
| Zustand                | 4.5+       | 4.5.7 (Leader)                                     | ✅                                                                                                |
| Zod                    | 3.23+      | **contracts 3.23.x; Leader 3.25.76; Agent 3.25.0** | ⚠️ **drift minor entre packages — F-015 (Low)**                                                   |
| ULID                   | 2.3+       | 2.4.x                                              | ✅                                                                                                |
| isomorphic-dompurify   | 2.10+      | 2.36.0                                             | ✅                                                                                                |
| Pino                   | 9.x        | 9.0.0+                                             | ✅                                                                                                |
| pino-roll              | 1.1+       | **NÃO INSTALADO**                                  | ❌ F-007 já cobre                                                                                 |
| Vitest                 | 1.6+       | 1.6.1                                              | ✅                                                                                                |
| @testing-library/react | 16.x       | 16.3.2                                             | ✅                                                                                                |
| @playwright/test       | 1.44+      | **NÃO INSTALADO**                                  | ⏸️ deferido W3 (BL-C8-004)                                                                        |
| pnpm                   | 9.x        | 10.18.2                                            | ⚠️ — **ADR-007 ratifica**                                                                         |
| Turborepo              | 2.x        | 2.9.14                                             | ✅                                                                                                |
| Vite                   | 5.x        | 5.4.21                                             | ✅                                                                                                |
| electron-builder       | 24+        | 24.13.3                                            | ✅                                                                                                |
| Changesets             | 2.27+      | 2.31.0                                             | ✅                                                                                                |
| ESLint                 | 9.x (flat) | 10.4.0                                             | ⚠️ — **ADR-007 ratifica**                                                                         |
| Prettier               | 3.x        | 3.8.3                                              | ✅                                                                                                |
| Husky                  | 9.x        | 9.1.7                                              | ✅                                                                                                |
| lint-staged            | 15.x       | 17.0.5                                             | ⚠️ — **ADR-007 ratifica**                                                                         |
| commitlint             | 19.x       | 21.0.1                                             | ⚠️ — **ADR-007 ratifica**                                                                         |
| date-fns               | 3.6+       | 3.6.0 (Agent only)                                 | ✅ (Agent) — não usado no Leader (não-finding; Leader não precisa ainda)                          |
| lucide-react           | 0.380+     | 0.380.0 (Agent only)                               | ✅ (Agent) — não usado no Leader                                                                  |
| react-hook-form        | 7.51+      | **NÃO INSTALADO**                                  | ✅ **decisão consciente em ADR-015** (Zustand é fonte única; RHF pode entrar em W2 com BL-C2-006) |
| @hookform/resolvers    | 3.3+       | **NÃO INSTALADO**                                  | ✅ (depende de react-hook-form)                                                                   |

#### Estrutura de diretórios — backlog §3.1 vs implementação

Backlog §3.1 prevê:

```
sprint-dispatcher/
├── apps/{leader, operator-agent}/
├── packages/{contracts, fs-adapter, logger}/
├── installer/                  ← NÃO EXISTE
├── docs/{adr, guides, README}/  ← NÃO EXISTE (ADRs em DECISIONS.md raiz)
├── tests/e2e/                  ← NÃO EXISTE (E2E deferido W3)
```

Implementação atual:

- `apps/` + `packages/` ✅
- `installer/` ausente — toda config de instalador fica em
  `apps/*/electron-builder.yml` (decisão pragmática consistente com Turborepo
  per-app)
- `docs/` ausente — ADRs estão em `DECISIONS.md` raiz (consistente com convenção
  3Studio)
- `tests/e2e/` ausente — Playwright deferido BL-C8-004 W3

Não é finding bloqueante (decisões pragmáticas), mas backlog merece atualização.
**Não cria finding novo** — débito documental capturado em "Discrepâncias
notáveis" do Gate 1.

#### Resumo Gate 4 — Conformidade Arquitetural

- **11 verificações obrigatórias:** 8 ✅, 3 ⚠️ (IPC naming F-013, IpcResult
  envelope F-014, atomic writes via adapter F-012)
- **21 ADRs:** 18 ✅ honored, 3 ⚠️ (ADR-009 com inconsistência interna; ADR-012
  superseded mas documentado; ADR-013 com exceção não documentada)
- **Versões da stack:** 12 alvos batem; 7 drifts majors ratificados por
  ADR-007/-010; 1 drift minor entre packages **(F-015 Low — Zod)**.

**4 novos findings criados:** F-012 (Medium), F-013 (Low), F-014 (Low), F-015
(Low).

### Categoria 4 — Type Safety & Code Quality

#### Verificação 1 — Uso de `any` em produção

Patterns scanned: ` any\b`, `: any[,)\]]`, ` as any`, `as unknown as`,
`Record<string, ?any>`, `any[]`, `<any>`.

**Hits encontrados (8):**

| Local                                                             | Tipo                                         | Classificação                                          |
| ----------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `apps/operator-agent/src/main/single-instance.test.ts:8,13`       | `as unknown as App` (Electron)               | ✅ Test — mock de `App` sem importar Electron completo |
| `packages/fs-adapter/src/node-adapter.adversarial.test.ts:55`     | `as unknown as FileHandle`                   | ✅ Test — mock de FileHandle para forçar erro em close |
| `packages/fs-adapter/src/domain/pending-store.test.ts:201,210`    | `as unknown as SprintPayload`                | ✅ Test — testando rejeição de payloads inválidos      |
| `packages/fs-adapter/src/domain/ack-store.test.ts:160,169`        | `as unknown as SprintAck`                    | ✅ Test — idem para acks                               |
| `apps/operator-agent/src/main/services/integration.test.ts:110`   | `as unknown as OverlayService & typeof mock` | ✅ Test — mock typed cast                              |
| `apps/operator-agent/src/main/services/overlayService.test.ts:33` | `Mock<any[], unknown>` em comentário         | ✅ Comment explicando TS issue                         |
| `apps/leader/src/preload/index.ts:16`                             | `Promise<any>` em JSDoc                      | ✅ Comment descrevendo API upstream do Electron        |

**Resultado:** **ZERO `any` em código de produção.** Todos os usos são em testes
(legítimos para testar rejeição de schema com input inválido / mockar interfaces
externas) ou em comentários (descritivos).

Regra ESLint `@typescript-eslint/no-explicit-any: 'error'` está ativa
([eslint.config.mjs:42](eslint.config.mjs:42)) — garante que regressão captura.

#### Verificação 2 — Uso de `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`

**Hits encontrados (5):**

| Local                                            | Tipo                                                                                   | Justificativa                                             | Classificação                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| `packages/fs-adapter/src/errors.test.ts:92`      | `// @ts-expect-error - FilesystemError é abstract`                                     | Testando enforcement de abstract class em runtime (G-016) | ✅ Test legítimo                 |
| `packages/contracts/src/ids.test.ts:75,77,79,81` | `// @ts-expect-error - testando defesa de runtime contra null/undefined/number/objeto` | Testando defesa de `isValidUlid` contra inputs não-string | ✅ Test legítimo (4 ocorrências) |

**Resultado:** **ZERO `@ts-ignore` ou `@ts-nocheck` em qualquer lugar.** Os 5
`@ts-expect-error` são todos em testes, todos com comentário justificativo,
todos exercitando defesa de runtime contra entradas mal-tipadas.

#### Verificação 3 — Uso de `console.*` em produção

**Hits encontrados (8 chamadas de runtime + 4 menções em JSDoc):**

| Local                                                            | Tipo                                                             | Justificativa                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/operator-agent/src/main/index.ts:77`                       | `console.error('[fatal]', err)`                                  | Fallback de `uncaughtException` handler — última linha de defesa (G-023)                  |
| `apps/operator-agent/src/main/index.ts:88`                       | `console.error('[fatal] unhandledRejection', err)`               | Idem para `unhandledRejection`                                                            |
| `apps/operator-agent/src/main/index.ts:171,204`                  | `console.warn('[ack] ${msg}', ctx)`                              | Wrapper para `AckService.log` — interface aceita logger, atualmente passa wrapper console |
| `apps/operator-agent/src/main/index.ts:216`                      | `console.warn('[polling] ${msg}', ctx)`                          | Wrapper para `PollingService.log.warn`                                                    |
| `apps/operator-agent/src/main/index.ts:219`                      | `console.error('[polling] ${msg}', ctx)`                         | Wrapper para `PollingService.log.error`                                                   |
| `apps/operator-agent/src/main/index.ts:319`                      | `console.error('[ack] handleAck falhou', ...)`                   | IPC handler error path                                                                    |
| `apps/operator-agent/src/renderer/hooks/useIncomingSprint.ts:39` | `console.warn('[useIncomingSprint] requestCurrent falhou', err)` | Renderer hook error handler                                                               |
| `packages/contracts/src/errors.ts:18`                            | `* console.error(...)`                                           | JSDoc comment example — NÃO é runtime call                                                |
| `apps/operator-agent/src/main/services/pollingService.ts:45,77`  | `* console.warn/error` em JSDoc                                  | Comments documentando convenção                                                           |

**Resultado:**

- **Leader: ZERO console.\*** (confirmado por SESSION_LOG Sessão 17 + grep).
- **Agent: 8 console.\* — todos `warn`/`error`** (regra ESLint
  `'no-console': ['error', { allow: ['warn', 'error'] }]` permite).
- Todos os 8 são candidatos a refactor em **BL-C6-002 W3** (integração
  `@sprint/logger`) — interfaces `PollingLogger`/`AckLogger`/`HandleAckLogger`
  já estão prontas para receber instância de `createLogger('xxx')` em vez do
  wrapper console.
- Documentado em CLAUDE.md §4 (subseção C6) com lista exata dos locais.

**Não cria finding novo** — débito técnico documentado em CLAUDE.md §12 "Débito:
regra ESLint `no-console` estrita" + listagem específica nos comentários.
Resolução condicionada à entrega de BL-C6-002.

#### Verificação 4 — `tsconfig.json` de cada package

`tsconfig.base.json` (raiz) define os strict flags
([tsconfig.base.json:1-18](tsconfig.base.json:1)):

| Flag                               | Valor  | Status           |
| ---------------------------------- | ------ | ---------------- |
| `strict`                           | `true` | ✅               |
| `noUncheckedIndexedAccess`         | `true` | ✅               |
| `exactOptionalPropertyTypes`       | `true` | ✅               |
| `verbatimModuleSyntax`             | `true` | ✅               |
| `isolatedModules`                  | `true` | ✅               |
| `forceConsistentCasingInFileNames` | `true` | ✅               |
| `skipLibCheck`                     | `true` | ✅ (intencional) |

Cada package/app herda via `"extends": "../../tsconfig.base.json"` — verificado
em todos os 5 tsconfigs:

| Workspace               | `extends` | `rootDir` | Outras particularidades                                                                   |
| ----------------------- | --------- | --------- | ----------------------------------------------------------------------------------------- |
| `@sprint/contracts`     | ✅        | `./src`   | `types: ["vitest/globals"]` (sem `node` — pacote puro)                                    |
| `@sprint/fs-adapter`    | ✅        | `./src`   | `types: ["vitest/globals", "node"]`                                                       |
| `@sprint/logger`        | ✅        | `./src`   | `types: ["vitest/globals", "node"]`                                                       |
| `sprint-leader`         | ✅        | `../..`   | `types: [vite/client, vitest/globals, @types/react, @types/react-dom]`; paths `@sprint/*` |
| `sprint-operator-agent` | ✅        | `../..`   | idem Leader + `node`; paths `@sprint/contracts`                                           |

**Achado:** `sprint-leader/tsconfig.json:4` tem `"rootDir": "../.."` — fix
correto per G-014 (necessário para consumir `@sprint/contracts` source-first sem
TS6059). **MAS** CLAUDE.md §12 ainda lista este como **"Débito técnico
pendente"**:

> **Débito: `rootDir` do Leader em `apps/leader/tsconfig.json`** **Status:**
> pendente — disparador é o início do BL-C2-007... **Plano:** fix de 1 linha em
> `apps/leader/tsconfig.json` — `"rootDir": "./src"` → `"rootDir": "../.."`.

A fix foi aplicada (provavelmente em BL-C2-007 / Sessão 15) mas a entrada do
débito não foi removida nem marcada como "resolvida".

→ **F-016 (Low)** — documentação stale.

Nenhum package ou app desativa flags estritas — **type safety baseline está
consistente** em todo o monorepo.

#### Verificação 5 — Regras ESLint não-desabilitadas

Configuração principal em [eslint.config.mjs:40-69](eslint.config.mjs:40)
inclui:

| Regra                                        | Status   | Notas                                                                             |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `no-console`                                 | ✅ ativa | `['error', { allow: ['warn', 'error'] }]` — débito conhecido para endurecer em W3 |
| `@typescript-eslint/no-explicit-any`         | ✅ ativa | `'error'`                                                                         |
| `@typescript-eslint/no-unused-vars`          | ✅ ativa | `'error'` com `argsIgnorePattern: '^_'` e `varsIgnorePattern: '^_'`               |
| `@typescript-eslint/consistent-type-imports` | ✅ ativa | `'error'`                                                                         |
| `@typescript-eslint/no-floating-promises`    | ✅ ativa | `'error'`                                                                         |
| `@typescript-eslint/no-misused-promises`     | ✅ ativa | `'error'`                                                                         |
| `@typescript-eslint/await-thenable`          | ✅ ativa | `'error'`                                                                         |
| `import-x/order`                             | ✅ ativa | Com pathGroups `@sprint/**` antes do internal                                     |
| `import-x/no-cycle`                          | ✅ ativa | `'error'`                                                                         |
| `import-x/no-self-import`                    | ✅ ativa | `'error'`                                                                         |
| `promise/no-return-wrap`                     | ✅ ativa | `'error'`                                                                         |
| `promise/param-names`                        | ✅ ativa | `'error'`                                                                         |
| `promise/prefer-await-to-then`               | ✅ ativa | `'error'`                                                                         |

Regras customizadas (BL-C8-005):

| Regra                                                                  | Status   | Notas                                              |
| ---------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| Leader não importa de Agent                                            | ✅ ativa | [eslint.config.mjs:79-102](eslint.config.mjs:79)   |
| Agent não importa de Leader                                            | ✅ ativa | [eslint.config.mjs:104-128](eslint.config.mjs:104) |
| Packages não se referenciam via path relativo (forçar `@sprint/<pkg>`) | ✅ ativa | [eslint.config.mjs:131-150](eslint.config.mjs:131) |

Nenhuma regra crítica desativada.

#### Resumo Gate 5 — Type Safety & Code Quality

- **`any` em produção:** **0** (todos 8 hits em testes/comentários — legítimos)
- **`@ts-ignore`/`@ts-nocheck` em qualquer lugar:** **0**
- **`@ts-expect-error`:** 5 (todos em testes, com justificativa inline)
- **`console.*` em produção:** 8 (todos warn/error documentados; débito
  BL-C6-002 W3)
- **`console.log`/`info`/`debug`:** **0**
- **TSConfigs:** todos 5 herdam de base com strict completo
- **ESLint:** 16 regras ativas (13 standard + 3 custom BL-C8-005)

**1 novo finding criado:** F-016 (Low) — CLAUDE.md §12 lista débito
`rootDir do Leader` como pendente mas a fix já foi aplicada.

Type safety do monorepo está em **excelente estado** — disciplina alta, zero
atalhos não-justificados.

### Categoria 5 — Testes & Cobertura

#### Cobertura agregada por package (re-rodada Gate 6)

| Package                 | Test files |                     Testes | Lines % | Branches % | Funcs % | Stmts % | Threshold configurado | Status vs threshold                                   |
| ----------------------- | ---------: | -------------------------: | ------: | ---------: | ------: | ------: | --------------------- | ----------------------------------------------------- |
| `@sprint/contracts`     |         14 |                        317 | **100** |    **100** | **100** | **100** | 98/95/98/98           | ✅ folga 2-5 pts                                      |
| `@sprint/fs-adapter`    |         15 | 294 (291 + 3 skip Windows) | **100** |  **99.53** | **100** | **100** | 95/95/95/95           | ✅ folga 4.5-5 pts                                    |
| `@sprint/logger`        |          3 |                         57 | **100** |    **100** | **100** | **100** | 95/90/95/95           | ✅ folga 5-10 pts                                     |
| `sprint-operator-agent` |         17 |                        190 |   97.76 |      91.47 |    95.4 |   97.76 | **70/65/70/70**       | ⚠️ passa com folga ENORME — threshold subdimensionado |
| `sprint-leader`         |         13 |                        198 |   96.89 |      94.51 |   93.84 |   96.89 | **NENHUM**            | ❌ sem threshold materializado                        |

**Total monorepo: 1056 testes verde (1053 + 3 skipped Windows).** Match com
SESSION_LOG Sessão 18.

#### Status vs threshold do prompt (§5 Gate 6)

| Component             | Threshold do prompt                                | Threshold configurado                | Real coverage                    | Veredito                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------- | ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sprint/contracts`   | ≥ 98 lines/funcs/stmts, ≥ 95 branches              | 98/95/98/98                          | 100/100/100/100                  | ✅                                                                                                                                                                                                                                                                   |
| `@sprint/fs-adapter`  | ≥ 95 global + **100% catch blocks/FsAdapterError** | 95/95/95/95                          | 100/99.53/100/100                | ⚠️ 99.53% branch — 1 catch defensivo (`unlink(tmpPath)` cleanup em [node-adapter.ts:53,73-77](packages/fs-adapter/src/node-adapter.ts:53)) não exercitado deterministicamente. Considerado aceitável em SESSION_LOG Sessão 18 — "100% catch" do prompt não cumprido. |
| `@sprint/logger`      | ≥ 95                                               | 95/90/95/95                          | 100/100/100/100                  | ✅                                                                                                                                                                                                                                                                   |
| `apps/leader`         | stores ≥ 90, services ≥ 90, componentes ≥ 60       | **NENHUM**                           | 96.89/94.51/93.84/96.89 agregado | ❌ **F-017** — thresholds não materializados; regressão silenciosa possível                                                                                                                                                                                          |
| `apps/operator-agent` | services ≥ 90, renderer ≥ 70, tray ≥ 60            | 70/65/70/70 (global, não per-folder) | 97.76/91.47/95.4/97.76           | ⚠️ **F-018** — passa global threshold, mas threshold permite drop de ~27 pts antes de falhar; per-folder não enforcado                                                                                                                                               |

#### Cobertura granular crítica do operator-agent (per Gate 1 test.log)

| Arquivo                           | Lines % | Branches % | Notas                                                                              |
| --------------------------------- | ------: | ---------: | ---------------------------------------------------------------------------------- |
| `main/handlers/handleAck.ts`      |   91.66 |      84.61 | Borderline; 88-92 e 98-102 (catches do try/catch isolado em archive/deletePending) |
| `main/services/ackService.ts`     |     100 |      73.33 | Lines 100% mas branches 73% — defaults e catches de erro defensivos                |
| `main/services/historyService.ts` |   96.75 |      89.65 | Próximo do limite — lines 138-139, 146-147 (race conditions em scan)               |
| `main/services/overlayService.ts` |   98.54 |      86.04 | Lines 262-263, 267-268 — dev/prod branching de URL                                 |
| `main/services/pollingService.ts` |     100 |      86.11 | Lines 150-152, 202, 216 — defaults + edge cases                                    |
| `main/services/queueService.ts`   |   98.68 |        100 | Lines 149-150                                                                      |
| `renderer/App.tsx`                |   **0** |      **0** | **NÃO TEM TEST FILE** — F-019                                                      |

**Achado adicional:**
[apps/operator-agent/src/renderer/App.tsx](apps/operator-agent/src/renderer/App.tsx)
tem **0% cobertura** — não há `App.test.tsx` no operator-agent. O Leader tem
`App.test.tsx`
([apps/leader/src/renderer/App.test.tsx](apps/leader/src/renderer/App.test.tsx)).
Assimetria entre os 2 apps. → **F-019 (Low)**.

#### Análise qualitativa de testes (§5 Gate 6 ponto 5)

| Aspecto                                                       | Presente? | Evidência                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Property-based em `@sprint/contracts` (sanitizer + filenames) | ✅        | `fast-check@^3.20.0` ativo; arquivos: [sanitize.test.ts](packages/contracts/src/sanitize.test.ts), [filenames.property.test.ts](packages/contracts/src/filenames.property.test.ts), [ids.property.test.ts](packages/contracts/src/ids.property.test.ts), [schemas/property.test.ts](packages/contracts/src/schemas/property.test.ts) |
| Property-based em `@sprint/fs-adapter` (roundtrip)            | ✅        | [integration/roundtrip.test.ts](packages/fs-adapter/src/integration/roundtrip.test.ts) com 3 properties × 50 runs cross-package                                                                                                                                                                                                      |
| Curadoria de XSS vectors                                      | ✅        | [**helpers**/xssVectors.ts](packages/contracts/src/__helpers__/xssVectors.ts) — 21 vetores em 5 categorias (mutation, encoding, polyglot, unicode, combining), com `reason` documentando o ataque defendido                                                                                                                          |
| Paridade real↔mock no fs-adapter                              | ✅        | [`__tests__/contract.test.ts`](packages/fs-adapter/src/__tests__/contract.test.ts) (`describeContract` — 26 testes × 2 adapters = 52), [integration/parity.test.ts](packages/fs-adapter/src/integration/parity.test.ts) (`describeParity` — 9 testes × 2 adapters = 18)                                                              |
| Testes adversariais no `writeFileAtomic`                      | ✅        | [node-adapter.adversarial.test.ts](packages/fs-adapter/src/node-adapter.adversarial.test.ts) — 10 testes (3 skip Windows): 10 escritas concorrentes, 10MB + ZWJ family, `vi.mock` de `open` para cobrir catches                                                                                                                      |
| `MemoryFilesystemAdapter` failure/latency injection           | ❌        | F-001 já cobre — workaround via `vi.spyOn`                                                                                                                                                                                                                                                                                           |
| Race conditions (10+ writePending concorrentes)               | ✅        | [pending-store.adversarial.test.ts](packages/fs-adapter/src/domain/pending-store.adversarial.test.ts) — 12 testes incluindo 10 writePending concorrentes, mtime ordering, race de pasta removida                                                                                                                                     |
| `useFakeTimers` no polling do Agent — sem flakiness           | ✅        | SESSION_LOG Sessão 16 abandonou fake timers no integration test em favor de `now` injetado + `flushMicrotasks` — design deliberado anti-flake                                                                                                                                                                                        |

#### 100% cobertura em paths críticos (§5 Gate 6 ponto 6)

| Path crítico                                         | Status | Notas                                                                                                                                                                                      |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sanitizeBodyHtml` — 100% incluindo branches         | ✅     | sanitize.ts 100/100/100/100. Testado com 21 XSS adversariais + 4 properties universais + idempotência.                                                                                     |
| Catches do `NodeFilesystemAdapter` cada um disparado | ⚠️     | 99.53% branch — line 53 (cleanup catch dentro de catch externo) não disparada deterministicamente. Aceito em SESSION_LOG Sessão 18 (G-... — Windows EPERM impede teste de alta contenção). |
| `ContractValidationError` cobertura                  | ✅     | errors.test.ts cobre via assertions específicas de mensagens Zod                                                                                                                           |

#### Resumo Gate 6 — Testes & Cobertura

- **Cobertura real do monorepo excepcional:** todos os packages internos em
  100%; apps em 96-98%
- **1056 testes verde** (1053 + 3 skipped Windows)
- **Testes adversariais robustos:** property-based (fast-check), XSS curados,
  paridade cross-adapter, race conditions
- **Tests qualidade:** designed-for-determinism (sem fake timers em integração;
  sem mocks ad-hoc; `it.runIf` para platform-specific)

**Mas:**

- **F-017 (High):** `sprint-leader` sem thresholds configurados — regressão
  silenciosa possível
- **F-018 (Medium):** `sprint-operator-agent` thresholds 70/65/70/70 muito
  abaixo do prompt (services ≥ 90, renderer ≥ 70, tray ≥ 60) e do real
  (97/91/95/97)
- **F-019 (Low):** `App.tsx` do operator-agent sem test file (Leader tem
  `App.test.tsx`)
- **Anotação:** o "100% em catch blocks" do prompt para fs-adapter não foi
  atingido literalmente (99.53% branch). Decisão consciente documentada em
  SESSION_LOG Sessão 18.

**3 novos findings criados:** F-017 (High), F-018 (Medium), F-019 (Low).

### Categoria 6 — Segurança

Checklist de 10 itens do prompt §5 Gate 7.

#### Item 1 — Electron hardening

| Flag                                 | Leader main window                                             | Agent overlay                                                                           |
| ------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `nodeIntegration: false`             | ✅ [leader/main/index.ts:73](apps/leader/src/main/index.ts:73) | ✅ [overlayService.ts:250](apps/operator-agent/src/main/services/overlayService.ts:250) |
| `contextIsolation: true`             | ✅ :72                                                         | ✅ :249                                                                                 |
| `sandbox: true`                      | ✅ :74                                                         | ✅ :251                                                                                 |
| `webSecurity: true`                  | ✅ :75                                                         | ✅ :252                                                                                 |
| `allowRunningInsecureContent: false` | ✅ :76                                                         | ✅ :253                                                                                 |
| `experimentalFeatures: false`        | ✅ :77                                                         | ✅ :254                                                                                 |

`webSecurity` **não** é desabilitado em nenhum lugar (grep confirma). ✅
Baseline §8.1 100% atendido.

#### Item 2 — Preload surface minimization

| App    | API exposta                                                                                                               | Surface  | Análise                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| Leader | `LeaderAPI` — 4 métodos: `ping`, `getConfig`, `listOperators`, `dispatchSprint`                                           | Tight ✅ | Arrow functions (não method-shorthand) — alinhado com ADR-017 |
| Agent  | `Api` — nested: `config.get`, `sprint.{requestCurrent, acknowledge, onIncoming}`, `queue.onUpdated`, `overlay.onMinimize` | Tight ✅ | Push channels com `subscribePush` wrapper                     |

**Anti-padrões verificados:**

- ❌ `contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)` — grep
  retorna 0 hits — **não existe vazamento total** ✅
- ❌ Casts `as` em IPC boundary são necessários (`ipcRenderer.invoke` retorna
  `Promise<any>` da tipagem do Electron) — não evitáveis
- ✅ Tipos da API são estreitos — sem `any` em `LeaderAPI` nem `Api`

#### Item 3 — Sanitização `body_html` (cadeia completa, 3 camadas)

| Camada                                                 | Lugar                                                                                                                                                | Status                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1. Leader main (antes de gravar)                       | [dispatchService.ts:137](apps/leader/src/main/services/dispatchService.ts:137) `sanitizeBodyHtml(substituteMeta(...))`                               | ✅                       |
| 2. fs-adapter (defesa em prof.)                        | [pending-store.ts:109](packages/fs-adapter/src/domain/pending-store.ts:109) `body_html: sanitizeBodyHtml(validated.body_html)`                       | ✅ Idempotente (ADR-014) |
| 3. Agent renderer (antes de `dangerouslySetInnerHTML`) | [SprintCard.tsx:24](apps/operator-agent/src/renderer/components/SprintCard/SprintCard.tsx:24) `const safeHtml = sanitizeBodyHtml(sprint.body_html);` | ✅                       |

**Tentativa de quebrar a cadeia:** procurei por qualquer caminho onde
`body_html` pudesse chegar ao DOM sem sanitização. Resultado: **único
`dangerouslySetInnerHTML` no codebase**
([SprintCard.tsx:31](apps/operator-agent/src/renderer/components/SprintCard/SprintCard.tsx:31))
é precedido pela sanitização na linha 24. **Não há caminho de bypass.** ✅

#### Item 4 — IpcResult envelope (todo cross-process serializável)

| Handler                        | Envelope?                                 | Notas                                      |
| ------------------------------ | ----------------------------------------- | ------------------------------------------ |
| Leader `ping`                  | ❌ bare string                            | F-014 — smoke W0                           |
| Leader `getConfig`             | ✅ `GetConfigResult` dedicado             | discriminated union para ConfigErrorScreen |
| Leader `listOperators`         | ✅ `IpcResult<OperatorsListResponse>`     |                                            |
| Leader `dispatchSprint`        | ✅ `IpcResult<DispatchSprintResponse>`    |                                            |
| Agent `config:get`             | ✅ `ConfigStatusResponse` dedicado        | discriminated union                        |
| Agent `sprint:request-current` | ❌ bare `IncomingSprintEvent \| null`     | F-014                                      |
| Agent `sprint:acknowledge`     | ✅ `IpcResult<AcknowledgeSprintResponse>` |                                            |

**Error serialization:** todos os handlers que envelopam capturam exceções e
retornam `{ ok: false, error: { code, message } }` — **nenhum `Error` cru cruza
o IPC**. ✅

Push events do main → renderer (`sprint:incoming`, `queue:updated`,
`overlay:minimize`) carregam payloads tipados (JSON-serializáveis) — sem `Error`
ou referências de objeto. ✅

#### Item 5 — Validação Zod nas fronteiras

| Fronteira                                    | Validação                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leader: leitura de `operators.json`          | ✅ `operatorsFileSchema.safeParse` em [operatorsService.ts:104](apps/leader/src/main/services/operatorsService.ts:104)                                                                        |
| Leader: leitura de `leader-config.json`      | ✅ Schema Zod local em [leader/main/config.ts:41-45](apps/leader/src/main/config.ts:41)                                                                                                       |
| Agent: leitura de `agent-config.json`        | ✅ `safeParseAgentConfig` em [agent/main/config.ts:239](apps/operator-agent/src/main/config.ts:239)                                                                                           |
| Agent: leitura de pending/\*.json            | ✅ `safeParseSprintPayload` / `safeParseSprintCancel` em [pending-store.ts:178,187](packages/fs-adapter/src/domain/pending-store.ts:178)                                                      |
| Agent: leitura de acks/\*.json               | ✅ `safeParseSprintAck` em [ack-store.ts:147](packages/fs-adapter/src/domain/ack-store.ts:147)                                                                                                |
| Leader: write pending (re-validação)         | ✅ `parseSprintPayload` em [pending-store.ts:106](packages/fs-adapter/src/domain/pending-store.ts:106)                                                                                        |
| Agent: write ack (re-validação)              | ✅ `parseSprintAck` em [ack-store.ts:100](packages/fs-adapter/src/domain/ack-store.ts:100)                                                                                                    |
| Leader: dispatch IPC payload (renderer→main) | ⚠️ Não-validado no envelope, mas downstream `parseSprintPayload` (linha 138) captura cada campo individualmente — Zod chega antes do FS write. Não-bloqueante.                                |
| Agent: ack IPC payload (renderer→main)       | ⚠️ Não-validado no envelope, mas `handleAck.ts:68-73` valida match contra `queueService.peek()`; `parseSprintAck` valida o ack construído — Zod sempre chega antes de gravar. Não-bloqueante. |

**Defense in depth na cadeia: Zod aplicado MÚLTIPLAS vezes** — schema strict
(`.strict()`) rejeita campos extras, e re-validação em writes (re-parse) protege
contra cast bypass.

#### Item 6 — Segredos hardcoded

Grep `password|secret|token|apikey|api_key` (case-insensitive) em `apps/` +
`packages/`:

| Match                                    | Contexto                                      | Classificação   |
| ---------------------------------------- | --------------------------------------------- | --------------- |
| `apps/leader/src/shared/ipc-types.ts:60` | JSDoc "ex.: tokens" descrevendo design futuro | ✅ comment only |
| `apps/leader/src/main/index.ts:112`      | Comment "preserva os tokens. O"               | ✅ comment only |

**Zero segredos hardcoded em código de produção.** ✅

#### Item 7 — Logging seguro

Análise dos 8 `console.*` em produção (cf. Gate 5):

| Local                                       | Payload logado                 | Risco PII / sensitive                                                                      |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `[fatal]` uncaughtException                 | `err` Error                    | err.message + stack — sem PII                                                              |
| `[fatal]` unhandledRejection                | reason                         | sem PII                                                                                    |
| `[ack] ${msg}`                              | ctx `{filename, err}`          | filename contém sprint_id+user_id ULID — **user_id é identificador interno, não PII real** |
| `[polling] ${msg}`                          | ctx `{filename, err}`          | idem                                                                                       |
| `[ack] handleAck falhou`                    | `{ sprint_id, code, message }` | sprint_id ULID — não PII                                                                   |
| `[useIncomingSprint] requestCurrent falhou` | err                            | sem PII                                                                                    |

**`body_html` nunca é logado** (verificado via grep — `body_html` aparece apenas
em código de sanitização/passagem). ✅

Risco residual baixíssimo — payloads logados são identificadores opacos +
mensagens de erro.

#### Item 8 — File system safety

| Aspecto                                                 | Análise                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path.join` / `path.posix.join` usados consistentemente | ✅ 22 arquivos usam; nenhum usa concatenação string com `/` ou `\`                                                                                                 |
| `path.resolve` com input do usuário                     | ✅ grep retorna 0 hits em código de produção; apenas em test fixtures                                                                                              |
| `userId` no filename sanitizado                         | ✅ [filenames.ts:30,134-141](packages/contracts/src/filenames.ts:30) — `USER_ID_REGEX = /^[a-z0-9_-]+$/`, length 1-50. Rejeita `../`, `\\`, `:`, espaços, unicode. |
| Path traversal em `deletePending`                       | ✅ [pending-store.ts:218-228](packages/fs-adapter/src/domain/pending-store.ts:218) chama `safeParseFilename` antes do `unlink` — só ULID-based filenames passam    |
| Parse no read                                           | ✅ `safeParseFilename` na enumeração de pending/ + acks/; filenames inválidos viram `kind: 'invalid'` ou são pulados (RN-09)                                       |

**Path traversal protection: excelente.** Defesa em profundidade no nível mais
crítico. ✅

#### Item 9 — Resilience (catches silenciosas)

Auditoria dos catches:

| Lugar                                         | Tipo de catch                                     | Status                                                                                           |
| --------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node-adapter.ts:46-51, 53-56, 60-64, 73-77`  | `try { ... } catch {}` em cleanup de `.tmp` órfão | ✅ Documentado inline (`// Ignora — .tmp pode não existir`) — silent intencional em cleanup path |
| `pollingService.ts:122-143`                   | catch global no `pollOnce`                        | ✅ Loga via `log.error`; benign `DirectoryNotFoundError` ignorado explicitamente                 |
| `dispatchService.ts:136-167`                  | try/catch isolado por operador                    | ✅ erro vai em `per_operator[i].error_message`                                                   |
| `ackService.ts:98-104`                        | catch em `writeDisplayed`                         | ✅ loga warn + retorna `null`                                                                    |
| `ackService.ts:157-163`                       | catch em `resolveDisplayedAt`                     | ✅ loga warn + fallback `now`                                                                    |
| `handleAck.ts:87-91, 97-101`                  | catches não-fatais em archive/deletePending       | ✅ loga warn explícito                                                                           |
| `historyService.ts:124-130, 136-138, 144-147` | catches em `initializeFromDisk` race              | ✅ skip silencioso documentado (race entre readdir e stat)                                       |
| `useIncomingSprint.ts:38-39`                  | catch em renderer                                 | ✅ console.warn explícito                                                                        |

**Zero catches silenciosos sem justificativa.** Todos os silent catches têm
comentário inline explicando o motivo (cleanup paths em I/O, race conditions).
✅

#### Item 10 — `pnpm audit`

Output completo do `pnpm audit --audit-level=low`:

| Severidade | Pacote             | Vuln                                          | Cadeia                                                                                  | Patched    |
| ---------- | ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- |
| **HIGH**   | `tmp <0.2.6`       | Path Traversal via unsanitized prefix/postfix | `apps__leader>electron-builder>app-builder-lib>@malept/flatpak-bundler>tmp-promise>tmp` | `>=0.2.6`  |
| Moderate   | `esbuild <=0.24.2` | Dev-server arbitrary requests                 | `apps__leader>vite>esbuild`                                                             | `>=0.25.0` |
| Moderate   | `vite <=6.4.1`     | Path Traversal in `.map` handling             | `apps__leader>vite`, `packages__contracts>vitest>vite`                                  | `>=6.4.2`  |

**4 vulnerabilidades totais: 1 HIGH + 3 moderate.** Todas são em deps
transitivas de **build-time only** (electron-builder, vite, vitest) — **NÃO**
entram nos bundles de produção Leader/Agent.

**MAS o HIGH `tmp` não está no `pnpm.overrides`** de
[package.json:40-42](package.json:40) (que tem apenas `tar: ^7.5.11`).

→ **F-020 (High)** — `pnpm audit` reporta 1 HIGH em dep transitiva sem override.

#### Resumo Gate 7 — Segurança

- **Electron hardening:** ✅ 12/12 flags (6 × 2 windows) corretas
- **Preload surface:** ✅ minimal, sem vazamento de ipcRenderer
- **Sanitização body_html:** ✅ 3 camadas; sem caminhos de bypass
- **IpcResult envelope:** ⚠️ F-014 já cobre (2 exceções menores)
- **Validação Zod:** ✅ 7 fronteiras validadas + re-validação em writes
- **Segredos hardcoded:** ✅ zero
- **Logging seguro:** ✅ body_html nunca logado
- **File system safety:** ✅ `path.join` consistente; userId regex rejeita
  traversal; safeParseFilename antes de unlink
- **Resilience:** ✅ zero silent catches sem justificativa
- **pnpm audit:** ❌ 1 HIGH (tmp) + 3 moderate — **F-020**

**1 novo finding criado:** F-020 (High).

Segurança do MVP está **muito bem desenhada** — defesa em profundidade explícita
em cada vetor crítico (XSS via 3 camadas de sanitização, path traversal via
regex + safeParseFilename, IPC isolation via sandbox+contextIsolation, secrets
via zero hardcoding). O único item negativo (F-020) é gerenciamento de deps
transitivas — corrigível via `pnpm.overrides`.

### Categoria 7 — Consistência Cross-Package

#### Naming de arquivos

| Workspace                          | Pattern usado                                                                                                                              | Aderência a CLAUDE.md §7.1 ("kebab-case.ts")                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `@sprint/contracts`                | `sanitize.ts`, `filenames.ts`, `ids.ts`, `constants.ts`, `errors.ts`                                                                       | ⚠️ palavra única — ambíguo (não viola, mas não exercita kebab-case) |
| `@sprint/fs-adapter`               | `pending-store.ts`, `ack-store.ts`, `node-adapter.ts`, `read-and-parse.ts`                                                                 | ✅ kebab-case                                                       |
| `@sprint/logger`                   | `createLogger.ts`, `rootLogger.ts`                                                                                                         | ❌ camelCase                                                        |
| `sprint-leader` (services)         | `dispatchService.ts`, `operatorsService.ts`                                                                                                | ❌ camelCase                                                        |
| `sprint-operator-agent` (services) | `pollingService.ts`, `ackService.ts`, `overlayService.ts`, `queueService.ts`, `trayService.ts`, `historyService.ts`, `trayStateService.ts` | ❌ camelCase                                                        |
| Components React                   | `OperatorList.tsx`, `SprintCard.tsx`, `DispatchModal.tsx`, etc.                                                                            | ✅ PascalCase                                                       |
| Helpers                            | `tmpFixtures.ts`, `arbitraries.ts`, `xssVectors.ts`                                                                                        | ❌ camelCase                                                        |

**Padrão real:** kebab-case só no `@sprint/fs-adapter`; o resto do projeto usa
**camelCase** para .ts files. CLAUDE.md §7.1 prescreve kebab-case universalmente
— **drift entre doc e implementação**.

Componentes React (.tsx) seguem PascalCase consistentemente. ✅

→ **F-022 (Low)** — Naming convention drift.

#### Estrutura de pasta

| Pacote                  | `src/` | `__tests__/` ou `*.test.ts` adjacente                     | `__helpers__/`                   | `__fixtures__/` |
| ----------------------- | ------ | --------------------------------------------------------- | -------------------------------- | --------------- |
| `@sprint/contracts`     | ✅     | adjacente (mais `__fixtures__/`)                          | ✅                               | ✅              |
| `@sprint/fs-adapter`    | ✅     | tem `__tests__/` (contract suite) + `*.test.ts` adjacente | ✅                               | —               |
| `@sprint/logger`        | ✅     | adjacente                                                 | — (não precisa)                  | —               |
| `sprint-leader`         | ✅     | adjacente (renderer) + adjacente (main)                   | `__test-fixtures__/` no renderer | —               |
| `sprint-operator-agent` | ✅     | adjacente (mesma divisão)                                 | `__test-fixtures__/` no renderer | —               |

✅ Padrão de pasta razoavelmente uniforme — `src/` raiz; `*.test.ts` colocados
próximo do código; helpers/fixtures em `__helpers__/` ou `__test-fixtures__/`
(drift menor de naming entre as 2 convenções `__helpers__/` vs
`__test-fixtures__/` — sem impacto).

#### Padrão de erros

| Pacote                                            | Pattern                                                                                                                                                              | Aderência ao padrão fs-adapter |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `@sprint/fs-adapter`                              | ✅ Hierárquico: `FilesystemError abstract` (com `new.target` runtime check) + `FileNotFoundError`/`DirectoryNotFoundError`/`FilesystemIOError`/`NotImplementedError` | **Padrão referência**          |
| `@sprint/contracts`                               | `ContractValidationError extends Error` + `FilenameParseError extends Error` — **sem base comum**                                                                    | ❌ standalone                  |
| `sprint-leader/main/config.ts`                    | `ConfigError abstract` + 5 concretas (`ConfigNotFoundError`, `ConfigJsonInvalidError`, `ConfigSchemaError`, `ConfigReadError`, `ConfigSharedPathInaccessibleError`)  | ✅ hierárquico                 |
| `sprint-leader/main/services/operatorsService.ts` | `OperatorsFileNotFoundError extends Error` + `OperatorsFileInvalidError extends Error` — **sem base comum**                                                          | ❌ standalone                  |
| `sprint-operator-agent/main/config.ts`            | `ConfigError abstract` + 3 concretas (`ConfigNotFoundError`, `ConfigInvalidError`, `ConfigInaccessibleError`)                                                        | ✅ hierárquico                 |

**Inconsistência:** padrão "abstract base + concretas" aplicado em fs-adapter,
leader-config, agent-config. **Não aplicado** em `contracts` (2 classes flat) e
em `operatorsService` (2 classes flat).

→ **F-023 (Low)** — Hierarquias de erro inconsistentes.

#### Barrel exports

| Pacote               | Barrel                                                       | Surface                                                                                                                     |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `@sprint/contracts`  | [src/index.ts](packages/contracts/src/index.ts) — 88 linhas  | ✅ Explícito, 27+ exports organizados por bloco com comentários (Constantes, IDs, Errors, Schemas, Filenames, Sanitization) |
| `@sprint/fs-adapter` | [src/index.ts](packages/fs-adapter/src/index.ts) — 38 linhas | ✅ Explícito, 12+ exports organizados por bloco (Interface, Errors, Adapters, Domain × 4)                                   |
| `@sprint/logger`     | [src/index.ts](packages/logger/src/index.ts) — 28 linhas     | ✅ Explícito, 6 exports (`createLogger`, `rootLogger`, 4 tipos)                                                             |

Apps (Leader, Agent) não têm barrel raiz (acessam por subpath) — adequado para
apps Electron.

#### Padrão de testes

- ✅ `*.test.ts` colocados **adjacentes** ao código testado em todos os 5
  workspaces
- ✅ `*.adversarial.test.ts` separados em fs-adapter (deliberado para facilitar
  leitura — testes lentos vs enumeráveis)
- ✅ `*.property.test.ts` separados em contracts (property-based testing via
  fast-check)
- ✅ `integration/` folder em fs-adapter para paridade + roundtrip cross-package

#### Imports cross-package

- ✅ Verificado em Gate 4 — **todos** os imports cross-package usam alias
  `@sprint/<pkg>`; relative paths cross-package são proibidos pela regra ESLint
  customizada (BL-C8-005) e o grep confirma zero violações.

### Categoria 8 — Documentação

#### CLAUDE.md (~1900 linhas)

| Seção                       | Cobertura | Status                                                                                                                    |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| §0 Protocolo de início      | ✅        | Sequência canônica                                                                                                        |
| §1-2 Missão + arquitetura   | ✅        | Principles P-01..P-05                                                                                                     |
| §3 Stack tecnológica        | ✅        | Tabela atualizada com versões reais                                                                                       |
| §4 Estrutura do Monorepo    | ✅        | Tem subseções por componente (Leader parte 1, Leader parte 2 main, fs-adapter domain, Operator Agent W1.C3, logger W1.C6) |
| §5 Componentes (C0-C8)      | ✅        | Tabela ID/Nome/Tipo                                                                                                       |
| §6 Waves de desenvolvimento | ⚠️        | W0 ✅, W1 ✅ concluída, mas tabela ainda diz "**W2 ⏸️ próxima**" — correto                                                |
| §7 Convenções de código     | ⚠️        | §7.1 naming (kebab-case prescrito, mas implementação usa camelCase) — **F-022**                                           |
| §8 Configurações críticas   | ✅        | §8.1 Electron security; §8.2 TOPMOST overlay                                                                              |
| §9 Regras absolutas         | ✅        | 9.1-9.7                                                                                                                   |
| §10 Protocolo de sessão     | ✅        |                                                                                                                           |
| §11 Specs externos          | ✅        | Renan mantém                                                                                                              |
| §12 Gotchas (G-001 a G-024) | ⚠️        | Cobertura excelente, mas "Débitos técnicos pendentes" tem entrada já paga — **F-016**                                     |
| §13 Como atualizar          | ✅        |                                                                                                                           |
| §14 Comunicação com Renan   | ✅        |                                                                                                                           |

**Pegadinhas G-001..G-024** — auditadas amostralmente:

- G-001 (turbo `tasks` não `pipeline`) ✅ verificado em [turbo.json](turbo.json)
- G-007 (preload CJS) ✅ ainda válido — apps Electron sem `"type": "module"`
- G-013 (window-all-closed) ✅ verificado em main/index.ts:360
- G-014 (rootDir source-first) ✅ aplicado em tsconfigs
- G-017 (randomBytes suffix) ✅ aplicado em node-adapter.ts:33
- G-018 (mkdir parent) ✅ documentado e aplicado em domain layer
- G-019 (Memory diretórios implícitos) ✅ documentado em memory-adapter.ts
- G-020 (jsdom/canvas externalize) ✅ aplicado em vite.config.ts dos 2 apps
- G-021 (BOM no PowerShell) ✅ SETUP.md menciona
- G-022 (productName não afeta runtime) ✅ comportamento conhecido
- G-023 (build/ excluído do asar + uncaughtException) ✅ corrigido em
  electron-builder.yml + main/index.ts
- G-024 (Windows EPERM renames concorrentes) ✅ documentado, testes com
  `it.runIf` Linux/macOS

#### DECISIONS.md (~2200 linhas, 21 ADRs)

| Aspecto                                        | Status                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| ADRs datados (Data: YYYY-MM-DD)                | ✅ Todos                                                        |
| Status (Accepted/Deprecated/Superseded)        | ✅ Todos com Accepted; ADR-012 supersded by ADR-019 documentado |
| Decisores                                      | ✅ Renan (3Studio)                                              |
| Contexto, Decisão, Alternativas, Consequências | ✅ Em todos os ADRs auditados                                   |
| Referências (Backlog/Requisitos/CLAUDE)        | ✅                                                              |
| Numeração sequencial e única                   | ✅ 001-021 sem gaps                                             |

**Decisões visíveis em código sem ADR correspondente** (cf. Gate 2-4):

- IPC channel naming convention (Leader camelCase vs Agent scope:action) —
  **F-013** captura
- HistoryService bypassa IFilesystemAdapter — **F-012** captura
- `minimize_after_seconds` extra-schema usado em vez de `show_duration_seconds`
  — ADR-019 D2 menciona em SESSION_LOG mas não em ADR formal — **F-003** captura
- `persistent_popup` ignorado — sem ADR — **F-011** captura

#### SESSION_LOG.md (~3000 linhas, 18 sessões)

| Aspecto                             | Status                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Cada sessão tem entrada estruturada | ✅ Sessões 01-18 com seções Objetivo/Feito/Estado/Decisões/Bloqueios/Próximo |
| Pendências conhecidas listadas      | ✅ Cada sessão lista "Observações para a próxima sessão"                     |
| Decisões referenciam ADR            | ✅ Cada sessão cita ADR-NNN quando aplicável                                 |
| Atualização ao fim de sessão        | ✅ Sessão 18 ("FECHA W1")                                                    |

#### CHANGELOG.md (~600 linhas)

| Aspecto                                               | Status                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Bloco `[Unreleased]` mantido                          | ✅                                                           |
| Cada BL referenciado entre `[]`                       | ✅ — `[BL-CX-NNN]` em cada bullet                            |
| Categorias Keep-a-Changelog (Added/Changed/Fixed/...) | ✅                                                           |
| Mensagens marker de sessão (`<!-- ↓↓↓ Sessão N -->`)  | ✅                                                           |
| Changesets dos pacotes consistentes                   | Não auditei `.changeset/` em detalhe — fora do escopo direto |

#### README.md (raiz)

| Aspecto                                        | Status                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| Status do MVP refletido corretamente           | ✅ "W1 ✅ Concluída"                                 |
| Componentes C0-C8 com status                   | ✅ Tabela atualizada Sessão 18                       |
| Quick start replicável (clone → install → dev) | ✅ Pré-requisitos + comandos                         |
| Documentação interna linkada                   | ✅ Links para CLAUDE/DECISIONS/CHANGELOG/SESSION_LOG |
| Status de cada wave (W0-W4)                    | ✅ Tabela com W1 fechada                             |

#### READMEs por pacote/app

| Workspace               | README                                                 | Status                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sprint/contracts`     | [README.md](packages/contracts/README.md) (174 linhas) | ✅ Extensivo — princípios, uso, API completa, branded types, tabelas                                                                                                            |
| `@sprint/fs-adapter`    | [README.md](packages/fs-adapter/README.md) (25 linhas) | ❌ **STALE** — linha 24: "API completa após F8 desta sessão" — F8 = Fase 8 da Sessão 10 (W0). F8 aconteceu (W0 fechou) + W1 adicionou domain layer; README nunca foi expandido. |
| `@sprint/logger`        | [README.md](packages/logger/README.md) (250+ linhas)   | ✅ Princípios, API, env vars, uso esperado nos apps, exemplos                                                                                                                   |
| `sprint-leader`         | [README.md](apps/leader/README.md) (2.2KB)             | ✅ Razoável                                                                                                                                                                     |
| `sprint-operator-agent` | [README.md](apps/operator-agent/README.md) (2.9KB)     | ✅ Razoável                                                                                                                                                                     |

→ **F-021 (Low)** — fs-adapter README stale.

#### Resumo Gate 8 — Consistência + Documentação

**Cross-package (Categoria 7):**

- Estrutura de pasta ✅ uniforme
- Barrel exports ✅ explícitos e organizados
- Padrão de testes ✅ adjacente + separação por característica
- Imports cross-package ✅ via `@sprint/*`
- **Naming de arquivos:** ⚠️ drift CLAUDE.md vs impl — **F-022**
- **Hierarquias de erro:** ⚠️ aplicado em 3 de 5 pacotes — **F-023**

**Documentação (Categoria 8):**

- CLAUDE.md ✅ completo (1900+ linhas, 12 gotchas verificados, débitos
  parcialmente atualizados)
- DECISIONS.md ✅ 21 ADRs estruturados, datados, com alternativas
- SESSION_LOG.md ✅ 18 sessões com formato padronizado
- CHANGELOG.md ✅ Keep-a-Changelog + BL refs
- README.md raiz ✅ status + quickstart replicável
- READMEs de pacote: 4 de 5 OK; **fs-adapter stale** — **F-021**

**3 novos findings criados:** F-021 (Low), F-022 (Low), F-023 (Low).

### Categoria 9 — Funcional E2E

#### Limitação do escopo desta auditoria

Auditoria é **read-only e headless** — não posso interagir com janelas Electron,
clicar botões, observar overlays. Strategy adotada:

1. **Verificar pré-condições estáticas** (configs, fixtures, paths) — feito.
2. **Citar evidência de smoke já executado** em sessões anteriores (Sessão 15
   Gate 5 + Sessão 16 Gate 8.5).
3. **Marcar cenários interativos** como "requer validação manual de Renan" —
   fora do alcance da auditoria headless.

#### Pré-condições estáticas

| Item                                                                      | Status | Evidência                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev-fixtures/shared/operators.json` válido (5 ops, 4 ativos + 1 inativo) | ✅     | [dev-fixtures/shared/operators.json](dev-fixtures/shared/operators.json) — schema OK                                                                                                                                                                                                                                          |
| `dev-fixtures/shared/pending/` (pasta)                                    | ✅     | Existe; 10 arquivos runtime (residue de sessões dev — `.gitignore` cobre `*.json`/`*.tmp`)                                                                                                                                                                                                                                    |
| `dev-fixtures/shared/acks/` (pasta)                                       | ✅     | Existe; 8 acks de joao (runtime residue)                                                                                                                                                                                                                                                                                      |
| `dev-fixtures/config-example.json` (Leader template)                      | ✅     | Inclui `_comment` removível + path absoluto exemplo                                                                                                                                                                                                                                                                           |
| `dev-fixtures/agent-config.example.json` (Agent template)                 | ✅     | Inclui `_comment` + lista user_ids válidos + `minimize_after_seconds`                                                                                                                                                                                                                                                         |
| `apps/leader/SETUP.md`                                                    | ✅     | ~80 linhas auditadas — pré-req, config schema, setup passo-a-passo                                                                                                                                                                                                                                                            |
| `apps/operator-agent/SETUP.md`                                            | ✅     | ~80 linhas auditadas — espelha estrutura do Leader                                                                                                                                                                                                                                                                            |
| Sample pending JSON valida contra Anexo C                                 | ✅     | Conferido em [dev-fixtures/shared/pending/01KSJ14CRS8YNSF0AYAQKGW175-beatriz.json](dev-fixtures/shared/pending/01KSJ14CRS8YNSF0AYAQKGW175-beatriz.json) — todos 11 campos presentes (schema_version, sprint_id, criado_por, criado_em, user_id, title, body_html, meta, deadline_at, show_duration_seconds, persistent_popup) |
| Sample ack JSON valida contra Anexo D                                     | ✅     | Conferido em [dev-fixtures/shared/acks/01KSJ28AJ3MGYEZPH70AM9XWZ2-joao.ack.json](dev-fixtures/shared/acks/01KSJ28AJ3MGYEZPH70AM9XWZ2-joao.ack.json) — 7 campos (schema_version, sprint_id, user_id, hostname, displayed_at, acknowledged_at, agent_version)                                                                   |
| User real `%APPDATA%/sprint-leader/config.json` existe                    | ✅     | Aponta para `\\srv-alpha\TEMP\Metas_3Studio` (UNC produção, não dev-fixtures — config Renan SMB)                                                                                                                                                                                                                              |
| User real `%APPDATA%/sprint-operator-agent/config.json` existe            | ✅     | Aponta para SMB, user_id "mario", hostname "PC-MARIO"                                                                                                                                                                                                                                                                         |
| `%APPDATA%/sprint-operator-agent/historico/` existe                       | ✅     | Diretório criado em runs anteriores                                                                                                                                                                                                                                                                                           |

#### Cenários do prompt (20 itens) — classificação

| #   | Cenário                                                                                                    | Tipo              | Status / Evidência                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Leader boota com config válida                                                                             | Interactive       | ⚠️ Requer launch manual. **Smoke previamente executado** — Sessão 15 Gate 4 + Gate 5                                                                                                                                                                                      |
| 2   | Agent boota com config válida                                                                              | Interactive       | ⚠️ Requer launch manual. **Smoke previamente executado** — Sessão 16 Gate 8.5 (2 PCs via SMB)                                                                                                                                                                             |
| 3   | Marcar operador, meta=5, deadline 18:00, Enviar — DispatchModal sucesso 1/1                                | Interactive       | ⚠️ **Smoke previamente executado** — Sessão 15 Gate 5: "Smoke real validado: 5 sprints disparadas em dev-fixtures/shared/pending/"                                                                                                                                        |
| 4   | `pending/` tem arquivo `<timestamp>-<sprint_id>-<user_id>.json`                                            | Static-verifiable | ✅ Verificado — 10 arquivos presentes em formato `<ULID>-<user>.json` (ADR-006)                                                                                                                                                                                           |
| 5   | Arquivo gerado valida contra schema Anexo C                                                                | Static-verifiable | ✅ Verificado em arquivo de amostra (acima)                                                                                                                                                                                                                               |
| 6   | Após pollingInterval, overlay fullscreen aparece com title/body/meta/deadline                              | Interactive       | ⚠️ **Smoke previamente executado** — Sessão 16 Gate 4 (BL-C3-004 + tests)                                                                                                                                                                                                 |
| 7   | `acks/` tem ack com `displayed_at` preenchido, sem `acknowledged_at`                                       | Static-verifiable | ✅ Verificado em [acks/01KSJ28AJ3MGYEZPH70AM9XWZ2-joao.ack.json](dev-fixtures/shared/acks/01KSJ28AJ3MGYEZPH70AM9XWZ2-joao.ack.json) — TEM acknowledged_at (smoke já tinha clicado). Padrão correto.                                                                       |
| 8   | Após 30s overlay minimiza para tray (amarelo + badge "1")                                                  | Interactive       | ⚠️ **F-003 já cobre** — timer é 30s vs 5s do backlog AC. State machine documentada em overlayService.ts                                                                                                                                                                   |
| 9   | Click tray "Mostrar sprint atual" → overlay restaura, foco no botão Recebi                                 | Interactive       | ⚠️ Cobertura por test unitário ([overlayService.test.ts](apps/operator-agent/src/main/services/overlayService.test.ts) `restoreCurrent`); F-005 cobre falta de left-click direto                                                                                          |
| 10  | Click "Recebi" → overlay fecha, tray cinza, toast sucesso                                                  | Interactive       | ⚠️ AckButton testado ([AckButton.test.tsx](apps/operator-agent/src/renderer/components/AckButton/AckButton.test.tsx)); handleAck testado ([integration.test.ts](apps/operator-agent/src/main/services/integration.test.ts))                                               |
| 11  | `acks/` agora tem `displayed_at` E `acknowledged_at`                                                       | Static-verifiable | ✅ Verificado nos acks existentes                                                                                                                                                                                                                                         |
| 12  | Arquivo da sprint **NÃO está mais em** `pending/`                                                          | Static-verifiable | ⚠️ Não posso disparar dispatch novo + ack para validar transição em real-time. Code path: handleAck.ts:95-102 chama `pendingStore.deletePending`. **Cobertura por integration test** confirma o flow.                                                                     |
| 13  | `<userData>/historico/YYYY-MM-DD/` tem o arquivo                                                           | Static-verifiable | ✅ Pasta `historico/` confirmada em %APPDATA%/sprint-operator-agent/. Smoke previamente populou.                                                                                                                                                                          |
| 14  | Disparar nova sprint para mesmo user_id; ack; segunda sprint aparece automaticamente                       | Interactive       | ⚠️ Cobertura: [integration.test.ts](apps/operator-agent/src/main/services/integration.test.ts) cenário "2 sprints pre-seeded → poll → ack → next sprint → ack → queue vazia → hide"                                                                                       |
| 15  | Marcar 4 operadores, meta=10 cada, dispatch → 4 arquivos em pending; modal 4/4 sucesso                     | Interactive       | ⚠️ Code path em `dispatchService.dispatch` (try/catch isolado per-operator) testado em [dispatchService.test.ts](apps/leader/src/main/services/dispatchService.test.ts)                                                                                                   |
| 16  | Sem operadores marcados → botão Enviar desabilitado                                                        | Interactive       | ⚠️ Testado via `selectIsValid` que delega para `composerFormSchema` (Zod `.min(1)`) — [sprintComposerSchema.ts:27](apps/leader/src/renderer/stores/sprintComposerSchema.ts:27)                                                                                            |
| 17  | Meta=0 num operador marcado → botão desabilitado                                                           | Interactive       | ⚠️ Testado via `z.number().int().positive()` — fail garantido em meta ≤ 0                                                                                                                                                                                                 |
| 18  | Arquivo malformado em `pending/` (`{ broken json`) → Agent loga warn, sem crash, próximos ciclos continuam | Adversarial       | ⚠️ Code path `kind: 'invalid'` em [pending-store.ts:181](packages/fs-adapter/src/domain/pending-store.ts:181); `processEntry` em [pollingService.ts:161-166](apps/operator-agent/src/main/services/pollingService.ts:161) loga warn. **Testado** em pending-store.test.ts |
| 19  | Renomear `pending/` para `pending_off/` enquanto Agent roda → Agent loga, sem crash                        | Adversarial       | ⚠️ Code path: `DirectoryNotFoundError` benigno em [pollingService.ts:136-138](apps/operator-agent/src/main/services/pollingService.ts:136). **Testado** em pollingService.test.ts                                                                                         |
| 20  | Sprint com deadline passada → Agent ignora; move para histórico sem overlay; sem ack                       | Adversarial       | ⚠️ Code path: [pollingService.ts:191-206](apps/operator-agent/src/main/services/pollingService.ts:191) — RN-11 + RN-08 fluxo. **Testado** em pollingService.test.ts                                                                                                       |

#### Resumo Gate 9 — Funcional E2E

**Static-verifiable:** 5 cenários (#4, #5, #7, #11, #13) — ✅ confirmados via
inspeção de fixtures.

**Interactive (12 cenários):** ⚠️ Requerem execução manual em ambiente Electron.
**9 desses 12 têm cobertura por unit/integration tests** que exercitam o mesmo
code path; os 3 restantes (boot Leader/Agent, dispatch UI clique) foram
**smoke-validados em sessões 15 e 16** conforme SESSION_LOG.

**Adversarial (3 cenários #18, #19, #20):** ⚠️ Code paths cobertos por unit
tests. Smoke manual recomendado mas não-bloqueante (lógica testada em
isolamento).

**Cobertura efetiva da Categoria 9:**

- Static + sessões anteriores documentadas = **15 de 20 cenários (75%) com
  evidência indireta**
- 5 cenários restantes (#8, #9, #10, #14, #15) precisam de smoke manual fresco
  antes da W2 — mas todos têm correlatos em test suite

**Nenhum novo finding criado neste gate.** Achados existentes (F-002
skipTaskbar, F-003 timer 30s, F-005 left-click) já capturam os pontos de
divergência entre comportamento prescrito (backlog) e implementado.

**Recomendação operacional:** antes do início da W2, Renan deveria executar
manualmente um smoke E2E focado nos 5 cenários (#8, #9, #10, #14, #15) usando
`dev-fixtures/shared/` (mudando temporariamente o `shared_path` em
`%APPDATA%/sprint-*/config.json` ou criando configs alternativos). Tempo
estimado: ~20-30 min.

### Categoria 10 — Edge Cases & Modos de Falha

Mesma estratégia do Gate 9 — auditoria headless valida code paths via leitura +
test suite; cenários interativos marcados como tal.

#### Tabela dos 20 cenários adversariais

| #   | Cenário                                                  | Evidência / Comportamento                                                                                                                                                                                                                                                              | Status                                                                                            |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E1  | `operators.json` vazio (`[]`)                            | `useOperatorsStore.loadOperators` filtra ativos → `operators: []`; `OperatorList.tsx:10` mostra "Nenhum usuário ativo cadastrado."                                                                                                                                                     | ✅ UX OK                                                                                          |
| E2  | `operators.json` só inativos                             | Mesma rota — `filter(op => op.ativo)` retorna `[]`; UI vazia                                                                                                                                                                                                                           | ✅ UX OK                                                                                          |
| E3  | `operators.json` malformado JSON                         | `operatorsService.list` throw `OperatorsFileInvalidError`; IPC envelope retorna `{ ok: false, error }`; **MAS** `useOperatorsStore.error` é set mas **`NovaSprint.tsx` nunca renderiza erro** — só lê `loadStatus` sem case para 'error'. Mostra "Nenhum usuário ativo" genérico.      | ❌ **F-025** — erro silencioso                                                                    |
| E4  | Marcar 50+ operadores e dispatch                         | `dispatchService.dispatch` itera `request.selected` em for loop sequencial — ~50ms × 50 = 2.5s aceitável; `pending-store.adversarial.test.ts` testa 10 escritas concorrentes. Para 50+, performance é linear em N.                                                                     | ⚠️ Não-testado para N≥50 mas escala linear plausível                                              |
| E5  | Body customizado                                         | W2 (BL-C2-006). Title fixo `"É hora de correr"`, body fixo `"Sua meta até o final do dia é de: <b>{meta} artes</b>"` (dispatchService.ts:41-42); `{meta}` substituído no main antes da sanitização (regra D2 Sessão 15).                                                               | ✅ comportamento documentado                                                                      |
| E6  | 10 sprints simultâneas via cliques rápidos               | UI desabilita botão `Disparar evento` enquanto `isDispatching === true` (NovaSprint.tsx:111). Sem race ao clicar rápido. **Code path:** `useDispatchStore.start()` → status `in_progress` → `selectIsDispatching` true → botão disabled.                                               | ✅ UI bloqueia race                                                                               |
| E7  | Agent recebe 5 sprints; queue cresce                     | `queueService` FIFO + Set dedup; `onNextSprint` só dispara em vazio→não-vazio; subsequent enqueues atualizam `onQueueUpdated` → tray badge "+N"; ack da atual → handleAck → showSprint(next). **Testado** em integration.test.ts.                                                      | ✅                                                                                                |
| E8  | Agent matado durante overlay show                        | `pending/` ainda tem o arquivo (não foi acked); polling re-detecta; `historyService.initializeFromDisk` no boot popula cache de processados — sprint NÃO está no cache → re-enfileira. **`writeDisplayed` chamado de novo** → ack tem novo `displayed_at` (não preserva).              | ⚠️ Documentado em CLAUDE.md §4 C3; smoke não-validado                                             |
| E9  | Leader matado durante DispatchModal                      | Escrita atômica por arquivo (writeFileAtomic via .tmp + rename). Se mata mid-dispatch, alguns arquivos commitados, outros não. Estado consistente per-arquivo — sem corrupção. **F-009** atual deadline já alerta operador.                                                            | ⚠️ Estado consistente per-arquivo; falha parcial não-comunicada (re-clicar dispara dispatch novo) |
| E10 | body_html com cada vetor XSS de `xssVectors.ts`          | 21 vetores em 5 categorias **testados** em sanitize.test.ts via `expectNoXssExecution`. Re-sanitização defensiva no SprintCard.tsx:24.                                                                                                                                                 | ✅                                                                                                |
| E11 | user*id com `*`, `.`, dígitos                            | Regex `[a-z0-9_-]+`: `_` ✅, dígitos ✅, `-` ✅, **`.` REJEITADO**. Schema rejeita user_id com ponto em `userIdSchema` em `@sprint/contracts`.                                                                                                                                         | ✅ documentado; `.` rejeitado por design                                                          |
| E12 | meta=999999999                                           | Schema: `z.number().int().positive().finite()` — sem upper bound. 999999999 passa. Render OK ("Sua meta de: 999999999 artes").                                                                                                                                                         | ⚠️ Sem limite superior — meta pode ser absurda                                                    |
| E13 | body_html de 1MB                                         | Schema `body_html: z.string().min(1).max(2000)` — **REJEITA > 2000 chars**. Em W1 body é fixo no Leader (não-customizável). E13 N/A na prática (BL-C2-006 W2).                                                                                                                         | ✅ schema rejeita                                                                                 |
| E14 | 2 instâncias do Agent com mesmo user_id                  | **Mesma máquina:** single instance lock previne (`acquireSingleInstanceLock`). **Máquinas diferentes:** ambas processam — RN-02 ("Cada operador user_id único") é responsabilidade da TI; código não enforça. Ambas escrevem ack (last-write-wins, line 91-94 ack-store.ts documenta). | ⚠️ TI-responsibility; sem enforcement                                                             |
| E15 | Rename de pending/ durante listPending                   | Adapter race-safe via `FileNotFoundError` skip ([pending-store.ts:172-174](packages/fs-adapter/src/domain/pending-store.ts:172)). **Testado** em pending-store.adversarial.test.ts (race de pasta removida)                                                                            | ✅                                                                                                |
| E16 | Tempo do sistema retroceder                              | mtime-based sorting (PendingStore.listPending:197 sort ascending by `modifiedAt`). Se relógio retrocede entre 2 writes, ordering quebra. **Não testado, não documentado.**                                                                                                             | ⚠️ Edge case não-documentado                                                                      |
| E17 | `<userData>/historico/` sem permissão                    | handleAck.ts:83-92 archive try/catch **NÃO-FATAL** — `movedToHistory: false`; deletePending pode suceder; ack escrito. **Renderer (AckButton.tsx) NÃO inspeciona `moved_to_history`** — mostra success sempre. Sprint perdida do histórico local.                                      | ❌ **F-024** — falha silenciosa                                                                   |
| E18 | Path com espaços e acentos                               | path.posix.join + UTF-8; **testado** em roundtrip.test.ts:309 (acentos + emojis + chars especiais preservados byte-a-byte). Anti-pattern: Windows MAX_PATH 260 chars não testado.                                                                                                      | ✅ acentos OK; MAX_PATH não-testado                                                               |
| E19 | `LOG_LEVEL=debug` no Agent                               | Agent NÃO usa `@sprint/logger` ainda — apenas `console.warn`/`error` inline (F-007). LOG_LEVEL **não tem efeito**.                                                                                                                                                                     | ⏸️ N/A — W3 BL-C6-002                                                                             |
| E20 | Build de produção (`NODE_ENV=production` + `pnpm build`) | `pnpm build` PASS em Gate 1 baseline. Logger em prod = JSON (testado config.test.ts). Vite externalize jsdom/canvas no main (G-020).                                                                                                                                                   | ✅                                                                                                |

#### Sumário Gate 10 — Edge Cases

| Categoria                             | Qtde | Detalhe                                                                                                                                          |
| ------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ Comportamento correto              |    9 | E1, E2, E5, E6, E7, E10, E11, E13, E15, E18, E20                                                                                                 |
| ⚠️ Documentado/tolerado mas não-ideal |    6 | E4 (não-testado N≥50), E8 (re-write displayed_at), E9 (falha parcial não-UX), E12 (sem upper bound), E14 (TI-responsibility), E16 (clock rewind) |
| ❌ Falha silenciosa de UX             |    2 | E3 (operators load error) → F-025, E17 (archive failure) → F-024                                                                                 |
| ⏸️ N/A no W1                          |    2 | E5 (W2 customização), E19 (logger W3)                                                                                                            |
| Não-testado mas plausível             |    1 | E4 (50+ ops scaling)                                                                                                                             |

**2 novos findings criados:** F-024 (Medium), F-025 (Medium).

---

## Análise quantitativa final (Gate 11)

### Distribuição de findings por categoria de origem

| Categoria do report            | Findings | IDs                                                           |
| ------------------------------ | -------: | ------------------------------------------------------------- |
| 1 — Backlog Compliance         |        9 | F-001, F-002, F-003, F-004, F-005, F-008, F-009, F-010, F-011 |
| 2 — Rastreabilidade            |        1 | F-011 (compartilhado com Categoria 1)                         |
| 3 — Conformidade Arquitetural  |        4 | F-012, F-013, F-014, F-015                                    |
| 4 — Type Safety                |        1 | F-016                                                         |
| 5 — Testes & Cobertura         |        3 | F-017, F-018, F-019                                           |
| 6 — Segurança                  |        1 | F-020                                                         |
| 7 — Consistência Cross-Package |        2 | F-022, F-023                                                  |
| 8 — Documentação               |        1 | F-021 (+ F-016, F-022 compartilhados)                         |
| 9 — Funcional E2E              |        0 | —                                                             |
| 10 — Edge Cases                |        2 | F-024, F-025                                                  |
| 11 — Cross-reference           |        — | (este gate)                                                   |

### Distribuição de findings por componente impactado

| Componente                     | Findings | IDs                                                           | Comentário                                                |
| ------------------------------ | -------: | ------------------------------------------------------------- | --------------------------------------------------------- |
| **C3** (Operator Agent)        |    **9** | F-002, F-003, F-004, F-005, F-006, F-011, F-012, F-019, F-024 | **Concentração marcada** — overlay/tray/timer/history/UX  |
| C2 (Leader)                    |        4 | F-008, F-009, F-024 (ack flow), F-025                         | Quase todos cosméticos (logo, deadline UX) — exceto F-025 |
| C6 (logger)                    |        1 | F-007                                                         | File rotation deferido                                    |
| C8 (testes)                    |        3 | F-017, F-018, F-019                                           | Thresholds e App.tsx test                                 |
| Cross-cutting (segurança/deps) |        1 | F-020                                                         | pnpm audit HIGH                                           |
| Documentação                   |        5 | F-007, F-016, F-021, F-022, F-023                             | doc lag                                                   |
| Schema/contracts               |        0 | —                                                             | C1 ✅                                                     |
| fs-adapter                     |        1 | F-001                                                         | mock injection API                                        |

### Padrões temáticos consolidados (6 padrões identificados)

| #   | Padrão                                                                                                | Findings                                                                    | Severidade ponderada                      |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | **Documentation lag** — decisões implementadas mas docs (backlog/requisitos/CLAUDE) não atualizadas   | F-007, F-016, F-021, F-022, F-008 (+ menções em F-003, F-006, F-011, F-013) | 5 Low + impacto indireto em 4 High/Medium |
| 2   | **Schema-Implementation drift** — `SprintPayload` declara capacidades que o Agent não consome         | F-003 (`show_duration_seconds`), F-011 (`persistent_popup`)                 | 1 High + 1 Medium                         |
| 3   | **UX silente em modos de falha** — main process captura erro mas renderer não surface                 | F-024 (archive), F-025 (operators.json load)                                | 2 Medium                                  |
| 4   | **Persistência local vs shared inconsistente** — paths em userData (não ProgramData) + bypass adapter | F-006 (paths), F-012 (historyService bypass)                                | 1 High + 1 Medium                         |
| 5   | **Inconsistência arquitetural entre apps** — convenções diferentes Leader vs Agent                    | F-013 (IPC naming), F-014 (envelope)                                        | 2 Low                                     |
| 6   | **Test infra subdimensionada nos apps** — thresholds frouxos/ausentes, App.tsx sem test               | F-017, F-018, F-019                                                         | 1 High + 1 Medium + 1 Low                 |

### Cross-references entre findings (raízes compartilhadas)

| Finding raiz                              | Findings derivados / relacionados                               | Notas                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **F-003** (timer source incorrect)        | F-011 (persistent_popup também não-consumed)                    | Mesma raiz: Schema-Implementation drift. Corrigir um pavimenta o outro.                                     |
| **F-006** (paths userData vs ProgramData) | F-012 (historyService bypass adapter)                           | Mesma raiz: modelo de persistência local. Decisão sobre F-006 determina abordagem em F-012.                 |
| **F-007** (BL-C6 numbering drift)         | (raiz isolada — afeta backlog grooming)                         | Bloquear: definir numbering antes de qualquer trabalho em BL-C6-002+.                                       |
| **F-013** (IPC camelCase vs scope:action) | F-014 (envelope inconsistente)                                  | Independentes mas mesma família. Ambos exigem ADR-022 padronizando.                                         |
| **F-016** (rootDir débito stale)          | F-021 (fs-adapter README stale), F-022 (naming CLAUDE.md drift) | Mesma raiz: documentação não-atualizada após implementação.                                                 |
| **F-017** (Leader sem thresholds)         | F-018 (Agent thresholds baixos), F-019 (App.tsx 0%)             | Mesma família: test infrastructure subdimensionada. Fix coordenado num PR.                                  |
| **F-024** (archive silent)                | F-025 (operators.json silent)                                   | Mesma raiz: error capturado em main, renderer não surface. Solução: componente `ErrorBanner` compartilhado. |

### Dependências entre correções

```
F-007 → desbloqueia → BL-C6-002 + BL-C6-003 (W3) reconciliados
F-006 → influencia → F-012 (mesma decisão)
F-003 → estabelece padrão → F-011 (mesma estratégia)
F-013 → ADR-022 → F-014 (mesma ADR)
F-024 + F-025 → ErrorBanner component → fix coordenado
F-017 + F-018 + F-019 → vitest config + 1 test file → PR único
F-008, F-016, F-021, F-022 → docs sweep → PR docs-only
```

**Grafo informal de prioridades:**

- Critical path (não-bloqueante mas alta visibilidade): F-002 (skipTaskbar) —
  fix isolado 1 linha
- Decisões arquiteturais (Renan-dependentes): F-003, F-006, F-013 — exigem
  ADR-022..024
- Defesa em profundidade UX: F-024 + F-025 (juntos) → ErrorBanner
- Docs sweep (oportunístico): F-007, F-008, F-016, F-021, F-022, F-023 — PR
  único
- Security debt: F-020 — override `tmp` em pnpm.overrides
- Test debt: F-017 + F-018 + F-019 — vitest configs + 1 App.test.tsx

### Cobertura agregada do monorepo

| Métrica                                    | Valor                                                    |
| ------------------------------------------ | -------------------------------------------------------- |
| Total de tests verde                       | 1056 (1053 + 3 skipped Windows)                          |
| Total test files                           | 62 (14 + 15 + 3 + 17 + 13)                               |
| Packages com 100% cobertura                | 3 de 5 (contracts, fs-adapter≈, logger)                  |
| Apps acima de 95% cobertura                | 2 de 2 (leader 96.89%, agent 97.76%)                     |
| Catches em código de produção              | 13 (em 8 arquivos)                                       |
| Catches com teste dedicado                 | 11 de 13 (84.6%) — 2 não-disparáveis deterministicamente |
| Silent catches sem justificativa           | 0                                                        |
| `any` em produção                          | 0                                                        |
| `@ts-ignore` em qualquer lugar             | 0                                                        |
| `console.log/info/debug` em qualquer lugar | 0                                                        |

### Densidade de ADRs por componente

| Componente      | ADRs dedicados                      | Adequação                                                                |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| C0 (Foundation) | 3 (ADR-001, -007, -008)             | ✅ Adequado                                                              |
| C1 (Contracts)  | 3 (ADR-005, -006, -014)             | ✅ Adequado                                                              |
| C2 (Leader)     | 3 (ADR-015, -017, -018)             | ✅ Adequado                                                              |
| C3 (Agent)      | 3 (ADR-011, -012, -019)             | ✅ Adequado                                                              |
| C4 (fs-adapter) | 2 (ADR-013, -016)                   | ✅ Adequado                                                              |
| C5 (Installer)  | 0                                   | ⚠️ Sem ADR dedicado; configs em `electron-builder.yml` + SETUP.md cobrem |
| C6 (Logger)     | 1 (ADR-020)                         | ✅ Adequado                                                              |
| C8 (QA)         | 1 (ADR-021)                         | ✅ Adequado                                                              |
| Cross-cutting   | 5 (ADR-002, -003, -004, -009, -010) | ✅ Excellent — pilares arquiteturais                                     |

**Observação:** C5 sem ADR dedicado não é finding bloqueante —
`electron-builder.yml` + SETUP.md + CHANGELOG cobrem decisões de packaging. Em
W3 quando entrar BL-C5-003+ (auto-start), provavelmente vai precisar de ADR.

### Pendências conhecidas vs surpresas

#### Pendências legítimas (documentadas em SESSION_LOG/CLAUDE.md, deferidas para W2/W3/W4)

13 itens deferidos legitimamente — não viraram findings:

- W2: BL-C2-006, -008, -009; BL-C3-009, -010 (parcial), -011, -012 (parcial);
  BL-C4-004
- W3: BL-C2-010, -012; BL-C3-013, -014; BL-C4-005; BL-C5-003, -006; BL-C6-002,
  -003; BL-C8-004, -006
- W4: BL-C2-... ; BL-C4-008; BL-C5-005, -007; BL-C6-004; BL-C8-007

#### Surpresas — findings sem deferral documentado

11 dos 25 findings são **falhas que não estavam declaradas como pendências**:

| Finding | Surpresa porque...                                                           |
| ------- | ---------------------------------------------------------------------------- |
| F-002   | Backlog AC explícito, CLAUDE.md §8.2 exemplo igual, sem ADR contrário        |
| F-005   | Backlog AC explícito (left-click); sem deferral                              |
| F-011   | Schema `SprintPayload` declara campo; Agent ignora silenciosamente sem ADR   |
| F-017   | Vitest config comment promete "W1+ define" — promessa não cumprida           |
| F-019   | Leader tem App.test.tsx; Agent não — assimetria sem explicação               |
| F-020   | `pnpm audit` HIGH é novo (post ADR-010); regressão sem captura               |
| F-021   | fs-adapter README diz "F8 da sessão" — F8 aconteceu, README nunca atualizado |
| F-022   | CLAUDE.md §7.1 prescreve kebab-case; 4 de 5 packages usam camelCase          |
| F-024   | Falha de archive é silente sem alerta operador — bug de UX latente           |
| F-025   | UC-01 A4 ("erro de conexão") implementação ausente                           |
| F-016   | Débito listado como "pendente" mas fix aplicada                              |

#### Pendências antecipadas (entregues em W1 apesar do backlog tagear W2)

2 RFs entregues além-do-escopo, **benefícios não-capturados** em backlog:

- RF-16 (queueService implementado em W1; BL-C3-010 marcado W2)
- RF-18 (deadline check no pollingService W1; BL-C3-012 marcado W2)

→ Sugere atualização de backlog mas não é finding.

### Resumo Gate 11

- **25 findings totais** após cross-reference (zero merges/duplicates — todos
  são distintos)
- **6 padrões temáticos sistêmicos** identificados — não são bugs isolados
- **84.6% dos catches têm teste dedicado** — disciplina alta
- **11 de 25 findings são surpresas** (sem deferral em docs) — restante 14 são
  consequências da escolha de waves
- **Densidade de ADRs adequada** em todos os componentes principais
- **0 novos findings neste gate** — análise de meta-padrões

---

## Findings consolidados

### CRITICAL (0)

_Nenhum finding crítico identificado nos gates executados até aqui._

### HIGH (5)

#### F-020 — `pnpm audit` reporta 1 HIGH (`tmp <0.2.6` path traversal) + 3 moderate; ausência de override

- **Severidade:** High
- **Categoria:** 6 (Segurança — dependências)
- **BL:** transversal — afeta `apps/leader` build chain
- **Evidência:** Output completo do `pnpm audit --audit-level=low` (Gate 7):
  - **HIGH** `tmp <0.2.6` — Path Traversal via unsanitized prefix/postfix;
    cadeia
    `apps__leader>electron-builder>app-builder-lib>@malept/flatpak-bundler>tmp-promise>tmp`.
    Patched em `>=0.2.6`. Advisory GHSA-ph9p-34f9-6g65.
  - Moderate `esbuild <=0.24.2` — Dev server arbitrary requests (cadeia
    `apps__leader>vite>esbuild`).
  - Moderate `vite <=6.4.1` — Path Traversal in `.map` handling (cadeia
    `apps__leader>vite` + `packages__contracts>vitest>vite`).
  - [package.json:40-42](package.json:40) tem apenas
    `"overrides": { "tar": "^7.5.11" }` — **sem override para `tmp`, `esbuild`,
    ou `vite`** (Vite resolve via Vitest é transitivo).
- **Impacto:**
  1. **Build-time only** — não embarca no produto final (Leader/Agent bundles).
     Mitigação parcial vs runtime exposure.
  2. **HIGH severity** — path traversal em `tmp` é exploitable via path passado
     para electron-builder durante empacotamento. Risco se um atacante conseguir
     injetar nomes de arquivo no build pipeline (cadeia de suprimento).
  3. ADR-010 (que ratificou Electron 42 + override de `tar`) **deveria ter
     capturado este `tmp`** — auditoria v1 da Sessão 07/08 endereçou os `tar`
     advisories mas o `tmp` ficou para trás (ou foi introduzido depois).
  4. Sessão 18 ADR-021 (testes production-grade) **não inclui audit** —
     disciplina de manter `pnpm audit` clean caiu.
- **Recomendação:**
  - Adicionar `"tmp": "^0.2.6"` ao `pnpm.overrides` em
    [package.json](package.json). Re-rodar `pnpm install` + `pnpm audit`.
  - Considerar `"esbuild": "^0.25.0"` e Vite ≥ 6.4.2 — mas Vite 5.x → 6.x é
    major bump (deferir para wave dedicada ou bump cuidadoso).
  - Adicionar etapa `pnpm audit --audit-level=high` em CI para regressão (BL-C8
    — quando entrar no W3/W4).
- **Estimativa de correção:** S (< 30min — override + re-install + verificar
  audit limpo).
- **Status:** ✅ RESOLVED (Sessão de correções — 2026-05-27)
- **Resolução:**
  - Fix: adicionado `"tmp": "^0.2.6"` ao `pnpm.overrides` em
    [package.json:42](package.json:42) (linha logo após o `tar` existente).
  - Teste de regressão: não-aplicável a unit test — verificação direta via
    `pnpm audit --audit-level=high` (exit 0 confirmado pós-fix). Output bruto:
    era `4 vulnerabilities found / Severity: 3 moderate | 1 high`; pós-fix
    `3 vulnerabilities found / Severity: 3 moderate` (os 3 moderates
    remanescentes — `esbuild` + `vite` × 2 — são build-time only, fora do escopo
    deste finding e tratados como tech debt).
  - Resumo: 1 linha em `package.json` + `pnpm install` (resolve 1 package:
    `+1 -1 tmp`). `pnpm audit --audit-level=high` agora exit 0; Highs zerados.

#### F-017 — `sprint-leader/vitest.config.ts` sem coverage thresholds materializados (regressão silenciosa)

- **Severidade:** High
- **Categoria:** 5 (Testes & Cobertura)
- **BL:** BL-C8-001 (Vitest + Turborepo)
- **Evidência:**
  - [apps/leader/vitest.config.ts:11-32](apps/leader/vitest.config.ts:11) define
    `coverage` (provider, reporter, include, exclude) **MAS NÃO `thresholds`**.
    Comentário inline na linha 29:
    `// W0: scaffold sem lógica, sem threshold; W1+ define` — promessa não
    cumprida.
  - CLAUDE.md §7.7.1 reconhece:
    "`sprint-leader: n/a (sem thresholds — confirmar Gate 6)`".
  - Cobertura real atual: **96.89/94.51/93.84/96.89** — excelente, mas sem
    floor.
- **Impacto:**
  - Regressão de cobertura passa silenciosa — CI verde mesmo se um PR derrubar
    coverage para 50%.
  - O prompt da auditoria expecta granular: stores ≥ 90%, services ≥ 90%,
    componentes ≥ 60%. Sem threshold, nada disto é enforced.
  - Inconsistência grave com a doutrina de defesa em profundidade adotada pelos
    packages — threshold elevado é "build-fails-on-regression", garante
    manutenção da disciplina ao longo do tempo.
- **Recomendação:** Materializar thresholds no `vitest.config.ts` do Leader.
  Mínimo recomendado dado o real atual:
  ```ts
  thresholds: {
    lines: 95, branches: 90, functions: 90, statements: 95,
    // OU per-folder via 'src/main/services/**' + 'src/renderer/components/**'
  }
  ```
  Atualizar CLAUDE.md §7.7.1 substituindo "n/a" pelos valores.
- **Estimativa de correção:** S (< 30min — config + ajuste docs).
- **Status:** ✅ RESOLVED (Sessão de correções — 2026-05-27)
- **Resolução:**
  - Fix: adicionado bloco
    `thresholds: { lines: 95, functions: 90, branches: 90, statements: 95 }` em
    [apps/leader/vitest.config.ts:29-34](apps/leader/vitest.config.ts:29).
    Substituído comentário "W0: scaffold sem lógica..." que prometia W1+.
  - Doc: CLAUDE.md §7.7.1 atualizado — linha da tabela trocou de
    `n/a / n/a / n/a / n/a` para `95% / 90% / 90% / 95%` e o parágrafo final
    substituiu "À medida que código de domínio for adicionado em W1+, thresholds
    serão introduzidos via PR dedicado" por nota com data e referência ao F-017.
  - Teste de regressão: não-aplicável a unit test — o **próprio threshold
    materializado é o teste de regressão** (build do Leader falha
    automaticamente se cobertura cair abaixo do floor). Coverage real pós-fix:
    96.89/94.51/93.84/96.89 — todos com folga sobre o threshold;
    `pnpm --filter sprint-leader test:coverage` exit 0 confirmado.
  - Resumo: 1 bloco em `vitest.config.ts` + 2 edits em `CLAUDE.md` §7.7.1. CI
    agora protege o Leader contra regressão de cobertura.

#### F-002 — Overlay com `skipTaskbar: false` (contraria AC do backlog e CLAUDE.md §8.2)

- **Severidade:** High
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C3-004 (AC4)
- **Evidência:**
  [apps/operator-agent/src/main/services/overlayService.ts:239](apps/operator-agent/src/main/services/overlayService.ts:239)
  — `skipTaskbar: false`. Backlog BL-C3-004 AC4 diz literalmente
  `skipTaskbar: true`; CLAUDE.md §8.2 (snippet do overlay TOPMOST) também usa
  `skipTaskbar: true`. Sem ADR documentando o desvio.
- **Impacto:** Overlay aparece na taskbar do Windows. Operador pode
  reabrir/minimizar pela taskbar bypassing o fluxo de tray, ou pode fechar e
  perder o overlay. Conflito visual com BL-C3-006 (tray icon é a interface
  persistente — taskbar entry é redundante).
- **Recomendação:** Trocar para `skipTaskbar: true` em overlayService.ts:239. Se
  a decisão atual for intencional, registrar ADR justificando E atualizar
  CLAUDE.md §8.2 + backlog AC para consistência.
- **Estimativa de correção:** S (< 1h — uma linha + recompilar; smoke test do
  Agent valida).
- **Status:** ✅ RESOLVED (Sessão de correções — 2026-05-27)
- **Resolução:**
  - Fix: `skipTaskbar: false` → `true` em
    [apps/operator-agent/src/main/services/overlayService.ts:239](apps/operator-agent/src/main/services/overlayService.ts:239)
    (1 linha). Alinha com backlog BL-C3-004 AC4 e snippet do CLAUDE.md §8.2 —
    nenhuma decisão intencional contrária identificada (CLAUDE.md §4 C3 não
    menciona desvio; ADR-019 da W1.C3 também não).
  - Teste de regressão:
    [apps/operator-agent/src/main/services/overlayService.test.ts:443-478](apps/operator-agent/src/main/services/overlayService.test.ts:443)
    — novo describe
    `"OverlayService — BrowserWindow construction args (regressão F-002)"` com 2
    testes:
    1. `'regressão F-002: BrowserWindow do overlay é criado com skipTaskbar: true (backlog BL-C3-004 AC4 + CLAUDE.md §8.2)'`
       — usa `expect.objectContaining({ skipTaskbar: true })` no
       `mockBrowserWindow`.
    2. `'regressão F-002: demais flags TOPMOST presentes no constructor (defesa em profundidade — fullscreen, frame:false, alwaysOnTop)'`
       — guard rail adicional.
  - TDD: o primeiro teste FALHOU antes do fix (`expected true, got false`),
    passou após. Confirmação cirúrgica.
  - Resumo: 1 char em production (`false` → `true`) + 2 testes de regressão.
    Suíte global: 1056 → 1058 testes verdes (sem regressão).

#### F-003 — Timer de minimização usa `minimize_after_seconds` (config, 30s) em vez de `show_duration_seconds` (sprint payload, 5s)

- **Severidade:** High
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C3-005 (AC1)
- **Evidência:**
  - [apps/operator-agent/src/main/services/overlayService.ts:222-225](apps/operator-agent/src/main/services/overlayService.ts:222)
    — timer usa `this.minimizeAfterMs` injetado pelo construtor.
  - [apps/operator-agent/src/main/index.ts](apps/operator-agent/src/main/index.ts)
    (composition root) injeta a partir de `RuntimeConfig.minimizeAfterMs`, vindo
    de `agent-config.json:minimize_after_seconds` (campo extra-schema, default
    30s — CLAUDE.md §4 C3 + ADR-019 D2).
  - O campo canônico `SprintPayload.show_duration_seconds` (definido em
    `agent-config.schema.ts` e SprintPayload schema, default 5s per
    `DEFAULT_SHOW_DURATION_SECONDS` em
    [packages/contracts/src/constants.ts:31](packages/contracts/src/constants.ts:31))
    **não é consultado em lugar nenhum** do Agent.
- **Impacto:**
  1. **Default 30s vs AC 5s** — 6× a duração esperada pela AC.
  2. **Per-sprint customização quebrada** — o líder não consegue customizar a
     duração por sprint (campo do schema é ignorado).
  3. **Constante `DEFAULT_SHOW_DURATION_SECONDS = 5` é dead code** no fluxo
     atual.
  4. Divergência documentada em ADR-019 D2 mas Requisitos/backlog não
     atualizados.
- **Recomendação:**
  - Opção A (alinha com backlog): Trocar a fonte do timer para
    `currentItem.payload.show_duration_seconds` em overlayService;
    remover/depreciar `minimize_after_seconds` do agent-config.
  - Opção B (alinha com decisão ADR-019): Atualizar formalmente backlog AC1 +
    Requisitos + remover `DEFAULT_SHOW_DURATION_SECONDS` do contracts (ou marcar
    como deprecated). Registrar ADR-022 explicitando a inversão de fonte.
- **Estimativa de correção:** M (1-4h — exige decisão Renan, ajuste em código +
  testes + docs).
- **Status:** ⏸️ DEFERRED — Renan-dependente (ADR-022). Catalogado em
  `TECH_DEBT.md`.

#### F-006 — Histórico, config e logs em `%APPDATA%\<app>\` (per-user) em vez de `C:\ProgramData\SprintAgent\` (all-users)

- **Severidade:** High
- **Categoria:** 1 (Backlog Compliance) + 2 (Rastreabilidade — Requisitos Anexo
  B)
- **BL:** BL-C3-008 (AC2) — também afeta BL-C3-002 (config loader) e BL-C6-003
  (logs do Agent — W3).
- **Evidência:**
  - [apps/operator-agent/src/main/services/historyService.ts:57](apps/operator-agent/src/main/services/historyService.ts:57)
    — `getHistoricoPath()` retorna `path.join(this.userDataPath, 'historico')`.
  - `userDataPath` vem de `app.getPath('userData')` em
    [main/index.ts](apps/operator-agent/src/main/index.ts), que no Windows
    resolve para `%APPDATA%\sprint-operator-agent\` (per-user, per CLAUDE.md
    G-022).
  - Config loader [main/config.ts](apps/operator-agent/src/main/config.ts) usa o
    mesmo `userData`.
  - **Requisitos Anexo B (linha 467-475 do extract) é explícito**:
    `C:\ProgramData\SprintAgent\config.json`, `historico\`, `log.txt` — pasta
    all-users `ProgramData`, não `%APPDATA%`.
- **Impacto:**
  1. **Modelo de instalação diverge do documentado** — Requisitos previa
     instalação compartilhada por máquina (uma config para todos os usuários da
     estação); a implementação atual cria configs per-user, fragmentando estado
     e dificultando manutenção pela TI.
  2. **Operadores que troquem de usuário Windows perdem histórico local** —
     cenário comum em estações compartilhadas.
  3. **CLAUDE.md G-022 reconhece a divergência mas não houve ADR formal nem
     atualização do Requisitos**.
- **Recomendação:**
  - Opção A (alinha com Requisitos): refatorar para usar
    `path.join('C:\\ProgramData\\SprintAgent', ...)` — exige permissões de admin
    no instalador (RF-19 já prevê isso) + ajuste em config loader, history
    service e futuro logger.
  - Opção B (alinha com implementação): atualizar Requisitos Anexo B + R-03 +
    RF-19 + RN-13 para refletir per-user; registrar ADR formal; revisar
    trade-offs (segurança, multi-user).
- **Estimativa de correção:** M-L (1-4h se Opção B docs-only; 4h+ se Opção A com
  mudança no código + instalador).
- **Status:** ⏸️ DEFERRED — Renan-dependente (ADR-023). Catalogado em
  `TECH_DEBT.md`.

### MEDIUM (8)

#### F-024 — `handleAck` archive falha silenciosamente — operador unaware que sprint não foi para histórico local

- **Severidade:** Medium
- **Categoria:** 10 (Edge Cases & Modos de Falha)
- **BL:** BL-C3-008
- **Evidência:**
  - [apps/operator-agent/src/main/handlers/handleAck.ts:83-92](apps/operator-agent/src/main/handlers/handleAck.ts:83)
    — try/catch sobre `historyService.archive`, **não-fatal**. Catch loga warn +
    seta `movedToHistory = false`.
  - Linhas 95-101 — `pendingStore.deletePending` também não-fatal (loga warn).
  - Linha 118 — response `{ acknowledged_at, moved_to_history: false }`
    retornada ao renderer.
  - [apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx:40-44](apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx:40)
    — testa `!result.ok` mas **NÃO inspeciona `result.data.moved_to_history`**.
    Caminho `ok: true` apenas espera o flow continuar (`sprint:incoming` next).
  - Cenário: se `<userData>/historico/` perde permissão de escrita:
    1. `writeAcknowledged` (acks/) ✅
    2. `archive` (historico/) ❌ (silently warn'd)
    3. `deletePending` (pending/) ✅
    4. Renderer mostra success
    5. Sprint **gone**: não está em pending/, não está em historico/, mas o ack
       foi escrito
- **Impacto:**
  - **Data inconsistency:** ack registrado mas sprint não-arquivada localmente.
  - **Reabertura quebrada:** tray "Mostrar sprint atual" depende de queue
    interna; após ack a queue avança, então a sprint perdida não pode ser
    reaberta.
  - **Operador invisible:** nenhum toast/warning indica que algo falhou.
  - Cenário de produção plausível: pasta `historico/` corrompida, disco cheio,
    permissão alterada.
- **Recomendação:**
  - Opção A (mínima): AckButton.tsx inspeciona
    `result.data.moved_to_history === false` e mostra toast
    `'Histórico local não foi atualizado — sprint registrada mas pode não aparecer em "Histórico"'`.
  - Opção B (mais robusta): tornar `archive` fatal em handleAck — se falhar, ack
    é desfeito (rollback) ou re-emitido em ciclo seguinte. Mais complexo.
  - Opção C: tornar `deletePending` condicional ao `movedToHistory === true` —
    sprint permanece em pending/ se historico/ falha; polling re-detecta no
    ciclo seguinte.
- **Estimativa de correção:** S-M (Opção A: 1h — UI feedback + teste; Opção C:
  2-3h — refactor handleAck + testes; Opção B: 4h+ — desfazer ack distribuído é
  complexo)
- **Status:** ✅ RESOLVED (Sessão de correções — 2026-05-27) — Opção A
- **Resolução:**
  - Fix:
    [apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx](apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx)
    ganhou state `warning` resetado no início do handler. Quando
    `result.ok === true && !result.data.moved_to_history`, seta mensagem
    `'Histórico local não foi atualizado. A rodada foi confirmada com sucesso, mas pode não aparecer em "Histórico".'`.
    Renderizado em `<p role="status">` (não "alert" — é warning não-bloqueante,
    ack já foi escrito).
  - CSS: nova classe `.warning` em
    [AckButton.module.css:44-50](apps/operator-agent/src/renderer/components/AckButton/AckButton.module.css:44)
    — yellow accent (`var(--color-warning)` com fallback), centralizada.
  - Teste de regressão:
    [apps/operator-agent/src/renderer/components/AckButton/AckButton.test.tsx:140-203](apps/operator-agent/src/renderer/components/AckButton/AckButton.test.tsx:140)
    — novo describe `'AckButton — moved_to_history: false (regressão F-024)'`
    com 4 testes: (a) `moved_to_history: false` → warning role=status visível,
    sem `role=alert`; (b) `moved_to_history: true` → warning ausente; (c)
    warning persiste enquanto button disabled (esperando remount); (d) warning
    some após remount via `key` (próxima sprint).
  - Resumo: ack já foi escrito no shared, então não há rollback — o warning
    informa o operador sem bloquear o flow. Comportamento alinha com Opção A da
    auditoria; Opções B/C deferidas como tech debt (mais robustas mas requerem
    refactor de handleAck).

#### F-025 — `operators.json` load errors silenciados na UI do Leader — "Nenhum usuário ativo" mostrado mesmo em malformed/inaccessible

- **Severidade:** Medium
- **Categoria:** 10 (Edge Cases & Modos de Falha) + 2 (Rastreabilidade — UC-01
  fluxo alternativo A4)
- **BL:** BL-C2-003 (lista de operadores) + BL-C2-007 (precondição de dispatch)
- **Evidência:**
  - [apps/leader/src/renderer/stores/useOperatorsStore.ts:54-68](apps/leader/src/renderer/stores/useOperatorsStore.ts:54)
    — `loadOperators` captura erro corretamente:
    `set({ status: 'error', error: result.error.message, operators: [] })`.
  - [apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx:28](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx:28)
    — `loadStatus` é lido da store mas **NUNCA usado para rendering
    condicional**.
  - [apps/leader/src/renderer/components/OperatorList/OperatorList.tsx:9-11](apps/leader/src/renderer/components/OperatorList/OperatorList.tsx:9)
    — mostra `<p>Nenhum usuário ativo cadastrado.</p>` se
    `operators.length === 0` — **mesma mensagem genérica quando há erro de
    leitura**.
  - Cenários afetados:
    - `operators.json` ausente — UI mostra "Nenhum usuário ativo cadastrado"
    - `operators.json` malformed JSON — idem
    - `operators.json` schema violado (campo errado) — idem
    - SMB inacessível — idem
    - I/O permission error — idem
  - **Operador não distingue "ninguém cadastrado" de "erro técnico"**.
  - Requisitos UC-01 fluxo alternativo A4: "Pasta compartilhada inacessível:
    Sistema exibe erro de conexão e instrui contato com TI." — **NÃO atendido**.
- **Impacto:**
  - UC-01 A4 violado — fluxo alternativo declarado em Requisitos não tem
    implementação UX.
  - Diagnóstico de campo dificultado: operador chama TI dizendo "lista vazia"
    sem detalhe da causa.
  - Disponível em código (`useOperatorsStore.error` tem a mensagem) mas não
    renderizada.
- **Recomendação:**
  - Adicionar em
    [NovaSprint.tsx](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx)
    renderização condicional para `loadStatus === 'error'`: banner em vermelho
    com `error.message` + instrução "Contate o TI" + botão "Tentar novamente"
    (chama `loadOperators` reset).
  - Considerar componente reutilizável `ErrorBanner` para outros casos
    similares.
- **Estimativa de correção:** S (1-2h — adicionar UI condicional + 1 teste).
- **Status:** ✅ RESOLVED (Sessão de correções — 2026-05-27)
- **Resolução:**
  - Componente novo:
    [apps/leader/src/renderer/components/ErrorBanner/ErrorBanner.tsx](apps/leader/src/renderer/components/ErrorBanner/ErrorBanner.tsx)
    (+ `.module.css` + `index.ts`) — banner com `role="alert"`, título, mensagem
    técnica em fonte mono, hint "Contate a TI", botão opcional "Tentar
    novamente".
  - Wire:
    [apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx)
    — subscribe ao `error` da `useOperatorsStore`; quando
    `loadStatus === 'error' && loadError !== null`, renderiza
    `<ErrorBanner message={loadError} onRetry={loadOperators} />` no LUGAR do
    `<OperatorList>` (substituição, não composição — distingue claramente "erro"
    de "lista vazia").
  - Testes de regressão:
    - [apps/leader/src/renderer/components/ErrorBanner/ErrorBanner.test.tsx](apps/leader/src/renderer/components/ErrorBanner/ErrorBanner.test.tsx)
      — 4 testes unit (role/aria, sem onRetry, com onRetry click, onRetry
      async).
    - [apps/leader/src/renderer/routes/NovaSprint/NovaSprint.test.tsx:275-340](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.test.tsx:275)
      — novo describe
      `'NovaSprint — surfacing de erro de carregamento (regressão F-025)'` com 3
      testes: (a) listOperators falha → ErrorBanner com mensagem técnica + hint
      TI + lista genérica suprimida; (b) click "Tentar novamente" invoca
      loadOperators de novo; (c) retry bem-sucedido remove banner e mostra
      OperatorList.
  - Decisão: ErrorBanner criado APENAS no Leader (não compartilhado em código
    entre apps — red line ESLint `apps/leader` não importa de
    `apps/operator-agent`). Para o Agent, F-024 usa state inline no AckButton
    (mesmo padrão UX, escopo cirúrgico). "ErrorBanner compartilhado em padrão,
    não em código".
  - Resumo: UC-01 fluxo alternativo A4 dos Requisitos agora atendido. Leader:
    198 → 205 testes (+7); coverage real subiu para 96.99/94.28/94.02/96.99
    (folga sobre threshold 95/90/90/95).

#### F-018 — `sprint-operator-agent` thresholds 70/65/70/70 muito abaixo do prompt e da realidade

- **Severidade:** Medium
- **Categoria:** 5 (Testes & Cobertura)
- **BL:** BL-C8-001
- **Evidência:**
  - [apps/operator-agent/vitest.config.ts:33-39](apps/operator-agent/vitest.config.ts:33)
    define
    `thresholds: { lines: 70, functions: 70, branches: 65, statements: 70 }`.
    Global, não per-folder.
  - Prompt da auditoria §5 Gate 6 expecta: **services ≥ 90, renderer ≥ 70, tray
    ≥ 60**.
  - CLAUDE.md §7.7.1 declara: `sprint-operator-agent (main): 90/90/85/90` —
    alinhado com prompt, **mas vitest.config.ts não bate com CLAUDE.md** (70 vs
    90 lines).
  - Cobertura real: **97.76/91.47/95.4/97.76** — 27 pontos acima do threshold em
    lines, 26 pontos acima em branches.
- **Impacto:**
  1. **Drift entre CLAUDE.md (declara 90/90/85/90) e config real (70/65/70/70)**
     — doc não confiável.
  2. Threshold subdimensionado permite degradação substancial sem alarme —
     coberture poderia cair de 97% → 71% e ainda passar.
  3. Defesa em profundidade enfraquecida — se uma sessão futura introduzir
     código sem teste, o build não falha até a cobertura colapsar 27 pontos.
  4. Per-folder mandato do prompt (services 90 / renderer 70 / tray 60) não
     enforced — apenas média global.
- **Recomendação:**
  - Subir threshold global para 90/85/90/90 (alinha com CLAUDE.md §7.7.1) —
    passa com folga sobre o real.
  - Considerar threshold per-folder via Vitest
    `coverage.thresholds['src/main/services/**']` para mandato granular.
  - Sincronizar CLAUDE.md §7.7.1 com a config materializada.
- **Estimativa de correção:** S (< 30min — config + docs).
- **Status:** ⏸️ DEFERRED — fix mecânico fora do escopo do Caminho 2; catalogado
  em `TECH_DEBT.md` para próxima sessão tocando vitest.config do Agent.

#### F-012 — `historyService.archive` bypassa `IFilesystemAdapter` (escrita direta com `fs.writeFile`)

- **Severidade:** Medium
- **Categoria:** 3 (Conformidade Arquitetural — ADR-013)
- **BL:** BL-C3-008
- **Evidência:**
  - [apps/operator-agent/src/main/services/historyService.ts:21-23](apps/operator-agent/src/main/services/historyService.ts:21)
    — imports `fs.promises`, `randomBytes`, `path` direto.
  - Linhas 53, 97-108: usa `fs.mkdir`, `fs.writeFile`, `fs.rename`,
    `fs.readdir`, `fs.stat` direto. **NÃO** instancia/recebe
    `IFilesystemAdapter`.
  - ADR-013 §"Consequences": "para que C4 possa ser substituído no futuro (ex:
    por um adapter HTTP) sem mexer em C2/C3" — meta de substituibilidade.
  - Config loaders (Leader `apps/leader/src/main/config.ts` + Agent
    `apps/operator-agent/src/main/config.ts`) também usam fs direto, mas isso
    está **documentado em CLAUDE.md §4** como exceção consciente: "config é boot
    state — uniformizar é débito futuro". `historyService` NÃO tem exceção
    análoga.
- **Impacto:**
  1. Inconsistência interna: pasta compartilhada (`<sharedPath>`) usa adapter;
     histórico local (`<userData>/historico`) usa fs direto.
  2. Substituibilidade do C4 quebrada parcialmente — se houver migração futura
     para adapter HTTP/cloud do histórico, exige refactor.
  3. Padrão atômico está correto (`.tmp` com `randomBytes(6).hex` + rename), só
     não passa pelo port.
  4. Testes de `historyService` mockam `fs.promises` direto via
     `vi.mock('node:fs', ...)` em vez de injetar `MemoryFilesystemAdapter` —
     fricção de teste maior.
- **Recomendação:**
  - Opção A (puro): refatorar `HistoryService` para receber `IFilesystemAdapter`
    no construtor; toda I/O via adapter. Inclui `mkdir`, `writeFileAtomic`,
    `readdir`, `stat`. Testes ficam mais limpos (MemoryFilesystemAdapter).
  - Opção B (documenta exceção): adicionar parágrafo em CLAUDE.md §4 (subseção
    C3) explicitando que `historyService` usa fs direto pelo mesmo motivo dos
    config loaders (local boot state) — alinhar com precedent.
- **Estimativa de correção:** M (2-4h Opção A: refactor + ajuste de testes; S <
  1h Opção B: docs only).
- **Status:** ⏸️ DEFERRED — mesma raiz que F-006/ADR-023 (modelo de persistência
  local). Catalogado em `TECH_DEBT.md`.

#### F-011 — Campo `persistent_popup` do `SprintPayload` é ignorado pelo Agent

- **Severidade:** Medium
- **Categoria:** 2 (Rastreabilidade) — auditoria inversa de campos do schema
- **BL:** BL-C3-004 / BL-C3-005 (overlay behavior)
- **Evidência:**
  - Schema declara o campo:
    [packages/contracts/src/schemas/sprint-payload.schema.ts:27](packages/contracts/src/schemas/sprint-payload.schema.ts:27)
    — `persistent_popup: z.boolean().default(true)`.
  - Requisitos Anexo C documenta o campo com valor `true` no exemplo.
  - **`grep persistent_popup` no Agent retorna apenas testes/fixtures**
    (`packages/fs-adapter/src/integration/roundtrip.test.ts`,
    `packages/contracts/src/__helpers__/arbitraries.ts`, fixtures de payload) —
    zero usos em código de produção do Agent
    ([overlayService.ts](apps/operator-agent/src/main/services/overlayService.ts),
    [pollingService.ts](apps/operator-agent/src/main/services/pollingService.ts),
    [queueService.ts](apps/operator-agent/src/main/services/queueService.ts),
    [SprintCard.tsx](apps/operator-agent/src/renderer/components/SprintCard/SprintCard.tsx)).
  - Comportamento implementado: overlay sempre permanece reabrível via tray menu
    (efetivamente `persistent_popup: true`).
- **Impacto:**
  1. Sprint com `persistent_popup: false` (caso o líder customize) seria
     silenciosamente tratada como `true` — divergência entre schema e runtime.
  2. Defesa em profundidade do schema (`.strict()` rejeita campos extras) é
     parcialmente debilitada — um campo declarado mas não usado é débito
     técnico.
  3. Combinado com F-003 (`show_duration_seconds` também ignorado), evidencia
     padrão: o **schema do `SprintPayload` documenta capacidades de customização
     per-sprint que o Agent não suporta**.
- **Recomendação:**
  - Opção A (alinha com schema): Implementar `persistent_popup` no
    `overlayService` — quando `false`, após o `minimize`, **destruir** a sprint
    do queue (não permitir restoreCurrent) e mover para histórico mesmo sem ack
    do operador.
  - Opção B (remove do schema): Remover `persistent_popup` (com bump de
    `SCHEMA_VERSION` se quebrante) ou marcar como deprecated. Registrar ADR-022
    explicando que "persistent_popup é sempre true em W1+ por design (RN-04)".
  - Em qualquer caso, alinhar Requisitos Anexo C com a decisão final.
- **Estimativa de correção:** S-M (Opção A: 2-4h código + testes; Opção B: 1-2h
  docs + remoção do campo).
- **Status:** ⏸️ DEFERRED — mesma raiz que F-003/ADR-022 (schema declara
  capacidade que Agent não consome). Catalogado em `TECH_DEBT.md`.

#### F-004 — Menu do tray diverge da AC do backlog (itens diferentes; falta "Status da conexão" e "Sair (admin)")

- **Severidade:** Medium
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C3-006 (AC4)
- **Evidência:**
  [apps/operator-agent/src/main/services/trayStateService.ts:119-143](apps/operator-agent/src/main/services/trayStateService.ts:119)
  — menu atual: header (não clicável) + "Mostrar sprint atual" / "Nenhuma sprint
  na fila" + "Histórico local" + "Sobre". Backlog AC4 explícita: "Reabrir último
  aviso", "Status da conexão", "Sobre", "Sair (admin)". **Falta "Status da
  conexão"**; **"Histórico local" foi acrescentado sem estar na AC**; **"Sair
  (admin)" foi removido** (RN-04 — documentado em CLAUDE.md §4 C3 mas sem ADR
  formal).
- **Impacto:**
  - "Status da conexão" ausente: operador não tem feedback explícito sobre
    estado da pasta compartilhada. (Está parcialmente coberto via tooltip do
    tray + cor do ícone, mas não como item de menu.)
  - "Sair (admin)" ausente é desejável (RN-04), mas backlog AC ainda não foi
    atualizado.
- **Recomendação:**
  - Adicionar "Status da conexão" como item de menu (pode reusar `TrayState`
    para exibir state como label, e.g. "Conexão: OK" / "Conexão: pendente").
  - Registrar ADR formal para a remoção do "Sair (admin)" do menu, citando
    RN-04.
  - Atualizar backlog AC4 para refletir a decisão.
- **Estimativa de correção:** S-M (1-3h — adicionar item + ADR + atualização
  docs).
- **Status:** ⏸️ DEFERRED — catalogado em `TECH_DEBT.md` (próxima sessão tocando
  trayService).

#### F-005 — Tray icon sem handler de click esquerdo (não reabre último aviso)

- **Severidade:** Medium
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C3-006 (AC2)
- **Evidência:**
  [apps/operator-agent/src/main/services/trayService.ts:107-111](apps/operator-agent/src/main/services/trayService.ts:107)
  — `new Tray(iconPath)` sem `.on('click', ...)`. Backlog AC2 explícita: "Click
  esquerdo reabre último aviso". Apenas right-click expõe menu de contexto;
  left-click default no Windows ou abre menu ou não faz nada.
- **Impacto:** Operador precisa right-click → "Mostrar sprint atual" — fricção
  extra em ação prevista pela AC como single-click.
- **Recomendação:** Adicionar
  `this.tray.on('click', () => this.actionHandler('show-current'))` em
  trayService.ts após criação do Tray. Garantir reuso do actionHandler já
  injetado.
- **Estimativa de correção:** S (< 1h — 1 linha + teste em integration suite).
- **Status:** ⏸️ DEFERRED — catalogado em `TECH_DEBT.md` (próxima sessão tocando
  trayService — workaround via context menu existe).

#### F-007 — File transport rotacionado (1/dia, 30 dias) prometido em BL-C6-001 mas ausente; drift de numeração BL-C6-\* entre backlog e implementação

- **Severidade:** Medium
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C6-001 (feature) + numeração C6 inteira (drift)
- **Evidência:**
  - Backlog BL-C6-001: "Wrapper sobre Pino com transports configurados para
    arquivo local rotacionado (1 arquivo por dia, retenção 30 dias)."
  - Implementação
    ([packages/logger/src/createLogger.ts](packages/logger/src/createLogger.ts)):
    wrapper Pino com pretty em dev + stdout JSON em prod. **Sem `pino-roll`**,
    sem rotação, sem retenção 30 dias.
  - SESSION_LOG Sessão 17 + CHANGELOG: "BL-C6-003 (file transport com rotação):
    ⏸️ W3 — via pino-roll" — mas backlog define BL-C6-003 como "Logs no Agent"
    (integração). Numeração C6 do projeto não coincide com a do backlog:
    - Backlog: 001 = Pino+rotação, 002 = Logs Leader, 003 = Logs Agent, 004 =
      Diagnostic snapshot
    - Projeto: 001 = Pino wrapper (sem rotação), 002 = integração nos apps, 003
      = file transport + rotação, 004 = Sentry
- **Impacto:**
  1. Feature "file rotation" prometida em BL-C6-001 está ausente do W1; quando o
     Agent for empacotado (sem console visível em produção, per SESSION_LOG
     Sessão 16), **não há log persistido** — impossível diagnosticar problemas
     em campo.
  2. Drift de numeração quebra rastreabilidade — quem ler backlog vê "BL-C6-003
     = Logs no Agent" mas SESSION_LOG/CHANGELOG referem-se a "BL-C6-003 = file
     transport".
- **Recomendação:**
  - Reconciliar numeração: decidir se a fonte é backlog (e renomear no projeto)
    ou se o backlog será atualizado para refletir o split realizado.
  - Para a feature: implementar `pino-roll` em BL-C6-001 ou registrar ADR formal
    de redivisão (Pino wrapper agora; file rotation em BL-C6-002/003 W3) +
    atualizar backlog.
- **Estimativa de correção:** S (1-2h — docs/numeração) + M (2-4h —
  implementação `pino-roll` quando entrar).
- **Status:** ⏸️ DEFERRED — feature (file rotation) é W3 (BL-C6-003 conforme
  projeto). Drift de numeração precisa de grooming com Renan. Catalogado em
  `TECH_DEBT.md`.

### LOW (12)

#### F-021 — `packages/fs-adapter/README.md` está stale ("API completa após F8 desta sessão")

- **Severidade:** Low
- **Categoria:** 8 (Documentação)
- **BL:** débito documental
- **Evidência:**
  [packages/fs-adapter/README.md:24](packages/fs-adapter/README.md:24) — 25
  linhas totais; a última linha diz:
  > API completa após F8 desta sessão.
  - F8 = Fase 8 da Sessão 10 (W0). A fase aconteceu (W0 fechou) e W1 adicionou o
    domain layer inteiro (PendingStore, AckStore, CancelStore stub, ArchiveStore
    stub).
  - README não menciona: domain layer, PendingStore/AckStore APIs,
    NotImplementedError, MemoryFilesystemAdapter, integração com
    `@sprint/contracts`.
- **Impacto:** Devs novos consultam o README e vêem só `NodeFilesystemAdapter` +
  `FileNotFoundError` exemplos básicos. Pra entender PendingStore/AckStore
  precisam ler código direto.
- **Recomendação:** Expandir o README espelhando o padrão de `@sprint/contracts`
  README — princípios, API completa (port + 2 adapters + 4 domain stores),
  tabelas de cobertura, exemplos de uso.
- **Estimativa de correção:** S (1-2h — escrever ~100-150 linhas seguindo o
  template de contracts).
- **Status:** ⏸️ DEFERRED — docs only; catalogado em `TECH_DEBT.md` para próxima
  sessão de docs sweep.

#### F-022 — Naming convention drift entre CLAUDE.md §7.1 (kebab-case) e implementação (camelCase em 4 de 5 packages)

- **Severidade:** Low
- **Categoria:** 7 (Consistência Cross-Package) + 8 (Documentação)
- **BL:** débito documental + consistência
- **Evidência:**
  - CLAUDE.md §7.1 prescreve:
    > | Arquivos TypeScript | `kebab-case.ts` |
  - Implementação real:
    - `@sprint/fs-adapter` usa kebab-case (`pending-store.ts`, `ack-store.ts`,
      `node-adapter.ts`, `read-and-parse.ts`) ✅
    - `@sprint/logger` usa camelCase (`createLogger.ts`, `rootLogger.ts`) ❌
    - `sprint-leader/main/services/` usa camelCase (`dispatchService.ts`,
      `operatorsService.ts`) ❌
    - `sprint-operator-agent/main/services/` usa camelCase (`pollingService.ts`,
      `ackService.ts`, `overlayService.ts`, `queueService.ts`, `trayService.ts`,
      `historyService.ts`) ❌
    - Helpers de teste em camelCase (`tmpFixtures.ts`, `arbitraries.ts`,
      `xssVectors.ts`)
- **Impacto:** Confusão para devs novos lendo CLAUDE.md. Padrão "real" é
  camelCase para .ts services/utils — só fs-adapter é o outlier (kebab-case).
  Sem prejuízo funcional.
- **Recomendação:** Atualizar CLAUDE.md §7.1 para refletir o padrão real:
  > | Arquivos TypeScript (services/utils) | `camelCase.ts` | | Arquivos
  > TypeScript (modules de package) | `kebab-case.ts` (preferência em packages
  > internos) |
  - Ou — se uniformizar é prioridade — renomear `fs-adapter/src/*.ts` para
    camelCase (refactor mecânico).
- **Estimativa de correção:** S (< 30min — atualizar 1 tabela em CLAUDE.md).
- **Status:** ⏸️ DEFERRED — docs only; catalogado em `TECH_DEBT.md`.

#### F-023 — Hierarquias de erro inconsistentes entre pacotes (2 de 5 usam standalone)

- **Severidade:** Low
- **Categoria:** 7 (Consistência Cross-Package)
- **BL:** consistência arquitetural
- **Evidência:**
  - **Pattern abstract + concretas (✅)** em 3 lugares:
    - `@sprint/fs-adapter` —
      [errors.ts:17-98](packages/fs-adapter/src/errors.ts:17):
      `FilesystemError abstract` (com `new.target` runtime enforcement) +
      `FileNotFoundError`, `DirectoryNotFoundError`, `FilesystemIOError`,
      `NotImplementedError`
    - `sprint-leader/main/config.ts` — `ConfigError abstract` + 5 concretas
    - `sprint-operator-agent/main/config.ts` — `ConfigError abstract` + 3
      concretas
  - **Standalone Error (❌)** em 2 lugares:
    - `@sprint/contracts/errors.ts` — `ContractValidationError extends Error`
      (sozinha) + `@sprint/contracts/filenames.ts` —
      `FilenameParseError extends Error` (sozinha) — sem base comum
    - `sprint-leader/main/services/operatorsService.ts` —
      `OperatorsFileNotFoundError extends Error` +
      `OperatorsFileInvalidError extends Error` (sem base comum)
- **Impacto:** Consumers do `@sprint/contracts` não conseguem fazer
  `catch (err) { if (err instanceof ContractsError) ... }` — precisam
  discriminar caso a caso. Mesma fricção em `operatorsService`. Pequena fricção;
  não-bloqueante.
- **Recomendação:** Adicionar abstract base em `@sprint/contracts`
  (`ContractsError abstract extends Error`) com `ContractValidationError` e
  `FilenameParseError` como subclasses. Mesmo padrão para
  `OperatorsFileError abstract` em `operatorsService`. Não exige `new.target`
  enforcement — apenas a hierarquia conceitual.
- **Estimativa de correção:** S (1-2h — refactor + atualizar testes que checam
  `instanceof`).
- **Status:** ⏸️ DEFERRED — refactor cosmético; catalogado em `TECH_DEBT.md`.

#### F-019 — `App.tsx` do operator-agent sem cobertura (0/0/0/0) — falta `App.test.tsx`

- **Severidade:** Low
- **Categoria:** 5 (Testes & Cobertura)
- **BL:** BL-C3-004 (renderer)
- **Evidência:**
  - [apps/operator-agent/src/renderer/App.tsx](apps/operator-agent/src/renderer/App.tsx)
    — entry React do renderer. Orquestra hooks + componente Overlay.
  - Test log (Gate 1 + Gate 6): `App.tsx | 0 | 0 | 0 | 0 | 1-22` — zero
    cobertura.
  - **NÃO existe** `apps/operator-agent/src/renderer/App.test.tsx` (verificado
    via glob no Gate 1).
  - Comparação: `sprint-leader` TEM `App.test.tsx`
    ([apps/leader/src/renderer/App.test.tsx](apps/leader/src/renderer/App.test.tsx))
    com 4 testes.
- **Impacto:**
  - Assimetria entre os 2 apps — Leader tem cobertura do root, Agent não.
  - App.tsx do Agent é thin (orquestra hooks + Overlay), mas zero cobertura
    significa: regressão silenciosa em mount sequence, em order de hook calls,
    em renderização condicional.
  - Hooks individuais (`useIncomingSprint`, `useQueueUpdated`) e componentes
    (`Overlay`, `SprintCard`) têm 100% — só falta o wiring root.
- **Recomendação:** Criar `App.test.tsx` mínimo no operator-agent espelhando o
  do Leader: renderiza, valida que `useIncomingSprint` é chamado (mock), valida
  fallback quando `currentSprint === null`. ~15-20 min de trabalho.
- **Estimativa de correção:** S (< 1h — 1 test file novo).
- **Status:** ⏸️ DEFERRED — agregado do Agent (97.78%) já passa threshold;
  catalogado em `TECH_DEBT.md`.

#### F-016 — CLAUDE.md §12 lista débito `rootDir do Leader` como pendente mas a fix já foi aplicada

- **Severidade:** Low
- **Categoria:** 4 (Type Safety & Code Quality) + 8 (Documentação)
- **BL:** débito documental
- **Evidência:**
  - [apps/leader/tsconfig.json:4](apps/leader/tsconfig.json:4) tem
    `"rootDir": "../.."` — fix aplicada (resolve G-014 — necessário para
    importar `@sprint/contracts` source-first sem TS6059).
  - CLAUDE.md §12 (seção "Débitos técnicos pendentes" → "Débito: `rootDir` do
    Leader em `apps/leader/tsconfig.json`") ainda declara:
    > **Status:** pendente — disparador é o início do BL-C2-007 (integração do
    > `sanitizeBodyHtml`... **Plano:** fix de 1 linha em
    > `apps/leader/tsconfig.json` — `"rootDir": "./src"` → `"rootDir": "../.."`.
  - SESSION_LOG Sessão 15 (Gate 3 BL-C2-007) integrou sanitização no Leader —
    esta foi a sessão onde a fix do `rootDir` provavelmente foi aplicada
    implicitamente (para destravar o `tsc --noEmit`). Mas CLAUDE.md não foi
    atualizado.
- **Impacto:** Confusão para futuros mantenedores — alguém lendo o débito
  acharia que precisa corrigir, mas a fix já está in-place. Desperdiça atenção;
  mina credibilidade da seção de "Débitos pendentes".
- **Recomendação:** Editar CLAUDE.md §12 — mover a entrada de "Débitos técnicos
  pendentes" para uma sub-seção "Débitos resolvidos" OU simplesmente remover (já
  que o gotcha G-014 captura o aprendizado original).
- **Estimativa de correção:** S (< 15min — edit em CLAUDE.md).
- **Status:** ⏸️ DEFERRED — docs only; catalogado em `TECH_DEBT.md` para próxima
  sessão de docs sweep.

#### F-013 — Convenções de naming IPC inconsistentes entre Leader e Agent

- **Severidade:** Low
- **Categoria:** 3 (Conformidade Arquitetural — ADR-009)
- **BL:** BL-C2-001/-007, BL-C3-001/-007 (cross-app)
- **Evidência:**
  - Leader
    ([apps/leader/src/shared/ipc-types.ts:8-12](apps/leader/src/shared/ipc-types.ts:8)):
    documenta convenção camelCase sem prefixo — `ping`, `getConfig`,
    `listOperators`, `dispatchSprint`.
  - Agent
    ([apps/operator-agent/src/main/index.ts:263, 301, 307](apps/operator-agent/src/main/index.ts:263)):
    usa convenção `scope:action` com `:` — `config:get`,
    `sprint:request-current`, `sprint:acknowledge`.
  - ADR-009 (IPC contract-first) não mandata uma convenção; CLAUDE.md tampouco.
- **Impacto:** Cosmético — funciona. Mas dev navegando entre os 2 apps precisa
  lembrar 2 convenções; refactor de busca/grep precisa cobrir os 2 padrões;
  ADR-009 fica menos prescritivo do que poderia.
- **Recomendação:** Decidir uma convenção (sugestão: `scope:action` por ser mais
  expressivo + alinhar com o padrão Electron oficial) e migrar o Leader
  (renomear `getConfig` → `config:get`, etc.). Registrar ADR-022 + atualizar
  CLAUDE.md.
- **Estimativa de correção:** S-M (1-3h — renomeação simétrica em 4 lugares ×
  Leader + tipos + tests).
- **Status:** ⏸️ DEFERRED — cosmético, funcional; catalogado em `TECH_DEBT.md`
  (par F-014 — mesma ADR futura).

#### F-014 — Handlers IPC sem IpcResult envelope: `ping` (Leader) e `sprint:request-current` (Agent)

- **Severidade:** Low
- **Categoria:** 3 (Conformidade Arquitetural — ADR-009 defesa em profundidade)
- **BL:** BL-C2-001 (ping), BL-C3-004 (sprint:request-current)
- **Evidência:**
  - [apps/leader/src/main/ipc.ts:57](apps/leader/src/main/ipc.ts:57):
    `ipcMain.handle('ping', () => 'pong')` — retorna string puro. Justificável
    como smoke test W0.
  - [apps/operator-agent/src/main/index.ts:301-304](apps/operator-agent/src/main/index.ts:301):
    ```ts
    ipcMain.handle('sprint:request-current', (): IncomingSprintEvent | null => {
      if (overlayService === null) return null;
      return overlayService.getCurrentEvent();
    });
    ```
    Retorna `IncomingSprintEvent | null` direto. Sem envelope. Se
    `getCurrentEvent` lançar, vira unhandled em vez de `{ ok: false, error }`.
  - Outros handlers do mesmo app (Agent + Leader) seguem padrão `IpcResult<T>`
    ou discriminated union dedicado (`GetConfigResult`, `ConfigStatusResponse`).
- **Impacto:**
  - `ping`: zero risco — smoke test, sem lógica.
  - `sprint:request-current`: defense in depth quebrada — renderer não
    diferencia "não há sprint atual" (`null`) de "erro no main" (exception).
    Currentemente `getCurrentEvent` não lança, mas é fragil — futura mudança no
    overlayService pode introduzir throw.
- **Recomendação:**
  - `ping`: deletar (era smoke W0) ou converter para `IpcResult<string>`.
  - `sprint:request-current`: envolver em
    `IpcResult<IncomingSprintEvent | null>` — discrimina null de erro.
- **Estimativa de correção:** S (< 1h — refactor pequeno + ajustar consumer no
  renderer).
- **Status:** ⏸️ DEFERRED — catalogado em `TECH_DEBT.md` (par F-013).

#### F-015 — Drift minor de versão do Zod entre packages (contracts 3.23.x, Agent 3.25.0, Leader 3.25.76)

- **Severidade:** Low
- **Categoria:** 3 (Conformidade Arquitetural — versões da stack)
- **BL:** BL-C0-003 (TypeScript paths/configs)
- **Evidência:**
  - `packages/contracts/package.json`: `"zod": "^3.23.0"`
    ([packages/contracts/package.json:30](packages/contracts/package.json:30))
  - `apps/leader/package.json`: `"zod": "^3.25.76"`
    ([apps/leader/package.json:28](apps/leader/package.json:28))
  - `apps/operator-agent/package.json`: `"zod": "^3.25.0"`
    ([apps/operator-agent/package.json:28](apps/operator-agent/package.json:28))
  - pnpm resolve para uma versão única no lockfile (deduplication), mas a
    declaração nominal diverge.
- **Impacto:**
  - Em rebuild do lockfile com `--no-frozen-lockfile`, pode resolver versões
    diferentes em workspaces distintos se as ranges não casarem.
  - Confusão para devs futuros — qual é a versão "canônica" do Zod no projeto?
- **Recomendação:** Unificar para `^3.23.0` (range mais conservadora — segue a
  do `@sprint/contracts`, que é o publisher dos schemas) em todos os
  `package.json`. Alternativa: usar `pnpm.overrides.zod` no root para forçar
  resolução única.
- **Estimativa de correção:** S (< 1h — edição em 2 package.json +
  `pnpm install`).
- **Status:** ⏸️ DEFERRED — lockfile deduplica; cosmético. Catalogado em
  `TECH_DEBT.md`.

#### F-001 — `MemoryFilesystemAdapter` sem API explícita de `injectFailure`/`setLatencyMs`

- **Severidade:** Low
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C4-007
- **Evidência:**
  [packages/fs-adapter/src/memory-adapter.ts:27-164](packages/fs-adapter/src/memory-adapter.ts:27)
  — só helpers `reset()` e `seed()`. Backlog: "Permite simular concorrência,
  falhas, latência." Workaround documentado em CLAUDE.md (seção fs-adapter,
  ~linha 262) usando `vi.spyOn(adapter, 'metodo').mockRejectedValueOnce(err)`.
- **Impacto:** Mínimo — workaround funciona, cobertura 100%. Apenas friccão para
  o usuário do mock que não conhece o workaround.
- **Recomendação:** Manter como Low — workaround documentado em CLAUDE.md cobre
  o caso. Considerar atualizar backlog AC para refletir a abordagem `vi.spyOn`
  (clarificar "Permite simular via spy externa em vez de API embutida").
- **Estimativa de correção:** S (< 1h — docs only).
- **Status:** ⏸️ DEFERRED — workaround documentado; catalogado em
  `TECH_DEBT.md`.

#### F-008 — Logo e cores são 3Studio, não ARTFLEXÍVEIS (backlog BL-C2-002 AC3)

- **Severidade:** Low
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C2-002 (AC3)
- **Evidência:**
  [apps/leader/src/renderer/components/Logo/Logo.tsx](apps/leader/src/renderer/components/Logo/Logo.tsx)
  — SVG com texto "3STUDIO". Accent color `#EBC76A` (CHANGELOG Sessão 15).
  Backlog AC3: "Identidade visual mínima (logo, cores ARTFLEXÍVEIS)". ADR-018
  documenta o redesign mas não justifica explicitamente o uso da marca 3Studio
  em vez de ARTFLEXÍVEIS.
- **Impacto:** Cosmético — produto é interno na ARTFLEXÍVEIS mas exibe marca do
  desenvolvedor (3Studio). Pode ser intencional (3Studio como vendor) ou
  involuntário. Sem ambiguidade prática para operadores que já conhecem o
  contexto.
- **Recomendação:** Confirmar com Renan se a escolha foi intencional (manter
  3Studio como vendor visível) ou se cabe trocar para ARTFLEXÍVEIS. Em qualquer
  caso, atualizar ADR-018 com a justificativa explícita.
- **Estimativa de correção:** S (< 1h — decisão + ADR + eventualmente novo SVG).
- **Status:** ⏸️ DEFERRED — exige confirmação de Renan (3Studio vendor visível
  vs ARTFLEXÍVEIS marca cliente). Catalogado em `TECH_DEBT.md`.

#### F-009 — Deadline no passado: warning inline em vez de "confirmação override" exigida pelo backlog

- **Severidade:** Low
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C2-005 (AC3)
- **Evidência:**
  [apps/leader/src/renderer/components/DeadlineInput/DeadlineInput.tsx:48-53](apps/leader/src/renderer/components/DeadlineInput/DeadlineInput.tsx:48)
  — mostra `<p role="alert">` mas não impede o submit. Backlog BL-C2-005: "não
  pode ser no passado (com confirmação override)" implica step explícito de
  confirmação. US-01.03: "Valor não pode ser anterior ao horário atual (com
  alerta opcional para forçar)" é mais lenient e bate com a implementação.
- **Impacto:** Mínimo — operador vê warning explícito (`role="alert"`) e Agent
  ignora deadline passado de toda forma (RN-11 / pollingService.ts:191).
  Conflito é apenas entre formulações do backlog (AC) vs US — implementação
  favorece a US.
- **Recomendação:** Atualizar backlog BL-C2-005 AC3 para alinhar com US-01.03
  ("warning sem bloqueio") — implementação atual é consistente com US.
- **Estimativa de correção:** S (< 1h — docs only — atualizar backlog).
- **Status:** ⏸️ DEFERRED — alinhamento docs com US-01.03. Catalogado em
  `TECH_DEBT.md`.

#### F-010 — Botão de ack labelado "Recebi" em vez de "OK, entendi" (backlog BL-C3-005 AC3 + US-02.02)

- **Severidade:** Low
- **Categoria:** 1 (Backlog Compliance)
- **BL:** BL-C3-005 (AC3) + US-02.02
- **Evidência:**
  [apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx](apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx)
  usa label "Recebi". Backlog BL-C3-005: "Botão 'OK, entendi' no overlay fecha
  antes do timeout". US-02.02 AC: "Botão 'OK, entendi' disponível para
  fechamento antecipado".
- **Impacto:** Cosmético — semântica é equivalente; "Recebi" pode ser inclusive
  mais conciso e claro em pt-BR.
- **Recomendação:** Trocar label do botão para "OK, entendi" para alinhar com
  backlog + US, OU atualizar ambos para "Recebi". Decisão de UX/copywriting com
  Renan.
- **Estimativa de correção:** S (< 1h — 1 string + decisão UX).
- **Status:** ⏸️ DEFERRED — decisão UX/copywriting com Renan. Catalogado em
  `TECH_DEBT.md`.

---

## Recomendação para a sessão de correções

### Caminho 1: Mínimo para qualificar ✅ PRONTO PARA W2 (~3h)

Reduz High count de 5 para ≤ 3:

| Ordem | Finding                       | Esforço   | Ação                                                                                                                                                       |
| ----- | ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **F-002** (skipTaskbar)       | S (5min)  | Alterar `false` → `true` em [overlayService.ts:239](apps/operator-agent/src/main/services/overlayService.ts:239). Build + smoke.                           |
| 2     | **F-020** (pnpm audit HIGH)   | S (15min) | Adicionar `"tmp": "^0.2.6"` ao `pnpm.overrides` em [package.json:40](package.json:40). Re-rodar `pnpm install` + `pnpm audit`.                             |
| 3     | **F-017** (Leader thresholds) | S (30min) | Adicionar `coverage.thresholds` em [apps/leader/vitest.config.ts:11](apps/leader/vitest.config.ts:11) (sugestão: 95/90/90/95). Atualizar CLAUDE.md §7.7.1. |

**Veredito após fix:** 2 High remanescentes (F-003, F-006) — qualifica como ✅
PRONTO PARA W2.

### Caminho 2: Recomendado para entrar em W2 com Highs zerados (~1-2 dias)

Inclui todos os 5 High + 3 Medium de maior impacto:

#### Bloco A — Quick wins (Caminho 1 acima — ~3h)

- F-002, F-020, F-017

#### Bloco B — UX silent failures (~1h)

Defesa em profundidade no renderer, antes da W2 trazer mais features.

| Ordem | Finding           | Esforço             | Ação                                                                                                                                                                           |
| ----- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4     | **F-024 + F-025** | M (2-3h combinados) | Criar componente `ErrorBanner` compartilhado em ambos os apps. AckButton inspeciona `moved_to_history === false`. NovaSprint renderiza `useOperatorsStore.status === 'error'`. |

#### Bloco C — Decisões arquiteturais (Renan-dependentes, ~3-4h)

| Ordem | Finding                                   | Esforço    | Ação                                                                                                                                                                                       |
| ----- | ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5     | **F-003** (timer source)                  | M (2h)     | Renan decide: A (usa `show_duration_seconds` do payload) ou B (mantém `minimize_after_seconds` config + remove campo do schema). Registrar **ADR-022**. Implementar. Atualizar Requisitos. |
| 6     | **F-011** (persistent_popup)              | S (1h)     | Mesma decisão de F-003 (mesma raiz). Opção A (implementar) ou B (remover do schema com SCHEMA_VERSION bump).                                                                               |
| 7     | **F-006** (paths userData vs ProgramData) | M-L (2-4h) | Renan decide: A (refactor para ProgramData — exige admin no installer W3) ou B (manter userData + atualizar Requisitos Anexo B). Registrar **ADR-023**.                                    |

**Veredito após Caminho 2:** 0 Critical, 0 High, 5 Medium remanescentes — ✅
**PRONTO PARA W2** com folga.

### Caminho 3: Aspiração (~3-4 dias, todos os 25 findings)

Bloco D — Test infra (~1h):

- F-018 (Agent thresholds — alinhar com CLAUDE.md 90/90/85/90)
- F-019 (criar `App.test.tsx` no agent)

Bloco E — Consistency + IPC (~2-3h):

- F-013 + F-014 — ADR-024 padronizando IPC naming + envelope
- F-023 — abstract base errors em contracts + operatorsService

Bloco F — Docs sweep (~2-3h, PR único):

- F-007 — reconciliar numeração BL-C6 (com Renan)
- F-008 — ADR-018 update justifica logo 3Studio vs ARTFLEXÍVEIS
- F-016 — remover débito stale `rootDir` de CLAUDE.md §12
- F-021 — expandir fs-adapter README
- F-022 — atualizar CLAUDE.md §7.1 (camelCase ≠ kebab-case)

Bloco G — Cosmético + observabilidade (~1-2h):

- F-001 — atualizar wording AC BL-C4-007
- F-004 — adicionar "Status da conexão" no tray menu + ADR-022 para "Sair"
  oculto
- F-005 — wire left-click no Tray
- F-009 — atualizar AC BL-C2-005 para alinhar com US-01.03
- F-010 — decisão UX label "Recebi" vs "OK, entendi"
- F-012 — refactor historyService para usar IFilesystemAdapter (OU documentar
  exceção)
- F-015 — uniformizar versão Zod (override)

### Estimativa de tempo total

| Caminho                         | Tempo     | Veredito resultante                                               |
| ------------------------------- | --------- | ----------------------------------------------------------------- |
| Mínimo (3 High)                 | ~3h       | ✅ PRONTO PARA W2 (3 High remanescentes documentados como débito) |
| Recomendado (5 High + 2 Medium) | ~1-2 dias | ✅ PRONTO PARA W2 (0 High, 5 Medium remanescentes)                |
| Aspiração (todos 25)            | ~3-4 dias | ✅ PRONTO PARA W2 (0 findings)                                    |

### Ordem sugerida considerando dependências

```
Sessão 1 (correções W1 — Bloco A + B):
├── F-002 ──┐
├── F-020 ──┼──► smoke + commit "fix(C3,C8): ..."
├── F-017 ──┘
└── F-024 + F-025 ──► commit "feat(C2,C3): ErrorBanner UX"

Sessão 2 (decisões arquiteturais — Bloco C):
├── ADR-022 (Renan + Auditor) ──► F-003 + F-011 reconciliados
└── ADR-023 (Renan + Auditor) ──► F-006 + F-012 reconciliados

Sessão 3 (sweep — Blocos D + E + F + G):
└── ~2-3h docs sweep + IPC consistency
```

---

## Itens fora de escopo da correção

Findings que **parecem** bloqueadores mas são **legitimamente pendência da
W2/W3/W4** conforme SESSION_LOG + CLAUDE.md. **NÃO bloqueiam W2.**

| Finding                                                     | Razão para estar fora de escopo da correção                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-007** (file rotation) — porção implementação            | A FEATURE de file rotation é deferida para W3 (BL-C6-003 conforme numeração do projeto). **Apenas o drift de numeração precisa de reconciliação agora** (pequena edição em backlog/SESSION_LOG).                                                |
| Console.\* no Agent (8 ocorrências)                         | **Não é finding** — débito explicitamente documentado em CLAUDE.md §12 "Débitos técnicos pendentes" + ADR-020. Refactor sistemático em BL-C6-002 W3 com slot de injeção já pronto (`PollingLogger`, `AckLogger`, `HandleAckLogger` interfaces). |
| Auto-start do Agent (RF-19, RN-11)                          | Deferido para BL-C5-003 W3. Manual launch + smoke real validados em Sessão 16 Gate 8.5.                                                                                                                                                         |
| Ack tracking no Leader (RF-10)                              | Deferido para BL-C2-008 W2.                                                                                                                                                                                                                     |
| Cancelamento de sprint                                      | Deferido para BL-C2-009 / BL-C3-009 / BL-C3-011 / BL-C4-004 W2.                                                                                                                                                                                 |
| Customização de texto da sprint (RF-13, US-01.04)           | Deferido para BL-C2-006 W2.                                                                                                                                                                                                                     |
| Consulta de histórico via UI (RF-15)                        | Deferido para BL-C2-010 W3.                                                                                                                                                                                                                     |
| Som de notificação (RF-14)                                  | Deferido para BL-C3-014 W3.                                                                                                                                                                                                                     |
| Retry com backoff em SMB down (RNF-07)                      | Deferido para BL-C3-013 W3.                                                                                                                                                                                                                     |
| `vi.spyOn` em vez de injectFailure no MemoryAdapter (F-001) | Workaround documentado em CLAUDE.md §4 (fs-adapter). Decisão consciente em ADR-021. Não-bloqueante.                                                                                                                                             |
| E2E Playwright                                              | Deferido para BL-C8-004 W3.                                                                                                                                                                                                                     |
| Husky pre-commit (BL-C8-006)                                | Deferido para W3.                                                                                                                                                                                                                               |
| Code signing (BL-C0-008)                                    | Deferido para W3.                                                                                                                                                                                                                               |

---

## Apêndice C — Validação final do report

| Item                                                                                 | Status                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------- |
| Arquivo `AUDIT_W1_pre_W2.md` criado na raiz                                          | ✅                                            |
| 10 categorias preenchidas (sem TBD)                                                  | ✅                                            |
| Todo finding tem ID único `F-NNN`                                                    | ✅ F-001 a F-025 (zero gaps, zero duplicates) |
| Todo finding tem severidade, categoria, evidência, impacto, recomendação, estimativa | ✅                                            |
| 20 BLs W1 na matriz Backlog Compliance                                               | ✅                                            |
| Matriz Rastreabilidade cobre RF/RN/RNF/US e UCs                                      | ✅                                            |
| 20 cenários do Gate 9 (E2E) documentados                                             | ✅                                            |
| 20 cenários do Gate 10 (edge cases) documentados                                     | ✅                                            |
| Veredito final declarado (✅/⚠️/❌)                                                  | ✅ ⚠️ AVANÇAR COM RESSALVAS                   |
| Lista priorizada para correções                                                      | ✅ 3 caminhos (mínimo/recomendado/aspiração)  |
| Zero modificação em código de produção/testes/docs (exceto `AUDIT_W1_pre_W2.md`)     | ✅                                            |
| Output dos comandos baseline disponível                                              | ✅ em `.audit-tmp/*.log`                      |

---

**FIM DA AUDITORIA.**

**Mode:** adversarial. **Goal alcançado:** 25 findings documentados com
evidência reproduzível antes da W2 começar.

---

## Itens fora de escopo da correção

_TBD — Gate 12. Listará findings que são esperadamente pendência da W2/W3._

---

## Apêndice A — Outputs brutos dos comandos baseline

Os outputs completos dos 5 comandos foram capturados em `.audit-tmp/`:

- `.audit-tmp/typecheck.log` — output de `pnpm type-check` (exit 0).
- `.audit-tmp/lint.log` — output de `pnpm lint` (exit 0).
- `.audit-tmp/build.log` — output de `pnpm build` (exit 0).
- `.audit-tmp/test.log` — output de `pnpm test:coverage` (exit 0).

Os 3 documentos `.docx` foram extraídos para markdown em:

- `.audit-tmp/backlog.md` (1427 linhas).
- `.audit-tmp/requisitos.md` (874 linhas).
- `.audit-tmp/stack.md` (913 linhas).

Essas extrações são usadas pela auditoria como representação textual dos `.docx`
originais — os `.docx` permanecem intocados (red line §10 do prompt). A pasta
`.audit-tmp/` é artefato de auditoria, não código de produção.

---

## Apêndice B — Estrutura do repositório auditada (Gate 1)

```
sprint-dispatcher/
├── apps/
│   ├── leader/                      # C2 — Leader (Electron 42)
│   │   ├── build/                   # buildResources (ícones do instalador)
│   │   └── src/
│   │       ├── main/                # main process (composition root, ipc, services)
│   │       ├── preload/             # context bridge
│   │       ├── renderer/            # React UI
│   │       └── shared/              # tipos IPC compartilhados main↔renderer
│   └── operator-agent/              # C3 — Operator Agent (Electron 42 tray-resident)
│       ├── build/                   # buildResources + tray.ico
│       └── src/
│           ├── main/                # main process (services, handlers)
│           ├── preload/
│           ├── renderer/
│           └── shared/
├── packages/
│   ├── contracts/                   # C1 — schemas Zod + sanitizer + helpers
│   │   └── src/
│   │       ├── __fixtures__/        # fixtures de schemas
│   │       ├── __helpers__/         # arbitraries fast-check + xssVectors
│   │       └── schemas/             # *.schema.ts por contrato
│   ├── fs-adapter/                  # C4 — port + Node + Memory adapters + domain layer
│   │   └── src/
│   │       ├── __helpers__/         # arbitraries + tmpFixtures
│   │       ├── __tests__/           # contract suite compartilhada
│   │       ├── domain/              # PendingStore, AckStore, stubs Cancel/Archive
│   │       └── integration/         # parity + roundtrip cross-package
│   └── logger/                      # C6 — Pino wrapper
│       └── src/
└── (sem .github/ no listing W1 — confirmar Gate 8)
```

Sub-pastas excluídas do snapshot: `node_modules/`, `dist/`, `dist-electron/`,
`coverage/`, `.turbo/`, `release/`.

---

## Histórico de correções

### 2026-05-27 — Sessão de correções pós-auditoria W1 (Caminho 2)

**Tipo:** corretivo, mutativo. **Escopo:** Critical+High+UX-Medium do plano
aprovado. **Veredito antes:** ⚠️ AVANÇAR COM RESSALVAS (5 High > 3). **Veredito
depois:** ✅ PRONTO PARA W2 (0 Critical, 2 High DEFERRED ≤ 3).

#### Findings RESOLVED nesta sessão (5)

| ID    | Severidade | Resumo do fix                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-020 | High       | `pnpm.overrides.tmp: ^0.2.6` em [package.json:42](package.json:42). `pnpm audit --audit-level=high` agora exit 0 (1 HIGH eliminado; 3 moderate restantes — `esbuild` + `vite` × 2 — são build-time only, fora deste finding).                                                                                                                                                      |
| F-017 | High       | `coverage.thresholds: { lines: 95, functions: 90, branches: 90, statements: 95 }` em [apps/leader/vitest.config.ts:29](apps/leader/vitest.config.ts:29). CLAUDE.md §7.7.1 atualizado. Real 96.99/94.28/94.02/96.99 — folga.                                                                                                                                                        |
| F-002 | High       | `skipTaskbar: false → true` em [overlayService.ts:239](apps/operator-agent/src/main/services/overlayService.ts:239). +2 testes regressão F-002 em [overlayService.test.ts:443-478](apps/operator-agent/src/main/services/overlayService.test.ts:443) (TDD-style: teste falhou antes do fix, passou após).                                                                          |
| F-024 | Medium     | State `warning` em [AckButton.tsx](apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx) quando `result.data.moved_to_history === false`. Renderiza `<p role="status">` com mensagem específica. +4 testes regressão.                                                                                                                                               |
| F-025 | Medium     | Novo componente [ErrorBanner](apps/leader/src/renderer/components/ErrorBanner/ErrorBanner.tsx) (tsx + module.css + index + 4 testes unit). Wire em [NovaSprint.tsx:139-143](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx:139): renderiza condicional quando `loadStatus === 'error'`. +3 testes regressão (UC-01 fluxo alternativo A4 dos Requisitos agora atendido). |

#### Findings DEFERRED (20) — catalogados em `TECH_DEBT.md`

- **Renan-dependentes (2 High):** F-003 (timer source — ADR-022), F-006
  (per-user vs all-users paths — ADR-023).
- **Medium não-bloqueantes (6):** F-004 (tray menu), F-005 (tray left-click),
  F-007 (BL-C6 numbering + file rotation W3), F-011 (persistent_popup — par
  F-003), F-012 (historyService bypass — par F-006), F-018 (Agent thresholds
  subdimensionados).
- **Low cosméticos/docs (12):** F-001, F-008, F-009, F-010, F-013, F-014, F-015,
  F-016, F-019, F-021, F-022, F-023. Maioria são docs sweep ou decisões de
  Renan.

#### Findings NOVOS descobertos nesta sessão

Nenhum (zero) — o escopo de cada batch foi cirurgicamente respeitado.

#### Validação consolidada (Gate 6)

| Métrica                | Baseline (auditoria, 2026-05-27) | Pós-correções (mesma data) | Delta                      |
| ---------------------- | -------------------------------- | -------------------------- | -------------------------- |
| `pnpm install`         | ✅                               | ✅ "Already up to date"    | OK                         |
| `pnpm type-check`      | ✅ 7/7                           | ✅ 7/7                     | OK                         |
| `pnpm lint`            | ✅ 5/5                           | ✅ 5/5                     | OK                         |
| `pnpm build`           | ✅ 5/5                           | ✅ 5/5                     | OK                         |
| `pnpm format:check`    | ✅                               | ✅                         | OK                         |
| `pnpm -r test`         | 1056 verdes                      | **1069 verdes**            | **+13** regressão          |
| `pnpm audit ≥high`     | 1 HIGH + 3 moderate              | **0 HIGH** + 3 moderate    | **−1 HIGH** ✅             |
| Leader coverage        | 96.89/94.51/93.84/96.89          | 96.99/94.28/94.02/96.99    | OK (threshold 95/90/90/95) |
| Agent coverage         | 97.76/91.47/95.4/97.76           | 97.78/91.57/95.4/97.78     | OK                         |
| Packages 100%          | contracts/fs-adapter/logger      | mantido                    | OK                         |
| `any` em produção      | 0                                | 0                          | OK                         |
| `@ts-ignore` em geral  | 0                                | 0                          | OK                         |
| `console.log` em geral | 0                                | 0                          | OK                         |

#### Plano descartado nesta sessão

- **Caminho 3 (todos 25 findings):** rejeitado pelo Renan (Caminho 2 escolhido
  via AskUserQuestion). Os 20 findings deferidos respeitam decisão estratégica
  ou são docs sweep — todos catalogados em `TECH_DEBT.md`.

#### Próximo passo recomendado

✅ **Wave 2 — iniciar.** Caminho recomendado pelo Backlog: BL-C4-004
(writeCancel removendo stub) + BL-C2-009 (UI de cancelamento) + BL-C3-009
(cancel handler no Agent). Trazer F-003 / F-006 em paralelo via sessão dedicada
de ADR (Renan + Auditor) quando convergir o cronograma da W2.
