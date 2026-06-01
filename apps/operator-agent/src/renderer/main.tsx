import React from 'react';
import ReactDOM from 'react-dom/client';

// Side-effect import — Vite library mode do ui-kit extrai CSS de componentes
// para um arquivo separado. O Agent precisa importar explicitamente, senão
// tokens (--sprint-*) e classes (.overlay/.card/etc) não carregam.
// Subpath ./styles.css exposto em packages/ui-kit/package.json#exports.
import '@sprint/ui-kit/styles.css';

import App from './App';
import PillApp from './PillApp';
import SetupApp from './SetupApp';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM');
}

// O main process carrega esta mesma index.html em janelas distintas, escolhidas
// pela query string (mesma surface IPC, roots diferentes):
//   - `?pill`  → overlay minimizado (BL-C3-017)
//   - `?setup` → wizard de configuração inicial (BL-C5-006)
//   - (sem query) → overlay fullscreen
const params = new URLSearchParams(window.location.search);
const isPillWindow = params.has('pill');
const isSetupWindow = params.has('setup');

// Pill e overlay precisam de body transparente (BrowserWindow transparent —
// Sessão 26). O wizard é uma janela OPACA comum → `setup-mode` mantém o
// background do tema (não transparenta).
if (isPillWindow) {
  document.body.classList.add('pill-mode');
} else if (isSetupWindow) {
  document.body.classList.add('setup-mode');
} else {
  document.body.classList.add('overlay-mode');
}

function selectRoot(): JSX.Element {
  if (isPillWindow) return <PillApp />;
  if (isSetupWindow) return <SetupApp />;
  return <App />;
}

ReactDOM.createRoot(rootElement).render(<React.StrictMode>{selectRoot()}</React.StrictMode>);
