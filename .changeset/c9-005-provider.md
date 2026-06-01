---
'@sprint/ui-kit': minor
---

feat(C9): <ThemeProvider> e CSS reset [BL-C9-005]

- `reset.css`: CSS reset mínimo (box-sizing, zera margin/padding em elementos
  comuns, herda font em form controls, antialiasing). NÃO toca em
  font-family/color/background — esses ficam no `.module.css` do ThemeProvider
  para serem rastreáveis via tokens.
- `<ThemeProvider>`: wrapper React que importa tokens.css + reset.css e aplica
  font-family + color + background base via `.module.css`.
  - Prop `className` opcional para composição
  - Sem Context API — design tokens propagam via cascata CSS
  - Múltiplas instâncias aninhadas são idempotentes
- `src/css.d.ts`: declarações de tipo para CSS Modules (`*.module.css`) e
  side-effect imports (`*.css`).
