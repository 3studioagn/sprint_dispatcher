/**
 * Utility do domain layer: lê arquivo JSON via `IFilesystemAdapter`,
 * faz parse e valida via parser fornecido (tipicamente um `safeParse*`
 * do `@sprint/contracts`).
 *
 * Comportamento por classe de falha:
 *
 * - **I/O genérico** (permissão negada, EISDIR, etc) — propaga
 *   `FilesystemError` original. Caller decide tratamento.
 * - **Arquivo inexistente** (FileNotFoundError) —
 *   `{ ok: false, kind: 'not-found', reason }`. Race condition típica
 *   em polling: arquivo aparece em `listDir` mas desaparece antes do
 *   `readFile`. Consumers tipicamente fazem skip.
 * - **JSON malformado** — `{ ok: false, kind: 'invalid', reason }`.
 * - **Schema inválido** — `{ ok: false, kind: 'invalid', reason }`.
 * - **Sucesso** — `{ ok: true, data }`.
 *
 * O `kind` permite consumers (`pending-store`, `ack-store`) distinguir
 * "race condition → skip" de "arquivo corrompido → `kind: 'invalid'`"
 * sem brittle string match em `reason`. RN-09 ("arquivo malformado:
 * log e ignora silenciosamente") aplica-se ao `kind: 'invalid'`.
 *
 * @see DECISIONS.md ADR-013 (port-and-adapter; domain layer separado do port)
 */
import { FileNotFoundError } from '../errors';
import type { IFilesystemAdapter } from '../interface';

/**
 * Resultado discriminado de {@link readAndParseJson}.
 *
 * Em caso de falha, `kind` distingue race condition ('not-found') de
 * corrupção genuína ('invalid'). `reason` é human-readable, usada em
 * logs e como mensagem para `kind: 'invalid'` em
 * `listPending`/`listAcks`.
 */
export type ReadAndParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'not-found' | 'invalid'; reason: string };

/**
 * Contrato do parser callback — compatível com a forma `safeParse*`
 * exportada por `@sprint/contracts` (e por extensão com Zod safeParse).
 *
 * Aceita `unknown` (saída do `JSON.parse`) e retorna discriminated union.
 * O `error` precisa estender `Error` para `.message` ser usado como reason.
 */
export type SafeParser<T> = (
  raw: unknown,
) => { success: true; data: T } | { success: false; error: Error };

/**
 * Lê arquivo JSON via adapter e valida via parser.
 *
 * @throws {FilesystemError} para erros de I/O diferentes de
 *   `FileNotFoundError` (que vira `{ ok: false }`). Erros não-Filesystem
 *   também propagam.
 */
export async function readAndParseJson<T>(
  adapter: IFilesystemAdapter,
  filepath: string,
  parse: SafeParser<T>,
): Promise<ReadAndParseResult<T>> {
  let text: string;
  try {
    text = await adapter.readFile(filepath);
  } catch (err) {
    if (err instanceof FileNotFoundError) {
      return { ok: false, kind: 'not-found', reason: `arquivo não encontrado: ${filepath}` };
    }
    throw err;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, kind: 'invalid', reason: `JSON inválido: ${detail}` };
  }

  const result = parse(raw);
  if (!result.success) {
    return { ok: false, kind: 'invalid', reason: `schema inválido: ${result.error.message}` };
  }
  return { ok: true, data: result.data };
}
