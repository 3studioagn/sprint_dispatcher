/**
 * Tray icon + menu de contexto do Sprint Operator Agent.
 *
 * A tray é a única interface persistente do agent. Em W0, o menu tem
 * apenas placeholders ("Sobre", "Sair"). Em W1+, será expandido com:
 * - Status do polling (rodando? última verificação?)
 * - Lista de sprints recentes
 * - Configurações
 * - Logs (abrir pasta)
 *
 * @see DECISIONS.md ADR-011
 */

import path from 'node:path';

import { Tray, Menu, app, dialog } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

let trayInstance: Tray | null = null;

/**
 * Cria o tray icon e retorna a instância.
 *
 * Deve ser chamado **após `app.whenReady()`**.
 *
 * @throws Error se o ícone não puder ser carregado.
 */
export function createTray(): Tray {
  if (trayInstance !== null) {
    return trayInstance;
  }

  // TODO(W3): substituir pelo ícone visual proprietário da ARTFLEXÍVEIS.
  // Por ora, um placeholder 16x16 válido (o Electron exige um arquivo real).
  const iconPath = path.join(__dirname, '../../build/tray.ico');

  trayInstance = new Tray(iconPath);
  trayInstance.setToolTip('Sprint Operator Agent');
  trayInstance.setContextMenu(buildContextMenu());

  return trayInstance;
}

/**
 * Reconstrói o menu de contexto. Usado quando o estado interno muda
 * (ex: polling on/off — implementado em W1).
 */
export function refreshTrayMenu(): void {
  if (trayInstance === null) return;
  trayInstance.setContextMenu(buildContextMenu());
}

function buildContextMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Sprint Operator Agent',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Sobre',
      click: () => {
        void dialog.showMessageBox({
          type: 'info',
          title: 'Sobre',
          message: 'Sprint Operator Agent',
          detail: `Versão: ${app.getVersion()}\n3Studio · ARTFLEXÍVEIS`,
          buttons: ['OK'],
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.quit();
      },
    },
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Destrói o tray icon (uso em cleanup, raro).
 */
export function destroyTray(): void {
  if (trayInstance !== null) {
    trayInstance.destroy();
    trayInstance = null;
  }
}
