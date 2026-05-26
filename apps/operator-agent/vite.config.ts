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
              external: ['electron', 'jsdom', 'canvas'],
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
