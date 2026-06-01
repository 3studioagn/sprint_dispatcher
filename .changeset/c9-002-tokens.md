---
'@sprint/ui-kit': minor
---

feat(C9): design tokens DARK theme extraídos da imagem [BL-C9-002]

Tokens com prefixo `--sprint-*` extraídos da imagem 'Hora do Rush!' anexada à
sessão:

- Cores semânticas: primary (#F5A557 warm orange), variantes
  hover/active/on/glow, secondary alias da primary, success/warning/ danger
  defaults para dark
- Paleta neutra contínua: `--sprint-color-neutral-100` a `-900`
- Aliases semânticos DARK: background (#1A1A1A), surface, surface- elevated,
  border, text (white), text-muted, text-inverse, backdrop (alpha 0.3 discreto)
- Espaçamentos: escala 4px de `--sprint-space-1` a `-8`
- Tipografia: Inter + 8 sizes (xs..4xl, tier 4xl=120px reservado para meta
  gigante do Agent), 4 weights, 3 line-heights
- 3 sombras de elevação + `--sprint-shadow-primary-glow` (composição expressiva
  do botão "Recebido")
- 4 border-radii (sm/md/lg/pill — pill adicionado para badges e botões
  full-rounded)

HTML preview standalone em `packages/ui-kit/dev/palette-preview.html` para
revisão visual (não vai pro dist/).
