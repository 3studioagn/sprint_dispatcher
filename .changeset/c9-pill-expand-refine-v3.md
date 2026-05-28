---
'@sprint/ui-kit': minor
---

feat(C9): animação smooth + layout refinado do Pill (Sessão 29)

Renan reportou após Sessão 28 (curva luxe + stagger 140ms) que a animação seguia
"travada", com sensação "primeiro cresce pra baixo, depois pro lado levemente".
Também pediu refino do layout compact (mais largo + menos alto) e expanded
(matching imagem 2 — "20 Artes" em linha) + cor preto puro.

**Animação smooth (single-rate, sem stagger):**

- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard, "fast out, slow
  in") substitui curva luxe `(0.19, 1, 0.22, 1)`. Sem plateau extremo — acelera
  natural no início, desacelera natural no fim.
- Duração: 480ms no container (era 620ms); 280ms no content emerge (era 460ms).
- **Sem stagger** — `.expandedLayout` `animation-delay` 140ms → 0ms. Container e
  conteúdo crescem em paralelo, sem ordem perceptível.
- Keyframe `pill-content-emerge` translateY 8px → 4px (sutil).

**Layout compact (mais largo, menos alto):**

- `.pill--compact` padding `space-3 / space-5` → `space-2 / space-6` (12/20 →
  8/24px). Vertical menor (badge mais baixa), horizontal maior (badge mais larga
  lateralmente).

**Layout expanded (matching imagem 2):**

- `.pill--expanded` padding `space-4 / space-6 / space-5` →
  `space-3 / space-6 / space-4` (16/24/20 → 12/24/16). Menos altura total; badge
  mais horizontal.
- `min-width` 280px → 320px.
- `.metricGroup` `flex-direction: column` → `row` com `align-items: baseline`.
  "20" + "Artes" em linha (não empilhados), alinhados pela base do número.
- `.unit` sem `margin-top` (gap do flex cobre o espaço horizontal).
- `.expandedLayout` `gap` `space-4` → `space-3` (mais compacto).

**Cor preto puro:**

- `.pill` background `--sprint-color-background` (#1A1A1A) →
  `--sprint-color-background-deep` (#000000, novo token semântico em
  `tokens.css`). Máximo contraste sobre o backdrop translúcido.

Total ui-kit: 60 testes verdes (mudanças cobertas pela suite existente).
