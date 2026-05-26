/**
 * AckService — escrita de SprintAck em dois momentos.
 *
 * **Fluxo do ack (RF-09, Anexo D):**
 *
 * 1. **`writeDisplayed(payload)`** — disparado pelo `overlayService` (via
 *    wire em `queueService.onNextSprint` no main) quando o overlay aparece.
 *    Grava o ack inicial com `displayed_at` (sem `acknowledged_at`). Não
 *    throw em erro — o overlay já está visível para o operador; falha de
 *    I/O do ack é log warning.
 *
 * 2. **`writeAcknowledged(sprintId, userId)`** — disparado pelo `handleAck`
 *    no main quando o operador clica "Recebi". Re-lê o ack inicial via
 *    `listAcks` para PRESERVAR o `displayed_at` original; sobrescreve
 *    adicionando `acknowledged_at`. **THROW em erro** — operador precisa
 *    saber que o ack falhou (toast vermelho via IPC envelope).
 *
 * O `writeAck` do AckStore (W1.C4) suporta overwrite naturalmente: mesmo
 * `<sprintId>-<userId>.ack.json` é gravado 2 vezes com payloads diferentes.
 * `rename` atômico garante consistência.
 *
 * **Defesa em profundidade:** caso o ack inicial NÃO tenha sido gravado
 * (writeDisplayed falhou), o fallback é `displayed_at = now` no ack final.
 * Não-ideal (perde o timestamp real de exibição), mas preserva o contrato
 * (campo obrigatório do schema).
 *
 * @see DECISIONS.md ADR-013 — port-and-adapter do fs-adapter
 * @see Requisitos RF-09, Anexo D
 */

import { parseSprintAck, type SprintPayload } from '@sprint/contracts';
import type { AckStore } from '@sprint/fs-adapter';

export interface AckServiceDeps {
  /** AckStore wraping `<shared>/acks/` — vem do main composition root. */
  ackStore: AckStore;
  /** Vai literal no campo `hostname` do SprintAck (RuntimeConfig.hostname). */
  hostname: string;
  /**
   * Versão do agent — segue semver MAJOR.MINOR.PATCH (validado pelo schema
   * SprintAck). Em produção vem de `app.getVersion()`; em testes pode ser
   * qualquer semver válido (e.g. '1.0.0').
   */
  agentVersion: string;
  /**
   * `() => Date` injectable para testes (controla `now`). Default:
   * `() => new Date()`.
   */
  now?: () => Date;
}

/**
 * Logger leve — mesmo padrão do PollingService. Default silent;
 * em produção o main injeta console-based.
 */
export interface AckLogger {
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
}

const SILENT_LOG: AckLogger = {
  warn: () => undefined,
};

export class AckService {
  private readonly ackStore: AckStore;
  private readonly hostname: string;
  private readonly agentVersion: string;
  private readonly now: () => Date;
  private readonly log: AckLogger;

  constructor(deps: AckServiceDeps & { log?: AckLogger }) {
    this.ackStore = deps.ackStore;
    this.hostname = deps.hostname;
    this.agentVersion = deps.agentVersion;
    this.now = deps.now ?? ((): Date => new Date());
    this.log = deps.log ?? SILENT_LOG;
  }

  /**
   * Grava o ack inicial com `displayed_at`. Não throw — captura erro e
   * loga warn (overlay já está exibido; falha do ack não impede UX).
   *
   * @returns `displayed_at` ISO string em sucesso; `null` em falha.
   */
  async writeDisplayed(payload: SprintPayload): Promise<string | null> {
    const displayedAt = this.now().toISOString();
    try {
      const ack = parseSprintAck({
        schema_version: '1.0',
        sprint_id: payload.sprint_id,
        user_id: payload.user_id,
        hostname: this.hostname,
        displayed_at: displayedAt,
        agent_version: this.agentVersion,
      });
      await this.ackStore.writeAck(ack);
      return displayedAt;
    } catch (err) {
      this.log.warn('writeDisplayed falhou — overlay segue exibido', {
        sprint_id: payload.sprint_id,
        user_id: payload.user_id,
        err: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Grava o ack final com `acknowledged_at`. Re-lê o ack inicial via
   * `listAcks({ sprintId, userId })` para preservar `displayed_at`
   * original; fallback para `now()` se o ack inicial não foi gravado.
   *
   * **THROW em erro** — caller (handleAck) propaga ao renderer via
   * `IpcResult { ok: false }` para o toast vermelho.
   */
  async writeAcknowledged(
    sprintId: string,
    userId: string,
  ): Promise<{ displayedAt: string; acknowledgedAt: string }> {
    const acknowledgedAt = this.now().toISOString();
    const displayedAt = await this.resolveDisplayedAt(sprintId, userId, acknowledgedAt);

    const ack = parseSprintAck({
      schema_version: '1.0',
      sprint_id: sprintId,
      user_id: userId,
      hostname: this.hostname,
      displayed_at: displayedAt,
      acknowledged_at: acknowledgedAt,
      agent_version: this.agentVersion,
    });
    await this.ackStore.writeAck(ack);
    return { displayedAt, acknowledgedAt };
  }

  /**
   * Re-lê o ack inicial gravado por `writeDisplayed` para preservar o
   * `displayed_at` original. Se `listAcks` falhar OU se o ack inicial
   * não foi gravado, retorna fallback (`now`).
   */
  private async resolveDisplayedAt(
    sprintId: string,
    userId: string,
    fallback: string,
  ): Promise<string> {
    try {
      const entries = await this.ackStore.listAcks({ sprintId, userId });
      for (const entry of entries) {
        if (
          entry.kind === 'ack' &&
          entry.payload.sprint_id === sprintId &&
          entry.payload.user_id === userId
        ) {
          return entry.payload.displayed_at;
        }
      }
    } catch (err) {
      this.log.warn('listAcks falhou ao resolver displayed_at — fallback para now', {
        sprint_id: sprintId,
        user_id: userId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return fallback;
  }
}
