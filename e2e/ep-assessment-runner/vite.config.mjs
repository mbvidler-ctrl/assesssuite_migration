import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: repositoryRoot,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@/api/base44Client',
        replacement: path.resolve(import.meta.dirname, 'mock-base44-client.js'),
      },
      {
        find: '@',
        replacement: path.resolve(repositoryRoot, 'src'),
      },
    ],
  },
  optimizeDeps: {
    entries: ['e2e/ep-assessment-runner/index.html'],
  },
  server: {
    watch: {
      // Playwright writes traces and screenshots beneath the repository root.
      // Ignore those receipts so Vite does not reload the page under test.
      ignored: ['**/output/playwright/**'],
    },
  },
});
