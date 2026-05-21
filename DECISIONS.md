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
