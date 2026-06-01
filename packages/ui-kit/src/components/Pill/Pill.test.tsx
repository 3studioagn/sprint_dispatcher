/**
 * Testes do <Pill> — render compact + expanded, click handler, a11y.
 *
 * Auto-collapse após N segundos é responsabilidade do HOST (Agent
 * PillApp em BL-C3-017+) — este componente é stateless quanto ao modo.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Pill } from './Pill';

describe('Pill — modo compact (default)', () => {
  it('renderiza label + value inline, omite unit/deadline/date', () => {
    render(<Pill label="Suas metas" value={20} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-mode', 'compact');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Suas metas')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByText('Até:')).not.toBeInTheDocument();
  });

  it('aria-label sem unit é "label: value"', () => {
    render(<Pill label="Suas metas" value={20} />);
    expect(screen.getByRole('button', { name: 'Suas metas: 20' })).toBeInTheDocument();
  });

  it('aria-label com unit é "label: value unit"', () => {
    render(<Pill label="Suas metas" value={20} unit="Artes" />);
    expect(screen.getByRole('button', { name: 'Suas metas: 20 Artes' })).toBeInTheDocument();
  });

  it('aceita value como string', () => {
    render(<Pill label="Suas metas" value="--" />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});

describe('Pill — modo expanded', () => {
  it('renderiza value grande + unit + deadline + label + date', () => {
    render(
      <Pill label="Suas metas" value={20} unit="Artes" deadline="18:00h" date="27/05" expanded />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-mode', 'expanded');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Artes')).toBeInTheDocument();
    expect(screen.getByText('Até:')).toBeInTheDocument();
    expect(screen.getByText('18:00h')).toBeInTheDocument();
    expect(screen.getByText('Suas metas')).toBeInTheDocument();
    expect(screen.getByText('27/05')).toBeInTheDocument();
  });

  it('omite unit/deadline/date quando não passados', () => {
    render(<Pill label="Suas metas" value={20} expanded />);
    expect(screen.queryByText('Até:')).not.toBeInTheDocument();
    expect(screen.queryByText('Artes')).not.toBeInTheDocument();
  });

  it('renderiza apenas deadline quando date ausente', () => {
    render(<Pill label="Suas metas" value={20} deadline="18:00h" expanded />);
    expect(screen.getByText('18:00h')).toBeInTheDocument();
    expect(screen.queryByText('27/05')).not.toBeInTheDocument();
  });
});

describe('Pill — click handler', () => {
  it('click dispara onClick', () => {
    const onClick = vi.fn();
    render(<Pill label="Suas metas" value={20} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('click em expanded também dispara onClick (host pode tratar como toggle)', () => {
    const onClick = vi.fn();
    render(<Pill label="Suas metas" value={20} onClick={onClick} expanded />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sem onClick: click não joga (no-op)', () => {
    render(<Pill label="Suas metas" value={20} />);
    expect(() => {
      fireEvent.click(screen.getByRole('button'));
    }).not.toThrow();
  });
});

describe('Pill — a11y', () => {
  it('aria-expanded reflete o modo', () => {
    const { rerender } = render(<Pill label="Suas metas" value={20} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    rerender(<Pill label="Suas metas" value={20} expanded />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('botão tem type="button" (evita submit em forms)', () => {
    render(<Pill label="Suas metas" value={20} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Pill — prop position (Sessão 25)', () => {
  it('default position é center → data-position="center"', () => {
    render(<Pill label="Suas metas" value={20} />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    // Positioner externo (span) tem inline style com left: 50%
    expect(positioner?.style.left).toBe('50%');
    expect(positioner?.style.transform).toContain('translateX(-50%)');
    expect(screen.getByRole('button')).toHaveAttribute('data-position', 'center');
  });

  it('position="left" → left: 0% + transform translateX(-0%)', () => {
    render(<Pill label="Suas metas" value={20} position="left" />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    expect(positioner?.style.left).toBe('0%');
    expect(positioner?.style.transform).toContain('translateX(-0%)');
    expect(screen.getByRole('button')).toHaveAttribute('data-position', 'left');
  });

  it('position="right" → left: 100% + transform translateX(-100%)', () => {
    render(<Pill label="Suas metas" value={20} position="right" />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    expect(positioner?.style.left).toBe('100%');
    expect(positioner?.style.transform).toContain('translateX(-100%)');
    expect(screen.getByRole('button')).toHaveAttribute('data-position', 'right');
  });

  it('position=25 (number) → left: 25%', () => {
    render(<Pill label="Suas metas" value={20} position={25} />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    expect(positioner?.style.left).toBe('25%');
    expect(screen.getByRole('button')).toHaveAttribute('data-position', 'numeric');
  });

  it('position fora do range (-10) é clamped para 0', () => {
    render(<Pill label="Suas metas" value={20} position={-10} />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    expect(positioner?.style.left).toBe('0%');
  });

  it('position fora do range (150) é clamped para 100', () => {
    render(<Pill label="Suas metas" value={20} position={150} />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    expect(positioner?.style.left).toBe('100%');
  });

  it('position NaN cai no default 50%', () => {
    render(<Pill label="Suas metas" value={20} position={Number.NaN} />);
    const positioner = screen.getByRole('button').parentElement?.parentElement;
    expect(positioner?.style.left).toBe('50%');
  });
});

describe('Pill — variant', () => {
  it('default não adiciona classe urgent', () => {
    render(<Pill label="Suas metas" value={20} />);
    const btn = screen.getByRole('button');
    expect(btn.className).not.toMatch(/urgent/i);
  });

  it('variant=urgent adiciona classe pill--urgent (placeholder W4)', () => {
    render(<Pill label="Suas metas" value={20} variant="urgent" />);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/urgent/);
  });
});
