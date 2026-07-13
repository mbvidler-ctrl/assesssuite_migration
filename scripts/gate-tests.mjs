// Launch-gate negative-test harness (G5 / G6 / G8), run against a LIVE seeded
// shim instance. Unlike server/selftest.mjs (which builds its own ephemeral
// database), this exercises the gates end to end against the running server on
// SMOKE_URL (default http://localhost:8787) with the synthetic seed data in
// place, and maps each check to the test numbers in
// docs/qa/20260703-role-entitlement-isolation-analysis.md.
//
// Run: node scripts/gate-tests.mjs   (with the seeded shim running on 8787)
//
// It performs only reads and idempotent, reversible writes against synthetic
// data. It never touches the Base44 platform or any external service.

const BASE = process.env.SMOKE_URL || 'http://localhost:8787';
const APP = 'local-assesssuite';

const CREDS = {
  admin: { email: 'admin@local.test', password: 'change-me-local' },
  alpha: { email: 'clinician@org-alpha.seed.test', password: 'SeedDemo!2026' },
  beta: { email: 'clinician@org-beta.seed.test', password: 'SeedDemo!2026' },
};

let pass = 0;
let fail = 0;
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  if (ok) pass++; else fail++;
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${id} — ${detail}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'X-App-Id': APP };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function login(cred) {
  const res = await api(`/api/apps/${APP}/auth/login`, { method: 'POST', body: cred });
  if (res.status !== 200 || !res.data?.access_token) {
    throw new Error(`login failed for ${cred.email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.access_token;
}

async function main() {
  console.log(`Gate tests against ${BASE} (seeded shim)\n`);

  const adminTok = await login(CREDS.admin);
  const alphaTok = await login(CREDS.alpha);
  const betaTok = await login(CREDS.beta);

  // Resolve one Alpha-scoped client id (as admin, who sees all).
  const alphaMe = await api(`/api/apps/${APP}/entities/User/me`, { token: alphaTok });
  const alphaMembership = await api(
    `/api/apps/${APP}/entities/OrganizationMember?q=${encodeURIComponent(JSON.stringify({ user_email: alphaMe.data.email }))}`,
    { token: adminTok },
  );
  const alphaOrgId = alphaMembership.data?.[0]?.org_id;
  const alphaClients = await api(
    `/api/apps/${APP}/entities/Client?q=${encodeURIComponent(JSON.stringify({ org_id: alphaOrgId }))}`,
    { token: adminTok },
  );
  const alphaClientId = alphaClients.data?.[0]?.id;

  // ---- G5: role / admin-surface enforcement (API layer) ----
  const uListNon = await api(`/api/apps/${APP}/entities/User`, { token: alphaTok });
  record('G5.4', uListNon.status === 403, `non-admin GET entities/User → ${uListNon.status} (expect 403)`);

  const uListAdmin = await api(`/api/apps/${APP}/entities/User`, { token: adminTok });
  const noSecrets = Array.isArray(uListAdmin.data)
    && uListAdmin.data.every((u) => !('password_hash' in u) && !('salt' in u));
  record('G5.4b', uListAdmin.status === 200 && noSecrets, `admin GET entities/User → ${uListAdmin.status}, no secret fields leaked=${noSecrets}`);

  const auditNon = await api(`/api/apps/${APP}/functions/auditAssessmentIssues`, { method: 'POST', token: alphaTok, body: {} });
  record('G5/G6.8a', auditNon.status === 403, `non-admin auditAssessmentIssues → ${auditNon.status} (expect 403)`);

  for (const fn of ['createTestClientWithAssessments', 'verifyTestAssessmentData', 'getMissingTestRunners']) {
    const r = await api(`/api/apps/${APP}/functions/${fn}`, { method: 'POST', token: alphaTok, body: {} });
    record(`G6.8-${fn}`, r.status === 403, `non-admin ${fn} → ${r.status} (expect 403)`);
  }

  // ---- G6: tenant isolation (object level) ----
  if (alphaClientId) {
    const crossGet = await api(`/api/apps/${APP}/entities/Client/${alphaClientId}`, { token: betaTok });
    record('G6.6a', crossGet.status === 404, `Beta clinician GET Alpha client by id → ${crossGet.status} (expect 404)`);
  } else {
    record('G6.6a', false, 'could not resolve an Alpha client id to test cross-org read');
  }

  const betaList = await api(`/api/apps/${APP}/entities/Client`, { token: betaTok });
  const betaSeesAlpha = Array.isArray(betaList.data) && alphaClientId
    && betaList.data.some((c) => c.id === alphaClientId);
  record('G6.6b', betaList.status === 200 && !betaSeesAlpha, `Beta clinician Client list excludes Alpha records=${!betaSeesAlpha}`);

  const alphaList = await api(`/api/apps/${APP}/entities/Client`, { token: alphaTok });
  const alphaSeesOwn = Array.isArray(alphaList.data) && alphaList.data.length > 0
    && alphaList.data.every((c) => c.org_id === alphaOrgId);
  record('G6.6c', alphaList.status === 200 && alphaSeesOwn, `Alpha clinician sees only own-org clients (${alphaList.data?.length} rows, all org_id match=${alphaSeesOwn})`);

  // ---- G8: payment cannot grant admin; billing state separate from role ----
  const escalate = await api(`/api/apps/${APP}/entities/User/me`, { method: 'PUT', token: alphaTok, body: { role: 'admin', clinic_name: 'Escalation Attempt Clinic' } });
  const stillUser = escalate.data?.role !== 'admin';
  const otherFieldTook = escalate.data?.clinic_name === 'Escalation Attempt Clinic';
  record('G8.16', escalate.status === 200 && stillUser, `updateMe{role:'admin'} stripped, role stays '${escalate.data?.role}'`);
  record('G8.16b', otherFieldTook, `non-guarded field on same updateMe still applied=${otherFieldTook}`);

  // Full mock entitlement flow: checkout then webhook, then confirm role unchanged.
  const betaMe = await api(`/api/apps/${APP}/entities/User/me`, { token: betaTok });
  const betaBeforeRole = betaMe.data?.role;
  const checkout = await api(`/api/apps/${APP}/functions/createCheckoutSession`, {
    method: 'POST', token: betaTok,
    body: { priceId: 'price_mock', userEmail: betaMe.data.email, userId: betaMe.data.id },
  });
  const checkoutOk = checkout.status === 200 && typeof (checkout.data?.url || checkout.data?.data?.url) === 'string';
  record('G8.17a', checkoutOk, `createCheckoutSession returns a url=${checkoutOk}`);

  const webhook = await api(`/api/apps/${APP}/functions/stripeWebhook`, {
    method: 'POST', token: adminTok,
    body: { type: 'checkout.session.completed', data: { object: { customer: 'mock_cus_beta', customer_email: betaMe.data.email, subscription: 'mock_sub_beta', metadata: { userId: betaMe.data.id, userEmail: betaMe.data.email } } } },
  });
  const betaAfter = await api(`/api/apps/${APP}/entities/User/me`, { token: betaTok });
  const roleUnchanged = betaAfter.data?.role === betaBeforeRole;
  record('G8.17b', webhook.status === 200 && roleUnchanged, `after checkout.session.completed webhook, role unchanged ('${betaBeforeRole}' → '${betaAfter.data?.role}')`);

  // ---- L1: launch posture (this harness runs against a NORMAL server — no
  //      SELFTEST bypass — so these exercise the real production behaviours) ----

  // Transcription is refused for users unless TRANSCRIPTION_ENABLED=1.
  const transcribe = await api(`/api/apps/${APP}/functions/transcribeSession`, {
    method: 'POST', token: alphaTok, body: { action: 'transcribe', audio_url: '/uploads/probe.webm' },
  });
  record('L1.1', transcribe.status === 403, `transcribeSession refused when TRANSCRIPTION_ENABLED unset → ${transcribe.status} (expect 403)`);

  // Client "delete" is an archive: hidden from lists, retained, retrievable.
  const archProbe = await api(`/api/apps/${APP}/entities/Client`, {
    method: 'POST', token: alphaTok, body: { full_name: 'Archive Probe Client' },
  });
  const archId = archProbe.data?.id;
  await api(`/api/apps/${APP}/entities/Client/${archId}`, {
    method: 'PUT', token: alphaTok, body: { archived: true, archived_date: new Date().toISOString() },
  });
  const listAfterArch = await api(`/api/apps/${APP}/entities/Client`, { token: alphaTok });
  const hiddenFromList = Array.isArray(listAfterArch.data) && !listAfterArch.data.some((c) => c.id === archId);
  record('L1.2a', hiddenFromList, `archived client hidden from default list=${hiddenFromList}`);
  const archListQ = encodeURIComponent(JSON.stringify({ archived: true }));
  const archList = await api(`/api/apps/${APP}/entities/Client?q=${archListQ}`, { token: alphaTok });
  const visibleWhenAsked = Array.isArray(archList.data) && archList.data.some((c) => c.id === archId);
  record('L1.2b', visibleWhenAsked, `archived client visible via explicit archived:true query=${visibleWhenAsked}`);
  const archGet = await api(`/api/apps/${APP}/entities/Client/${archId}`, { token: alphaTok });
  record('L1.2c', archGet.status === 200 && archGet.data?.archived === true, `archived client still retrievable by id (retention) → ${archGet.status}`);

  // Self-service deactivation: works for the caller, refuses clinical access,
  // admin restores (mirrors AdminApprovals) so re-runs stay idempotent.
  const deact = await api(`/api/apps/${APP}/functions/deactivateAccount`, {
    method: 'POST', token: betaTok, body: {},
  });
  record('L1.3a', deact.status === 200 && deact.data?.status === 'deactivated', `deactivateAccount self-service → ${deact.status}`);
  const usersAfter = await api(`/api/apps/${APP}/entities/User`, { token: adminTok });
  const betaRow = usersAfter.data?.find((u) => u.email === betaAfter.data?.email);
  record('L1.3b', betaRow?.account_status === 'deactivated', `account_status recorded as deactivated=${betaRow?.account_status}`);
  const clinicalWhileDeactivated = await api(`/api/apps/${APP}/entities/Client`, { token: betaTok });
  record('L1.3c', clinicalWhileDeactivated.status === 403, `deactivated account refused clinical access → ${clinicalWhileDeactivated.status} (expect 403)`);
  await api(`/api/apps/${APP}/entities/User/${betaRow?.id}`, {
    method: 'PUT', token: adminTok, body: { account_status: 'active' },
  });
  const restored = await api(`/api/apps/${APP}/entities/User`, { token: adminTok });
  const betaRestored = restored.data?.find((u) => u.id === betaRow?.id);
  record('L1.3d', betaRestored?.account_status === 'active', `admin reactivation restores active=${betaRestored?.account_status}`);

  // The bootstrap admin cannot self-deactivate (would orphan the deployment).
  const adminDeact = await api(`/api/apps/${APP}/functions/deactivateAccount`, {
    method: 'POST', token: adminTok, body: {},
  });
  record('L1.4', adminDeact.status === 403, `admin self-deactivation refused → ${adminDeact.status} (expect 403)`);

  console.log(`\nGate tests complete: ${pass}/${pass + fail} passed.`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('gate-tests harness error:', err);
  process.exitCode = 1;
});
