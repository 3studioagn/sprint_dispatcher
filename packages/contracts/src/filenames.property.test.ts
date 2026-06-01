/**
 * Property-based para `filenames.ts`.
 *
 * Garante invariantes universais de roundtrip e cross-discriminação
 * que `filenames.test.ts` cobre apenas com exemplos pontuais.
 */
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { ulidArbitrary, userIdArbitrary } from './__helpers__/arbitraries';
import {
  buildAckFilename,
  buildCancelFilename,
  buildPendingFilename,
  FilenameParseError,
  parseFilename,
} from './filenames';

const SAMPLE_ULID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

describe('roundtrip property: build → parse preserva todos os campos', () => {
  it('pending: parseFilename(buildPendingFilename(ulid, user)) === { pending, ulid, user }', () => {
    fc.assert(
      fc.property(ulidArbitrary, userIdArbitrary, (ulid, user) => {
        const name = buildPendingFilename(ulid, user);
        const parsed = parseFilename(name);
        return parsed.type === 'pending' && parsed.sprintId === ulid && parsed.userId === user;
      }),
      { numRuns: 100 },
    );
  });

  it('ack: parseFilename(buildAckFilename(ulid, user)) === { ack, ulid, user }', () => {
    fc.assert(
      fc.property(ulidArbitrary, userIdArbitrary, (ulid, user) => {
        const name = buildAckFilename(ulid, user);
        const parsed = parseFilename(name);
        return parsed.type === 'ack' && parsed.sprintId === ulid && parsed.userId === user;
      }),
      { numRuns: 100 },
    );
  });

  it('cancel: parseFilename(buildCancelFilename(ulid)) === { cancel, ulid }', () => {
    fc.assert(
      fc.property(ulidArbitrary, (ulid) => {
        const name = buildCancelFilename(ulid);
        const parsed = parseFilename(name);
        return parsed.type === 'cancel' && parsed.sprintId === ulid;
      }),
      { numRuns: 100 },
    );
  });
});

describe('cross-discriminação: tipos são mutuamente exclusivos', () => {
  it('parseFilename de pending NUNCA produz type ack nem cancel', () => {
    fc.assert(
      fc.property(ulidArbitrary, userIdArbitrary, (ulid, user) => {
        const name = buildPendingFilename(ulid, user);
        return parseFilename(name).type === 'pending';
      }),
      { numRuns: 50 },
    );
  });

  it('parseFilename de ack NUNCA produz type pending nem cancel', () => {
    fc.assert(
      fc.property(ulidArbitrary, userIdArbitrary, (ulid, user) => {
        const name = buildAckFilename(ulid, user);
        return parseFilename(name).type === 'ack';
      }),
      { numRuns: 50 },
    );
  });

  it('parseFilename de cancel NUNCA produz type pending nem ack', () => {
    fc.assert(
      fc.property(ulidArbitrary, (ulid) => {
        const name = buildCancelFilename(ulid);
        return parseFilename(name).type === 'cancel';
      }),
      { numRuns: 50 },
    );
  });
});

describe('edge cases de userId — limites de tamanho e charset', () => {
  it('userId com 1 char é aceito e roundtrip funciona (pending)', () => {
    const name = buildPendingFilename(SAMPLE_ULID, 'a');
    expect(parseFilename(name)).toEqual({
      type: 'pending',
      sprintId: SAMPLE_ULID,
      userId: 'a',
    });
  });

  it('userId com 50 chars (máximo) é aceito e roundtrip funciona', () => {
    const user = 'a'.repeat(50);
    const name = buildPendingFilename(SAMPLE_ULID, user);
    expect(parseFilename(name)).toEqual({
      type: 'pending',
      sprintId: SAMPLE_ULID,
      userId: user,
    });
  });

  it('userId apenas com dígitos é aceito', () => {
    const name = buildPendingFilename(SAMPLE_ULID, '12345');
    expect(parseFilename(name)).toEqual({
      type: 'pending',
      sprintId: SAMPLE_ULID,
      userId: '12345',
    });
  });

  it('userId apenas com hífen é aceito (regex permite)', () => {
    const name = buildPendingFilename(SAMPLE_ULID, '-');
    expect(parseFilename(name)).toEqual({
      type: 'pending',
      sprintId: SAMPLE_ULID,
      userId: '-',
    });
  });

  it('userId apenas com underscore é aceito (regex permite)', () => {
    const name = buildPendingFilename(SAMPLE_ULID, '_');
    expect(parseFilename(name)).toEqual({
      type: 'pending',
      sprintId: SAMPLE_ULID,
      userId: '_',
    });
  });

  it('userId misturando dígitos, letras, hífens e underscores', () => {
    const user = 'op-007_node5';
    const name = buildPendingFilename(SAMPLE_ULID, user);
    expect(parseFilename(name)).toEqual({
      type: 'pending',
      sprintId: SAMPLE_ULID,
      userId: user,
    });
  });
});

describe('inputs inválidos para parseFilename (asserts pontuais complementam o existente)', () => {
  it('falha em string com extensão diferente de .json', () => {
    expect(() => parseFilename(`${SAMPLE_ULID}-joao.txt`)).toThrow(FilenameParseError);
  });

  it('falha em string com extra prefix antes do ULID', () => {
    expect(() => parseFilename(`pending-${SAMPLE_ULID}-joao.json`)).toThrow(FilenameParseError);
  });

  it('falha em cancel sem o prefixo "cancel-"', () => {
    expect(() => parseFilename(`cancelar-${SAMPLE_ULID}.json`)).toThrow(FilenameParseError);
  });

  it('falha em pending sem hífen separador entre ULID e userId', () => {
    expect(() => parseFilename(`${SAMPLE_ULID}joao.json`)).toThrow(FilenameParseError);
  });
});
