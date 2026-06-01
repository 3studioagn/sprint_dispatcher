import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrackedSprintStore } from '../../stores/useTrackedSprintStore';

import { Acompanhamento } from './Acompanhamento';

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

describe('Acompanhamento (BL-C2-008)', () => {
  beforeEach(() => {
    trackedStore.getState().clear();
  });

  afterEach(() => {
    trackedStore.getState().clear();
    vi.useRealTimers();
  });

  describe('estado vazio', () => {
    it('mostra mensagem de empty quando não há sprint sendo rastreada', () => {
      render(<Acompanhamento />);
      expect(screen.getByText(/Nenhuma rodada disparada/i)).toBeInTheDocument();
    });
  });

  describe('com sprint rastreada', () => {
    beforeEach(() => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
    });

    it('renderiza título da sprint no resumo', async () => {
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText('É hora de correr')).toBeInTheDocument();
      });
    });

    it('renderiza deadline e count de operadores', async () => {
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText('18:00h')).toBeInTheDocument();
      });
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 operadores
    });

    it('chama api.listAcks com sprint_id e targets ao montar', async () => {
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(vi.mocked(window.api.listAcks)).toHaveBeenCalledWith(
          SAMPLE_SPRINT.sprint_id,
          SAMPLE_SPRINT.targets,
        );
      });
    });

    it('renderiza target "não visto" quando ack ausente', async () => {
      vi.mocked(window.api.listAcks).mockResolvedValueOnce({
        ok: true,
        data: {
          targets: [{ user_id: 'joao', user_nome_exibicao: 'João Silva', state: 'nao_visto' }],
          checked_at: '2026-05-28T14:00:00.000Z',
        },
      });
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      expect(screen.getByText('Não visto')).toBeInTheDocument();
    });

    it('renderiza target "visto" com timestamp', async () => {
      vi.mocked(window.api.listAcks).mockResolvedValueOnce({
        ok: true,
        data: {
          targets: [
            {
              user_id: 'joao',
              user_nome_exibicao: 'João Silva',
              state: 'visto',
              displayed_at: '2026-05-28T14:30:15.000Z',
            },
          ],
          checked_at: '2026-05-28T14:00:00.000Z',
        },
      });
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText('Visto')).toBeInTheDocument();
      });
    });

    it('renderiza target "confirmado" com timestamp', async () => {
      vi.mocked(window.api.listAcks).mockResolvedValueOnce({
        ok: true,
        data: {
          targets: [
            {
              user_id: 'joao',
              user_nome_exibicao: 'João Silva',
              state: 'confirmado',
              displayed_at: '2026-05-28T14:30:15.000Z',
              acknowledged_at: '2026-05-28T14:30:20.000Z',
            },
          ],
          checked_at: '2026-05-28T14:00:00.000Z',
        },
      });
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText('Confirmado')).toBeInTheDocument();
      });
    });

    it('chama api.listAcks de novo após 3s (polling)', async () => {
      vi.useFakeTimers();
      render(<Acompanhamento />);
      await vi.waitFor(() => {
        expect(vi.mocked(window.api.listAcks)).toHaveBeenCalledTimes(1);
      });

      await vi.advanceTimersByTimeAsync(3_000);
      await vi.waitFor(() => {
        expect(vi.mocked(window.api.listAcks)).toHaveBeenCalledTimes(2);
      });

      await vi.advanceTimersByTimeAsync(3_000);
      await vi.waitFor(() => {
        expect(vi.mocked(window.api.listAcks)).toHaveBeenCalledTimes(3);
      });
    });

    it('para o polling no unmount (cleanup do useEffect)', async () => {
      vi.useFakeTimers();
      const { unmount } = render(<Acompanhamento />);
      await vi.waitFor(() => {
        expect(vi.mocked(window.api.listAcks)).toHaveBeenCalledTimes(1);
      });

      unmount();
      await vi.advanceTimersByTimeAsync(10_000);

      // Nada de novo deve ter sido chamado
      expect(vi.mocked(window.api.listAcks)).toHaveBeenCalledTimes(1);
    });

    it('renderiza mensagem de erro quando IPC retorna ok=false', async () => {
      vi.mocked(window.api.listAcks).mockResolvedValueOnce({
        ok: false,
        error: { code: 'CONFIG_REQUIRED', message: 'config faltando' },
      });
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/config faltando/);
      });
    });

    it('renderiza mensagem de erro quando IPC throws', async () => {
      vi.mocked(window.api.listAcks).mockRejectedValueOnce(new Error('IPC blew up'));
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/IPC blew up/);
      });
    });
  });

  describe('estado pós-cancelamento (BL-C2-009)', () => {
    beforeEach(() => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
      trackedStore.getState().markCancelled();
    });

    it('renderiza mensagem "rodada cancelada"', async () => {
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText(/Esta rodada foi/i)).toBeInTheDocument();
      });
      // Note: "cancelada" aparece tanto no subtitle quanto na nota inferior
      const cancelados = screen.getAllByText(/cancelada/i);
      expect(cancelados.length).toBeGreaterThanOrEqual(1);
    });

    it('NÃO renderiza o botão "Cancelar rodada" quando sprint já está cancelada', async () => {
      render(<Acompanhamento />);
      await waitFor(() => {
        expect(screen.getByText(/Esta rodada foi/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Cancelar rodada/ })).not.toBeInTheDocument();
    });

    it('NÃO chama api.listAcks (polling parou)', async () => {
      vi.useFakeTimers();
      render(<Acompanhamento />);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(vi.mocked(window.api.listAcks)).not.toHaveBeenCalled();
    });
  });

  describe('cancelar sprint via botão (integração ponta-a-ponta no renderer)', () => {
    beforeEach(() => {
      trackedStore.getState().setCurrent(SAMPLE_SPRINT);
    });

    it('clicar em Cancelar rodada → modal → Confirmar cancelamento → chama api.cancelSprint', async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      const user = userEvent.setup();
      render(<Acompanhamento />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancelar rodada/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Cancelar rodada/ }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Confirmar cancelamento/ }));

      await waitFor(() => {
        expect(vi.mocked(window.api.cancelSprint)).toHaveBeenCalledWith({
          sprint_id: SAMPLE_SPRINT.sprint_id,
        });
      });
      await waitFor(() => {
        expect(trackedStore.getState().current?.cancelled).toBe(true);
      });
    });
  });
});
