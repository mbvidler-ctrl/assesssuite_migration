import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

/**
 * Thin Vite shells keep the public marketing artifact and authenticated
 * platform artifact structurally separate while reusing the reviewed source.
 */
export function makeAppConfig({ appDir, port, serverPort, outDir, sourcemap = false }) {
  const proxy = serverPort
    ? {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
        '/functions': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(
            /^\/functions\/(.*)/,
            '/api/apps/local-assesssuite/functions/$1',
          ),
        },
        '/uploads': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      }
    : undefined;

  return defineConfig({
    root: appDir,
    envDir: appDir,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.join(repoRoot, 'src'),
      },
    },
    css: { postcss: repoRoot },
    build: {
      outDir: outDir || path.join(appDir, 'dist'),
      emptyOutDir: true,
      sourcemap,
    },
    server: { port, strictPort: true, proxy },
    preview: { port, strictPort: true },
  });
}
