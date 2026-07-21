import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createEntityRepository } from '../db.mjs';
import { createFounderOrganizationEnsurer } from '../integrations.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const route = (server) => (
  `/api/apps/${server.appId}/integration-endpoints/Core/EnsureFounderOrganization`
);

function entityRows(dbPath, entityName) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`SELECT id, data, created_date, updated_date, created_by FROM entity_${entityName}`)
      .all()
      .map((row) => ({
        id: row.id,
        created_date: row.created_date,
        updated_date: row.updated_date,
        created_by: row.created_by,
        ...JSON.parse(row.data),
      }));
  } finally {
    db.close();
  }
}

async function activatePaidUser(server, adminToken, user) {
  await activateUser(server, adminToken, user.id);
  const paid = await requestJson(
    server,
    `/api/apps/${server.appId}/entities/User/${user.id}`,
    {
      method: 'PUT',
      token: adminToken,
      body: { subscription_status: 'active' },
    },
  );
  assert.equal(paid.status, 200, paid.text);
}

test('profile founding uses one server operation and sends no ownership identity fields', () => {
  const profile = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'ProfileSetup.jsx'), 'utf8');
  const helper = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'profileFounderOrganization.js'), 'utf8');
  const onboarding = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'Onboarding.jsx'), 'utf8');
  const quickOnboard = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'onboarding', 'QuickOnboardModal.jsx'),
    'utf8',
  );
  const validationIndex = profile.indexOf('if (!validateForm())');
  const audienceIndex = profile.indexOf('liveAudience.ownerBundle !== consentAudience.ownerBundle');
  const ensureIndex = profile.indexOf('ensureFounderOrganization({');

  assert.ok(validationIndex >= 0 && audienceIndex > validationIndex && ensureIndex > audienceIndex);
  assert.doesNotMatch(profile, /base44\.entities\.Organization(?:Member)?\.create/);
  assert.doesNotMatch(onboarding, /base44\.entities\.Organization(?:Member)?\.create/);
  assert.doesNotMatch(quickOnboard, /base44\.entities\.Organization(?:Member)?\.create/);
  assert.match(onboarding, /ensureFounderOrganization\(\{\s*clinicName:\s*defaultName\s*\}\)/);
  assert.match(quickOnboard, /ensureFounderOrganization\(\{\s*clinicName:\s*defaultName\s*\}\)/);
  assert.match(helper, /EnsureFounderOrganization\(\{[\s\S]*?clinic_name:\s*clinicName/);
  const integrationPayload = /EnsureFounderOrganization\(\{([\s\S]*?)\}\)/.exec(helper)?.[1] || '';
  assert.doesNotMatch(integrationPayload, /user_email|owner_email|\brole\b|is_primary|org_id/);
});

test('self-service profile updates cannot forge payment or Stripe entitlement state', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-founder-entitlement@example.test');
    await activateUser(server, adminToken, user.id);

    const forged = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      method: 'PUT',
      token: user.token,
      body: {
        subscription_status: 'active',
        stripe_customer_id: 'cus_caller_controlled',
        stripe_subscription_id: 'sub_caller_controlled',
        subscription_start_date: '2026-07-21T00:00:00.000Z',
      },
    });
    assert.equal(forged.status, 200, forged.text);
    assert.notEqual(forged.body?.subscription_status, 'active');
    assert.equal(forged.body?.stripe_customer_id, undefined);
    assert.equal(forged.body?.stripe_subscription_id, undefined);
    assert.equal(forged.body?.subscription_start_date, undefined);

    const founder = await requestJson(server, route(server), {
      method: 'POST', token: user.token, body: { clinic_name: 'Must Remain Unpaid' },
    });
    assert.equal(founder.status, 403, founder.text);
    assert.equal(founder.body?.code, 'founder_organization_forbidden');
    assert.equal(entityRows(server.dbPath, 'Organization').length, 0);
    assert.equal(entityRows(server.dbPath, 'OrganizationMember').length, 0);
  } finally {
    await server.stop();
  }
});

test('generic organisation founder writes are denied for pending and invited paid users', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const pending = await registerUser(server, 'synthetic-founder-generic-pending@example.test');

    const pendingOrg = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
      method: 'POST', token: pending.token, body: { name: 'Pending Bypass Practice' },
    });
    assert.equal(pendingOrg.status, 403, pendingOrg.text);

    const memberless = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
      method: 'POST', token: adminToken, body: { name: 'Synthetic Memberless Practice' },
    });
    assert.equal(memberless.status, 200, memberless.text);
    const pendingMembership = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/OrganizationMember`,
      {
        method: 'POST',
        token: pending.token,
        body: { org_id: memberless.body.id, user_email: pending.email, role: 'owner', is_primary: true },
      },
    );
    assert.equal(pendingMembership.status, 403, pendingMembership.text);

    const invited = await registerUser(server, 'synthetic-founder-generic-invited@example.test');
    await activatePaidUser(server, adminToken, invited);
    const invitedOrg = await createOrganizationForUser(server, adminToken, invited, 'clinician');
    const invitedCreate = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
      method: 'POST', token: invited.token, body: { name: 'Invited Elevation Practice' },
    });
    assert.equal(invitedCreate.status, 403, invitedCreate.text);
    const invitedMembership = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/OrganizationMember`,
      {
        method: 'POST',
        token: invited.token,
        body: { org_id: memberless.body.id, user_email: invited.email, role: 'owner', is_primary: true },
      },
    );
    assert.equal(invitedMembership.status, 403, invitedMembership.text);

    const organizations = entityRows(server.dbPath, 'Organization');
    const memberships = entityRows(server.dbPath, 'OrganizationMember');
    assert.equal(organizations.length, 2);
    assert.ok(organizations.some((row) => row.id === memberless.body.id));
    assert.ok(organizations.some((row) => row.id === invitedOrg.id));
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].org_id, invitedOrg.id);
    assert.equal(memberships[0].role, 'clinician');
  } finally {
    await server.stop();
  }
});

test('founder operation is authenticated, entitlement-gated, and validates a bounded clinic name', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-founder-negative@example.test');

    const anonymous = await requestJson(server, route(server), {
      method: 'POST',
      body: { clinic_name: 'Synthetic Anonymous Clinic' },
    });
    assert.equal(anonymous.status, 401, anonymous.text);

    const pending = await requestJson(server, route(server), {
      method: 'POST',
      token: user.token,
      body: { clinic_name: 'Synthetic Pending Clinic' },
    });
    assert.equal(pending.status, 403, pending.text);
    assert.equal(pending.body?.code, 'founder_organization_forbidden');

    await activateUser(server, adminToken, user.id);
    const unpaid = await requestJson(server, route(server), {
      method: 'POST',
      token: user.token,
      body: { clinic_name: 'Synthetic Unpaid Clinic' },
    });
    assert.equal(unpaid.status, 403, unpaid.text);
    assert.equal(unpaid.body?.code, 'founder_organization_forbidden');

    const paid = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/User/${user.id}`,
      { method: 'PUT', token: adminToken, body: { subscription_status: 'active' } },
    );
    assert.equal(paid.status, 200, paid.text);

    for (const clinicName of [undefined, '', '   ', `x${'y'.repeat(160)}`, 'Unsafe\u0000Name']) {
      const invalid = await requestJson(server, route(server), {
        method: 'POST',
        token: user.token,
        body: clinicName === undefined ? {} : { clinic_name: clinicName },
      });
      assert.equal(invalid.status, 400, `${JSON.stringify(clinicName)}: ${invalid.text}`);
      assert.equal(invalid.body?.code, 'invalid_clinic_name');
    }

    assert.equal(entityRows(server.dbPath, 'Organization').length, 0);
    assert.equal(entityRows(server.dbPath, 'OrganizationMember').length, 0);
  } finally {
    await server.stop();
  }
});

test('lost-response replay ignores caller ownership fields and creates one owner membership', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-founder-replay@example.test');
    await activatePaidUser(server, adminToken, user);

    const attackerShapedBody = {
      clinic_name: '  Synthetic   Founder Practice  ',
      user_email: 'admin@local.test',
      owner_email: 'admin@local.test',
      role: 'admin',
      is_primary: false,
      org_id: 'caller-controlled-org',
    };
    const first = await requestJson(server, route(server), {
      method: 'POST', token: user.token, body: attackerShapedBody,
    });
    assert.equal(first.status, 200, first.text);
    assert.deepEqual(Object.keys(first.body).sort(), ['id', 'name']);
    assert.equal(first.body.name, 'Synthetic Founder Practice');

    // Identical retry represents the client not receiving the committed first
    // response. It must return the same safe identity without another write.
    const replay = await requestJson(server, route(server), {
      method: 'POST', token: user.token, body: attackerShapedBody,
    });
    assert.equal(replay.status, 200, replay.text);
    assert.deepEqual(replay.body, first.body);

    const organizations = entityRows(server.dbPath, 'Organization');
    const memberships = entityRows(server.dbPath, 'OrganizationMember');
    assert.equal(organizations.length, 1);
    assert.equal(memberships.length, 1);
    assert.equal(organizations[0].id, first.body.id);
    assert.equal(organizations[0].created_by, user.email);
    assert.deepEqual(
      {
        org_id: memberships[0].org_id,
        user_email: memberships[0].user_email,
        role: memberships[0].role,
        is_primary: memberships[0].is_primary,
        created_by: memberships[0].created_by,
      },
      {
        org_id: first.body.id,
        user_email: user.email,
        role: 'owner',
        is_primary: true,
        created_by: user.email,
      },
    );
  } finally {
    await server.stop();
  }
});

test('concurrent founder requests serialize to one organisation and one membership', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-founder-concurrent@example.test');
    await activatePaidUser(server, adminToken, user);

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => requestJson(server, route(server), {
        method: 'POST',
        token: user.token,
        body: { clinic_name: 'Synthetic Concurrent Practice' },
      })),
    );
    for (const response of responses) assert.equal(response.status, 200, response.text);
    assert.equal(new Set(responses.map((response) => response.body.id)).size, 1);
    assert.equal(entityRows(server.dbPath, 'Organization').length, 1);
    assert.equal(entityRows(server.dbPath, 'OrganizationMember').length, 1);
  } finally {
    await server.stop();
  }
});

test('existing invited membership remains on its established path without elevation or a new tenant', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-founder-invited@example.test');
    await activatePaidUser(server, adminToken, user);
    const existing = await createOrganizationForUser(server, adminToken, user, 'clinician');

    const result = await requestJson(server, route(server), {
      method: 'POST',
      token: user.token,
      body: { clinic_name: 'Must Not Be Created' },
    });
    assert.equal(result.status, 409, result.text);
    assert.equal(result.body?.code, 'existing_membership_requires_selection');

    const organizations = entityRows(server.dbPath, 'Organization');
    const memberships = entityRows(server.dbPath, 'OrganizationMember');
    assert.equal(organizations.length, 1);
    assert.equal(organizations[0].id, existing.id);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].role, 'clinician');
    assert.equal(memberships[0].is_primary, true);
  } finally {
    await server.stop();
  }
});

test('legacy orphan recovery is deterministic and does not create another organisation', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-founder-orphan@example.test');
    await activatePaidUser(server, adminToken, user);

    // Recreate the historical partial state directly as a test fixture. The
    // public generic create route is now retired, but pre-existing orphans
    // still need deterministic recovery.
    const fixtureDb = new DatabaseSync(server.dbPath);
    const orphan = createEntityRepository(fixtureDb, 'Organization')
      .create({ name: 'Synthetic Legacy Orphan' }, user.email);
    fixtureDb.close();

    const recovered = await requestJson(server, route(server), {
      method: 'POST',
      token: user.token,
      body: { clinic_name: 'Synthetic Legacy Orphan' },
    });
    assert.equal(recovered.status, 200, recovered.text);
    assert.equal(recovered.body.id, orphan.id);
    assert.equal(entityRows(server.dbPath, 'Organization').length, 1);
    assert.equal(entityRows(server.dbPath, 'OrganizationMember').length, 1);
  } finally {
    await server.stop();
  }
});

test('membership insert failure rolls the newly-created organisation back atomically', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-founder-rollback-'));
  const dbPath = path.join(tempRoot, 'rollback.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE entity_Organization (
        id TEXT PRIMARY KEY, data TEXT NOT NULL, created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL, created_by TEXT
      );
      CREATE TABLE entity_OrganizationMember (
        id TEXT PRIMARY KEY, data TEXT NOT NULL, created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL, created_by TEXT
      );
    `);
    const organizationRepo = createEntityRepository(db, 'Organization');
    const organizationMemberRepo = createEntityRepository(db, 'OrganizationMember');
    const throwingMembershipRepo = {
      ...organizationMemberRepo,
      create() { throw new Error('synthetic membership persistence fault'); },
    };
    const ensure = createFounderOrganizationEnsurer({
      db,
      organizationRepo,
      organizationMemberRepo: throwingMembershipRepo,
    });
    const sessionUser = {
      id: 'synthetic-user-id',
      email: 'synthetic-founder-rollback@example.test',
      role: 'user',
      account_status: 'active',
      subscription_status: 'active',
    };

    assert.throws(
      () => ensure({ sessionUser, clinicName: 'Synthetic Rollback Practice' }),
      /synthetic membership persistence fault/,
    );
    assert.equal(organizationRepo.listAll().length, 0);
    assert.equal(organizationMemberRepo.listAll().length, 0);

    const retry = createFounderOrganizationEnsurer({ db, organizationRepo, organizationMemberRepo });
    const organization = retry({ sessionUser, clinicName: 'Synthetic Rollback Practice' });
    assert.deepEqual(Object.keys(organization).sort(), ['id', 'name']);
    assert.equal(organizationRepo.listAll().length, 1);
    assert.equal(organizationMemberRepo.listAll().length, 1);
  } finally {
    db.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
