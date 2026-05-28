/**
 * Testes do PillApp — root da janela do pill (BL-C3-017).
 *
 * Cobre:
 * - Pull inicial via pill.requestCurrent
 * - Push subsequente via pill.onUpdate
 * - Click → pill.expand
 * - Estado de loading (info=null) renderiza wrapper vazio sem crash
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Unsubscribe, PillUpdateEvent } from '../shared/ipc-types';

import PillApp from './PillApp';

const SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const USER_ID = 'joao';

describe('PillApp — render inicial', () => {
  it('com requestCurrent retornando null: renderiza placeholder sem crash', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(null);
    render(<PillApp />);
    // Sem badge — apenas wrapper vazio. Ausência de role=button confirma.
    await waitFor(() => {
      expect(window.api.pill.requestCurrent).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('com requestCurrent retornando info: renderiza OverlayMinimized', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce({
      sprintId: SPRINT_ID,
      userId: USER_ID,
      title: 'Hora do Rush',
      meta: 4,
    });
    render(<PillApp />);
    // OverlayMinimized renderiza um button com aria-label = `${label}: ${value}`
    const btn = await screen.findByRole('button', { name: /Hora do Rush: 4/i });
    expect(btn).toBeInTheDocument();
  });

  it('falha em requestCurrent: NÃO joga + renderiza placeholder', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockRejectedValueOnce(new Error('IPC offline'));
    render(<PillApp />);
    // Após rejection, info permanece null → placeholder
    await waitFor(() => {
      expect(window.api.pill.requestCurrent).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PillApp — onUpdate push', () => {
  it('push pill:update atualiza conteúdo do badge', async () => {
    const pushCallbacks: ((event: PillUpdateEvent) => void)[] = [];
    vi.mocked(window.api.pill.onUpdate).mockImplementationOnce(
      (cb: (event: PillUpdateEvent) => void): Unsubscribe => {
        pushCallbacks.push(cb);
        return (): void => undefined;
      },
    );
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(null);

    render(<PillApp />);

    // Aguarda mount + register de onUpdate
    await waitFor(() => {
      expect(window.api.pill.onUpdate).toHaveBeenCalled();
    });

    // Simula push com info nova
    const push = pushCallbacks[0];
    expect(push).toBeDefined();
    push?.({
      info: {
        sprintId: SPRINT_ID,
        userId: USER_ID,
        title: 'Nova sprint',
        meta: 9,
      },
    });

    const btn = await screen.findByRole('button', { name: /Nova sprint: 9/i });
    expect(btn).toBeInTheDocument();
  });
});

describe('PillApp — click no badge', () => {
  it('click chama window.api.pill.expand', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce({
      sprintId: SPRINT_ID,
      userId: USER_ID,
      title: 'Hora do Rush',
      meta: 4,
    });
    render(<PillApp />);

    const btn = await screen.findByRole('button', { name: /Hora do Rush: 4/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(window.api.pill.expand).toHaveBeenCalledTimes(1);
    });
  });

  it('click NÃO chama sprint.acknowledge (pill é outro fluxo)', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce({
      sprintId: SPRINT_ID,
      userId: USER_ID,
      title: 'Hora do Rush',
      meta: 4,
    });
    render(<PillApp />);

    const btn = await screen.findByRole('button', { name: /Hora do Rush: 4/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(window.api.pill.expand).toHaveBeenCalled();
    });
    expect(window.api.sprint.acknowledge).not.toHaveBeenCalled();
  });
});

describe('PillApp — cleanup', () => {
  it('unmount cancela subscription do onUpdate', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(window.api.pill.onUpdate).mockImplementationOnce((_cb): Unsubscribe => unsubscribe);
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(null);

    const { unmount } = render(<PillApp />);
    await waitFor(() => {
      expect(window.api.pill.onUpdate).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
