/**
 * Schema Zod do composer de sprint do Leader.
 *
 * Define a forma validada do payload que o composer produz: lista de
 * operadores com metas inteiras positivas (RN-07), deadline em HH:MM e
 * título do aviso (BL-C2-006).
 *
 * Esta sessão (W1.C2 parte 1) NÃO usa `react-hook-form` — a store Zustand
 * é a fonte única de verdade, e este schema é consumido por
 * `selectIsValid` / `selectFormPayload` para validar o draft antes do
 * dispatch.
 *
 * @see DECISIONS.md ADR-005 (schema-first com z.infer)
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 */

import { z } from 'zod';

/**
 * Limite de tamanho do título customizável pelo líder (BL-C2-006).
 *
 * Título é exibido no header do overlay (espaço limitado) — capped em 80
 * chars cobre frases naturais ("É hora de correr — fim de expediente").
 */
const MAX_TITLE_LENGTH = 80;

export const composerFormSchema = z.object({
  selectedOperators: z
    .array(
      z.object({
        user_id: z.string().min(1),
        meta: z.number().int().positive(),
      }),
    )
    .min(1, 'Selecione ao menos um operador'),
  deadline: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM (00:00–23:59)'),
  /**
   * Título customizado. String vazia OU mais que 80 chars derruba a
   * validação. Líder pode digitar livremente, mas dispatch só sai com
   * algo razoável (default é populado pelo store, então só fica vazio se
   * o líder apagar tudo manualmente).
   */
  title: z.string().min(1, 'Informe um título').max(MAX_TITLE_LENGTH, 'Título muito longo'),
});

export type ComposerFormInput = z.input<typeof composerFormSchema>;
export type ComposerFormOutput = z.output<typeof composerFormSchema>;
