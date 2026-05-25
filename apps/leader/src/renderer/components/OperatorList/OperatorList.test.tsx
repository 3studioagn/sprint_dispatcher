import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { OperatorList } from './OperatorList';

describe('OperatorList', () => {
  beforeEach(() => {
    useOperatorsStore.setState({ operators: [], isLoaded: false });
    useSprintComposerStore.getState().reset();
    useOperatorsStore.getState().loadOperators();
  });

  it('renderiza apenas os 4 operadores ativos (sem rafael, que tem ativo: false)', () => {
    render(<OperatorList />);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Carlos Pereira')).toBeInTheDocument();
    expect(screen.getByText('Beatriz Lima')).toBeInTheDocument();
    expect(screen.queryByText('Rafael Costa')).not.toBeInTheDocument();
  });

  it('expõe 4 checkboxes (um por operador ativo)', () => {
    render(<OperatorList />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((cb) => {
      expect(cb).not.toBeChecked();
    });
  });

  it('renderiza o hostname de cada operador', () => {
    render(<OperatorList />);
    expect(screen.getByText('ART-DESIGN-04')).toBeInTheDocument();
    expect(screen.getByText('ART-DESIGN-05')).toBeInTheDocument();
    expect(screen.getByText('ART-DESIGN-06')).toBeInTheDocument();
    expect(screen.getByText('ART-DESIGN-07')).toBeInTheDocument();
  });

  it('clicar no checkbox marca o operador na store', async () => {
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

  it('clicar no label clica no checkbox (associação htmlFor)', async () => {
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

  it('exibe mensagem de vazio quando o store está sem operadores', () => {
    useOperatorsStore.setState({ operators: [], isLoaded: true });
    render(<OperatorList />);
    expect(screen.getByText(/Nenhum operador/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('OperatorRow — input de meta (BL-C2-004)', () => {
  beforeEach(() => {
    useOperatorsStore.setState({ operators: [], isLoaded: false });
    useSprintComposerStore.getState().reset();
    useOperatorsStore.getState().loadOperators();
  });

  it('input de meta NÃO aparece para operador desmarcado', () => {
    render(<OperatorList />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('input de meta aparece quando operador é marcado', async () => {
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

  it('meta inválida (null logo após marcar) marca aria-invalid="true"', async () => {
    const user = userEvent.setup();
    render(<OperatorList />);

    await user.click(screen.getByRole('checkbox', { name: /João Silva/ }));
    const metaInput = screen.getByRole('spinbutton');

    expect(metaInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Meta ≥ 1')).toBeInTheDocument();
  });

  it('meta válida remove aria-invalid e mensagem de erro', async () => {
    const user = userEvent.setup();
    useSprintComposerStore.getState().toggleOperator('joao');
    render(<OperatorList />);

    const metaInput = screen.getByRole('spinbutton');
    await user.type(metaInput, '5');

    expect(metaInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Meta ≥ 1')).not.toBeInTheDocument();
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

  it('desmarcar operador remove o input de meta e limpa a store', async () => {
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
