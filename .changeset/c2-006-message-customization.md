---
'sprint-leader': minor
---

feat(C2): customização de título do aviso via input inline [BL-C2-006]

Adiciona um input simples no header da NovaSprint para o líder digitar um título
curto opcional. O input fica entre o H1 "Escolher pessoas para rodada de metas"
e o grupo de ações (deadline + botão "Disparar evento"), aproveitando o espaço
vazio da banner.

Renderer:

- `useSprintComposerStore` ganha `setTitle` action. Default `'É hora de correr'`
  (= default do Agent).
- `composerFormSchema` valida `title` em [1..80] caracteres. Vazio bloqueia o
  dispatch (líder precisa ou customizar ou manter o default visível).
- `<input type="text" />` inline no header, com `placeholder="Título do aviso"`,
  `maxLength={80}` e `aria-label="Título do aviso"`. Flex layout: input cresce
  até 420px, header em `flex-wrap` para telas estreitas.

Main process:

- `DispatchSprintRequest` ganha `title?: string` opcional. Vazio ou ausente →
  main usa o default.
- `DispatchService.resolveTitle(requestTitle?)` exportado: trim + fallback
  default. `dispatch()` usa o resolvido. `substituteMeta` + `sanitizeBodyHtml`
  permanecem no pipeline final.
- O **corpo do aviso (`body_html`) permanece com o template fixo do sistema** —
  não é customizável (decisão UX: simplicidade no composer
  - consistência visual nos overlays dos operadores).

Testes: 14 novos (5 resolveTitle + 5 dispatch custom + 4 composer + ajustes em
selectIsValid/Payload/DispatchRequest).
