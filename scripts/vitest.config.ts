import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      // Apenas o helper puro e determinístico entra na medição. A glue de CI
      // (prepare-signing-cert.mjs) e os scripts .ps1/.sh são não-determinísticos
      // (process.env, signtool, openssl) e validados via integração/CI —
      // excluí-los mantém os thresholds honestos (BL-C0-008, §4.10).
      include: ['pfx-secret.mjs'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
