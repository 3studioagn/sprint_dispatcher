/**
 * Tray state service — funções puras que computam aparência e menu do
 * tray icon a partir de um `TrayState` declarativo.
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
 * @see DECISIONS.md ADR-011 (arquitetura tray-resident)
 */

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
 * absoluto do `.ico` em `build/`. Mantemos string aqui (em vez de path)
 * para preservar pureza.
 */
export type TrayIconColor = 'gray' | 'yellow' | 'red';

/**
 * Identificador estável de ação do menu — `trayService` faz dispatch
 * baseado no `action`. Strings literais (não enums) para serializar bem
 * e ser inspecionável em testes.
 *
 * `null` = item não é clicável (header / separador semântico).
 */
export type TrayMenuAction = 'show-current' | 'open-history' | 'about' | null;

/**
 * Item de menu. `enabled: false` cria itens visíveis mas inativos
 * (ex.: "Mostrar sprint atual" quando não há sprint).
 */
export interface TrayMenuItem {
  /** Label exibido no menu. */
  label: string;
  /** True = clicável; False = visível mas inativo. */
  enabled: boolean;
  /** Identificador de ação. `null` para separadores/headers. */
  action: TrayMenuAction;
}

/**
 * Computa a cor do ícone para o estado dado.
 *
 * `loading`/`idle` → cinza (neutro, sem chamar atenção).
 * `sprint_active` → amarelo (operador tem algo pendente — RF-08).
 * `config_error` → vermelho (atenção crítica — operador deve agir).
 */
export function computeTrayIconColor(state: TrayState): TrayIconColor {
  switch (state.kind) {
    case 'loading':
    case 'idle':
      return 'gray';
    case 'sprint_active':
      return 'yellow';
    case 'config_error':
      return 'red';
  }
}

/**
 * Computa a tooltip do tray (texto curto que aparece em hover).
 *
 * Mensagens em pt-BR. Para `sprint_active`, inclui contagem da fila
 * (pluralização correta — operador pode ter 1 ou N sprints aguardando).
 */
export function computeTrayTooltip(state: TrayState): string {
  switch (state.kind) {
    case 'loading':
      return 'Sprint Operator Agent — iniciando…';
    case 'idle':
      return 'Sprint Operator Agent — aguardando sprints';
    case 'sprint_active': {
      const n = state.queueLength;
      if (n === 1) return 'Sprint Operator Agent — 1 sprint na fila';
      return `Sprint Operator Agent — ${n} sprints na fila`;
    }
    case 'config_error':
      return `Sprint Operator Agent — ${state.reason}`;
  }
}

/**
 * Computa o menu de contexto do tray.
 *
 * Estrutura constante (item visível em todo estado), mas `enabled` e
 * `label` mudam por estado:
 *
 * - "Mostrar sprint atual": habilitado só em `sprint_active`.
 * - "Histórico local": sempre habilitado (operador pode inspecionar
 *   pasta `userData/historico/` mesmo sem sprint ativa).
 * - "Sobre": sempre habilitado.
 *
 * **"Sair" ocluso no W1** — RN-04 (operador não pode fechar o agente).
 * Fortificação completa com senha de admin em W3.
 */
export function computeTrayMenu(state: TrayState): readonly TrayMenuItem[] {
  const hasSprint = state.kind === 'sprint_active';
  return [
    {
      label: 'Sprint Operator Agent',
      enabled: false,
      action: null,
    },
    {
      label: hasSprint ? 'Mostrar sprint atual' : 'Nenhuma sprint na fila',
      enabled: hasSprint,
      action: hasSprint ? 'show-current' : null,
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
