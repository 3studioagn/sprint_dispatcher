/**
 * Criação de overlay TOPMOST para exibição de sprints.
 *
 * Em W0, a função `createOverlayWindow` está implementada e exportada,
 * mas **NÃO é chamada** pelo lifecycle do app. Será invocada em W1 por
 * BL-C3-003 (polling) quando uma sprint pending for detectada.
 *
 * Características do overlay (Requisitos RF-07, RF-08, RNF-15):
 * - TOPMOST (`alwaysOnTop` no nível `screen-saver`)
 * - Frameless (sem barra de título)
 * - Não pode ser fechada por Alt+F4 sem ack (`closable: false`)
 * - Sandboxed como qualquer renderer (segurança Electron, CLAUDE.md §8.1)
 */

import path from 'node:path';

import { BrowserWindow, screen } from 'electron';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

/**
 * Cria a janela do overlay.
 *
 * @returns Instância da `BrowserWindow` do overlay. **Não se destrói
 *          automaticamente** — o caller fecha quando o ack chegar (W1+).
 */
export function createOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const overlay = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: false, // overlay sólido pra clareza visual da meta
    alwaysOnTop: true,
    fullscreen: false, // workAreaSize já exclui a taskbar; fullscreen real bloquearia a tray
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false, // operador não pode fechar com Alt+F4 sem ack
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

  // Garante TOPMOST mesmo se outro app tentar tomar o foco.
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlay.once('ready-to-show', () => {
    overlay.show();
    overlay.focus();
  });

  if (IS_DEV && DEV_SERVER_URL) {
    void overlay.loadURL(DEV_SERVER_URL);
    overlay.webContents.openDevTools({ mode: 'detach' });
  } else {
    void overlay.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return overlay;
}
