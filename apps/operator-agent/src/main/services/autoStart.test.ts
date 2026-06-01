/**
 * Testes do auto-registro de auto-start (BL-C5-003, ADR-028).
 *
 * Cobre os helpers puros (`normalizeRunValue`, `parseRegQueryValue`) e o core
 * `ensureAutoStartRegistered` com um {@link RegistryRunAccessor} fake em
 * memória — sem tocar o registro real nem `reg.exe`.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  ensureAutoStartRegistered,
  normalizeRunValue,
  parseRegQueryValue,
  type RegistryRunAccessor,
} from './autoStart';

const VALUE_NAME = 'Metas - Desenhistas';
const EXE_PATH = 'C:\\Program Files\\Metas - Desenhistas\\Metas - Desenhistas.exe';
const QUOTED_EXE = `"${EXE_PATH}"`;

/** Accessor fake em memória — registra chamadas para asserções. */
function makeFakeAccessor(initial: string | null = null): RegistryRunAccessor & {
  store: { value: string | null };
  writes: string[];
} {
  const store = { value: initial };
  const writes: string[] = [];
  return {
    store,
    writes,
    readValue: vi.fn(() => Promise.resolve(store.value)),
    writeValue: vi.fn((_name: string, data: string) => {
      store.value = data;
      writes.push(data);
      return Promise.resolve();
    }),
  };
}

describe('normalizeRunValue', () => {
  it('remove aspas externas, faz trim e lowercase', () => {
    expect(normalizeRunValue(QUOTED_EXE)).toBe(EXE_PATH.toLowerCase());
  });

  it('trata caminho sem aspas como equivalente ao com aspas', () => {
    expect(normalizeRunValue(QUOTED_EXE)).toBe(normalizeRunValue(EXE_PATH));
  });

  it('ignora diferença de caixa', () => {
    expect(normalizeRunValue('"C:\\App\\X.EXE"')).toBe(normalizeRunValue('c:\\app\\x.exe'));
  });
});

describe('parseRegQueryValue', () => {
  const stdout = [
    '',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    `    Metas - Desenhistas    REG_SZ    ${QUOTED_EXE}`,
    '    OutroApp    REG_SZ    "C:\\Outro\\app.exe"',
    '',
  ].join('\r\n');

  it('extrai o dado de um valor com espaços no nome', () => {
    expect(parseRegQueryValue(stdout, 'Metas - Desenhistas')).toBe(QUOTED_EXE);
  });

  it('extrai outros valores da mesma chave', () => {
    expect(parseRegQueryValue(stdout, 'OutroApp')).toBe('"C:\\Outro\\app.exe"');
  });

  it('retorna null quando o valor não está presente', () => {
    expect(parseRegQueryValue(stdout, 'Inexistente')).toBeNull();
  });

  it('retorna null para saída vazia', () => {
    expect(parseRegQueryValue('', VALUE_NAME)).toBeNull();
  });
});

describe('ensureAutoStartRegistered', () => {
  it('não faz nada fora de Windows (unsupported-platform)', async () => {
    const accessor = makeFakeAccessor();
    const outcome = await ensureAutoStartRegistered({
      accessor,
      valueName: VALUE_NAME,
      exePath: EXE_PATH,
      platform: 'linux',
    });
    expect(outcome).toBe('unsupported-platform');
    expect(accessor.readValue).not.toHaveBeenCalled();
    expect(accessor.writeValue).not.toHaveBeenCalled();
  });

  it('registra quando a entrada está ausente', async () => {
    const accessor = makeFakeAccessor(null);
    const outcome = await ensureAutoStartRegistered({
      accessor,
      valueName: VALUE_NAME,
      exePath: EXE_PATH,
      platform: 'win32',
    });
    expect(outcome).toBe('registered');
    expect(accessor.writes).toEqual([QUOTED_EXE]);
  });

  it('é idempotente quando a entrada já aponta para o exe (com aspas)', async () => {
    const accessor = makeFakeAccessor(QUOTED_EXE);
    const outcome = await ensureAutoStartRegistered({
      accessor,
      valueName: VALUE_NAME,
      exePath: EXE_PATH,
      platform: 'win32',
    });
    expect(outcome).toBe('already-registered');
    expect(accessor.writeValue).not.toHaveBeenCalled();
  });

  it('é idempotente mesmo se a entrada estiver sem aspas / outra caixa', async () => {
    const accessor = makeFakeAccessor(EXE_PATH.toLowerCase());
    const outcome = await ensureAutoStartRegistered({
      accessor,
      valueName: VALUE_NAME,
      exePath: EXE_PATH,
      platform: 'win32',
    });
    expect(outcome).toBe('already-registered');
    expect(accessor.writeValue).not.toHaveBeenCalled();
  });

  it('atualiza quando a entrada aponta para outro caminho', async () => {
    const accessor = makeFakeAccessor('"C:\\Old\\Sprint Operator Agent.exe"');
    const outcome = await ensureAutoStartRegistered({
      accessor,
      valueName: VALUE_NAME,
      exePath: EXE_PATH,
      platform: 'win32',
    });
    expect(outcome).toBe('updated');
    expect(accessor.writes).toEqual([QUOTED_EXE]);
  });

  it('é não-fatal quando o accessor lança (error)', async () => {
    const accessor: RegistryRunAccessor = {
      readValue: vi.fn(() => Promise.reject(new Error('reg falhou'))),
      writeValue: vi.fn(() => Promise.resolve()),
    };
    const warn = vi.fn();
    const outcome = await ensureAutoStartRegistered({
      accessor,
      valueName: VALUE_NAME,
      exePath: EXE_PATH,
      platform: 'win32',
      log: { warn },
    });
    expect(outcome).toBe('error');
    expect(warn).toHaveBeenCalledOnce();
  });
});
