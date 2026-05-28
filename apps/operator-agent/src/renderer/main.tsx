import React from 'react';
import ReactDOM from 'react-dom/client';

// Side-effect import — Vite library mode do ui-kit extrai CSS de componentes
// para um arquivo separado. O Agent precisa importar explicitamente, senão
// tokens (--sprint-*) e classes (.overlay/.card/etc) não carregam.
// Subpath ./styles.css exposto em packages/ui-kit/package.json#exports.
import '@sprint/ui-kit/styles.css';

import App from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado no DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
