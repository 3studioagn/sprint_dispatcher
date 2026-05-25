/**
 * Sprint Leader — Renderer entrypoint component.
 *
 * Monta o shell com sidebar persistente e roteia entre as 3 rotas
 * principais. HashRouter é usado deliberadamente: o build de produção
 * carrega via `file://` (Electron), incompatível com BrowserRouter
 * (history API).
 *
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 */

import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import styles from './App.module.css';
import { Sidebar } from './components/Sidebar';
import { Acompanhamento } from './routes/Acompanhamento';
import { Historico } from './routes/Historico';
import { NovaSprint } from './routes/NovaSprint';

export default function App() {
  return (
    <HashRouter>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<Navigate to="/nova" replace />} />
            <Route path="/nova" element={<NovaSprint />} />
            <Route path="/acompanhamento" element={<Acompanhamento />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="*" element={<Navigate to="/nova" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
