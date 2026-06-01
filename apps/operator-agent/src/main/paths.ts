/**
 * Resolução dos caminhos de dados locais do Agent (BL-C5-006, ADR-028).
 *
 * **Data root (decisão Q1, Sessão 49 — supersede o `userData` de ADR-012/027):**
 * em Windows os dados do Agent (`config.json`, `historico/`, `logs/`) vivem em
 * `C:\ProgramData\<APP_DATA_DIR_NAME>\` — machine-wide, coerente com Anexo B /
 * Stack §15.3 ("criado no first-run"). A pasta é criada pelo próprio Agent no
 * first-run (como o usuário logado) — sem exigir elevação, já que o criador
 * vira o dono e ganha permissão de escrita (ver runbook do TI / docs).
 *
 * Fora de Windows (CI Linux, dev macOS) cai para `app.getPath('userData')` —
 * mantém testes hermenéticos e o `pnpm dev` cross-platform.
 *
 * **Override de teste:** a env var {@link DATA_DIR_ENV_OVERRIDE} tem precedência
 * absoluta — testes apontam para um tmp dir sem tocar em `ProgramData` real
 * (nem depender da plataforma do runner).
 *
 * @see DECISIONS.md ADR-028 — auto-start + first-run + data root em ProgramData
 * @see Requisitos/Backlog BL-C3-002 (config no ProgramData), Stack §15.3
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { LOCAL_DIRS } from '@sprint/contracts';
import { app } from 'electron';

import { APP_DATA_DIR_NAME } from '../shared/branding';

/**
 * Env var que sobrescreve o data root. Precedência máxima — usada pelos testes
 * (e disponível para diagnósticos do TI). Vazia/ausente → resolução normal.
 */
export const DATA_DIR_ENV_OVERRIDE = 'SPRINT_AGENT_DATA_DIR';

/**
 * Diretório raiz dos dados locais do Agent.
 *
 * Precedência: env override → `C:\ProgramData\<APP_DATA_DIR_NAME>` (win32) →
 * `app.getPath('userData')` (demais plataformas / dev / CI).
 */
export function getAgentDataDir(): string {
  const override = process.env[DATA_DIR_ENV_OVERRIDE];
  if (override !== undefined && override.length > 0) {
    return override;
  }
  if (process.platform === 'win32') {
    // %PROGRAMDATA% normalmente é C:\ProgramData; fallback defensivo.
    const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
    return path.join(programData, APP_DATA_DIR_NAME);
  }
  return app.getPath('userData');
}

/** `<dataDir>/historico` — histórico local de sprints processadas. */
export function getHistoryDir(): string {
  return path.join(getAgentDataDir(), LOCAL_DIRS.HISTORY);
}

/** `<dataDir>/logs` — destino futuro do file transport do logger (BL-C6-003). */
export function getLogsDir(): string {
  return path.join(getAgentDataDir(), LOCAL_DIRS.LOGS);
}

/**
 * Cria o data root + `historico/` + `logs/` (idempotente, recursivo).
 *
 * Chamado no first-run (wizard `setup:save`) e em todo boot bem-sucedido —
 * garante a estrutura do Anexo B / Stack §15.3 mesmo que o `config.json` tenha
 * sido criado manualmente pelo TI sem as subpastas.
 */
export async function ensureAgentDataDirs(): Promise<void> {
  await fs.mkdir(getHistoryDir(), { recursive: true });
  await fs.mkdir(getLogsDir(), { recursive: true });
}
