// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// G-015: factory do `vi.mock` é hoisted; variáveis externas precisam ser
// prefixadas com `mock`. `mockUserDataDir` é avaliado lazily na 1ª importação
// do módulo `electron` — `path.join` + `os.tmpdir` já estarão prontos.
const mockUserDataDir = path.join(
  os.tmpdir(),
  `leader-config-test-${String(Date.now())}-${String(Math.floor(Math.random() * 1e9))}`,
);

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') {
        throw new Error(`Unexpected getPath: ${name}`);
      }
      return mockUserDataDir;
    },
  },
}));

import {
  ConfigJsonError,
  ConfigNotFoundError,
  ConfigReadError,
  ConfigSchemaError,
  getConfigPath,
  loadLeaderConfig,
  SharedPathInaccessibleError,
} from './config';

let sharedDir: string;

beforeEach(async () => {
  await mkdir(mockUserDataDir, { recursive: true });
  sharedDir = await mkdtemp(path.join(os.tmpdir(), 'leader-shared-'));
});

afterEach(async () => {
  await rm(mockUserDataDir, { recursive: true, force: true });
  await rm(sharedDir, { recursive: true, force: true });
});

describe('loadLeaderConfig — happy path', () => {
  it('retorna config válido quando arquivo e shared_path estão OK', async () => {
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: sharedDir, criado_por: 'Renan' }),
      'utf-8',
    );
    const config = await loadLeaderConfig();
    expect(config).toEqual({ shared_path: sharedDir, criado_por: 'Renan' });
  });
});

describe('loadLeaderConfig — file errors', () => {
  it('lança ConfigNotFoundError quando arquivo ausente', async () => {
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it('ConfigNotFoundError carrega configPath e code NOT_FOUND', async () => {
    try {
      await loadLeaderConfig();
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigNotFoundError);
      expect((err as ConfigNotFoundError).configPath).toBe(getConfigPath());
      expect((err as ConfigNotFoundError).code).toBe('NOT_FOUND');
    }
  });

  it('lança ConfigJsonError quando JSON malformado', async () => {
    await writeFile(getConfigPath(), '{ not valid json', 'utf-8');
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigJsonError);
  });

  it('ConfigJsonError carrega code JSON_INVALID', async () => {
    await writeFile(getConfigPath(), 'totalmente quebrado', 'utf-8');
    try {
      await loadLeaderConfig();
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigJsonError);
      expect((err as ConfigJsonError).code).toBe('JSON_INVALID');
    }
  });

  it('lança ConfigReadError quando path é diretório (EISDIR)', async () => {
    await mkdir(getConfigPath(), { recursive: true });
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigReadError);
  });
});

describe('loadLeaderConfig — schema errors', () => {
  it('lança ConfigSchemaError quando shared_path faltando', async () => {
    await writeFile(getConfigPath(), JSON.stringify({ criado_por: 'Renan' }), 'utf-8');
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigSchemaError);
  });

  it('lança ConfigSchemaError quando criado_por faltando', async () => {
    await writeFile(getConfigPath(), JSON.stringify({ shared_path: sharedDir }), 'utf-8');
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigSchemaError);
  });

  it('lança ConfigSchemaError quando criado_por vazio', async () => {
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: sharedDir, criado_por: '' }),
      'utf-8',
    );
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigSchemaError);
  });

  it('lança ConfigSchemaError quando criado_por > 100 chars', async () => {
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: sharedDir, criado_por: 'x'.repeat(101) }),
      'utf-8',
    );
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigSchemaError);
  });

  it('lança ConfigSchemaError quando campo extra (.strict)', async () => {
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: sharedDir, criado_por: 'Renan', extra: 'campo' }),
      'utf-8',
    );
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigSchemaError);
  });

  it('lança ConfigSchemaError quando shared_path vazio', async () => {
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: '', criado_por: 'Renan' }),
      'utf-8',
    );
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(ConfigSchemaError);
  });

  it('ConfigSchemaError carrega code SCHEMA_INVALID', async () => {
    await writeFile(getConfigPath(), JSON.stringify({}), 'utf-8');
    try {
      await loadLeaderConfig();
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigSchemaError);
      expect((err as ConfigSchemaError).code).toBe('SCHEMA_INVALID');
    }
  });
});

describe('loadLeaderConfig — shared_path errors', () => {
  it('lança SharedPathInaccessibleError quando shared_path inexistente', async () => {
    const fake = path.join(os.tmpdir(), `nao-existe-${String(Date.now())}`);
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: fake, criado_por: 'Renan' }),
      'utf-8',
    );
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(SharedPathInaccessibleError);
  });

  it('lança SharedPathInaccessibleError quando shared_path é arquivo', async () => {
    const filePath = path.join(sharedDir, 'arquivo.txt');
    await writeFile(filePath, 'conteudo', 'utf-8');
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: filePath, criado_por: 'Renan' }),
      'utf-8',
    );
    await expect(loadLeaderConfig()).rejects.toBeInstanceOf(SharedPathInaccessibleError);
  });

  it('SharedPathInaccessibleError carrega sharedPath, configPath e code', async () => {
    const fake = path.join(
      os.tmpdir(),
      `nao-existe-${String(Date.now())}-${String(Math.floor(Math.random() * 1e9))}`,
    );
    await writeFile(
      getConfigPath(),
      JSON.stringify({ shared_path: fake, criado_por: 'Renan' }),
      'utf-8',
    );
    try {
      await loadLeaderConfig();
      expect.unreachable('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(SharedPathInaccessibleError);
      expect((err as SharedPathInaccessibleError).sharedPath).toBe(fake);
      expect((err as SharedPathInaccessibleError).configPath).toBe(getConfigPath());
      expect((err as SharedPathInaccessibleError).code).toBe('SHARED_PATH_INACCESSIBLE');
    }
  });
});

describe('getConfigPath', () => {
  it('retorna caminho dentro de userData', () => {
    const p = getConfigPath();
    expect(p).toBe(path.join(mockUserDataDir, 'config.json'));
  });
});
