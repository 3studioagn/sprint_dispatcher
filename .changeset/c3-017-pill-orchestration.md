---
'sprint-operator-agent': minor
---

feat(C3): orquestração Overlay ↔ OverlayMinimized via pillService [BL-C3-017]

PillService gerencia BrowserWindow dedicada do pill (badge minimizado do
`@sprint/ui-kit`) que aparece após "Recebi" quando a fila esvazia.

Quando aparece: handleAck final + queue.peek() === null →
overlayService.hide() + pillService.show(item.payload).

Quando some:

- Operador clica pill → IPC pill:expand → overlayService.
  reopenFromHistory(payload) + pillService.hide() (modo BL-C3-009 reopen, sem
  novo ack).
- Nova sprint chega via polling → queueLocal.onNextSprint wire chama
  pillService.hide() (overlay normal eclipsa).
- Operador clica "Reabrir último aviso" no tray → handleReopenLast esconde pill
  (UX consistente).

BrowserWindow do pill: frameless + transparent + topmost screen-saver

- skipTaskbar + focusable false (não rouba foco do app que operador usa).
  Largura = primary display workAreaSize.width; altura 100px ancorada em top:0.
  `<OverlayMinimized>` do ui-kit com `position="center"`.

Renderer: main.tsx detecta `?pill` em window.location.search e monta `<PillApp>`
em vez de `<App>`. PillApp pulla info via window.api.pill.requestCurrent no
mount + subscribe a pill.onUpdate. Click no pill chama window.api.pill.expand.

body.pill-mode {background: transparent} para o canvas do BrowserWindow do pill
mostrar transparência fora da bar do OverlayMinimized.

+29 testes:

- pillService.test.ts (18 testes): estado inicial, show primeira/ subsequente,
  hide idempotente, destroy, getCurrent/getFullPayload, isShown.
- PillApp.test.tsx (7 testes): render inicial null/info, falha em
  requestCurrent, push onUpdate, click → expand, NÃO chama acknowledge, cleanup
  do unsubscribe.
- handleAck.test.ts (4 testes): wire do pill — queue vazia → show, próxima na
  fila → hide, pillService omitido (backward compat), show recebe item ackeado.

Total Agent: 240 → 269 testes verdes.
