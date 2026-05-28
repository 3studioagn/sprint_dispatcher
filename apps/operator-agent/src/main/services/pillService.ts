/**
 * PillService — gestão do BrowserWindow do pill (badge informativa
 * standalone) que aparece após "Recebi" (BL-C3-017, redesigned Sessão 24).
 *
 * **Quando aparece:** apenas após ack final via `handleAck` quando a
 * fila esvazia. Se há próxima sprint, ela vai direto para overlay
 * fullscreen (sem pill no meio — fluxo continuous). Auto-close por
 * timeout (sem ack) continua hide() invisível → tray, NÃO usa pill.
 *
 * **Quando some:**
 * - Timer de `deadline_at` da sprint expira (Sessão 23 — pill
 *   persiste até o final da meta).
 * - Nova sprint chega via polling → `dismiss()` no wire
 *   `queueLocal.onNextSprint` do main/index.ts.
 *
 * **NÃO some por click** (Sessão 24): clique no pill alterna entre
 * modo compact e expanded INTERNAMENTE no renderer (`<Pill>` do
 * `@sprint/ui-kit` aceita prop `expanded`). Não reabre overlay
 * fullscreen — overlay aparece apenas em dispatch novo.
 *
 * **Window:** BrowserWindow dedicada (frameless + transparent +
 * topmost screen-saver + skipTaskbar + focusable false). Tamanho
 * fixo cobrindo área compact + expanded (340×160), ancorada no
 * topo-center da tela primária. Body do renderer transparente fora
 * da pill — apps abaixo permanecem clicáveis nas áreas vazias do
 * window.
 *
 * **State:** `currentInfo` (subset compatível com renderer — sprintId,
 * userId, title, meta, deadline_at). Sem fullPayload (não precisa mais
 * — pill não reabre overlay).
 *
 * **Renderer separado:** mesma `index.html`, query `?pill` distingue
 * — `main.tsx` roteia para `<PillApp>` em vez de `<App>`. Mesmo
 * preload, mesma API surface.
 *
 * @see Backlog BL-C3-017
 * @see DECISIONS.md ADR-011 (tray-resident; pill é primo do tray)
 * @see ./overlayService.ts — overlay fullscreen (sibling)
 */

import path from 'node:path';

import type { SprintPayload } from '@sprint/contracts';
import { BrowserWindow, screen } from 'electron';

import type { PillCurrentInfo, PillUpdateEvent } from '../../shared/ipc-types';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

/**
 * Dimensões do BrowserWindow do pill (Sessão 24).
 *
 * - Width: largura visual da pill (~280px no expanded) + margem para
 *   sombra ~30px de cada lado → 340px.
 * - Height: cobre compact (~52px) + transição CSS para expanded (~140px)
 *   + sombra inferior (~16px) → 160px.
 *
 * Window é fixo neste tamanho; CSS controla o que aparece (compact vs
 * expanded). Áreas vazias do window são transparent (body.pill-mode
 * em global.css).
 */
const PILL_WINDOW_WIDTH = 340;
const PILL_WINDOW_HEIGHT = 160;

export class PillService {
  private window: BrowserWindow | null = null;
  private currentInfo: PillCurrentInfo | null = null;
  /**
   * Timer que dispara `dismiss()` quando `payload.deadline_at` é
   * alcançado (Sessão 23 — pill persiste até o final da meta).
   * Cancelado em `dismiss()`, `destroy()`, ou novo `show()`.
   */
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * `() => Date` injetável — testes podem controlar "agora" para validar
   * timer de deadline sem fake timers globais.
   */
  private readonly now: () => Date;

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? ((): Date => new Date());
  }

  /**
   * Mostra o pill com a sprint recém-ackeada. Inicia timer baseado em
   * `payload.deadline_at` — quando alcançado, pill é automaticamente
   * dismissed. Cria janela na primeira chamada; em chamadas subsequentes
   * atualiza conteúdo via push `pill:update` e revela.
   *
   * Se a sprint já está expirada no momento do show (deadline_at no
   * passado), pill é dismissed imediatamente sem criar janela —
   * cenário defensivo, não esperado em produção (handleAck só é
   * chamado para sprints vigentes).
   */
  show(payload: SprintPayload): void {
    this.currentInfo = {
      sprintId: payload.sprint_id,
      userId: payload.user_id,
      title: payload.title,
      meta: payload.meta,
      deadline_at: payload.deadline_at,
    };
    this.startDeadlineTimer(payload.deadline_at);
    if (this.currentInfo === null) return; // dismissed pelo timer expirado

    if (this.window === null || this.window.isDestroyed()) {
      this.window = this.createWindow();
      // Renderer pulla currentInfo via `pill:request-current` no mount.
    } else {
      this.window.webContents.send('pill:update', {
        info: this.currentInfo,
      } satisfies PillUpdateEvent);
      if (!this.window.isVisible()) this.window.show();
    }
  }

  /**
   * Dismissal completo — cancela timer, limpa state, oculta janela.
   * Uso por: (a) timer de deadline disparar; (b) nova sprint chegar
   * via polling (queueService.onNextSprint); (c) cleanup explícito.
   *
   * Alias `hide()` mantido para retrocompatibilidade.
   */
  dismiss(): void {
    this.clearDeadlineTimer();
    this.currentInfo = null;
    if (this.window !== null && !this.window.isDestroyed() && this.window.isVisible()) {
      this.window.hide();
    }
  }

  /** @deprecated alias para `dismiss()` — preservado para retrocompat. */
  hide(): void {
    this.dismiss();
  }

  /** Snapshot do pill atual — consumido pelo pull pattern do renderer. */
  getCurrent(): PillCurrentInfo | null {
    return this.currentInfo;
  }

  /** Pill está atualmente visível ao operador? */
  isShown(): boolean {
    return (
      this.currentInfo !== null &&
      this.window !== null &&
      !this.window.isDestroyed() &&
      this.window.isVisible()
    );
  }

  /**
   * Destrói a janela + limpa estado. Uso em cleanup (raro — agent é
   * tray-resident; pill window vive enquanto agent vive).
   */
  destroy(): void {
    this.clearDeadlineTimer();
    this.currentInfo = null;
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }

  /**
   * Agenda dismiss automático para o instante de `deadline_at`. Se já
   * expirou, dismissa imediatamente. Cancela timer anterior antes de
   * agendar — chamadas sucessivas de `show()` resetam o relógio para
   * o deadline da sprint mais recente.
   */
  private startDeadlineTimer(deadlineIso: string): void {
    this.clearDeadlineTimer();
    const msUntil = new Date(deadlineIso).getTime() - this.now().getTime();
    if (msUntil <= 0) {
      this.dismiss();
      return;
    }
    this.deadlineTimer = setTimeout(() => {
      this.dismiss();
    }, msUntil);
  }

  private clearDeadlineTimer(): void {
    if (this.deadlineTimer !== null) {
      clearTimeout(this.deadlineTimer);
      this.deadlineTimer = null;
    }
  }

  private createWindow(): BrowserWindow {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, x: displayX, y: displayY } = display.bounds;
    // Centralizado horizontalmente no topo da tela primária.
    const x = displayX + Math.floor((screenWidth - PILL_WINDOW_WIDTH) / 2);
    const y = displayY;

    const win = new BrowserWindow({
      x,
      y,
      width: PILL_WINDOW_WIDTH,
      height: PILL_WINDOW_HEIGHT,
      frame: false,
      // transparent: true → áreas do canvas fora da pill ficam transparentes
      // permitindo o operador ver/clicar nas apps abaixo. Renderer aplica
      // `body.pill-mode { background: transparent }` para casar.
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      // focusable: false → pill NÃO rouba foco do app que o operador
      // está usando ao clicar nele (operador clica, pill expande mas
      // seu IDE/Illustrator continua com foco visual normal).
      focusable: false,
      show: false,
      title: 'Sprint Dispatcher · Pill',
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

    // TOPMOST nível screen-saver — fica acima de Illustrator/Corel
    // fullscreen, mesmo nível do overlay fullscreen (não compete por
    // z-order com ele porque os dois são mutuamente exclusivos).
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.once('ready-to-show', () => {
      win.show();
    });

    if (IS_DEV && DEV_SERVER_URL) {
      void win.loadURL(`${DEV_SERVER_URL}?pill`);
    } else {
      void win.loadFile(path.join(__dirname, '../../dist/index.html'), {
        search: 'pill',
      });
    }

    return win;
  }
}
