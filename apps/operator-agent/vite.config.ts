import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: command === 'serve',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'src/main/index.ts',
        onstart(args) {
          args.startup();
        },
        vite: {
          build: {
            sourcemap: command === 'serve',
            outDir: 'dist-electron/main',
            rollupOptions: {
              // jsdom + canvas externalizados: o sanitizeBodyHtml de @sprint/contracts
              // carrega isomorphic-dompurify → jsdom transitivamente. Bundlar jsdom
              // no main injeta um stub de `canvas` que lança em runtime de module-load.
              // Em produção, node_modules é incluído pelo electron-builder, então
              // `require('jsdom')` em runtime tem acesso ao pacote. Mesma decisão do
              // Leader (G-020, ADR-017).
              //
              // pino/pino-pretty/thread-stream externalizados (BL-C3-013): o
              // PollingService loga transições de conexão via @sprint/logger (pino).
              // Bundlar os requires dinâmicos/worker do pino quebra sob
              // vite-plugin-electron + asar. Externalizado, resolve de node_modules
              // em runtime. O pollingLogger usa `destination: process.stdout`
              // (JSON síncrono, sem worker) — mesmo padrão do Leader (G-020).
              external: ['electron', 'jsdom', 'canvas', 'pino', 'pino-pretty', 'thread-stream'],
            },
          },
        },
      },
      {
        // Preload script
        entry: 'src/preload/index.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            sourcemap: command === 'serve' ? 'inline' : false,
            outDir: 'dist-electron/preload',
            rollupOptions: {
              // jsdom + canvas externalizados: o sanitizeBodyHtml de @sprint/contracts
              // carrega isomorphic-dompurify → jsdom transitivamente. Bundlar jsdom
              // no main injeta um stub de `canvas` que lança em runtime de module-load.
              // Em produção, node_modules é incluído pelo electron-builder, então
              // `require('jsdom')` em runtime tem acesso ao pacote. Mesma decisão do
              // Leader (G-020, ADR-017).
              external: ['electron', 'jsdom', 'canvas'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
  clearScreen: false,
}));
