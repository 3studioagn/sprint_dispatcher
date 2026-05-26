/**
 * Tela exibida quando `api.getConfig()` retorna `{ ok: false }` no boot.
 *
 * Renderizada em lugar de `<HashRouter>` por `App.tsx`. Mostra:
 * - título específico por `error.code`
 * - mensagem human-readable do erro
 * - caminho esperado (líder copia para a TI)
 * - exemplo de JSON válido (copy-paste)
 * - botão "Reabrir" que recarrega a janela (em main, `getConfig`
 *   tenta rebuild de deps quando services estão null — fluxo destrava
 *   sem precisar reiniciar o app)
 *
 * @see DECISIONS.md ADR-012 (loader fail-fast — Agent precedent)
 * @see src/main/config.ts (origem das mensagens de erro)
 */

import type { ConfigErrorInfo } from '../../../shared/ipc-types';

import styles from './ConfigErrorScreen.module.css';

interface ConfigErrorScreenProps {
  readonly error: ConfigErrorInfo;
}

const TITLE_BY_CODE: Record<ConfigErrorInfo['code'], string> = {
  NOT_FOUND: 'Configuração não encontrada',
  JSON_INVALID: 'JSON inválido na configuração',
  SCHEMA_INVALID: 'Estrutura da configuração inválida',
  READ_ERROR: 'Falha ao ler configuração',
  SHARED_PATH_INACCESSIBLE: 'Pasta compartilhada inacessível',
};

const EXAMPLE_CONFIG = `{
  "shared_path": "\\\\\\\\srv-alpha\\\\TEMP\\\\Metas_3Studio",
  "criado_por": "Seu Nome"
}`;

export function ConfigErrorScreen({ error }: ConfigErrorScreenProps) {
  const handleReload = (): void => {
    window.location.reload();
  };

  return (
    <div className={styles.screen} role="alert" aria-live="assertive">
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{TITLE_BY_CODE[error.code]}</h1>
          <p className={styles.subtitle}>
            Sprint Leader precisa de um <code>config.json</code> válido para iniciar.
          </p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Detalhes do erro</h2>
          <pre className={styles.message}>{error.message}</pre>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Caminho esperado</h2>
          <code className={styles.path}>{error.expectedPath}</code>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Modelo do arquivo</h2>
          <pre className={styles.example}>
            <code>{EXAMPLE_CONFIG}</code>
          </pre>
          <p className={styles.hint}>
            Crie o arquivo no caminho indicado e clique em <strong>Reabrir</strong>.
          </p>
        </section>

        <button type="button" className={styles.reloadButton} onClick={handleReload}>
          Reabrir após criar configuração
        </button>
      </div>
    </div>
  );
}
