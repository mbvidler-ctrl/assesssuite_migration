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
    const res = await fetch(`${baseUrl}/api/app-logs/${appId}/log-user-in-app/Dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Id': appId },
      body: JSON.stringify({ page: 'Dashboard' }),
    });
    record(
      'app-logs log-user-in-app returns 204 at the SDK-true /api-prefixed path',
      res.status === 204,
      `status=${res.status}`,
    );
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
  let emailA = null;
  let emailB = null;
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

    emailA = `org-a-user-${Date.now()}@example.com`;
    emailB = `org-b-user-${Date.now()}@example.com`;
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

    // OTP verification no longer activates accounts (approval is an admin
    // decision). Approve both fixtures the way the product now does it:
    // an admin User-entity update, as AdminApprovals performs.
    const { body: allUsers } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User`, {
      token: adminToken,
    });
    for (const email of [emailA, emailB]) {
      const fixtureUser = (allUsers || []).find((u) => u.email === email);
      if (fixtureUser) {
        await api(baseUrl, appId, `/api/apps/${appId}/entities/User/${fixtureUser.id}`, {
          method: 'PUT',
          token: adminToken,
          body: { account_status: 'active' },
        });
      }
    }

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

  // --- Hard gates: anonymous writes refused; approval gate enforced ---
  {
    const { status } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      method: 'POST',
      body: { full_name: 'Anonymous Injection Attempt' },
    });
    record('anonymous entity create is refused (401)', status === 401, `status=${status}`);
  }
  {
    const { status } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/${clientAId}`, {
      method: 'PUT',
      body: { full_name: 'Anonymous Tamper' },
    });
    record('anonymous entity update is refused (401)', status === 401, `status=${status}`);
  }
  {
    const { status } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/bulk`, {
      method: 'POST',
      body: [{ full_name: 'Anonymous Bulk' }],
    });
    record('anonymous bulk create is refused (401)', status === 401, `status=${status}`);
  }
  {
    // A registered-but-unapproved (pending) user: clinical entities refused
    // outright; setup entities writable; approval then unlocks access.
    const pendingEmail = `pending-user-${Date.now()}@example.com`;
    await api(baseUrl, appId, `/api/apps/${appId}/auth/register`, {
      method: 'POST',
      body: { email: pendingEmail, password: 'password123456' },
    });
    const { body: verifyPending } = await api(baseUrl, appId, `/api/apps/${appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email: pendingEmail, otp_code: '000000' },
    });
    const pendingToken = verifyPending?.access_token;
    record(
      'verify-otp leaves a new account pending (email verified, not activated)',
      Boolean(pendingToken),
      `token=${Boolean(pendingToken)}`,
    );

    const { status: clinicalReadStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      token: pendingToken,
    });
    record('pending user reading a clinical entity is refused (403)', clinicalReadStatus === 403, `status=${clinicalReadStatus}`);

    const { status: clinicalWriteStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/SOAPNote`, {
      method: 'POST',
      token: pendingToken,
      body: { note_name: 'Pending user probe' },
    });
    record('pending user writing a clinical entity is refused (403)', clinicalWriteStatus === 403, `status=${clinicalWriteStatus}`);

    const { status: setupWriteStatus, body: pendingOrg } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Organization`, {
      method: 'POST',
      token: pendingToken,
      body: { name: 'Pending User Clinic' },
    });
    record('pending user may still create setup entities (Organization)', setupWriteStatus === 200 && Boolean(pendingOrg?.id), `status=${setupWriteStatus}`);

    const { status: catalogueStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Assessment`, {
      token: pendingToken,
    });
    record('pending user may still read the assessment catalogue', catalogueStatus === 200, `status=${catalogueStatus}`);

    // Self-activation via updateMe must be stripped.
    await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
      method: 'PUT',
      token: pendingToken,
      body: { account_status: 'active', clinician_name: 'Pending Probe' },
    });
    const { body: meAfter } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
      token: pendingToken,
    });
    record(
      'updateMe strips self-service account_status changes',
      meAfter?.account_status === 'pending' && meAfter?.clinician_name === 'Pending Probe',
      `account_status=${meAfter?.account_status}`,
    );

    // Clinical functions refused while pending.
    const { status: fnStatus } = await api(baseUrl, appId, `/api/apps/${appId}/functions/transcribeSession`, {
      method: 'POST',
      token: pendingToken,
      body: { action: 'transcribe', audio_url: '/uploads/probe.webm' },
    });
    record('pending user calling a clinical function is refused (403)', fnStatus === 403, `status=${fnStatus}`);

    // Admin approval unlocks clinical access (the AdminApprovals path).
    const { body: usersForApproval } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User`, {
      token: adminToken,
    });
    const pendingUserRecord = (usersForApproval || []).find((u) => u.email === pendingEmail);
    await api(baseUrl, appId, `/api/apps/${appId}/entities/User/${pendingUserRecord.id}`, {
      method: 'PUT',
      token: adminToken,
      body: { account_status: 'active' },
    });
    const { status: postApprovalStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      token: pendingToken,
    });
    record('admin approval unlocks clinical entity access', postApprovalStatus === 200, `status=${postApprovalStatus}`);
  }
  {
    // Payment-failure recovery: a suspended account is restored to active by
    // a successful checkout (the one billing event permitted to touch
    // account_status); a pending account never is (asserted above).
    const suspendedEmail = `suspended-user-${Date.now()}@example.com`;
    await api(baseUrl, appId, `/api/apps/${appId}/auth/register`, {
      method: 'POST',
      body: { email: suspendedEmail, password: 'password123456' },
    });
    const { body: allUsersNow } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User`, {
      token: adminToken,
    });
    const suspendedUser = (allUsersNow || []).find((u) => u.email === suspendedEmail);
    await api(baseUrl, appId, `/api/apps/${appId}/entities/User/${suspendedUser.id}`, {
      method: 'PUT',
      token: adminToken,
      body: { account_status: 'suspended' },
    });
    // Mock-mode stripeWebhook requires an admin session (no signature to
    // verify, no real Stripe origin — the anonymous path was an account
    // suspend/entitlement primitive).
    await api(baseUrl, appId, `/api/apps/${appId}/functions/stripeWebhook`, {
      method: 'POST',
      token: adminToken,
      body: {
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: suspendedUser.id,
            customer: 'mock_cus_restore',
            subscription: 'mock_sub_restore',
            customer_email: suspendedEmail,
          },
        },
      },
    });
    const { body: restored } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/${suspendedUser.id}`, {
      token: adminToken,
    });
    record(
      'successful payment restores a suspended account to active',
      restored?.account_status === 'active' && restored?.subscription_status === 'active',
      `account_status=${restored?.account_status}`,
    );
    // Anonymous mock-mode webhook is refused.
    const { status: anonWebhookStatus } = await api(baseUrl, appId, `/api/apps/${appId}/functions/stripeWebhook`, {
      method: 'POST',
      body: { type: 'customer.subscription.deleted', data: { object: { metadata: { userId: suspendedUser.id } } } },
    });
    record('anonymous mock stripeWebhook is refused (401)', anonWebhookStatus === 401, `status=${anonWebhookStatus}`);
    // Anonymous invite-user is refused (was an anonymous admin-mint primitive).
    const { status: anonInviteStatus } = await api(baseUrl, appId, `/api/apps/${appId}/users/invite-user`, {
      method: 'POST',
      body: { user_email: `anon-invite-${Date.now()}@example.com`, role: 'admin' },
    });
    record('anonymous invite-user is refused (401)', anonInviteStatus === 401, `status=${anonInviteStatus}`);
    // Cross-tenant org_id injection on create is refused for a non-admin.
    const { status: injectStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      method: 'POST',
      token: userAToken,
      body: { org_id: orgBId, full_name: 'Cross-tenant Injection' },
    });
    record('cross-tenant org_id injection on create is refused (403)', injectStatus === 403, `status=${injectStatus}`);
    // A non-admin create without org_id is auto-scoped to the caller's org.
    const { status: autoStatus, body: autoClient } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      method: 'POST',
      token: userAToken,
      body: { full_name: 'Auto-scoped Client' },
    });
    record('non-admin create auto-scopes org_id to the caller org',
      autoStatus === 200 && autoClient?.org_id === orgAId, `status=${autoStatus} org_id=${autoClient?.org_id}`);
    // Anonymous entity read is refused (tenant/catalogue enumeration closed).
    const { status: anonReadStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Organization`);
    record('anonymous entity read is refused (401)', anonReadStatus === 401, `status=${anonReadStatus}`);
    // A non-admin cannot read another tenant's Organization by id.
    const { status: crossOrgStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Organization/${orgBId}`, {
      token: userAToken,
    });
    record('cross-tenant Organization read is refused (404)', crossOrgStatus === 404, `status=${crossOrgStatus}`);
    // Anonymous checkout function is refused.
    const { status: anonCheckoutStatus } = await api(baseUrl, appId, `/api/apps/${appId}/functions/createCheckoutSession`, {
      method: 'POST',
      body: { plan: 'monthly' },
    });
    record('anonymous createCheckoutSession is refused (401)', anonCheckoutStatus === 401, `status=${anonCheckoutStatus}`);

    // --- Second-pass regressions: sibling write paths of the org_id fix ---
    // Self-enrolment into an existing populated foreign org must be refused
    // (org B already has userB), else any user joins any tenant by id.
    const { status: joinStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/OrganizationMember`, {
      method: 'POST',
      token: userAToken,
      body: { user_email: emailA, org_id: orgBId },
    });
    record('self-enrolment into an existing foreign org is refused (403)', joinStatus === 403, `status=${joinStatus}`);
    // Founding membership into a brand-new empty org is allowed (ProfileSetup).
    const { body: newOrg } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Organization`, {
      method: 'POST', token: userAToken, body: { name: `Founded by A ${Date.now()}` },
    });
    const { status: foundStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/OrganizationMember`, {
      method: 'POST', token: userAToken, body: { user_email: emailA, org_id: newOrg.id, is_primary: false },
    });
    record('founding a membership in a new empty org is allowed', foundStatus === 200, `status=${foundStatus}`);
    // bulkUpdate must not relocate an own record into a foreign org.
    const { body: ownClient } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client`, {
      method: 'POST', token: userAToken, body: { full_name: 'Bulk Relocate Probe' },
    });
    const { status: bulkPutStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/bulk`, {
      method: 'PUT', token: userAToken, body: [{ id: ownClient.id, org_id: orgBId }],
    });
    record('bulkUpdate relocating a record to a foreign org is refused (403)', bulkPutStatus === 403, `status=${bulkPutStatus}`);
    // bulkUpdate must not edit a foreign record by id.
    const { status: bulkForeignStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/bulk`, {
      method: 'PUT', token: userBToken, body: [{ id: ownClient.id, full_name: 'edited by B' }],
    });
    record('bulkUpdate editing a foreign record by id is refused (404)', bulkForeignStatus === 404, `status=${bulkForeignStatus}`);
    // update-many PATCH must not relocate matched records into a foreign org.
    const { status: patchStatus } = await api(baseUrl, appId, `/api/apps/${appId}/entities/Client/update-many`, {
      method: 'PATCH', token: userAToken, body: { query: {}, data: { org_id: orgBId } },
    });
    record('update-many relocating records to a foreign org is refused (403)', patchStatus === 403, `status=${patchStatus}`);
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

  // ---------------------------------------------------------------------
  // Ported functions (base44/functions/*/entry.ts) + transcribeSession mock
  // ---------------------------------------------------------------------

  const PORTED_FUNCTION_NAMES = [
    'assignOrganizations',
    'auditAssessmentIssues',
    'createCheckoutSession',
    'createMissingAssessments',
    'createPortalSession',
    'createTestClientWithAssessments',
    'enableMissingTestRunners',
    'fixHasTestRunnerFlags',
    'fixMissingOrgIds',
    'fixUserOrganizations',
    'getComorbidityReport',
    'getMissingTestRunners',
    'stripeWebhook',
    'syncStripeSubscription',
    'verifyTestAssessmentData',
    'transcribeSession',
  ];

  // --- every ported function name responds (not the router's 404) ---
  for (const functionName of PORTED_FUNCTION_NAMES) {
    let requestBody = {};
    if (functionName === 'stripeWebhook') requestBody = { type: 'unrecognised.event.type', data: { object: {} } };
    if (functionName === 'transcribeSession') requestBody = { action: 'transcribe', audio_url: '/uploads/probe.webm' };
    if (functionName === 'createPortalSession') requestBody = { stripeCustomerId: null };

    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/${functionName}`, {
      method: 'POST',
      token: adminToken,
      body: requestBody,
    });
    record(
      `function ${functionName} responds (not router 404)`,
      !(status === 404 && body?.message === 'function not found'),
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- getComorbidityReport: 403 for non-admin, 200 for admin ---
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/getComorbidityReport`, {
      method: 'POST',
      token: userToken,
      body: {},
    });
    record(
      'getComorbidityReport returns 403 for non-admin',
      status === 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/getComorbidityReport`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    record(
      'getComorbidityReport returns 200 for admin',
      status === 200 && Array.isArray(body?.comorbidities),
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- G6 remediation: admin-only maintenance functions -----------------
  // auditAssessmentIssues, createTestClientWithAssessments, and
  // verifyTestAssessmentData are ported without an auth check in the
  // captured Base44 source (a live-platform security defect recorded in
  // docs/qa/20260703-role-entitlement-isolation-analysis.md). The shim
  // hardens each with an admin-role guard; these checks confirm the guard
  // is present (403 for non-admin) and does not block legitimate admin use
  // (non-403 for admin).
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/auditAssessmentIssues`, {
      method: 'POST',
      token: userToken,
      body: {},
    });
    record(
      'auditAssessmentIssues returns 403 for non-admin',
      status === 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/auditAssessmentIssues`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    record(
      'auditAssessmentIssues proceeds (non-403) for admin',
      status !== 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/functions/createTestClientWithAssessments`,
      { method: 'POST', token: userToken, body: {} },
    );
    record(
      'createTestClientWithAssessments returns 403 for non-admin',
      status === 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/functions/createTestClientWithAssessments`,
      { method: 'POST', token: adminToken, body: {} },
    );
    record(
      'createTestClientWithAssessments proceeds (non-403) for admin',
      status !== 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/verifyTestAssessmentData`, {
      method: 'POST',
      token: userToken,
      body: {},
    });
    record(
      'verifyTestAssessmentData returns 403 for non-admin',
      status === 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/verifyTestAssessmentData`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    record(
      'verifyTestAssessmentData proceeds (non-403) for admin',
      status !== 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    // Found on review 2026-07-04: getMissingTestRunners was missed in the
    // initial G6 hardening pass (captured source has no auth check of any
    // kind, not even auth.me()). Guard added; asserted here alongside its
    // three siblings.
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/getMissingTestRunners`, {
      method: 'POST',
      token: userToken,
      body: {},
    });
    record(
      'getMissingTestRunners returns 403 for non-admin',
      status === 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/functions/getMissingTestRunners`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    record(
      'getMissingTestRunners proceeds (non-403) for admin',
      status !== 403,
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // ---------------------------------------------------------------------
  // Mocked Stripe flow, end to end: checkout -> webhook -> sync
  // ---------------------------------------------------------------------
  {
    const stripeEmail = `stripe-selftest-${Date.now()}@example.com`;

    const { body: registerBody } = await api(baseUrl, appId, `/api/apps/${appId}/auth/register`, {
      method: 'POST',
      body: { email: stripeEmail, password: 'stripe-selftest-password-1' },
    });
    const stripeUserId = registerBody?.user_id;

    // 1. createCheckoutSession returns a url.
    const { status: checkoutStatus, body: checkoutBody } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/functions/createCheckoutSession`,
      { method: 'POST', token: adminToken, body: { userEmail: stripeEmail, userId: stripeUserId } },
    );
    record(
      'createCheckoutSession returns a url',
      checkoutStatus === 200 && typeof checkoutBody?.url === 'string' && checkoutBody.url.length > 0,
      `status=${checkoutStatus} body=${JSON.stringify(checkoutBody)}`,
    );

    // 2. Posting a checkout.session.completed webhook event sets the User
    // entitlement fields (account_status, subscription_status,
    // stripe_customer_id, stripe_subscription_id, subscription_start_date).
    const mockCustomerId = `mock_cus_selftest_${Date.now()}`;
    const mockSubscriptionId = `mock_sub_selftest_${Date.now()}`;
    const { status: webhookStatus, body: webhookBody } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/functions/stripeWebhook`,
      {
        method: 'POST',
        token: adminToken,
        body: {
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: mockCustomerId,
              subscription: mockSubscriptionId,
              client_reference_id: stripeUserId,
              customer_email: stripeEmail,
            },
          },
        },
      },
    );
    record(
      'stripeWebhook checkout.session.completed accepted',
      webhookStatus === 200 && webhookBody?.received === true,
      `status=${webhookStatus} body=${JSON.stringify(webhookBody)}`,
    );

    const { body: verifyBody } = await api(baseUrl, appId, `/api/apps/${appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email: stripeEmail, otp_code: '000000' },
    });
    const stripeUserToken = verifyBody?.access_token;

    const { status: meStatus, body: meBody } = await api(baseUrl, appId, `/api/apps/${appId}/entities/User/me`, {
      token: stripeUserToken,
    });
    record(
      'stripeWebhook wrote entitlement fields without activating approval',
      meStatus === 200 &&
        // Payment success flips entitlement only; approval (account_status)
        // remains 'pending' until an admin approves — the hard approval gate.
        meBody?.account_status === 'pending' &&
        meBody?.email_verified === true &&
        meBody?.subscription_status === 'active' &&
        meBody?.stripe_customer_id === mockCustomerId &&
        meBody?.stripe_subscription_id === mockSubscriptionId &&
        typeof meBody?.subscription_start_date === 'string',
      `status=${meStatus} body=${JSON.stringify(meBody)}`,
    );

    // 3. syncStripeSubscription reflects the mock store.
    const { status: syncStatus, body: syncBody } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/functions/syncStripeSubscription`,
      { method: 'POST', token: stripeUserToken, body: {} },
    );
    record(
      'syncStripeSubscription reconciles from the mock Stripe store',
      syncStatus === 200 &&
        syncBody?.success === true &&
        syncBody?.data?.stripe_customer_id === mockCustomerId &&
        syncBody?.data?.stripe_subscription_id === mockSubscriptionId,
      `status=${syncStatus} body=${JSON.stringify(syncBody)}`,
    );
  }

  // ---------------------------------------------------------------------
  // Core integration endpoints
  // ---------------------------------------------------------------------

  // --- InvokeLLM without response_json_schema -> raw string ---
  {
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token: adminToken, body: { prompt: 'Write a short clinical note.' } },
    );
    record(
      'InvokeLLM without response_json_schema returns a raw string',
      status === 200 && typeof body === 'string' && body.length > 0,
      `status=${status} typeof body=${typeof body}`,
    );
  }

  // --- InvokeLLM with response_json_schema -> schema-shaped object ---
  {
    const schema = {
      type: 'object',
      properties: {
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              medication_name: { type: 'string' },
              alert_text: { type: 'string' },
            },
            required: ['medication_name', 'alert_text'],
          },
        },
      },
      required: ['alerts'],
    };
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token: adminToken, body: { prompt: 'Give medication alerts', response_json_schema: schema } },
    );
    record(
      'InvokeLLM with response_json_schema returns the schema-shaped object directly',
      status === 200 &&
        Array.isArray(body?.alerts) &&
        body.alerts.length > 0 &&
        typeof body.alerts[0].medication_name === 'string' &&
        typeof body.alerts[0].alert_text === 'string',
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }

  // --- SendEmail / SendSMS happy path ---
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/integration-endpoints/Core/SendEmail`, {
      method: 'POST',
      token: adminToken,
      body: { to: 'selftest@example.com', subject: 'Selftest', body: 'Body text' },
    });
    record('SendEmail returns a success shape', status === 200 && Boolean(body), `status=${status} body=${JSON.stringify(body)}`);
  }
  {
    const { status, body } = await api(baseUrl, appId, `/api/apps/${appId}/integration-endpoints/Core/SendSMS`, {
      method: 'POST',
      token: adminToken,
      body: { to: '+61400000000', body: 'Text message' },
    });
    record('SendSMS returns a success shape', status === 200 && Boolean(body), `status=${status} body=${JSON.stringify(body)}`);
  }

  // --- GenerateImage happy path ---
  {
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/integration-endpoints/Core/GenerateImage`,
      { method: 'POST', token: adminToken, body: { prompt: 'a cat' } },
    );
    record('GenerateImage returns {url}', status === 200 && typeof body?.url === 'string', `status=${status} body=${JSON.stringify(body)}`);
  }

  // --- UploadFile round trip through the served /uploads/ URL ---
  let uploadedFileUrl = null;
  {
    const boundary = `----selftestBoundary${Date.now()}`;
    const fileContent = 'selftest upload content';
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="selftest.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--\r\n`;
    const res = await fetch(`${baseUrl}/api/apps/${appId}/integration-endpoints/Core/UploadFile`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'X-App-Id': appId, Authorization: `Bearer ${adminToken}` },
      body: multipartBody,
    });
    const body = await res.json().catch(() => null);
    uploadedFileUrl = body?.file_url;
    record(
      'UploadFile stores the file and returns {file_url}',
      res.status === 200 && typeof uploadedFileUrl === 'string' && uploadedFileUrl.startsWith('/uploads/'),
      `status=${res.status} body=${JSON.stringify(body)}`,
    );

    if (uploadedFileUrl) {
      const servedRes = await fetch(`${baseUrl}${uploadedFileUrl}`);
      const servedText = await servedRes.text().catch(() => '');
      record(
        'uploaded file is retrievable via the served /uploads/ URL',
        servedRes.status === 200 && servedText === fileContent,
        `status=${servedRes.status} text=${JSON.stringify(servedText)}`,
      );
    }
  }

  // --- ExtractDataFromUploadedFile happy path ---
  {
    const schema = {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        comorbidities: { type: 'array', items: { type: 'string' } },
      },
    };
    const { status, body } = await api(
      baseUrl,
      appId,
      `/api/apps/${appId}/integration-endpoints/Core/ExtractDataFromUploadedFile`,
      { method: 'POST', token: adminToken, body: { file_url: uploadedFileUrl, json_schema: schema } },
    );
    record(
      'ExtractDataFromUploadedFile returns {status, output} honouring json_schema',
      status === 200 &&
        body?.status === 'success' &&
        typeof body?.output?.full_name === 'string' &&
        Array.isArray(body?.output?.comorbidities),
      `status=${status} body=${JSON.stringify(body)}`,
    );
  }
}

main();
