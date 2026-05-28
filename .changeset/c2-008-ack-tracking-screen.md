---
'sprint-leader': minor
---

feat(C2): tela de acompanhamento de acks com polling [BL-C2-008]

A rota `/acompanhamento` deixa de ser placeholder. Após o líder disparar uma
rodada com sucesso, esta tela mostra o estado dos avisos em cada operador da
rodada, atualizando a cada 3s (UC-04, RF-10).

Main process:

- `AckTrackingService.list(sprintId, targets)` agrega `AckStore` +
  `OperatorsService` e devolve `readonly AckStateView[]`. Estados derivados do
  Anexo D: `displayed_at` presente = "visto"; `acknowledged_at` presente =
  "confirmado"; nenhum ack = "nao_visto". Trata `DirectoryNotFoundError` de
  `acks/` como benigno (todos os targets ficam `nao_visto` até o primeiro ack).
- Novo handler IPC `listAcks` com envelope `IpcResult<ListAcksResponse>` e
  código `CONFIG_REQUIRED` quando deps null.
- `AckStore` + `AckTrackingService` instanciados no `rebuildDeps`.

Renderer:

- `useTrackedSprintStore` (Zustand): persiste a sprint disparada na sessão atual
  (`sprint_id`, `dispatched_at`, `targets`, `title`, `deadline`).
- `NovaSprint.handleDispatchClick` popula o store quando
  `result.summary.success > 0` (targets que falharam ficam fora).
- `Acompanhamento.tsx`: empty state se nenhuma sprint; senão lê o store +
  polling com `setInterval(3s)` e cleanup no unmount via cancelled flag +
  `clearInterval`. Renderiza summary (título, deadline, count, `checked_at`) +
  lista de targets com indicador colorido (cinza/laranja/verde) e timestamp.
- `LeaderAPI.listAcks` adicionado; preload + api wrapper + test-setup mock
  alinhados.

Testes: 27 novos (12 `AckTrackingService` + 5 `useTrackedSprintStore`

- 9 Acompanhamento + 1 App route update). Total Leader: 248 → 276.
