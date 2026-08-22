import { createServer as createViteServer } from 'vite';

import { createPhysioViteConfig } from '../../apps/app-physio/vite.config.js';

const PHYSIO_APP_ID = 'local-assesssuite-physio';
const LOOPBACK_HTTP_URL = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/;

function exactPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError(`${label} must be an integer from 1 to 65535`);
  }
  return port;
}

function proxyFor(target) {
  return {
    '/api': { target, changeOrigin: false },
    '/functions': {
      target,
      changeOrigin: false,
      rewrite: (requestPath) => requestPath.replace(
        /^\/functions\/(.*)/,
        `/api/apps/${PHYSIO_APP_ID}/functions/$1`,
      ),
    },
    '/uploads': { target, changeOrigin: false },
  };
}

const frontendPort = exactPort(process.env.PHYSIO_OFFLINE_FRONTEND_PORT, 'frontend port');
const backendUrl = String(process.env.PHYSIO_OFFLINE_BACKEND_URL || '');
const backendMatch = LOOPBACK_HTTP_URL.exec(backendUrl);
if (!backendMatch || exactPort(backendMatch[1], 'backend port') === frontendPort) {
  throw new TypeError('backend URL must be a distinct exact 127.0.0.1 HTTP port');
}

const physioViteConfig = createPhysioViteConfig();
const vite = await createViteServer({
  ...physioViteConfig,
  configFile: false,
  clearScreen: false,
  logLevel: 'error',
  server: {
    ...(physioViteConfig.server || {}),
    host: '127.0.0.1',
    port: frontendPort,
    strictPort: true,
    hmr: false,
    proxy: proxyFor(backendUrl),
  },
});

await vite.listen();
const address = vite.httpServer?.address();
if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || address.port !== frontendPort) {
  throw new Error('offline Physio Vite child did not prove its exact loopback listener');
}
process.stdout.write(`[physio-offline-vite] listening on http://127.0.0.1:${frontendPort}\n`);
