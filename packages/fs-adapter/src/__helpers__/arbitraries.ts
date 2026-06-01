/**
 * Arbitraries `fast-check` para `@sprint/fs-adapter`.
 *
 * Nota arquitetural: arbitraries de SprintPayload/SprintAck/SprintCancel
 * vivem em `@sprint/contracts/src/__helpers__/arbitraries.ts`, mas o
 * pacote contracts não expõe subpath `__helpers__` no `exports`. Quando
 * o Gate 6 (integration tests cross-package) precisar dos shapes, eles
 * serão recriados localmente neste arquivo — duplicação consciente,
 * pequena, isolada em helpers de teste. Outra alternativa seria
 * adicionar `"./src/__helpers__/*"` ao `exports` do contracts, mas isso
 * é mudança de production API (red line §10).
 *
 * Excluído da medição de cobertura (ver `vitest.config.ts`).
 */
import fc from 'fast-check';

/**
 * Path POSIX de tamanho médio (`/foo/bar/baz`). Útil em property tests
 * de operações de filesystem que não dependem de FS real.
 */
export const posixPathArbitrary: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/), { minLength: 1, maxLength: 5 })
  .map((segments) => `/${segments.join('/')}`);

/**
 * ULID em Crockford Base32. Cópia local do equivalente em
 * `@sprint/contracts/__helpers__` — adicionado aqui em Gate 6 conforme
 * a nota arquitetural acima.
 */
export const ulidArbitrary: fc.Arbitrary<string> = fc.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/);

/**
 * userId conforme `userIdSchema` — 1-50 chars de `[a-z0-9_-]`.
 */
export const userIdArbitrary: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom<string>(
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '_',
      '-',
    ),
    { minLength: 1, maxLength: 50 },
  )
  .map((chars) => chars.join(''));
