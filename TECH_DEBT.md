# Tech Debt — Sprint Dispatcher

Fila priorizada de findings DEFERIDOS de auditorias e sessões de correção. Cada
entrada é uma decisão consciente de **adiar** trabalho — não esquecer.

> **Origem inicial (2026-05-27):** sessão de correções pós-auditoria W1 (Caminho
> 2 — Mínimo + UX). 20 dos 25 findings da `AUDIT_W1_pre_W2.md` ficaram fora do
> escopo dessa sessão e estão catalogados abaixo com justificativa.

## Formato de entrada

```markdown
### F-NNN — <Título conciso do finding>

- **Severidade:** Critical | High | Medium | Low
- **Categoria:** <da auditoria>
- **Origem:** AUDIT_W1_pre_W2.md (linha X) | sessão NN | etc.
- **Status:** DEFERRED — <razão sucinta>
- **Bloqueio:** <pré-requisito; pode ser ADR-XXX, BL-YYY, decisão estratégica,
  outro finding...>
- **Reativar quando:** <gatilho objetivo>
- **Recomendação resumida:** <1 linha>
- **Estimativa:** S (<30min) | M (1-4h) | L (1d+)
```

---

## HIGH — Renan-dependentes (decisões arquiteturais, exigem ADR)

### F-003 — Timer de minimização usa `minimize_after_seconds` (config, 30s) em vez de `show_duration_seconds` (sprint payload, 5s)

- **Severidade:** High
- **Categoria:** 1 (Backlog Compliance) + 2 (Rastreabilidade)
- **Origem:** AUDIT_W1_pre_W2.md F-003
- **Status:** DEFERRED — exige decisão arquitetural (Opção A vs B). Mesma raiz
  que F-011.
- **Bloqueio:** ADR-022 (precisa de Renan) decidindo: (A) trocar fonte do timer
  para `currentItem.payload.show_duration_seconds` (alinha backlog AC 5s); (B)
  manter `minimize_after_seconds` config + remover campo do schema com bump
  `SCHEMA_VERSION` e atualizar Requisitos.
- **Reativar quando:** sessão dedicada W2 com presença do Renan; OU
  imediatamente se um operador reportar UX confusa do timer de 30s.
- **Recomendação resumida:** ver AUDIT_W1_pre_W2.md F-003 — duas opções
  detalhadas.
- **Estimativa:** M (1-4h após decisão).

### F-006 — Histórico, config e logs em `%APPDATA%\<app>\` (per-user) em vez de `C:\ProgramData\SprintAgent\` (all-users)

- **Severidade:** High
- **Categoria:** 1 (Backlog Compliance) + 2 (Rastreabilidade — Requisitos Anexo
  B)
- **Origem:** AUDIT_W1_pre_W2.md F-006
- **Status:** DEFERRED — exige decisão arquitetural (modelo de instalação:
  per-user vs all-users).
- **Bloqueio:** ADR-023 (precisa de Renan) decidindo: (A) refactor para
  `ProgramData` (exige admin no instalador W3 — BL-C5-003); (B) manter
  `userData` + atualizar Requisitos Anexo B + RF-19 + RN-13 + registrar ADR
  formal.
- **Reativar quando:** sessão dedicada de arquitetura de instalação (idealmente
  antes ou junto de BL-C5-003 em W3).
- **Recomendação resumida:** ver AUDIT_W1_pre_W2.md F-006. Influencia F-012
  (mesma decisão).
- **Estimativa:** M-L (1-4h se Opção B docs; 4h+ se Opção A com mudança de
  código + instalador).

---

## MEDIUM — não-bloqueantes para W2

### F-004 — Menu do tray diverge da AC do backlog (falta "Status da conexão" e "Sair (admin)")

- **Severidade:** Medium
- **Categoria:** 1 (Backlog Compliance)
- **Origem:** AUDIT_W1_pre_W2.md F-004
- **Status:** DEFERRED — escopo cosmético + ADR formal para "Sair (admin)"
  oculto (RN-04 já justifica em CLAUDE.md mas backlog AC desatualizada).
- **Bloqueio:** nenhum — pode entrar em qualquer sessão W2/W3 com escopo de tray
  polish.
- **Reativar quando:** próxima sessão tocando `trayService.ts` /
  `trayStateService.ts` (provavelmente W3 fortificação admin).
- **Recomendação resumida:** adicionar "Status da conexão" como item; registrar
  ADR justificando "Sair" oculto.
- **Estimativa:** S-M (1-3h).

### F-005 — Tray icon sem handler de click esquerdo (não reabre último aviso)

- **Severidade:** Medium
- **Categoria:** 1 (Backlog Compliance)
- **Origem:** AUDIT_W1_pre_W2.md F-005
- **Status:** DEFERRED — workaround existente (operador usa context menu →
  "Mostrar sprint atual"). Backlog AC pede single-click.
- **Bloqueio:** nenhum.
- **Reativar quando:** próxima sessão tocando `trayService.ts`.
- **Recomendação resumida:** adicionar
  `this.tray.on('click', () => this.actionHandler('show-current'))`.
- **Estimativa:** S (< 1h — 1 linha + 1 teste).

### F-007 — File transport rotacionado ausente; drift de numeração BL-C6-\*

- **Severidade:** Medium
- **Categoria:** 1 (Backlog Compliance)
- **Origem:** AUDIT_W1_pre_W2.md F-007
- **Status:** DEFERRED — feature de file rotation deferida para W3 (BL-C6-003
  conforme numeração do projeto). Drift de numeração entre backlog e
  implementação precisa ser reconciliado com Renan.
- **Bloqueio:** BL-C6-003 (W3) para implementação; sessão de backlog grooming
  com Renan para numeração.
- **Reativar quando:** início de W3 OU sessão de grooming.
- **Recomendação resumida:** ver AUDIT_W1_pre_W2.md F-007.
- **Estimativa:** S (1-2h docs/numeração) + M (2-4h implementação pino-roll).

### F-011 — Campo `persistent_popup` do `SprintPayload` é ignorado pelo Agent

- **Severidade:** Medium
- **Categoria:** 2 (Rastreabilidade)
- **Origem:** AUDIT_W1_pre_W2.md F-011
- **Status:** DEFERRED — mesma raiz que F-003 (schema declara capacidade que
  Agent não consome). Decisão compartilhada via ADR-022.
- **Bloqueio:** ADR-022 (mesma decisão que F-003) — Opção A: implementar campo
  no overlayService; Opção B: remover do schema com bump SCHEMA_VERSION.
- **Reativar quando:** sessão que resolve F-003.
- **Recomendação resumida:** seguir decisão de F-003.
- **Estimativa:** S-M (Opção A: 2-4h; Opção B: 1-2h).

### F-012 — `historyService.archive` bypassa `IFilesystemAdapter` (escrita direta com `fs.writeFile`)

- **Severidade:** Medium
- **Categoria:** 3 (Conformidade Arquitetural — ADR-013)
- **Origem:** AUDIT_W1_pre_W2.md F-012
- **Status:** DEFERRED — mesma raiz que F-006 (modelo de persistência local). A
  decisão sobre F-006 determina abordagem.
- **Bloqueio:** F-006 / ADR-023.
- **Reativar quando:** sessão que resolve F-006.
- **Recomendação resumida:** Opção A: refactor para usar IFilesystemAdapter;
  Opção B: documentar exceção em CLAUDE.md §4.
- **Estimativa:** M (2-4h Opção A; S Opção B).

### F-018 — `sprint-operator-agent` thresholds 70/65/70/70 muito abaixo do prompt e da realidade

- **Severidade:** Medium
- **Categoria:** 5 (Testes & Cobertura)
- **Origem:** AUDIT_W1_pre_W2.md F-018
- **Status:** DEFERRED — fix mecânico (subir threshold para 90/85/90/90 alinhado
  com CLAUDE.md §7.7.1). Não foi feito nesta sessão para não estender escopo;
  Caminho 2 limitado-se a F-024+F-025 no Agent.
- **Bloqueio:** nenhum.
- **Reativar quando:** próxima sessão tocando
  `apps/operator-agent/vitest.config.ts` (ou batch dedicado de threshold
  tightening — análogo ao F-017 do Leader).
- **Recomendação resumida:** subir threshold para 90/85/90/90; cobertura real já
  está em 97.78/91.57/95.4/97.78 — folga.
- **Estimativa:** S (< 30min — config + docs).

---

## LOW — todos cosméticos / docs / consistency

### F-001 — `MemoryFilesystemAdapter` sem API explícita de `injectFailure`/`setLatencyMs`

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-001
- **Status:** DEFERRED — workaround documentado (`vi.spyOn`) funciona. Sem
  impacto operacional.
- **Bloqueio:** nenhum (atualização de backlog AC).
- **Reativar quando:** revisão de backlog com Renan.
- **Estimativa:** S (< 1h — docs).

### F-008 — Logo e cores são 3Studio, não ARTFLEXÍVEIS (BL-C2-002 AC3)

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-008
- **Status:** DEFERRED — exige confirmação de Renan (intencional como vendor
  visível vs trocar para marca cliente).
- **Bloqueio:** decisão Renan.
- **Reativar quando:** revisão visual ou conversa com Renan.
- **Estimativa:** S.

### F-009 — Deadline no passado: warning inline em vez de "confirmação override"

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-009
- **Status:** DEFERRED — implementação consistente com US-01.03 (warning sem
  bloqueio); fix é atualizar backlog AC3 para alinhar com US.
- **Bloqueio:** revisão de backlog com Renan.
- **Estimativa:** S (docs).

### F-010 — Botão de ack labelado "Recebi" em vez de "OK, entendi"

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-010
- **Status:** DEFERRED — semântica equivalente; decisão de UX/copywriting com
  Renan.
- **Bloqueio:** decisão Renan.
- **Estimativa:** S.

### F-013 — Convenções de naming IPC inconsistentes entre Leader e Agent

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-013
- **Status:** DEFERRED — funcional; cosmético. ADR-022 (futuro) deve padronizar.
- **Bloqueio:** ADR-022 (não a mesma que F-003 — outra ADR-022; este TECH_DEBT
  pode receber numeração diferente; consultar antes de criar).
- **Reativar quando:** próxima sessão de IPC refactor ou consolidação cross-app.
- **Estimativa:** S-M (1-3h).

### F-014 — Handlers IPC sem `IpcResult` envelope: `ping` (Leader) e `sprint:request-current` (Agent)

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-014
- **Status:** DEFERRED — `ping` é smoke W0 (deletar); `sprint:request-current`
  fragil mas funcional. Fix coordenado com F-013.
- **Bloqueio:** nenhum.
- **Estimativa:** S.

### F-015 — Drift minor de versão do Zod entre packages

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-015
- **Status:** DEFERRED — lockfile resolve para uma versão única (deduplication).
  Declarações nominais divergentes são confusas mas não-bloqueantes.
- **Bloqueio:** nenhum.
- **Estimativa:** S (< 1h).

### F-016 — CLAUDE.md §12 lista débito `rootDir do Leader` como pendente mas a fix já foi aplicada

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-016
- **Status:** DEFERRED — débito stale; remoção/migração para "resolvidos".
- **Bloqueio:** nenhum.
- **Reativar quando:** próxima sessão de docs sweep.
- **Estimativa:** S (< 15min).

### F-019 — `App.tsx` do operator-agent sem cobertura (0/0/0/0) — falta `App.test.tsx`

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-019
- **Status:** DEFERRED — cobertura agregada do Agent (97.78%) já passa
  threshold; fix é assimetria com Leader.
- **Bloqueio:** nenhum.
- **Reativar quando:** sessão tocando `apps/operator-agent/src/renderer/App.tsx`
  ou batch dedicado de test infra.
- **Estimativa:** S (< 1h).

### F-021 — `packages/fs-adapter/README.md` está stale ("API completa após F8 desta sessão")

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-021
- **Status:** DEFERRED — docs only; expand README seguindo padrão de
  `@sprint/contracts`.
- **Bloqueio:** nenhum.
- **Reativar quando:** próxima sessão de docs sweep ou início de uma sessão de
  W2 tocando fs-adapter.
- **Estimativa:** S (1-2h).

### F-022 — Naming convention drift entre CLAUDE.md §7.1 (kebab-case) e implementação (camelCase em 4 de 5 packages)

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-022
- **Status:** DEFERRED — atualização docs (kebab-case era prescrição não
  cumprida; impl converge para camelCase em services/utils).
- **Bloqueio:** nenhum.
- **Reativar quando:** próxima sessão de docs sweep.
- **Estimativa:** S (< 30min).

### F-023 — Hierarquias de erro inconsistentes entre pacotes (2 de 5 usam standalone)

- **Severidade:** Low
- **Origem:** AUDIT_W1_pre_W2.md F-023
- **Status:** DEFERRED — refactor cosmético (abstract base em
  `@sprint/contracts` + `operatorsService`).
- **Bloqueio:** nenhum.
- **Reativar quando:** sessão tocando contracts/errors ou operatorsService.
- **Estimativa:** S (1-2h).

---

## Padrões temáticos agrupados (do Gate 11 da auditoria)

Quando endereçar findings relacionados juntos, considerar:

- **Documentation lag:** F-007, F-016, F-021, F-022 (+ F-001, F-008, F-009) — PR
  único docs-sweep.
- **Schema-Implementation drift:** F-003 + F-011 — ADR-022 + 1 PR.
- **Persistência local vs shared:** F-006 + F-012 — ADR-023 + 1 PR.
- **IPC inconsistency:** F-013 + F-014 — ADR-024 + 1 PR.
- **Test infra subdimensionada:** F-018 + F-019 — 1 PR (vitest config +
  App.test.tsx do Agent).

---

## Sessões anteriores que adicionaram entradas aqui

- **2026-05-27** — Sessão de correções pós-auditoria W1 (Caminho 2). 20 findings
  DEFERRED inseridos. Ver `AUDIT_W1_pre_W2.md` seção "Histórico de correções"
  para detalhe do que foi resolvido.
