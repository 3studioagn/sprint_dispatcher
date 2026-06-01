// @vitest-environment node
/**
 * Testes do PermissionService (BL-C2-012) — gate de permissão do líder.
 *
 * Usa o override `setProbeWritePermission` do MemoryFilesystemAdapter para
 * simular um share com/sem permissão, sem FS real. Logger e `getUsername`
 * são injetados (fakes) para asserção determinística.
 */
import { SHARED_DIRS } from '@sprint/contracts';
import { MemoryFilesystemAdapter } from '@sprint/fs-adapter';
import type { Logger } from '@sprint/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_DENIED_REASON, PermissionService } from './permissionService';

const SHARED = '/shared';

interface FakeLogger extends Logger {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
}

function makeLogger(): FakeLogger {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    name: 'test',
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

describe('PermissionService.canDispatch', () => {
  let adapter: MemoryFilesystemAdapter;
  let logger: FakeLogger;

  beforeEach(() => {
    adapter = new MemoryFilesystemAdapter();
    logger = makeLogger();
  });

  it('permite quando o probe de escrita em pending/ retorna true', async () => {
    adapter.setProbeWritePermission(true);
    const service = new PermissionService(adapter, SHARED, logger, () => 'renan');

    const result = await service.canDispatch();

    expect(result).toEqual({ allowed: true });
  });

  it('bloqueia com mensagem clara quando o probe retorna false', async () => {
    adapter.setProbeWritePermission(false);
    const service = new PermissionService(adapter, SHARED, logger, () => 'joao');

    const result = await service.canDispatch();

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(PERMISSION_DENIED_REASON);
  });

  it('proba o diretório pending/ da pasta compartilhada', async () => {
    const spy = vi.spyOn(adapter, 'probeWritePermission').mockResolvedValue(true);
    const service = new PermissionService(adapter, SHARED, logger, () => 'renan');

    await service.canDispatch();

    expect(spy).toHaveBeenCalledWith(`${SHARED}/${SHARED_DIRS.PENDING}`);
  });

  it('loga em info (com o usuário Windows) quando permitido', async () => {
    adapter.setProbeWritePermission(true);
    const service = new PermissionService(adapter, SHARED, logger, () => 'renan');

    await service.canDispatch();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'renan' }),
      expect.any(String),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('loga em warn (com o usuário) quando negado', async () => {
    adapter.setProbeWritePermission(false);
    const service = new PermissionService(adapter, SHARED, logger, () => 'joao');

    await service.canDispatch();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'joao' }),
      expect.any(String),
    );
  });

  it('cai para "desconhecido" se getUsername lançar', async () => {
    adapter.setProbeWritePermission(true);
    const service = new PermissionService(adapter, SHARED, logger, () => {
      throw new Error('no passwd entry');
    });

    await service.canDispatch();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'desconhecido' }),
      expect.any(String),
    );
  });

  it('usa o default getUsername (os.userInfo) quando não injetado', async () => {
    adapter.setProbeWritePermission(true);
    const service = new PermissionService(adapter, SHARED, logger);

    const result = await service.canDispatch();

    expect(result).toEqual({ allowed: true });
    // Exercita o ramo do default getUsername (os.userInfo) sem injeção.
    expect(logger.info).toHaveBeenCalledOnce();
  });
});
