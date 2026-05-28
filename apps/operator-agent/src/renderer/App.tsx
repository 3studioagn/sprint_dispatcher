/**
 * App root do renderer do overlay.
 *
 * Em Gate 2 era placeholder de smoke do bridge. Em Gate 4 virou o overlay
 * real: assina pushes de sprint:incoming + queue:updated e renderiza
 * `<Overlay />`. Hooks gerenciam ciclo de vida das subscrições IPC.
 *
 * **BL-C3-015/016 (W2):** `<ThemeProvider>` do `@sprint/ui-kit` envolve
 * o overlay — importa `tokens.css` (`--sprint-*`) + reset CSS via cascata.
 * Tokens locais (`--color-*`, `--space-*`) em `styles/global.css` ainda
 * presentes como fallback; migração progressiva em BL-C3-016.
 *
 * **A janela só é criada pelo main quando uma sprint chega** (`queueService
 * .onNextSprint` → `overlayService.showSprint`). Em browser regular (fora do
 * Electron) `window.api` é `undefined` — o renderer falha de forma
 * defensiva, mas é cenário não-produção.
 */

import { ThemeProvider } from '@sprint/ui-kit';

import { Overlay } from './components/Overlay';
import { useIncomingSprint } from './hooks/useIncomingSprint';
import { useQueueUpdated } from './hooks/useQueueUpdated';
import { useCurrentSprintStore } from './stores';

export default function App(): JSX.Element {
  useIncomingSprint();
  useQueueUpdated();
  const sprint = useCurrentSprintStore((s) => s.sprint);

  // key={sprint_id ?? 'idle'} força remount do <Overlay> quando a sprint
  // troca via push sprint:incoming — reseta loading/error/warning sem
  // useEffect/cleanup manual (padrão estabelecido no W1 + ADR-024).
  return (
    <ThemeProvider>
      <Overlay key={sprint?.sprint_id ?? 'idle'} />
    </ThemeProvider>
  );
}
