---
'@sprint/ui-kit': minor
---

feat(C9): Pill com pointer events props + refino de animações

**Pointer events (Sessão 26):**

`<Pill>` aceita novas props `onPointerDown`/`onPointerMove`/`onPointerUp`/
`onPointerCancel` no botão para hosts que implementam drag custom. Pattern
necessário porque drag requer distinguir click puro (sem movimento) de drag real
(movimento > threshold) — onClick não é suficiente.

`touch-action: none` adicionado no `.pill` para que o browser não interfira com
gestos default (scroll, zoom, etc.) durante drag — host controla 100% do gesto.

**Refino de animação compact ↔ expanded (Sessão 26):**

Substitui transition spring `cubic-bezier(0.34, 1.4, 0.64, 1)` (com overshoot —
sensação bouncy "tosca") por `cubic-bezier(0.16, 1, 0.3, 1)` "ease-out expo" —
desacelera suavemente sem overshoot, percepção mais "considerada" e refinada.
Duração 320ms → 360ms (mais "considerada").

Adiciona content fade-in animation no `.compactLayout` e `.expandedLayout` —
quando React desmonta CompactContent e monta ExpandedContent (ou vice-versa), o
novo conteúdo entra com 280ms fade + slide pequeno (translateY 4px → 0) em vez
de aparecer instant. Combina com a size transition do container para sensação
contínua sem "pop" abrupto.

Respeita `prefers-reduced-motion: reduce` (animação e transition desligadas).

**Fix `.label` quebra de linha:**

Adiciona `white-space: nowrap` em `.label` — Renan reportou "Suas metas"
quebrando em duas linhas no compact ("Suas / metas"). Pill agora cresce
horizontalmente conforme necessário; min-width:0 no `.pill--compact` não impede
o conteúdo de empurrar.
