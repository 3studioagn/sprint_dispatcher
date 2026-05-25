import DOMPurify from 'isomorphic-dompurify';

import { ALLOWED_HTML_TAGS } from './constants';

/**
 * Sanitiza o conteúdo HTML do corpo (`body_html`) de um aviso de sprint.
 *
 * Aplica whitelist estrita derivada de {@link ALLOWED_HTML_TAGS} (RN-10):
 * apenas `<b>`, `<i>`, `<br>`, `<p>`, `<h1>` e `<span>` são preservados.
 * Todos os atributos são removidos — defesa contra XSS via handlers
 * inline (`onerror`, `onclick`, `onmouseover`, ...), `style: url(javascript:...)`,
 * `href: javascript:`, `srcset`, etc. Conteúdo textual dentro de tags
 * removidas é preservado (`KEEP_CONTENT: true`).
 *
 * A camada de schema deliberadamente **não** sanitiza (ver
 * `schemas/security.test.ts` no mesmo package): toda escrita de
 * `body_html` deve passar por esta função antes de gravar JSON em
 * `pending/`, e toda leitura deve sanitizar antes de renderizar no
 * overlay — defesa em profundidade.
 *
 * @param html - HTML bruto fornecido pelo líder.
 * @returns HTML sanitizado, seguro para renderização no overlay.
 *
 * @example
 * ```ts
 * sanitizeBodyHtml('<b>Meta: 8</b><script>alert(1)</script>');
 * // → '<b>Meta: 8</b>'
 *
 * sanitizeBodyHtml('<img src=x onerror=alert(1)>');
 * // → '' (tag removida, conteúdo vazio preservado)
 *
 * sanitizeBodyHtml('<b onmouseover="alert(1)">x</b>');
 * // → '<b>x</b>' (tag mantida, atributo removido)
 * ```
 *
 * @see DECISIONS.md ADR-014 (sanitização via isomorphic-dompurify)
 * @see Requisitos RF-17 (sanitização do `body_html`)
 * @see Requisitos RN-10 (whitelist de tags HTML)
 * @see Requisitos RNF-18 (defesa contra injeção de script)
 */
export function sanitizeBodyHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_HTML_TAGS],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    RETURN_TRUSTED_TYPE: false,
  });
}
