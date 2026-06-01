---
'@sprint/ui-kit': minor
---

feat(C9): <OverlayMinimized> pill compacto pós auto-close [BL-C9-006]

Componente NOVO (não previsto no backlog v1.1) aprovado pelo Renan via
`SCOPE_QUESTION.md` após análise da segunda imagem anexada à sessão mostrar pill
on-screen — não tray icon, como CLAUDE.md §1 sugeria.

Replica o design da imagem "minimizada" — pill horizontal dark com ícone check
pontilhado laranja, label muted ("Suas metas") e valor branco bold ("20") em
sequência inline.

Props:

- `label: string` — label muted exibido antes do valor
- `value: string | number` — valor destacado
- `onClick: () => void` — host decide o que fazer (reabrir Overlay, ack direto,
  etc)
- `variant?: 'default' | 'urgent'` — urgent reservado

Decisões arquiteturais (confirmadas por Renan via AskUserQuestion):

- **Sem prop `icon`** — SVG check pontilhado fixo (identidade canônica)
- **Sem positioning CSS** — host (Agent em BL-C3-017) decide via `BrowserWindow`
  frameless+topmost ou portal fixed
- Componente renderiza só o pill; localização na tela é do consumidor

Acessibilidade: `aria-label` composto + SVG `aria-hidden`.
