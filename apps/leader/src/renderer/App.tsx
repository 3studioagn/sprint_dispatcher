import { useEffect, useState } from 'react';

import styles from './App.module.css';

export default function App() {
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Smoke test do bridge IPC. Usa async/await em vez de `.then()/.catch()`
     * (CLAUDE.md §7.4); o callback de `useEffect` não pode ser async, então a
     * função é declarada aqui dentro e descartada com `void`.
     */
    async function runPing(): Promise<void> {
      try {
        const value = await window.api.ping();
        setPingResult(value);
      } catch (err: unknown) {
        setPingError(err instanceof Error ? err.message : String(err));
      }
    }

    void runPing();
  }, []);

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sprint Leader</h1>
        <span className={styles.subtitle}>Aplicação em scaffold · Wave 0</span>
      </header>
      <section className={styles.bridge}>
        <h2 className={styles.bridgeTitle}>Bridge IPC</h2>
        {pingError !== null ? (
          <p className={styles.error}>Erro: {pingError}</p>
        ) : pingResult !== null ? (
          <p className={styles.ok}>Bridge ativo · resposta do main: {pingResult}</p>
        ) : (
          <p className={styles.loading}>Aguardando resposta do main...</p>
        )}
      </section>
      <footer className={styles.footer}>
        <p>Telas reais serão construídas na Wave 1.</p>
        <p>BL-C2-002 a 011 · depende de C4 (fs-adapter).</p>
      </footer>
    </main>
  );
}
