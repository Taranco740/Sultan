import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve(__dirname, 'electron/main.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve(__dirname, 'electron/preload.ts') } },
  },
  renderer: {
    root: resolve(__dirname),
    envDir: resolve(__dirname, '../..'),
    plugins: [react()],
    resolve: { alias: { '@sultan/shared': resolve(__dirname, '../../packages/shared/src/index.ts') } },
    build: { rollupOptions: { input: resolve(__dirname, 'index.html') } },
  },
});

