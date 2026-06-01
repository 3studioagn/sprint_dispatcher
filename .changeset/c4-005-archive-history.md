---
'@sprint/fs-adapter': minor
'@sprint/contracts': patch
---

feat(C4): arquivo histórico compartilhado (move + leitura) [BL-C4-005]

Substitui o stub `NotImplementedError` do `ArchiveStore` por implementação
completa do histórico compartilhado (`<shared>/arquivo/<YYYY-MM-DD>/`),
destravando a tela de histórico do Leader (BL-C2-010).

`@sprint/fs-adapter`:

- `archiveSprint(sprintFilename)` — move a sprint de `pending/` **+ o ack
  pareado** de `acks/` para `arquivo/<data-de-origem>/`. Data derivada do
  timestamp do ULID (UTC, sem ler o arquivo → robusto a JSON corrompido).
  `mkdir` recursivo; move atômico (`rename`) com fallback **copy+unlink** em
  `EXDEV`; anti-overwrite (destino existente → `already-archived`, remove o
  original redundante); `source-missing`/`ENOENT` benigno.
- `archiveAck(ackFilename)` — arquiva acks **órfãos** (sprint já fora de
  `pending/`) na pasta de data da sua sprint.
- `listArchive(filter?)` / `readArchivedSprint(ref)` — leitura do histórico
  (filtros por data/operador; pareia sprint↔ack). Ignora `log-limpeza.txt` e
  entradas não-data. Não lança se `arquivo/` ainda não existe.
- Tipos públicos novos: `ArchiveOutcome`, `ArchiveSprintResult`,
  `ArchiveAckResult`, `ArchivedSprintRef`, `ArchivedSprint`, `ListArchiveFilter`
  (substituem `MoveToArchiveResult`).

`@sprint/contracts` (patch): `decodeUlidTime(id)`, `formatArchiveDate(input)`,
`isArchiveDateFolder(name)` + constantes `DEFAULT_RETENTION_DAYS` e
`CLEANUP_LOG_FILENAME`.

O `MemoryFilesystemAdapter` já provê todos os primitivos — sem métodos novos
(operações de arquivo vivem no domain layer, não na `IFilesystemAdapter`).

Decisões em ADR-025. Testes: suíte do `ArchiveStore` reescrita (real) + paridade
Node↔Memory; cobertura do código novo ≥ 90% (branches 97% em
`archive-store.ts`).
