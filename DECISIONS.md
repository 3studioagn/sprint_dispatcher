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

| Alternativa            | Por que rejeitada                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **WPF (.NET/C#)**      | Time sem fluência. Tooling distinto do que usamos. Curva alta.                                                                                  |
| **PyQt / PySide**      | Empacotamento Python no Windows é frágil (PyInstaller, py2exe). UI menos polida.                                                                |
| **AutoHotkey**         | Suficiente pro overlay do Agent, mas Leader exige UI rica (forms, listas, validação). Stack dual seria pior.                                    |
| **Tauri**              | Promissor (binário ~10x menor que Electron), mas em 2026 ainda imaturo pra TOPMOST robusto e tray. Re-avaliar em Tauri 2.x (estimado jan/2027). |
| **Flutter Desktop**    | Quebra o single tech stack (Dart). Time não usa.                                                                                                |
| **Native Win32 / C++** | Custo de desenvolvimento desproporcional ao escopo.                                                                                             |

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

| #      | Arquitetura                           | Stack                          | Veredito                                             |
| ------ | ------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| **A1** | Backend cloud + WebSocket             | FastAPI + Postgres + WebSocket | Inviável por política de segurança                   |
| **A2** | Backend local + WebSocket             | FastAPI local + Postgres local | Exige servidor dedicado, abertura de porta, operação |
| **A3** | **Pasta compartilhada SMB + polling** | EXEs + SMB share               | **Escolhida**                                        |
| **A4** | Banco de dados local + polling        | Postgres + ODBC                | Exige licenciamento, gestão de credenciais           |

Critérios de decisão (✓ = melhor, △ = neutro, ✗ = pior):

| Critério                      | A1  | A2  | A3  | A4  |
| ----------------------------- | --- | --- | --- | --- |
| Aprovação TI / Segurança      | ✗   | △   | ✓   | △   |
| Custo de infraestrutura       | △   | △   | ✓   | △   |
| Velocidade de desenvolvimento | △   | △   | ✓   | ✗   |
| Manutenibilidade              | △   | △   | ✓   | △   |
| Extensibilidade futura        | ✓   | ✓   | △   | ✓   |

A3 ganhou em 4 dos 5 critérios. O único trade-off — extensibilidade — é mitigado
pelo §"Migração futura" do doc de requisitos: o formato JSON é preservado
intacto entre filesystem e payload HTTP de eventual API REST (A1).

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
