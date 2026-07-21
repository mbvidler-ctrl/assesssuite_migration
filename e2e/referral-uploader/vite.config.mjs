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
        find: '@/lib/fileIntegrations',
        replacement: path.resolve(import.meta.dirname, 'mock-file-integrations.js'),
      },
      {
        find: '@/lib/AuthContext',
        replacement: path.resolve(import.meta.dirname, 'mock-auth-context.js'),
      },
      {
        find: '@/lib/legal/acceptanceGate',
        replacement: path.resolve(import.meta.dirname, 'mock-acceptance-gate.js'),
      },
      {
        find: '@',
        replacement: path.resolve(repositoryRoot, 'src'),
      },
    ],
  },
  optimizeDeps: {
    entries: ['e2e/referral-uploader/index.html'],
  },
});
