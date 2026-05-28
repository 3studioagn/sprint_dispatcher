---
'sprint-operator-agent': minor
---

fix(C3): canvas transparentes na pill + overlay (Sessão 25)

3 issues reportadas por Renan após teste visual da Sessão 24:

(1) **Pill com retângulo dark em volta** — `ThemeProvider.module.css` do ui-kit
aplica `background: var(--sprint-color-background)` no `.themeProvider` div,
pintando o canvas 340×160 do BrowserWindow do pill mesmo com
`body.pill-mode { background: transparent }`. Fix: PillApp passa
`className="transparent-theme"` ao ThemeProvider; `global.css` define
`.transparent-theme { background: transparent }`. Specificity vence porque
`global.css` é carregado APÓS `@sprint/ui-kit/styles.css` (ver main.tsx ordem de
imports).

(2) **Overlay com backdrop dark cobrindo a tela inteira** — Renan quer que
apenas o card central apareça; apps abaixo permaneçam visíveis ao redor. Fix:

- `overlayService` adiciona `transparent: true` no BrowserWindow.
- `App.tsx` passa `className="overlay-transparent-theme"` ao ThemeProvider.
- `global.css`:
  `.overlay-transparent-theme { background: transparent; --sprint-color-backdrop: transparent }`
  — o override de `--sprint-color-backdrop` no escopo da div propaga para o
  `.overlay` div do ui-kit que usa `var(--sprint-color-backdrop)`, zerando o
  backdrop em vez do default `rgba(0,0,0,0.3)`.

(3) **Capacidade de mover pill horizontalmente** — `<Pill>` ganha prop
`position` no ui-kit (mudança propagada via @sprint/ui-kit minor release).
PillApp pode passar `'left' | 'center' | 'right' | number`. Por ora hardcoded
`'center'`; UI/config para customizar fica em W3.

**Bônus — animações fluidas e imersivas** (mudança em @sprint/ui-kit):

- Overlay card: entrance fade + slide + scale (cubic-bezier expo)
- Overlay botão "Recebi": pulse sutil infinito no glow
- Pill: entrance slide + fade + transitions compact↔expanded com cubic-bezier
  spring (overshoot pequeno)
- Todos respeitam `prefers-reduced-motion`

`.pill-positioner` no global.css ajustado para `position: relative` (contexto de
positioner absoluto) em vez de `flex` — necessário pelo novo padrão da `<Pill>`.

Total Agent: 283 testes verdes. Lint + type-check + build clean.
