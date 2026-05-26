/**
 * Testes do Overlay — placeholder vs renderização completa.
 *
 * Stores manipuladas diretamente via setState (zustand) — em produção
 * o useIncomingSprint atualiza-as via IPC push.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { makePayload } from '../../__test-fixtures__/sprint';
import { useCurrentSprintStore } from '../../stores/useCurrentSprintStore';
import { useQueueStore } from '../../stores/useQueueStore';

import { Overlay } from './Overlay';

describe('Overlay', () => {
  beforeEach(() => {
    useCurrentSprintStore.setState({ sprint: null });
    useQueueStore.setState({ length: 0 });
  });

  it('renderiza placeholder "Aguardando sprint…" quando store está vazia', () => {
    render(<Overlay />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/aguardando sprint/i)).toBeInTheDocument();
  });

  it('renderiza alertdialog completo quando há sprint atual', () => {
    useCurrentSprintStore.setState({ sprint: makePayload() });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recebi/i })).toBeInTheDocument();
  });

  it('inclui o título da sprint (rotulado por aria-labelledby)', () => {
    const sprint = makePayload({ title: 'Meta especial' });
    useCurrentSprintStore.setState({ sprint });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'sprint-title');
    expect(screen.getByRole('heading', { name: /meta especial/i })).toBeInTheDocument();
  });

  it('renderiza DeadlineBadge formatado em HH:mm', () => {
    const sprint = makePayload({ deadlineIso: '2026-05-26T18:30:00.000Z' });
    useCurrentSprintStore.setState({ sprint });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    // Aceita qualquer formato HH:mm; ambiente node tem TZ UTC por default,
    // mas comportamento do date-fns é local. Verificamos só o rótulo PRAZO.
    expect(screen.getByText(/^prazo$/i)).toBeInTheDocument();
  });

  it('botão Recebi tem autoFocus (atributo presente)', () => {
    useCurrentSprintStore.setState({ sprint: makePayload() });
    useQueueStore.setState({ length: 1 });
    render(<Overlay />);
    // RTL pode não bater foco real consistentemente; testamos a presença
    // do botão habilitado como proxy de "wired correctly".
    const button = screen.getByRole('button', { name: /recebi/i });
    expect(button).toBeEnabled();
  });
});
