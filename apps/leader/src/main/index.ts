/**
 * Sprint Leader — Main process entrypoint.
 *
 * Responsabilidades:
 * - Criar BrowserWindow com webPreferences seguras (CLAUDE.md §8.1).
 * - Anexar preload script (bridge IPC tipado — ADR-009).
 * - Carregar dev server (modo dev) ou arquivo estático (build).
 * - Tentar `loadLeaderConfig()` no boot; se falhar, deps ficam null e
 *   o handler `getConfig` mostra a ConfigErrorScreen no renderer.
 * - Instanciar `NodeFilesystemAdapter` + `PendingStore` +
 *   `OperatorsService` + `DispatchService` quando a config carrega.
 * - Registrar handlers IPC (3 handlers reais + smoke `ping`).
 *
 * @see CLAUDE.md §8.1 — segurança obrigatória Electron
 * @see DECISIONS.md ADR-009 — IPC contract-first
 * @see DECISIONS.md ADR-013 — filesystem adapter port-and-adapter
 */

import path from 'node:path';

import { AckStore, CancelStore, NodeFilesystemAdapter, PendingStore } from '@sprint/fs-adapter';
import { app, BrowserWindow } from 'electron';

import { ConfigError, loadLeaderConfig, type LeaderConfig } from './config';
import { type IpcDependencies, registerIpcHandlers } from './ipc';
import { AckTrackingService } from './services/ackTrackingService';
import { CancelService } from './services/cancelService';
import { DispatchService } from './services/dispatchService';
import { OperatorsService } from './services/operatorsService';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

const deps: IpcDependencies = {
  operatorsService: null,
  dispatchService: null,
  ackTrackingService: null,
  cancelService: null,
};

/**
 * Carrega a config e popula `deps` com services instanciados.
 *
 * Re-utilizável: chamado no boot e novamente pelo handler `getConfig`
 * quando o líder corrige config e recarrega a janela do renderer.
 * Lança `ConfigError` se a config ainda estiver inválida.
 */
async function rebuildDeps(): Promise<LeaderConfig> {
  const config = await loadLeaderConfig();
  const adapter = new NodeFilesystemAdapter();
  const pendingStore = new PendingStore(adapter, config.shared_path);
  const ackStore = new AckStore(adapter, config.shared_path);
  // CancelStore recebe pendingStore para remover originais pendentes
  // como parte do writeCancel (BL-C4-004).
  const cancelStore = new CancelStore(adapter, config.shared_path, pendingStore);
  deps.operatorsService = new OperatorsService(adapter, config.shared_path);
  deps.dispatchService = new DispatchService(pendingStore, deps.operatorsService, config);
  deps.ackTrackingService = new AckTrackingService(ackStore, deps.operatorsService);
  deps.cancelService = new CancelService(cancelStore, config);
  return config;
}

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
    show: false,
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
 * Bootstrap do app. Tenta carregar config; se falhar, deps ficam null
 * (não bloqueia o boot — renderer mostrará ConfigErrorScreen via
 * `getConfig` que retornará `{ ok: false }`).
 */
async function bootstrap(): Promise<void> {
  await app.whenReady();

  try {
    await rebuildDeps();
  } catch (err) {
    if (!(err instanceof ConfigError)) {
      throw err;
    }
    // Config inválida no boot — deps permanecem null. O handler `getConfig`
    // vai tentar de novo quando o renderer chamar (após o líder corrigir +
    // window.location.reload). Não logamos aqui — preserva os tokens. O
    // erro detalhado vai via IPC para a ConfigErrorScreen.
  }

  registerIpcHandlers(deps, rebuildDeps);
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
      return;
    }
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
