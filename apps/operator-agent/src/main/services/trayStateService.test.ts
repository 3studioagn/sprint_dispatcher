/**
 * Testes das funções puras do trayStateService.
 *
 * Cobre cada `TrayState.kind` × cada função (3 estados × 3 funções).
 * Sem mocks — funções são puras.
 */

import { describe, expect, it } from 'vitest';

import {
  computeTrayIconColor,
  computeTrayMenu,
  computeTrayTooltip,
  type TrayState,
} from './trayStateService';

const LOADING: TrayState = { kind: 'loading' };
const IDLE: TrayState = { kind: 'idle' };
const SPRINT_1: TrayState = { kind: 'sprint_active', queueLength: 1 };
const SPRINT_3: TrayState = { kind: 'sprint_active', queueLength: 3 };
const CONFIG_ERROR: TrayState = { kind: 'config_error', reason: 'config ausente' };

describe('computeTrayIconColor', () => {
  it('loading → gray', () => {
    expect(computeTrayIconColor(LOADING)).toBe('gray');
  });

  it('idle → gray', () => {
    expect(computeTrayIconColor(IDLE)).toBe('gray');
  });

  it('sprint_active → yellow', () => {
    expect(computeTrayIconColor(SPRINT_1)).toBe('yellow');
    expect(computeTrayIconColor(SPRINT_3)).toBe('yellow');
  });

  it('config_error → red', () => {
    expect(computeTrayIconColor(CONFIG_ERROR)).toBe('red');
  });
});

describe('computeTrayTooltip', () => {
  it('loading → texto de boot', () => {
    expect(computeTrayTooltip(LOADING)).toContain('iniciando');
  });

  it('idle → "aguardando sprints"', () => {
    expect(computeTrayTooltip(IDLE)).toContain('aguardando sprints');
  });

  it('sprint_active com 1 sprint → singular', () => {
    expect(computeTrayTooltip(SPRINT_1)).toContain('1 sprint na fila');
  });

  it('sprint_active com N sprints → plural', () => {
    expect(computeTrayTooltip(SPRINT_3)).toContain('3 sprints na fila');
  });

  it('config_error inclui a razão fornecida', () => {
    expect(computeTrayTooltip(CONFIG_ERROR)).toContain('config ausente');
  });
});

describe('computeTrayMenu', () => {
  it('idle: "Mostrar sprint atual" desabilitado, label degradado', () => {
    const menu = computeTrayMenu(IDLE);
    const showCurrent = menu.find((i) => i.label.includes('Nenhuma sprint'));
    expect(showCurrent).toBeDefined();
    expect(showCurrent?.enabled).toBe(false);
    expect(showCurrent?.action).toBeNull();
  });

  it('sprint_active: "Mostrar sprint atual" habilitado com action', () => {
    const menu = computeTrayMenu(SPRINT_1);
    const showCurrent = menu.find((i) => i.label === 'Mostrar sprint atual');
    expect(showCurrent).toBeDefined();
    expect(showCurrent?.enabled).toBe(true);
    expect(showCurrent?.action).toBe('show-current');
  });

  it('config_error: "Mostrar sprint atual" degradado + "Histórico" desabilitado', () => {
    const menu = computeTrayMenu(CONFIG_ERROR);
    const showCurrent = menu.find((i) => i.label.includes('Nenhuma sprint'));
    expect(showCurrent?.enabled).toBe(false);

    const history = menu.find((i) => i.label === 'Histórico local');
    expect(history?.enabled).toBe(false);
    expect(history?.action).toBeNull();
  });

  it('idle: "Histórico local" habilitado', () => {
    const menu = computeTrayMenu(IDLE);
    const history = menu.find((i) => i.label === 'Histórico local');
    expect(history?.enabled).toBe(true);
    expect(history?.action).toBe('open-history');
  });

  it('sprint_active: "Histórico local" habilitado', () => {
    const menu = computeTrayMenu(SPRINT_1);
    const history = menu.find((i) => i.label === 'Histórico local');
    expect(history?.enabled).toBe(true);
  });

  it('todos os estados: "Sobre" habilitado', () => {
    for (const state of [LOADING, IDLE, SPRINT_1, CONFIG_ERROR]) {
      const menu = computeTrayMenu(state);
      const about = menu.find((i) => i.label === 'Sobre');
      expect(about?.enabled).toBe(true);
      expect(about?.action).toBe('about');
    }
  });

  it('todos os estados: header "Sprint Operator Agent" sempre presente e desabilitado', () => {
    for (const state of [LOADING, IDLE, SPRINT_1, CONFIG_ERROR]) {
      const menu = computeTrayMenu(state);
      expect(menu[0]?.label).toBe('Sprint Operator Agent');
      expect(menu[0]?.enabled).toBe(false);
    }
  });

  it('nenhum estado expõe item "Sair" — RN-04 W1', () => {
    for (const state of [LOADING, IDLE, SPRINT_1, CONFIG_ERROR]) {
      const menu = computeTrayMenu(state);
      const sair = menu.find((i) => i.label.toLowerCase().includes('sair'));
      expect(sair).toBeUndefined();
    }
  });
});
