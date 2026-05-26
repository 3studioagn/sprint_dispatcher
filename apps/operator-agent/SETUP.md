# Sprint Operator Agent — Setup Local

Guia para devs que vão rodar e desenvolver o Sprint Operator Agent localmente.
Para a visão geral do monorepo e onboarding inicial, consulte
[`/README.md`](../../README.md) e [`/CLAUDE.md`](../../CLAUDE.md).

---

## 1. Pré-requisitos

- **Node.js** ≥ 20 (recomendado: `nvm use` na versão fixada em `.nvmrc` —
  24.10.0)
- **pnpm** ≥ 10 — `corepack enable && corepack use pnpm@10`
- **Windows** com Developer Mode habilitado (necessário para empacotar Electron
  localmente — G-008 em `CLAUDE.md`)
- `pnpm install` já rodado na raiz
- (Opcional, para teste E2E) Sprint Leader configurado — ver
  [`apps/leader/SETUP.md`](../leader/SETUP.md)

---

## 2. Configuração local (`config.json`)

O Agent **continua vivo** sem `config.json` válido — diferente do Leader, o boot
é fail-soft: tray fica **vermelho** com balloon "Configuração necessária",
polling NÃO inicia, mas o processo persiste. Crie o `config.json` e reinicie (ou
aguarde recovery automático via IPC `config:get` se o renderer for aberto).

### 2.1. Localização do `config.json`

| Ambiente             | Caminho                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Dev** (`pnpm dev`) | `%APPDATA%\sprint-operator-agent\config.json` — derivado do `name` no `package.json`                |
| **Build packaged**   | `%APPDATA%\Sprint Operator Agent\config.json` — derivado do `productName` do `electron-builder.yml` |

### 2.2. Schema do `config.json`

```json
{
  "schema_version": "1.0",
  "user_id": "joao",
  "user_nome_exibicao": "João Silva",
  "hostname": "ART-DESIGN-04",
  "shared_path": "C:\\caminho\\absoluto\\para\\pasta\\compartilhada",
  "polling_interval_seconds": 3,
  "som_notificacao": true,
  "log_level": "info",
  "minimize_after_seconds": 30
}
```

| Campo                      | Tipo                        | Restrição                                      | Uso                                                                                 |
| -------------------------- | --------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `schema_version`           | `"1.0"`                     | literal                                        | versionamento — ADR-005                                                             |
| `user_id`                  | `string` (1-50 chars)       | deve existir em `<shared_path>/operators.json` | identifica esta estação; filtra sprints do polling                                  |
| `user_nome_exibicao`       | `string` (1-100 chars)      | qualquer                                       | exibido em telas de diagnóstico                                                     |
| `hostname`                 | `string` (1-100 chars)      | nome desta estação                             | vai no campo `hostname` do `SprintAck`                                              |
| `shared_path`              | `string`                    | path absoluto que **existe e é diretório**     | onde o app vai ler `pending/`, escrever `acks/`, ler `operators.json`               |
| `polling_interval_seconds` | `number` 1-60               | default `3` (ADR-004)                          | intervalo entre polls de `<shared>/pending/`                                        |
| `som_notificacao`          | `boolean`                   | default `true`                                 | (W2) ativa beep ao receber sprint                                                   |
| `log_level`                | `'trace'..'fatal'`          | default `'info'`                               | (W1.C6) controla verbosity do logger                                                |
| `minimize_after_seconds`   | `number` 1-300 **opcional** | default `30`                                   | timer de auto-minimize do overlay para tray (BL-C3-005). Campo W1-only extra-schema |

**Atenção:** campos extras desconhecidos → `ConfigInvalidError` (schema
`agentConfigSchema` do `@sprint/contracts` é `.strict()`).

O campo `minimize_after_seconds` é **lido fora do schema** (stripado antes do
`safeParseAgentConfig`) — invenção W1 do Agent. Não modifica
`@sprint/contracts`. Validação faixa 1-300 acontece no `loadConfig` do Agent.

### 2.3. Setup em dev — passo a passo

1. Copie o template:

   ```powershell
   Copy-Item dev-fixtures\agent-config.example.json `
     "$env:APPDATA\sprint-operator-agent\config.json"
   ```

   **CRÍTICO:** Use UTF-8 SEM BOM. O `Set-Content -Encoding utf8` do PowerShell
   5.1 adiciona BOM (caractere `﻿` invisível) que quebra `JSON.parse`. Se editar
   o config via PowerShell, use:

   ```powershell
   [System.IO.File]::WriteAllText($path, $content, `
     [System.Text.UTF8Encoding]::new($false))
   ```

   Ou abra/edite via Notepad com "Save As → UTF-8 (sem BOM)".

2. Remova a linha `"_comment"` do JSON copiado (o schema é estrito).

3. Ajuste o `shared_path` para apontar para `dev-fixtures/shared/` neste repo
   (path absoluto). Exemplo:

   ```json
   {
     "shared_path": "C:\\Users\\seuusuario\\sprint-dispatcher\\dev-fixtures\\shared",
     ...
   }
   ```

4. Ajuste o `user_id` para um operador que existe em
   `dev-fixtures/shared/operators.json` — opções dev: `joao`, `maria`, `carlos`,
   `beatriz` (todos `ativo: true`). `rafael` está `ativo: false` e não vai
   aparecer no Leader.

5. (Opcional) Ajuste `minimize_after_seconds` para um valor pequeno (e.g. `10`)
   durante desenvolvimento para validar o auto-minimize sem esperar 30 s.

---

## 3. Rodar o Agent em modo dev

```powershell
pnpm --filter sprint-operator-agent dev
```

Vite serve o renderer (overlay) em `http://localhost:5174` e
`vite-plugin-electron` spawna o processo Electron com hot reload em main,
preload e renderer.

**Boot esperado (config válido):**

1. Tray icon aparece **cinza** (estado `idle`) no system tray.
2. Tooltip ao hover: `Sprint Operator Agent — aguardando sprints`.
3. Polling silencioso de `<shared>/pending/` a cada `polling_interval_seconds`.
4. Quando o Leader dispara uma sprint para este `user_id`, em até
   `polling_interval_seconds` o overlay TOPMOST fullscreen aparece com o
   título + body + meta + botão "Recebi" + badge `+N aguardando`.

**Boot esperado (config inválido):**

1. Tray icon **vermelho** (estado `config_error`).
2. Balloon do Windows: "Configuração necessária — \<mensagem específica\>".
3. Tooltip permanece com a mensagem de erro até config ser corrigida.
4. Polling NÃO inicia; overlay nunca aparece.
5. Para destravar: edite/crie o `config.json` correto, reinicie `pnpm dev`.

---

## 4. Estrutura `dev-fixtures/`

A mesma `dev-fixtures/shared/` consumida pelo Leader.

```
dev-fixtures/
├── .gitignore                       # exclui pending/*.json + acks/*.json
├── config-example.json              # template leader-config.json
├── agent-config.example.json        # template agent-config.json (Gate 8)
└── shared/                          # apontado por shared_path
    ├── operators.json               # 4 ativos + 1 inativo (canonical dev list)
    ├── pending/                     # Leader escreve aqui; Agent lê e deleta
    └── acks/                        # Agent escreve aqui (displayed + acknowledged)
```

**Convenção de commit:**

- ✅ Committed: `.gitignore`, `config-example.json`,
  `agent-config.example.json`, `shared/operators.json`
- ❌ Não committed: qualquer `.json` em `shared/pending/` ou `shared/acks/`
  (gerados em runtime pelo dispatch/ack)

---

## 5. Histórico local

Sprints já processadas vão para `<userData>/historico/YYYY-MM-DD/`:

| Ambiente | Caminho                                                 |
| -------- | ------------------------------------------------------- |
| Dev      | `%APPDATA%\sprint-operator-agent\historico\YYYY-MM-DD\` |
| Build    | `%APPDATA%\Sprint Operator Agent\historico\YYYY-MM-DD\` |

A pasta é criada no boot (`historyService.ensureFolder`) e populada via
`historyService.archive` no ack final. Cada arquivo `.json` é uma cópia exata do
que estava em `<shared>/pending/` antes do ack.

**Dedup pós-restart:** `historyService.initializeFromDisk()` faz scan recursivo
da pasta no boot e popula o cache de filenames processados. Polling re-detecta
um arquivo via filename → `isAlreadyArchived` retorna true → skip (não
re-enfileira).

**Tray menu "Histórico local"** abre essa pasta no Windows Explorer.

---

## 6. Smoke test E2E (Leader + Agent simultâneos)

Sequência completa para validar o fluxo ponta-a-ponta:

### 6.1. Preparação

1. Em 2 terminais separados, suba os 2 apps (cache do turbo + portas distintas):

   ```powershell
   # Terminal 1
   pnpm --filter sprint-leader dev          # porta 5173

   # Terminal 2
   pnpm --filter sprint-operator-agent dev  # porta 5174
   ```

2. Ambos devem usar o **mesmo `shared_path`** (`dev-fixtures/shared/`).

3. Confirme tray do Agent **cinza** + Leader composer carregado com 4 usuários.

### 6.2. Fluxo de dispatch

1. No Leader: selecione **um usuário** que case com o `user_id` do Agent (e.g.
   `joao`).
2. Preencha meta (e.g. `5`).
3. Click **"Disparar evento"** → modal sucesso → arquivo `.json` aparece em
   `dev-fixtures/shared/pending/`.
4. Em até **`polling_interval_seconds`** (default 3 s), o Agent detecta:
   - Tray muda para **amarelo** (estado `sprint_active`).
   - Overlay fullscreen TOPMOST aparece com o conteúdo da sprint.
   - Arquivo `.ack.json` (com apenas `displayed_at`) aparece em
     `dev-fixtures/shared/acks/`.

### 6.3. Fluxo de ack

1. Click **"Recebi"** no overlay.
2. Overlay desaparece (ou troca para próxima sprint se houver fila).
3. Tray volta para **cinza** (se queue esvazia) ou continua **amarelo** com novo
   count.
4. Arquivo `.ack.json` em `dev-fixtures/shared/acks/` agora tem ambos
   `displayed_at` **e** `acknowledged_at` preenchidos.
5. Arquivo `.json` desaparece de `dev-fixtures/shared/pending/`.
6. Arquivo aparece em `%APPDATA%\sprint-operator-agent\historico\YYYY-MM-DD\`.

### 6.4. Fluxo de minimize automático

1. Dispare sprint (passo 6.2 acima).
2. **Aguarde `minimize_after_seconds`** (default 30 s) **SEM clicar nada**.
3. Overlay esconde sozinho (`minimize` automático).
4. Tray continua **amarelo** (sprint ainda na fila — não foi ackeada).
5. Click no tray icon → menu mostra **"Mostrar sprint atual"** habilitado.
6. Click em "Mostrar sprint atual" → overlay reabre **com timer resetado** (novo
   countdown de `minimize_after_seconds`).

---

## 6.5. Setup em 2 PCs (LAN — deployment real de teste)

O sistema foi desenhado para 2+ máquinas comunicando via pasta compartilhada SMB
(ADR-003). Não precisa de mudança no código — só configuração e permissões NTFS.

### 6.5.1. Topologia

```
+--------------------+        +-----------------------+        +-------------------+
| PC 1: Líder        |        | Pasta compartilhada   |        | PC 2: Operador    |
| (Sprint Leader)    |  ───►  | \\<HOST>\<share>      |  ───►  | (Sprint Agent)    |
|                    |        |   ├── operators.json  |        |                   |
|                    |  ◄───  |   ├── pending/        |  ◄───  |                   |
|                    |        |   └── acks/           |        |                   |
+--------------------+        +-----------------------+        +-------------------+
```

O `<HOST>` pode ser: um dos 2 PCs servindo via Windows Share, um file server
dedicado da LAN, ou um NAS (Synology/QNAP).

### 6.5.2. Setup do host SMB

Para usar um dos 2 PCs como host (cenário mais comum de teste):

```powershell
# No PC que vai hospedar (executar como Administrator)
New-Item -ItemType Directory -Path 'C:\SprintDispatcher\shared\pending' -Force
New-Item -ItemType Directory -Path 'C:\SprintDispatcher\shared\acks' -Force

# Cria o operators.json com os user_ids reais. Use UTF-8 SEM BOM via
# [System.IO.File]::WriteAllText (PowerShell 5.1 Set-Content adiciona BOM).
$operators = @'
{
  "operators": [
    { "user_id": "renan", "user_nome_exibicao": "Renan",       "hostname": "PC-DESIGN-01", "ativo": true },
    { "user_id": "mario", "user_nome_exibicao": "Mario Souza", "hostname": "PC-DESIGN-02", "ativo": true }
  ]
}
'@
[System.IO.File]::WriteAllText(
  'C:\SprintDispatcher\shared\operators.json',
  $operators,
  [System.Text.UTF8Encoding]::new($false)
)

# Compartilha via SMB (admin obrigatório). 'Todos' em LAN doméstica;
# em produção use grupos AD específicos.
New-SmbShare -Name 'SprintDispatcher' `
  -Path 'C:\SprintDispatcher\shared' `
  -FullAccess 'Todos'

# Verifica
Get-SmbShare -Name 'SprintDispatcher'
```

Pasta agora acessível via `\\<NOME-DO-PC>\SprintDispatcher`. Do outro PC,
navegue para `\\<NOME-DO-PC>\` no Explorer para confirmar.

**Onde achar o nome do PC host:**

```powershell
$env:COMPUTERNAME
```

### 6.5.3. Setup do Leader (PC 1)

Em `%APPDATA%\sprint-leader\config.json`:

```json
{
  "shared_path": "\\\\NOME-DO-PC-HOST\\SprintDispatcher",
  "criado_por": "Renan"
}
```

**Atenção ao UNC duplo-escapado** no JSON: `\\\\` vira `\\` literal. Edite via
Notepad para evitar BOM do PowerShell.

### 6.5.4. Setup do Agent (PC 2)

Em `%APPDATA%\sprint-operator-agent\config.json`:

```json
{
  "schema_version": "1.0",
  "user_id": "mario",
  "user_nome_exibicao": "Mario Souza",
  "hostname": "PC-DESIGN-02",
  "shared_path": "\\\\NOME-DO-PC-HOST\\SprintDispatcher",
  "polling_interval_seconds": 3,
  "som_notificacao": true,
  "log_level": "info",
  "minimize_after_seconds": 30
}
```

- `user_id` **DEVE existir** em `operators.json` (criado no §6.5.2).
- `hostname` é livre — vai literal no `SprintAck.hostname` (útil para o líder
  identificar a estação física que ackou).
- `shared_path` **idêntico** ao do Leader. Use UNC, NÃO letra mapeada — cada PC
  pode mapear letras diferentes ou nem mapear.

### 6.5.5. Considerações importantes

1. **Firewall**: porta TCP **445** (SMB) precisa estar aberta entre os 2 PCs. Em
   LAN doméstica geralmente está; em rede corporativa pode estar fechada (TI
   precisa liberar). Verifica via:

   ```powershell
   Test-NetConnection -ComputerName NOME-DO-PC-HOST -Port 445
   ```

2. **Mesma rede**: LAN ou VPN. SMB **não roteia bem via Internet** sem VPN.

3. **Permissões NTFS**: o `New-SmbShare -FullAccess 'Todos'` cobre LAN
   doméstica. Em produção real, configure permissões mais granulares:
   - Leaders precisam **escrita** em `pending/` (e leitura em `acks/`).
   - Agents precisam **leitura** em `pending/`, **escrita** em `acks/`,
     **delete** em `pending/` (limpar após ack).

4. **Autenticação Windows**: a primeira conexão pode pedir credencial do PC
   host. Marque "Lembrar credenciais" pra ficar persistente.

5. **Latência SMB**: em LAN típica, polling de 3 s + I/O SMB resulta em ~5-8 s
   entre dispatch e overlay aparecer. Em rede congestionada pode chegar a 10-15
   s. Aceitável para o use case (comunicação de meta, não real-time).

6. **`hostname` é importante para o líder**: o `SprintAck` carrega o hostname
   literal do config do Agent. Isso permite ao líder identificar qual estação
   física ackou — útil quando o mesmo `user_id` é compartilhado por uma equipe
   que troca de PC (plantão).

### 6.5.6. O que ainda NÃO funciona end-to-end entre PCs

Itens diferidos (W2/W3) que limitam o teste real entre máquinas:

| Item                                          | Backlog        | Limitação atual                                                                                                                    |
| --------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Acompanhamento de acks em tempo real          | BL-C2-008 (W2) | Líder não vê acks chegando — só inspecionando manualmente `<shared>/acks/`                                                         |
| Cancelamento de sprint                        | BL-C2-009 (W2) | Líder não tem botão "Cancelar"; Agent ignora `cancel-*.json` se aparecer                                                           |
| Fila de pendentes ao boot do Agent            | BL-C3-010 (W2) | Funciona parcialmente: arquivos persistem em `pending/` até ackar; mas Agent não destaca visualmente que tinha sprints já vencidas |
| Retry com backoff em SMB down                 | BL-C3-013 (W3) | Hoje só loga e segue no próximo ciclo                                                                                              |
| Auto-start no boot do Windows                 | BL-C3-014 (W3) | Hoje precisa rodar `pnpm dev` manualmente ou shortcut do `.exe`                                                                    |
| Instalador `.exe` que pré-grava `config.json` | C5 (W3)        | Hoje setup do config é manual (este documento)                                                                                     |

**O ciclo principal (dispatch → polling → overlay → ack) funciona ponta-a-ponta
hoje** entre 2 PCs reais via SMB.

### 6.5.7. Troubleshooting do setup em 2 PCs

**Tray vermelho "Caminho inacessível: \\\\HOST\\share"**

- `Test-NetConnection -ComputerName HOST -Port 445` falha → firewall ou PC host
  offline.
- `Get-SmbShare` no host não lista o share → `New-SmbShare` não foi executado ou
  foi removido.
- Path digitado errado no `config.json` (ex.: 1 `\` em vez de 2 na escape JSON).

**Operador não aparece no Leader (`OperatorList` vazio)**

- `<shared>/operators.json` não existe OU o JSON é inválido (verifica via
  Notepad no PC host).
- Cada operador precisa ter `ativo: true`. Operadores com `ativo: false` ficam
  ocultos no Leader.

**Overlay não aparece no Agent mesmo com sprint no pending**

- `user_id` do config do Agent NÃO existe em `operators.json` (sem validação; só
  ignora silenciosamente).
- `user_id` do config do Agent não corresponde ao `user_id` do JSON do sprint
  (Leader pode ter disparado para outro operador).
- Filename do sprint não bate com pattern `<ULID>-<user_id>.json` — o
  `pollingService` ignora via `safeParseFilename`.

**Acks aparecendo mas Leader não vê**

- Esperado em W1 — acompanhamento (BL-C2-008) é W2. Verifica manualmente em
  `<shared>/acks/` no PC host.

---

## 6.6. Build via GitHub Actions (distribuição em produção)

O build local do `.exe` pode falhar porque o antivírus ESET trava o `app.asar`
(CLAUDE.md §12 G-009). Workaround: usar o workflow CI que builda num runner
Windows limpo do GitHub.

### 6.6.1. Disparar o build

**Trigger automático:** push em `develop` com mudanças em
`apps/operator-agent/**`, `packages/contracts/**`, `packages/fs-adapter/**`,
`pnpm-lock.yaml`, ou no próprio workflow.

**Trigger manual:** GitHub UI → **Actions** → **"Build Operator Agent"** → botão
**"Run workflow"** → escolhe branch → **"Run workflow"**.

### 6.6.2. Baixar os instaladores

Após o workflow concluir (✅ verde, ~5-10 min):

1. GitHub UI → **Actions** → click no run mais recente "Build Operator Agent".
2. Scroll até **"Artifacts"** no fim da página.
3. Click em **`sprint-operator-agent-windows`** → baixa um `.zip`.
4. Descompacta. Conteúdo:
   - **`SprintOperatorAgent-0.0.0-x64-portable.exe`** — portable, roda direto
     sem instalação. Bom pra teste rápido.
   - **`SprintOperatorAgent-Setup-0.0.0.exe`** — instalador NSIS pt-BR, com
     Start Menu shortcut + uninstaller. Recomendado pra deployment.

### 6.6.3. Instalar nos PCs dos operadores

Para cada operador (Otávio, Diemerson, André, etc.) repita em cada PC:

1. **Copia o `SprintOperatorAgent-Setup-X.X.X.exe` pro PC local** via pendrive
   ou share. **Não rode o setup direto do `\\srv-alpha\TEMP\Metas_3Studio\`** —
   o Windows trata como "executável de origem não confiável" e pode bloquear.

2. **Roda o setup** (duplo-clique). Aceita o EULA, escolhe pasta (default
   `Program Files\Sprint Operator Agent`).

3. **Cria o `config.json` local ANTES do primeiro boot:**

   ```powershell
   # No PC do operador, PowerShell com o usuário do operador:
   $config = @'
   {
     "schema_version": "1.0",
     "user_id": "<USER_ID_REAL>",
     "user_nome_exibicao": "<NOME_REAL>",
     "hostname": "<HOSTNAME_DESTE_PC>",
     "shared_path": "\\\\srv-alpha\\TEMP\\Metas_3Studio",
     "polling_interval_seconds": 3,
     "som_notificacao": true,
     "log_level": "info",
     "minimize_after_seconds": 30
   }
   '@

   # ATENÇÃO: instalador empacotado usa productName = "Sprint Operator Agent"
   # (com espaço). Path do userData é DIFERENTE do dev ("sprint-operator-agent"):
   $configPath = "$env:APPDATA\Sprint Operator Agent\config.json"
   New-Item -ItemType Directory -Path (Split-Path $configPath) -Force | Out-Null
   [System.IO.File]::WriteAllText(
     $configPath, $config, [System.Text.UTF8Encoding]::new($false)
   )
   ```

   Substitua:
   - `<USER_ID_REAL>` por um `user_id` que existe em
     `\\srv-alpha\TEMP\Metas_3Studio\operators.json` (e.g. `diemerson`,
     `otavio`, `andre`).
   - `<NOME_REAL>` — nome do operador (e.g. `Diemerson Costa`).
   - `<HOSTNAME_DESTE_PC>` — livre, geralmente o nome do PC físico (ex.:
     `PC-DESIGN-03`). Vai literal no `SprintAck.hostname`.

4. **Roda o Agent** via Start Menu → **"Sprint Operator Agent"**. Tray icon
   aparece em segundos.

5. **Verifica boot:**
   - ✅ Tray **cinza** → config OK + polling ativo. Pronto para receber.
   - ❌ Tray **vermelho** + balloon → leia a mensagem específica. Causas comuns:
     `user_id` não existe em `operators.json`; `shared_path` digitado errado;
     permissão NTFS bloqueando; Windows não autenticou no share (login do
     usuário não tem credenciais salvas).

### 6.6.4. Validar end-to-end pelo líder

1. **No PC do líder**, na app `Sprint Leader`, selecione um operador (e.g.
   Diemerson), preencha meta, clica **"Disparar evento"**.
2. **No PC do Diemerson**, em ~3 segundos (intervalo de polling), o overlay
   TOPMOST aparece em fullscreen com a meta.
3. Diemerson clica **"Recebi"**. Overlay desaparece.
4. **De volta no PC do líder**, inspeciona via Explorer:
   - `\\srv-alpha\TEMP\Metas_3Studio\acks\<sprint_id>-diemerson.ack.json` existe
     com `displayed_at` E `acknowledged_at` preenchidos.
   - O arquivo dele em `pending/` foi removido.
5. **No PC do Diemerson**, o arquivo aparece em
   `%APPDATA%\Sprint Operator Agent\historico\YYYY-MM-DD\`.

> **Acompanhamento em tempo real** (BL-C2-008, W2) vai trazer essa validação
> direto na UI do Leader. Hoje a inspeção é manual via Explorer.

### 6.6.5. Logs em produção

Como o instalador NSIS empacota o app sem console visível, os logs do main
process (warnings/errors do polling, ack, etc.) ficam no DevTools do overlay
quando este está aberto. Em background (sem overlay), os logs são perdidos —
fica como débito até **W1.C6** (`@sprint/logger` com Pino escrevendo em
`<userData>/logs/*.log`).

---

## 7. QA manual checklist (W1.C3 fim de sessão)

Marque com ✅ conforme passar. Items prefixados com 📷 são bons momentos para
screenshot (documentação).

### Boot e config

- [ ] 📷 Agent boota **sem** config → tray **vermelho** com balloon
      "Configuração necessária"
- [ ] Agent boota **com** config válido → tray **cinza**, polling silencioso
- [ ] Tray menu mostra "Mostrar sprint atual" DESABILITADO, "Histórico local",
      "Sobre" — **"Sair" ausente** (RN-04 — fortificação W3)
- [ ] Tray menu "Sobre" → diálogo com versão do app
- [ ] Tray menu "Histórico local" → Explorer abre na pasta
      `%APPDATA%\sprint-operator-agent\historico\` (vazia no primeiro boot)

### Polling + Overlay

- [ ] 📷 Rodar Leader em paralelo, enviar sprint para o `user_id` do Agent →
      overlay aparece em < `polling_interval_seconds` segundos após dispatch
- [ ] Overlay mostra: title (h1), body sanitizado, meta destacada (~160px em
      amarelo), deadline HH:MM no canto, botão "Recebi" com autoFocus
- [ ] Body com `<script>alert("XSS")</script>` injetado MANUALMENTE no JSON (via
      Notepad) — re-sanitização do renderer remove (verificar via DevTools →
      Elements: não há `<script>` no DOM)
- [ ] Click "Recebi" → overlay troca para próxima sprint (se houver) ou
      esconde + tray volta para cinza
- [ ] Ack file aparece em `dev-fixtures/shared/acks/` com `displayed_at` E
      `acknowledged_at`
- [ ] Arquivo desaparece de `pending/`
- [ ] Arquivo aparece em `<userData>/historico/YYYY-MM-DD/`

### Minimize timer + Restore

- [ ] Aguardar `minimize_after_seconds` sem clicar → overlay minimiza para tray
      (some da tela). Tray fica amarelo com tooltip "X sprints na fila"
- [ ] Click tray "Mostrar sprint atual" → overlay restaura, timer reseta (novo
      countdown completo)
- [ ] Click tray "Mostrar sprint atual" estando overlay já visível → no-op
      (idempotência)

### Queue multipla

- [ ] Disparar 3 sprints rápidas via Leader (3 clicks consecutivos no "Disparar
      evento" com 3 usuários selecionados) → primeira exibe imediato, badge "+ 2
      sprints aguardando" aparece
- [ ] Ack da 1ª → 2ª exibe automaticamente, badge "+ 1 sprint aguardando"
- [ ] Ack da 2ª → 3ª exibe, badge desaparece
- [ ] Ack da 3ª → overlay esconde, tray volta para cinza

### Edge cases

- [ ] Enviar sprint com `deadline_at` no passado (edit JSON via Notepad após
      dispatch) → NÃO aparece overlay; arquivo é movido para history sem ack
      (deletePending + markProcessed). Log warn no terminal do `pnpm dev`
- [ ] Criar arquivo manualmente em `pending/` com JSON inválido
      (`{ broken json`) — filename válido `01HX...-joao.json` → log warn no
      console do main, **sem crash**
- [ ] Apagar `dev-fixtures/shared/pending/` durante runtime → log error no
      próximo ciclo (DirectoryNotFoundError tratado como benigno: na verdade NÃO
      loga error; ver `pollingService.pollOnce`), sem crash, próximos ciclos
      continuam

### Restart resiliência

- [ ] Kill o Agent via Task Manager (forçar quit; `Sair` não existe no tray)
- [ ] Reabrir `pnpm dev` → cache do `historyService` re-popula via
      `initializeFromDisk` (filenames já arquivados não re-aparecem como sprints
      novas no próximo polling)

### Renderer (via DevTools detached)

- [ ] DevTools detached abre junto com overlay (modo dev)
- [ ] Console: `await window.api.sprint.requestCurrent()` retorna sprint atual +
      queueLength
- [ ] Elements: `<div class="body...">` NÃO contém `<script>` injetado

---

## 8. Troubleshooting

### Tray vermelho + balloon "Caminho inacessível"

**Sintoma:** Balloon do Windows com `UNKNOWN: unknown error, stat 'X:\...'`.

**Causa:** o `shared_path` declarado não existe ou é unreachable (SMB
desconectado, drive desmontado, path digitado errado).

**Fix:** verifique `shared_path` no `config.json`. Em dev, use o path absoluto
para `dev-fixtures/shared/` (com escapes `\\`).

### Tray vermelho + balloon "JSON inválido"

**Causa:** BOM no `config.json` (caractere `﻿` invisível no início). PowerShell
5.1 `Set-Content -Encoding utf8` ADICIONA BOM.

**Fix:** reescreva o arquivo via
`[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`
ou via Notepad "Save As → UTF-8 (sem BOM)".

### Overlay não aparece mesmo com config válido + sprint em pending

**Possíveis causas:**

1. **`user_id` diferente:** o JSON do sprint deve ter `user_id` que case
   exatamente com o do `config.json` do Agent. Confira ambos no Notepad.
2. **Filename do sprint não bate com pattern ULID-userId.json:** o
   `pollingService` ignora silenciosamente via `safeParseFilename` quando o nome
   não bate.
3. **Sprint já em `historico/`:** `isAlreadyArchived` retorna true e pula.
   Verifique cache via DevTools console:
   `await window.api.sprint.requestCurrent()` retorna o currentItem.
4. **Deadline passado:** sprint descartada silenciosamente (move para history +
   delete pending). Veja log warn no terminal do `pnpm dev`.

### Bundle main 5+ MB

**Causa:** G-020 — `jsdom` + `canvas` não externalizados.

**Fix:** já aplicado em `vite.config.ts` —
`rollupOptions.external: ['electron', 'jsdom', 'canvas']`.

### Preload "Cannot use import statement outside a module"

**Causa:** G-007 — preload sandboxed tem que ser CJS.

**Fix:** já aplicado — `apps/operator-agent/package.json` sem `"type"`.

### "Cannot access 'mockX' before initialization" em testes

**Causa:** G-015 — `vi.mock` é hoisted; variáveis referenciadas pela factory
precisam de `vi.hoisted()` (ou prefix `mock` lowercase).

**Fix:** usar `vi.hoisted(() => ({ ... }))` para declarações que a factory de
`vi.mock` consome.

---

## 9. Próximos passos (W2+)

Itens fora do escopo da W1.C3 que voltam em W2 ou W3:

- **BL-C3-009 (W2):** handler de cancelamento — `pending/cancel-*.json` some o
  overlay sem ack (hoje é ignorado com log warn).
- **BL-C3-010 (W2):** re-exibição automática de sprints minimizadas passado X
  tempo (hoje só restore manual via tray).
- **BL-C3-011 (W2):** notificação sonora ao receber sprint (`som_notificacao` no
  config já existe).
- **BL-C3-012 (W2):** countdown ao vivo do deadline (hoje HH:MM estático).
- **BL-C3-013 (W3):** retry com backoff em erros de SMB (hoje só loga e segue no
  próximo ciclo).
- **BL-C3-014 (W3):** auto-start na inicialização do Windows (hoje manual via
  `pnpm dev` ou shortcut do instalador).
- **RN-04 forte:** overlay window não-fechável + tray "Sair" com senha de admin
  (hoje Alt+F4 fecha + Task Manager mata).
- **W1.C6:** `@sprint/logger` (Pino) substitui `console.warn`/`error` espalhados
  pelos services.

---

**Documentos relacionados:**

- [`/CLAUDE.md`](../../CLAUDE.md) — convenções, gotchas (G-007, G-015, G-017,
  G-020), débitos técnicos
- [`/DECISIONS.md`](../../DECISIONS.md) — ADRs (especialmente ADR-004, -009,
  -011, -012, -013, -014, -016)
- [`/SESSION_LOG.md`](../../SESSION_LOG.md) — diário de sessões
- [`apps/leader/SETUP.md`](../leader/SETUP.md) — setup do Leader (par natural
  para teste E2E)
