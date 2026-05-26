/**
 * OverlayService — gestão do BrowserWindow do overlay TOPMOST + state machine.
 *
 * Responsabilidades (Gate 5):
 *
 * - Cria/reutiliza a `BrowserWindow` do overlay com props de §8.1 + TOPMOST
 *   `screen-saver`.
 * - `showSprint(item, queueLength)` — primeira chamada cria a janela;
 *   subsequentes mandam `sprint:incoming` push + revelam. Inicia (ou
 *   reseta) o **timer de minimização** (`minimizeAfterMs`).
 * - `minimize()` — disparado pelo timer OU manualmente. Limpa timer, oculta
 *   janela, envia push `overlay:minimize`, transiciona para `'minimized'`.
 * - `restoreCurrent()` — operador clicou "Mostrar sprint atual" no tray.
 *   Mostra janela, foca, **reseta o timer** (D4 do Gate 1).
 * - `clearTimer()` — uso interno (Gate 6: cancela timer ao ack final).
 * - `sendQueueUpdate(length)` — push `queue:updated` para badge "+N".
 * - `getCurrentEvent()` — pull pattern consumido pelo handler IPC.
 * - **Event emitter** `onStateChange` para subscribers externos
 *   (trayService re-sincroniza state visual).
 *
 * **State machine:**
 * ```
 *  HIDDEN  ──showSprint──▶  SHOWING  ──timer──▶  MINIMIZED  ──restoreCurrent──▶  SHOWING
 *     ▲                        │                       │                              │
 *     │                        │                       └──restoreCurrent──▶  SHOWING ─┘
 *     │                        │
 *     └────────────hide()──────┘  (Gate 6: ack final + fila vazia)
 * ```
 *
 * **Gate 6 expandirá:** `handleAck(sprintId, userId)` orquestrando ackService
 * + historyService + dequeue + próxima sprint (call `showSprint` se peek)
 * ou `hide()` se vazia.
 *
 * @see DECISIONS.md ADR-011 — arquitetura tray-resident
 * @see CLAUDE.md §8.1 — segurança obrigatória Electron
 * @see CLAUDE.md §8.2 — TOPMOST `screen-saver`
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';

import { BrowserWindow } from 'electron';

import type { IncomingSprintEvent } from '../../shared/ipc-types';
import type { QueueItem } from '../../shared/types/queue';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

const STATE_CHANGE_EVENT = 'stateChange';

export type OverlayState = 'hidden' | 'showing' | 'minimized';

export interface OverlayServiceDeps {
  /** Timer de auto-minimize em ms. Default 30000 (D2 do Gate 1). */
  minimizeAfterMs: number;
}

export type OverlayStateUnsubscribe = () => void;

export class OverlayService {
  private window: BrowserWindow | null = null;
  private state: OverlayState = 'hidden';
  private currentItem: QueueItem | null = null;
  private currentQueueLength = 0;
  private minimizeTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly minimizeAfterMs: number;
  private readonly emitter = new EventEmitter();

  constructor(deps: OverlayServiceDeps) {
    this.minimizeAfterMs = deps.minimizeAfterMs;
  }

  /**
   * Exibe uma sprint. Cria janela na primeira chamada; nas subsequentes
   * envia push `sprint:incoming`. Sempre RESETA o timer de minimização.
   */
  showSprint(item: QueueItem, queueLength: number): void {
    this.currentItem = item;
    this.currentQueueLength = queueLength;

    if (this.window === null || this.window.isDestroyed()) {
      // Primeira exibição — cria janela. Renderer pulla currentItem
      // via `sprint:request-current` no mount.
      this.window = this.createWindow();
    } else {
      // Janela já existe (ack de sprint anterior + próxima na fila,
      // OU restoreCurrent + nova sprint). Push direto.
      this.window.webContents.send('sprint:incoming', {
        sprint: item.payload,
        queueLength,
      } satisfies IncomingSprintEvent);
      if (!this.window.isVisible()) this.window.show();
      this.window.focus();
    }
    this.transitionTo('showing');
    this.restartMinimizeTimer();
  }

  /**
   * Oculta a janela e transiciona para `'minimized'`. Limpa timer.
   * Envia push `overlay:minimize` ao renderer (para reset de UI futuro;
   * Gate 6 pode usar para cancelar ack-in-flight).
   *
   * **NÃO escreve `acknowledged_at`** — só timer disparou OU operador
   * fechou via tray sem clicar "Recebi". A sprint segue pendente na fila.
   */
  minimize(): void {
    if (this.window === null || this.window.isDestroyed()) return;
    if (this.state !== 'showing') return; // idempotência
    this.clearMinimizeTimer();
    this.window.webContents.send('overlay:minimize', {});
    this.window.hide();
    this.transitionTo('minimized');
  }

  /**
   * Reabre overlay minimizado + foca + reseta timer (D4 do Gate 1 —
   * "operador voltou para a tela, dar tempo de novo"). No-op se overlay
   * já está showing ou se não há janela (estado 'hidden').
   */
  restoreCurrent(): void {
    if (this.window === null || this.window.isDestroyed()) return;
    if (this.state === 'showing') return; // já visível, no-op
    if (this.currentItem === null) return; // sem sprint para mostrar
    this.window.show();
    this.window.focus();
    this.transitionTo('showing');
    this.restartMinimizeTimer();
  }

  /**
   * Cancela o timer de minimização sem mudar de estado. Uso primário em
   * Gate 6: quando o operador clica "Recebi", o handleAck cancela o timer
   * antes de processar o ack (evita race entre ack + minimize).
   */
  clearTimer(): void {
    this.clearMinimizeTimer();
  }

  /**
   * Push `queue:updated` ao renderer. Mantém o snapshot da queue length
   * para o pull pattern (`getCurrentEvent`).
   */
  sendQueueUpdate(queueLength: number): void {
    this.currentQueueLength = queueLength;
    if (this.window === null || this.window.isDestroyed()) return;
    this.window.webContents.send('queue:updated', { queueLength });
  }

  /**
   * Snapshot consumido pelo handler `sprint:request-current`. Renderer
   * pulla no mount inicial para evitar race com push timing.
   */
  getCurrentEvent(): IncomingSprintEvent | null {
    if (this.currentItem === null) return null;
    return {
      sprint: this.currentItem.payload,
      queueLength: this.currentQueueLength,
    };
  }

  /** Estado atual — uso primário em testes integrados + trayService refresh. */
  getState(): OverlayState {
    return this.state;
  }

  /**
   * Esconde sem destruir + limpa timer + transiciona para 'hidden'.
   * Uso Gate 6: ack final quando a fila esvazia (nenhuma sprint a exibir).
   * Diferente de `minimize`, NÃO envia `overlay:minimize` push — caller
   * (handleAck) tem semântica diferente.
   */
  hide(): void {
    if (this.window === null || this.window.isDestroyed()) return;
    this.clearMinimizeTimer();
    this.window.hide();
    this.currentItem = null;
    this.currentQueueLength = 0;
    this.transitionTo('hidden');
  }

  /**
   * Destrói a janela e limpa todo estado interno. Uso em cleanup raro.
   */
  destroy(): void {
    this.clearMinimizeTimer();
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.currentItem = null;
    this.currentQueueLength = 0;
    this.transitionTo('hidden');
  }

  /**
   * Registra callback para mudanças de estado. Retorna função de
   * unsubscribe — caller usa em cleanup. Uso primário: trayService
   * resincronizar estado visual quando overlay minimize/show.
   */
  onStateChange(cb: (state: OverlayState) => void): OverlayStateUnsubscribe {
    this.emitter.on(STATE_CHANGE_EVENT, cb);
    return () => {
      this.emitter.off(STATE_CHANGE_EVENT, cb);
    };
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private transitionTo(state: OverlayState): void {
    if (this.state === state) return;
    this.state = state;
    this.emitter.emit(STATE_CHANGE_EVENT, state);
  }

  private restartMinimizeTimer(): void {
    this.clearMinimizeTimer();
    this.minimizeTimer = setTimeout(() => {
      this.minimize();
    }, this.minimizeAfterMs);
  }

  private clearMinimizeTimer(): void {
    if (this.minimizeTimer !== null) {
      clearTimeout(this.minimizeTimer);
      this.minimizeTimer = null;
    }
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      fullscreen: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: false,
      closable: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      focusable: true,
      show: false,
      title: 'Sprint Dispatcher · Meta',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    if (IS_DEV && DEV_SERVER_URL) {
      void win.loadURL(DEV_SERVER_URL);
      win.webContents.openDevTools({ mode: 'detach' });
    } else {
      void win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    return win;
  }
}
