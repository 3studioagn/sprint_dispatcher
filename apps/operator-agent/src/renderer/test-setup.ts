/**
 * Setup global do Vitest aplicado a todos os testes do renderer (jsdom).
 *
 * Responsabilidades:
 * 1. Estende `expect` com matchers de `@testing-library/jest-dom`.
 * 2. Define `window.api` global como bag de `vi.fn()` — testes do renderer
 *    que dependem do IPC bridge ganham defaults plausíveis sem ter que
 *    mockar individualmente.
 * 3. `cleanup()` após cada teste do RTL.
 *
 * Espelha o padrão do Leader (ADR-017 — property-with-arrow + vi.mocked).
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import type { Api, ConfigStatusResponse } from '../shared/ipc-types';

const DEFAULT_CONFIG_RESPONSE: ConfigStatusResponse = {
  ok: true,
  config: {
    sharedPath: '/test/shared',
    userId: 'joao',
    userNomeExibicao: 'João Silva',
    hostname: 'TEST-PC',
    pollingIntervalMs: 3000,
    minimizeAfterMs: 30000,
  },
};

const DEFAULT_ACK_RESPONSE = {
  ok: true as const,
  data: {
    acknowledged_at: '2026-05-26T10:00:00.000Z',
    moved_to_history: true,
  },
};

const NOOP_UNSUBSCRIBE = (): void => undefined;

if (typeof window !== 'undefined') {
  const apiMock: Api = {
    config: {
      get: vi.fn(() => Promise.resolve(DEFAULT_CONFIG_RESPONSE)),
    },
    sprint: {
      requestCurrent: vi.fn(() => Promise.resolve(null)),
      acknowledge: vi.fn(() => Promise.resolve(DEFAULT_ACK_RESPONSE)),
      onIncoming: vi.fn(() => NOOP_UNSUBSCRIBE),
    },
    queue: {
      onUpdated: vi.fn(() => NOOP_UNSUBSCRIBE),
    },
    overlay: {
      onMinimize: vi.fn(() => NOOP_UNSUBSCRIBE),
      closeReopened: vi.fn(() => Promise.resolve()),
    },
  };
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: apiMock,
  });
}

beforeEach(() => {
  if (typeof window === 'undefined') return;
  vi.mocked(window.api.config.get).mockReset().mockResolvedValue(DEFAULT_CONFIG_RESPONSE);
  vi.mocked(window.api.sprint.requestCurrent).mockReset().mockResolvedValue(null);
  vi.mocked(window.api.sprint.acknowledge).mockReset().mockResolvedValue(DEFAULT_ACK_RESPONSE);
  vi.mocked(window.api.sprint.onIncoming).mockReset().mockReturnValue(NOOP_UNSUBSCRIBE);
  vi.mocked(window.api.queue.onUpdated).mockReset().mockReturnValue(NOOP_UNSUBSCRIBE);
  vi.mocked(window.api.overlay.onMinimize).mockReset().mockReturnValue(NOOP_UNSUBSCRIBE);
  vi.mocked(window.api.overlay.closeReopened).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
});
