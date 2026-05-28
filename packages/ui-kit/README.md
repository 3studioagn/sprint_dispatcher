# @sprint/ui-kit

Design system interno do **Sprint Dispatcher**: componentes React, design tokens
e theme provider compartilhados entre o **Operator Agent** (consumidor a partir
da Wave 2 via BL-C3-015) e o **Leader** (consumidor em wave futura).

> Quarto package compartilhado do monorepo, junto a `@sprint/contracts`,
> `@sprint/fs-adapter` e `@sprint/logger`. Segue o mesmo padrão de versionamento
> independente via Changesets.

## Status

**Conteúdo completo** — pronto para consumo pelo Operator Agent (BL-C3-015).
Wave 2 / Sessão BL-C9-completo.

| Item      | Status                                                             |
| --------- | ------------------------------------------------------------------ |
| BL-C9-001 | ✅ Scaffold do package                                             |
| BL-C9-002 | ✅ Design tokens DARK extraídos da imagem ARTFLEXÍVEIS             |
| BL-C9-003 | ✅ `<Overlay>` (header + body slot + botão "Recebido" com glow)    |
| BL-C9-004 | ✅ `<TextBlock>` com sanitização defensiva                         |
| BL-C9-005 | ✅ `<ThemeProvider>` + CSS reset                                   |
| BL-C9-006 | ✅ `<OverlayMinimized>` pill compacto (NOVO — aprovado pelo Renan) |
| BL-C8-008 | ⏳ Testes unitários ≥ 85% (sessão dedicada)                        |

## Comandos

```bash
pnpm --filter @sprint/ui-kit build       # gera dist/ (index.js + index.d.ts + tokens.css)
pnpm --filter @sprint/ui-kit dev         # watch mode
pnpm --filter @sprint/ui-kit test        # 31 smoke tests (jsdom + Testing Library)
pnpm --filter @sprint/ui-kit type-check  # tsc --noEmit
```

## Entradas públicas

- **Componentes:** `<Overlay>`, `<OverlayMinimized>`, `<TextBlock>`
- **Theme:** `<ThemeProvider>`
- **Tipos:** `OverlayProps`, `OverlayVariant`, `OverlayMinimizedProps`,
  `OverlayMinimizedVariant`, `TextBlockProps`, `ThemeProviderProps`
- **CSS subpath:** `import '@sprint/ui-kit/tokens.css'`

## Exemplo de uso

```tsx
import {
  ThemeProvider,
  Overlay,
  OverlayMinimized,
  TextBlock,
} from '@sprint/ui-kit';
// tokens.css é importado automaticamente pelo ThemeProvider

function App() {
  const [minimized, setMinimized] = useState(false);
  const handleAck = () => console.log('acknowledged');

  return (
    <ThemeProvider>
      {minimized ? (
        <OverlayMinimized
          label="Suas metas"
          value={20}
          onClick={() => setMinimized(false)}
        />
      ) : (
        <Overlay
          title="Hora do Rush!"
          body={<TextBlock bodyHtml="Sua meta hoje é <b>20 artes</b>" />}
          onAcknowledge={handleAck}
          autoCloseSeconds={5}
        />
      )}
    </ThemeProvider>
  );
}
```

## Convenções

- **Tokens com prefixo `--sprint-`** — zero hex hardcoded nos `.module.css` de
  componentes. Toda cor, espaçamento, sombra, radius e tipografia vem de
  `var(--sprint-*)`.
- **Tema DARK** — paleta extraída diretamente da imagem 'Hora do Rush!' anexada
  à sessão de implementação. Identidade ARTFLEXÍVEIS: card `#1A1A1A` + accent
  laranja warm `#F5A557`.
- **CSS Modules** para styling de componentes (`.module.css` ao lado do `.tsx`).
- **Sem `window`, `document`, `process`, `electron`, `fs` em componentes** —
  apenas React + DOM via JSX. Window management (alwaysOnTop, fullscreen) fica
  nos apps consumidores.
- **Defesa em profundidade** no `<TextBlock>` — chama `sanitizeBodyHtml` mesmo
  que produtor já tenha sanitizado.

Referências: backlog v1.1 §6/C9; `DECISIONS.md` "Nota técnica — BL-C9-001 a 006"
para decisões internas. ADRs formais sobre o C9 (ADR-022 adoção do C9, ADR-023
não adoção de Storybook v1.0) chegam em BL-C7-008 e BL-C7-009.
