import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchSprintResponse } from '../../../shared/ipc-types';
import { useDispatchStore } from '../../stores/useDispatchStore';

import { DispatchModal } from './DispatchModal';

const SUCCESS_RESULT: DispatchSprintResponse = {
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

const PARTIAL_RESULT: DispatchSprintResponse = {
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

describe('DispatchModal', () => {
  beforeEach(() => {
    useDispatchStore.getState().reset();
  });

  it('não renderiza nada em estado idle', () => {
    const { container } = render(<DispatchModal onClose={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra spinner e texto em in_progress', () => {
    useDispatchStore.getState().start();
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: /Disparando rodada/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Despachando/i })).toBeInTheDocument();
  });

  it('NÃO renderiza botão Fechar em in_progress', () => {
    useDispatchStore.getState().start();
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
  });

  it('mostra título "Resultado da rodada" em completed', () => {
    useDispatchStore.getState().setResult(SUCCESS_RESULT);
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: /Resultado da rodada/i })).toBeInTheDocument();
  });

  it('mostra summary total/success/failed em completed', () => {
    useDispatchStore.getState().setResult({
      sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
      per_operator: [],
      summary: { total: 5, success: 3, failed: 2 },
    });
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('lista cada usuário com ✓ em sucesso total', () => {
    useDispatchStore.getState().setResult(SUCCESS_RESULT);
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
  });

  it('mostra mensagem de erro per-operator em sucesso parcial', () => {
    useDispatchStore.getState().setResult(PARTIAL_RESULT);
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByText('EACCES: permissão negada')).toBeInTheDocument();
  });

  it('mostra mensagem fatal em estado error', () => {
    useDispatchStore.getState().setError('Configuração ausente — corrija e tente novamente');
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: /Erro ao disparar/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Configuração ausente — corrija e tente novamente/),
    ).toBeInTheDocument();
  });

  it('fallback message quando globalError é null em estado error', () => {
    useDispatchStore.setState({ status: 'error', globalError: null, result: null });
    render(<DispatchModal onClose={() => undefined} />);
    expect(screen.getByText(/Erro inesperado ao disparar/i)).toBeInTheDocument();
  });

  it('chama onClose ao clicar Fechar em completed', async () => {
    const onClose = vi.fn();
    useDispatchStore.getState().setResult(SUCCESS_RESULT);
    const user = userEvent.setup();
    render(<DispatchModal onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('chama onClose ao clicar Fechar em error', async () => {
    const onClose = vi.fn();
    useDispatchStore.getState().setError('fatal');
    const user = userEvent.setup();
    render(<DispatchModal onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('modal tem role=dialog e aria-modal=true', () => {
    useDispatchStore.getState().setError('test');
    render(<DispatchModal onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dispatch-modal-title');
  });
});
