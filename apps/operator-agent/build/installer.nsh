; =============================================================================
; installer.nsh — hook NSIS de auto-start do Agent "Metas - Desenhistas"
; BL-C5-003 · ADR-028 · Anexo G.6.2 · RF-19
; =============================================================================
;
; electron-builder inclui este arquivo automaticamente (default de
; `nsis.include = build/installer.nsh`; também explicitado no
; electron-builder.yml). As macros abaixo são invocadas pelo template NSIS:
;   - customInstall   → ao final da instalação
;   - customUnInstall → ao final da desinstalação
;
; AUTO-START EM HKCU (não HKLM) — R-03 / Anexo G.5: roda no contexto do
; usuário, sem exigir admin para a entrada de Run em si. Num install per-user
; (perMachine:false) o HKCU do instalador É o do operador → entrada correta.
; A robustez para o caso per-machine/admin (onde o HKCU do instalador seria o
; do admin) é garantida pelo AUTO-REGISTRO DEFENSIVO no main do app
; (`src/main/services/autoStart.ts`), que reescreve a entrada no HKCU do
; usuário logado a cada boot. Belt-and-suspenders (ADR-028).
;
; O valor aponta para o exe instalado entre aspas — `${APP_EXECUTABLE_FILENAME}`
; resolve para "<productName>.exe" (i.e. "Metas - Desenhistas.exe"); o caminho
; tem espaços, então as aspas são obrigatórias para o parse no logon.
;
; ⚠️ O NOME DO VALOR ("Metas - Desenhistas") DEVE casar com
; AUTO_START_REGISTRY_VALUE em `src/shared/branding.ts`. Divergir cria DUAS
; entradas de auto-start (uma deste hook, outra do auto-registro do app).
;
; NÃO confundir este auto-start (HKCU Run, MVP) com watchdog/Scheduled Task
; (BL-C5-004, W4).

!macro customInstall
  DetailPrint "Configurando início automático (Metas - Desenhistas)..."
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Metas - Desenhistas" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Metas - Desenhistas"
!macroend
