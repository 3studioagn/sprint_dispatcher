---
'sprint-operator-agent': minor
---

refactor(C3): substituir overlay inline por <Overlay> do @sprint/ui-kit
[BL-C3-015]

Adiciona @sprint/ui-kit (workspace:\*) como dependência do Agent. Overlay.tsx do
renderer consome:

- <Overlay> do ui-kit (chrome: background, card, header, botão)
- <TextBlock> do ui-kit para body_html sanitizado
- <ThemeProvider> do ui-kit no root (App.tsx)

Window management permanece no Agent (overlayService.createWindow: fullscreen +
alwaysOnTop:'screen-saver' + skipTaskbar + multi-monitor). ui-kit é puramente
apresentacional.

Decisão de auto-close: autoCloseSeconds={0} no <Overlay> do ui-kit desabilita
seu timer interno. Ciclo de vida da janela continua exclusivamente no main
process via overlayService.minimizeAfterMs. Única fonte de verdade evita race
entre timers.

Componentes deletados (subsumidos pelo novo Overlay):

- AckButton: loading state, error inline, warning F-024 → vivem agora inline no
  Overlay.tsx
- SprintCard: title vai para header do ui-kit; body_html para TextBlock; meta
  gigante permanece no body slot

Componentes preservados: DeadlineBadge, QueueIndicator (reused no body slot do
<Overlay>).

Label dinâmico do botão: "Confirmando…" (loading), "Fechar" (reopened
BL-C3-009), "Recebi" (normal).
