import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupPfxFile, decodePfxToFile, PfxSecretError } from './pfx-secret.mjs';

describe('decodePfxToFile', () => {
  /** @type {string} */
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pfx-secret-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('decodifica o base64 para os bytes originais exatos', async () => {
    const original = Buffer.from([0x30, 0x82, 0x00, 0x01, 0xff, 0xfe, 0x00]); // bytes binários
    const base64 = original.toString('base64');
    const dest = join(dir, 'codesign.pfx');

    const result = await decodePfxToFile({ base64, destPath: dest });

    expect(result).toBe(dest);
    const written = await readFile(dest);
    expect(written.equals(original)).toBe(true);
  });

  it('tolera quebras de linha/espaços no base64 (Secret colado/quebrado)', async () => {
    const original = Buffer.from('conteudo-fake-do-pfx');
    const wrapped = original.toString('base64').replace(/(.{4})/g, '$1\n  ');
    const dest = join(dir, 'wrapped.pfx');

    await decodePfxToFile({ base64: wrapped, destPath: dest });

    const written = await readFile(dest);
    expect(written.equals(original)).toBe(true);
  });

  it('lança EMPTY_BASE64 quando o Secret está ausente (string vazia)', async () => {
    await expect(decodePfxToFile({ base64: '', destPath: join(dir, 'a.pfx') })).rejects.toMatchObject(
      { name: 'PfxSecretError', code: 'EMPTY_BASE64' },
    );
  });

  it('lança EMPTY_BASE64 quando o base64 é só espaço em branco', async () => {
    await expect(
      decodePfxToFile({ base64: '   \n\t', destPath: join(dir, 'b.pfx') }),
    ).rejects.toMatchObject({ code: 'EMPTY_BASE64' });
  });

  it('lança INVALID_BASE64 quando o comprimento não é múltiplo de 4', async () => {
    await expect(
      decodePfxToFile({ base64: 'QUJD', destPath: join(dir, 'c.pfx') }),
    ).resolves.toBeDefined(); // controle: "QUJD" (= "ABC") é válido
    await expect(
      decodePfxToFile({ base64: 'QUJDR', destPath: join(dir, 'd.pfx') }),
    ).rejects.toBeInstanceOf(PfxSecretError);
  });

  it('lança INVALID_BASE64 para caracteres fora do alfabeto base64', async () => {
    await expect(
      decodePfxToFile({ base64: '@@@@', destPath: join(dir, 'e.pfx') }),
    ).rejects.toMatchObject({ code: 'INVALID_BASE64' });
  });

  it('lança MISSING_DEST quando o destPath é vazio', async () => {
    await expect(decodePfxToFile({ base64: 'QUJD', destPath: '' })).rejects.toMatchObject({
      code: 'MISSING_DEST',
    });
  });

  it('lança MISSING_DEST quando o destPath é só espaço em branco', async () => {
    await expect(decodePfxToFile({ base64: 'QUJD', destPath: '   ' })).rejects.toMatchObject({
      code: 'MISSING_DEST',
    });
  });
});

describe('cleanupPfxFile', () => {
  /** @type {string} */
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pfx-cleanup-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('remove um arquivo existente e retorna true', async () => {
    const f = join(dir, 'codesign.pfx');
    await writeFile(f, 'segredo');

    expect(await cleanupPfxFile(f)).toBe(true);
    await expect(stat(f)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('é idempotente: retorna false quando o arquivo já não existe', async () => {
    expect(await cleanupPfxFile(join(dir, 'inexistente.pfx'))).toBe(false);
  });

  it('retorna false para caminho vazio sem lançar', async () => {
    expect(await cleanupPfxFile('')).toBe(false);
  });

  it('propaga erros que não sejam ENOENT (ex.: alvo é um diretório)', async () => {
    // unlink em um diretório → EISDIR (POSIX) / EPERM (Windows): deve propagar.
    await expect(cleanupPfxFile(dir)).rejects.toMatchObject({
      code: expect.stringMatching(/^(EISDIR|EPERM)$/),
    });
  });
});
