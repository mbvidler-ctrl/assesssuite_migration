import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hashPassword } from '../auth.mjs';
import { createEntityRepository, openDatabase } from '../db.mjs';
import {
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
  fingerprint as legalContentFingerprint,
} from '../../src/lib/legal/documentRegistry.js';
import { effectiveLegalContent } from '../../src/lib/legal/effectiveContent.js';

export const PARITY_NAMESPACE = 'asr-r2-20260721';
export const PARITY_BASE_URL = 'http://127.0.0.1:48787';
export const PARITY_PROVIDER_CALL_LIMIT = 1;
export const PARITY_DB_PATH = '/app/server/data/assesssuite-parity.db';
export const PARITY_UPLOADS_DIR = '/app/server/data/assesssuite-parity-uploads';
export const PARITY_APP_ID = 'local-assesssuite';
export const PARITY_ADMIN_EMAIL = 'admin@asr-r2-20260721.seed.test';
export const PARITY_DB_ACK = 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';
export const PARITY_RECEIPT_BEGIN = 'ASSESSSUITE_PARITY_RECEIPT_BEGIN';
export const PARITY_RECEIPT_END = 'ASSESSSUITE_PARITY_RECEIPT_END';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLEANUP_PATH = fileURLToPath(import.meta.url);
const RUNNER_PATH = path.join(REPO_ROOT, 'server', 'tests', 'production-parity-wave.mjs');
const FIXTURE_PATH = path.join(REPO_ROOT, 'server', 'tests', 'support', 'syntheticReferralFixtures.mjs');
const CONFIG_PATH = path.join(REPO_ROOT, 'fly.production.toml');
const LEGAL_CONTENT_DIR = path.join(REPO_ROOT, 'src', 'legal-content');
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const CONTROL_TABLE = 'parity_assurance_control';

export const CLINICAL_ENTITIES = Object.freeze([
  'AdverseEvent',
  'Appointment',
  'AssessmentRequest',
  'Client',
  'ClientAssessment',
  'ClientCondition',
  'ClientDocument',
  'ClientNutritionPlan',
  'ClientOnboardingEpisode',
  'ClientReport',
  'Payment',
  'SOAPNote',
  'SavedReport',
]);

export const SEED_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'action', 'result', 'namespace', 'wave_id',
  'runner_sha256', 'fixture_sha256', 'cleanup_sha256', 'config_sha256',
  'database_path', 'uploads_dir', 'synthetic_seed_present', 'synthetic_seed_rows',
  'synthetic_user_count', 'synthetic_admin_count', 'clinical_rows', 'provider_requests',
  'outbound_email_attempts', 'outbound_sms_attempts', 'payment_attempts',
]);

export const VERIFY_SEED_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'action', 'result', 'namespace', 'wave_id',
  'runner_sha256', 'fixture_sha256', 'cleanup_sha256', 'config_sha256',
  'database_path', 'uploads_dir', 'server_ready', 'synthetic_seed_present',
  'membership_count', 'legal_receipt_count', 'clinical_rows',
]);

export const OBSERVE_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'action', 'result', 'namespace', 'wave_id',
  'runner_sha256', 'fixture_sha256', 'cleanup_sha256', 'config_sha256',
  'database_path', 'uploads_dir', 'provider_call_limit', 'provider_requests',
  'outbound_email_attempts', 'outbound_sms_attempts', 'payment_attempts',
  'clinical_rows_before', 'clinical_rows_after', 'clinical_writes',
  'referral_commits', 'client_records_created', 'namespace_rows',
  'namespace_files', 'production_volume_path_accesses', 'signup_profile_writes',
  'signup_acceptance_rows', 'signup_acceptance_document_rows',
  'signup_acceptance_role', 'duplicate_signup_acceptance_rows',
]);

export const CLEANUP_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'action', 'result', 'namespace', 'wave_id',
  'runner_sha256', 'fixture_sha256', 'cleanup_sha256', 'config_sha256',
  'database_path', 'uploads_dir', 'rows_deleted', 'files_deleted',
  'remaining_namespace_rows', 'remaining_namespace_files',
  'nonnamespace_rows_touched', 'nonnamespace_files_touched', 'clinical_rows_deleted',
]);

function required(environment, name, expected) {
  if (environment[name] !== expected) throw new Error(`invalid_${name.toLowerCase()}`);
}

export function deriveParityIdentity(waveId) {
  if (waveId !== 'wave-1' && waveId !== 'wave-2') throw new Error('invalid_wave_id');
  const digest = createHash('sha256').update(`${PARITY_NAMESPACE}:${waveId}:credential`).digest('hex');
  return Object.freeze({
    email: `practitioner.${waveId}@${PARITY_NAMESPACE}.seed.test`,
    password: `Asr!${digest.slice(0, 28)}`,
    primaryOrganizationName: `${PARITY_NAMESPACE} ${waveId} primary practice`,
    secondaryOrganizationName: `${PARITY_NAMESPACE} ${waveId} secondary practice`,
  });
}

export function lfNormalizedSha256(filePath) {
  const bytes = fs.readFileSync(filePath);
  const normalized = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'), 'utf8');
  return createHash('sha256').update(normalized).digest('hex');
}

export function expectedArtifactHashes() {
  return Object.freeze({
    runner_sha256: lfNormalizedSha256(RUNNER_PATH),
    fixture_sha256: lfNormalizedSha256(FIXTURE_PATH),
    cleanup_sha256: lfNormalizedSha256(CLEANUP_PATH),
    config_sha256: lfNormalizedSha256(CONFIG_PATH),
  });
}

function assertCommonEnvironment(environment) {
  required(environment, 'PARITY_ASSURANCE_MODE', '1');
  required(environment, 'PARITY_NAMESPACE', PARITY_NAMESPACE);
  required(environment, 'PARITY_PROVIDER_CALL_LIMIT', String(PARITY_PROVIDER_CALL_LIMIT));
  required(environment, 'ASSESSSUITE_DB_PATH', PARITY_DB_PATH);
  required(environment, 'UPLOADS_DIR', PARITY_UPLOADS_DIR);
  required(environment, 'OUTBOUND_EMAIL_ENABLED', '0');
  required(environment, 'OUTBOUND_SMS_ENABLED', '0');
  required(environment, 'PAYMENTS_ENABLED', '0');
  required(environment, 'DOCUMENT_EXTRACTION_ENABLED', '1');
  required(environment, 'DOCUMENT_EXTRACTION_UNDER_13_ENABLED', '0');
  required(environment, 'OPENAI_HEALTH_DATA_TERMS_CONFIRMED', '1');
  required(environment, 'GENERAL_CLINICAL_LLM_ENABLED', '0');
  required(environment, 'TRANSCRIPTION_ENABLED', '0');
  required(environment, 'ALLOW_OPEN_REGISTRATION', '0');
  required(environment, 'ADMIN_EMAIL', PARITY_ADMIN_EMAIL);
  required(environment, 'LEGAL_STATUS', 'effective');
  required(environment, 'LEGAL_EFFECTIVE_DATE', '19 July 2026');
  if (environment.PARITY_WAVE_ID !== 'wave-1' && environment.PARITY_WAVE_ID !== 'wave-2') {
    throw new Error('invalid_parity_wave_id');
  }
  if (environment.SELFTEST === '1') throw new Error('selftest_forbidden');
  if (environment.DOCUMENT_EXTRACTION_TEST_BASE_URL) throw new Error('test_provider_forbidden');

  const expected = expectedArtifactHashes();
  const supplied = {
    runner_sha256: environment.PARITY_RUNNER_SHA256,
    fixture_sha256: environment.PARITY_FIXTURE_SHA256,
    cleanup_sha256: environment.PARITY_CLEANUP_SHA256,
    config_sha256: environment.PARITY_CONFIG_SHA256,
  };
  for (const [name, value] of Object.entries(supplied)) {
    if (!HASH_PATTERN.test(value || '') || value !== expected[name]) throw new Error(`invalid_${name}`);
  }
  return Object.freeze({
    waveId: environment.PARITY_WAVE_ID,
    identity: deriveParityIdentity(environment.PARITY_WAVE_ID),
    hashes: expected,
  });
}

export function assertParityMachineEnvironment(mode, environment = process.env) {
  if (!['seed', 'verify-seed', 'observe-wave', 'cleanup-and-verify'].includes(mode)) {
    throw new Error('invalid_parity_machine_mode');
  }
  const contract = assertCommonEnvironment(environment);
  if (mode === 'seed') {
    required(environment, 'NODE_ENV', 'test');
    required(environment, 'ASSESSSUITE_DB_PATH_ACK', PARITY_DB_ACK);
  } else {
    required(environment, 'NODE_ENV', 'production');
    if (environment.ASSESSSUITE_DB_PATH_ACK) throw new Error('database_ack_forbidden');
  }
  return contract;
}

function commonReceipt(action, contract) {
  return {
    schema_version: 'assesssuite.production-parity.v1',
    action,
    result: 'PASS',
    namespace: PARITY_NAMESPACE,
    wave_id: contract.waveId,
    ...contract.hashes,
    database_path: PARITY_DB_PATH,
    uploads_dir: PARITY_UPLOADS_DIR,
  };
}

export function frameParityReceipt(receipt) {
  const json = JSON.stringify(receipt);
  if (json.includes('\n') || Buffer.byteLength(json) > 8_192) throw new Error('invalid_receipt');
  return `${PARITY_RECEIPT_BEGIN}\n${json}\n${PARITY_RECEIPT_END}`;
}

function ensureControlTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${CONTROL_TABLE} (
      namespace TEXT NOT NULL,
      wave_id TEXT NOT NULL,
      control_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (namespace, wave_id)
    )
  `);
}

function parsePayload(row) {
  try {
    const value = JSON.parse(row?.data || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    throw new Error('invalid_entity_payload');
  }
}

function rowsForEntity(db, entityName) {
  return db.prepare(`SELECT * FROM entity_${entityName}`).all();
}

function countEntity(db, entityName) {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM entity_${entityName}`).get().n);
}

function clinicalCounts(db) {
  const byEntity = Object.fromEntries(CLINICAL_ENTITIES.map((name) => [name, countEntity(db, name)]));
  return {
    byEntity,
    total: Object.values(byEntity).reduce((sum, value) => sum + value, 0),
    clients: byEntity.Client,
    payments: byEntity.Payment,
  };
}

function tableCount(db, tableName) {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${tableName}`).get().n);
}

function baselineCounts(db) {
  const clinical = clinicalCounts(db);
  return Object.freeze({
    clinicalRows: clinical.total,
    clinicalIds: Object.fromEntries(CLINICAL_ENTITIES.map((name) => [
      name,
      rowsForEntity(db, name).map((row) => row.id).sort(),
    ])),
    clients: clinical.clients,
    payments: clinical.payments,
    extractionUsage: tableCount(db, 'extraction_usage'),
    outboundEmail: tableCount(db, 'outbox_email'),
    outboundSms: tableCount(db, 'outbox_sms'),
    outboundEmailIds: db.prepare('SELECT id FROM outbox_email').all().map((row) => row.id).sort(),
    outboundSmsIds: db.prepare('SELECT id FROM outbox_sms').all().map((row) => row.id).sort(),
    referralCommits: tableCount(db, 'referral_commit_receipt'),
  });
}

function parityTag(waveId, kind) {
  return {
    _parity_namespace: PARITY_NAMESPACE,
    _parity_wave_id: waveId,
    _parity_kind: kind,
  };
}

function loadControl(db, waveId) {
  ensureControlTable(db);
  const row = db.prepare(`
    SELECT control_json FROM ${CONTROL_TABLE} WHERE namespace = ? AND wave_id = ?
  `).get(PARITY_NAMESPACE, waveId);
  if (!row) return null;
  try {
    return JSON.parse(row.control_json);
  } catch {
    throw new Error('invalid_parity_control');
  }
}

function expectedLegalReceiptData(documentId, orgId, email) {
  const document = LEGAL_DOCUMENTS[documentId];
  if (!document) throw new Error('legal_document_unavailable');
  const raw = fs.readFileSync(path.join(LEGAL_CONTENT_DIR, document.file), 'utf8');
  const displayed = effectiveLegalContent(raw, {
    status: 'effective',
    effectiveDate: '19 July 2026',
  });
  return {
    event_type: document.eventType,
    user_email: email,
    org_id: orgId,
    suite_version: SUITE_VERSION,
    actor_capacity: 'invited clinician',
    document_id: documentId,
    document_title: document.title,
    document_fingerprint: legalContentFingerprint(displayed),
    session_context: null,
    user_agent: 'server-derived-bundle',
    ip_address: 'not-collected-local-shim',
  };
}

function assertFreshParityDatabase(db) {
  if (clinicalCounts(db).total !== 0) throw new Error('parity_database_contains_clinical_rows');
  for (const entityName of ['User', 'Organization', 'OrganizationMember', 'LegalAcceptanceEvent']) {
    if (countEntity(db, entityName) !== 0) throw new Error('parity_database_contains_identity_rows');
  }
  for (const tableName of [
    'sessions', 'outbox_email', 'outbox_sms', 'upload_registry', 'upload_disposition',
    'upload_audit', 'extraction_usage', 'referral_commit_receipt',
  ]) {
    if (tableCount(db, tableName) !== 0) throw new Error('parity_database_contains_internal_rows');
  }
}

export function seedParityDatabase(environment = process.env) {
  const contract = assertParityMachineEnvironment('seed', environment);
  fs.mkdirSync(PARITY_UPLOADS_DIR, { recursive: true });
  const { db } = openDatabase();
  try {
    ensureControlTable(db);
    if (loadControl(db, contract.waveId)) throw new Error('parity_seed_already_present');
    assertFreshParityDatabase(db);
    const baseline = baselineCounts(db);
    const userRepo = createEntityRepository(db, 'User');
    const organizationRepo = createEntityRepository(db, 'Organization');
    const membershipRepo = createEntityRepository(db, 'OrganizationMember');
    const now = new Date().toISOString();
    const orgCount = contract.waveId === 'wave-1' ? 1 : 2;
    let admin;
    let practitioner;
    const organizations = [];
    const memberships = [];

    db.exec('BEGIN IMMEDIATE');
    try {
      const adminHash = hashPassword(randomBytes(48).toString('base64url'));
      admin = userRepo.create({
        ...parityTag(contract.waveId, 'bootstrap-admin'),
        email: PARITY_ADMIN_EMAIL,
        full_name: 'AssessSuite Parity Administrator',
        role: 'admin',
        account_status: 'active',
        subscription_status: 'active',
        email_verified: true,
        ...adminHash,
      }, PARITY_ADMIN_EMAIL);
      const practitionerHash = hashPassword(contract.identity.password);
      practitioner = userRepo.create({
        ...parityTag(contract.waveId, 'practitioner'),
        email: contract.identity.email,
        full_name: 'AssessSuite Synthetic Practitioner',
        clinician_name: 'AssessSuite Synthetic Practitioner',
        role: 'user',
        account_status: 'active',
        subscription_status: 'active',
        email_verified: true,
        profession: 'Exercise Physiologist',
        country: 'australia',
        last_active: now,
        ...practitionerHash,
      }, contract.identity.email);

      for (let index = 0; index < orgCount; index += 1) {
        const isPrimary = index === 0;
        const organization = organizationRepo.create({
          ...parityTag(contract.waveId, isPrimary ? 'primary-organization' : 'secondary-organization'),
          name: isPrimary
            ? contract.identity.primaryOrganizationName
            : contract.identity.secondaryOrganizationName,
          subscription_status: 'active',
        }, contract.identity.email);
        organizations.push(organization);
        memberships.push(membershipRepo.create({
          ...parityTag(contract.waveId, isPrimary ? 'primary-membership' : 'secondary-membership'),
          org_id: organization.id,
          user_email: contract.identity.email,
          role: 'clinician',
          is_primary: isPrimary,
        }, contract.identity.email));
      }

      const control = {
        namespace: PARITY_NAMESPACE,
        waveId: contract.waveId,
        adminId: admin.id,
        practitionerId: practitioner.id,
        organizationIds: organizations.map((record) => record.id),
        membershipIds: memberships.map((record) => record.id),
        legalReceiptIds: [],
        practitionerUpdatedDate: practitioner.updated_date,
        baseline,
      };
      db.prepare(`
        INSERT INTO ${CONTROL_TABLE} (namespace, wave_id, control_json, created_at)
        VALUES (?, ?, ?, ?)
      `).run(PARITY_NAMESPACE, contract.waveId, JSON.stringify(control), now);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const syntheticSeedRows = 2 + organizations.length + memberships.length;
    const receipt = {
      ...commonReceipt('seed', contract),
      synthetic_seed_present: true,
      synthetic_seed_rows: syntheticSeedRows,
      synthetic_user_count: 1,
      synthetic_admin_count: 1,
      clinical_rows: 0,
      provider_requests: 0,
      outbound_email_attempts: 0,
      outbound_sms_attempts: 0,
      payment_attempts: 0,
    };
    assert.deepEqual(Object.keys(receipt), SEED_RECEIPT_KEYS);
    return receipt;
  } finally {
    db.close();
  }
}

function missionContext(db, contract, control = loadControl(db, contract.waveId)) {
  const emails = new Set([
    PARITY_ADMIN_EMAIL,
    contract.identity.email,
    `clinic.${contract.waveId}@${PARITY_NAMESPACE}.seed.test`,
  ]);
  const contactIdentifiers = new Set([...emails, '+61 7 3000 0202']);
  const userIds = new Set([control?.adminId, control?.practitionerId].filter(Boolean));
  const organizationIds = new Set(control?.organizationIds || []);
  const membershipIds = new Set(control?.membershipIds || []);
  const legalReceiptIds = new Set(control?.legalReceiptIds || []);

  for (const row of rowsForEntity(db, 'User')) {
    const payload = parsePayload(row);
    if (payload._parity_namespace === PARITY_NAMESPACE || emails.has(payload.email)) userIds.add(row.id);
  }
  for (const row of rowsForEntity(db, 'Organization')) {
    const payload = parsePayload(row);
    if (payload._parity_namespace === PARITY_NAMESPACE) organizationIds.add(row.id);
  }
  for (const row of rowsForEntity(db, 'OrganizationMember')) {
    const payload = parsePayload(row);
    if (payload._parity_namespace === PARITY_NAMESPACE || emails.has(payload.user_email)) {
      membershipIds.add(row.id);
      if (typeof payload.org_id === 'string') organizationIds.add(payload.org_id);
    }
  }
  for (const row of rowsForEntity(db, 'LegalAcceptanceEvent')) {
    const payload = parsePayload(row);
    if (payload._parity_namespace === PARITY_NAMESPACE || emails.has(payload.user_email)) {
      legalReceiptIds.add(row.id);
      if (typeof payload.org_id === 'string') organizationIds.add(payload.org_id);
    }
  }
  return {
    emails,
    contactIdentifiers,
    userIds,
    organizationIds,
    membershipIds,
    legalReceiptIds,
    hasSeedBaseline: Boolean(control?.baseline),
    baselineEmailOutboxIds: new Set(control?.baseline?.outboundEmailIds || []),
    baselineSmsOutboxIds: new Set(control?.baseline?.outboundSmsIds || []),
    baselineClinicalIds: Object.fromEntries(CLINICAL_ENTITIES.map((name) => [
      name,
      new Set(control?.baseline?.clinicalIds?.[name] || []),
    ])),
  };
}

export function isMissionEntityRow(row, context) {
  const payload = parsePayload(row);
  return payload._parity_namespace === PARITY_NAMESPACE
    || context.userIds.has(row.id)
    || context.organizationIds.has(row.id)
    || context.membershipIds.has(row.id)
    || context.legalReceiptIds.has(row.id)
    || context.emails.has(row.created_by)
    || context.emails.has(payload.email)
    || context.emails.has(payload.user_email)
    || context.organizationIds.has(payload.org_id)
    || context.userIds.has(payload.user_id);
}

function missionInternalRows(db, context) {
  const userIds = [...context.userIds];
  const orgIds = [...context.organizationIds];
  const uploadRows = db.prepare('SELECT * FROM upload_registry').all().filter((row) => (
    context.userIds.has(row.uploader_user_id) || context.organizationIds.has(row.org_id)
  ));
  const uploadIds = new Set(uploadRows.map((row) => row.id));
  return {
    sessions: db.prepare('SELECT * FROM sessions').all().filter((row) => userIds.includes(row.user_id)),
    upload_registry: uploadRows,
    upload_disposition: db.prepare('SELECT * FROM upload_disposition').all().filter((row) => (
      uploadIds.has(row.upload_id) || orgIds.includes(row.org_id)
    )),
    upload_audit: db.prepare('SELECT * FROM upload_audit').all().filter((row) => (
      uploadIds.has(row.upload_id) || userIds.includes(row.actor_user_id) || orgIds.includes(row.org_id)
    )),
    extraction_usage: db.prepare('SELECT * FROM extraction_usage').all().filter((row) => (
      userIds.includes(row.user_id) || orgIds.includes(row.org_id)
    )),
    referral_commit_receipt: db.prepare('SELECT * FROM referral_commit_receipt').all().filter((row) => (
      userIds.includes(row.actor_user_id) || orgIds.includes(row.org_id)
    )),
  };
}

function valueContainsMissionIdentity(value, context) {
  if (typeof value === 'string') {
    return context.contactIdentifiers.has(value)
      || context.userIds.has(value)
      || context.organizationIds.has(value);
  }
  if (Array.isArray(value)) return value.some((item) => valueContainsMissionIdentity(item, context));
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => valueContainsMissionIdentity(item, context));
  }
  return false;
}

function missionOutboxRows(db, tableName, context) {
  const baselineIds = tableName === 'outbox_email'
    ? context.baselineEmailOutboxIds
    : context.baselineSmsOutboxIds;
  return db.prepare(`SELECT * FROM ${tableName}`).all().filter((row) => {
    if (context.hasSeedBaseline && !baselineIds.has(row.id)) return true;
    try {
      return valueContainsMissionIdentity(JSON.parse(row.payload), context);
    } catch {
      throw new Error('invalid_outbox_payload');
    }
  });
}

function namespaceState(db, entityNames, context) {
  const entityRows = Object.fromEntries(entityNames.map((entityName) => [
    entityName,
    rowsForEntity(db, entityName).filter((row) => (
      isMissionEntityRow(row, context)
      || (context.hasSeedBaseline
        && CLINICAL_ENTITIES.includes(entityName)
        && !context.baselineClinicalIds[entityName].has(row.id))
    )),
  ]));
  const internalRows = missionInternalRows(db, context);
  internalRows.outbox_email = missionOutboxRows(db, 'outbox_email', context);
  internalRows.outbox_sms = missionOutboxRows(db, 'outbox_sms', context);
  const rowCount = [...Object.values(entityRows), ...Object.values(internalRows)]
    .reduce((sum, rows) => sum + rows.length, 0);
  return { entityRows, internalRows, rowCount };
}

function missionFileNames(internalRows) {
  const names = new Set();
  for (const row of internalRows.upload_registry || []) {
    names.add(row.stored_name);
    names.add(`${row.stored_name}.registering`);
    names.add(`${row.id}.provider-block`);
  }
  return names;
}

function listTopLevelFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('unexpected_uploads_entry');
    return entry.name;
  }).sort();
}

function countMissionFiles(internalRows, uploadsDir = PARITY_UPLOADS_DIR) {
  const existing = new Set(listTopLevelFiles(uploadsDir));
  return [...missionFileNames(internalRows)].filter((name) => existing.has(name)).length;
}

function stableDigest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function nonnamespaceDigest(db, entityNames, state) {
  const excludedEntityIds = new Map(Object.entries(state.entityRows).map(([name, rows]) => [
    name, new Set(rows.map((row) => row.id)),
  ]));
  const excludedInternalKeys = {
    sessions: ['token'],
    upload_registry: ['id'],
    upload_disposition: ['upload_id'],
    upload_audit: ['id'],
    extraction_usage: ['id'],
    referral_commit_receipt: ['idempotency_key'],
    outbox_email: ['id'],
    outbox_sms: ['id'],
  };
  const snapshot = {};
  for (const entityName of entityNames) {
    const excluded = excludedEntityIds.get(entityName);
    snapshot[`entity_${entityName}`] = rowsForEntity(db, entityName)
      .filter((row) => !excluded.has(row.id))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  for (const [tableName, keyParts] of Object.entries(excludedInternalKeys)) {
    const excluded = new Set((state.internalRows[tableName] || []).map((row) => (
      keyParts.map((key) => row[key]).join('\u0000')
    )));
    snapshot[tableName] = db.prepare(`SELECT * FROM ${tableName}`).all()
      .filter((row) => !excluded.has(keyParts.map((key) => row[key]).join('\u0000')))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return stableDigest(snapshot);
}

function nonnamespaceFileDigest(state, uploadsDir = PARITY_UPLOADS_DIR) {
  const excluded = missionFileNames(state.internalRows);
  const entries = listTopLevelFiles(uploadsDir)
    .filter((name) => !excluded.has(name))
    .map((name) => ({
      name,
      bytes: fs.statSync(path.join(uploadsDir, name)).size,
      sha256: createHash('sha256').update(fs.readFileSync(path.join(uploadsDir, name))).digest('hex'),
    }));
  return stableDigest(entries);
}

function assertSeedShape(db, contract, control) {
  if (!control || control.namespace !== PARITY_NAMESPACE || control.waveId !== contract.waveId) {
    throw new Error('parity_seed_missing');
  }
  const context = missionContext(db, contract, control);
  const practitionerRows = rowsForEntity(db, 'User').filter((row) => (
    parsePayload(row).email === contract.identity.email && isMissionEntityRow(row, context)
  ));
  const expectedMemberships = contract.waveId === 'wave-1' ? 1 : 2;
  const memberships = rowsForEntity(db, 'OrganizationMember').filter((row) => (
    parsePayload(row).user_email === contract.identity.email && isMissionEntityRow(row, context)
  ));
  const legal = rowsForEntity(db, 'LegalAcceptanceEvent').filter((row) => (
    parsePayload(row).user_email === contract.identity.email && isMissionEntityRow(row, context)
  ));
  if (practitionerRows.length !== 1 || memberships.length !== expectedMemberships) {
    throw new Error('parity_seed_identity_invalid');
  }
  if (clinicalCounts(db).total !== control.baseline.clinicalRows) throw new Error('parity_seed_clinical_invalid');
  return { context, memberships, legal };
}

function verifySignupWrites(db, contract, control, context) {
  const primaryOrgId = control.organizationIds[0];
  const legalRows = rowsForEntity(db, 'LegalAcceptanceEvent')
    .filter((row) => isMissionEntityRow(row, context));
  const expected = PRACTITIONER_NOTICE_IDS.map((documentId) => (
    expectedLegalReceiptData(documentId, primaryOrgId, contract.identity.email)
  ));
  const matchesExpected = (payload, expectedReceipt) => Object.entries(expectedReceipt)
    .every(([key, value]) => payload[key] === value);
  for (const expectedReceipt of expected) {
    const matches = legalRows.filter((row) => matchesExpected(parsePayload(row), expectedReceipt));
    if (matches.length !== 1) throw new Error('signup_acceptance_bundle_invalid');
  }
  if (legalRows.length !== expected.length) throw new Error('signup_acceptance_unexpected_rows');

  const practitionerRow = rowsForEntity(db, 'User').find((row) => row.id === control.practitionerId);
  if (!practitionerRow || practitionerRow.updated_date === control.practitionerUpdatedDate) {
    throw new Error('signup_profile_write_missing');
  }
  const profile = parsePayload(practitionerRow);
  const requiredProfile = {
    clinician_name: 'AssessSuite Synthetic Practitioner',
    profession: 'Exercise Physiologist',
    qualifications: 'Bachelor of Clinical Exercise Physiology (synthetic)',
    clinic_name: `${PARITY_NAMESPACE} synthetic clinic`,
    clinic_address: '1 Synthetic Gate Way, Brisbane QLD 4000',
    clinic_phone: '+61 7 3000 0202',
    clinic_email: `clinic.${contract.waveId}@${PARITY_NAMESPACE}.seed.test`,
    country: 'australia',
  };
  for (const [field, value] of Object.entries(requiredProfile)) {
    if (profile[field] !== value) throw new Error('signup_profile_write_invalid');
  }
  for (const forbiddenField of ['date_of_birth', 'adult_only_confirmed', 'served_jurisdictions']) {
    if (Object.prototype.hasOwnProperty.call(profile, forbiddenField)) {
      throw new Error('signup_profile_forbidden_field_present');
    }
  }
  return {
    profileWrites: 1,
    logicalAcceptanceRows: 1,
    documentRows: legalRows.length,
    role: 'invited_clinician',
    duplicateRows: legalRows.length - expected.length,
  };
}

async function assertServerReady() {
  const response = await fetch(
    `http://127.0.0.1:8787/api/apps/public/prod/public-settings/by-id/${PARITY_APP_ID}`,
    { signal: AbortSignal.timeout(5_000), cache: 'no-store' },
  );
  if (!response.ok) throw new Error('parity_server_not_ready');
  await response.arrayBuffer();
}

export async function verifySeed(environment = process.env) {
  const contract = assertParityMachineEnvironment('verify-seed', environment);
  const { db } = openDatabase();
  try {
    const control = loadControl(db, contract.waveId);
    const shape = assertSeedShape(db, contract, control);
    if (shape.legal.length !== 0) throw new Error('parity_seed_legal_invalid');
    await assertServerReady();
    const receipt = {
      ...commonReceipt('verify-seed', contract),
      server_ready: true,
      synthetic_seed_present: true,
      membership_count: shape.memberships.length,
      legal_receipt_count: shape.legal.length,
      clinical_rows: clinicalCounts(db).total,
    };
    assert.deepEqual(Object.keys(receipt), VERIFY_SEED_RECEIPT_KEYS);
    return receipt;
  } finally {
    db.close();
  }
}

export function observeWave(environment = process.env) {
  const contract = assertParityMachineEnvironment('observe-wave', environment);
  const { db, entityNames } = openDatabase();
  try {
    const control = loadControl(db, contract.waveId);
    const shape = assertSeedShape(db, contract, control);
    const signup = verifySignupWrites(db, contract, control, shape.context);
    const after = baselineCounts(db);
    const state = namespaceState(db, [...entityNames], shape.context);
    const usageRows = state.internalRows.extraction_usage;
    const successfulUsage = usageRows.filter((row) => row.status === 'succeeded' && row.upload_count === 1);
    const missionUploads = state.internalRows.upload_registry;
    const providerRequests = successfulUsage.reduce((sum, row) => sum + Number(row.upload_count), 0);
    const emailAttempts = after.outboundEmail - control.baseline.outboundEmail;
    const smsAttempts = after.outboundSms - control.baseline.outboundSms;
    const paymentAttempts = after.payments - control.baseline.payments;
    const clinicalWrites = after.clinicalRows - control.baseline.clinicalRows;
    const referralCommits = after.referralCommits - control.baseline.referralCommits;
    const clientRecordsCreated = after.clients - control.baseline.clients;
    const namespaceFiles = countMissionFiles(state.internalRows);

    if (usageRows.length !== 1 || successfulUsage.length !== 1 || providerRequests !== 1) {
      throw new Error('provider_request_count_invalid');
    }
    if (missionUploads.length !== 1
      || missionUploads[0].lifecycle_state !== 'deleted'
      || missionUploads[0].bound_at !== null
      || missionUploads[0].bound_entity_id !== null) {
      throw new Error('upload_cancellation_invalid');
    }
    if (emailAttempts !== 0 || smsAttempts !== 0 || paymentAttempts !== 0
      || clinicalWrites !== 0 || referralCommits !== 0 || clientRecordsCreated !== 0
      || namespaceFiles !== 0) {
      throw new Error('parity_wave_side_effect_detected');
    }

    const receipt = {
      ...commonReceipt('observe-wave', contract),
      provider_call_limit: PARITY_PROVIDER_CALL_LIMIT,
      provider_requests: providerRequests,
      outbound_email_attempts: emailAttempts,
      outbound_sms_attempts: smsAttempts,
      payment_attempts: paymentAttempts,
      clinical_rows_before: control.baseline.clinicalRows,
      clinical_rows_after: after.clinicalRows,
      clinical_writes: clinicalWrites,
      referral_commits: referralCommits,
      client_records_created: clientRecordsCreated,
      namespace_rows: state.rowCount,
      namespace_files: namespaceFiles,
      // This is exact-path evidence: this process opens only the guarded
      // parity DB/uploads paths. The workflow's machine/volume identity gate
      // remains authoritative for the attached Fly volume topology.
      // This proves the executor opened only the exact parity database/upload
      // paths. Fly volume identity and attachment are independently proved by
      // the trusted workflow inventory gate.
      production_volume_path_accesses: 0,
      signup_profile_writes: signup.profileWrites,
      signup_acceptance_rows: signup.logicalAcceptanceRows,
      signup_acceptance_document_rows: signup.documentRows,
      signup_acceptance_role: signup.role,
      duplicate_signup_acceptance_rows: signup.duplicateRows,
    };
    assert.deepEqual(Object.keys(receipt), OBSERVE_RECEIPT_KEYS);
    return receipt;
  } finally {
    db.close();
  }
}

function deleteRowsByKey(db, tableName, rows, keyName) {
  const statement = db.prepare(`DELETE FROM ${tableName} WHERE ${keyName} = ?`);
  let deleted = 0;
  for (const row of rows) deleted += Number(statement.run(row[keyName]).changes);
  return deleted;
}

function removeMissionFiles(internalRows, uploadsDir = PARITY_UPLOADS_DIR) {
  let deleted = 0;
  const root = path.resolve(uploadsDir);
  for (const name of missionFileNames(internalRows)) {
    if (path.basename(name) !== name) throw new Error('unsafe_mission_filename');
    const candidate = path.resolve(root, name);
    if (path.dirname(candidate) !== root) throw new Error('unsafe_mission_path');
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe_mission_file_type');
    fs.rmSync(candidate);
    deleted += 1;
  }
  return deleted;
}

export function cleanupNamespaceStore({ db, entityNames, contract, uploadsDir }) {
  ensureControlTable(db);
  const names = [...entityNames];
  const control = loadControl(db, contract.waveId);
  const context = missionContext(db, contract, control);
  const before = namespaceState(db, names, context);
  const nonnamespaceRowsBefore = nonnamespaceDigest(db, names, before);
  const nonnamespaceFilesBefore = nonnamespaceFileDigest(before, uploadsDir);
  const clinicalRowsDeleted = CLINICAL_ENTITIES.reduce(
    (sum, name) => sum + before.entityRows[name].length,
    0,
  );
  const filesDeleted = removeMissionFiles(before.internalRows, uploadsDir);
  let rowsDeleted = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    rowsDeleted += deleteRowsByKey(db, 'upload_disposition', before.internalRows.upload_disposition, 'upload_id');
    rowsDeleted += deleteRowsByKey(db, 'upload_audit', before.internalRows.upload_audit, 'id');
    rowsDeleted += deleteRowsByKey(db, 'extraction_usage', before.internalRows.extraction_usage, 'id');
    rowsDeleted += deleteRowsByKey(db, 'referral_commit_receipt', before.internalRows.referral_commit_receipt, 'idempotency_key');
    rowsDeleted += deleteRowsByKey(db, 'upload_registry', before.internalRows.upload_registry, 'id');
    rowsDeleted += deleteRowsByKey(db, 'sessions', before.internalRows.sessions, 'token');
    rowsDeleted += deleteRowsByKey(db, 'outbox_email', before.internalRows.outbox_email, 'id');
    rowsDeleted += deleteRowsByKey(db, 'outbox_sms', before.internalRows.outbox_sms, 'id');

    const deletionOrder = [
      ...CLINICAL_ENTITIES,
      ...names.filter((name) => !CLINICAL_ENTITIES.includes(name)
        && !['LegalAcceptanceEvent', 'OrganizationMember', 'Organization', 'User'].includes(name)),
      'LegalAcceptanceEvent',
      'OrganizationMember',
      'Organization',
      'User',
    ];
    for (const entityName of deletionOrder) {
      rowsDeleted += deleteRowsByKey(db, `entity_${entityName}`, before.entityRows[entityName] || [], 'id');
    }
    rowsDeleted += Number(db.prepare(`
      DELETE FROM ${CONTROL_TABLE} WHERE namespace = ? AND wave_id = ?
    `).run(PARITY_NAMESPACE, contract.waveId).changes);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const afterContext = missionContext(db, contract, null);
  const after = namespaceState(db, names, afterContext);
  const remainingFiles = countMissionFiles(after.internalRows, uploadsDir);
  const nonnamespaceRowsAfter = nonnamespaceDigest(db, names, after);
  const nonnamespaceFilesAfter = nonnamespaceFileDigest(after, uploadsDir);
  if (after.rowCount !== 0 || remainingFiles !== 0) throw new Error('namespace_cleanup_incomplete');
  if (nonnamespaceRowsAfter !== nonnamespaceRowsBefore) throw new Error('nonnamespace_rows_changed');
  if (nonnamespaceFilesAfter !== nonnamespaceFilesBefore) throw new Error('nonnamespace_files_changed');
  return {
    rowsDeleted,
    filesDeleted,
    remainingNamespaceRows: after.rowCount,
    remainingNamespaceFiles: remainingFiles,
    clinicalRowsDeleted,
  };
}

export function cleanupAndVerify(environment = process.env) {
  const contract = assertParityMachineEnvironment('cleanup-and-verify', environment);
  const { db, entityNames } = openDatabase();
  try {
    const result = cleanupNamespaceStore({
      db,
      entityNames,
      contract,
      uploadsDir: PARITY_UPLOADS_DIR,
    });
    const receipt = {
      ...commonReceipt('namespace-cleanup', contract),
      rows_deleted: result.rowsDeleted,
      files_deleted: result.filesDeleted,
      remaining_namespace_rows: result.remainingNamespaceRows,
      remaining_namespace_files: result.remainingNamespaceFiles,
      nonnamespace_rows_touched: 0,
      nonnamespace_files_touched: 0,
      clinical_rows_deleted: result.clinicalRowsDeleted,
    };
    assert.deepEqual(Object.keys(receipt), CLEANUP_RECEIPT_KEYS);
    return receipt;
  } finally {
    db.close();
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const mode = process.argv[2];
  const runners = {
    seed: () => seedParityDatabase(),
    'verify-seed': () => verifySeed(),
    'observe-wave': () => observeWave(),
    'cleanup-and-verify': () => cleanupAndVerify(),
  };
  const runner = runners[mode];
  if (!runner) {
    process.stderr.write('ASSESSSUITE_PARITY_FAILED\n');
    process.exitCode = 1;
  } else {
    Promise.resolve()
      .then(runner)
      .then((receipt) => process.stdout.write(`${frameParityReceipt(receipt)}\n`))
      .catch(() => {
        process.stderr.write('ASSESSSUITE_PARITY_FAILED\n');
        process.exitCode = 1;
      });
  }
}
