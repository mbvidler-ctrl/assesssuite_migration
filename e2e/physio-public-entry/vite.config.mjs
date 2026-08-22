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
        find: '@/lib/profession',
        replacement: path.resolve(import.meta.dirname, 'mock-profession.js'),
      },
      {
        find: '@',
        replacement: path.resolve(repositoryRoot, 'src'),
      },
    ],
  },
  css: { postcss: repositoryRoot },
  optimizeDeps: {
    entries: ['e2e/physio-public-entry/index.html'],
  },
});
