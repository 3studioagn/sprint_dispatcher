/**
 * Testes das funções puras do trayStateService.
 *
 * Cobre cada `TrayState.kind` × cada função (3 estados × 3 funções).
 * Sem mocks — funções são puras.
 */

import { describe, expect, it } from 'vitest';

import type { ConnectionStatus } from './connectivity';
import {
  computeTrayIconColor,
  computeTrayMenu,
  computeTrayTooltip,
  formatConnectionStatusLabel,
  type TrayState,
} from './trayStateService';

const LOADING: TrayState = { kind: 'loading' };
const IDLE: TrayState = { kind: 'idle' };
const SPRINT_1: TrayState = { kind: 'sprint_active', queueLength: 1 };
const SPRINT_3: TrayState = { kind: 'sprint_active', queueLength: 3 };
const CONFIG_ERROR: TrayState = { kind: 'config_error', reason: 'config ausente' };

const ONLINE: ConnectionStatus = { online: true, lastConnectedAt: new Date('2026-06-01T13:05:00') };
const OFFLINE_WITH_LAST: ConnectionStatus = {
  online: false,
  lastConnectedAt: new Date('2026-06-01T13:05:00'),
};
const OFFLINE_NEVER: ConnectionStatus = { online: false, lastConnectedAt: null };

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

  it('todos os estados: header da marca sempre presente em menu[0] e desabilitado', () => {
    for (const state of [LOADING, IDLE, SPRINT_1, CONFIG_ERROR]) {
      const menu = computeTrayMenu(state);
      expect(menu[0]?.label).toBe('Metas - Desenhistas');
      expect(menu[0]?.enabled).toBe(false);
    }
  });

  describe('BL-C5-006 — item "Configurar…"', () => {
    it('config_error: presente e habilitado com action open-setup', () => {
      const menu = computeTrayMenu(CONFIG_ERROR);
      const setup = menu.find((i) => i.label === 'Configurar…');
      expect(setup).toBeDefined();
      expect(setup?.enabled).toBe(true);
      expect(setup?.action).toBe('open-setup');
    });

    it('não aparece fora de config_error', () => {
      for (const state of [LOADING, IDLE, SPRINT_1]) {
        const menu = computeTrayMenu(state);
        expect(menu.find((i) => i.label === 'Configurar…')).toBeUndefined();
      }
    });
  });

  it('nenhum estado expõe item "Sair" — RN-04 W1', () => {
    for (const state of [LOADING, IDLE, SPRINT_1, CONFIG_ERROR]) {
      const menu = computeTrayMenu(state);
      const sair = menu.find((i) => i.label.toLowerCase().includes('sair'));
      expect(sair).toBeUndefined();
    }
  });

  describe('BL-C3-009 — item "Reabrir último aviso"', () => {
    it('idle: habilitado com action reopen-last', () => {
      const menu = computeTrayMenu(IDLE);
      const reopen = menu.find((i) => i.label === 'Reabrir último aviso');
      expect(reopen).toBeDefined();
      expect(reopen?.enabled).toBe(true);
      expect(reopen?.action).toBe('reopen-last');
    });

    it('sprint_active: desabilitado (show-current já cobre)', () => {
      const menu = computeTrayMenu(SPRINT_1);
      const reopen = menu.find((i) => i.label === 'Reabrir último aviso');
      expect(reopen).toBeDefined();
      expect(reopen?.enabled).toBe(false);
      expect(reopen?.action).toBeNull();
    });

    it('config_error: desabilitado', () => {
      const menu = computeTrayMenu(CONFIG_ERROR);
      const reopen = menu.find((i) => i.label === 'Reabrir último aviso');
      expect(reopen?.enabled).toBe(false);
      expect(reopen?.action).toBeNull();
    });

    it('loading: desabilitado (estado transitório)', () => {
      const menu = computeTrayMenu(LOADING);
      const reopen = menu.find((i) => i.label === 'Reabrir último aviso');
      expect(reopen?.enabled).toBe(false);
      expect(reopen?.action).toBeNull();
    });
  });
});

// =============================================================================
// BL-C3-013 — dimensão de conexão (vermelho/verde + tooltip + "Status da conexão")
// =============================================================================

describe('computeTrayIconColor — dimensão de conexão (BL-C3-013)', () => {
  it('idle conectado → verde', () => {
    expect(computeTrayIconColor(IDLE, ONLINE)).toBe('green');
  });

  it('idle com conexão desconhecida (null) → cinza', () => {
    expect(computeTrayIconColor(IDLE, null)).toBe('gray');
  });

  it('sem conexão → vermelho (sobrepõe idle e sprint_active)', () => {
    expect(computeTrayIconColor(IDLE, OFFLINE_WITH_LAST)).toBe('red');
    expect(computeTrayIconColor(SPRINT_1, OFFLINE_WITH_LAST)).toBe('red');
    expect(computeTrayIconColor(SPRINT_3, OFFLINE_NEVER)).toBe('red');
  });

  it('sprint_active conectado permanece amarelo (pendência preservada)', () => {
    expect(computeTrayIconColor(SPRINT_1, ONLINE)).toBe('yellow');
  });

  it('config_error é vermelho mesmo se a conexão estiver online', () => {
    expect(computeTrayIconColor(CONFIG_ERROR, ONLINE)).toBe('red');
  });

  it('loading permanece cinza quando online', () => {
    expect(computeTrayIconColor(LOADING, ONLINE)).toBe('gray');
  });
});

describe('computeTrayTooltip — dimensão de conexão (BL-C3-013)', () => {
  it('sem conexão com última conexão conhecida inclui HH:MM', () => {
    const tip = computeTrayTooltip(IDLE, OFFLINE_WITH_LAST);
    expect(tip).toContain('sem conexão');
    expect(tip).toContain('última conexão 13:05');
  });

  it('sem conexão e nunca conectou omite o HH:MM', () => {
    const tip = computeTrayTooltip(IDLE, OFFLINE_NEVER);
    expect(tip).toContain('sem conexão');
    expect(tip).not.toContain('última conexão');
  });

  it('idle conectado prefixa "conectado ·"', () => {
    expect(computeTrayTooltip(IDLE, ONLINE)).toContain('conectado · aguardando sprints');
  });

  it('config_error ignora conexão (mostra a razão)', () => {
    expect(computeTrayTooltip(CONFIG_ERROR, OFFLINE_WITH_LAST)).toContain('config ausente');
  });
});

describe('formatConnectionStatusLabel (BL-C3-013)', () => {
  it('null → verificando…', () => {
    expect(formatConnectionStatusLabel(null)).toBe('Conexão: verificando…');
  });

  it('online → conectado', () => {
    expect(formatConnectionStatusLabel(ONLINE)).toBe('Conexão: conectado');
  });

  it('offline com última conexão → inclui (última: HH:MM)', () => {
    expect(formatConnectionStatusLabel(OFFLINE_WITH_LAST)).toBe(
      'Conexão: sem conexão (última: 13:05)',
    );
  });

  it('offline e nunca conectou → sem sufixo', () => {
    expect(formatConnectionStatusLabel(OFFLINE_NEVER)).toBe('Conexão: sem conexão');
  });
});

describe('computeTrayMenu — item "Status da conexão" (BL-C3-013)', () => {
  it('insere item de status (desabilitado) refletindo a conexão', () => {
    const menu = computeTrayMenu(IDLE, OFFLINE_WITH_LAST);
    const status = menu.find((i) => i.label.startsWith('Conexão:'));
    expect(status).toBeDefined();
    expect(status?.enabled).toBe(false);
    expect(status?.action).toBeNull();
    expect(status?.label).toContain('sem conexão');
  });

  it('sem connection (null) mostra "verificando…"', () => {
    const menu = computeTrayMenu(IDLE);
    const status = menu.find((i) => i.label.startsWith('Conexão:'));
    expect(status?.label).toBe('Conexão: verificando…');
  });

  it('header continua em menu[0] (item de status vem depois)', () => {
    const menu = computeTrayMenu(IDLE, ONLINE);
    expect(menu[0]?.label).toBe('Metas - Desenhistas');
    expect(menu[1]?.label).toBe('Conexão: conectado');
  });
});
