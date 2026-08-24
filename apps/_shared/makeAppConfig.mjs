import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { composePlatformTarget } from '../../packages/profession-config/index.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const viteImportMetaEnvironment = 'import.meta.env';

/**
 * Thin Vite shells keep the public marketing artifact and authenticated
 * platform artifacts structurally separate while reusing the reviewed source.
 * A clinical shell must declare its exact profession and Base44-compatible app
 * id. The profession registry rejects any cross-target composition before Vite
 * starts, rather than silently falling back to the EP target.
 */
export function makeAppConfig({
  appDir,
  port,
  serverPort,
  professionId,
  appId,
  outDir,
  sourcemap = false,
}) {
  if (!path.isAbsolute(appDir)) {
    throw new TypeError('makeAppConfig appDir must be an absolute shell directory');
  }

  const platformRequested = [serverPort, professionId, appId]
    .some((value) => value !== undefined);
  const target = platformRequested
    ? composePlatformTarget({
        professionId,
        shellId: path.basename(appDir),
        appId,
        port,
        serverPort,
      })
    : null;

  const proxy = target
    ? {
        '/api': {
          target: `http://localhost:${target.serverPort}`,
          // Preserve the browser-facing loopback Host so it continues to
          // agree with Origin at the backend. Public return/reset targets are
          // resolved from that exact pair and must reject a proxy-generated
          // backend Host paired with the frontend Origin.
          changeOrigin: false,
        },
        '/functions': {
          target: `http://localhost:${target.serverPort}`,
          changeOrigin: false,
          rewrite: (requestPath) => requestPath.replace(
            /^\/functions\/(.*)/,
            `/api/apps/${target.appId}/functions/$1`,
          ),
        },
        '/uploads': {
          target: `http://localhost:${target.serverPort}`,
          changeOrigin: false,
        },
      }
    : undefined;

  const targetDefines = target
    ? {
        [`${viteImportMetaEnvironment}.VITE_APP_SURFACE`]: JSON.stringify('platform'),
        [`${viteImportMetaEnvironment}.VITE_PROFESSION`]: JSON.stringify(target.professionId),
        [`${viteImportMetaEnvironment}.VITE_BASE44_APP_ID`]: JSON.stringify(target.appId),
      }
    : {
        [`${viteImportMetaEnvironment}.VITE_APP_SURFACE`]: JSON.stringify('marketing'),
      };

  return defineConfig({
    root: appDir,
    envDir: appDir,
    define: targetDefines,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.join(repoRoot, 'src'),
        '@profession': path.join(repoRoot, 'packages', 'profession-config', 'index.mjs'),
      },
    },
    css: { postcss: repoRoot },
    build: {
      outDir: outDir || path.join(appDir, 'dist'),
      emptyOutDir: true,
      sourcemap,
    },
    server: { port: target?.port ?? port, strictPort: true, proxy },
    preview: { port: target?.port ?? port, strictPort: true },
  });
}
