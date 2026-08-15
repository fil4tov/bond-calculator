import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [mkcert(), react()],
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
  server: {
    host: true,
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000',
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
