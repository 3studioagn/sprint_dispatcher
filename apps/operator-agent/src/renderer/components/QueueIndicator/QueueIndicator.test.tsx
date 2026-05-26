/**
 * Testes do QueueIndicator — comportamento por queueLength.
 *
 * Regra:
 * - length <= 1 → não renderiza nada.
 * - length = 2 → "+1 sprint aguardando" (singular).
 * - length >= 3 → "+N sprints aguardando" (plural).
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useQueueStore } from '../../stores/useQueueStore';

import { QueueIndicator } from './QueueIndicator';

describe('QueueIndicator', () => {
  beforeEach(() => {
    useQueueStore.setState({ length: 0 });
  });

  it('não renderiza quando length = 0', () => {
    const { container } = render(<QueueIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('não renderiza quando length = 1 (só a atual, nada aguardando)', () => {
    useQueueStore.setState({ length: 1 });
    const { container } = render(<QueueIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('singular: length=2 → "+ 1 sprint aguardando"', () => {
    useQueueStore.setState({ length: 2 });
    render(<QueueIndicator />);
    expect(screen.getByText(/\+ 1 sprint aguardando/)).toBeInTheDocument();
  });

  it('plural: length=3 → "+ 2 sprints aguardando"', () => {
    useQueueStore.setState({ length: 3 });
    render(<QueueIndicator />);
    expect(screen.getByText(/\+ 2 sprints aguardando/)).toBeInTheDocument();
  });

  it('plural: length=5 → "+ 4 sprints aguardando"', () => {
    useQueueStore.setState({ length: 5 });
    render(<QueueIndicator />);
    expect(screen.getByText(/\+ 4 sprints aguardando/)).toBeInTheDocument();
  });

  it('tem aria-live polite para acessibilidade', () => {
    useQueueStore.setState({ length: 2 });
    render(<QueueIndicator />);
    const el = screen.getByText(/aguardando/i);
    expect(el).toHaveAttribute('aria-live', 'polite');
  });
});
