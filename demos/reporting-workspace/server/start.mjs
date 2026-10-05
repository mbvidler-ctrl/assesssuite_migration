// Start the reporting-workflow demo API.
//
//   node demos/reporting-workspace/server/start.mjs [--port 8791] [--db <path>] [--reset]
//
// The store lives at demos/reporting-workspace/data/demo.sqlite (git-ignored)
// and is seeded with the synthetic dataset on first start or after --reset.
// The server never contacts an AI provider and never touches the live
// application's database.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDemoHttpServer, listen } from './http.mjs';
import { seedDemoStore } from './seed.mjs';
import { createReportingService } from './service.mjs';
import { openStore } from './store.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { port: Number(process.env.REPORTING_DEMO_PORT || 8791), db: path.join(workspaceRoot, 'data', 'demo.sqlite'), reset: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') options.port = Number(argv[++index]);
    else if (arg === '--db') options.db = path.resolve(argv[++index]);
    else if (arg === '--reset') options.reset = true;
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
fs.mkdirSync(path.dirname(options.db), { recursive: true });
if (options.reset) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(`${options.db}${suffix}`)) fs.unlinkSync(`${options.db}${suffix}`);
  }
}
const store = openStore(options.db);
if (store.isEmpty()) {
  seedDemoStore(store);
  console.log('[reporting-demo] seeded the synthetic dataset');
}
const service = createReportingService({ store, synthetic: true });
const server = createDemoHttpServer({ service, staticDir: path.join(workspaceRoot, 'dist') });
const address = await listen(server, { port: options.port });
console.log(`[reporting-demo] API listening on ${address.baseUrl} (store: ${options.db})`);
console.log('[reporting-demo] synthetic data only; AI drafting is unavailable by design');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
}
