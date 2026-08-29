import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { hashPassword } from '../auth.mjs';
import {
  loginAdmin,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const PHYSIO_RUNTIME = Object.freeze({
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  APP_URL: 'https://physio.app.assesssuite.com',
  STRIPE_TRIAL_PERIOD_DAYS: '30',
  OUTBOUND_EMAIL_ENABLED: '0',
  ALLOW_OPEN_REGISTRATION: '0',
});

const EMAIL = 'synthetic-physio-self-service@example.test';
const ACCESS_OWNER_EMAIL = 'synthetic-physio-access-owner@example.test';
const ACCESS_OWNER_PASSWORD = 'Synthetic-Physio-Access-Owner-1!';
const INITIAL_PASSWORD = 'Synthetic-Physio-Password-1!';
const REPLACEMENT_PASSWORD = 'Synthetic-Physio-Password-2!';

function appRoute(server, suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function me(server, token) {
  return requestJson(server, appRoute(server, '/entities/User/me'), { token });
}

test('an invited Physio owner reaches an entitled, recoverable clinical account', { timeout: 30_000 }, async () => {
  const server = await startTestServer(PHYSIO_RUNTIME);
  let database;
  try {
    const version = await requestJson(server, '/api/version');
    assert.equal(version.status, 200, version.text);
    assert.equal(version.body?.profession_id, 'physio');
    assert.equal(version.body?.app_id, 'local-assesssuite-physio');

    const publicRegistration = await requestJson(server, appRoute(server, '/auth/register'), {
      method: 'POST',
      body: {
        email: EMAIL,
        password: INITIAL_PASSWORD,
        full_name: 'Synthetic Physio Owner',
      },
    });
    assert.equal(publicRegistration.status, 403, publicRegistration.text);
    assert.match(publicRegistration.body?.message || '', /self-registration is disabled/i);

    const adminToken = await loginAdmin(server);
    const accessOwner = await requestJson(server, appRoute(server, '/entities/User'), {
      method: 'POST', token: adminToken,
      body: {
        email: ACCESS_OWNER_EMAIL,
        full_name: 'Synthetic Physio Access Owner',
        clinician_name: 'Synthetic Physio Access Owner',
        role: 'user',
        account_status: 'active',
        email_verified: true,
        subscription_status: 'active',
        access_entitlement: 'organisation',
        profession: 'Physiotherapist',
        ...hashPassword(ACCESS_OWNER_PASSWORD),
      },
    });
    assert.equal(accessOwner.status, 200, accessOwner.text);
    const organization = await requestJson(server, appRoute(server, '/entities/Organization'), {
      method: 'POST', token: adminToken,
      body: { name: 'Synthetic Physio Practice', subscription_status: 'active' },
    });
    assert.equal(organization.status, 200, organization.text);
    const accessOwnerMembership = await requestJson(
      server,
      appRoute(server, '/entities/OrganizationMember'),
      {
        method: 'POST', token: adminToken,
        body: {
          org_id: organization.body.id,
          user_email: ACCESS_OWNER_EMAIL,
          role: 'owner',
          is_primary: true,
        },
      },
    );
    assert.equal(accessOwnerMembership.status, 200, accessOwnerMembership.text);
    const accessOwnerLogin = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: ACCESS_OWNER_EMAIL, password: ACCESS_OWNER_PASSWORD },
    });
    assert.equal(accessOwnerLogin.status, 200, accessOwnerLogin.text);
    const invitation = await requestJson(
      server,
      appRoute(server, '/functions/manageOrganizationAccess'),
      {
        method: 'POST', token: accessOwnerLogin.body.access_token,
        body: { action: 'invite', org_id: organization.body.id, email: EMAIL, role: 'owner' },
      },
    );
    assert.equal(invitation.status, 200, invitation.text);
    const inviteAcceptance = await requestJson(server, appRoute(server, '/auth/accept-invitation'), {
      method: 'POST',
      body: {
        token: invitation.body.test_token,
        password: INITIAL_PASSWORD,
        full_name: 'Synthetic Physio Owner',
      },
    });
    assert.equal(inviteAcceptance.status, 200, inviteAcceptance.text);
    assert.equal(inviteAcceptance.body?.organization_role, 'owner');
    const firstToken = inviteAcceptance.body?.access_token;
    const invitedUserId = inviteAcceptance.body?.user?.id;
    assert.equal(typeof firstToken, 'string');
    assert.equal(typeof invitedUserId, 'string');

    const activated = await me(server, firstToken);
    assert.equal(activated.status, 200, activated.text);
    assert.equal(activated.body?.account_status, 'active');
    assert.equal(activated.body?.subscription_status, 'active');
    assert.equal(activated.body?.access_entitlement, 'organisation');

    const profile = await requestJson(server, appRoute(server, '/entities/User/me'), {
      method: 'PUT',
      token: firstToken,
      body: {
        clinician_name: 'Synthetic Physio Owner',
        country: 'australia',
        profession: 'Physiotherapist',
        qualifications: 'Synthetic BPhty',
        registration_number: 'SYN-PHYSIO-001',
        clinic_name: 'Synthetic Physio Practice',
        clinic_address: '1 Synthetic Street, Sydney NSW',
        clinic_phone: '0200000000',
        clinic_email: EMAIL,
      },
    });
    assert.equal(profile.status, 200, profile.text);
    assert.equal(profile.body?.profession, 'Physiotherapist');
    assert.equal(profile.body?.country, 'australia');

    const founder = await requestJson(
      server,
      appRoute(server, '/integration-endpoints/Core/EnsureFounderOrganization'),
      {
        method: 'POST',
        token: firstToken,
        body: { clinic_name: 'Synthetic Physio Practice' },
      },
    );
    assert.equal(founder.status, 200, founder.text);
    assert.equal(founder.body?.name, organization.body.name);
    assert.equal(founder.body?.id, organization.body.id);

    const beforeAcceptance = await requestJson(
      server,
      `${appRoute(server, '/entities/Client')}?q=${encodeURIComponent(JSON.stringify({
        org_id: founder.body.id,
      }))}`,
      { token: firstToken },
    );
    assert.equal(beforeAcceptance.status, 403, beforeAcceptance.text);
    assert.match(beforeAcceptance.body?.message || '', /legal acceptance/i);

    const acceptance = await requestJson(
      server,
      appRoute(server, '/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: firstToken,
        body: { org_id: founder.body.id, marketing_opt_in: false },
      },
    );
    assert.equal(acceptance.status, 200, acceptance.text);
    assert.equal(acceptance.body?.owner_bundle, true);
    assert.equal(acceptance.body?.recorded, 8);

    const client = await requestJson(server, appRoute(server, '/entities/Client'), {
      method: 'POST',
      token: firstToken,
      body: {
        org_id: founder.body.id,
        full_name: 'Synthetic Physio Client',
        status: 'active',
      },
    });
    assert.equal(client.status, 200, client.text);

    const episode = await requestJson(server, appRoute(server, '/entities/PhysioCareEpisode'), {
      method: 'POST',
      token: firstToken,
      body: {
        schema_version: 2,
        org_id: founder.body.id,
        client_id: client.body.id,
        episode_number: 1,
        status: 'active',
        episode_start_date: '2026-08-22',
      },
    });
    assert.equal(episode.status, 200, episode.text);
    assert.equal(episode.body?.client_id, client.body.id);

    const secondEmail = 'synthetic-physio-second-practice@example.test';
    const secondAccount = await requestJson(server, appRoute(server, '/entities/User'), {
      method: 'POST', token: adminToken,
      body: {
        email: secondEmail,
        full_name: 'Synthetic Second Physio',
        clinician_name: 'Synthetic Second Physio',
        role: 'user',
        account_status: 'active',
        email_verified: true,
        subscription_status: 'active',
        access_entitlement: 'organisation',
        country: 'australia',
        profession: 'Physiotherapist',
        ...hashPassword(INITIAL_PASSWORD),
      },
    });
    assert.equal(secondAccount.status, 200, secondAccount.text);

    const secondOrganization = await requestJson(server, appRoute(server, '/entities/Organization'), {
      method: 'POST',
      token: adminToken,
      body: { name: 'Synthetic Second Physio Practice' },
    });
    assert.equal(secondOrganization.status, 200, secondOrganization.text);
    const secondMembership = await requestJson(
      server,
      appRoute(server, '/entities/OrganizationMember'),
      {
        method: 'POST',
        token: adminToken,
        body: {
          org_id: secondOrganization.body.id,
          user_email: secondEmail,
          role: 'owner',
          is_primary: true,
        },
      },
    );
    assert.equal(secondMembership.status, 200, secondMembership.text);
    const secondLogin = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: secondEmail, password: INITIAL_PASSWORD },
    });
    assert.equal(secondLogin.status, 200, secondLogin.text);
    const secondToken = secondLogin.body.access_token;
    const secondAcceptance = await requestJson(
      server,
      appRoute(server, '/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: secondToken,
        body: { org_id: secondOrganization.body.id, marketing_opt_in: false },
      },
    );
    assert.equal(secondAcceptance.status, 200, secondAcceptance.text);

    const secondPracticeEpisodes = await requestJson(
      server,
      `${appRoute(server, '/entities/PhysioCareEpisode')}?q=${encodeURIComponent(JSON.stringify({
        org_id: secondOrganization.body.id,
      }))}`,
      { token: secondToken },
    );
    assert.equal(secondPracticeEpisodes.status, 200, secondPracticeEpisodes.text);
    assert.deepEqual(secondPracticeEpisodes.body, []);

    const crossPracticeRead = await requestJson(
      server,
      appRoute(server, `/entities/PhysioCareEpisode/${episode.body.id}`),
      { token: secondToken },
    );
    assert.equal(crossPracticeRead.status, 404, crossPracticeRead.text);
    const crossPracticeWrite = await requestJson(
      server,
      appRoute(server, `/entities/PhysioCareEpisode/${episode.body.id}`),
      {
        method: 'PUT',
        token: secondToken,
        body: { title: 'Cross-practice overwrite must fail' },
      },
    );
    assert.equal(crossPracticeWrite.status, 404, crossPracticeWrite.text);

    const resetRequest = await requestJson(server, appRoute(server, '/auth/reset-password-request'), {
      method: 'POST',
      body: { email: EMAIL },
    });
    assert.equal(resetRequest.status, 200, resetRequest.text);
    assert.deepEqual(resetRequest.body, { status: 'accepted' });

    database = new DatabaseSync(server.dbPath);
    const storedUser = database
      .prepare('SELECT data FROM entity_User WHERE id = ?')
      .get(invitedUserId);
    const resetToken = JSON.parse(storedUser.data).reset_token;
    assert.match(resetToken, /^[0-9a-f-]{36}$/i);

    const reset = await requestJson(server, appRoute(server, '/auth/reset-password'), {
      method: 'POST',
      body: { reset_token: resetToken, new_password: REPLACEMENT_PASSWORD },
    });
    assert.equal(reset.status, 200, reset.text);
    assert.deepEqual(reset.body, { status: 'reset' });

    const consumedToken = await requestJson(server, appRoute(server, '/auth/reset-password'), {
      method: 'POST',
      body: { reset_token: resetToken, new_password: INITIAL_PASSWORD },
    });
    assert.equal(consumedToken.status, 400, consumedToken.text);

    const invalidatedSession = await me(server, firstToken);
    assert.equal(invalidatedSession.status, 401, invalidatedSession.text);

    const oldPassword = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: EMAIL, password: INITIAL_PASSWORD },
    });
    assert.equal(oldPassword.status, 401, oldPassword.text);

    const recoveredLogin = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: EMAIL, password: REPLACEMENT_PASSWORD },
    });
    assert.equal(recoveredLogin.status, 200, recoveredLogin.text);
    assert.equal(typeof recoveredLogin.body?.access_token, 'string');

    const recoveredEpisode = await requestJson(
      server,
      appRoute(server, `/entities/PhysioCareEpisode/${episode.body.id}`),
      { token: recoveredLogin.body.access_token },
    );
    assert.equal(recoveredEpisode.status, 200, recoveredEpisode.text);
    assert.equal(recoveredEpisode.body?.id, episode.body.id);
  } finally {
    database?.close();
    await server.stop();
  }
});
