/**
 * Contratos IPC compartilhados entre main process e renderer.
 *
 * Toda comunicação main↔renderer passa por este tipo. O preload script
 * implementa `LeaderAPI` e expõe via `contextBridge.exposeInMainWorld`.
 * O renderer consome via `window.api: LeaderAPI`.
 *
 * Convenção de nomes IPC:
 * - Métodos imperativos em camelCase → `ping`, `getConfig`, `listOperators`,
 *   `dispatchSprint`.
 * - Canais correspondem 1-to-1 ao nome do método (sem prefixos `scope:`).
 *
 * Erros entre processes são **serializáveis** — nunca retornar `Error`
 * direto; envelopar em `IpcResult<T>` (genérico) ou em discriminated union
 * específica (`GetConfigResult` para config, onde o renderer precisa do
 * `code` tipado para escolher mensagens específicas na ConfigErrorScreen).
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 */

import type { Operator } from './types/operator';

// =============================================================================
// Envelope genérico
// =============================================================================

/**
 * Resultado de chamada IPC com payload tipado. Erros viram
 * `{ ok: false, error }` em vez de exceções (não-serializáveis no IPC
 * Electron).
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export interface IpcError {
  /** Código curto para branching no renderer (mensagem específica). */
  code: string;
  /** Mensagem human-readable em pt-BR. */
  message: string;
  /** Payload livre para debug — não exibir bruto ao usuário. */
  details?: unknown;
}

// =============================================================================
// config:get — leitura do leader-config.json em app.getPath('userData')
// =============================================================================

export type ConfigErrorCode =
  | 'NOT_FOUND'
  | 'JSON_INVALID'
  | 'SCHEMA_INVALID'
  | 'READ_ERROR'
  | 'SHARED_PATH_INACCESSIBLE';

/**
 * View pública da config do líder enviada ao renderer.
 *
 * Defense-in-depth — espelha o padrão `SafeAgentConfigView` do Agent
 * (ADR-012). Atualmente todos os campos do `LeaderConfig` são públicos,
 * mas o tipo separado preserva a opção de esconder campos sensíveis
 * (ex.: tokens) sem refactor de IPC quando entrarem.
 */
export interface LeaderConfigView {
  /** UNC ou path absoluto da pasta compartilhada SMB. */
  shared_path: string;
  /** Identificador do líder (vai no campo `criado_por` do SprintPayload). */
  criado_por: string;
}

export interface ConfigErrorInfo {
  code: ConfigErrorCode;
  /** Mensagem human-readable em pt-BR (exibida na ConfigErrorScreen). */
  message: string;
  /** Caminho que foi tentado — mostra na tela de erro para o usuário copiar. */
  expectedPath: string;
}

/**
 * Resultado do `getConfig()`. Discriminated union dedicada (em vez do
 * `IpcResult<T>` genérico) porque a ConfigErrorScreen precisa do
 * `expectedPath` e do `code` tipado para escolher mensagens específicas.
 */
export type GetConfigResult =
  | { ok: true; config: LeaderConfigView }
  | { ok: false; error: ConfigErrorInfo };

// =============================================================================
// operators:list — leitura de <shared_path>/operators.json
// =============================================================================

export interface OperatorsListResponse {
  /** Lista completa (filtragem `ativo:true` é responsabilidade do renderer). */
  operators: readonly Operator[];
  /** Caminho absoluto do operators.json lido (debug/troubleshoot). */
  source: string;
  /** ISO timestamp do `mtime` do arquivo. */
  lastModified: string;
}

// =============================================================================
// sprint:dispatch — grava 1 arquivo em <shared_path>/pending/ por operador
// =============================================================================

/**
 * Payload do renderer ao main para iniciar dispatch.
 *
 * Carrega só o que o main não tem como obter sozinho: o subset de
 * `user_id`s escolhidos e suas metas. `user_nome_exibicao` e `hostname`
 * são resolvidos pelo main consultando o `operatorsService` (SoT) —
 * reduz superfície IPC e evita inconsistência entre o que o renderer
 * acha que sabe e o que está em `operators.json`.
 */
export interface DispatchSprintRequest {
  readonly selected: readonly {
    user_id: string;
    meta: number;
  }[];
  /** Deadline em HH:MM 24h. Main converte em ISO via `resolveDeadlineIso`. */
  readonly deadline: string;
}

export interface DispatchSprintPerOperatorResult {
  user_id: string;
  user_nome_exibicao: string;
  status: 'success' | 'error';
  /** Nome do arquivo gravado em `pending/`. Presente em `status: 'success'`. */
  filename?: string;
  /** Mensagem human-readable em pt-BR. Presente em `status: 'error'`. */
  error_message?: string;
}

export interface DispatchSprintResponse {
  /** ULID gerado uma única vez por sprint, compartilhado entre os operadores. */
  sprint_id: string;
  per_operator: readonly DispatchSprintPerOperatorResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

// =============================================================================
// LeaderAPI — superfície exposta pelo preload via contextBridge
// =============================================================================

/**
 * API exposta pelo main process ao renderer através do preload.
 *
 * - `ping` (W0): smoke test do bridge IPC.
 * - `getConfig`/`listOperators`/`dispatchSprint` (W1.C2 — Gate 3 desta sessão):
 *   handlers reais para o MVP do Leader.
 *
 * **Convenção:** propriedades com tipo função (arrow), não método-shorthand.
 * Justificativa: o lint `@typescript-eslint/unbound-method` reclama quando
 * `vi.mocked(window.api.foo)` extrai um método sem `this:void`; tipando como
 * propriedade de função evita a falsa positiva em testes.
 */
export interface LeaderAPI {
  /**
   * Smoke test do bridge IPC. Retorna 'pong'.
   */
  ping: () => Promise<string>;

  /**
   * Lê e valida `leader-config.json` em `app.getPath('userData')`. Retorna
   * discriminated union — renderer narra para `ConfigErrorScreen` no caminho
   * de erro. Idempotente: pode ser chamado várias vezes (ex.: após o líder
   * corrigir config e recarregar a janela).
   */
  getConfig: () => Promise<GetConfigResult>;

  /**
   * Lê `<shared_path>/operators.json` via `@sprint/fs-adapter`. Retorna lista
   * completa (renderer filtra `ativo:true` na renderização). Erro genérico
   * via `IpcResult<T>{ ok: false }` com `code: OperatorsFileNotFoundError`
   * ou `OperatorsFileInvalidError`.
   */
  listOperators: () => Promise<IpcResult<OperatorsListResponse>>;

  /**
   * Despacha sprint para os operadores selecionados — gera 1 arquivo JSON
   * em `<shared_path>/pending/` por operador, com `sprint_id` (ULID)
   * compartilhado. Falhas per-operator ficam no `summary.failed`; erro
   * fatal (ex.: config faltando) vira `IpcResult<T>{ ok: false }`.
   */
  dispatchSprint: (request: DispatchSprintRequest) => Promise<IpcResult<DispatchSprintResponse>>;
}
