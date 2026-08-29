import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: repositoryRoot,
  plugins: [react()],
  // This harness renders shared production components outside either app
  // shell. Pin the EP identity explicitly so profession-aware imports retain
  // the same fail-closed build contract as a real bundle.
  define: {
    'import.meta.env.VITE_PROFESSION': JSON.stringify('exercise-physiology'),
    'import.meta.env.VITE_BASE44_APP_ID': JSON.stringify('local-assesssuite'),
  },
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
