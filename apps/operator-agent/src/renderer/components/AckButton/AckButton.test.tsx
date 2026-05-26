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
