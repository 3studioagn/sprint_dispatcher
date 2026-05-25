import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { DeadlineInput, isDeadlineInPast } from './DeadlineInput';

describe('isDeadlineInPast (helper puro)', () => {
  const FIXED_NOW = new Date('2026-05-25T15:00:00');

  it('true quando horário já passou hoje', () => {
    expect(isDeadlineInPast('14:00', FIXED_NOW)).toBe(true);
    expect(isDeadlineInPast('14:59', FIXED_NOW)).toBe(true);
  });

  it('false quando horário ainda virá hoje', () => {
    expect(isDeadlineInPast('18:00', FIXED_NOW)).toBe(false);
    expect(isDeadlineInPast('15:01', FIXED_NOW)).toBe(false);
  });

  it('false quando deadline = now (borda inclusiva via comparação <)', () => {
    expect(isDeadlineInPast('15:00', FIXED_NOW)).toBe(false);
  });

  it('false quando formato é inválido (responsabilidade de outra validação)', () => {
    expect(isDeadlineInPast('abc', FIXED_NOW)).toBe(false);
    expect(isDeadlineInPast('25:00', FIXED_NOW)).toBe(false);
    expect(isDeadlineInPast('', FIXED_NOW)).toBe(false);
  });
});

describe('DeadlineInput', () => {
  beforeEach(() => {
    useSprintComposerStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exibe o valor da store no input (default 18:00)', () => {
    render(<DeadlineInput />);
    const input = screen.getByLabelText<HTMLInputElement>(/Horário limite/i);
    expect(input.value).toBe('18:00');
    expect(input.type).toBe('time');
  });

  it('atualiza a store ao mudar o horário', () => {
    render(<DeadlineInput />);
    const input = screen.getByLabelText(/Horário limite/i);

    fireEvent.change(input, { target: { value: '20:30' } });

    expect(useSprintComposerStore.getState().deadline).toBe('20:30');
  });

  it('exibe warning quando deadline está no passado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T19:00:00'));
    useSprintComposerStore.getState().setDeadline('14:00');

    render(<DeadlineInput />);

    const warning = screen.getByRole('alert');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent(/14:00/);
    expect(warning).toHaveTextContent(/já passou/i);
  });

  it('não exibe warning quando deadline ainda virá hoje', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00'));
    useSprintComposerStore.getState().setDeadline('18:00');

    render(<DeadlineInput />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('não exibe warning para formato inválido (ainda que seja "passado")', () => {
    useSprintComposerStore.getState().setDeadline('abc');

    render(<DeadlineInput />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
