import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formatAckTime, TargetStatusList, type TargetStatusItem } from './TargetStatusList';

const NAO_VISTO: TargetStatusItem = {
  user_id: 'joao',
  user_nome_exibicao: 'João Silva',
  state: 'nao_visto',
};

const VISTO: TargetStatusItem = {
  user_id: 'maria',
  user_nome_exibicao: 'Maria Souza',
  state: 'visto',
  displayed_at: '2026-05-28T14:30:15.000Z',
};

const CONFIRMADO: TargetStatusItem = {
  user_id: 'carlos',
  user_nome_exibicao: 'Carlos Pereira',
  state: 'confirmado',
  displayed_at: '2026-05-28T14:30:15.000Z',
  acknowledged_at: '2026-05-28T14:31:00.000Z',
};

describe('TargetStatusList', () => {
  it('renderiza nome e rótulo de cada estado', () => {
    render(<TargetStatusList targets={[NAO_VISTO, VISTO, CONFIRMADO]} emptyLabel="vazio" />);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Não visto')).toBeInTheDocument();
    expect(screen.getByText('Visto')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });

  it('expõe data-state para cada linha', () => {
    const { container } = render(<TargetStatusList targets={[CONFIRMADO]} emptyLabel="vazio" />);
    expect(container.querySelector('[data-state="confirmado"]')).not.toBeNull();
  });

  it('mostra o emptyLabel quando não há targets', () => {
    render(<TargetStatusList targets={[]} emptyLabel="Nenhum operador." />);
    expect(screen.getByText('Nenhum operador.')).toBeInTheDocument();
  });

  it('não mostra timestamp para nao_visto', () => {
    render(<TargetStatusList targets={[NAO_VISTO]} emptyLabel="vazio" />);
    expect(screen.queryByText(/às/)).not.toBeInTheDocument();
  });
});

describe('formatAckTime', () => {
  it('formata ISO em HH:MM:SS', () => {
    expect(formatAckTime('2026-05-28T14:30:15.000Z')).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('retorna null para undefined', () => {
    expect(formatAckTime(undefined)).toBeNull();
  });

  it('retorna null para data inválida', () => {
    expect(formatAckTime('not-a-date')).toBeNull();
  });
});
