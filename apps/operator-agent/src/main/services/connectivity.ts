/**
 * Classificação de conectividade + agenda de backoff da máquina de
 * reconexão do Agent (BL-C3-013).
 *
 * Módulo **puro** — zero Electron, zero `fs`. Toda a lógica testável da
 * resiliência de reconexão vive aqui; o {@link PollingService} apenas a
 * orquestra com o I/O (via `listPending` do C4) e o tempo (`setTimeout`).
 *
 * **Sinal de conectividade (ADR-027):** o `listPending` do `@sprint/fs-adapter`
 * lança `FilesystemError` quando a pasta compartilhada SMB está inacessível,
 * preservando o `NodeJS.ErrnoException` original em `error.cause` (com `.code`).
 * Não é preciso método novo no C4 — basta classificar o `cause.code`.
 *
 * @see DECISIONS.md ADR-027 — estratégia de reconexão e resiliência do Agent
 * @see Requisitos RNF-07 (sobreviver à queda do servidor), RI-03 (retry com backoff)
 */

/**
 * Snapshot do estado de conexão emitido pela máquina de estados do
 * {@link PollingService} (vive no MAIN — ADR-027). Consumido pelo
 * `trayService` para sinalização visual (vermelho/verde + tooltip + menu).
 */
export interface ConnectionStatus {
  /** `true` = pasta compartilhada acessível; `false` = sem conexão. */
  online: boolean;
  /**
   * Último instante em que a pasta foi acessível com sucesso, ou `null` se
   * nunca conectou desde o boot. Alimenta o "última conexão às HH:MM" do tray.
   */
  lastConnectedAt: Date | null;
}

/**
 * Códigos `errno` que indicam **queda do share / servidor SMB inacessível**
 * (≠ erro pontual de um arquivo, que é "loga e ignora" no processamento).
 *
 * Inclui `ENOENT` porque, no Windows, um UNC indisponível frequentemente
 * some como "path não existe". O caso ambíguo (`pending/` ainda não criada,
 * mas share no ar) é desambiguado pelo {@link PollingService} sondando a
 * **raiz** do share — ver `handlePollError`.
 *
 * `EBUSY` entra como sinal de share ocupado/indisponível (RI-03). `EACCES`/
 * `EPERM`/`ENOSPC` **não** entram — são problemas de permissão/disco, não de
 * conectividade, e virar "desconectado" neles faria backoff eterno.
 */
export const CONNECTIVITY_ERROR_CODES: ReadonlySet<string> = new Set([
  'ENOENT', // path/share sumiu (UNC fora do ar no Windows cai aqui com frequência)
  'ENOTFOUND', // resolução de nome (DNS/NetBIOS) falhou
  'ETIMEDOUT', // timeout de rede/SMB
  'EHOSTUNREACH',
  'EHOSTDOWN',
  'ENETUNREACH',
  'ENETDOWN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'EBUSY', // share ocupado/indisponível
]);

interface MaybeCoded {
  code?: unknown;
  cause?: unknown;
}

/**
 * Extrai o código `errno` (string) de um erro ou da sua `cause`.
 *
 * O `FilesystemError` do C4 preserva o `NodeJS.ErrnoException` original em
 * `cause`; o `.code` mora lá. Também aceita o code direto no próprio erro
 * (defensivo, caso um erro cru de `fs` escape sem wrap).
 */
function extractErrnoCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as MaybeCoded;
  if (typeof e.code === 'string') return e.code;
  const cause = e.cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as MaybeCoded).code;
    if (typeof causeCode === 'string') return causeCode;
  }
  return null;
}

/**
 * Classifica um erro como "queda de conectividade do share" (vs. erro
 * pontual de arquivo). Inspeciona `err.cause?.code` (ou `err.code`) contra
 * {@link CONNECTIVITY_ERROR_CODES}.
 *
 * @returns `true` se o código indica share/servidor inacessível.
 */
export function isConnectivityError(err: unknown): boolean {
  const code = extractErrnoCode(err);
  return code !== null && CONNECTIVITY_ERROR_CODES.has(code);
}

/**
 * Agenda base de backoff em ms (spec BL-C3-013): 5s → 10s → 30s → 60s,
 * mantendo 60s a partir daí (cap no último passo).
 */
export const BACKOFF_SCHEDULE_MS: readonly number[] = [5000, 10000, 30000, 60000];

/**
 * Fração de jitter (±10%) aplicada a cada passo do backoff. Evita que ~50
 * agentes reconectem em sincronia martelando o file server quando ele volta
 * (RI-03). A agenda base permanece documentada como referência.
 */
export const BACKOFF_JITTER = 0.1;

/** Gerador de aleatórios injetável (testes determinísticos). */
export type RandomFn = () => number;

/**
 * Calcula o atraso (ms) do próximo retry para a N-ésima falha **consecutiva**
 * (1-based). Seleciona o passo base (capado no último de
 * {@link BACKOFF_SCHEDULE_MS}) e aplica ±{@link BACKOFF_JITTER} usando `rng`.
 *
 * @param consecutiveFailures Quantidade de falhas seguidas (>= 1). Valores
 *   <= 0 são tratados como 1 (primeiro retry).
 * @param rng Fonte de aleatório em [0,1). Default `Math.random`.
 * @returns Atraso em ms (inteiro, sempre > 0).
 */
export function nextBackoffDelayMs(
  consecutiveFailures: number,
  rng: RandomFn = Math.random,
): number {
  const step = Math.max(consecutiveFailures, 1) - 1;
  const idx = Math.min(step, BACKOFF_SCHEDULE_MS.length - 1);
  const base = BACKOFF_SCHEDULE_MS[idx]!;
  // rng() em [0,1) → fator em [1 - J, 1 + J)
  const factor = 1 - BACKOFF_JITTER + rng() * (2 * BACKOFF_JITTER);
  return Math.round(base * factor);
}
