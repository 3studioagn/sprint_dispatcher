---
'sprint-operator-agent': minor
---

feat(C3): redesign pill — sem bar, expand inline, sem reabrir overlay

Pós-validação Renan (Sessão 24): comportamento e visual do pill redesenhados
conforme imagens entregues.

**Mudança visual:**

Pill agora é standalone (sem a bar full-width dark atrás) — apenas a própria
badge pendurada do topo da tela centralizada. BrowserWindow encolhe de
full-screen-width × 100px → 340 × 160px transparent, top- center. Áreas vazias
do canvas são transparentes; apps abaixo permanecem visíveis e clicáveis fora da
pill.

**Mudança comportamental:**

Click no pill NÃO reabre mais overlay fullscreen. Em vez disso, alterna entre
modo compact (linha única) e expanded (grid 2×2 com métrica, "Até: HH:MMh",
"Suas metas", data badge) puramente local no renderer. Após 5s em expanded sem
novo click, auto-colapsa. Overlay fullscreen aparece APENAS em dispatch novo via
polling.

Elimina o bug "não consigo fechar a overlay novamente" reportado pelo Renan —
não há mais loop loading=true preso porque pill não chama `closeReopened` IPC.
State machine simplificada.

**API IPC removida (breaking dentro do Agent, sem release público):**

- `Api.pill.expand` removido
- `ipcMain.handle('pill:expand', ...)` removido
- `pillService.hideWindow()` / `showWindow()` / `getFullPayload()` removidos
  (split temporário da Sessão 23 não precisa mais existir)
- `pillService` API simplificada: `show(payload)` / `dismiss()` / `hide()`
  (alias) / `getCurrent()` / `isShown()` / `destroy()`

**API IPC mantida:**

- `Api.pill.requestCurrent` (pull no mount)
- `Api.pill.onUpdate` (push para troca de sprint)
- `pill:request-current` handler

**PillCurrentInfo** ganha campo `deadline_at` (ISO-8601) — renderer formata para
"HH:MMh" no expanded.

**Wires simplificados em main/index.ts:**

- `overlay:close-reopened` handler não chama mais `pillService. showWindow()`
  (pill não foi escondida no click).
- `handleReopenLast` (tray) não chama mais `pillService.hideWindow()` — pill
  permanece visível atrás do overlay durante reopen via tray (mesmo z-level
  screen-saver; pill ocupa só topo 160px).

**PillApp.tsx:**

Usa `<Pill>` do `@sprint/ui-kit` com `useState(isExpanded)` local. Click toggla.
`useEffect` agenda `setTimeout(5000)` quando expanded vira true; cleanup cancela
timer em (a) re-expand cancelado, (b) componente desmonta, (c) info muda via
push (nova sprint reseta para compact). Helpers `formatDeadline` (HH:MMh) +
`formatDate` (DD/MM).

**global.css:** adiciona `.pill-positioner` para centralizar a `<Pill>` no top
do canvas do BrowserWindow do pill.

Tests:

- pillService.test.ts: -3 (removido hideWindow/showWindow split block da Sessão
  23; getFullPayload references), +1 (currentInfo inclui deadline_at). Dimensões
  window atualizadas (340×160 vs 1920×100).
- PillApp.test.tsx: redesigned — sem mais testes de pill.expand IPC, toggle
  local, auto-collapse via fake timers com shouldAdvanceTime, push reseta
  expanded.
- test-setup.ts: removido mock de `pill.expand`.

Total Agent: 283 testes (consistente com sessão anterior; -3 deletados +3 novos
cobrindo redesign).
