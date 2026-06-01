/**
 * Store do composer de sprint (W1.C2 parte 1 + BL-C2-006 W2).
 *
 * Mantém o rascunho da sprint sendo composta: operadores selecionados, meta
 * por operador, deadline e título. O `body_html` final é montado pelo
 * `DispatchService` a partir do template default — não é mais customizável
 * pelo líder (decisão UX da Sessão 43+1: apenas o título fica editável,
 * inline no header da NovaSprint, e o corpo permanece padronizado).
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

export interface SprintComposerState {
  /** user_id → meta (null = ainda não preenchida). */
  readonly selectedOperators: ReadonlyMap<string, number | null>;
  /** Horário limite no formato HH:MM (24h). */
  readonly deadline: string;
  /** Título da sprint exibido no overlay do Agent (BL-C2-006). */
  readonly title: string;

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
  /** Volta tudo aos defaults. */
  reset: () => void;
}

export const useSprintComposerStore = create<SprintComposerState>((set) => ({
  selectedOperators: new Map(),
  deadline: DEFAULT_DEADLINE,
  title: DEFAULT_TITLE,

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

  reset: () => {
    set({
      selectedOperators: new Map(),
      deadline: DEFAULT_DEADLINE,
      title: DEFAULT_TITLE,
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
  };
}
