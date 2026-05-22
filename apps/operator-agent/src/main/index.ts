/**
 * Sprint Operator Agent — Main process entrypoint.
 *
 * Responsabilidades (W0):
 * - Single instance lock (impede 2 agents rodando)
 * - Criar o tray icon
 * - Registrar handlers IPC
 *
 * Em W0 NÃO há polling e NÃO há overlay ativo. O app fica residente na
 * tray, esperando ser comandado (W1+). O carregamento de `config.json`
 * (BL-C3-002) será inserido no `bootstrap`, entre `app.whenReady()` e a
 * criação da tray.
 *
 * @see DECISIONS.md ADR-011 — arquitetura tray-resident
 * @see CLAUDE.md §8.1 — segurança obrigatória Electron
 */

import { app, dialog, ipcMain } from 'electron';

import { acquireSingleInstanceLock } from './single-instance';
import { createTray } from './tray';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

/**
 * Bootstrap do main process.
 *
 * Sequência: single instance lock → app ready → tray → handlers IPC.
 */
async function bootstrap(): Promise<void> {
  // 1. Single instance lock — antes de qualquer outra coisa.
  const isPrimary = acquireSingleInstanceLock(app);
  if (!isPrimary) {
    app.quit();
    return;
  }

  // 2. Aguarda o Electron ficar pronto.
  await app.whenReady();

  // 3. Cria o tray icon.
  try {
    createTray();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      'Sprint Operator Agent — Erro ao iniciar',
      `Não foi possível criar o ícone da tray:\n\n${message}`,
    );
    app.quit();
    return;
  }

  // 4. Registra os handlers IPC.
  registerIpcHandlers();
}

/**
 * Registra os handlers IPC do Agent.
 *
 * W0: apenas `ping` (smoke test do bridge). O handler `getConfig` entra
 * com o config loader (BL-C3-002). W1+ trará os handlers de overlay.
 */
function registerIpcHandlers(): void {
  ipcMain.handle('ping', () => 'pong');
}

app.on('window-all-closed', () => {
  // Agent é tray-resident: NÃO encerra quando as janelas fecham.
  // Subscrever a este evento já cancela o quit automático do Electron —
  // basta não chamar app.quit() aqui. O overlay abre e fecha várias vezes
  // ao dia; o app só sai via menu da tray ("Sair"). Ver ADR-011.
});

// Hardening: bloqueia navegação externa em qualquer webContents criado.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (IS_DEV && url.startsWith(DEV_SERVER_URL ?? '')) {
      return; // permite navegação no dev server
    }
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.on('second-instance', () => {
  // O single instance lock garante que só a primária roda. Quando uma
  // segunda instância tenta subir, este evento dispara aqui. W1+ vai
  // focar o overlay ativo; em W0 não há janela, então nada a fazer.
});

void bootstrap();
