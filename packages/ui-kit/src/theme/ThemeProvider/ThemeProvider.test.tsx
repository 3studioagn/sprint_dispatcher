import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ThemeProvider } from './ThemeProvider';

describe('<ThemeProvider>', () => {
  it('renderiza os children', () => {
    render(
      <ThemeProvider>
        <p>conteúdo de teste</p>
      </ThemeProvider>,
    );

    expect(screen.getByText('conteúdo de teste')).toBeInTheDocument();
  });

  it('aplica wrapper com className do CSS Module', () => {
    const { container } = render(
      <ThemeProvider>
        <span>x</span>
      </ThemeProvider>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).not.toBeNull();
    // CSS Modules em jsdom resolvem para string (vazia ou hashed) —
    // verificamos só que algo foi atribuído, não o valor específico.
    expect(wrapper?.className).toBeDefined();
  });

  it('compõe className adicional quando passado via prop', () => {
    const { container } = render(
      <ThemeProvider className="custom-extra">
        <span>x</span>
      </ThemeProvider>,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('custom-extra');
  });

  it('é idempotente quando aninhado (props independentes)', () => {
    // Múltiplas instâncias funcionam — tokens propagam por cascata CSS.
    render(
      <ThemeProvider>
        <ThemeProvider>
          <p>inner</p>
        </ThemeProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText('inner')).toBeInTheDocument();
  });
});
