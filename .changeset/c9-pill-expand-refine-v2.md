---
'@sprint/ui-kit': minor
---

feat(C9): refino fino da animação compact ↔ expanded do Pill (Sessão 27)

Renan reportou que mesmo após Sessão 26 a animação ainda estava "tosca" e o
crescimento horizontal estava "bem de leve". Refino fino:

**Easing — curva iOS canônica:**

`cubic-bezier(0.32, 0.72, 0, 1)` (era `cubic-bezier(0.16, 1, 0.3, 1)` ease-out
expo). Curva referência do Tobias Ahlin para iOS — decelera ainda mais
suavemente, percepção "natural" sem nenhum jerk ou overshoot. Aplicada em ambas
as transitions (`.pill`) e na content emerge animation
(`.compactLayout`/`.expandedLayout`).

**Duração mais "considerada":**

- Container transition: 360ms → 480ms.
- Content emerge: 280ms → 360ms.

**Crescimento horizontal mais pronunciado:**

`.pill--expanded` min-width 220px → 280px e padding horizontal aumentado de
`--sprint-space-5` (20px) para `--sprint-space-6` (24px). Renan queria sentir o
crescimento lateral mais visível.

**Stagger no content emerge:**

`.expandedLayout` ganha `animation-delay: 80ms` — dá ao container tempo de
iniciar o crescimento ANTES do conteúdo preencher. Resultado: "container abre,
depois conteúdo emerge" em vez de "ambos saltam ao mesmo tempo".
`.compactLayout` permanece sem delay (compress feedback deve ser imediato).

**Feedback tátil no click:**

`.pill:active { transform: scale(0.97) }` + transition transform 140ms ease-out.
Operador percebe haptic visual quando pressiona — pill encolhe brevemente.
Combina com a animação principal sem interferir (transform é separado de
padding/min-width).

**Otimização de compositing:**

`will-change: padding, min-width` no `.pill` promove a layer GPU durante
transição, resultando em animação mais suave em dispositivos intermediários.

**Content emerge keyframe atualizado:**

translateY 4px → 6px (mais movimento de entrada).

Respeita `prefers-reduced-motion: reduce` — animation, transition, will-change e
`:active` scale todos desligados.

Total ui-kit: 60 testes estáveis (mudanças cobertas pela suite existente; CSS
não tem testes específicos de timing).
