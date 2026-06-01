import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_OPERATORS } from '../../__test-fixtures__/operators';
import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { OperatorList } from './OperatorList';

/**
 * Pre-seed do store com usuários ativos — pula a chamada IPC e foca o
 * teste em renderização + interação. Tests do fluxo async vivem em
 * `useOperatorsStore.test.ts`.
 */
function seedActiveOperators(): void {
  useOperatorsStore.setState({
    operators: TEST_OPERATORS.filter((op) => op.ativo),
    status: 'loaded',
    error: null,
  });
}

describe('OperatorList', () => {
  beforeEach(() => {
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
    seedActiveOperators();
  });

  it('renderiza apenas os 4 usuários ativos (sem rafael, que tem ativo: false)', () => {
    render(<OperatorList />);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Carlos Pereira')).toBeInTheDocument();
    expect(screen.getByText('Beatriz Lima')).toBeInTheDocument();
    expect(screen.queryByText('Rafael Costa')).not.toBeInTheDocument();
  });

  it('expõe 4 checkboxes (um por usuário ativo)', () => {
    render(<OperatorList />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((cb) => {
      expect(cb).not.toBeChecked();
    });
  });

  it('hostname disponível como title attribute (não visível no design, mas acessível)', () => {
    render(<OperatorList />);
    expect(screen.getByText('João Silva')).toHaveAttribute('title', 'ART-DESIGN-04');
    expect(screen.getByText('Maria Souza')).toHaveAttribute('title', 'ART-DESIGN-05');
  });

  it('clicar no checkbox marca o usuário na store', async () => {
    const user = userEvent.setup();
    render(<OperatorList />);
    const joao = screen.getByRole('checkbox', { name: /João Silva/ });

    expect(joao).not.toBeChecked();
    await user.click(joao);

    expect(joao).toBeChecked();
    expect(useSprintComposerStore.getState().selectedOperators.has('joao')).toBe(true);
    expect(useSprintComposerStore.getState().selectedOperators.get('joao')).toBeNull();
  });

  it('clicar duas vezes alterna o estado do checkbox', async () => {
    const user = userEvent.setup();
    render(<OperatorList />);
    const joao = screen.getByRole('checkbox', { name: /João Silva/ });

    await user.click(joao);
    expect(joao).toBeChecked();

    await user.click(joao);
    expect(joao).not.toBeChecked();
    expect(useSprintComposerStore.getState().selectedOperators.has('joao')).toBe(false);
  });

  it('clicar no nome também marca o checkbox (associação htmlFor)', async () => {
    const user = userEvent.setup();
    render(<OperatorList />);
    const joaoNome = screen.getByText('João Silva');

    await user.click(joaoNome);

    const joao = screen.getByRole('checkbox', { name: /João Silva/ });
    expect(joao).toBeChecked();
  });

  it('estado da seleção persiste entre re-mountings (store é global)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OperatorList />);
    const joaoBefore = screen.getByRole('checkbox', { name: /João Silva/ });

    await user.click(joaoBefore);
    expect(useSprintComposerStore.getState().selectedOperators.has('joao')).toBe(true);

    unmount();
    render(<OperatorList />);

    const joaoAfter = screen.getByRole('checkbox', { name: /João Silva/ });
    expect(joaoAfter).toBeChecked();
  });

  it('exibe mensagem de vazio quando o store está sem usuários', () => {
    useOperatorsStore.setState({ operators: [], status: 'loaded', error: null });
    render(<OperatorList />);
    expect(screen.getByText(/Nenhum usuário/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('OperatorRow — input de meta (BL-C2-004)', () => {
  beforeEach(() => {
    useOperatorsStore.getState().reset();
    useSprintComposerStore.getState().reset();
    seedActiveOperators();
  });

  it('input de meta NÃO aparece para usuário desmarcado (placeholder "0" mostrado)', () => {
    render(<OperatorList />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('input de meta aparece quando usuário é marcado', async () => {
    const user = userEvent.setup();
    render(<OperatorList />);
    const joao = screen.getByRole('checkbox', { name: /João Silva/ });

    await user.click(joao);

    const metaInputs = screen.getAllByRole('spinbutton');
    expect(metaInputs).toHaveLength(1);
  });

  it('digitar no input de meta atualiza a store com inteiro', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    render(<OperatorList />);

    const metaInput = screen.getByRole('spinbutton');
    await user.type(metaInput, '15');

    expect(useSprintComposerStore.getState().selectedOperators.get('joao')).toBe(15);
  });

  it('apagar o input salva null na store', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    useSprintComposerStore.getState().setMeta('joao', 5);
    render(<OperatorList />);

    const metaInput = screen.getByRole('spinbutton');
    await user.clear(metaInput);

    expect(useSprintComposerStore.getState().selectedOperators.get('joao')).toBeNull();
  });

  it('meta inválida (null logo após marcar) marca aria-invalid="true" + sr-only message', async () => {
    const user = userEvent.setup();
    render(<OperatorList />);

    await user.click(screen.getByRole('checkbox', { name: /João Silva/ }));
    const metaInput = screen.getByRole('spinbutton');

    expect(metaInput).toHaveAttribute('aria-invalid', 'true');
    // Sinal visual de erro = apenas borda vermelha (CSS .metaInput[aria-invalid='true']).
    // Mensagem fica sr-only no DOM para leitores de tela via aria-errormessage.
    expect(screen.getByText(/Meta deve ser maior/i)).toBeInTheDocument();
  });

  it('meta válida remove aria-invalid e mensagem de erro', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    render(<OperatorList />);

    const metaInput = screen.getByRole('spinbutton');
    await user.type(metaInput, '5');

    expect(metaInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/Meta deve ser maior/i)).not.toBeInTheDocument();
  });

  it('meta zero marca aria-invalid="true"', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    render(<OperatorList />);

    const metaInput = screen.getByRole('spinbutton');
    await user.type(metaInput, '0');

    expect(metaInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('input com valor não-numérico salva null (defesa contra parseFloat=NaN)', () => {
    useSprintComposerStore.getState().toggleOperator('joao');
    render(<OperatorList />);

    const metaInput = screen.getByRole('spinbutton');
    fireEvent.change(metaInput, { target: { value: 'abc' } });

    expect(useSprintComposerStore.getState().selectedOperators.get('joao')).toBeNull();
  });

  it('desmarcar usuário remove o input de meta e limpa a store', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    useSprintComposerStore.getState().setMeta('joao', 5);
    render(<OperatorList />);

    expect(screen.getByRole('spinbutton')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /João Silva/ }));

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(useSprintComposerStore.getState().selectedOperators.has('joao')).toBe(false);
  });
});
