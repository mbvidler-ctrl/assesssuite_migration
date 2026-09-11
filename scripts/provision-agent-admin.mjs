// Provision a single dedicated service account (e.g. an automation/agent
// identity) through the shim's OWN sanctioned endpoints — no direct database
// writes, no `fly ssh`, no email-verification bypass.
//
// It performs exactly one privileged action: calling the admin-only
// `invite-user` endpoint with an existing administrator's bearer token to
// create (or set the role of) the target account. Everything after that — the
// account setting its own password — happens through the normal
// reset-password email flow that proves control of the target mailbox. This
// script never sets a password, never reads or prints the admin token, and
// never touches patient data.
//
// Usage (env-driven; secrets stay in the environment, never on argv):
//   BASE_URL=https://<prod-host> \
//   ADMIN_TOKEN=<existing admin access_token> \
//   TARGET_EMAIL=dev.agent@unimatter.com.au \
//   ROLE=admin \
//   node scripts/provision-agent-admin.mjs
//
// Optional env:
//   APP_ID       path/app segment + X-App-Id header (default 'local-assesssuite')
//   DRY_RUN=1    resolve + report what would happen, make no write call
//
// Exit codes: 0 success or already-provisioned (idempotent); 1 usage/precondition;
// 2 remote/API error.

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const APP_ID = process.env.APP_ID || 'local-assesssuite';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ROLE = process.env.ROLE || 'admin';
const DRY_RUN = process.env.DRY_RUN === '1';
// The shim canonicalises emails to trimmed lower-case (server/auth.mjs
// normaliseEmail); match that here so the existence check and the created row
// agree and we never mint a case-variant duplicate.
const TARGET_EMAIL = (process.env.TARGET_EMAIL || '').trim().toLowerCase();

function fail(code, message) {
  console.error(`[provision-agent-admin] ${message}`);
  process.exit(code);
}

if (!BASE_URL) fail(1, 'BASE_URL is required (e.g. https://<host> or http://localhost:8787)');
if (!ADMIN_TOKEN) fail(1, 'ADMIN_TOKEN is required — an existing administrator bearer token');
if (!TARGET_EMAIL) fail(1, 'TARGET_EMAIL is required');
if (!['user', 'admin'].includes(ROLE)) fail(1, `ROLE must be 'user' or 'admin' (got '${ROLE}')`);

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-App-Id': APP_ID, Authorization: `Bearer ${ADMIN_TOKEN}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    fail(2, `network error calling ${method} ${path}: ${err.message}`);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function findTarget() {
  // Admin-only User listing; filter server-side by email. Response is passed
  // through stripAuthFields, so no secrets are returned.
  const q = encodeURIComponent(JSON.stringify({ email: TARGET_EMAIL }));
  const res = await api(`/api/apps/${APP_ID}/entities/User?q=${q}`);
  if (res.status === 401) fail(2, 'ADMIN_TOKEN was rejected (401) — provide a valid, unexpired admin token');
  if (res.status === 403) fail(2, 'ADMIN_TOKEN is not an administrator (403) — invite-user requires an admin identity');
  if (res.status !== 200) fail(2, `unexpected ${res.status} resolving existing account: ${JSON.stringify(res.data)}`);
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.find((u) => (u.email || '').toLowerCase() === TARGET_EMAIL) || null;
}

async function main() {
  console.log(`[provision-agent-admin] target=${TARGET_EMAIL} role=${ROLE} base=${BASE_URL} app=${APP_ID}${DRY_RUN ? ' (DRY RUN)' : ''}`);

  const existing = await findTarget();

  if (existing && existing.role === ROLE) {
    console.log(`[provision-agent-admin] already provisioned: ${TARGET_EMAIL} is '${existing.role}' (id ${existing.id}). Nothing to do.`);
    reportNextSteps(existing, /* changed */ false);
    return;
  }

  if (DRY_RUN) {
    const verb = existing ? `promote from '${existing.role}' to '${ROLE}'` : `create as '${ROLE}'`;
    console.log(`[provision-agent-admin] DRY RUN — would ${verb} via invite-user. No call made.`);
    return;
  }

  // invite-user creates a passwordless, account_status:'invited' account for a
  // new email, or updates the role of an existing one. It is the ONLY
  // sanctioned way to mint/promote an admin now that bootstrapAdmin is a no-op.
  const res = await api(`/api/apps/${APP_ID}/users/invite-user`, {
    method: 'POST',
    body: { user_email: TARGET_EMAIL, role: ROLE },
  });
  if (res.status === 401) fail(2, 'ADMIN_TOKEN was rejected (401) at invite-user');
  if (res.status === 403) fail(2, 'ADMIN_TOKEN is not an administrator (403) at invite-user');
  if (res.status !== 200) fail(2, `invite-user failed (${res.status}): ${JSON.stringify(res.data)}`);

  const verb = existing ? 'promoted' : 'invited';
  console.log(`[provision-agent-admin] ${verb} ${TARGET_EMAIL} as '${ROLE}'.`);
  reportNextSteps(res.data?.user || existing, /* changed */ true);
}

function reportNextSteps(user, changed) {
  console.log('\nNext steps (complete out-of-band; this script does not set passwords):');
  console.log(`  1. Request a password reset for ${TARGET_EMAIL}:`);
  console.log(`       POST ${BASE_URL}/api/apps/${APP_ID}/auth/reset-password-request  {"email":"${TARGET_EMAIL}"}`);
  console.log('  2. Open the emailed link (/reset-password?token=...) and set a strong password.');
  console.log('       This sets email_verified=true — the account can then log in.');
  console.log(`  3. Log in to mint the agent's bearer token:`);
  console.log(`       POST ${BASE_URL}/api/apps/${APP_ID}/auth/login  {"email":"${TARGET_EMAIL}","password":"..."}`);
  console.log('       Store the returned access_token as a secret (it is long-lived); rotate by logging out.');
  if (!changed && user?.email_verified) {
    console.log(`  NOTE: ${TARGET_EMAIL} is already email_verified — it may already have a usable password.`);
  }
}

main().catch((err) => fail(2, `unexpected error: ${err.stack || err.message}`));
