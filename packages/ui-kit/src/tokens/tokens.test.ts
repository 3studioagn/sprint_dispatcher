import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

const tokensPath = resolve(__dirname, 'tokens.css');
const css = readFileSync(tokensPath, 'utf-8');

describe('tokens.css', () => {
  it('contém o seletor :root', () => {
    expect(css).toMatch(/:root\s*\{/);
  });

  it('todas as CSS custom properties usam prefixo --sprint-', () => {
    const declarationPattern = /(--[a-z][\w-]+)\s*:/g;
    const declarations = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = declarationPattern.exec(css)) !== null) {
      const captured = match[1];
      if (captured !== undefined) declarations.add(captured);
    }

    // Pelo menos 40 tokens — categorias completas: cores semânticas,
    // neutros, aliases, espaçamentos, tipografia (sizes/weights/lh),
    // sombras e radii.
    expect(declarations.size).toBeGreaterThan(40);
    for (const prop of declarations) {
      expect(prop).toMatch(/^--sprint-/);
    }
  });

  it('contém todas as categorias requeridas', () => {
    // Cores semânticas
    expect(css).toMatch(/--sprint-color-primary\b/);
    expect(css).toMatch(/--sprint-color-primary-hover\b/);
    expect(css).toMatch(/--sprint-color-primary-active\b/);
    expect(css).toMatch(/--sprint-color-primary-on\b/);
    expect(css).toMatch(/--sprint-color-primary-glow\b/);
    expect(css).toMatch(/--sprint-color-secondary\b/);
    expect(css).toMatch(/--sprint-color-success\b/);
    expect(css).toMatch(/--sprint-color-warning\b/);
    expect(css).toMatch(/--sprint-color-danger\b/);

    // Escala neutra contínua
    expect(css).toMatch(/--sprint-color-neutral-100\b/);
    expect(css).toMatch(/--sprint-color-neutral-500\b/);
    expect(css).toMatch(/--sprint-color-neutral-900\b/);

    // Aliases semânticos (DARK theme)
    expect(css).toMatch(/--sprint-color-background\b/);
    expect(css).toMatch(/--sprint-color-surface\b/);
    expect(css).toMatch(/--sprint-color-surface-elevated\b/);
    expect(css).toMatch(/--sprint-color-text\b/);
    expect(css).toMatch(/--sprint-color-text-muted\b/);
    expect(css).toMatch(/--sprint-color-text-inverse\b/);
    expect(css).toMatch(/--sprint-color-border\b/);
    expect(css).toMatch(/--sprint-color-backdrop\b/);

    // Espaçamentos (escala 4px)
    expect(css).toMatch(/--sprint-space-1\b/);
    expect(css).toMatch(/--sprint-space-8\b/);

    // Tipografia
    expect(css).toMatch(/--sprint-font-family-sans\b/);
    expect(css).toMatch(/--sprint-font-size-xs\b/);
    expect(css).toMatch(/--sprint-font-size-base\b/);
    expect(css).toMatch(/--sprint-font-size-4xl\b/); // tier extra (120px para meta gigante)
    expect(css).toMatch(/--sprint-font-weight-regular\b/);
    expect(css).toMatch(/--sprint-font-weight-bold\b/);
    expect(css).toMatch(/--sprint-line-height-tight\b/);
    expect(css).toMatch(/--sprint-line-height-normal\b/);
    expect(css).toMatch(/--sprint-line-height-relaxed\b/);

    // Sombras (3 níveis + glow expressivo)
    expect(css).toMatch(/--sprint-shadow-sm\b/);
    expect(css).toMatch(/--sprint-shadow-md\b/);
    expect(css).toMatch(/--sprint-shadow-lg\b/);
    expect(css).toMatch(/--sprint-shadow-primary-glow\b/);

    // Border-radius (4 escalas)
    expect(css).toMatch(/--sprint-radius-sm\b/);
    expect(css).toMatch(/--sprint-radius-md\b/);
    expect(css).toMatch(/--sprint-radius-lg\b/);
    expect(css).toMatch(/--sprint-radius-pill\b/);
  });

  it('não contém marcadores TODO_IMG remanescentes', () => {
    // Cores foram extraídas diretamente da imagem, sem necessidade
    // de placeholders TODO_IMG (defesa caso versão futura introduza).
    expect(css).not.toMatch(/TODO_IMG/);
  });

  it('background do card é dark theme (~#1A1A1A extraído da imagem)', () => {
    // Sanity check específico do tema dark — se um futuro refactor
    // acidentalmente reverter para light theme (#fff), este teste pega.
    expect(css).toMatch(/--sprint-color-background:\s*#1a1a1a/i);
    expect(css).toMatch(/--sprint-color-text:\s*#ffffff/i);
  });
});
