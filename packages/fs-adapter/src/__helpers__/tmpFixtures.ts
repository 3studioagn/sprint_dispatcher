/**
 * Helpers compartilhados de tmp dir para os adversarial / integration
 * tests do `@sprint/fs-adapter`.
 *
 * Excluído da medição de cobertura (ver `vitest.config.ts`).
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TmpSharedContext {
  /** Raiz absoluta do tmp dir (com `pending/` e `acks/` já criados). */
  readonly sharedPath: string;
  /** Cleanup recursivo — chame em `afterEach`. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Cria um tmp dir isolado com a estrutura
 * `<tmp>/<random>/{pending,acks}/` para testes que precisam de
 * filesystem real (não Memory).
 *
 * @param label - prefixo legível usado no `mkdtemp`. Aparece no nome
 *   do dir para facilitar diagnóstico em CI quando o teste vaza dir.
 */
export async function setupTmpShared(label: string): Promise<TmpSharedContext> {
  const sharedPath = await fs.mkdtemp(path.join(os.tmpdir(), `${label}-`));
  await fs.mkdir(path.join(sharedPath, 'pending'), { recursive: true });
  await fs.mkdir(path.join(sharedPath, 'acks'), { recursive: true });

  return {
    sharedPath,
    cleanup: async () => {
      await fs.rm(sharedPath, { recursive: true, force: true });
    },
  };
}
