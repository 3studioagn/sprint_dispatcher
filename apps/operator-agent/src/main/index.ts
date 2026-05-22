/**
 * Sprint Operator Agent — Main process entrypoint.
 *
 * Responsabilidades (W0):
 * - Single instance lock (impede 2 agents rodando)
 * - Carregar e validar o config.json (fail-fast)
 * - Criar o tray icon
 * - Registrar handlers IPC
 *
 * Em W0 NÃO há polling e NÃO há overlay ativo. O app carrega o
 * `config.json` da estação, fica residente na tray, e espera ser
 * comandado (W1+).
 *
 * @see DECISIONS.md ADR-011 — arquitetura tray-resident
 * @see DECISIONS.md ADR-012 — config loader fail-fast
 * @see CLAUDE.md §8.1 — segurança obrigatória Electron
 */

import type { AgentConfig } from '@sprint/contracts';
import { app, dialog, ipcMain } from 'electron';

import { ConfigError, getConfigPath, loadAgentConfig } from './config';
import { acquireSingleInstanceLock } from './single-instance';
import { createTray } from './tray';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

// Config lido uma vez no boot e mantido em memória. Não vaza para o
// renderer — o handler `getConfig` expõe só os campos seguros. Ver ADR-012.
let configCache: AgentConfig | null = null;

/**
 * Bootstrap do main process.
 *
 * Sequência: single instance lock → app ready → config → tray → IPC.
 * Erro de config encerra o app via diálogo (fail-fast, ADR-012).
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

  // 3. Carrega e valida o config.json (fail-fast — ADR-012).
  try {
    configCache = await loadAgentConfig();
  } catch (err) {
    handleConfigError(err);
    return; // o app já foi encerrado dentro de handleConfigError
  }

  // 4. Cria o tray icon.
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

  // 5. Registra os handlers IPC.
  registerIpcHandlers();
}

/**
 * Registra os handlers IPC do Agent.
 *
 * W0: `ping` (smoke do bridge) e `getConfig` (campos seguros do config).
 * W1+ trará os handlers de overlay.
 */
function registerIpcHandlers(): void {
  ipcMain.handle('ping', () => 'pong');

  // Expõe ao renderer apenas os campos seguros do config — sem
  // shared_path, polling_interval ou log_level (defense-in-depth).
  ipcMain.handle('getConfig', () => {
    if (configCache === null) {
      throw new Error('Config não carregado');
    }
    return {
      user_id: configCache.user_id,
      user_nome_exibicao: configCache.user_nome_exibicao,
      hostname: configCache.hostname,
    };
  });
}

/**
 * Trata erros do config loader: mostra um diálogo e encerra o app.
 *
 * Fail-fast — não há "modo degradado" (ADR-012). Um `ConfigError` rende
 * uma mensagem específica; qualquer outro erro cai no ramo genérico.
 */
function handleConfigError(err: unknown): void {
  if (err instanceof ConfigError) {
    dialog.showErrorBox(
      'Sprint Operator Agent — Config inválido',
      `${err.message}\n\nCaminho do config:\n${getConfigPath()}`,
    );
  } else {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      'Sprint Operator Agent — Erro inesperado',
      `Falha ao iniciar:\n\n${message}\n\nCaminho do config:\n${getConfigPath()}`,
    );
  }
  app.quit();
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
