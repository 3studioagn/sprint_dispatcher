import { describe, it, expect } from 'vitest';

import { validSprintAck } from '../__fixtures__/sample-payloads';
import { ContractValidationError } from '../errors';

import { parseSprintAck, safeParseSprintAck } from './sprint-ack.schema';

describe('sprintAckSchema', () => {
  describe('payloads válidos', () => {
    it('aceita fixture canônica', () => {
      expect(() => parseSprintAck(validSprintAck)).not.toThrow();
    });

    it('aceita ack sem acknowledged_at (operador não clicou OK antes do timeout)', () => {
      const { acknowledged_at: _ignored, ...rest } = validSprintAck;
      expect(() => parseSprintAck(rest)).not.toThrow();
    });
  });

  describe('campos obrigatórios faltantes', () => {
    const required = [
      'schema_version',
      'sprint_id',
      'user_id',
      'hostname',
      'displayed_at',
      'agent_version',
    ] as const;

    required.forEach((field) => {
      it(`falha quando ${field} está ausente`, () => {
        const invalid: Record<string, unknown> = { ...validSprintAck };
        delete invalid[field];
        expect(() => parseSprintAck(invalid)).toThrow(ContractValidationError);
      });
    });
  });

  describe('validação de agent_version (semver)', () => {
    it('rejeita semver com prefix "v"', () => {
      const invalid = { ...validSprintAck, agent_version: 'v1.0.0' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });

    it('rejeita semver de duas partes', () => {
      const invalid = { ...validSprintAck, agent_version: '1.0' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });

    it('rejeita semver com pre-release suffix', () => {
      const invalid = { ...validSprintAck, agent_version: '1.0.0-alpha' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });

    it('aceita semver MAJOR.MINOR.PATCH padrão', () => {
      const ok = { ...validSprintAck, agent_version: '12.34.567' };
      expect(() => parseSprintAck(ok)).not.toThrow();
    });
  });

  describe('validação de sprint_id (ULID)', () => {
    it('rejeita ULID com caractere inválido', () => {
      const invalid = { ...validSprintAck, sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7U8W' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });
  });

  describe('validação de user_id', () => {
    it('rejeita user_id com espaço', () => {
      const invalid = { ...validSprintAck, user_id: 'joao silva' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });
  });

  describe('campo extra (.strict())', () => {
    it('rejeita campo desconhecido', () => {
      const invalid = { ...validSprintAck, campo_estranho: 'malicioso' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });
  });

  describe('limites de tamanho', () => {
    it('rejeita hostname vazio', () => {
      const invalid = { ...validSprintAck, hostname: '' };
      expect(() => parseSprintAck(invalid)).toThrow();
    });

    it('rejeita hostname com mais de 100 chars', () => {
      const invalid = { ...validSprintAck, hostname: 'a'.repeat(101) };
      expect(() => parseSprintAck(invalid)).toThrow();
    });
  });
});

describe('parseSprintAck', () => {
  it('lança ContractValidationError em payload inválido', () => {
    expect(() => parseSprintAck({})).toThrow(ContractValidationError);
  });

  it('ContractValidationError tem schemaName "SprintAck"', () => {
    try {
      parseSprintAck({});
      expect.fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ContractValidationError);
      expect((err as ContractValidationError).schemaName).toBe('SprintAck');
    }
  });
});

describe('safeParseSprintAck', () => {
  it('retorna { success: true, data } em payload válido', () => {
    const result = safeParseSprintAck(validSprintAck);
    expect(result.success).toBe(true);
  });

  it('retorna { success: false, error } em payload inválido', () => {
    const result = safeParseSprintAck({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.schemaName).toBe('SprintAck');
    }
  });
});
