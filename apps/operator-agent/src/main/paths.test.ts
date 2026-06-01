/**
 * Testes da resolução do data root do Agent (ADR-028, BL-C5-006).
 *
 * Cobre a precedência override → ProgramData (win32) → userData (fallback) e a
 * criação idempotente das subpastas. `process.platform` é stubado por teste.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LOCAL_DIRS } from '@sprint/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: (key: string): string => {
      if (key === 'userData') return '/mock/userData';
      throw new Error(`Mock app.getPath não suporta: ${key}`);
    },
  },
}));

import { APP_DATA_DIR_NAME } from '../shared/branding';

import {
  DATA_DIR_ENV_OVERRIDE,
  ensureAgentDataDirs,
  getAgentDataDir,
  getHistoryDir,
  getLogsDir,
} from './paths';

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_PROGRAMDATA = process.env.PROGRAMDATA;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

beforeEach(() => {
  delete process.env[DATA_DIR_ENV_OVERRIDE];
});

afterEach(() => {
  setPlatform(ORIGINAL_PLATFORM);
  delete process.env[DATA_DIR_ENV_OVERRIDE];
  if (ORIGINAL_PROGRAMDATA === undefined) {
    delete process.env.PROGRAMDATA;
  } else {
    process.env.PROGRAMDATA = ORIGINAL_PROGRAMDATA;
  }
});

describe('getAgentDataDir', () => {
  it('o override de env tem precedência absoluta', () => {
    setPlatform('win32');
    process.env[DATA_DIR_ENV_OVERRIDE] = '/tmp/custom-data';
    expect(getAgentDataDir()).toBe('/tmp/custom-data');
  });

  it('em win32 (sem override) resolve C:\\ProgramData\\<APP_DATA_DIR_NAME>', () => {
    setPlatform('win32');
    process.env.PROGRAMDATA = 'C:\\ProgramData';
    expect(getAgentDataDir()).toBe(path.join('C:\\ProgramData', APP_DATA_DIR_NAME));
  });

  it('em win32 com %PROGRAMDATA% ausente usa o fallback C:\\ProgramData', () => {
    setPlatform('win32');
    delete process.env.PROGRAMDATA;
    expect(getAgentDataDir()).toBe(path.join('C:\\ProgramData', APP_DATA_DIR_NAME));
  });

  it('fora de win32 (sem override) cai para app.getPath(userData)', () => {
    setPlatform('linux');
    expect(getAgentDataDir()).toBe('/mock/userData');
  });
});

describe('getHistoryDir / getLogsDir', () => {
  it('compõem historico/ e logs/ sob o data root', () => {
    process.env[DATA_DIR_ENV_OVERRIDE] = '/data/root';
    expect(getHistoryDir()).toBe(path.join('/data/root', LOCAL_DIRS.HISTORY));
    expect(getLogsDir()).toBe(path.join('/data/root', LOCAL_DIRS.LOGS));
  });
});

describe('ensureAgentDataDirs', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-paths-'));
    process.env[DATA_DIR_ENV_OVERRIDE] = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('cria historico/ e logs/ (idempotente)', async () => {
    await ensureAgentDataDirs();
    await ensureAgentDataDirs(); // 2ª vez não deve lançar
    const entries = await fs.readdir(tmpDir);
    expect(entries).toContain(LOCAL_DIRS.HISTORY);
    expect(entries).toContain(LOCAL_DIRS.LOGS);
  });
});
