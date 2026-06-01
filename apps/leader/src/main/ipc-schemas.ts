/**
 * Schemas Zod para validação dos inputs IPC do Leader — defesa em
 * profundidade (§6.3). O renderer é tratado como fonte potencialmente
 * não-confiável: todo payload que cruza o IPC e dirige I/O no main é
 * validado aqui antes de chegar aos services.
 *
 * Vivem fora de `main/ipc.ts` (que é boot/envelope, excluído do coverage)
 * para serem unit-testados diretamente — o handler apenas invoca
 * `schema.safeParse`.
 *
 * @see DECISIONS.md ADR-009 (IPC contract-first)
 */

import { ARCHIVE_DATE_REGEX, sprintIdSchema, userIdSchema } from '@sprint/contracts';
import { z } from 'zod';

/**
 * Filtro do `listArchive`. Só `date` (YYYY-MM-DD) é aceito — operador e
 * líder são filtrados client-side. `.strict()` rejeita chaves extras.
 */
export const archiveFilterSchema = z
  .object({
    date: z.string().regex(ARCHIVE_DATE_REGEX, 'date deve ser YYYY-MM-DD').optional(),
  })
  .strict();

/**
 * Request do `readArchivedSprint`. Valida a tripla que identifica a sprint
 * arquivada — `sprint_id` precisa ser ULID e `user_id` precisa casar com o
 * padrão de operador (o main reconstrói o filename a partir deles).
 */
export const readArchivedSprintRequestSchema = z
  .object({
    date: z.string().regex(ARCHIVE_DATE_REGEX, 'date deve ser YYYY-MM-DD'),
    sprint_id: sprintIdSchema,
    user_id: userIdSchema,
  })
  .strict();
