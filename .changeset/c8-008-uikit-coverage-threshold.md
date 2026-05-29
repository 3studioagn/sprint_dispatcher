---
'@sprint/ui-kit': patch
---

test(C8): enforçar threshold de coverage ≥85% no @sprint/ui-kit [BL-C8-008]

Materializa `coverage.thresholds` no `packages/ui-kit/vitest.config.ts`
(lines/functions/statements ≥ 85, branches ≥ 80), substituindo o TODO que
deixava o threshold desligado. Fecha o DoD do BL-C8-008 ("falha de cobertura
abaixo de 85% bloqueia merge") na parte do ui-kit.

Acompanha um teste de `<TextBlock>` exercitando o ramo `className` fornecido
(antes 50% de branch coverage no arquivo), fechando o gap AUD-W2-012. Cobertura
real do ui-kit após a mudança: 99.41% stmts / 96.96% branch / 100% funcs /
99.41% lines — passa os thresholds com folga.

O enforcement em CI (rodar `pnpm test:coverage` no lugar de `pnpm test`)
acompanha como mudança de infra do CI — não-publicável, sem changeset próprio.

Refs: docs/audits/W2-AUDIT-2026-05-29.md (AUD-W2-001, AUD-W2-012)
