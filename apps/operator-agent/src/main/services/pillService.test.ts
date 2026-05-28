/**
 * Testes do PillService — gestão do BrowserWindow do pill (BL-C3-017).
 *
 * Pattern de mock idêntico ao overlayService.test.ts: vi.hoisted +
 * vi.mock('electron') retorna spies controláveis. screen.getPrimaryDisplay
 * adicional para o pill calcular largura.
 */

import { parseSprintPayload } from '@sprint/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock electron.BrowserWindow + screen
// ============================================================================

const { mockBrowserWindow, mockBrowserWindowInstances, mockScreen } = vi.hoisted(() => {
  function makeMockWindow() {
    let isVisible = false;
    let destroyed = false;
    const showSpy = vi.fn(() => {
      isVisible = true;
    });
    return {
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      // once: auto-dispatch ready-to-show — replica o ciclo do Electron
      // que dispara o evento quando a página termina de carregar.
      // pillService usa win.once('ready-to-show', () => win.show()).
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'ready-to-show') cb();
      }),
      show: showSpy,
      hide: vi.fn(() => {
        isVisible = false;
      }),
      isDestroyed: vi.fn(() => destroyed),
      isVisible: vi.fn(() => isVisible),
      destroy: vi.fn(() => {
        destroyed = true;
      }),
      webContents: {
        send: vi.fn(),
      },
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

  const screen = {
    getPrimaryDisplay: vi.fn(() => ({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workAreaSize: { width: 1920, height: 1040 },
    })),
  };

  return {
    mockBrowserWindow: constructor,
    mockBrowserWindowInstances: instances,
    mockScreen: screen,
  };
});

vi.mock('electron', () => ({
  BrowserWindow: mockBrowserWindow,
  screen: mockScreen,
}));

// ============================================================================
// Import APÓS o mock
// ============================================================================

import { PillService } from './pillService';

const SPRINT_ID_1 = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const SPRINT_ID_2 = '01HXAAABBBCCCDDDEEEFFFGGGH';

// "now" fixo bem ANTES do deadline default em makePayload — garante
// que startDeadlineTimer agende em vez de dismissar imediatamente.
const FIXED_NOW = new Date('2026-05-26T10:00:00.000Z');

function makePayload(opts: { sprintId?: string; title?: string; meta?: number } = {}) {
  return parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId ?? SPRINT_ID_1,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: 'joao',
    title: opts.title ?? 'Hora do Rush',
    body_html: 'corpo',
    meta: opts.meta ?? 4,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
}

function lastWindow(): (typeof mockBrowserWindowInstances)[number] {
  const w = mockBrowserWindowInstances.at(-1);
  if (w === undefined) throw new Error('Nenhuma BrowserWindow criada ainda');
  return w;
}

describe('PillService — estado inicial', () => {
  let service: PillService;

  beforeEach(() => {
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  afterEach(() => {
    service.destroy();
  });

  it('getCurrent retorna null antes de show', () => {
    expect(service.getCurrent()).toBeNull();
  });

  it('isShown retorna false antes de show', () => {
    expect(service.isShown()).toBe(false);
  });

  it('hide em estado inicial é no-op (não cria janela)', () => {
    service.hide();
    expect(mockBrowserWindow).not.toHaveBeenCalled();
  });
});

describe('PillService — show (primeira chamada)', () => {
  let service: PillService;

  beforeEach(() => {
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  afterEach(() => {
    service.destroy();
  });

  it('primeira show cria BrowserWindow 340×160 centralizada no topo (Sessão 24)', () => {
    service.show(makePayload());
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    // Screen = 1920 wide; pill = 340 wide → x = (1920 - 340) / 2 = 790
    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 340,
        height: 160,
        x: 790,
        y: 0,
      }),
    );
  });

  it('cria janela com flags frameless + transparent + topmost + skipTaskbar', () => {
    service.show(makePayload());
    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
      }),
    );
  });

  it('seta setAlwaysOnTop screen-saver + setVisibleOnAllWorkspaces', () => {
    service.show(makePayload());
    const w = lastWindow();
    expect(w.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(w.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true,
    });
  });

  it('preenche currentInfo com subset visível ao renderer', () => {
    const payload = makePayload({ sprintId: SPRINT_ID_1, title: 'Hora do Rush', meta: 4 });
    service.show(payload);
    const info = service.getCurrent();
    expect(info).toEqual({
      sprintId: SPRINT_ID_1,
      userId: 'joao',
      title: 'Hora do Rush',
      meta: 4,
      deadline_at: '2026-05-26T21:00:00.000Z',
    });
  });

  it('currentInfo inclui deadline_at do payload (Sessão 24)', () => {
    service.show(makePayload());
    const info = service.getCurrent();
    expect(info?.deadline_at).toBe('2026-05-26T21:00:00.000Z');
  });
});

describe('PillService — show (subsequente, mesma janela)', () => {
  let service: PillService;

  beforeEach(() => {
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  afterEach(() => {
    service.destroy();
  });

  it('segunda show NÃO cria nova janela (reusa)', () => {
    service.show(makePayload({ sprintId: SPRINT_ID_1 }));
    service.show(makePayload({ sprintId: SPRINT_ID_2 }));
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
  });

  it('segunda show envia push pill:update com novo info', () => {
    service.show(makePayload({ sprintId: SPRINT_ID_1 }));
    const w = lastWindow();
    w.webContents.send.mockClear();

    service.show(makePayload({ sprintId: SPRINT_ID_2, title: 'Outra', meta: 7 }));

    expect(w.webContents.send).toHaveBeenCalledTimes(1);
    const [channel, event] = w.webContents.send.mock.calls[0] as [
      string,
      { info: { sprintId: string; title: string; meta: number } },
    ];
    expect(channel).toBe('pill:update');
    expect(event.info.sprintId).toBe(SPRINT_ID_2);
    expect(event.info.title).toBe('Outra');
    expect(event.info.meta).toBe(7);
  });

  it('show após hide volta a mostrar a janela', () => {
    service.show(makePayload());
    service.hide();
    const w = lastWindow();
    w.show.mockClear();

    service.show(makePayload({ sprintId: SPRINT_ID_2 }));

    expect(w.show).toHaveBeenCalledTimes(1);
  });
});

describe('PillService — hide', () => {
  let service: PillService;

  beforeEach(() => {
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  afterEach(() => {
    service.destroy();
  });

  it('hide (alias dismiss) limpa currentInfo + chama window.hide', () => {
    service.show(makePayload());
    expect(service.getCurrent()).not.toBeNull();

    service.hide();

    expect(service.getCurrent()).toBeNull();
    expect(lastWindow().hide).toHaveBeenCalledTimes(1);
  });

  it('hide duplicado é idempotente (não chama hide na window 2ª vez)', () => {
    service.show(makePayload());
    service.hide();
    const hideCount = lastWindow().hide.mock.calls.length;

    service.hide();

    expect(lastWindow().hide.mock.calls.length).toBe(hideCount);
  });

  it('isShown retorna false após hide', () => {
    service.show(makePayload());
    expect(service.isShown()).toBe(true);
    service.hide();
    expect(service.isShown()).toBe(false);
  });
});

describe('PillService — deadline timer (Sessão 23)', () => {
  let service: PillService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  function makePayloadWithDeadline(deadlineIso: string) {
    return parseSprintPayload({
      schema_version: '1.0',
      sprint_id: SPRINT_ID_1,
      criado_por: 'TestRenan',
      criado_em: '2026-05-26T09:00:00.000Z',
      user_id: 'joao',
      title: 'Hora do Rush',
      body_html: 'corpo',
      meta: 4,
      deadline_at: deadlineIso,
    });
  }

  it('show com deadline futuro: pill mostrado (não dismissed imediato)', () => {
    // FIXED_NOW = 2026-05-26T10:00; deadline = 2026-05-26T11:00 (1h futuro)
    service.show(makePayloadWithDeadline('2026-05-26T11:00:00.000Z'));
    expect(service.isShown()).toBe(true);
    expect(service.getCurrent()).not.toBeNull();
  });

  it('show com deadline JÁ EXPIRADO: dismissa imediato (sem criar janela)', () => {
    // FIXED_NOW = 2026-05-26T10:00; deadline = 2026-05-26T09:00 (1h passado)
    service.show(makePayloadWithDeadline('2026-05-26T09:00:00.000Z'));
    expect(service.getCurrent()).toBeNull();
    expect(mockBrowserWindow).not.toHaveBeenCalled();
  });

  it('timer dispara dismiss quando deadline alcançado', () => {
    // Deadline 1h após FIXED_NOW = 3_600_000 ms
    service.show(makePayloadWithDeadline('2026-05-26T11:00:00.000Z'));
    expect(service.isShown()).toBe(true);

    // Avança 1h - 1ms → ainda não disparou
    vi.advanceTimersByTime(3_600_000 - 1);
    expect(service.isShown()).toBe(true);

    // Avança 1ms → timer dispara → dismiss
    vi.advanceTimersByTime(1);
    expect(service.getCurrent()).toBeNull();
    expect(lastWindow().hide).toHaveBeenCalled();
  });

  it('show consecutivo reseta timer para o deadline mais novo', () => {
    service.show(makePayloadWithDeadline('2026-05-26T11:00:00.000Z')); // +1h
    service.show(makePayloadWithDeadline('2026-05-26T12:00:00.000Z')); // +2h (substitui)

    // Avança 1h05min — sob o primeiro deadline mas antes do segundo
    vi.advanceTimersByTime(3_900_000);
    expect(service.isShown()).toBe(true); // timer do 1º foi cancelado

    // Avança até o 2º deadline (mais 55min = 3_300_000)
    vi.advanceTimersByTime(3_300_000);
    expect(service.getCurrent()).toBeNull();
  });

  it('dismiss cancela timer (não dispara após cancelamento)', () => {
    service.show(makePayloadWithDeadline('2026-05-26T11:00:00.000Z'));
    service.dismiss();

    // Avança muito além do deadline original — timer não dispara dismiss
    // duplo nem cria efeito colateral (já está null).
    expect(() => {
      vi.advanceTimersByTime(10_000_000);
    }).not.toThrow();
    expect(service.getCurrent()).toBeNull();
  });

  it('destroy cancela timer', () => {
    service.show(makePayloadWithDeadline('2026-05-26T11:00:00.000Z'));
    service.destroy();

    expect(() => {
      vi.advanceTimersByTime(10_000_000);
    }).not.toThrow();
  });
});

describe('PillService — dismiss API (Sessão 24)', () => {
  let service: PillService;

  function makePayloadOK() {
    return parseSprintPayload({
      schema_version: '1.0',
      sprint_id: SPRINT_ID_1,
      criado_por: 'TestRenan',
      criado_em: '2026-05-26T09:00:00.000Z',
      user_id: 'joao',
      title: 'Hora do Rush',
      body_html: 'corpo',
      meta: 4,
      deadline_at: '2026-05-26T11:00:00.000Z',
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('dismiss limpa currentInfo + cancela timer + oculta janela', () => {
    service.show(makePayloadOK());
    expect(service.getCurrent()).not.toBeNull();

    service.dismiss();

    expect(service.getCurrent()).toBeNull();
    expect(lastWindow().hide).toHaveBeenCalled();

    // Timer cancelado — não dispara dismiss extra
    vi.advanceTimersByTime(10_000_000);
    expect(service.getCurrent()).toBeNull();
  });

  it('hide() funciona como alias para dismiss (retrocompat)', () => {
    service.show(makePayloadOK());
    service.hide();

    expect(service.getCurrent()).toBeNull();
  });
});

describe('PillService — destroy', () => {
  let service: PillService;

  beforeEach(() => {
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new PillService({ now: () => FIXED_NOW });
  });

  it('destroy destrói janela + reseta estado', () => {
    service.show(makePayload());
    const w = lastWindow();
    service.destroy();

    expect(w.destroy).toHaveBeenCalledTimes(1);
    expect(service.getCurrent()).toBeNull();
  });

  it('próximo show após destroy cria nova janela', () => {
    service.show(makePayload());
    service.destroy();
    service.show(makePayload({ sprintId: SPRINT_ID_2 }));

    expect(mockBrowserWindow).toHaveBeenCalledTimes(2);
  });

  it('destroy em estado inicial não joga', () => {
    expect(() => {
      service.destroy();
    }).not.toThrow();
  });
});
