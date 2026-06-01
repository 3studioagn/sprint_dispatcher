import { describe, it, expect } from 'vitest';

import { validSprintPayload } from '../__fixtures__/sample-payloads';
import { ContractValidationError } from '../errors';

import { parseSprintPayload, safeParseSprintPayload } from './sprint-payload.schema';

describe('sprintPayloadSchema', () => {
  describe('payloads válidos', () => {
    it('aceita fixture canônica', () => {
      expect(() => parseSprintPayload(validSprintPayload)).not.toThrow();
    });

    it('aplica default em show_duration_seconds quando omitido', () => {
      const { show_duration_seconds: _ignored, ...rest } = validSprintPayload;
      const result = parseSprintPayload(rest);
      expect(result.show_duration_seconds).toBe(5);
    });

    it('aplica default em persistent_popup quando omitido', () => {
      const { persistent_popup: _ignored, ...rest } = validSprintPayload;
      const result = parseSprintPayload(rest);
      expect(result.persistent_popup).toBe(true);
    });

    it('aceita user_id com underscores e hífens', () => {
      const ok = { ...validSprintPayload, user_id: 'joao_silva-01' };
      expect(() => parseSprintPayload(ok)).not.toThrow();
    });
  });

  describe('campos obrigatórios faltantes', () => {
    const required = [
      'schema_version',
      'sprint_id',
      'criado_por',
      'criado_em',
      'user_id',
      'title',
      'body_html',
      'meta',
      'deadline_at',
    ] as const;

    required.forEach((field) => {
      it(`falha quando ${field} está ausente`, () => {
        const invalid: Record<string, unknown> = { ...validSprintPayload };
        delete invalid[field];
        expect(() => parseSprintPayload(invalid)).toThrow(ContractValidationError);
      });
    });
  });

  describe('validação de sprint_id (ULID)', () => {
    it('rejeita ULID com caractere inválido (U no índice 23)', () => {
      const invalid = { ...validSprintPayload, sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7U8W' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita ULID de tamanho errado', () => {
      const invalid = { ...validSprintPayload, sprint_id: '01HX9K2M' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita ULID em lowercase', () => {
      const invalid = {
        ...validSprintPayload,
        sprint_id: validSprintPayload.sprint_id.toLowerCase(),
      };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });
  });

  describe('validação de user_id', () => {
    it('rejeita user_id com espaço', () => {
      const invalid = { ...validSprintPayload, user_id: 'joao silva' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita user_id em uppercase', () => {
      const invalid = { ...validSprintPayload, user_id: 'JOAO' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita user_id vazio', () => {
      const invalid = { ...validSprintPayload, user_id: '' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita user_id com mais de 50 chars', () => {
      const invalid = { ...validSprintPayload, user_id: 'a'.repeat(51) };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });
  });

  describe('validação de meta', () => {
    it('rejeita meta zero', () => {
      const invalid = { ...validSprintPayload, meta: 0 };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita meta negativa', () => {
      const invalid = { ...validSprintPayload, meta: -1 };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita meta fracionária', () => {
      const invalid = { ...validSprintPayload, meta: 3.5 };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita meta como string', () => {
      const invalid = { ...validSprintPayload, meta: '5' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita meta NaN', () => {
      const invalid = { ...validSprintPayload, meta: Number.NaN };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita meta Infinity', () => {
      const invalid = { ...validSprintPayload, meta: Number.POSITIVE_INFINITY };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });
  });

  describe('validação de datetime', () => {
    it('rejeita criado_em sem offset', () => {
      const invalid = { ...validSprintPayload, criado_em: '2026-05-21T14:32:10' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('aceita criado_em com offset UTC (Z)', () => {
      const ok = { ...validSprintPayload, criado_em: '2026-05-21T14:32:10Z' };
      expect(() => parseSprintPayload(ok)).not.toThrow();
    });

    it('aceita criado_em com offset numérico', () => {
      const ok = { ...validSprintPayload, criado_em: '2026-05-21T14:32:10-03:00' };
      expect(() => parseSprintPayload(ok)).not.toThrow();
    });
  });

  describe('campo extra (.strict())', () => {
    it('rejeita campo desconhecido', () => {
      const invalid = { ...validSprintPayload, campo_estranho: 'malicioso' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });
  });

  describe('schema_version', () => {
    it('rejeita schema_version diferente de "1.0"', () => {
      const invalid = { ...validSprintPayload, schema_version: '2.0' };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });
  });

  describe('limites de tamanho', () => {
    it('rejeita title com mais de 200 chars', () => {
      const invalid = { ...validSprintPayload, title: 'x'.repeat(201) };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita body_html com mais de 2000 chars', () => {
      const invalid = { ...validSprintPayload, body_html: 'x'.repeat(2001) };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita show_duration_seconds maior que 60', () => {
      const invalid = { ...validSprintPayload, show_duration_seconds: 61 };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });

    it('rejeita show_duration_seconds zero', () => {
      const invalid = { ...validSprintPayload, show_duration_seconds: 0 };
      expect(() => parseSprintPayload(invalid)).toThrow();
    });
  });
});

describe('parseSprintPayload', () => {
  it('lança ContractValidationError em payload inválido', () => {
    expect(() => parseSprintPayload({})).toThrow(ContractValidationError);
  });

  it('ContractValidationError tem schemaName correto', () => {
    try {
      parseSprintPayload({});
      expect.fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ContractValidationError);
      expect((err as ContractValidationError).schemaName).toBe('SprintPayload');
    }
  });
});

describe('safeParseSprintPayload', () => {
  it('retorna { success: true, data } em payload válido', () => {
    const result = safeParseSprintPayload(validSprintPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user_id).toBe('joao');
    }
  });

  it('retorna { success: false, error } em payload inválido', () => {
    const result = safeParseSprintPayload({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ContractValidationError);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('error.format() retorna string com path: mensagem', () => {
    const result = safeParseSprintPayload({});
    if (!result.success) {
      const formatted = result.error.format();
      expect(formatted).toContain(':');
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('error.issues retorna array não-vazio em payload vazio', () => {
    const result = safeParseSprintPayload({});
    if (!result.success) {
      expect(Array.isArray(result.error.issues)).toBe(true);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('error.format() usa "<root>" quando path está vazio (input não-objeto)', () => {
    // Quando o input não é um objeto (ex: null), Zod produz issue com
    // path: [] — exercita o branch falsy de `path.join('.') || '<root>'`.
    const result = safeParseSprintPayload(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.format()).toContain('<root>');
    }
  });
});
