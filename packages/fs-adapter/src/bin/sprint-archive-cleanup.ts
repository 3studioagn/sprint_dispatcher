#!/usr/bin/env node
/**
 * CLI standalone do job de limpeza automática (BL-C4-008).
 *
 * Varre `pending/` e `acks/` na pasta compartilhada, arquiva sprints/acks
 * expirados em `arquivo/<YYYY-MM-DD>/`, registra um log em
 * `arquivo/log-limpeza.txt` (append) + stdout, e define exit codes.
 *
 * Este é o **único** arquivo do C4 que usa `process.*` / `node:fs`
 * diretamente — a lógica (planejamento/execução) fica em `../cleanup`,
 * pura e testável. Construído como `.mjs` standalone via esbuild
 * (`pnpm --filter @sprint/fs-adapter build:cli`).
 *
 * Empacotar este CLI em EXE e agendá-lo via instalador é responsabilidade
 * do C5/deploy — fora do escopo do C4. Agendamento via Windows Task
 * Scheduler: ver `docs/guides/cleanup-job.md`.
 *
 * Exit codes: 0 sucesso (mesmo sem nada a fazer); 1 erro fatal
 * (ex.: compartilhamento inacessível); 2 erro de argumentos.
 *
 * @see DECISIONS.md ADR-025
 */
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { CLEANUP_LOG_FILENAME, SHARED_DIRS } from '@sprint/contracts';

import {
  AckStore,
  ArchiveStore,
  CLEANUP_USAGE,
  type CleanupEvent,
  formatCleanupLogLine,
  NodeFilesystemAdapter,
  parseCleanupArgs,
  PendingStore,
  runCleanup,
} from '../index';

async function main(): Promise<number> {
  const parsed = parseCleanupArgs(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`erro: ${parsed.error}\n\n${CLEANUP_USAGE}\n`);
    return 2;
  }
  if (parsed.args.help) {
    process.stdout.write(`${CLEANUP_USAGE}\n`);
    return 0;
  }

  const { share, retentionDays, mode, dryRun } = parsed.args;
  const adapter = new NodeFilesystemAdapter();

  // Guarda: compartilhamento inacessível é erro fatal (exit 1). Distingue
  // "share inalcançável" de "pending/ ainda não criado" (benigno no run).
  try {
    const stat = await adapter.stat(share);
    if (!stat.isDirectory) {
      process.stderr.write(`erro: o caminho informado em --share não é um diretório: ${share}\n`);
      return 1;
    }
  } catch (err) {
    process.stderr.write(
      `erro: compartilhamento inacessível (${share}): ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  const pendingStore = new PendingStore(adapter, share);
  const ackStore = new AckStore(adapter, share);
  const archiveStore = new ArchiveStore(adapter, share);

  const logLines: string[] = [];
  const onEvent = (event: CleanupEvent): void => {
    const line = formatCleanupLogLine(event);
    process.stdout.write(`${line}\n`);
    logLines.push(line);
  };

  try {
    await runCleanup(
      { sharedPath: share, retentionDays, mode, dryRun, now: new Date() },
      {
        pendingStore,
        ackStore,
        archiveStore,
        onEvent,
      },
    );
  } catch (err) {
    process.stderr.write(
      `falha fatal durante a limpeza: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  // Persiste o log (append) — exceto em dry-run, que não muta nada.
  if (!dryRun && logLines.length > 0) {
    const archiveDir = path.join(share, SHARED_DIRS.ARCHIVE);
    const logPath = path.join(archiveDir, CLEANUP_LOG_FILENAME);
    try {
      await mkdir(archiveDir, { recursive: true });
      await appendFile(logPath, `${logLines.join('\n')}\n`, 'utf-8');
    } catch (err) {
      // Falha ao gravar o log não invalida a limpeza já realizada — apenas
      // avisa no stderr e mantém exit 0.
      process.stderr.write(
        `aviso: não foi possível gravar ${logPath}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  process.stderr.write(`erro inesperado: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
