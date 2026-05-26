import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test-setup.ts'],
    // Scaffold W0 ainda nao tem testes; W1+ adiciona. Evita exit 1 do vitest.
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__test-fixtures__/**', // fixtures só consumidas por testes
        // main/config.ts e main/services/** TÊM testes unitários — incluem no
        // coverage. main/index.ts (boot) e main/ipc.ts (envelope) ficam para
        // E2E em W3 (Playwright) — chamar ipcMain.handle em unit test exigiria
        // mock denso do Electron sem ganho real.
        'src/main/index.ts',
        'src/main/ipc.ts',
        'src/preload/**', // testado via E2E em W3
        'src/renderer/main.tsx',
        'src/renderer/env.d.ts',
        'src/renderer/test-setup.ts',
      ],
      // W0: scaffold sem lógica, sem threshold; W1+ define
    },
  },
});
