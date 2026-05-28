---
'sprint-operator-agent': minor
---

feat(C3): aplicar identidade visual ARTFLEXÍVEIS via ThemeProvider [BL-C3-016]

Renderer consome tokens visuais exclusivamente do @sprint/ui-kit via cascata
CSS. Zero hex/px hardcoded em componentes do Agent.

Mudanças:

- styles/global.css: removidos os tokens locais (--color-_, --space-_,
  --font-size-_, --radius-_). Mantido apenas o reset essencial + body com tokens
  --sprint-\*.
- Overlay.module.css, DeadlineBadge.module.css, QueueIndicator.module.css: todos
  migrados para --sprint-\*.
- Meta value: usa --sprint-font-size-4xl (120px, tier canônico "métrica gigante"
  do C9) — antes era 160px local.
- max-width: 1200px removido do body do overlay (redundante; card do <Overlay>
  do ui-kit já limita via max-width: 720px).
- min-width: 140px removido do DeadlineBadge (largura content-driven).

Pendente: aprovação visual do Renan no PR (critério BL-C3-016 — alinhamento da
identidade visual com a marca ARTFLEXÍVEIS).
