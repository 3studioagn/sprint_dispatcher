import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ConfigErrorInfo } from '../../../shared/ipc-types';

import { ConfigErrorScreen } from './ConfigErrorScreen';

function baseError(overrides: Partial<ConfigErrorInfo> = {}): ConfigErrorInfo {
  return {
    code: 'NOT_FOUND',
    message: 'Configuração ausente em C:\\fake\\config.json',
    expectedPath: 'C:\\fake\\config.json',
    ...overrides,
  };
}

describe('ConfigErrorScreen', () => {
  it('exibe título correto para code NOT_FOUND', () => {
    render(<ConfigErrorScreen error={baseError({ code: 'NOT_FOUND' })} />);
    expect(
      screen.getByRole('heading', { name: /Configuração não encontrada/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('exibe título correto para code JSON_INVALID', () => {
    render(<ConfigErrorScreen error={baseError({ code: 'JSON_INVALID' })} />);
    expect(screen.getByRole('heading', { name: /JSON inválido/i, level: 1 })).toBeInTheDocument();
  });

  it('exibe título correto para code SCHEMA_INVALID', () => {
    render(<ConfigErrorScreen error={baseError({ code: 'SCHEMA_INVALID' })} />);
    expect(
      screen.getByRole('heading', { name: /Estrutura da configuração inválida/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('exibe título correto para code READ_ERROR', () => {
    render(<ConfigErrorScreen error={baseError({ code: 'READ_ERROR' })} />);
    expect(
      screen.getByRole('heading', { name: /Falha ao ler configuração/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('exibe título correto para code SHARED_PATH_INACCESSIBLE', () => {
    render(<ConfigErrorScreen error={baseError({ code: 'SHARED_PATH_INACCESSIBLE' })} />);
    expect(
      screen.getByRole('heading', { name: /Pasta compartilhada inacessível/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('exibe a mensagem do erro', () => {
    render(<ConfigErrorScreen error={baseError({ message: 'Mensagem específica detalhada' })} />);
    expect(screen.getByText('Mensagem específica detalhada')).toBeInTheDocument();
  });

  it('exibe o expectedPath', () => {
    render(
      <ConfigErrorScreen
        error={baseError({ expectedPath: 'C:\\Users\\Renan\\custom\\config.json' })}
      />,
    );
    expect(screen.getByText('C:\\Users\\Renan\\custom\\config.json')).toBeInTheDocument();
  });

  it('exibe exemplo de JSON com shared_path e criado_por', () => {
    render(<ConfigErrorScreen error={baseError()} />);
    expect(screen.getByText(/shared_path/)).toBeInTheDocument();
    expect(screen.getByText(/criado_por/)).toBeInTheDocument();
  });

  it('botão Reabrir renderiza habilitado', () => {
    render(<ConfigErrorScreen error={baseError()} />);
    const button = screen.getByRole('button', { name: /Reabrir/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('container tem role=alert e aria-live=assertive', () => {
    render(<ConfigErrorScreen error={baseError()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});
