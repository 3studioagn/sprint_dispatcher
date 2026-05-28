/**
 * Testes do AckButton — fluxo funcional Gate 6.
 *
 * Cobre:
 * - Click chama `window.api.sprint.acknowledge` com sprint_id+user_id.
 * - Loading state durante invoke (button disabled + label muda).
 * - Sucesso: state NÃO muda (renderer espera next sprint OU hide via push).
 * - Erro (`ok: false`): mensagem inline + button volta a habilitado.
 * - Throw inesperado: mesma UX.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AckButton } from './AckButton';

const SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const USER_ID = 'joao';

describe('AckButton — render inicial', () => {
  beforeEach(() => {
    // test-setup.ts reseta os mocks; defaults retornam ok:true
  });

  it('renderiza com label "Recebi" + autoFocus + habilitado', () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    const btn = screen.getByRole('button', { name: /recebi/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeEnabled();
  });

  it('não mostra mensagem de erro inicialmente', () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AckButton — click flow', () => {
  it('click chama window.api.sprint.acknowledge com sprint_id e user_id', async () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));
    await waitFor(() => {
      expect(window.api.sprint.acknowledge).toHaveBeenCalledWith({
        sprint_id: SPRINT_ID,
        user_id: USER_ID,
      });
    });
  });

  it('durante invoke: button disabled + label "Confirmando…"', async () => {
    // Mock que NUNCA resolve — fica pending para inspecionar loading state
    let resolveFn:
      | ((v: { ok: true; data: { acknowledged_at: string; moved_to_history: boolean } }) => void)
      | undefined;
    vi.mocked(window.api.sprint.acknowledge).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    const btn = screen.getByRole('button', { name: /recebi/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeDisabled();
    });

    // Cleanup — resolve a promise pendente
    resolveFn?.({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
    });
  });

  it('sucesso: state local NÃO muda (button continua "Confirmando…" até remount)', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
    });
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    // Após sucesso, o renderer espera o `sprint:incoming` push da próxima
    // sprint (que via key={sprint_id} faz remount). Em isolamento (sem
    // próxima sprint), o button fica em "Confirmando…" — comportamento OK.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeInTheDocument();
    });
  });

  it('erro IpcResult.ok=false: mostra mensagem + reabilita button', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: false,
      error: { code: 'IO_ERROR', message: 'SMB caiu' },
    });
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Falha ao confirmar/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/SMB caiu/);
      expect(screen.getByRole('button', { name: /recebi/i })).toBeEnabled();
    });
  });

  it('throw inesperado: mesma UX de erro', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockRejectedValueOnce(
      new Error('IPC channel inacessível'),
    );
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/IPC channel inacessível/);
      expect(screen.getByRole('button', { name: /recebi/i })).toBeEnabled();
    });
  });

  it('após erro, segundo click tenta de novo', async () => {
    vi.mocked(window.api.sprint.acknowledge)
      .mockResolvedValueOnce({ ok: false, error: { code: 'X', message: 'primeira falha' } })
      .mockResolvedValueOnce({
        ok: true,
        data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
      });
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
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

describe('AckButton — moved_to_history: false (regressão F-024)', () => {
  it('regressão F-024: sucesso com moved_to_history: false → warning role="status" visível', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: false },
    });
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    const warning = await screen.findByRole('status');
    expect(warning).toHaveTextContent(/Histórico local não foi atualizado/i);
    expect(warning).toHaveTextContent(/confirmada com sucesso/i);

    // Sem role="alert" — não é erro, apenas warning não-bloqueante
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('regressão F-024: sucesso com moved_to_history: true → SEM warning', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: true },
    });
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    // Aguarda o invoke completar — button passa para "Confirmando…"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmando/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('regressão F-024: warning persiste enquanto button fica disabled (loading=true) — esperando remount via sprint:incoming push', async () => {
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: false },
    });

    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));

    // Aguarda o ack completar (sucesso, mas archive falhou)
    await screen.findByRole('status');

    // Button permanece disabled ("Confirmando…") esperando o React remount
    // disparado pelo próximo `sprint:incoming` ou `overlay:minimize`. UX
    // intencional: ack já foi escrito, operador não deve re-clicar.
    expect(screen.getByRole('button', { name: /confirmando/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/Histórico local não foi atualizado/i);
  });

  it('regressão F-024: warning não suprime mensagem de erro de sprints subsequentes (após remount via key)', async () => {
    // Remount via key — simula novo sprint:incoming chegando.
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: true,
      data: { acknowledged_at: '2026-05-26T10:00:00.000Z', moved_to_history: false },
    });

    const { rerender } = render(
      <AckButton key={SPRINT_ID} sprintId={SPRINT_ID} userId={USER_ID} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));
    await screen.findByRole('status');

    // Remount com novo sprint_id — React cria componente do zero
    const SPRINT_ID_2 = '01HXAAABBBCCCDDDEEEFFFGGGH';
    vi.mocked(window.api.sprint.acknowledge).mockResolvedValueOnce({
      ok: false,
      error: { code: 'IO', message: 'segunda falha' },
    });
    rerender(<AckButton key={SPRINT_ID_2} sprintId={SPRINT_ID_2} userId={USER_ID} />);

    // Após remount: warning some, button volta a habilitado
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recebi/i })).toBeEnabled();

    // Novo click → mostra erro da segunda chamada
    fireEvent.click(screen.getByRole('button', { name: /recebi/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/segunda falha/);
    });
  });
});

describe('AckButton — modo reaberto (BL-C3-009)', () => {
  it('reopened=true: renderiza label "Fechar" em vez de "Recebi"', () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} reopened />);
    expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recebi/i })).not.toBeInTheDocument();
  });

  it('reopened=true: click chama overlay.closeReopened, NÃO sprint.acknowledge', async () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} reopened />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));

    await waitFor(() => {
      expect(window.api.overlay.closeReopened).toHaveBeenCalledTimes(1);
    });
    expect(window.api.sprint.acknowledge).not.toHaveBeenCalled();
  });

  it('reopened=true: NÃO mostra warning de moved_to_history (irrelevante em reopen)', async () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} reopened />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));

    // Espera o handler async terminar
    await waitFor(() => {
      expect(window.api.overlay.closeReopened).toHaveBeenCalled();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reopened=true: falha em closeReopened mostra mensagem de erro inline', async () => {
    vi.mocked(window.api.overlay.closeReopened).mockRejectedValueOnce(new Error('IPC offline'));
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} reopened />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Falha ao fechar/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/IPC offline/);
    });
  });

  it('reopened=false (default): comportamento Recebi inalterado', () => {
    render(<AckButton sprintId={SPRINT_ID} userId={USER_ID} reopened={false} />);
    expect(screen.getByRole('button', { name: /recebi/i })).toBeInTheDocument();
  });
});
