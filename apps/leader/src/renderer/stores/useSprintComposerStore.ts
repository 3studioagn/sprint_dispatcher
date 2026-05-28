/**
 * Store do composer de sprint (W1.C2 parte 1).
 *
 * Mantém o rascunho da sprint sendo composta: operadores selecionados, meta
 * por operador, deadline, título e corpo. O dispatch real (escrita em
 * `pending/`) fica em BL-C2-007 — esta store só guarda o draft.
 *
 * Lógica derivada (isValid, count, payload) fica em selectors puros exportados
 * separadamente — não em estado armazenado. A validação delega para
 * `composerFormSchema` (Zod) — fonte única de regras de forma.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 */

import { create } from 'zustand';

import type { DispatchSprintRequest } from '../../shared/ipc-types';

import { composerFormSchema, type ComposerFormOutput } from './sprintComposerSchema';

const DEFAULT_DEADLINE = '18:00';
const DEFAULT_TITLE = 'É hora de correr';
const DEFAULT_BODY = '';

/**
 * Template default do corpo do aviso quando o líder não customiza.
 *
 * Espelhado em `DispatchService.DEFAULT_BODY_TEMPLATE` (main process —
 * a única fonte que de fato escreve no payload é o main, que aplica
 * o default quando o request chega com body_template vazio). Este
 * espelho existe apenas para o preview do renderer não precisar de
 * IPC para mostrar o default.
 *
 * @see DispatchService (apps/leader/src/main/services/dispatchService.ts)
 */
export const DEFAULT_BODY_TEMPLATE = 'Sua meta até o final do dia é de: <b>{meta} artes</b>';

export interface SprintComposerState {
  /** user_id → meta (null = ainda não preenchida). */
  readonly selectedOperators: ReadonlyMap<string, number | null>;
  /** Horário limite no formato HH:MM (24h). */
  readonly deadline: string;
  /** Título da sprint exibido no overlay do Agent. */
  readonly title: string;
  /**
   * Template HTML do corpo da sprint. String vazia = usa o default do main
   * (`DEFAULT_BODY_TEMPLATE`). O `{meta}` é substituído por operador no
   * `DispatchService` antes da sanitização e da escrita.
   */
  readonly body: string;

  /** Marca/desmarca um operador. Ao marcar, meta inicial = null. */
  toggleOperator: (userId: string) => void;
  /** Atualiza a meta de um operador já selecionado. No-op se não estiver selecionado. */
  setMeta: (userId: string, meta: number | null) => void;
  /** Adiciona ao set todos os userIds informados, preservando metas existentes. */
  selectAll: (userIds: readonly string[]) => void;
  /** Limpa todos os operadores selecionados. */
  deselectAll: () => void;
  /** Atualiza o deadline (validação fica nos selectors). */
  setDeadline: (deadline: string) => void;
  /** Atualiza o título exibido no overlay (BL-C2-006). */
  setTitle: (title: string) => void;
  /** Atualiza o template HTML do corpo (BL-C2-006). String vazia = default. */
  setBody: (body: string) => void;
  /** Volta tudo aos defaults. */
  reset: () => void;
}

export const useSprintComposerStore = create<SprintComposerState>((set) => ({
  selectedOperators: new Map(),
  deadline: DEFAULT_DEADLINE,
  title: DEFAULT_TITLE,
  body: DEFAULT_BODY,

  toggleOperator: (userId) =>
    set((state) => {
      const next = new Map(state.selectedOperators);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.set(userId, null);
      }
      return { selectedOperators: next };
    }),

  setMeta: (userId, meta) =>
    set((state) => {
      if (!state.selectedOperators.has(userId)) {
        return state;
      }
      const next = new Map(state.selectedOperators);
      next.set(userId, meta);
      return { selectedOperators: next };
    }),

  selectAll: (userIds) =>
    set((state) => {
      const next = new Map(state.selectedOperators);
      for (const userId of userIds) {
        if (!next.has(userId)) {
          next.set(userId, null);
        }
      }
      return { selectedOperators: next };
    }),

  deselectAll: () => {
    set({ selectedOperators: new Map() });
  },

  setDeadline: (deadline) => {
    set({ deadline });
  },

  setTitle: (title) => {
    set({ title });
  },

  setBody: (body) => {
    set({ body });
  },

  reset: () => {
    set({
      selectedOperators: new Map(),
      deadline: DEFAULT_DEADLINE,
      title: DEFAULT_TITLE,
      body: DEFAULT_BODY,
    });
  },
}));

// =============================================================================
// Selectors puros — recebem state, retornam derivações. Sem side effects.
// =============================================================================

/** Quantos operadores estão atualmente marcados. */
export function selectSelectedCount(state: SprintComposerState): number {
  return state.selectedOperators.size;
}

/**
 * Retorna o payload validado pelo schema, ou `null` se o draft não passa.
 * Quando BL-C2-007 (parte 2) ativar o dispatch, este é o objeto que vai
 * para `pending/<sprintId>-<userId>.json` via fs-adapter.
 */
export function selectFormPayload(state: SprintComposerState): ComposerFormOutput | null {
  const selectedOperators = Array.from(state.selectedOperators.entries()).map(
    ([user_id, meta]) => ({
      user_id,
      // meta null vira 0 para o schema, que falha em positive() — equivalente
      // a "meta não preenchida" do ponto de vista da validação.
      meta: meta ?? 0,
    }),
  );

  const result = composerFormSchema.safeParse({
    selectedOperators,
    deadline: state.deadline,
    title: state.title,
    body: state.body,
  });

  return result.success ? result.data : null;
}

/**
 * Verdadeiro quando o composer está pronto para dispatch.
 * Delega para `selectFormPayload` — schema é fonte única de regras.
 */
export function selectIsValid(state: SprintComposerState): boolean {
  return selectFormPayload(state) !== null;
}

/**
 * Retorna o `DispatchSprintRequest` pronto para o IPC, ou `null` se o
 * draft é inválido. Mesma validação de `selectFormPayload`, só renomeia
 * `selectedOperators` → `selected` para casar com o nome do campo no
 * contrato IPC (`shared/ipc-types.ts`).
 *
 * Consumido por `NovaSprint.handleDispatchClick` no Gate 5 (BL-C2-007).
 */
export function selectDispatchRequest(state: SprintComposerState): DispatchSprintRequest | null {
  const payload = selectFormPayload(state);
  if (payload === null) return null;
  return {
    selected: payload.selectedOperators,
    deadline: payload.deadline,
    title: payload.title,
    body_template: payload.body,
  };
}
