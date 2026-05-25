import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    // Scaffold W0 ainda nao tem testes; W1+ adiciona. Evita exit 1 do vitest.
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main/**', // testado via E2E em W3 (Playwright)
        'src/preload/**', // testado via E2E em W3
        'src/renderer/main.tsx',
        'src/renderer/env.d.ts',
      ],
      // W0: scaffold sem lógica, sem threshold; W1+ define
    },
  },
});
