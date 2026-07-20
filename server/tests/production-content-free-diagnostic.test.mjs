import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { buildContentFreeDiagnostic } from '../../scripts/production-content-free-diagnostic.mjs';
import { validateContentFreeDiagnostic } from '../../scripts/validate-production-content-free-diagnostic.mjs';

const START = '2026-07-20T08:00:00Z';
const END = '2026-07-20T09:00:00Z';
const NOW = new Date('2026-07-20T09:01:00Z');

function withDatabase(run) {
  const testRoot = path.join(process.cwd(), '.diagnostic-test-tmp');
  fs.mkdirSync(testRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(testRoot, 'case-'));
  const dbPath = path.join(root, 'app.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE upload_registry (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      org_id TEXT NOT NULL,
      uploader_user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE upload_audit (
      id TEXT PRIMARY KEY,
      upload_id TEXT,
      org_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE entity_User (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE entity_LegalAcceptanceEvent (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
  try {
    return run({ db, dbPath });
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
    try {
      fs.rmdirSync(testRoot);
    } catch {
      // Another concurrent case may still own the shared test root.
    }
  }
}

function insertUpload(db, id = 'private-upload-id') {
  db.prepare(`
    INSERT INTO upload_registry
      (id, original_name, org_id, uploader_user_id, purpose, created_at)
    VALUES (?, ?, ?, ?, 'referral-extraction', ?)
  `).run(id, 'SENSITIVE PATIENT REFERRAL.pdf', 'private-org-id', 'private-user-id', '2026-07-20T08:10:00Z');
  db.prepare(`
    INSERT INTO upload_audit
      (id, upload_id, org_id, actor_user_id, event_type, outcome, metadata_json, created_at)
    VALUES (?, ?, ?, ?, 'upload_registered', 'success', '{}', ?)
  `).run('audit-upload', id, 'private-org-id', 'private-user-id', '2026-07-20T08:10:01Z');
}

test('reports a pre-registration failure window without exposing database values', () => {
  withDatabase(({ dbPath }) => {
    const result = buildContentFreeDiagnostic({ dbPath, startUtc: START, endUtc: END, now: NOW });
    assert.equal(result.classification, 'no_referral_upload_registered');
    assert.equal(result.counts.referral_uploads_registered, 0);
    assert.deepEqual(result.events, []);
    assert.deepEqual(result.unextracted_attempt_preflight, []);
  });
});

test('classifies the current fixed-enum preflight state without emitting profile values', () => {
  withDatabase(({ db, dbPath }) => {
    insertUpload(db);
    db.prepare('INSERT INTO entity_User (id, data) VALUES (?, ?)').run(
      'private-user-id',
      JSON.stringify({
        email: 'sensitive@example.test',
        country: 'not-an-eligible-country',
        profession: 'Sensitive profession value',
        account_status: 'active',
      }),
    );
    const result = buildContentFreeDiagnostic({ dbPath, startUtc: START, endUtc: END, now: NOW });
    assert.deepEqual(result.unextracted_attempt_preflight, [{
      attempt: 'attempt_001',
      classification: 'clinical_release_unavailable',
    }]);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('sensitive@example.test'), false);
    assert.equal(serialized.includes('Sensitive profession value'), false);
    assert.doesNotThrow(() =>
      validateContentFreeDiagnostic(result, { expectedStartUtc: START, expectedEndUtc: END }),
    );
  });
});

test('reports upload success followed by a provider failure using only the fixed contract', () => {
  withDatabase(({ db, dbPath }) => {
    insertUpload(db);
    db.prepare(`
      INSERT INTO upload_audit
        (id, upload_id, org_id, actor_user_id, event_type, outcome, metadata_json, created_at)
      VALUES (?, ?, ?, ?, 'document_extraction', 'failed', ?, ?)
    `).run(
      'audit-extraction',
      'private-upload-id',
      'private-org-id',
      'private-user-id',
      JSON.stringify({
        code: 'provider_error',
        provider_request_constructed: true,
        provider_contact_attempted: true,
        provider_status_class: '5xx',
        forbidden_patient_value: 'SECRET CLINICAL CONTENT',
      }),
      '2026-07-20T08:10:02Z',
    );

    const result = buildContentFreeDiagnostic({ dbPath, startUtc: START, endUtc: END, now: NOW });
    assert.equal(result.classification, 'extraction_failed_after_provider_contact');
    assert.equal(result.counts.referral_uploads_registered, 1);
    assert.equal(result.counts.extraction_failures, 1);
    assert.equal(result.events[1].attempt, 'attempt_001');
    assert.equal(result.events[1].code, 'provider_error');
    assert.doesNotThrow(() =>
      validateContentFreeDiagnostic(result, { expectedStartUtc: START, expectedEndUtc: END }),
    );

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      'SENSITIVE PATIENT REFERRAL.pdf',
      'private-upload-id',
      'private-org-id',
      'private-user-id',
      'SECRET CLINICAL CONTENT',
    ]) {
      assert.equal(serialized.includes(forbidden), false, `leaked forbidden value: ${forbidden}`);
    }
  });
});

test('the output firewall rejects an added field even when the remote record is otherwise valid', () => {
  withDatabase(({ dbPath }) => {
    const result = buildContentFreeDiagnostic({ dbPath, startUtc: START, endUtc: END, now: NOW });
    assert.throws(
      () => validateContentFreeDiagnostic({ ...result, leaked_value: 'patient' }, {
        expectedStartUtc: START,
        expectedEndUtc: END,
      }),
      /invalid_contract/,
    );
  });
});

test('maps arbitrary metadata values to fixed safe enums', () => {
  withDatabase(({ db, dbPath }) => {
    insertUpload(db);
    db.prepare(`
      INSERT INTO upload_audit
        (id, upload_id, org_id, actor_user_id, event_type, outcome, metadata_json, created_at)
      VALUES (?, ?, ?, ?, 'document_extraction', 'failed', ?, ?)
    `).run(
      'audit-extraction',
      'private-upload-id',
      'private-org-id',
      'private-user-id',
      JSON.stringify({
        code: 'PATIENT-NAME-AS-CODE',
        provider_status_class: 'PATIENT-NAME-AS-STATUS',
      }),
      '2026-07-20T08:10:02Z',
    );

    const result = buildContentFreeDiagnostic({ dbPath, startUtc: START, endUtc: END, now: NOW });
    assert.equal(result.events[1].code, 'other');
    assert.equal(result.events[1].provider_status_class, 'none');
    assert.equal(JSON.stringify(result).includes('PATIENT-NAME'), false);
  });
});

test('rejects broad or historical windows before opening the database', () => {
  assert.throws(
    () => buildContentFreeDiagnostic({ dbPath: '/does/not/exist', startUtc: START, endUtc: '2026-07-20T13:00:01Z', now: NOW }),
    /window_too_wide/,
  );
  assert.throws(
    () => buildContentFreeDiagnostic({ dbPath: '/does/not/exist', startUtc: '2026-07-01T08:00:00Z', endUtc: END, now: NOW }),
    /window_too_wide|window_out_of_bounds/,
  );
});
