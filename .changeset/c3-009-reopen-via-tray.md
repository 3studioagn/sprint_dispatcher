---
'sprint-operator-agent': minor
---

feat(C3): reabertura do último aviso via tray sem novo ack [BL-C3-009]

Tray menu ganha item "Reabrir último aviso" — operador pode reabrir o último
aviso arquivado no histórico local sem disparar novo ack. Habilitado apenas em
estado `idle` (sem sprint na fila); em `sprint_active` o item "Mostrar sprint
atual" já cobre.

Fluxo separado do ack final (RF-08, UC-03):

- Normal: showSprint → writeDisplayed → "Recebi" → writeAcknowledged + archive +
  dequeue.
- Reabertura: loadLastArchived → reopenFromHistory → "Fechar" → closeReopened
  (hide). SEM ack, SEM dequeue, SEM toque em currentItem.

Camadas:

- historyService.loadLastArchived: lê último .json válido em
  <userData>/historico/<dia>/, filtrando cancels.
- overlayService.reopenFromHistory: cria/mostra janela; push sprint:incoming com
  reopened:true; NÃO inicia timer.
- IPC overlay:close-reopened → overlayService.closeReopened (hide).
- ipc-types: IncomingSprintEvent.reopened?, Api.overlay.closeReopened.
- Renderer: useCurrentSprintStore.isReopened. AckButton vira "Fechar" quando
  reopened=true (BL-C3-015 subsumiu em Overlay.tsx via prop).
- trayStateService: ação 'reopen-last' adicionada.
- trayService.displayInfoBalloon para feedback "nenhum aviso para reabrir".
