---
'sprint-operator-agent': minor
'sprint-leader': patch
---

C5 (Wave 3) — Installer & Deployment: escopo de W3 concluído.

- **Rename do produto (decisão Renan):** Leader → "Metas - Liderança", Agent →
  "Metas - Desenhistas". `productName`, `appId`, `artifactName` e a pasta de
  dados em `ProgramData` seguem o novo nome; identificadores internos (nomes de
  pacote npm, pastas do repo) permanecem.
- **BL-C5-005 — Nomeação versionada dos artefatos:** instaladores
  determinísticos `Metas-Lideranca-Setup-${version}.exe` e
  `Metas-Desenhistas-Setup-${version}.exe` (versão do `package.json`, ASCII-safe
  para CI/release). Destrava BL-C0-009.
- **BL-C5-003 — Auto-start do Agent (HKCU Run):** hook NSIS
  (`build/installer.nsh`, macros `customInstall`/`customUnInstall`) +
  auto-registro defensivo idempotente no boot (`main/services/autoStart.ts`, via
  `reg.exe`), cobrindo o caso per-machine/admin. HKCU (nunca HKLM); só o Agent
  (Leader é manual — RN-12).
- **BL-C5-006 — Wizard de configuração inicial (first-run):** janela `?setup`
  que coleta `user_id`/`shared_path` (+ nome de exibição opcional), deriva
  `hostname`, aplica defaults do Anexo F, valida via Zod (`AgentConfig`) e grava
  o `config.json`. "Testar conexão" reaproveita `isConnectivityError`
  (BL-C3-013).
- **Config em `C:\ProgramData\Metas - Desenhistas\`** (config.json +
  historico/ + logs/), criado no first-run — supersede o
  `app.getPath('userData')` do W1 (ADR-012). Decisões em ADR-028.

Fora do escopo (W4): BL-C5-004 (Scheduled Task) e BL-C5-007 (instalador
silencioso). Assinatura de código (C0-008) preservada.
