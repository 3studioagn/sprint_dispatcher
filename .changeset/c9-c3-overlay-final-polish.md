---
'@sprint/ui-kit': minor
'sprint-operator-agent': minor
---

fix(C9,C3): polish final do overlay matching design-alvo (Sessão 34)

Renan: "Apenas ajuste os detalhes para ficar igual à imagem... border radius,
peso de fonte, espaçamento e tudo mais. Deixe exatamente igual para eu não
precisar mexer e está aprovado." Ajustes finos:

**`@sprint/ui-kit` · `<Overlay>`:**

- **`.title` font-weight** `regular` (400) → `medium` (500). Title "Hora do
  Rush!" com presença visual mais firme matching design.
- **`.header` padding vertical** `space-5` (20px) → `space-4` (16px). Header bar
  mais fina, matching proporção do design.
- **`.acknowledgeButton` font-weight** `semibold` → `bold` (700). Peso firme do
  call-to-action "Recebido" matching design.

**`sprint-operator-agent` · body slot:**

- **`.metricGroup` gap** `space-3` (12px) → `space-4` (16px). Mais respiração
  entre o número gigante "20" e a unidade "Artes".
- **`.dateBadge`** mais compacto: font `base` (16) → `sm` (14); padding
  `space-2/space-4` (8/16) → `space-1/space-3` (4/12). Badge "27/05" matching
  tamanho do design.

Tests: 60 verdes no ui-kit + 298 verdes no Agent (estável; CSS visual não afeta
tests funcionais).
