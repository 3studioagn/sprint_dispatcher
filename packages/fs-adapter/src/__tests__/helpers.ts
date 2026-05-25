import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { IFilesystemAdapter } from '../interface';
import { MemoryFilesystemAdapter } from '../memory-adapter';
import { NodeFilesystemAdapter } from '../node-adapter';

export interface ContractContext {
  adapter: IFilesystemAdapter;
  root: string;
  cleanup: () => Promise<void>;
  resolvePath: (rel: string) => string;
}

/**
 * Contexto para testes contra NodeFilesystemAdapter — cria tmpdir
 * real e retorna helpers de cleanup e path resolution.
 */
export async function setupNodeContext(): Promise<ContractContext> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-contract-'));
  const adapter = new NodeFilesystemAdapter();
  return {
    adapter,
    root,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
    resolvePath: (rel: string) => path.join(root, rel),
  };
}

/**
 * Contexto para testes contra MemoryFilesystemAdapter — usa root
 * virtual e reset() para cleanup.
 */
export function setupMemoryContext(): Promise<ContractContext> {
  const adapter = new MemoryFilesystemAdapter();
  const root = '/test';
  return Promise.resolve({
    adapter,
    root,
    cleanup: () => {
      adapter.reset();
      return Promise.resolve();
    },
    resolvePath: (rel: string) => `${root}/${rel}`,
  });
}
