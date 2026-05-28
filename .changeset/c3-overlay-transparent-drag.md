---
'sprint-operator-agent': minor
---

fix(C3): overlay realmente transparente + drag horizontal do pill (Sessão 26)

4 issues reportadas por Renan após validar Sessão 25:

**(1) Overlay ainda com fundo dark:** Sessão 25 adicionou `transparent: true` no
BrowserWindow + ThemeProvider override, mas o `body` continuava com
`background: var(--sprint-color-background)` (dark) que cobria a transparência.
Fix:

- `main.tsx` adiciona `body.overlay-mode` (paralelo ao `body.pill-mode`) para o
  overlay window
- `global.css` `body.overlay-mode { background: transparent }` (regra combinada
  com `body.pill-mode`)

Agora operador vê APENAS o card central do overlay; apps abaixo permanecem
visíveis ao redor.

**(2) Drag horizontal do pill:** Renan quer arrastar a pill para as laterais
como drag-and-drop, mas só horizontal. Implementado:

- `pillService` ganha `beginDrag(screenX)` / `dragTo(screenX)` / `endDrag()` /
  `isDragging()` — usa `screen.X` absoluto (não `client.X` relativo) para evitar
  feedback loop quando o window se move. Movimento clampado às bordas do display
  primário.
- IPC `pill:begin-drag`, `pill:drag-to`, `pill:end-drag`.
- `Api.pill.beginDrag/dragTo/endDrag` em ipc-types + preload.
- `PillApp.tsx` substitui `onClick` por handlers de pointer events
  (`onPointerDown`/`Move`/`Up`/`Cancel`). Threshold de 5px distingue click puro
  (sem movimento → toggle expand) de drag real (movimento
  > threshold → IPC drag, sem toggle). `setPointerCapture` garante que
  > pointermove continue chegando mesmo quando cursor sai do bounding box
  > durante drag.

**(3) "Suas metas" quebrando linha:** Renan reportou label quebrando em duas
linhas no compact ("Suas / metas"). Fix delegado ao ui-kit via
`white-space: nowrap` em `.label` do `<Pill>` (mudança propagada via
@sprint/ui-kit minor).

**(4) Animação tosca:** Spring com overshoot `cubic-bezier(0.34, 1.4, 0.64, 1)`
substituído por ease-out expo `cubic-bezier(0.16, 1, 0.3, 1)`

- content fade-in animation no `.compactLayout`/`.expandedLayout`. Sem mais
  sensação bouncy; transição refinada e considerada. Mudança no ui-kit
  (`<Pill>`).

Mudanças no test-setup:

- Mocks de `pill.beginDrag`/`dragTo`/`endDrag` adicionados.
- `setPointerCapture`/`releasePointerCapture` stubs no `beforeAll` para
  PillApp.test.tsx (jsdom não implementa nativamente — joga exception sem stub).
- Helper `firePointerEvent` em PillApp.test.tsx usa `createEvent` +
  `Object.defineProperty(event, 'screenX', ...)` porque jsdom ignora `screenX`
  no init dict do `PointerEvent`.

+14 testes:

- pillService: 8 testes drag (beginDrag captura state, dragTo clampa
  esquerda/direita, dragTo sem beginDrag no-op, endDrag limpa state, destroy
  limpa, sem janela é no-op, vários dragTo sem feedback loop).
- PillApp: 6 testes drag (pointerdown chama beginDrag com screenX, drag > 5px
  chama dragTo sem toggle, click puro toggla, < 5px é click, cancel sem toggle,
  vários moves geram múltiplos dragTo).

Total Agent: 283 → 297 tests verdes.
