import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Standalone Vite shell for the reporting-workflow demo workspace.
//
// It reuses the live application's UI primitives and deterministic clinical
// libraries by read-only alias (`@` -> ../../src) but has its own root,
// Tailwind content globs, PostCSS configuration and API proxy. It never
// composes a profession target and never touches the live shells under
// apps/.

const workspaceRoot = path.resolve(import.meta.dirname);
const repoRoot = path.resolve(workspaceRoot, '..', '..');
const apiPort = Number(process.env.REPORTING_DEMO_PORT || 8791);
const appPort = Number(process.env.REPORTING_DEMO_APP_PORT || 4301);

export default defineConfig({
  root: path.join(workspaceRoot, 'app'),
  envDir: workspaceRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(repoRoot, 'src'),
      '@demo': path.join(workspaceRoot, 'app'),
      '@domain': path.join(workspaceRoot, 'domain'),
    },
  },
  css: { postcss: workspaceRoot },
  server: {
    port: appPort,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false },
    },
  },
  preview: { port: appPort, strictPort: true },
  build: {
    outDir: path.join(workspaceRoot, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
