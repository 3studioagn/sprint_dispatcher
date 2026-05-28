import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      // TODO(BL-C8-008): habilitar thresholds (lines/functions/statements ≥ 85%, branches ≥ 80%).
      // Por ora, smoke tests apenas — coverage threshold OFF nesta sessão.
    },
  },
});
