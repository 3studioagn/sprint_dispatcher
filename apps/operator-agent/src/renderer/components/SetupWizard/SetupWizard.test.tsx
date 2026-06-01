/**
 * Testes RTL do SetupWizard (BL-C5-006) — validação de habilitação, sondagem
 * de conexão (feedback OK/falha) e save (input correto + sucesso/erro).
 *
 * `window.api.setup.*` é mockado pelo test-setup global; cada teste sobrescreve
 * com `vi.mocked(...)` conforme necessário.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SetupWizard } from './SetupWizard';

const APP_NAME = 'Metas - Desenhistas';

function renderWizard(): void {
  render(<SetupWizard appName={APP_NAME} />);
}

describe('SetupWizard', () => {
  it('renderiza o nome do app e o botão Salvar começa desabilitado', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: APP_NAME })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar e iniciar/i })).toBeDisabled();
  });

  it('habilita Salvar quando user_id e pasta estão preenchidos', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText('user_id'), 'joao');
    await user.type(screen.getByLabelText('Caminho da pasta compartilhada'), '\\\\srv\\Metas');
    expect(screen.getByRole('button', { name: /salvar e iniciar/i })).toBeEnabled();
  });

  it('Testar conexão chama probe e mostra mensagem de sucesso', async () => {
    const user = userEvent.setup();
    vi.mocked(window.api.setup.probe).mockResolvedValue({
      reachable: true,
      message: 'Conexão OK — a pasta compartilhada está acessível.',
    });
    renderWizard();
    await user.type(screen.getByLabelText('Caminho da pasta compartilhada'), 'Z:\\Metas');
    await user.click(screen.getByRole('button', { name: /testar conexão/i }));

    expect(window.api.setup.probe).toHaveBeenCalledWith({ shared_path: 'Z:\\Metas' });
    expect(await screen.findByText(/pasta compartilhada está acessível/i)).toBeInTheDocument();
  });

  it('Testar conexão mostra mensagem de falha quando não reachable', async () => {
    const user = userEvent.setup();
    vi.mocked(window.api.setup.probe).mockResolvedValue({
      reachable: false,
      message: 'Pasta não encontrada. Verifique o caminho.',
    });
    renderWizard();
    await user.type(screen.getByLabelText('Caminho da pasta compartilhada'), 'Z:\\Errado');
    await user.click(screen.getByRole('button', { name: /testar conexão/i }));
    expect(await screen.findByText(/pasta não encontrada/i)).toBeInTheDocument();
  });

  it('Testar conexão fica desabilitado sem pasta preenchida', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /testar conexão/i })).toBeDisabled();
  });

  it('Salvar envia o input com nome de exibição e mostra sucesso', async () => {
    const user = userEvent.setup();
    vi.mocked(window.api.setup.save).mockResolvedValue({ ok: true, configPath: 'C:\\config.json' });
    renderWizard();
    await user.type(screen.getByLabelText('user_id'), 'joao');
    await user.type(screen.getByLabelText('Nome de exibição'), 'João Silva');
    await user.type(screen.getByLabelText('Caminho da pasta compartilhada'), '\\\\srv\\Metas');
    await user.click(screen.getByRole('button', { name: /salvar e iniciar/i }));

    expect(window.api.setup.save).toHaveBeenCalledWith({
      user_id: 'joao',
      shared_path: '\\\\srv\\Metas',
      user_nome_exibicao: 'João Silva',
    });
    expect(await screen.findByText(/configuração salva/i)).toBeInTheDocument();
  });

  it('Salvar omite user_nome_exibicao quando vazio', async () => {
    const user = userEvent.setup();
    vi.mocked(window.api.setup.save).mockResolvedValue({ ok: true, configPath: 'C:\\config.json' });
    renderWizard();
    await user.type(screen.getByLabelText('user_id'), 'maria');
    await user.type(screen.getByLabelText('Caminho da pasta compartilhada'), 'Z:\\Metas');
    await user.click(screen.getByRole('button', { name: /salvar e iniciar/i }));

    expect(window.api.setup.save).toHaveBeenCalledWith({
      user_id: 'maria',
      shared_path: 'Z:\\Metas',
    });
  });

  it('Salvar mostra erro inline (role=alert) quando o save falha', async () => {
    const user = userEvent.setup();
    vi.mocked(window.api.setup.save).mockResolvedValue({
      ok: false,
      code: 'VALIDATION',
      message: 'user_id aceita apenas [a-z0-9_-]',
    });
    renderWizard();
    await user.type(screen.getByLabelText('user_id'), 'joao');
    await user.type(screen.getByLabelText('Caminho da pasta compartilhada'), 'Z:\\Metas');
    await user.click(screen.getByRole('button', { name: /salvar e iniciar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/user_id aceita apenas/i);
    });
  });
});
