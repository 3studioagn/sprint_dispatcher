---
'@sprint/ui-kit': patch
---

test(C8): cobertura unitária ≥85% dos componentes do @sprint/ui-kit [BL-C8-008]

Fecha a W2 do C9 pelo lado de QA: cobertura unitária atinge 100/100/100/100
(lines/branches/functions/statements) e os thresholds entram em vigor no
`vitest.config.ts` (≥85 lines/functions/statements, ≥80 branches). Regressão de
cobertura bloqueia merge — sanity check confirmou que vitest sai com exit 1
quando o limite não é atingido.

4 testes novos:

- `TextBlock` — composição de `className` (branch ternário) + render com
  `bodyHtml` vazio.
- `OverlayMinimized` — fallback `return 50` em `resolvePercent` quando o valor
  de `position` chega fora do tipo (cast em runtime).
- `Pill` — mesmo padrão de fallback em `resolvePillPositionPercent`.

`vitest.config.ts` ganhou `include`/`exclude` explícitos para coverage — barrels
(`index.ts`) e arquivos `.test.*` não diluem o denominador. Total de testes do
ui-kit: 60 → 64.
