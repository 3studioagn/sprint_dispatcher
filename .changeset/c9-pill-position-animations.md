---
'@sprint/ui-kit': minor
---

feat(C9): Pill com prop position + animações fluidas + entrance no Overlay

**Pill — prop position (Sessão 25):**

Aceita `'left' | 'center' | 'right' | number` (0-100 percent). Pill é
posicionada absolutamente dentro do container do host via `left: N%`

- `translateX(-N%)` (mesmo padrão do `<OverlayMinimized>`). Default `'center'`.

Pill DOM agora é estruturada em 3 spans aninhados:

- `.pillPositioner` (outer) — recebe inline style com position absoluta e
  percentual horizontal
- `.pillEntrance` (middle) — owns a animação de entrance (slide do topo + fade);
  separada para não conflitar com transform inline do positioner
- `.pill` (button) — corpo clicável com transitions compact ↔ expanded

**Animações fluidas (Sessão 25):**

- `<Overlay>` `.card`: entrance animation `overlay-card-enter` 420ms
  cubic-bezier(0.16, 1, 0.3, 1) — fade + slide do topo + slight scale (0.96 →
  1).
- `<Overlay>` `.acknowledgeButton`: pulse infinito 2400ms `ack-button-pulse` no
  glow do shadow — chama atenção sutil sem ser intrusivo (60% do ciclo no estado
  base).
- `<Pill>` `.pillEntrance`: animation `pill-enter` 480ms cubic-bezier(0.16, 1,
  0.3, 1) — slide do topo + fade quando aparece.
- `<Pill>` `.pill`: transitions compact ↔ expanded com cubic-bezier (0.34, 1.4,
  0.64, 1) — overshoot pequeno = sensação spring imersiva mas sem exagero.
  Duração 320ms (era 250ms ease-in-out).

Todas as animações respeitam `@media (prefers-reduced-motion: reduce)` —
desligam para usuários com setting de redução de movimento.

+7 testes em `Pill.test.tsx` cobrindo prop position (default center, left/right
strings, number, clamp -10/150, NaN fallback). Total ui-kit: 53 → 60 testes.
