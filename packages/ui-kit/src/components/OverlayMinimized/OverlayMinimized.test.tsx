import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { OverlayMinimized } from './OverlayMinimized';

/** Type guard helper — retorna HTMLElement pra escapar dos `as` casts
 *  rejeitados pelo @typescript-eslint/no-unsafe-member-access. */
function asElement(node: Element | null): HTMLElement {
  if (!(node instanceof HTMLElement)) {
    throw new Error('Esperado HTMLElement');
  }
  return node;
}

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

    // 3 SVGs: cornerLeft, icon do badge, cornerRight
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(3);

    // O ícone check é o único com viewBox 24x24
    const checkIcon = Array.from(svgs).find((s) => s.getAttribute('viewBox') === '0 0 24 24');
    expect(checkIcon).toBeDefined();
    expect(checkIcon).toHaveAttribute('aria-hidden', 'true');
    expect(checkIcon?.querySelector('circle')).not.toBeNull();
    expect(checkIcon?.querySelector('path')).not.toBeNull();
  });

  it('renderiza estrutura bar > positioner > cornerLeft + badge + cornerRight', () => {
    const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);

    const bar = container.firstElementChild;
    expect(bar?.tagName).toBe('DIV');

    const positioner = bar?.firstElementChild;
    expect(positioner?.tagName).toBe('DIV');

    // positioner tem 3 filhos diretos: cornerLeft (svg) + badge (button) + cornerRight (svg)
    expect(positioner?.children.length).toBe(3);
    expect(positioner?.children[0]?.tagName).toBe('svg');
    expect(positioner?.children[1]?.tagName).toBe('BUTTON');
    expect(positioner?.children[2]?.tagName).toBe('svg');
  });

  it('SVG corners têm viewBox 28×32 e fill currentColor (cor da bar)', () => {
    const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);

    const positioner = container.querySelector('[data-position]');
    const cornerSvgs = positioner?.querySelectorAll('svg');
    // corner left + corner right (icon do badge tem viewBox 24×24, filtra fora)
    const corners = Array.from(cornerSvgs ?? []).filter(
      (s) => s.getAttribute('viewBox') === '0 0 28 32',
    );
    expect(corners.length).toBe(2);

    for (const c of corners) {
      const path = c.querySelector('path');
      expect(path).not.toBeNull();
      expect(path?.getAttribute('fill')).toBe('currentColor');
    }
  });

  describe('prop position — atalhos enum', () => {
    it('default é "center" (50%)', () => {
      const { container } = render(<OverlayMinimized label="L" value={1} onClick={vi.fn()} />);

      const positioner = asElement(container.querySelector('[data-position]'));
      expect(positioner).toHaveAttribute('data-position', 'center');
      expect(positioner.style.left).toBe('50%');
    });

    it('position="left" resolve para 0%', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position="left" />,
      );

      const positioner = asElement(container.querySelector('[data-position]'));
      expect(positioner.getAttribute('data-position')).toBe('left');
      expect(positioner.style.left).toBe('0%');
    });

    it('position="right" resolve para 100%', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position="right" />,
      );

      const positioner = asElement(container.querySelector('[data-position]'));
      expect(positioner.getAttribute('data-position')).toBe('right');
      expect(positioner.style.left).toBe('100%');
    });
  });

  describe('prop position — numeric (drag controlado pelo host)', () => {
    it('aceita number 0-100 e injeta no style.left', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position={73} />,
      );

      const positioner = asElement(container.querySelector('[data-position="numeric"]'));
      expect(positioner.style.left).toBe('73%');
      expect(positioner.style.transform).toBe('translateX(-73%)');
    });

    it('clamp em values negativos (< 0 → 0)', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position={-30} />,
      );

      const positioner = asElement(container.querySelector('[data-position="numeric"]'));
      expect(positioner.style.left).toBe('0%');
    });

    it('clamp em values acima de 100 (> 100 → 100)', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position={150} />,
      );

      const positioner = asElement(container.querySelector('[data-position="numeric"]'));
      expect(positioner.style.left).toBe('100%');
    });

    it('NaN cai em center (50%) como fallback seguro', () => {
      const { container } = render(
        <OverlayMinimized label="L" value={1} onClick={vi.fn()} position={Number.NaN} />,
      );

      const positioner = asElement(container.querySelector('[data-position="numeric"]'));
      expect(positioner.style.left).toBe('50%');
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
});
