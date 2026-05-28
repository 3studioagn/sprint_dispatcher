---
'sprint-operator-agent': minor
---

feat(C3): ignorar sprints com deadline_at no passado [BL-C3-012]

Sprint expirada agora é movida ao histórico local via `historyService.archive()`
em vez de apenas marcada como processed em memória, alinhando com RN-03/RF-18.
Operador pode auditar via tray "Histórico local" sprints que chegaram tarde. Sem
ack de visualização (precondição: nunca enfileirada → onNextSprint não dispara →
writeDisplayed não roda).

Fallback defensivo: se archive() falhar (disco cheio, permissão), markProcessed
garante dedup em memória — ciclo seguinte não re-processa o mesmo arquivo.
