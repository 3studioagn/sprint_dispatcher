/**
 * OperatorsService — lê `<shared_path>/operators.json` via
 * `IFilesystemAdapter`.
 *
 * Schema do arquivo:
 * ```json
 * {
 *   "operators": [
 *     { "user_id": "joao", "user_nome_exibicao": "João", "hostname": "PC-04", "ativo": true },
 *     ...
 *   ]
 * }
 * ```
 *
 * **Filtragem `ativo:true` NÃO acontece aqui** — service retorna lista
 * completa; UI (renderer) filtra na renderização. Mantém o service como
 * espelho fiel do arquivo e facilita debug ("por que operador X não
 * aparece? Está com `ativo: false`?").
 *
 * @see CLAUDE.md §4 (estrutura interna do Leader)
 * @see DECISIONS.md ADR-013 (filesystem adapter port-and-adapter)
 */

import path from 'node:path';

import { userIdSchema } from '@sprint/contracts';
import { FileNotFoundError, FilesystemError, type IFilesystemAdapter } from '@sprint/fs-adapter';
import { z } from 'zod';

import type { OperatorsListResponse } from '../../shared/ipc-types';

const OPERATORS_FILENAME = 'operators.json';

const operatorSchema = z
  .object({
    user_id: userIdSchema,
    user_nome_exibicao: z.string().min(1).max(100),
    hostname: z.string().min(1).max(50),
    ativo: z.boolean(),
  })
  .strict();

export const operatorsFileSchema = z
  .object({
    operators: z.array(operatorSchema),
  })
  .strict();

export class OperatorsFileNotFoundError extends Error {
  override readonly name = 'OperatorsFileNotFoundError';

  constructor(public readonly filepath: string) {
    super(`operators.json não encontrado em ${filepath}`);
  }
}

export class OperatorsFileInvalidError extends Error {
  override readonly name = 'OperatorsFileInvalidError';

  constructor(
    public readonly filepath: string,
    public override readonly cause: Error,
  ) {
    super(`operators.json em ${filepath} é inválido: ${cause.message}`);
  }
}

export class OperatorsService {
  constructor(
    private readonly adapter: IFilesystemAdapter,
    private readonly sharedPath: string,
  ) {}

  /**
   * Lê e valida o `operators.json` da pasta compartilhada.
   *
   * @throws {OperatorsFileNotFoundError} Arquivo ausente.
   * @throws {OperatorsFileInvalidError} JSON malformado, schema violado,
   *   ou erro de I/O propagado do adapter.
   */
  async list(): Promise<OperatorsListResponse> {
    const filepath = path.posix.join(this.sharedPath, OPERATORS_FILENAME);

    let raw: string;
    try {
      raw = await this.adapter.readFile(filepath);
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        throw new OperatorsFileNotFoundError(filepath);
      }
      if (err instanceof FilesystemError) {
        throw new OperatorsFileInvalidError(filepath, err);
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (err) {
      throw new OperatorsFileInvalidError(filepath, err as Error);
    }

    const result = operatorsFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new OperatorsFileInvalidError(filepath, result.error);
    }

    const stats = await this.adapter.stat(filepath);

    return {
      operators: result.data.operators,
      source: filepath,
      lastModified: stats.modifiedAt.toISOString(),
    };
  }
}
