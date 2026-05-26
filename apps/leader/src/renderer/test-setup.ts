/**
 * Setup global do Vitest aplicado a todos os arquivos de teste do Leader.
 *
 * Responsabilidades:
 * 1. Estende `expect` com matchers de `@testing-library/jest-dom`
 *    (toBeInTheDocument, toBeChecked, etc). Side-effect do import.
 * 2. Define `window.api` global como `vi.fn()` bag — testes do renderer
 *    que dependem do IPC bridge ganham defaults plausíveis sem ter que
 *    mockar individualmente. Tests overridem via
 *    `vi.mocked(window.api.<method>).mockResolvedValueOnce(...)`.
 * 3. `cleanup()` após cada teste — apenas em jsdom (testes do main
 *    process usam `// @vitest-environment node` e não têm DOM).
 *
 * O `window.api` mock só é definido em jsdom (`typeof window !==
 * 'undefined'`). Tests do main process (env `node`) não tocam o bridge.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import type { LeaderAPI } from '../shared/ipc-types';

import { TEST_OPERATORS } from './__test-fixtures__/operators';

const DEFAULT_OPERATORS_RESPONSE = {
  ok: true as const,
  data: {
    operators: TEST_OPERATORS,
    source: '/test/shared/operators.json',
    lastModified: '2026-05-25T10:00:00.000Z',
  },
};

const DEFAULT_CONFIG_RESPONSE = {
  ok: true as const,
  config: { shared_path: '/test/shared', criado_por: 'TestRenan' },
};

const DEFAULT_DISPATCH_RESPONSE = {
  ok: true as const,
  data: {
    sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7V8W',
    per_operator: [],
    summary: { total: 0, success: 0, failed: 0 },
  },
};

if (typeof window !== 'undefined') {
  // vi.fn() recebe um implementation para que o tipo do Mock case com a
  // assinatura declarada em LeaderAPI (arrow property em ipc-types.ts).
  const apiMock: LeaderAPI = {
    ping: vi.fn(() => Promise.resolve('pong')),
    getConfig: vi.fn(() => Promise.resolve(DEFAULT_CONFIG_RESPONSE)),
    listOperators: vi.fn(() => Promise.resolve(DEFAULT_OPERATORS_RESPONSE)),
    dispatchSprint: vi.fn(() => Promise.resolve(DEFAULT_DISPATCH_RESPONSE)),
  };
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: apiMock,
  });
}

beforeEach(() => {
  if (typeof window !== 'undefined') {
    vi.mocked(window.api.ping).mockReset().mockResolvedValue('pong');
    vi.mocked(window.api.getConfig).mockReset().mockResolvedValue(DEFAULT_CONFIG_RESPONSE);
    vi.mocked(window.api.listOperators).mockReset().mockResolvedValue(DEFAULT_OPERATORS_RESPONSE);
    vi.mocked(window.api.dispatchSprint).mockReset().mockResolvedValue(DEFAULT_DISPATCH_RESPONSE);
  }
});

afterEach(() => {
  if (typeof document !== 'undefined') {
    cleanup();
  }
});
