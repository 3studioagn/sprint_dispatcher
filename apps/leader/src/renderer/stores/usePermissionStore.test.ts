import { beforeEach, describe, expect, it, vi } from 'vitest';

import { selectIsDispatchBlocked, usePermissionStore } from './usePermissionStore';

describe('usePermissionStore', () => {
  beforeEach(() => {
    usePermissionStore.getState().reset();
  });

  it('estado inicial: não verificado, não bloqueado', () => {
    const s = usePermissionStore.getState();
    expect(s.allowed).toBeNull();
    expect(s.reason).toBeNull();
    expect(selectIsDispatchBlocked(s)).toBe(false);
  });

  it('check() permite quando allowed=true', async () => {
    vi.mocked(window.api.canDispatch).mockResolvedValueOnce({
      ok: true,
      data: { allowed: true },
    });
    await usePermissionStore.getState().check();
    const s = usePermissionStore.getState();
    expect(s.allowed).toBe(true);
    expect(s.reason).toBeNull();
    expect(s.checking).toBe(false);
    expect(selectIsDispatchBlocked(s)).toBe(false);
  });

  it('check() bloqueia com reason quando allowed=false', async () => {
    vi.mocked(window.api.canDispatch).mockResolvedValueOnce({
      ok: true,
      data: { allowed: false, reason: 'Sem acesso de escrita. Contate o TI.' },
    });
    await usePermissionStore.getState().check();
    const s = usePermissionStore.getState();
    expect(s.allowed).toBe(false);
    expect(s.reason).toBe('Sem acesso de escrita. Contate o TI.');
    expect(selectIsDispatchBlocked(s)).toBe(true);
  });

  it('check() usa reason de fallback quando allowed=false sem reason', async () => {
    vi.mocked(window.api.canDispatch).mockResolvedValueOnce({
      ok: true,
      data: { allowed: false },
    });
    await usePermissionStore.getState().check();
    expect(usePermissionStore.getState().reason).toMatch(/permissão para disparar/i);
  });

  it('check() bloqueia em erro de IPC (CONFIG_REQUIRED)', async () => {
    vi.mocked(window.api.canDispatch).mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFIG_REQUIRED', message: 'config faltando' },
    });
    await usePermissionStore.getState().check();
    const s = usePermissionStore.getState();
    expect(s.allowed).toBe(false);
    expect(s.reason).toBe('config faltando');
  });

  it('check() bloqueia quando a promessa rejeita', async () => {
    vi.mocked(window.api.canDispatch).mockRejectedValueOnce(new Error('bridge morreu'));
    await usePermissionStore.getState().check();
    const s = usePermissionStore.getState();
    expect(s.allowed).toBe(false);
    expect(s.reason).toBe('bridge morreu');
  });
});
