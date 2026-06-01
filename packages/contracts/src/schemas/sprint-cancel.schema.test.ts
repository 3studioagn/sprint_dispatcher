import { describe, it, expect } from 'vitest';

import { validSprintCancel } from '../__fixtures__/sample-payloads';
import { ContractValidationError } from '../errors';

import { parseSprintCancel, safeParseSprintCancel } from './sprint-cancel.schema';

describe('sprintCancelSchema', () => {
  describe('payloads válidos', () => {
    it('aceita fixture canônica', () => {
      expect(() => parseSprintCancel(validSprintCancel)).not.toThrow();
    });

    it('aceita cancel sem motivo (campo opcional)', () => {
      const { motivo: _ignored, ...rest } = validSprintCancel;
      expect(() => parseSprintCancel(rest)).not.toThrow();
    });
  });

  describe('campos obrigatórios faltantes', () => {
    const required = [
      'schema_version',
      'type',
      'sprint_id_ref',
      'cancelado_por',
      'cancelado_em',
    ] as const;

    required.forEach((field) => {
      it(`falha quando ${field} está ausente`, () => {
        const invalid: Record<string, unknown> = { ...validSprintCancel };
        delete invalid[field];
        expect(() => parseSprintCancel(invalid)).toThrow(ContractValidationError);
      });
    });
  });

  describe('validação de type (literal "cancel")', () => {
    it('rejeita type diferente de "cancel"', () => {
      const invalid = { ...validSprintCancel, type: 'sprint' };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });

    it('rejeita type em uppercase', () => {
      const invalid = { ...validSprintCancel, type: 'CANCEL' };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });
  });

  describe('validação de sprint_id_ref (ULID)', () => {
    it('rejeita ULID inválido', () => {
      const invalid = {
        ...validSprintCancel,
        sprint_id_ref: '01HX9K2M4F8N7P2Q5R3S6T7U8W',
      };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });
  });

  describe('validação de datetime', () => {
    it('rejeita cancelado_em sem offset', () => {
      const invalid = { ...validSprintCancel, cancelado_em: '2026-05-21T15:00:00' };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });
  });

  describe('campo extra (.strict())', () => {
    it('rejeita campo desconhecido', () => {
      const invalid = { ...validSprintCancel, campo_estranho: 'malicioso' };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });
  });

  describe('limites de tamanho', () => {
    it('rejeita motivo com mais de 500 chars', () => {
      const invalid = { ...validSprintCancel, motivo: 'x'.repeat(501) };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });

    it('rejeita cancelado_por vazio', () => {
      const invalid = { ...validSprintCancel, cancelado_por: '' };
      expect(() => parseSprintCancel(invalid)).toThrow();
    });
  });
});

describe('parseSprintCancel', () => {
  it('lança ContractValidationError em payload inválido', () => {
    expect(() => parseSprintCancel({})).toThrow(ContractValidationError);
  });

  it('ContractValidationError tem schemaName "SprintCancel"', () => {
    try {
      parseSprintCancel({});
      expect.fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ContractValidationError);
      expect((err as ContractValidationError).schemaName).toBe('SprintCancel');
    }
  });
});

describe('safeParseSprintCancel', () => {
  it('retorna { success: true, data } em payload válido', () => {
    const result = safeParseSprintCancel(validSprintCancel);
    expect(result.success).toBe(true);
  });

  it('retorna { success: false, error } em payload inválido', () => {
    const result = safeParseSprintCancel({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.schemaName).toBe('SprintCancel');
    }
  });
});
