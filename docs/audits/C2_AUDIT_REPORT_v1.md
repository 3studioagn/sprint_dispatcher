# Relatório de Auditoria — Componente C2 (Leader Application scaffold) · Wave 0

| Campo              | Valor                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Versão             | v1                                                                     |
| Data               | 2026-05-22                                                             |
| Auditor            | Claude Code (sessão independente)                                      |
| Sessão auditada    | Sessão 06 — Execução C2 (SESSION_LOG.md)                               |
| Commits avaliados  | `4854fa9` (scaffold) até `58e3545`; PR #1 merge `2578a36` — 12 commits |
| Itens BL auditados | BL-C2-001, BL-C5-001                                                   |

---

## 1. Sumário Executivo

O scaffold do C2 (`apps/leader/`) foi entregue com **qualidade de produção
sênior**. Os 18 arquivos versionados estão todos presentes; a segurança Electron
é exemplar e aplicada em camadas: `webPreferences` com as 7 flags corretas
(`contextIsolation`, `nodeIntegration: false`, `sandbox`, `webSecurity`,
`allowRunningInsecureContent: false`, `experimentalFeatures: false`, `preload`),
CSP estrita sem `'unsafe-eval'` nem `'unsafe-inline'` em `script-src`, preload
expondo **apenas** a chave `api` (nunca `ipcRenderer`), hardening de navegação
(`will-navigate`, `setWindowOpenHandler` → `deny`, `web-contents-created`) e
**validação runtime do retorno IPC** no preload. Nenhuma API proibida
(`@electron/remote`, `<webview>`, `nodeIntegration: true`). Bundling conforme
ADR-008 (vite-plugin-electron, 3 entry points) e IPC contract-first conforme
ADR-009. A bateria funcional (`install`, `format:check`, `lint`, `type-check`,
`test`, `build`) passa toda exit 0, com **regressão zero** de C0/C1
(`@sprint/contracts` mantém 100% de cobertura, 190 testes). O smoke de
`pnpm dev` foi re-executado nesta auditoria: a janela sobe, o Vite serve em
`:5173` (HTTP 200), os processos Electron iniciam e o DevTools anexa.

A **única ressalva** é de plataforma, não de código: `pnpm audit` reporta
advisories High em `electron` 30.5.1 (4 advisories, corrigidos só em ≥ 38.8.6) e
em `tar` transitivo (6 advisories de build-time). Não é um defeito do scaffold —
é consequência direta do ADR-002 (fixar Electron 30.x) e afeta C3 de forma
idêntica. A geração do `.exe` (BL-C5-001) **não foi validável localmente** — o
ESET trava o `app.asar` (G-009), exatamente como o SESSION_LOG já documenta; a
configuração do electron-builder, porém, é válida e foi exercitada até a etapa
de packaging.

### Veredito final

🟡 **APROVADO COM RESSALVAS**

Critérios objetivos (§6 do prompt de auditoria):

- **APROVADO:** 0 Critical, 0 High, ≤ 3 Medium
- **APROVADO COM RESSALVAS:** 0 Critical, ≤ 2 High ← **resultado**
- **REPROVADO:** ≥ 1 Critical OU ≥ 3 High

Resultado real: **0 Critical, 1 High, 0 Medium, 4 Low, 7 Info.**

### Recomendação operacional

- [x] **Liberar avanço para o próximo componente (C3 — par funcional).**
- [ ] Liberar com sessão de remediação prévia.
- [ ] Não liberar. Sessão de remediação obrigatória.

Justificativa: o scaffold do C2 é um **template excelente para o C3** — a
arquitetura está correta e deve ser espelhada. A única High (FINDING-001) **não
é remediável editando o C2**: é uma decisão de plataforma sobre a cadência de
atualização do Electron, que afeta C2 e C3 igualmente. Tratá-la deve ser uma
trilha paralela (decisão de Renan, possivelmente um ADR), não um bloqueio do C3.
Os 4 Low são triviais (cleanup de ~15 min ou absorvidos na sessão do C3).

### Métricas-chave de segurança

| Item                                           | Esperado | Real           | Status |
| ---------------------------------------------- | -------- | -------------- | ------ |
| `contextIsolation: true` em toda BrowserWindow | Sim      | Sim (1 janela) | ✅     |
| `nodeIntegration: false`                       | Sim      | Sim            | ✅     |
| `sandbox: true`                                | Sim      | Sim            | ✅     |
| CSP sem `'unsafe-eval'`                        | Sim      | Sim            | ✅     |
| CSP sem `'unsafe-inline'` em `script-src`      | Sim      | Sim            | ✅     |
| Preload NÃO expõe `ipcRenderer`                | Sim      | Sim            | ✅     |
| `will-navigate` handler presente               | Sim      | Sim            | ✅     |
| `setWindowOpenHandler` retorna `deny`          | Sim      | Sim            | ✅     |
| Validação runtime no preload                   | Sim      | Sim            | ✅     |
| Sem APIs proibidas (`remote`, `webview`)       | Sim      | Sim            | ✅     |
| `requestExecutionLevel: user`                  | Sim      | Sim            | ✅     |

### Métricas de build

| Item                          | Status                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm dev` abre janela        | ✅ Vite HTTP 200, 5 processos Electron, DevTools anexado                                            |
| Bridge IPC funcional (`pong`) | ✅ por inspeção de código + saída CJS correta; ⚠️ `pong` não confirmado visualmente nesta auditoria |
| `pnpm build` gera 3 pastas    | ✅ `dist/`, `dist-electron/main`, `dist-electron/preload`                                           |
| `pnpm package` gera `.exe`    | ❌ localmente — bloqueado pelo ESET (G-009). Config válida. Não validado.                           |

---

## 2. Resumo por Dimensão

| Dimensão                       | Veredito                     | Críticas | Altas | Médias | Baixas | Info  |
| ------------------------------ | ---------------------------- | -------- | ----- | ------ | ------ | ----- |
| D1 — Estrutural                | ✅ Pass                      | 0        | 0     | 0      | 0      | 1     |
| D2 — Conteúdo                  | ✅ Pass                      | 0        | 0     | 0      | 2      | 1     |
| D3 — Funcional                 | ✅ Pass (com limitação)      | 0        | 0     | 0      | 0      | 2     |
| D4 — Documental                | ✅ Pass                      | 0        | 0     | 0      | 1      | 1     |
| D5 — Segurança Electron        | ⚠️ Pass com ressalva         | 0        | 1     | 0      | 1      | 2     |
| D6 — Conformidade arquitetural | ✅ Pass                      | 0        | 0     | 0      | 0      | 0     |
| **Total**                      | 🟡 **APROVADO C/ RESSALVAS** | **0**    | **1** | **0**  | **4**  | **7** |

---

## 3. Achados detalhados

Ordenados por severidade decrescente.

### FINDING-001 · 🟠 High · D5 · Advisories de dependências (Electron runtime + tar build-time)

**Descrição:** `pnpm audit` reporta 26 vulnerabilidades (3 low, 13 moderate,
**10 high**). Das 10 high: **4 estão em `electron`** (runtime — embarcado no
produto) e **6 em `tar`** (dependência transitiva de build-time, via
electron-builder e toolchain). A versão instalada de Electron é 30.5.1; os 4
advisories só têm correção em versões ≥ 38.8.6 / ≥ 39.8.1, ou seja, exigem
upgrade de major.

**Evidência:**

```
$ pnpm audit --audit-level=high   # exit 1
Total high/critical advisories: 10
- electron | vuln:<39.8.1  | patched:>=39.8.1  | Use-after-free in offscreen child window painting
- electron | vuln:<38.8.6  | patched:>=38.8.6  | Use-after-free in WebContents fullscreen
- electron | vuln:<38.8.6  | patched:>=38.8.6  | Use-after-free in PowerMonitor (Windows e macOS)
- electron | vuln:<38.8.6  | patched:>=38.8.6  | Renderer command-line switch injection (commandLineSwitches)
- tar | patched:>=7.5.7  | Arbitrary File Creation/Overwrite
- tar | patched:>=7.5.3  | Arbitrary File Overwrite
- tar | patched:>=7.5.8  | Arbitrary File Read/Write via Hardlink Target Escape
- tar | patched:>=7.5.10 | Hardlink Path Traversal via Drive-Relative Link
- tar | patched:>=7.5.11 | Symlink Path Traversal via Drive-Relative Link
- tar | patched:>=7.5.4  | Race Condition in Path Reservations
```

Refs: GHSA-jjp3-mq3x-295m, GHSA-9wfr-w7mm-pc7f (Electron). Arquivo afetado:
`apps/leader/package.json:30` (`"electron": "^30.0.0"`).

**Impacto:** Os 4 advisories de `electron` são em código que **embarca no
produto** — três use-after-free e uma injeção de switches de linha de comando do
renderer. O risco prático é **mitigado** pelo threat model do projeto (LAN
interna, sem conteúdo externo, sem input não-confiável no scaffold W0) e pelo
hardening já aplicado (`contextIsolation`, `sandbox`, CSP estrita,
`setWindowOpenHandler` deny, `will-navigate` bloqueado). Ainda assim, são CVEs
High não corrigidos na linha 30.x — a única correção é um bump de major. Os 6
advisories de `tar` são em ferramenta de build (extração de tarballs durante o
packaging); o threat model é de input confiável (distribuição do Electron e
pacotes npm), risco real baixo, mas patcháveis facilmente.

**Recomendação:**

1. **Electron (runtime):** decisão de plataforma para Renan — abrir spike/ADR
   sobre cadência de atualização do Electron. Não há patch na linha 30.x;
   clarear os 4 advisories exige migrar para ≥ 39.8.1. **Afeta C2 e C3
   igualmente** — não é um bloqueio específico do C2.
2. **`tar` (build-time):** baixo custo — `pnpm.overrides` no `package.json` raiz
   forçando `tar` ≥ 7.5.11, seguido de `pnpm install` + re-`audit`.
3. Registrar a aceitação de risco residual (caso opte-se por manter 30.x no
   curto prazo) formalmente em `DECISIONS.md`.

**Item BL relacionado:** BL-C2-001, BL-C5-001 (e plataforma — ADR-002). **ADR
relacionado:** ADR-002 (Electron 30.x).

---

### FINDING-002 · 🟢 Low · D2 · `tsconfig.json` inclui arquivo inexistente

**Descrição:** O `include` do `apps/leader/tsconfig.json` lista
`electron-builder.yml.d.ts`, um arquivo que **não existe** no repositório (não
rastreado, não presente em disco). Nenhum código TS importa o `.yml`. É uma
entrada de `include` morta/aspiracional.

**Evidência:**

```jsonc
// apps/leader/tsconfig.json:16
"include": ["src/**/*.ts", "src/**/*.tsx", "electron-builder.yml.d.ts"],
```

```
$ git ls-files apps/leader | grep electron-builder
apps/leader/electron-builder.yml          # o .yml existe
                                          # nenhum electron-builder.yml.d.ts
```

**Impacto:** Inofensivo — o TypeScript ignora entradas de `include` que não
casam com nenhum arquivo, e `tsc --noEmit` passa exit 0. É apenas ruído de
configuração que pode confundir um leitor futuro (sugere um arquivo de tipos que
nunca existiu).

**Recomendação:** Remover `"electron-builder.yml.d.ts"` do array `include`.

**Item BL relacionado:** BL-C2-001.

---

### FINDING-003 · 🟢 Low · D5 · Oportunidades de hardening na CSP

**Descrição:** A CSP (meta tag em `index.html`) é **estrita e atende a todos os
requisitos Critical** — sem `'unsafe-eval'`, sem `'unsafe-inline'` em
`script-src`, `default-src 'self'`. Restam três oportunidades de hardening de
segunda linha: (a) não declara `object-src 'none'` (depende do fallback de
`default-src`); (b) não declara `base-uri` — diretiva que **não tem fallback**
para `default-src`, logo uma injeção de `<base>` poderia reposicionar URLs
relativas; (c) `connect-src` inclui `ws://localhost:5173`, que viaja para a CSP
de **produção** (a meta tag é estática, compartilhada dev/prod).

**Evidência:**

```html
<!-- apps/leader/index.html:7 — também presente em dist/index.html (build) -->
content="default-src 'self'; script-src 'self'; style-src 'self'
'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:5173;
font-src 'self' data:;"
```

**Impacto:** Baixo. `base-uri` ausente é a lacuna mais real, mas só explorável
se já houvesse injeção de HTML — o que a ausência de `'unsafe-inline'` em
`script-src` já dificulta. O `ws://localhost:5173` em produção é inerte (nada
escuta nessa porta no app empacotado; é localhost-only). O prompt de auditoria
explicitamente tolera o `ws` de dev.

**Recomendação:** Adicionar `object-src 'none'; base-uri 'self';` à CSP.
Opcionalmente, separar a CSP dev/prod (ex.: injeção via `onHeadersReceived` no
main em produção) para remover o `ws://localhost:5173` do artefato final.
Não-bloqueante para W0.

**Item BL relacionado:** BL-C2-001.

---

### FINDING-004 · 🟢 Low · D2 · `rfc3161TimeStampServer` presente antes da wave de code signing

**Descrição:** O `electron-builder.yml` declara `win.rfc3161TimeStampServer`
(servidor de timestamp para assinatura de código). O code signing está
corretamente diferido para a W3 (BL-C0-008) — `signtoolOptions` está comentado
—, mas a linha do servidor de timestamp ficou ativa.

**Evidência:**

```yaml
# apps/leader/electron-builder.yml:40-41
rfc3161TimeStampServer: http://timestamp.digicert.com
# signtoolOptions: configurado em BL-C0-008 (Wave 3, code signing)
```

**Impacto:** Inerte — `rfc3161TimeStampServer` só é usado quando há um
certificado de assinatura configurado, o que não é o caso. É apenas configuração
prematura (pertence à sessão de signing da W3). Sem efeito funcional ou de
segurança em W0.

**Recomendação:** Comentar a linha junto de `signtoolOptions`, ou mover ambas
para a sessão de BL-C0-008. Mantém o `electron-builder.yml` do scaffold focado
no que é W0.

**Item BL relacionado:** BL-C5-001.

---

### FINDING-005 · 🟢 Low · D4 · Traçabilidade de commits — 2 commits sem o tag `[BL-C2-001]`

**Descrição:** A convenção de commits do `CLAUDE.md` §7.8 mostra o formato
`<tipo>(<componente>): <descrição> [BL-CX-NNN]`. Dos 7 commits de código do C2,
5 (`feat`/`fix`) carregam `[BL-C2-001]` ou `[BL-C5-001]`; **2 commits `chore`**
omitem o tag, embora ambos sejam trabalho do BL-C2-001.

**Evidência:**

```
$ git log --oneline | grep -E 'chore\(C2\)'
4854fa9 chore(C2): scaffold do workspace apps/leader (Electron + React + TypeScript)
65323f7 chore(C2): ajusta toolchain da raiz para artefatos do app Electron
```

(Comparar com `7ef4680 feat(C2): ... [BL-C2-001]`, que carrega o tag.)

**Impacto:** Mínimo. A traçabilidade por `git log` ainda funciona pelo scope
`(C2)`; é uma divergência pontual e discutível da convenção (pode-se argumentar
que commits `chore` de scaffold/toolchain não mapeiam 1-para-1 a um item de
backlog).

**Recomendação:** Em sessões futuras, aplicar o tag `[BL-CX-NNN]` também a
commits `chore` que mapeiem a um item de backlog. Nenhuma ação retroativa
necessária.

**Item BL relacionado:** BL-C2-001.

---

### INFO-001 · ⚪ Info · D4 · Offset de numeração dos ADRs do C2 (esperado pelo prompt como 007/008)

O prompt de auditoria assume que os ADRs do C2 seriam ADR-007 e ADR-008. Na
realidade, o **ADR-007 já estava ocupado** ("Ratificação do baseline de
versões", criado na Sessão 03 do C1, endereçando a auditoria do C0). Os ADRs
substantivos do C2 existem e são **ADR-008** (bundling com vite-plugin-electron)
e **ADR-009** (IPC contract-first). A renumeração foi feita com aval de Renan no
início da Sessão 06 e está documentada no SESSION_LOG. **Nenhum ADR do C2 está
ausente** — apenas há um offset de +1 vs. o texto do prompt. Ambos os ADRs são
completos e bem-formados (status `Accepted`, data, decisores, contexto, decisão,
alternativas, consequências, referências).

### INFO-002 · ⚪ Info · D2 · App em CommonJS é decisão deliberada (ADR-008 + G-007) — supera a checagem D2.1/D2.7 do prompt

O `apps/leader/package.json` **não tem** `"type": "module"`. O checklist D2.1 do
prompt classifica isso como High e o D2.7 espera "preload é ESM". Contudo, o
**ADR-008 e o CLAUDE.md §12 G-007** mandam explicitamente que o app fique em
CommonJS: o preload sandboxado (`sandbox: true`) quebra como ESM ("Cannot use
import statement outside a module"). A spec consolidada que esta auditoria deve
usar **inclui os ADRs** (§0 do prompt) — logo, app em CJS é **conformidade com a
spec**, não desvio. Confirmado na saída de build: `dist-electron/main/index.js`
e `dist-electron/preload/index.js` compilam como CJS
(`"use strict";const i=require(...)`), preservando todas as flags de segurança.
**Não é finding** — é o comportamento correto e documentado.

### INFO-003 · ⚪ Info · D1 · Alterações fora de `apps/leader/` (toolchain raiz + workflow CI)

O C2 tocou arquivos fora de `apps/leader/`: raiz (`.gitignore`,
`.prettierignore`, `eslint.config.mjs`, `package.json`, `pnpm-lock.yaml`) e
`.github/workflows/build-leader.yml` (novo). **Nenhum** dos caminhos Critical de
escopo do §3 do prompt (`packages/*`, `apps/operator-agent/`, `installer/`,
`tests/e2e/`) foi tocado, e **nenhuma tela W1+** foi implementada. As mudanças
de toolchain são integração necessária do primeiro app Electron (documentadas no
SESSION_LOG e beneficiam o C3); o workflow `build-leader.yml` serve diretamente
o BL-C5-001 (gera o `.exe` num runner Windows limpo, contornando o bloqueio do
ESET). Tudo documentado no SESSION_LOG da Sessão 06. **Não é violação de escopo
Critical.**

### INFO-004 · ⚪ Info · D5 · Hardening Electron acima do mínimo obrigatório

Observação positiva. Além do mínimo do CLAUDE.md §8.1, o `main/index.ts` aplica:
`web-contents-created` + `will-navigate` (bloqueia navegação externa) +
`setWindowOpenHandler` → `{ action: 'deny' }` (bloqueia novas janelas), e seta
explicitamente `allowRunningInsecureContent: false` e
`experimentalFeatures: false`. DevTools abre apenas em dev (`mode: 'detach'`).

### INFO-005 · ⚪ Info · D5 · Validação runtime do retorno IPC implementada (defesa em profundidade)

Observação positiva. O preload valida o retorno de `ipcRenderer.invoke('ping')`
antes de devolvê-lo ao renderer:
`if (typeof result !== 'string') throw new TypeError(...)`. É exatamente a
defesa em profundidade que o ADR-009 recomenda e o checklist D5.E do prompt
exige.

### INFO-006 · ⚪ Info · D3 · `.exe` não validável localmente; execução do workflow CI não verificável

`pnpm --filter sprint-leader run package` falhou exit 1 em `EnsureEmptyDir` — o
ESET trava o `release/win-unpacked/resources/app.asar` deixado pela Sessão 06
(gotcha G-009). A configuração do electron-builder, porém, **é válida**: a
ferramenta carregou o `electron-builder.yml`, resolveu
`platform=win32 arch=x64 electron=30.5.1` e só falhou na remoção do arquivo
travado pelo AV. O artefato `.exe` (BL-C5-001) permanece **não validado
localmente**, conforme o SESSION_LOG já marca a BL-C5-001 com ⚠️. O `gh` CLI não
está instalado nesta máquina, então a execução do workflow `build-leader.yml` no
GitHub Actions também **não foi verificável** nesta auditoria.

### INFO-007 · ⚪ Info · D3 · Ruído ambiental no smoke de dev (não é defeito do C2)

Durante o smoke de `pnpm dev`, o stdout do main mostrou erros do Chromium
`ERROR:cache_util_win.cc ... Unable to move the cache: Acesso negado` e
`Gpu Cache Creation failed`, além da mensagem benigna de DevTools
`Request Autofill.enable failed`. São ruído **ambiental** (acesso negado ao
diretório de cache GPU — classe ESET/permissões) e ruído universal de
Electron+DevTools, respectivamente. Não-fatais — o app sobe normalmente (5
processos Electron, DevTools anexado). Não é defeito de código do C2; vale
apenas monitorar o ambiente.

---

## 4. Cobertura da auditoria

### Auditado

- D1–D6 — todos os checks do §5 do prompt.
- Bateria funcional: `install --frozen-lockfile`, `format:check`, `lint`,
  `type-check`, `test`, `build` — todos exit 0; `@sprint/contracts`
  `test:coverage` 100% (regressão zero de C0/C1).
- `pnpm package` (electron-builder `--dir`) — executado; falhou no bloqueio
  ambiental do ESET (G-009).
- Smoke de `pnpm dev` — executado; janela/Vite/Electron/DevTools confirmados;
  processos encerrados de forma limpa ao fim.
- CSP via leitura de `index.html` e do `dist/index.html` buildado.
- `webPreferences` via leitura do `main/index.ts` **e** do
  `dist-electron/main/index.js` compilado.
- APIs proibidas (`@electron/remote`, `<webview>`, `nodeIntegration: true`,
  `enableRemoteModule`, `window.require`) — varredura grep, zero ocorrências.
- Bridge hygiene no preload (`exposeInMainWorld` — 1 chamada real; a contagem
  grep de 2 inclui a menção no JSDoc da linha 5).
- `pnpm audit` (advisories de dependências).

### Não auditado (e razão)

- Geração real do `.exe` (BL-C5-001) — bloqueada pelo ESET (G-009). Requer
  ambiente sem o AV ou o runner Windows do GitHub Actions.
- Execução do workflow `build-leader.yml` no GitHub Actions — `gh` CLI ausente;
  sem acesso para inspecionar runs (mesma limitação registrada na auditoria do
  C0).
- Confirmação **visual** do `pong` no DOM — sem ferramenta de screenshot de
  janela Electron nesta sessão. O wiring `ping → pong` foi validado por inspeção
  de código (main `ipcMain.handle` + preload `invoke`+validação + `App.tsx`
  render) e pela saída de build CJS correta.
- E2E real com Playwright (BL-C8-004 — W3).
- Code signing (BL-C0-008 — W3).
- Comportamento em diferentes versões de Windows.
- BL-C2-002 a 012 (telas, Zustand, Router, dispatch — W1+, não entregues; e
  **confirmado que não há implementação prematura** delas).

---

## 5. Observações fora de escopo

- **C3 deve espelhar a arquitetura do C2.** O scaffold do C2 é um template de
  alta qualidade — `vite.config.ts` (3 entries), `webPreferences`, hardening do
  main, preload contract-first, `env.d.ts`, `electron-builder.yml`. O prompt do
  C3 pode instruir explicitamente "espelhar `apps/leader/`, adaptando o renderer
  para o overlay TOPMOST do Agent (CLAUDE.md §8.2)".
- **A High (FINDING-001) é de plataforma, não de C2.** O Electron 30.x é
  dependência idêntica do C3. Decidir a cadência de atualização do Electron
  antes do C3 evita carregar a mesma ressalva para o próximo componente.
- **Prompts de auditoria futuros:** o offset de numeração de ADR (INFO-001)
  sugere que os prompts de C3+ confirmem o próximo número de ADR livre via
  `DECISIONS.md` em vez de fixar o número no texto do prompt.
- **`apps/leader/release/win-unpacked/resources/app.asar`** continua em disco,
  travado pelo ESET (gitignored, inofensivo). Um reboot da máquina libera o
  arquivo — útil antes de uma próxima tentativa local de `pnpm package`.

---

## 6. Comandos executados (apêndice)

```
$ git status                                              # exit 0 — limpa, develop
$ git log --oneline -50 --all                             # exit 0
$ node --version                                          # v24.10.0
$ pnpm --version                                          # 10.18.2
$ pnpm install --frozen-lockfile                          # exit 0
$ pnpm format:check                                       # exit 0
$ pnpm lint                                               # exit 0
$ pnpm type-check                                         # exit 0 — inclui sprint-leader
$ pnpm test                                               # exit 0 — 190 testes @sprint/contracts
$ pnpm build                                              # exit 0 — sprint-leader: dist/ + dist-electron/
$ pnpm --filter @sprint/contracts run test:coverage       # exit 0 — 100% stmts/branch/funcs/lines
$ pnpm --filter sprint-leader run package                 # exit 1 — ESET trava app.asar (G-009)
$ pnpm dev (smoke)                                        # janela ABRIU — Vite HTTP 200, 5x electron, DevTools anexado
$ Bridge IPC pong                                         # NÃO confirmado visualmente — wiring validado por inspeção + build CJS
$ pnpm audit --audit-level=high                           # exit 1 — 26 vulns (3 low, 13 mod, 10 high)
```

Buscas de segurança (grep em `apps/leader/src`) — todas **zero ocorrências**:
`nodeIntegration: true`, `enableRemoteModule`, `<webview`, `@electron/remote`,
`window.require`/`globalThis.require`, `console.log`/`console.debug`,
`: any`/`as any`/`<any>`, `@ts-ignore`, `ipcMain.on`.

---

## 7. Assinatura

Auditoria realizada em 2026-05-22. Estado do repositório: branch `develop`,
working tree limpa, commit `58e3545`. Nenhuma alteração em código de app ou
configuração — apenas este relatório e a entrada de SESSION_LOG da sessão de
auditoria.

Próxima auditoria recomendada: após a sessão do C3 (que espelhará a arquitetura
do C2), ou após a decisão de plataforma sobre a versão do Electron
(FINDING-001), o que vier primeiro.
