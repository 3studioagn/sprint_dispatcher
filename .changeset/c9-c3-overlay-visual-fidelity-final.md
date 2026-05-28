---
'@sprint/ui-kit': minor
'sprint-operator-agent': minor
---

feat(C9,C3): refino visual final do Overlay matching design-alvo

11 micro-iterações coordenadas (Sessões 35-42) sobre o redesign do Overlay
entregue na Sessão 31. Todas guiadas por screenshots do Renan contra a
imagem-alvo "Hora do Rush!". Estado final aprovado.

**ui-kit `<Overlay>`:**

- `.card` max-width 720 → 480 → 560px (proporção retangular final).
- `.body` padding: `space-8` (uniforme 32) →
  `space-7 vertical / space-10 lateral` (28/40). Mais respiração interna e
  elementos internos se aproximam horizontalmente.
- `.header` padding vertical estabilizado em `space-5` (20px).
- `.title` "É hora de correr" font-weight: `regular` → `medium` → `light` (300).
  Tipografia leve padronizada.
- `.acknowledgeButton` font-size `lg` → `xl`; font-weight `semibold` → `bold` →
  `light` (300). Permanece visualmente firme via o glow laranja, sem peso forte
  na fonte.
- Token `--sprint-color-surface-subtle` #111 → #0a0a0a — header bar sutil sobre
  body preto puro.

**Agent body slot:**

- `.metricRow` `align-items: flex-start` → `last baseline` — resolve
  desalinhamento entre "Artes" (baseline do metricGroup) e "18:00h" (último item
  da deadlineGroup column) que `flex-end` não conseguia por causa do gap entre
  baseline e bottom da box do `.valueBig` 4xl com line-height tight.
- `.deadlineGroup`: column flex-end → flex-start. "Até" alinhado pela esquerda
  do bloco direito, matching design.
- `.deadlineLabel` "Até" font-size: ajustado para `lg` (18px).
- `.deadlineValue` "18:00h" font-size `3xl` → `2xl`; font-weight `bold` →
  `medium`.
- `.sprintBody` gap `space-5` → `space-3` (elementos mais juntos).
- `.unit` "Artes", `.label` "Suas metas", `.deadlineLabel` "Até": padronizados
  em font-weight `light` (300).
- `.dateBadge` font `base` → `sm`; padding horizontal `space-3` → `space-4`.
- ackLabel default "Recebi" → "RECEBIDO".

**Tokens novos (em `@sprint/ui-kit/tokens.css`):**

- `--sprint-font-weight-light: 300` (com weight 300 adicionado no import do
  Inter via Google Fonts).
- `--sprint-space-9: 36px` e `--sprint-space-10: 40px` — continuação da escala
  4px para chrome generoso.

**DX / Infraestrutura:**

- `pnpm dev` na raiz funciona sem race no `dist/` do ui-kit: predev no root +
  `emptyOutDir: !isWatchMode` na config do ui-kit.

**Total testes:** 60 verdes no ui-kit + 298 verdes no Agent + 205 verdes no
Leader. Lint + type-check + builds limpos.
