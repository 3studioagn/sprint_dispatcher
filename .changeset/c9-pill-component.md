---
'@sprint/ui-kit': minor
---

feat(C9): novo componente `<Pill>` standalone (sem bar full-width)

Adiciona `<Pill>` em `packages/ui-kit/src/components/Pill/` — badge informativa
standalone que ancora no topo da tela do operador (Operator Agent BL-C3-017+).
Substitui o uso de `<OverlayMinimized>` no Agent — sem a bar full-width atrás da
badge; só a própria pill.

Modos: compact (linha única com check + label + value) e expanded (grid 2×2 com
métrica grande + unidade + "Até: HH:MMh" + label muted

- data badge). Transição compact ↔ expanded animada via CSS (padding/min-width
  transitions 250ms). Componente é stateless quanto ao modo — host (Agent
  PillApp) controla via state local + auto-collapse após N segundos.

Props: `label`, `value`, `unit?`, `deadline?`, `date?`, `expanded?`, `onClick?`,
`variant?`. Acessibilidade: `aria-label` legível + `aria-expanded` reflete
modo + `data-mode` para inspeção em testes.

Cantos inferiores arredondados, topo reto — continuidade visual com o limite do
monitor. Sombra projeta para baixo destacando a saliência. Magnitudes via tokens
`--sprint-*` (zero hardcoded fora de tokens).

`<OverlayMinimized>` permanece exported para retrocompat (não está em uso em
produção; cobertura mantida).

+14 testes em `Pill.test.tsx` cobrindo compact/expanded rendering, click
handler, aria-label com/sem unit, omissão condicional de deadline/date,
aria-expanded reflete prop, variant urgent placeholder.
