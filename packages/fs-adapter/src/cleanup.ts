/**
 * Lógica do job de limpeza automática (BL-C4-008).
 *
 * **Pura e testável**: este módulo NÃO usa `process.*`, `console.*` nem
 * `new Date()` — o instante "agora" é injetado (`opts.now`) e o logging é
 * por injeção de dependência (`onEvent`). O entry point do CLI
 * (`bin/sprint-archive-cleanup.ts`) é quem instancia o adapter real,
 * escreve em `arquivo/log-limpeza.txt` + stdout e define exit codes.
 *
 * Política de retenção (ADR-025, decisão 4.4):
 * - `age`: arquiva se a idade do arquivo (mtime) ≥ `retentionDays` (RN-08).
 * - `deadline`: arquiva se `deadline_at` da sprint já passou (UC-08).
 * - `both` (padrão): arquiva se idade ≥ retenção OU deadline passou.
 *
 * Acks órfãos (cuja sprint não está mais em `pending/`) são arquivados
 * por idade (acks não têm deadline). Arquivos de cancelamento
 * (`cancel-*.json`) NÃO são arquivados por este job — seu ciclo de vida é
 * do Agent (processCancel); são reportados como `skip` para transparência.
 *
 * @see DECISIONS.md ADR-025 (política de arquivamento e retenção)
 * @see Requisitos UC-08 (limpar sprints expiradas), RN-08 (>7 dias)
 */
import { DEFAULT_RETENTION_DAYS, safeParseFilename } from '@sprint/contracts';

import type { AckEntry, AckStore } from './domain/ack-store';
import type { ArchiveOutcome, ArchiveStore } from './domain/archive-store';
import type { PendingEntry, PendingStore } from './domain/pending-store';
import { DirectoryNotFoundError } from './errors';

const MS_PER_DAY = 86_400_000;

/** Política de retenção do job de limpeza. */
export type RetentionMode = 'age' | 'deadline' | 'both';

/** Opções de execução do {@link runCleanup}. */
export interface CleanupOptions {
  /** Pasta compartilhada (UNC ou letra mapeada). */
  sharedPath: string;
  /** Idade (dias) para arquivar por antiguidade. */
  retentionDays: number;
  /** Política de retenção. */
  mode: RetentionMode;
  /** Se `true`, apenas reporta o que seria arquivado — não move nada. */
  dryRun: boolean;
  /** Instante "agora" — injetado para testes determinísticos. */
  now: Date;
}

/** Evento emitido durante a limpeza (logging por injeção). */
export type CleanupEvent =
  | {
      kind: 'start';
      sharedPath: string;
      mode: RetentionMode;
      retentionDays: number;
      dryRun: boolean;
      at: string;
    }
  | {
      kind: 'candidate';
      filename: string;
      reason: 'age' | 'deadline';
      ageDays: number;
      deadlineAt: string | null;
    }
  | {
      kind: 'archived';
      filename: string;
      outcome: ArchiveOutcome;
      date: string;
      ackFilename: string | null;
    }
  | { kind: 'skip'; filename: string; reason: string }
  | { kind: 'warn'; filename: string | null; message: string }
  | {
      kind: 'done';
      scanned: number;
      archived: number;
      skipped: number;
      warnings: number;
      dryRun: boolean;
      at: string;
    };

/** Callback de logging injetado em {@link runCleanup}. */
export type CleanupEventHandler = (event: CleanupEvent) => void;

/** Sprint que o plano decidiu arquivar. */
export interface CleanupSprintTarget {
  filename: string;
  reason: 'age' | 'deadline';
  ageDays: number;
  deadlineAt: string | null;
}

/** Ack órfão que o plano decidiu arquivar. */
export interface CleanupAckTarget {
  filename: string;
  reason: 'age';
  ageDays: number;
}

/** Arquivo deliberadamente não arquivado, com motivo (para transparência). */
export interface CleanupSkip {
  filename: string;
  reason: string;
}

/** Aviso (ex.: arquivo corrompido encontrado). */
export interface CleanupWarning {
  filename: string;
  message: string;
}

/** Plano de limpeza — saída pura de {@link planCleanup}. */
export interface CleanupPlan {
  sprintsToArchive: CleanupSprintTarget[];
  acksToArchive: CleanupAckTarget[];
  skipped: CleanupSkip[];
  warnings: CleanupWarning[];
}

/** Resumo agregado retornado por {@link runCleanup}. */
export interface CleanupSummary {
  /** Total de entries varridas em `pending/` + `acks/`. */
  scanned: number;
  /** Quantos foram arquivados (ou *seriam*, em `dry-run`). */
  archived: number;
  /** Quantos foram deliberadamente ignorados. */
  skipped: number;
  /** Quantos avisos foram emitidos. */
  warnings: number;
  /** Espelha `opts.dryRun`. */
  dryRun: boolean;
  /** Nomes dos arquivos arquivados (ou que seriam, em `dry-run`). */
  archivedFilenames: string[];
}

/** Dependências de I/O de {@link runCleanup} (injeção). */
export interface CleanupDeps {
  pendingStore: PendingStore;
  ackStore: AckStore;
  archiveStore: ArchiveStore;
  /** Logging por injeção — sem isto o job roda silencioso. */
  onEvent?: CleanupEventHandler;
}

function ageInDays(modifiedAt: Date, now: Date): number {
  return (now.getTime() - modifiedAt.getTime()) / MS_PER_DAY;
}

function deadlinePassed(deadlineAt: string, now: Date): boolean {
  const t = Date.parse(deadlineAt);
  return !Number.isNaN(t) && t <= now.getTime();
}

/**
 * Decide o que arquivar, dadas as listagens de `pending/` e `acks/`.
 * Função **pura** — sem I/O. Testável com entries em memória.
 *
 * @param pendingEntries - saída de `PendingStore.listPending()`.
 * @param ackEntries - saída de `AckStore.listAcks()`.
 */
export function planCleanup(
  pendingEntries: readonly PendingEntry[],
  ackEntries: readonly AckEntry[],
  opts: { mode: RetentionMode; retentionDays: number; now: Date },
): CleanupPlan {
  const { mode, retentionDays, now } = opts;
  const sprintsToArchive: CleanupSprintTarget[] = [];
  const acksToArchive: CleanupAckTarget[] = [];
  const skipped: CleanupSkip[] = [];
  const warnings: CleanupWarning[] = [];

  // Stems (`<sprintId>-<userId>`) de toda sprint presente em pending/ —
  // usados para detectar acks órfãos (sem sprint correspondente).
  const pendingSprintStems = new Set<string>();

  for (const entry of pendingEntries) {
    if (entry.kind === 'cancel') {
      skipped.push({
        filename: entry.filename,
        reason: 'arquivo de cancelamento — não arquivado por este job',
      });
      continue;
    }

    const parsed = safeParseFilename(entry.filename);
    if (!parsed.success || parsed.data.type !== 'pending') {
      // 'invalid' cujo nome não é de sprint (ex.: cancel malformado).
      skipped.push({ filename: entry.filename, reason: 'não é um arquivo de sprint' });
      continue;
    }
    pendingSprintStems.add(`${parsed.data.sprintId}-${parsed.data.userId}`);

    const age = ageInDays(entry.modifiedAt, now);
    const ageQualifies = age >= retentionDays;

    if (entry.kind === 'invalid') {
      // JSON corrompido: não dá pra checar deadline. A regra de idade
      // decide (decisão 4.4). Sempre registra aviso da corrupção.
      warnings.push({ filename: entry.filename, message: `JSON inválido: ${entry.reason}` });
      if (mode !== 'deadline' && ageQualifies) {
        sprintsToArchive.push({
          filename: entry.filename,
          reason: 'age',
          ageDays: age,
          deadlineAt: null,
        });
      }
      continue;
    }

    // entry.kind === 'sprint'
    const dlPassed = deadlinePassed(entry.payload.deadline_at, now);
    let target: CleanupSprintTarget | null = null;
    if (mode === 'age') {
      if (ageQualifies)
        target = {
          filename: entry.filename,
          reason: 'age',
          ageDays: age,
          deadlineAt: entry.payload.deadline_at,
        };
    } else if (mode === 'deadline') {
      if (dlPassed)
        target = {
          filename: entry.filename,
          reason: 'deadline',
          ageDays: age,
          deadlineAt: entry.payload.deadline_at,
        };
    } else {
      // both: deadline tem prioridade na atribuição do motivo.
      if (dlPassed)
        target = {
          filename: entry.filename,
          reason: 'deadline',
          ageDays: age,
          deadlineAt: entry.payload.deadline_at,
        };
      else if (ageQualifies)
        target = {
          filename: entry.filename,
          reason: 'age',
          ageDays: age,
          deadlineAt: entry.payload.deadline_at,
        };
    }
    if (target !== null) sprintsToArchive.push(target);
    // Sprint não-expirada → retida silenciosamente (caso normal, sem skip).
  }

  for (const entry of ackEntries) {
    const parsed = safeParseFilename(entry.filename);
    if (!parsed.success || parsed.data.type !== 'ack') continue; // defesa — listAcks só devolve acks

    const stem = `${parsed.data.sprintId}-${parsed.data.userId}`;
    // Ack cuja sprint ainda está em pending/ é movido junto com ela (ou
    // retido com ela) — não tratamos aqui para não duplicar.
    if (pendingSprintStems.has(stem)) continue;

    if (entry.kind === 'invalid') {
      warnings.push({ filename: entry.filename, message: `JSON inválido: ${entry.reason}` });
    }

    // Acks órfãos não têm deadline → só a regra de idade se aplica.
    if (mode === 'deadline') continue;
    const age = ageInDays(entry.modifiedAt, now);
    if (age >= retentionDays) {
      acksToArchive.push({ filename: entry.filename, reason: 'age', ageDays: age });
    }
  }

  return { sprintsToArchive, acksToArchive, skipped, warnings };
}

/**
 * Executa a limpeza: lista `pending/`+`acks/`, planeja e (se não for
 * `dry-run`) arquiva via {@link ArchiveStore}. Tolerante a corrida — uma
 * falha por arquivo vira aviso e o job segue. Não lança por
 * `DirectoryNotFoundError` em `pending/`/`acks/` (pastas podem não existir
 * ainda); outros erros de I/O propagam (caller decide fatal).
 */
export async function runCleanup(opts: CleanupOptions, deps: CleanupDeps): Promise<CleanupSummary> {
  const emit: CleanupEventHandler = deps.onEvent ?? (() => undefined);
  emit({
    kind: 'start',
    sharedPath: opts.sharedPath,
    mode: opts.mode,
    retentionDays: opts.retentionDays,
    dryRun: opts.dryRun,
    at: opts.now.toISOString(),
  });

  const pendingEntries = await listBenign(() => deps.pendingStore.listPending());
  const ackEntries = await listBenign(() => deps.ackStore.listAcks());

  const plan = planCleanup(pendingEntries, ackEntries, {
    mode: opts.mode,
    retentionDays: opts.retentionDays,
    now: opts.now,
  });

  for (const w of plan.warnings) emit({ kind: 'warn', filename: w.filename, message: w.message });
  for (const s of plan.skipped) emit({ kind: 'skip', filename: s.filename, reason: s.reason });

  let archived = 0;
  let warnings = plan.warnings.length;
  const archivedFilenames: string[] = [];

  if (opts.dryRun) {
    for (const t of plan.sprintsToArchive) {
      emit({
        kind: 'candidate',
        filename: t.filename,
        reason: t.reason,
        ageDays: t.ageDays,
        deadlineAt: t.deadlineAt,
      });
    }
    for (const t of plan.acksToArchive) {
      emit({
        kind: 'candidate',
        filename: t.filename,
        reason: t.reason,
        ageDays: t.ageDays,
        deadlineAt: null,
      });
    }
    archived = plan.sprintsToArchive.length + plan.acksToArchive.length;
    archivedFilenames.push(
      ...plan.sprintsToArchive.map((t) => t.filename),
      ...plan.acksToArchive.map((t) => t.filename),
    );
  } else {
    for (const t of plan.sprintsToArchive) {
      try {
        const r = await deps.archiveStore.archiveSprint(t.filename);
        if (r.outcome !== 'source-missing') {
          archived += 1;
          archivedFilenames.push(t.filename);
        }
        emit({
          kind: 'archived',
          filename: t.filename,
          outcome: r.outcome,
          date: r.date,
          ackFilename: r.ackFilename,
        });
      } catch (err) {
        warnings += 1;
        emit({ kind: 'warn', filename: t.filename, message: errorMessage(err) });
      }
    }
    for (const t of plan.acksToArchive) {
      try {
        const r = await deps.archiveStore.archiveAck(t.filename);
        if (r.outcome !== 'source-missing') {
          archived += 1;
          archivedFilenames.push(t.filename);
        }
        emit({
          kind: 'archived',
          filename: t.filename,
          outcome: r.outcome,
          date: r.date,
          ackFilename: null,
        });
      } catch (err) {
        warnings += 1;
        emit({ kind: 'warn', filename: t.filename, message: errorMessage(err) });
      }
    }
  }

  const summary: CleanupSummary = {
    scanned: pendingEntries.length + ackEntries.length,
    archived,
    skipped: plan.skipped.length,
    warnings,
    dryRun: opts.dryRun,
    archivedFilenames,
  };
  emit({
    kind: 'done',
    scanned: summary.scanned,
    archived: summary.archived,
    skipped: summary.skipped,
    warnings: summary.warnings,
    dryRun: summary.dryRun,
    at: opts.now.toISOString(),
  });
  return summary;
}

/** Argumentos do CLI, já parseados e validados. */
export interface CleanupArgs {
  share: string;
  retentionDays: number;
  mode: RetentionMode;
  dryRun: boolean;
  help: boolean;
}

/**
 * Parseia os argumentos do CLI. **Puro** — não toca `process`. Retorna
 * `{ ok: false, error }` em vez de lançar, para o entry point decidir o
 * exit code (2 = erro de argumentos).
 */
export function parseCleanupArgs(
  argv: readonly string[],
): { ok: true; args: CleanupArgs } | { ok: false; error: string } {
  let share: string | undefined;
  let retentionDays = DEFAULT_RETENTION_DAYS;
  let mode: RetentionMode = 'both';
  let dryRun = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;
    switch (arg) {
      case '--help':
      case '-h':
        help = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--share': {
        const value = argv[i + 1];
        if (value === undefined) return { ok: false, error: '--share requer um caminho' };
        share = value;
        i += 1;
        break;
      }
      case '--retention-days': {
        const value = argv[i + 1];
        if (value === undefined) return { ok: false, error: '--retention-days requer um número' };
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) {
          return {
            ok: false,
            error: `--retention-days inválido: "${value}" (esperado inteiro >= 0)`,
          };
        }
        retentionDays = n;
        i += 1;
        break;
      }
      case '--mode': {
        const value = argv[i + 1];
        if (value === undefined) return { ok: false, error: '--mode requer um valor' };
        if (value !== 'age' && value !== 'deadline' && value !== 'both') {
          return { ok: false, error: `--mode inválido: "${value}" (esperado age|deadline|both)` };
        }
        mode = value;
        i += 1;
        break;
      }
      default:
        return { ok: false, error: `argumento desconhecido: "${arg}"` };
    }
  }

  if (help) {
    return { ok: true, args: { share: share ?? '', retentionDays, mode, dryRun, help: true } };
  }
  if (share === undefined || share.length === 0) {
    return { ok: false, error: '--share é obrigatório' };
  }
  return { ok: true, args: { share, retentionDays, mode, dryRun, help: false } };
}

/**
 * Formata um {@link CleanupEvent} como uma linha de log human-readable
 * (para `arquivo/log-limpeza.txt` e stdout). **Pura**.
 */
export function formatCleanupLogLine(event: CleanupEvent): string {
  switch (event.kind) {
    case 'start':
      return `[${event.at}] INÍCIO — modo=${event.mode} retenção=${event.retentionDays}d dry-run=${event.dryRun} share=${event.sharedPath}`;
    case 'candidate': {
      const dl = event.deadlineAt !== null ? ` deadline=${event.deadlineAt}` : '';
      return `[candidato] ${event.filename} — motivo=${event.reason} idade=${event.ageDays.toFixed(1)}d${dl}`;
    }
    case 'archived': {
      const ack = event.ackFilename !== null ? ` +ack ${event.ackFilename}` : '';
      return `[arquivado] ${event.filename} → arquivo/${event.date}/ (${event.outcome})${ack}`;
    }
    case 'skip':
      return `[ignorado] ${event.filename} — ${event.reason}`;
    case 'warn':
      return `[AVISO] ${event.filename ?? '(geral)'} — ${event.message}`;
    case 'done':
      return `[${event.at}] FIM — varridos=${event.scanned} arquivados=${event.archived} ignorados=${event.skipped} avisos=${event.warnings} dry-run=${event.dryRun}`;
  }
}

/** Texto de ajuda do CLI. */
export const CLEANUP_USAGE = `Uso: sprint-archive-cleanup --share <caminho> [opções]

Varre pending/ e acks/ na pasta compartilhada, arquiva sprints/acks
expirados em arquivo/<YYYY-MM-DD>/ e registra um log de limpeza.

Opções:
  --share <caminho>             (obrigatório) Pasta compartilhada (UNC),
                                ex.: \\\\srv-alpha\\TEMP\\Metas_3Studio
  --retention-days <n>          Idade (dias) p/ arquivar por antiguidade.
                                Padrão: ${DEFAULT_RETENTION_DAYS} (RN-08).
  --mode <age|deadline|both>    Política de retenção. Padrão: both
                                (idade >= retenção OU deadline passou).
  --dry-run                     Lista o que seria arquivado, sem mover nada.
  -h, --help                    Mostra esta ajuda.

Códigos de saída: 0 sucesso (mesmo sem nada a fazer); 1 erro fatal
(ex.: compartilhamento inacessível); 2 erro de argumentos.`;

async function listBenign<T>(fn: () => Promise<readonly T[]>): Promise<readonly T[]> {
  try {
    return await fn();
  } catch (err) {
    // pending/ ou acks/ podem ainda não existir — benigno (lista vazia).
    if (err instanceof DirectoryNotFoundError) return [];
    throw err;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
