/**
 * Tray service — integração com Electron Tray API.
 *
 * Responsabilidades:
 *
 * - Mantém referência ao `Tray` do Electron (criado em `boot`).
 * - Recebe atualizações de `TrayState` e materializa em chamadas
 *   `tray.setImage` / `setContextMenu` / `setToolTip` baseado nos outputs
 *   puros de {@link trayStateService}.
 * - Expõe `displayConfigErrorBalloon` para notificar operador quando
 *   config está inválida (cenário fail-soft do W1 — D3 da Sessão).
 *
 * Wiring de cliques do menu (ações `show-current`, `open-history`,
 * `about`) é feito via callback `onAction` passado no `boot`. Em Gate 2
 * (esta sessão) o caller passa um stub que loga; em Gate 5 o wiring real
 * é injetado com `overlayService.restoreCurrent()`, `shell.openPath(...)`,
 * etc.
 *
 * @see DECISIONS.md ADR-011 (tray-resident)
 * @see ./trayStateService.ts (lógica pura)
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { Menu, Tray, app, dialog } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

import type { ConnectionStatus } from './connectivity';
import {
  computeTrayIconColor,
  computeTrayMenu,
  computeTrayTooltip,
  type TrayIconColor,
  type TrayMenuAction,
  type TrayState,
} from './trayStateService';

/**
 * Callback chamado quando operador clica em item de menu acionável.
 *
 * Em Gate 2 o caller passa um stub. Em Gate 5+ é substituído pelo
 * dispatcher real (overlayService.restoreCurrent, shell.openPath, etc).
 */
export type TrayActionHandler = (action: Exclude<TrayMenuAction, null>) => void;

/** Nome do arquivo PNG por cor lógica (gerados em `build/` — ver scripts/generate-tray-icons.mjs). */
const ICON_FILE_BY_COLOR: Record<TrayIconColor, string> = {
  gray: 'tray-gray.png',
  yellow: 'tray-yellow.png',
  red: 'tray-red.png',
  green: 'tray-green.png',
};

/**
 * Resolve o path absoluto do ícone do tray para uma cor lógica (BL-C3-013).
 *
 * Os PNGs coloridos (32×32, downscale nítido pelo Tray) vivem em `build/`
 * e são empacotados via `electron-builder.yml#files` (`build/**`). Se um
 * asset de cor faltar no asar por qualquer motivo, cai para o `tray.ico`
 * do W0 (sempre presente) — defesa em profundidade contra o boot do `Tray`
 * sem imagem (G-023).
 */
function resolveIconPath(color: TrayIconColor): string {
  // `__dirname` em runtime do main aponta para `dist-electron/main/`.
  const buildDir = path.join(__dirname, '../../build');
  const candidate = path.join(buildDir, ICON_FILE_BY_COLOR[color]);
  if (existsSync(candidate)) return candidate;
  return path.join(buildDir, 'tray.ico');
}

/**
 * Constrói o template Electron a partir do menu puro do trayStateService.
 * Cliques são roteados via `onAction(action)` — itens sem `action` (null)
 * viram itens informativos (sem `click`).
 */
function buildContextMenu(
  state: TrayState,
  connection: ConnectionStatus | null,
  onAction: TrayActionHandler,
): Menu {
  const items = computeTrayMenu(state, connection);
  const template: MenuItemConstructorOptions[] = items.map((item) => {
    const opts: MenuItemConstructorOptions = {
      label: item.label,
      enabled: item.enabled,
    };
    if (item.action !== null && item.enabled) {
      const action = item.action;
      opts.click = (): void => {
        onAction(action);
      };
    }
    return opts;
  });
  return Menu.buildFromTemplate(template);
}

/**
 * Tray service singleton. Use `boot` uma vez no startup, depois
 * `setState` quando o estado mudar.
 */
export class TrayService {
  private tray: Tray | null = null;
  private currentState: TrayState = { kind: 'loading' };
  /**
   * Estado de conexão com a pasta compartilhada (BL-C3-013). `null` até o
   * primeiro ciclo de polling sondar (boot). Dimensão ortogonal ao
   * `currentState` — compõe cor/tooltip/menu via {@link trayStateService}.
   */
  private currentConnection: ConnectionStatus | null = null;
  private actionHandler: TrayActionHandler = () => {
    // Default noop — caller deve substituir via boot({ onAction })
  };

  /**
   * Cria o tray icon com o estado inicial. Deve ser chamado **após
   * `app.whenReady()`**.
   *
   * @throws Error se o ícone não puder ser carregado.
   */
  boot(initialState: TrayState, onAction: TrayActionHandler): void {
    if (this.tray !== null) {
      // Idempotente — preserva instância existente, só atualiza estado.
      this.actionHandler = onAction;
      this.setState(initialState);
      return;
    }
    const iconPath = resolveIconPath(computeTrayIconColor(initialState));
    this.tray = new Tray(iconPath);
    this.actionHandler = onAction;
    this.applyState(initialState);
  }

  /**
   * Atualiza o tray para um novo estado. Idempotente — chamadas sucessivas
   * com o mesmo estado são seguras.
   */
  setState(state: TrayState): void {
    if (this.tray === null) {
      // boot() ainda não rodou — guarda o estado para aplicar no boot.
      this.currentState = state;
      return;
    }
    this.applyState(state);
  }

  /**
   * Atualiza a dimensão de **conexão** (BL-C3-013). Chamado pelo
   * composition root quando a máquina de reconexão do `PollingService`
   * transiciona (conectado ↔ sem conexão). Recompõe o ícone/tooltip/menu
   * preservando o `currentState` (sprint/config). Idempotente; seguro antes
   * do `boot` (apenas guarda o valor).
   */
  setConnection(connection: ConnectionStatus): void {
    this.currentConnection = connection;
    if (this.tray === null) return;
    this.applyState(this.currentState);
  }

  /**
   * Mostra balloon (Windows tray notification) sinalizando erro de config.
   *
   * No-op em plataformas sem suporte a balloon. Não bloqueia.
   */
  displayConfigErrorBalloon(message: string): void {
    if (this.tray === null) return;
    // displayBalloon é Windows-only; em outras plataformas é no-op.
    if (process.platform === 'win32') {
      this.tray.displayBalloon({
        title: 'Sprint Operator Agent — Configuração necessária',
        content: message,
        iconType: 'warning',
      });
    }
  }

  /**
   * Mostra balloon informativo (BL-C3-009 — feedback de "nenhum aviso
   * para reabrir"). No-op em plataformas sem suporte. Não bloqueia.
   */
  displayInfoBalloon(message: string): void {
    if (this.tray === null) return;
    if (process.platform === 'win32') {
      this.tray.displayBalloon({
        title: 'Sprint Operator Agent',
        content: message,
        iconType: 'info',
      });
    }
  }

  /**
   * Mostra diálogo "Sobre" — utilitário invocado pelo handler do menu.
   */
  showAboutDialog(): void {
    void dialog.showMessageBox({
      type: 'info',
      title: 'Sobre',
      message: 'Sprint Operator Agent',
      detail: `Versão: ${app.getVersion()}\n3Studio · ARTFLEXÍVEIS`,
      buttons: ['OK'],
    });
  }

  /**
   * Destrói o tray icon. Uso em cleanup (raro — agent é tray-resident).
   */
  destroy(): void {
    if (this.tray !== null) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * @internal — exposto para testes integrados poderem inspecionar
   * o estado vigente sem tocar no `Tray` real.
   */
  getState(): TrayState {
    return this.currentState;
  }

  private applyState(state: TrayState): void {
    if (this.tray === null) return;
    this.currentState = state;
    const connection = this.currentConnection;
    const iconPath = resolveIconPath(computeTrayIconColor(state, connection));
    this.tray.setImage(iconPath);
    this.tray.setToolTip(computeTrayTooltip(state, connection));
    this.tray.setContextMenu(buildContextMenu(state, connection, this.actionHandler));
  }
}
