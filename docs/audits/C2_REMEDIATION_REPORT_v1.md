# Relatório de Remediação — Componente C2 · Auditoria v1

| Campo                            | Valor                                             |
| -------------------------------- | ------------------------------------------------- |
| Versão do relatório              | v1                                                |
| Data                             | 2026-05-22                                        |
| Remediador                       | Claude Code (sessão independente)                 |
| Relatório de auditoria de origem | `docs/audits/C2_AUDIT_REPORT_v1.md`               |
| Branch desta remediação          | `fix/c2-audit-v1-remediation`                     |
| Commits desta remediação         | `10c94cd` .. `e228324` (+ commit de encerramento) |

---

## 1. Sumário Executivo

A remediação da Auditoria v1 do C2 endereçou **4 dos 12 achados** do relatório
de origem — a única High (FINDING-001) e os 3 Low acionáveis (FINDING-002, 003,
004). FINDING-005 (Low) foi **postergado** por não ter ação retroativa possível
(exigiria reescrever o histórico de commits). Os 7 Info não são problemas.
**Zero findings disputados.**

FINDING-001 — advisories de dependência, não defeito de código — foi remediado
integralmente: **upgrade do Electron 30.5.1 → 42.2.0** e **override de `tar`
para `^7.5.11`** via `pnpm.overrides`. `pnpm audit --audit-level=high` caiu de
**10 advisories High para 0 High / 0 Critical** (o upgrade do Electron também
zerou os 3 Low e baixou os moderate de 13 → 3). O alvo do Electron foi elevado,
por decisão consciente do Renan, do mínimo `≥ 39.8.1` que o relatório sugeria
para a última estável `42.2.0` — que fica dentro da janela de suporte de 3
majors do Electron, evitando que o C2 nasça fora de suporte. O upgrade foi feito
**sem cascata**: nenhuma mudança em `electron-builder`, `vite-plugin-electron`
ou código. Registrado em **ADR-010**.

Re-validação completa após `rm -rf node_modules` + reinstall determinístico:
bateria raiz exit 0, C1 `@sprint/contracts` mantém **100% de cobertura**
(regressão zero), smoke dev abre a janela em Electron 42 (5 processos
`electron.exe`, dev log sem erros). `pnpm package` permanece bloqueado
localmente pelo ESET (G-009) — exatamente como na auditoria v1; a geração do
`.exe` depende do CI `build-leader.yml`.

### Estado dos findings da auditoria v1

| Severidade | Total no relatório | Fixed | Disputed | Deferred |
| ---------- | ------------------ | ----: | -------- | -------- |
| Critical   | 0                  |     0 | 0        | 0        |
| High       | 1                  |     1 | 0        | 0        |
| Medium     | 0                  |     0 | 0        | 0        |
| Low        | 4                  |     3 | 0        | 1        |
| Info       | 7                  |     0 | 0        | n/a      |
| **Total**  | **12**             | **4** | **0**    | **1**    |

### Métricas-chave de segurança — antes vs. depois

| Item                                      | Antes (v1) | Depois           |
| ----------------------------------------- | ---------- | ---------------- |
| `contextIsolation: true`                  | ✅         | ✅               |
| `nodeIntegration: false`                  | ✅         | ✅               |
| `sandbox: true`                           | ✅         | ✅               |
| `webSecurity: true` (explícito)           | ✅         | ✅               |
| CSP sem `'unsafe-eval'`                   | ✅         | ✅               |
| CSP sem `'unsafe-inline'` em `script-src` | ✅         | ✅               |
| CSP `object-src 'none'`                   | ❌         | ✅ (FINDING-003) |
| CSP `base-uri 'self'`                     | ❌         | ✅ (FINDING-003) |
| Preload NÃO expõe `ipcRenderer`           | ✅         | ✅               |
| `will-navigate` handler                   | ✅         | ✅               |
| `setWindowOpenHandler` deny               | ✅         | ✅               |
| Validação runtime no preload              | ✅         | ✅               |
| Sem APIs proibidas (`remote`, `webview`)  | ✅         | ✅               |
| `requestExecutionLevel: user`             | ✅         | ✅               |
| `pnpm audit` — advisories **High**        | **10**     | **0**            |
| `pnpm audit` — advisories **Critical**    | 0          | 0                |

### Métricas de build — antes vs. depois

| Item                       | Antes (v1)       | Depois                    |
| -------------------------- | ---------------- | ------------------------- |
| Versão do Electron         | 30.5.1           | 42.2.0                    |
| `pnpm dev` abre janela     | ✅               | ✅ (Electron 42)          |
| Bridge IPC `pong`          | ⚠️ não-visual    | ⚠️ não-visual             |
| `pnpm build` gera 3 pastas | ✅               | ✅                        |
| `pnpm package` gera `.exe` | ❌ (ESET, G-009) | ❌ (ESET, G-009) — via CI |

### Recomendação operacional

- [x] **Submeter à Auditoria v2 e, se APROVADO, liberar o próximo componente.**
- [ ] Liberar sem re-auditoria.

**Auditoria v2 obrigatória antes de iniciar o C3** — o Agent vai espelhar a
arquitetura do C2 (inclusive a versão do Electron 42.x estabelecida aqui).

---

## 2. Findings endereçados (Fixed)

### FINDING-001 · 🟠 High · D5 · Advisories de dependências (Electron runtime + tar build-time)

**Status:** ✅ Fixed

**Commits:**

- `10c94cd` —
  `fix(C2): pnpm.overrides força tar >=7.5.11 (build-time) [audit-v1-FINDING-001]`
- `ed74d1e` —
  `fix(C2): upgrade Electron 30.5.1 -> 42.2.0 [audit-v1-FINDING-001]`
- `939c53a` —
  `docs(C2): registra ADR-010 (upgrade Electron + override tar) [audit-v1-FINDING-001]`

**Arquivos modificados:**

- `package.json` (raiz) — `pnpm.overrides.tar`
- `apps/leader/package.json` — `electron` `^30.0.0` → `^42.2.0`
- `pnpm-lock.yaml`
- `DECISIONS.md` — ADR-010

**Correção aplicada:**

A High não era defeito de código — eram 10 advisories de dependência: 4 em
`electron` (runtime) e 6 em `tar` (build-time, transitivo via `electron-builder`
→ `app-builder-lib`). Tratada em duas frentes:

1. **`tar`** — `pnpm.overrides` no `package.json` raiz força `tar` para
   `^7.5.11` (resolvido: 7.5.15). A linha 6.x (instalada: 6.2.1) não recebeu
   patch dos 6 advisories de path traversal / symlink — só existem na 7.5.x.
2. **`electron`** — upgrade de 30.5.1 para 42.2.0. Os 4 advisories High (três
   use-after-free + uma injeção de switches de linha de comando) não têm patch
   na linha 30.x. O alvo foi elevado do mínimo `≥ 39.8.1` (sugerido pelo
   relatório) para a última estável 42.2.0 — decisão do Renan — para o C2 ficar
   dentro da janela de suporte de 3 majors do Electron.

Registrado em **ADR-010**, que atualiza a versão-alvo do Electron definida no
ADR-002. O upgrade não exigiu nenhuma mudança de código nem de toolchain — o
scaffold usa apenas APIs estáveis do Electron.

**Validação:**

```
$ pnpm audit --audit-level=high          # 10 High -> 0 High / 0 Critical
  vulnerabilities: { info:0, low:0, moderate:3, high:0, critical:0 }
$ pnpm --filter sprint-leader type-check  # exit 0
$ pnpm --filter sprint-leader lint        # exit 0
$ pnpm --filter sprint-leader build       # exit 0 — dist/ + dist-electron/{main,preload}
$ electron-builder ... packaging electron=42.2.0  # config carrega e resolve Electron 42
```

Smoke dev: **ABRIU** — Vite `:5173` → 200, 5 processos `electron.exe` estáveis
(> 7 s, sem crash-loop), dev log sem erros, preload carrega (sem
`"Unable to load preload"`). Smoke package: **❌ localmente** — ESET trava o
`app.asar` (G-009), idêntico à auditoria v1; o `.exe` é validado pelo CI
`build-leader.yml`.

**`pong` não confirmado visualmente** — sem ferramenta de screenshot de janela
Electron. O código IPC não foi tocado pela remediação; o bridge é validado por
type-check, build CJS correto e ausência de erro de carregamento do preload —
mesmo critério da auditoria v1.

**Efeitos colaterais conhecidos:** o upgrade do Electron também zerou os 3
advisories Low e baixou os moderate de 13 → 3 (efeito positivo). Restam 3
moderate transitivos, abaixo do limiar High do finding.

---

### FINDING-003 · 🟢 Low · D5 · Oportunidades de hardening na CSP

**Status:** ✅ Fixed

**Commit:** `1b70b4f` —
`fix(C2): hardening da CSP (object-src, base-uri) [audit-v1-FINDING-003]`

**Arquivos modificados:**

- `apps/leader/index.html`

**Correção aplicada:**

A CSP já era estrita (sem `'unsafe-eval'`, sem `'unsafe-inline'` em
`script-src`, `default-src 'self'`). Adicionadas duas diretivas de defesa em
profundidade: `object-src 'none'` (bloqueia `<object>`/`<embed>`/`<applet>`, não
usados) e `base-uri 'self'` (`base-uri` não tem fallback para `default-src` —
sem ela, uma injeção de `<base>` poderia reposicionar URLs relativas).

A terceira observação do finding (o `ws://localhost:5173` viajar para a CSP de
produção) **não foi remediada** — o auditor a classificou como inerte e
não-bloqueante, e separar a CSP dev/prod seria mudança maior fora do escopo Low.
Permanece como débito documentado.

**Validação:**

```
CSP final (apps/leader/index.html):
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; connect-src 'self' ws://localhost:5173;
  font-src 'self' data:; object-src 'none'; base-uri 'self';
```

Smoke dev: **ABRIU** — Vite `:5173` → 200, 5 processos `electron.exe`, HTML
servido com a meta CSP presente, dev log sem erros.

**Efeitos colaterais conhecidos:** Nenhum — as duas diretivas restringem
recursos que o app não usa.

---

### FINDING-002 · 🟢 Low · D2 · `tsconfig.json` inclui arquivo inexistente

**Status:** ✅ Fixed

**Commit:** `5dc0ccd` —
`fix(C2): remove include morto do tsconfig do leader [audit-v1-FINDING-002]`

**Arquivos modificados:**

- `apps/leader/tsconfig.json`

**Correção aplicada:**

Removida a entrada `"electron-builder.yml.d.ts"` do array `include` — arquivo
que nunca existiu no repositório e que nenhum código TS importa.

**Validação:**

```
$ pnpm --filter sprint-leader type-check   # exit 0
```

Smoke dev: N/A — mudança só de configuração de type-check.

**Efeitos colaterais conhecidos:** Nenhum.

---

### FINDING-004 · 🟢 Low · D2 · `rfc3161TimeStampServer` presente antes da wave de code signing

**Status:** ✅ Fixed

**Commit:** `e228324` —
`fix(C2): difere rfc3161TimeStampServer para a W3 [audit-v1-FINDING-004]`

**Arquivos modificados:**

- `apps/leader/electron-builder.yml`

**Correção aplicada:**

A linha `win.rfc3161TimeStampServer` foi comentada e agrupada com o
`signtoolOptions` (já comentado) sob um cabeçalho que marca o bloco de code
signing como diferido para BL-C0-008 (Wave 3). A linha era inerte
(`rfc3161TimeStampServer` só tem efeito com um certificado de assinatura
configurado), mas era config prematura.

**Validação:**

```
$ git commit ...   # prettier (commit hook) parseia o YAML — válido
electron-builder ... loaded configuration file=...electron-builder.yml  # carrega OK
```

Smoke dev: N/A — config de packaging.

**Efeitos colaterais conhecidos:** Nenhum — linha inerte sem certificado.

---

## 3. Findings disputados (Disputed)

Nenhum. A remediação não disputou nenhum achado da auditoria v1.

---

## 4. Findings postergados (Deferred)

### FINDING-005 · 🟢 Low · D4 · Traçabilidade de commits — 2 commits sem o tag `[BL-C2-001]`

**Status:** ⏸️ Deferred

**Motivo:** Não há ação retroativa possível sem reescrever o histórico de
commits (`4854fa9` e `65323f7`) — proibido pelo §12.6 do prompt de remediação. O
próprio relatório de auditoria registrou "**Nenhuma ação retroativa
necessária**". A recomendação (aplicar o tag `[BL-CX-NNN]` também a commits
`chore` que mapeiem a um item de backlog) é orientação para sessões futuras, não
uma correção aplicável a esta branch.

---

## 5. Regressões detectadas e tratadas

Nenhuma regressão detectada na bateria de re-validação. Após
`rm -rf node_modules` + `pnpm install --frozen-lockfile`:

- bateria raiz (`format:check`, `lint`, `type-check`, `test`, `build`) — exit 0;
- C1 `@sprint/contracts` — cobertura 100% em stmts/branches/funcs/lines
  (idêntico à auditoria v1 — regressão zero);
- C2 `type-check` / `lint` / `build` — exit 0, 3 pastas geradas;
- smoke dev — janela abre em Electron 42, sem erros;
- nenhum check que passava na auditoria v1 falha agora.

---

## 6. Bateria de re-validação (output)

```
$ rm -rf node_modules apps/leader/node_modules packages/contracts/node_modules \
         apps/leader/dist apps/leader/dist-electron apps/leader/release
  (release/win-unpacked/resources/app.asar: travado pelo ESET — gitignored, inofensivo)
$ pnpm install --frozen-lockfile                          # exit 0 — tar 7.5.15, electron 42.2.0
$ pnpm format:check                                       # exit 0
$ pnpm lint                                               # exit 0
$ pnpm type-check                                         # exit 0
$ pnpm test                                               # exit 0
$ pnpm build                                              # exit 0
$ pnpm --filter @sprint/contracts run test:coverage       # exit 0 — 100% (regressão zero)
$ pnpm --filter sprint-leader run type-check              # exit 0
$ pnpm --filter sprint-leader run lint                    # exit 0
$ pnpm --filter sprint-leader run build                   # exit 0 — dist/ + dist-electron/{main,preload}
$ pnpm --filter sprint-leader run package                 # exit 1 — ESET trava app.asar (G-009)
                                                          #   electron-builder carrega, resolve electron=42.2.0
$ pnpm audit --audit-level=high                           # 0 High / 0 Critical (3 moderate restantes)
$ Smoke dev                                               # ABRIU — Vite :5173 200, 5x electron.exe, log limpo
$ commit-msg hook (mensagem inválida)                     # BLOQUEADO — commitlint exit 1 (esperado)
```

### Re-grep adversarial (`apps/leader/src`)

```
nodeIntegration: true        -> 0 (só "nodeIntegration: false" + JSDoc)
enableRemoteModule           -> 0
@electron/remote             -> 0 (incl. todos os package.json)
<webview                     -> 0
window.require / globalThis  -> 0
console.log/debug em main    -> 0
console.log/debug em preload -> 0
: any / as any / <any>       -> 0
@ts-ignore / @ts-nocheck     -> 0
```

### webPreferences (`apps/leader/src/main/index.ts`, 1 BrowserWindow)

```
contextIsolation: true            ✓
nodeIntegration: false            ✓
sandbox: true                     ✓
webSecurity: true                 ✓
allowRunningInsecureContent: false ✓
experimentalFeatures: false       ✓
preload: path.join(...)           ✓
```

### CSP (`apps/leader/index.html`)

```
sem 'unsafe-eval'                      ✓
script-src 'self' (sem 'unsafe-inline') ✓
default-src 'self'                     ✓
object-src 'none'                      ✓ (FINDING-003)
base-uri 'self'                        ✓ (FINDING-003)
```

### Preload (`apps/leader/src/preload/index.ts`)

```
contextBridge.exposeInMainWorld('api', api)  — expõe só a chave 'api'
ipcRenderer usado só dentro do método ping() — envelopado, não exposto direto
```

---

## 7. Observações fora de escopo

- **Binário do Electron após `rm -rf node_modules`.** Nesta máquina,
  `pnpm install --frozen-lockfile` (e `pnpm rebuild electron`) **não** restaurou
  `node_modules/electron/dist/` — foi preciso rodar
  `node node_modules/electron/install.js` para baixar/extrair o binário. É uma
  interação pnpm 10 + electron (o cache de side-effects do pnpm não captura o
  `dist/` de centenas de MB); não é introduzida pelo bump de versão (o Electron
  30 se comportaria igual). **Relevante para o CI:** confirmar que o
  `build-leader.yml` de fato obtém o binário num runner limpo. Registrada como
  gotcha G-012 no CLAUDE.md §12.
- **3 advisories moderate transitivos** permanecem após o upgrade (abaixo do
  limiar High do FINDING-001). Não-bloqueantes; débito monitorável.
- **`apps/leader/release/win-unpacked/resources/app.asar`** continua travado
  pelo ESET em disco (gitignored, inofensivo). Um reboot da máquina libera o
  arquivo — útil antes de uma próxima tentativa local de `pnpm package`.
- **Aviso `The CJS build of Vite's Node API is deprecated`** aparece no
  `build`/`dev` — ruído pré-existente do Vite 5 (carregamento do `vite.config`),
  não relacionado à remediação.

---

## 8. Próximos passos recomendados

1. Renan revisa este relatório e o PR `fix/c2-audit-v1-remediation`.
2. PR mergeado em `develop`.
3. O merge em `develop` dispara o workflow `build-leader.yml` — **verificar que
   ele gera o `.exe` com Electron 42 num runner Windows limpo** (valida o que o
   ESET impede localmente, e a observação do §7 sobre o binário do Electron).
4. Sessão de **Auditoria v2 do C2** (mesmo prompt da v1, com aviso de
   re-auditoria).
5. Se a v2 **APROVAR** → liberar o C3 (Operator Agent), que espelhará a
   arquitetura do C2 — inclusive a versão Electron 42.x.
6. Se a v2 ainda acusar Critical/High → nova remediação.
