import React from 'react';
import ReactDOM from 'react-dom/client';

// Side-effect import — Vite library mode do ui-kit extrai CSS de componentes
// para um arquivo separado. O Agent precisa importar explicitamente, senão
// tokens (--sprint-*) e classes (.overlay/.card/etc) não carregam.
// Subpath ./styles.css exposto em packages/ui-kit/package.json#exports.
import '@sprint/ui-kit/styles.css';

import App from './App';
import PillApp from './PillApp';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM');
}

// BL-C3-017: o main process carrega esta mesma index.html em DUAS
// BrowserWindows distintas (overlay fullscreen + pill). O pill window
// recebe `?pill` na query — usamos isso para escolher o root a montar.
// Mesma surface IPC (preload é compartilhado), mas roots diferentes.
const isPillWindow = new URLSearchParams(window.location.search).has('pill');

if (isPillWindow) {
  // Pill ocupa só 100px no topo da tela. Marca body para CSS reset
  // específico (background transparente para não poluir abaixo da bar).
  document.body.classList.add('pill-mode');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>{isPillWindow ? <PillApp /> : <App />}</React.StrictMode>,
);
