/**
 * SetupApp — root do renderer da janela de configuração inicial (`?setup`).
 *
 * Montado por `main.tsx` quando a query é `?setup` (janela criada pelo
 * `SetupWizardService` no first-run). Envolve o `<SetupWizard>` no
 * `<ThemeProvider>` do ui-kit (background opaco — diferente do overlay/pill,
 * que são transparentes).
 *
 * @see ./components/SetupWizard
 * @see DECISIONS.md ADR-028
 */

import { ThemeProvider } from '@sprint/ui-kit';

import { APP_DISPLAY_NAME } from '../shared/branding';

import { SetupWizard } from './components/SetupWizard';

export default function SetupApp(): JSX.Element {
  return (
    <ThemeProvider>
      <SetupWizard appName={APP_DISPLAY_NAME} />
    </ThemeProvider>
  );
}
