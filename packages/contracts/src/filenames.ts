import { isValidUlid } from './ids';

/**
 * Resultado do parse de um nome de arquivo da pasta compartilhada.
 *
 * Discriminated union: o campo `type` indica qual variante e quais
 * campos estarão presentes.
 */
export type ParsedFilename =
  | { type: 'pending'; sprintId: string; userId: string }
  | { type: 'ack'; sprintId: string; userId: string }
  | { type: 'cancel'; sprintId: string };

/**
 * Lançado quando um nome de arquivo não bate com nenhum padrão conhecido.
 *
 * Use `safeParseFilename()` para fluxo sem exceção.
 */
export class FilenameParseError extends Error {
  override readonly name = 'FilenameParseError';

  constructor(
    public readonly filename: string,
    reason: string,
  ) {
    super(`Invalid filename "${filename}": ${reason}`);
  }
}

const USER_ID_REGEX = /^[a-z0-9_-]+$/;
const PENDING_REGEX = /^([0-9A-HJKMNP-TV-Z]{26})-([a-z0-9_-]+)\.json$/;
const ACK_REGEX = /^([0-9A-HJKMNP-TV-Z]{26})-([a-z0-9_-]+)\.ack\.json$/;
const CANCEL_REGEX = /^cancel-([0-9A-HJKMNP-TV-Z]{26})\.json$/;

/**
 * Constrói o nome do arquivo de sprint pendente: `<sprintId>-<userId>.json`.
 *
 * @throws Error se `sprintId` não for ULID válido ou `userId` tiver
 *         caracteres inválidos.
 *
 * @see DECISIONS.md ADR-006 (uso de ULID completo no filename)
 */
export function buildPendingFilename(sprintId: string, userId: string): string {
  assertValidSprintId(sprintId);
  assertValidUserId(userId);
  return `${sprintId}-${userId}.json`;
}

/**
 * Constrói o nome do arquivo de ack: `<sprintId>-<userId>.ack.json`.
 *
 * @throws Error se `sprintId` ou `userId` forem inválidos.
 */
export function buildAckFilename(sprintId: string, userId: string): string {
  assertValidSprintId(sprintId);
  assertValidUserId(userId);
  return `${sprintId}-${userId}.ack.json`;
}

/**
 * Constrói o nome do arquivo de cancelamento: `cancel-<sprintId>.json`.
 *
 * @throws Error se `sprintId` não for ULID válido.
 */
export function buildCancelFilename(sprintId: string): string {
  assertValidSprintId(sprintId);
  return `cancel-${sprintId}.json`;
}

/**
 * Faz o parse de um nome de arquivo de qualquer um dos 3 tipos suportados.
 *
 * @throws FilenameParseError se o nome não bater com nenhum padrão.
 */
export function parseFilename(filename: string): ParsedFilename {
  const result = safeParseFilename(filename);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * Versão não-throwable de `parseFilename`.
 *
 * Retorna discriminated union — útil para iterar a pasta `pending/`/`acks/`
 * sem precisar de try/catch por arquivo.
 */
export function safeParseFilename(
  filename: string,
): { success: true; data: ParsedFilename } | { success: false; error: FilenameParseError } {
  // Cancel testado primeiro: prefixo "cancel-" é único.
  const cancelMatch = CANCEL_REGEX.exec(filename);
  const cancelSprintId = cancelMatch?.[1];
  if (cancelSprintId !== undefined) {
    return { success: true, data: { type: 'cancel', sprintId: cancelSprintId } };
  }

  // Ack testado antes de pending: `.ack.json` é mais específico que `.json`.
  // Ambos passam pelo mesmo regex root sem o `.ack`, então a ordem importa
  // para que `<ulid>-<user>.ack.json` não seja interpretado como pending.
  const ackMatch = ACK_REGEX.exec(filename);
  const ackSprintId = ackMatch?.[1];
  const ackUserId = ackMatch?.[2];
  if (ackSprintId !== undefined && ackUserId !== undefined) {
    return {
      success: true,
      data: { type: 'ack', sprintId: ackSprintId, userId: ackUserId },
    };
  }

  const pendingMatch = PENDING_REGEX.exec(filename);
  const pendingSprintId = pendingMatch?.[1];
  const pendingUserId = pendingMatch?.[2];
  if (pendingSprintId !== undefined && pendingUserId !== undefined) {
    return {
      success: true,
      data: { type: 'pending', sprintId: pendingSprintId, userId: pendingUserId },
    };
  }

  return {
    success: false,
    error: new FilenameParseError(filename, 'não corresponde a pending, ack ou cancel'),
  };
}

function assertValidSprintId(sprintId: string): void {
  if (!isValidUlid(sprintId)) {
    throw new Error(`sprintId inválido: "${sprintId}" — deve ser ULID de 26 chars`);
  }
}

function assertValidUserId(userId: string): void {
  if (userId.length < 1 || userId.length > 50) {
    throw new Error(`userId inválido: tamanho deve ser 1-50 chars`);
  }
  if (!USER_ID_REGEX.test(userId)) {
    throw new Error(`userId inválido: "${userId}" — aceita apenas [a-z0-9_-]`);
  }
}
