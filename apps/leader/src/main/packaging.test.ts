/**
 * Guardas de empacotamento do Leader (BL-C5-005 / C0-008 / RN-12).
 *
 * Lê o `electron-builder.yml` como texto e afirma: nomeação determinística do
 * artefato, config de assinatura (C0-008) intacta e — crucialmente — que o
 * Leader NÃO tem auto-start (RN-12: o Leader é aberto manualmente).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Resolve robusto a env (jsdom) e a cwd (workspace vs raiz do monorepo) — o CI
// roda em Linux e o cwd/URL podem diferir do dev local. Tenta: (1) relativo ao
// arquivo de teste; (2) cwd (workspace); (3) cwd + apps/leader (raiz do mono).
function readAppFile(relFromAppRoot: string): string {
  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url)); // .../src/main
    candidates.push(path.resolve(here, '..', '..', relFromAppRoot));
  } catch {
    /* jsdom: import.meta.url não é file:// — ignora e usa cwd */
  }
  candidates.push(path.resolve(process.cwd(), relFromAppRoot));
  candidates.push(path.resolve(process.cwd(), 'apps', 'leader', relFromAppRoot));
  const found = candidates.find((c) => existsSync(c));
  if (found === undefined) {
    throw new Error(
      `packaging.test: não encontrei ${relFromAppRoot} (tentei: ${candidates.join(' | ')})`,
    );
  }
  return readFileSync(found, 'utf-8');
}

const yml = readAppFile('electron-builder.yml');

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
