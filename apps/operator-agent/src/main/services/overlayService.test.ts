/**
 * Testes do OverlayService — state machine + timer de minimização +
 * push IPC. BrowserWindow do Electron é mockado para isolar a lógica.
 *
 * Cobre os 3 cenários explícitos do prompt § Gate 5:
 * - showSprint cria timer.
 * - restoreCurrent reseta timer (D4 do Gate 1).
 * - minimize disparado após minimizeAfterMs.
 *
 * Mais alguns adicionais: getCurrentEvent, sendQueueUpdate, hide,
 * destroy, onStateChange.
 */

import { parseSprintPayload } from '@sprint/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem } from '../../shared/types/queue';

// ============================================================================
// Mock electron.BrowserWindow
// ============================================================================
// Cada `new BrowserWindow(...)` retorna uma instância isolada com spies
// individuais — testes podem inspecionar `mockBrowserWindow.mock.results`
// para acessar a window criada.

// CLAUDE.md G-015 + vi.hoisted: vi.mock é hoisted para o topo do arquivo.
// Para a factory referenciar variáveis declaradas pelo teste, usamos
// `vi.hoisted` que move a declaração junto. Mesmo padrão recomendado pela
// doc do vitest 1.x para fábricas que precisam de spies inspecionáveis.

const { mockBrowserWindow, mockBrowserWindowInstances, mockScreen } = vi.hoisted(() => {
  // Tipo inferido pelo retorno de `makeMockWindow` — evita o variance
  // issue de `ReturnType<typeof vi.fn>` (Mock<any[], unknown>) vs
  // `vi.fn(() => Promise.resolve())` (Mock<[], Promise<void>>).
  function makeMockWindow() {
    let isVisible = false;
    let destroyed = false;
    return {
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setBounds: vi.fn(),
      once: vi.fn(),
      show: vi.fn(() => {
        isVisible = true;
      }),
      hide: vi.fn(() => {
        isVisible = false;
      }),
      focus: vi.fn(),
      isDestroyed: vi.fn(() => destroyed),
      isVisible: vi.fn(() => isVisible),
      destroy: vi.fn(() => {
        destroyed = true;
      }),
      webContents: {
        send: vi.fn(),
        openDevTools: vi.fn(),
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

import { OverlayService, type OverlayState } from './overlayService';

const MINIMIZE_AFTER_MS = 30_000;
const SPRINT_ID_1 = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const SPRINT_ID_2 = '01HXAAABBBCCCDDDEEEFFFGGGH';

function makeItem(opts: { sprintId?: string } = {}): QueueItem {
  const payload = parseSprintPayload({
    schema_version: '1.0',
    sprint_id: opts.sprintId ?? SPRINT_ID_1,
    criado_por: 'TestRenan',
    criado_em: '2026-05-26T09:00:00.000Z',
    user_id: 'joao',
    title: 'Teste',
    body_html: 'corpo',
    meta: 5,
    deadline_at: '2026-05-26T21:00:00.000Z',
  });
  return {
    payload,
    filename: `${payload.sprint_id}-${payload.user_id}.json`,
    rawContent: JSON.stringify(payload, null, 2),
  };
}

function lastWindow(): (typeof mockBrowserWindowInstances)[number] {
  const w = mockBrowserWindowInstances.at(-1);
  if (w === undefined) throw new Error('Nenhuma BrowserWindow criada ainda');
  return w;
}

describe('OverlayService — estado inicial', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('state inicial é "hidden"', () => {
    expect(service.getState()).toBe('hidden');
  });

  it('getCurrentEvent retorna null antes de showSprint', () => {
    expect(service.getCurrentEvent()).toBeNull();
  });

  it('sendQueueUpdate sem janela é no-op (não joga)', () => {
    expect(() => {
      service.sendQueueUpdate(5);
    }).not.toThrow();
    expect(mockBrowserWindow).not.toHaveBeenCalled();
  });
});

describe('OverlayService — showSprint', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('primeira chamada cria BrowserWindow + transiciona para "showing"', () => {
    service.showSprint(makeItem(), 1);
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(service.getState()).toBe('showing');
  });

  it('inicia timer de minimização (não disparado imediatamente)', () => {
    service.showSprint(makeItem(), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS - 1);
    expect(service.getState()).toBe('showing');
    expect(lastWindow().hide).not.toHaveBeenCalled();
  });

  it('getCurrentEvent retorna sprint + queueLength após showSprint', () => {
    service.showSprint(makeItem({ sprintId: SPRINT_ID_1 }), 3);
    const event = service.getCurrentEvent();
    expect(event).not.toBeNull();
    expect(event?.sprint.sprint_id).toBe(SPRINT_ID_1);
    expect(event?.queueLength).toBe(3);
  });

  it('segunda chamada (janela existente) envia push sprint:incoming', () => {
    service.showSprint(makeItem({ sprintId: SPRINT_ID_1 }), 1);
    const w = lastWindow();
    w.webContents.send.mockClear();

    service.showSprint(makeItem({ sprintId: SPRINT_ID_2 }), 2);

    // Segunda chamada NÃO cria nova janela
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    // Push enviado com a nova sprint — inspeção direta do call args evita
    // o `any` propagado pelos `expect.objectContaining` aninhados.
    expect(w.webContents.send).toHaveBeenCalledTimes(1);
    const [channel, payload] = w.webContents.send.mock.calls[0] as [
      string,
      { sprint: { sprint_id: string }; queueLength: number },
    ];
    expect(channel).toBe('sprint:incoming');
    expect(payload.sprint.sprint_id).toBe(SPRINT_ID_2);
    expect(payload.queueLength).toBe(2);
    expect(w.show).toHaveBeenCalled();
    expect(w.focus).toHaveBeenCalled();
  });

  it('showSprint sempre reseta o timer (chamadas consecutivas)', () => {
    service.showSprint(makeItem({ sprintId: SPRINT_ID_1 }), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS - 5_000);
    expect(service.getState()).toBe('showing');

    // Nova showSprint reseta o timer — minimize NÃO dispara após avanço total > MINIMIZE_AFTER_MS
    service.showSprint(makeItem({ sprintId: SPRINT_ID_2 }), 2);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS - 1);
    expect(service.getState()).toBe('showing');

    // Agora ultrapassa o novo timer
    vi.advanceTimersByTime(2);
    expect(service.getState()).toBe('minimized');
  });
});

describe('OverlayService — minimize automático após timer', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('após minimizeAfterMs, transiciona para "minimized" + hide chamado', () => {
    service.showSprint(makeItem(), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS);
    expect(service.getState()).toBe('minimized');
    expect(lastWindow().hide).toHaveBeenCalled();
  });

  it('envia push overlay:minimize ao renderer no auto-minimize', () => {
    service.showSprint(makeItem(), 1);
    const w = lastWindow();
    w.webContents.send.mockClear();
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS);
    expect(w.webContents.send).toHaveBeenCalledWith('overlay:minimize', {});
  });

  it('NÃO dispara minimize uma segunda vez (timer é one-shot)', () => {
    service.showSprint(makeItem(), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS);
    const hideCallCount = lastWindow().hide.mock.calls.length;
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS * 3);
    expect(lastWindow().hide.mock.calls.length).toBe(hideCallCount);
  });
});

describe('OverlayService — restoreCurrent', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('a partir de minimized: show + focus + state="showing"', () => {
    service.showSprint(makeItem(), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS);
    expect(service.getState()).toBe('minimized');

    const w = lastWindow();
    w.show.mockClear();
    w.focus.mockClear();

    service.restoreCurrent();

    expect(service.getState()).toBe('showing');
    expect(w.show).toHaveBeenCalledTimes(1);
    expect(w.focus).toHaveBeenCalledTimes(1);
  });

  it('RESETA o timer (D4 do Gate 1) — não minimize antes do novo intervalo', () => {
    service.showSprint(makeItem(), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS); // → minimized
    expect(service.getState()).toBe('minimized');

    service.restoreCurrent(); // novo timer
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS - 1);
    expect(service.getState()).toBe('showing'); // timer ainda não disparou

    vi.advanceTimersByTime(2);
    expect(service.getState()).toBe('minimized'); // agora sim
  });

  it('no-op quando state já é "showing" (idempotência)', () => {
    service.showSprint(makeItem(), 1);
    expect(service.getState()).toBe('showing');
    const w = lastWindow();
    w.show.mockClear();
    w.focus.mockClear();

    service.restoreCurrent();
    expect(w.show).not.toHaveBeenCalled();
    expect(w.focus).not.toHaveBeenCalled();
  });

  it('no-op quando state é "hidden" e não há janela (sem sprint atual)', () => {
    expect(service.getState()).toBe('hidden');
    service.restoreCurrent();
    expect(mockBrowserWindow).not.toHaveBeenCalled();
    expect(service.getState()).toBe('hidden');
  });
});

describe('OverlayService — hide + destroy + clearTimer', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hide() limpa timer + transiciona para "hidden" + currentItem null', () => {
    service.showSprint(makeItem(), 1);
    service.hide();
    expect(service.getState()).toBe('hidden');
    expect(service.getCurrentEvent()).toBeNull();
    expect(lastWindow().hide).toHaveBeenCalled();

    // Timer cancelado — minimize não dispara após hide
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS * 2);
    // hide já foi chamado uma vez; não devem haver chamadas extra
    expect(lastWindow().hide).toHaveBeenCalledTimes(1);
  });

  it('clearTimer cancela timer sem mudar state', () => {
    service.showSprint(makeItem(), 1);
    expect(service.getState()).toBe('showing');
    service.clearTimer();
    expect(service.getState()).toBe('showing'); // state preservado
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS * 2);
    expect(service.getState()).toBe('showing'); // timer não disparou
  });

  it('destroy() destrói janela + reseta state', () => {
    service.showSprint(makeItem(), 1);
    const w = lastWindow();
    service.destroy();
    expect(w.destroy).toHaveBeenCalled();
    expect(service.getState()).toBe('hidden');
    expect(service.getCurrentEvent()).toBeNull();
  });

  it('próximo showSprint após destroy cria nova janela', () => {
    service.showSprint(makeItem(), 1);
    service.destroy();
    service.showSprint(makeItem(), 1);
    expect(mockBrowserWindow).toHaveBeenCalledTimes(2);
  });
});

describe('OverlayService — sendQueueUpdate', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('envia queue:updated push após showSprint', () => {
    service.showSprint(makeItem(), 1);
    const w = lastWindow();
    w.webContents.send.mockClear();
    service.sendQueueUpdate(5);
    expect(w.webContents.send).toHaveBeenCalledWith('queue:updated', { queueLength: 5 });
  });

  it('atualiza o snapshot consumido por getCurrentEvent', () => {
    service.showSprint(makeItem(), 1);
    service.sendQueueUpdate(7);
    expect(service.getCurrentEvent()?.queueLength).toBe(7);
  });
});

describe('OverlayService — onStateChange', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('callback recebe cada transição de estado', () => {
    const cb = vi.fn<[OverlayState], void>();
    service.onStateChange(cb);
    service.showSprint(makeItem(), 1);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS);
    service.restoreCurrent();
    expect(cb.mock.calls.map((c) => c[0])).toEqual(['showing', 'minimized', 'showing']);
  });

  it('transição idêntica NÃO dispara callback (idempotência)', () => {
    const cb = vi.fn();
    service.onStateChange(cb);
    service.showSprint(makeItem(), 1);
    service.showSprint(makeItem({ sprintId: SPRINT_ID_2 }), 2); // ainda showing
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe remove o listener', () => {
    const cb = vi.fn();
    const unsub = service.onStateChange(cb);
    unsub();
    service.showSprint(makeItem(), 1);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('OverlayService — BrowserWindow construction args (regressão F-002)', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('regressão F-002: BrowserWindow do overlay é criado com skipTaskbar: true (backlog BL-C3-004 AC4 + CLAUDE.md §8.2)', () => {
    service.showSprint(makeItem(), 1);
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow).toHaveBeenCalledWith(expect.objectContaining({ skipTaskbar: true }));
  });

  it('regressão F-002: demais flags TOPMOST presentes no constructor (defesa em profundidade — fullscreen, frame:false, alwaysOnTop)', () => {
    service.showSprint(makeItem(), 1);
    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        fullscreen: true,
        frame: false,
        alwaysOnTop: true,
      }),
    );
  });

  it('Sessão 23 fix: constructor recebe width/height da tela primária (fullscreen real)', () => {
    service.showSprint(makeItem(), 1);
    expect(mockBrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      }),
    );
  });

  it('Sessão 23 fix: setBounds chamado com display.bounds (defesa contra fullscreen ignorado)', () => {
    service.showSprint(makeItem(), 1);
    expect(lastWindow().setBounds).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });
});

describe('OverlayService — reopenFromHistory + closeReopened (BL-C3-009)', () => {
  let service: OverlayService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
    service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('reopenFromHistory cria janela na primeira chamada + state="showing"', () => {
    service.reopenFromHistory(makeItem().payload);
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(service.getState()).toBe('showing');
    expect(service.isReopened()).toBe(true);
  });

  it('reopenFromHistory NÃO toca em currentItem (preserva null)', () => {
    expect(service.getCurrentEvent()).toBeNull();
    service.reopenFromHistory(makeItem({ sprintId: SPRINT_ID_1 }).payload);
    expect(service.getCurrentEvent()).toBeNull();
  });

  it('reopenFromHistory envia push sprint:incoming com reopened:true', () => {
    service.reopenFromHistory(makeItem({ sprintId: SPRINT_ID_1 }).payload);
    const w = lastWindow();
    expect(w.webContents.send).toHaveBeenCalledTimes(1);
    const [channel, payload] = w.webContents.send.mock.calls[0] as [
      string,
      { sprint: { sprint_id: string }; queueLength: number; reopened: boolean },
    ];
    expect(channel).toBe('sprint:incoming');
    expect(payload.sprint.sprint_id).toBe(SPRINT_ID_1);
    expect(payload.queueLength).toBe(0);
    expect(payload.reopened).toBe(true);
  });

  it('reopenFromHistory NÃO inicia timer de minimize (operador controla)', () => {
    service.reopenFromHistory(makeItem().payload);
    vi.advanceTimersByTime(MINIMIZE_AFTER_MS * 3);
    expect(service.getState()).toBe('showing'); // sem timer → não minimiza
    expect(lastWindow().hide).not.toHaveBeenCalled();
  });

  it('reopenFromHistory em janela hidden existente apenas exibe', () => {
    // Show normal → hide → reopen reusa a janela
    service.showSprint(makeItem(), 1);
    service.hide();
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);

    service.reopenFromHistory(makeItem({ sprintId: SPRINT_ID_2 }).payload);
    // Mesma janela
    expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(lastWindow().show).toHaveBeenCalled();
    expect(service.isReopened()).toBe(true);
  });

  it('closeReopened: hide + reopenedMode=false + state="hidden"', () => {
    service.reopenFromHistory(makeItem().payload);
    expect(service.isReopened()).toBe(true);

    service.closeReopened();

    expect(service.isReopened()).toBe(false);
    expect(service.getState()).toBe('hidden');
    expect(lastWindow().hide).toHaveBeenCalled();
  });

  it('closeReopened fora do modo é no-op (não toca window)', () => {
    // showSprint normal, depois closeReopened — deve ser no-op
    service.showSprint(makeItem(), 1);
    const w = lastWindow();
    const initialHideCalls = w.hide.mock.calls.length;
    const initialState = service.getState();

    service.closeReopened();

    expect(w.hide.mock.calls.length).toBe(initialHideCalls); // sem hide adicional
    expect(service.getState()).toBe(initialState);
  });

  it('showSprint normal após reopen limpa reopenedMode', () => {
    service.reopenFromHistory(makeItem({ sprintId: SPRINT_ID_1 }).payload);
    expect(service.isReopened()).toBe(true);

    service.showSprint(makeItem({ sprintId: SPRINT_ID_2 }), 1);
    expect(service.isReopened()).toBe(false);
  });

  it('hide limpa reopenedMode', () => {
    service.reopenFromHistory(makeItem().payload);
    expect(service.isReopened()).toBe(true);
    service.hide();
    expect(service.isReopened()).toBe(false);
  });

  it('destroy limpa reopenedMode', () => {
    service.reopenFromHistory(makeItem().payload);
    expect(service.isReopened()).toBe(true);
    service.destroy();
    expect(service.isReopened()).toBe(false);
  });
});

describe('OverlayService — som de notificação (BL-C3-014)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowserWindow.mockClear();
    mockBrowserWindowInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getCurrentEvent inclui playSound=true por default (som habilitado)', () => {
    const service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
    service.showSprint(makeItem(), 1);
    expect(service.getCurrentEvent()?.playSound).toBe(true);
    service.destroy();
  });

  it('push sprint:incoming (janela existente) carrega playSound=true', () => {
    const service = new OverlayService({ minimizeAfterMs: MINIMIZE_AFTER_MS });
    service.showSprint(makeItem({ sprintId: SPRINT_ID_1 }), 1);
    const w = lastWindow();
    w.webContents.send.mockClear();
    service.showSprint(makeItem({ sprintId: SPRINT_ID_2 }), 2);
    const [, payload] = w.webContents.send.mock.calls[0] as [string, { playSound?: boolean }];
    expect(payload.playSound).toBe(true);
    service.destroy();
  });

  it('som_notificacao=false → playSound=false no pull e no push', () => {
    const service = new OverlayService({
      minimizeAfterMs: MINIMIZE_AFTER_MS,
      somNotificacao: false,
    });
    service.showSprint(makeItem({ sprintId: SPRINT_ID_1 }), 1);
    expect(service.getCurrentEvent()?.playSound).toBe(false);

    const w = lastWindow();
    w.webContents.send.mockClear();
    service.showSprint(makeItem({ sprintId: SPRINT_ID_2 }), 2);
    const [, payload] = w.webContents.send.mock.calls[0] as [string, { playSound?: boolean }];
    expect(payload.playSound).toBe(false);
    service.destroy();
  });

  it('reopenFromHistory NUNCA toca som (playSound=false) mesmo com som habilitado', () => {
    const service = new OverlayService({
      minimizeAfterMs: MINIMIZE_AFTER_MS,
      somNotificacao: true,
    });
    service.reopenFromHistory(makeItem().payload);
    const w = lastWindow();
    const [, payload] = w.webContents.send.mock.calls[0] as [
      string,
      { playSound?: boolean; reopened?: boolean },
    ];
    expect(payload.reopened).toBe(true);
    expect(payload.playSound).toBe(false);
    service.destroy();
  });
});
