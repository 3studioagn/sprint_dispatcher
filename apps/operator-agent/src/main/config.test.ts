import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigError,
  ConfigInvalidError,
  ConfigJsonError,
  ConfigNotFoundError,
  ConfigReadError,
  getConfigPath,
  loadAgentConfig,
} from './config';

// Diretório temp do teste. O nome começa com `mock` para o hoisting de
// vi.mock do vitest aceitar referenciá-lo dentro da factory.
const mockTmpRoot = path.join(os.tmpdir(), `sprint-agent-test-${Date.now()}`);

vi.mock('electron', () => ({
  app: {
    getPath: (key: string): string => {
      if (key === 'userData') return mockTmpRoot;
      throw new Error(`Mock app.getPath não suporta: ${key}`);
    },
  },
}));

const configFile = path.join(mockTmpRoot, 'config.json');

const VALID_CONFIG_OBJECT = {
  schema_version: '1.0',
  user_id: 'joao',
  user_nome_exibicao: 'João Silva',
  hostname: 'ART-DESIGN-04',
  shared_path: '\\\\servidor\\sprint-dispatcher',
  polling_interval_seconds: 3,
  som_notificacao: true,
  log_level: 'info',
};

describe('getConfigPath', () => {
  it('retorna o path absoluto baseado em userData', () => {
    expect(getConfigPath()).toBe(configFile);
  });
});

describe('loadAgentConfig', () => {
  beforeEach(async () => {
    await fs.mkdir(mockTmpRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(mockTmpRoot, { recursive: true, force: true });
  });

  it('carrega um config válido', async () => {
    await fs.writeFile(configFile, JSON.stringify(VALID_CONFIG_OBJECT), 'utf-8');
    const config = await loadAgentConfig();
    expect(config.hostname).toBe('ART-DESIGN-04');
    expect(config.user_nome_exibicao).toBe('João Silva');
    expect(config.polling_interval_seconds).toBe(3);
  });

  it('lança ConfigNotFoundError se o arquivo não existe', async () => {
    await expect(loadAgentConfig()).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it('ConfigNotFoundError carrega o configPath correto', async () => {
    await expect(loadAgentConfig()).rejects.toMatchObject({
      name: 'ConfigNotFoundError',
      configPath: configFile,
    });
  });

  it('lança ConfigReadError em erro de I/O que não é "não existe"', async () => {
    // config.json criado como diretório → fs.readFile falha com EISDIR
    // (código distinto de ENOENT).
    await fs.mkdir(configFile, { recursive: true });
    await expect(loadAgentConfig()).rejects.toBeInstanceOf(ConfigReadError);
  });

  it('lança ConfigJsonError se o conteúdo não é JSON válido', async () => {
    await fs.writeFile(configFile, '{ broken json', 'utf-8');
    await expect(loadAgentConfig()).rejects.toBeInstanceOf(ConfigJsonError);
  });

  it('lança ConfigInvalidError se o schema é violado', async () => {
    const invalid = { ...VALID_CONFIG_OBJECT, user_id: '' };
    await fs.writeFile(configFile, JSON.stringify(invalid), 'utf-8');
    await expect(loadAgentConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError se um campo essencial falta', async () => {
    const { user_id: _omit, ...incomplete } = VALID_CONFIG_OBJECT;
    await fs.writeFile(configFile, JSON.stringify(incomplete), 'utf-8');
    await expect(loadAgentConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError se há campo extra (schema strict)', async () => {
    const withExtra = { ...VALID_CONFIG_OBJECT, malicious: 'extra' };
    await fs.writeFile(configFile, JSON.stringify(withExtra), 'utf-8');
    await expect(loadAgentConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('ConfigInvalidError.cause é um ContractValidationError', async () => {
    await fs.writeFile(configFile, JSON.stringify({ schema_version: '1.0' }), 'utf-8');
    let caught: unknown;
    try {
      await loadAgentConfig();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigInvalidError);
    const invalid = caught as ConfigInvalidError;
    expect(invalid.cause.constructor.name).toBe('ContractValidationError');
    expect(invalid.cause.issues.length).toBeGreaterThan(0);
  });

  it('todos os ConfigError concretos estendem o ConfigError abstrato', () => {
    expect(new ConfigNotFoundError('x')).toBeInstanceOf(ConfigError);
    expect(new ConfigJsonError('x', new Error('y'))).toBeInstanceOf(ConfigError);
    expect(new ConfigReadError('x', new Error('y'))).toBeInstanceOf(ConfigError);
  });

  it('aplica os defaults do schema (polling_interval_seconds ausente)', async () => {
    const { polling_interval_seconds: _omit, ...partial } = VALID_CONFIG_OBJECT;
    await fs.writeFile(configFile, JSON.stringify(partial), 'utf-8');
    const config = await loadAgentConfig();
    expect(config.polling_interval_seconds).toBeGreaterThan(0);
  });

  it('aplica os defaults do schema (log_level ausente)', async () => {
    const { log_level: _omit, ...partial } = VALID_CONFIG_OBJECT;
    await fs.writeFile(configFile, JSON.stringify(partial), 'utf-8');
    const config = await loadAgentConfig();
    expect(config.log_level).toBe('info');
  });
});
