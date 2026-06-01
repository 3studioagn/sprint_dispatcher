import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_OPERATORS } from '../../__test-fixtures__/operators';
import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { BulkSelectButtons } from './BulkSelectButtons';

/**
 * Pre-seed do store com operadores ativos — pula a chamada IPC e foca o
 * teste em interação. Tests do fluxo async vivem em
 * `useOperatorsStore.test.ts`.
 */
function seedActiveOperators(): void {
  useOperatorsStore.setState({
    operators: TEST_OPERATORS.filter((op) => op.ativo),
    status: 'loaded',
    error: null,
  });
}

describe('BulkSelectButtons', () => {
  beforeEach(() => {
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
    seedActiveOperators();
  });

  it('renderiza os dois botões com texto correto', () => {
    render(<BulkSelectButtons />);
    expect(screen.getByRole('button', { name: 'Marcar todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desmarcar todos' })).toBeInTheDocument();
  });

  it('"Marcar todos" seleciona todos os operadores ativos', async () => {
    const user = userEvent.setup();
    render(<BulkSelectButtons />);

    await user.click(screen.getByRole('button', { name: 'Marcar todos' }));

    const state = useSprintComposerStore.getState();
    expect(state.selectedOperators.size).toBe(4);
    expect(state.selectedOperators.has('joao')).toBe(true);
    expect(state.selectedOperators.has('maria')).toBe(true);
    expect(state.selectedOperators.has('carlos')).toBe(true);
    expect(state.selectedOperators.has('beatriz')).toBe(true);
    expect(state.selectedOperators.has('rafael')).toBe(false);
  });

  it('"Desmarcar todos" limpa a seleção', async () => {
    const user = userEvent.setup();
    render(<BulkSelectButtons />);

    await user.click(screen.getByRole('button', { name: 'Marcar todos' }));
    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(4);

    await user.click(screen.getByRole('button', { name: 'Desmarcar todos' }));
    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(0);
  });

  it('"Marcar todos" preserva metas já preenchidas (delega ao selectAll do store)', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    useSprintComposerStore.getState().setMeta('joao', 7);

    render(<BulkSelectButtons />);
    await user.click(screen.getByRole('button', { name: 'Marcar todos' }));

    const state = useSprintComposerStore.getState();
    expect(state.selectedOperators.get('joao')).toBe(7);
    expect(state.selectedOperators.get('maria')).toBeNull();
  });

  it('botões ficam disabled quando não há operadores carregados', () => {
    useOperatorsStore.setState({ operators: [], status: 'loaded', error: null });
    render(<BulkSelectButtons />);
    expect(screen.getByRole('button', { name: 'Marcar todos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Desmarcar todos' })).toBeDisabled();
  });
});
