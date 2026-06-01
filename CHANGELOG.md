# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Added — Sessão 48 (2026-06-01) — W3 · C3 (Operator Agent) CONCLUÍDO — BL-C3-013 + BL-C3-014

Fecha o componente C3 (Operator Agent) — seus 2 itens restantes da Wave 3. C3
100% concluído (sem itens em W4). Decisão em [ADR-027](DECISIONS.md).

**BL-C3-013 — Reconexão à pasta compartilhada com backoff (`apps/operator-agent`):**

- O Agent sobrevive à queda temporária do servidor de arquivos. Máquina de
  estados de conexão no MAIN sobre o polling: classifica o throw do `listPending`
  (via `cause.code`, **sem método novo no C4**) como queda de conectividade; em
  queda entra em `disconnected` com **backoff exponencial 5s → 10s → 30s → 60s**
  (cap 60s, +jitter ±10%), sonda o share a cada tick e, ao reconectar, retoma o
  intervalo normal e processa a fila acumulada. Desambiguação de
  `DirectoryNotFound` sondando a raiz do share (`adapter.exists`).
- **Tray vermelho/verde** + tooltip + item "Status da conexão" (última conexão
  HH:MM). Ícones de status gerados sem dependências
  (`scripts/generate-tray-icons.mjs` → `build/tray-{gray,yellow,red,green}.png`).
- **Boot resiliente:** o Agent sobe mesmo com o share fora e conecta sozinho
  quando ele volta — `loadConfig` deixou de validar a acessibilidade do
  `shared_path` (virou condição de runtime).
- Transições logadas via `@sprint/logger` (1º uso no Agent): warn na borda,
  debug nos retries, info ao reconectar.

**BL-C3-014 — Som de notificação opcional (`apps/operator-agent`):**

- Ao exibir o overlay (exibição inicial), toca um tom curto (~480ms) via Web
  Audio se `config.som_notificacao === true`. Não toca na reabertura via tray;
  **fail-safe** (falha de áudio não afeta o overlay). Seam documentado para
  trocar por um asset `.wav`/`.ogg` próprio.

**Infra:** `@sprint/logger` adicionado ao Agent;
`pino`/`pino-pretty`/`thread-stream` externalizados no build do main (G-020).

**Testes:** Agent 297 → **354**. Gates verdes
(format/type-check/lint/test/build). Changeset criado.

### Added — Sessão 47 (2026-06-01) — W3 · C2 (Leader) CONCLUÍDO — BL-C2-010 + BL-C2-012

Fecha o componente C2 (Leader) — seus 2 itens restantes da Wave 3. C2 100%
concluído (sem itens em W4). Decisão em [ADR-026](DECISIONS.md).

**BL-C2-010 — Tela de Histórico (`apps/leader`):**

- Rota `/historico` funcional: filtros (data na fonte; operador/líder
  client-side), lista de **rodadas agrupadas por `sprint_id`** com resumo de
  status, e **detalhe read-only** (modal) com metadados + corpo do aviso
  (`body_html` re-sanitizado, §7.9) + lista de targets reaproveitando o
  componente de status do Acompanhamento (`<TargetStatusList>`, extraído).
- Novos handlers IPC tipados `listArchive`/`readArchivedSprint` (fs só no MAIN,
  inputs validados com Zod) → `ArchiveService` que consome
  `ArchiveStore.listArchive/readArchivedSprint` (C4). Store `useArchiveStore`
  (filtros/lista/seleção + derivações puras). `date-fns`/`ptBR` +
  `lucide-react` adicionados ao Leader.

**BL-C2-012 — Gate de permissão do líder (`apps/leader`):**

- Botão "Disparar" desabilitado + mensagem clara + "Verificar novamente" quando
  o usuário Windows não tem escrita em `pending/`. Handler IPC `canDispatch` →
  `PermissionService` (probe via adapter C4) + log do resultado com o usuário
  Windows via `@sprint/logger` (primeiro uso no Leader). Store
  `usePermissionStore`.

**`@sprint/fs-adapter` (toque aditivo, BL-C2-012):**

- `probeWritePermission(dirpath)` na `IFilesystemAdapter` — probe write+unlink
  (real no `NodeFilesystemAdapter` com cleanup garantido; configurável no
  `MemoryFilesystemAdapter`). Aditivo, não quebra consumidores.

**Testes:** Leader 280 → **348**; fs-adapter 382 → **394**. Gates verdes
(format/type-check/lint/test/build). Changeset criado.

### Added — Sessão 45 (2026-06-01) — W3 · BL-C0-008 Code Signing

Primeiro item da Wave 3 (Production Readiness): infraestrutura de assinatura
Authenticode + verificação para os 2 EXEs. Estratégia de confiança: cert
auto-assinado da ARTFLEXÍVEIS + distribuição via GPO ($0, sem CA paga) —
[ADR-024](DECISIONS.md).

**electron-builder (`apps/*/electron-builder.yml`, bloco `win:`):**

- `rfc3161TimeStampServer` (timestamping RFC 3161) + `signingHashAlgorithms: [sha256]`
  em **ambos** os apps. Chaves **top-level** (electron-builder 24.x, não
  `signtoolOptions` — G-027). `CSC_LINK`/`CSC_KEY_PASSWORD` do ambiente — zero
  segredo hardcoded.

**Workspace `@sprint/release-tools` (`scripts/`, novo, privado):**

- `pfx-secret.mjs` — decode base64 → arquivo + cleanup idempotente (helper puro,
  **unit-testado 100%**); `prepare-signing-cert.mjs` — glue do `release.yml`
  (`prepare`/`cleanup`).
- `generate-signing-cert.ps1` (+ `.sh` openssl) — gera `.pfx` (privado) + `.cer`
  (público/GPO); `verify-signature.ps1` — distingue _assinado_ vs _confiável_,
  exit ≠ 0 se não-assinado; `sign-local.ps1` — validação local em 1 processo.
- 20 testes (12 do helper + 8 de asserção de config dos YAML).

**CI:**

- `.github/workflows/release.yml` (novo) — tag `v*.*.*` + dispatch,
  `windows-latest`: build → decode do Secret → assina → **verifica** → upload →
  **cleanup do PFX em `if: always()`**. Pontos de `# TODO(BL-C0-009)`.
- `CSC_IDENTITY_AUTO_DISCOVERY=false` nos builds não-release (ci/build-leader/
  build-agent) — PR/branch builds não assinam nem veem Secrets.

**Scripts npm (raiz):** `cert:gen`, `build:signed`, `sign:local`,
`verify:signature`. **Docs:** `docs/guides/code-signing.md` (runbook GPO/AD CS),
ADR-024, gotcha G-027.

> **Contrato de Secrets:** `WINDOWS_CERT_PFX_BASE64` + `WINDOWS_CERT_PASSWORD`.
> O `.pfx`/senha nunca entram no Git (`.gitignore`: `.certs/`, `*.pfx`).
> **Pendente (BL-C0-009):** publish/version/notify — bloqueado por BL-C5-005.

### Added — Sessão 43 (2026-05-28) — Leader W2 + writeCancel

Encerra o C2 (Leader) na Wave 2 com 4 BLs entregues em commits atômicos
e a fundação `writeCancel` no fs-adapter. Marco: **ciclo de cancelamento
ponta-a-ponta funcionando** (Leader escreve `cancel-*.json` → Agent já
mergeado em BL-C3-011 detecta e fecha overlay sem ack).

**`@sprint/fs-adapter` (BL-C4-004):**

- `CancelStore.writeCancel(cancel)` real (substitui stub
  `NotImplementedError`). Escrita atômica de
  `<sharedPath>/pending/cancel-<sprintId>.json` espelhando o padrão de
  `PendingStore.writePendingSprint`.
- `PendingStore` opcional no construtor — quando injetado, `writeCancel`
  lista pendings da sprint e deleta idempotentemente (race-safe:
  `FileNotFoundError` silenciado quando Agent processou primeiro).
- `WriteCancelResult` ganha `removedOriginals: readonly string[]`.
- Re-validação Zod via `parseSprintCancel` (defesa em profundidade).

**`sprint-leader` — BL-C2-006 (customização de título; título-only):**

- `useSprintComposerStore`: `setTitle` action; selector propaga `title`
  para o IPC.
- `composerFormSchema`: valida `title` (1..80; vazio bloqueia o dispatch).
- `DispatchSprintRequest`: campo `title?` opcional.
- `DispatchService`: helper exportado `resolveTitle` (trim + fallback
  default `'É hora de correr'`). Corpo do aviso usa template fixo do
  sistema (`BODY_TEMPLATE` com `{meta}`) — NÃO é customizável.
- Input de título inline no header da NovaSprint (`maxLength={80}`).

> **Nota (descopo, AUD-W2-007):** o commit `0b01ec3` simplificou o
> BL-C2-006 para título-only, removendo o `<MessageCustomizer>` (campo de
> corpo + preview + `body_template` + `resolveBodyTemplate`). Decisão de UX
> aprovada por Renan; o corte de corpo/preview (item "Should" entregue
> parcialmente) deve ser refletido no backlog externo.

**`sprint-leader` — BL-C2-008 (tela de acks):**

- `AckTrackingService.list(sprintId, targets)` no main: agrega
  `AckStore` + `OperatorsService`, devolve `AckStateView[]`. Estados
  derivados do Anexo D (3 estados). Trata `DirectoryNotFoundError` de
  `acks/` como benigno.
- IPC `listAcks` com envelope `IpcResult<ListAcksResponse>`.
- `useTrackedSprintStore` (Zustand): persiste sprint disparada na sessão.
- `NovaSprint.handleDispatchClick` popula store quando
  `result.summary.success > 0`.
- `Acompanhamento.tsx` funcional: empty state, summary + lista de
  targets com 3 estados (cinza/laranja/verde + timestamp), polling 3s
  com cleanup no unmount.

**`sprint-leader` — BL-C2-009 (cancelamento):**

- `CancelService.cancel(request)` monta `SprintCancel` (Anexo E:
  `sprint_id_ref`, `cancelado_por` do config, `cancelado_em` ISO,
  `motivo` opcional trimmed). Validação via `parseSprintCancel`
  (sprint_id inválido → `ContractValidationError`).
- IPC `cancelSprint` com envelope `IpcResult<CancelSprintResponse>`.
- `CancelStore` instanciado em `rebuildDeps` recebendo `pendingStore`.
- `useTrackedSprintStore` estendido: `cancelled: boolean` +
  `markCancelled()` + `selectIsSprintActive`.
- `<CancelSprintButton />`: botão destrutivo + modal de confirmação com
  textarea motivo opcional. Click no backdrop fecha; submitting
  desabilita botões; sucesso marca cancelled; erro inline `role="alert"`.
- `Acompanhamento` integra: botão visível enquanto sprint ativa, some
  quando `cancelled`; polling para automaticamente.

### Tests — Sessão 43 (contagens corrigidas — AUD-W2-006)

Medições reais em `develop` (docs antigas alegavam Leader 332):

- fs-adapter: 308 verdes.
- Leader: **280** verdes (o commit `0b01ec3` removeu o `<MessageCustomizer>`
  e ~25 testes; BL-C2-006 ficou título-only).
- Agent: 298 verdes (chegou a 298 nas Sessões 21-42 do C3).
- ui-kit: 60 verdes.

### Changed — Sessões 35-42 (2026-05-28) — Refino visual coordenado do Overlay

11 micro-iterações sobre o mesmo escopo, guiadas por screenshots do
Renan vs imagem-alvo. Sequência consolidada (veja SESSION_LOG.md para
detalhamento por commit):

**ui-kit `<Overlay>`:**

- `.card` max-width 520 → 480 → 560 (proporção retangular final).
- `.body` padding `space-7` (uniforme) → `space-6 vertical /
  space-8 lateral` → `space-7 vertical / space-10 lateral` (mais
  respiração interna, elementos se aproximam horizontalmente).
- `.header` padding vertical `space-4` → `space-5`.
- `.title` font-weight `medium` → `light` (300).
- `.acknowledgeButton` font-size `lg` → `xl`; font-weight `bold`
  → `light` (300).
- Token `--sprint-color-surface-subtle` #111 → #0a0a0a (header bar
  ainda mais sutil sobre body preto puro).

**Agent body slot:**

- `.metricRow` `align-items: flex-start` → `last baseline` (resolve
  bloco de horário caindo abaixo de "Artes" por gap de line-height
  do `.valueBig`).
- `.deadlineGroup` column flex-end → flex-start ("Até" alinhado à
  esquerda do bloco direito; matching imagem).
- `.deadlineLabel` font-size `lg` (era 3xl pré-redesign).
- `.deadlineValue` font-size `3xl` → `2xl`; font-weight `bold` →
  `medium`.
- `.sprintBody` gap `space-5` → `space-3` (elementos mais juntos).
- `.unit` "Artes", `.label` "Suas metas", `.deadlineLabel` "Até":
  todos padronizados em font-weight `light` (300).
- `.dateBadge` font `base` → `sm`; padding horizontal `space-3` →
  `space-4` (laterais mais largas).
- ackLabel default "Recebi" → "RECEBIDO".

### Added — Sessões 35-42 (2026-05-28)

- **Inter Google Fonts weight 300** no import de `tokens.css` (era
  400+).
- **Token `--sprint-font-weight-light: 300`** — padrão para labels
  muted no design system.
- **Tokens `--sprint-space-9: 36px` e `--sprint-space-10: 40px`** —
  continuação monotônica da escala 4px para chrome generoso.

### Fixed — Sessões 35-42 (2026-05-28)

- **`pnpm dev` na raiz**: 3-camada fix do race no `dist/` do ui-kit.
  Remove `predev` do Agent (race com `@sprint/ui-kit#dev` paralelo);
  adiciona `predev` na raiz (`pnpm --filter @sprint/ui-kit build`);
  `emptyOutDir: !isWatchMode` no `ui-kit/vite.config.ts` (watch não
  esvazia mais o dist/ no startup).
- **Cores do Leader**: `.dispatchButton:disabled` em
  `NovaSprint.module.css` tinha `rgba(235, 199, 106, 0.35)` hardcoded
  (amarelo antigo). Trocado para `rgba(245, 165, 87, 0.35)` (RGB do
  laranja `#f5a557` unificado).

### Changed — Sessão 34 (2026-05-28) — Polish final do overlay matching design-alvo

Renan: "Apenas ajuste os detalhes... border radius, peso de fonte,
espaçamento e tudo mais. Deixe exatamente igual para eu não precisar
mexer e está aprovado." Ajustes finos:

**ui-kit `<Overlay>`:**

- `.title` font-weight `regular` → `medium` (500). Presença visual
  mais firme matching design.
- `.header` padding vertical `space-5` → `space-4`. Header bar mais
  fina.
- `.acknowledgeButton` font-weight `semibold` → `bold` (700). Peso
  firme do CTA "Recebido".

**Agent body slot:**

- `.metricGroup` gap `space-3` → `space-4`. Mais respiração entre
  "20" e "Artes".
- `.dateBadge` compacto: font `base` → `sm`; padding `space-2/space-4`
  → `space-1/space-3`. Badge "27/05" matching tamanho do design.

### Changed — Sessão 32 (2026-05-28) — Overlay mais estreito + header bar "subtle"

Renan validou Sessão 31 e reportou 2 ajustes finos no Overlay:

- **`.card` `max-width: 720px` → `520px`** — Renan: "ficou um pouco
  largo demais comparado com a imagem que tinha te enviado". Proporção
  mais quadrada/portrait matching o design.
- **Header bg `--surface-elevated` (#2A) → `--surface-subtle` (#111)**
  — Renan: "o fundo onde está escrito 'É hora de correr' deve ser um
  pouco mais escuro, apenas um tom acima do preto mesmo". Diferenciação
  sutil em vez de bar visualmente proeminente.

### Added — Sessão 32 (2026-05-28)

- **Token `--sprint-color-surface-subtle: #111111`** em `tokens.css`
  — entre `background-deep` (#000) e `surface` (#222). Reservado para
  áreas que precisam se diferenciar SUTILMENTE do background-deep sem
  chamar atenção (header bar do Overlay).

### Changed — Sessão 31 (2026-05-28) — Overlay matchando design 'Hora do Rush!'

Renan: "Agora precisamos arrumar somente a overlay, ela está muito
diferente e precisa ficar exatamente igual ao design que estou te
enviando." Refactor em duas camadas:

**ui-kit · `<Overlay>` chrome:**

- `.card` background `--sprint-color-background` → `--background-deep`
  (preto puro). Sem padding direto; `overflow: hidden` clipa o bg do
  header nos cantos arredondados.
- `.header` ganha background `--sprint-color-surface-elevated` (#2A2A2A)
  + padding próprio. Substitui o `border-bottom` por contraste de
  superfícies. Matching "bar" cinza médio sobre body preto do design.
- `.body` ganha padding próprio.
- `.acknowledgeButton` perde `width: 100%`, ganha `margin: 0 space-6
  space-6` + `border: none` + `cursor: pointer` — respiração visual
  entre body e botão.

**Agent · `<Overlay>` body slot:**

- Refactor completo do `SprintBody`. Estrutura nova matching imagem:
  metricRow (value 4xl + unit "Artes" baseline | "Até" + "HH:MMh"
  coluna) + footerRow (✓ + "Suas metas" | "DD/MM" badge).
- Remove do body slot: `<DeadlineBadge>`, `<QueueIndicator>`,
  `<TextBlock>` com `body_html`, bloco "META" gigante laranja.
  Componentes preservados (podem ser reusados em telas futuras).
- Helpers locais `formatDeadline` + `formatDate` duplicados do PillApp
  (promover para `utils/` quando 3º consumer aparecer).
- `DottedCheckIcon` local — SVG inline duplicado do `<Pill>` do
  ui-kit.
- Hardcoded: label "Suas metas" + unit "Artes" (débito a resolver em
  W3+ com bump de `schema_version` no SprintPayload).

**Tests:** 298 verdes no Agent (estável); 60 verdes no ui-kit
(estável). `Overlay.test.tsx` atualizado para cobrir nova estrutura.

### Changed — Sessão 30 (2026-05-28) — Pill se extende linearmente em ambas dimensões

Renan reportou após Sessão 29 que a animação seguia "dando um salto,
crescendo primeiro pra baixo e depois pras laterais". Root cause das
sessões 27-29: só `padding` + `min-width` animavam, mas o reflow do
conteúdo (`inline-flex row` → `flex column`) era INSTANTÂNEO quando o
React trocava `CompactContent` por `ExpandedContent`. Fix:

- **`max-height` adicionado à transição** — `.pill` ganha
  `max-height 480ms cubic-bezier(0.4, 0, 0.2, 1)` na lista (mesma
  curva/duração de padding/min-width). `overflow: hidden` já existente
  clipa o conteúdo enquanto o container cresce.
- **`.pill--compact { max-height: 56px }`** — clipa o `ExpandedContent`
  no frame zero da transição.
- **`.pill--expanded { max-height: 200px }`** — generoso para acomodar
  o layout 2-rows com folga.
- **`will-change`** atualizado para `padding, min-width, max-height`.
- **Animações de content emerge removidas** — `.compactLayout` e
  `.expandedLayout` não têm mais `animation: pill-content-emerge`. O
  conteúdo é revelado puramente pelo crescimento do container; sem
  fade/translate paralelo. Remove também o keyframe e o bloco
  `@media (prefers-reduced-motion)` do content layout.

Resultado: pill cresce em 3 dimensões simultaneamente
(altura/largura/padding) com curva Material single-rate. Conteúdo
emerge de cima pra baixo conforme a altura cresce, sem salto.

### Changed — Sessão 29 (2026-05-28) — Animação smooth + layout refinado do Pill

_(Animação parcialmente superseded pela Sessão 30 — `max-height` foi
adicionado e content animations removidas. Layout/cor da Sessão 29
preservados.)_

Renan reportou após Sessão 28 que a curva luxe + stagger ainda dava
sensação "primeiro cresce pra baixo, depois pro lado levemente". Pediu
também refino do layout (compact mais largo + menos alto; expanded
matching imagem 2) e cor preto puro. Mudanças:

- **Animação smooth single-rate** — `cubic-bezier(0.4, 0, 0.2, 1)`
  (Material standard "fast out, slow in") substitui luxe
  `(0.19, 1, 0.22, 1)`. Duração 480ms container (era 620ms) + 280ms
  content emerge (era 460ms). **Sem stagger** — `animation-delay`
  140ms → 0ms. Container e conteúdo crescem em paralelo, sem ordem
  perceptível. Keyframe translateY 8px → 4px (sutil).
- **Layout compact** — padding `space-3 / space-5` →
  `space-2 / space-6` (12/20 → 8/24px). Mais largo, menos alto.
- **Layout expanded** — padding `space-4 / space-6 / space-5` →
  `space-3 / space-6 / space-4`. `min-width` 280 → 320px.
  `.metricGroup` `flex-direction: column` → `row` com
  `align-items: baseline` — "20 Artes" em linha (matching imagem 2).
  `.unit` sem `margin-top`. `.expandedLayout` `gap` `space-4` →
  `space-3`.
- **Cor preto puro** — `.pill` background
  `--sprint-color-background-deep` (#000000, novo token semântico em
  `tokens.css`) substitui `--sprint-color-background` (#1A1A1A).
  Máximo contraste sobre o backdrop translúcido.

### Added — Sessão 29 (2026-05-28)

- **Token `--sprint-color-background-deep`** em `tokens.css` — preto
  puro `#000000` reservado para superfícies sobre backdrop translúcido
  onde precisa de máximo contraste com o desktop atrás.

### Changed — Sessão 28 (2026-05-28) — Curva luxe na animação compact ↔ expanded

_(Superseded pela Sessão 29 — sequência ainda parecia travada. Histórico
preservado.)_

- **Easing extra-suave** no `<Pill>` — `cubic-bezier(0.19, 1, 0.22, 1)`
  substitui `cubic-bezier(0.32, 0.72, 0, 1)` (iOS canonical).
- **Duração estendida** — container transition 480ms → 620ms; content
  emerge 360ms → 460ms.
- **Stagger maior no content emerge** — `.expandedLayout`
  `animation-delay` 80ms → 140ms.
- **Keyframe translateY** 6px → 8px.

### Changed — Sessão 27 (2026-05-28) — Refino animação compact ↔ expanded

- **Easing iOS canônica** no `<Pill>` — `cubic-bezier(0.32, 0.72, 0, 1)`
  substitui `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out expo). Decelera
  ainda mais suavemente, percepção "natural" sem jerk. _(Superseded
  pela Sessão 28; histórico preservado.)_
- **Duração mais "considerada"** — container transition 360ms → 480ms;
  content emerge 280ms → 360ms. _(Superseded pela Sessão 28.)_
- **Crescimento horizontal mais pronunciado** — `.pill--expanded`
  min-width 220 → 280px + padding horizontal `--sprint-space-5` →
  `--sprint-space-6`. Crescimento lateral mais visível (Renan reportou
  "cresce pro lado bem de leve").
- **Stagger no content emerge** — `.expandedLayout` ganha
  `animation-delay: 80ms`. _(Superseded por 140ms na Sessão 28.)_
- **Feedback tátil no click** — `.pill:active { transform: scale(0.97) }`
  com transition transform 140ms ease-out. Operador percebe haptic
  visual ao pressionar.
- **`will-change: padding, min-width`** — promove layer GPU durante
  transição, animação mais suave em dispositivos intermediários.
- **Content emerge translateY** 4px → 6px. _(Superseded por 8px na
  Sessão 28.)_
- Todas as mudanças respeitam `prefers-reduced-motion: reduce`.

### Fixed — Sessão 26 (2026-05-28)

- **Overlay ainda com fundo dark uniforme** — Sessão 25 colocou
  `transparent: true` na BrowserWindow + ThemeProvider override, mas
  o `body` continuava `background: var(--sprint-color-background)`
  (dark) bloqueando a transparência. Fix: `main.tsx` adiciona
  `body.overlay-mode` quando não é pill window; `global.css` regra
  combinada `body.overlay-mode` + `body.pill-mode` → transparent.
  Operador vê APENAS o card central.
- **"Suas metas" quebrando linha no compact** — `.label` do `<Pill>`
  ganha `white-space: nowrap`. Pill expande horizontalmente conforme
  necessário.
- **Animação compact ↔ expanded tosca/bouncy** — substitui
  `cubic-bezier(0.34, 1.4, 0.64, 1)` (spring overshoot) por
  `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out expo, sem overshoot).
  Duração 320ms → 360ms. Adiciona content fade-in animation 280ms
  no `.compactLayout`/`.expandedLayout` — conteúdo entra com slide
  pequeno (translateY 4px → 0) em vez de "pop" abrupto. Respeita
  `prefers-reduced-motion: reduce`.

### Added — Sessão 26 (2026-05-28)

- **Drag horizontal da pill** — operador pode arrastar pill para
  esquerda/direita; BrowserWindow do pill se reposiciona via IPC
  para acompanhar cursor (clampado às bordas do display primário,
  sem feedback loop graças ao uso de `screen.X` absoluto). Mecanismo:
  - `pillService` ganha `beginDrag(screenX)` / `dragTo(screenX)` /
    `endDrag()` / `isDragging()`.
  - IPC `pill:begin-drag`, `pill:drag-to`, `pill:end-drag`.
  - `Api.pill.beginDrag/dragTo/endDrag` em ipc-types + preload.
  - `<Pill>` aceita `onPointerDown`/`Move`/`Up`/`Cancel` props
    (mudança no ui-kit).
  - `PillApp` substitui `onClick` por pointer event handlers.
    Threshold de 5px distingue click puro (sem movimento → toggle
    expand) de drag real (movimento > threshold → IPC drag, sem
    toggle). `setPointerCapture` garante eventos contínuos.
  - `touch-action: none` no `.pill` (ui-kit) — browser não interfere
    com gestos default durante drag.

### Notes — Sessão 26

- Total testes: ui-kit 60 estável; Agent 283 → 297 (+14 drag).
- `setPointerCapture`/`releasePointerCapture` stubs em PillApp.test.tsx
  beforeAll (jsdom não implementa nativamente). Helper
  `firePointerEvent` usa `createEvent` + `Object.defineProperty(event,
  'screenX', ...)` porque jsdom ignora `screenX` no init dict.
- 2 changesets: `c9-pill-pointer-events-refine.md` (ui-kit minor) +
  `c3-overlay-transparent-drag.md` (Agent minor).

### Fixed — Sessão 25 (2026-05-28)

- **Pill canvas com retângulo dark em volta** — `ThemeProvider.module.css`
  do ui-kit aplica background dark no `.themeProvider` div, pintando
  todo canvas 340×160 do BrowserWindow do pill. Fix: PillApp passa
  `className="transparent-theme"` ao ThemeProvider; `global.css` define
  `.transparent-theme { background: transparent }`. Pill window agora
  mostra APENAS a pill.
- **Overlay com backdrop dark cobrindo a tela** — `overlayService`
  adiciona `transparent: true` no BrowserWindow; App.tsx passa
  `className="overlay-transparent-theme"`; `global.css` sobrescreve
  `--sprint-color-backdrop` para `transparent` no escopo da div. O
  override propaga via CSS cascade para o `.overlay` do ui-kit. Operador
  vê APENAS o card central; apps abaixo permanecem visíveis ao redor.

### Added — Sessão 25 (2026-05-28)

- **`<Pill>` prop `position`** no `@sprint/ui-kit` — aceita
  `'left' | 'center' | 'right' | number` (0-100 percent). Atalhos
  para 0/50/100% + percent contínuo. Pill refatorada em 3 spans
  (positioner + entrance + button) para separar transform inline da
  animação. Pattern paralelo ao `<OverlayMinimized>`.
- **Animações fluidas** no `@sprint/ui-kit`:
  - Overlay `.card`: entrance `overlay-card-enter` 420ms cubic-bezier
    expo (fade + slide do topo + scale 0.96→1).
  - Overlay `.acknowledgeButton`: pulse infinito 2400ms no glow do
    shadow — chama atenção sutil.
  - Pill `.pillEntrance`: `pill-enter` 480ms cubic-bezier expo (slide
    + fade quando aparece).
  - Pill `.pill`: transitions compact↔expanded com cubic-bezier(0.34,
    1.4, 0.64, 1) — overshoot pequeno spring imersivo. Duração 320ms
    (era 250ms ease-in-out).
  - Todas respeitam `@media (prefers-reduced-motion: reduce)`.

### Notes — Sessão 25

- Total testes: ui-kit 53 → 60 (+7 do prop position). Agent 283 estável.
- `.pill-positioner` no global.css mudou de flex para `position:
  relative` (contexto de absolute para a `<Pill>`).
- 2 changesets: `c9-pill-position-animations.md` (ui-kit minor) +
  `c3-transparent-canvas.md` (Agent minor).

### Changed — Sessão 24 (2026-05-28) — Redesign pill standalone

- **Novo componente `<Pill>` no `@sprint/ui-kit`** — standalone (sem
  bar full-width), cantos inferiores arredondados / topo reto. Props
  `label`/`value`/`unit?`/`deadline?`/`date?`/`expanded?`/`onClick?`.
  CSS transition 250ms entre compact ↔ expanded. `<OverlayMinimized>`
  mantido exported para retrocompat (não usado em produção).
- **Pill window do Operator Agent** encolhe de full-screen-width × 100
  → 340×160 transparent top-center. Áreas vazias do canvas são
  transparentes; apps abaixo permanecem visíveis/clicáveis.
- **Click no pill NÃO reabre overlay** — alterna entre compact e
  expanded puramente local no renderer. Overlay fullscreen aparece
  APENAS em dispatch novo via polling. Elimina bug "não consigo
  fechar a overlay novamente" reportado.
- **Auto-collapse após 5s** sem novo click — `useEffect` agenda
  `setTimeout` quando expanded vira true; cleanup cancela em re-click,
  unmount, ou push de nova sprint.

### Removed — Sessão 24 (2026-05-28)

- **`Api.pill.expand`** IPC + handler `ipcMain.handle('pill:expand')`.
- **`pillService.hideWindow()` / `showWindow()` / `getFullPayload()`**
  (split temporário da Sessão 23 não precisa mais existir).
- Wires associados em `main/index.ts` — `overlay:close-reopened` não
  chama mais `pillService.showWindow()`; `handleReopenLast` não chama
  mais `pillService.hideWindow()`.

### Notes — Sessão 24

- `PillCurrentInfo` ganha campo `deadline_at` (ISO-8601) — renderer
  formata para "HH:MMh" no expanded.
- pillService API simplificada para 6 métodos: `show`/`dismiss`/`hide`
  (alias)/`getCurrent`/`isShown`/`destroy`.
- Total testes: ui-kit 39 → 53 (+14 do `<Pill>`); Agent 283 estável
  (-3 deletados de hideWindow/showWindow +3 novos cobrindo redesign).

### Fixed — Sessão 22 (2026-05-28)

- **CSS bundle do `@sprint/ui-kit` não era carregado pelo Agent em
  produção.** Vite library mode extrai CSS para
  `dist/assets/style.css`; consumidores recebiam só JS sem importar o
  CSS bundled. Fix: `packages/ui-kit/package.json#exports` ganha
  `"./styles.css"` apontando para o bundle; `apps/operator-agent/src/
  renderer/main.tsx` adiciona `import '@sprint/ui-kit/styles.css'` como
  side-effect. Bundle CSS do Agent: 2.45 kB → 9.51 kB (+7 kB).

### Added — Sessão 22 (2026-05-28) — BL-C3-017 pill orchestration

- **BL-C3-017** — `PillService` (novo em
  [pillService.ts](apps/operator-agent/src/main/services/pillService.ts))
  gerencia BrowserWindow dedicada do pill (badge minimizado do
  `@sprint/ui-kit` — `<OverlayMinimized>`) que aparece após "Recebi"
  quando a fila esvazia. Wire em
  [handleAck.ts](apps/operator-agent/src/main/handlers/handleAck.ts):
  next === null → `overlayService.hide()` + `pillService.show(payload)`;
  next !== null → `overlayService.showSprint(next)` +
  `pillService.hide()`. `queueService.onNextSprint` também esconde pill
  (nova sprint eclipsa). Click no pill via IPC `pill:expand` reabre
  overlay fullscreen no modo BL-C3-009 reopen.
- **PillApp.tsx** + roteamento por `?pill` em `main.tsx` — mesma
  index.html carregada em 2 BrowserWindows; query param distingue qual
  root React montar. `body.pill-mode { background: transparent }` para
  canvas do pill window não cobrir apps atrás.
- **IPC API `window.api.pill`** com `requestCurrent` (pull no mount),
  `expand` (click → reabre overlay), `onUpdate` (push para trocas de
  sprint sem destruir janela).
- **+29 testes**: pillService 18 (estado, show/hide/destroy, push update,
  isShown), PillApp 7 (render, push, click, cleanup), handleAck 4 (wire
  do pill — queue vazia/cheia, backward compat, payload correto).
- Total Agent: 240 (Sessão 21) → 269 verdes.

### Added — Sessão 21 (2026-05-28) — Refinamento C3 (Operator Agent) na W2

- **BL-C3-012** — Sprint com `deadline_at` no passado é arquivada localmente
  via `historyService.archive()` sem exibir overlay e sem ack de
  visualização. Fallback `markProcessed` em falha de archive preserva dedup
  em memória. +3 testes em [pollingService.test.ts](apps/operator-agent/src/main/services/pollingService.test.ts).
- **BL-C3-010** — `QueueService.enqueue` ordena por `payload.criado_em` (ISO
  ascendente, `Date.parse` timezone-aware). Empate FIFO. Invariante crítica:
  `items[0]` (sprint atualmente exibida) preservada de preempção. +8 testes.
- **BL-C3-009** — Reabertura via tray ("Reabrir último aviso") lê último
  `.json` válido em `<userData>/historico/<dia>/`. Caminhos separados de
  ack: `reopenFromHistory` sem timer, sem touch em currentItem; renderer
  ramifica botão para "Fechar" via `IncomingSprintEvent.reopened?`. Novo IPC
  `overlay:close-reopened`. Tray item enabled iff `kind === 'idle'`. +30
  testes (historyService 11, trayState 4, overlayService 10, AckButton/
  Overlay 5).
- **BL-C3-011** — `PollingService.processCancel` substitui stub; `listPending`
  sem filter userId (cancels broadcast); sprints de outros operadores
  filtradas inline em `processSprint`. `queueService.removeBySprintId` +
  `overlayService.hide()` se exibida + archive cancel + delete shared.
  `overlayService?` injetado em `PollingDeps`. +15 testes (pollingService 8,
  queueService 7).

### Changed — Sessão 21 (2026-05-28)

- **BL-C3-015** — Overlay do renderer refatorado para consumir `@sprint/ui-kit`
  (`<Overlay>` + `<TextBlock>` + `<ThemeProvider>`). Window management
  permanece no main (overlayService.createWindow). `autoCloseSeconds={0}`
  no `<Overlay>` do ui-kit: main process é única fonte do timer
  (`overlayService.minimizeAfterMs`). Label dinâmico: "Confirmando…"
  (loading), "Fechar" (reopened), "Recebi" (normal). Componentes deletados:
  `AckButton` e `SprintCard` (funcionalidade subsumida pelo novo `Overlay.tsx`).
  Preservados: `DeadlineBadge`, `QueueIndicator` (reused no body slot).
- **BL-C3-016** — Identidade visual via `<ThemeProvider>` do ui-kit. Tokens
  locais (`--color-*`, `--space-*`, `--font-size-*`, `--radius-*`) removidos
  de `global.css`; CSS modules de Overlay/DeadlineBadge/QueueIndicator
  migrados para `--sprint-*`. Meta gigante usa `--sprint-font-size-4xl`
  (120px, tier canônico do C9; antes 160px local). `min-width: 140px`
  (DeadlineBadge) e `max-width: 1200px` (Overlay) removidos — content-
  driven + card do ui-kit limita 720px. Audit: 0 hex/px hardcoded fora de
  comentários.

### Notes — Sessão 21

- 240 testes verdes no Agent (199 W1 → 240 W2; +41 novos). Lint + type-check
  + build clean.
- 6 changesets em `.changeset/c3-XXX-*.md` para sprint-operator-agent (minor).
- 7 commits separados na branch `feature/BL-C3-w2-refinamento`.
- Próxima sessão sugerida: C2 (Leader) na W2 + BL-C4-004 (writeCancel) —
  fecha cancelamento ponta-a-ponta.

### Fixed

<!-- ↓↓↓ Sessão 19 (2026-05-27) — Correções pós-auditoria W1 (Caminho 2) ↓↓↓ -->

- **Sessão de correções pós-auditoria W1 (`AUDIT_W1_pre_W2.md`)** —
  Caminho 2 (Mínimo + UX). 5 dos 25 findings RESOLVED; 20 DEFERRED
  catalogados em novo `TECH_DEBT.md`. Veredito da auditoria muda de ⚠️
  AVANÇAR COM RESSALVAS para ✅ **PRONTO PARA W2**. Total monorepo: 1056 →
  **1069 testes verdes** (+13 regressão). `pnpm audit --audit-level=high`
  agora exit 0 (1 HIGH eliminado).
- **F-020 (High):** `pnpm.overrides.tmp: ^0.2.6` em
  [package.json:42](package.json:42). Elimina o advisory HIGH
  `tmp <0.2.6` (Path Traversal, GHSA-ph9p-34f9-6g65) na cadeia
  `apps/leader > electron-builder > app-builder-lib > @malept/flatpak-bundler
> tmp-promise > tmp`. 3 moderate restantes (`esbuild`, `vite` × 2) são
  build-time only — fora do escopo F-020.
- **F-017 (High):** `coverage.thresholds: { lines: 95, functions: 90,
branches: 90, statements: 95 }` materializados em
  [apps/leader/vitest.config.ts:29](apps/leader/vitest.config.ts:29).
  Coverage real 96.99/94.28/94.02/96.99 passa com folga. CLAUDE.md §7.7.1
  atualizado: tabela troca `n/a` por valores; parágrafo final substituído
  com nota da sessão pós-auditoria.
- **F-002 (High):** `skipTaskbar: false → true` em
  [overlayService.ts:239](apps/operator-agent/src/main/services/overlayService.ts:239)
  — alinha com backlog BL-C3-004 AC4 e snippet do CLAUDE.md §8.2. +2 testes
  regressão F-002 via `expect.objectContaining({ skipTaskbar: true })` no
  mock BrowserWindow ([overlayService.test.ts:443-478](apps/operator-agent/src/main/services/overlayService.test.ts:443)).
  TDD-style: teste FALHOU antes do fix, passou após.
- **F-024 (Medium):** State `warning` em
  [AckButton.tsx](apps/operator-agent/src/renderer/components/AckButton/AckButton.tsx) —
  quando `result.data.moved_to_history === false`, mostra `<p role="status">`
  com mensagem específica do failure de archive. Warning não-bloqueante (ack
  já foi escrito). Nova classe CSS `.warning` em AckButton.module.css. +4
  testes regressão F-024 cobrindo: moved_to_history=false → warning visible;
  moved_to_history=true → sem warning; warning persiste com button disabled;
  warning some após remount via key.
- **F-025 (Medium):** Novo componente
  [ErrorBanner](apps/leader/src/renderer/components/ErrorBanner/ErrorBanner.tsx)
  (tsx + module.css + index + 4 testes unit) — banner role="alert" com
  título, mensagem técnica em mono, hint TI, botão opcional retry. Wire em
  [NovaSprint.tsx:139-143](apps/leader/src/renderer/routes/NovaSprint/NovaSprint.tsx:139)
  — renderiza condicional substituindo `<OperatorList>` quando
  `loadStatus === 'error'`. **Atende UC-01 fluxo alternativo A4** dos
  Requisitos ("Pasta compartilhada inacessível: Sistema exibe erro de
  conexão e instrui contato com TI"). +3 testes regressão F-025.

### Added — Sessão 19 (2026-05-27)

- **`TECH_DEBT.md`** novo na raiz — catálogo estruturado dos 20 findings
  DEFERRED da auditoria com gatilho/bloqueio/estimativa/recomendação por
  entrada. Agrupa findings por padrão temático (Renan-dependentes, UX
  silent, persistência local, IPC inconsistency, test infra subdimensionada,
  docs lag).
- **`.audit-tmp/` adicionado ao `.prettierignore`** — artifacts da auditoria
  pré-W2 (extrações .docx em markdown + outputs de comandos baseline) não
  devem ser reformatados.

### Notes — Sessão 19

- 20 findings DEFERRED em `TECH_DEBT.md`:
  - **High Renan-dependentes (2):** F-003 (timer source — ADR-022), F-006
    (per-user vs all-users paths — ADR-023).
  - **Medium (6):** F-004 (tray menu), F-005 (tray left-click), F-007
    (BL-C6 numbering + file rotation W3), F-011 (persistent_popup — par
    F-003), F-012 (historyService bypass — par F-006), F-018 (Agent
    thresholds).
  - **Low (12):** F-001, F-008, F-009, F-010, F-013, F-014, F-015, F-016,
    F-019, F-021, F-022, F-023.
- Veredito atualizado: ✅ **PRONTO PARA W2**. Próxima sessão recomendada:
  W2 começando por BL-C4-004 + BL-C2-009 + BL-C3-009 (ciclo de
  cancelamento).
- Zero findings NOVOS descobertos durante a sessão de correções — escopo
  cirurgicamente respeitado.

<!-- ↑↑↑ Sessão 19 ↑↑↑ -->

### Added

<!-- ↓↓↓ Sessão 18 (2026-05-27) — W1.C8 inteiro: testes ampliados — FECHA W1 ↓↓↓ -->

- **`@sprint/contracts` — suíte ampliada para production-grade** [BL-C8-002,
  Sessão 18]:
  - `fast-check@^3.20.0` como devDependency.
  - **`src/__helpers__/arbitraries.ts`** — 8 arbitraries reutilizáveis
    (`ulidArbitrary`, `userIdArbitrary`, `isoDatetimeArbitrary`,
    `semverArbitrary`, `sprintPayloadArbitrary`, `sprintAckArbitrary`,
    `sprintCancelArbitrary`, `agentConfigArbitrary`).
  - **`src/__helpers__/xssVectors.ts`** — 21 vetores XSS adversariais
    curados em 5 categorias (mutation, encoding, polyglot, unicode,
    combining) com `reason` documentando cada ataque defendido.
  - **`src/sanitize.test.ts`** expandido de 40 → 80 testes (+40):
    21 vetores XSS iterados via `it.each` + 4 properties universais
    (`<script` ausente, `javascript:` ausente, `on*=` ausente,
    idempotência — 50 runs cada) + 6 unicode edge cases + 3 inputs
    gigantes (10MB) + variantes vazias/control.
  - **`src/ids.property.test.ts`** (novo, 9 testes) — 1000 IDs
    sequenciais únicos, 100 paralelos via `Promise.all`, properties
    `isValidUlid` ↔ `ulidArbitrary`.
  - **`src/filenames.property.test.ts`** (novo, 16 testes) — 3 roundtrip
    properties (100 runs) + 3 cross-discriminação (50 runs) + edge
    cases userId.
  - **`src/schemas/property.test.ts`** (novo, 22 testes) — 8 properties
    (parse + JSON roundtrip para 4 schemas) + 13 asserts sobre mensagens
    de erro Zod específicas como API pública (`ULID`, `não pode ser
    vazio`, `[a-z0-9_-]`, `ISO 8601`, `MAJOR.MINOR.PATCH`, `>= 1`,
    `<= 60`).
  - Thresholds elevados em `vitest.config.ts`: **98/95/98/98** (era
    95/90/95/95). Cobertura real: **100/100/100/100**.
  - **Total: 230 → 317 testes (+87) em 14 arquivos.**
- **`@sprint/fs-adapter` — suíte ampliada com cenários adversariais,
  paridade Node↔Memory e roundtrip cross-package** [BL-C8-003, Sessão 18]:
  - `fast-check@^3.20.0` como devDependency.
  - **`src/__helpers__/arbitraries.ts`** — `posixPathArbitrary`,
    `ulidArbitrary`, `userIdArbitrary` (cópia local — `@sprint/contracts`
    não expõe subpath `__helpers__/*` por design de production API).
  - **`src/__helpers__/tmpFixtures.ts`** — `setupTmpShared(label)` cria
    `<tmp>/pending,acks/` para integration tests.
  - **`src/node-adapter.adversarial.test.ts`** (novo, 10 testes — 3
    skipped no Windows) — concorrência 10 escritas, 10MB+ZWJ family,
    **handle.close() catches (lines 50-51 e 63-64) cobertos via
    `vi.mock` de `node:fs/promises.open`**, permission revoked Linux/mac.
  - **`src/domain/pending-store.adversarial.test.ts`** (novo, 12 testes)
    — 10 writePendingSprint concorrentes, mtime ordering com `fs.utimes`
    real, race de pasta removida, cenário "mistura 8 arquivos" (3
    sprint + 2 cancel + 1 invalid + 1 .tmp + 1 junk + 1 ack errado).
  - **`src/domain/ack-store.adversarial.test.ts`** (novo, 7 testes) —
    overwrite progressivo 3× (UC de re-exibição W2), 10 acks
    concorrentes, cenário "mistura 6 arquivos".
  - **`src/integration/parity.test.ts`** (novo, 18 testes — 9 × 2
    adapters) — matriz `describeParity(label, factory)` cross-adapter
    para PendingStore, AckStore, CancelStore stub, ArchiveStore stub
    contra Node real FS + Memory mock.
  - **`src/integration/roundtrip.test.ts`** (novo, 12 testes — cross-
    package) — 3 properties (50 runs cada): writePendingSprint →
    listPending preserva campos; AckStore idem; filtro userId universal.
    3 testes sanitização end-to-end (`<script>`/`onerror`/clean
    preservado). 3 testes unicode (acentos+emoji, ZWJ family, 1900
    chars). 3 testes end-to-end Node real FS.
  - **Subiu `node-adapter.ts` de 97.74% → 100% lines** via mock de
    `FileHandle.close()` rejeitando (lines 50-51 e 63-64 — catches
    defensivos em path de erro e em finally de path de sucesso).
  - Thresholds elevados em `vitest.config.ts`: **95/95/95/95** (era
    95/90/95/95). Cobertura real: **100/99.53/100/100**.
  - **Total: 235 → 294 testes (+59; 291 passing + 3 skipped no Windows)
    em 15 arquivos.**
- **ADR-021** em `DECISIONS.md` — Expansão da suíte de testes para
  production-grade na W1.C8. Documenta 10 decisões (fast-check como
  devDep, curadoria XSS, arbitraries em `__helpers__`, nota arquitetural
  sobre subpath não-exposto do contracts, thresholds elevados, matriz
  de paridade, roundtrip com `safeSprintPayloadArbitrary`, adversarial
  separation, `it.runIf` Linux/macOS, cobertura defensiva via `vi.mock`)
  + política de bug-discovery + 4 alternativas rejeitadas (Stryker,
  subpath exports, numRuns: 200+, modificar Memory adapter).
- 2 changesets gerados (`contracts-test-expansion.md`,
  `fs-adapter-test-expansion.md` — ambos `patch`).

### Notes — Sessão 18

- **WAVE 1 OFICIALMENTE FECHADA.** 6 sessões executadas (13 → 18); 4
  pacotes (contracts, fs-adapter, logger, + workspace setup) e 2 apps
  (Leader, Operator Agent) em production-grade.
- Pendências W3+: BL-C8-004 (Playwright E2E), BL-C8-006 (Husky
  pre-commit), BL-C8-007 (GitHub Actions CI dedicado de cobertura).
- Próxima wave (W2) — cancelamento, acompanhamento de acks, custom
  title/body, re-exibição, countdown.

<!-- ↑↑↑ Sessão 18 ↑↑↑ -->

<!-- ↓↓↓ Sessão 17 (2026-05-27) — W1.C6 inteiro: @sprint/logger ↓↓↓ -->

- **`@sprint/logger` — pacote novo** (`packages/logger/`) [BL-C6-001,
  Sessão 17]:
  - **`createLogger(name, options?)`** — factory de logger nomeado.
    Dev (`NODE_ENV !== 'production'`) sem `destination` ativa
    `pino-pretty` em worker thread; prod emite JSON estruturado em
    `process.stdout`. Com `options.destination` (testes), sempre JSON
    síncrono no stream fornecido.
  - **`rootLogger()`** — singleton lazy com `name === 'root'`,
    pensado para boot do app e fatal handlers globais.
  - **Tipos públicos**: `Logger`, `LogLevel`, `LoggerOptions`,
    `ChildBindings`. API estreita por design — barrel exporta 6
    símbolos (Pino expõe ~30 métodos; expomos 7).
  - **Configuração via env vars**: `NODE_ENV` (dev/prod) +
    `LOG_LEVEL` (case-insensitive, ignorado se inválido).
    Precedência: `options.level` > `LOG_LEVEL` > default por
    `NODE_ENV` (`'debug'` em dev, `'info'` em prod).
  - **Wrapper opaco em torno do Pino** — `wrap(pinoInstance, name)`
    esconde `trace`, `silent`, `flush`, `bindings()`, `levels`.
    `child(bindings)` recursa via `wrap` para que sub-loggers
    enxerguem só nossa interface.
  - **`options.bindings` aplicado via `.child()`** após criação para
    preservar o default `base: { pid, hostname }` do Pino.
  - **Deps runtime**: `pino@^9` + `pino-pretty@^11` (regular dep —
    apps usam em `pnpm dev`).
- **`packages/logger/README.md`** [Sessão 17 Gate 5] — ~250 linhas,
  11 seções: princípios, "Por que Pino", quickstart (3 exemplos),
  API pública (tabelas), env vars, **"Uso esperado nos apps (W3 /
  BL-C6-002)"** com 3 exemplos copy-pasteáveis + lista exata dos 8
  `console.*` no Agent (apurada no Gate 1), helper `captureLines()`
  para testes, escopo fora (BL-C6-003 W3, BL-C6-004 W4+), cobertura,
  referências.
- **ADR-020** em `DECISIONS.md` — `@sprint/logger` com Pino —
  wrapper enxuto (W1.C6). Documenta as 8 decisões da sessão
  (API estreita, dev/prod auto, LOG_LEVEL override, singleton lazy,
  destination customizado, bindings via child) + 7 alternativas
  rejeitadas (Winston, Bunyan, custom console wrapper, expor Pino
  direto, API wide, builder pattern, file/Sentry agora) +
  endurecimento futuro da regra ESLint `no-console`.
- **CLAUDE.md** [Sessão 17 Gate 6]:
  - §4 ganhou nova subseção **"Estrutura interna de `@sprint/logger`
    (W1.C6 — Sessão 17)"** com 9 convenções específicas + lista
    exata dos `console.*` no Agent que esperam refactor BL-C6-002.
- **57 testes** em 3 arquivos no `@sprint/logger` — cobertura
  **100% lines / 100% branches / 100% funcs / 100% stmts** em
  `config.ts`, `createLogger.ts` e `rootLogger.ts`. `types.ts`
  (`export type` only) e `index.ts` (barrel) excluídos da medição
  por config — mesma escolha de contracts e fs-adapter.
- **Changeset `logger-package.md`** (patch — versão `0.0.0`) —
  documenta entrega do pacote para próxima release.

<!-- ↑↑↑ Sessão 17 ↑↑↑ -->

<!-- ↓↓↓ Sessão 16 (2026-05-26) — W1.C3 inteiro: Operator Agent MVP ↓↓↓ -->

- **`sprint-operator-agent` — MVP funcional ponta-a-ponta** [BL-C3-003,
  BL-C3-004, BL-C3-005, BL-C3-006, BL-C3-007, BL-C3-008, Sessão 16]:
  - **`main/services/pollingService.ts`** — loop `setTimeout` recursivo
    (não setInterval) consumindo `PendingStore.listPending({ userId })`.
    Switch sobre `PendingEntry.kind` (invalid/cancel/sprint), filtro de
    deadline passado (RN-11), dedup via `historyService.isAlreadyArchived`,
    `DirectoryNotFoundError` tratado como benigno. Logger opcional (default
    silent).
  - **`main/services/queueService.ts`** — FIFO array + `Set<string>` paralelo
    para dedup O(1) por `sprint_id|user_id`. EventEmitter composto com API
    tipada (`onNextSprint`, `onQueueUpdated`) + unsubscribe. `nextSprint`
    emit apenas em fila vazia → não-vazia (overlay já mostrando uma sprint
    não troca via push; muda só `queueUpdated`).
  - **`main/services/overlayService.ts`** — state machine
    `hidden|showing|minimized` + timer `minimizeAfterMs` (default 30s) +
    push IPC `sprint:incoming`/`queue:updated`/`overlay:minimize`. Métodos:
    `showSprint`, `minimize`, `restoreCurrent` (reseta timer — D4),
    `clearTimer`, `hide`, `destroy`. `onStateChange` event emitter para
    subscribers externos.
  - **`main/services/trayStateService.ts` + `trayService.ts`** —
    `trayStateService` puro (computeTrayIconColor/Menu/Tooltip sobre
    `TrayState` discriminada) + `trayService` integra Electron Tray
    (boot/setState/balloon/aboutDialog). Estados: idle (cinza),
    sprint_active(N) (amarelo), config_error (vermelho), loading.
    **`Sair` ausente** no menu (RN-04 W1).
  - **`main/services/historyService.ts`** — cache em memória de filenames
    processados. `ensureFolder` cria `<userData>/historico/` no boot.
    `archive(payload, filename, rawContent)` grava em
    `<userData>/historico/YYYY-MM-DD/<filename>` com escrita atômica
    (`.tmp` + `randomBytes(6).hex` + rename — G-017). `initializeFromDisk`
    scan recursivo populando cache no boot (dedup pós-restart — D5).
  - **`main/services/ackService.ts`** — `writeDisplayed(payload)` (não-throw,
    log warn) + `writeAcknowledged(sprintId, userId)` (throw, re-lê via
    listAcks para preservar `displayed_at` original). Fallback `now` se
    listAcks falhar.
  - **`main/handlers/handleAck.ts`** — orquestra ack final extraído do
    `main/index.ts` (testabilidade). Valida peek match → `clearTimer` →
    `writeAcknowledged` (throw) → `archive` (não-fatal) → `deletePending`
    (não-fatal) → dequeue → `showSprint(next)` + `writeDisplayed(next)`
    OU `overlay.hide()`.
  - **`main/index.ts`** — composition root com **rebuildDeps fail-soft**
    espelhando ADR-017. Boot 7-step ordenado: single-instance →
    `app.whenReady` → tray loading → `try rebuildDeps` → config_error
    fallback → IPC handlers. 3 IPC handlers tipados: `config:get`,
    `sprint:request-current` (pull pattern), `sprint:acknowledge`.
  - **`main/config.ts`** REWRITE — fail-soft com 3 ConfigError tipados
    (`NotFound`/`Invalid`/`Inaccessible`) + campo extra-schema
    `minimize_after_seconds` (1-300s, default 30) stripado antes de
    `safeParseAgentConfig`.
- **Renderer dark theme + accent yellow** (espelha ADR-018) [BL-C3-004,
  Sessão 16 Gate 4]:
  - Stores Zustand (`useCurrentSprintStore`, `useQueueStore` com
    selectExtraInQueue), hooks (`useIncomingSprint` pull+push,
    `useQueueUpdated`), 5 components (Overlay, SprintCard com
    **re-sanitização defensiva** via `sanitizeBodyHtml`, AckButton
    funcional com loading + erro inline + key remount, DeadlineBadge
    estático, QueueIndicator condicional).
  - `Api` interface nested (config/sprint/queue/overlay) com
    property-with-arrow (ADR-017) — evita `unbound-method` em testes.
- **Dev fixtures + SETUP** [Sessão 16 Gate 8]:
  - `dev-fixtures/agent-config.example.json` (template com `_comment`
    removível + campo W1-extra `minimize_after_seconds`).
  - `apps/operator-agent/SETUP.md` (~530 linhas, 9 seções: dev,
    LAN 2 PCs, build via GitHub Actions + deployment passo-a-passo, QA
    checklist, troubleshooting).
- **`.github/workflows/build-agent.yml`** [Sessão 16 Gate 8.5] —
  workflow CI espelhado de `build-leader.yml`. Runner windows-latest, gera
  portable + NSIS installer via `pnpm --filter sprint-operator-agent run make`.
  Triggers paths-based + manual dispatch. Necessário pelo ESET local
  (G-009).
- **ADR-019** em `DECISIONS.md` — arquitetura W1.C3 inteiro. State machine
  do overlay; pull pattern pra resolver mount race; boot fail-soft
  superseding ADR-012 W0; handleAck extraído pra testabilidade;
  re-sanitização defensiva; dedup pós-restart; campo extra-schema; mock
  strategy (BrowserWindow via `vi.hoisted`, OverlayService inteiro
  mockado em integration).
- **CLAUDE.md §4 ganhou nova subseção** "Estrutura interna do Operator
  Agent (W1.C3)" + §12 **G-021** (BOM no PowerShell 5.1 — `Set-Content
  -Encoding utf8` adiciona `EF BB BF` que quebra `JSON.parse`; fix:
  `[System.IO.File]::WriteAllText` com `UTF8Encoding($false)`).
- **README.md** status C3 atualizado para "✅ W1 MVP".
- **190 testes** em 17 arquivos no `sprint-operator-agent` (era 15 no W0).
  Cobertura **97.76% lines / 91.47% branches / 95.4% funcs**. Inclui:
  - 4 XSS adversariais no `SprintCard.test` (script, iframe, onclick,
    atributos não-listados).
  - 24 testes do `overlayService.test` (state machine, timer, IPC,
    onStateChange) com mock `BrowserWindow` via `vi.hoisted()`.
  - 4 testes integrados em `integration.test.ts` (fluxo E2E real com
    `MemoryFilesystemAdapter` + OverlayService mockado): 2 sprints
    pre-seeded → poll → ack → ack → queue vazia + verificações de
    filesystem state (4 writeAck, 2 archives, 2 deletePending,
    clearTimer 2×).
- **Migrate dev configs para o servidor SMB real** — Sessão 16 Gate 8.5:
  `%APPDATA%\sprint-leader\config.json` e
  `%APPDATA%\sprint-operator-agent\config.json` apontam para
  `\\srv-alpha\TEMP\Metas_3Studio` (Renan + Mario + Otavio + Diemerson +
  André em `operators.json` real no UNC). Leader bootou OK com UNC; smoke
  validado.

<!-- ↑↑↑ Sessão 16 ↑↑↑ -->

<!-- ↓↓↓ Sessão 15 (2026-05-26) — W1.C2 parte 2: Leader MVP + redesign Renan ↓↓↓ -->

- **`@apps/leader` — main process completo** (`main/config.ts`,
  `main/services/operatorsService.ts`, `main/services/dispatchService.ts`,
  `main/ipc.ts`) consumindo `@sprint/fs-adapter` (W1) e `@sprint/contracts`
  (sanitize + parse + ULID). 5 `ConfigError` tipados com fail-fast espelhando
  ADR-012. `rebuildDeps` callback destrava app sem restart após líder
  corrigir `config.json` [BL-C2-007, Sessão 15 Gate 3]
- **`@apps/leader` — integração renderer**: wrapper tipado
  `renderer/services/api.ts`, `useOperatorsStore` async via IPC (substitui
  `data/operators.mock.ts` deletado), `ConfigErrorScreen` para boot sem
  config válida, `useDispatchStore` (status do dispatch + result),
  discriminated union de boot state em `App.tsx` [Sessão 15 Gate 4]
- **BL-C2-007 fechado — dispatch real**: `DispatchModal` (3 estados:
  in_progress / completed / error), wire `Disparar evento` →
  `selectDispatchRequest` → `api.dispatchSprint` → main `DispatchService` →
  per-operator try/catch isolado em `PendingStore.writePendingSprint`. Reset
  condicional do composer pós-fechamento (sucesso total reseta; falha
  parcial preserva form para retry). Toasts de feedback com auto-dismiss.
  Smoke real validado: 5 sprints disparadas em `dev-fixtures/shared/pending/`
  com schema do Anexo C conferindo ponto-a-ponto [Sessão 15 Gate 5]
- **Dev fixtures + setup**: `dev-fixtures/` formal (`.gitignore` para
  runtime, `config-example.json`, `shared/operators.json` com 5 operadores,
  `shared/{pending,acks}/`). `apps/leader/SETUP.md` com 8 seções
  (pré-requisitos, config, dev, fixtures, smoke, QA checklist,
  troubleshooting, próximos passos) [Sessão 15 Gate 6]
- **Redesign visual do Leader (design Renan)**: dark theme + accent amarelo
  `#EBC76A` + logo `3STUDIO` SVG inline. `components/Sidebar/` substituído
  por `components/TopNav/` horizontal. Hero "Escolher pessoas / para rodada
  de metas" com accent no fragmento `rodada de metas`. `OperatorList` em
  grid 2-colunas. `OperatorRow` redesenhado (avatar com inicial + nome em
  label clicável + counter inline + checkbox custom amarelo).
  `DispatchModal` + `ConfigErrorScreen` + Toast adaptados ao dark theme.
  Vocabulário UI: Sprint→Rodada, Operador→Usuário, Enviar→Disparar evento,
  Horário limite→Horário. **Schema interno do `SprintPayload` e contratos
  IPC permanecem inalterados** — só copy user-facing mudou [Sessão 15
  Gate 7]
- **ADR-017** em `DECISIONS.md` (arquitetura main process do Leader —
  W1.C2 parte 2): composition root + fail-fast + IpcResult envelope +
  GetConfigResult discriminated + rebuildDeps callback + LeaderAPI
  property-with-arrow
- **ADR-018** em `DECISIONS.md` (redesign visual do Leader — design Renan):
  tokens dark + accent + Logo + TopNav + hero + 2-col grid +
  vocabulário UI; documenta inconsistência intencional entre UI naming
  ("Rodada", "Usuário", "Evento") e schema/código ("Sprint", "Operator",
  "Dispatch")
- **CLAUDE.md** ganhou (1) nova subseção em §4 "Estrutura interna do main
  process do Leader (W1.C2 parte 2)" com convenções específicas + (2)
  G-020 em §12 (jsdom/canvas externalize em `vite-plugin-electron`)
- **README.md** status C2 atualizado para "✅ W1 MVP + redesign"

<!-- ↑↑↑ Sessão 15 ↑↑↑ -->

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
- Package `@sprint/contracts` com schemas Zod e tipos inferidos via
  `z.infer` [BL-C1-001, BL-C1-002]
- `generateSprintId()` e `isValidUlid()` com ULID Crockford Base32
  (defensivo contra entradas não-string) [BL-C1-005]
- Helpers de filename: `buildPending/Ack/CancelFilename`, `parseFilename`,
  `safeParseFilename` com `ParsedFilename` discriminated union
  [BL-C1-003]
- Constantes compartilhadas: `SCHEMA_VERSION`, `DEFAULT_POLLING_INTERVAL_MS`,
  `SHARED_DIRS`, `LOCAL_DIRS`, `ALLOWED_HTML_TAGS`,
  `MAX_DEADLINE_HORIZON_HOURS`, etc [BL-C1-006]
- `ContractValidationError` (com `cause: ZodError`, `.issues`, `.format()`)
  e `FilenameParseError` tipados [BL-C1-002, BL-C1-003]
- Branded types `SprintId` e `UserId` (via `z.brand`) para evitar trocas
  acidentais entre IDs [BL-C1-002]
- ADR-005 em `DECISIONS.md`: schema-first com `z.infer<>`
- ADR-006 em `DECISIONS.md`: filenames com ULID completo (esclarece Anexo A
  do Requisitos)
- ADR-007 em `DECISIONS.md`: ratifica baseline de versões instaladas
  (endereça audit FINDING-M1)
- README do package `@sprint/contracts` com tabela de API, branded types,
  cobertura e roadmap
- Workspace `apps/leader`: app desktop Electron 30 + React 18 + TypeScript,
  bundling via vite-plugin-electron [BL-C2-001]
- Main process com `BrowserWindow` segura (CLAUDE.md §8.1) + hardening de
  navegação (`will-navigate`, `setWindowOpenHandler`) [BL-C2-001]
- Preload + bridge IPC contract-first via `contextBridge`; `LeaderAPI` em
  `src/shared/ipc-types.ts` [BL-C2-001]
- Renderer React placeholder com CSS Modules + tokens e CSP estrita no
  `index.html` [BL-C2-001]
- `electron-builder.yml` do Leader: targets portable + NSIS, instalador pt-BR,
  `requestExecutionLevel: user` [BL-C5-001]
- ADR-008 (bundling com vite-plugin-electron) e ADR-009 (IPC contract-first) em
  `DECISIONS.md`
- Workspace `apps/operator-agent`: app desktop Electron 42 tray-resident,
  React 18 + TypeScript (CJS) [BL-C3-001]
- Main process com single instance lock; `window-all-closed` apenas subscrito
  (sem `preventDefault()` — ADR-011, G-013); tray icon + menu placeholder
  Sobre/Sair; `tray.ico` 16×16 32bpp gerado via Node [BL-C3-001]
- `createOverlayWindow` declarado (TOPMOST, `closable: false`, §8.1) para uso
  em W1 [BL-C3-001]
- Preload + bridge IPC contract-first; `AgentAPI` + `SafeAgentConfigView` em
  `src/shared/ipc-types.ts` (defense-in-depth) [BL-C3-001]
- Renderer placeholder React + CSS Modules; tokens espelham o Leader; CSP
  estrita endurecida (`object-src 'none'`, `base-uri 'self'`) [BL-C3-001]
- Loader de `config.json` fail-fast com 4 `ConfigError` tipados (NotFound,
  Json, Invalid, Read); validação via `safeParseAgentConfig` do
  `@sprint/contracts`; integração no `bootstrap` com diálogo + `app.quit()` em
  erro; handler IPC `getConfig` expõe só `SafeAgentConfigView` [BL-C3-002]
- 13 testes de `config.ts` + 2 de `single-instance.ts` (fs temp real, EISDIR
  via path-como-diretório); cobertura 100% [BL-C3-002]
- `electron-builder.yml` do Agent: portable + NSIS pt-BR, `runAfterFinish`,
  sem desktop shortcut, preserva `config.json` na desinstalação [BL-C5-002]
- ADR-011 (arquitetura tray-resident) e ADR-012 (loader fail-fast) em
  `DECISIONS.md`
- Package `@sprint/fs-adapter` (port-and-adapter hexagonal): library de
  filesystem com port + 2 adapters [BL-C4-001]
- `IFilesystemAdapter` interface com 8 métodos primitivos (`readFile`,
  `writeFileAtomic`, `listDir`, `exists`, `rename`, `unlink`, `mkdir`,
  `stat`) + tipo `FileStat` [BL-C4-001]
- `FilesystemError` abstract base + `FileNotFoundError`,
  `DirectoryNotFoundError`, `FilesystemIOError` concretos; `new.target`
  check enforce abstractness em runtime [BL-C4-001]
- `NodeFilesystemAdapter` usando `node:fs/promises` com escrita atômica
  (open→writeFile→fsync→close→rename) e sufixo aleatório de 6 bytes hex
  no `.tmp` para isolar escritas concorrentes [BL-C4-007]
- `mapError` exhaustive cobrindo ENOENT, ENOTDIR, EISDIR, EACCES, EPERM,
  EEXIST, ENOSPC, EBUSY e fallback `desconhecido` [BL-C4-007]
- `MemoryFilesystemAdapter` in-memory (`Map<string, MemoryFileEntry>`)
  com diretórios implícitos, `mkdir` no-op idempotente, helpers
  `seed()`/`reset()` para fixtures [BL-C4-006]
- Suite de contrato compartilhada (`describeContract` em
  `src/__tests__/contract.test.ts`): 26 testes × 2 adapters = 52 testes
  garantindo paridade Node↔Memory [BL-C4-001]
- ADR-013 (filesystem adapter port-and-adapter hexagonal) em
  `DECISIONS.md`
- README raiz definitivo do monorepo (onboarding ≤ 10 min, visão geral,
  estrutura, componentes C0-C8, comandos, padrões, status) [BL-C7-001]
- Vitest consolidado via Turborepo: `pnpm test` e `pnpm test:coverage`
  na raiz orquestram todos os packages [BL-C8-001]
- Task `test:coverage` em `turbo.json` com `outputs: ["coverage/**"]`
  [BL-C8-001]
- Tabela formal de coverage thresholds por package em CLAUDE.md §7.7.1
  [BL-C8-001]
- ESLint regra customizada: `apps/leader` proibido de importar
  `apps/operator-agent` (e vice-versa) [BL-C8-005]
- ESLint regra customizada: imports de `packages/*` devem usar alias
  `@sprint/<pkg>` (sem path relativo cross-package) [BL-C8-005]
- Seção "Débitos técnicos pendentes" em CLAUDE.md §12 — registra a
  3ª regra ESLint (no-console estrito) como pendente para W1
  [BL-C8-005]
- ADR-002 complementado com alternativa Web/PWA (incompatibilidade
  com RF-07 TOPMOST, RF-19 auto-start) [BL-C7-005]
- ADR-003 complementado com alternativa A5 mensageria (RabbitMQ /
  MQTT / ActiveMQ) e tabela de critérios estendida [BL-C7-004]
- `@sprint/contracts`: `sanitizeBodyHtml(html)` — sanitização de
  `body_html` via `isomorphic-dompurify` (^2.36.0); whitelist estrita
  via `ALLOWED_HTML_TAGS`, zero atributos permitidos, `KEEP_CONTENT`
  preserva texto de tags removidas; idempotente; defesa em
  profundidade (Leader sanitiza ao escrever, Agent ao renderizar);
  40 testes adversariais (XSS clássicos, edge cases) com cobertura
  100% no módulo [BL-C1-004]
- ADR-014 (sanitização de `body_html` via isomorphic-dompurify) em
  `DECISIONS.md`
- CLAUDE.md §7.9 (convenção de uso obrigatório de `sanitizeBodyHtml`
  em toda escrita e leitura de `body_html`)
- `apps/leader`: layout base com 3 rotas (Nova Sprint, Acompanhamento,
  Histórico) via `react-router-dom` ^6.30 em hash mode + sidebar persistente
  com identidade ARTFLEXÍVEIS [BL-C2-002]
- `apps/leader`: stores Zustand ^4.5 — `useSprintComposerStore` (draft do
  composer com operadores + metas + deadline + title + body, ações
  imutáveis) e `useOperatorsStore` (cache filtrando `ativo: true`); selectors
  puros top-level `selectIsValid`, `selectSelectedCount`, `selectFormPayload`
  [BL-C2-011]
- `apps/leader`: `composerFormSchema` Zod (RN-07: meta inteira ≥ 1; deadline
  regex HH:MM 00–23) como fonte única de regras do composer; `selectIsValid`
  delega para `selectFormPayload(state) !== null` (schema-first ADR-005)
  [BL-C2-011]
- `apps/leader`: tela "Nova Sprint" com `OperatorList` (4 operadores ativos
  do mock, filtro por `ativo: true`), `OperatorRow` com checkbox + label
  clicável + nome + hostname, e `BulkSelectButtons` "Marcar todos" /
  "Desmarcar todos" (desabilitam quando lista vazia) [BL-C2-003]
- `apps/leader`: input numérico de meta inline em `OperatorRow` (renderiza
  quando `isSelected`); `aria-invalid` + `aria-describedby` + mensagem
  inline "Meta ≥ 1" quando inválida (null/0/negativa/fracionária) [BL-C2-004]
- `apps/leader`: `DeadlineInput` com `<input type="time">`, default '18:00'
  da store, warning visual `role="alert"` quando deadline está no passado
  (não-bloqueante); helper puro `isDeadlineInPast(hhmm, now?)` exportado
  para reuso [BL-C2-005]
- `apps/leader`: botão "Enviar" como stub desabilitado, controlado pela flag
  `DISPATCH_ENABLED = false` em `NovaSprint.tsx`; tooltip aponta para
  BL-C2-007; `console.warn` de stub no handler (permitido pela regra atual).
  **Ativação prevista em BL-C2-007 (parte 2 desta sessão) após C4 entregar
  operações de domínio do fs-adapter**
- `apps/leader`: tooling de teste de componente — `@testing-library/react`
  ^16.3, `@testing-library/user-event` ^14.6, `@testing-library/jest-dom`
  ^6.9 como devDeps; `test-setup.ts` com `cleanup()` em `afterEach` e
  matchers globais via `jest-dom/vitest`
- `apps/leader`: 84 testes unitários em 7 arquivos (era 0); cobertura
  agregada **96.64% lines / 94.89% branches / 92.59% funcs**; stores
  individuais 100%, componentes 96-100% individuais, rotas 93-100%
- ADR-015 (arquitetura do composer da app Líder — W1.C2 parte 1) em
  `DECISIONS.md`
- CLAUDE.md §3 atualizada (tabela de stack): zustand **4.5.7**,
  react-router-dom **6.30.3**, isomorphic-dompurify **2.36.0**, Electron
  **42.2.0** (corrige stale), @testing-library/{react,user-event,jest-dom}
- CLAUDE.md §4 ganhou nova subseção "Estrutura interna do Leader (W1.C2
  parte 1)" documentando organização do `renderer/` e convenções
  específicas (selectors puros, schema-first, flag DISPATCH_ENABLED,
  decisão de não usar RHF)
- `@sprint/fs-adapter`: camada de domínio em `src/domain/` (port-and-adapter
  per ADR-013) — `PendingStore` (`writePendingSprint`, `listPending`,
  `deletePending`), `AckStore` (`writeAck`, `listAcks`), stubs `CancelStore`
  (W2 / BL-C4-004) e `ArchiveStore` (W3 / BL-C4-005). Todos com construtor
  uniforme `(adapter, sharedPath)` [BL-C4-002, BL-C4-003, BL-C4-006]
- `@sprint/fs-adapter`: utility interno `readAndParseJson` com
  discriminador `kind: 'not-found' | 'invalid'` em `ok: false` —
  consumers distinguem race condition (skip) de corrupção (`kind: invalid`)
  sem string match
- `@sprint/fs-adapter`: `NotImplementedError` na hierarquia
  `FilesystemError` — usado pelos stubs `CancelStore.writeCancel` e
  `ArchiveStore.moveToArchive` com `operationName` exposto
- `@sprint/fs-adapter`: `writePendingSprint` sanitiza `body_html` antes
  de gravar (CLAUDE.md §7.9 + ADR-014); re-valida via `parseSprintPayload`
  como defesa em profundidade contra cast bypass; idem `writeAck` via
  `parseSprintAck`
- `@sprint/fs-adapter`: tipos exportados —
  `PendingEntry`/`AckEntry` (discriminated unions com `kind` e `modifiedAt`),
  `ListPendingFilter`/`ListAcksFilter`, `WritePendingResult`/`WriteAckResult`/
  `WriteCancelResult`/`MoveToArchiveResult`
- `@sprint/fs-adapter`: nova runtime dep `@sprint/contracts` (`workspace:*`)
  para parsers, sanitizer e filename builders
- `@sprint/fs-adapter`: sanity test em `src/__tests__/barrel.test.ts`
  importando via barrel raiz — captura early o erro de adicionar símbolo
  público sem atualizar `index.ts`
- ADR-016 (domain layer do `@sprint/fs-adapter` — W1) em `DECISIONS.md`
- CLAUDE.md §4 ganhou nova subseção "Estrutura interna de
  `@sprint/fs-adapter` (W1 domain layer)" documentando convenções
  (construtor uniforme, `path.posix.join`, RN-09 no domain layer,
  race-safe via FileNotFoundError skip, JSON pretty-print, stubs W2/W3)

### Changed

- `apps/leader/package.json`: adicionado script `test:coverage` e
  devDep `@vitest/coverage-v8` para consistência com os demais
  workspaces [BL-C8-001]
- `apps/leader/vitest.config.ts` e `apps/operator-agent/vitest.config.ts`:
  reporters padronizados (`text`, `json`, `json-summary`, `html`,
  `lcov`) para uso por ferramentas externas de coverage agregada
  [BL-C8-001]

- `eslint.config.mjs`: corrige merge de `rules` no override
  `disableTypeChecked` (bug latente em C0 exposto pelo primeiro `.ts`
  lintado em config files — `vitest.config.ts`)
- `packages/contracts/tsconfig.json`: não exclui `*.test.ts` nem
  `__fixtures__/**` (projectService da typescript-eslint v8 exige
  cobertura por tsconfig; type-check de testes captura erros)
- `package.json` raiz: `esbuild` adicionado a `pnpm.onlyBuiltDependencies`
  (necessário para Vitest funcionar)
- `.changeset/README.md`: marca `@sprint/contracts` como criado;
  `linked`/`ignore` continuam vazios em `config.json` até `fs-adapter` e
  `logger` existirem (endereçamento parcial de audit FINDING-M2)
- `package.json` raiz: `electron` adicionado a `pnpm.onlyBuiltDependencies`
  (postinstall baixa o binário do Electron); `--no-warn-ignored` no comando
  eslint do `lint-staged` (evita falha ao commitar arquivos `.d.ts`) [BL-C2-001]
- `eslint.config.mjs` e `.prettierignore`: ignoram `dist-electron` (saída do
  vite-plugin-electron) [BL-C2-001]
- `.gitignore` raiz: `!apps/*/build/` — não ignora o diretório `buildResources`
  do electron-builder [BL-C5-001]

### Fixed

- Testes diretos para `errors.ts` e `schemas/shared.ts`: fecha a heurística de
  par `.test.ts` 1-para-1 do package `@sprint/contracts` (164 → 190 testes,
  cobertura 100% mantida) [audit-v1-FINDING-001]
- JSDoc consistente nos parsers e types de `sprintAck`, `sprintCancel` e
  `agentConfig`, replicado da referência `sprintPayload` [audit-v1-FINDING-002]
- Upgrade do Electron 30.5.1 → 42.2.0 e override de `tar` para `^7.5.11`
  (`pnpm.overrides`): `pnpm audit` cai de 10 advisories High para 0; ADR-010
  registra a decisão [audit-v1-FINDING-001]
- Entrada morta `electron-builder.yml.d.ts` removida do `include` do
  `apps/leader/tsconfig.json` [audit-v1-FINDING-002]
- CSP do `apps/leader/index.html` endurecida com `object-src 'none'` e
  `base-uri 'self'` [audit-v1-FINDING-003]
- `rfc3161TimeStampServer` comentado no `electron-builder.yml` do Leader — code
  signing diferido para a Wave 3 (BL-C0-008) [audit-v1-FINDING-004]

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
