import { describe, it, expect } from 'vitest';

import { decodeUlidTime, generateSprintId, isValidUlid, ULID_REGEX } from './ids';

describe('generateSprintId', () => {
  it('retorna string de exatamente 26 caracteres', () => {
    const id = generateSprintId();
    expect(id).toHaveLength(26);
  });

  it('retorna string Crockford Base32 válida', () => {
    const id = generateSprintId();
    expect(id).toMatch(ULID_REGEX);
  });

  it('não usa caracteres ambíguos (I, L, O, U)', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateSprintId();
      expect(id).not.toMatch(/[ILOU]/);
    }
  });

  it('gera IDs distintos em chamadas consecutivas', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSprintId());
    }
    expect(ids.size).toBe(100);
  });

  it('IDs gerados em ordem temporal ordenam lexicograficamente', async () => {
    const first = generateSprintId();
    // Resolução do timestamp ULID é 1 ms — pausa pequena garante segundo > primeiro
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = generateSprintId();
    expect(first < second).toBe(true);
  });
});

describe('isValidUlid', () => {
  it('aceita ULIDs gerados pelo próprio módulo', () => {
    const id = generateSprintId();
    expect(isValidUlid(id)).toBe(true);
  });

  it('aceita ULID canônico de exemplo', () => {
    // Nota: o exemplo `01HX9K2M4F8N7P2Q5R3S6T7U8V` que circula em prompts
    // contém um U no índice 23 — inválido em Crockford Base32. Usamos
    // `01HX9K2M4F8N7P2Q5R3S6T7V8W` (sem I/L/O/U) como referência.
    expect(isValidUlid('01HX9K2M4F8N7P2Q5R3S6T7V8W')).toBe(true);
  });

  it('rejeita strings de tamanho errado', () => {
    expect(isValidUlid('01HX9K2M')).toBe(false);
    expect(isValidUlid('01HX9K2M4F8N7P2Q5R3S6T7V8W0')).toBe(false);
    expect(isValidUlid('')).toBe(false);
  });

  it('rejeita caracteres inválidos (I, L, O, U)', () => {
    expect(isValidUlid('01HX9K2M4F8N7P2Q5R3S6T7V8I')).toBe(false);
    expect(isValidUlid('01HX9K2M4F8N7P2Q5R3S6T7V8L')).toBe(false);
    expect(isValidUlid('01HX9K2M4F8N7P2Q5R3S6T7V8O')).toBe(false);
    expect(isValidUlid('01HX9K2M4F8N7P2Q5R3S6T7U8W')).toBe(false);
  });

  it('rejeita lowercase', () => {
    expect(isValidUlid('01hx9k2m4f8n7p2q5r3s6t7v8w')).toBe(false);
  });

  it('rejeita UUIDs', () => {
    expect(isValidUlid('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('rejeita inputs não-string em runtime (defesa contra consumers JS)', () => {
    // @ts-expect-error - testando defesa de runtime contra null
    expect(isValidUlid(null)).toBe(false);
    // @ts-expect-error - testando defesa de runtime contra undefined
    expect(isValidUlid(undefined)).toBe(false);
    // @ts-expect-error - testando defesa de runtime contra number
    expect(isValidUlid(12345)).toBe(false);
    // @ts-expect-error - testando defesa de runtime contra objeto
    expect(isValidUlid({})).toBe(false);
  });
});

describe('decodeUlidTime', () => {
  it('decodifica o timestamp canônico da spec do ULID', () => {
    // Vetor da spec ULID: 01ARYZ6S41TSV4RRFFQ69G5FAV → 1469918176385.
    expect(decodeUlidTime('01ARYZ6S41TSV4RRFFQ69G5FAV')).toBe(1469918176385);
  });

  it('round-trip: o timestamp decodificado bate com o instante de geração', () => {
    const before = Date.now();
    const id = generateSprintId();
    const after = Date.now();
    const decoded = decodeUlidTime(id);
    // ULID tem resolução de 1 ms; o instante decodificado fica no intervalo.
    expect(decoded).toBeGreaterThanOrEqual(before);
    expect(decoded).toBeLessThanOrEqual(after);
  });

  it('lança para ULID inválido (tamanho errado)', () => {
    expect(() => decodeUlidTime('01HX9K2M')).toThrow(/ULID inválido/);
  });

  it('lança para caracteres inválidos (I/L/O/U)', () => {
    expect(() => decodeUlidTime('01HX9K2M4F8N7P2Q5R3S6T7U8W')).toThrow(/ULID inválido/);
  });
});
