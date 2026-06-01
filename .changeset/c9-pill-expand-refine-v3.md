---
'@sprint/ui-kit': minor
---

feat(C9): pill se extende linearmente em ambas dimensões (Sessão 30)

Renan reportou após Sessão 29 que a animação seguia "dando um salto, crescendo
primeiro pra baixo e depois pras laterais". Pediu animação "linear e fluida,
como se fosse um efeito de se extendendo mesmo, sem dar esse salto".

**Root cause das sessões 27-29:**

Só `padding` + `min-width` animavam. Quando o React trocava `CompactContent`
(`inline-flex row`) por `ExpandedContent` (`flex column`), o reflow do conteúdo
era INSTANTÂNEO — altura do content saltava de ~30px para ~100px no frame zero.
As propriedades CSS animadas (padding/min-width) só interpolam suas próprias
dimensões; não há como interpolar entre dois conteúdos diferentes.

**Solução: animar `max-height` também.**

- `.pill` ganha `max-height` na lista de transitions (480ms Material curve,
  mesma duração de padding/min-width).
- `.pill--compact { max-height: 56px }` — clipa o `ExpandedContent` no frame
  zero da transição compact → expanded.
- `.pill--expanded { max-height: 200px }` — generoso para acomodar o layout
  2-rows com folga.
- `overflow: hidden` no `.pill` (já existente) garante que o conteúdo excedente
  é clipado durante o crescimento.

Resultado: pill cresce em 3 dimensões simultaneamente (altura/largura/padding)
com curva Material single-rate. O `ExpandedContent` é revelado de cima pra baixo
conforme a altura cresce, sem salto.

**Mudanças pequenas auxiliares:**

- `will-change: padding, min-width, max-height` (adiciona max-height).
- Remove `animation: pill-content-emerge` de `.compactLayout` e
  `.expandedLayout` (e o keyframe) — a transição agora é puramente do container;
  conteúdo não tem entrance separada.
- Remove `@media (prefers-reduced-motion)` block para
  `.compactLayout`/`.expandedLayout` (sem animation = não precisa desligar).

Total ui-kit: 60 testes verdes (CSS de timing/layout não tem testes
específicos).
