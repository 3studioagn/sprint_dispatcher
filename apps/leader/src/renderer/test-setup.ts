/**
 * Setup global do Vitest para testes de componente do renderer.
 *
 * - Estende o `expect` global com matchers de `@testing-library/jest-dom`
 *   (toBeInTheDocument, toBeChecked, toHaveClass, etc).
 * - `cleanup()` após cada teste — desmonta árvores React montadas via RTL
 *   e evita vazamento de DOM entre testes.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
