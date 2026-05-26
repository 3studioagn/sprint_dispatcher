# Sprint Leader — Setup Local

Guia para devs que vão rodar e desenvolver o Sprint Leader localmente. Para a
visão geral do monorepo e onboarding inicial, consulte
[`/README.md`](../../README.md) e [`/CLAUDE.md`](../../CLAUDE.md).

---

## 1. Pré-requisitos

- **Node.js** ≥ 20 (recomendado: `nvm use` na versão fixada em `.nvmrc` —
  24.10.0)
- **pnpm** ≥ 10 — `corepack enable && corepack use pnpm@10`
- **Windows** com Developer Mode habilitado (necessário para empacotar Electron
  localmente — G-008 em `CLAUDE.md`)
- `pnpm install` já rodado na raiz

---

## 2. Configuração local (`config.json`)

O Leader não inicia sem um `config.json` válido — o boot dispara o
`ConfigErrorScreen` se o arquivo estiver ausente, inválido ou se o `shared_path`
declarado não existir. Espelha o padrão fail-fast do Operator Agent (ADR-012).

### 2.1. Localização do `config.json`

| Ambiente             | Caminho                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **Dev** (`pnpm dev`) | `%APPDATA%\sprint-leader\config.json` (Windows) — derivado do `name` no `package.json`      |
| **Build packaged**   | `%APPDATA%\Sprint Leader\config.json` — derivado do `productName` do `electron-builder.yml` |

Outras plataformas (macOS/Linux) usam o equivalente de
`app.getPath('userData')`, mas o Sprint Leader é Windows-only no MVP.

### 2.2. Schema do `config.json`

```json
{
  "shared_path": "C:\\caminho\\absoluto\\para\\pasta\\compartilhada",
  "criado_por": "Seu Nome"
}
```

| Campo         | Tipo                   | Restrição                                                        | Uso                                                                                 |
| ------------- | ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `shared_path` | `string` (não vazia)   | path absoluto UNC ou letra de drive que **existe e é diretório** | onde o app vai escrever `pending/<sprint_id>-<user_id>.json` e ler `operators.json` |
| `criado_por`  | `string` (1-100 chars) | qualquer nome                                                    | vai no campo `criado_por` do `SprintPayload` (Anexo C)                              |

Campo extra → `ConfigSchemaError` (schema é `.strict()`).

### 2.3. Setup em dev — passo a passo

1. Copie o template:

   ```powershell
   Copy-Item dev-fixtures\config-example.json `
     "$env:APPDATA\sprint-leader\config.json"
   ```

2. Remova a linha `"_comment"` do JSON copiado (o schema é estrito).

3. Ajuste o `shared_path` para apontar para `dev-fixtures/shared` neste repo
   (path absoluto). Exemplo:

   ```json
   {
     "shared_path": "C:\\Users\\seuusuario\\sprint-dispatcher\\dev-fixtures\\shared",
     "criado_por": "Renan"
   }
   ```

4. Confira que existe `dev-fixtures\shared\operators.json` — se não, o
   `OperatorList` fica vazio e dispatch falha. O repo já vem com 5 operadores (4
   ativos + 1 inativo para exercitar o filtro).

---

## 3. Rodar o Leader em modo dev

```powershell
pnpm --filter sprint-leader dev
```

Vite serve o renderer em `http://localhost:5173` e `vite-plugin-electron` spawna
o processo Electron com hot reload em main, preload e renderer.

**Boot esperado:**

1. Tela rápida `"Carregando configuração…"` (chamada IPC `getConfig` em vôo)
2. `config.json` carrega + `shared_path` validado → app renderiza
3. `NovaSprint.useEffect` chama `listOperators` → lista de 4 usuários ativos
   aparece (João, Maria, Carlos, Beatriz; Rafael fica escondido por
   `ativo:false`)

**Se cair na `ConfigErrorScreen`:** leia a mensagem específica do erro
(`NOT_FOUND` / `JSON_INVALID` / `SCHEMA_INVALID` / `READ_ERROR` /
`SHARED_PATH_INACCESSIBLE`), corrija o arquivo e clique em **"Reabrir após criar
configuração"**. O main re-tenta o load + reconstrói os services sem precisar
matar o processo (`pnpm dev` continua rodando).

---

## 4. Estrutura `dev-fixtures/`

Espelha a pasta compartilhada SMB que existe em produção, mas localmente para
desenvolvimento offline.

```
dev-fixtures/
├── .gitignore                  # exclui pending/*.json e acks/*.json (runtime gerado)
├── config-example.json         # template do leader-config.json (committed)
└── shared/                     # apontado por shared_path
    ├── operators.json          # canonical dev list (committed)
    ├── pending/                # Leader escreve aqui ao despachar (runtime)
    └── acks/                   # Agent escreverá aqui em W1.C3 (runtime)
```

### Convenção de commit

- ✅ Committed: `.gitignore`, `config-example.json`, `shared/operators.json`
- ❌ Não committed: qualquer `.json` em `shared/pending/` ou `shared/acks/`
  (gerados pelo dispatch/ack em runtime)

### Schema de `operators.json`

```json
{
  "operators": [
    { "user_id": "joao", "user_nome_exibicao": "João Silva", "hostname": "ART-DESIGN-04", "ativo": true },
    ...
  ]
}
```

Validado por `operatorsFileSchema` Zod em
`apps/leader/src/main/services/operatorsService.ts`.

Para adicionar um usuário, edite `dev-fixtures/shared/operators.json` e reinicie
o Leader (ou navegue para outra rota e volte — o `useOperatorsStore` recarrega
via `useEffect`).

---

## 5. Smoke test do dispatch (BL-C2-007)

Sequência completa para validar que o dispatch real funciona ponta-a-ponta:

1. App boota OK (passa pela tela de loading sem cair em `ConfigErrorScreen`).
2. 4 usuários ativos aparecem na lista.
3. Click **"Marcar todos"** → 4 checkboxes marcados + 4 inputs de meta surgem.
4. Preencha metas (ex: 5, 10, 7, 3). Botão **"Disparar evento"** deve ficar
   **habilitado**.
5. Click **"Disparar evento"** → modal abre brevemente com spinner ("Disparando
   rodada…"), depois transita para "Resultado da rodada" com ✓ em cada usuário.
6. Verifique `dev-fixtures\shared\pending\` no Windows Explorer:

   ```powershell
   Get-ChildItem dev-fixtures\shared\pending\*.json | Select-Object Name
   ```

   Esperado: 4 arquivos com nome `<sprintId-ULID>-<user_id>.json`, todos com o
   mesmo prefixo `sprintId` (gerado uma única vez por sprint).

7. Abra um arquivo no Notepad — confira o schema do Anexo C:

   ```json
   {
     "schema_version": "1.0",
     "sprint_id": "01HX...",
     "criado_por": "Renan",
     "criado_em": "2026-05-26T...",
     "user_id": "joao",
     "title": "É hora de correr",
     "body_html": "Sua meta até o final do dia é de: <b>5 artes</b>",
     "meta": 5,
     "deadline_at": "2026-05-26T...",
     "show_duration_seconds": 5,
     "persistent_popup": true
   }
   ```

   **Pontos críticos:**
   - `criado_por` é literalmente o que está no `config.json`.
   - `body_html` tem o número literal (`5 artes`), **não** o placeholder
     `{meta}`.
   - `body_html` foi sanitizado via DOMPurify (mesmo template plain HTML).
   - `deadline_at` é ISO 8601 — se HH:MM já passou >30min, vira amanhã (regra D1
     do `dispatchService.resolveDeadlineIso`).

8. Click **"Fechar"** no modal → form reseta, toast verde aparece no canto
   inferior direito ("Rodada disparada com sucesso") e some após 4s.

---

## 6. QA manual checklist (W1.C2 fim de sessão)

Checklist sugerido para o líder/dev verificar antes de declarar Gate W1.C2
fechado. Marque com ✅ conforme passar.

### Boot e config

- [ ] App boota com config válido → cai em `/nova`
- [ ] App boota sem config (renomeie `config.json` temporariamente) →
      `ConfigErrorScreen` mostra mensagem + caminho esperado + exemplo de JSON
- [ ] Botão "Reabrir após criar configuração" recarrega e app sobe sem matar
      `pnpm dev`
- [ ] Top nav mostra 3 links (Nova rodada / Acompanhamento / Histórico) com logo
      3STUDIO à esquerda; navegação entre rotas funciona

### Composer (BL-C2-002 a 005, 011)

- [ ] Lista mostra 4 usuários ativos em grid 2-colunas (Rafael oculto)
- [ ] Cada row: avatar (inicial) + nome + counter de meta + checkbox amarelo
- [ ] Hostname acessível via tooltip (hover sobre o nome do usuário)
- [ ] "Marcar todos" / "Desmarcar todos" (text-link subtle, ao lado de
      "Usuários")
- [ ] Marcar usuário → input de meta aparece, checkbox vira amarelo com check
- [ ] Meta = 0 → input ganha borda vermelha (`aria-invalid="true"`) + botão
      "Disparar evento" disabled. Sem mensagem visual "Meta ≥ 1" — fica apenas
      como sr-only para leitores de tela.
- [ ] Meta válida (≥ 1, inteira) → borda vermelha removida
- [ ] Deadline default 18:00; mudar para hora passada → warning visual aparece
      mas não bloqueia
- [ ] Clicar no nome do usuário também marca o checkbox (htmlFor)
- [ ] Navegação inter-rotas preserva seleção e metas (antes do dispatch)

### Dispatch (BL-C2-007)

- [ ] Botão "Disparar evento" desabilita com form inválido (tooltip "Preencha
      todos os campos para disparar")
- [ ] Botão habilita quando válido (tooltip "Disparar evento") — pill amarelo
      com seta SVG
- [ ] Click → modal abre com spinner ("Disparando rodada…") → "Resultado da
      rodada"
- [ ] Arquivos `.json` aparecem em `dev-fixtures\shared\pending\`
- [ ] Schema dos arquivos confere com Anexo C (passo §5.7 acima)
- [ ] Todos os arquivos da sprint compartilham o mesmo `sprint_id` (ULID)
- [ ] `body_html` tem número literal (não `{meta}`)
- [ ] Fechar modal de sucesso → form resetado + toast verde "Rodada disparada
      com sucesso" por 4s
- [ ] Click "Disparar evento" dispara em ~1s; sem bloqueio perceptível da UI

### Falhas

> Falha parcial e fatal são exercitadas pelos testes unitários
> (`dispatchService.test.ts`, `NovaSprint.test.tsx`). Reproduzir manualmente
> requer simular EACCES/ENOSPC no FS — deixar para W4 hardening (manual
> intrusion test).

---

## 6.5. Deployment em 2+ PCs (LAN)

Para rodar Leader e Agent em PCs separados (cenário de produção real do MVP) em
vez de tudo na mesma máquina via `dev-fixtures/shared/`, consulte
[`apps/operator-agent/SETUP.md` §6.5](../operator-agent/SETUP.md#65-setup-em-2-pcs-lan--deployment-real-de-teste)
— documento principal do setup multi-máquina (cobre criação do share SMB,
configuração do `shared_path` UNC nos dois apps, permissões NTFS, firewall,
considerações de latência).

Resumo para o Leader:

- O `config.json` do Leader usa o **mesmo `shared_path` UNC** do Agent (e.g.
  `"\\\\NOME-DO-PC-HOST\\SprintDispatcher"` ou
  `"\\\\srv-alpha\\TEMP\\Metas_3Studio"`).
- O `criado_por` do Leader vai literal no campo `criado_por` de cada
  `SprintPayload` gravado em `<shared>/pending/`.
- Múltiplos líderes (futuro W2+) podem compartilhar a mesma pasta — cada um com
  `criado_por` distinto.

---

## 6.6. Build via GitHub Actions

Para gerar o `.exe` do Sprint Leader sem o problema do antivírus ESET local
bloquear o `app.asar` (CLAUDE.md §12 G-009), use o workflow CI em runner Windows
do GitHub.

**Trigger:** GitHub UI → **Actions** → **"Build Leader"** → **"Run workflow"**
OU push em `develop` tocando `apps/leader/**`.

**Artefatos:** após ~5-10 min, download em **Actions** → run "Build Leader" →
**Artifacts** → `sprint-leader-windows`. Conteúdo:

- `SprintLeader-0.0.0-x64-portable.exe` — portable, roda direto.
- `SprintLeader-Setup-0.0.0.exe` — instalador NSIS pt-BR, com Start Menu
  shortcut + uninstaller.

**Instalação no PC do líder:**

1. Roda o instalador. Aceita default `Program Files\Sprint Leader`.
2. Cria `%APPDATA%\Sprint Leader\config.json` (productName com **espaço**) com:

   ```json
   {
     "shared_path": "\\\\srv-alpha\\TEMP\\Metas_3Studio",
     "criado_por": "Renan"
   }
   ```

3. UTF-8 **sem BOM** — use `[System.IO.File]::WriteAllText` ou Notepad "Save As
   → UTF-8 (sem BOM)". `Set-Content -Encoding utf8` do PowerShell 5.1 adiciona
   BOM e quebra `JSON.parse`.
4. Roda via Start Menu → "Sprint Leader". App abre. `operators.json` é lido do
   share, composer pronto.

**Para deploy do Agent nos PCs dos operadores**, ver
[`apps/operator-agent/SETUP.md` §6.6](../operator-agent/SETUP.md#66-build-via-github-actions-distribui%C3%A7%C3%A3o-em-produ%C3%A7%C3%A3o)
(processo análogo, mas com configs distintas por operador).

---

## 7. Troubleshooting

### "Could not resolve 'canvas' imported by 'jsdom'" no boot

**Sintoma:** dialog box do Electron com `JavaScript error in main process`
referenciando `dist-electron/main/index.js:198865`.

**Causa:** `vite-plugin-electron` bundla `jsdom` (transitivo via
`isomorphic-dompurify` em `@sprint/contracts`), e o `require('canvas')` interno
do jsdom não resolve em build-time.

**Fix:** já aplicado em `vite.config.ts` — `rollupOptions.external` inclui
`'jsdom'` e `'canvas'`. Se reintroduzir, verifique se o externalize foi desfeito
acidentalmente.

### `tsc --noEmit` reclama TS6059 ao importar `@sprint/contracts`/`fs-adapter`

**Sintoma:** `'X' is not under 'rootDir'`.

**Causa:** G-014 (CLAUDE.md §12) — apps source-first puxam fontes de outros
packages do monorepo e o `rootDir` precisa ser a raiz, não `./src`.

**Fix:** já aplicado — `apps/leader/tsconfig.json` tem `"rootDir": "../.."`.

### Preload script falha com "Cannot use import statement outside a module"

**Causa:** G-007 — preload sandboxed tem que ser CJS. App não pode ter
`"type": "module"` em `package.json`.

**Fix:** já aplicado — `apps/leader/package.json` não tem `"type"` (CJS é
default).

### `pnpm install` "recriou" `node_modules` mas o Electron não roda

**Sintoma:** `pnpm dev` falha — Electron binary ausente em
`node_modules/electron/dist/`.

**Causa:** G-012 — pnpm não reexecuta o postinstall do Electron em alguns
cenários.

**Fix:** `node apps/leader/node_modules/electron/install.js` força a extração.

---

## 8. Próximos passos (W2+)

Itens fora do escopo da W1.C2 que voltam em W2 ou W3:

- **BL-C2-006 (W2):** customização de `title` / `body_html` no composer (hoje
  fixos como `'É hora de correr'` /
  `'Sua meta até o final do dia é de: <b>{meta} artes</b>'`).
- **BL-C2-008 (W2):** rota `/acompanhamento` exibe acks recebidos em tempo
  quase-real.
- **BL-C2-009 (W2):** cancelamento de sprint propaga via
  `cancel-<sprintId>.json`.
- **BL-C2-010 (W3):** rota `/historico` lista sprints já processadas.
- **BL-C2-012 (W3):** validação de líder via Active Directory.
- **C5 (W3):** instalador `.exe` que pré-grava `config.json` na primeira
  execução (substitui o setup manual deste documento).

---

**Documentos relacionados:**

- [`/CLAUDE.md`](../../CLAUDE.md) — convenções, gotchas, débitos técnicos
- [`/DECISIONS.md`](../../DECISIONS.md) — ADRs (especialmente ADR-009, -012,
  -013, -015, -016)
- [`/SESSION_LOG.md`](../../SESSION_LOG.md) — diário de sessões
