---
'@sprint/fs-adapter': minor
---

feat(C4): implementar writeCancel no fs-adapter + mock [BL-C4-004]

Substitui o stub `NotImplementedError` da `CancelStore` por implementação
completa de `writeCancel`. Esta entrega fecha o ciclo de cancelamento
ponta-a-ponta: o Leader (BL-C2-009) agora escreve `cancel-<sprintId>.json` que o
Agent (BL-C3-011, já mergeado em W2) detecta para fechar o overlay sem ack —
last write wins (RN-06).

Comportamento:

1. Escrita atômica de `<sharedPath>/pending/cancel-<sprintId>.json` via
   `IFilesystemAdapter.writeFileAtomic` (espelha
   `PendingStore.writePendingSprint`).
2. Re-validação Zod via `parseSprintCancel` em runtime — defesa em profundidade
   contra cast bypass.
3. `PendingStore` opcional no construtor
   (`new CancelStore(adapter, sharedPath, pendingStore?)`). Quando injetado,
   `writeCancel` localiza via `pendingStore.listPending({ sprintId })` e remove
   os arquivos `<sprintId>-<userId>.json` da sprint cancelada. Race-safe:
   arquivos que desaparecem entre list e delete (Agent processou primeiro) são
   pulados silenciosamente (`FileNotFoundError`).
4. `WriteCancelResult` ganha `removedOriginals: readonly string[]` para o caller
   registrar quantos pendings foram limpos.

Paridade Node↔Memory: novo bloco `describe('CancelStore')` em `parity.test.ts`
substitui o teste de stub. `ArchiveStore` continua no bloco de stubs (W3).

Testes: 19 novos em `cancel-store.test.ts` (happy path, defesa em profundidade,
remoção de originais, race condition, overwrite) + 2 em paridade. Total
fs-adapter: 286 → 308.
