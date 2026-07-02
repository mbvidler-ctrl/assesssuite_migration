// End-to-end smoke test for the local Base44 shim.
//
// Run: node scripts/smoke.mjs
// Targets a base URL from env SMOKE_URL, defaulting to http://localhost:8799
// (an ephemeral/other port — never the lead's live shim on 8787, and never
// Vite's 5173).
//
// Sequence:
//   1. Boot a fresh shim (server/index.mjs) with SELFTEST=1 against a
//      throwaway server/data/selftest.db, on the port derived from
//      SMOKE_URL (or an explicit PORT env override).
//   2. Seed that same, now-open db file via server/seed.mjs's exported
//      runSeed({ db, entityNames }), using a second, independent
//      node:sqlite DatabaseSync handle onto the identical file (WAL mode
//      permits this — verified: a concurrent writer is visible to the
//      server's own repository reads on the next request with no caching
//      in between). This deliberately does NOT spawn `node server/seed.mjs`
//      as a second process: that entry point calls openDatabase() itself,
//      which — under SELFTEST=1 — unconditionally deletes and recreates the
//      db file (server/db.mjs), and a second process attempting that delete
//      while the just-spawned server still holds the file open fails with
//      EPERM on Windows (the same hazard already documented in
//      server/functions/index.mjs's init() pattern).
//   3. Exercise the seeded shim via HTTP: admin login; org-scoped Client
//      listing as a clinician (asserting only own-org clients return);
//      auth.me; one entity create/read; one functions.invoke
//      (getComorbidityReport as admin -> 200); one integration
//      (InvokeLLM with a schema -> object).
//   4. Print PASS/FAIL per step; exit non-zero on any failure.
//   5. Clean up: stop the spawned server (by PID) and delete the throwaway
//      db file (+ WAL/SHM siblings) it created.
//
// Never binds 8787 (lead's shim) or 5173 (Vite). Synthetic data only.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const serverEntry = path.join(repoRoot, 'server', 'index.mjs');
const seedModulePath = path.join(repoRoot, 'server', 'seed.mjs');
const dbFile = path.join(repoRoot, 'server', 'data', 'selftest.db');

const FORBIDDEN_PORTS = new Set([8787, 5173]);

const results = [];
let failures = 0;

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const status = pass ? 'PASS' : 'FAIL';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[${status}] ${name}${suffix}`);
  if (!pass) failures += 1;
}

function parsePortFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/apps/public/prod/public-settings/by-id/probe`);
      if (res.status === 200) return true;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

function removeThrowawayDbFiles() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const candidate = `${dbFile}${suffix}`;
    if (fs.existsSync(candidate)) {
      try {
        fs.rmSync(candidate);
      } catch (err) {
        console.warn(`[smoke] could not remove ${candidate}: ${err.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function api(baseUrl, appId, methodPath, { method = 'GET', token, body } = {}) {
  const url = `${baseUrl}${methodPath}`;
  const headers = { 'Content-Type': 'application/json', 'X-App-Id': appId };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const smokeUrl = process.env.SMOKE_URL || 'http://localhost:8799';
  let port = parsePortFromUrl(smokeUrl);
  if (!port || FORBIDDEN_PORTS.has(port)) {
    console.error(
      `[smoke] SMOKE_URL port ${port} is not permitted (must avoid the lead's shim on 8787 ` +
        `and Vite on 5173); falling back to an ephemeral port.`,
    );
    port = await getFreePort();
  }
  const baseUrl = `http://localhost:${port}`;
  const appId = 'smoke-test-app';

  // Always start from a clean throwaway db file — this script owns it
  // exclusively and never touches server/data/app.db.
  removeThrowawayDbFiles();

  console.log(`[smoke] starting shim on ${baseUrl} (SELFTEST=1, throwaway db)`);
  const child = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      SELFTEST: '1',
      PORT: String(port),
      ADMIN_EMAIL: 'admin@local.test',
      ADMIN_PASSWORD: 'change-me-local',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const childPid = child.pid;

  let serverOutput = '';
  child.stdout.on('data', (d) => {
    serverOutput += d.toString();
  });
  child.stderr.on('data', (d) => {
    serverOutput += d.toString();
  });

  let exitCode = 0;

  async function cleanup() {
    // Stop only the process this script started, verified by PID.
    if (childPid && !child.killed) {
      try {
        process.kill(childPid, 0); // throws if the PID no longer exists
        child.kill();
        // Wait for the child's actual exit event rather than racing it
        // against a setTimeout: a dangling timer handle left over from a
        // won race, torn down under a subsequent process.exit(), is what
        // trips libuv's Windows async-handle assertion on shutdown.
        const exitTimeoutMs = 5000;
        let timeoutHandle;
        const timeout = new Promise((resolve) => {
          timeoutHandle = setTimeout(resolve, exitTimeoutMs);
        });
        await Promise.race([once(child, 'exit'), timeout]);
        clearTimeout(timeoutHandle);
        console.log(`[smoke] stopped spawned shim (pid ${childPid})`);
      } catch {
        // already exited
      }
    }
    removeThrowawayDbFiles();
    console.log('[smoke] removed throwaway selftest db files');
  }

  try {
    const up = await waitForServer(baseUrl);
    if (!up) {
      console.error('[smoke] server failed to start within timeout. Output so far:\n', serverOutput);
      process.exitCode = 1;
      await cleanup();
      return;
    }
    record('shim server started on ephemeral port', true, `pid=${childPid} url=${baseUrl}`);

    // -----------------------------------------------------------------
    // Seed the now-open throwaway db via a second, independent
    // DatabaseSync handle onto the same file (see header comment for why
    // this is NOT a spawned `node server/seed.mjs` process).
    // -----------------------------------------------------------------
    let seedResult = null;
    try {
      const db = new DatabaseSync(dbFile);
      db.exec('PRAGMA journal_mode = WAL;');
      // entityNames: derive the same way server/db.mjs does, by reading the
      // captured schema file directly (avoids re-importing db.mjs's
      // openDatabase(), which would attempt to wipe the file again).
      const schemaPath = path.join(
        repoRoot,
        'docs',
        'source-capture',
        '20260702-live-entity-schemas.json',
      );
      const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const entityNames = new Set(schemaJson.schemas.map((entry) => entry.entity_name));

      const seedModuleUrl = pathToFileURL(seedModulePath).href;
      const { runSeed } = await import(seedModuleUrl);
      seedResult = runSeed({ db, entityNames });
      db.close();
      record('seeder (runSeed) populated the throwaway db', true, `log lines=${seedResult.log.length}`);
    } catch (err) {
      record('seeder (runSeed) populated the throwaway db', false, err.stack || err.message);
      throw err;
    }

    const { admin, users, clients } = seedResult;

    // -----------------------------------------------------------------
    // Admin login
    // -----------------------------------------------------------------
    let adminToken = null;
    {
      const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/auth/login`, {
        method: 'POST',
        body: { email: admin.email, password: admin.password },
      });
      adminToken = body?.access_token;
      record(
        'admin login',
        status === 200 && Boolean(adminToken) && body?.user?.role === 'admin',
        `status=${status} body=${JSON.stringify(body)}`,
      );
    }

    // -----------------------------------------------------------------
    // Org-scoped clinician login + Client listing: assert only own-org
    // clients return (G6 tenant isolation).
    // -----------------------------------------------------------------
    let alphaClinicianToken = null;
    {
      const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/auth/login`, {
        method: 'POST',
        body: { email: users.alphaClinician.email, password: 'SeedDemo!2026' },
      });
      alphaClinicianToken = body?.access_token;
      record(
        'Org Alpha clinician login',
        status === 200 && Boolean(alphaClinicianToken),
        `status=${status} body=${JSON.stringify(body)}`,
      );
    }
    {
      const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
        token: alphaClinicianToken,
      });
      const isArray = Array.isArray(body);
      const orgAlphaId = seedResult.organisations.orgAlpha.id;
      const orgBetaId = seedResult.organisations.orgBeta.id;
      const allOwnOrg = isArray && body.every((c) => c.org_id === orgAlphaId);
      const noOtherOrg = isArray && !body.some((c) => c.org_id === orgBetaId);
      const expectedCount = isArray
        ? [clients.graceEllington, clients.tobiasFerreira, clients.simoneOkafor, clients.graceEllingtonDuplicate]
            .every((c) => body.some((r) => r.id === c.id))
        : false;
      record(
        'Client list as Org Alpha clinician returns only own-org clients (G6)',
        status === 200 && isArray && allOwnOrg && noOtherOrg && expectedCount,
        `status=${status} count=${isArray ? body.length : 'n/a'} allOwnOrg=${allOwnOrg} noOtherOrg=${noOtherOrg}`,
      );
    }

    // -----------------------------------------------------------------
    // auth.me
    // -----------------------------------------------------------------
    {
      const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
        token: alphaClinicianToken,
      });
      record(
        'auth.me returns the logged-in clinician, no password fields',
        status === 200 &&
          body?.email === users.alphaClinician.email &&
          !('password_hash' in (body || {})) &&
          !('salt' in (body || {})),
        `status=${status} body=${JSON.stringify(body)}`,
      );
    }

    // -----------------------------------------------------------------
    // One entity create/read (Appointment, scoped to Org Alpha)
    // -----------------------------------------------------------------
    {
      const orgAlphaId = seedResult.organisations.orgAlpha.id;
      const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Appointment`, {
        method: 'POST',
        token: alphaClinicianToken,
        body: {
          org_id: orgAlphaId,
          title: 'Smoke test follow-up',
          client_id: clients.tobiasFerreira.id,
          start_time: '2026-07-10T09:00:00.000Z',
          end_time: '2026-07-10T09:30:00.000Z',
          status: 'scheduled',
        },
      });
      const createdId = body?.id;
      record(
        'entity create (Appointment) succeeds',
        status === 200 && Boolean(createdId),
        `status=${status} body=${JSON.stringify(body)}`,
      );

      if (createdId) {
        const readBack = await api(
          baseUrl,
          appId,
          `/api/apps/${appId}/entities/Appointment/${createdId}`,
          { token: alphaClinicianToken },
        );
        record(
          'entity read (Appointment) returns the created record',
          readBack.status === 200 && readBack.body?.id === createdId,
          `status=${readBack.status}`,
        );
      }
    }

    // -----------------------------------------------------------------
    // functions.invoke: getComorbidityReport as admin -> 200
    // -----------------------------------------------------------------
    {
      const { status, body } = await api(
        baseUrl,
        appId,
        `/api/apps/${appId}/functions/getComorbidityReport`,
        { method: 'POST', token: adminToken, body: {} },
      );
      record(
        'functions.invoke getComorbidityReport as admin returns 200',
        status === 200 && Array.isArray(body?.comorbidities),
        `status=${status} body=${JSON.stringify(body)}`,
      );
    }

    // -----------------------------------------------------------------
    // Integration: InvokeLLM with a schema -> object
    // -----------------------------------------------------------------
    {
      const schema = {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          risk_flags: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary'],
      };
      const { status, body } = await api(
        baseUrl,
        appId,
        `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`,
        { method: 'POST', body: { prompt: 'Summarise smoke test findings', response_json_schema: schema } },
      );
      record(
        'integration InvokeLLM with response_json_schema returns a schema-shaped object',
        status === 200 && typeof body === 'object' && body !== null && typeof body.summary === 'string',
        `status=${status} body=${JSON.stringify(body)}`,
      );
    }
  } catch (err) {
    console.error('[smoke] unhandled exception during smoke run:', err);
    failures += 1;
  } finally {
    await cleanup();
  }

  console.log('');
  console.log(`Smoke test complete: ${results.length - failures}/${results.length} passed.`);
  if (failures > 0) {
    console.log(`${failures} check(s) FAILED.`);
    exitCode = 1;
  }
  // Setting process.exitCode and letting the event loop drain naturally
  // (rather than calling process.exit()) avoids forcibly tearing down any
  // handle still mid-close on Windows — the root cause of a prior libuv
  // async-handle assertion observed here during child-process cleanup.
  process.exitCode = exitCode;
}

main();
