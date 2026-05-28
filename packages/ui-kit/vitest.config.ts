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
      include: ['src/**/*.{ts,tsx}'],
      // Barrels (index.ts) e os próprios testes são excluídos: re-exports
      // triviais não devem inflar o denominador e .test.* não deve se
      // contar a si mesmo.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/index.ts', 'src/test-setup.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        // Branches em 80 (não 85): coerência com a política dos demais
        // workspaces (CLAUDE.md §7.7.1). Cobertura real atual é 100%,
        // com folga; subir branches a 85 não exigiria nenhum teste novo
        // — mantemos 80 como margem para fallbacks defensivos futuros
        // sem precisar inflar com testes artificiais.
        branches: 80,
      },
    },
  },
});
