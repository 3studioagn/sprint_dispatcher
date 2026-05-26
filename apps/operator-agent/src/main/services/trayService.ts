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

import path from 'node:path';

import { Menu, Tray, app, dialog } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

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

/**
 * Resolve o path absoluto do ícone do tray para uma cor lógica.
 *
 * **TODO (Gate 5/8 polish):** gerar `build/tray-gray.ico`,
 * `build/tray-yellow.ico`, `build/tray-red.ico` distintos. Por ora todos
 * resolvem para o `build/tray.ico` único do W0 — sinalização visual
 * principal vai via tooltip + balloon + menu degradado.
 */
function resolveIconPath(color: TrayIconColor): string {
  // `__dirname` em runtime do main aponta para `dist-electron/main/`.
  // `tray.ico` foi gerado em `apps/operator-agent/build/tray.ico` (W0).
  void color; // futuro: colorVariants[color] ?? defaultPath
  return path.join(__dirname, '../../build/tray.ico');
}

/**
 * Constrói o template Electron a partir do menu puro do trayStateService.
 * Cliques são roteados via `onAction(action)` — itens sem `action` (null)
 * viram itens informativos (sem `click`).
 */
function buildContextMenu(state: TrayState, onAction: TrayActionHandler): Menu {
  const items = computeTrayMenu(state);
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
    const iconPath = resolveIconPath(computeTrayIconColor(state));
    this.tray.setImage(iconPath);
    this.tray.setToolTip(computeTrayTooltip(state));
    this.tray.setContextMenu(buildContextMenu(state, this.actionHandler));
  }
}
