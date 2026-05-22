import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { ContractValidationError } from './errors';

/**
 * Cria um `ZodError` real com exatamente duas issues: um campo com tipo
 * incorreto e um campo obrigatório ausente.
 */
function makeZodError() {
  const result = z.object({ nome: z.string(), idade: z.number() }).safeParse({ nome: 123 });
  if (result.success) {
    throw new Error('fixture inválida: esperava falha de validação');
  }
  return result.error;
}

describe('ContractValidationError', () => {
  describe('construção', () => {
    it('é instância de Error e de ContractValidationError', () => {
      const err = new ContractValidationError('SprintAck', makeZodError());
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ContractValidationError);
    });

    it('expõe um name fixo "ContractValidationError"', () => {
      const err = new ContractValidationError('SprintAck', makeZodError());
      expect(err.name).toBe('ContractValidationError');
    });

    it('preserva o schemaName recebido no construtor', () => {
      const err = new ContractValidationError('AgentConfig', makeZodError());
      expect(err.schemaName).toBe('AgentConfig');
    });

    it('compõe a message com schemaName e contagem de issues', () => {
      const cause = makeZodError();
      const err = new ContractValidationError('SprintPayload', cause);
      expect(cause.issues).toHaveLength(2);
      expect(err.message).toBe('SprintPayload validation failed: 2 issue(s)');
    });
  });

  describe('cause', () => {
    it('encadeia o ZodError original (ES2022 error cause)', () => {
      const cause = makeZodError();
      const err = new ContractValidationError('SprintCancel', cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('issues (getter)', () => {
    it('expõe a mesma referência de array de cause.issues', () => {
      const cause = makeZodError();
      const err = new ContractValidationError('SprintAck', cause);
      expect(err.issues).toBe(cause.issues);
    });

    it('lista uma issue para cada campo inválido', () => {
      const err = new ContractValidationError('SprintAck', makeZodError());
      expect(err.issues).toHaveLength(2);
    });
  });

  describe('format()', () => {
    it('formata cada issue como "path: mensagem", uma por linha', () => {
      const err = new ContractValidationError('SprintAck', makeZodError());
      const linhas = err.format().split('\n');
      expect(linhas).toHaveLength(2);
      expect(linhas.every((linha) => linha.includes(': '))).toBe(true);
    });

    it('junta paths aninhados com ponto', () => {
      const result = z
        .object({ endereco: z.object({ cep: z.string() }) })
        .safeParse({ endereco: { cep: 123 } });
      if (result.success) {
        throw new Error('fixture inválida: esperava falha de validação');
      }
      const err = new ContractValidationError('SprintPayload', result.error);
      expect(err.format()).toMatch(/^endereco\.cep: /);
    });

    it('usa "<root>" quando a issue não tem path', () => {
      const result = z.object({ campo: z.string() }).safeParse('não é objeto');
      if (result.success) {
        throw new Error('fixture inválida: esperava falha de validação');
      }
      const err = new ContractValidationError('SprintPayload', result.error);
      expect(err.format()).toMatch(/^<root>: /);
    });
  });
});
