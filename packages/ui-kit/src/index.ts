/**
 * @sprint/ui-kit — Sprint Dispatcher Design System
 *
 * Componentes React, design tokens e theme provider compartilhados
 * entre Operator Agent (consumidor a partir de BL-C3-015) e Leader
 * (consumidor em wave futura).
 *
 * Entradas públicas:
 *   - Componentes: <Overlay>, <OverlayMinimized>, <TextBlock>
 *   - Theme: <ThemeProvider>
 *   - Tipos: OverlayProps/Variant, OverlayMinimizedProps/Variant,
 *     TextBlockProps, ThemeProviderProps
 *   - CSS subpath: import '@sprint/ui-kit/tokens.css'
 *
 * Veja DECISIONS.md "Nota técnica — C9 (BL-C9-001 a 006)" para
 * decisões internas. ADRs formais sobre o C9 (adoção do package,
 * não adoção de Storybook na v1.0) chegam em BL-C7-008 e BL-C7-009
 * — registrados como ADR-022 e ADR-023 quando forem criados.
 */

export { Overlay, OverlayMinimized, Pill, TextBlock } from './components';
export type {
  OverlayProps,
  OverlayVariant,
  OverlayMinimizedProps,
  OverlayMinimizedPosition,
  OverlayMinimizedVariant,
  PillProps,
  PillPosition,
  PillVariant,
  TextBlockProps,
} from './components';

export { ThemeProvider } from './theme';
export type { ThemeProviderProps } from './theme';

export const UI_KIT_PACKAGE_VERSION = '0.0.0' as const;
