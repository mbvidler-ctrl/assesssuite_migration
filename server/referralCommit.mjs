// Atomic persistence boundary for the practitioner-reviewed referral journey.
//
// The browser-facing Base44 SDK has no cross-entity transaction primitive. A
// referral save, however, spans Client, ClientCondition, ClientDocument and
// upload-registry rows. This module keeps that entire
// write set on the server and performs it synchronously on the one SQLite
// connection, so BEGIN IMMEDIATE covers every entity, binding and audit row.

import fs from 'node:fs';
import { createHash } from 'node:crypto';

import { createEntityRepository } from './db.mjs';
import { extractedDateOfBirthIsUnder13 } from './documentExtraction.mjs';
import { canonicalUploadPath } from './uploadRegistry.mjs';
import { REFERRAL_SUBJECT_AGE_CONFIRMATION } from '../src/lib/referralWorkflow.js';

export const REFERRAL_REVIEW_COMMIT_VERSION = 'referral-review-commit-v2026-07-21.1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_UPLOADS = 4;
const MAX_CONDITIONS = 50;

const TOP_LEVEL_FIELDS = new Set([
  'idempotency_key',
  'org_id',
  'operation',
  'client_id',
  'review_confirmed',
  'review_version',
  'client',
  'conditions',
  'upload_ids',
  'historical_assessments',
]);

// This is deliberately narrower than the complete Client entity. Referral
// extraction may update only fields shown in the mandatory review surface;
// tenant, assignment, consent and lifecycle fields remain server-controlled.
const CLIENT_FIELDS = new Set([
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'email',
  'address',
  'referral_source',
  'referral_source_name',
  'referral_source_address',
  'referral_source_email',
  'referral_provider_number',
  'referral_reason',
  'referral_date',
  'funding_source',
  'medicare_number',
  'medicare_irn',
  'medicare_referral_type',
  'dva_card_number',
  'dva_card_type',
  'dva_file_number',
  'dva_accepted_conditions',
  'ndis_number',
  'ndis_goals',
  'private_health_fund_name',
  'private_health_fund_number',
  'workcover_claim_number',
  'workcover_date_of_injury',
  'workcover_injury_description',
  'primary_gp_name',
  'primary_gp_clinic_name',
  'primary_gp_address',
  'primary_gp_phone',
  'primary_gp_email',
  'primary_gp_provider_number',
  'client_goals',
]);

const CLIENT_ENUMS = new Map([
  ['gender', new Set(['male', 'female', 'other', 'prefer_not_to_say'])],
  ['referral_source', new Set([
    'gp',
    'wc_case_manager',
    'aged_care_case_manager',
    'ndis_support_coordinator',
    'dva',
    'self_referral',
    'other',
  ])],
  ['funding_source', new Set([
    'dva',
    'private_health',
    'medicare',
    'self_funded',
    'workcover_qld',
    'ndis',
    'tac_maic',
    'aged_care',
    'my_aged_care',
    'other',
  ])],
  ['medicare_referral_type', new Set(['tca', 'epc', 'cdm'])],
  ['dva_card_type', new Set(['white', 'gold', 'gold_tpi'])],
]);

const CLIENT_DATE_FIELDS = new Set([
  'date_of_birth',
  'referral_date',
  'workcover_date_of_injury',
]);

const CONDITION_FIELDS = new Set(['condition_name', 'condition_type', 'medication', 'notes']);

export class ReferralCommitError extends Error {
  constructor(httpStatus, code, publicMessage) {
    super(publicMessage);
    this.name = 'ReferralCommitError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function reject(httpStatus, code, publicMessage) {
  throw new ReferralCommitError(httpStatus, code, publicMessage);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownFields(value, allowed, code = 'invalid_referral_commit') {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) reject(400, code, 'The reviewed referral request is invalid.');
  }
}

function cleanIdentifier(value, { code = 'invalid_referral_commit', required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    reject(400, code, 'The reviewed referral request is invalid.');
  }
  if (typeof value !== 'string') reject(400, code, 'The reviewed referral request is invalid.');
  const clean = value.trim();
  if (!clean || clean.length > 200 || /[\u0000-\u001f\u007f]/.test(clean)) {
    reject(400, code, 'The reviewed referral request is invalid.');
  }
  return clean;
}

function cleanText(value, { max = 10_000, code = 'invalid_referral_commit', optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    reject(400, code, 'The reviewed referral request is invalid.');
  }
  if (typeof value !== 'string') reject(400, code, 'The reviewed referral request is invalid.');
  const clean = value.trim();
  if ((!clean && !optional) || clean.length > max || clean.includes('\u0000')) {
    reject(400, code, 'The reviewed referral request is invalid.');
  }
  return clean || null;
}

function isIsoDate(value) {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeClientData(value, operation) {
  if (!isPlainObject(value)) reject(400, 'invalid_client_review', 'The reviewed client details are invalid.');
  rejectUnknownFields(value, CLIENT_FIELDS, 'invalid_client_review');
  const normalized = {};
  for (const [field, raw] of Object.entries(value)) {
    const clean = cleanText(raw, { optional: true, code: 'invalid_client_review' });
    if (clean === null) continue;
    if (CLIENT_DATE_FIELDS.has(field) && !isIsoDate(clean)) {
      reject(400, 'invalid_client_review', 'The reviewed client details are invalid.');
    }
    const allowed = CLIENT_ENUMS.get(field);
    if (allowed && !allowed.has(clean)) {
      reject(400, 'invalid_client_review', 'The reviewed client details are invalid.');
    }
    normalized[field] = clean;
  }
  if (
    !normalized.full_name ||
    !normalized.date_of_birth ||
    (operation === 'create' && !normalized.gender)
  ) {
    reject(400, 'incomplete_client_review', 'Review the required client details before saving.');
  }
  return normalized;
}

function normalizeConditions(value) {
  if (!Array.isArray(value) || value.length > MAX_CONDITIONS) {
    reject(400, 'invalid_conditions', 'The reviewed conditions are invalid.');
  }
  const seen = new Set();
  const normalized = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) reject(400, 'invalid_conditions', 'The reviewed conditions are invalid.');
    rejectUnknownFields(raw, CONDITION_FIELDS, 'invalid_conditions');
    const conditionName = cleanText(raw.condition_name, { max: 500, code: 'invalid_conditions' });
    const conditionType = cleanText(raw.condition_type, { max: 40, code: 'invalid_conditions' });
    if (!['primary', 'comorbidity'].includes(conditionType)) {
      reject(400, 'invalid_conditions', 'The reviewed conditions are invalid.');
    }
    const medication = cleanText(raw.medication, {
      max: 1_000,
      optional: true,
      code: 'invalid_conditions',
    });
    const notes = cleanText(raw.notes, {
      max: 8_000,
      optional: true,
      code: 'invalid_conditions',
    });
    if (medication && (conditionType !== 'comorbidity' || conditionName.toLocaleLowerCase() !== 'medication')) {
      reject(400, 'invalid_conditions', 'The reviewed conditions are invalid.');
    }
    const key = [
      conditionType,
      conditionName.toLocaleLowerCase(),
      medication?.toLocaleLowerCase() || '',
      notes?.toLocaleLowerCase() || '',
    ].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      condition_name: conditionName,
      condition_type: conditionType,
      ...(medication ? { medication } : {}),
      ...(notes ? { notes } : {}),
    });
  }
  return normalized;
}

function normalizeHistoricalAssessments(value) {
  if (!Array.isArray(value)) {
    reject(400, 'invalid_historical_assessments', 'The reviewed historical assessments are invalid.');
  }
  if (value.length > 0) {
    reject(
      400,
      'historical_assessments_not_supported',
      'Historical assessment import is not available for reviewed referrals.',
    );
  }
  return [];
}

function normalizeUploadIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_UPLOADS) {
    reject(400, 'invalid_uploads', 'The reviewed referral files are invalid.');
  }
  const ids = value.map((raw) => {
    const id = cleanIdentifier(raw, { code: 'invalid_uploads' }).toLowerCase();
    if (!UUID_RE.test(id)) reject(400, 'invalid_uploads', 'The reviewed referral files are invalid.');
    return id;
  });
  if (new Set(ids).size !== ids.length) reject(400, 'invalid_uploads', 'Select each referral file only once.');
  return ids;
}

function normalizeRequest(body) {
  if (!isPlainObject(body)) reject(400, 'invalid_referral_commit', 'The reviewed referral request is invalid.');
  rejectUnknownFields(body, TOP_LEVEL_FIELDS);
  const idempotencyKey = cleanIdentifier(body.idempotency_key);
  if (!UUID_RE.test(idempotencyKey)) {
    reject(400, 'invalid_idempotency_key', 'The reviewed referral request is invalid.');
  }
  const orgId = cleanIdentifier(body.org_id);
  const operation = cleanText(body.operation, { max: 20 });
  if (!['create', 'update'].includes(operation)) {
    reject(400, 'invalid_referral_operation', 'The reviewed referral operation is invalid.');
  }
  const clientId = cleanIdentifier(body.client_id, { required: false });
  if ((operation === 'create' && clientId) || (operation === 'update' && !clientId)) {
    reject(400, 'invalid_referral_operation', 'The reviewed referral operation is invalid.');
  }
  if (body.review_confirmed !== true || body.review_version !== REFERRAL_REVIEW_COMMIT_VERSION) {
    reject(403, 'review_required', 'Review and confirm the extracted referral before saving.');
  }
  return {
    idempotencyKey: idempotencyKey.toLowerCase(),
    payload: {
      org_id: orgId,
      operation,
      client_id: clientId,
      review_confirmed: true,
      review_version: REFERRAL_REVIEW_COMMIT_VERSION,
      client: normalizeClientData(body.client, operation),
      conditions: normalizeConditions(body.conditions ?? []),
      upload_ids: normalizeUploadIds(body.upload_ids),
      historical_assessments: normalizeHistoricalAssessments(body.historical_assessments ?? []),
    },
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestDigest(payload) {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/** Assurance-visible digest helper over the normalized reviewed payload. */
export function referralCommitRequestDigest(body) {
  return requestDigest(normalizeRequest(body).payload);
}

function conditionFingerprint(record) {
  return [
    String(record.condition_type || '').trim().toLocaleLowerCase(),
    String(record.condition_name || '').trim().toLocaleLowerCase(),
    String(record.medication || '').trim().toLocaleLowerCase(),
    String(record.notes || '').trim().toLocaleLowerCase(),
  ].join('\u0000');
}

function normalizeReviewedIdentityName(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim();
}

function assertReviewedIdentityMatchesClient(reviewedClient, targetClient) {
  // This is an authorisation boundary, not duplicate-detection advice. Permit
  // only case/punctuation/spacing variants of the complete selected-client
  // name, in the same token order, and the exact canonical ISO DOB. A partial
  // or token-subset name must never authorise a client mutation.
  const reviewedName = normalizeReviewedIdentityName(reviewedClient.full_name);
  const targetName = normalizeReviewedIdentityName(targetClient?.full_name);
  const targetDateOfBirth = typeof targetClient?.date_of_birth === 'string'
    ? targetClient.date_of_birth.trim()
    : '';
  if (
    !reviewedName ||
    reviewedName !== targetName ||
    reviewedClient.date_of_birth !== targetDateOfBirth
  ) {
    reject(
      409,
      'client_identity_mismatch',
      'The reviewed referral identity does not match the selected client.',
    );
  }
}

function rollbackPreservingOriginal(db) {
  try {
    db.exec('ROLLBACK');
  } catch {
    // Preserve the original transaction error.
  }
}

export function createReferralCommitService({
  db,
  uploadRegistry,
  uploadsDir,
  getOrgIdsForUser,
  hasCurrentLegalAcceptance,
  isClinicalUseEligible,
  now = () => new Date(),
}) {
  if (
    !db ||
    !uploadRegistry ||
    typeof uploadRegistry.hasReferralProcessingAuthority !== 'function' ||
    typeof uploadRegistry.quarantineReviewedUnder13 !== 'function' ||
    !uploadsDir ||
    typeof getOrgIdsForUser !== 'function' ||
    typeof hasCurrentLegalAcceptance !== 'function' ||
    typeof isClinicalUseEligible !== 'function'
  ) {
    throw new Error('referral commit service dependencies are incomplete');
  }

  const clients = createEntityRepository(db, 'Client');
  const conditions = createEntityRepository(db, 'ClientCondition');
  const documents = createEntityRepository(db, 'ClientDocument');

  function assertUploadIntegrity(upload) {
    try {
      const filePath = canonicalUploadPath(uploadsDir, upload.storedName, { mustExist: true });
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Number(upload.byteSize)) throw new Error('invalid');
      const actualSha256 = createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      if (actualSha256 !== upload.sha256) throw new Error('invalid');
    } catch {
      reject(409, 'upload_integrity_failed', 'A reviewed referral file is no longer available.');
    }
  }

  function commit({ sessionUser, body }) {
    if (!sessionUser?.id || !sessionUser?.email) {
      reject(401, 'authentication_required', 'Authentication is required.');
    }
    if (sessionUser.account_status !== 'active') {
      reject(403, 'account_inactive', 'Account approval is required before saving a referral.');
    }
    if (!isClinicalUseEligible(sessionUser)) {
      reject(403, 'clinical_release_unavailable', 'Referral saving is not approved for this account profile.');
    }

    const timestamp = now();
    const { idempotencyKey, payload } = normalizeRequest(body);
    const digest = requestDigest(payload);

    let transactionOpen = false;
    db.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    try {
      const orgIds = getOrgIdsForUser(sessionUser.email);
      if (!Array.isArray(orgIds) || !orgIds.includes(payload.org_id)) {
        reject(403, 'org_forbidden', 'The selected organisation is unavailable.');
      }
      if (!hasCurrentLegalAcceptance(sessionUser.email, payload.org_id)) {
        reject(403, 'legal_acceptance_required', 'Current legal acceptance is required before saving a referral.');
      }

      const existingReceipt = db.prepare(`
        SELECT * FROM referral_commit_receipt WHERE idempotency_key = ?
      `).get(idempotencyKey);
      if (existingReceipt) {
        if (
          existingReceipt.actor_user_id !== sessionUser.id ||
          existingReceipt.org_id !== payload.org_id ||
          existingReceipt.request_sha256 !== digest
        ) {
          reject(409, 'idempotency_conflict', 'This referral save key has already been used.');
        }
        const result = JSON.parse(existingReceipt.result_json);
        db.exec('COMMIT');
        transactionOpen = false;
        return result;
      }

      let targetClient = null;
      if (payload.operation === 'update') {
        targetClient = clients.getById(payload.client_id);
        if (!targetClient || targetClient.org_id !== payload.org_id) {
          reject(404, 'client_not_found', 'The selected client is unavailable.');
        }
        if (targetClient.archived === true) {
          reject(409, 'client_archived', 'An archived client cannot be updated from a referral.');
        }
        // The target id comes from the browser, so tenant ownership alone is
        // not enough: bind the final reviewed name and DOB to that exact
        // selected client before any entity or upload-registry write.
        assertReviewedIdentityMatchesClient(payload.client, targetClient);
      }

      // Authorise the complete mutable dependency set before the first entity
      // write. A retry with another key can never reuse a bound file: only a
      // receipt replay is allowed to bypass this review-pending requirement.
      // Physical integrity is checked after the reviewed-age gate so a damaged
      // sibling cannot prevent every authorised file in an under-13 set from
      // being durably provider-blocked.
      const retainedUploads = payload.upload_ids.map((uploadId) => {
        const upload = uploadRegistry.getById(uploadId);
        if (
          !upload ||
          upload.orgId !== payload.org_id ||
          upload.uploaderUserId !== sessionUser.id ||
          upload.isLegacy ||
          upload.purpose !== 'referral-extraction' ||
          upload.state !== 'review-pending' ||
          !uploadRegistry.hasReferralProcessingAuthority(upload.id) ||
          upload.subjectAgeBand !== REFERRAL_SUBJECT_AGE_CONFIRMATION ||
          (upload.expiresAt && Date.parse(upload.expiresAt) <= timestamp.getTime())
        ) {
          reject(404, 'upload_not_found', 'A reviewed referral file is unavailable.');
        }
        return upload;
      });

      if (extractedDateOfBirthIsUnder13(payload.client.date_of_birth, timestamp)) {
        // No entity write has occurred. End the read/validation transaction so
        // the upload registry can durably apply its own fail-closed provider
        // blocks and categorical quarantine transactions to every file.
        db.exec('ROLLBACK');
        transactionOpen = false;
        try {
          uploadRegistry.quarantineReviewedUnder13(
            retainedUploads.map((upload) => upload.id),
            { actorUserId: sessionUser.id, now: timestamp },
          );
        } catch {
          reject(
            503,
            'upload_quarantine_incomplete',
            'The referral could not be quarantined safely. No client data was changed.',
          );
        }
        reject(
          409,
          'reviewed_subject_under_13',
          'This referral cannot be saved or processed through the configured extraction provider.',
        );
      }

      for (const upload of retainedUploads) assertUploadIntegrity(upload);

      if (payload.operation === 'create') {
        targetClient = clients.create({
          ...payload.client,
          org_id: payload.org_id,
          assigned_clinician_email: sessionUser.email,
          consent_confirmed: false,
        }, sessionUser.email);
      } else if (Object.keys(payload.client).length > 0) {
        targetClient = clients.update(targetClient.id, payload.client);
      }

      const existingConditions = new Map();
      for (const record of conditions.listAll()) {
        if (record.org_id !== payload.org_id || record.client_id !== targetClient.id) continue;
        const fingerprint = conditionFingerprint(record);
        const prior = existingConditions.get(fingerprint);
        // Prefer an already-active duplicate; otherwise retain one inactive
        // row that can be reactivated without creating another duplicate.
        if (!prior || (prior.is_active === false && record.is_active !== false)) {
          existingConditions.set(fingerprint, record);
        }
      }
      let conditionsCreated = 0;
      for (const item of payload.conditions) {
        const fingerprint = conditionFingerprint(item);
        const existingCondition = existingConditions.get(fingerprint);
        if (existingCondition) {
          if (existingCondition.is_active === false) {
            conditions.update(existingCondition.id, { is_active: true });
            existingCondition.is_active = true;
          }
          continue;
        }
        conditions.create({
          ...item,
          client_id: targetClient.id,
          org_id: payload.org_id,
          is_active: true,
        }, sessionUser.email);
        existingConditions.set(fingerprint, { ...item, is_active: true });
        conditionsCreated += 1;
      }

      let documentsRetained = 0;
      for (const upload of retainedUploads) {
        const document = documents.create({
          client_id: targetClient.id,
          org_id: payload.org_id,
          document_type: 'referral',
          file_url: `/uploads/${upload.id}`,
          file_name: upload.originalName,
          notes: 'Uploaded via referral uploader',
        }, sessionUser.email);
        uploadRegistry.bind(upload.id, {
          orgId: payload.org_id,
          actorUserId: sessionUser.id,
          entityType: 'ClientDocument',
          entityId: document.id,
          now: timestamp,
        });
        documentsRetained += 1;
      }

      const result = {
        status: 'success',
        operation: payload.operation,
        client_id: targetClient.id,
        counts: {
          conditions_created: conditionsCreated,
          documents_retained: documentsRetained,
          historical_assessments_created: 0,
        },
      };

      db.prepare(`
        INSERT INTO referral_commit_receipt (
          idempotency_key, request_sha256, actor_user_id, org_id,
          operation, client_id, result_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        idempotencyKey,
        digest,
        sessionUser.id,
        payload.org_id,
        payload.operation,
        targetClient.id,
        JSON.stringify(result),
        timestamp.toISOString(),
      );

      db.exec('COMMIT');
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) rollbackPreservingOriginal(db);
      throw error;
    }
  }

  return { commit };
}
