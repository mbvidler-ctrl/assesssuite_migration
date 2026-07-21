import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  adminNotifyEmail,
  inviteEmail,
  otpEmail,
  resetEmail,
  welcomeEmail,
} from '../email.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const ADMIN_RECIPIENT = 'relay-admin@example.test';

function readOutbox(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare('SELECT payload FROM outbox_email ORDER BY created_date, id').all()
      .map((row) => JSON.parse(row.payload));
  } finally {
    db.close();
  }
}

async function provisionFeedbackUser(server, adminToken, email) {
  const user = await registerUser(server, email);
  await activateUser(server, adminToken, user.id);
  const entitlement = await requestJson(server, `/api/apps/${server.appId}/entities/User/${user.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { subscription_status: 'active' },
  });
  assert.equal(entitlement.status, 200, entitlement.text);
  const organization = await createOrganizationForUser(server, adminToken, user);
  const acceptance = await requestJson(
    server,
    `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
    { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
  );
  assert.equal(acceptance.status, 200, acceptance.text);
  return { ...user, organization };
}

async function createAssessmentRequest(server, user, overrides = {}) {
  const created = await requestJson(server, `/api/apps/${server.appId}/entities/AssessmentRequest`, {
    method: 'POST',
    token: user.token,
    body: {
      org_id: user.organization.id,
      request_type: 'error_report',
      assessment_name: 'Synthetic Assessment',
      details: 'SYNTHETIC-FEEDBACK-MARKER',
      user_email: user.email,
      user_name: 'Synthetic Feedback User',
      status: 'pending',
      ...overrides,
    },
  });
  assert.equal(created.status, 200, created.text);
  return created.body;
}

test('SendEmail is a tenant-bound, quota-limited AssessmentRequest notification rather than a generic relay', async () => {
  const server = await startTestServer({
    EMAIL_ADMIN_NOTIFY: ADMIN_RECIPIENT,
    OUTBOUND_EMAIL_ENABLED: '0',
  });
  try {
    const adminToken = await loginAdmin(server);
    const user = await provisionFeedbackUser(server, adminToken, 'synthetic-feedback-owner@example.test');
    const foreignUser = await provisionFeedbackUser(server, adminToken, 'synthetic-feedback-foreign@example.test');
    const request = await createAssessmentRequest(server, user);
    const foreignRequest = await createAssessmentRequest(server, foreignUser);
    const route = `/api/apps/${server.appId}/integration-endpoints/Core/SendEmail`;
    const send = (body, suppliedToken = user.token) => requestJson(server, route, {
      method: 'POST',
      token: suppliedToken,
      body,
    });

    const baseline = readOutbox(server.dbPath).length;
    const unauthenticated = await send({ assessment_request_id: request.id }, null);
    assert.equal(unauthenticated.status, 401);

    const legacyRelay = await send({
      to: 'arbitrary-recipient@example.test',
      subject: 'Synthetic relay attempt',
      body: 'SYNTHETIC-RELAY-MARKER',
    });
    assert.equal(legacyRelay.status, 400);
    assert.equal(legacyRelay.body?.code, 'invalid_feedback_notification_request');
    assert.equal(readOutbox(server.dbPath).length, baseline);

    const injectedRelay = await send({
      assessment_request_id: request.id,
      to: 'arbitrary-recipient@example.test',
      subject: 'Synthetic relay attempt',
      body: 'SYNTHETIC-RELAY-MARKER',
    });
    assert.equal(injectedRelay.status, 400);
    assert.equal(injectedRelay.body?.code, 'invalid_feedback_notification_request');
    assert.equal(readOutbox(server.dbPath).length, baseline);

    const malformedIds = [null, 7, '', 'not-a-request-id'];
    for (const assessmentRequestId of malformedIds) {
      const result = await send({ assessment_request_id: assessmentRequestId });
      assert.equal(result.status, 400);
      assert.equal(result.body?.code, 'invalid_assessment_request_id');
    }

    const foreign = await send({ assessment_request_id: foreignRequest.id });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.body?.code, 'assessment_request_not_found');
    assert.equal(readOutbox(server.dbPath).length, baseline);

    const spoofedOwnerRequest = await createAssessmentRequest(server, user, { user_email: foreignUser.email });
    const spoofedOwner = await send({ assessment_request_id: spoofedOwnerRequest.id });
    assert.equal(spoofedOwner.status, 404);
    assert.equal(spoofedOwner.body?.code, 'assessment_request_not_found');

    const crossTenantRecord = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/AssessmentRequest`,
      {
        method: 'POST',
        token: adminToken,
        body: {
          org_id: foreignUser.organization.id,
          request_type: 'error_report',
          details: 'SYNTHETIC-CROSS-TENANT-MARKER',
          user_email: user.email,
          user_name: 'Synthetic Feedback User',
          status: 'pending',
        },
      },
    );
    assert.equal(crossTenantRecord.status, 200, crossTenantRecord.text);
    const crossTenant = await send({ assessment_request_id: crossTenantRecord.body.id });
    assert.equal(crossTenant.status, 404);
    assert.equal(crossTenant.body?.code, 'assessment_request_not_found');
    assert.equal(readOutbox(server.dbPath).length, baseline);

    const ineligibleStates = [
      [{ email_verified: false }, { email_verified: true }],
      [{ subscription_status: 'inactive' }, { subscription_status: 'active' }],
      [{ account_status: 'pending' }, { account_status: 'active' }],
    ];
    for (const [disabled, restored] of ineligibleStates) {
      const entitlementDisabled = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/User/${user.id}`,
        { method: 'PUT', token: adminToken, body: disabled },
      );
      assert.equal(entitlementDisabled.status, 200, entitlementDisabled.text);
      const ineligible = await send({ assessment_request_id: request.id });
      assert.equal(ineligible.status, 403);
      assert.equal(ineligible.body?.code, 'feedback_notification_not_permitted');
      assert.equal(readOutbox(server.dbPath).length, baseline);
      const entitlementRestored = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/User/${user.id}`,
        { method: 'PUT', token: adminToken, body: restored },
      );
      assert.equal(entitlementRestored.status, 200, entitlementRestored.text);
    }
    // Restoring account_status through the real admin path records the normal
    // welcome message. Begin feedback-notification accounting after it.
    const notificationBaseline = readOutbox(server.dbPath).length;

    const invalidRecord = await createAssessmentRequest(server, user, { details: 'x'.repeat(5_001) });
    const invalidRecordResult = await send({ assessment_request_id: invalidRecord.id });
    assert.equal(invalidRecordResult.status, 400);
    assert.equal(invalidRecordResult.body?.code, 'invalid_assessment_request_record');
    assert.equal(readOutbox(server.dbPath).length, notificationBaseline);

    const first = await send({ assessment_request_id: request.id });
    assert.equal(first.status, 200, first.text);
    assert.deepEqual(first.body, {
      status: 'recorded',
      assessment_request_id: request.id,
      recorded: true,
      sent: false,
    });

    const retry = await send({ assessment_request_id: request.id });
    assert.equal(retry.status, 200, retry.text);
    assert.deepEqual(retry.body, {
      status: 'already_recorded',
      assessment_request_id: request.id,
      recorded: true,
      sent: false,
    });
    assert.equal(readOutbox(server.dbPath).length, notificationBaseline + 2);

    for (let index = 0; index < 4; index += 1) {
      const anotherRequest = await createAssessmentRequest(server, user, {
        assessment_name: `Synthetic quota request ${index}`,
        details: `SYNTHETIC-QUOTA-MARKER-${index}`,
      });
      const result = await send({ assessment_request_id: anotherRequest.id });
      assert.equal(result.status, 200, result.text);
    }
    const overQuotaRequest = await createAssessmentRequest(server, user, {
      assessment_name: 'Synthetic over-quota request',
      details: 'SYNTHETIC-OVER-QUOTA-MARKER',
    });
    const overQuota = await send({ assessment_request_id: overQuotaRequest.id });
    assert.equal(overQuota.status, 429);
    assert.equal(overQuota.body?.code, 'feedback_notification_rate_limited');

    const outbox = readOutbox(server.dbPath);
    assert.equal(outbox.length, notificationBaseline + 10);
    const notificationRows = outbox.slice(notificationBaseline);
    assert.equal(notificationRows.filter((item) => item.to === ADMIN_RECIPIENT).length, 5);
    assert.equal(notificationRows.filter((item) => item.to === user.email).length, 5);
    assert.ok(notificationRows.every((item) => item.body === null));
    assert.ok(notificationRows.every((item) => /AssessSuite (?:feedback|request confirmation) \[[0-9a-f-]{36}\]/.test(item.subject)));
    assert.doesNotMatch(JSON.stringify(notificationRows), /SYNTHETIC-(?:FEEDBACK|RELAY|QUOTA|OVER-QUOTA)-MARKER/);
  } finally {
    await server.stop();
  }
});

test('transactional HTML templates escape every interpolated value', { concurrency: false }, () => {
  const hostile = `<img src=x onerror="alert('x')"> & "quoted"`;
  const hostileLink = `https://example.test/reset?q=${encodeURIComponent(hostile)}&raw="'><svg/onload=alert(1)>`;
  const previousReplyTo = process.env.EMAIL_REPLY_TO;
  process.env.EMAIL_REPLY_TO = hostile;
  try {
    const templates = [
      otpEmail(hostile),
      resetEmail(hostileLink),
      welcomeEmail(hostile),
      adminNotifyEmail(hostile),
      inviteEmail(hostile),
    ];
    for (const template of templates) {
      assert.doesNotMatch(template.html, /<(?:img|svg)\b|on(?:error|load)\s*=\s*["']/i);
      assert.match(template.html, /&(?:lt|gt|amp|quot|#39);/);
    }
    assert.match(resetEmail(hostileLink).html, /href="https:\/\/example\.test\/reset\?q=/);
    assert.doesNotMatch(resetEmail(hostileLink).html, /raw="'><svg/i);
  } finally {
    if (previousReplyTo === undefined) delete process.env.EMAIL_REPLY_TO;
    else process.env.EMAIL_REPLY_TO = previousReplyTo;
  }
});
