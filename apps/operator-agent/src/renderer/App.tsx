/**
 * App root do renderer do overlay.
 *
 * Em Gate 2 era placeholder de smoke do bridge. Em Gate 4 vira o overlay
 * real: assina pushes de sprint:incoming + queue:updated e renderiza
 * `<Overlay />`. Hooks gerenciam ciclo de vida das subscrições IPC.
 *
 * **A janela só é criada pelo main quando uma sprint chega** (`queueService
 * .onNextSprint` → `overlayService.showSprint`). Em browser regular (fora do
 * Electron) `window.api` é `undefined` — o renderer falha de forma
 * defensiva, mas é cenário não-produção.
 */

import { Overlay } from './components/Overlay';
import { useIncomingSprint } from './hooks/useIncomingSprint';
import { useQueueUpdated } from './hooks/useQueueUpdated';

export default function App(): JSX.Element {
  useIncomingSprint();
  useQueueUpdated();
  return <Overlay />;
}
