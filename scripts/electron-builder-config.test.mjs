// Asserções de configuração: garantem que ambos os electron-builder.yml
// declaram timestamping RFC 3161 + digest SHA-256 e NÃO embutem caminho/senha
// do certificado. Lê o YAML como texto (sem dependência de parser) — o foco é
// detectar segredos hardcoded e regressões de invariante, não estrutura.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const APPS = [
  { name: 'leader', path: join(repoRoot, 'apps', 'leader', 'electron-builder.yml') },
  { name: 'operator-agent', path: join(repoRoot, 'apps', 'operator-agent', 'electron-builder.yml') },
];

describe.each(APPS)('electron-builder.yml ($name) — code signing', ({ path }) => {
  it('declara timestamping RFC 3161', async () => {
    const yml = await readFile(path, 'utf8');
    expect(yml).toMatch(/^\s*rfc3161TimeStampServer:\s*https?:\/\/\S+/m);
  });

  it('força digest SHA-256 e nunca SHA-1', async () => {
    const yml = await readFile(path, 'utf8');
    expect(yml).toMatch(/^\s*signingHashAlgorithms:/m);
    expect(yml).toMatch(/-\s*sha256/);
    expect(yml).not.toMatch(/-\s*sha1\b/);
  });

  it('NÃO embute caminho nem senha do certificado (vêm do ambiente)', async () => {
    const yml = await readFile(path, 'utf8');
    // CSC_LINK / CSC_KEY_PASSWORD são lidos do ambiente pelo electron-builder.
    expect(yml).not.toMatch(/^\s*certificateFile:\s*\S/m);
    expect(yml).not.toMatch(/^\s*certificatePassword:\s*\S/m);
    expect(yml).not.toMatch(/CSC_KEY_PASSWORD\s*[:=]/);
  });

  it('preserva publisherName da identidade ARTFLEXÍVEIS', async () => {
    const yml = await readFile(path, 'utf8');
    expect(yml).toMatch(/^\s*publisherName:\s*ARTFLEXÍVEIS\s*$/m);
  });
});
