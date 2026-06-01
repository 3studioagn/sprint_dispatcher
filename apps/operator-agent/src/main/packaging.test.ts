/**
 * Guardas de empacotamento do Agent (BL-C5-005 / BL-C5-003 / C0-008).
 *
 * Lê o `electron-builder.yml` e o `build/installer.nsh` como texto e afirma os
 * invariantes que não podem regredir: nomeação determinística do artefato,
 * config de assinatura (C0-008) intacta, hook de auto-start presente e — o mais
 * sutil — o nome do valor de Run no NSH casando com `AUTO_START_REGISTRY_VALUE`
 * (divergir criaria DUAS entradas de auto-start; ver ADR-028).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AUTO_START_REGISTRY_VALUE } from '../shared/branding';

// Resolve um arquivo do app de forma robusta a env (node/jsdom) e a cwd
// (workspace vs raiz do monorepo) — o CI roda em Linux e o cwd/URL podem
// diferir do dev local. Tenta: (1) relativo ao arquivo de teste (env node:
// import.meta.url é file://); (2) cwd (workspace, sob turbo/pnpm); (3) cwd +
// apps/operator-agent (caso o cwd seja a raiz do monorepo).
function readAppFile(relFromAppRoot: string): string {
  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url)); // .../src/main
    candidates.push(path.resolve(here, '..', '..', relFromAppRoot));
  } catch {
    /* jsdom: import.meta.url não é file:// — ignora e usa cwd */
  }
  candidates.push(path.resolve(process.cwd(), relFromAppRoot));
  candidates.push(path.resolve(process.cwd(), 'apps', 'operator-agent', relFromAppRoot));
  const found = candidates.find((c) => existsSync(c));
  if (found === undefined) {
    throw new Error(
      `packaging.test: não encontrei ${relFromAppRoot} (tentei: ${candidates.join(' | ')})`,
    );
  }
  return readFileSync(found, 'utf-8');
}

const yml = readAppFile('electron-builder.yml');
const nsh = readAppFile(path.join('build', 'installer.nsh'));

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
