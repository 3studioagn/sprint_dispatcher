/**
 * Testes do Overlay — placeholder, render, click flow + reopen mode +
 * loading/error/warning UX (BL-C3-015).
 *
 * Refatorado para consumir `<Overlay>` do `@sprint/ui-kit`. Mudanças
 * vs W1:
 * - `aria-labelledby` mudou de `'sprint-title'` para
 *   `'sprint-overlay-title'` (definido pelo ui-kit).
 * - Botão sem autoFocus (default do ui-kit) — operador clica
 *   manualmente.
 * - Loading/error/warning agora no body slot — não mais no AckButton
 *   componente separado (deletado).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makePayload } from '../../__test-fixtures__/sprint';
import { useCurrentSprintStore } from '../../stores/useCurrentSprintStore';
import { useQueueStore } from '../../stores/useQueueStore';

import { Overlay } from './Overlay';

describe('Overlay — render inicial', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: null, isReopened: false });
    useQueueStore.setState({ length: 0 });
  });

  it('renderiza placeholder "Aguardando sprint…" quando store está vazia', () => {
    render(<Overlay />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/aguardando sprint/i)).toBeInTheDocument();
  });

  it('renderiza alertdialog completo quando há sprint atual', () => {
    useCurrentSprintStore.setState({ sprint: makePayload(), isReopened: false });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recebi/i })).toBeInTheDocument();
  });

  it('inclui o título da sprint (rotulado por aria-labelledby do ui-kit)', () => {
    const sprint = makePayload({ title: 'Meta especial' });
    useCurrentSprintStore.setState({ sprint, isReopened: false });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'sprint-overlay-title');
    expect(screen.getByRole('heading', { name: /meta especial/i })).toBeInTheDocument();
  });

  it('renderiza DeadlineBadge no body slot', () => {
    const sprint = makePayload({ deadlineIso: '2026-05-26T18:30:00.000Z' });
    useCurrentSprintStore.setState({ sprint, isReopened: false });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    expect(screen.getByText(/^prazo$/i)).toBeInTheDocument();
  });

  it('renderiza meta gigante com label "META"', () => {
    const sprint = makePayload({ meta: 12 });
    useCurrentSprintStore.setState({ sprint, isReopened: false });
    render(<Overlay />);
    expect(screen.getByText('META')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByLabelText(/meta: 12/i)).toBeInTheDocument();
  });
});

describe('Overlay — click flow (acknowledge)', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: makePayload(), isReopened: false });
    useQueueStore.setState({ length: 1 });
  });

  it('click "Recebi" chama window.api.sprint.acknowledge', async () => {
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));
    await waitFor(() => {
      expect(window.api.sprint.acknowledge).toHaveBeenCalledWith({
        sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
        user_id: 'joao',
      });
    });
  });

  it('durante invoke: label do botão muda para "Confirmando…"', async () => {
    let resolveFn:
      | ((v: { ok: true; data: { acknowledged_at: string; moved_to_history: boolean } }) => void)
      | undefined;
    vi.mocked(window.api.sprint.acknowledge).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeInTheDocument();
    });

    // Cleanup — resolve a promise pendente
    resolveFn?.({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
    });
  });

  it('guard contra double-click: segundo click durante loading é no-op', async () => {
    let resolveFn:
      | ((v: { ok: true; data: { acknowledged_at: string; moved_to_history: boolean } }) => void)
      | undefined;
    vi.mocked(window.api.sprint.acknowledge).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(<Overlay />);
    const btn = screen.getByRole('button', { name: /recebi/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeInTheDocument();
    });
    // Segundo click durante loading — handler retorna early via guard
    fireEvent.click(screen.getByRole('button', { name: /confirmando/i }));
    expect(window.api.sprint.acknowledge).toHaveBeenCalledTimes(1);

    resolveFn?.({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
    });
  });

  it('erro IpcResult.ok=false: mostra mensagem inline + label volta para "Recebi"', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: false,
      error: { code: 'IO_ERROR', message: 'SMB caiu' },
    });
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Falha ao confirmar/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/SMB caiu/);
      expect(screen.getByRole('button', { name: /recebi/i })).toBeInTheDocument();
    });
  });

  it('throw inesperado: mesma UX de erro', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockRejectedValueOnce(
      new Error('IPC channel inacessível'),
    );
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/IPC channel inacessível/);
    });
  });

  it('sucesso com moved_to_history: false → warning role="status" visível (F-024)', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: false },
    });
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    const warning = await screen.findByRole('status');
    expect(warning).toHaveTextContent(/Histórico local não foi atualizado/i);
  });

  it('sucesso com moved_to_history: true → SEM warning', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
    });
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeInTheDocument();
    });
    // Warning aria role="status" tem CONCORRENCIA com a placeholder
    // (mesmo role) — usamos texto para discriminar.
    expect(screen.queryByText(/Histórico local não foi atualizado/i)).not.toBeInTheDocument();
  });

  it('após erro, segundo click tenta de novo', async () => {
    vi.mocked(window.api.sprint.acknowledge)
      .mockResolvedValueOnce({ ok: false, error: { code: 'X', message: 'primeira falha' } })
      .mockResolvedValueOnce({
        ok: true,
        data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
      });
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));
    await waitFor(() => {
      expect(window.api.sprint.acknowledge).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Overlay — modo reaberto (BL-C3-009)', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: makePayload(), isReopened: true });
    useQueueStore.setState({ length: 0 });
  });

  it('renderiza botão "Fechar" em vez de "Recebi"', () => {
    render(<Overlay />);
    expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^recebi$/i })).not.toBeInTheDocument();
  });

  it('click "Fechar" chama overlay.closeReopened, NÃO sprint.acknowledge', async () => {
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    await waitFor(() => {
      expect(window.api.overlay.closeReopened).toHaveBeenCalledTimes(1);
    });
    expect(window.api.sprint.acknowledge).not.toHaveBeenCalled();
  });

  it('falha em closeReopened: mostra erro inline + label volta', async () => {
    vi.mocked(window.api.overlay.closeReopened).mockRejectedValueOnce(new Error('IPC offline'));
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/IPC offline/);
    });
  });

  it('NÃO checa moved_to_history (irrelevante em reopen)', async () => {
    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    await waitFor(() => {
      expect(window.api.overlay.closeReopened).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Histórico local não foi atualizado/i)).not.toBeInTheDocument();
  });

  it('reset loading após closeReopened — button volta para "Fechar" enabled (Sessão 23 fix)', async () => {
    // CRÍTICO: main BrowserWindow.hide() não destrói o renderer; React
    // tree fica mounted com state preservado. Sem reset, loading=true
    // persiste e bloqueia click futuro quando overlay re-abre via pill
    // (sintoma reportado: "não consigo fechar a overlay novamente").
    let resolveFn: (() => void) | undefined;
    vi.mocked(window.api.overlay.closeReopened).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(<Overlay />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));

    // Durante invoke: label é "Confirmando…"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeInTheDocument();
    });

    // Resolve closeReopened — loading DEVE resetar via finally.
    resolveFn?.();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument();
    });
  });
});
