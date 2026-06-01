/**
 * Testes específicos por adapter para `probeWritePermission` (BL-C2-012).
 *
 * A paridade do caso positivo (diretório gravável → `true`) vive na suite
 * de contrato compartilhada. Aqui ficam os casos que **não** têm paridade
 * natural entre os adapters:
 *
 * - **Node:** exercita o FS real — diretório pai inexistente → `false`.
 *   (No Memory, `writeFileAtomic` cria diretórios implícitos, então o
 *   mesmo cenário daria `true`.)
 * - **Memory:** o override configurável (`setProbeWritePermission`) que
 *   simula um share sem permissão sem precisar de FS real — usado pelos
 *   testes do gate de dispatch do Leader.
 */
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { MemoryFilesystemAdapter } from '../memory-adapter';
import { NodeFilesystemAdapter } from '../node-adapter';

describe('NodeFilesystemAdapter.probeWritePermission', () => {
  const created: string[] = [];

  afterEach(async () => {
    await Promise.all(created.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    created.length = 0;
  });

  it('retorna true em diretório real gravável', async () => {
    const adapter = new NodeFilesystemAdapter();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-probe-'));
    created.push(dir);
    expect(await adapter.probeWritePermission(dir)).toBe(true);
  });

  it('retorna false quando o diretório (pai) não existe', async () => {
    const adapter = new NodeFilesystemAdapter();
    // Pai inexistente → open(wx) falha com ENOENT → false (sem lançar).
    const missing = path.join(
      os.tmpdir(),
      `fs-probe-missing-${randomBytes(6).toString('hex')}`,
      'sub',
    );
    expect(await adapter.probeWritePermission(missing)).toBe(false);
  });

  it('não deixa arquivo de probe no diretório (cleanup)', async () => {
    const adapter = new NodeFilesystemAdapter();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-probe-'));
    created.push(dir);
    await adapter.probeWritePermission(dir);
    const entries = await fs.readdir(dir);
    expect(entries).toEqual([]);
  });
});

describe('MemoryFilesystemAdapter.probeWritePermission', () => {
  it('override false força "sem permissão"', async () => {
    const adapter = new MemoryFilesystemAdapter();
    adapter.setProbeWritePermission(false);
    expect(await adapter.probeWritePermission('/shared/pending')).toBe(false);
  });

  it('override true força "com permissão"', async () => {
    const adapter = new MemoryFilesystemAdapter();
    adapter.setProbeWritePermission(true);
    // Mesmo sem o diretório existir, o override decide.
    expect(await adapter.probeWritePermission('/inexistente')).toBe(true);
  });

  it('comportamento real (override null) escreve+remove → true', async () => {
    const adapter = new MemoryFilesystemAdapter();
    await adapter.writeFileAtomic('/shared/pending/seed.json', '{}');
    expect(await adapter.probeWritePermission('/shared/pending')).toBe(true);
  });

  it('setProbeWritePermission(null) restaura o comportamento real', async () => {
    const adapter = new MemoryFilesystemAdapter();
    adapter.setProbeWritePermission(false);
    adapter.setProbeWritePermission(null);
    await adapter.writeFileAtomic('/shared/pending/seed.json', '{}');
    expect(await adapter.probeWritePermission('/shared/pending')).toBe(true);
  });

  it('reset() limpa o override', async () => {
    const adapter = new MemoryFilesystemAdapter();
    adapter.setProbeWritePermission(false);
    adapter.reset();
    await adapter.writeFileAtomic('/shared/pending/seed.json', '{}');
    expect(await adapter.probeWritePermission('/shared/pending')).toBe(true);
  });
});
