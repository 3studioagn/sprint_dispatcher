import type { ReactNode } from 'react';

import '../../tokens/tokens.css';
import '../reset.css';
import styles from './ThemeProvider.module.css';

export interface ThemeProviderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Aplica os design tokens (`@sprint/ui-kit/tokens.css`) e o CSS reset
 * mínimo no escopo dos `children`.
 *
 * Sem Context API — tokens propagam por cascata CSS. Múltiplas
 * instâncias aninhadas são idempotentes (CSS variables resolvem na
 * cadeia de herança natural).
 *
 * Uso típico (no root do renderer do Operator Agent — BL-C3-015):
 *
 * ```tsx
 * import { ThemeProvider } from '@sprint/ui-kit';
 *
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <Overlay title="..." body="..." onAcknowledge={...} />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({ children, className }: ThemeProviderProps) {
  const composedClassName = className
    ? `${styles.themeProvider} ${className}`
    : styles.themeProvider;

  return <div className={composedClassName}>{children}</div>;
}
