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
