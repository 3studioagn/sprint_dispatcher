/**
 * Guardas de empacotamento do Agent (BL-C5-005 / BL-C5-003 / C0-008).
 *
 * Lê o `electron-builder.yml` e o `build/installer.nsh` como texto e afirma os
 * invariantes que não podem regredir: nomeação determinística do artefato,
 * config de assinatura (C0-008) intacta, hook de auto-start presente e — o mais
 * sutil — o nome do valor de Run no NSH casando com `AUTO_START_REGISTRY_VALUE`
 * (divergir criaria DUAS entradas de auto-start; ver ADR-028).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AUTO_START_REGISTRY_VALUE } from '../shared/branding';

// O vitest roda com cwd = raiz do workspace (apps/operator-agent), tanto via
// `pnpm --filter` quanto via turbo — resolve os arquivos de empacotamento a
// partir daí (env-agnóstico, ao contrário de import.meta.url sob jsdom).
const appRoot = process.cwd();
const yml = readFileSync(path.join(appRoot, 'electron-builder.yml'), 'utf-8');
const nsh = readFileSync(path.join(appRoot, 'build', 'installer.nsh'), 'utf-8');

describe('electron-builder.yml (Agent) — rename + artifactName (BL-C5-005)', () => {
  it('productName e appId renomeados para "Metas - Desenhistas"', () => {
    expect(yml).toContain('productName: Metas - Desenhistas');
    expect(yml).toContain('appId: br.com.artflexiveis.metas.desenhistas');
  });

  it('artifactName do instalador é determinístico com a versão do package.json', () => {
    expect(yml).toContain('Metas-Desenhistas-Setup-${version}.${ext}');
  });
});

describe('electron-builder.yml (Agent) — assinatura C0-008 não regride', () => {
  it('mantém timestamping RFC 3161 + SHA-256', () => {
    expect(yml).toContain('rfc3161TimeStampServer');
    expect(yml).toContain('- sha256');
  });
});

describe('auto-start HKCU Run (BL-C5-003)', () => {
  it('o yml inclui o hook NSIS', () => {
    expect(yml).toContain('include: build/installer.nsh');
  });

  it('o NSH escreve e remove a entrada em HKCU Run', () => {
    expect(nsh).toContain('!macro customInstall');
    expect(nsh).toContain('!macro customUnInstall');
    expect(nsh).toContain('Software\\Microsoft\\Windows\\CurrentVersion\\Run');
    expect(nsh).toContain('WriteRegStr HKCU');
    expect(nsh).toContain('DeleteRegValue HKCU');
  });

  it('o nome do valor de Run casa com AUTO_START_REGISTRY_VALUE (evita entrada dupla)', () => {
    expect(nsh).toContain(`"${AUTO_START_REGISTRY_VALUE}"`);
  });
});
