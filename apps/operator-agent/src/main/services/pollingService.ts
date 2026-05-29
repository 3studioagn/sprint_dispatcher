/**
 * PollingService — ciclo de detecção de sprints novas e cancelamentos em
 * `<shared>/pending/`.
 *
 * Implementação per ADR-004 (polling, NÃO `fs.watch` ou chokidar — pastas
 * SMB têm suporte instável a eventos de kernel). Default 3s entre ciclos
 * (`pollingIntervalMs` de `RuntimeConfig.pollingIntervalMs`, vindo de
 * `agent-config.json:polling_interval_seconds` × 1000 — D1 do Gate 1).
 *
 * **Escalonamento:** `setTimeout` recursivo (não `setInterval`). Evita
 * overlap se um ciclo demorar mais que o intervalo configurado (rede SMB
 * lenta, muitos arquivos em `pending/`). Cada ciclo agenda o próximo
 * APÓS terminar.
 *
 * **Caminhos por kind de PendingEntry:**
 *
 * | kind      | Ação                                                                                     |
 * | --------- | ---------------------------------------------------------------------------------------- |
 * | `invalid` | log warn + skip (RN-09 — não bloqueia outras entries do ciclo)                           |
 * | `cancel`  | (BL-C3-011) processCancel: remove fila + fecha overlay se exibido (sem ack) + archive   |
 * | `sprint`  | filtra user_id local → dedup via history → check deadline → enqueue OU descarta+delete  |
 *
 * **Filtragem por userId (BL-C3-011):** `listPending` é chamado SEM
 * filter `userId` para capturar também os `cancel-*.json` (que são
 * broadcast — não embutem user_id). Sprints de outros operadores são
 * filtradas inline em `processSprint`. Antes desta sessão o filter
 * `{ userId }` era aplicado no `listPending`, mas isso descartava
 * cancels — comportamento corrigido por BL-C3-011.
 *
 * @see DECISIONS.md ADR-004 — polling deliberado
 * @see DECISIONS.md ADR-016 — domain layer do fs-adapter (listPending entrega
 *   discriminated union PendingEntry)
 * @see Requisitos UC-05, RN-06 — cancelamento last-write-wins
 */

import { DirectoryNotFoundError, type PendingEntry, type PendingStore } from '@sprint/fs-adapter';

import type { AckService } from './ackService';
import type { HistoryService } from './historyService';
import type { OverlayService } from './overlayService';
import type { QueueService } from './queueService';

/**
 * Logger leve. `info`-level fica intencionalmente fora — a regra ESLint
 * atual permite só `console.warn`/`error`. Eventos meramente informativos
 * (e.g. "deadline passado", "cancel detected") usam `warn` em Gate 3;
 * downgrade para `info` quando `@sprint/logger` (W1.C6) entrar.
 */
export interface PollingLogger {
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
}

const SILENT_LOG: PollingLogger = {
  warn: () => undefined,
  error: () => undefined,
};

export interface PollingDeps {
  /** Domain layer wrapping `<shared>/pending/`. Injetado pelo caller. */
  pendingStore: PendingStore;
  /** Fila ordenada destino dos sprints válidos detectados. */
  queueService: QueueService;
  /** Cache de filenames já processados — dedup entre ciclos. */
  historyService: HistoryService;
  /**
   * `OverlayService` — necessário para fechar overlay quando um cancel
   * referencia a sprint atualmente exibida (BL-C3-011). Opcional para
   * testes que isolam fluxos sem overlay; em produção sempre injetado
   * pelo composition root do main.
   */
  overlayService?: OverlayService;
  /**
   * `AckService` — grava o ack inicial (`displayed_at`) da sprint promovida
   * quando um cancel fecha a sprint exibida e promove a próxima da fila
   * (AUD-W2-003). Espelha o `writeDisplayed` do wire
   * `queueService.onNextSprint` (main/index.ts): sem ele, a sprint promovida
   * apareceria sem `displayed_at` e o acompanhamento do líder a marcaria como
   * `nao_visto` permanentemente. Opcional só para testes; em produção sempre
   * injetado pelo composition root.
   */
  ackService?: AckService;
  /** `RuntimeConfig.userId` — filtra sprints destinadas a este operador. */
  userId: string;
  /** `RuntimeConfig.pollingIntervalMs`. */
  pollingIntervalMs: number;
  /**
   * `() => Date` injectable para testes (controla "agora" sem mockar
   * `Date` global). Default: `() => new Date()`.
   */
  now?: () => Date;
  /**
   * Logger opcional. Default: silent (zero side-effects em testes).
   * Em produção, caller injeta um wrapper com `console.warn`/`error`.
   */
  log?: PollingLogger;
}

export class PollingService {
  private readonly deps: PollingDeps;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(deps: PollingDeps) {
    this.deps = deps;
  }

  /**
   * Inicia o loop. Executa um `pollOnce` IMEDIATAMENTE (await), depois
   * agenda o próximo via `setTimeout(pollingIntervalMs)`. Idempotente:
   * chamar `start` várias vezes só efetiva uma vez.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.pollAndSchedule();
  }

  /**
   * Para o loop. Cancela o setTimeout pendente. Se um `pollOnce` está
   * em vôo, ele termina mas NÃO agenda o próximo. Idempotente.
   */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executa UM ciclo de polling. Exposto público para testes poderem
   * controlar timing (chamar manualmente em vez de esperar setTimeout).
   *
   * Try-catch global: erro fatal em qualquer parte do ciclo não derruba
   * o agent — apenas loga e o próximo ciclo continua (RNF-07 parcial;
   * retry real em BL-C3-013 W3).
   */
  async pollOnce(): Promise<void> {
    try {
      // BL-C3-011: listPending SEM filter userId — precisa retornar também
      // os `cancel-*.json` (broadcast, sem user_id no filename). Sprints
      // de outros operadores são filtradas inline em `processSprint`.
      const entries = await this.deps.pendingStore.listPending();
      for (const entry of entries) {
        await this.processEntry(entry);
      }
    } catch (err) {
      // DirectoryNotFoundError em `pending/` é cenário benigno — primeiro
      // ciclo após config OU antes de o Leader/instalador criar a estrutura.
      // Não loga como error (que indicaria "falha"); polling continua nos
      // próximos ciclos e a pasta vai aparecer quando o Leader gravar o
      // primeiro sprint.
      if (err instanceof DirectoryNotFoundError) {
        return;
      }
      this.getLog().error('falha no ciclo de polling', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ===========================================================================
  // Internos
  // ===========================================================================

  private async pollAndSchedule(): Promise<void> {
    if (!this.running) return;
    await this.pollOnce();
    if (!this.running) return; // stop() chamado durante pollOnce
    this.timer = setTimeout(() => {
      void this.pollAndSchedule();
    }, this.deps.pollingIntervalMs);
  }

  private async processEntry(entry: PendingEntry): Promise<void> {
    const log = this.getLog();
    switch (entry.kind) {
      case 'invalid':
        log.warn('arquivo malformado em pending — RN-09 (skip)', {
          filename: entry.filename,
          reason: entry.reason,
        });
        return;
      case 'cancel':
        await this.processCancel(entry);
        return;
      case 'sprint':
        // BL-C3-011: sprints de outros operadores são descartadas inline.
        // O filter foi removido do `listPending` para capturar cancels.
        if (entry.payload.user_id !== this.deps.userId) return;
        await this.processSprint(entry);
        return;
    }
  }

  /**
   * Processa um arquivo `cancel-<sprintId>.json` (BL-C3-011, UC-05,
   * RN-06). Cancels são broadcast (sem user_id) — todos os agents do
   * shared os recebem.
   *
   * Algoritmo:
   * 1. Dedup via cache (já processado em ciclo anterior).
   * 2. Snapshot do `sprint_id_ref` e do `currentItem` do overlay ANTES
   *    de mutar estado — evita race entre remover da fila e fechar
   *    overlay.
   * 3. Remove sprint da fila se ainda enfileirada (sem ack).
   * 4. Fecha overlay se estava exibindo essa sprint (sem ack — RN-06).
   *    Próxima da fila (se houver) é exibida automaticamente pelo wire
   *    em main/index.ts (queueService.onNextSprint não dispara por
   *    `removeBySprintId`; caller orquestra).
   * 5. Arquiva o `cancel-*.json` localmente para auditoria + dedup
   *    pós-restart. Fallback `markProcessed` em falha (consistente
   *    com BL-C3-012).
   * 6. Deleta do shared para não acumular. Falha não-fatal.
   *
   * Cancel para sprint inexistente (já ackeada, expirada, ou nunca
   * chegou a este agent): é no-op no overlay/fila, mas ainda arquiva
   * e deleta (cleanup).
   */
  private async processCancel(entry: Extract<PendingEntry, { kind: 'cancel' }>): Promise<void> {
    const log = this.getLog();
    const { filename, payload } = entry;
    const sprintIdRef = payload.sprint_id_ref;

    if (this.deps.historyService.isAlreadyArchived(filename)) return;

    // Snapshot: a sprint cancelada está sendo exibida AGORA?
    const overlay = this.deps.overlayService;
    const wasDisplayed = overlay?.getCurrentEvent()?.sprint.sprint_id === sprintIdRef;

    // Remove da fila se estava lá (sem ack). Retorna false silently se
    // não estava — cenário comum quando cancel é tardio.
    const removed = this.deps.queueService.removeBySprintId(sprintIdRef);

    log.warn('cancel detectado — processando (sem ack)', {
      filename,
      sprint_id_ref: sprintIdRef,
      was_displayed: wasDisplayed,
      was_in_queue: removed,
    });

    // Fecha overlay se estava exibindo essa sprint. `hide()` limpa
    // currentItem; próximo `peek()` da fila (já sem a removida) é
    // exibido se houver, senão estado permanece hidden.
    if (wasDisplayed && overlay !== undefined) {
      overlay.hide();
      // Se há próxima sprint na fila, exibe via showSprint manualmente
      // (queueService.removeBySprintId não emite nextSprint).
      const next = this.deps.queueService.peek();
      if (next !== null) {
        overlay.showSprint(next, this.deps.queueService.length());
        // AUD-W2-003: a sprint promovida precisa do MESMO ack inicial
        // (displayed_at) que o wire `onNextSprint` grava — senão o líder a
        // veria como `nao_visto` para sempre. Não-throw (writeDisplayed loga
        // warn em falha; o overlay já está exibido).
        void this.deps.ackService?.writeDisplayed(next.payload);
      }
    }

    // Archive cancel para auditoria + dedup pós-restart.
    const rawContent = JSON.stringify(payload, null, 2);
    try {
      await this.deps.historyService.archive(payload, filename, rawContent);
    } catch (err) {
      log.error('falha ao arquivar cancel — fallback markProcessed', {
        filename,
        err: err instanceof Error ? err.message : String(err),
      });
      this.deps.historyService.markProcessed(filename);
    }

    // Delete shared — não-fatal.
    try {
      await this.deps.pendingStore.deletePending(filename);
    } catch (err) {
      log.error('falha ao deletar cancel do shared', {
        filename,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async processSprint(entry: Extract<PendingEntry, { kind: 'sprint' }>): Promise<void> {
    const log = this.getLog();
    const { filename, payload } = entry;

    // Dedup via histórico — sprints já processadas (acked ou descartadas
    // por deadline) ficam no Set em memória. Em Gate 6 + restart, o
    // initializeFromDisk repopula via fs.readdir.
    if (this.deps.historyService.isAlreadyArchived(filename)) {
      return;
    }

    const rawContent = JSON.stringify(payload, null, 2);

    // RN-03 / RF-18 (BL-C3-012) — sprint com deadline passado: NÃO exibe
    // overlay, NÃO gera ack de visualização. Move para histórico local
    // (auditoria — operador pode inspecionar via tray "Histórico local")
    // e deleta do shared para não acumular. Fallback: se archive falhar
    // (disco cheio, permissão), pelo menos garante dedup em memória via
    // markProcessed para evitar re-processamento no próximo ciclo.
    if (this.isDeadlinePast(payload.deadline_at)) {
      log.warn('sprint com deadline passado — arquivando sem exibir', {
        filename,
        deadline: payload.deadline_at,
      });
      try {
        await this.deps.historyService.archive(payload, filename, rawContent);
      } catch (err) {
        log.error('falha ao arquivar sprint expirada — fallback markProcessed', {
          filename,
          err: err instanceof Error ? err.message : String(err),
        });
        this.deps.historyService.markProcessed(filename);
      }
      try {
        await this.deps.pendingStore.deletePending(filename);
      } catch (err) {
        log.error('falha ao deletar pending expirado', {
          filename,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // Sprint válida — enfileira para exibição. dedup interno do
    // queueService cobre o caso "sprint já enfileirada em ciclo anterior
    // ainda não foi dequeued". Aqui não precisamos checar manualmente.
    this.deps.queueService.enqueue({ payload, filename, rawContent });
  }

  private isDeadlinePast(deadlineIso: string): boolean {
    const nowMs = (this.deps.now?.() ?? new Date()).getTime();
    return new Date(deadlineIso).getTime() <= nowMs;
  }

  private getLog(): PollingLogger {
    return this.deps.log ?? SILENT_LOG;
  }
}
