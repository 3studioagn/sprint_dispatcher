import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useOperatorsStore } from '../../stores/useOperatorsStore';
import { selectIsValid, useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { NovaSprint } from './NovaSprint';

describe('NovaSprint — fluxo crítico do composer', () => {
  beforeEach(() => {
    useOperatorsStore.setState({ operators: [], isLoaded: false });
    useSprintComposerStore.getState().reset();
  });

  it('header + sections + botão Enviar renderizam', () => {
    render(<NovaSprint />);
    expect(screen.getByRole('heading', { name: 'Nova Sprint', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operadores', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Horário limite/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('carrega operadores via useEffect ao montar', async () => {
    render(<NovaSprint />);
    expect(await screen.findByRole('checkbox', { name: /João Silva/ })).toBeInTheDocument();
    expect(useOperatorsStore.getState().isLoaded).toBe(true);
  });

  it('status inicial: "Nenhum operador selecionado" + "Preencha todos os campos"', () => {
    render(<NovaSprint />);
    expect(screen.getByText('Nenhum operador selecionado')).toBeInTheDocument();
    expect(screen.getByText(/Preencha todos os campos/i)).toBeInTheDocument();
  });

  it('botão Enviar inicia desabilitado com tooltip apontando para BL-C2-007', () => {
    render(<NovaSprint />);
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toBeDisabled();
    expect(button.getAttribute('title')).toContain('BL-C2-007');
  });

  it('fluxo completo: 4 operadores marcados + metas + deadline → isFormValid=true; botão CONTINUA disabled (stub)', async () => {
    const user = userEvent.setup();
    render(<NovaSprint />);

    // 1. Marcar João via checkbox e preencher meta = 5
    const joao = await screen.findByRole('checkbox', { name: /João Silva/ });
    await user.click(joao);
    const joaoMeta = screen.getByRole('spinbutton');
    await user.type(joaoMeta, '5');

    // 2. Marcar os outros 3 via "Marcar todos" (preserva meta de João)
    await user.click(screen.getByRole('button', { name: 'Marcar todos' }));
    expect(useSprintComposerStore.getState().selectedOperators.get('joao')).toBe(5);
    expect(useSprintComposerStore.getState().selectedOperators.size).toBe(4);

    // 3. isFormValid ainda false — 3 operadores com meta null
    expect(selectIsValid(useSprintComposerStore.getState())).toBe(false);

    // 4. Preencher metas restantes via store (atalho de teste — equivalente a
    //    digitar em cada input dos OperatorRows visíveis)
    useSprintComposerStore.getState().setMeta('maria', 10);
    useSprintComposerStore.getState().setMeta('carlos', 7);
    useSprintComposerStore.getState().setMeta('beatriz', 3);

    // 5. Mudar deadline para 20:00
    const deadlineInput = screen.getByLabelText(/Horário limite/i);
    fireEvent.change(deadlineInput, { target: { value: '20:00' } });

    // 6. selectIsValid agora true
    expect(selectIsValid(useSprintComposerStore.getState())).toBe(true);

    // 7. UI reflete: status muda
    expect(screen.getByText('4 operadores selecionados')).toBeInTheDocument();
    expect(screen.getByText('Pronto para enviar')).toBeInTheDocument();

    // 8. CRUCIAL: botão Enviar AINDA desabilitado por causa do DISPATCH_ENABLED=false
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toBeDisabled();
    expect(button.getAttribute('title')).toContain('BL-C2-007');
  });

  it('contagem singular quando exatamente 1 operador selecionado', async () => {
    const user = userEvent.setup();
    render(<NovaSprint />);

    const joao = await screen.findByRole('checkbox', { name: /João Silva/ });
    await user.click(joao);

    expect(screen.getByText('1 operador selecionado')).toBeInTheDocument();
  });

  it('clicar no botão Enviar (disabled) NÃO dispara handler em produção', async () => {
    const user = userEvent.setup();
    render(<NovaSprint />);

    const button = screen.getByRole('button', { name: 'Enviar' });
    // Tentativa de click em botão disabled é no-op no DOM
    await user.click(button);
    // Sem erro — handler nunca executa porque o browser não dispatcha
    expect(button).toBeDisabled();
  });
});
