/**
 * Schema Zod do composer de sprint do Leader.
 *
 * Define a forma validada do payload que o composer produz: lista de
 * operadores com metas inteiras positivas (RN-07) e deadline em HH:MM.
 *
 * Esta sessão (W1.C2 parte 1) NÃO usa `react-hook-form` — a store Zustand
 * é a fonte única de verdade, e este schema é consumido por
 * `selectIsValid` / `selectFormPayload` para validar o draft antes do
 * dispatch. Quando BL-C2-007 trouxer o dispatch real (parte 2), o output
 * deste schema é o payload pronto para escrita em pending/ via fs-adapter.
 *
 * @see DECISIONS.md ADR-005 (schema-first com z.infer)
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 */

import { z } from 'zod';

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
});

export type ComposerFormInput = z.input<typeof composerFormSchema>;
export type ComposerFormOutput = z.output<typeof composerFormSchema>;
