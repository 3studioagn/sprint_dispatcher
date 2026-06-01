/**
 * Testes do loader de config do Agent (W1).
 *
 * Aponta o data root (ADR-028) para um tmp dir único da run via a env
 * `SPRINT_AGENT_DATA_DIR` — `getConfigPath()` resolve `<tmp>/config.json`
 * independente da plataforma. Cada teste cria/destrói o config dentro desse
 * tmp. O `shared_path` aponta para outro tmp dir por conveniência, mas a
 * partir de ADR-027 o loader NÃO valida mais a acessibilidade do `shared_path`
 * (virou condição de runtime da máquina de reconexão).
 *
 * Cobertura alvo: 100% lines/branches/funcs em `config.ts`.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigError,
  ConfigInaccessibleError,
  ConfigInvalidError,
  ConfigNotFoundError,
  DEFAULT_MINIMIZE_AFTER_SECONDS,
  getConfigPath,
  loadConfig,
} from './config';

// Nomes começam com `mock` para o hoisting de `vi.mock` aceitar
// referenciá-los na factory (CLAUDE.md G-015).
const mockTmpRoot = path.join(os.tmpdir(), `sprint-agent-config-${Date.now()}`);
const mockUserDataDir = path.join(mockTmpRoot, 'userData');
const mockSharedDir = path.join(mockTmpRoot, 'shared');

vi.mock('electron', () => ({
  app: {
    getPath: (key: string): string => {
      if (key === 'userData') return mockUserDataDir;
      throw new Error(`Mock app.getPath não suporta: ${key}`);
    },
  },
}));

const configFile = path.join(mockUserDataDir, 'config.json');

const VALID_CONFIG: Record<string, unknown> = {
  schema_version: '1.0',
  user_id: 'joao',
  user_nome_exibicao: 'João Silva',
  hostname: 'ART-DESIGN-04',
  shared_path: mockSharedDir, // populado em beforeAll para path real
  polling_interval_seconds: 3,
  som_notificacao: true,
  log_level: 'info',
};

beforeAll(async () => {
  // ADR-028: o data root resolve via getAgentDataDir(); o override de env
  // aponta para o tmp da run — determinístico, sem tocar o ProgramData real
  // nem depender da plataforma do runner (win32 vs CI Linux).
  process.env.SPRINT_AGENT_DATA_DIR = mockUserDataDir;
  // shared_path real (diretório). A partir de ADR-027 o loader NÃO valida mais
  // a acessibilidade do shared_path; mantido por conveniência das fixtures.
  await fs.mkdir(mockSharedDir, { recursive: true });
});

afterAll(() => {
  delete process.env.SPRINT_AGENT_DATA_DIR;
});

beforeEach(async () => {
  await fs.mkdir(mockUserDataDir, { recursive: true });
});

afterEach(async () => {
  // Remove só o userData entre testes — shared persiste pra todos.
  await fs.rm(mockUserDataDir, { recursive: true, force: true });
});

describe('getConfigPath', () => {
  it('retorna o caminho absoluto baseado em userData', () => {
    expect(getConfigPath()).toBe(configFile);
  });
});

describe('loadConfig — cenários OK', () => {
  it('carrega um config válido e converte segundos→millis', async () => {
    await fs.writeFile(configFile, JSON.stringify(VALID_CONFIG), 'utf-8');
    const rt = await loadConfig();
    expect(rt.userId).toBe('joao');
    expect(rt.userNomeExibicao).toBe('João Silva');
    expect(rt.hostname).toBe('ART-DESIGN-04');
    expect(rt.sharedPath).toBe(mockSharedDir);
    expect(rt.pollingIntervalMs).toBe(3000); // 3s * 1000
    expect(rt.minimizeAfterMs).toBe(DEFAULT_MINIMIZE_AFTER_SECONDS * 1000); // default 30s
  });

  it('aplica default de polling_interval_seconds do schema (faltando)', async () => {
    const { polling_interval_seconds: _omit, ...partial } = VALID_CONFIG;
    await fs.writeFile(configFile, JSON.stringify(partial), 'utf-8');
    const rt = await loadConfig();
    expect(rt.pollingIntervalMs).toBeGreaterThan(0);
  });

  it('respeita minimize_after_seconds custom (campo W1-extra)', async () => {
    const withMinimize = { ...VALID_CONFIG, minimize_after_seconds: 15 };
    await fs.writeFile(configFile, JSON.stringify(withMinimize), 'utf-8');
    const rt = await loadConfig();
    expect(rt.minimizeAfterMs).toBe(15 * 1000);
  });

  it('aceita minimize_after_seconds no limite inferior (1s)', async () => {
    const min = { ...VALID_CONFIG, minimize_after_seconds: 1 };
    await fs.writeFile(configFile, JSON.stringify(min), 'utf-8');
    const rt = await loadConfig();
    expect(rt.minimizeAfterMs).toBe(1000);
  });

  it('aceita minimize_after_seconds no limite superior (300s)', async () => {
    const max = { ...VALID_CONFIG, minimize_after_seconds: 300 };
    await fs.writeFile(configFile, JSON.stringify(max), 'utf-8');
    const rt = await loadConfig();
    expect(rt.minimizeAfterMs).toBe(300 * 1000);
  });
});

describe('loadConfig — NOT_FOUND', () => {
  it('lança ConfigNotFoundError se o arquivo não existe', async () => {
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it('ConfigNotFoundError carrega o configPath e o code', async () => {
    await expect(loadConfig()).rejects.toMatchObject({
      name: 'ConfigNotFoundError',
      code: 'NOT_FOUND',
      configPath: configFile,
    });
  });
});

describe('loadConfig — INVALID', () => {
  it('lança ConfigInvalidError em JSON malformado', async () => {
    await fs.writeFile(configFile, '{ broken json', 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError se o JSON é primitivo (não objeto)', async () => {
    await fs.writeFile(configFile, '"just a string"', 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError se o JSON é array', async () => {
    await fs.writeFile(configFile, '[]', 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em schema violado (user_id vazio)', async () => {
    const invalid = { ...VALID_CONFIG, user_id: '' };
    await fs.writeFile(configFile, JSON.stringify(invalid), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em campo obrigatório faltando', async () => {
    const { user_id: _omit, ...incomplete } = VALID_CONFIG;
    await fs.writeFile(configFile, JSON.stringify(incomplete), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em campo extra desconhecido (strict)', async () => {
    const withExtra = { ...VALID_CONFIG, malicious: 'extra' };
    await fs.writeFile(configFile, JSON.stringify(withExtra), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em minimize_after_seconds < 1', async () => {
    const bad = { ...VALID_CONFIG, minimize_after_seconds: 0 };
    await fs.writeFile(configFile, JSON.stringify(bad), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em minimize_after_seconds > 300', async () => {
    const bad = { ...VALID_CONFIG, minimize_after_seconds: 301 };
    await fs.writeFile(configFile, JSON.stringify(bad), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em minimize_after_seconds não-inteiro', async () => {
    const bad = { ...VALID_CONFIG, minimize_after_seconds: 15.5 };
    await fs.writeFile(configFile, JSON.stringify(bad), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('lança ConfigInvalidError em minimize_after_seconds não-numérico', async () => {
    const bad = { ...VALID_CONFIG, minimize_after_seconds: 'trinta' };
    await fs.writeFile(configFile, JSON.stringify(bad), 'utf-8');
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInvalidError);
  });
});

describe('loadConfig — INACCESSIBLE (apenas I/O do próprio config.json)', () => {
  it('lança ConfigInaccessibleError em I/O EISDIR (config.json é diretório)', async () => {
    // Remove o tmp do beforeEach e cria como diretório para forçar EISDIR
    await fs.rm(configFile, { force: true });
    await fs.mkdir(configFile, { recursive: true });
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigInaccessibleError);
    await fs.rmdir(configFile);
  });
});

describe('loadConfig — boot resiliente: shared_path NÃO é validado (ADR-027)', () => {
  // BL-C3-013: a acessibilidade da pasta compartilhada virou condição de
  // runtime (máquina de reconexão do PollingService). loadConfig não deve
  // mais falhar por shared_path inexistente/inacessível — o Agent sobe e
  // tenta reconectar com backoff (RNF-07).
  it('carrega normalmente mesmo com shared_path inexistente', async () => {
    const cfg = { ...VALID_CONFIG, shared_path: path.join(mockTmpRoot, 'nao-existe-no-boot') };
    await fs.writeFile(configFile, JSON.stringify(cfg), 'utf-8');
    const rt = await loadConfig();
    expect(rt.sharedPath).toBe(path.join(mockTmpRoot, 'nao-existe-no-boot'));
  });

  it('carrega normalmente mesmo se shared_path aponta para um arquivo', async () => {
    const filePath = path.join(mockTmpRoot, 'not-a-dir.txt');
    await fs.writeFile(filePath, 'hello', 'utf-8');
    const cfg = { ...VALID_CONFIG, shared_path: filePath };
    await fs.writeFile(configFile, JSON.stringify(cfg), 'utf-8');
    const rt = await loadConfig();
    expect(rt.sharedPath).toBe(filePath);
    await fs.rm(filePath, { force: true });
  });
});

describe('loadConfig — som_notificacao (BL-C3-014)', () => {
  it('propaga som_notificacao=true do config', async () => {
    await fs.writeFile(
      configFile,
      JSON.stringify({ ...VALID_CONFIG, som_notificacao: true }),
      'utf-8',
    );
    const rt = await loadConfig();
    expect(rt.somNotificacao).toBe(true);
  });

  it('propaga som_notificacao=false do config', async () => {
    await fs.writeFile(
      configFile,
      JSON.stringify({ ...VALID_CONFIG, som_notificacao: false }),
      'utf-8',
    );
    const rt = await loadConfig();
    expect(rt.somNotificacao).toBe(false);
  });

  it('aplica o default true do schema quando o campo está ausente', async () => {
    const { som_notificacao: _omit, ...partial } = VALID_CONFIG;
    await fs.writeFile(configFile, JSON.stringify(partial), 'utf-8');
    const rt = await loadConfig();
    expect(rt.somNotificacao).toBe(true);
  });
});

describe('loadConfig — hierarquia de erros', () => {
  it('todas as subclasses estendem ConfigError abstrato', () => {
    expect(new ConfigNotFoundError('x')).toBeInstanceOf(ConfigError);
    expect(new ConfigInvalidError('x', new Error('y'))).toBeInstanceOf(ConfigError);
    expect(new ConfigInaccessibleError('x', 'y')).toBeInstanceOf(ConfigError);
  });

  it('cada subclasse expõe o code correto', () => {
    expect(new ConfigNotFoundError('x').code).toBe('NOT_FOUND');
    expect(new ConfigInvalidError('x', new Error('y')).code).toBe('INVALID');
    expect(new ConfigInaccessibleError('x', 'y').code).toBe('INACCESSIBLE');
  });

  it('ConfigInaccessibleError aceita cause opcional', () => {
    const err = new ConfigInaccessibleError('x', 'y');
    expect(err.cause).toBeUndefined();
    const err2 = new ConfigInaccessibleError('x', 'y', new Error('boom'));
    expect(err2.cause).toBeInstanceOf(Error);
  });
});
