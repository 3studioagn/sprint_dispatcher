import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { useOperatorsStore } from './stores/useOperatorsStore';
import { useSprintComposerStore } from './stores/useSprintComposerStore';

describe('App — routing (smoke)', () => {
  beforeEach(() => {
    window.location.hash = '#/nova';
    useOperatorsStore.setState({ operators: [], isLoaded: false });
    useSprintComposerStore.getState().reset();
  });

  it('renderiza Nova Sprint por default + sidebar com 3 links', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Nova Sprint', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova Sprint' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acompanhamento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument();
  });

  it('rota inicial sem hash redireciona para /nova', () => {
    window.location.hash = '';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Nova Sprint', level: 1 })).toBeInTheDocument();
  });

  it('rota inválida redireciona para /nova (fallback *)', () => {
    window.location.hash = '#/rota-inexistente';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Nova Sprint', level: 1 })).toBeInTheDocument();
  });

  it('clicar em "Acompanhamento" navega para a rota de Wave 2', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Acompanhamento' }));

    expect(screen.getByRole('heading', { name: 'Acompanhamento', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Em desenvolvimento — Wave 2/i)).toBeInTheDocument();
  });

  it('clicar em "Histórico" navega para a rota de Wave 3', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Histórico' }));

    expect(screen.getByRole('heading', { name: 'Histórico', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Em desenvolvimento — Wave 3/i)).toBeInTheDocument();
  });

  it('persistência inter-rotas: marcar operador → Histórico → voltar mantém seleção', async () => {
    const user = userEvent.setup();
    render(<App />);

    const joao = await screen.findByRole('checkbox', { name: /João Silva/ });
    await user.click(joao);
    expect(useSprintComposerStore.getState().selectedOperators.has('joao')).toBe(true);

    await user.click(screen.getByRole('link', { name: 'Histórico' }));
    expect(screen.getByRole('heading', { name: 'Histórico', level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Nova Sprint' }));
    const joaoBack = await screen.findByRole('checkbox', { name: /João Silva/ });
    expect(joaoBack).toBeChecked();
  });
});
