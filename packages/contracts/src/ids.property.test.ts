/**
 * Property-based + larga escala para `ids.ts`.
 *
 * Separado de `ids.test.ts` (que cobre caminhos enumeráveis) para que
 * a leitura de cada suite siga um padrão único — properties aqui,
 * casos pontuais lá.
 */
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { ulidArbitrary } from './__helpers__/arbitraries';
import { generateSprintId, isValidUlid, ULID_REGEX } from './ids';

describe('generateSprintId — larga escala', () => {
  it('1000 IDs sequenciais são todos únicos', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateSprintId());
    }
    expect(ids.size).toBe(1000);
  });

  it('100 IDs concorrentes (Promise.all) são todos únicos', async () => {
    const ids = await Promise.all(
      Array.from({ length: 100 }, () => Promise.resolve(generateSprintId())),
    );
    expect(new Set(ids).size).toBe(100);
  });

  it('1000 IDs sempre passam ULID_REGEX', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generateSprintId();
      expect(ULID_REGEX.test(id)).toBe(true);
    }
  });

  it('1000 IDs nunca contêm I, L, O nem U (Crockford ambíguos)', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generateSprintId();
      expect(id).not.toMatch(/[ILOU]/);
    }
  });

  it('1000 IDs sempre têm tamanho 26', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateSprintId()).toHaveLength(26);
    }
  });
});

describe('isValidUlid — properties', () => {
  it('para qualquer ULID gerado pelo arbitrary, isValidUlid retorna true', () => {
    fc.assert(
      fc.property(ulidArbitrary, (ulid) => isValidUlid(ulid)),
      { numRuns: 100 },
    );
  });

  it('para qualquer ULID gerado pelo arbitrary, ULID_REGEX casa', () => {
    fc.assert(
      fc.property(ulidArbitrary, (ulid) => ULID_REGEX.test(ulid)),
      { numRuns: 100 },
    );
  });

  it('qualquer string com tamanho diferente de 26 falha isValidUlid', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length !== 26),
        (s) => !isValidUlid(s),
      ),
      { numRuns: 100 },
    );
  });

  it('roundtrip: cada generateSprintId() satisfaz isValidUlid', () => {
    // Não é fc.property porque generateSprintId é determinístico (mas estocástico
    // por uso de Math.random). Iteração simples basta.
    for (let i = 0; i < 200; i++) {
      const id = generateSprintId();
      expect(isValidUlid(id)).toBe(true);
    }
  });
});
