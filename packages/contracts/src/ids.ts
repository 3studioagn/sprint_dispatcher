import { decodeTime, ulid } from 'ulid';

/**
 * Regex Crockford Base32 (RFC ULID).
 *
 * Caracteres válidos: 0-9, A-Z exceto I, L, O, U (excluídos para reduzir
 * ambiguidade visual). 26 chars no total — 10 do timestamp + 16 do
 * componente aleatório.
 *
 * @see https://github.com/ulid/spec
 */
export const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Gera um novo Sprint ID no formato ULID.
 *
 * ULIDs são timestamp-sortable e geograficamente únicos. Diferente de
 * UUIDs, podem ser ordenados lexicograficamente para refletir ordem
 * cronológica de criação — útil pra debug e para o agente processar
 * sprints na ordem certa quando há acúmulo.
 *
 * Exemplo: `01HX9K2M4F8N7P2Q5R3S6T7U8V`
 *
 * @returns ULID de 26 caracteres em Crockford Base32 (uppercase).
 *
 * @see DECISIONS.md ADR-005
 * @see Requisitos Anexo C (sprint_id)
 */
export function generateSprintId(): string {
  return ulid();
}

/**
 * Valida se um valor é um ULID válido.
 *
 * Defensivo: verifica tipo antes de aplicar regex, então aceita entradas
 * de fonte não-tipada (JSON.parse, JS puro) sem lançar exceção em
 * `null`/`undefined`/objetos.
 *
 * @param value - Valor a validar
 * @returns true se for ULID válido (26 chars Crockford Base32)
 */
export function isValidUlid(value: string): boolean {
  return typeof value === 'string' && ULID_REGEX.test(value);
}

/**
 * Decodifica o timestamp (milissegundos desde a epoch Unix, UTC)
 * embutido nos 10 primeiros caracteres de um ULID.
 *
 * Usado pelo histórico compartilhado (BL-C4-005) para derivar a pasta
 * de data de origem (`arquivo/<YYYY-MM-DD>/`) diretamente do `sprint_id`
 * — sem precisar ler o conteúdo do arquivo. Como o Leader gera o ULID e
 * serializa `criado_em` (UTC) no mesmo instante, a data UTC decodificada
 * aqui coincide com a de `criado_em`.
 *
 * @param value - ULID de 26 chars (Crockford Base32).
 * @returns Timestamp em ms (UTC).
 * @throws Error se `value` não for um ULID válido.
 *
 * @see DECISIONS.md ADR-025 (política de arquivamento)
 */
export function decodeUlidTime(value: string): number {
  if (!isValidUlid(value)) {
    throw new Error(`ULID inválido: "${value}" — não é possível decodificar o timestamp`);
  }
  return decodeTime(value);
}
