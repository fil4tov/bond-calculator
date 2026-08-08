import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '#app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '#pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '#widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
      '#entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '#shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '#assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['node_modules/**', 'e2e/**'],
  },
});
