import assert from 'node:assert/strict';
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
  ALLOW_OPEN_REGISTRATION: '0',
  OUTBOUND_EMAIL_ENABLED: '0',
  GENERAL_CLINICAL_LLM_ENABLED: '1',
  LLM_REQUIRED: '0',
});

const OWNER_EMAIL = 'owner@restricted-physio.test';
const OWNER_PASSWORD = 'Owner-Restricted-Access-1!';
const CLINICIAN_EMAIL = 'clinician@restricted-physio.test';
const CLINICIAN_PASSWORD = 'Clinician-Restricted-Access-1!';

function route(server, suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function login(server, email, password) {
  return requestJson(server, route(server, '/auth/login'), {
    method: 'POST',
    body: { email, password },
  });
}

async function invokeAccess(server, token, body) {
  return requestJson(server, route(server, '/functions/manageOrganizationAccess'), {
    method: 'POST',
    token,
    body,
  });
}

test('restricted Physio access is invitation-only, owner-governed, single-use, and suspendable', async () => {
  const server = await startTestServer(PHYSIO_RUNTIME);
  try {
    const adminToken = await loginAdmin(server);

    const registration = await requestJson(server, route(server, '/auth/register'), {
      method: 'POST',
      body: { email: 'public@restricted-physio.test', password: 'Public-Registration-1!' },
    });
    assert.equal(registration.status, 403, registration.text);
    assert.match(registration.body?.message || '', /self-registration is disabled/i);

    const globalAdminAccess = await invokeAccess(server, adminToken, { action: 'list' });
    assert.equal(globalAdminAccess.status, 403, globalAdminAccess.text);
    assert.equal(globalAdminAccess.body?.error, 'owner_access_required');

    const ownerCredentials = hashPassword(OWNER_PASSWORD);
    const owner = await requestJson(server, route(server, '/entities/User'), {
      method: 'POST',
      token: adminToken,
      body: {
        email: OWNER_EMAIL,
        full_name: 'Restricted Physio Owner',
        clinician_name: 'Restricted Physio Owner',
        role: 'user',
        account_status: 'active',
        email_verified: true,
        subscription_status: 'active',
        access_entitlement: 'organisation',
        profession: 'Physiotherapist',
        ...ownerCredentials,
      },
    });
    assert.equal(owner.status, 200, owner.text);

    const organization = await requestJson(server, route(server, '/entities/Organization'), {
      method: 'POST',
      token: adminToken,
      body: { name: 'Restricted Physio Test Practice', subscription_status: 'active' },
    });
    assert.equal(organization.status, 200, organization.text);

    const ownerMembership = await requestJson(server, route(server, '/entities/OrganizationMember'), {
      method: 'POST',
      token: adminToken,
      body: {
        org_id: organization.body.id,
        user_email: OWNER_EMAIL,
        role: 'owner',
        is_primary: true,
      },
    });
    assert.equal(ownerMembership.status, 200, ownerMembership.text);

    const ownerLogin = await login(server, OWNER_EMAIL, OWNER_PASSWORD);
    assert.equal(ownerLogin.status, 200, ownerLogin.text);
    const ownerToken = ownerLogin.body.access_token;

    const invite = await invokeAccess(server, ownerToken, {
      action: 'invite',
      org_id: organization.body.id,
      email: CLINICIAN_EMAIL,
      role: 'clinician',
    });
    assert.equal(invite.status, 200, invite.text);
    assert.equal(invite.body?.status, 'success');
    assert.match(invite.body?.test_token || '', /^[A-Za-z0-9_-]{32,128}$/);
    const invitationId = invite.body.invitation.id;
    const firstToken = invite.body.test_token;

    const firstInspection = await requestJson(server, route(server, '/auth/inspect-invitation'), {
      method: 'POST',
      body: { token: firstToken },
    });
    assert.equal(firstInspection.status, 200, firstInspection.text);
    assert.equal(firstInspection.body?.email, CLINICIAN_EMAIL);
    assert.equal(firstInspection.body?.role, 'clinician');

    const resend = await invokeAccess(server, ownerToken, {
      action: 'resend',
      org_id: organization.body.id,
      invitation_id: invitationId,
    });
    assert.equal(resend.status, 200, resend.text);
    assert.notEqual(resend.body?.test_token, firstToken);
    const acceptedToken = resend.body.test_token;

    const rotatedToken = await requestJson(server, route(server, '/auth/inspect-invitation'), {
      method: 'POST',
      body: { token: firstToken },
    });
    assert.equal(rotatedToken.status, 410, rotatedToken.text);

    const acceptance = await requestJson(server, route(server, '/auth/accept-invitation'), {
      method: 'POST',
      body: {
        token: acceptedToken,
        password: CLINICIAN_PASSWORD,
        full_name: 'Restricted Physio Clinician',
      },
    });
    assert.equal(acceptance.status, 200, acceptance.text);
    assert.equal(acceptance.body?.organization_role, 'clinician');
    assert.equal(acceptance.body?.organization?.id, organization.body.id);
    const clinicianToken = acceptance.body.access_token;

    const replay = await requestJson(server, route(server, '/auth/accept-invitation'), {
      method: 'POST',
      body: {
        token: acceptedToken,
        password: CLINICIAN_PASSWORD,
        full_name: 'Replay Attempt',
      },
    });
    assert.equal(replay.status, 410, replay.text);

    const clinicianMemberships = await requestJson(
      server,
      `${route(server, '/entities/OrganizationMember')}?q=${encodeURIComponent(JSON.stringify({ org_id: organization.body.id }))}`,
      { token: clinicianToken },
    );
    assert.equal(clinicianMemberships.status, 200, clinicianMemberships.text);
    const clinicianMembership = clinicianMemberships.body.find((row) => row.user_email === CLINICIAN_EMAIL);
    assert.ok(clinicianMembership);

    const roleChange = await invokeAccess(server, ownerToken, {
      action: 'change_role',
      org_id: organization.body.id,
      membership_id: clinicianMembership.id,
      role: 'admin',
    });
    assert.equal(roleChange.status, 200, roleChange.text);

    const suspended = await invokeAccess(server, ownerToken, {
      action: 'suspend',
      org_id: organization.body.id,
      membership_id: clinicianMembership.id,
    });
    assert.equal(suspended.status, 200, suspended.text);

    const revokedSession = await requestJson(server, route(server, '/entities/User/me'), {
      token: clinicianToken,
    });
    assert.equal(revokedSession.status, 401, revokedSession.text);
    const suspendedLogin = await login(server, CLINICIAN_EMAIL, CLINICIAN_PASSWORD);
    assert.equal(suspendedLogin.status, 403, suspendedLogin.text);
    assert.equal(suspendedLogin.body?.error, 'account_suspended');

    const reinstated = await invokeAccess(server, ownerToken, {
      action: 'reinstate',
      org_id: organization.body.id,
      membership_id: clinicianMembership.id,
    });
    assert.equal(reinstated.status, 200, reinstated.text);
    const restoredLogin = await login(server, CLINICIAN_EMAIL, CLINICIAN_PASSWORD);
    assert.equal(restoredLogin.status, 200, restoredLogin.text);

    const secondInvite = await invokeAccess(server, ownerToken, {
      action: 'invite',
      org_id: organization.body.id,
      email: 'revoked@restricted-physio.test',
      role: 'clinician',
    });
    assert.equal(secondInvite.status, 200, secondInvite.text);
    const revoked = await invokeAccess(server, ownerToken, {
      action: 'revoke',
      org_id: organization.body.id,
      invitation_id: secondInvite.body.invitation.id,
    });
    assert.equal(revoked.status, 200, revoked.text);
    const revokedInspection = await requestJson(server, route(server, '/auth/inspect-invitation'), {
      method: 'POST',
      body: { token: secondInvite.body.test_token },
    });
    assert.equal(revokedInspection.status, 410, revokedInspection.text);

    const accessState = await invokeAccess(server, ownerToken, {
      action: 'list',
      org_id: organization.body.id,
    });
    assert.equal(accessState.status, 200, accessState.text);
    assert.equal(
      accessState.body.members.find((row) => row.email === CLINICIAN_EMAIL)?.role,
      'admin',
    );
    for (const eventType of [
      'invitation_sent',
      'invitation_resent',
      'invitation_accepted',
      'member_role_changed',
      'member_suspended',
      'member_reinstated',
      'invitation_revoked',
    ]) {
      assert.ok(
        accessState.body.events.some((event) => event.event_type === eventType),
        `missing access event ${eventType}`,
      );
    }
  } finally {
    await server.stop();
  }
});
