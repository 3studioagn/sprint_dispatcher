// Helper puro e testável para o manuseio do certificado PFX no caminho de
// release (CI). Mantido determinístico e sem efeitos colaterais de import:
// decodifica um PFX em base64 (vindo de um Secret do GitHub Actions) para um
// arquivo temporário no disco e limpa esse arquivo ao final do job.
//
// NUNCA loga nem ecoa o conteúdo do segredo — apenas escreve/remove os bytes.
// A glue de CI (process.env / GITHUB_ENV) fica no `prepare-signing-cert.mjs`;
// este módulo é a parte unit-testável.

import { unlink, writeFile } from 'node:fs/promises';

/**
 * Erro tipado para falhas no manuseio do segredo PFX.
 * O `code` permite ao chamador (e aos testes) discriminar o modo de falha sem
 * depender da string da mensagem.
 */
export class PfxSecretError extends Error {
  /**
   * @param {string} message
   * @param {'EMPTY_BASE64' | 'INVALID_BASE64' | 'MISSING_DEST'} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'PfxSecretError';
    this.code = code;
  }
}

// Base64 canônico (sem URL-safe): A-Z a-z 0-9 + / com 0..2 chars de padding.
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Decodifica um PFX em base64 para um arquivo no disco, para que o
 * electron-builder o consuma via a env var `CSC_LINK`.
 *
 * Tolera quebras de linha/espacos no base64 (o `base64 -w0`/`ToBase64String`
 * podem ser quebrados ao colar em um Secret). Valida estritamente o conteudo
 * antes de gravar — um Secret ausente vira `EMPTY_BASE64`, lixo vira
 * `INVALID_BASE64`, em vez de gravar um PFX corrompido que so falharia no
 * signtool.
 *
 * @param {{ base64: string, destPath: string }} args
 * @returns {Promise<string>} o caminho escrito (igual a `destPath`)
 */
export async function decodePfxToFile({ base64, destPath }) {
  if (!destPath || destPath.trim() === '') {
    throw new PfxSecretError('destPath obrigatorio para gravar o PFX', 'MISSING_DEST');
  }
  if (!base64 || base64.trim() === '') {
    throw new PfxSecretError(
      'PFX base64 vazio — Secret WINDOWS_CERT_PFX_BASE64 ausente?',
      'EMPTY_BASE64',
    );
  }

  const normalized = base64.replace(/\s+/g, '');
  if (normalized.length % 4 !== 0 || !BASE64_RE.test(normalized)) {
    throw new PfxSecretError('PFX base64 malformado', 'INVALID_BASE64');
  }

  const bytes = Buffer.from(normalized, 'base64');
  // mode 0o600: legível só pelo dono em POSIX (no-op no Windows, inócuo).
  await writeFile(destPath, bytes, { mode: 0o600 });
  return destPath;
}

/**
 * Remove o arquivo PFX temporário. Idempotente — se o arquivo não existe
 * (ex.: o job falhou antes de escrevê-lo), retorna `false` sem lançar, para
 * poder ser chamado em `if: always()` no CI sem mascarar a causa-raiz da
 * falha original. Erros que não sejam "arquivo inexistente" propagam.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>} `true` se removeu, `false` se não havia o que remover
 */
export async function cleanupPfxFile(filePath) {
  if (!filePath) {
    return false;
  }
  try {
    await unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}
