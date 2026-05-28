/**
 * PollingService — ciclo de detecção de sprints novas em `<shared>/pending/`.
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
 * | kind      | Ação                                                                   |
 * | --------- | ---------------------------------------------------------------------- |
 * | `invalid` | log warn + skip (RN-09 — não bloqueia outras entries do ciclo)         |
 * | `cancel`  | log warn + skip — handler de cancelamento é BL-C3-009 W2 (defer)       |
 * | `sprint`  | dedup via history → check deadline → enqueue OU descarta+delete        |
 *
 * **Filtros do `listPending({ userId })`:** já filtra arquivos cancel
 * automaticamente quando passamos `userId` (cancels são broadcast — ver
 * `PendingStore.listPending`). Mas em Gate 3, o agent NÃO passa
 * `userId` em filtro de listPending? Reler... — passa SIM o userId
 * (sprints são por operador), e a doc do PendingStore diz que filter
 * com userId "ignora cancels também". Resultado: o branch `kind: 'cancel'`
 * só é exercitado se o usuário do agent receber um cancel direcionado a
 * outro user (não vai acontecer com filter por userId). Mantemos o
 * branch defensivo + um cancel direto (sem filter user) em testes para
 * exercitar a lógica.
 *
 * @see DECISIONS.md ADR-004 — polling deliberado
 * @see DECISIONS.md ADR-016 — domain layer do fs-adapter (listPending entrega
 *   discriminated union PendingEntry)
 */

import { DirectoryNotFoundError, type PendingEntry, type PendingStore } from '@sprint/fs-adapter';

import type { HistoryService } from './historyService';
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
  /** Fila FIFO destino dos sprints válidos detectados. */
  queueService: QueueService;
  /** Cache de filenames já processados — dedup entre ciclos. */
  historyService: HistoryService;
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
      const entries = await this.deps.pendingStore.listPending({
        userId: this.deps.userId,
      });
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
        log.warn('cancel file detectado — deferido para W2 (BL-C3-009)', {
          filename: entry.filename,
        });
        return;
      case 'sprint':
        await this.processSprint(entry);
        return;
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
