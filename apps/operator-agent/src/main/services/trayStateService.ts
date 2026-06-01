/**
 * Tray state service — funções puras que computam aparência e menu do
 * tray icon a partir de um `TrayState` declarativo + um `ConnectionStatus`
 * (BL-C3-013).
 *
 * Separação deliberada do `trayService` (impure, integra Electron Tray):
 *
 * - `trayStateService` (este arquivo): apenas funções que mapeiam estado
 *   → outputs (cor do ícone, tooltip, lista de itens de menu). Zero
 *   dependência do Electron. **Testável isoladamente** sem mocks.
 *
 * - `trayService` (sibling): mantém referência ao `Tray` do Electron e
 *   chama `tray.setImage`/`setContextMenu`/`setToolTip` baseado nos
 *   outputs deste módulo. Wiring de cliques do menu também fica lá.
 *
 * **Conexão é uma dimensão ortogonal ao `TrayState`** (BL-C3-013, ADR-027):
 * o `state` descreve sprint/config; o `connection` descreve a saúde do link
 * com a pasta compartilhada. As funções compõem as duas — "sem conexão"
 * sobrepõe o resto (vermelho), e o idle conectado vira verde.
 *
 * @see DECISIONS.md ADR-011 (arquitetura tray-resident)
 * @see DECISIONS.md ADR-027 (reconexão com backoff + sinalização vermelho/verde)
 */

import type { ConnectionStatus } from './connectivity';

/**
 * Estado do tray. Discriminated union — `kind` identifica o cenário.
 *
 * - `idle`: agent rodando, polling ativo, sem sprint na fila.
 * - `sprint_active`: pelo menos 1 sprint na fila. `queueLength` informa
 *   total (inclui a sprint atualmente exibida, se houver).
 * - `config_error`: config faltando/inválida. Polling NÃO inicia. Tray
 *   vermelho até operador corrigir.
 * - `loading`: estado inicial entre `app.whenReady()` e o primeiro
 *   `setState` (boot). Tray cinza, tooltip neutro. Curto-lived.
 */
export type TrayState =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'sprint_active'; queueLength: number }
  | { kind: 'config_error'; reason: string };

/**
 * Cor do ícone — string nominal, mapeada pelo `trayService` para path
 * absoluto do `.png`/`.ico` em `build/`. Mantemos string aqui (em vez de
 * path) para preservar pureza.
 *
 * `green` (BL-C3-013) sinaliza "conectado e ocioso"; `red` cobre tanto
 * `config_error` quanto "sem conexão com a pasta compartilhada".
 */
export type TrayIconColor = 'gray' | 'yellow' | 'red' | 'green';

/**
 * Identificador estável de ação do menu — `trayService` faz dispatch
 * baseado no `action`. Strings literais (não enums) para serializar bem
 * e ser inspecionável em testes.
 *
 * `null` = item não é clicável (header / separador semântico / status).
 *
 * - `show-current`: restaura overlay minimizado (sprint atual).
 * - `reopen-last`: reabre último aviso do histórico local (BL-C3-009).
 * - `open-history`: abre `<userData>/historico/` no Explorer.
 * - `about`: dialog "Sobre".
 */
export type TrayMenuAction = 'show-current' | 'reopen-last' | 'open-history' | 'about' | null;

/**
 * Item de menu. `enabled: false` cria itens visíveis mas inativos
 * (ex.: "Mostrar sprint atual" quando não há sprint).
 */
export interface TrayMenuItem {
  /** Label exibido no menu. */
  label: string;
  /** True = clicável; False = visível mas inativo. */
  enabled: boolean;
  /** Identificador de ação. `null` para separadores/headers/status. */
  action: TrayMenuAction;
}

/**
 * Formata um `Date` para "HH:MM" no horário local do operador. Puro, sem
 * `date-fns` (proibido novas deps no C3). Tests fixam o TZ
 * (`America/Sao_Paulo`) para determinismo.
 */
function formatHhMm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Label do item de menu "Status da conexão" (BL-C3-013).
 *
 * - `null` (ainda não sondado / boot) → "verificando…".
 * - online → "conectado".
 * - offline → "sem conexão" + "(última: HH:MM)" se já houve conexão.
 */
export function formatConnectionStatusLabel(connection: ConnectionStatus | null): string {
  if (connection === null) return 'Conexão: verificando…';
  if (connection.online) return 'Conexão: conectado';
  const last = connection.lastConnectedAt;
  const suffix = last !== null ? ` (última: ${formatHhMm(last)})` : '';
  return `Conexão: sem conexão${suffix}`;
}

/**
 * Computa a cor do ícone para o estado + conexão dados.
 *
 * Precedência:
 * 1. `config_error` → vermelho (problema de boot, independe de conexão).
 * 2. sem conexão (`connection.online === false`) → vermelho (sobrepõe os
 *    demais — operador precisa saber que o share caiu).
 * 3. `loading` → cinza.
 * 4. `sprint_active` → amarelo (operador tem algo pendente — RF-08).
 * 5. `idle` conectado → verde; conexão desconhecida (`null`) → cinza.
 *
 * @param connection `null` quando a conexão ainda não foi sondada (boot /
 *   antes do 1º ciclo de polling).
 */
export function computeTrayIconColor(
  state: TrayState,
  connection: ConnectionStatus | null = null,
): TrayIconColor {
  if (state.kind === 'config_error') return 'red';
  if (connection !== null && !connection.online) return 'red';
  switch (state.kind) {
    case 'loading':
      return 'gray';
    case 'sprint_active':
      return 'yellow';
    case 'idle':
      return connection?.online ? 'green' : 'gray';
  }
}

/**
 * Computa a tooltip do tray (texto curto que aparece em hover).
 *
 * Mensagens em pt-BR. `config_error` mostra a razão; "sem conexão" mostra
 * o link caído (+ última conexão, se houver); idle conectado prefixa
 * "conectado ·".
 */
export function computeTrayTooltip(
  state: TrayState,
  connection: ConnectionStatus | null = null,
): string {
  if (state.kind === 'config_error') {
    return `Sprint Operator Agent — ${state.reason}`;
  }
  if (connection !== null && !connection.online) {
    const last = connection.lastConnectedAt;
    const suffix = last !== null ? ` (última conexão ${formatHhMm(last)})` : '';
    return `Sprint Operator Agent — sem conexão com a pasta compartilhada${suffix}`;
  }
  switch (state.kind) {
    case 'loading':
      return 'Sprint Operator Agent — iniciando…';
    case 'idle': {
      const prefix = connection?.online ? 'conectado · ' : '';
      return `Sprint Operator Agent — ${prefix}aguardando sprints`;
    }
    case 'sprint_active': {
      const n = state.queueLength;
      if (n === 1) return 'Sprint Operator Agent — 1 sprint na fila';
      return `Sprint Operator Agent — ${n} sprints na fila`;
    }
  }
}

/**
 * Computa o menu de contexto do tray.
 *
 * Estrutura constante (item visível em todo estado), mas `enabled` e
 * `label` mudam por estado/conexão:
 *
 * - "Status da conexão" (BL-C3-013): item informativo (desabilitado) que
 *   reflete `connection` — conectado / sem conexão (última: HH:MM).
 * - "Mostrar sprint atual": habilitado só em `sprint_active`.
 * - "Reabrir último aviso" (BL-C3-009): habilitado iff `idle`.
 * - "Histórico local": habilitado exceto em `config_error`.
 * - "Sobre": sempre habilitado.
 *
 * **"Sair" ocluso no W1** — RN-04 (operador não pode fechar o agente).
 * Fortificação completa com senha de admin em W3.
 */
export function computeTrayMenu(
  state: TrayState,
  connection: ConnectionStatus | null = null,
): readonly TrayMenuItem[] {
  const hasSprint = state.kind === 'sprint_active';
  const canReopen = state.kind === 'idle';
  return [
    {
      label: 'Sprint Operator Agent',
      enabled: false,
      action: null,
    },
    {
      label: formatConnectionStatusLabel(connection),
      enabled: false,
      action: null,
    },
    {
      label: hasSprint ? 'Mostrar sprint atual' : 'Nenhuma sprint na fila',
      enabled: hasSprint,
      action: hasSprint ? 'show-current' : null,
    },
    {
      label: 'Reabrir último aviso',
      enabled: canReopen,
      action: canReopen ? 'reopen-last' : null,
    },
    {
      label: 'Histórico local',
      enabled: state.kind !== 'config_error',
      action: state.kind !== 'config_error' ? 'open-history' : null,
    },
    {
      label: 'Sobre',
      enabled: true,
      action: 'about',
    },
  ] as const;
}
