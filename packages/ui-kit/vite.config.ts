import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Watch mode (`vite build --watch`, usado pelo script `dev`) NÃO deve
 * esvaziar o `dist/` na inicialização — apps consumidores (Agent
 * renderer via Vite dev server) podem estar fazendo Pre-transform
 * exatamente no intervalo entre o clear e o primeiro re-bundle, e
 * falham com "Failed to load url .../dist/index.js" / "styles.css".
 * Em one-shot build (`pnpm build`), `dist/` é reescrito por completo
 * pelos outputs do Rollup; arquivos antigos não sobrevivem.
 */
const isWatchMode = process.argv.includes('--watch');

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.json',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
      rollupTypes: true,
      insertTypesEntry: true,
    }),
    viteStaticCopy({
      targets: [{ src: 'src/tokens/tokens.css', dest: '.' }],
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: !isWatchMode,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@sprint/contracts'],
      output: {
        preserveModules: false,
        assetFileNames: 'assets/[name][extname]',
      },
    },
    cssCodeSplit: false,
  },
});
