---
'@sprint/ui-kit': minor
---

feat(C9): animação compact ↔ expanded do Pill com curva luxe (Sessão 28)

Renan pediu "algo mais smooth e mais bezier" após Sessão 27 (iOS canonical)
ainda parecer pouco fluida. Troca exclusivamente CSS no `<Pill>`:

**Easing — curva "luxe" extra-suave:**

`cubic-bezier(0.19, 1, 0.22, 1)` substitui `cubic-bezier(0.32, 0.72, 0, 1)` (iOS
canonical). Mais pronunciada visualmente: control point 1 puxa verticalmente
para o topo (0.19→1.0), criando aceleração inicial sutil + plateau de
deceleração estendido. Aplicada no `.pill` container E no content emerge
(`.compactLayout` e `.expandedLayout`).

**Duração mais "considerada":**

- Container transition: 480ms → 620ms.
- Content emerge: 360ms → 460ms.

**Stagger maior:**

`.expandedLayout` `animation-delay` 80ms → 140ms. Com container 620ms, dá mais
respiração entre o início do crescimento e a emersão do conteúdo.
`.compactLayout` segue sem delay.

**Keyframe translateY:**

`pill-content-emerge` translateY 6px → 8px. Conteúdo emerge com presença um
pouco maior.

Total ui-kit: 60 testes estáveis (mudanças cobertas pela suite existente; CSS
não tem testes específicos de timing).
