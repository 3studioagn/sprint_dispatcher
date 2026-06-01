/**
 * Guardas de empacotamento do Leader (BL-C5-005 / C0-008 / RN-12).
 *
 * Lê o `electron-builder.yml` como texto e afirma: nomeação determinística do
 * artefato, config de assinatura (C0-008) intacta e — crucialmente — que o
 * Leader NÃO tem auto-start (RN-12: o Leader é aberto manualmente).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// O vitest roda com cwd = raiz do workspace (apps/leader) — resolve o yml a
// partir daí (env-agnóstico, ao contrário de import.meta.url sob jsdom).
const yml = readFileSync(path.join(process.cwd(), 'electron-builder.yml'), 'utf-8');

describe('electron-builder.yml (Leader) — rename + artifactName (BL-C5-005)', () => {
  it('productName e appId renomeados para "Metas - Liderança"', () => {
    expect(yml).toContain('productName: Metas - Liderança');
    expect(yml).toContain('appId: br.com.artflexiveis.metas.lideranca');
  });

  it('artifactName do instalador é determinístico com a versão do package.json', () => {
    expect(yml).toContain('Metas-Lideranca-Setup-${version}.${ext}');
  });
});

describe('electron-builder.yml (Leader) — assinatura C0-008 não regride', () => {
  it('mantém timestamping RFC 3161 + SHA-256', () => {
    expect(yml).toContain('rfc3161TimeStampServer');
    expect(yml).toContain('- sha256');
  });
});

describe('Leader NÃO tem auto-start (RN-12)', () => {
  it('não inclui hook NSIS nem entrada de Run', () => {
    expect(yml).not.toContain('installer.nsh');
    expect(yml).not.toContain('CurrentVersion\\Run');
  });
});
