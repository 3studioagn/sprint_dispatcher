import { describe, it, expect } from 'vitest';

import {
  buildAckFilename,
  buildCancelFilename,
  buildPendingFilename,
  FilenameParseError,
  parseFilename,
  safeParseFilename,
} from './filenames';

const VALID_ULID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';
const VALID_USER = 'joao';

describe('buildPendingFilename', () => {
  it('produz <ulid>-<user>.json', () => {
    expect(buildPendingFilename(VALID_ULID, VALID_USER)).toBe(`${VALID_ULID}-${VALID_USER}.json`);
  });

  it('rejeita sprintId não-ULID', () => {
    expect(() => buildPendingFilename('not-ulid', VALID_USER)).toThrow();
  });

  it('rejeita sprintId com caractere inválido (U no índice 23)', () => {
    expect(() => buildPendingFilename('01HX9K2M4F8N7P2Q5R3S6T7U8W', VALID_USER)).toThrow();
  });

  it('rejeita userId com espaço', () => {
    expect(() => buildPendingFilename(VALID_ULID, 'jo ao')).toThrow();
  });

  it('rejeita userId em uppercase', () => {
    expect(() => buildPendingFilename(VALID_ULID, 'JOAO')).toThrow();
  });

  it('rejeita userId vazio', () => {
    expect(() => buildPendingFilename(VALID_ULID, '')).toThrow();
  });

  it('rejeita userId acima de 50 chars', () => {
    expect(() => buildPendingFilename(VALID_ULID, 'a'.repeat(51))).toThrow();
  });

  it('aceita userId com underscores e hífens', () => {
    expect(() => buildPendingFilename(VALID_ULID, 'joao_silva-01')).not.toThrow();
  });
});

describe('buildAckFilename', () => {
  it('produz <ulid>-<user>.ack.json', () => {
    expect(buildAckFilename(VALID_ULID, VALID_USER)).toBe(`${VALID_ULID}-${VALID_USER}.ack.json`);
  });

  it('rejeita sprintId inválido', () => {
    expect(() => buildAckFilename('bad', VALID_USER)).toThrow();
  });

  it('rejeita userId inválido', () => {
    expect(() => buildAckFilename(VALID_ULID, 'BAD USER')).toThrow();
  });
});

describe('buildCancelFilename', () => {
  it('produz cancel-<ulid>.json', () => {
    expect(buildCancelFilename(VALID_ULID)).toBe(`cancel-${VALID_ULID}.json`);
  });

  it('rejeita sprintId inválido', () => {
    expect(() => buildCancelFilename('not-ulid')).toThrow();
  });
});

describe('parseFilename', () => {
  it('parseia pending', () => {
    const result = parseFilename(`${VALID_ULID}-${VALID_USER}.json`);
    expect(result).toEqual({ type: 'pending', sprintId: VALID_ULID, userId: VALID_USER });
  });

  it('parseia ack (distingue de pending mesmo com prefixo idêntico)', () => {
    const result = parseFilename(`${VALID_ULID}-${VALID_USER}.ack.json`);
    expect(result).toEqual({ type: 'ack', sprintId: VALID_ULID, userId: VALID_USER });
  });

  it('parseia cancel', () => {
    const result = parseFilename(`cancel-${VALID_ULID}.json`);
    expect(result).toEqual({ type: 'cancel', sprintId: VALID_ULID });
  });

  it('lança FilenameParseError em nome arbitrário', () => {
    expect(() => parseFilename('aleatorio.txt')).toThrow(FilenameParseError);
  });

  it('lança em string vazia', () => {
    expect(() => parseFilename('')).toThrow(FilenameParseError);
  });

  it('rejeita arquivos .tmp (escrita atômica) — não devem ser processados', () => {
    expect(() => parseFilename(`${VALID_ULID}-${VALID_USER}.json.tmp`)).toThrow();
    expect(() => parseFilename(`cancel-${VALID_ULID}.json.tmp`)).toThrow();
  });

  it('rejeita pending com userId inválido (uppercase)', () => {
    expect(() => parseFilename(`${VALID_ULID}-JOAO.json`)).toThrow();
  });

  it('rejeita pending com ULID inválido', () => {
    // 01HX9K2M4F8N7P2Q5R3S6T7U8W tem U no índice 23 — Crockford rejeita
    expect(() => parseFilename(`01HX9K2M4F8N7P2Q5R3S6T7U8W-${VALID_USER}.json`)).toThrow();
  });

  it('rejeita cancel sem ULID válido após o prefixo', () => {
    expect(() => parseFilename('cancel-NOTAULID.json')).toThrow();
  });

  it('FilenameParseError carrega o filename original', () => {
    try {
      parseFilename('lixo.txt');
      expect.fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(FilenameParseError);
      expect((err as FilenameParseError).filename).toBe('lixo.txt');
    }
  });
});

describe('safeParseFilename', () => {
  it('retorna { success: true, data } em nome válido', () => {
    const result = safeParseFilename(`${VALID_ULID}-${VALID_USER}.json`);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('pending');
    }
  });

  it('retorna { success: false, error } em nome inválido', () => {
    const result = safeParseFilename('lixo');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(FilenameParseError);
    }
  });
});

describe('round-trip build → parse', () => {
  it('pending: parseFilename(buildPendingFilename(a, b)) ≡ { pending, a, b }', () => {
    const name = buildPendingFilename(VALID_ULID, VALID_USER);
    const parsed = parseFilename(name);
    expect(parsed).toEqual({ type: 'pending', sprintId: VALID_ULID, userId: VALID_USER });
  });

  it('ack: parseFilename(buildAckFilename(a, b)) ≡ { ack, a, b }', () => {
    const name = buildAckFilename(VALID_ULID, VALID_USER);
    const parsed = parseFilename(name);
    expect(parsed).toEqual({ type: 'ack', sprintId: VALID_ULID, userId: VALID_USER });
  });

  it('cancel: parseFilename(buildCancelFilename(a)) ≡ { cancel, a }', () => {
    const name = buildCancelFilename(VALID_ULID);
    const parsed = parseFilename(name);
    expect(parsed).toEqual({ type: 'cancel', sprintId: VALID_ULID });
  });

  it('round-trip preserva userId com hífens e underscores', () => {
    const complexUser = 'joao_silva-01';
    const name = buildPendingFilename(VALID_ULID, complexUser);
    const parsed = parseFilename(name);
    expect(parsed).toEqual({
      type: 'pending',
      sprintId: VALID_ULID,
      userId: complexUser,
    });
  });
});
