import { describe, expect, it } from 'vitest';

import { ARCHIVE_DATE_REGEX, formatArchiveDate, isArchiveDateFolder } from './dates';

describe('formatArchiveDate', () => {
  it('formata um Date como YYYY-MM-DD em UTC', () => {
    // 2026-05-21T14:32:10Z → 2026-05-21
    const date = new Date('2026-05-21T14:32:10.000Z');
    expect(formatArchiveDate(date)).toBe('2026-05-21');
  });

  it('aceita timestamp em ms', () => {
    const ms = Date.parse('2026-05-21T14:32:10.000Z');
    expect(formatArchiveDate(ms)).toBe('2026-05-21');
  });

  it('usa UTC, não o fuso local (instante perto da meia-noite UTC)', () => {
    // 23:30Z continua sendo o mesmo dia UTC.
    expect(formatArchiveDate(new Date('2026-05-21T23:30:00.000Z'))).toBe('2026-05-21');
    // 00:30Z já é o dia seguinte em UTC.
    expect(formatArchiveDate(new Date('2026-05-22T00:30:00.000Z'))).toBe('2026-05-22');
  });

  it('resulta na mesma string para Date e seu ms equivalente', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(formatArchiveDate(date)).toBe(formatArchiveDate(date.getTime()));
  });

  it('lança RangeError para Date inválido', () => {
    expect(() => formatArchiveDate(new Date('not-a-date'))).toThrow(RangeError);
  });

  it('lança RangeError para timestamp NaN', () => {
    expect(() => formatArchiveDate(Number.NaN)).toThrow(RangeError);
  });
});

describe('isArchiveDateFolder', () => {
  it('aceita uma data válida YYYY-MM-DD', () => {
    expect(isArchiveDateFolder('2026-05-21')).toBe(true);
    expect(isArchiveDateFolder('2026-02-28')).toBe(true);
    expect(isArchiveDateFolder('2024-02-29')).toBe(true); // ano bissexto
  });

  it('rejeita o nome do log de limpeza (não é pasta de data)', () => {
    expect(isArchiveDateFolder('log-limpeza.txt')).toBe(false);
  });

  it('rejeita formatos não-YYYY-MM-DD', () => {
    expect(isArchiveDateFolder('2026-5-21')).toBe(false);
    expect(isArchiveDateFolder('21-05-2026')).toBe(false);
    expect(isArchiveDateFolder('2026/05/21')).toBe(false);
    expect(isArchiveDateFolder('')).toBe(false);
    expect(isArchiveDateFolder('2026-05-21T00:00:00')).toBe(false);
  });

  it('rejeita datas-calendário impossíveis mesmo com formato correto', () => {
    expect(isArchiveDateFolder('2026-13-40')).toBe(false);
    expect(isArchiveDateFolder('2026-02-30')).toBe(false);
    expect(isArchiveDateFolder('2025-02-29')).toBe(false); // 2025 não é bissexto
    expect(isArchiveDateFolder('2026-00-10')).toBe(false);
  });

  it('round-trip com formatArchiveDate é sempre uma pasta válida', () => {
    expect(isArchiveDateFolder(formatArchiveDate(new Date('2026-05-21T12:00:00Z')))).toBe(true);
  });

  it('ARCHIVE_DATE_REGEX casa exatamente o formato de data', () => {
    expect(ARCHIVE_DATE_REGEX.test('2026-05-21')).toBe(true);
    expect(ARCHIVE_DATE_REGEX.test('2026-05-21 ')).toBe(false);
  });
});
