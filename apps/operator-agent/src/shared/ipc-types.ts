/**
 * Contratos IPC compartilhados entre main process e renderer do Sprint
 * Operator Agent.
 *
 * Diferente do Leader, o Agent tem padrão **bidirecional rico**:
 *
 * - **Renderer → Main (invoke/handle)**: `config:get`, `sprint:acknowledge`.
 *   Resposta envelopada em `IpcResult<T>` (genérico) ou em discriminated
 *   union dedicada (`ConfigStatusResponse` — renderer precisa do `code`
 *   tipado para escolher mensagens específicas de erro).
 *
 * - **Main → Renderer (push)**: `sprint:incoming`, `queue:updated`,
 *   `overlay:minimize`. Renderer registra listener via
 *   `window.api.<scope>.on<Event>(cb)` e recebe função de unsubscribe.
 *
 * **Convenção:** `Api` tipo como interface com property-with-arrow
 * (não method-shorthand) — espelha ADR-017 do Leader para evitar lint
 * `@typescript-eslint/unbound-method` em `vi.mocked(window.api.X)`.
 *
 * @see DECISIONS.md ADR-009 — IPC contract-first
 * @see DECISIONS.md ADR-017 — property-with-arrow no IPC API
 */

import type { SprintPayload } from '@sprint/contracts';

// =============================================================================
// Envelope genérico
// =============================================================================

/**
 * Resultado de chamada IPC com payload tipado. Erros viram
 * `{ ok: false, error }` em vez de exceções — exceptions não cruzam o IPC
 * Electron.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export interface IpcError {
  /** Código curto para branching no renderer. */
  code: string;
  /** Mensagem human-readable em pt-BR. */
  message: string;
  /** Payload livre para debug — não exibir bruto ao usuário. */
  details?: unknown;
}

// =============================================================================
// config:get — leitura do agent-config.json em app.getPath('userData')
// =============================================================================

/**
 * Códigos de erro do loader de config. Espelha {@link LeaderConfigErrorCode}
 * mas mais enxuto (3 vs 5 códigos — Agent não precisa distinguir JSON_INVALID
 * de SCHEMA_INVALID na UI; ambos viram `INVALID`).
 */
export type ConfigErrorCode = 'NOT_FOUND' | 'INVALID' | 'INACCESSIBLE';

/**
 * View pública da config do agente. Campos com defaults resolvidos para
 * millissegundos prontos para consumir pelos services.
 *
 * `pollingIntervalMs` e `minimizeAfterMs` são CALCULADOS pelo main:
 * - `pollingIntervalMs = polling_interval_seconds * 1000` (default 3000 — ADR-004)
 * - `minimizeAfterMs = minimize_after_seconds * 1000` (default 30000)
 */
export interface ConfigView {
  /** UNC ou path absoluto da pasta compartilhada SMB. */
  sharedPath: string;
  /** Identificador único do operador (`user_id`). */
  userId: string;
  /** Nome amigável do operador (`user_nome_exibicao`). */
  userNomeExibicao: string;
  /** Hostname da estação. */
  hostname: string;
  /** Intervalo de polling em millissegundos (já resolvido com default). */
  pollingIntervalMs: number;
  /** Tempo até overlay minimizar para tray em millissegundos. */
  minimizeAfterMs: number;
}

export interface ConfigErrorInfo {
  code: ConfigErrorCode;
  /** Mensagem human-readable em pt-BR (exibida em diálogos/balloons). */
  message: string;
  /** Caminho do config.json que foi tentado — para o operador copiar/abrir. */
  expectedPath: string;
}

/**
 * Resultado do `config:get`. Discriminated union (em vez de
 * `IpcResult<ConfigView>` genérico) porque a UI/tray precisa do `code`
 * tipado para escolher mensagens específicas.
 */
export type ConfigStatusResponse =
  | { ok: true; config: ConfigView }
  | { ok: false; error: ConfigErrorInfo };

// =============================================================================
// sprint:incoming — push main → renderer quando overlay deve exibir sprint
// =============================================================================

export interface IncomingSprintEvent {
  /** Payload completo da sprint (já sanitizado pelo Leader; renderer re-sanitiza). */
  sprint: SprintPayload;
  /** Quantidade total de sprints na fila (incluindo a atual). UI mostra "+N na fila". */
  queueLength: number;
  /**
   * `true` quando o evento é uma reabertura via tray (BL-C3-009) — sprint
   * já foi ackeada anteriormente, sendo apenas re-exibida do histórico
   * local. UI deve mostrar botão "Fechar" em vez de "Recebido" e o handler
   * de fechamento NÃO grava ack adicional.
   *
   * Opcional — ausente em pushes normais (fluxo de fila padrão).
   */
  reopened?: boolean;
  /**
   * `true` quando o renderer deve tocar o som de notificação ao exibir esta
   * sprint (BL-C3-014). Computado pelo main como
   * `som_notificacao && exibição inicial && !reabertura`. Ausente/`false` →
   * silêncio (reabertura via tray, ou som desabilitado no `config.json`).
   * O som no renderer é fail-safe — falha de áudio não afeta o overlay.
   */
  playSound?: boolean;
}

// =============================================================================
// queue:updated — push main → renderer quando a fila muda (ack/dequeue)
// =============================================================================

export interface QueueUpdatedEvent {
  /** Quantidade atual de sprints na fila (após o evento que disparou o update). */
  queueLength: number;
}

// =============================================================================
// overlay:minimize — push main → renderer quando timer minimiza o overlay
// =============================================================================

/**
 * Evento sem payload — apenas sinaliza "o overlay vai minimizar agora".
 * Renderer pode usar para parar animações ou resetar estado de UI.
 */
export type OverlayMinimizeEvent = Record<string, never>;

// =============================================================================
// Pill (BL-C3-017) — badge minimizado pós-ack
// =============================================================================

/**
 * Subset da sprint exibida no pill — campos visíveis ao operador no
 * `<Pill>` do `@sprint/ui-kit`. Inclui identificadores (sprintId,
 * userId) para distinguir a sprint + dados renderizados (title como
 * label muted, meta como value destacado, deadline_at formatado para
 * "Até: HH:MMh" no modo expanded).
 *
 * Sessão 24 (redesign Pill): adicionado `deadline_at` ao payload — o
 * renderer agora precisa do timestamp para mostrar a deadline no modo
 * expanded. Antes não era enviado porque pill era informacional só com
 * label+value. Sem body_html (pill não exibe corpo da sprint).
 */
export interface PillCurrentInfo {
  sprintId: string;
  userId: string;
  title: string;
  meta: number;
  /** Timestamp ISO-8601 da deadline — renderer formata para HH:MMh. */
  deadline_at: string;
}

/**
 * Push main → renderer quando o pill troca de sprint (ex.: operador ack
 * sprint A → pill A; operador ack sprint B → pill atualiza para B sem
 * destruir a janela).
 */
export interface PillUpdateEvent {
  info: PillCurrentInfo;
}

// =============================================================================
// sprint:acknowledge — renderer → main quando operador clica "Recebi"
// =============================================================================

export interface AcknowledgeSprintRequest {
  /** ULID da sprint sendo ackeada. */
  sprint_id: string;
  /** user_id do operador (sanity check — main valida que casa com config.userId). */
  user_id: string;
}

export interface AcknowledgeSprintResponse {
  /** ISO timestamp do momento que o ack final foi escrito no shared. */
  acknowledged_at: string;
  /** Indica se o JSON foi movido para histórico local com sucesso. */
  moved_to_history: boolean;
}

// =============================================================================
// Setup wizard (BL-C5-006) — first-run: coleta user_id + shared_path
// =============================================================================

/** Pedido de sondagem de conexão à pasta compartilhada ("Testar conexão"). */
export interface SetupProbeRequest {
  /** UNC ou caminho da pasta compartilhada a sondar. */
  shared_path: string;
}

/**
 * Resultado da sondagem — `reachable` + mensagem human-readable pt-BR.
 * Reaproveita o classificador `isConnectivityError` (BL-C3-013) no main; o
 * renderer apenas exibe. Erros inesperados viram `reachable: false`.
 */
export interface SetupProbeResult {
  reachable: boolean;
  message: string;
}

/**
 * Entrada do wizard. `user_nome_exibicao` é opcional — o main usa `user_id`
 * como default quando ausente/vazio. Os demais campos do `AgentConfig`
 * (`schema_version`, `hostname`, `polling_interval_seconds`, `som_notificacao`,
 * `log_level`) são derivados/default no MAIN — o renderer NÃO os envia.
 */
export interface SetupSaveInput {
  user_id: string;
  shared_path: string;
  user_nome_exibicao?: string;
}

/**
 * Resultado do save. Sucesso traz o caminho do `config.json` gravado (o
 * renderer pode exibir). Falha discrimina entre validação (Zod), escrita (I/O)
 * e inesperado.
 */
export type SetupSaveResult =
  | { ok: true; configPath: string }
  | { ok: false; code: 'VALIDATION' | 'WRITE' | 'UNKNOWN'; message: string };

// =============================================================================
// Api — superfície exposta pelo preload via contextBridge
// =============================================================================

/**
 * Função de unsubscribe retornada pelos listeners push (main → renderer).
 *
 * Renderer DEVE chamar isto no cleanup do useEffect — sem unsubscribe, o
 * listener vaza e o handler dispara em componentes desmontados.
 */
export type Unsubscribe = () => void;

/**
 * API exposta pelo main process ao renderer através do preload.
 *
 * Estrutura aninhada por escopo (config / sprint / queue / overlay). Diferente
 * do Leader que tem 4 endpoints flat, o Agent tem 6 (3 invoke + 3 push) e
 * o agrupamento melhora legibilidade.
 *
 * **Convenção:** properties são arrow functions (não method-shorthand) para
 * evitar lint `@typescript-eslint/unbound-method` quando testes fazem
 * `vi.mocked(window.api.config.get)` — mesma decisão do Leader (ADR-017).
 */
export interface Api {
  readonly config: {
    /**
     * Lê e valida `agent-config.json` em `app.getPath('userData')`. Retorna
     * discriminated union — renderer ramifica em `error.code` para mensagens
     * específicas. Idempotente: pode ser chamado várias vezes (ex.: após
     * operador criar config e recarregar a janela).
     */
    readonly get: () => Promise<ConfigStatusResponse>;
  };

  readonly sprint: {
    /**
     * Pull pattern (renderer → main) usado APENAS no mount inicial do
     * renderer para evitar race entre `window.webContents.send` e o
     * registro de listener do React (useEffect roda após primeira
     * pintura — pode perder o primeiro push `sprint:incoming`). Retorna
     * a sprint atualmente exibida + queueLength, ou `null` se overlay
     * abriu sem sprint na fila (nunca deveria ocorrer em produção, mas
     * cobre o caso defensivo).
     */
    readonly requestCurrent: () => Promise<IncomingSprintEvent | null>;

    /**
     * Operador clicou "Recebi" no overlay. Main escreve ack final com
     * `acknowledged_at`, move o JSON para histórico local, deleta do
     * shared/pending e dequeue. Próxima sprint da fila (se houver) é
     * exibida automaticamente via `sprint:incoming`.
     *
     * Em falha: retorna `{ ok: false }` — renderer mostra toast e mantém
     * o overlay para retry.
     */
    readonly acknowledge: (
      req: AcknowledgeSprintRequest,
    ) => Promise<IpcResult<AcknowledgeSprintResponse>>;

    /**
     * Registra callback para novas sprints. Disparado pelo `queueService`
     * quando a queue vai de vazia → não-vazia, OU quando uma sprint é
     * ackeada e há próxima na fila.
     *
     * Renderer recebe sprint + `queueLength` total (inclui a atual).
     * Retorna função de unsubscribe — chamar no cleanup do useEffect.
     */
    readonly onIncoming: (cb: (event: IncomingSprintEvent) => void) => Unsubscribe;
  };

  readonly queue: {
    /**
     * Registra callback para mudanças na fila (sem nova sprint a exibir).
     * Disparado quando a fila muda mas o overlay permanece (ex.: nova
     * sprint chega enquanto outra está sendo exibida — UI mostra
     * "+N na fila").
     */
    readonly onUpdated: (cb: (event: QueueUpdatedEvent) => void) => Unsubscribe;
  };

  readonly overlay: {
    /**
     * Registra callback para minimização do overlay disparada pelo timer
     * do main (`minimizeAfterMs`). Renderer pode usar para parar animações
     * ou resetar estado de UI (ack permanece pendente — não foi clicado).
     */
    readonly onMinimize: (cb: () => void) => Unsubscribe;

    /**
     * Fecha o overlay quando exibido em modo de reabertura (BL-C3-009 —
     * `reopened: true`). Apenas oculta a janela; NÃO grava ack adicional
     * (sprint já foi ackeada anteriormente). No-op se o overlay não está
     * em modo de reabertura.
     */
    readonly closeReopened: () => Promise<void>;
  };

  /**
   * API do pill (BL-C3-017) — usado pela janela do pill (`?pill` no
   * URL). Renderer pulla info atual no mount + subscribe a updates.
   *
   * Sessão 24: removido `expand` IPC. Click no pill é state local do
   * renderer (`useState(isExpanded)` em PillApp) — não reabre overlay
   * fullscreen. Auto-collapse após 5s gerenciado pelo renderer via
   * setTimeout. Overlay aparece apenas em dispatch novo.
   */
  readonly pill: {
    /**
     * Pull pattern (renderer → main) usado no mount do `<PillApp>` para
     * obter a sprint exibida no pill atualmente. Retorna `null` se o
     * pill ainda não foi configurado (race possível durante boot da
     * janela).
     */
    readonly requestCurrent: () => Promise<PillCurrentInfo | null>;

    /**
     * Registra callback para atualizações de conteúdo do pill (operador
     * acka uma nova sprint enquanto pill já existe; pill troca de
     * sprint sem destruir/recriar a janela).
     */
    readonly onUpdate: (cb: (event: PillUpdateEvent) => void) => Unsubscribe;

    /**
     * Drag horizontal do pill window (Sessão 26). Operador segura
     * pointer down no pill e arrasta para a esquerda/direita; a
     * BrowserWindow do pill move via `setPosition` no main para
     * acompanhar o cursor. Movimento clampado às bordas da tela
     * primária — pill nunca sai da viewport.
     *
     * Renderer envia `screenX` absoluto (não `clientX` relativo à
     * janela) — assim main não precisa compensar movimento próprio
     * causando feedback loop.
     */
    readonly beginDrag: (screenX: number) => Promise<void>;
    readonly dragTo: (screenX: number) => Promise<void>;
    readonly endDrag: () => Promise<void>;
  };

  /**
   * API do wizard de configuração inicial (BL-C5-006) — usado pela janela de
   * setup (`?setup` no URL) que aparece no first-run quando o `config.json`
   * está ausente/inválido. Inputs validados no MAIN (Zod/AgentConfig); o
   * renderer não toca em `fs`.
   */
  readonly setup: {
    /**
     * Sonda a pasta compartilhada informada (botão "Testar conexão"). Reusa o
     * `listPending` do C4 + `isConnectivityError` do C3-013. Não persiste nada.
     */
    readonly probe: (req: SetupProbeRequest) => Promise<SetupProbeResult>;

    /**
     * Valida o input (Zod/AgentConfig), deriva `hostname` + defaults, grava o
     * `config.json` em `ProgramData` e destrava a operação normal (rebuildDeps
     * + fecha o wizard). Retorna o caminho gravado em caso de sucesso.
     */
    readonly save: (input: SetupSaveInput) => Promise<SetupSaveResult>;
  };
}
