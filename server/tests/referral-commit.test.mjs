import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createClient } from '@base44/sdk';

import {
  REFERRAL_REVIEW_COMMIT_VERSION,
} from '../referralCommit.mjs';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../uploadRegistry.mjs';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
import { pdfFixture } from './support/synthetic-fixtures.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

function openGateDatabase(server) {
  const db = new DatabaseSync(server.dbPath);
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

async function setupPractitioner(suffix) {
  const server = await startTestServer({
    UPLOAD_USER_PER_MINUTE: '60',
    UPLOAD_ORG_PER_MINUTE: '240',
  });
  const adminToken = await loginAdmin(server);
  const user = await registerUser(server, `referral-commit-${suffix}@example.test`);
  await activateUser(server, adminToken, user.id);
  const organization = await createOrganizationForUser(server, adminToken, user);
  const acceptance = await requestJson(
    server,
    `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
    {
      method: 'POST',
      token: user.token,
      body: { org_id: organization.id, marketing_opt_in: false },
    },
  );
  assert.equal(acceptance.status, 200, acceptance.text);
  const sdk = createClient({
    appId: server.appId,
    serverUrl: server.baseUrl,
    token: user.token,
    requiresAuth: false,
  });
  return { server, adminToken, user, organization, sdk };
}

async function createReviewPendingUpload(context, fileName = 'synthetic-referral.pdf') {
  const upload = await context.sdk.integrations.Core.UploadFile({
    file: new File([pdfFixture()], fileName, { type: 'application/pdf' }),
    org_id: context.organization.id,
    purpose: 'referral-extraction',
    processing_authority_confirmed: true,
    processing_authority_attestation_version:
      REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    subject_age_confirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  });
  const uploadId = upload.upload_id || String(upload.file_url).split('/').at(-1);
  const db = openGateDatabase(context.server);
  try {
    const changed = db.prepare(`
      UPDATE upload_registry SET lifecycle_state = 'review-pending' WHERE id = ?
    `).run(uploadId);
    assert.equal(changed.changes, 1);
  } finally {
    db.close();
  }
  return uploadId;
}

function createPayload(context, uploadId, overrides = {}) {
  return {
    idempotency_key: randomUUID(),
    org_id: context.organization.id,
    operation: 'create',
    client_id: null,
    review_confirmed: true,
    review_version: REFERRAL_REVIEW_COMMIT_VERSION,
    client: {
      full_name: 'Synthetic Reviewed Client',
      date_of_birth: '1990-01-02',
      gender: 'other',
      phone: '0400000000',
    },
    conditions: [
      { condition_name: 'Synthetic ankle sprain', condition_type: 'primary' },
      {
        condition_name: 'Medication',
        condition_type: 'comorbidity',
        medication: 'Synthetic medicine 5 mg',
      },
      {
        condition_name: 'Relevant medical history',
        condition_type: 'comorbidity',
        notes: 'Synthetic reviewed medical history.',
      },
    ],
    upload_ids: [uploadId],
    historical_assessments: [],
    ...overrides,
  };
}

async function invokeCommit(sdk, payload) {
  const response = await sdk.functions.invoke('commitReviewedReferral', payload);
  return response?.data ?? response;
}

async function expectCommitError(sdk, payload, status, code) {
  await assert.rejects(
    () => sdk.functions.invoke('commitReviewedReferral', payload),
    (error) => {
      assert.equal(error?.response?.status, status);
      assert.equal(error?.response?.data?.code, code);
      return true;
    },
  );
}

async function abortCommitRequestMidBody(server, route, token) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: server.listenerAddress,
      port: server.listenerPort,
    });
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(2_000, () => {
      socket.destroy();
      finish(new Error('synthetic aborted request did not close'));
    });
    socket.once('error', (error) => {
      if (['ECONNRESET', 'EPIPE'].includes(error?.code)) finish();
      else finish(error);
    });
    socket.once('close', () => finish());
    socket.once('connect', () => {
      socket.write([
        `POST ${route} HTTP/1.1`,
        `Host: ${server.listenerAddress}:${server.listenerPort}`,
        `Authorization: Bearer ${token}`,
        `X-App-Id: ${server.appId}`,
        'Content-Type: application/json',
        'Content-Length: 4096',
        'Connection: close',
        '',
        '{"idempotency_key":"synthetic-partial',
      ].join('\r\n'), () => {
        setTimeout(() => socket.destroy(), 20);
      });
    });
  });
}

test('aborted commit request bodies are contained for app-scoped and relative function routes', async () => {
  const server = await startTestServer();
  try {
    const token = await loginAdmin(server);
    for (const route of [
      `/api/apps/${server.appId}/functions/commitReviewedReferral`,
      '/functions/commitReviewedReferral',
    ]) {
      await abortCommitRequestMidBody(server, route, token);
      // Give the request-body async iterator enough time to reject. Without an
      // awaited handler this becomes an unhandled rejection and exits Node 24.
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(server.child.exitCode, null, route);
      const health = await requestJson(
        server,
        '/api/apps/public/prod/public-settings/by-id/referral-abort-health',
      );
      assert.equal(health.status, 200, `${route}\n${server.getOutput()}`);
    }
    assert.doesNotMatch(server.getOutput(), /UnhandledPromiseRejection|triggerUncaughtException/);
  } finally {
    await server.stop();
  }
});

test('reviewed referral commit rejects an oversized JSON body before persistence', async () => {
  const server = await startTestServer();
  try {
    const token = await loginAdmin(server);
    const result = await requestJson(
      server,
      `/api/apps/${server.appId}/functions/commitReviewedReferral`,
      {
        method: 'POST',
        token,
        body: { padding: 'x'.repeat(256 * 1024) },
      },
    );
    assert.equal(result.status, 413, result.text);
    assert.equal(result.body?.code, 'request_too_large');
    const db = openGateDatabase(server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
    } finally {
      db.close();
    }
    assert.equal(server.child.exitCode, null);
  } finally {
    await server.stop();
  }
});

test('commit route rejects non-empty historical assessments before every clinical write', async () => {
  const context = await setupPractitioner('historical-rejected');
  try {
    const uploadId = await createReviewPendingUpload(context, 'synthetic-historical-referral.pdf');
    const result = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/functions/commitReviewedReferral`,
      {
        method: 'POST',
        token: context.user.token,
        body: createPayload(context, uploadId, {
          historical_assessments: [{
            assessment_id: randomUUID(),
            result_value: 11.5,
            result_value_secondary: 7,
            assessment_date: '2026-07-19',
            performed_by: 'Synthetic Practitioner',
            notes: 'Synthetic historical observation.',
          }],
        }),
      },
    );
    assert.equal(result.status, 400, result.text);
    assert.equal(result.body?.code, 'historical_assessments_not_supported');

    const db = openGateDatabase(context.server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientAssessment').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      assert.equal(
        db.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
        'review-pending',
      );
    } finally {
      db.close();
    }
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('reviewed referral commit atomically creates reviewed records and replays one idempotent result', async () => {
  const context = await setupPractitioner('create-replay');
  try {
    const uploadId = await createReviewPendingUpload(context);
    const payload = createPayload(context, uploadId);

    const first = await invokeCommit(context.sdk, payload);
    const replay = await invokeCommit(context.sdk, payload);
    assert.deepEqual(replay, first);
    assert.deepEqual(first.counts, {
      conditions_created: 3,
      documents_retained: 1,
      historical_assessments_created: 0,
    });

    const clients = await context.sdk.entities.Client.filter({ org_id: context.organization.id });
    const conditions = await context.sdk.entities.ClientCondition.filter({ client_id: first.client_id });
    const documents = await context.sdk.entities.ClientDocument.filter({ client_id: first.client_id });
    const assessments = await context.sdk.entities.ClientAssessment.filter({ client_id: first.client_id });
    assert.equal(clients.filter((client) => client.id === first.client_id).length, 1);
    assert.equal(conditions.length, 3);
    assert.equal(documents.length, 1);
    assert.equal(assessments.length, 0);
    assert.equal(clients.find((client) => client.id === first.client_id)?.medical_history, undefined);
    assert.equal(
      conditions.find((condition) => condition.condition_name === 'Relevant medical history')?.notes,
      'Synthetic reviewed medical history.',
    );
    assert.equal(documents[0].file_url, `/uploads/${uploadId}`);
    assert.equal(documents[0].file_name, 'synthetic-referral.pdf');

    const db = openGateDatabase(context.server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 1);
      const upload = db.prepare(`
        SELECT lifecycle_state, bound_entity_type, bound_entity_id
        FROM upload_registry WHERE id = ?
      `).get(uploadId);
      assert.equal(upload.lifecycle_state, 'bound');
      assert.equal(upload.bound_entity_type, 'ClientDocument');
      assert.equal(upload.bound_entity_id, documents[0].id);
    } finally {
      db.close();
    }
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('review, tenant, target, upload and idempotency controls fail closed without writes', async () => {
  const context = await setupPractitioner('negative');
  let outsiderSdk = null;
  try {
    const uploadId = await createReviewPendingUpload(context, 'synthetic-negative-referral.pdf');
    const basePayload = createPayload(context, uploadId);

    const uploadWithoutAuthority = await createReviewPendingUpload(
      context,
      'synthetic-missing-authority-receipt.pdf',
    );
    const provenanceDb = openGateDatabase(context.server);
    try {
      provenanceDb.prepare(`
        DELETE FROM upload_audit
        WHERE upload_id = ? AND event_type = 'upload_registered' AND outcome = 'success'
      `).run(uploadWithoutAuthority);
    } finally {
      provenanceDb.close();
    }
    await expectCommitError(
      context.sdk,
      createPayload(context, uploadWithoutAuthority),
      404,
      'upload_not_found',
    );

    const anonymous = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/functions/commitReviewedReferral`,
      { method: 'POST', body: basePayload },
    );
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body?.code, 'authentication_required');

    await expectCommitError(
      context.sdk,
      { ...basePayload, review_confirmed: false },
      403,
      'review_required',
    );
    await expectCommitError(
      context.sdk,
      { ...basePayload, client: { ...basePayload.client, org_id: context.organization.id } },
      400,
      'invalid_client_review',
    );
    await expectCommitError(
      context.sdk,
      { ...basePayload, client: { ...basePayload.client, medical_history: 'undeclared Client field' } },
      400,
      'invalid_client_review',
    );
    await expectCommitError(
      context.sdk,
      {
        ...basePayload,
        operation: 'update',
        client_id: randomUUID(),
        client: {
          full_name: basePayload.client.full_name,
          date_of_birth: basePayload.client.date_of_birth,
          phone: '0411111111',
        },
      },
      404,
      'client_not_found',
    );

    const outsider = await registerUser(context.server, 'referral-commit-outsider@example.test');
    await activateUser(context.server, context.adminToken, outsider.id);
    outsiderSdk = createClient({
      appId: context.server.appId,
      serverUrl: context.server.baseUrl,
      token: outsider.token,
      requiresAuth: false,
    });
    await expectCommitError(outsiderSdk, basePayload, 403, 'org_forbidden');

    const membership = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/entities/OrganizationMember`,
      {
        method: 'POST',
        token: context.adminToken,
        body: {
          org_id: context.organization.id,
          user_email: outsider.email,
          role: 'clinician',
          is_primary: true,
        },
      },
    );
    assert.equal(membership.status, 200, membership.text);
    await expectCommitError(outsiderSdk, basePayload, 403, 'legal_acceptance_required');

    const outsiderAcceptance = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      {
        method: 'POST',
        token: outsider.token,
        body: { org_id: context.organization.id, marketing_opt_in: false },
      },
    );
    assert.equal(outsiderAcceptance.status, 200, outsiderAcceptance.text);
    await expectCommitError(outsiderSdk, basePayload, 404, 'upload_not_found');

    const first = await invokeCommit(context.sdk, basePayload);
    await expectCommitError(
      context.sdk,
      {
        ...basePayload,
        client: { ...basePayload.client, phone: '0499999999' },
      },
      409,
      'idempotency_conflict',
    );
    await expectCommitError(
      context.sdk,
      { ...basePayload, idempotency_key: randomUUID() },
      404,
      'upload_not_found',
    );

    const clients = await context.sdk.entities.Client.filter({ org_id: context.organization.id });
    assert.equal(clients.filter((client) => client.full_name === 'Synthetic Reviewed Client').length, 1);
    assert.ok(clients.some((client) => client.id === first.client_id));
  } finally {
    outsiderSdk?.cleanup();
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('an injected upload-binding fault rolls back client, children, audit and receipt, then permits retry', async () => {
  const context = await setupPractitioner('rollback');
  try {
    const uploadId = await createReviewPendingUpload(context, 'synthetic-rollback-referral.pdf');
    const payload = createPayload(context, uploadId);

    const db = openGateDatabase(context.server);
    try {
      db.exec(`
        CREATE TRIGGER synthetic_referral_commit_bind_fault
        BEFORE UPDATE OF lifecycle_state ON upload_registry
        WHEN NEW.lifecycle_state = 'bound'
        BEGIN
          SELECT RAISE(ABORT, 'synthetic_referral_commit_bind_fault');
        END;
      `);
    } finally {
      db.close();
    }

    await expectCommitError(context.sdk, payload, 500, 'internal_error');

    const inspection = openGateDatabase(context.server);
    try {
      assert.equal(inspection.prepare(`
        SELECT COUNT(*) AS n FROM entity_Client
        WHERE json_extract(data, '$.full_name') = 'Synthetic Reviewed Client'
      `).get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientAssessment').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      assert.equal(
        inspection.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
        'review-pending',
      );
      assert.equal(
        inspection.prepare(`
          SELECT COUNT(*) AS n FROM upload_audit
          WHERE upload_id = ? AND event_type = 'upload_bound'
        `).get(uploadId).n,
        0,
      );
      inspection.exec('DROP TRIGGER synthetic_referral_commit_bind_fault;');
    } finally {
      inspection.close();
    }

    const retry = await invokeCommit(context.sdk, payload);
    assert.equal(retry.status, 'success');
    assert.equal(retry.counts.documents_retained, 1);
    assert.equal(context.server.getOutput().includes('Synthetic Reviewed Client'), false);
    assert.equal(context.server.getOutput().includes('synthetic-rollback-referral.pdf'), false);
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('a later upload-binding fault also rolls back an earlier successful bind and every clinical write', async () => {
  const context = await setupPractitioner('later-bind-rollback');
  try {
    const firstUploadId = await createReviewPendingUpload(context, 'synthetic-first-bind.pdf');
    const secondUploadId = await createReviewPendingUpload(context, 'synthetic-second-bind.pdf');
    const payload = createPayload(context, firstUploadId, {
      upload_ids: [firstUploadId, secondUploadId],
    });

    const db = openGateDatabase(context.server);
    try {
      db.exec(`
        CREATE TRIGGER synthetic_referral_second_bind_fault
        BEFORE UPDATE OF lifecycle_state ON upload_registry
        WHEN NEW.id = '${secondUploadId}' AND NEW.lifecycle_state = 'bound'
        BEGIN
          SELECT RAISE(ABORT, 'synthetic_referral_second_bind_fault');
        END;
      `);
    } finally {
      db.close();
    }

    await expectCommitError(context.sdk, payload, 500, 'internal_error');

    const inspection = openGateDatabase(context.server);
    try {
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      for (const uploadId of [firstUploadId, secondUploadId]) {
        assert.equal(
          inspection.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
          'review-pending',
        );
        assert.equal(
          inspection.prepare(`
            SELECT COUNT(*) AS n FROM upload_audit
            WHERE upload_id = ? AND event_type = 'upload_bound'
          `).get(uploadId).n,
          0,
        );
      }
      inspection.exec('DROP TRIGGER synthetic_referral_second_bind_fault;');
    } finally {
      inspection.close();
    }

    const retry = await invokeCommit(context.sdk, payload);
    assert.equal(retry.status, 'success');
    assert.equal(retry.counts.documents_retained, 2);
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('same-size physical upload tampering fails integrity verification before any clinical write', async () => {
  const context = await setupPractitioner('integrity-tamper');
  try {
    const uploadId = await createReviewPendingUpload(context, 'synthetic-integrity-referral.pdf');
    const db = openGateDatabase(context.server);
    let storedName;
    try {
      storedName = db.prepare('SELECT stored_name FROM upload_registry WHERE id = ?').get(uploadId).stored_name;
    } finally {
      db.close();
    }
    const filePath = path.join(context.server.uploadsDir, storedName);
    const bytes = fs.readFileSync(filePath);
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    fs.writeFileSync(filePath, bytes);

    await expectCommitError(context.sdk, createPayload(context, uploadId), 409, 'upload_integrity_failed');

    const inspection = openGateDatabase(context.server);
    try {
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(inspection.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      assert.equal(
        inspection.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
        'review-pending',
      );
    } finally {
      inspection.close();
    }
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('update route rejects a wrong-patient identity before every write or upload bind', async () => {
  const context = await setupPractitioner('wrong-patient');
  try {
    const existing = await context.sdk.entities.Client.create({
      org_id: context.organization.id,
      assigned_clinician_email: context.user.email,
      full_name: 'Synthetic Selected Patient',
      date_of_birth: '1988-02-03',
      gender: 'female',
      phone: '0400111222',
    });
    const uploadId = await createReviewPendingUpload(context, 'synthetic-wrong-patient-referral.pdf');
    const payload = createPayload(context, uploadId, {
      operation: 'update',
      client_id: existing.id,
      client: {
        full_name: 'Entirely Different Person',
        date_of_birth: '1975-09-08',
        address: 'This value must never persist',
      },
      conditions: [{
        condition_name: 'This condition must never persist',
        condition_type: 'primary',
      }],
    });

    const response = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/functions/commitReviewedReferral`,
      { method: 'POST', token: context.user.token, body: payload },
    );
    assert.equal(response.status, 409, response.text);
    assert.equal(response.body?.code, 'client_identity_mismatch');

    const unchanged = await context.sdk.entities.Client.get(existing.id);
    assert.equal(unchanged.full_name, 'Synthetic Selected Patient');
    assert.equal(unchanged.date_of_birth, '1988-02-03');
    assert.equal(unchanged.address, undefined);
    const db = openGateDatabase(context.server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientAssessment').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      assert.equal(
        db.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
        'review-pending',
      );
    } finally {
      db.close();
    }
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('update route rejects a same-DOB token-subset name before every write or upload bind', async () => {
  const context = await setupPractitioner('token-subset-identity');
  try {
    const existing = await context.sdk.entities.Client.create({
      org_id: context.organization.id,
      assigned_clinician_email: context.user.email,
      full_name: 'Jane Marie Doe',
      date_of_birth: '1988-02-03',
      gender: 'female',
      phone: '0400111222',
    });
    const uploadId = await createReviewPendingUpload(context, 'synthetic-token-subset-referral.pdf');
    const payload = createPayload(context, uploadId, {
      operation: 'update',
      client_id: existing.id,
      client: {
        full_name: 'Jane Doe',
        date_of_birth: '1988-02-03',
        address: 'This value must never persist',
      },
      conditions: [{
        condition_name: 'This condition must never persist',
        condition_type: 'primary',
      }],
    });

    const response = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/functions/commitReviewedReferral`,
      { method: 'POST', token: context.user.token, body: payload },
    );
    assert.equal(response.status, 409, response.text);
    assert.equal(response.body?.code, 'client_identity_mismatch');

    const unchanged = await context.sdk.entities.Client.get(existing.id);
    assert.equal(unchanged.full_name, 'Jane Marie Doe');
    assert.equal(unchanged.date_of_birth, '1988-02-03');
    assert.equal(unchanged.address, undefined);
    const db = openGateDatabase(context.server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      assert.equal(
        db.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
        'review-pending',
      );
    } finally {
      db.close();
    }
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('update route requires both reviewed identity fields before every write or upload bind', async () => {
  const context = await setupPractitioner('identity-required');
  try {
    const existing = await context.sdk.entities.Client.create({
      org_id: context.organization.id,
      assigned_clinician_email: context.user.email,
      full_name: 'Synthetic Identity Required',
      date_of_birth: '1988-02-03',
      gender: 'female',
      phone: '0400111222',
    });
    const uploadId = await createReviewPendingUpload(context, 'synthetic-identity-required.pdf');

    for (const client of [
      { phone: '0499999999' },
      { full_name: existing.full_name, phone: '0499999999' },
      { date_of_birth: existing.date_of_birth, phone: '0499999999' },
    ]) {
      await expectCommitError(
        context.sdk,
        createPayload(context, uploadId, {
          operation: 'update',
          client_id: existing.id,
          client,
          conditions: [{
            condition_name: 'This incomplete-identity condition must never persist',
            condition_type: 'primary',
          }],
        }),
        400,
        'incomplete_client_review',
      );
    }

    const unchanged = await context.sdk.entities.Client.get(existing.id);
    assert.equal(unchanged.phone, '0400111222');
    const db = openGateDatabase(context.server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      assert.equal(
        db.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state,
        'review-pending',
      );
    } finally {
      db.close();
    }
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('reviewed under-13 DOB blocks the commit, clinical writes and every later provider retry', async () => {
  const context = await setupPractitioner('reviewed-under-13');
  try {
    const uploadId = await createReviewPendingUpload(context, 'synthetic-reviewed-under-13.pdf');
    const markerPath = path.join(context.server.uploadsDir, `${uploadId}.provider-block`);
    const payload = createPayload(context, uploadId, {
      client: {
        full_name: 'Synthetic Reviewed Minor',
        date_of_birth: '2020-01-02',
        gender: 'other',
      },
      conditions: [{
        condition_name: 'This under-13 condition must never persist',
        condition_type: 'primary',
      }],
    });

    await expectCommitError(context.sdk, payload, 409, 'reviewed_subject_under_13');

    const db = openGateDatabase(context.server);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientCondition').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM referral_commit_receipt').get().n, 0);
      const upload = db.prepare(`
        SELECT lifecycle_state, subject_age_band, expires_at
        FROM upload_registry WHERE id = ?
      `).get(uploadId);
      assert.equal(upload.lifecycle_state, 'expired');
      assert.equal(upload.subject_age_band, 'under_13');
      assert.ok(Date.parse(upload.expires_at) <= Date.now(), upload.expires_at);
    } finally {
      db.close();
    }
    assert.equal(fs.statSync(markerPath).size, 0);
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});

test('same-patient update is identity- and tenant-bound, preserves values and avoids duplicate conditions', async () => {
  const context = await setupPractitioner('update');
  try {
    const existing = await context.sdk.entities.Client.create({
      org_id: context.organization.id,
      assigned_clinician_email: context.user.email,
      full_name: 'Synthetic Existing-Client',
      date_of_birth: '1988-02-03',
      gender: 'female',
      phone: '0400111222',
      consent_confirmed: false,
    });
    await context.sdk.entities.ClientCondition.create({
      org_id: context.organization.id,
      client_id: existing.id,
      condition_name: 'Synthetic stable condition',
      condition_type: 'primary',
      is_active: true,
    });
    const inactiveCondition = await context.sdk.entities.ClientCondition.create({
      org_id: context.organization.id,
      client_id: existing.id,
      condition_name: 'Synthetic inactive comorbidity',
      condition_type: 'comorbidity',
      is_active: false,
    });
    const uploadId = await createReviewPendingUpload(context, 'synthetic-update-referral.pdf');
    const payload = createPayload(context, uploadId, {
      operation: 'update',
      client_id: existing.id,
      client: {
        full_name: 'Synthetic Existing Client',
        date_of_birth: '1988-02-03',
        address: '1 Synthetic Assurance Street',
      },
      conditions: [
        { condition_name: 'Synthetic stable condition', condition_type: 'primary' },
        { condition_name: 'Synthetic inactive comorbidity', condition_type: 'comorbidity' },
        { condition_name: 'Synthetic new comorbidity', condition_type: 'comorbidity' },
      ],
    });

    const response = await requestJson(
      context.server,
      `/api/apps/${context.server.appId}/functions/commitReviewedReferral`,
      { method: 'POST', token: context.user.token, body: payload },
    );
    assert.equal(response.status, 200, response.text);
    const result = response.body;
    assert.equal(result.client_id, existing.id);
    assert.equal(result.counts.conditions_created, 1);
    const updated = await context.sdk.entities.Client.get(existing.id);
    assert.equal(updated.address, '1 Synthetic Assurance Street');
    assert.equal(updated.full_name, 'Synthetic Existing Client');
    assert.equal(updated.phone, '0400111222');
    assert.equal(updated.assigned_clinician_email, context.user.email);
    const conditions = await context.sdk.entities.ClientCondition.filter({ client_id: existing.id });
    assert.equal(conditions.length, 3);
    assert.equal(conditions.find((condition) => condition.id === inactiveCondition.id)?.is_active, true);
  } finally {
    context.sdk.cleanup();
    await context.server.stop();
  }
});
