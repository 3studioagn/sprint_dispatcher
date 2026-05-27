/**
 * Testes do ErrorBanner — componente criado em sessão pós-auditoria W1
 * (fix de F-025) para surfacing de silent failures ao operador.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBanner } from './ErrorBanner';

describe('ErrorBanner', () => {
  it('renderiza role="alert" + título + mensagem + hint TI', () => {
    render(<ErrorBanner message="EACCES: permissão negada" />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText(/Não foi possível carregar os dados/i)).toBeInTheDocument();
    expect(screen.getByText(/EACCES: permissão negada/)).toBeInTheDocument();
    expect(screen.getByText(/Contate a TI/i)).toBeInTheDocument();
  });

  it('sem onRetry: NÃO renderiza botão "Tentar novamente"', () => {
    render(<ErrorBanner message="erro qualquer" />);
    expect(screen.queryByRole('button', { name: /Tentar novamente/i })).not.toBeInTheDocument();
  });

  it('com onRetry: renderiza botão "Tentar novamente" e dispara callback no click', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBanner message="erro recoverable" onRetry={onRetry} />);

    const btn = screen.getByRole('button', { name: /Tentar novamente/i });
    await user.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('onRetry assíncrono: callback chamado e promise não estoura', async () => {
    const onRetry = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    render(<ErrorBanner message="async err" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
