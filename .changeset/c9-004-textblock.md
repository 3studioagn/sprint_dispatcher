---
'@sprint/ui-kit': minor
---

feat(C9): <TextBlock> com sanitização defensiva [BL-C9-004]

Componente React que recebe `body_html` (string) e renderiza com tipografia
consistente do design system.

Defesa em profundidade (CLAUDE.md §7.9, RF-17, RN-10):

- Chama `sanitizeBodyHtml` de `@sprint/contracts` em todo render, mesmo que o
  produtor (Leader em BL-C1-004) já tenha sanitizado.
- `sanitizeBodyHtml` é idempotente (ADR-014) — re-render não muta DOM.
- Renderiza via `dangerouslySetInnerHTML` após sanitização imediata.

Tipografia:

- Tags whitelistadas (`b`, `i`, `br`, `p`, `h1`, `span`) recebem styling do
  design system via seletores aninhados no `.module.css`.

Adiciona `@sprint/contracts` como dependency workspace do `@sprint/ui-kit`
(primeira ligação inter-package partindo de C9).
