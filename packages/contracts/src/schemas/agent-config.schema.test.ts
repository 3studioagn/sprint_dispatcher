import { describe, it, expect } from 'vitest';

import { validAgentConfig } from '../__fixtures__/sample-payloads';
import { ContractValidationError } from '../errors';

import { parseAgentConfig, safeParseAgentConfig } from './agent-config.schema';

describe('agentConfigSchema', () => {
  describe('configs válidas', () => {
    it('aceita fixture canônica', () => {
      expect(() => parseAgentConfig(validAgentConfig)).not.toThrow();
    });

    it('aplica defaults quando campos opcionais omitidos', () => {
      const {
        polling_interval_seconds: _p,
        som_notificacao: _s,
        log_level: _l,
        ...rest
      } = validAgentConfig;
      const result = parseAgentConfig(rest);
      expect(result.polling_interval_seconds).toBe(3);
      expect(result.som_notificacao).toBe(true);
      expect(result.log_level).toBe('info');
    });
  });

  describe('campos obrigatórios faltantes', () => {
    const required = [
      'schema_version',
      'user_id',
      'user_nome_exibicao',
      'hostname',
      'shared_path',
    ] as const;

    required.forEach((field) => {
      it(`falha quando ${field} está ausente`, () => {
        const invalid: Record<string, unknown> = { ...validAgentConfig };
        delete invalid[field];
        expect(() => parseAgentConfig(invalid)).toThrow(ContractValidationError);
      });
    });
  });

  describe('validação de polling_interval_seconds', () => {
    it('rejeita valor menor que 1', () => {
      const invalid = { ...validAgentConfig, polling_interval_seconds: 0 };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });

    it('rejeita valor maior que 60', () => {
      const invalid = { ...validAgentConfig, polling_interval_seconds: 61 };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });

    it('rejeita valor fracionário', () => {
      const invalid = { ...validAgentConfig, polling_interval_seconds: 3.5 };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });

    it('rejeita valor negativo', () => {
      const invalid = { ...validAgentConfig, polling_interval_seconds: -5 };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });

    it('aceita valor máximo (60)', () => {
      const ok = { ...validAgentConfig, polling_interval_seconds: 60 };
      expect(() => parseAgentConfig(ok)).not.toThrow();
    });
  });

  describe('validação de log_level (enum)', () => {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

    validLevels.forEach((level) => {
      it(`aceita log_level "${level}"`, () => {
        const ok = { ...validAgentConfig, log_level: level };
        expect(() => parseAgentConfig(ok)).not.toThrow();
      });
    });

    it('rejeita log_level inválido', () => {
      const invalid = { ...validAgentConfig, log_level: 'verbose' };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });

    it('rejeita log_level em uppercase', () => {
      const invalid = { ...validAgentConfig, log_level: 'INFO' };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });
  });

  describe('validação de user_id', () => {
    it('rejeita user_id com espaço', () => {
      const invalid = { ...validAgentConfig, user_id: 'joao silva' };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });
  });

  describe('campo extra (.strict())', () => {
    it('rejeita campo desconhecido', () => {
      const invalid = { ...validAgentConfig, campo_estranho: 'malicioso' };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });
  });

  describe('limites de tamanho', () => {
    it('rejeita shared_path vazio', () => {
      const invalid = { ...validAgentConfig, shared_path: '' };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });

    it('rejeita shared_path com mais de 500 chars', () => {
      const invalid = { ...validAgentConfig, shared_path: 'x'.repeat(501) };
      expect(() => parseAgentConfig(invalid)).toThrow();
    });
  });
});

describe('parseAgentConfig', () => {
  it('lança ContractValidationError em payload inválido', () => {
    expect(() => parseAgentConfig({})).toThrow(ContractValidationError);
  });

  it('ContractValidationError tem schemaName "AgentConfig"', () => {
    try {
      parseAgentConfig({});
      expect.fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ContractValidationError);
      expect((err as ContractValidationError).schemaName).toBe('AgentConfig');
    }
  });
});

describe('safeParseAgentConfig', () => {
  it('retorna { success: true, data } em payload válido', () => {
    const result = safeParseAgentConfig(validAgentConfig);
    expect(result.success).toBe(true);
  });

  it('retorna { success: false, error } em payload inválido', () => {
    const result = safeParseAgentConfig({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.schemaName).toBe('AgentConfig');
    }
  });
});
