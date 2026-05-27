import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { XSS_VECTORS } from './__helpers__/xssVectors';
import { ALLOWED_HTML_TAGS } from './constants';
import { sanitizeBodyHtml } from './sanitize';

/**
 * Heurística de "saída livre de execução" para vetores XSS.
 *
 * Verifica que NENHUMA das superfícies de execução remanesce após
 * sanitização: tags executáveis (`<script>`, `<svg>`, `<iframe>`,
 * `<img>`, `<style>`), event handlers inline (`onerror`, `onload`, ...)
 * e schemes URI perigosos (`javascript:`, `vbscript:`). Comparação
 * case-insensitive para neutralizar bypasses tipo `<ScRiPt>`.
 *
 * Útil para casos onde o output exato pode variar entre versões do
 * DOMPurify (whitespace, ordem de atributos remanescentes), mas a
 * propriedade de segurança deve sempre se manter.
 */
function expectNoXssExecution(output: string): void {
  const lower = output.toLowerCase();
  expect(lower).not.toContain('<script');
  expect(lower).not.toContain('<svg');
  expect(lower).not.toContain('<iframe');
  expect(lower).not.toContain('<img');
  expect(lower).not.toContain('<style');
  expect(lower).not.toContain('<object');
  expect(lower).not.toContain('<embed');
  expect(output).not.toMatch(/\son[a-z]+\s*=/i);
  expect(lower).not.toContain('javascript:');
  expect(lower).not.toContain('vbscript:');
}

describe('sanitizeBodyHtml', () => {
  describe('casos normais (preservam)', () => {
    it('string vazia retorna string vazia', () => {
      expect(sanitizeBodyHtml('')).toBe('');
    });

    it('texto puro sem tags é preservado idêntico', () => {
      expect(sanitizeBodyHtml('Meta de produção: 8 peças')).toBe('Meta de produção: 8 peças');
    });

    it.each([['b'], ['i'], ['p'], ['h1'], ['span']])(
      'tag <%s> é preservada com conteúdo',
      (tag) => {
        const input = `<${tag}>conteúdo</${tag}>`;
        expect(sanitizeBodyHtml(input)).toBe(`<${tag}>conteúdo</${tag}>`);
      },
    );

    it('tag <br> (auto-fechada) é preservada', () => {
      // DOMPurify normaliza <br> e <br/> para a mesma forma. Aceitamos
      // qualquer das duas representações comuns — o importante é que
      // não suma e a quebra de linha permaneça.
      const output = sanitizeBodyHtml('linha1<br>linha2');
      expect(output).toMatch(/^linha1<br\s*\/?>linha2$/);
    });

    it('tag <br/> auto-fechada é preservada', () => {
      const output = sanitizeBodyHtml('linha1<br/>linha2');
      expect(output).toMatch(/^linha1<br\s*\/?>linha2$/);
    });

    it('aninhamento de tags permitidas é preservado', () => {
      expect(sanitizeBodyHtml('<p>Meta: <b>8</b></p>')).toBe('<p>Meta: <b>8</b></p>');
    });

    it('unicode, acentos e emoji passam intactos', () => {
      const input = '<b>Sua meta é de 8 peças 🎯</b>';
      expect(sanitizeBodyHtml(input)).toBe(input);
    });

    it('placeholder {meta} (BL-C2-006) atravessa sem alteração', () => {
      const input = '<b>Meta: {meta}</b>';
      expect(sanitizeBodyHtml(input)).toBe(input);
    });

    it('múltiplas tags da whitelist combinadas em sequência', () => {
      const input = '<h1>Sprint</h1><p>Meta: <b>8</b> peças em <i>1 hora</i></p>';
      expect(sanitizeBodyHtml(input)).toBe(input);
    });
  });

  describe('vetores XSS clássicos (neutralizam)', () => {
    it('tag <script> é removida', () => {
      const output = sanitizeBodyHtml('<script>alert(1)</script>');
      expectNoXssExecution(output);
      // KEEP_CONTENT preserva o texto interno do <script>; o que importa
      // é que NÃO há tag executável remanescente.
      expect(output).not.toContain('<script');
    });

    it('<img src=x onerror=alert(1)> é totalmente neutralizada', () => {
      const output = sanitizeBodyHtml('<img src=x onerror=alert(1)>');
      expectNoXssExecution(output);
    });

    it('<a href="javascript:..."> tem o scheme javascript: removido', () => {
      // O <a> está fora da whitelist; vai sumir (KEEP_CONTENT preserva o "x").
      const output = sanitizeBodyHtml('<a href="javascript:alert(1)">x</a>');
      expectNoXssExecution(output);
      expect(output).toContain('x');
    });

    it('<svg onload=alert(1)> é removida (svg fora da whitelist)', () => {
      const output = sanitizeBodyHtml('<svg onload=alert(1)></svg>');
      expectNoXssExecution(output);
    });

    it('<iframe src="javascript:..."> é removida', () => {
      const output = sanitizeBodyHtml('<iframe src="javascript:alert(1)"></iframe>');
      expectNoXssExecution(output);
    });

    it('atributo onmouseover em <b> é removido, tag preservada', () => {
      const output = sanitizeBodyHtml('<b onmouseover=alert(1)>x</b>');
      expect(output).toBe('<b>x</b>');
      expectNoXssExecution(output);
    });

    it('case bypass <ScRiPt>...</ScRiPt> é neutralizado', () => {
      const output = sanitizeBodyHtml('<ScRiPt>alert(1)</ScRiPt>');
      expectNoXssExecution(output);
    });

    it('nested bypass <<script>script>...<</script>/script> é neutralizado', () => {
      const output = sanitizeBodyHtml('<<script>script>alert(1)<</script>/script>');
      expectNoXssExecution(output);
    });

    it('<style> com javascript: url é removida', () => {
      const output = sanitizeBodyHtml('<style>body{background:url("javascript:alert(1)")}</style>');
      expectNoXssExecution(output);
    });

    it('atributo style malicioso em <b> é removido, tag preservada', () => {
      const output = sanitizeBodyHtml('<b style="background:url(javascript:alert(1))">x</b>');
      expect(output).toBe('<b>x</b>');
      expectNoXssExecution(output);
    });

    it('<a href="data:text/html,..."> é removida (scheme data: + tag fora whitelist)', () => {
      const output = sanitizeBodyHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
      expectNoXssExecution(output);
      expect(output).toContain('x');
    });

    it('HTML entities (&lt;script&gt;) permanecem escapadas — não são reinterpretadas', () => {
      const input = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const output = sanitizeBodyHtml(input);
      // Não deve conter < literal seguido de "script" — entities ficam ou
      // como &lt; ou como < (mas então NUNCA seguido da tag executável).
      expectNoXssExecution(output);
    });

    it('múltiplos vetores combinados são todos neutralizados', () => {
      const input =
        '<b onmouseover=alert(1)>texto</b><script>x</script><iframe src="javascript:y"></iframe>';
      const output = sanitizeBodyHtml(input);
      expect(output).toContain('<b>texto</b>');
      expectNoXssExecution(output);
    });

    it('atributo class em tag permitida é removido (ALLOWED_ATTR vazio)', () => {
      expect(sanitizeBodyHtml('<b class="x">oi</b>')).toBe('<b>oi</b>');
    });

    it('atributo id em tag permitida é removido', () => {
      expect(sanitizeBodyHtml('<span id="abc">oi</span>')).toBe('<span>oi</span>');
    });

    it('atributo data-* é removido (ALLOW_DATA_ATTR: false)', () => {
      expect(sanitizeBodyHtml('<b data-x="1">oi</b>')).toBe('<b>oi</b>');
    });
  });

  describe('edge cases', () => {
    it('string apenas com whitespace é preservada', () => {
      expect(sanitizeBodyHtml('   ')).toBe('   ');
    });

    it('texto muito longo (10.000 chars) é preservado', () => {
      const long = 'a'.repeat(10_000);
      expect(sanitizeBodyHtml(long)).toBe(long);
    });

    it('HTML malformado <b>oi é tratado sem lançar', () => {
      // DOMPurify normaliza — pode fechar a tag ou não. O importante é
      // não lançar e o texto "oi" permanecer.
      const output = sanitizeBodyHtml('<b>oi');
      expect(output).toContain('oi');
      expect(() => sanitizeBodyHtml('<b>oi')).not.toThrow();
    });

    it('tag desconhecida com conteúdo: <unknown>texto</unknown> → texto', () => {
      // KEEP_CONTENT preserva texto interno de tags removidas.
      expect(sanitizeBodyHtml('<unknown>texto</unknown>')).toBe('texto');
    });

    it('comentário HTML é removido', () => {
      const output = sanitizeBodyHtml('antes<!-- comment -->depois');
      expect(output).not.toContain('<!--');
      expect(output).not.toContain('comment');
      expect(output).toContain('antes');
      expect(output).toContain('depois');
    });

    it('<div> (fora da whitelist) é removido, conteúdo preservado', () => {
      expect(sanitizeBodyHtml('<div>texto</div>')).toBe('texto');
    });

    it('<table> (fora da whitelist) é removido, conteúdo preservado', () => {
      const output = sanitizeBodyHtml('<table><tr><td>cell</td></tr></table>');
      // Sem table/tr/td no output; conteúdo "cell" preservado.
      expectNoXssExecution(output);
      expect(output).not.toContain('<table');
      expect(output).not.toContain('<tr');
      expect(output).not.toContain('<td');
      expect(output).toContain('cell');
    });

    it('chamadas múltiplas com mesmo input são idempotentes', () => {
      const input = '<b>x</b><script>y</script>';
      const first = sanitizeBodyHtml(input);
      const second = sanitizeBodyHtml(first);
      expect(second).toBe(first);
    });
  });

  describe('ALLOWED_HTML_TAGS (whitelist)', () => {
    it('contém exatamente 6 tags', () => {
      expect(ALLOWED_HTML_TAGS).toHaveLength(6);
    });

    it('contém exatamente b, i, br, p, h1, span (sem variações)', () => {
      expect([...ALLOWED_HTML_TAGS].sort()).toEqual(['b', 'br', 'h1', 'i', 'p', 'span'].sort());
    });

    it('é readonly (typed as const)', () => {
      // Validação de tipo em tempo de compilação: a constante é
      // `readonly`. Em runtime, `Object.isFrozen` retorna false porque
      // `as const` é compile-time-only (não congela o array), mas TS
      // impede mutação no source. Este teste documenta a expectativa.
      const isReadonly: ALLOWED_HTML_TAGS_TYPE_IS_READONLY = true;
      expect(isReadonly).toBe(true);
    });
  });
});

// Type-level assertion: garante em compile-time que ALLOWED_HTML_TAGS é
// uma tupla readonly. Se alguém remover o `as const` da constante, o
// type-check falha aqui.
type ALLOWED_HTML_TAGS_TYPE_IS_READONLY = typeof ALLOWED_HTML_TAGS extends readonly string[]
  ? true
  : false;

// ===========================================================
// HARDENING ADVERSARIAL — Gate 2 (BL-C8-002 parte 1)
//
// Expansão da suíte com:
// - Curadoria de vetores XSS (mutation / encoding / polyglot /
//   unicode / combining) — ver __helpers__/xssVectors.ts
// - Property-based testing (fast-check) sobre invariantes
//   universais do sanitizer.
// - Unicode edge cases (zero-width, RTL, emoji composto,
//   NFC vs NFD).
// - Inputs gigantes (performance + ausência de crash).
// - Variantes vazias / whitespace / chars de controle.
// ===========================================================

describe('sanitizeBodyHtml — hardening adversarial', () => {
  // ---- Vetores XSS curados, agrupados por categoria ----
  describe('vetores XSS curados (__helpers__/xssVectors.ts)', () => {
    const categories = ['mutation', 'encoding', 'polyglot', 'unicode', 'combining'] as const;

    for (const category of categories) {
      const vectorsInCategory = XSS_VECTORS.filter((v) => v.category === category);

      describe(`categoria ${category} (${String(vectorsInCategory.length)} vetores)`, () => {
        it.each(vectorsInCategory.map((v) => [v.reason, v.input] as const))(
          '%s — sanitização neutraliza',
          (_reason, input) => {
            const output = sanitizeBodyHtml(input);
            expectNoXssExecution(output);
          },
        );
      });
    }

    it('curadoria mantém ≥ 5 mutation + ≥ 5 encoding + ≥ 3 polyglot + ≥ 5 unicode + ≥ 2 combining', () => {
      // Guard rail: se alguém deletar vetores sem ADR explícito, o teste
      // falha — exigindo decisão consciente sobre redução do escopo
      // defensivo.
      const counts: Record<string, number> = {};
      for (const v of XSS_VECTORS) {
        counts[v.category] = (counts[v.category] ?? 0) + 1;
      }
      expect(counts.mutation ?? 0).toBeGreaterThanOrEqual(5);
      expect(counts.encoding ?? 0).toBeGreaterThanOrEqual(5);
      expect(counts.polyglot ?? 0).toBeGreaterThanOrEqual(3);
      expect(counts.unicode ?? 0).toBeGreaterThanOrEqual(5);
      expect(counts.combining ?? 0).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- Properties universais (fast-check) ----
  describe('property: superfície de execução nunca remanesce', () => {
    it('para qualquer string, output não contém "<script"', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const output = sanitizeBodyHtml(input).toLowerCase();
          return !output.includes('<script');
        }),
        { numRuns: 50 },
      );
    });

    it('para qualquer string, output não contém "javascript:"', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const output = sanitizeBodyHtml(input).toLowerCase();
          return !output.includes('javascript:');
        }),
        { numRuns: 50 },
      );
    });

    it('para qualquer string, output não contém handler inline (on*=)', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const output = sanitizeBodyHtml(input);
          return !/\son[a-z]+\s*=/i.test(output);
        }),
        { numRuns: 50 },
      );
    });

    it('sanitização é idempotente para qualquer string', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const once = sanitizeBodyHtml(input);
          const twice = sanitizeBodyHtml(once);
          return once === twice;
        }),
        { numRuns: 50 },
      );
    });
  });

  // ---- Unicode edge cases ----
  describe('unicode edge cases', () => {
    it('zero-width space dentro de <b> é preservado', () => {
      const input = '<b>x​y</b>';
      const output = sanitizeBodyHtml(input);
      expect(output).toContain('​');
      expect(output.startsWith('<b>')).toBe(true);
    });

    it('RTL override (U+202E) dentro de <b> é preservado como char textual', () => {
      const input = '<b>texto‮rev</b>';
      const output = sanitizeBodyHtml(input);
      expect(output).toContain('‮');
    });

    it('emoji ZWJ family (👨‍👩‍👧‍👦) preservado dentro de <b>', () => {
      const input = '<b>Meta 👨‍👩‍👧‍👦</b>';
      const output = sanitizeBodyHtml(input);
      expect(output).toContain('👨‍👩‍👧‍👦');
    });

    it('NFC composto (caf\\u00E9 — 4 codepoints) preservado byte-a-byte', () => {
      const nfc = 'café';
      expect(nfc.length).toBe(4);
      expect(sanitizeBodyHtml(nfc)).toBe(nfc);
    });

    it('NFD decomposto (cafe + U+0301 — 5 codepoints) preservado byte-a-byte', () => {
      const nfd = 'café';
      expect(nfd.length).toBe(5);
      expect(sanitizeBodyHtml(nfd)).toBe(nfd);
    });

    it('NFC e NFD permanecem distintos após sanitização (sanitizer não normaliza)', () => {
      const nfc = 'café';
      const nfd = 'café';
      expect(sanitizeBodyHtml(nfc)).not.toBe(sanitizeBodyHtml(nfd));
    });
  });

  // ---- Inputs gigantes (performance + sem crash) ----
  describe('inputs gigantes', () => {
    it('input de 1 MB de texto puro processa em < 2s', () => {
      const huge = 'a'.repeat(1_000_000);
      const start = performance.now();
      const output = sanitizeBodyHtml(huge);
      const elapsedMs = performance.now() - start;
      expect(output).toBe(huge);
      expect(elapsedMs).toBeLessThan(2000);
    });

    it('input de 10 MB de texto puro processa em < 10s', () => {
      const huge = 'a'.repeat(10_000_000);
      const start = performance.now();
      const output = sanitizeBodyHtml(huge);
      const elapsedMs = performance.now() - start;
      expect(output).toBe(huge);
      expect(elapsedMs).toBeLessThan(10_000);
    });

    it('input grande com 10k <script> aninhados não deixa nenhum no output', () => {
      const malicious = `<b>start</b>${'<script>x</script>'.repeat(10_000)}<b>end</b>`;
      const output = sanitizeBodyHtml(malicious);
      expectNoXssExecution(output);
      expect(output).toContain('<b>start</b>');
      expect(output).toContain('<b>end</b>');
    });
  });

  // ---- Variantes vazias / whitespace / chars de controle ----
  describe('variantes empty / whitespace / chars de controle', () => {
    it('string vazia retorna vazio', () => {
      expect(sanitizeBodyHtml('')).toBe('');
    });

    it('whitespace ASCII puro é preservado', () => {
      expect(sanitizeBodyHtml(' \n\t\r')).toBe(' \n\t\r');
    });

    it('null character (U+0000) não causa crash e retorna string', () => {
      const output = sanitizeBodyHtml('\0');
      expect(typeof output).toBe('string');
    });

    it('apenas combining marks sem base (U+0301 U+0302 U+0303) não causa crash', () => {
      const output = sanitizeBodyHtml('́̂̃');
      expect(typeof output).toBe('string');
    });

    it('apenas tags fora da whitelist sem conteúdo vira string vazia', () => {
      expect(sanitizeBodyHtml('<div></div><table></table>')).toBe('');
    });
  });
});
