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

  console.log(`\nGate tests complete: ${pass}/${pass + fail} passed.`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('gate-tests harness error:', err);
  process.exitCode = 1;
});
