/**
 * PillService — gestão do BrowserWindow do pill (badge minimizado) que
 * aparece após "Recebi" (BL-C3-017).
 *
 * **Quando aparece:** apenas após ack final via `handleAck` quando a
 * fila esvazia. Se há próxima sprint, ela vai direto para overlay
 * fullscreen (sem pill no meio — fluxo continuous). Auto-close por
 * timeout (sem ack) continua hide() invisível → tray, NÃO usa pill.
 *
 * **Quando some:** clique no pill (expand → reabre overlay fullscreen
 * em modo BL-C3-009 reopen) OU nova sprint chega via polling (pill é
 * eclipsada pelo overlay normal).
 *
 * **Window:** BrowserWindow dedicada (frameless + topmost +
 * skipTaskbar), 100px de altura ancorada em top:0 com largura da
 * tela primária. Opaca dark — body padronizado em
 * `var(--sprint-color-background)` (BL-C3-016). Não-focusable
 * (não rouba foco do app que o operador está usando).
 *
 * **State:** `currentInfo` (subset compatível com renderer) +
 * `fullPayload` (preservado para expand reabrir overlay com payload
 * completo). hide() limpa ambos; show(payload) atualiza ambos.
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
 * Altura do BrowserWindow do pill. Bar do `<OverlayMinimized>` é 32px
 * (`--sprint-space-8`); badge extende abaixo (padding ~24px + shadow
 * ~6px) — 100px dá folga para a sombra do badge não ser cortada.
 */
const PILL_HEIGHT = 100;

export class PillService {
  private window: BrowserWindow | null = null;
  private currentInfo: PillCurrentInfo | null = null;
  /**
   * Payload completo da última sprint acked — preservado internamente
   * para que o handler `pill:expand` consiga chamar
   * `overlayService.reopenFromHistory(payload)` sem precisar buscar do
   * disco. Renderer NÃO vê este campo (recebe apenas `currentInfo`).
   */
  private fullPayload: SprintPayload | null = null;
  /**
   * Timer que dispara `dismiss()` quando `payload.deadline_at` é
   * alcançado (Sessão 23 fix — pill persiste "até o final do tempo
   * daquela meta"). Cancelado em `dismiss()`, `destroy()`, ou novo
   * `show()` (que reseta com o deadline da nova sprint).
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
    this.fullPayload = payload;
    this.currentInfo = {
      sprintId: payload.sprint_id,
      userId: payload.user_id,
      title: payload.title,
      meta: payload.meta,
    };
    this.startDeadlineTimer(payload.deadline_at);
    if (this.currentInfo === null) return; // dismissed pelo timer expirado
    this.showWindow();
  }

  /**
   * Apenas oculta a janela; preserva `currentInfo`, `fullPayload` e
   * `deadlineTimer`. Uso pelo handler `pill:expand` — operador clicou
   * no pill, overlay reabre, pill some visualmente mas seu state segue
   * vivo para reaparecer quando o overlay reaberto fecha (Sessão 23
   * fix: "badge deve ficar persistente até o final do tempo daquela meta").
   */
  hideWindow(): void {
    if (this.window === null || this.window.isDestroyed()) return;
    if (this.window.isVisible()) this.window.hide();
  }

  /**
   * Re-exibe pill se há state preservado. Uso pelo handler
   * `overlay:close-reopened` — após o operador fechar o overlay
   * reaberto, pill volta com a mesma sprint até o deadline passar
   * (ou nova sprint chegar). No-op se não há state (operador
   * dismissed manualmente OU deadline expirou enquanto overlay
   * estava aberto).
   */
  showWindow(): void {
    if (this.currentInfo === null) return;
    if (this.window === null || this.window.isDestroyed()) {
      this.window = this.createWindow();
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
   * Alias `hide()` mantido para retrocompatibilidade com callers
   * anteriores à Sessão 23 que esperavam semântica "dismiss".
   */
  dismiss(): void {
    this.clearDeadlineTimer();
    this.currentInfo = null;
    this.fullPayload = null;
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

  /**
   * Payload completo da sprint exibida no pill — usado internamente
   * pelo handler `pill:expand` para reabrir overlay fullscreen sem
   * leitura adicional do disco.
   */
  getFullPayload(): SprintPayload | null {
    return this.fullPayload;
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
    this.fullPayload = null;
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
    const { width: screenWidth } = display.workAreaSize;

    const win = new BrowserWindow({
      width: screenWidth,
      height: PILL_HEIGHT,
      x: 0,
      y: 0,
      frame: false,
      // transparent: true → área abaixo da bar (32px) e ao redor da
      // badge (no canvas de 100px) fica transparente em vez de mostrar
      // background opaco da janela. Renderer aplica `body.pill-mode {
      // background: transparent }` para combinar.
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      // focusable: false → pill NÃO rouba foco do app que o operador
      // está usando ao clicar nele (operador clica, ack expande overlay,
      // mas seu IDE/Illustrator continua com foco visual normal).
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
