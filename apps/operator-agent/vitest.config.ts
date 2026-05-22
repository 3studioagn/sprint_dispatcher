import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // main process — testes rodam em Node
    // vitest sai exit 1 quando nao acha arquivos de teste (ver CLAUDE.md G-011)
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts'], // foco em main (lógica real)
      exclude: [
        'src/**/*.test.ts',
        'src/main/index.ts', // entry, integração — E2E em W3
        'src/main/tray.ts', // depende de Electron APIs, E2E em W3
        'src/main/overlay.ts', // E2E em W3
        'src/preload/**',
        'src/renderer/**',
        'src/shared/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
