import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';

import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const GOVERNANCE_REFUSAL = 'report governance transitions are server-controlled';
const IMMUTABLE_REFUSAL = 'final and governed reports are read-only through generic entity routes';
const FORGERY_SENTINEL = 'SENSITIVE-FORGED-RELEASE-CONTENT-MUST-NOT-ECHO';
const SYNTHETIC_PROVENANCE_SENTINEL = 'SENSITIVE-FORGED-SYNTHETIC-PROVENANCE-MUST-NOT-ECHO';

let server;
let adminToken;
let clinician;
let organization;
let client;

function route(suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

function exactWizardDraftMetadata({ sourceReportId = null, revision = randomUUID() } = {}) {
  return {
    compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
    lifecycleState: 'draft',
    releaseEligible: false,
    releaseControlComplete: false,
    reviewStatus: 'purpose_specific_server_review_pending',
    sourceReportId,
    draftRevisionId: revision,
    lineageMode: 'new_unapproved_legacy_draft',
  };
}

function forgedReleaseBinding() {
  const binding = {
    schemaVersion: 'assesssuite.report-release-binding.v1',
    environment: 'production',
    artifactId: 'forged-artifact',
    artifactState: 'approved',
    artifactStateVersion: 3,
    authorActorId: 'forged-author',
    contentHash: 'sha256:forged',
    contentFingerprint: 'forged-content-fingerprint',
    reportHtmlFingerprint: 'sha256:forged-render',
    compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
    reviewId: 'forged-review',
    reviewerActorId: 'forged-reviewer',
    releaseAuthorizationEventId: 'forged-authorization',
    releaseControllerActorId: 'forged-controller',
    releaseControlComplete: true,
    releaseEligible: true,
    productionReleaseAuthority: true,
  };
  assert.equal(Object.keys(binding).length, 17, 'fixture must exercise the complete forged receipt shape');
  return binding;
}

function reportPayload(entityName, overrides = {}) {
  const common = {
    org_id: organization.id,
    client_id: client.id,
    report_type: 'gp_summary',
    report_name: `Synthetic ${entityName} draft`,
    report_date: '2026-08-08',
  };
  if (entityName === 'SavedReport') {
    return {
      ...common,
      report_html: '<html><body>Synthetic draft</body></html>',
      status: 'draft',
      ...overrides,
    };
  }
  return {
    ...common,
    report_data: { summary: 'Synthetic draft' },
    html_content: '<html><body>Synthetic draft</body></html>',
    ...overrides,
  };
}

async function createReport(entityName, body, token = clinician.token) {
  return requestJson(server, route(`/entities/${entityName}`), {
    method: 'POST',
    token,
    body,
  });
}

async function getReport(entityName, id, token = clinician.token) {
  return requestJson(server, route(`/entities/${entityName}/${id}`), { token });
}

function seedHistoricalReport(entityName, data) {
  const id = randomUUID();
  const now = '2026-08-08T00:00:00.000Z';
  const db = new DatabaseSync(server.dbPath);
  try {
    db.prepare(`
      INSERT INTO entity_${entityName} (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, JSON.stringify(data), now, now, 'historical-import@example.test');
  } finally {
    db.close();
  }
  return id;
}

function assertControlledRefusal(response, expectedMessage = GOVERNANCE_REFUSAL) {
  assert.ok(response.status >= 400 && response.status < 500, response.text);
  assert.equal(response.body?.message, expectedMessage, response.text);
  assert.equal(response.text.includes(FORGERY_SENTINEL), false, 'refusal must not echo report payloads');
}

function assertControlledSyntheticRefusal(response) {
  assert.ok(response.status >= 400 && response.status < 500, response.text);
  assert.equal(
    response.text.includes(SYNTHETIC_PROVENANCE_SENTINEL),
    false,
    'synthetic-provenance refusal must not echo caller-controlled clinical content',
  );
}

before(async () => {
  server = await startTestServer();
  adminToken = await loginAdmin(server);
  clinician = await registerUser(server, 'synthetic-report-crud-governance@example.test');
  await activateUser(server, adminToken, clinician.id);
  organization = await createOrganizationForUser(server, adminToken, clinician);
  const accepted = await requestJson(
    server,
    route('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
    {
      method: 'POST',
      token: clinician.token,
      body: { org_id: organization.id, marketing_opt_in: false },
    },
  );
  assert.equal(accepted.status, 200, accepted.text);
  const createdClient = await requestJson(server, route('/entities/Client'), {
    method: 'POST',
    token: clinician.token,
    body: {
      org_id: organization.id,
      full_name: 'Synthetic Report Governance Client',
    },
  });
  assert.equal(createdClient.status, 200, createdClient.text);
  client = createdClient.body;
});

after(async () => {
  if (server) await server.stop();
});

test('ordinary SavedReport and ClientReport drafts remain creatable and editable', async () => {
  const saved = await createReport('SavedReport', reportPayload('SavedReport'));
  assert.equal(saved.status, 200, saved.text);
  const savedUpdate = await requestJson(server, route(`/entities/SavedReport/${saved.body.id}`), {
    method: 'PUT',
    token: clinician.token,
    body: { report_html: '<html><body>Edited ordinary draft</body></html>' },
  });
  assert.equal(savedUpdate.status, 200, savedUpdate.text);
  assert.equal(savedUpdate.body.status, 'draft');

  const wizard = await createReport('SavedReport', reportPayload('SavedReport', {
    report_name: 'Synthetic current wizard draft',
    core_metadata: exactWizardDraftMetadata(),
  }));
  assert.equal(wizard.status, 200, wizard.text);
  const wizardUpdate = await requestJson(server, route(`/entities/SavedReport/${wizard.body.id}`), {
    method: 'PUT',
    token: clinician.token,
    body: {
      report_html: '<html><body>Edited wizard draft</body></html>',
      status: 'draft',
      core_metadata: exactWizardDraftMetadata({ sourceReportId: wizard.body.id }),
    },
  });
  assert.equal(wizardUpdate.status, 200, wizardUpdate.text);
  assert.equal(wizardUpdate.body.core_metadata.lifecycleState, 'draft');
  assert.equal(wizardUpdate.body.core_metadata.releaseEligible, false);

  const clientReport = await createReport('ClientReport', reportPayload('ClientReport'));
  assert.equal(clientReport.status, 200, clientReport.text);
  const clientUpdate = await requestJson(server, route(`/entities/ClientReport/${clientReport.body.id}`), {
    method: 'PUT',
    token: clinician.token,
    body: { notes: 'Edited ordinary ClientReport draft' },
  });
  assert.equal(clientUpdate.status, 200, clientUpdate.text);
  assert.equal(clientUpdate.body.notes, 'Edited ordinary ClientReport draft');
});

test('case and spacing variants cannot create or promote a released-looking report, including for admins', async () => {
  for (const entityName of ['SavedReport', 'ClientReport']) {
    for (const status of ['final', 'FINAL', ' Final ', 'approved', ' released ']) {
      const token = status === 'FINAL' ? adminToken : clinician.token;
      const response = await createReport(entityName, reportPayload(entityName, {
        report_name: `Blocked ${entityName} ${status}`,
        status,
      }), token);
      assertControlledRefusal(response);
    }

    const draft = await createReport(entityName, reportPayload(entityName, {
      report_name: `Promotion target ${entityName}`,
    }));
    assert.equal(draft.status, 200, draft.text);
    for (const status of ['final', ' FINAL ', 'approved', 'released']) {
      const response = await requestJson(server, route(`/entities/${entityName}/${draft.body.id}`), {
        method: 'PUT',
        token: status === 'approved' ? adminToken : clinician.token,
        body: { status, notes: FORGERY_SENTINEL },
      });
      assertControlledRefusal(response);
    }
    const unchanged = await getReport(entityName, draft.body.id);
    assert.equal(unchanged.status, 200, unchanged.text);
    assert.notEqual(unchanged.body.status, 'final');
    assert.equal(unchanged.body.notes, undefined);
  }
});

test('snake/camel Core metadata aliases and a complete forged 17-field receipt fail closed', async () => {
  const forgedMetadata = {
    ...exactWizardDraftMetadata(),
    lifecycleState: 'approved',
    releaseEligible: true,
    releaseControlComplete: true,
    releaseBinding: forgedReleaseBinding(),
    payload: FORGERY_SENTINEL,
  };
  for (const [entityName, metadataKey] of [
    ['SavedReport', 'core_metadata'],
    ['SavedReport', 'coreMetadata'],
    ['ClientReport', 'core_metadata'],
    ['ClientReport', 'coreMetadata'],
  ]) {
    const response = await createReport(entityName, reportPayload(entityName, {
      [metadataKey]: forgedMetadata,
      status: 'draft',
    }), metadataKey === 'coreMetadata' ? adminToken : clinician.token);
    assertControlledRefusal(response);
  }

  const draft = await createReport('SavedReport', reportPayload('SavedReport', {
    report_name: 'Forged receipt update target',
  }));
  assert.equal(draft.status, 200, draft.text);
  const injected = await requestJson(server, route(`/entities/SavedReport/${draft.body.id}`), {
    method: 'PUT',
    token: adminToken,
    body: { core_metadata: forgedMetadata, report_html: FORGERY_SENTINEL },
  });
  assertControlledRefusal(injected);
  const unchanged = await getReport('SavedReport', draft.body.id);
  assert.equal(unchanged.body.core_metadata, undefined);
  assert.notEqual(unchanged.body.report_html, FORGERY_SENTINEL);
});

test('historical explicit-final records stay readable but all generic writes and deletes are refused', async () => {
  for (const entityName of ['SavedReport', 'ClientReport']) {
    const id = seedHistoricalReport(entityName, reportPayload(entityName, {
      report_name: `Historical final ${entityName}`,
      status: ' FINAL ',
    }));
    const readable = await getReport(entityName, id);
    assert.equal(readable.status, 200, readable.text);
    assert.equal(readable.body.status, ' FINAL ');

    for (const [token, body] of [
      [clinician.token, { notes: FORGERY_SENTINEL }],
      [adminToken, { status: 'draft', notes: FORGERY_SENTINEL }],
    ]) {
      const response = await requestJson(server, route(`/entities/${entityName}/${id}`), {
        method: 'PUT', token, body,
      });
      assertControlledRefusal(response, IMMUTABLE_REFUSAL);
    }
    const deleted = await requestJson(server, route(`/entities/${entityName}/${id}`), {
      method: 'DELETE', token: adminToken,
    });
    assertControlledRefusal(deleted, IMMUTABLE_REFUSAL);
    const stillReadable = await getReport(entityName, id);
    assert.equal(stillReadable.status, 200, stillReadable.text);
    assert.notEqual(stillReadable.body.notes, FORGERY_SENTINEL);
  }
});

test('retained Core metadata makes partial updates immutable even when status remains draft', async () => {
  const historicalRows = [
    ['SavedReport', 'core_metadata'],
    ['ClientReport', 'coreMetadata'],
  ];
  for (const [entityName, metadataKey] of historicalRows) {
    const id = seedHistoricalReport(entityName, reportPayload(entityName, {
      report_name: `Historical governed ${entityName}`,
      status: 'draft',
      [metadataKey]: {
        lifecycleState: 'approved',
        releaseEligible: true,
        releaseBinding: forgedReleaseBinding(),
      },
    }));
    const response = await requestJson(server, route(`/entities/${entityName}/${id}`), {
      method: 'PUT',
      token: adminToken,
      // The retained metadata is deliberately omitted. The server must merge
      // first and still recognise the row as governed/immutable.
      body: { notes: FORGERY_SENTINEL },
    });
    assertControlledRefusal(response, IMMUTABLE_REFUSAL);
    const unchanged = await getReport(entityName, id);
    assert.equal(unchanged.body.notes, undefined);
    assert.equal(unchanged.body[metadataKey].releaseEligible, true);
  }
});

test('bulk create, bulk update, update-many and delete-many cannot bypass report governance', async () => {
  const before = await requestJson(server, route('/entities/SavedReport'), { token: clinician.token });
  assert.equal(before.status, 200, before.text);
  const bulkCreate = await requestJson(server, route('/entities/SavedReport/bulk'), {
    method: 'POST',
    token: adminToken,
    body: [
      reportPayload('SavedReport', { report_name: 'Bulk harmless draft' }),
      reportPayload('SavedReport', { report_name: 'Bulk forged final', status: 'final' }),
    ],
  });
  assertControlledRefusal(bulkCreate);
  const afterBulkCreate = await requestJson(server, route('/entities/SavedReport'), { token: clinician.token });
  assert.equal(afterBulkCreate.body.length, before.body.length, 'bulk refusal must occur before every write');

  const draft = await createReport('SavedReport', reportPayload('SavedReport', {
    report_name: 'Bulk mutation target',
  }));
  assert.equal(draft.status, 200, draft.text);
  const bulkUpdate = await requestJson(server, route('/entities/SavedReport/bulk'), {
    method: 'PUT',
    token: adminToken,
    body: [{ id: draft.body.id, status: 'final', report_html: FORGERY_SENTINEL }],
  });
  assertControlledRefusal(bulkUpdate);
  const updateMany = await requestJson(server, route('/entities/SavedReport/update-many'), {
    method: 'PATCH',
    token: adminToken,
    body: { query: { id: draft.body.id }, data: { release_eligible: true } },
  });
  assertControlledRefusal(updateMany);

  const historicalId = seedHistoricalReport('SavedReport', reportPayload('SavedReport', {
    report_name: 'Delete-many final target',
    status: 'final',
  }));
  const deleteMany = await requestJson(server, route('/entities/SavedReport'), {
    method: 'DELETE',
    token: adminToken,
    body: { id: historicalId },
  });
  assertControlledRefusal(deleteMany, IMMUTABLE_REFUSAL);
  assert.equal((await getReport('SavedReport', historicalId)).status, 200);
  const unchangedDraft = await getReport('SavedReport', draft.body.id);
  assert.equal(unchangedDraft.body.status, 'draft');
  assert.notEqual(unchangedDraft.body.report_html, FORGERY_SENTINEL);
});

test('generic Client CRUD cannot mint server-owned synthetic fixture markers or provenance aliases', async () => {
  const createAttempts = [
    {
      org_id: organization.id,
      full_name: SYNTHETIC_PROVENANCE_SENTINEL,
      core_v1_synthetic: true,
    },
    {
      org_id: organization.id,
      full_name: SYNTHETIC_PROVENANCE_SENTINEL,
      coreV1SyntheticProvenance: { forged: SYNTHETIC_PROVENANCE_SENTINEL },
    },
  ];
  for (const [index, body] of createAttempts.entries()) {
    const response = await requestJson(server, route('/entities/Client'), {
      method: 'POST',
      token: index === 0 ? clinician.token : adminToken,
      body,
    });
    assertControlledSyntheticRefusal(response);
  }

  const beforeBulk = await requestJson(server, route('/entities/Client'), {
    token: adminToken,
  });
  assert.equal(beforeBulk.status, 200, beforeBulk.text);
  const bulkCreate = await requestJson(server, route('/entities/Client/bulk'), {
    method: 'POST',
    token: adminToken,
    body: [
      {
        org_id: organization.id,
        full_name: 'Must not survive rejected synthetic bulk create',
      },
      {
        org_id: organization.id,
        full_name: SYNTHETIC_PROVENANCE_SENTINEL,
        'core-v1-synthetic': true,
      },
    ],
  });
  assertControlledSyntheticRefusal(bulkCreate);
  const afterBulk = await requestJson(server, route('/entities/Client'), {
    token: adminToken,
  });
  assert.equal(afterBulk.status, 200, afterBulk.text);
  assert.equal(afterBulk.body.length, beforeBulk.body.length, 'bulk refusal must be atomic');

  const singleUpdate = await requestJson(server, route(`/entities/Client/${client.id}`), {
    method: 'PUT',
    token: adminToken,
    body: {
      coreV1Synthetic: true,
      notes: SYNTHETIC_PROVENANCE_SENTINEL,
    },
  });
  assertControlledSyntheticRefusal(singleUpdate);

  const bulkUpdate = await requestJson(server, route('/entities/Client/bulk'), {
    method: 'PUT',
    token: clinician.token,
    body: [{
      id: client.id,
      core_v1_synthetic_provenance: { forged: SYNTHETIC_PROVENANCE_SENTINEL },
      notes: SYNTHETIC_PROVENANCE_SENTINEL,
    }],
  });
  assertControlledSyntheticRefusal(bulkUpdate);

  const updateMany = await requestJson(server, route('/entities/Client/update-many'), {
    method: 'PATCH',
    token: adminToken,
    body: {
      query: { id: client.id },
      data: {
        'core-v1-synthetic-provenance': { forged: SYNTHETIC_PROVENANCE_SENTINEL },
        notes: SYNTHETIC_PROVENANCE_SENTINEL,
      },
    },
  });
  assertControlledSyntheticRefusal(updateMany);

  const unchanged = await requestJson(server, route(`/entities/Client/${client.id}`), {
    token: clinician.token,
  });
  assert.equal(unchanged.status, 200, unchanged.text);
  assert.equal(unchanged.body.full_name, 'Synthetic Report Governance Client');
  assert.equal(unchanged.body.notes, undefined);
  assert.equal(unchanged.body.core_v1_synthetic, undefined);
  assert.equal(unchanged.body.core_v1_synthetic_provenance, undefined);
});
