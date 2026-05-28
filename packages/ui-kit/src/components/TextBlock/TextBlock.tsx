import { sanitizeBodyHtml } from '@sprint/contracts';

import styles from './TextBlock.module.css';

export interface TextBlockProps {
  bodyHtml: string;
  className?: string;
}

/**
 * Renderiza um bloco de texto a partir de HTML sanitizado, aplicando
 * a tipografia canônica do design system.
 *
 * **Defesa em profundidade** (CLAUDE.md §7.9, RF-17, RN-10):
 * - O HTML passa por `sanitizeBodyHtml` em **todo render**, mesmo que
 *   já tenha sido sanitizado pelo produtor (Leader em BL-C1-004).
 *   `sanitizeBodyHtml` é idempotente (ADR-014) — segundo passe não
 *   muta o output do primeiro.
 * - O resultado é inserido via `dangerouslySetInnerHTML` — "dangerous"
 *   aqui é nominal, conteúdo é seguro por construção.
 * - Tags fora da whitelist (qualquer `<script>`, atributos `on*`, etc)
 *   são removidas antes da inserção.
 *
 * Tipografia:
 * - Tags whitelistadas (`<b>`, `<i>`, `<br>`, `<p>`, `<h1>`, `<span>`)
 *   recebem styling do design system via seletores aninhados no
 *   `.module.css`.
 */
export function TextBlock({ bodyHtml, className }: TextBlockProps) {
  const sanitized = sanitizeBodyHtml(bodyHtml);
  const composedClassName = className ? `${styles.textBlock} ${className}` : styles.textBlock;

  return <div className={composedClassName} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
