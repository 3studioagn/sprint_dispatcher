import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { BulkSelectButtons } from './BulkSelectButtons';

describe('BulkSelectButtons', () => {
  beforeEach(() => {
    useOperatorsStore.setState({ operators: [], isLoaded: false });
    useSprintComposerStore.getState().reset();
    useOperatorsStore.getState().loadOperators();
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
    useOperatorsStore.setState({ operators: [], isLoaded: true });
    render(<BulkSelectButtons />);
    expect(screen.getByRole('button', { name: 'Marcar todos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Desmarcar todos' })).toBeDisabled();
  });
});
