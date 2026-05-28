---
'sprint-leader': minor
---

feat(C2): customização de título e corpo do aviso com preview [BL-C2-006]

Adiciona ao composer da NovaSprint dois campos opcionais — título e corpo
(template HTML com placeholder `{meta}`) — e um preview do aviso final
renderizado, espelhando o pipeline real do `DispatchService`.

Renderer:

- `useSprintComposerStore` ganha `setTitle`/`setBody`; `selectFormPayload` e
  `selectDispatchRequest` propagam title + body para o IPC.
- `composerFormSchema` agora valida `title` (1..80) e `body` (max 500); body
  vazio é permitido (= "use default").
- `<MessageCustomizer />`: input título + textarea corpo + preview com `{meta}`
  substituído pela primeira meta selecionada (ou 0 com hint se nenhum operador).
  Preview HTML sanitizado pelo mesmo `sanitizeBodyHtml` de contracts (defesa em
  profundidade contra XSS).
- Integrado em `NovaSprint` logo abaixo da listSection.

Main process:

- `DispatchSprintRequest` ganha `title?` e `body_template?` opcionais.
- `DispatchService.dispatch` resolve via `resolveTitle`/`resolveBodyTemplate`
  (trim + fallback para defaults). `substituteMeta` + `sanitizeBodyHtml`
  permanecem no pipeline final.

Testes: 38 novos. Total Leader: 210 → 248.
