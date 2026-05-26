import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Renderer roda em jsdom (@testing-library); main process roda em node.
    // environmentMatchGlobs aplica per-file baseado no path do test.
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
      ['src/main/**', 'node'],
    ],
    setupFiles: ['./src/renderer/test-setup.ts'],
    // vitest sai exit 1 quando nao acha arquivos de teste (ver CLAUDE.md G-011)
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/main/**/*.ts', 'src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main/index.ts', // composition root — testado via E2E em W3
        'src/main/services/index.ts', // barrel
        'src/main/services/trayService.ts', // integra Electron Tray — E2E em W3
        'src/preload/**',
        'src/shared/**',
        'src/renderer/main.tsx', // entry React
        'src/renderer/env.d.ts',
        'src/renderer/test-setup.ts',
        'src/renderer/styles/**',
        'src/renderer/**/index.ts', // barrels
      ],
      thresholds: {
        // 70/65 cobre o piso do renderer; main + services excedem com folga.
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
