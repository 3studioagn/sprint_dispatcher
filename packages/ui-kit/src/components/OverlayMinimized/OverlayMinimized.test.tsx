import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { OverlayMinimized } from './OverlayMinimized';

describe('<OverlayMinimized>', () => {
  it('renderiza label e value', () => {
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

  it('dispara onClick quando clicado', () => {
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
    // Ícone marcado como aria-hidden — não atrapalha o leitor de tela
    // (informação já está no aria-label do botão).
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // Circle dashed (borda pontilhada) + path do check
    expect(svg?.querySelector('circle')).not.toBeNull();
    expect(svg?.querySelector('path')).not.toBeNull();
  });

  it('variant="urgent" compõe className adicional (placeholder visual)', () => {
    const { container } = render(
      <OverlayMinimized label="L" value={1} onClick={vi.fn()} variant="urgent" />,
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.className.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('NÃO impõe positioning (host decide localização na tela)', () => {
    // Sanidade arquitetural: o componente não deve trazer position
    // fixed/absolute/etc na className raiz. Test indireto via inline
    // style — CSS Modules em jsdom não expõem regras, mas garantimos
    // que não há style attribute imposto pelo componente.
    render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('style')).toBeNull();
  });
});
