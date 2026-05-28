---
'sprint-leader': minor
---

feat(C2): cancelamento de sprint com confirmação e writeCancel [BL-C2-009]

Fecha o ciclo de cancelamento ponta-a-ponta: o líder cancela uma rodada via UI;
o `cancel-<id>.json` é gravado em `pending/` via `CancelStore.writeCancel`; o
Agent (BL-C3-011, já mergeado) detecta e fecha o overlay no operador sem ack —
last write wins (RN-06).

Main process:

- `CancelService.cancel(request)` monta `SprintCancel` (Anexo E:
  `schema_version`, `type:"cancel"`, `sprint_id_ref`, `cancelado_por` do config,
  `cancelado_em` ISO, `motivo` opcional). Valida via `parseSprintCancel`
  (sprint_id inválido → `ContractValidationError` com contexto do campo). Delega
  para `CancelStore.writeCancel`, devolvendo `filename` + `removed_originals`.
- Novo handler IPC `cancelSprint` com envelope
  `IpcResult<CancelSprintResponse>`.
- `CancelStore` instanciado no `rebuildDeps` recebendo `pendingStore` para
  remoção idempotente de pendings originais (BL-C4-004).

Renderer:

- `useTrackedSprintStore` ganha `cancelled: boolean` + `markCancelled()` +
  `selectIsSprintActive`.
- `<CancelSprintButton />` renderiza botão destrutivo + modal de confirmação
  (overlay escuro, motivo opcional textarea, "Voltar" e "Confirmar
  cancelamento"). Click no backdrop fecha sem enviar; submitting state
  desabilita botões; sucesso chama `markCancelled()` na store; erro mostra
  mensagem inline com `role="alert"`.
- `Acompanhamento` integra: botão visível enquanto `selectIsSprintActive`, some
  quando `cancelled`; `useEffect` interrompe polling em `current.cancelled`;
  exibe nota "Rodada cancelada" + subtítulo atualizado.
- `LeaderAPI.cancelSprint` adicionado; preload + api wrapper + test-setup mock
  alinhados.

Testes: 27 novos. Total Leader: 276 → 332.

Marco da Wave 2: cancelamento ponta-a-ponta validável (Leader escreve → Agent
fecha overlay).
