---
'sprint-operator-agent': minor
---

feat(C3): detecção de cancelamento fecha overlay/remove da fila [BL-C3-011]

PollingService processa arquivos cancel-<sprintId>.json detectados em pending/,
alinhando com UC-05 e RN-06 (last-write-wins). Antes, o branch kind:'cancel' era
stub com log+skip.

listPending agora é chamado SEM filter {userId} — cancels são broadcast (sem
user_id no filename). Sprints de outros operadores são filtradas inline em
processSprint.

Algoritmo processCancel:

1. Snapshot do sprint_id_ref e do currentItem do overlay ANTES de mutar estado
   (evita race).
2. queueService.removeBySprintId — remove se enfileirada (sem ack).
3. overlayService.hide() se estava exibindo essa sprint (sem ack).
4. Se há próxima sprint na fila, exibe via showSprint manualmente.
5. historyService.archive do cancel para auditoria + dedup pós-restart.
6. pendingStore.deletePending do shared. Não-fatal em falha.

Cancel para sprint inexistente: no-op em fila/overlay; ainda arquiva e deleta
(cleanup).
