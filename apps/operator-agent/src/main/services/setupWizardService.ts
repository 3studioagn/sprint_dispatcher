/**
 * SetupWizardService — janela do wizard de configuração inicial (BL-C5-006).
 *
 * Janela comum (com chrome, focável, centralizada) — diferente do overlay/pill
 * (frameless + transparent + topmost). Aparece no first-run quando o
 * `config.json` está ausente/inválido (disparada pelo `main/index.ts`) e via o
 * item de tray "Configurar…" no estado `config_error`.
 *
 * **Renderer separado:** mesma `index.html`, query `?setup` distingue —
 * `main.tsx` roteia para `<SetupApp>` em vez de `<App>`/`<PillApp>`. Mesmo
 * preload, mesma surface IPC (`window.api.setup.*`).
 *
 * Impuro (integra `BrowserWindow`); a lógica testável (build/validação do
 * config, sondagem) vive em `setupService.ts`.
 *
 * @see ./setupService.ts — lógica pura
 * @see DECISIONS.md ADR-028
 */

import path from 'node:path';

import { BrowserWindow } from 'electron';

import { APP_DISPLAY_NAME } from '../../shared/branding';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 640;

export class SetupWizardService {
  private window: BrowserWindow | null = null;

  /** Abre o wizard (ou foca a janela existente — idempotente). */
  show(): void {
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
      return;
    }
    this.window = this.createWindow();
  }

  /** Fecha o wizard (no-op se já fechado). Usado após `setup:save` com sucesso. */
  close(): void {
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
  }

  /** `true` se a janela existe e está visível. */
  isShown(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  /** Destrói a janela (cleanup — raro). */
  destroy(): void {
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      resizable: false,
      fullscreenable: false,
      maximizable: false,
      minimizable: true,
      center: true,
      show: false,
      autoHideMenuBar: true,
      title: `${APP_DISPLAY_NAME} — Configuração inicial`,
      // first-run: garante que a janela apareça à frente (ex.: lançada por
      // runAfterFinish do instalador) para o operador notar.
      alwaysOnTop: true,
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

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    win.on('closed', () => {
      this.window = null;
    });

    if (IS_DEV && DEV_SERVER_URL) {
      void win.loadURL(`${DEV_SERVER_URL}?setup`);
    } else {
      void win.loadFile(path.join(__dirname, '../../dist/index.html'), {
        search: 'setup',
      });
    }

    return win;
  }
}
