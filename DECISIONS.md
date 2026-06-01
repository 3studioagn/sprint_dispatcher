# DECISIONS.md — Architecture Decision Records

Log cronológico das decisões arquiteturais do projeto Sprint Dispatcher.

Cada decisão de peso (escolha entre alternativas com trade-offs, padrão
organizacional, estratégia de longo prazo) vira uma entrada aqui. Mantenha
entradas em ordem cronológica crescente — mais recente no fim.

---

## Formato de cada ADR

```markdown
## ADR-NNN: <Título conciso>

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
- **Data:** YYYY-MM-DD
- **Decisores:** <Quem participou da decisão>

### Contexto

<O que estava acontecendo? Qual problema motivou a decisão?>

### Decisão

<O que decidimos fazer? Seja específico e direto.>

### Alternativas consideradas

<Que outras opções foram avaliadas? Por que foram rejeitadas?>

### Consequências

<O que essa decisão implica? Trade-offs aceitos? Riscos?>

### Referências

<Links, issues, PRs relacionados (se houver)>
```

### Regras

- **ADRs nunca são apagados.** Se uma decisão muda, a antiga vira
  `Status: Superseded by ADR-XXX` e uma nova é criada.
- **Status `Deprecated`** indica decisão que perdeu relevância mas não foi
  formalmente substituída.
- **Numeração é sequencial e única.** Não reuse IDs.

### O que NÃO merece ADR

- Escolhas óbvias sem trade-offs (ex: "usar TypeScript em projeto TS")
- Implementação tática de feature específica
- Reversões triviais de comportamento

---

## Registro de ADRs

- [ADR-001](#adr-001-monorepo-com-pnpm-workspaces--turborepo) — Monorepo com
  pnpm workspaces + Turborepo
- [ADR-002](#adr-002-electron-como-runtime-desktop) — Electron como runtime
  desktop
- [ADR-003](#adr-003-pasta-compartilhada-smb-como-canal-de-comunicacao) — Pasta
  compartilhada SMB como canal de comunicação
- [ADR-004](#adr-004-polling-como-estrategia-de-deteccao) — Polling como
  estratégia de detecção
- [ADR-005](#adr-005-schema-first-com-inferencia-de-tipos-via-zinfer) —
  Schema-first com inferência de tipos via `z.infer`
- [ADR-006](#adr-006-convencao-de-naming-de-arquivos-com-ulid-completo) —
  Convenção de naming de arquivos com ULID completo
- [ADR-007](#adr-007-ratificacao-do-baseline-de-versoes-instaladas-vs-stack-v10)
  — Ratificação do baseline de versões instaladas vs Stack v1.0
- [ADR-008](#adr-008-bundling-electron-com-vite-plugin-electron) — Bundling
  Electron com vite-plugin-electron
- [ADR-009](#adr-009-ipc-contract-first-com-tipos-compartilhados-mainrenderer) —
  IPC contract-first com tipos compartilhados main↔renderer
- [ADR-010](#adr-010-upgrade-do-electron-para-a-linha-42x-remediacao-finding-001)
  — Upgrade do Electron para a linha 42.x (remediação FINDING-001)
- [ADR-011](#adr-011-arquitetura-tray-resident-do-operator-agent) — Arquitetura
  tray-resident do Operator Agent
- [ADR-012](#adr-012-loader-de-configjson-com-fail-fast-validation) — Loader de
  `config.json` com fail-fast validation
- [ADR-013](#adr-013-filesystem-adapter-port-and-adapter-hexagonal) — Filesystem
  Adapter port-and-adapter (hexagonal)
- [ADR-014](#adr-014-sanitizacao-de-body_html-via-isomorphic-dompurify) —
  Sanitização de `body_html` via isomorphic-dompurify
- [ADR-015](#adr-015-arquitetura-do-composer-da-app-lider-w1c2-parte-1) —
  Arquitetura do composer da app Líder (W1.C2 parte 1)
- [ADR-016](#adr-016-domain-layer-do-sprintfs-adapter-w1) — Domain layer do
  `@sprint/fs-adapter` (W1)
- [ADR-017](#adr-017-arquitetura-do-main-process-do-leader-w1c2-parte-2) —
  Arquitetura do main process do Leader (W1.C2 parte 2)
- [ADR-018](#adr-018-redesign-visual-do-leader-design-renan) — Redesign visual
  do Leader (design Renan)
- [ADR-019](#adr-019-arquitetura-do-operator-agent-w1c3-inteiro) — Arquitetura
  do Operator Agent (W1.C3 inteiro)
- [ADR-020](#adr-020-sprintlogger-com-pino-wrapper-enxuto-w1c6) —
  `@sprint/logger` com Pino — wrapper enxuto (W1.C6)
- [ADR-021](#adr-021-expansao-da-suite-de-testes-para-production-grade-na-w1c8)
  — Expansão da suíte de testes para production-grade na W1.C8
- [ADR-022](#adr-022-adocao-do-sprintui-kit-c9-como-design-system-compartilhado)
  — Adoção do `@sprint/ui-kit` (C9) como design system compartilhado
- [ADR-023](#adr-023-nao-adocao-de-storybook-na-v10) — Não adoção de Storybook
  na v1.0
- [ADR-024](#adr-024-estrategia-de-assinatura-e-confianca-de-codigo-cert-auto-assinado--gpo)
  — Estratégia de assinatura e confiança de código (cert auto-assinado + GPO)

---

<!-- Adicione ADRs abaixo desta linha, em ordem cronológica crescente -->

## ADR-001: Monorepo com pnpm workspaces + Turborepo

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)

### Contexto

O Sprint Dispatcher se decompõe em dois apps Electron (`leader`,
`operator-agent`) e três libraries (`@sprint/contracts`, `@sprint/fs-adapter`,
`@sprint/logger`) — totalizando 5 entregáveis com forte interdependência tipada.
Precisamos versionar, buildar, lintar e testar o conjunto sem que cada package
vire um repo independente (overhead absurdo pra um time pequeno e pra contratos
que mudam em conjunto). Também precisamos cachear builds entre desenvolvedores e
CI para que o ciclo dev → push → green continue rápido mesmo quando o número de
packages crescer.

### Decisão

Adotamos **monorepo único** gerenciado por:

- **pnpm 10.x workspaces** (chave `packages: ['apps/*', 'packages/*']` no
  `pnpm-workspace.yaml`) como gerenciador de dependências e linker entre
  workspaces.
- **Turborepo 2.x** (chave `tasks` no `turbo.json`) como orquestrador de builds,
  com pipeline declarativo (`build`, `test`, `lint`, `type-check`, `dev`),
  `dependsOn: ["^build"]` onde aplica, e cache local em `.turbo/` com restore
  por OS no CI.
- **Changesets** para versionamento independente dos packages internos
  (`@sprint/*`), com `linked` agrupando os três para evitar drift de
  compatibilidade.

### Alternativas consideradas

| Alternativa                        | Por que rejeitada                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **npm workspaces**                 | Sem `strict` por default — phantom dependencies passam batido. Sem orquestrador equivalente; precisaria casar com Lerna/Nx. |
| **Yarn 3 (Berry)**                 | Boa, mas adota PnP por default (problemático com Electron) e sai do padrão 3Studio.                                         |
| **Lerna**                          | Substituída na prática por Turborepo + Changesets. Manutenção pulou desde 2022.                                             |
| **Nx**                             | Mais opinionado e pesado. Excesso de features pro nosso porte (5 entregáveis).                                              |
| **Polirrepo (1 repo por package)** | Custo de coordenação alto para um time pequeno; PRs cross-cutting viram 5 PRs encadeados.                                   |

### Consequências

- Path aliases `@sprint/*` resolvem para `packages/*/src/index.ts` via
  `tsconfig.json` raiz — toda a refatoração de assinatura de contrato é triviada
  pelo TypeScript.
- Cada commit pode tocar múltiplos packages e o cache do Turborepo só refaz o
  que mudou (e suas dependências transitivas).
- Versionamento dos packages exige disciplina com Changesets — um changeset por
  mudança publicável. Devs novos precisam ser orientados.
- Apps Electron (`leader`, `operator-agent`) **não** participam do versionamento
  Changesets — eles versionam pelo `electron-builder` no artefato final
  (`SprintLeader-Setup-X.Y.Z.exe`). Configuração `ignore` em
  `.changeset/config.json` reflete isso.
- O cache do Turborepo é o ativo mais sensível do CI; perdê-lo (ex: trocar
  runner) faz a primeira run ficar lenta. Aceito.

### Referências

- `pnpm-workspace.yaml`, `turbo.json`, `.changeset/config.json`
- Stack §11.1 (pnpm), §11.2 (Turborepo), §11.5 (Changesets)
- Backlog §3.2, BL-C0-001, BL-C0-002, BL-C0-006

---

## ADR-002: Electron como runtime desktop

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)

### Contexto

Tanto o Leader (UI de composição de sprints) quanto o Agent (residente, com
overlay fullscreen TOPMOST sobre qualquer aplicação aberta) precisam ser **apps
desktop nativos Windows**. Operadores rodam Illustrator, Corel e outras
ferramentas em zoom — qualquer aviso que não consiga sobrepor essas janelas é
invisível pra eles. Adicionalmente, o time 3Studio é especializado em stack web
(React, TS, CSS Modules) — adotar runtime nativo (.NET/C++) introduziria duas
linguagens e dois tooling stacks.

### Decisão

Adotamos **Electron 30.x** como runtime único para Leader e Agent. Mesma
codebase pode ser dividida em renderers diferentes; main process compartilha
patterns (IPC tipado via preload, BrowserWindow com `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`). Vite serve como bundler do renderer.

Overlay TOPMOST do Agent usa `overlay.setAlwaysOnTop(true, 'screen-saver')` —
nível máximo do Electron, acima de qualquer outra janela do sistema exceto
Win+L.

### Alternativas consideradas

| Alternativa             | Por que rejeitada                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WPF (.NET/C#)**       | Time sem fluência. Tooling distinto do que usamos. Curva alta.                                                                                                                             |
| **PyQt / PySide**       | Empacotamento Python no Windows é frágil (PyInstaller, py2exe). UI menos polida.                                                                                                           |
| **AutoHotkey**          | Suficiente pro overlay do Agent, mas Leader exige UI rica (forms, listas, validação). Stack dual seria pior.                                                                               |
| **Tauri**               | Promissor (binário ~10x menor que Electron), mas em 2026 ainda imaturo pra TOPMOST robusto e tray. Re-avaliar em Tauri 2.x (estimado jan/2027).                                            |
| **Flutter Desktop**     | Quebra o single tech stack (Dart). Time não usa.                                                                                                                                           |
| **Native Win32 / C++**  | Custo de desenvolvimento desproporcional ao escopo.                                                                                                                                        |
| **Web (PWA / browser)** | Incompatível com requisitos: tray icon impossível, sem TOPMOST sobre janelas nativas (RF-07), sem auto-start no boot do Windows (RF-19), sem acesso a HKCU Run / scheduled tasks via APIs. |

### Consequências

- EXE final fica grande (~80–120 MB). Aceito — distribuição é interna na LAN da
  ARTFLEXÍVEIS, sem largura de banda como restrição.
- Consumo de RAM por janela aberta (~50–100 MB). Aceito — estações modernas têm
  8 GB+.
- Atualizações do Electron exigem rebuild dos dois apps. Aceito — patch
  trimestral é viável e cai numa wave dedicada se for major bump.
- Toda `BrowserWindow` **obrigatoriamente** é criada com flags de segurança
  (`contextIsolation`, `nodeIntegration: false`, `sandbox: true`). Sem exceção.
  Documentado no `CLAUDE.md` §8.1.
- Trigger de reavaliação: quando Tauri 2.x estabilizar TOPMOST e tray (provável
  jan/2027), abrir spike de migração.

### Referências

- Stack §5.1 (Electron), §16.2 (Quando reavaliar)
- Requisitos §3.1 (Componentes), §3.2 P-03 (Agent residente)
- `CLAUDE.md` §8.1 (segurança obrigatória), §8.2 (overlay TOPMOST)
- BL-C7-005 — formalização da seção de alternativas (entrada Web/PWA adicionada
  na sessão de fechamento da W0)

---

## ADR-003: Pasta compartilhada SMB como canal de comunicação

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)

### Contexto

Leader e Agent precisam trocar mensagens (sprint payload, ack, cancelamento)
**sem servidor de aplicação**. A política de segurança da ARTFLEXÍVEIS rejeita
backends cloud para tráfego interno, e o time não tem operação para manter um
backend local rodando 24/7. Por outro lado, a ARTFLEXÍVEIS já usa intensamente
uma pasta compartilhada SMB para artes, especificações de impressão e arquivos
de produção — esse canal já é gerenciado, monitorado e auditado pela TI.

### Decisão

Adotamos a **pasta compartilhada SMB** (`\\servidor\sprint-dispatcher\`) como
**único canal de comunicação** entre Leader e Agent:

- `pending/` — Leader escreve `SprintPayload` JSON; permissão NTFS de escrita só
  para líderes.
- `acks/` — Agent escreve `SprintAck` JSON; permissão NTFS de escrita para todos
  os operadores.
- `arquivo/` — sprints processadas movidas para histórico.

Toda escrita é **atômica**: escreve em `<arquivo>.tmp`, depois faz `rename()`
(atômico no mesmo filesystem). Autenticação é por **permissões NTFS da pasta**,
não por credencial de aplicação.

### Alternativas consideradas

| #      | Arquitetura                           | Stack                             | Veredito                                             |
| ------ | ------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| **A1** | Backend cloud + WebSocket             | FastAPI + Postgres + WebSocket    | Inviável por política de segurança                   |
| **A2** | Backend local + WebSocket             | FastAPI local + Postgres local    | Exige servidor dedicado, abertura de porta, operação |
| **A3** | **Pasta compartilhada SMB + polling** | EXEs + SMB share                  | **Escolhida**                                        |
| **A4** | Banco de dados local + polling        | Postgres + ODBC                   | Exige licenciamento, gestão de credenciais           |
| **A5** | Mensageria (broker dedicado)          | RabbitMQ / MQTT / ActiveMQ + libs | Broker adicional para operar; overhead injustificado |

Critérios de decisão (✓ = melhor, △ = neutro, ✗ = pior):

| Critério                      | A1  | A2  | A3  | A4  | A5  |
| ----------------------------- | --- | --- | --- | --- | --- |
| Aprovação TI / Segurança      | ✗   | △   | ✓   | △   | ✗   |
| Custo de infraestrutura       | △   | △   | ✓   | △   | ✗   |
| Velocidade de desenvolvimento | △   | △   | ✓   | ✗   | △   |
| Manutenibilidade              | △   | △   | ✓   | △   | ✗   |
| Extensibilidade futura        | ✓   | ✓   | △   | ✓   | ✓   |

A3 ganhou em 4 dos 5 critérios. O único trade-off — extensibilidade — é mitigado
pelo §"Migração futura" do doc de requisitos: o formato JSON é preservado
intacto entre filesystem e payload HTTP de eventual API REST (A1).

**Notas adicionais sobre A5 (mensageria):** RabbitMQ/MQTT/ActiveMQ são padrão da
indústria para comunicação assíncrona com filas duráveis e entrega real-time,
mas pressupõem um broker rodando 24/7 — para a escala do MVP (3–10 estações
operadoras na LAN da ARTFLEXÍVEIS) o overhead operacional do broker (deploy,
monitoring, ACLs, backups da fila) excede o ganho. Operadores e TI ganham um
sistema novo para entender que não substitui a pasta compartilhada já existente
para artes/specs de produção. Reavaliação só faz sentido se o cenário escalar
para múltiplos sites com latência abaixo de 1 s (não previsto).

### Consequências

- Zero infraestrutura nova. Zero conversa de firewall. Zero credenciais a
  gerenciar fora do AD existente.
- Resiliência por design: estação desligada durante o disparo processa o aviso
  ao ligar (arquivo persiste em `pending/`).
- Auditoria automática: todo arquivo é histórico — basta listar
  `pending/`/`acks/` para reconstruir o que aconteceu.
- Limite prático ~50 estações antes de o polling agregar carga relevante no file
  server. Aceito (ARTFLEXÍVEIS tem ~20 operadores).
- Latência de até 5 s entre disparo e exibição. Aceito — comunicação de meta de
  produção não é evento real-time estrito.
- Sem operação remota (operadores fora da LAN não recebem). Aceito — todos os
  operadores estão fisicamente na fábrica.
- Migração futura para backend HTTP (cenário A1) é viável **sem reescrever o
  protocolo**: o payload JSON vira corpo de requisição REST. Cláusula
  arquitetural deliberada.

### Referências

- Requisitos §3.2 (P-01 a P-06), §4.1–4.5 (Alternativas, critérios, trade-offs,
  migração futura)
- `CLAUDE.md` §1 (Missão), §2 (Princípios arquiteturais inegociáveis P-01 a
  P-05), §8.3 (Escrita atômica)
- BL-C7-004 — formalização da seção de alternativas (entrada A5 mensageria
  adicionada na sessão de fechamento da W0)

---

## ADR-004: Polling como estratégia de detecção

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)

### Contexto

Com o canal sendo uma pasta compartilhada SMB (ver
[ADR-003](#adr-003-pasta-compartilhada-smb-como-canal-de-comunicacao)), o Agent
precisa detectar arquivos novos em `pending/` e o Leader precisa detectar acks
em `acks/`. A abordagem default em Node.js — `fs.watch` ou bibliotecas como
`chokidar` — assume um filesystem local com eventos de kernel confiáveis.
**Pastas SMB não entregam essa garantia.**

### Decisão

Adotamos **polling** com intervalo de **3 segundos** (configurável via
`config.json`, faixa 3–5 s):

- Agent lê `pending/` a cada 3 s, filtra arquivos com seu `operator_id`,
  processa em ordem de timestamp.
- Leader lê `acks/` a cada 3 s enquanto há sprint ativa pendente de ack,
  atualiza UI.
- Polling implementado no `@sprint/fs-adapter` (futuro), com cancelamento via
  `AbortSignal`.

`fs.watch` e `chokidar` ficam **proibidos** no código de produção (ESLint custom
rule a ser adicionada em sessão futura, item BL-C8-005).

### Alternativas consideradas

| Alternativa                                | Por que rejeitada                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **`fs.watch` (Node nativo)**               | SMB não dispara eventos de kernel de forma confiável. Comportamento errático: às vezes dispara, às vezes não, às vezes duplica. |
| **`chokidar`**                             | Mesmo problema-raiz — abstrai sobre `fs.watch` e herda o comportamento errático. Pior ainda: a abstração esconde o problema.    |
| **Inotify / ReadDirectoryChangesW direto** | Mesma camada de eventos do kernel; mesmo problema com SMB redirector.                                                           |
| **Push via WebSocket / SSE**               | Exigiria backend (ver [ADR-003](#adr-003-pasta-compartilhada-smb-como-canal-de-comunicacao)).                                   |
| **Polling com intervalo < 1 s**            | Custo de CPU e I/O cresce sem ganho perceptível pro usuário (5 s já é "imediato" pra comunicação de meta).                      |

### Consequências

- Latência máxima de 3 s entre arquivo aparecer e ser detectado. Aceito — RNF-04
  estabelece "<10 KB/min" de tráfego por agente e o polling de pasta pequena com
  3–5 acks fica muito abaixo disso.
- Custo de CPU desprezível: `readdir()` em pasta com poucos arquivos é
  microssegundos.
- Comportamento **determinístico, previsível e debugável** — debug log imprime
  cada ciclo. Vale muito mais que magia de event-based em produção.
- Polling continua mesmo com pasta vazia — custo constante mas mínimo.
- Se latência de 5 s tornar-se inaceitável (revisão de UX), reavaliamos. Não é
  um problema iminente.

### Referências

- Requisitos §3.2 P-04 (Operação assíncrona com polling discreto), RNF-04
  (tráfego de rede)
- Stack §8.2 (Polling vs Watching)
- `CLAUDE.md` §2 P-04 (polling deliberado)

---

## ADR-005: Schema-first com inferência de tipos via z.infer

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)

### Contexto

O package `@sprint/contracts` (C1) define tipos TypeScript **E** schemas Zod
para os 4 contratos JSON (`SprintPayload`, `SprintAck`, `SprintCancel`,
`AgentConfig`). O Backlog sugere itens BL-C1-001 (tipos TS) antes de BL-C1-002
(schemas Zod), mas executar nessa ordem cria risco de **drift**: ao longo do
projeto, alguém edita o schema sem refletir no tipo (ou vice-versa), e a
divergência só é notada quando dados reais quebram em runtime.

### Decisão

Adotar **schema-first com inferência via `z.infer<typeof schema>`**:

```ts
export const sprintPayloadSchema = z.object({ ... }).strict();
export type SprintPayload = z.infer<typeof sprintPayloadSchema>;
export type SprintPayloadInput = z.input<typeof sprintPayloadSchema>;
```

Schemas Zod são a única fonte de verdade. Tipos TypeScript são derivados via
`z.infer` (após defaults aplicados) e `z.input` (antes de defaults — para uso em
formulários onde campos com default ainda podem estar ausentes).

Toda definição de contrato neste package deve seguir esse padrão. **Declarar
`interface Foo` em paralelo a `fooSchema` é violação.**

### Alternativas consideradas

1. **Tipo primeiro, schema com `satisfies z.ZodType<T>`:** preserva
   independência mas exige sincronização manual e ainda permite discrepâncias
   sutis em campos com defaults.
2. **Tipo e schema co-mantidos manualmente:** padrão da maioria dos projetos
   legados. Alto risco de drift; pega bugs só em produção.
3. **Code-gen de schema a partir de TS via tools tipo `zod-to-ts`:** mais
   complexidade de build, sem ganho real no nosso escopo.

### Consequências

**Aceitas:**

- Toda mudança em contrato passa pelo schema → impossível drift.
- Type-checking obriga consistência.
- Tipos `*Input` separados (`z.input<>`) para uso em formulários onde defaults
  ainda não foram aplicados.

**Trade-offs:**

- Tipos públicos da library ficam acoplados a Zod (sempre vai precisar importar
  `@sprint/contracts` que carrega Zod transitivamente).
- IDE às vezes mostra tipos como `z.infer<typeof xxxSchema>` em vez do nome
  semântico — solução: `export type Foo = z.infer<typeof fooSchema>` faz o nome
  aparecer.
- Branded types (`SprintId`, `UserId`) ficam como `string & { brand }` na
  inferência. Em UIs com `react-hook-form` pode exigir cast explícito no valor
  inicial. Documentado em CLAUDE §12 G-005.

### Referências

- Backlog BL-C1-001, BL-C1-002
- Stack §7.1 (Zod)
- `packages/contracts/README.md` (uso e exemplos)
- <https://zod.dev/?id=type-inference>

---

## ADR-006: Convenção de naming de arquivos com ULID completo

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)

### Contexto

O Anexo A do documento de Requisitos exibe arquivos pending como
`20260521-143210-joao.json` (timestamp humano `YYYYMMDD-HHmmss` + userid). Não
especifica formalmente se o timestamp é `criado_em`, `issued_at` ou outro —
ambiguidade. Os schemas Zod, por outro lado, exigem que cada sprint tenha um
`sprint_id` ULID. Existem dois candidatos óbvios para o nome do arquivo, e a
divergência entre o nome no filesystem e o `sprint_id` do payload JSON criaria
fricção de debug e risco de colisão.

### Decisão

Adotar **`<sprintId>-<userId>.json`** (ULID completo + userid) para arquivos
pending, e equivalentes para ack (`<sprintId>-<userId>.ack.json`) e cancel
(`cancel-<sprintId>.json`). Formato canônico documentado em
`packages/contracts/src/filenames.ts`.

### Justificativa

1. **ULID já carrega timestamp ordenável.** A primeira metade (10 chars) do ULID
   encode timestamp em ms desde epoch, em Base32. Listagem lexicográfica da
   pasta == listagem cronológica.
2. **1-to-1 entre `sprint_id` no JSON e nome do arquivo.** Zero ambiguidade
   sobre qual JSON pertence a qual sprint.
3. **Sem risco de colisão.** ULIDs são únicos por design; timestamp humano
   `YYYYMMDD-HHmmss` pode colidir se duas sprints forem disparadas no mesmo
   segundo (raro mas possível).
4. **Esclarece spec ambígua.** Anexo A do Requisitos v1.1 deveria ser atualizado
   para refletir essa decisão — sugerir a Renan em revisão futura.

### Alternativas consideradas

| Alternativa                                 | Por que rejeitada                                         |
| ------------------------------------------- | --------------------------------------------------------- |
| Timestamp humano `YYYYMMDD-HHmmss-<userid>` | Risco de colisão, drift contra `sprint_id`, menos preciso |
| Hash do payload (`sha256-<hash>.json`)      | Opaco para humanos, não ordenável                         |
| ULID truncado (`<first10ULID>-<userid>`)    | Perde unicidade garantida, não round-trip seguro          |

### Consequências

- Apps (Leader, Agent) rastreiam por nome de arquivo veem ULID em primeiro
  lugar. Scripts de debug podem decodificar o timestamp dos primeiros 10 chars
  do ULID se precisarem da hora legível.
- Requisitos v1.2 (futura) deve atualizar Anexo A para refletir este formato.
- Helpers `buildPendingFilename`/`buildAckFilename`/`buildCancelFilename` e
  `parseFilename` em `@sprint/contracts` materializam a convenção e fazem
  round-trip seguro.
- Filtros de UI ou logs que esperavam `YYYYMMDD-...` precisarão se adaptar — não
  há nenhum consumidor ainda (esta sessão é a primeira a tocar nomes).

### Referências

- Backlog BL-C1-003
- [ADR-005](#adr-005-schema-first-com-inferencia-de-tipos-via-zinfer)
- Requisitos Anexo A (a atualizar)
- ULID spec: <https://github.com/ulid/spec>

---

## ADR-007: Ratificação do baseline de versões instaladas vs Stack v1.0

- **Status:** Accepted
- **Data:** 2026-05-21
- **Decisores:** Renan (3Studio)
- **Endereça:** Auditoria de C0 (Sessão 02), FINDING-M1

### Contexto

O documento de Stack v1.0 (externo) define versões-alvo para o tooling do
monorepo: Node 20 LTS, pnpm 9.x, ESLint 9.x, TypeScript 5.4+, lint-staged 15.x,
etc. Durante o bootstrap (Sessão 01, BL-C0-004) o ambiente real do Renan
instalou versões majoritariamente mais recentes:

| Tecnologia  | Stack v1.0  | Instalado          |
| ----------- | ----------- | ------------------ |
| Node.js     | `>= 20 LTS` | `24.10.0` (.nvmrc) |
| pnpm        | `9.x`       | `10.18.2`          |
| TypeScript  | `5.4+`      | `6.0.3`            |
| ESLint      | `9.x`       | `10.4.0`           |
| lint-staged | `15.x`      | `17.0.5`           |
| Changesets  | `2.27+`     | `2.31.0`           |

Renan aceitou explicitamente durante a Sessão 01 (validado, sem regressão). O
`CLAUDE.md` §3 foi atualizado para refletir o instalado, mas o desvio nunca foi
formalmente ratificado em `DECISIONS.md`. A auditoria do C0 (Sessão 02) marcou
isso como **FINDING-M1 (Medium)** sugerindo um ADR.

### Decisão

**Ratificar o baseline de versões efetivamente instaladas como a verdade
operacional do projeto.** O Stack v1.0 vira referência histórica; o `CLAUDE.md`
§3 (mantido com as versões reais) é a fonte de verdade operacional até que Stack
v1.1 seja produzido externamente.

### Alternativas consideradas

1. **Downgrade forçado para o alvo Stack v1.0.** Custo de tempo, risco de
   quebrar o lockfile estável, sem ganho funcional.
2. **Aguardar Stack v1.1 externo antes de prosseguir.** Bloqueia waves
   subsequentes sem necessidade real.
3. **Reconhecer `CLAUDE.md` §3 como SoT operacional (esta decisão).** Custo
   zero. Stack externo é atualizado fora-de-banda.

### Consequências

- `CLAUDE.md` §3 é a fonte de verdade para versões do tooling. Atualizar
  manualmente quando um package for adicionado/atualizado.
- Novos devs / CI / ambientes de build devem usar Node 24.x e pnpm 10.x
  (refletidos em `.nvmrc` e `package.json engines`).
- Sem trigger automático de reavaliação. Stack v1.1 (externo) sincroniza com o
  que já está em produção — não bloqueia trabalho.
- Em caso de major bump futuro (ex.: Node 26 LTS sair, Electron 30 → 31), abrir
  ADR dedicado.
- Endereça **FINDING-M1** da auditoria v1 do C0. Marca a ressalva como fechada
  via ratificação formal.

### Referências

- `docs/audits/C0_AUDIT_REPORT_v1.md` — FINDING-M1
- `CLAUDE.md` §3 (Stack Tecnológica — versões reais)
- `.nvmrc` (Node 24.10.0), `package.json` engines
- Stack v1.0 externo (a virar v1.1 quando conveniente — não-bloqueante)

---

## ADR-008: Bundling Electron com vite-plugin-electron

- **Status:** Accepted
- **Data:** 2026-05-22
- **Decisores:** Renan (3Studio)

### Contexto

C2 (Leader) e C3 (Agent) precisam empacotar 3 entry points distintos (main
process, preload script, renderer) num único `.exe` Electron. O Vite (já adotado
para o renderer per Stack §11.3) não cobre main/preload nativamente — é
necessário um orquestrador que builde os três e ligue o fluxo de dev.

### Decisão

Adotar `vite-plugin-electron` + `vite-plugin-electron-renderer` como
orquestrador único de build dos 3 entry points, dirigido pelo `vite.config.ts`
do app.

### Alternativas consideradas

1. **Setup manual:** Vite só pro renderer, `tsc` separado pro main/preload,
   scripts npm orquestrando. Mais explícito, mas mais código de build e sem hot
   reload integrado.
2. **electron-vite framework** (electron-vite.org): opinionado, escopo além do
   necessário, lock-in maior.
3. **electron-forge** (oficial Electron): bom, mas exigiria migração custosa do
   electron-builder (já adotado em Stack §11.4).

### Consequências

**Aceitas:**

- Hot reload funciona end-to-end — renderer (HMR) e main/preload (restart);
  validado no smoke E2E da Sessão 06.
- Watch unificado num único `pnpm dev`.
- TypeScript em main/preload sem step de build separado; source maps inline no
  preload para debug.

**Trade-offs:**

- Lock-in com `vite-plugin-electron` (mantido pela electron-vite-org).
- A configuração do plugin tem peculiaridades (callbacks `onstart`) e
  **sobrescreve `rollupOptions.output.format`** — não dá para forçar o formato
  de um entry isolado por essa via.
- O preload sandboxado (`sandbox: true`, obrigatório CLAUDE.md §8.1) **tem de
  ser CommonJS**; com `"type": "module"` no `package.json` o plugin compila ESM
  e o preload quebra com _"Cannot use import statement outside a module"_. O app
  fica em CommonJS (sem `"type": "module"`). Descoberto no smoke E2E da Sessão
  06; ver CLAUDE.md §12 G-007.

### Referências

- Stack §11.3 (Vite), §11.4 (electron-builder)
- CLAUDE.md §8.1 (segurança Electron), §12 G-007
- BL-C2-001, BL-C3-001
- <https://github.com/electron-vite/vite-plugin-electron>

---

## ADR-009: IPC contract-first com tipos compartilhados main↔renderer

- **Status:** Accepted
- **Data:** 2026-05-22
- **Decisores:** Renan (3Studio)

### Contexto

Em Electron com `contextIsolation` + `sandbox` (CLAUDE.md §8.1), main e renderer
são contextos distintos. A comunicação é exclusivamente via IPC + preload. Sem
disciplina, isso vira "anything goes" com canais `string` e payloads não tipados
— fonte clássica de bugs sutis em Electron.

### Decisão

Adotar **IPC contract-first**:

1. Tipos das APIs definidos em `src/shared/ipc-types.ts` (por app).
2. O preload implementa o tipo e expõe via
   `contextBridge.exposeInMainWorld('api', impl)`.
3. O renderer declara `Window['api']: LeaderAPI` em `env.d.ts`.
4. O main implementa handlers via `ipcMain.handle(channel, ...)`.
5. Nomes de canais = nomes de métodos do tipo (1-para-1).

### Alternativas consideradas

1. **tRPC over IPC:** muito poder, overhead desproporcional à escala do projeto.
2. **Strings cruas + validação manual:** exatamente o que se quer evitar.
3. **electron-trpc** ou similares: dependência adicional pouco justificada para
   os ~10-15 endpoints do MVP.

### Consequências

**Aceitas:**

- Type-safety end-to-end (main, preload, renderer).
- Refactor de assinatura captura automaticamente desalinhos.
- Documentação implícita via JSDoc em `ipc-types.ts`.

**Trade-offs:**

- A validação runtime ainda é responsabilidade do dev (no preload). Recomenda-se
  validar payloads via Zod (disponível em `@sprint/contracts`) em W1+, quando
  surgirem endpoints de dispatch real.
- Os tipos IPC vivem dentro de cada app, não em `@sprint/contracts` — decisão
  consciente, porque o bridge IPC é específico de cada app (Leader e Agent não
  compartilham bridge).

### Referências

- CLAUDE.md §8.1 (segurança Electron)
- Stack §5.1
- BL-C2-001, BL-C3-001
- <https://www.electronjs.org/docs/latest/tutorial/context-isolation>

---

## ADR-010: Upgrade do Electron para a linha 42.x (remediação FINDING-001)

- **Status:** Accepted
- **Data:** 2026-05-22
- **Decisores:** Renan (3Studio)
- **Endereça:** Auditoria v1 do C2, FINDING-001

### Contexto

A auditoria v1 do C2 (FINDING-001, severidade High, dimensão D5) reportou que
`pnpm audit` acusava 10 advisories High no projeto: **4 em `electron`**
(runtime, embarcado no produto) e **6 em `tar`** (dependência transitiva de
build-time, via `electron-builder` → `app-builder-lib`).

Os 4 de `electron` — três use-after-free (offscreen child window paint;
WebContents fullscreen / pointer-lock / keyboard-lock; PowerMonitor) e uma
injeção de switches de linha de comando no renderer — não têm correção na linha
30.x. A versão fixada pelo ADR-002 (Electron 30.x) só é patcheada desses
advisories a partir de ≥ 38.8.6 / ≥ 39.8.1: exige bump de major.

Os 6 de `tar` não têm patch na linha 6.x (instalada: 6.2.1) — a correção só
existe na linha 7.5.x.

### Decisão

**Runtime — Electron 30.5.1 → 42.2.0.** Adotar a última estável do Electron
(42.2.0) como nova versão-alvo, em vez do mínimo ≥ 39.8.1 sugerido pelo
relatório. O Electron mantém suporte de segurança apenas para os 3 majors mais
recentes (no momento, 42/41/40); fixar em 39.x faria o C2 nascer fora da janela
de suporte e uma re-auditoria reabriria o tema de imediato. O scaffold do C2 usa
apenas APIs estáveis do Electron (`BrowserWindow`, `webPreferences`,
`ipcMain.handle`, `contextBridge`, ciclo de vida do `app`, `will-navigate`,
`setWindowOpenHandler`), então o salto 30 → 42 não exigiu mudança de código nem
de toolchain (`electron-builder`, `vite-plugin-electron`).

**Build-time — `tar` `^7.5.11` via `pnpm.overrides`.** Forçar `tar` para a linha
7.5.x (resolvido: 7.5.15) no `package.json` raiz, eliminando os 6 advisories de
path traversal / symlink poisoning. `tar` é dependência exclusivamente de
build-time (extração de tarballs no `electron-builder`) — não embarca no
produto.

Resultado: `pnpm audit --audit-level=high` passou de 10 High para **0 High / 0
Critical**.

Esta decisão **atualiza a versão-alvo do Electron definida no ADR-002**, que
permanece válido quanto à escolha do Electron como runtime desktop (vs.
Tauri/WPF/etc.) — muda apenas o número da versão.

### Alternativas consideradas

1. **Manter Electron 30.x e aceitar o risco residual.** Sugerido pelo relatório
   como opção de curto prazo. Rejeitada: deixaria 4 CVEs High em código
   embarcado no produto, sem caminho de patch na linha 30.x.
2. **Subir apenas para 39.8.1 (mínimo do relatório).** Limpa os advisories
   atuais, mas a linha 39.x já está fora da janela de suporte de 3 majors do
   Electron — débito de segurança imediato.
3. **Patchar a linha 6.x do `tar`.** Inviável — o node-tar não fez backport das
   correções para a 6.x; só existem na 7.5.x.
4. **Adiar FINDING-001 para um spike de plataforma dedicado.** Avaliada na
   triagem desta remediação; Renan optou por remediar agora, no mesmo fluxo.

### Consequências

- O C2 passa a rodar Electron 42.x, dentro da janela de suporte de segurança do
  Electron.
- O C3 (Operator Agent), que espelhará a arquitetura do C2, já deve nascer em
  Electron 42.x — não herda o débito do 30.x.
- `pnpm.overrides` no `package.json` raiz vira ponto de manutenção: ao atualizar
  o `electron-builder` no futuro, revisar se o override de `tar` ainda é
  necessário.
- A validação de que o `electron-builder` empacota o `.exe` com `tar` 7 e
  Electron 42 depende do CI (`build-leader.yml`) — `pnpm package` não roda
  localmente pelo bloqueio do ESET (CLAUDE.md §12 G-009).
- Atualizações futuras do Electron seguem a cadência de 3 majors: quando o C2/C3
  saírem da janela de suporte, abrir novo ADR de bump.
- Restam 3 advisories moderate transitivos (abaixo do limiar High do
  FINDING-001) — não-bloqueantes, ficam como débito monitorável.

### Referências

- `docs/audits/C2_AUDIT_REPORT_v1.md` — FINDING-001
- [ADR-002](#adr-002-electron-como-runtime-desktop) — escolha do Electron como
  runtime (versão-alvo atualizada por este ADR)
- `apps/leader/package.json` (`electron` `^42.2.0`); `package.json` raiz
  (`pnpm.overrides.tar`)
- Electron security / release cadence:
  <https://www.electronjs.org/docs/latest/tutorial/electron-timelines>

---

## ADR-011: Arquitetura tray-resident do Operator Agent

- **Status:** Accepted
- **Data:** 2026-05-25
- **Decisores:** Renan (3Studio)

### Contexto

O Operator Agent (C3) não tem UI estacionária — diferente do Leader (C2), que
tem janela principal onde o líder compõe sprints. O Agent precisa ficar sempre
rodando em background na estação do operador, esperando sprints chegarem via
polling (W1+). Quando chega uma sprint, exibe um overlay TOPMOST temporário;
quando o operador dá ack ou cancel, o overlay fecha.

Pergunta arquitetural: como o app fica "vivo" sem janela aberta?

### Decisão

Adotamos **arquitetura tray-resident**:

1. O main process inicia e cria o tray icon (única interface persistente).
2. **Não cria janela principal** — o overlay é criado/destruído sob demanda
   (W1+).
3. `app.on('window-all-closed', () => { /* não chama app.quit() */ })` — basta
   **subscrever** ao evento; só de existir o listener, o quit automático do
   Electron é cancelado. **O evento `window-all-closed` NÃO recebe `event` nem
   suporta `preventDefault()`** (tipagem `() => void` no Electron 42; ver
   CLAUDE.md §12 G-013).
4. Único caminho de quit: menu da tray → "Sair", ou `app.quit()` programático.
5. Single instance lock via `app.requestSingleInstanceLock()` é obrigatório —
   acks duplicados de múltiplas instâncias invalidariam tracking.

### Alternativas consideradas

1. **Janela principal escondida (`show: false` permanente):** funciona mas
   desperdiça recursos (RAM alocada) e o operador pode acidentalmente abri-la
   via taskbar (mesmo com `skipTaskbar: true`).
2. **Processo background no Windows sem tray:** mais "puro" mas perde a tray
   (interface visual mínima que o operador precisa para ver status e sair).
3. **Headless via CLI + tray separado:** complexidade desnecessária pro MVP.

### Consequências

**Aceitas:**

- App leve em RAM (sem janela principal alocada).
- UX clara: tray = "está rodando"; sem tray = "fechei".
- Single instance lock previne classe inteira de bugs (acks duplicados, polling
  concorrente, tray duplicada).
- Overlay temporário e descartável (criado/destruído por evento em W1+).

**Trade-offs:**

- Tray icon obrigatório — sistemas sem tray (alguns Linux DEs) não suportariam.
  Não é problema para o escopo Windows da fábrica.
- O listener de `window-all-closed` é **load-bearing**: deletar o listener faz o
  app encerrar automaticamente quando a última janela fechar (default do
  Electron). Documentado inline no `index.ts` e em G-013.

### Referências

- CLAUDE.md §8.1 (segurança Electron), §12 G-013 (window-all-closed)
- Requisitos RF-07 (overlay temporário)
- ADR-002 (Electron como runtime)
- BL-C3-001 (scaffold do Agent)

---

## ADR-012: Loader de config.json com fail-fast validation

- **Status:** Accepted
- **Data:** 2026-05-25
- **Decisores:** Renan (3Studio)

### Contexto

O Operator Agent lê `config.json` da estação ao iniciar (Requisitos Anexo F). O
arquivo contém `user_id`, `hostname`, `shared_path`, `polling_interval_seconds`,
etc. — dados críticos para identificar a estação no fluxo de sprints.

Comportamentos possíveis quando o arquivo está ausente, mal-formado, ou fora do
schema:

- (a) Auto-criar template default e prosseguir.
- (b) Falhar com mensagem clara e sair.
- (c) Mostrar UI de setup inicial.

### Decisão

Adotamos **(b) fail-fast com diálogo informativo + erros tipados**:

1. O loader retorna config válido OU lança um `ConfigError` tipado. Quatro
   subclasses cobrem os modos de falha:
   - `ConfigNotFoundError` (ENOENT)
   - `ConfigReadError` (outros erros de I/O — permissão, EISDIR, etc.)
   - `ConfigJsonError` (JSON inválido)
   - `ConfigInvalidError` (JSON válido mas schema violado)
2. O main process captura o erro → `dialog.showErrorBox(title, content)` com a
   mensagem específica + o caminho do config → `app.quit()`.
3. **Sem auto-criação, sem retry, sem fallback silencioso.**
4. Validação via **`safeParseAgentConfig`** (parser não-lançador do
   `@sprint/contracts`) em vez de `parseAgentConfig`+`try/catch`+`instanceof`.
   Elimina um ramo defensivo
   (`if (!instanceof ContractValidationError) throw err`) que `parseAgentConfig`
   nunca exercita — branch inalcançável, não-testável, derruba coverage.
5. Config cacheado em memória (`configCache: AgentConfig | null`); mudança no
   arquivo exige restart do app.

### Alternativas consideradas

1. **(a) Auto-criar template:** requer saber valores que dependem do contexto
   (`user_id`, `hostname`, `shared_path`). Auto-criar com `user_id: "TBD"` seria
   pior do que falhar — o operador rodaria com identidade errada.
2. **(c) UI de setup inicial:** legítimo para UX mas é trabalho de W2+ (lá vai
   virar uma janela de configuração acessível pelo menu da tray). Em W0,
   fail-fast é determinístico.

### Consequências

**Aceitas:**

- Comportamento previsível (mesmo erro = mesma mensagem específica).
- Diagnóstico fácil: o operador vê o path e a mensagem, copia para suporte.
- Defensive parsing — o Zod cobre todos os edge cases (`user_id` vazio,
  `polling_interval_seconds` fora de 1..60, campo extra com `.strict()`, etc.).
- Cobertura: `config.ts` 100% lines/branches/funcs (13 testes unitários,
  incluindo EISDIR via config-como-diretório); `single-instance.ts` 100% (2
  testes).

**Trade-offs:**

- UX pior na primeira execução (sem auto-setup). Mitigação: o instalador pode
  criar `config.example.json` em `/sprint-operator-agent/` e a documentação pede
  ao operador renomear/preencher.
- Cache em memória — config lido uma vez no boot; mudança exige restart.
  Aceitável para MVP; W2+ pode adicionar reload via menu da tray.

### Padrão de I/O estabelecido

Este é o **primeiro código de produção do projeto com I/O em filesystem**. Usa
`fs/promises` direto, marcado com `TODO(C4)` para refatoração quando C4
(`@sprint/fs-adapter`) for entregue. A intenção: `loadAgentConfig` passa a usar
`IFilesystemAdapter.readFile` em vez de `fs.readFile` direto, mantendo a mesma
interface externa e os mesmos `ConfigError`s.

### Defense-in-depth no IPC

O handler `getConfig` (em `main/index.ts`) NÃO retorna o `AgentConfig` inteiro
ao renderer — retorna apenas um **`SafeAgentConfigView`** (`user_id`,
`user_nome_exibicao`, `hostname`). O renderer não precisa de `shared_path`,
`polling_interval_seconds` nem `log_level`, e expor menos é defesa em
profundidade caso o overlay seja comprometido em W1+.

### Referências

- Requisitos Anexo F (schema AgentConfig)
- ADR-005 (schema-first com `z.infer`)
- `packages/contracts/README.md` (recomendação de `safeParse*` para "validação
  como parte do fluxo normal" / "arquivos potencialmente corrompidos")
- CLAUDE.md §12 G-014 (TS6059 cross-package source-first), G-015 (`vi.mock`
  hoisting)
- BL-C3-002 (loader)
- BL-C4-001 (interface `IFilesystemAdapter` — futuro)

---

## ADR-013: Filesystem Adapter port-and-adapter (hexagonal)

- **Status:** Accepted
- **Data:** 2026-05-25
- **Decisores:** Renan (3Studio)

### Contexto

Consumers (Leader, Agent) precisam fazer I/O em filesystem (config local da
estação, pasta compartilhada SMB, arquivo histórico). Acoplar consumers
diretamente a `fs/promises` torna testes lentos (cada teste precisaria de tmpdir
real) e flaky (concorrência de arquivos, permissões variáveis entre máquinas).
Também dificulta substituições futuras (ex.: storage remoto, S3, ou versão
diferente do filesystem com cache).

O primeiro consumer de I/O do projeto — o loader de `config.json` do Operator
Agent (BL-C3-002, Sessão 09) — usa `fs/promises` direto marcado com `TODO(C4)`.
ADR-012 estabelece esse uso como provisório até C4 entregar.

### Decisão

Adotar padrão **port-and-adapter (hexagonal)**:

1. **`IFilesystemAdapter` é o port** — interface no domínio com 8 operações
   primitivas: `readFile`, `writeFileAtomic`, `listDir`, `exists`, `rename`,
   `unlink`, `mkdir`, `stat`.
2. **`NodeFilesystemAdapter` é o adapter de produção** — implementação real
   usando `node:fs/promises` + `node:crypto.randomBytes` (sufixo aleatório no
   `.tmp` para isolar escritas concorrentes).
3. **`MemoryFilesystemAdapter` é o adapter de teste** — implementação in-memory
   (`Map<string, MemoryFileEntry>`), diretórios implícitos, helpers `seed()` e
   `reset()` para fixtures.
4. **Operações de domínio** (`writePendingSprint`, `listAcks`, `moveToArchive`,
   `writeAck`, `writeCancel`, etc.) ficam em **módulos separados** que recebem
   `IFilesystemAdapter` como dependência — não entram na interface.
   BL-C4-002..005 (W1) entregarão esses módulos.
5. **`writeFileAtomic` é método do adapter** (não helper externo) porque
   atomicidade depende da implementação concreta: Node faz
   `open → writeFile → fsync → rename` com sufixo aleatório no `.tmp`; Memory é
   trivialmente atômico (Map.set).
6. **`exists` não lança exceção** — retorna `false` em qualquer erro (ENOENT,
   EACCES, path inválido). Caso especial pragmático para checks rápidos. Outros
   métodos lançam `FilesystemError` concreto via `instanceof` para forçar
   tratamento explícito.
7. **Suite de contrato compartilhada** — `describeContract(name, setup)` roda os
   mesmos testes contra ambos os adapters. Se um teste passa em um adapter mas
   falha no outro, há divergência comportamental.

### Alternativas consideradas

1. **Acoplamento direto a `fs/promises` em consumers** (estado atual de
   BL-C3-002, marcado com `TODO(C4)`): mais simples inicialmente, mas testes
   ficam lentos e dependentes de tmpdir/permissions. O ADR-012 já estabelece
   esse acoplamento como provisório.
2. **Adapter com operações de domínio na interface** (`writePendingSprint` etc.
   como métodos): viola separação de responsabilidades — adapter conheceria
   SprintPayload, schemas, semântica de pasta compartilhada. Acoplamento alto
   entre I/O e domínio.
3. **Apenas mock manual via Vitest:** menos disciplinado, fácil de criar
   discrepâncias entre mock e fs real (drift). Suite de contrato compartilhada
   elimina essa classe de bug.
4. **`writeFileAtomic` como helper externo** que recebe `IFilesystemAdapter` e
   chama métodos primitivos: impossível em prática — atomicidade requer `fsync`
   em handle aberto, que não é exposto pela interface (e expor `FileHandle`
   quebraria a abstração).

### Consequências

**Aceitas:**

- Testes de consumers podem usar `MemoryFilesystemAdapter` — instantâneos e
  isolados. Sem tmpdir, sem cleanup async, sem flakiness por concorrência de
  filesystem.
- Adapter substituível (futuro: S3, http storage, etc.) sem tocar em consumers.
- Operações de domínio (W1) testáveis isoladamente — recebem
  `IFilesystemAdapter` mockável.
- Suite de contrato compartilhada garante paridade entre adapters; novos
  adapters (futuros) só são "completos" quando passam a suite.

**Trade-offs:**

- Mais código (interface + 2 implementações + helpers + suite vs. uma chamada
  `fs.readFile`). Pagamento amortizado conforme W1+ adiciona consumers.
- **`MemoryFilesystemAdapter` tem semântica de "diretório implícito"** que
  difere ligeiramente de filesystem real: diretórios sem filhos não existem. Em
  consumers, isso é OK porque sempre criamos arquivo dentro do dir antes de
  listar. Caller deve `mkdir(parent)` antes de `writeFileAtomic` em paths
  aninhados (pelo contrato — Node exige; Memory é no-op idempotente).
- **`writeFileAtomic` em diretório pai inexistente lança `FileNotFoundError`**
  (não `FilesystemIOError`). `mapError` é genérico e mapeia ENOENT
  consistentemente. JSDoc documenta esse comportamento.

### Padrão de escrita atômica (Node)

```
open(tmp = `${path}.${randomBytes(6).hex}.tmp`, 'w')
  → handle.writeFile(content, 'utf-8')
  → handle.sync()       // fsync força flush ao disco
  → handle.close()
  → fs.rename(tmp, path)
```

**Por que `fsync` é crítico:** sem ele, o sistema operacional pode estar
bufferizando os dados na RAM no momento do rename. Crash mid-rename poderia
resultar em arquivo final apontando para inode com conteúdo zerado. Com `fsync`,
garantimos que dados estão no disco antes do rename atômico.

**Por que sufixo aleatório no `.tmp`:** sem ele, 2 writers concorrentes ao mesmo
destino colidem no `.tmp` compartilhado — a rename de um remove o `.tmp` do
outro, causando `ENOENT` errático. Sufixo aleatório (6 bytes hex = 48 bits de
entropia) isola escritas concorrentes.

### Método novo da Wave 0 aplicado

Esta é a **primeira sessão sob o método novo de auto-validação** — sem
audit/remediation separadas (que tínhamos em C0-C3). Auto-validação interna na
Fase 8 substituiu auditoria externa, com 15 checks inspecionados pelo próprio
executor. Resultado: 15/15 ✅. Tempo total estimado ~70% menor que o padrão de 3
sessões.

### Referências

- BL-C4-001 (interface + erros), BL-C4-006 (Memory), BL-C4-007 (Node)
- ADR-005 (schema-first) — `@sprint/contracts` é peer, não dependência
- ADR-012 (loader fail-fast) — primeiro consumer marcado `TODO(C4)`
- `packages/fs-adapter/README.md`
- Alistair Cockburn, "Hexagonal Architecture" (2005)

---

## ADR-014: Sanitização de body_html via isomorphic-dompurify

- **Status:** Accepted
- **Data:** 2026-05-25
- **Decisores:** Renan (3Studio)

### Contexto

O `SprintPayload` carrega um campo `body_html` (Requisitos RF-17) com o conteúdo
do aviso que o operador verá no overlay. O líder digita HTML — em produção, é
formatação simples (negrito, itálico, quebra de linha, parágrafo). Sem
sanitização, o campo é uma superfície clássica de XSS: handlers inline
(`onerror`, `onmouseover`, …), schemes perigosos (`javascript:`, `data:` em
`<a>`), tags executáveis (`<script>`, `<svg>+onload`, `<iframe>`,
`<style>+url(javascript:)`). RNF-18 explicita defesa contra injeção; RN-10
estabelece a whitelist de tags válidas.

O schema Zod **deliberadamente não sanitiza** (decisão arquitetural antecipada
em `schemas/security.test.ts`, BL-C1-002 W0): aceita qualquer string em
`body_html` para preservar separação de responsabilidades. Sanitização é uma
operação distinta, com biblioteca dedicada.

### Decisão

Adotamos **`isomorphic-dompurify` ^2.36.0** como dependência única de
sanitização do `@sprint/contracts`, exposta via função pura
`sanitizeBodyHtml(html: string): string`:

1. **Whitelist estrita** derivada de `ALLOWED_HTML_TAGS` (constante já existente
   desde BL-C1-006 W0, com mesmo conteúdo proposto pela RN-10): `<b>`, `<i>`,
   `<br>`, `<p>`, `<h1>`, `<span>`. **Não criamos `ALLOWED_BODY_TAGS`
   redundante** — fonte única.
2. **Atributos: zero permitidos** (`ALLOWED_ATTR: []`). Defesa máxima contra
   handlers inline (`on*=`), `style: url(javascript:...)` e `href: javascript:`.
   Nem `class` nem `id` passam.
3. **`KEEP_CONTENT: true`** — texto dentro de tags removidas é preservado.
   Exemplo: `<div>texto</div>` → `texto`.
4. **`ALLOW_DATA_ATTR: false`** e **`ALLOW_UNKNOWN_PROTOCOLS: false`** — rejeita
   `data-*` e schemes não-padrão.
5. **`RETURN_TRUSTED_TYPE: false`** — retorno `string`, compatível com
   `JSON.stringify` para serialização em `pending/`.
6. **`USE_PROFILES` omitido** — desvio do prompt original do BL-C1-004 (§6.2).
   Razão: na versão atual do DOMPurify, `USE_PROFILES: { html: true }`
   **sobrescreve** `ALLOWED_TAGS` com o profile HTML completo (validado contra
   doc oficial e contra testes adversariais). A whitelist explícita é mais
   restritiva. Validado empiricamente: testes com `<div>`, `<table>`,
   `<unknown>` confirmam que essas tags são removidas (e seus filhos
   preservados) — com `USE_PROFILES` ativo, passariam.

A função é **pura, idempotente**
(`sanitizeBodyHtml(sanitizeBodyHtml(x)) === sanitizeBodyHtml(x)`) e
**isomórfica** (funciona em main process Node e em renderer browser-like, via
`isomorphic-dompurify` que carrega `dompurify` nativo no browser e usa `jsdom`
no Node).

### Defesa em profundidade

Sanitização é aplicada **duas vezes** no fluxo, com a mesma rotina:

1. **Leader (escrita)** — antes de gravar `pending/<sprintId>-<userId>.json`
   (BL-C2-007, W1).
2. **Agent (leitura)** — antes de renderizar `body_html` no overlay (BL-C3-004,
   W1).

A idempotência garante que o segundo passe não muta o output do primeiro. Se um
arquivo for adulterado em trânsito (alguém com acesso a `pending/` editando
manualmente), o Agent re-sanitiza e neutraliza.

### Alternativas consideradas

| Alternativa                                        | Por que rejeitada                                                                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementação própria (regex / parser ad-hoc)**  | Superfície de ataque grande; mXSS, parser quirks de browsers, bypasses conhecidos (`<<script>script>...`). Rolar do zero é anti-padrão de segurança. |
| **`sanitize-html`**                                | API menos ergonômica, adoção menor, menos auditado que DOMPurify.                                                                                    |
| **DOMPurify puro (sem wrapper isomorfo)**          | Requer mock manual de DOM/JSDOM no main process Node (Electron). Wrapper isomorfo elimina overhead de setup.                                         |
| **Escapar tudo manualmente (`innerHTML` → texto)** | Perde formatação que o líder genuinamente quer (negrito, parágrafo). RN-10 já reconhece que algumas tags são necessárias.                            |

### Consequências

**Aceitas:**

- Defesa robusta contra XSS via biblioteca auditada (DOMPurify é o padrão de
  facto, usado por GitHub, npm, Slack, e milhares de outros).
- Função pura — testável isoladamente, sem dependência de DOM real (40 testes
  adversariais em `sanitize.test.ts`, cobertura 100%).
- Defesa em profundidade trivial — mesma função, dois pontos de aplicação.
- Adição de footprint runtime: `dompurify` ~681 KB no `node_modules` + jsdom ~4
  MB (só no Node side). No bundle final do Leader/Agent, jsdom é tree-shaken
  pelo Vite (renderer = browser).

**Trade-offs:**

- Bibliotecas de sanitização evoluem: novos vetores XSS aparecem; é necessário
  manter `isomorphic-dompurify` atualizado. **Disparador de revisão:** quando
  `pnpm audit` reportar advisory High em `dompurify`/`isomorphic-dompurify`,
  bump imediato (mesmo padrão do ADR-010 para Electron).
- A whitelist de 6 tags é restritiva — se o líder pedir suporte a `<ul>/<li>`,
  `<a>`, `<img>`, etc no futuro, expandir exige bump em RN-10 e em
  `ALLOWED_HTML_TAGS` (e bump do `SCHEMA_VERSION` se a expansão for
  incompatível).

### Referências

- BL-C1-004 (esta sessão)
- BL-C1-006 (constante `ALLOWED_HTML_TAGS` já existente)
- BL-C2-007 (integração no Leader, W1)
- BL-C3-004 (integração no Agent, W1)
- Requisitos RF-17 (sanitização), RN-10 (whitelist), RNF-18 (defesa XSS)
- ADR-005 (schema-first) — schema deliberadamente não sanitiza
- `packages/contracts/src/sanitize.ts`
- `packages/contracts/src/schemas/security.test.ts` (afirmação arquitetural
  prévia de que schema não sanitiza)
- <https://github.com/cure53/DOMPurify>
- <https://github.com/kkomelin/isomorphic-dompurify>

---

## ADR-015: Arquitetura do composer da app Líder (W1.C2 parte 1)

- **Status:** Accepted
- **Data:** 2026-05-25
- **Decisores:** Renan (3Studio)

### Contexto

A primeira sessão de UI real do Leader (BL-C2-002/003/004/005/011) precisa
entregar o composer de sprint — tela "Nova Sprint" com lista de operadores,
metas individuais, deadline e botão Enviar — antes de C4 (`@sprint/fs-adapter`)
disponibilizar as operações de domínio (BL-C4-002..005). O dispatch real
(BL-C2-007) fica para a parte 2, depois de C4 entregar `writePending`.

Várias decisões arquiteturais precisaram ser tomadas em conjunto: roteamento em
Electron, gerenciamento de estado, padrão de validação, localização do tipo
`Operator`, e estratégia para o botão "Enviar" enquanto o dispatch real não
existe.

### Decisões

1. **React Router em modo hash (`<HashRouter>`)** — o build de produção do
   Electron carrega via `file://`, incompatível com `<BrowserRouter>` (history
   API). Hash mode resolve sem proxy/middleware. 3 rotas: `/nova`,
   `/acompanhamento` (placeholder W2), `/historico` (placeholder W3) +
   `<Navigate>` em `/` e `*` para `/nova`.
2. **Zustand para estado global, com selectors puros separados** —
   `useSprintComposerStore` (draft: operadores+metas+deadline+title+body) e
   `useOperatorsStore` (cache da lista). Selectors (`selectIsValid`,
   `selectSelectedCount`, `selectFormPayload`) são funções top-level fora do
   `create()`, recebem state e retornam derivações sem side effects. Lógica
   derivada **não** é armazenada — sempre derivada via selector.
3. **`composerFormSchema` (Zod) como fonte única de regras de forma** — alinhado
   com schema-first ADR-005. `selectIsValid` delega para
   `selectFormPayload(state) !== null`. Validação dispersa fica em um único
   lugar, e o output do schema é o payload pronto para escrita em `pending/`
   quando BL-C2-007 ativar o dispatch.
4. **Não usar `react-hook-form` + `@hookform/resolvers`** — desvio explícito da
   § 6.4 do prompt da sessão. Justificativa em "Alternativas rejeitadas" abaixo.
5. **Tipo `Operator` definido localmente em
   `apps/leader/src/renderer/types/operator.ts`** com TODO inline para promover
   para `@sprint/contracts` quando C3 (Agent) ou C4 (read real via fs-adapter)
   também precisarem. Mantém C1 congelado em W1.
6. **Mock `data/operators.mock.ts`** com 5 operadores (4 ativos + 1 inativo
   `rafael` para exercitar filtro de `ativo: true`). Substituído por leitura
   real de `operators.json` via `@sprint/fs-adapter` em refactor de BL-C2-003
   após C4 completar W1.
7. **Flag `DISPATCH_ENABLED = false`** em `routes/NovaSprint/NovaSprint.tsx`
   controla o botão "Enviar" — `disabled = !DISPATCH_ENABLED || !isFormValid`.
   Tooltip estático aponta para BL-C2-007. Handler é `console.warn` stub
   (permitido pela regra atual
   `no-console: ['error', { allow: ['warn', 'error'] }]`). **Remover a flag e
   substituir o handler em BL-C2-007.**

### Alternativas rejeitadas

| Alternativa                                                        | Por que rejeitada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<BrowserRouter>`                                                  | Incompatível com `file://` no build de produção do Electron.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Redux Toolkit                                                      | Overkill para o escopo; Zustand cobre com API mínima e menos boilerplate. ADR-007/stack §6.2 já preferia Zustand.                                                                                                                                                                                                                                                                                                                                                                                     |
| `useState` local nas telas                                         | Re-render desnecessário ao navegar entre rotas; perderia persistência inter-rotas. Antecipar Zustand evita refactor.                                                                                                                                                                                                                                                                                                                                                                                  |
| **`react-hook-form` + `zodResolver`** (proposto pelo prompt § 6.4) | Composer dinâmico com lista de N operadores exigiria `useFieldArray` + sincronização store ↔ form em `useEffect` (dual-source-of-truth frágil). A store Zustand já é fonte única; `composerFormSchema` valida; `aria-invalid` + mensagem inline cobrem UX de erro. RHF brilha em forms estruturados (login, settings), não em composer dinâmico. **Reavaliar** quando BL-C2-006 (W2) trouxer customização de title/body via editor rico — para campo único e estruturado, o benefício de RHF é maior. |
| `Operator` em `@sprint/contracts` agora                            | C1 congelado em W1; nenhum consumer cross-component existe ainda. Promover quando C3/C4 também precisarem (ver "Decisão 5").                                                                                                                                                                                                                                                                                                                                                                          |
| `date-fns` para `isDeadlineInPast`                                 | Função trivial (~10 linhas com `Date.setHours()` nativo); evita dep para "passado vs futuro".                                                                                                                                                                                                                                                                                                                                                                                                         |
| `lucide-react` no Sidebar/botões                                   | Sidebar e BulkSelectButtons usam texto puro nesta sessão. Ícones só viram necessidade em W2+ (polish).                                                                                                                                                                                                                                                                                                                                                                                                |

### Consequências

- **App navegável end-to-end** — Nova Sprint, Acompanhamento (placeholder),
  Histórico (placeholder) renderizam e a sidebar persiste.
- **Composer 100% funcional EXCETO pelo dispatch** — usuário pode marcar
  operadores, preencher metas, mudar deadline, ver `aria-invalid` em campos
  inválidos, ver status dinâmico ("Pronto para enviar"). Botão Enviar permanece
  desabilitado mesmo com tudo válido (DISPATCH_ENABLED=false).
- **Refactor previsto em BL-C2-007 (parte 2)**: substituir mock por fs-adapter;
  remover flag DISPATCH_ENABLED; substituir `console.warn` do handler pelo
  dispatch real via `selectFormPayload` + `writePendingSprint`.
- **Stores 100% cobertura individual; agregado puxado para 93% pelo barrel
  `index.ts`**. Componentes 96-100% individuais; rotas 93-100%. Cobertura
  agregada do `sprint-leader`: ~96.6%.
- **Padrão de selectors puros estabelecido** — repetível em futuras stores do
  projeto. Documentado em CLAUDE.md §4 ("Estrutura interna do Leader").
- **Padrão de teste de componente estabelecido** —
  `@testing-library/{react,user-event,jest-dom}` como devDeps + `test-setup.ts`
  com cleanup automático. Próximas sessões herdam.
- **Acessibilidade básica aplicada** — `<label htmlFor>` em todos os inputs,
  `aria-invalid` + `aria-describedby` no input de meta, `role="alert"` no
  warning de deadline, `role="group"` no BulkSelectButtons, foco visível
  (outline) em todos os elementos interativos.

### Reabertura prevista

- **Flag `DISPATCH_ENABLED`**: removida em BL-C2-007 (parte 2 desta sessão).
- **Tipo `Operator`**: promover a `@sprint/contracts` quando o primeiro consumer
  cross-component (C3 ou C4 real) precisar — sessão dedicada, fix de 1 commit
  (mover + re-exportar + atualizar import no Leader).
- **Mock `operators.mock.ts`**: substituído por leitura via `@sprint/fs-adapter`
  em refactor de BL-C2-003 após C4 completar W1.
- **`react-hook-form`**: reavaliar em BL-C2-006 (W2) quando customização de
  title/body via editor rico entrar.

### Referências

- Backlog BL-C2-002, BL-C2-003, BL-C2-004, BL-C2-005, BL-C2-011
- Backlog BL-C2-007 (dispatch real, parte 2 desta sessão — bloqueado por
  BL-C4-002..005)
- ADR-005 (schema-first com `z.infer`) — `composerFormSchema` segue o padrão
- ADR-013 (filesystem adapter port-and-adapter) — futuro consumer em BL-C2-007
- ADR-014 (sanitização de `body_html`) — `sanitizeBodyHtml` integra no BL-C2-007
  antes da escrita em `pending/`
- CLAUDE.md §4 ("Estrutura interna do Leader") — convenção de pastas e padrões
  específicos
- CLAUDE.md §12 G-014 — débito `rootDir` do Leader (fix de 1 linha pré-requisito
  para BL-C2-007)

---

## ADR-016: Domain layer do `@sprint/fs-adapter` (W1)

- **Status:** Accepted
- **Data:** 2026-05-25
- **Decisores:** Renan (3Studio)

### Contexto

ADR-013 (W0) estabeleceu o port-and-adapter hexagonal e prometeu que operações
de domínio (`writePendingSprint`, `listAcks`, `moveToArchive`, etc.) ficariam em
**módulos separados** em W1+, fora da interface `IFilesystemAdapter`. Este ADR
documenta como esses módulos foram materializados em BL-C4-002, BL-C4-003 e
BL-C4-006 — junto com stubs explícitos para BL-C4-004 (W2) e BL-C4-005 (W3).

### Decisão

Adotamos **4 stores em `src/domain/`** — `PendingStore`, `AckStore`,
`CancelStore`, `ArchiveStore` — cada um com **construtor uniforme**
`(adapter: IFilesystemAdapter, sharedPath: string)`. Características
compartilhadas:

1. **Path arithmetic via `path.posix.join`** — Windows aceita ambos os
   separadores; uniformidade elimina drift entre Linux CI, Windows dev e Memory
   adapter (que normaliza só `/`, ver G-019).
2. **Defense-in-depth via Zod**: `writePendingSprint`/`writeAck` re-validam via
   `parseSprintPayload`/`parseSprintAck` antes de gravar. Captura callers que
   façam `as SprintPayload` cast bypass — erro vira `ContractValidationError`,
   não `FilesystemError`.
3. **Sanitização de `body_html` em `writePendingSprint`** (CLAUDE.md §7.9 e
   ADR-014). Idempotente — chamada nunca quebra um payload já sanitizado.
4. **`mkdir(parent)` antes de cada `writeFileAtomic`** — segue G-018. Node cria
   recursivo idempotente; Memory é no-op.
5. **JSON pretty-printed** (`null, 2`) — pasta compartilhada é inspecionada
   manualmente pela TI via `notepad`/`type`. ~30% mais bytes, ganho de
   debuggability supera o custo.
6. **`listPending`/`listAcks` aplicam RN-09**: arquivos malformados viram
   `kind: 'invalid'` em vez de lançar. Só `DirectoryNotFoundError` (pasta
   inexistente) propaga.
7. **Race-safe**: `FileNotFoundError` no `stat` ou `readFile` (arquivo
   desaparece entre `listDir` e a próxima chamada) é skipado silenciosamente.
   Outros `FilesystemError` propagam.

### Utility readAndParseJson com discriminador `kind`

Helper interno (`src/domain/read-and-parse.ts`) faz read + JSON parse +
validation Zod, retornando discriminated union:

```ts
type ReadAndParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'not-found' | 'invalid'; reason: string };
```

O `kind` evita brittle string match em `reason` — consumers distinguem "race
condition (skip)" de "corrupção (`kind: 'invalid'`)" sem inspecionar o texto do
erro. RN-09 ("arquivo malformado: log e ignora silenciosamente") aplica-se ao
`kind: 'invalid'`.

### Stubs W2/W3 com NotImplementedError

`CancelStore.writeCancel` (BL-C4-004 W2) e `ArchiveStore.moveToArchive`
(BL-C4-005 W3) lançam `NotImplementedError(operationName)`. A classe estende
`FilesystemError` — consumers continuam usando `instanceof FilesystemError` como
discriminação única do package.

Assinaturas finais preservadas (`writeCancel(_cancel: SprintCancel)`,
`moveToArchive(_filename: string)`) para callers de W1+ poderem escrever código
que type-check contra o contrato final. Prefixo `_` no parâmetro silencia
`no-unused-vars`; some na implementação real de W2/W3.

### Sanity test via barrel

`src/__tests__/barrel.test.ts` importa via `..` (resolve para `index.ts`) e
confirma que cada classe/tipo está exportada. Captura cedo o erro de "adicionou
símbolo público e esqueceu de atualizar o barrel". Forma é equivalente a
`import { X } from '@sprint/fs-adapter'` em runtime (source-first com
`main: ./src/index.ts`).

### Alternativas consideradas

1. **Mock paralelo ao Memory** (proposto no prompt original do W1.C4):
   rejeitado. `MemoryFilesystemAdapter` do W0 já é paritário ao Node via
   contract suite; testes do domain usam Memory direto. Helpers tipo
   `injectFailure` se resolvem com `vi.spyOn(adapter, '...')` com setup mais
   simples e menos surface area.
2. **Operações de domínio como métodos da interface `IFilesystemAdapter`**: já
   rejeitado em ADR-013, confirmado aqui. Acoplaria adapter a `SprintPayload`,
   schemas, semântica de pasta compartilhada.
3. **`sharedPath` como dep injetada no adapter**: rejeitado. Adapter é port
   puro; `sharedPath` é responsabilidade do domain layer.
4. **`deletePending` aceitar qualquer filename**: rejeitado por path traversal.
   Validamos via `safeParseFilename` antes do `unlink`.
5. **`listPending` lançar para qualquer falha**: rejeitado por RN-09. Arquivo
   malformado individual não deve quebrar polling agentwide.
6. **Brittle string match em `reason` para detectar race**: rejeitado.
   Discriminador `kind` no `ReadAndParseResult` resolve com type-safe.
7. **Numerar BLs como o prompt original sugeria** (writeAck=006, mock=007):
   rejeitado. SESSION_LOG #10 já usou 006/007 para MemoryAdapter/NodeAdapter no
   W0. Mantemos a numeração efetiva do projeto.

### Consequências

**Aceitas:**

- Leader (BL-C2-007, parte 2) e Agent (BL-C3-003/007) ganham API completa para
  dispatch + polling + ack. Próximas sessões consomem `PendingStore` /
  `AckStore` diretamente.
- Stores são testáveis isoladamente via `MemoryFilesystemAdapter` (sem tmpdir,
  sem flakiness).
- Coverage 100% em toda a camada de domínio (5 arquivos, 9 suites, 235 testes no
  fs-adapter total).
- Stubs `CancelStore`/`ArchiveStore` permitem code-completion e type-check para
  callers de W1+ sem precisar esperar W2/W3 entregarem o corpo.

**Trade-offs:**

- Stores compartilham boilerplate (constructor, mkdir-before-write,
  pretty-print). Extrair classe-base reduziria legibilidade dos métodos
  individuais. Aceito.
- `@sprint/fs-adapter` ganha runtime dep em `@sprint/contracts` — mudança de
  schema/sanitizer dispara rebuild do fs-adapter. Inevitável com o domain layer.
- W3 (job de limpeza, BL-C4-008) precisará usar `ArchiveStore.moveToArchive`
  quando entregue; até lá, sprints processadas se acumulam em `pending/`.

### Referências

- ADR-013 (port-and-adapter; fundação)
- ADR-014 (sanitização body_html — usada em `writePendingSprint`)
- ADR-005 (schema-first; parsers Zod usados em defesa em profundidade)
- ADR-006 (filename com ULID; `buildPendingFilename`/`buildAckFilename`/
  `buildCancelFilename`)
- BL-C4-002 (`writePendingSprint`), BL-C4-003 (`listPending`/`listAcks`/
  `deletePending`), BL-C4-006 (`writeAck`), BL-C4-004 W2 (`writeCancel` stub),
  BL-C4-005 W3 (`moveToArchive` stub)
- CLAUDE.md §7.9 (sanitização obrigatória), §4 ("Estrutura interna de
  `@sprint/fs-adapter`")
- CLAUDE.md §12 G-018 (caller faz `mkdir` antes de `writeFileAtomic` em paths
  aninhados), G-019 (Memory adapter normaliza só `/`) para BL-C2-007)

---

## ADR-017: Arquitetura do main process do Leader (W1.C2 parte 2)

- **Status:** Accepted
- **Data:** 2026-05-26
- **Decisores:** Renan (3Studio)

### Contexto

A parte 1 da W1.C2 (Sessão 13, ADR-015) entregou o renderer do Leader — composer
de sprint funcional mas com o botão "Enviar" como stub (flag `DISPATCH_ENABLED`
false). O dispatch real (BL-C2-007) precisa do main process inteiro: carregar
`leader-config.json`, ler `operators.json` da pasta compartilhada, orquestrar
escrita atômica em `pending/` por operador, e expor tudo via IPC tipado ao
renderer.

Pré-requisitos disponíveis após Sessão 14 (ADR-016): `@sprint/fs-adapter` domain
layer com `PendingStore.writePendingSprint`, sanitização, validação Zod em
camada de domínio.

### Decisão

Adotamos **arquitetura tri-camada main process** alinhada ao padrão IPC
contract-first (ADR-009) e ao port-and-adapter hexagonal do fs-adapter
(ADR-013):

1. **`main/config.ts`** — `loadLeaderConfig()` fail-fast com 5 `ConfigError`
   tipados (`NotFound`, `JsonInvalid`, `SchemaInvalid`, `Read`,
   `SharedPathInaccessible`). Espelha o padrão do Agent (ADR-012). Schema local
   Zod (`leaderConfigSchema`) — não promovido para `@sprint/contracts` enquanto
   o tipo for exclusivo do Leader.
2. **`main/services/operatorsService.ts`** —
   `OperatorsService(adapter, sharedPath).list()` lê
   `<shared_path>/operators.json` via `IFilesystemAdapter.readFile`. Schema Zod
   local (`operatorsFileSchema.strict()`). NÃO filtra `ativo:false` — renderer
   filtra na renderização (separação de responsabilidade + facilita debug).
3. **`main/services/dispatchService.ts`** —
   `DispatchService(pendingStore, operatorsService, config).dispatch(request)`:
   - Gera `sprint_id` (ULID) **uma única vez por sprint** — todos os operadores
     compartilham.
   - Resolve `deadline_at` ISO via `resolveDeadlineIso(hhmm, now)`: se HH:MM
     passou >30min, avança para amanhã; senão usa hoje (decisão D1 do Gate 1).
   - Substitui `{meta}` no body via `substituteMeta(body, meta)` **no main,
     antes da sanitização** (decisão D2 do Gate 1) — agente fica "burro"
     (renderiza HTML final).
   - Sanitiza body via `sanitizeBodyHtml` (ADR-014).
   - Valida payload final via `parseSprintPayload` (defense-in-depth).
   - Escreve via `pendingStore.writePendingSprint(payload)` **em try/catch
     isolado por operador** — falha de 1 não impede os outros 2. Retorna
     `DispatchSprintResponse` com `per_operator[]` + `summary`.
4. **`main/ipc.ts`** — `registerIpcHandlers(deps, rebuildDeps)` registra 3
   handlers reais + smoke `ping`. Cada handler retorna `IpcResult<T>` (envelope)
   ou discriminated union dedicada (`GetConfigResult` para `config:get` —
   renderer precisa do `code` tipado para `ConfigErrorScreen`).
5. **`main/index.ts`** — composition root. Instancia `NodeFilesystemAdapter` +
   `PendingStore` + `OperatorsService` + `DispatchService` via `rebuildDeps()`.
   Se config falha no boot, deps ficam `null`; handler `getConfig` invoca
   `rebuildDeps` quando o renderer chama de novo (após `window.location.reload`)
   — destrava app sem precisar matar o processo.

### IpcResult envelope vs discriminated union dedicada

- **`IpcResult<T>`** para `listOperators` e `dispatchSprint`:
  `{ ok: true, data } | { ok: false, error: { code: string, message: string } }`.
  Genérico o suficiente para handlers que apenas reportam sucesso/falha.
- **`GetConfigResult`** dedicado para `config:get`:
  `{ ok: true, config: LeaderConfigView } | { ok: false, error: { code: ConfigErrorCode, message, expectedPath } }`.
  Renderer narra para `ConfigErrorScreen` que precisa de `expectedPath` e `code`
  tipado (`NOT_FOUND` vs `JSON_INVALID` vs ...) para escolher mensagens
  específicas.

### `rebuildDeps` callback — destravar app sem restart

Antes: se a config falhasse no boot, app só voltava ao normal após `pnpm dev`
restart (matar processo + reabrir).

Agora: `main/index.ts` mantém
`deps: IpcDependencies = { operatorsService: null, dispatchService: null }`
(mutável). Define `rebuildDeps()` que carrega config

- instancia services + popula `deps`. Passa `rebuildDeps` para
  `registerIpcHandlers`. O handler `getConfig` invoca `rebuildDeps()` quando
  `deps.operatorsService === null` (boot falhou + agora a config talvez tenha
  sido corrigida). Se rebuild sucede, deps populadas; próximas chamadas a
  `listOperators`/`dispatchSprint` funcionam sem precisar reiniciar.

UX: líder cria config.json → clica "Reabrir após criar configuração" na
ConfigErrorScreen → `window.location.reload()` recarrega só o renderer →
`api.getConfig()` chama o main → main rebuild deps → renderer renderiza a app
funcional. Processo `pnpm dev` continua rodando.

### `LeaderAPI` property-with-arrow (não method-shorthand)

`@typescript-eslint/unbound-method` lint reclamava de `vi.mocked(window.api.X)`
em testes do renderer porque o tipo declarado em `shared/ipc-types.ts` usava
method-shorthand (`ping(): Promise<string>`). Mudamos para property-with-arrow
(`ping: () => Promise<string>`) — funções soltas como propriedades, sem `this`,
eliminam o falso positivo. Preload e wrapper (`renderer/services/api.ts`) seguem
o mesmo padrão.

### Alternativas consideradas

| Alternativa                                                    | Por que rejeitada                                                                                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operadores: ler via `fs/promises` direto no main               | Sem ganho concreto sobre `IFilesystemAdapter.readFile` (mesmo método sob o capô) e perde testabilidade com `MemoryFilesystemAdapter`. D4 do Gate 1 escolheu via adapter.                                      |
| Config: ler via `IFilesystemAdapter`                           | Config é boot-state; o adapter ainda não tem `sharedPath` conhecido. `fs/promises` direto espelha ADR-012 (Agent precedent). Uniformizar é débito futuro (não pressa).                                        |
| `LeaderConfig` em `@sprint/contracts`                          | YAGNI — tipo exclusivo do Leader. Promover quando outro consumer (instalador C5?) precisar.                                                                                                                   |
| Filtrar `ativo:false` no `operatorsService`                    | Quebra debug ("por que operador X não aparece? Está com `ativo:false`?"). Filtragem na renderização preserva o service como espelho fiel do arquivo.                                                          |
| Substituir `{meta}` no Agent na hora de renderizar             | Acopla Agent a template engine. Manter Agent burro (renderiza HTML pronto) é arquiteturalmente melhor. D2 do Gate 1.                                                                                          |
| Deadline no passado: usar sempre hoje                          | Cenário típico: líder digita HH:MM fim do expediente. Se já passou +30min, o Agent vai descartar (não tem sentido enviar). Avançar para amanhã preserva intenção; ≤30min é tolerância de drift. D1 do Gate 1. |
| Permitir dispatch quando config falhou (sem `CONFIG_REQUIRED`) | `dispatchSprint` precisa de `sharedPath` válido. Bloquear cedo é melhor que falhar tardiamente em `PendingStore.writePendingSprint`.                                                                          |
| LeaderAPI com method-shorthand + cast nos testes               | `as unknown as` está proibido (CLAUDE.md §10). Mudar a tipagem do contrato é mais limpo que cast.                                                                                                             |

### Consequências

**Aceitas:**

- BL-C2-007 fechado com smoke real validado (5 sprints disparadas em
  `dev-fixtures/shared/pending/` durante dev; schema do Anexo C confere).
- Coverage `main/config.ts` 100%; `main/services/*` 92-99%; `main/index.ts` +
  `main/ipc.ts` excluídos (boot + envelope; testados via E2E em W3 com
  Playwright).
- Padrão de "config-recovery sem restart" estabelecido — replicável em C3
  (Operator Agent W1) e W2+ se precisar de hot-reload de config.
- 198 testes (13 files) sem flakes — `MemoryFilesystemAdapter` injetado em todos
  os testes de service.

**Trade-offs:**

- Config-recovery via `getConfig` cria um path indireto (config loaded duas
  vezes em alguns cenários — boot + getConfig após reload). Aceitável (config é
  leve).
- Renderer tem que tratar 3 estados de boot (loading / ok / error) com
  discriminated union — código a mais que "assumir sempre OK". Justificado pelo
  UX (mensagem clara em vez de crash).
- `LeaderAPI` como property-with-arrow é menos idiomático que method shorthand,
  mas necessário para lint clean em testes.

### Referências

- ADR-009 (IPC contract-first), ADR-012 (loader fail-fast — Agent precedent)
- ADR-013 (filesystem adapter port-and-adapter), ADR-014 (sanitização body_html)
- ADR-015 (composer Leader W1.C2 parte 1), ADR-016 (fs-adapter domain layer W1)
- BL-C2-007 (dispatch real)
- CLAUDE.md §4 (nova subseção "Estrutura interna do main process do Leader")
- CLAUDE.md §12 G-020 (jsdom externalize em vite-plugin-electron)

---

## ADR-018: Redesign visual do Leader (design Renan)

- **Status:** Accepted
- **Data:** 2026-05-26
- **Decisores:** Renan (3Studio, designer + stakeholder)

### Contexto

A W1.C2 parte 1 (Sessão 13) e parte 2 (Sessão 15 — Gates 2-6) entregaram o MVP
funcional do Leader com identidade visual mínima (tokens light theme, azul como
accent, Sidebar lateral vertical, copy genérica "Sprint", "Operadores",
"Enviar"). Renan produziu um design no Figma com identidade da marca 3STUDIO —
dark theme, accent amarelo, terminologia "Rodada de metas" / "Usuários" /
"Disparar evento".

### Decisão

Aplicamos o redesign **sem tocar em arquitetura, schema ou comportamento** —
mudanças confinadas a CSS Modules (visual), JSX (estrutura de componente), e
copy de UI (strings user-facing). Schema, IPC, fs-adapter, stores Zustand e
contratos JSON permanecem inalterados.

**1. Tokens de design (`styles/global.css`):**

- `--color-bg: #0a0a0a` (era `#ffffff`)
- `--color-bg-elevated: #1c1c1c` (era `#f9fafb`)
- `--color-surface: #2a2a2a` (novo — surfaces internas como counter/checkbox bg)
- `--color-accent: #ebc76a` + `--color-accent-hover: #e0b955` +
  `--color-accent-text: #0a0a0a` (novo bloco — substitui `--color-primary` azul)
- `--color-text: #ffffff`, `--color-text-muted: #909090`,
  `--color-text-subtle: #606060`
- `--color-input-bg: #f5f5f5`, `--color-input-text: #0a0a0a` (novo — light
  surface para Horário input, contraste deliberado no dark theme)
- `--font-size-3xl: 48px` (novo — hero title)
- `--radius-button: 14px` (novo — buttons; pill 9999px reservado para Toast e
  elementos genuinamente circular-ended)

**2. Sidebar vertical → TopNav horizontal:**

`components/Sidebar/` deletado. `components/TopNav/` criado com:

- Logo `3STUDIO` (SVG inline) à esquerda
- 3 nav links à direita (`Nova rodada`, `Acompanhamento`, `Histórico`) com gap
  `--space-12` (48px)
- Link ativo: cor accent + underline; inativo: `#a8a8a8` font-weight 400

`App.module.css` mudou de `display: grid; grid-template-columns: 240px 1fr` para
`display: flex; flex-direction: column`.

**3. `Logo` component (novo):**

`components/Logo/` — SVG inline do "3STUDIO" logotype (path data exato do
`logo.svg` fornecido por Renan). `fill="currentColor"` para versatilidade de cor
por contexto.

**4. Hero do `NovaSprint`:**

```tsx
<h1>
  Escolher pessoas
  <br /> para <span className={accent}>rodada de metas</span>
</h1>
```

Title em 2 linhas com `<br>` explícito (max-width descartada). Font 48px, weight
600, letter-spacing -0.02em, line-height 1.1. Inline com o título, à direita:
`<DeadlineInput />` (pill light bg, "Horário") + botão "Disparar evento" (pill
amarelo com seta SVG).

**5. `OperatorList` em grid 2-colunas:**

`grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3)`. Media
query `(max-width: 720px)` colapsa para 1 coluna.

**6. `OperatorRow` redesenhado:**

```
[avatar(initial)] [nome (label clicável)] [counter/input meta] [checkbox amarelo]
```

- Avatar: 36px quadrado com border-radius `--radius-sm`, primeira letra do nome
  em uppercase.
- Nome: dentro de `<label htmlFor={checkboxId}>` (clicar no nome marca o
  checkbox — preserva teste de htmlFor association). Hostname agora só em
  `title` attribute (não visível, acessível por hover).
- Counter: span "0" quando não-selecionado (placeholder visual); input numérico
  quando selecionado.
- Checkbox: input nativo com `opacity: 0` sobre um `<span>` 32px amarelo com SVG
  check icon quando `:checked` — preserva acessibilidade nativa + visual custom.

**7. Vocabulário UI:**

| Antes (parte 1)              | Depois (redesign)                    |
| ---------------------------- | ------------------------------------ |
| "Nova Sprint" (nav + h1)     | **Nova rodada** (nav) + hero próprio |
| "Operadores" (h2)            | **Usuários**                         |
| "N operadores selecionados"  | N usuários selecionados              |
| "Enviar" (botão)             | **Disparar evento**                  |
| "Enviando…" (em vôo)         | Disparando…                          |
| "Horário limite"             | **Horário**                          |
| "Sprint enviada com sucesso" | **Rodada disparada com sucesso**     |
| "Enviando sprint…" (modal)   | Disparando rodada…                   |
| "Resultado do envio"         | **Resultado da rodada**              |
| "Erro no envio"              | **Erro ao disparar**                 |

Schema interno (`sprint_id`, `criado_por`, IPC method `dispatchSprint`, internal
vars como `useSprintComposerStore`) NÃO mudou — seria mudança de contrato com o
Agent + bump em `SCHEMA_VERSION` + trabalho em `@sprint/contracts`. Só copy
user-facing.

**8. Outros componentes:**

- `BulkSelectButtons`: text-link style sutil (sem border/bg) com `·` como
  separador entre os dois botões. Movido para a direita do label "Usuários".
- `DispatchModal`: dark surface (`--color-bg-elevated`), accent button no close,
  summary item com strong color destacado (accent para sucesso, danger para
  falha).
- `ConfigErrorScreen`: dark surface, accent reload button. Tipografia/layout
  preservados (cards com estrutura informativa).
- `Toast`: cores semânticas (`--color-success` verde / `--color-warning` âmbar),
  position fixed bottom-right, auto-dismiss em 4s.

**9. Mensagem "Meta ≥ 1" → sr-only:**

Visual de erro do input de meta é apenas `border-color: var(--color-danger)`
(via `[aria-invalid='true']`). A mensagem "Meta deve ser maior ou igual a 1"
fica sr-only (visualmente escondida) para leitores de tela via
`aria-errormessage`.

### Alternativas consideradas

| Alternativa                                                          | Por que rejeitada                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aplicar redesign + mudar schema interno para usar "rodada"/"usuário" | Mudaria contrato com Agent + `SCHEMA_VERSION` bump + trabalho em `@sprint/contracts`. Visual redesign não justifica essa onda. Schema é contrato técnico — copy é só apresentação.                                                    |
| Manter "Operadores" como label técnico no UI                         | Inconsistência entre design (que diz "Usuários") e implementação. Renan é o cliente + designer; sua voz prevalece em copy.                                                                                                            |
| Manter Sidebar lateral (preserva infraestrutura existente)           | Design do Renan é claro: top nav horizontal. Sidebar quebra a hierarquia visual.                                                                                                                                                      |
| Cores claras com accent escuro                                       | Design é dark theme — não-negociável.                                                                                                                                                                                                 |
| `--radius-pill` (9999px) em todos os buttons                         | Renan especificou `~14px` para Horário + Disparar evento. Pill 9999px ficou exclusivo para Toast (formato pill mais natural lá). Outros buttons (modal Close, ConfigError Reload) ficaram com `--radius-pill` até feedback contrário. |
| Manter "Meta ≥ 1" como mensagem visível                              | Renan removeu do design — feedback visual fica apenas com borda vermelha. Sr-only preserva a11y sem clutter visual.                                                                                                                   |

### Consequências

**Aceitas:**

- Aderência completa ao design no que se refere a cores, tipografia, layout do
  hero, 2-col grid, top nav, vocabulário. Iteração rápida via comparação de
  screenshots (sem Figma MCP Dev Mode habilitado).
- 198 testes mantidos verde após atualização de copy (text assertions). Coverage
  `sprint-leader` subiu de 96.68% para 96.88% (Logo + TopNav 100%).
- Arquitetura, IPC e schema ZERO alteração — Agent W1 (próxima sessão) continua
  consumindo o mesmo formato JSON. Schema (`SCHEMA_VERSION: '1.0'`) intocado.

**Trade-offs:**

- Inconsistência de naming entre UI (Rodada / Usuário / Evento) e código (Sprint
  / Operator / Dispatch). Documentado neste ADR e em CLAUDE.md. Padrão:
  schema/IPC = termos originais; UI = termos do design.
- Sem Figma MCP, iteração visual requer screenshots manuais comparativos.
  Habilitar Dev Mode MCP Server no Figma Desktop (sessão futura) destrava
  pixel-perfect direto.
- Modal Close + ConfigError Reload buttons permanecem com pill (9999px),
  enquanto hero buttons mudaram para 14px. Inconsistência menor — se Renan
  especificar diferente nesses, ajustar.

### Próximas oportunidades de polish (W2 ou sessão dedicada)

- Logo 3STUDIO em outras superfícies (instalador, splash screen quando C5 W3
  entregar)
- ConfigErrorScreen header com logo (atualmente texto puro)
- DispatchModal com micro-animação no spinner / fade-in da resposta
- Acompanhamento e Histórico (placeholders W2/W3) ainda usam tipografia básica —
  vão precisar de design quando os conteúdos chegarem

### Referências

- Figma file (fornecido por Renan): `node-id=13-44`
- Figma MCP setup futuro: Figma Desktop → Preferences → "Enable Dev Mode MCP
  Server" + restart Claude Desktop
- ADR-015 (composer Leader W1.C2 parte 1 — supersedido visualmente; lógica
  preservada)
- ADR-017 (arquitetura main process do Leader)
- CLAUDE.md §4 ("Estrutura interna do Leader") — convenções continuam válidas
  (selectors puros, schema-first, etc.)
- BL-C2-006 (W2 — customização de title/body via editor rico) — vai precisar de
  novos componentes de design quando chegar

---

## ADR-019: Arquitetura do Operator Agent (W1.C3 inteiro)

- **Status:** Accepted
- **Data:** 2026-05-26
- **Decisores:** Renan (3Studio)

### Contexto

A Sessão 16 entrega o `sprint-operator-agent` inteiro de W1 — todos os BLs do
componente C3 fechados em uma sessão de 9 gates: polling (BL-C3-003), overlay
TOPMOST com re-sanitização defensiva (BL-C3-004), timer de minimização para tray
(BL-C3-005), tray icon com 3 estados + menu (BL-C3-006), ack em 2 momentos
(BL-C3-007), arquivamento local + dedup pós-restart (BL-C3-008). Pré-requisitos
disponíveis após Sessão 14 (domain layer do `@sprint/fs-adapter`) e Sessão 15
(`Leader` completo escrevendo em `<shared>/pending/`).

Várias decisões arquiteturais precisaram ser tomadas em conjunto: state machine
do overlay, pull pattern vs push race, fail-soft vs fail-fast no boot,
orquestração do ack, dedup pós-restart, BOM no PowerShell, mock strategy para
BrowserWindow em testes.

### Decisões

1. **State machine explícita no `overlayService`** —
   `hidden | showing | minimized` como discriminated union. Transitions
   documentadas:
   - `hidden` → `showing` via `showSprint(item, queueLength)` (queueService emit
     `nextSprint`).
   - `showing` → `minimized` via timer `minimizeAfterMs` automático (default 30s
     — D2 do Gate 1).
   - `minimized` → `showing` via `restoreCurrent()` (tray click "Mostrar sprint
     atual") — **reseta o timer** (D4 do Gate 1: operador "voltou para a tela,
     dar tempo de novo").
   - `showing` → `hidden` via `hide()` (ack final + fila vazia, Gate 6).

2. **Pull pattern `sprint:request-current`** resolve race entre
   `webContents.send` (do `overlayService.showSprint` ao criar BrowserWindow) e
   o registro de listener do React (useEffect roda APÓS o primeiro paint).
   Renderer pulla currentItem no mount; main mantém estado em
   `overlayService.currentItem`. Push `sprint:incoming` cobre mudanças
   subsequentes (ack → próxima sprint).

3. **Boot fail-soft em vez de fail-fast** (D3 do Gate 1) — substitui o
   comportamento W0 do ADR-012 (que terminava o app em `ConfigError`). Agora
   tray fica vermelho + balloon de aviso, polling NÃO inicia, mas processo
   persiste. Recovery via IPC `config:get` quando o renderer for aberto (segue
   padrão `rebuildDeps` do ADR-017). Operador corrige config sem matar processo.

4. **`handleAck` extraído para `main/handlers/`** — testabilidade.
   `main/index.ts` faz `void bootstrap()` no top-level e não pode ser importado
   em testes sem inicializar Electron. Função pura recebe `HandleAckDeps` com 5
   services + logger opcional. main/index.ts vira wrapper thin que valida deps
   não-null e delega.

5. **Re-sanitização defensiva no renderer** — `SprintCard` chama
   `sanitizeBodyHtml` mesmo sabendo que o Leader já sanitizou via
   `PendingStore.writePendingSprint`. Defesa em profundidade contra adulteração
   do JSON em trânsito (alguém editando manualmente o `pending/` via notepad).
   Idempotência (ADR-014) garante que segundo passe não muta o output do
   primeiro. 4 XSS adversariais no `SprintCard.test` confirmam: `<script>`,
   `<iframe>`, `onclick`, atributos `class/id/data-*` todos removidos.

6. **Dedup pós-restart via cache populado no boot** (D5 do Gate 1) —
   `historyService.initializeFromDisk()` faz `fs.readdir` recursivo em
   `<userData>/historico/<dia>/*.json` antes do `pollingService.start()`.
   Filenames já arquivados ficam no `processedFilenames: Set<string>`. Polling
   consulta `isAlreadyArchived(filename)` antes de enfileirar.

7. **Campo `minimize_after_seconds` extra-schema** — `@sprint/contracts` é
   imutável nesta sessão (§ 2.2 do prompt original). Solução: o `loadConfig` do
   Agent extrai o campo via spread+rest ANTES de chamar `safeParseAgentConfig`
   (que é `.strict()`). Validação 1-300 segundos acontece no `loadConfig` local.
   Default 30s.

8. **`OverlayService` com `BrowserWindow` real é o ÚNICO service não testável
   via Memory adapter** — o resto (PendingStore, AckStore, QueueService,
   HistoryService, AckService, PollingService) usa `MemoryFilesystemAdapter`
   direto. Para `overlayService.test.ts` o `BrowserWindow` é mockado via
   `vi.hoisted()` (G-015 atualizado — `vi.mock` é hoisted; `vi.hoisted` agrupa
   declarações antes do hoisting). Para o integration test, `OverlayService`
   inteiro é mockado com spies simplificados.

9. **Polling com `setTimeout` recursivo, não `setInterval`** — evita overlap se
   um ciclo demorar mais que o intervalo (rede SMB lenta). Cada `pollOnce` await
   termina antes de agendar o próximo via
   `setTimeout(this.pollAndSchedule, pollingIntervalMs)`.
   `DirectoryNotFoundError` em `pending/` é benigno (primeiro boot pré-Leader) —
   catch específico antes do log.error.

10. **Workflow CI `build-agent.yml` espelhado de `build-leader.yml`** — mesmo
    padrão (windows-latest, pnpm cache, `pnpm --filter ... run make`,
    upload-artifact). Triggers paths-based em `apps/operator-agent/**` +
    `packages/contracts/**` + `packages/fs-adapter/**` + lockfile + workflow.
    Necessário porque o build local falha pelo ESET travando `app.asar` (G-009).

### Alternativas consideradas

| Alternativa                                                         | Por que rejeitada                                                                                                                                                                                         |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adicionar `minimize_after_seconds` ao schema do `@sprint/contracts` | Proibido pela § 2.2 do prompt; também violaria SCHEMA_VERSION (campo opcional novo seria breaking pra parsers strict). Stripping via spread+rest mantém schema intocado.                                  |
| Push immediate em `showSprint` antes do mount React                 | Race entre `webContents.send` e `useEffect` registration. Pull pattern via `sprint:request-current` é determinístico.                                                                                     |
| `setInterval` no polling                                            | Risco de overlap se ciclo demorar — múltiplos polls concorrentes corrompem cache + duplicate enqueue. `setTimeout` recursivo serializa.                                                                   |
| Fake timers no integration test                                     | Race com `void writeDisplayed` microtasks fire-and-forget — `vi.useFakeTimers` + `await new Promise(r => setTimeout(r, 5))` ficava pendurado. Real timers + `flushMicrotasks` helper resolveu sem flakes. |
| `BrowserWindow` real em todos os testes                             | Exige runtime Electron + display. CI Linux/headless falharia. Mock via `vi.hoisted` cobre state machine + IPC sends sem dependência de Electron.                                                          |
| `archive` na hierarquia do `IFilesystemAdapter`                     | Já rejeitado pelo ADR-013 (port mantém-se em 8 primitivos). Domain layer `historyService` consome `node:fs/promises` direto (mesmo padrão do `loadConfig` — ADR-012).                                     |
| `cancel-*.json` handler ativo no W1                                 | BL-C3-009 é W2. Em W1, branch defensivo no `processEntry` apenas loga warn + skip. listPending com `userId` filter já remove cancels naturalmente; o branch só dispara via mock em testes.                |
| Logger `@sprint/logger` no W1.C3                                    | BL-C6-001 é a próxima sessão. Em W1.C3, `console.warn`/`error` em main process com TODO. Build NSIS sem console visível é débito conhecido.                                                               |
| `Sair` no tray menu                                                 | RN-04 (operador não pode fechar agente). Em W1, "Sair" oculto. W3 vai expor com senha de admin.                                                                                                           |

### Consequências

**Aceitas:**

- Operator Agent funcional ponta-a-ponta no W1: dispatch via Leader → polling do
  Agent → overlay TOPMOST → ack → archive → próxima sprint OU overlay hide.
  Testado em integration test (4 cenários) + 186 testes unitários cobrindo state
  machine, timer, ack flow, dedup, XSS defensivo.
- Coverage: 97.76% lines / 91.47% branches / 95.4% funcs no
  `sprint-operator-agent`. Threshold 70/65/70/70 (renderer floor) com folga.
- Setup real em servidor SMB validado (`\\srv-alpha\TEMP\Metas_3Studio`): Leader
  boota com UNC remoto, lê `operators.json`, escreve em `pending/`.
- Workflow CI `build-agent.yml` permite distribuição via runner Windows limpo
  (sem ESET local). Trigger paths-based + manual dispatch.
- SETUP.md de ambos os apps documenta: setup dev, setup LAN 2 PCs, build via
  Actions + deployment passo-a-passo, validação end-to-end, troubleshooting.

**Trade-offs:**

- Logs de produção (build NSIS) ficam silenciosos quando overlay não está
  visível — débito até W1.C6 (`@sprint/logger` com pino-roll).
- Hostnames em `operators.json` são apenas declarativos; o `SprintAck.hostname`
  real vem do config local de cada Agent.
- `cancel-*.json` handler é stub silencioso até BL-C3-009 (W2). Líder ainda não
  tem botão "Cancelar".
- Acompanhamento de acks em tempo real pelo Leader (BL-C2-008 W2) é a próxima
  necessidade UX — hoje líder inspeciona manualmente `<shared>/acks/`.
- `overlay.ts` legado W0 e `tray.ts` deletados (operação destrutiva intencional
  — substituídos por `services/overlayService.ts` e `services/trayService.ts`).

### Referências

- Backlog BL-C3-003 a BL-C3-008 (todos fechados); BL-C3-009/010/011/012 (W2),
  BL-C3-013/014 (W3)
- ADR-004 (polling), ADR-009 (IPC contract-first), ADR-011 (tray-resident),
  ADR-012 (fail-fast precedent — superseded em D3 para fail-soft), ADR-013
  (port-and-adapter), ADR-014 (sanitize defesa em profundidade), ADR-016 (domain
  layer fs-adapter W1), ADR-017 (rebuildDeps callback)
- CLAUDE.md §4 (nova subseção "Estrutura interna do Operator Agent W1.C3")
- CLAUDE.md §12 G-021 (BOM no PowerShell 5.1 quebra JSON.parse)
- `apps/operator-agent/SETUP.md` (~530 linhas — guia completo dev + deployment)
- `apps/operator-agent/src/main/handlers/handleAck.ts`
- `apps/operator-agent/src/main/services/` (overlayService, ackService,
  historyService, queueService, pollingService, trayService, trayStateService)
- `.github/workflows/build-agent.yml`

---

## ADR-020: `@sprint/logger` com Pino — wrapper enxuto (W1.C6)

- **Status:** Accepted
- **Data:** 2026-05-27
- **Decisores:** Renan (3Studio)

### Contexto

BL-C6-001 entrega o pacote `@sprint/logger`, último item W1 do componente
Observability. RNF-03 (observabilidade) exige logs estruturados para
troubleshooting. O Agent já tem 8 `console.warn`/`console.error` espalhados
(W1.C3 — alguns via injeção `PollingLogger`/`HandleAckDeps`, alguns em fatal
handlers), e o Leader não tem logging algum em pontos onde lança erro
silenciosamente. Ambos precisam de uma biblioteca comum antes do refactor de W3
(BL-C6-002).

A regra ESLint atual (`'no-console': ['error', { allow: ['warn', 'error'] }]`)
foi propositalmente afrouxada em C8 porque sem `@sprint/logger` não havia
substituto para `console.warn`/`error` em ramos de erro críticos. CLAUDE.md §12
("Débitos técnicos pendentes") registra a regra estrita como pendente até esta
sessão.

### Decisão

Adotamos **Pino como logger core**, exposto via **wrapper enxuto** em
`@sprint/logger`:

1. **Pino 9.x** como dep runtime — performance (~5× faster que Winston em
   throughput sustentado), JSON estruturado nativo, child loggers nativos,
   ecossistema de transports (file rotation, Datadog, Loki, etc.) abre porta
   para W3/W4 sem reescrever o wrapper.
2. **`pino-pretty` 11.x** como dep runtime (não devDep) — apps usam em
   `pnpm dev`. Worker thread em dev mode entrega output colorido legível sem
   custo no main thread.
3. **API estreita exposta**: `createLogger(name, options?)`, `rootLogger()`,
   tipos `Logger`, `LogLevel`, `LoggerOptions`, `ChildBindings`. Cinco níveis
   (`debug`, `info`, `warn`, `error`, `fatal`) + `child(bindings)` + `name`
   readonly. Pino expõe ~30 métodos; nosso wrapper expõe 7.
4. **Detecção dev/prod automática via `NODE_ENV`** — `!== 'production'` ativa
   pretty print; `'production'` emite JSON puro em stdout. Com
   `options.destination` (testes), sempre JSON síncrono no stream fornecido —
   não passa por pino-pretty independentemente do `NODE_ENV`.
5. **`LOG_LEVEL` env var como override universal** — case-insensitive.
   Precedência: `options.level` > `LOG_LEVEL` env > default por `NODE_ENV`
   (`'debug'` em dev, `'info'` em prod). Valor inválido em `LOG_LEVEL` é
   ignorado silenciosamente (fallback para o default — evita boot crash por
   typo).
6. **`rootLogger()` é singleton lazy** — primeira chamada cria; chamadas
   subsequentes retornam a mesma instância. Lazy permite que código de boot stub
   env vars antes do primeiro uso. `_resetRootLoggerForTesting()` (helper
   interno, não exportado no barrel) força reconstrução em testes que mudam
   `NODE_ENV`/ `LOG_LEVEL`.
7. **Suporte a destination customizado primariamente para testes** — captura via
   `PassThrough` documentada no README com helper `captureLines()`. Padrão
   estabelecido nos 29 testes de `createLogger.test.ts`.
8. **`options.bindings` aplicado via `.child()` após criação** — preserva o
   default `base: { pid, hostname }` do Pino. Sobrescrever via `options.base`
   removeria pid/hostname; usar child mantém ambos.

### Alternativas consideradas

| Alternativa                                     | Por que rejeitada                                                                                                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Winston**                                     | ~5× mais lento que Pino em throughput sustentado. API mais legacy (formatters/transports complexos). Menor adoção em projetos novos.                                                               |
| **Bunyan**                                      | Descontinuado (último release relevante em 2017). Sem path de evolução.                                                                                                                            |
| **`console.*` wrapper customizado**             | Reinventa roda. Sem formato estruturado nativo. Sem child loggers. Performance pior por causa do `console.*` overhead em alta cadência.                                                            |
| **Expor Pino diretamente** (sem wrapper)        | Vazaria detalhes de implementação. Trocar Pino futuramente (ex.: por OpenTelemetry, Datadog SDK) exigiria mudança em N services. Wrapper enxuto isola.                                             |
| **API wide** (expor `trace`, `silent`, `flush`) | YAGNI. `trace` ruidoso demais em produção; `silent` melhor expresso via `LOG_LEVEL=fatal`; `flush` raramente útil. Expandir é não-quebrante; encolher quebra consumidores.                         |
| **`react-hook-form`-style options via builder** | Overkill. `createLogger(name, options?)` cobre 100% dos casos. Builder API só pagaria custo se houvesse 10+ opções.                                                                                |
| **File transport + Sentry agora**               | Fora do escopo do BL-C6-001. File transport é BL-C6-003 (W3) com `pino-roll`; Sentry/serviço externo é BL-C6-004 (W4+). Esta sessão entrega fundação; integração nos apps + transports vêm depois. |

### Consequências

**Aceitas:**

- Apps podem importar `createLogger` e ter logging estruturado pronto.
  Integração real em W3 (BL-C6-002) é trivial — o `PollingService` já tem slot
  de injeção pronto (`PollingLogger` interface com `SILENT_LOG` default).
- Migrações futuras de implementação (OpenTelemetry, Datadog SDK, custom
  transport) só tocam `@sprint/logger`; consumidores ficam intactos. Decoupling
  deliberado.
- Coverage 100% nos 3 arquivos de runtime (config, createLogger, rootLogger). 57
  testes cobrindo: filtragem por nível, precedência de options/env/default,
  child com bindings acumulados, name preservado em child recursivo, fluxos
  dev/prod default sem crash.
- README do pacote tem seção "Uso esperado nos apps (W3 / BL-C6-002)" com
  exemplos copy-pasteáveis + lista exata dos 8 `console.*` no Agent.

**Trade-offs:**

- Worker thread do `pino-pretty` em dev mode tem startup cost (~50ms). Aceitável
  para `pnpm dev`; pode ser desligado em testes via `options.destination`
  (PassThrough).
- Bindings de `child` restritos a primitivos (`string|number|boolean|null`) —
  Pino aceita estruturas aninhadas, mas a v1 do wrapper troca isso por
  previsibilidade do shape JSON. Expandir é não-quebrante.
- Dispatch explícito por nível (~30 linhas) é verboso, mas preserva type-safety
  sem `any` e sem casts. Alternativas (indexer, bind) caem em variance issues do
  TS.

### Endurecimento futuro da regra ESLint `no-console`

CLAUDE.md §12 ("Débitos técnicos pendentes") registra a regra estrita
(`'no-console': 'error'`, sem `allow`) como pendente até BL-C6-002. Após o
refactor sistemático dos `console.warn`/`console.error` remanescentes nos apps,
abrir PR dedicado para endurecer a regra (W3). Este ADR autoriza a mudança;
disparador é a entrega de BL-C6-002.

### Padrão de captura em testes

Helper `captureLines()` (PassThrough + parse de linhas JSON) é o padrão único
para asserts de output. Documentado no README do pacote
(`packages/logger/ README.md`, seção "Para testes"). Usado em todos os 29 testes
de `createLogger.test.ts`. Pino com stream customizado escreve síncrono; evento
`data` propaga no próximo tick — `await new Promise(r => setImmediate(r))` basta
para flush.

### Referências

- BL-C6-001 (esta sessão); BL-C6-002 (integração — W3), BL-C6-003 (file
  transport — W3), BL-C6-004 (Sentry/externo — W4+)
- RNF-03 (observabilidade) — esta sessão cumpre a fundação
- ADR-019 (W1.C3 inteiro) — Agent introduziu o slot `PollingLogger` /
  `HandleAckDeps` esperando o logger real
- CLAUDE.md §4 (nova subseção "Estrutura interna de `@sprint/logger` (W1.C6)")
- CLAUDE.md §12 (regra `no-console` estrita pendente — débito que este ADR fecha
  após BL-C6-002)
- `packages/logger/README.md`
- [Pino docs](https://getpino.io)
- [`pino-pretty` docs](https://github.com/pinojs/pino-pretty)

---

## ADR-021: Expansão da suíte de testes para production-grade na W1.C8

- **Status:** Accepted
- **Data:** 2026-05-27
- **Decisores:** Renan (3Studio)

### Contexto

BL-C8-002 e BL-C8-003 (W1, sessão final da Wave 1) ampliam as suítes de testes
de `@sprint/contracts` e `@sprint/fs-adapter` para qualidade production-grade
antes do fechamento da W1. Cobertura inicial já estava alta (contracts
100/100/100/100 e fs-adapter 99.61/98.03/100/99.61 lines/branches/funcs/stmts),
mas faltavam três classes de teste insubstituíveis em manutenção futura:

1. **Property-based testing** para invariantes universais (ex.:
   `sanitizeBodyHtml` nunca produz `<script>` para qualquer string).
2. **Curadoria adversarial** de vetores XSS (mutation, encoding, polyglot,
   unicode, combining marks) — defesa documentada e expansível.
3. **Paridade Node↔Memory** no domain layer (não só nos primitivos do port) e
   **roundtrip cross-package** via property-based.

Sem essas camadas, regressões em sanitização, race conditions ou divergência
entre adapters só apareceriam em produção.

### Decisão

1. **`fast-check@^3.20.0` como devDependency** em ambos pacotes. Property-based
   testing é insubstituível para invariantes universais — `numRuns: 50` por
   padrão para CI rápido; 100 quando o cenário tolera (filenames roundtrip).
2. **Curadoria de vetores XSS** em
   `packages/contracts/src/__helpers__/ xssVectors.ts` — 21 vetores em 5
   categorias com `reason` documentando o ataque defendido. Adicionar vetor novo
   é trivial; remover exige passar guard rail de contagem mínima por categoria.
3. **Arbitraries customizados** em
   `packages/<pkg>/src/__helpers__/ arbitraries.ts` (excluídos da medição de
   cobertura). `@sprint/contracts` tem o conjunto completo (ulid, userId,
   isoDatetime, semver, sprintPayload, sprintAck, sprintCancel, agentConfig);
   `@sprint/fs-adapter` re-cria localmente o que precisa (posixPath, ulid,
   userId — cópia consciente, ver nota arquitetural).
4. **Nota arquitetural — `@sprint/contracts/__helpers__/*` não exposto via
   subpath exports.** O `package.json` do contracts declara apenas `"."`. Para
   reutilizar arbitraries em fs-adapter, opções eram: (a) recriar localmente —
   escolhida; (b) adicionar subpath `"./src/__helpers__/*"` aos exports —
   rejeitada porque é modificação de production API (red line §10 da sessão);
   (c) path relativo cross-package — quebra com mudanças de estrutura.
5. **Thresholds elevados em `vitest.config.ts`** com folga generosa contra os
   números reais:
   - `@sprint/contracts`: **98/95/98/98** (real 100/100/100/100).
   - `@sprint/fs-adapter`: **95/95/95/95** (real 100/99.53/100/100).

   Build falha em regressão. Folga absorve flutuação razoável; quebra real exige
   investigação.

6. **Paridade cross-adapter na matriz `describeParity(label, factory)`** em
   `integration/parity.test.ts`. Mesma sequência roda contra Node (tmp dir real)
   e Memory (in-memory). Diferenças intencionais (G-019: Memory perde diretório
   quando fica vazio) tratadas com `try/catch` aceitando ambos os outcomes.
7. **Roundtrip cross-package em `integration/roundtrip.test.ts`** com
   `safeSprintPayloadArbitrary` — body limitado a conteúdo que sobrevive
   `sanitizeBodyHtml` byte-a-byte (texto plain sem `<`/`>`/`&`, ou whitelist
   HTML pré-formado). Sem isso, roundtrip de body falha porque PendingStore
   sanitiza antes de gravar (CLAUDE §7.9, ADR-014).
8. **Adversarial tests em arquivos `*.adversarial.test.ts`** ao lado dos
   `*.test.ts` originais — separa cenários enumeráveis (rápidos) de cenários
   adversariais (race conditions, concorrência larga escala, mocks de
   FileHandle).
9. **`it.runIf(os.platform() !== 'win32')` para Linux/macOS only** — permission
   revoked (chmod 0o000) e renames concorrentes ao mesmo path (Windows EPERM por
   limitação do SO, não bug — issue conhecido nodejs/node#30075).
10. **Cobertura defensiva via `vi.mock`** — node-adapter.ts lines 50-51 e 63-64
    (catches de `handle.close()` em path de erro e em finally do path de
    sucesso) atingidas mockando `node:fs/promises.open` para retornar
    `FileHandle` com `close()` que rejeita. Subiu de 97.74% → 100% lines.

### Política de bug-discovery (aceita para a sessão)

- **Bug menor** (typo, off-by-one cosmético) → documentar no SESSION_LOG +
  `test.fails`/`test.skip` com TODO. Não corrigir durante a sessão de testes.
- **Bug crítico** (sanitizer deixa XSS passar, write não-atômico) → parar
  sessão, reportar cenário reproduzível, aguardar decisão.
- **Comportamento documentado mas surpreendente** → manter, adicionar teste
  explícito + ADR documentando a decisão.

**Bugs descobertos nesta sessão (categoria "surpresa cosmética"):**

- Polyglot PortSwigger preserva `javascript:` raw como texto (não em href — não
  executa). Heurística overzealous corrigida: vetor adaptado removendo o prefixo
  cosmético, essência do polyglot preservada.
- Windows EPERM em renames concorrentes → limite real do SO, `it.runIf` no
  Linux/macOS.
- `.tmp` files visíveis em `listDir` raw durante write → atomicidade é no
  rename, não na invisibilidade; asserção corrigida para estado final.

### Alternativas consideradas

1. **Stryker (mutation testing).** Valor não justifica setup nesta fase —
   property-based já cobre invariantes universais. Reavaliar em W4.
2. **`@sprint/contracts` adicionar subpath exports `"./src/__helpers__/*"`.**
   Mais limpo (single source of truth), mas é mudança de production API.
   Rejeitado por red line §10. Cópia local em fs-adapter é o trade-off aceito.
3. **Property-based com `numRuns: 200+`.** Mais cobertura empírica, mas CI
   ficaria 4× mais lento. `numRuns: 50` é o balanço entre confiança e tempo.
   Aumentar pontualmente em testes especialmente críticos.
4. **Modificar `MemoryFilesystemAdapter` para incluir `injectFailure`,
   `setLatencyMs`, `seedRawInvalid`** (mencionados no §6.2 do prompt original).
   Rejeitado — `MemoryFilesystemAdapter` é production API exportada pelo barrel;
   adicionar features de teste lá viola red line §10. Cenários de failure
   injection são cobertos via `vi.spyOn` nos métodos do adapter instanciado, sem
   mudança de API.

### Consequências

**Aceitas:**

- `@sprint/contracts` cobertura **100/100/100/100** (era 100/100/100/100 —
  mantida, mas com 87 testes novos exercitando invariantes que estavam apenas
  implicitamente cobertos).
- `@sprint/fs-adapter` cobertura **100/99.53/100/100** lines/branches/funcs/
  stmts (era 99.61/98.03/100/99.61 — subiu node-adapter.ts de 97.74% para 100%
  lines).
- 230 → 317 testes em contracts (+87); 235 → 294 testes em fs-adapter (+59).
- Build falha automaticamente em regressão de cobertura (thresholds
  configurados).
- Próximos consumers (W2/W3) podem confiar no comportamento documentado:
  paridade Node↔Memory garantida, sanitização end-to-end exercitada,
  property-based cobrindo invariantes universais.
- Wave 1 oficialmente fechada com qualidade de produção.

**Trade-offs:**

- Suíte total demora ~25s (era ~3s) — overhead vem de inputs grandes (10MB no
  sanitizer, 1900 chars no body roundtrip) e property-based runs. Aceitável para
  CI.
- `fast-check` adiciona ~1MB de devDeps em cada pacote. Aceitável.
- Cópia local de `ulidArbitrary`/`userIdArbitrary` em fs-adapter — quando
  contracts adicionar novos arbitraries (W2+), fs-adapter precisará re-copiar se
  quiser. Comentário inline em `arbitraries.ts` documenta isso.

### Referências

- BL-C8-002 e BL-C8-003 (esta sessão, sessão 18 — fechamento da W1)
- BL-C8-004 (Playwright E2E — W3); BL-C8-006 (Husky pre-commit — W3); BL-C8-007
  (GitHub Actions CI — W4) — fora do escopo
- ADR-014 (sanitização) — base para `xssVectors` curados
- ADR-013 (port-and-adapter) — paridade Node↔Memory na matriz
- CLAUDE.md §7.7.1 (coverage thresholds — tabela atualizada)
- CLAUDE.md §12 G-022 será adicionado: Windows EPERM em renames concorrentes
- `packages/contracts/src/__helpers__/{arbitraries,xssVectors}.ts`
- `packages/fs-adapter/src/{__helpers__/{arbitraries,tmpFixtures},integration/{parity,roundtrip}}.ts`
- [fast-check docs](https://fast-check.dev)

---

## Nota técnica — C9 (BL-C9-001 a 006)

Decisões internas tomadas no scaffold e conteúdo do package `@sprint/ui-kit`,
**não promovidas a ADR** porque estão dentro do escopo de implementação do
componente. Os ADRs formais do C9 estão registrados **abaixo**: **ADR-022**
(adoção do C9 — fecha BL-C7-008) e **ADR-023** (não adoção de Storybook na v1.0
— fecha BL-C7-009), escritos na remediação R1 da auditoria da W2 (2026-05-29).

> **Numeração/local (resolvido — AUD-W2-014):** o backlog e o Gate W2→W3
> referenciam "ADR-003 / ADR-004 em `docs/adr/`", mas esses números já estão
> ocupados (ADR-003 = SMB; ADR-004 = Polling) e o projeto não usa `docs/adr/` —
> usa este `DECISIONS.md` sequencial. Ratificou-se **`DECISIONS.md` como o
> repositório de ADRs do projeto**; os ADRs do C9 são **ADR-022/023** (próximos
> livres após ADR-021). O texto do gate/backlog deve ser ajustado por Renan
> (pendência externa, fora deste repo).

### Decisões

1. **Vite library mode com `vite-plugin-dts` (rollupTypes: true)** ao invés de
   tsc puro. Razão: integra CSS Modules naturalmente e gera ESM tree-shakeable
   num único pipeline. Diverge do padrão source-first dos outros packages
   (contracts/fs-adapter/logger), mas justificada — ui-kit é o primeiro com
   React + CSS Modules e tsc puro não lida bem com ambos.

2. **`tokens.css` exportado via subpath + copiado por
   `vite-plugin-static-copy`** em vez de bundlado. Razão: importado via
   `import '@sprint/ui-kit/tokens.css'` em apps; precisa existir como recurso
   CSS independente em `dist/`.

3. **Tokens single-tier semânticos** + escala neutra contínua (100-900).
   Two-tier (primitivos + semânticos) deferido — overkill para o MVP.

4. **Tema DARK** extraído da imagem 'Hora do Rush!' anexada à sessão. Identidade
   ARTFLEXÍVEIS canônica a partir desta wave: card `#1A1A1A`, text `#FFFFFF`,
   primary `#F5A557` (warm orange). Test anti-regressão para light theme em
   `tokens.test.ts`.

5. **CSS reset em arquivo separado** (`theme/reset.css`), importado pelo
   `<ThemeProvider>`. Permite consumo isolado se necessário. Reset NÃO toca
   font/color/background — esses ficam no `.module.css` do ThemeProvider para
   serem rastreáveis via tokens.

6. **`<ThemeProvider>` sem Context API** — design tokens propagam por cascata
   CSS, idempotentes em aninhamento.

7. **Variant `'urgent'` em `<Overlay>` e `<OverlayMinimized>` reservado** — prop
   existe, hook CSS pronto, regra vazia com TODO. Hardening visual deferido para
   wave 4.

8. **`<TextBlock>` sanitiza em todo render** (defesa em profundidade, ADR-014) —
   sem memoização. Otimização tardia (BL-C8-008 ou wave 4).

9. **`acknowledgeLabel` default `'Recebido'`** em `<Overlay>` — matching design
   da imagem. Override via prop se necessário.

10. **`<OverlayMinimized>` (BL-C9-006, NOVO)** — componente adicional aprovado
    pelo Renan via SCOPE_QUESTION.md durante a sessão. Não estava no backlog
    v1.1 porque CLAUDE.md §1 prometia "minimiza para ícone na bandeja", mas a
    segunda imagem anexada mostrou pill on-screen. Props: `label`, `value`,
    `onClick`, `variant?`. **Sem prop `icon`** (SVG check pontilhado fixo —
    identidade canônica). **Sem positioning CSS** (host decide via
    `BrowserWindow` frameless+topmost ou portal — coordenação em BL-C3-017).

11. **`@sprint/contracts` adicionado como dep workspace do ui-kit** — primeira
    ligação inter-package partindo de C9. Usado apenas pelo `<TextBlock>` para
    `sanitizeBodyHtml`. Externalizado em `vite.config.ts` (não vai pro bundle).

12. **Path alias `@sprint/ui-kit` NÃO foi adicionado a `tsconfig.base.json`** —
    decisão do Renan via AskUserQuestion. `tsconfig.base.json` não tem seção
    `paths` (padrão atual do monorepo: paths são responsabilidade do
    consumidor). Alias entra em `apps/operator-agent/tsconfig.json` durante
    BL-C3-015.

13. **`tsconfig.node.json`** para `vite.config.ts` e `vitest.config.ts` (padrão
    leader, G-010). Sem isso, ESLint `projectService: true` rejeita os arquivos.

14. **`src/test-setup.ts` dentro de `src/`** (não na raiz) — match
    `include: ["src/**/*.ts"]` do tsconfig sem exception.

15. **`fireEvent` em vez de `userEvent` para tests de click** — userEvent v14
    conflita com `vi.useFakeTimers` (timeout). `fakeTimers` escopado por teste
    com `try/finally`, não global em `beforeEach`.

16. **`commitlint.config.cjs`** ampliado para aceitar scope `C9`. Sem isso,
    todos os commits desta sessão seriam rejeitados.

17. **Coverage thresholds OFF nesta sessão.** Apenas 31 smoke tests para validar
    "package vivo + XSS bloqueado". Meta de 85%+ entregue em BL-C8-008 (sessão
    dedicada). `TODO(BL-C8-008)` no `vitest.config.ts`.

### Referências

- Sessão de implementação: BL-C9-completo (Wave 2, Sessão 20)
- `packages/ui-kit/dev/SCOPE_QUESTION.md` — audit trail da decisão BL-C9-006
- CLAUDE.md §4 "Estrutura interna de `@sprint/ui-kit` (W2.C9)" — convenções
  detalhadas
- ADR-014 (sanitização) — base para defesa em profundidade do `<TextBlock>`
- G-010 (CLAUDE.md §12) — padrão `tsconfig.node.json` para configs Vite
- Backlog v1.1 §6/C9

## Nota técnica — BL-C3-009 a 016 (refinamento C3 na W2 — Sessão 21)

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Renan (3Studio), Claude Opus 4.7

### Contexto

Wave 2 do projeto exige refinamento do componente C3 (Operator Agent)
adicionando 5 features novas (BL-C3-009/010/011/012) e refatorando a camada
visual para adotar o `@sprint/ui-kit` recém-entregue na W2 (BL-C3-015/016).
Sessão única atômica que toca código existente (diferente das sessões anteriores
que entregaram componentes inteiros do zero).

### Decisão

Implementação ordenada por dependência: features de comportamento (main process)
primeiro, refactor visual (renderer) por último. Ordem:

1. BL-C3-012 (deadline guard)
2. BL-C3-010 (fila por criado_em)
3. BL-C3-009 (reabertura via tray)
4. BL-C3-011 (detecção de cancelamento)
5. BL-C3-015 (refactor para @sprint/ui-kit)
6. BL-C3-016 (ThemeProvider + zero hardcoding)

### Decisões técnicas durante implementação

1. **`historyService.archive` em deadline-passed (BL-C3-012)** — antes só
   `markProcessed` (memória); agora arquiva localmente para auditoria alinhando
   com a leitura literal de "move para histórico". Fallback `markProcessed` em
   falha de archive preserva dedup em memória.

2. **Ordenação por `criado_em` no QueueService.enqueue (BL-C3-010)** —
   `Date.parse` timezone-aware; empate em criado_em mantém FIFO de chegada.
   Invariante crítica: `items[0]` (sprint atualmente exibida) NÃO é preempted.
   Sprints novas com criado_em mais antigo entram em `items[1]`. Preempção do
   overlay no meio da exibição quebraria `handleAck` (peek mismatch) e seria má
   UX (operador confundiria qual sprint está confirmando).

3. **Tray "Reabrir último aviso" habilitado iff `kind === 'idle'` (BL-C3-009)**
   — mutuamente exclusivo com "Mostrar sprint atual" (visível em
   `sprint_active`). Simplifica UX (sempre só 1 ação de visualização
   disponível). Em `config_error` ambos desabilitados.

4. **`reopenedMode` flag no OverlayService (BL-C3-009)** — overlay reaberto NÃO
   toca em `currentItem` (preserva null/idle do main). `closeReopened` no-op
   fora do modo (defesa contra IPC adulterado). `showSprint`/`hide`/`destroy`
   resetam o flag — fluxo normal sempre supersede reopen (cenário raro: sprint
   chega durante reopen).

5. **IncomingSprintEvent.reopened?: boolean (BL-C3-009)** — campo opcional.
   Renderer ramifica label do botão ("Fechar" vs "Recebi") e handler
   (`overlay.closeReopened` vs `sprint.acknowledge`).

6. **`listPending` SEM filter userId (BL-C3-011)** — antes filtrava `{ userId }`
   mas isso descartava cancels (broadcast). Agora sem filter; sprints de outros
   operadores filtradas inline em `processSprint`. Cancels processados via novo
   `processCancel`.

7. **`overlayService?` opcional em PollingDeps (BL-C3-011)** — cancel handling
   precisa de acesso ao overlay para hide() quando exibida. Composição via dep
   injection mantém testabilidade isolada (mock no testKit).

8. **`removeBySprintId` no QueueService (BL-C3-011)** — idempotente; NÃO emite
   `nextSprint` mesmo removendo items[0] (caller orquestra próxima exibição —
   mesma semântica de `dequeue`).

9. **Refactor para `<Overlay>` do ui-kit (BL-C3-015)** — substituição completa
   do componente Overlay.tsx local + componentes auxiliares (`SprintCard`,
   `AckButton` deletados). DeadlineBadge + QueueIndicator preservados (reused no
   body slot). Window management (`overlayService.createWindow`: fullscreen,
   alwaysOnTop:'screen-saver', skipTaskbar) permanece no main; ui-kit é só
   apresentacional.

10. **`autoCloseSeconds={0}` no `<Overlay>` do ui-kit (BL-C3-015)** — ui-kit tem
    timer próprio (`useEffect` com setTimeout). Para evitar timer duplicado com
    o main (`overlayService.minimizeAfterMs`), desabilitamos o do ui-kit. Main
    fica como única fonte de verdade do ciclo de vida da janela. Documentação no
    Overlay.tsx do Agent.

11. **Loading/error/warning UX no body slot (BL-C3-015)** — ui-kit `<Overlay>`
    button não tem `disabled` prop. Guard `if (loading) return;` no handler
    previne double-click. Surface de erro/warning inline preserva UX do W1
    (regressão F-024 mantida).

12. **Label dinâmico do botão (BL-C3-015 + BL-C3-009)** — "Confirmando…"
    (loading), "Fechar" (reopened), "Recebi" (normal). "Recebi" diverge do
    default "Recebido" do ui-kit por convenção UX consolidada no W1.

13. **`key={sprint?.sprint_id ?? 'idle'}` no `<Overlay>` em App.tsx
    (BL-C3-015)** — força remount em troca de sprint; reseta loading/
    error/warning sem useEffect manual. Mesmo pattern do W1 com
    `key={sprint_id}` em AckButton (agora deletado).

14. **Meta gigante usa `--sprint-font-size-4xl` (120px) (BL-C3-016)** — antes
    160px local; agora 120px (tier canônico "métrica gigante" definido no C9).
    Visual ligeiramente menor mas dentro do "operador vê de longe".

15. **`global.css` reduzido + zero hardcoding (BL-C3-016)** — tokens locais
    (`--color-*`, `--space-*`, `--font-size-*`, `--radius-*`) removidos.
    ThemeProvider importa tokens.css que registra `--sprint-*` em `:root`
    globalmente. `min-width: 140px` no DeadlineBadge e `max-width: 1200px` no
    Overlay removidos (largura content-driven; card do ui-kit limita via
    `max-width: 720px`).

### Métricas

- Tests: 199 (W1 baseline) → 240 (W2 final). +41 novos cobrindo todas as novas
  capacidades.
- Lint, type-check, build do Agent: zero warnings.
- Componentes deletados: AckButton (4 arquivos) + SprintCard (4 arquivos).
  Subsumidos pelo novo Overlay.tsx.
- Hardcoding visual em src/renderer: 0 hex, 0 px hardcoded (1 px em comentário).

### Referências

- Sessão de implementação: BL-C3-w2-refinamento (Wave 2, Sessão 21)
- CLAUDE.md §4 "Atualização W2 — BL-C3-009/010/011/012/015/016" — detalhes por
  camada
- Backlog v1.1 §6/C3 (itens 009-016)
- ADR-019 — arquitetura W1.C3 (base sobre a qual W2 refatora)

---

## Nota técnica — Sessão 43 (2026-05-28) — Leader W2 + writeCancel (ciclo de cancelamento ponta-a-ponta)

**Wave:** W2 — em curso **Componentes:** C2 (Leader) + C4 (fs-adapter)
**Itens:** [BL-C4-004, BL-C2-006, BL-C2-008, BL-C2-009] **Status:** ✅ mergeado
em `develop` após PR.

Esta sessão entrega 4 BLs em commits atômicos separados (1 BL por commit),
fechando o ciclo de cancelamento ponta-a-ponta. O Agent (BL-C3-011, mergeado em
W2 anterior) já detectava `cancel-*.json` e fechava o overlay sem ack — faltava
o lado escritor. Esta sessão entrega o escritor, o tipo `SprintCancel` (Anexo E)
já existia em `@sprint/contracts`.

### Decisões arquiteturais materializadas

1. **`writeCancel` espelha `writePending`** — escrita atômica via
   `IFilesystemAdapter.writeFileAtomic` (`.tmp` + rename interno). Re-validação
   Zod em runtime (`parseSprintCancel`) por defesa em profundidade contra cast
   bypass. JSON pretty-printed (2-space) para inspeção manual da TI da fábrica
   via `notepad`/`type` — consistente com `writePending` e `writeAck`.

2. **`PendingStore` opcional no construtor da `CancelStore`** —
   `new CancelStore(adapter, sharedPath, pendingStore?)`. Quando injetado
   (composition root do main do Leader), `writeCancel` lista pendings da sprint
   e os deleta. Quando ausente (testes de escrita isolada), `removedOriginals` é
   sempre `[]`. Decisão alinhada com o feedback "qual acha mais viável" —
   pattern padrão do projeto (sem opts mutáveis; comportamento idempotente).
   Permite construção limpa em testes.

3. **Schema escrito pelo Leader = schema lido pelo Agent (Anexo E)** —
   `sprint_id_ref` é o campo de match, NÃO `sprint_id`. Confirmado pelo código
   do `pollingService.processCancel` no Agent (BL-C3-011). Sem divergência de
   integração. `cancelado_por` vem do `LeaderConfig.criado_por` (mesmo campo que
   vai no `criado_por` do `SprintPayload`). `cancelado_em` é ISO 8601 com
   offset.

4. **Race-safe remoção de originais** — entre o `listPending({ sprintId })` e o
   `deletePending(filename)`, o Agent pode processar e remover o arquivo.
   `FileNotFoundError` é capturado e silenciado (`continue` no loop); outros
   `FilesystemError` propagam. Cenário comum em alta concorrência.

5. **Customização de título/corpo no momento do dispatch (BL-C2-006)** — o
   `{meta}` é substituído por operador no `DispatchService.substituteMeta`, não
   no preview ou no Agent. O Agent permanece "burro": recebe HTML final já com a
   meta literal. `sanitizeBodyHtml` é aplicado depois da substituição,
   idempotente (CLAUDE.md §7.9, ADR-014).

6. **Defaults centralizados em helpers exportados (BL-C2-006)** —
   `resolveTitle`/`resolveBodyTemplate` no `DispatchService` aplicam `.trim()`
   antes de comparar com vazio. Líder que apaga input ou deixa só whitespace cai
   pro default. Helpers exportados para teste isolado.

7. **Tela de acks com 3 estados derivados (BL-C2-008)** — Anexo D:
   `displayed_at` presente = "visto"; `acknowledged_at` presente = "confirmado";
   sem ack = "nao_visto". `AckTrackingService.list` agrega `AckStore` +
   `OperatorsService`, retornando `AckStateView[]` com `user_nome_exibicao`
   resolvido + timestamps + hostname. `DirectoryNotFoundError` em `acks/` é
   benigno (pasta ainda não criada pelo primeiro ack).

8. **Polling 3s com cleanup em flag (BL-C2-008)** — `useEffect` em
   `Acompanhamento.tsx` declara `signal = { cancelled: false }` no escopo do
   effect, passa para o `fetchAcks`, e no cleanup faz
   `signal.cancelled = true` + `clearInterval`. Pattern reutilizável para
   qualquer componente com polling concorrente a IPC async.

9. **`useTrackedSprintStore` em sessão (BL-C2-008 + BL-C2-009)** — persiste a
   sprint disparada com `sprint_id`, `targets` (id + meta), `title`,
   `deadline_hhmm`, `dispatched_at`. Setada pelo
   `NovaSprint.handleDispatchClick` quando `result.summary.success > 0` (targets
   que falharam ficam fora — não há nada para acompanhar). Persistência em disco
   fica para W3+ (histórico via fs-adapter).

10. **Botão Cancelar Sprint na tela de Acompanhamento (BL-C2-009)** — decisão de
    UX confirmada com o Renan via AskUserQuestion. O líder vê o estado dos acks
    e decide se cancela. Modal com `aria-modal="true"` e `aria-labelledby` por
    acessibilidade. Click no backdrop fecha; `submitting` desabilita botões;
    sucesso chama `markCancelled()` na store.

11. **Polling para automaticamente em `cancelled` (BL-C2-009)** — em vez de
    parar o `setInterval` explicitamente no `markCancelled`, o `useEffect` da
    Acompanhamento observa `current.cancelled` e retorna `undefined` no caso
    cancelado. A mutação do store dispara re-execução do effect, cleanup do
    interval anterior, e novo effect com `return undefined`. Sem timers
    fantasmas.

12. **Validação de sprint_id via parseSprintCancel (BL-C2-009)** —
    `CancelService.cancel` NÃO usa `sprintIdSchema.parse` direto (que lançaria
    `ZodError`). Em vez disso, passa `request.sprint_id` direto para
    `parseSprintCancel`, que internamente faz safeParse e converte para
    `ContractValidationError` com contexto do campo. Mesma semântica do
    `DispatchService.dispatch`.

### Métricas

- Testes: fs-adapter 286 → 308 (+22). Leader 210 → 332 (+122). Total monorepo
  +144. Agent intocado (240 estável).
- Lint, type-check, build do Leader: zero warnings.
- Build do fs-adapter: zero warnings.
- Commits: 4 BL + 1 docs = 5 separados, sem squash, escopo BL-XXX no scope do
  conventional commit.

### Referências

- Sessão de implementação: feature/BL-C2-w2-leader-cancelamento (Sessão 43)
- SESSION_LOG.md Sessão 43 — narrativa completa por commit
- Backlog v1.1 §6/C2 (006, 008, 009) e §6/C4 (004)
- ADR-013 — port-and-adapter do fs-adapter (base do CancelStore)
- ADR-014 — sanitização de body_html (preservada no pipeline customizado)
- ADR-015 — composer do Leader W1 (refinado por BL-C2-006)
- ADR-017 — main process do Leader W1 (estendido por C2-006/008/009)
- Pendências W2: BL-C7-008/009 (ADRs) e BL-C8-008 (threshold ≥85% C9) —
  **fechados na remediação R1 (2026-05-29)**: ver ADR-022/023 abaixo e
  thresholds materializados em `packages/ui-kit/vitest.config.ts`.

---

## ADR-022: Adoção do `@sprint/ui-kit` (C9) como design system compartilhado

- **Status:** Accepted
- **Data:** 2026-05-29
- **Decisores:** Renan (3Studio), Claude Opus 4.7

> Formaliza, como ADR rastreável, a decisão antes registrada apenas como "Nota
> técnica — C9 (BL-C9-001 a 006)" (acima). Escrito na remediação R1 da auditoria
> da W2 (AUD-W2-002). Fecha o BL-C7-008 e destrava o critério 7 do Gate W2→W3.

### Contexto

A Wave 2 introduziu um quarto package compartilhado, `@sprint/ui-kit` (C9), que
concentra o chrome visual do overlay do Agent (`<Overlay>`,
`<OverlayMinimized>`/`<Pill>`, `<TextBlock>`, `<ThemeProvider>`) e os design
tokens da identidade ARTFLEXÍVEIS (tema DARK extraído da imagem 'Hora do
Rush!'). Antes do C9, o markup e os estilos do overlay viviam dentro de
`apps/operator-agent`. Com o redesign visual (ADR-018) e a perspectiva de o
Leader também consumir componentes compartilhados, era preciso decidir
formalmente (a) extrair um package de UI e (b) com qual arquitetura de build, já
que ele diverge dos demais packages (React + CSS Modules vs. TS puro
source-first).

### Decisão

Adotamos `@sprint/ui-kit` como o design system compartilhado do monorepo, com:

- **Vite library mode + `vite-plugin-dts` (rollupTypes)** em vez do padrão
  source-first (contracts/fs-adapter/logger). Integra CSS Modules e gera ESM
  tree-shakeable + `.d.ts` agrupado num pipeline só; tsc puro não lida bem com
  CSS Modules. Build produz `dist/{index.js, index.d.ts, tokens.css}`.
- **Tokens com prefixo obrigatório `--sprint-`** (RNF-23), validados por
  `tokens.test.ts` no CI. Zero hex/px hardcoded nos `.module.css` dos
  componentes.
- **`<ThemeProvider>` sem Context API** — tokens propagam por cascata CSS,
  idempotentes em aninhamento.
- **`react`/`react-dom` como `peerDependencies`** (`^18.3.0`);
  **`@sprint/contracts` como `dependency` workspace** (primeira ligação
  inter-package partindo do C9), usada só pelo `<TextBlock>` para
  `sanitizeBodyHtml` e externalizada no bundle.
- **Path alias `@sprint/ui-kit` é responsabilidade do consumidor** (não entra em
  `tsconfig.base.json`) — coerente com o padrão de paths do monorepo.

Consumo: o Agent migrou para o ui-kit em BL-C3-015/016; o Leader pode consumir
em waves futuras. Apps referenciam `dist/` em produção; dev/test podem usar
source via alias próprio.

### Alternativas consideradas

| Alternativa                                       | Por que rejeitada                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manter a UI dentro de `apps/operator-agent`**   | Impede reuso pelo Leader; acopla a identidade visual a um app; testes de UI ficam presos ao runtime do Electron.                                                       |
| **Source-first com tsc puro (padrão dos outros)** | tsc puro não processa CSS Modules nem extrai `tokens.css`; exigiria pipeline paralelo. Vite library mode resolve num passo.                                            |
| **Tokens sem prefixo / two-tier**                 | Two-tier (primitivos + semânticos) é overkill para o MVP (≈4 componentes). Single-tier semântico + escala neutra basta; o prefixo `--sprint-` evita colisão de tokens. |
| **Context API no `<ThemeProvider>`**              | Desnecessário — a cascata CSS já propaga tokens estáticos; Context adicionaria re-render e boilerplate sem benefício.                                                  |

### Consequências

- O monorepo passa de 3 para **4 packages compartilhados**; o ui-kit é o único
  em Vite library mode. Divergência documentada e justificada.
- Apps consumidores precisam do `dist/` populado em dev — exige `predev` na raiz
  - `emptyOutDir` condicional em watch (G-026).
- Mudança de token vira mudança visível em todos os consumidores — disciplina de
  changeset (`@sprint/ui-kit`) + teste anti-regressão de tokens.
- Ratifica-se **`DECISIONS.md` como o repositório de ADRs do projeto**
  (AUD-W2-014); não há `docs/adr/` separado. O texto literal do gate
  ("ADR-003/004 em docs/adr/") fica como pendência de ajuste no backlog externo.

### Referências

- "Nota técnica — C9 (BL-C9-001 a 006)" (acima) — decisões de implementação
- CLAUDE.md §4 "Estrutura interna de `@sprint/ui-kit` (W2.C9)"
- ADR-014 (sanitização — base do `<TextBlock>`), ADR-018 (redesign visual)
- G-010 (`tsconfig.node.json`), G-026 (`predev` + `emptyOutDir` em watch)
- Backlog v1.1 §6/C7 (BL-C7-008), Gate W2→W3 critério 7
- AUD-W2-002 / AUD-W2-014 (auditoria da W2 — origem desta formalização)

---

## ADR-023: Não adoção de Storybook na v1.0

- **Status:** Accepted
- **Data:** 2026-05-29
- **Decisores:** Renan (3Studio), Claude Opus 4.7

> Escrito na remediação R1 da auditoria da W2 (AUD-W2-002). Fecha o BL-C7-009 e
> completa o critério 7 do Gate W2→W3 junto com ADR-022.

### Contexto

Design systems costumam vir acompanhados de Storybook para desenvolvimento
isolado e documentação visual de componentes. Ao formalizar o C9 (ADR-022),
avaliamos se a v1.0 do `@sprint/ui-kit` deveria adotar Storybook.

### Decisão

**Não adotamos Storybook na v1.0.** A superfície de componentes é pequena
(`<Overlay>`, `<OverlayMinimized>`/`<Pill>`, `<TextBlock>`, `<ThemeProvider>`) e
já é coberta por:

- **Vitest + jsdom + Testing Library** para comportamento (ARIA, sanitização
  XSS, auto-close, idempotência) — testes honestos, cobertura ≥85% enforçada em
  CI (BL-C8-008, AUD-W2-001/004).
- **`dev/palette-preview.html`** — preview estático standalone do tema DARK.
- **Os próprios apps consumidores** — o Agent renderiza os componentes em
  `BrowserWindow` real (fullscreen/topmost), fidelidade maior que stories
  isoladas para um overlay cujo comportamento depende do chrome da janela.

### Alternativas consideradas

| Alternativa                       | Por que rejeitada na v1.0                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adotar Storybook agora**        | Segundo pipeline de build/bundler + manutenção de stories + deps, desproporcional a ≈4 componentes. O overlay depende de window chrome (fullscreen/topmost) que stories não reproduzem. |
| **Ladle / Histoire (mais leves)** | Mesmo custo conceitual (manter stories) sem ganho relevante no porte atual; adiciona ferramenta nova ao stack.                                                                          |
| **Documentação só em Markdown**   | Já existe (README do package + CLAUDE.md §4 + `palette-preview.html`). Suficiente para a v1.0.                                                                                          |

### Consequências

- Componentes são desenvolvidos e validados via testes + preview estático + apps
  reais. Sem catálogo interativo isolado.
- Sem dívida de stories desatualizadas — não há stories para manter.
- **Trigger de reavaliação:** se a contagem de componentes crescer
  substancialmente (expansão real do design system em W4+) ou se um time de
  design passar a consumir o kit isoladamente, reabrir a decisão.

### Referências

- ADR-022 (adoção do C9 — contexto imediato desta decisão)
- `packages/ui-kit/README.md`, `packages/ui-kit/dev/palette-preview.html`
- Backlog v1.1 §6/C7 (BL-C7-009), Gate W2→W3 critério 7
- AUD-W2-002 (auditoria da W2 — origem desta formalização)

---

## ADR-024: Estratégia de assinatura e confiança de código (cert auto-assinado + GPO)

- **Status:** Accepted
- **Data:** 2026-06-01
- **Decisores:** Renan (3Studio), Claude Opus 4.8

> Primeiro ADR da Wave 3 (Production Readiness), escrito junto da entrega do
> **BL-C0-008** (code signing). **Nota de numeração:** o prompt do item pedia
> "ADR-005", mas esse número já pertence ao schema-first (registrado na W0). O
> repositório é a fonte de verdade — esta decisão entra como **ADR-024**, o
> próximo sequencial após ADR-023.

### Contexto

O Gate **W3→W4** exige instalador assinado (e o Gate W1→W2 já aceitava "EXEs
assinados, mesmo com cert de teste" — precedente do projeto). **RI-01**:
antivírus corporativo e o SmartScreen bloqueiam/avisam sobre EXE não assinado
("editor desconhecido"), o que atrapalha o deploy nas estações da fábrica. A
distribuição do Sprint Dispatcher é **100% interna**, em estações Windows
gerenciadas via **Active Directory / GPO** (RNF-15/16, US-04.02) — não há
distribuição fora do domínio. Logo, a confiança na assinatura **não** precisa
vir de reputação de CA pública (SmartScreen); pode vir da própria TI,
distribuindo a chave pública como raiz confiável.

### Decisão

Assinar os dois EXEs (`SprintLeader.exe`, `SprintAgent.exe`) com um
**certificado de code signing auto-assinado da ARTFLEXÍVEIS**, cuja confiança é
estabelecida pela **distribuição do `.cer` via GPO** (Trusted Root + Trusted
Publishers) — **custo zero, sem CA paga**.

Infraestrutura de assinatura **idiomática e estável**, idêntica
independentemente da origem do certificado:

- **electron-builder nativo** — `CSC_LINK` (caminho do `.pfx`) +
  `CSC_KEY_PASSWORD` lidos do **ambiente**, nunca hardcoded no YAML. Chaves
  top-level em `win:` (electron-builder **24.x** — `signtoolOptions` é da linha
  25.x, não usada aqui).
- **Timestamping RFC 3161** (`rfc3161TimeStampServer`) — a assinatura permanece
  válida após o certificado expirar.
- **Digest SHA-256** (`signingHashAlgorithms: [sha256]`), nunca SHA-1.
- **Assinatura só no caminho de release** (`release.yml`, tag `v*.*.*`,
  `windows-latest`). PR/branch builds **não** assinam nem expõem Secrets
  (`CSC_IDENTITY_AUTO_DISCOVERY=false` nos builds não-release).
- O `.pfx` (privado) e a senha **nunca** entram no Git (`.gitignore`: `.certs/`,
  `*.pfx`); no CI vêm dos Secrets `WINDOWS_CERT_PFX_BASE64` +
  `WINDOWS_CERT_PASSWORD`. **Trocar a origem do certificado = trocar um
  Secret.**

### Alternativas consideradas

| Alternativa                               | Veredito                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **(a) CA interna AD CS (Enterprise CA)**  | **Equivalente e também $0.** A raiz da CA interna já é distribuída automaticamente a todo o domínio (sem empurrar o `.cer` manualmente). **Recomendada se a empresa já operar uma Enterprise CA.** Migração = trocar o Secret. |
| **(b) Certificado público pago (OV/EV)**  | **Rejeitada para o MVP.** Custo recorrente + chave privada em HSM/token obrigatório desde jun/2023 (FIPS 140-2 L2+) + só necessário para distribuição **externa**, que está fora de escopo (sistema LAN-only).                 |
| **(c) Whitelist por hash sem assinatura** | Mitiga o antivírus (Anexo G.8), mas deixa "editor desconhecido" e exige re-whitelist a cada versão. Mantida como **mitigação complementar**, não como estratégia principal.                                                    |

### Consequências

- **Confiança válida apenas dentro do domínio** — aceitável: o sistema é
  LAN-only e todas as estações estão no AD da ARTFLEXÍVEIS. Fora do domínio, o
  artefato fica "assinado mas não-confiável" (esperado; `verify-signature.ps1`
  trata como aviso, não falha).
- **Migração para CA interna ou cert público é troca de Secret**, sem reescrever
  YAML, scripts ou workflow. (Cert EV/HSM, se um dia, exigiria um hook de
  assinatura customizado no electron-builder — anotado no runbook.)
- **`release.yml` é o ponto de extensão para BL-C0-009** (bump de versão via
  Changesets, publicação em GitHub Releases, notificação) — marcado com
  `# TODO(BL-C0-009)`; depende de BL-C5-005 (nomeação de artefatos).
- **Ação operacional pendente do TI** (pré-requisito, não bloqueia o código):
  gerar o cert, distribuir o `.cer` via GPO (Trusted Root + Trusted Publishers)
  e cadastrar os 2 Secrets. Decisão cert auto-assinado **ou** AD CS fica com o
  TI — ambos $0.
- A parte sensível (decode do PFX + cleanup) é isolada em `pfx-secret.mjs`
  (workspace `@sprint/release-tools`) e **unit-testada**; a
  assinatura/verificação Authenticode real é validada via CI/integração (não há
  unit test artificial sobre `signtool`).

### Referências

- `docs/guides/code-signing.md` — runbook (GPO $0 como principal, AD CS como
  opção, CA paga como nota de evolução).
- `apps/leader/electron-builder.yml`, `apps/operator-agent/electron-builder.yml`
  (bloco `win:`); `.github/workflows/release.yml`;
  `scripts/{generate-signing-cert.ps1,.sh,verify-signature.ps1,sign-local.ps1,prepare-signing-cert.mjs,pfx-secret.mjs}`.
- Contrato de Secrets: `WINDOWS_CERT_PFX_BASE64`, `WINDOWS_CERT_PASSWORD`.
- ADR-002/ADR-010 (Electron + electron-builder), ADR-001 (apps versionam pelo
  electron-builder, não Changesets).
- Backlog v1.1 BL-C0-008 (este item), BL-C0-009 (próximo, bloqueado por
  BL-C5-005), §5 (Pipeline DevOps); Requisitos RI-01, RNF-15/16, US-04.02, Anexo
  G.8.
