---
'@sprint/fs-adapter': patch
---

feat(C4): domain layer (PendingStore, AckStore, CancelStore stub, ArchiveStore
stub) [BL-C4-002, BL-C4-003, BL-C4-006]

Camada de domínio em `src/domain/`, alinhada com ADR-013 (port-and-adapter):
módulos separados que injetam `IFilesystemAdapter` + `sharedPath` no construtor
e operam sobre os primitivos do W0 (`readFile`, `writeFileAtomic`, `listDir`,
`stat`, `unlink`, `mkdir`).

Entregues:

- **`PendingStore`** (`writePendingSprint`, `listPending`, `deletePending`).
  Sanitiza `body_html` antes de gravar (defesa em profundidade per CLAUDE.md
  §7.9). Defense-in-depth via `parseSprintPayload` (re-validação contra cast
  bypass). Listagem retorna `PendingEntry` discriminada
  (`kind: 'sprint' | 'cancel' | 'invalid'`), aplicando RN-09 (malformados viram
  `kind: 'invalid'`, não lançam). `deletePending` aceita pending + cancel,
  rejeita ack/path traversal.
- **`AckStore`** (`writeAck`, `listAcks`). Overwrite é caso de uso explícito
  (BL-C4-006) — Agent reescreve para adicionar `acknowledged_at`.
- **`CancelStore`** stub (W2 / BL-C4-004): `writeCancel` lança
  `NotImplementedError`.
- **`ArchiveStore`** stub (W3 / BL-C4-005): `moveToArchive` lança
  `NotImplementedError`.
- **`readAndParseJson`** utility com discriminador
  `kind: 'not-found' | 'invalid'` — consumers distinguem race condition (skip)
  de corrupção (`kind: 'invalid'`) sem brittle string match.
- **`NotImplementedError`** adicionado à hierarquia `FilesystemError`.

Nova runtime dep: `@sprint/contracts` (`workspace:*`), necessária para os
parsers Zod, sanitizador e helpers de filename usados pelo domain layer. JSON
gravado em pretty-print (2 espaços) para diagnóstico manual pela TI da fábrica
via `notepad`/`type`.

Coverage 100% em toda a camada de domínio. Testes contra
`MemoryFilesystemAdapter` (paridade Node↔Memory já garantida pela contract suite
do W0).
