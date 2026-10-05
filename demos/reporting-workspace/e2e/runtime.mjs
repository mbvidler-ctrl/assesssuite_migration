// Boots the seeded demo API with the built workspace for the browser
// walkthrough. Everything is in-process and in-memory; nothing touches the
// live application, its database or any provider.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDemoHttpServer, listen } from '../server/http.mjs';
import { seedDemoStore } from '../server/seed.mjs';
import { createReportingService } from '../server/service.mjs';
import { openStore } from '../server/store.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function startWalkthroughRuntime() {
  const staticDir = path.join(workspaceRoot, 'dist');
  if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    throw new Error('The workspace has not been built. Run `npm run demo:build` in demos/reporting-workspace first.');
  }
  const store = openStore(':memory:');
  const seeded = seedDemoStore(store);
  const service = createReportingService({ store, synthetic: true });
  const server = createDemoHttpServer({ service, staticDir, log: { error: console.error } });
  const { baseUrl } = await listen(server);
  return {
    baseUrl,
    seeded,
    service,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      store.close();
    },
  };
}
