/**
 * Auto-registro defensivo do auto-start em `HKCU\...\Run` (BL-C5-003, ADR-028).
 *
 * Complementa o hook NSIS (`build/installer.nsh`): garante a entrada de Run no
 * contexto do USUÁRIO LOGADO a cada boot, cobrindo o caso per-machine/admin
 * (onde o HKCU escrito pelo instalador é o do admin, não o do operador — a
 * "pegadinha Program Files × HKCU"). Idempotente: só escreve quando a entrada
 * está ausente ou aponta para outro exe. Roda UMA vez no boot (não a cada
 * poll) e é não-fatal — o app sobe e funciona mesmo se o registro falhar.
 *
 * O acesso ao registro é abstraído por {@link RegistryRunAccessor} para
 * testabilidade — a produção usa `reg.exe` (built-in do Windows, sem deps
 * novas). Os testes injetam um fake em memória.
 *
 * @see DECISIONS.md ADR-028
 * @see apps/operator-agent/build/installer.nsh — hook NSIS (par do auto-registro)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Caminho da chave Run do usuário corrente. */
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

/** Logger mínimo (msg-first), opcional. Espelha o `PollingLogger`. */
export interface AutoStartLogger {
  debug?: (msg: string, ctx?: Record<string, unknown>) => void;
  info?: (msg: string, ctx?: Record<string, unknown>) => void;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
}

/**
 * Porta de acesso à chave HKCU Run. Produção usa `reg.exe`; testes injetam um
 * fake em memória.
 */
export interface RegistryRunAccessor {
  /** Lê o dado do valor `valueName` em HKCU Run, ou `null` se ausente. */
  readValue: (valueName: string) => Promise<string | null>;
  /** Cria/atualiza o valor `valueName` com `data` (tipo `REG_SZ`). */
  writeValue: (valueName: string, data: string) => Promise<void>;
}

export type AutoStartOutcome =
  | 'already-registered'
  | 'registered'
  | 'updated'
  | 'unsupported-platform'
  | 'error';

export interface EnsureAutoStartDeps {
  accessor: RegistryRunAccessor;
  /** Nome do valor sob Run (deve ser `AUTO_START_REGISTRY_VALUE`). */
  valueName: string;
  /** Caminho absoluto do exe atual (`app.getPath('exe')`). */
  exePath: string;
  /** Plataforma — default `process.platform`. Auto-start só em `win32`. */
  platform?: NodeJS.Platform;
  log?: AutoStartLogger;
}

/**
 * Normaliza um valor de Run para comparação tolerante: remove aspas externas,
 * faz trim e lowercase. `"C:\App\X.exe"` e `c:\app\x.exe` viram equivalentes —
 * evita reescrita desnecessária quando o hook NSIS já gravou o mesmo caminho
 * (entre aspas).
 */
export function normalizeRunValue(value: string): string {
  return value
    .trim()
    .replace(/^"+|"+$/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Extrai o dado de um valor `REG_SZ` da saída de `reg query KEY /v NAME`.
 * Tolera nomes de valor com espaços (split pelo token de tipo `REG_SZ`).
 * Retorna `null` se a linha do valor não estiver presente.
 */
export function parseRegQueryValue(stdout: string, valueName: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const typeIdx = line.indexOf('REG_SZ');
    if (typeIdx === -1) continue;
    const name = line.slice(0, typeIdx).trim();
    if (name === valueName) {
      return line.slice(typeIdx + 'REG_SZ'.length).trim();
    }
  }
  return null;
}

/** Acessor de produção via `reg.exe` (Windows built-in — sem deps novas). */
export class WindowsRegistryRunAccessor implements RegistryRunAccessor {
  async readValue(valueName: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('reg', ['query', RUN_KEY, '/v', valueName]);
      return parseRegQueryValue(stdout, valueName);
    } catch {
      // reg query sai com código != 0 quando o valor não existe → ausente.
      return null;
    }
  }

  async writeValue(valueName: string, data: string): Promise<void> {
    await execFileAsync('reg', ['add', RUN_KEY, '/v', valueName, '/t', 'REG_SZ', '/d', data, '/f']);
  }
}

/**
 * Garante a entrada de auto-start no HKCU Run do usuário corrente. Idempotente
 * e não-fatal (nunca lança — erros viram `'error'`). Ver doc do módulo.
 */
export async function ensureAutoStartRegistered(
  deps: EnsureAutoStartDeps,
): Promise<AutoStartOutcome> {
  const platform = deps.platform ?? process.platform;
  if (platform !== 'win32') {
    deps.log?.debug?.('auto-start ignorado (plataforma não-Windows)', { platform });
    return 'unsupported-platform';
  }

  // Caminho com espaços → armazenar entre aspas (mesma forma do hook NSIS).
  const desired = `"${deps.exePath}"`;

  try {
    const current = await deps.accessor.readValue(deps.valueName);
    if (current !== null && normalizeRunValue(current) === normalizeRunValue(desired)) {
      deps.log?.debug?.('auto-start já registrado — nada a fazer', {
        valueName: deps.valueName,
      });
      return 'already-registered';
    }
    await deps.accessor.writeValue(deps.valueName, desired);
    const outcome: AutoStartOutcome = current === null ? 'registered' : 'updated';
    deps.log?.info?.(
      outcome === 'registered'
        ? 'auto-start registrado no HKCU Run'
        : 'auto-start atualizado (apontava para outro caminho)',
      { valueName: deps.valueName, exePath: deps.exePath },
    );
    return outcome;
  } catch (err) {
    // Não-fatal: o hook NSIS já cobre o caminho feliz; pior caso, o operador
    // reinicia o app uma vez e o próximo boot tenta de novo.
    deps.log?.warn?.('falha ao registrar auto-start (não-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 'error';
  }
}
