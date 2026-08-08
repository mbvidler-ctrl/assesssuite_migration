import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const pageSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'),
  'utf8',
);

test('protocol assistance is catalogue-only and has no generative or patient-plan fallback', () => {
  assert.match(pageSource, /base44\.entities\.TreatmentProtocol\.list\(\)/);
  assert.match(pageSource, /searchProtocolCatalogue\(\{/);
  assert.match(pageSource, /auditProtocolCatalogue\(/);
  assert.match(pageSource, /isProtocolAvailableTo\(entry, catalogueAccess\.context\)/);
  assert.match(pageSource, /deriveAuthenticatedProtocolSearchContext\(authenticatedUser\)/);
  assert.match(pageSource, /normaliseProfession\(user\?\.profession\)/);
  assert.match(pageSource, /No protocol was generated\./);
  assert.doesNotMatch(
    pageSource,
    /InvokeLLM|searchEvidence|verifyReferences|useAiCapability|ImportToSOAPModal|PROTOCOL_PROVENANCE|buildProtocolPrompt|PROTOCOL_RESPONSE_SCHEMA/,
  );
  assert.doesNotMatch(pageSource, /TreatmentProtocol\.filter/);
});

test('catalogue preparation preserves every row for governance audit and sorts before discovery', () => {
  assert.match(pageSource, /Array\.isArray\(rows\)/);
  assert.match(pageSource, /Array\.isArray\(rows\) \? \[\.\.\.rows\] : \[\]/);
  assert.match(pageSource, /\.sort\(\(left, right\) =>/);
  assert.match(pageSource, /condition_name[\s\S]*localeCompare/);
  assert.doesNotMatch(pageSource, /uniqueByName|dedup/i);
  assert.match(pageSource, /blockedCatalogueCount/);
  assert.match(pageSource, /They remain visible in this count but cannot be searched or rendered\./);
});

test('Enter, submit button and catalogue preset all route through one deterministic handler', () => {
  assert.match(pageSource, /const runProtocolSearch = \(queryInput\) =>/);
  assert.match(pageSource, /onKeyDown=[\s\S]*runProtocolSearch\(searchTerm\)/);
  assert.match(pageSource, /onClick=\{\(\) => runProtocolSearch\(searchTerm\)\}/);
  assert.match(pageSource, /onClick=\{\(\) => runProtocolSearch\(\{ name: condition\.name \}\)\}/);
  assert.equal((pageSource.match(/searchProtocolCatalogue\(\{/g) || []).length, 1);
});

test('every deterministic outcome is rendered explicitly and malformed reviewed content fails closed', () => {
  for (const state of ['MATCHES', 'NO_MATCH', 'UNSUPPORTED', 'INVALID_QUERY', 'CATALOGUE_BLOCKED']) {
    assert.match(pageSource, new RegExp('PROTOCOL_SEARCH_STATE\\.' + state));
  }
  for (const label of ['Matches.', 'No match.', 'Unsupported.', 'Invalid search.', 'Catalogue blocked.']) {
    assert.match(pageSource, new RegExp(label.replace('.', '\\.'), 'i'));
  }
  assert.match(pageSource, /!reviewed\.ok \|\| reviewed\.degraded/);
  assert.match(pageSource, /matching_catalogue_entry_failed_render_contract/);
  assert.doesNotMatch(pageSource, /setProtocolData\([^)]*\?[^)]*:[^)]*protocol/);
});

test('a displayed card carries its governance, rights and controlled-source record', () => {
  assert.match(pageSource, /Governed catalogue card/);
  assert.match(pageSource, /Independent review/);
  assert.match(pageSource, /Management target:/);
  assert.match(pageSource, /Controlled sources/);
  assert.match(pageSource, /selectedCondition\?\.governance\?\.rights/);
});

async function setUserProfile(server, adminSession, user, overrides = {}) {
  const result = await requestJson(server, `/api/apps/${server.appId}/entities/User/${user.id}`, {
    method: 'PUT',
    token: adminSession,
    body: {
      account_status: 'active',
      country: 'australia',
      profession: 'Exercise Physiologist',
      qualifications: 'Synthetic accredited exercise physiology qualification',
      registration_number: `SYNTH-${user.id}`,
      ...overrides,
    },
  });
  assert.equal(result.status, 200, result.text);
}

async function recordCurrentAcceptance(server, user, orgId) {
  const result = await requestJson(
    server,
    `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
    {
      method: 'POST',
      token: user.token,
      body: { org_id: orgId, marketing_opt_in: false },
    },
  );
  assert.equal(result.status, 200, result.text);
}

async function listProtocols(server, token, suffix = '') {
  return requestJson(
    server,
    `/api/apps/${server.appId}/entities/TreatmentProtocol${suffix}`,
    { token },
  );
}

test('TreatmentProtocol reads fail closed for non-AEPs, admins, missing membership and missing legal acceptance', async () => {
  const server = await startTestServer();
  try {
    const adminSession = await loginAdmin(server);

    const adminRead = await listProtocols(server, adminSession);
    assert.equal(adminRead.status, 403, adminRead.text);
    assert.match(adminRead.body?.message || '', /credentialed Australian Exercise Physiologist/);

    const nonAep = await registerUser(server, 'synthetic-protocol-non-aep@example.test');
    await setUserProfile(server, adminSession, nonAep, { profession: 'Gym Management' });
    const nonAepRead = await listProtocols(server, nonAep.token);
    assert.equal(nonAepRead.status, 403, nonAepRead.text);

    const noMembership = await registerUser(server, 'synthetic-protocol-no-membership@example.test');
    await setUserProfile(server, adminSession, noMembership);
    const noMembershipRead = await listProtocols(server, noMembership.token);
    assert.equal(noMembershipRead.status, 403, noMembershipRead.text);
    assert.match(noMembershipRead.body?.message || '', /primary-practice membership/);

    const unaccepted = await registerUser(server, 'synthetic-protocol-unaccepted@example.test');
    await setUserProfile(server, adminSession, unaccepted);
    await createOrganizationForUser(server, adminSession, unaccepted);
    const unacceptedRead = await listProtocols(server, unaccepted.token);
    assert.equal(unacceptedRead.status, 403, unacceptedRead.text);
    assert.match(unacceptedRead.body?.message || '', /current legal acceptance/);
  } finally {
    await server.stop();
  }
});

test('foreign organisation input and another practice acceptance cannot widen protocol access', async () => {
  const server = await startTestServer();
  try {
    const adminSession = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-protocol-foreign-context@example.test');
    await setUserProfile(server, adminSession, user);
    await createOrganizationForUser(server, adminSession, user);

    const secondaryOrg = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
      method: 'POST',
      token: adminSession,
      body: { name: 'Synthetic secondary protocol practice' },
    });
    assert.equal(secondaryOrg.status, 200, secondaryOrg.text);
    const secondaryMembership = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/OrganizationMember`,
      {
        method: 'POST',
        token: adminSession,
        body: {
          org_id: secondaryOrg.body.id,
          user_email: user.email,
          role: 'clinician',
          is_primary: false,
        },
      },
    );
    assert.equal(secondaryMembership.status, 200, secondaryMembership.text);
    await recordCurrentAcceptance(server, user, secondaryOrg.body.id);

    const otherPracticeCannotSubstitute = await listProtocols(server, user.token);
    assert.equal(otherPracticeCannotSubstitute.status, 403, otherPracticeCannotSubstitute.text);
    assert.match(otherPracticeCannotSubstitute.body?.message || '', /current legal acceptance/);

    const forgedQuery = encodeURIComponent(JSON.stringify({ org_id: secondaryOrg.body.id }));
    const forged = await listProtocols(server, user.token, `?q=${forgedQuery}`);
    assert.equal(forged.status, 403, forged.text);
    assert.match(forged.body?.message || '', /server-derived/);
  } finally {
    await server.stop();
  }
});

test('multi-practice protocol and Core context fail closed without one explicit primary membership', async () => {
  const adminEmail = 'protocol-core-admin@isolated.test';
  const adminPassword = 'Synthetic-Protocol-Core-Admin-1!';
  const server = await startTestServer({
    CORE_V1_SANDBOX_ENABLED: '1',
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
  });
  try {
    const adminLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email: adminEmail, password: adminPassword },
    });
    assert.equal(adminLogin.status, 200, adminLogin.text);
    const adminSession = adminLogin.body.access_token;
    const user = await registerUser(server, 'synthetic-protocol-ambiguous-practice@example.test');
    await setUserProfile(server, adminSession, user);

    for (const name of ['Synthetic ambiguous practice A', 'Synthetic ambiguous practice B']) {
      const organization = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
        method: 'POST',
        token: adminSession,
        body: { name },
      });
      assert.equal(organization.status, 200, organization.text);
      const membership = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/OrganizationMember`,
        {
          method: 'POST',
          token: adminSession,
          body: {
            org_id: organization.body.id,
            user_email: user.email,
            role: 'clinician',
            is_primary: false,
          },
        },
      );
      assert.equal(membership.status, 200, membership.text);
      const adminMembership = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/OrganizationMember`,
        {
          method: 'POST',
          token: adminSession,
          body: {
            org_id: organization.body.id,
            user_email: adminEmail,
            role: 'clinician',
            is_primary: false,
          },
        },
      );
      assert.equal(adminMembership.status, 200, adminMembership.text);
    }

    const catalogue = await listProtocols(server, user.token);
    assert.equal(catalogue.status, 403, catalogue.text);
    assert.match(catalogue.body?.message || '', /primary-practice membership/);

    const core = await requestJson(
      server,
      '/api/core/v1/protocol-assistance/search?q=Synthetic&limit=10',
      { token: adminSession },
    );
    assert.equal(core.status, 403, core.text);
    assert.equal(core.body?.error?.code, 'CORE_ORG_REQUIRED');
  } finally {
    await server.stop();
  }
});

test('active credentialed AEP with primary membership and current acceptance can read the governed catalogue', async () => {
  const server = await startTestServer();
  try {
    const adminSession = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-protocol-eligible-aep@example.test');
    await setUserProfile(server, adminSession, user);
    const organization = await createOrganizationForUser(server, adminSession, user);
    await recordCurrentAcceptance(server, user, organization.id);

    const result = await listProtocols(server, user.token);
    assert.equal(result.status, 200, result.text);
    assert.ok(Array.isArray(result.body));
  } finally {
    await server.stop();
  }
});

test('protocol UI fails closed with explicit unsupported and unavailable access states', () => {
  assert.doesNotMatch(pageSource, /const PROTOCOL_SEARCH_CONTEXT/);
  assert.match(pageSource, /data-protocol-access-state="unsupported"/);
  assert.match(pageSource, /data-protocol-access-state="unavailable"/);
  assert.match(pageSource, /Unsupported professional scope\./);
  assert.match(pageSource, /active credentialed profile, current primary-practice membership and current legal acceptance/);
  assert.match(pageSource, /Source metadata unavailable/);
  assert.match(
    pageSource,
    /catalogueAccess\.state === PROTOCOL_CATALOGUE_ACCESS_STATE\.READY && !disclaimerDismissed/,
  );
  assert.match(
    pageSource,
    /disabled=\{isCatalogueLoading \|\| catalogueAccess\.state !== PROTOCOL_CATALOGUE_ACCESS_STATE\.READY\}/,
  );
});
