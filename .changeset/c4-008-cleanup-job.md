---
'@sprint/fs-adapter': minor
---

feat(C4): job de limpeza automática (CLI + retenção) [BL-C4-008]

CLI standalone `sprint-archive-cleanup` que varre `pending/`/`acks/` na pasta
compartilhada, arquiva o que expirou (via `ArchiveStore`) e registra um log de
limpeza. **Conclui o componente C4** (`@sprint/fs-adapter`) — sem itens em W4.

- **Lógica pura e testável** (`cleanup.ts`): `planCleanup` (decide o que
  arquivar) + `runCleanup` (executa). Política de retenção configurável
  `age | deadline | both` (default `both`; `--retention-days` default 7, RN-08).
  Acks órfãos arquivados por idade; cancelamentos ignorados (lifecycle do
  Agent); inválidos geram aviso + arquivam por idade. Tolerante a corrida.
- **Logging por injeção** (`onEvent?`): o pacote **não** importa
  `@sprint/logger` — permanece dependency-pure (só Node + `@sprint/contracts`).
  Helpers puros `parseCleanupArgs` + `formatCleanupLogLine` + `CLEANUP_USAGE`.
- **CLI** (`bin/sprint-archive-cleanup.ts`, único arquivo com `process.*`):
  `--share`, `--retention-days`, `--mode`, `--dry-run`, `--help`; escreve em
  `arquivo/log-limpeza.txt` (append) + stdout; exit codes 0/1/2; guarda de
  compartilhamento inacessível. Bundled p/ `.mjs` autocontido via esbuild
  (`build:cli`, regenerado no `prepare` do `pnpm install`).
- Empacotar o CLI em EXE e agendar via instalador é **C5/deploy** — fora de
  escopo. Runbook + agendamento via Task Scheduler em
  `docs/guides/cleanup-job.md`.

Decisões em ADR-025. Testes: `cleanup.test.ts` (plan/run/args/log) cobrindo as 3
políticas, dry-run, idempotência, órfãos e corrida; cobertura do código novo ≥
90%.
