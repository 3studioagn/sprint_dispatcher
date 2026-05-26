import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchSprintResponse } from '../../../shared/ipc-types';
import { useDispatchStore } from '../../stores/useDispatchStore';
import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { selectIsValid, useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { NovaSprint } from './NovaSprint';

const FULL_SUCCESS: DispatchSprintResponse = {
  sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
  per_operator: [
    {
      user_id: 'joao',
      user_nome_exibicao: 'João Silva',
      status: 'success',
      filename: '01HX9K2M4F8N7P2Q5R3S6T7V8W-joao.json',
    },
    {
      user_id: 'maria',
      user_nome_exibicao: 'Maria Souza',
      status: 'success',
      filename: '01HX9K2M4F8N7P2Q5R3S6T7V8W-maria.json',
    },
  ],
  summary: { total: 2, success: 2, failed: 0 },
};

const PARTIAL: DispatchSprintResponse = {
  sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
  per_operator: [
    {
      user_id: 'joao',
      user_nome_exibicao: 'João Silva',
      status: 'success',
      filename: '01HX9K2M4F8N7P2Q5R3S6T7V8W-joao.json',
    },
    {
      user_id: 'maria',
      user_nome_exibicao: 'Maria Souza',
      status: 'error',
      error_message: 'EACCES: permissão negada',
    },
  ],
  summary: { total: 2, success: 1, failed: 1 },
};

describe('NovaSprint — render base', () => {
  beforeEach(() => {
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
    useDispatchStore.getState().reset();
  });

  it('header + sections + botão Disparar evento renderizam', () => {
    render(<NovaSprint />);
    expect(
      screen.getByRole('heading', { name: /Escolher pessoas/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Usuários', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Horário/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disparar evento/i })).toBeInTheDocument();
  });

  it('carrega operadores via useEffect ao montar (IPC)', async () => {
    render(<NovaSprint />);
    expect(await screen.findByRole('checkbox', { name: /João Silva/ })).toBeInTheDocument();
    expect(useOperatorsStore.getState().status).toBe('loaded');
  });

  it('status inicial: "Nenhum usuário selecionado" + "Preencha todos os campos"', () => {
    render(<NovaSprint />);
    expect(screen.getByText('Nenhum usuário selecionado')).toBeInTheDocument();
    expect(screen.getByText(/Preencha todos os campos/i)).toBeInTheDocument();
  });

  it('botão Disparar evento inicia desabilitado por form inválido', () => {
    render(<NovaSprint />);
    const button = screen.getByRole('button', { name: /Disparar evento/i });
    expect(button).toBeDisabled();
    expect(button.getAttribute('title')).toContain('Preencha todos os campos');
  });
});

describe('NovaSprint — fluxo de validação do composer', () => {
  beforeEach(() => {
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
    useDispatchStore.getState().reset();
  });

  it('botão habilita quando 4 usuários marcados + metas válidas + deadline', async () => {
    const user = userEvent.setup();
    render(<NovaSprint />);

    const joao = await screen.findByRole('checkbox', { name: /João Silva/ });
    await user.click(joao);
    const joaoMeta = screen.getByRole('spinbutton');
    await user.type(joaoMeta, '5');

    await user.click(screen.getByRole('button', { name: 'Marcar todos' }));
    expect(useSprintComposerStore.getState().selectedOperators.get('joao')).toBe(5);
    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(4);

    useSprintComposerStore.getState().setMeta('maria', 10);
    useSprintComposerStore.getState().setMeta('carlos', 7);
    useSprintComposerStore.getState().setMeta('beatriz', 3);

    const deadlineInput = screen.getByLabelText(/Horário/i);
    fireEvent.change(deadlineInput, { target: { value: '20:00' } });

    expect(selectIsValid(useSprintComposerStore.getState())).toBe(true);
    expect(screen.getByText('4 usuários selecionados')).toBeInTheDocument();
    expect(screen.getByText('Pronto para disparar')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Disparar evento/i });
    expect(button).toBeEnabled();
    expect(button.getAttribute('title')).toBe('Disparar evento');
  });

  it('contagem singular quando exatamente 1 usuário selecionado', async () => {
    const user = userEvent.setup();
    render(<NovaSprint />);

    const joao = await screen.findByRole('checkbox', { name: /João Silva/ });
    await user.click(joao);

    expect(screen.getByText('1 usuário selecionado')).toBeInTheDocument();
  });

  it('clicar no botão (disabled por form inválido) é no-op', async () => {
    const user = userEvent.setup();
    render(<NovaSprint />);

    const button = screen.getByRole('button', { name: /Disparar evento/i });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(useDispatchStore.getState().status).toBe('idle');
  });
});

describe('NovaSprint — dispatch real (BL-C2-007)', () => {
  beforeEach(() => {
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
    useDispatchStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fillValidForm(): void {
    useSprintComposerStore.getState().toggleOperator('joao');
    useSprintComposerStore.getState().setMeta('joao', 5);
    useSprintComposerStore.getState().toggleOperator('maria');
    useSprintComposerStore.getState().setMeta('maria', 8);
  }

  it('happy path: Disparar → modal com resultado → fechar reseta form + toast', async () => {
    vi.mocked(window.api.dispatchSprint).mockResolvedValueOnce({
      ok: true,
      data: FULL_SUCCESS,
    });

    const user = userEvent.setup();
    render(<NovaSprint />);
    await screen.findByRole('checkbox', { name: /João Silva/ });
    fillValidForm();

    await user.click(screen.getByRole('button', { name: /Disparar evento/i }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: /Resultado da rodada/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('João Silva')).toBeInTheDocument();
    expect(within(dialog).getByText('Maria Souza')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));

    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(0);
    expect(screen.getByText(/Rodada disparada com sucesso/i)).toBeInTheDocument();
  });

  it('falha parcial: 1 erro → fechar mantém form + toast warning', async () => {
    vi.mocked(window.api.dispatchSprint).mockResolvedValueOnce({
      ok: true,
      data: PARTIAL,
    });

    const user = userEvent.setup();
    render(<NovaSprint />);
    await screen.findByRole('checkbox', { name: /João Silva/ });
    fillValidForm();

    await user.click(screen.getByRole('button', { name: /Disparar evento/i }));

    expect(
      await screen.findByRole('heading', { name: /Resultado da rodada/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/EACCES/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(2);
    expect(screen.getByText(/Algumas falhas/i)).toBeInTheDocument();
  });

  it('erro fatal (ok:false) → modal mostra erro → fechar mantém form sem toast', async () => {
    vi.mocked(window.api.dispatchSprint).mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFIG_REQUIRED', message: 'config.json ausente' },
    });

    const user = userEvent.setup();
    render(<NovaSprint />);
    await screen.findByRole('checkbox', { name: /João Silva/ });
    fillValidForm();

    await user.click(screen.getByRole('button', { name: /Disparar evento/i }));

    expect(await screen.findByRole('heading', { name: /Erro ao disparar/i })).toBeInTheDocument();
    expect(screen.getByText(/config.json ausente/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(2);
    expect(screen.queryByText(/Rodada disparada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Algumas falhas/i)).not.toBeInTheDocument();
  });

  it('exceção do IPC vira erro fatal no dispatchStore', async () => {
    vi.mocked(window.api.dispatchSprint).mockRejectedValueOnce(new Error('IPC crashed'));

    const user = userEvent.setup();
    render(<NovaSprint />);
    await screen.findByRole('checkbox', { name: /João Silva/ });
    fillValidForm();

    await user.click(screen.getByRole('button', { name: /Disparar evento/i }));

    expect(await screen.findByRole('heading', { name: /Erro ao disparar/i })).toBeInTheDocument();
    expect(screen.getByText(/IPC crashed/)).toBeInTheDocument();
  });

  it('botão fica disabled durante in_progress', async () => {
    let resolveDispatch!: (value: { ok: true; data: DispatchSprintResponse }) => void;
    vi.mocked(window.api.dispatchSprint).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDispatch = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<NovaSprint />);
    await screen.findByRole('checkbox', { name: /João Silva/ });
    fillValidForm();

    const button = screen.getByRole('button', { name: /Disparar evento/i });
    await user.click(button);

    // Durante in_progress, o label do botão muda para "Disparando…" e fica disabled
    expect(await screen.findByRole('button', { name: /Disparando/i })).toBeDisabled();
    expect(screen.getByRole('heading', { name: /Disparando rodada/i })).toBeInTheDocument();

    resolveDispatch({ ok: true, data: FULL_SUCCESS });
    await waitFor(() => {
      expect(useDispatchStore.getState().status).toBe('completed');
    });
  });
});
