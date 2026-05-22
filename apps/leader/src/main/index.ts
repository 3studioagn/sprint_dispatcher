/**
 * Sprint Leader — Main process entrypoint.
 *
 * Responsabilidades:
 * - Criar BrowserWindow com webPreferences seguras (CLAUDE.md §8.1)
 * - Anexar preload script
 * - Carregar dev server (modo dev) ou arquivo estático (build)
 * - Registrar handlers IPC (W1 — agora apenas placeholder ping)
 *
 * @see CLAUDE.md §8.1 — segurança obrigatória Electron
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, ipcMain } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

/**
 * Cria a janela principal do Leader.
 *
 * Segurança aplicada conforme CLAUDE.md §8.1:
 * - contextIsolation: isola contextos main↔renderer
 * - nodeIntegration: false (renderer não acessa Node)
 * - sandbox: renderer roda em sandbox OS-level
 * - webSecurity: força same-origin policy
 * - preload: único bridge tipado entre main e renderer
 */
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false, // mostra depois de carregado pra evitar flash branco
    title: 'Sprint Leader',
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
  });

  if (IS_DEV && DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return win;
}

/**
 * Registra handlers IPC.
 *
 * W0: apenas `ping` (smoke test do bridge).
 * W1+: handlers reais virão com BL-C2-007, BL-C2-008, etc.
 */
function registerIpcHandlers(): void {
  ipcMain.handle('ping', () => 'pong');
}

/**
 * Bootstrap do app: espera o Electron ficar pronto, registra os handlers
 * IPC e cria a janela principal.
 *
 * Usa async/await em vez de `app.whenReady().then()` — CLAUDE.md §7.4
 * proíbe `.then()`. A Promise resultante é fire-and-forget no topo do
 * módulo, descartada explicitamente com `void` no call site.
 */
async function bootstrap(): Promise<void> {
  await app.whenReady();
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

void bootstrap();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Hardening adicional: bloqueia navegação externa indevida
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (IS_DEV && url.startsWith(DEV_SERVER_URL ?? '')) {
      return; // permite navegação no dev server
    }
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
