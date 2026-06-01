/**
 * Sprint Leader — Renderer root.
 *
 * Fluxo de boot:
 * 1. Estado inicial `{ status: 'loading' }` — mostra "Carregando…".
 * 2. `useEffect` chama `api.getConfig()` via IPC. Cancela via flag se o
 *    componente desmontar antes da resposta (defesa contra setState em
 *    componente desmontado).
 * 3. Se `ok: true` → `{ status: 'ok' }` → renderiza HashRouter com 3 rotas.
 * 4. Se `ok: false` → `{ status: 'error', error }` → renderiza
 *    `ConfigErrorScreen` em lugar das rotas. Líder corrige config e
 *    clica "Reabrir" (window.location.reload), o main process tenta
 *    rebuild de deps no novo `getConfig` (ipc.ts) e o fluxo destrava.
 *
 * HashRouter é usado deliberadamente — o build de produção do Electron
 * carrega via `file://`, incompatível com BrowserRouter (history API).
 *
 * @see DECISIONS.md ADR-015 (composer do Leader)
 * @see DECISIONS.md ADR-012 (config loader fail-fast — Agent precedent)
 */

import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import type { ConfigErrorInfo } from '../shared/ipc-types';

import styles from './App.module.css';
import { ConfigErrorScreen } from './components/ConfigErrorScreen';
import { TopNav } from './components/TopNav';
import { Acompanhamento } from './routes/Acompanhamento';
import { Historico } from './routes/Historico';
import { NovaSprint } from './routes/NovaSprint';
import { api } from './services/api';

type BootState =
  | { status: 'loading' }
  | { status: 'ok' }
  | { status: 'error'; error: ConfigErrorInfo };

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api.getConfig();
      if (cancelled) return;
      if (result.ok) {
        setBoot({ status: 'ok' });
      } else {
        setBoot({ status: 'error', error: result.error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (boot.status === 'loading') {
    return (
      <div className={styles.bootLoading} role="status" aria-live="polite">
        Carregando configuração…
      </div>
    );
  }

  if (boot.status === 'error') {
    return <ConfigErrorScreen error={boot.error} />;
  }

  return (
    <HashRouter>
      <div className={styles.shell}>
        <TopNav />
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
