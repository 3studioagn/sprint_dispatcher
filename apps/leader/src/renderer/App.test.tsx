import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigErrorInfo } from '../shared/ipc-types';

import App from './App';
import { useOperatorsStore } from './stores/useOperatorsStore';
import { useSprintComposerStore } from './stores/useSprintComposerStore';

describe('App — boot (config check)', () => {
  beforeEach(() => {
    window.location.hash = '#/nova';
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
  });

  it('mostra estado loading enquanto getConfig está em vôo', () => {
    let resolveConfig!: (value: {
      ok: true;
      config: { shared_path: string; criado_por: string };
    }) => void;
    vi.mocked(window.api.getConfig).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveConfig = resolveConfig ?? resolve;
        resolveConfig = resolve;
      }),
    );
    render(<App />);
    expect(screen.getByText(/Carregando configuração/i)).toBeInTheDocument();
    resolveConfig({ ok: true, config: { shared_path: '/x', criado_por: 'T' } });
  });

  it('mostra ConfigErrorScreen quando getConfig retorna ok:false', async () => {
    const error: ConfigErrorInfo = {
      code: 'NOT_FOUND',
      message: 'Config inexistente em C:\\fake',
      expectedPath: 'C:\\fake\\config.json',
    };
    vi.mocked(window.api.getConfig).mockResolvedValueOnce({ ok: false, error });
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /Configuração não encontrada/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Config inexistente em C:\\fake/i)).toBeInTheDocument();
    expect(screen.getByText('C:\\fake\\config.json')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('rota inicial sem hash redireciona para /nova após config OK', async () => {
    window.location.hash = '';
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /Escolher pessoas/i, level: 1 }),
    ).toBeInTheDocument();
  });
});

describe('App — routing (smoke pós-config-ok)', () => {
  beforeEach(() => {
    window.location.hash = '#/nova';
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
  });

  it('renderiza Nova rodada por default + nav com 3 links', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /Escolher pessoas/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova rodada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acompanhamento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument();
  });

  it('rota inválida redireciona para /nova (fallback *)', async () => {
    window.location.hash = '#/rota-inexistente';
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /Escolher pessoas/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('clicar em "Acompanhamento" navega para a rota e mostra empty state quando nenhuma rodada foi disparada', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Escolher pessoas/i, level: 1 });
    await user.click(screen.getByRole('link', { name: 'Acompanhamento' }));
    expect(screen.getByRole('heading', { name: 'Acompanhamento', level: 1 })).toBeInTheDocument();
    // BL-C2-008: tela mostra empty state até o líder disparar uma rodada na sessão.
    expect(screen.getByText(/Nenhuma rodada disparada nesta sessão/i)).toBeInTheDocument();
  });

  it('clicar em "Histórico" navega para a rota de Wave 3', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Escolher pessoas/i, level: 1 });
    await user.click(screen.getByRole('link', { name: 'Histórico' }));
    expect(screen.getByRole('heading', { name: 'Histórico', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Em desenvolvimento — Wave 3/i)).toBeInTheDocument();
  });

  it('persistência inter-rotas: marcar usuário → Histórico → voltar mantém seleção', async () => {
    const user = userEvent.setup();
    render(<App />);
    const joao = await screen.findByRole('checkbox', { name: /João Silva/ });
    await user.click(joao);
    expect(useSprintComposerStore.getState().selectedOperators.has('joao')).toBe(true);

    await user.click(screen.getByRole('link', { name: 'Histórico' }));
    expect(screen.getByRole('heading', { name: 'Histórico', level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Nova rodada' }));
    const joaoBack = await screen.findByRole('checkbox', { name: /João Silva/ });
    expect(joaoBack).toBeChecked();
  });
});
