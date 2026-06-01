// CLI de glue usado pelo `release.yml` no GitHub Actions.
//
//   node scripts/prepare-signing-cert.mjs            # (ou `prepare`)
//   node scripts/prepare-signing-cert.mjs cleanup
//
// `prepare`: decodifica o Secret `WINDOWS_CERT_PFX_BASE64` para
//   `$RUNNER_TEMP/codesign.pfx` e exporta `CSC_LINK=<path>` via `$GITHUB_ENV`,
//   para que os passos seguintes (electron-builder) assinem sem expor o PFX no
//   log. A senha (`CSC_KEY_PASSWORD`) é mapeada direto no YAML do workflow.
// `cleanup`: remove o PFX temporário. Idempotente — feito para rodar em
//   `if: always()`, inclusive quando o build falhou antes de gerar o arquivo.
//
// A lógica determinística (decode/cleanup) vive em `pfx-secret.mjs` e é
// unit-testada; aqui ficam só os efeitos de ambiente (process.env / arquivos
// de runner), validados via CI.

import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cleanupPfxFile, decodePfxToFile } from './pfx-secret.mjs';

const PFX_FILENAME = 'codesign.pfx';

/** @returns {string} caminho do PFX temporário no runner */
function resolvePfxPath() {
  const runnerTemp = process.env.RUNNER_TEMP;
  if (!runnerTemp) {
    throw new Error('RUNNER_TEMP não definido — este script é destinado ao GitHub Actions.');
  }
  return join(runnerTemp, PFX_FILENAME);
}

async function prepare() {
  const dest = resolvePfxPath();
  await decodePfxToFile({ base64: process.env.WINDOWS_CERT_PFX_BASE64 ?? '', destPath: dest });

  const githubEnv = process.env.GITHUB_ENV;
  if (githubEnv) {
    await appendFile(githubEnv, `CSC_LINK=${dest}\n`);
  }
  process.stdout.write(`PFX de assinatura preparado em ${dest}\n`);
}

async function cleanup() {
  const removed = await cleanupPfxFile(resolvePfxPath());
  process.stdout.write(removed ? 'PFX temporário removido.\n' : 'Nenhum PFX temporário para remover.\n');
}

try {
  if ((process.argv[2] ?? 'prepare') === 'cleanup') {
    await cleanup();
  } else {
    await prepare();
  }
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
