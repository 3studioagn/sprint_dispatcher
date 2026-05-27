/**
 * Banner de erro reutilizável para surfacing de falhas de I/O ao operador
 * (defesa em profundidade para silent failures — F-025 da auditoria W1).
 *
 * Renderizado quando um carregamento de dados falha — distingue
 * "lista vazia" de "erro técnico" e dá ao líder caminho de ação (retry).
 *
 * Pattern: `role="alert"` + `aria-live="assertive"` para leitores de tela.
 * Texto curto, mensagem técnica entre parênteses, instrução para TI, botão
 * opcional de retry.
 *
 * @see Requisitos UC-01 fluxo alternativo A4 ("Pasta compartilhada
 *   inacessível: Sistema exibe erro de conexão e instrui contato com TI")
 */

import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  /** Mensagem human-readable em pt-BR (geralmente vem do IpcError.message). */
  readonly message: string;
  /**
   * Callback opcional para botão "Tentar novamente". Quando ausente, o
   * botão não é renderizado (banner é apenas informativo).
   */
  readonly onRetry?: () => void | Promise<void>;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const handleRetry = (): void => {
    if (onRetry === undefined) return;
    void onRetry();
  };

  return (
    <div className={styles.banner} role="alert" aria-live="assertive">
      <div className={styles.content}>
        <p className={styles.title}>Não foi possível carregar os dados</p>
        <p className={styles.message}>{message}</p>
        <p className={styles.hint}>
          Se o problema persistir, contate a TI da fábrica com o trecho acima.
        </p>
      </div>
      {onRetry !== undefined && (
        <button type="button" className={styles.retryButton} onClick={handleRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
