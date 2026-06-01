/**
 * Testes do SetupWizardService — gestão da janela do wizard (BL-C5-006).
 *
 * Pattern de mock idêntico ao pillService.test.ts: vi.hoisted + vi.mock(
 * 'electron') retorna um BrowserWindow controlável.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBrowserWindow, mockBrowserWindowInstances } = vi.hoisted(() => {
  function makeMockWindow() {
    let isVisible = false;
    let destroyed = false;
    return {
      show: vi.fn(() => {
        isVisible = true;
      }),
      focus: vi.fn(),
      close: vi.fn(() => {
        isVisible = false;
        destroyed = true;
      }),
      destroy: vi.fn(() => {
        destroyed = true;
      }),
      isVisible: vi.fn(() => isVisible),
      isDestroyed: vi.fn(() => destroyed),
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'ready-to-show') cb();
      }),
      on: vi.fn(),
      loadURL: vi.fn(() => Promise.resolve()),
      loadFile: vi.fn(() => Promise.resolve()),
    };
  }
  const instances: ReturnType<typeof makeMockWindow>[] = [];
  const constructor = vi.fn(() => {
    const w = makeMockWindow();
    instances.push(w);
    return w;
  });
  return { mockBrowserWindow: constructor, mockBrowserWindowInstances: instances };
});

vi.mock('electron', () => ({ BrowserWindow: mockBrowserWindow }));

import { SetupWizardService } from './setupWizardService';

beforeEach(() => {
  mockBrowserWindow.mockClear();
  mockBrowserWindowInstances.length = 0;
});

afterEach(() => {
  delete process.env.VITE_DEV_SERVER_URL;
});

describe('SetupWizardService', () => {
  it('show() cria a janela e carrega o renderer com ?setup', () => {
    const svc = new SetupWizardService();
    svc.show();
    expect(mockBrowserWindow).toHaveBeenCalledOnce();
    const win = mockBrowserWindowInstances[0]!;
    // prod (sem VITE_DEV_SERVER_URL) → loadFile com search 'setup'
    expect(win.loadFile).toHaveBeenCalledWith(expect.stringContaining('index.html'), {
      search: 'setup',
    });
    expect(win.show).toHaveBeenCalled();
  });

  it('show() repetido foca a janela existente sem recriar', () => {
    const svc = new SetupWizardService();
    svc.show();
    svc.show();
    expect(mockBrowserWindow).toHaveBeenCalledOnce();
    expect(mockBrowserWindowInstances[0]!.focus).toHaveBeenCalled();
  });

  it('isShown() reflete a visibilidade da janela', () => {
    const svc = new SetupWizardService();
    expect(svc.isShown()).toBe(false);
    svc.show();
    expect(svc.isShown()).toBe(true);
  });

  it('close() fecha a janela e isShown() volta a false', () => {
    const svc = new SetupWizardService();
    svc.show();
    const win = mockBrowserWindowInstances[0]!;
    svc.close();
    expect(win.close).toHaveBeenCalled();
    expect(svc.isShown()).toBe(false);
  });

  it('destroy() destrói a janela', () => {
    const svc = new SetupWizardService();
    svc.show();
    const win = mockBrowserWindowInstances[0]!;
    svc.destroy();
    expect(win.destroy).toHaveBeenCalled();
  });
});
