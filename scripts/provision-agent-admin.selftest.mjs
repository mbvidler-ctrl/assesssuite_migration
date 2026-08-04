// End-to-end verification for scripts/provision-agent-admin.mjs, run against a
// throwaway ISOLATED server (NODE_ENV=test + the explicit gate-DB acknowledgement
// + a temp .db). It never touches app.db, the parity DB, production, or any real
// mailbox — the reset token is read from the throwaway DB the same way
// scripts/pa-e2e-verify.mjs reads its isolated database.
//
// It proves the full sanctioned flow the runbook relies on:
//   invite-user (admin) -> reset-password-request -> reset-password -> login,
// then asserts the provisioned account is a working admin, that it could not log
// in before setting a password, and that re-running the provisioner is
// idempotent (no duplicate account).
//
// Run: node scripts/provision-agent-admin.selftest.mjs

import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(repoRoot, 'server', 'index.mjs');
const provisionScript = path.join(__dirname, 'provision-agent-admin.mjs');

const APP = 'local-assesssuite';
const PORT = Number(process.env.PORT) || 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { email: 'admin@local.test', password: 'change-me-local' };
const TARGET = 'dev.agent@unimatter.com.au';
const TARGET_PW = 'AgentPass!2026';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provision-verify-'));
const dbPath = path.join(tmpDir, 'verify.db');

const childEnv = {
  ...process.env,
  NODE_ENV: 'test',
  ASSESSSUITE_DB_PATH: dbPath,
  ASSESSSUITE_DB_PATH_ACK: 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE',
  ASSESSSUITE_BIND_HOST: '127.0.0.1',
  PORT: String(PORT),
  ADMIN_EMAIL: ADMIN.email,
  ADMIN_PASSWORD: ADMIN.password,
  OUTBOUND_EMAIL_ENABLED: '0',
};

let pass = 0;
let fail = 0;
function check(ok, detail) {
  if (ok) { pass++; console.log(`[PASS] ${detail}`); }
  else { fail++; console.log(`[FAIL] ${detail}`); }
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'X-App-Id': APP };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${pathname}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function login(cred) {
  const res = await api(`/api/apps/${APP}/auth/login`, { method: 'POST', body: cred });
  return res;
}

function readResetToken(email) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare('SELECT data FROM entity_User').all();
    for (const row of rows) {
      const rec = JSON.parse(row.data);
      if ((rec.email || '').toLowerCase() === email) return rec.reset_token || null;
    }
    return null;
  } finally {
    db.close();
  }
}

function runProvision() {
  return spawnSync('node', [provisionScript], {
    env: { ...childEnv, BASE_URL: BASE, ADMIN_TOKEN: provisionAdminToken, TARGET_EMAIL: TARGET, ROLE: 'admin' },
    encoding: 'utf8',
  });
}

async function waitForReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/apps/public/prod/public-settings/by-id/${APP}`);
      if (res.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

let provisionAdminToken = '';
let server;

async function main() {
  server = spawn('node', [serverEntry], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => process.env.VERBOSE && process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server:err] ${d}`));

  const ready = await waitForReady();
  check(ready, 'isolated server booted and serving public-settings');
  if (!ready) return;

  // Admin can authenticate and reach the admin-only User surface (baseline).
  const adminLogin = await login(ADMIN);
  check(adminLogin.status === 200 && !!adminLogin.data?.access_token, `bootstrap admin login → ${adminLogin.status}`);
  provisionAdminToken = adminLogin.data?.access_token;
  const adminUserList = await api(`/api/apps/${APP}/entities/User`, { token: provisionAdminToken });
  check(adminUserList.status === 200, `admin GET entities/User → ${adminUserList.status} (admin gate open for admin)`);

  // Target does not exist yet.
  const before = (adminUserList.data || []).find((u) => (u.email || '').toLowerCase() === TARGET);
  check(!before, `target ${TARGET} absent before provisioning`);

  // Run the real provisioning script.
  const run1 = runProvision();
  check(run1.status === 0, `provision script exit 0 (got ${run1.status})`);
  if (run1.status !== 0) console.log(run1.stdout, run1.stderr);

  // Target now exists as admin, invited, passwordless.
  const listAfter = await api(`/api/apps/${APP}/entities/User`, { token: provisionAdminToken });
  const created = (listAfter.data || []).filter((u) => (u.email || '').toLowerCase() === TARGET);
  check(created.length === 1 && created[0].role === 'admin', `target created once as admin (count=${created.length}, role=${created[0]?.role})`);
  check(!('password_hash' in (created[0] || {})) && !('salt' in (created[0] || {})), 'no secret fields leaked in admin User listing');

  // It cannot log in yet — no password, unverified.
  const preLogin = await login({ email: TARGET, password: TARGET_PW });
  check(preLogin.status !== 200, `target cannot log in before password set → ${preLogin.status} (expect non-200)`);

  // Complete the sanctioned reset flow (the mailbox step, simulated by reading
  // the throwaway DB for the token the email would have carried).
  const reqReset = await api(`/api/apps/${APP}/auth/reset-password-request`, { method: 'POST', body: { email: TARGET } });
  check(reqReset.status === 200, `reset-password-request → ${reqReset.status}`);
  const token = readResetToken(TARGET);
  check(!!token, 'reset token present on target record');
  const doReset = await api(`/api/apps/${APP}/auth/reset-password`, { method: 'POST', body: { reset_token: token, new_password: TARGET_PW } });
  check(doReset.status === 200, `reset-password → ${doReset.status} (sets email_verified)`);

  // Now it logs in and is a working admin.
  const devLogin = await login({ email: TARGET, password: TARGET_PW });
  check(devLogin.status === 200 && !!devLogin.data?.access_token, `target login after reset → ${devLogin.status}`);
  const devToken = devLogin.data?.access_token;
  const me = await api(`/api/apps/${APP}/entities/User/me`, { token: devToken });
  check(me.status === 200 && me.data?.role === 'admin', `target /me role=admin (${me.data?.role})`);
  const adminReach = await api(`/api/apps/${APP}/entities/User`, { token: devToken });
  check(adminReach.status === 200, `target token reaches admin-only entities/User → ${adminReach.status}`);

  // Idempotency: re-running provisions nothing new.
  const run2 = runProvision();
  check(run2.status === 0, `re-run provision exit 0 (got ${run2.status})`);
  const listFinal = await api(`/api/apps/${APP}/entities/User`, { token: provisionAdminToken });
  const finalCount = (listFinal.data || []).filter((u) => (u.email || '').toLowerCase() === TARGET).length;
  check(finalCount === 1, `still exactly one ${TARGET} after re-run (count=${finalCount})`);
}

main()
  .catch((err) => { console.error(err); fail++; })
  .finally(() => {
    if (server) server.kill('SIGKILL');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
