# @sprint/ui-kit

Design system interno do **Sprint Dispatcher**: componentes React, design tokens
e theme provider compartilhados entre o **Operator Agent** (consumidor a partir
da Wave 2 via BL-C3-015) e o **Leader** (consumidor em wave futura).

> Quarto package compartilhado do monorepo, junto a `@sprint/contracts`,
> `@sprint/fs-adapter` e `@sprint/logger`.

## Status

Em construção (sessão BL-C9-completo da Wave 2). Substitua este README pela
versão final após a Fase 7.

| Item      | Status                                                       |
| --------- | ------------------------------------------------------------ |
| BL-C9-001 | 🔄 Scaffold (Fase 1)                                         |
| BL-C9-002 | ⏸️ Design tokens (Fase 2)                                    |
| BL-C9-003 | ⏸️ `<Overlay>` (Fase 4)                                      |
| BL-C9-004 | ⏸️ `<TextBlock>` (Fase 5)                                    |
| BL-C9-005 | ⏸️ `<ThemeProvider>` + reset (Fase 3)                        |
| BL-C9-006 | ⏸️ `<OverlayMinimized>` (Fase 6 — NOVO, aprovado pelo Renan) |

## Comandos

```bash
pnpm --filter @sprint/ui-kit build       # vite build → dist/
pnpm --filter @sprint/ui-kit dev         # watch mode
pnpm --filter @sprint/ui-kit test        # vitest run (jsdom)
pnpm --filter @sprint/ui-kit type-check  # tsc --noEmit
```
