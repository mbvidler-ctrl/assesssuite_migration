// Self-test harness for the local Base44 shim server.
// Spawns server/index.mjs on a free port with SELFTEST=1, exercises the
// contract end to end, and prints one PASS/FAIL line per check. Exits
// non-zero on any failure.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, 'index.mjs');

const results = [];
let failures = 0;

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const status = pass ? 'PASS' : 'FAIL';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[${status}] ${name}${suffix}`);
  if (!pass) failures += 1;
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

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const appId = 'selftest-app';

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

  let serverOutput = '';
  child.stdout.on('data', (d) => {
    serverOutput += d.toString();
  });
  child.stderr.on('data', (d) => {
    serverOutput += d.toString();
  });

  const up = await waitForServer(baseUrl);
  if (!up) {
    console.error('Server failed to start within timeout. Output so far:\n', serverOutput);
    child.kill();
    process.exit(1);
  }

  try {
    await runChecks(baseUrl, appId);
  } catch (err) {
    console.error('Unhandled exception during self-test run:', err);
    failures += 1;
  } finally {
    child.kill();
    await once(child, 'exit').catch(() => {});
  }

  console.log('');
  console.log(`Self-test complete: ${results.length - failures}/${results.length} passed.`);
  if (failures > 0) {
    console.log(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// HTTP helpers
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
  return { status: res.status, body: json, res };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function runChecks(baseUrl, appId) {
  // --- Public settings ---
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/public/prod/public-settings/by-id/${appId}`);
    record(
      'public-settings returns 200 with {id, public_settings}',
      status === 200 && body?.id === appId && typeof body?.public_settings === 'object',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- Telemetry stubs ---
  {
    const res = await fetch(`${baseUrl}/api/apps/${appId}/analytics/track/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Id': appId },
      body: JSON.stringify({ events: [] }),
    });
    record('analytics track/batch returns 204', res.status === 204, `status=${res.status}`);
  }
  {
    const res = await fetch(`${baseUrl}/app-logs/${appId}/log-user-in-app/Dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Id': appId },
      body: JSON.stringify({ page: 'Dashboard' }),
    });
    record('app-logs log-user-in-app returns 204', res.status === 204, `status=${res.status}`);
  }

  // --- Admin bootstrap login ---
  let adminToken = null;
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@local.test', password: 'change-me-local' },
    });
    adminToken = body?.access_token;
    record(
      'bootstrap admin can log in',
      status === 200 && Boolean(adminToken) && body?.user?.role === 'admin',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- Register -> verify-otp -> me round trip ---
  const testEmail = `selftest-user-${Date.now()}@example.com`;
  let userToken = null;
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/auth/register`, {
      method: 'POST',
      body: { email: testEmail, password: 'correct-horse-battery-staple' },
    });
    record('register accepts new user', status === 200, `status=${status} body=${JSON.stringify(body)}`);
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email: testEmail, otp_code: '000000' },
    });
    userToken = body?.access_token;
    record(
      'verify-otp accepts mock code 000000',
      status === 200 && Boolean(userToken),
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
      token: userToken,
    });
    record(
      'register->login->me round trip returns correct email, no password fields',
      status === 200 && body?.email === testEmail && !('password_hash' in (body || {})) && !('salt' in (body || {})),
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- updateMe field guard ---
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
      method: 'PUT',
      token: userToken,
      body: { role: 'admin', full_name: 'Updated Name' },
    });
    record(
      'updateMe rejects role escalation but allows other fields',
      status === 200 && body?.role !== 'admin' && body?.full_name === 'Updated Name',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
      token: userToken,
    });
    record(
      'updateMe field guard persisted (role still user after reload)',
      status === 200 && body?.role === 'user',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- Entity CRUD (Exercise: no org_id) ---
  let exerciseId = null;
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise`, {
      method: 'POST',
      token: adminToken,
      body: { name: 'Squat', category: 'strength', difficulty_level: 'beginner' },
    });
    exerciseId = body?.id;
    record(
      'entity create (Exercise) returns record with id/created_date',
      status === 200 && Boolean(exerciseId) && Boolean(body?.created_date),
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise`, {
      token: adminToken,
    });
    record(
      'entity list (Exercise) includes created record',
      status === 200 && Array.isArray(body) && body.some((r) => r.id === exerciseId),
      `status=${status} count=${Array.isArray(body) ? body.length : 'n/a'}`,
    );
  }
  {
    // Create a second exercise to test $in / sort / limit.
    await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise`, {
      method: 'POST',
      token: adminToken,
      body: { name: 'Lunge', category: 'strength', difficulty_level: 'intermediate' },
    });
    const q = encodeURIComponent(JSON.stringify({ difficulty_level: { $in: ['beginner', 'intermediate'] } }));
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/entities/Exercise?q=${q}&sort=-name&limit=1`,
      { token: adminToken },
    );
    record(
      'entity filter ($in, -sort, limit) works',
      status === 200 && Array.isArray(body) && body.length === 1 && body[0].name === 'Squat',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise/${exerciseId}`, {
      token: adminToken,
    });
    record('entity get by id (Exercise)', status === 200 && body?.id === exerciseId, `status=${status}`);
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise/${exerciseId}`, {
      method: 'PUT',
      token: adminToken,
      body: { category: 'mobility' },
    });
    record(
      'entity update by id (Exercise)',
      status === 200 && body?.category === 'mobility' && body?.name === 'Squat',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise/${exerciseId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    record('entity delete by id (Exercise)', status === 200, `status=${status} body=${JSON.stringify(body)}`);
  }
  {
    const { status } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise/${exerciseId}`, {
      token: adminToken,
    });
    record('deleted entity no longer retrievable', status === 404, `status=${status}`);
  }

  // --- Dot-path filter test (ClientAssessment.additional_data.foo) ---
  {
    const { body: created } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise`, {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Dot Path Probe',
        category: 'strength',
        // additional_data is not a real Exercise field, but the JSON blob
        // accepts arbitrary keys, which is sufficient to exercise dot-path
        // matching against nested structures.
        nested: { child: { flag: true } },
      },
    });
    const q = encodeURIComponent(JSON.stringify({ 'nested.child.flag': true }));
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise?q=${q}`, {
      token: adminToken,
    });
    record(
      'entity filter supports dot-path nested fields',
      status === 200 && Array.isArray(body) && body.some((r) => r.id === created.id),
      `status=${status} body=${JSON.stringify(body)}`,
    );
    // Clean up.
    await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise/${created.id}`, {
      method: 'DELETE',
      token: adminToken,
    });
  }

  // --- bulkCreate ---
  let bulkIds = [];
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise/bulk`, {
      method: 'POST',
      token: adminToken,
      body: [
        { name: 'Bulk A', category: 'cardio' },
        { name: 'Bulk B', category: 'cardio' },
      ],
    });
    bulkIds = Array.isArray(body) ? body.map((r) => r.id) : [];
    record(
      'bulkCreate (POST base/bulk) creates multiple records',
      status === 200 && bulkIds.length === 2,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- DELETE-with-body deleteMany ---
  {
    const res = await fetch(`${baseUrl}/api/apps/${appId}/entities/Exercise`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': appId,
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ category: 'cardio' }),
    });
    const body = await res.json().catch(() => null);
    record(
      'DELETE-with-body deleteMany removes matching records',
      res.status === 200 && body?.deleted === 2,
      `status=${res.status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Exercise`, {
      token: adminToken,
    });
    record(
      'entities removed by deleteMany are gone from list',
      status === 200 && Array.isArray(body) && bulkIds.every((id) => !body.some((r) => r.id === id)),
      `status=${status}`,
    );
  }

  // --- User list as non-admin -> 403, as admin -> 200 ---
  {
    const { status } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User`, {
      token: userToken,
    });
    record('User list as non-admin returns 403', status === 403, `status=${status}`);
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User`, {
      token: adminToken,
    });
    record(
      'User list as admin returns 200 with no password fields',
      status === 200 && Array.isArray(body) && body.every((u) => !('password_hash' in u) && !('salt' in u)),
      `status=${status} count=${Array.isArray(body) ? body.length : 'n/a'}`,
    );
  }

  // --- Org scoping: two orgs, two users, cross-org read denied ---
  let orgAId = null;
  let orgBId = null;
  let userAToken = null;
  let userBToken = null;
  let clientAId = null;
  {
    const { body: orgA } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Organization`, {
      method: 'POST',
      token: adminToken,
      body: { name: 'Org A' },
    });
    const { body: orgB } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Organization`, {
      method: 'POST',
      token: adminToken,
      body: { name: 'Org B' },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const emailA = `org-a-user-${Date.now()}@example.com`;
    const emailB = `org-b-user-${Date.now()}@example.com`;
    await api(baseUrl, appId, `/api/apps/${appId}/auth/register`, {
      method: 'POST',
      body: { email: emailA, password: 'password123456' },
    });
    await api(baseUrl, appId, `/api/apps/${appId}/auth/register`, {
      method: 'POST',
      body: { email: emailB, password: 'password123456' },
    });
    const { body: verifyA } = await api(baseUrl, appId, `/api/apps/${appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email: emailA, otp_code: '000000' },
    });
    const { body: verifyB } = await api(baseUrl, appId, `/api/apps/${appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email: emailB, otp_code: '000000' },
    });
    userAToken = verifyA.access_token;
    userBToken = verifyB.access_token;

    await api(baseUrl, appId, `/api/apps/${appId}/entities/OrganizationMember`, {
      method: 'POST',
      token: adminToken,
      body: { org_id: orgAId, user_email: emailA, role: 'member', is_primary: true },
    });
    await api(baseUrl, appId, `/api/apps/${appId}/entities/OrganizationMember`, {
      method: 'POST',
      token: adminToken,
      body: { org_id: orgBId, user_email: emailB, role: 'member', is_primary: true },
    });

    const { status: createStatus, body: client } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/entities/Client`,
      {
        method: 'POST',
        token: userAToken,
        body: { org_id: orgAId, full_name: 'Org A Client' },
      },
    );
    clientAId = client?.id;
    record('org A user can create a Client scoped to org A', createStatus === 200 && Boolean(clientAId));
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/${clientAId}`, {
      token: userBToken,
    });
    record('org B user reading org A client is denied (404)', status === 404, `status=${status} body=${JSON.stringify(body)}`);
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/${clientAId}`, {
      token: userAToken,
    });
    record(
      'org A user reading own org client succeeds',
      status === 200 && body?.id === clientAId,
      `status=${status}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      token: userBToken,
    });
    record(
      'org B user listing Client does not see org A records',
      status === 200 && Array.isArray(body) && !body.some((r) => r.id === clientAId),
      `status=${status}`,
    );
  }

  // --- Unknown entity / unknown function ---
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/entities/NotARealEntity`, {
      token: adminToken,
    });
    record('unknown entity returns 404', status === 404, `status=${status} body=${JSON.stringify(body)}`);
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/notARealFunction`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    record(
      "unknown function returns 404 {message:'function not found'}",
      status === 404 && body?.message === 'function not found',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
}

main();
