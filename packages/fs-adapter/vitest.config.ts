import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/helpers.ts',
        'src/__helpers__/**',
        'src/index.ts',
        // CLI entry point: glue de process.*/node:fs (não-testável em
        // unit). A lógica pura vive em src/cleanup.ts e é coberta.
        // Validado por smoke run (--dry-run + execução real) e via E2E (W3).
        'src/bin/**',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
