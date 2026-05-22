import { useEffect, useState } from 'react';

import type { SafeAgentConfigView } from '../shared/ipc-types';

import styles from './App.module.css';

export default function App() {
  const [config, setConfig] = useState<SafeAgentConfigView | null>(null);
  const [pong, setPong] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Smoke test do bridge IPC. O callback de `useEffect` não pode ser
     * async, então a função é declarada aqui e descartada com `void`.
     */
    async function init(): Promise<void> {
      try {
        const p = await window.api.ping();
        setPong(p);
        const c = await window.api.getConfig();
        setConfig(c);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void init();
  }, []);

  return (
    <main className={styles.overlay}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sprint Dispatcher · Agent</h1>
        <span className={styles.subtitle}>Placeholder do overlay · Wave 0</span>
      </header>
      <section className={styles.bridge}>
        <h2 className={styles.bridgeTitle}>Smoke do bridge IPC</h2>
        {error !== null ? (
          <p className={styles.error}>Erro: {error}</p>
        ) : (
          <>
            <p>
              ping: <strong>{pong ?? 'aguardando...'}</strong>
            </p>
            {config !== null && (
              <p>
                Operador: <strong>{config.user_nome_exibicao}</strong> (
                <code>{config.user_id}</code>) · estação <code>{config.hostname}</code>
              </p>
            )}
          </>
        )}
      </section>
      <footer className={styles.footer}>
        <p>Este placeholder será substituído pelo overlay real (BL-C3-004, W1).</p>
        <p>Em W0 esta UI só aparece via `pnpm dev`; não há polling ativo.</p>
      </footer>
    </main>
  );
}
