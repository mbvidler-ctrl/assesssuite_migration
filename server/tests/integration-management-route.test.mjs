import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword } from '../auth.mjs';
import { loginAdmin, requestJson, startTestServer } from './support/server-harness.mjs';

const OWNER_EMAIL = 'connector-owner@example.test';
const OWNER_PASSWORD = 'Connector-Owner-Test-1!';
const KEY = Buffer.alloc(32, 41).toString('base64');

function route(server, suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function invoke(server, token, body) {
  return requestJson(server, route(server, '/functions/manageIntegrations'), {
    method: 'POST', token, body,
  });
}

test('owner-managed Halaxy credentials are encrypted, non-readable and removable in both product builds', async (t) => {
  for (const runtime of [
    { name: 'EP', env: { PROFESSION: 'exercise-physiology', DEFAULT_APP_ID: 'local-assesssuite' }, profession: 'Exercise Physiologist' },
    { name: 'Physio', env: { PROFESSION: 'physio', DEFAULT_APP_ID: 'local-assesssuite-physio', ALLOW_OPEN_REGISTRATION: '0' }, profession: 'Physiotherapist' },
  ]) {
    await t.test(runtime.name, async () => {
      const server = await startTestServer({
        ...runtime.env,
        ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY: KEY,
      });
      try {
        const adminToken = await loginAdmin(server);
        const owner = await requestJson(server, route(server, '/entities/User'), {
          method: 'POST',
          token: adminToken,
          body: {
            email: OWNER_EMAIL,
            clinician_name: 'Connector Owner',
            role: 'user',
            account_status: 'active',
            email_verified: true,
            subscription_status: 'active',
            country: 'australia',
            profession: runtime.profession,
            ...hashPassword(OWNER_PASSWORD),
          },
        });
        assert.equal(owner.status, 200, owner.text);
        const organization = await requestJson(server, route(server, '/entities/Organization'), {
          method: 'POST', token: adminToken, body: { name: `${runtime.name} Connector Practice` },
        });
        assert.equal(organization.status, 200, organization.text);
        const membership = await requestJson(server, route(server, '/entities/OrganizationMember'), {
          method: 'POST',
          token: adminToken,
          body: { org_id: organization.body.id, user_email: OWNER_EMAIL, role: 'owner', is_primary: true },
        });
        assert.equal(membership.status, 200, membership.text);
        const login = await requestJson(server, route(server, '/auth/login'), {
          method: 'POST', body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
        });
        assert.equal(login.status, 200, login.text);
        const ownerToken = login.body.access_token;

        const initial = await invoke(server, ownerToken, { action: 'list' });
        assert.equal(initial.status, 200, initial.text);
        assert.equal(initial.body.can_manage, true);
        assert.equal(initial.body.encrypted_storage_ready, true);
        assert.equal(initial.body.connectors[0].status, 'disconnected');

        const saved = await invoke(server, ownerToken, {
          action: 'save',
          provider_id: 'halaxy',
          configuration: {
            region: 'au',
            client_id: 'halaxy-client-9876',
            client_secret: 'test-halaxy-secret-never-return',
            settings: { import_patients: true, export_patients: true },
          },
        });
        assert.equal(saved.status, 200, saved.text);
        assert.equal(saved.body.connector.status, 'configured');
        assert.equal(saved.body.connector.credential_hint, '••••9876');
        assert.doesNotMatch(saved.text, /test-halaxy-secret-never-return|halaxy-client-9876/);

        const listed = await invoke(server, ownerToken, { action: 'list' });
        assert.equal(listed.status, 200, listed.text);
        assert.equal(listed.body.connectors[0].settings.export_patients, true);
        assert.ok(listed.body.events.some((event) => event.event_type === 'configured'));
        assert.doesNotMatch(listed.text, /test-halaxy-secret-never-return|halaxy-client-9876/);

        const adminAttempt = await invoke(server, adminToken, {
          action: 'save', provider_id: 'halaxy', configuration: {},
        });
        assert.equal(adminAttempt.status, 403, adminAttempt.text);

        const disconnected = await invoke(server, ownerToken, {
          action: 'disconnect', provider_id: 'halaxy',
        });
        assert.equal(disconnected.status, 200, disconnected.text);
        assert.equal(disconnected.body.connector.status, 'disconnected');
        assert.equal(disconnected.body.connector.credential_hint, null);
      } finally {
        await server.stop();
      }
    });
  }
});
