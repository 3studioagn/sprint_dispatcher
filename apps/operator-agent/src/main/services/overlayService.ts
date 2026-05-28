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

import type { SprintPayload } from '@sprint/contracts';
import { BrowserWindow, screen } from 'electron';

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
  /**
   * `true` quando o overlay está exibindo um aviso reaberto via tray
   * (BL-C3-009). Diferente do fluxo normal: NÃO inicia timer, NÃO toca
   * em `currentItem` (preserva null/idle do main process), e o renderer
   * substitui o botão "Recebi" por "Fechar" (sem grave ack).
   */
  private reopenedMode = false;

  private readonly minimizeAfterMs: number;
  private readonly emitter = new EventEmitter();

  constructor(deps: OverlayServiceDeps) {
    this.minimizeAfterMs = deps.minimizeAfterMs;
  }

  /**
   * Exibe uma sprint. Cria janela na primeira chamada; nas subsequentes
   * envia push `sprint:incoming`. Sempre RESETA o timer de minimização.
   *
   * Limpa o `reopenedMode` — fluxo normal supersede reopen (cenário raro:
   * sprint chega na fila enquanto reopen estava ativo).
   */
  showSprint(item: QueueItem, queueLength: number): void {
    this.reopenedMode = false;
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
   * Reabre o overlay com um aviso recuperado do histórico local
   * (BL-C3-009 — tray menu "Reabrir último aviso"). Diferenças do
   * fluxo normal `showSprint`:
   *
   * - NÃO modifica `currentItem` (preserva o estado do main process —
   *   tipicamente null quando o tray item está habilitado).
   * - NÃO inicia timer de minimização — operador fecha manualmente.
   * - Envia push `sprint:incoming` com `reopened: true` — renderer
   *   substitui o botão "Recebi" por "Fechar" e o handler de fechamento
   *   chama `api.overlay.closeReopened()` em vez de `acknowledge`
   *   (sprint já foi ackeada anteriormente; reabertura não duplica ack).
   * - Marca `reopenedMode = true`. `closeReopened` é no-op fora desse
   *   modo (defesa contra IPC adulterado).
   */
  reopenFromHistory(payload: SprintPayload): void {
    this.reopenedMode = true;
    if (this.window === null || this.window.isDestroyed()) {
      this.window = this.createWindow();
    }
    // Push direto: renderer recebe sprint + reopened flag. Não usa
    // pull pattern (`getCurrentEvent` retorna null porque currentItem
    // permanece null) — push é a fonte autoritativa em reopen.
    this.window.webContents.send('sprint:incoming', {
      sprint: payload,
      queueLength: 0,
      reopened: true,
    } satisfies IncomingSprintEvent);
    if (!this.window.isVisible()) this.window.show();
    this.window.focus();
    this.transitionTo('showing');
    // Sem `restartMinimizeTimer` — operador controla o fechamento.
  }

  /**
   * Fecha o overlay reaberto via tray (BL-C3-009). Apenas oculta a
   * janela; NÃO grava ack adicional. No-op se overlay não está em
   * reopened mode (defesa contra IPC adulterado).
   *
   * Após fechar, o state machine volta para `'hidden'` — próxima
   * sprint via fluxo normal funciona inalterada.
   */
  closeReopened(): void {
    if (!this.reopenedMode) return;
    this.reopenedMode = false;
    if (this.window === null || this.window.isDestroyed()) return;
    this.window.hide();
    this.transitionTo('hidden');
  }

  /** Indica se o overlay está exibindo um aviso reaberto (BL-C3-009). */
  isReopened(): boolean {
    return this.reopenedMode;
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
    this.reopenedMode = false;
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
    this.reopenedMode = false;
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
    // BL-C3-004 + Sessão 23 fix: `fullscreen: true` no construtor sozinho
    // é inconsistente em Electron 42 + Win11 (especialmente com `frame: false`
    // e DPI scaling) — janela renderiza em tamanho default no canto da tela
    // em vez de cobrir o display. Solução: dimensionar e posicionar
    // explicitamente via `display.bounds` (inclui taskbar — TOPMOST overlay
    // deve cobrir TUDO). `setBounds` aplicado após criação reforça caso o
    // construtor ignore.
    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      fullscreen: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
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
    // Defensivo — reforça dimensões caso o construtor `fullscreen: true`
    // tenha sido sobreescrito por defaults do Electron em alguma combinação
    // de DPI/multi-display/sandbox.
    win.setBounds(display.bounds);
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
