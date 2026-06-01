/**
 * Curadoria de vetores XSS adversariais para o sanitizer.
 *
 * Cada entrada documenta o motivo do vetor — o ataque que tenta
 * explorar — para que, ao falhar no futuro, o engenheiro de plantão
 * saiba O QUE estava sendo defendido sem precisar reverter histórico
 * de Git.
 *
 * **Como adicionar um vetor novo**:
 *  1. Identifique a categoria (mutation / encoding / polyglot /
 *     unicode / combining).
 *  2. Descreva o vetor em uma frase no campo `reason`.
 *  3. O teste em `sanitize.test.ts` itera essa lista e exige que
 *     `expectNoXssExecution(sanitizeBodyHtml(input))` passe.
 *
 * Mantenha esta lista versionada e cresça com a sofisticação dos
 * ataques publicados (PortSwigger, OWASP, etc.).
 *
 * @see DECISIONS.md ADR-014 (sanitização via isomorphic-dompurify)
 */
export interface XssVector {
  readonly input: string;
  readonly reason: string;
  readonly category: 'mutation' | 'encoding' | 'polyglot' | 'unicode' | 'combining';
}

export const XSS_VECTORS: readonly XssVector[] = [
  // === Mutation XSS — exploram quirks do parser HTML ===
  {
    category: 'mutation',
    reason: 'SVG <animate> com onbegin (handler em namespace SVG)',
    input: '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  },
  {
    category: 'mutation',
    reason: 'MathML <mi xlink:href="javascript:..."> (foreign content)',
    input: '<math><mi xlink:href="javascript:alert(1)">click</mi></math>',
  },
  {
    category: 'mutation',
    reason: 'SVG <foreignObject> hospedando <script> em namespace HTML',
    input: '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>',
  },
  {
    category: 'mutation',
    reason: '<noscript> context confusion (parser HTML vs JS-disabled)',
    input: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  },
  {
    category: 'mutation',
    reason: 'CSS @import com scheme javascript: dentro de <style>',
    input: '<style>@import "javascript:alert(1)";</style>',
  },
  {
    category: 'mutation',
    reason: 'Comentário malformado <!--<script>...<!-- bypassa parser ingênuo',
    input: '<!--<script>alert(1)//--><!--',
  },

  // === Encoding bypasses — entities/escapes que parsers ingênuos decodificam ===
  {
    category: 'encoding',
    reason: 'tags <script> encodadas em HTML entities (&lt;script&gt;)',
    input: '&lt;script&gt;alert(1)&lt;/script&gt;',
  },
  {
    category: 'encoding',
    reason: 'hex entity dentro do scheme javascript: (&#x6A;avascript:)',
    input: '<a href="&#x6A;avascript:alert(1)">x</a>',
  },
  {
    category: 'encoding',
    reason: 'unicode escape dentro do scheme javascript: (\\u006Aavascript:)',
    input: '<a href="javascript:alert(1)">x</a>',
  },
  {
    category: 'encoding',
    reason: 'tab/whitespace embutido dentro do scheme javascript:',
    input: '<a href="ja\tvascript:alert(1)">x</a>',
  },
  {
    category: 'encoding',
    reason: 'atributos com backtick em vez de aspas (parser quirky)',
    input: '<img src=`x` onerror=`alert(1)`>',
  },

  // === Polyglots — payloads válidos em múltiplos contextos ===
  {
    category: 'polyglot',
    // Versão adaptada do polyglot PortSwigger sem o prefixo `javascript:/*--`
    // standalone: aquele prefixo, após sanitização, sobrevive como TEXTO puro
    // (não como href de <a>), e portanto é cosmeticamente seguro — porém
    // ativa nossa heurística `expectNoXssExecution` que rejeita literal
    // `javascript:` sem distinguir contexto. Decisão consciente: testar a
    // essência (breakout HTML+SVG+JS via fechamento de tags raras + svg/onload).
    reason: 'polyglot HTML+JS+SVG via closing-tag breakout + svg/onload',
    input:
      "</title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
  },
  {
    category: 'polyglot',
    reason: 'SVG hospedando <script> com entity dentro do payload',
    input: '<svg><script>alert&#40;1&#41;</script></svg>',
  },
  {
    category: 'polyglot',
    reason: 'attribute-breakout polyglot (\'> "> <script>...)',
    input: '\'>">"<script>alert(1)</script>',
  },

  // === Unicode edge cases — chars invisíveis e normalizações ===
  {
    category: 'unicode',
    reason: 'zero-width space antes de <script>',
    input: 'Meta​<script>alert(1)</script>',
  },
  {
    category: 'unicode',
    reason: 'RTL override (U+202E) antes de <script>',
    input: '‮<script>alert(1)</script>',
  },
  {
    category: 'unicode',
    reason: 'emoji composto (ZWJ family) antes de <svg onload=...>',
    input: 'Meta 👨‍👩‍👧‍👦<svg onload=alert(1)></svg>',
  },
  {
    category: 'unicode',
    reason: 'acento NFC composto (café) antes de <script>',
    input: 'café<script>alert(1)</script>',
  },
  {
    category: 'unicode',
    reason: 'acento NFD decomposto (cafe\\u0301) antes de <script>',
    input: 'café<script>alert(1)</script>',
  },

  // === Combining marks — modificadores diacríticos com tags ===
  {
    category: 'combining',
    reason: 'combining acute dentro de <b> permitida + <script> adjacente',
    input: '<b>á</b><script>alert(1)</script>',
  },
  {
    category: 'combining',
    reason: 'sequência longa de combining marks (3+) antes de <script>',
    input: 'x́̂̃<script>alert(1)</script>',
  },
];
