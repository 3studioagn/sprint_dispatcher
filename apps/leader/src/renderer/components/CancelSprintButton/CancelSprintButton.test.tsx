import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrackedSprintStore } from '../../stores/useTrackedSprintStore';

import { CancelSprintButton } from './CancelSprintButton';

const trackedStore = useTrackedSprintStore;

const SAMPLE_SPRINT = {
  sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
  dispatched_at: '2026-05-28T14:00:00.000Z',
  targets: [
    { user_id: 'joao', meta: 5 },
    { user_id: 'mario', meta: 8 },
  ],
  title: 'É hora de correr',
  deadline_hhmm: '18:00',
};

describe('CancelSprintButton (BL-C2-009)', () => {
  beforeEach(() => {
    trackedStore.getState().clear();
  });

  afterEach(() => {
    trackedStore.getState().clear();
  });

  describe('visibilidade', () => {
    it('retorna null quando não há sprint sendo rastreada', () => {
      const { container } = render(<CancelSprintButton />);
      expect(container.firstChild).toBeNull();
    });

    it('renderiza botão "Cancelar rodada" quando há sprint ativa', () => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
      render(<CancelSprintButton />);
      expect(screen.getByRole('button', { name: /Cancelar rodada/ })).toBeInTheDocument();
    });
  });

  describe('abrir e fechar diálogo', () => {
    beforeEach(() => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
    });

    it('clicar no botão abre o diálogo', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Cancelar esta rodada\?/)).toBeInTheDocument();
    });

    it('clicar em "Voltar" fecha o diálogo sem chamar IPC', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.click(screen.getByRole('button', { name: 'Voltar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(vi.mocked(window.api.cancelSprint)).not.toHaveBeenCalled();
    });

    it('clicar no backdrop fecha o diálogo', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      // backdrop tem role="presentation"
      const backdrop = screen.getByRole('presentation');
      await user.click(backdrop);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('confirmar cancelamento', () => {
    beforeEach(() => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
    });

    it('chama api.cancelSprint com sprint_id ao confirmar', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(vi.mocked(window.api.cancelSprint)).toHaveBeenCalledWith({
          sprint_id: SAMPLE_SPRINT.sprint_id,
        });
      });
    });

    it('envia motivo quando preenchido', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.type(screen.getByLabelText('Motivo do cancelamento'), 'Encerramento antecipado');
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(vi.mocked(window.api.cancelSprint)).toHaveBeenCalledWith({
          sprint_id: SAMPLE_SPRINT.sprint_id,
          motivo: 'Encerramento antecipado',
        });
      });
    });

    it('NÃO envia motivo quando só whitespace', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.type(screen.getByLabelText('Motivo do cancelamento'), '   ');
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(vi.mocked(window.api.cancelSprint)).toHaveBeenCalledWith({
          sprint_id: SAMPLE_SPRINT.sprint_id,
        });
      });
    });

    it('chama markCancelled na store após sucesso', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(trackedStore.getState().current?.cancelled).toBe(true);
      });
    });

    it('fecha o diálogo após sucesso', async () => {
      const user = userEvent.setup();
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('erros', () => {
    beforeEach(() => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
    });

    it('mostra mensagem de erro quando IPC retorna ok=false (NÃO chama markCancelled)', async () => {
      const user = userEvent.setup();
      vi.mocked(window.api.cancelSprint).mockResolvedValueOnce({
        ok: false,
        error: { code: 'CONFIG_REQUIRED', message: 'config faltando' },
      });
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/config faltando/);
      });
      expect(trackedStore.getState().current?.cancelled).toBe(false);
    });

    it('mostra mensagem de erro quando IPC lança', async () => {
      const user = userEvent.setup();
      vi.mocked(window.api.cancelSprint).mockRejectedValueOnce(new Error('IPC blew up'));
      render(<CancelSprintButton />);
      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/IPC blew up/);
      });
    });
  });
});
