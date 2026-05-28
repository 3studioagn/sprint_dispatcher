import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { OverlayMinimized } from './OverlayMinimized';

describe('<OverlayMinimized>', () => {
  it('renderiza label e value dentro da badge', () => {
    render(<OverlayMinimized label="Suas metas" value={20} onClick={vi.fn()} />);

    expect(screen.getByText('Suas metas')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('aceita value como string ou number', () => {
    const { rerender } = render(<OverlayMinimized label="L" value={5} onClick={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();

    rerender(<OverlayMinimized label="L" value="20 artes" onClick={vi.fn()} />);
    expect(screen.getByText('20 artes')).toBeInTheDocument();
  });

  it('dispara onClick quando a badge é clicada', () => {
    const onClick = vi.fn();
    render(<OverlayMinimized label="Suas metas" value={20} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('expõe aria-label composto (a11y para screen readers)', () => {
    render(<OverlayMinimized label="Suas metas" value={20} onClick={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Suas metas: 20');
  });

  it('renderiza ícone check pontilhado SVG inline (fixo, não customizável)', () => {
    const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // Ícone marcado como aria-hidden — info já está no aria-label do botão.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // Circle dashed + path do check
    expect(svg?.querySelector('circle')).not.toBeNull();
    expect(svg?.querySelector('path')).not.toBeNull();
  });

  it('renderiza estrutura bar > positioner > badge', () => {
    const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);

    // Root é a bar (div), não a badge (button) — diferente do design
    // antigo. Garante que o componente renderiza o wrapper full-width.
    const root = container.firstElementChild;
    expect(root?.tagName).toBe('DIV');
    // Positioner é o filho direto da bar
    const positioner = root?.firstElementChild;
    expect(positioner?.tagName).toBe('DIV');
    // Badge (button) está dentro do positioner
    const badge = positioner?.firstElementChild;
    expect(badge?.tagName).toBe('BUTTON');
  });

  describe('prop position', () => {
    // data-position attribute em vez de checar className do CSS Module —
    // names de CSS Modules em jsdom não são estáveis entre versões do
    // bundler e atrapalham testes. data-position também serve como hook
    // CSS público (consumidor pode customizar via [data-position="X"]).

    it('default é "center"', () => {
      const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);

      const positioner = container.querySelector('[data-position]');
      expect(positioner).not.toBeNull();
      expect(positioner).toHaveAttribute('data-position', 'center');
    });

    it('position="left" aplica data-position correspondente', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position="left" />,
      );

      expect(container.querySelector('[data-position="left"]')).not.toBeNull();
    });

    it('position="right" aplica data-position correspondente', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position="right" />,
      );

      expect(container.querySelector('[data-position="right"]')).not.toBeNull();
    });
  });

  it('variant="urgent" compõe className adicional na badge (placeholder visual)', () => {
    const { container } = render(
      <OverlayMinimized label="L" value={1} onClick={vi.fn()} variant="urgent" />,
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.className.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('NÃO impõe positioning CSS no host (sem style attribute)', () => {
    // Sanidade arquitetural: nem a bar nem a badge devem trazer style
    // inline. Positioning da bar (top:0, fixed, etc) é do host.
    const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);
    const bar = container.firstElementChild;
    const button = container.querySelector('button');
    expect(bar?.getAttribute('style')).toBeNull();
    expect(button?.getAttribute('style')).toBeNull();
  });
});
