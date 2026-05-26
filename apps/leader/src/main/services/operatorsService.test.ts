// @vitest-environment node
import { MemoryFilesystemAdapter } from '@sprint/fs-adapter';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  OperatorsFileInvalidError,
  OperatorsFileNotFoundError,
  OperatorsService,
} from './operatorsService';

const SHARED = '/shared';
const OPERATORS_PATH = `${SHARED}/operators.json`;

const VALID_OPERATORS = {
  operators: [
    { user_id: 'joao', user_nome_exibicao: 'João Silva', hostname: 'PC-04', ativo: true },
    { user_id: 'mario', user_nome_exibicao: 'Mario Souza', hostname: 'PC-05', ativo: true },
    { user_id: 'rafael', user_nome_exibicao: 'Rafael Costa', hostname: 'PC-08', ativo: false },
  ],
};

let adapter: MemoryFilesystemAdapter;
let service: OperatorsService;

beforeEach(() => {
  adapter = new MemoryFilesystemAdapter();
  service = new OperatorsService(adapter, SHARED);
});

describe('OperatorsService.list — happy path', () => {
  it('retorna a lista completa quando arquivo é válido', async () => {
    adapter.seed({ [OPERATORS_PATH]: JSON.stringify(VALID_OPERATORS) });
    const response = await service.list();
    expect(response.operators).toHaveLength(3);
    expect(response.operators[0]?.user_id).toBe('joao');
  });

  it('NÃO filtra ativo:false — retorna todos os operadores', async () => {
    adapter.seed({ [OPERATORS_PATH]: JSON.stringify(VALID_OPERATORS) });
    const response = await service.list();
    expect(response.operators.some((op) => op.ativo === false)).toBe(true);
  });

  it('source aponta para filepath absoluto', async () => {
    adapter.seed({ [OPERATORS_PATH]: JSON.stringify(VALID_OPERATORS) });
    const response = await service.list();
    expect(response.source).toBe(OPERATORS_PATH);
  });

  it('lastModified é ISO datetime', async () => {
    adapter.seed({ [OPERATORS_PATH]: JSON.stringify(VALID_OPERATORS) });
    const response = await service.list();
    expect(response.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('aceita array vazio (zero operadores)', async () => {
    adapter.seed({ [OPERATORS_PATH]: JSON.stringify({ operators: [] }) });
    const response = await service.list();
    expect(response.operators).toHaveLength(0);
  });
});

describe('OperatorsService.list — file errors', () => {
  it('lança OperatorsFileNotFoundError quando arquivo ausente', async () => {
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileNotFoundError);
  });

  it('OperatorsFileNotFoundError carrega filepath esperado', async () => {
    try {
      await service.list();
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(OperatorsFileNotFoundError);
      expect((err as OperatorsFileNotFoundError).filepath).toBe(OPERATORS_PATH);
    }
  });

  it('lança OperatorsFileInvalidError quando JSON malformado', async () => {
    adapter.seed({ [OPERATORS_PATH]: '{ not valid json' });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });
});

describe('OperatorsService.list — schema errors', () => {
  it('lança OperatorsFileInvalidError quando estrutura raiz errada (sem operators)', async () => {
    adapter.seed({ [OPERATORS_PATH]: JSON.stringify({ ops: [] }) });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });

  it('lança OperatorsFileInvalidError quando campo extra na raiz (.strict)', async () => {
    adapter.seed({
      [OPERATORS_PATH]: JSON.stringify({ operators: [], extra: 'campo' }),
    });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });

  it('lança OperatorsFileInvalidError quando user_id inválido (uppercase)', async () => {
    adapter.seed({
      [OPERATORS_PATH]: JSON.stringify({
        operators: [{ user_id: 'JOAO', user_nome_exibicao: 'X', hostname: 'PC', ativo: true }],
      }),
    });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });

  it('lança OperatorsFileInvalidError quando user_nome_exibicao vazio', async () => {
    adapter.seed({
      [OPERATORS_PATH]: JSON.stringify({
        operators: [{ user_id: 'joao', user_nome_exibicao: '', hostname: 'PC', ativo: true }],
      }),
    });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });

  it('lança OperatorsFileInvalidError quando ativo não-boolean', async () => {
    adapter.seed({
      [OPERATORS_PATH]: JSON.stringify({
        operators: [{ user_id: 'joao', user_nome_exibicao: 'João', hostname: 'PC', ativo: 'sim' }],
      }),
    });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });

  it('lança OperatorsFileInvalidError quando operador tem campo extra', async () => {
    adapter.seed({
      [OPERATORS_PATH]: JSON.stringify({
        operators: [
          {
            user_id: 'joao',
            user_nome_exibicao: 'João',
            hostname: 'PC',
            ativo: true,
            extra: 'x',
          },
        ],
      }),
    });
    await expect(service.list()).rejects.toBeInstanceOf(OperatorsFileInvalidError);
  });

  it('OperatorsFileInvalidError carrega cause original', async () => {
    adapter.seed({ [OPERATORS_PATH]: '{ broken' });
    try {
      await service.list();
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(OperatorsFileInvalidError);
      expect((err as OperatorsFileInvalidError).cause).toBeInstanceOf(Error);
      expect((err as OperatorsFileInvalidError).filepath).toBe(OPERATORS_PATH);
    }
  });
});
