---
'@sprint/contracts': patch
---

feat(C1): add sanitizeBodyHtml for sprint body HTML (BL-C1-004)

Novo sanitizador `sanitizeBodyHtml(html: string): string` em `@sprint/contracts`
para o campo `body_html` do `SprintPayload`. Aplica whitelist estrita derivada
de `ALLOWED_HTML_TAGS` (RN-10): `<b>`, `<i>`, `<br>`, `<p>`, `<h1>`, `<span>`.
Atributos são removidos (`ALLOWED_ATTR: []`); conteúdo textual de tags fora da
whitelist é preservado (`KEEP_CONTENT: true`).

Defesa em profundidade contra XSS (RNF-18): Leader sanitiza ao escrever em
`pending/`; Agent sanitiza ao renderizar no overlay. Função idempotente —
chamadas múltiplas com o mesmo input produzem o mesmo output.

Implementação via `isomorphic-dompurify` ^2.36.0 (nova dependency runtime),
funcional tanto em main process (Node) quanto em renderer (browser-like).
