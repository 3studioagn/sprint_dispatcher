---
'@sprint/ui-kit': minor
---

feat(C9): <Overlay> reutilizável replicando design ARTFLEXÍVEIS [BL-C9-003]

Componente React que renderiza a estrutura visual completa do aviso de sprint
conforme imagem 'Hora do Rush!' anexada à sessão. Card dark centralizado com
header (título), body slot (preenchido pelo host) e botão de acknowledge laranja
com glow expressivo.

Props:

- `title: string` — header centralizado
- `body: ReactNode | string` — slot preenchido pelo Agent (BL-C3-015) com
  conteúdo estruturado (métrica, deadline, status row)
- `onAcknowledge: () => void`
- `acknowledgeLabel?: string` — default `'Recebido'` (matching design)
- `autoCloseSeconds?: number` — default 5, `<= 0` desabilita
- `variant?: 'default' | 'urgent'` — urgent reservado (CSS placeholder)

Comportamento:

- `autoCloseSeconds > 0` dispara `onAcknowledge` após timeout (cleanup)
- Click no botão também dispara `onAcknowledge` imediatamente
- `role='alertdialog'` + `aria-modal` + `aria-labelledby` para a11y
- 100% testável em jsdom (zero dependência de window management)

Styling exclusivamente via tokens `--sprint-*` (zero hex hardcoded).
