import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Overlay } from './Overlay';

describe('<Overlay>', () => {
  it('renderiza title e body fornecidos', () => {
    render(
      <Overlay
        title="Hora do Rush!"
        body="Sua meta hoje é 20 artes"
        onAcknowledge={vi.fn()}
        autoCloseSeconds={0}
      />,
    );

    expect(screen.getByText('Hora do Rush!')).toBeInTheDocument();
    expect(screen.getByText('Sua meta hoje é 20 artes')).toBeInTheDocument();
  });

  it('usa label default "Recebido" no botão e dispara onAcknowledge ao clicar', () => {
    const onAck = vi.fn();

    render(<Overlay title="t" body="b" onAcknowledge={onAck} autoCloseSeconds={0} />);

    const button = screen.getByRole('button', { name: 'Recebido' });
    expect(button).toBeInTheDocument();
    // fireEvent (síncrono) em vez de userEvent para evitar conflitos
    // com vi.useFakeTimers em outros testes do mesmo arquivo. Para o
    // botão de ack, a fidelidade extra do userEvent (hover, focus,
    // pointer events) não testa nada que ainda não esteja coberto.
    fireEvent.click(button);
    expect(onAck).toHaveBeenCalledOnce();
  });

  it('permite override do label via prop acknowledgeLabel', () => {
    render(
      <Overlay
        title="t"
        body="b"
        onAcknowledge={vi.fn()}
        acknowledgeLabel="OK, entendi"
        autoCloseSeconds={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'OK, entendi' })).toBeInTheDocument();
  });

  it('dispara onAcknowledge automaticamente após autoCloseSeconds', () => {
    vi.useFakeTimers();
    try {
      const onAck = vi.fn();
      render(<Overlay title="t" body="b" onAcknowledge={onAck} autoCloseSeconds={3} />);

      expect(onAck).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3000);
      expect(onAck).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('NÃO agenda timer quando autoCloseSeconds <= 0', () => {
    vi.useFakeTimers();
    try {
      const onAck = vi.fn();
      render(<Overlay title="t" body="b" onAcknowledge={onAck} autoCloseSeconds={0} />);

      vi.advanceTimersByTime(60_000);
      expect(onAck).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renderiza com role=alertdialog + aria-modal + aria-labelledby', () => {
    render(<Overlay title="Acessível" body="b" onAcknowledge={vi.fn()} autoCloseSeconds={0} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'sprint-overlay-title');
    expect(screen.getByText('Acessível').id).toBe('sprint-overlay-title');
  });

  it('variant="urgent" compõe className adicional (placeholder visual)', () => {
    const { container } = render(
      <Overlay title="t" body="b" onAcknowledge={vi.fn()} variant="urgent" autoCloseSeconds={0} />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    // 2 classes (base + urgent) compostas via template string
    expect(wrapper.className.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('renderiza body como ReactNode complexo (slot pattern)', () => {
    render(
      <Overlay
        title="t"
        body={
          <div>
            <strong data-testid="metric">20</strong>
            <span> artes</span>
          </div>
        }
        onAcknowledge={vi.fn()}
        autoCloseSeconds={0}
      />,
    );

    expect(screen.getByTestId('metric').textContent).toBe('20');
  });
});
