import { describe, it, expect } from 'vitest';

import { isoDatetimeSchema, schemaVersionSchema, sprintIdSchema, userIdSchema } from './shared';

const VALID_ULID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

describe('sprintIdSchema', () => {
  it('aceita um ULID Crockford Base32 válido', () => {
    expect(sprintIdSchema.safeParse(VALID_ULID).success).toBe(true);
  });

  it('rejeita ULID com caractere ambíguo (contém U)', () => {
    // Crockford Base32 exclui I, L, O e U para evitar ambiguidade visual.
    const ulidComU = '01HX9K2M4F8N7P2Q5R3S6T7U8W';
    expect(sprintIdSchema.safeParse(ulidComU).success).toBe(false);
  });

  it('rejeita string com tamanho diferente de 26', () => {
    expect(sprintIdSchema.safeParse('01HX9K2M').success).toBe(false);
  });

  it('rejeita ULID em lowercase', () => {
    expect(sprintIdSchema.safeParse(VALID_ULID.toLowerCase()).success).toBe(false);
  });
});

describe('userIdSchema', () => {
  it('aceita lowercase, dígitos, underscore e hífen', () => {
    expect(userIdSchema.safeParse('joao_silva-02').success).toBe(true);
  });

  it('rejeita string vazia (min 1)', () => {
    expect(userIdSchema.safeParse('').success).toBe(false);
  });

  it('rejeita string com mais de 50 caracteres', () => {
    expect(userIdSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });

  it('aceita string com exatamente 50 caracteres', () => {
    expect(userIdSchema.safeParse('a'.repeat(50)).success).toBe(true);
  });

  it('rejeita caracteres fora de [a-z0-9_-]', () => {
    expect(userIdSchema.safeParse('Joao').success).toBe(false);
    expect(userIdSchema.safeParse('joao silva').success).toBe(false);
    expect(userIdSchema.safeParse('joão').success).toBe(false);
  });
});

describe('isoDatetimeSchema', () => {
  it('aceita datetime com offset numérico', () => {
    const result = isoDatetimeSchema.safeParse('2026-05-21T14:32:10-03:00');
    expect(result.success).toBe(true);
  });

  it('aceita datetime UTC com sufixo Z', () => {
    const result = isoDatetimeSchema.safeParse('2026-05-21T14:32:10Z');
    expect(result.success).toBe(true);
  });

  it('rejeita datetime sem offset (fuso ambíguo)', () => {
    const result = isoDatetimeSchema.safeParse('2026-05-21T14:32:10');
    expect(result.success).toBe(false);
  });

  it('rejeita string que não é datetime ISO 8601', () => {
    expect(isoDatetimeSchema.safeParse('ontem às 14h').success).toBe(false);
  });
});

describe('schemaVersionSchema', () => {
  it('aceita o literal "1.0"', () => {
    expect(schemaVersionSchema.safeParse('1.0').success).toBe(true);
  });

  it('rejeita qualquer outra versão', () => {
    expect(schemaVersionSchema.safeParse('2.0').success).toBe(false);
    expect(schemaVersionSchema.safeParse('1.1').success).toBe(false);
  });

  it('rejeita a versão expressa como número', () => {
    expect(schemaVersionSchema.safeParse(1).success).toBe(false);
  });
});
