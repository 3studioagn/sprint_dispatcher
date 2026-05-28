/**
 * Testes do PillApp — root da janela do pill (BL-C3-017, redesigned
 * Sessão 24).
 *
 * Cobre:
 * - Pull inicial via pill.requestCurrent
 * - Push subsequente via pill.onUpdate
 * - Click toggla compact ↔ expanded (state local, sem IPC)
 * - Auto-collapse 5s após expansão
 * - Push pill:update reseta expanded para false
 * - Estado loading (info=null) renderiza wrapper vazio sem crash
 * - Click NÃO chama pill.expand (que foi removido na Sessão 24)
 */

import { createEvent, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Unsubscribe, PillUpdateEvent } from '../shared/ipc-types';

import PillApp from './PillApp';

const SPRINT_ID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const USER_ID = 'joao';

function makePillInfo(meta = 4) {
  return {
    sprintId: SPRINT_ID,
    userId: USER_ID,
    title: 'Hora do Rush',
    meta,
    deadline_at: '2026-05-26T21:00:00.000Z',
  };
}

// jsdom NÃO implementa setPointerCapture/releasePointerCapture — operações
// que jogam exception ao serem chamadas. Stub vazio para PillApp poder
// invocar normalmente em handlePointerDown/Up sem crash no teste.
beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

/**
 * Dispara um PointerEvent com `screenX` aplicado via `defineProperty`.
 * jsdom ignora `screenX` no init dict do PointerEvent constructor;
 * precisamos forçar a propriedade no objeto event antes de
 * `fireEvent`.
 */
function firePointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  el: HTMLElement,
  init: { pointerId: number; screenX: number },
): void {
  const event = createEvent[type](el, { pointerId: init.pointerId });
  Object.defineProperty(event, 'screenX', { value: init.screenX, configurable: true });
  fireEvent(el, event);
}

/**
 * Simula um "click puro" (sem drag) via pointer events. Sessão 26
 * substituiu `onClick` por pointer events em PillApp para distinguir
 * click de drag — testes precisam disparar pointerdown + pointerup
 * com mesmo screenX (zero movimento → classificado como click).
 */
function simulateClick(btn: HTMLElement, screenX = 100): void {
  firePointerEvent('pointerDown', btn, { pointerId: 1, screenX });
  firePointerEvent('pointerUp', btn, { pointerId: 1, screenX });
}

/**
 * Simula um drag horizontal: pointerdown + pointerMove com delta
 * suficiente para passar do threshold (5px) + pointerup.
 */
function simulateDrag(btn: HTMLElement, startX: number, endX: number): void {
  firePointerEvent('pointerDown', btn, { pointerId: 1, screenX: startX });
  firePointerEvent('pointerMove', btn, { pointerId: 1, screenX: endX });
  firePointerEvent('pointerUp', btn, { pointerId: 1, screenX: endX });
}

describe('PillApp — render inicial', () => {
  it('requestCurrent retornando null: renderiza placeholder sem botão', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(null);
    render(<PillApp />);
    await waitFor(() => {
      expect(window.api.pill.requestCurrent).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('requestCurrent retornando info: renderiza Pill em modo compact', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);
    const btn = await screen.findByRole('button', { name: /Suas metas: 4 Artes/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveAttribute('data-mode', 'compact');
  });

  it('falha em requestCurrent: NÃO joga + renderiza placeholder', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockRejectedValueOnce(new Error('IPC offline'));
    render(<PillApp />);
    await waitFor(() => {
      expect(window.api.pill.requestCurrent).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PillApp — click toggla compact ↔ expanded (Sessão 24)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('click no compact: vira expanded (aria-expanded=true)', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button', { name: /Suas metas/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      simulateClick(btn);
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button')).toHaveAttribute('data-mode', 'expanded');
  });

  it('click no expanded: volta para compact', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    act(() => {
      simulateClick(btn);
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      simulateClick(screen.getByRole('button'));
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('click NÃO chama nenhum IPC (puramente local)', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    const callsBeforeClick = vi.mocked(window.api.pill.requestCurrent).mock.calls.length;

    act(() => {
      simulateClick(btn);
    });

    // requestCurrent NÃO foi chamado de novo no click; nenhum outro IPC do pill.
    expect(vi.mocked(window.api.pill.requestCurrent).mock.calls.length).toBe(callsBeforeClick);
    expect(window.api.sprint.acknowledge).not.toHaveBeenCalled();
    expect(window.api.overlay.closeReopened).not.toHaveBeenCalled();
  });
});

describe('PillApp — auto-collapse após 5s (Sessão 24)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expanded auto-colapsa após 5s sem interação', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    act(() => {
      simulateClick(btn);
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');

    // Avança 5s − 1ms — ainda não disparou
    act(() => {
      vi.advanceTimersByTime(5000 - 1);
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');

    // Avança 1ms — auto-collapse dispara
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('click manual cancela auto-collapse (cleanup do useEffect)', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    act(() => {
      simulateClick(btn); // expand → timer armado
    });

    // 2s depois, operador clica manualmente → cancela timer + volta compact
    act(() => {
      vi.advanceTimersByTime(2000);
      simulateClick(screen.getByRole('button'));
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');

    // Avança o restante do tempo original do timer — não deve re-disparar
    // (cleanup já cancelou; novo click compactou).
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('PillApp — push onUpdate', () => {
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
    await waitFor(() => {
      expect(window.api.pill.onUpdate).toHaveBeenCalled();
    });

    const push = pushCallbacks[0];
    expect(push).toBeDefined();
    act(() => {
      push?.({ info: makePillInfo(9) });
    });

    const btn = await screen.findByRole('button', { name: /Suas metas: 9 Artes/i });
    expect(btn).toBeInTheDocument();
  });

  it('push pill:update reseta expanded para false (nova sprint = badge limpo)', async () => {
    const pushCallbacks: ((event: PillUpdateEvent) => void)[] = [];
    vi.mocked(window.api.pill.onUpdate).mockImplementationOnce(
      (cb: (event: PillUpdateEvent) => void): Unsubscribe => {
        pushCallbacks.push(cb);
        return (): void => undefined;
      },
    );
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));

    render(<PillApp />);
    const btn = await screen.findByRole('button');
    act(() => {
      simulateClick(btn); // expand
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');

    // Nova sprint chega via push
    const push = pushCallbacks[0];
    act(() => {
      push?.({ info: makePillInfo(9) });
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('PillApp — drag horizontal (Sessão 26)', () => {
  it('pointer down → IPC pill.beginDrag com e.screenX', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    firePointerEvent('pointerDown', btn, { pointerId: 1, screenX: 250 });

    await waitFor(() => {
      expect(window.api.pill.beginDrag).toHaveBeenCalledWith(250);
    });
  });

  it('drag (move > 5px) → IPC pill.dragTo + endDrag, sem toggle expand', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    simulateDrag(btn, 100, 200); // 100px de movimento → drag

    await waitFor(() => {
      expect(window.api.pill.beginDrag).toHaveBeenCalledWith(100);
      expect(window.api.pill.dragTo).toHaveBeenCalledWith(200);
      expect(window.api.pill.endDrag).toHaveBeenCalled();
    });

    // Movimento real → NÃO foi click → expanded permanece false
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('click puro (sem move) → toggle expand + endDrag', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    simulateClick(btn);

    await waitFor(() => {
      expect(window.api.pill.endDrag).toHaveBeenCalled();
    });
    expect(window.api.pill.dragTo).not.toHaveBeenCalled();
    // Click sem movimento → toggle expand
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('movimento abaixo do threshold (<5px) é tratado como click', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    // 3px de movimento — abaixo do DRAG_THRESHOLD_PX (5)
    firePointerEvent('pointerDown', btn, { pointerId: 1, screenX: 100 });
    firePointerEvent('pointerMove', btn, { pointerId: 1, screenX: 103 });
    firePointerEvent('pointerUp', btn, { pointerId: 1, screenX: 103 });

    await waitFor(() => {
      expect(window.api.pill.endDrag).toHaveBeenCalled();
    });
    expect(window.api.pill.dragTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('pointer cancel → endDrag sem toggle expand', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    firePointerEvent('pointerDown', btn, { pointerId: 1, screenX: 100 });
    firePointerEvent('pointerCancel', btn, { pointerId: 1, screenX: 100 });

    await waitFor(() => {
      expect(window.api.pill.endDrag).toHaveBeenCalled();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('vários pointermove durante drag enviam dragTo em sequência', async () => {
    vi.mocked(window.api.pill.requestCurrent).mockResolvedValueOnce(makePillInfo(4));
    render(<PillApp />);

    const btn = await screen.findByRole('button');
    firePointerEvent('pointerDown', btn, { pointerId: 1, screenX: 100 });
    firePointerEvent('pointerMove', btn, { pointerId: 1, screenX: 150 });
    firePointerEvent('pointerMove', btn, { pointerId: 1, screenX: 200 });
    firePointerEvent('pointerMove', btn, { pointerId: 1, screenX: 250 });
    firePointerEvent('pointerUp', btn, { pointerId: 1, screenX: 250 });

    await waitFor(() => {
      expect(window.api.pill.endDrag).toHaveBeenCalled();
    });
    // 3 calls de dragTo (uma por pointermove após threshold)
    expect(window.api.pill.dragTo).toHaveBeenCalledTimes(3);
    expect(window.api.pill.dragTo).toHaveBeenNthCalledWith(1, 150);
    expect(window.api.pill.dragTo).toHaveBeenNthCalledWith(2, 200);
    expect(window.api.pill.dragTo).toHaveBeenNthCalledWith(3, 250);
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
