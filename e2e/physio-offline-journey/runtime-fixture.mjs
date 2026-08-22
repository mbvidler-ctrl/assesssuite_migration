import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { loadEntityNames } from '../../server/db.mjs';
import { MOCK_CHECKOUT_PRICE_ID } from '../../server/mocks/stripe.mjs';
import { runCatalogueSeed } from '../../server/seed.mjs';
import {
  createTestStore,
  loginAdmin,
  requestJson,
  startTestServer,
} from '../../server/tests/support/server-harness.mjs';
import { startFakeOpenAIChat } from '../../server/tests/support/fake-openai-chat.mjs';

const PHYSIO_APP_ID = 'local-assesssuite-physio';
const EXPECTED_PHYSIO_ASSESSMENT_COUNT = 236;
const viteChildEntry = fileURLToPath(new URL('./vite-child.mjs', import.meta.url));

function seedPhysioCatalogue(dbPath) {
  const previousProfession = process.env.PROFESSION;
  const previousAppId = process.env.DEFAULT_APP_ID;
  const database = new DatabaseSync(dbPath);
  try {
    database.exec('PRAGMA busy_timeout = 5000;');
    process.env.PROFESSION = 'physio';
    process.env.DEFAULT_APP_ID = PHYSIO_APP_ID;
    runCatalogueSeed({ db: database, entityNames: new Set(loadEntityNames()) });
    const count = Number(
      database.prepare('SELECT COUNT(*) AS count FROM entity_Assessment').get().count,
    );
    if (count !== EXPECTED_PHYSIO_ASSESSMENT_COUNT) {
      throw new Error(
        `Offline Physio catalogue expected ${EXPECTED_PHYSIO_ASSESSMENT_COUNT} assessments; found ${count}`,
      );
    }
  } finally {
    database.close();
    if (previousProfession === undefined) delete process.env.PROFESSION;
    else process.env.PROFESSION = previousProfession;
    if (previousAppId === undefined) delete process.env.DEFAULT_APP_ID;
    else process.env.DEFAULT_APP_ID = previousAppId;
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      listener.close(() => resolve(address.port));
    });
  });
}

async function terminateViteChild(vite) {
  const child = vite?.child;
  if (!child || child.exitCode !== null || !child.pid) return;
  const exited = once(child, 'exit').catch(() => {});
  child.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM');
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await exited;
}

async function startViteChild({ frontendBaseUrl, frontendPort, backendUrl }) {
  const child = spawn(process.execPath, [viteChildEntry], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: {
      ...process.env,
      PHYSIO_OFFLINE_FRONTEND_PORT: String(frontendPort),
      PHYSIO_OFFLINE_BACKEND_URL: backendUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let childError = null;
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  child.on('error', (error) => { childError = error; });

  const expectedListener = `[physio-offline-vite] listening on ${frontendBaseUrl}`;
  const deadline = Date.now() + 30_000;
  try {
    while (Date.now() < deadline) {
      if (childError) throw childError;
      if (child.exitCode !== null) {
        throw new Error(`offline Physio Vite child exited before readiness (${child.exitCode})`);
      }
      if (output.split(/\r?\n/).includes(expectedListener)) {
        const response = await fetch(frontendBaseUrl);
        if (response.status === 200) return { child, getOutput: () => output };
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('offline Physio Vite child did not become ready within 30000ms');
  } catch (error) {
    await terminateViteChild({ child });
    throw new Error(`${error.message}\nVite output:\n${output}`);
  }
}

function registeredUserId(dbPath, email) {
  const database = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = database.prepare('SELECT id, data FROM entity_User').all();
    const matching = rows.find((row) => {
      try {
        return JSON.parse(row.data)?.email?.toLowerCase() === email.toLowerCase();
      } catch {
        return false;
      }
    });
    if (!matching?.id) throw new Error(`No registered user row exists for ${email}`);
    return matching.id;
  } finally {
    database.close();
  }
}

export async function startOfflinePhysioRuntime() {
  const frontendPort = await getFreePort();
  let backendPort = await getFreePort();
  while (backendPort === frontendPort) backendPort = await getFreePort();
  const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
  const store = createTestStore('assesssuite-physio-offline-browser-');
  const fakeChat = await startFakeOpenAIChat();

  let server = null;
  let vite = null;
  let stopped = false;
  let hasStarted = false;

  const startBackend = async () => {
    server = await startTestServer({
      PROFESSION: 'physio',
      DEFAULT_APP_ID: PHYSIO_APP_ID,
      APP_URL: frontendBaseUrl,
      ALLOW_OPEN_REGISTRATION: '1',
      STRIPE_TRIAL_PERIOD_DAYS: '30',
      OUTBOUND_EMAIL_ENABLED: '0',
      GENERAL_CLINICAL_LLM_ENABLED: '0',
      LLM_REQUIRED: '0',
      OPENAI_API_KEY: 'synthetic-physio-offline-browser-key',
      OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
    }, {
      store,
      startupTimeoutMs: 30_000,
      // The first process deliberately enables the fixed offline OTP. Every
      // reopen disables SELFTEST so openDatabase preserves the caller-owned
      // SQLite file and the journey proves real restart persistence.
      selftest: !hasStarted,
      port: backendPort,
    });

    // startTestServer intentionally creates schema-only databases. Exercise
    // the same catalogue-only seed used in production, rather than injecting
    // browser fixtures or bypassing the repository layer.
    seedPhysioCatalogue(store.dbPath);
    if (server.baseUrl !== `http://127.0.0.1:${backendPort}`) {
      throw new Error(`Offline Physio backend did not bind the reserved port ${backendPort}`);
    }
    hasStarted = true;
  };

  const startProcesses = async () => {
    await startBackend();
    vite = await startViteChild({
      frontendBaseUrl,
      frontendPort,
      backendUrl: server.baseUrl,
    });
  };

  const stopProcesses = async () => {
    const activeVite = vite;
    const activeServer = server;
    vite = null;
    server = null;
    await terminateViteChild(activeVite);
    await activeServer?.stop();
  };

  const restartBackend = async () => {
    const activeServer = server;
    server = null;
    await activeServer?.stop();
    await startBackend();
  };

  try {
    await startProcesses();
  } catch (error) {
    await stopProcesses().catch(() => {});
    await fakeChat.stop().catch(() => {});
    store.cleanup();
    throw error;
  }

  return {
    frontendBaseUrl,
    get server() { return server; },
    get providerCalls() { return [...fakeChat.calls]; },
    async completeCheckout(email) {
      if (!server) throw new Error('The offline Physio backend is not running.');
      const userId = registeredUserId(store.dbPath, email);
      const adminToken = await loginAdmin(server);
      const completion = await requestJson(
        server,
        `/api/apps/${server.appId}/functions/stripeWebhook`,
        {
          method: 'POST',
          token: adminToken,
          body: {
            id: 'evt_physioofflinecheckout',
            created: 1_800_000_005,
            livemode: false,
            type: 'checkout.session.completed',
            data: {
              object: {
                mode: 'subscription',
                payment_status: 'paid',
                customer: `mock_cus_${userId}`,
                subscription: `mock_sub_${userId}`,
                client_reference_id: userId,
                customer_email: email,
                metadata: {
                  appId: server.appId,
                  professionId: 'physio',
                  userId,
                  userEmail: email,
                  priceId: MOCK_CHECKOUT_PRICE_ID,
                },
              },
            },
          },
        },
      );
      if (completion.status !== 200 || completion.body?.received !== true) {
        throw new Error(`Offline checkout completion failed: ${completion.status} ${completion.text}`);
      }
      return { userId, completion: completion.body };
    },
    async entityRows(entityName) {
      if (!server) throw new Error('The offline Physio backend is not running.');
      const database = new DatabaseSync(store.dbPath, { readOnly: true });
      try {
        return database.prepare(`SELECT id, data FROM entity_${entityName}`).all().map((row) => ({
          id: row.id,
          ...JSON.parse(row.data),
        }));
      } finally {
        database.close();
      }
    },
    async restart() {
      if (stopped) throw new Error('The offline Physio runtime has already stopped.');
      await restartBackend();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await stopProcesses().catch(() => {});
      await fakeChat.stop().catch(() => {});
      store.cleanup();
    },
  };
}
