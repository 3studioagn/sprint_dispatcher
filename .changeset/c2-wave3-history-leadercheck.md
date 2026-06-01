---
'@sprint/fs-adapter': minor
'sprint-leader': minor
---

feat(C2): tela de histórico + gate de permissão do líder [BL-C2-010][BL-C2-012]

Conclui o componente C2 (Leader) na Wave 3 — seus 2 itens restantes:

- **BL-C2-010 — Histórico:** tela `/historico` funcional (filtros de
  data/operador/líder, lista de rodadas agrupadas por `sprint_id`, detalhe
  read-only com metadados + corpo do aviso re-sanitizado + lista de targets
  reaproveitando o componente de status do Acompanhamento). Consome
  `listArchive`/`readArchivedSprint` via novos handlers IPC tipados (fs só no
  MAIN), com validação Zod dos inputs.
- **BL-C2-012 — Gate de permissão:** botão "Disparar" desabilitado + mensagem
  clara + "Verificar novamente" quando o usuário Windows não tem escrita em
  `pending/`; resultado logado via `@sprint/logger`.

Toque aditivo no **`@sprint/fs-adapter`** (não quebra consumidores):
`probeWritePermission(dirpath)` na `IFilesystemAdapter` — probe write+unlink
(real no `NodeFilesystemAdapter`, configurável no `MemoryFilesystemAdapter`)
para o gate de permissão (ADR-026).
