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
              // jsdom/canvas externalizados: dispatchService -> @sprint/contracts ->
              // isomorphic-dompurify -> jsdom -> canvas (peer opcional). Bundlado, o
              // require('canvas') interno do jsdom nao resolve em build-time, e o
              // Vite injeta stub que joga em runtime. Externalizado, o jsdom carrega
              // de node_modules em runtime e trata canvas como opcional (silencioso).
              //
              // pino/pino-pretty/thread-stream externalizados: @sprint/logger
              // (BL-C2-012 — PermissionService) usa pino. Bundlar os requires
              // dinamicos/worker do pino quebra sob vite-plugin-electron + asar.
              // Externalizado, resolve de node_modules em runtime (shamefully-hoist,
              // como jsdom). O permissionLogger usa destination sincrono, sem worker.
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
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
}));
