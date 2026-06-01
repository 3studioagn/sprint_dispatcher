import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArchivedSprintListItem } from '../../../shared/ipc-types';
import { useArchiveStore } from '../../stores/useArchiveStore';

import { Historico } from './Historico';

const ULID_A = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

function item(overrides: Partial<ArchivedSprintListItem> = {}): ArchivedSprintListItem {
  return {
    date: '2026-05-28',
    sprint_id: ULID_A,
    user_id: 'joao',
    user_nome_exibicao: 'João Silva',
    title: 'Rush',
    criado_por: 'Renan',
    criado_em: '2026-05-28T13:00:00.000Z',
    deadline_at: '2026-05-28T21:00:00.000Z',
    meta: 5,
    state: 'nao_visto',
    ...overrides,
  };
}

const ITEMS: ArchivedSprintListItem[] = [
  item({
    user_id: 'joao',
    user_nome_exibicao: 'João Silva',
    state: 'confirmado',
    displayed_at: '2026-05-28T13:30:00.000Z',
    acknowledged_at: '2026-05-28T13:31:00.000Z',
  }),
  item({
    user_id: 'maria',
    user_nome_exibicao: 'Maria Souza',
    state: 'visto',
    displayed_at: '2026-05-28T13:30:00.000Z',
  }),
];

function mockList(items: ArchivedSprintListItem[]): void {
  vi.mocked(window.api.listArchive).mockResolvedValue({
    ok: true,
    data: { items, checked_at: '2026-06-01T10:00:00.000Z' },
  });
}

describe('Historico (BL-C2-010)', () => {
  beforeEach(() => {
    useArchiveStore.getState().reset();
  });

  it('mostra empty state quando não há rodadas arquivadas', async () => {
    render(<Historico />);
    expect(await screen.findByText(/Nenhuma rodada arquivada/i)).toBeInTheDocument();
  });

  it('lista rodadas (título + líder) consumindo listArchive', async () => {
    mockList(ITEMS);
    render(<Historico />);
    const row = await screen.findByRole('button', { name: /Rush/ });
    // "Renan" também aparece como <option> no filtro de líder — escopa à linha.
    expect(within(row).getByText('Renan')).toBeInTheDocument();
    expect(vi.mocked(window.api.listArchive)).toHaveBeenCalled();
  });

  it('mostra alerta de erro quando o compartilhamento está inacessível', async () => {
    vi.mocked(window.api.listArchive).mockResolvedValue({
      ok: false,
      error: { code: 'IO', message: 'compartilhamento inacessível' },
    });
    render(<Historico />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/compartilhamento inacessível/);
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });

  it('o filtro de operador atualiza a store (client-side)', async () => {
    mockList(ITEMS);
    const user = userEvent.setup();
    render(<Historico />);
    await screen.findByRole('button', { name: /Rush/ });

    await user.selectOptions(screen.getByLabelText('Filtrar por operador'), 'maria');

    expect(useArchiveStore.getState().filters.operador).toBe('maria');
  });

  it('mudar a data re-consulta listArchive na fonte', async () => {
    render(<Historico />);
    await screen.findByText(/Nenhuma rodada/i);

    fireEvent.change(screen.getByLabelText('Filtrar por data'), {
      target: { value: '2026-05-28' },
    });

    await waitFor(() => {
      expect(vi.mocked(window.api.listArchive)).toHaveBeenLastCalledWith({ date: '2026-05-28' });
    });
  });

  it('abre o detalhe, busca o corpo via readArchivedSprint e lista os targets', async () => {
    mockList(ITEMS);
    const user = userEvent.setup();
    render(<Historico />);

    await user.click(await screen.findByRole('button', { name: /Rush/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('João Silva')).toBeInTheDocument();
    expect(within(dialog).getByText('Maria Souza')).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(window.api.readArchivedSprint)).toHaveBeenCalledWith({
        date: '2026-05-28',
        sprint_id: ULID_A,
        user_id: 'joao',
      });
    });
    expect(await within(dialog).findByText(/Sua meta até o final do dia/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('detalhe mostra erro quando readArchivedSprint falha', async () => {
    mockList(ITEMS);
    vi.mocked(window.api.readArchivedSprint).mockResolvedValue({
      ok: false,
      error: { code: 'IO', message: 'arquivo corrompido' },
    });
    const user = userEvent.setup();
    render(<Historico />);

    await user.click(await screen.findByRole('button', { name: /Rush/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Não foi possível ler o conteúdo/)).toBeInTheDocument();
    // Os targets continuam visíveis mesmo sem o corpo.
    expect(within(dialog).getByText('João Silva')).toBeInTheDocument();
  });

  it('botão "Tentar novamente" re-consulta após erro', async () => {
    vi.mocked(window.api.listArchive).mockResolvedValue({
      ok: false,
      error: { code: 'IO', message: 'compartilhamento inacessível' },
    });
    const user = userEvent.setup();
    render(<Historico />);
    await screen.findByRole('alert');
    const callsBefore = vi.mocked(window.api.listArchive).mock.calls.length;

    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));

    await waitFor(() => {
      expect(vi.mocked(window.api.listArchive).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('fecha o detalhe ao clicar no backdrop', async () => {
    mockList(ITEMS);
    const user = userEvent.setup();
    render(<Historico />);
    await user.click(await screen.findByRole('button', { name: /Rush/ }));
    const dialog = await screen.findByRole('dialog');

    // clica no backdrop (presentation) — o pai do dialog
    fireEvent.click(dialog.parentElement!);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
