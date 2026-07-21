// Tenant-bound upload persistence, validation, lifecycle and usage controls.
//
// This module deliberately uses only Node built-ins and the process's existing
// DatabaseSync handle. File contents never enter audit rows or logs.

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE,
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../src/lib/referralWorkflow.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PHYSICAL_CLEANUP_GRACE_MS = 60 * 1000;
const REGISTERING_TEMP_SUFFIX = '.registering';
const PROVIDER_BLOCK_SUFFIX = '.provider-block';
const HISTORICAL_ARTIFACT_RECONCILIATION_MAX_ENTRIES = 10_000;
const TRANSIENT_PROVIDER_BLOCKS = new Set();

export function assertProductionUploadPolicyEnvironment(environment = process.env) {
  if (environment.NODE_ENV !== 'production') return;
  if (
    environment.UPLOAD_AUDIT_RETENTION_DAYS !== undefined &&
    environment.UPLOAD_AUDIT_RETENTION_DAYS.trim() !== '730'
  ) {
    // Do not include the supplied value: startup logs must never disclose
    // configuration content, and production retention is release-controlled.
    throw new Error('UPLOAD_AUDIT_RETENTION_DAYS must remain 730 in production');
  }
  if (
    environment.UPLOAD_CLEANUP_INTERVAL_MINUTES !== undefined &&
    environment.UPLOAD_CLEANUP_INTERVAL_MINUTES.trim() !== '1'
  ) {
    throw new Error('UPLOAD_CLEANUP_INTERVAL_MINUTES must remain 1 in production');
  }
}

assertProductionUploadPolicyEnvironment();

export const REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION =
  'referral-processing-authority-v2026-07-21.1';
export const REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE =
  'authenticated_practitioner_action';
export const UPLOAD_DISPOSITION_RESOLUTION_VERSION =
  'upload-disposition-resolution-v2026-07-21.1';

const UPLOAD_DISPOSITION_RETENTION_BASES = new Set([
  'clinical_record_retention',
  'legal_hold',
  'regulatory_hold',
  'investigation_hold',
]);

function boundedNumber(name, fallback, { min, max, integer = true } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const value = integer ? Math.floor(parsed) : parsed;
  if (min !== undefined && value < min) return fallback;
  if (max !== undefined && value > max) return max;
  return value;
}

// The 24-hour and one-hour caps are policy ceilings, not merely defaults.
// Environment values may shorten them but cannot silently lengthen them.
const referralTtlHours = boundedNumber('UPLOAD_REFERRAL_TTL_HOURS', 24, { min: 1, max: 24 });
const failureCleanupMinutes = boundedNumber('UPLOAD_FAILURE_CLEANUP_MINUTES', 60, {
  min: 1,
  max: 60,
});

export const UPLOAD_POLICY = Object.freeze({
  maxRequestBytes: boundedNumber('UPLOAD_MAX_REQUEST_BYTES', 24 * 1024 * 1024, {
    min: 1024,
    max: 32 * 1024 * 1024,
  }),
  maxFileBytes: boundedNumber('UPLOAD_MAX_FILE_BYTES', 20 * 1024 * 1024, {
    min: 1024,
    max: 24 * 1024 * 1024,
  }),
  maxReferralBytes: boundedNumber('UPLOAD_MAX_REFERRAL_BYTES', 10 * 1024 * 1024, {
    min: 1024,
    max: 20 * 1024 * 1024,
  }),
  maxFilesPerExtraction: boundedNumber('DOCUMENT_EXTRACTION_MAX_FILES', 4, { min: 1, max: 8 }),
  // Access expires one maintenance interval before the physical-retention
  // ceiling, so the minute scheduler can remove bytes by (not after) 24h/1h.
  referralTtlMs: Math.max(0, referralTtlHours * HOUR_MS - PHYSICAL_CLEANUP_GRACE_MS),
  failureCleanupMs: Math.max(
    0,
    Math.min(failureCleanupMinutes * 60 * 1000, referralTtlHours * HOUR_MS) - PHYSICAL_CLEANUP_GRACE_MS,
  ),
  auditRetentionMs:
    boundedNumber('UPLOAD_AUDIT_RETENTION_DAYS', 730, { min: 30, max: 3650 }) * DAY_MS,
  // Rowless artifacts from the predecessor write-before-row implementation
  // are never removed until they have remained untouched for a full day.
  // This is a fixed ceiling/floor, rather than an environment-controlled
  // value, so a deployment cannot silently widen or shorten the safety gate.
  historicalArtifactReconciliationAgeMs: DAY_MS,
  // Removed-reference files are isolated immediately, then require a human
  // disposition decision on a bounded clock. Configuration may shorten these
  // ceilings but cannot silently extend them.
  dispositionReviewMs:
    boundedNumber('UPLOAD_DISPOSITION_REVIEW_DAYS', 30, { min: 1, max: 30 }) * DAY_MS,
  dispositionRetentionReviewMs:
    boundedNumber('UPLOAD_DISPOSITION_RETENTION_REVIEW_DAYS', 365, { min: 1, max: 365 }) * DAY_MS,
  uploadUserPerMinute: boundedNumber('UPLOAD_USER_PER_MINUTE', 10, { min: 1, max: 60 }),
  uploadOrgPerMinute: boundedNumber('UPLOAD_ORG_PER_MINUTE', 30, { min: 1, max: 240 }),
  uploadUserDailyBytes: boundedNumber('UPLOAD_USER_DAILY_BYTES', 250 * 1024 * 1024, {
    min: 1024 * 1024,
    max: 2 * 1024 * 1024 * 1024,
  }),
  uploadOrgDailyBytes: boundedNumber('UPLOAD_ORG_DAILY_BYTES', 1024 * 1024 * 1024, {
    min: 1024 * 1024,
    max: 8 * 1024 * 1024 * 1024,
  }),
  globalLiveBytes: boundedNumber('UPLOAD_GLOBAL_LIVE_BYTES', 2 * 1024 * 1024 * 1024, {
    min: 16 * 1024 * 1024,
    max: 16 * 1024 * 1024 * 1024,
  }),
  extractionUserPerMinute: boundedNumber('DOCUMENT_EXTRACTION_USER_PER_MINUTE', 5, {
    min: 1,
    max: 60,
  }),
  extractionOrgPerMinute: boundedNumber('DOCUMENT_EXTRACTION_ORG_PER_MINUTE', 15, {
    min: 1,
    max: 180,
  }),
  extractionUserDailyDocuments: boundedNumber('DOCUMENT_EXTRACTION_USER_DAILY_DOCUMENTS', 20, {
    min: 1,
    max: 500,
  }),
  extractionOrgDailyDocuments: boundedNumber('DOCUMENT_EXTRACTION_ORG_DAILY_DOCUMENTS', 100, {
    min: 1,
    max: 2000,
  }),
  extractionUserDailyCostMicrousd: Math.round(
    boundedNumber('DOCUMENT_EXTRACTION_USER_DAILY_COST_USD', 2, {
      min: 0.1,
      max: 10,
      integer: false,
    }) * 1_000_000,
  ),
  extractionOrgDailyCostMicrousd: Math.round(
    boundedNumber('DOCUMENT_EXTRACTION_ORG_DAILY_COST_USD', 10, {
      min: 0.5,
      max: 20,
      integer: false,
    }) * 1_000_000,
  ),
  // The mission ceiling is USD 30/month. The hard maximum of USD 29 leaves
  // headroom for estimate error and existing non-extraction OpenAI usage.
  extractionMonthlyCircuitMicrousd: Math.round(
    boundedNumber('DOCUMENT_EXTRACTION_MONTHLY_CIRCUIT_USD', 25, {
      min: 1,
      max: 29,
      integer: false,
    }) * 1_000_000,
  ),
  estimatedCostPerDocumentMicrousd: Math.round(
    boundedNumber('DOCUMENT_EXTRACTION_ESTIMATED_COST_PER_DOCUMENT_USD', 0.2, {
      min: 0.01,
      max: 2,
      integer: false,
    }) * 1_000_000,
  ),
});

export class UploadError extends Error {
  constructor(status, code, publicMessage) {
    super(publicMessage);
    this.name = 'UploadError';
    this.httpStatus = status;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export const APPROVED_UPLOAD_PURPOSES = new Set([
  'referral-extraction',
  'clinical-attachment',
  'report-attachment',
  'audio-transcription',
  'profile-image',
]);

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

const FILE_TYPES = [
  {
    kind: 'pdf',
    extensions: new Set(['.pdf']),
    mime: 'application/pdf',
    declared: new Set(['application/pdf']),
    matches: (b) => b.length >= 5 && b.subarray(0, 5).equals(Buffer.from('%PDF-')),
  },
  {
    kind: 'png',
    extensions: new Set(['.png']),
    mime: 'image/png',
    declared: new Set(['image/png']),
    matches: (b) =>
      b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    kind: 'jpeg',
    extensions: new Set(['.jpg', '.jpeg']),
    mime: 'image/jpeg',
    declared: new Set(['image/jpeg', 'image/jpg']),
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    kind: 'gif',
    extensions: new Set(['.gif']),
    mime: 'image/gif',
    declared: new Set(['image/gif']),
    matches: (b) => b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')),
  },
  {
    kind: 'webp',
    extensions: new Set(['.webp']),
    mime: 'image/webp',
    declared: new Set(['image/webp']),
    matches: (b) =>
      b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    kind: 'webm',
    extensions: new Set(['.webm']),
    mime: 'audio/webm',
    declared: new Set(['audio/webm', 'video/webm']),
    matches: (b) => b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
  {
    kind: 'wav',
    extensions: new Set(['.wav']),
    mime: 'audio/wav',
    declared: new Set(['audio/wav', 'audio/x-wav', 'audio/wave']),
    matches: (b) =>
      b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WAVE',
  },
  {
    kind: 'mp3',
    extensions: new Set(['.mp3']),
    mime: 'audio/mpeg',
    declared: new Set(['audio/mpeg', 'audio/mp3']),
    matches: (b) =>
      b.length >= 3 &&
      (b.subarray(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)),
  },
  {
    kind: 'mp4',
    extensions: new Set(['.m4a', '.mp4']),
    mime: 'audio/mp4',
    declared: new Set(['audio/mp4', 'audio/x-m4a', 'video/mp4']),
    matches: (b) => b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp',
  },
  {
    kind: 'docx',
    extensions: new Set(['.docx']),
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    declared: new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    matches: (b) => {
      if (b.length < 4 || b[0] !== 0x50 || b[1] !== 0x4b || b[2] !== 0x03 || b[3] !== 0x04) return false;
      const names = b.toString('latin1');
      if (!names.includes('[Content_Types].xml') || !names.includes('word/document.xml')) return false;
      return !/vbaProject\.bin|word\/activeX|word\/embeddings|\.exe\b|\.js\b/i.test(names);
    },
  },
];

const PURPOSE_KINDS = {
  'referral-extraction': new Set(['pdf', 'png', 'jpeg', 'csv']),
  'clinical-attachment': new Set(['pdf', 'png', 'jpeg', 'gif', 'webp', 'docx']),
  'report-attachment': new Set(['pdf', 'png', 'jpeg', 'gif', 'webp', 'docx']),
  'audio-transcription': new Set(['webm', 'wav', 'mp3', 'mp4']),
  'profile-image': new Set(['png', 'jpeg', 'gif', 'webp']),
};

const MANAGED_UPLOAD_EXTENSIONS = new Set([
  ...FILE_TYPES.flatMap((type) => [...type.extensions]),
  '.csv',
]);
const MANAGED_EXTENSION_PATTERN = [...MANAGED_UPLOAD_EXTENSIONS]
  .map((extension) => extension.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const UUID_V4_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const HISTORICAL_PENDING_PATTERN = new RegExp(
  `^(${UUID_V4_PATTERN})\\.(${MANAGED_EXTENSION_PATTERN})\\.pending-(${UUID_V4_PATTERN})$`,
);
const REGISTERING_ARTIFACT_PATTERN = new RegExp(
  `^(${UUID_V4_PATTERN})\\.(${MANAGED_EXTENSION_PATTERN})\\.registering$`,
);
const PROVIDER_BLOCK_ARTIFACT_PATTERN = new RegExp(`^(${UUID_V4_PATTERN})\\.provider-block$`);
const FINAL_MANAGED_ARTIFACT_PATTERN = new RegExp(
  `^(${UUID_V4_PATTERN})\\.(${MANAGED_EXTENSION_PATTERN})$`,
);

function safeOriginalName(name) {
  const value = typeof name === 'string' ? name : '';
  const base = value.replaceAll('\\', '/').split('/').pop() || 'upload';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 180);
  return cleaned || 'upload';
}

function normalizeDeclaredMime(value) {
  return typeof value === 'string' ? value.split(';', 1)[0].trim().toLowerCase() : '';
}

function isUtf8Text(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function looksLikeCsv(buffer) {
  if (!isUtf8Text(buffer)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 16 * 1024)).toString('utf8');
  const lines = sample.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return false;
  return lines.slice(0, 5).some((line) => line.includes(','));
}

export function inspectUpload({ buffer, originalName, declaredMime, purpose }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new UploadError(400, 'empty_file', 'The selected file is empty.');
  }
  if (!APPROVED_UPLOAD_PURPOSES.has(purpose)) {
    throw new UploadError(400, 'invalid_purpose', 'Select a supported upload purpose.');
  }
  const maxBytes = purpose === 'referral-extraction' ? UPLOAD_POLICY.maxReferralBytes : UPLOAD_POLICY.maxFileBytes;
  if (buffer.length > maxBytes) {
    throw new UploadError(413, 'file_too_large', 'The selected file is too large.');
  }

  const safeName = safeOriginalName(originalName);
  const extension = path.extname(safeName).toLowerCase();
  const normalizedMime = normalizeDeclaredMime(declaredMime);
  let detected = FILE_TYPES.find((type) => type.extensions.has(extension) && type.matches(buffer));

  if (extension === '.csv' && looksLikeCsv(buffer)) {
    detected = {
      kind: 'csv',
      extensions: new Set(['.csv']),
      mime: 'text/csv',
      declared: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']),
    };
  }

  if (!detected) {
    throw new UploadError(415, 'unsupported_or_mismatched_file', 'The file type is unsupported or does not match its contents.');
  }
  if (!PURPOSE_KINDS[purpose]?.has(detected.kind)) {
    throw new UploadError(415, 'purpose_media_mismatch', 'That file type is not supported for the selected purpose.');
  }
  if (!GENERIC_MIME_TYPES.has(normalizedMime) && !detected.declared.has(normalizedMime)) {
    throw new UploadError(415, 'mime_mismatch', 'The file type is unsupported or does not match its contents.');
  }

  return {
    originalName: safeName,
    extension: detected.kind === 'mp4' ? extension : [...detected.extensions][0],
    detectedMime: detected.mime,
    kind: detected.kind,
    byteSize: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

export function canonicalUploadPath(uploadsDir, storedName, { mustExist = false } = {}) {
  if (typeof storedName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(storedName)) {
    throw new UploadError(404, 'upload_not_found', 'File not found.');
  }
  const root = path.resolve(uploadsDir);
  const candidate = path.resolve(root, storedName);
  if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) {
    throw new UploadError(404, 'upload_not_found', 'File not found.');
  }
  if (mustExist) {
    let stat;
    try {
      stat = fs.lstatSync(candidate);
    } catch {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    if (!realCandidate.startsWith(`${realRoot}${path.sep}`)) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
  }
  return candidate;
}

function mapUpload(row) {
  if (!row) return null;
  return {
    id: row.id,
    storedName: row.stored_name,
    originalName: row.original_name,
    orgId: row.org_id,
    uploaderUserId: row.uploader_user_id,
    purpose: row.purpose,
    detectedMime: row.detected_mime,
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    state: row.lifecycle_state,
    subjectAgeBand: row.subject_age_band || 'unknown',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    boundAt: row.bound_at,
    deletedAt: row.deleted_at,
    boundEntityType: row.bound_entity_type,
    boundEntityId: row.bound_entity_id,
    isLegacy: Boolean(row.is_legacy),
  };
}

function safeAuditMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const allowed = new Set([
    'diagnostic_reference',
    'stage',
    'code',
    'file_count',
    'byte_size',
    'detected_mime',
    'purpose',
    'state_from',
    'state_to',
    'provider_status_class',
    'schema_hash',
    'estimated_cost_microusd',
    'actual_cost_microusd',
    'dry_run',
    'attestation_version',
    'upload_purpose',
    'subject_age_attestation_source',
    'subject_age_attestation_version',
    'subject_age_band',
    'processing_authority_attestation_source',
    'processing_authority_attestation_version',
    'processing_authority_confirmed',
    'provider_model',
    'prompt_version',
    'provider_response_id_hash',
    'provider_request_constructed',
    'provider_contact_attempted',
    'request_store_disabled',
    'request_background_disabled',
    'request_prompt_cache_in_memory',
    'request_tools_disabled',
    'request_inline_only',
    'request_conversation_state_disabled',
    'cleanup_within_seconds',
    'live_access_revoked_immediately',
    'physical_cleanup_scheduled',
    'resolution',
    'resolution_version',
    'retention_basis',
    'reference_count',
    'scan_complete',
    'local_bytes_state',
    'signed_url',
    'range_request',
    'range_start',
    'range_end',
  ]);
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => {
        if (!allowed.has(key) || !['string', 'number', 'boolean'].includes(typeof value)) return false;
        if (key === 'diagnostic_reference') {
          return (
            typeof value === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
          );
        }
        if (key === 'stage') return typeof value === 'string' && /^[a-z0-9_]{1,48}$/.test(value);
        if (key === 'code') return typeof value === 'string' && /^[a-z0-9_]{1,80}$/.test(value);
        if (key === 'processing_authority_attestation_source') {
          return value === REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE;
        }
        if (key === 'processing_authority_attestation_version') {
          return value === REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION;
        }
        if (key === 'processing_authority_confirmed') return value === true;
        if (key === 'resolution_version') return value === UPLOAD_DISPOSITION_RESOLUTION_VERSION;
        return true;
      })
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value]),
  );
}

function registeringTempName(storedName) {
  return `${storedName}${REGISTERING_TEMP_SUFFIX}`;
}

function providerBlockName(uploadId) {
  return `${uploadId}${PROVIDER_BLOCK_SUFFIX}`;
}

function removeRegularFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new UploadError(409, 'upload_integrity_failed', 'The uploaded file failed integrity validation.');
  }
  fs.rmSync(filePath);
  return true;
}

function classifyHistoricalManagedArtifact(name) {
  let match = HISTORICAL_PENDING_PATTERN.exec(name);
  if (match) {
    return {
      kind: 'predecessor-pending',
      uploadId: match[1],
      operationId: match[3],
      storedName: `${match[1]}.${match[2]}`,
    };
  }
  match = REGISTERING_ARTIFACT_PATTERN.exec(name);
  if (match) {
    return {
      kind: 'registering',
      uploadId: match[1],
      operationId: match[1],
      storedName: `${match[1]}.${match[2]}`,
    };
  }
  match = PROVIDER_BLOCK_ARTIFACT_PATTERN.exec(name);
  if (match) {
    return {
      kind: 'provider-block',
      uploadId: match[1],
      operationId: match[1],
      storedName: name,
    };
  }
  match = FINAL_MANAGED_ARTIFACT_PATTERN.exec(name);
  if (match) {
    return {
      kind: 'final',
      uploadId: match[1],
      operationId: match[1],
      storedName: name,
    };
  }
  return null;
}

function emptyHistoricalArtifactReconciliationResult() {
  return {
    examinedEntries: 0,
    managedCandidates: 0,
    removed: 0,
    removedPredecessorPending: 0,
    removedRegistering: 0,
    removedProviderBlocks: 0,
    rowlessFinalReviewRequired: 0,
    preservedFresh: 0,
    preservedRegistered: 0,
    preservedUnsafeType: 0,
    preservedNonemptyProviderBlock: 0,
    partial: 0,
    truncated: false,
  };
}

/**
 * Reconcile content-free historical upload artifacts without opening or
 * reading their contents. Only the uploads directory's immediate children are
 * considered and at most 10,000 entries are examined per pass.
 *
 * The predecessor's exact UUID.ext.pending-UUID files, current rowless
 * UUID.ext.registering files, and empty rowless UUID.provider-block markers
 * become deletion candidates only after 24 hours. A final UUID.ext object
 * without a registry association is never deleted automatically; it remains
 * inaccessible to routes and is represented only by an aggregate review
 * count. No returned field contains a filename, identifier, path, or content.
 */
export function reconcileHistoricalRowlessUploadArtifacts({ db, uploadsDir, now = new Date() }) {
  const result = emptyHistoricalArtifactReconciliationResult();
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) {
    result.partial += 1;
    return Object.freeze(result);
  }

  let findRegistryAssociation;
  try {
    findRegistryAssociation = db.prepare(`
      SELECT 1 AS present
      FROM upload_registry
      WHERE id IN (?, ?) OR stored_name IN (?, ?)
      LIMIT 1
    `);
  } catch {
    result.partial += 1;
    return Object.freeze(result);
  }

  let directory;
  try {
    directory = fs.opendirSync(uploadsDir);
  } catch {
    result.partial += 1;
    return Object.freeze(result);
  }

  try {
    while (result.examinedEntries < HISTORICAL_ARTIFACT_RECONCILIATION_MAX_ENTRIES) {
      const entry = directory.readSync();
      if (!entry) break;
      result.examinedEntries += 1;
      const artifact = classifyHistoricalManagedArtifact(entry.name);
      if (!artifact) continue;
      result.managedCandidates += 1;

      let filePath;
      let stat;
      try {
        filePath = canonicalUploadPath(uploadsDir, entry.name);
        stat = fs.lstatSync(filePath);
      } catch {
        result.partial += 1;
        continue;
      }
      if (!stat.isFile() || stat.isSymbolicLink()) {
        result.preservedUnsafeType += 1;
        continue;
      }

      let registered;
      try {
        registered = Boolean(
          findRegistryAssociation.get(
            artifact.uploadId,
            artifact.operationId,
            artifact.storedName,
            entry.name,
          )?.present,
        );
      } catch {
        result.partial += 1;
        continue;
      }
      if (registered) {
        result.preservedRegistered += 1;
        continue;
      }
      if (artifact.kind === 'final') {
        result.rowlessFinalReviewRequired += 1;
        continue;
      }

      const ageMs = nowMs - stat.mtimeMs;
      if (!Number.isFinite(ageMs) || ageMs < UPLOAD_POLICY.historicalArtifactReconciliationAgeMs) {
        result.preservedFresh += 1;
        continue;
      }
      if (artifact.kind === 'provider-block' && stat.size !== 0) {
        result.preservedNonemptyProviderBlock += 1;
        continue;
      }

      try {
        // Re-check immediately before unlinking. A changed or replaced path is
        // retained for the next pass/manual review instead of being acted on.
        const current = fs.lstatSync(filePath);
        if (
          !current.isFile() ||
          current.isSymbolicLink() ||
          current.dev !== stat.dev ||
          current.ino !== stat.ino ||
          current.size !== stat.size ||
          current.mtimeMs !== stat.mtimeMs
        ) {
          result.partial += 1;
          continue;
        }
        fs.unlinkSync(filePath);
        result.removed += 1;
        if (artifact.kind === 'predecessor-pending') result.removedPredecessorPending += 1;
        else if (artifact.kind === 'registering') result.removedRegistering += 1;
        else result.removedProviderBlocks += 1;
      } catch {
        result.partial += 1;
      }
    }
    if (result.examinedEntries === HISTORICAL_ARTIFACT_RECONCILIATION_MAX_ENTRIES) {
      result.truncated = Boolean(directory.readSync());
    }
  } catch {
    result.partial += 1;
  } finally {
    try { directory.closeSync(); } catch { result.partial += 1; }
  }

  return Object.freeze(result);
}

export function createUploadRegistry(db, { uploadsDir }) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  function getById(id) {
    return mapUpload(db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(id));
  }

  function getByStoredName(storedName) {
    return mapUpload(db.prepare('SELECT * FROM upload_registry WHERE stored_name = ?').get(storedName));
  }

  function hasReferralProcessingAuthority(id) {
    const upload = getById(id);
    if (!upload || upload.purpose !== 'referral-extraction') return false;
    const row = db.prepare(`
      SELECT actor_user_id, metadata_json
      FROM upload_audit
      WHERE upload_id = ? AND org_id = ?
        AND event_type = 'upload_registered' AND outcome = 'success'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(upload.id, upload.orgId);
    if (!row || row.actor_user_id !== upload.uploaderUserId) return false;
    let metadata;
    try {
      metadata = JSON.parse(row.metadata_json);
    } catch {
      return false;
    }
    return (
      metadata?.processing_authority_confirmed === true &&
      metadata?.processing_authority_attestation_source ===
        REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE &&
      metadata?.processing_authority_attestation_version ===
        REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION
    );
  }

  function assertStoredActiveAdmin(actorUserId) {
    const userRow = db.prepare('SELECT data FROM entity_User WHERE id = ?').get(actorUserId);
    let storedUser;
    try {
      storedUser = userRow ? JSON.parse(userRow.data) : null;
    } catch {
      storedUser = null;
    }
    if (storedUser?.role !== 'admin' || storedUser?.account_status !== 'active') {
      throw new UploadError(403, 'upload_disposition_admin_required', 'Administrator access is required.');
    }
  }

  function getUploadDispositionReport({ actorUserId, orgId = null, now = new Date() }) {
    assertStoredActiveAdmin(actorUserId);
    if (orgId !== null && (typeof orgId !== 'string' || orgId.length === 0 || orgId.length > 120)) {
      throw new UploadError(400, 'invalid_disposition_org', 'Select a valid organisation filter.');
    }
    return inspectUploadDispositions({ db, uploadsDir, now, orgId });
  }

  function audit({ uploadId = null, orgId, actorUserId, eventType, outcome, metadata = {}, now = new Date() }) {
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(new Date(now).getTime() + UPLOAD_POLICY.auditRetentionMs).toISOString();
    db.prepare(`
      INSERT INTO upload_audit
        (id, upload_id, org_id, actor_user_id, event_type, outcome, metadata_json, created_at, expires_at, legal_hold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      uploadId,
      orgId,
      actorUserId,
      eventType,
      outcome,
      JSON.stringify(safeAuditMetadata(metadata)),
      createdAt,
      expiresAt,
      process.env.UPLOAD_AUDIT_LEGAL_HOLD === '1' ? 1 : 0,
    );
  }

  function registrationAuditMetadata({ inspected, purpose, subjectAgeBand, subjectAgeAttestationVersion,
    processingAuthorityAttestationVersion }) {
    return {
      byte_size: inspected.byteSize,
      detected_mime: inspected.detectedMime,
      purpose,
      ...(purpose === 'referral-extraction'
        ? {
            subject_age_attestation_source: REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE,
            subject_age_attestation_version: subjectAgeAttestationVersion,
            subject_age_band: subjectAgeBand,
            processing_authority_attestation_source: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
            processing_authority_attestation_version: processingAuthorityAttestationVersion,
            processing_authority_confirmed: true,
          }
        : {}),
    };
  }

  function providerBlockPath(uploadId) {
    return canonicalUploadPath(uploadsDir, providerBlockName(uploadId));
  }

  function establishProviderBlock(id) {
    const current = getById(id);
    if (!current) throw new UploadError(404, 'upload_not_found', 'File not found.');
    // This process refuses retries even if both durable quarantine channels
    // report an I/O error before the controlled response is returned.
    TRANSIENT_PROVIDER_BLOCKS.add(current.id);
    const markerPath = providerBlockPath(current.id);
    try {
      fs.writeFileSync(markerPath, Buffer.alloc(0), { flag: 'wx', mode: 0o600, flush: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const stat = fs.lstatSync(markerPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== 0) {
        throw new UploadError(409, 'upload_integrity_failed', 'The uploaded file failed integrity validation.');
      }
    }
    return markerPath;
  }

  function isProviderBlocked(id) {
    const current = getById(id);
    if (!current) return true;
    if (TRANSIENT_PROVIDER_BLOCKS.has(current.id)) return true;
    if (current.subjectAgeBand === 'under_13') return true;
    let markerPath;
    try {
      markerPath = providerBlockPath(current.id);
    } catch {
      return true;
    }
    if (!fs.existsSync(markerPath)) return false;
    try {
      fs.lstatSync(markerPath);
      // Any object at this path blocks provider egress. The expected marker is
      // an empty regular file; an unexpected object also fails closed.
      return true;
    } catch {
      return true;
    }
  }

  function removeProviderBlock(id) {
    const markerPath = providerBlockPath(id);
    removeRegularFileIfPresent(markerPath);
    TRANSIENT_PROVIDER_BLOCKS.delete(id);
  }

  function reconcileInterruptedRegistrations({ now = new Date() } = {}) {
    const rows = db.prepare(`
      SELECT * FROM upload_registry
      WHERE lifecycle_state = 'registering' AND is_legacy = 0
      ORDER BY created_at ASC
    `).all();
    const result = { examined: rows.length, removed: 0, partial: 0 };
    for (const row of rows) {
      const finalPath = canonicalUploadPath(uploadsDir, row.stored_name);
      const tempPath = canonicalUploadPath(uploadsDir, registeringTempName(row.stored_name));
      try {
        removeRegularFileIfPresent(tempPath);
        removeRegularFileIfPresent(finalPath);
        removeProviderBlock(row.id);
      } catch {
        // Leave the durable registering row in its fail-closed state. The next
        // maintenance pass retries without exposing the bytes through an API.
        result.partial += 1;
        continue;
      }
      const nowIso = new Date(now).toISOString();
      let transactionStarted = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        transactionStarted = true;
        const changed = db.prepare(`
          UPDATE upload_registry
          SET lifecycle_state = 'deleted', deleted_at = ?, expires_at = ?, original_name = '[deleted]'
          WHERE id = ? AND lifecycle_state = 'registering' AND is_legacy = 0
        `).run(nowIso, nowIso, row.id);
        if (Number(changed.changes) === 1) {
          audit({
            uploadId: row.id,
            orgId: row.org_id,
            actorUserId: 'system:startup-reconciliation',
            eventType: 'upload_registration_reconciled',
            outcome: 'removed',
            metadata: { state_from: 'registering', state_to: 'deleted' },
            now,
          });
          result.removed += 1;
        }
        db.exec('COMMIT');
        transactionStarted = false;
      } catch {
        if (transactionStarted) {
          try { db.exec('ROLLBACK'); } catch { /* retry on the next maintenance pass */ }
        }
        result.partial += 1;
      }
    }
    result.historicalArtifacts = reconcileHistoricalRowlessUploadArtifacts({ db, uploadsDir, now });
    return result;
  }

  function assertUploadQuota({ uploaderUserId, orgId, byteSize, now = new Date() }) {
    const minuteAgo = new Date(new Date(now).getTime() - 60 * 1000).toISOString();
    const dayAgo = new Date(new Date(now).getTime() - DAY_MS).toISOString();
    const userMinute = Number(
      db.prepare('SELECT COUNT(*) AS n FROM upload_registry WHERE uploader_user_id = ? AND created_at >= ?')
        .get(uploaderUserId, minuteAgo)?.n || 0,
    );
    const orgMinute = Number(
      db.prepare('SELECT COUNT(*) AS n FROM upload_registry WHERE org_id = ? AND created_at >= ?')
        .get(orgId, minuteAgo)?.n || 0,
    );
    const userDaily = Number(
      db.prepare('SELECT COALESCE(SUM(byte_size), 0) AS n FROM upload_registry WHERE uploader_user_id = ? AND created_at >= ?')
        .get(uploaderUserId, dayAgo)?.n || 0,
    );
    const orgDaily = Number(
      db.prepare('SELECT COALESCE(SUM(byte_size), 0) AS n FROM upload_registry WHERE org_id = ? AND created_at >= ?')
        .get(orgId, dayAgo)?.n || 0,
    );
    const globalLive = Number(
      db.prepare(`
        SELECT COALESCE(SUM(byte_size), 0) AS n
        FROM upload_registry
        WHERE lifecycle_state != 'deleted'
          AND (lifecycle_state != 'expired' OR bound_entity_id IS NOT NULL)
      `)
        .get()?.n || 0,
    );
    if (
      userMinute >= UPLOAD_POLICY.uploadUserPerMinute ||
      orgMinute >= UPLOAD_POLICY.uploadOrgPerMinute ||
      userDaily + byteSize > UPLOAD_POLICY.uploadUserDailyBytes ||
      orgDaily + byteSize > UPLOAD_POLICY.uploadOrgDailyBytes ||
      globalLive + byteSize > UPLOAD_POLICY.globalLiveBytes
    ) {
      throw new UploadError(429, 'upload_limit_reached', 'Upload limit reached. Please try again later.');
    }
  }

  function register({
    buffer,
    originalName,
    declaredMime,
    orgId,
    uploaderUserId,
    purpose,
    subjectAgeBand = 'unknown',
    subjectAgeAttestationVersion = null,
    processingAuthorityConfirmed = null,
    processingAuthorityAttestationVersion = null,
    now = new Date(),
  }) {
    if (!['unknown', 'under_13', '13_or_over'].includes(subjectAgeBand)) {
      throw new UploadError(400, 'invalid_age_band', 'The subject age category is invalid.');
    }
    if (purpose === 'referral-extraction') {
      if (
        subjectAgeBand !== REFERRAL_SUBJECT_AGE_CONFIRMATION ||
        subjectAgeAttestationVersion !== REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION ||
        processingAuthorityConfirmed !== true ||
        processingAuthorityAttestationVersion !== REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION
      ) {
        throw new UploadError(
          400,
          'invalid_referral_authority_provenance',
          'The referral processing authority is invalid.',
        );
      }
    } else if (
      subjectAgeAttestationVersion !== null ||
      processingAuthorityConfirmed !== null ||
      processingAuthorityAttestationVersion !== null
    ) {
      throw new UploadError(
        400,
        'referral_authority_not_applicable',
        'Referral authority is not accepted for this upload purpose.',
      );
    }
    const inspected = inspectUpload({ buffer, originalName, declaredMime, purpose });
    assertUploadQuota({ uploaderUserId, orgId, byteSize: inspected.byteSize, now });
    const id = randomUUID();
    const storedName = `${id}${inspected.extension}`;
    const finalPath = canonicalUploadPath(uploadsDir, storedName);
    const tempName = registeringTempName(storedName);
    const tempPath = canonicalUploadPath(uploadsDir, tempName);
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(new Date(now).getTime() + UPLOAD_POLICY.referralTtlMs).toISOString();
    let transactionStarted = false;
    try {
      // The registry row and exact action-bound authority receipt are durable
      // before the first byte reaches the upload volume. A crash at any later
      // point leaves a deterministic, fail-closed object for startup recovery.
      db.exec('BEGIN IMMEDIATE');
      transactionStarted = true;
      db.prepare(`
        INSERT INTO upload_registry (
          id, stored_name, original_name, org_id, uploader_user_id, purpose,
          detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
          created_at, expires_at, is_legacy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'registering', ?, ?, ?, 0)
      `).run(
        id,
        storedName,
        inspected.originalName,
        orgId,
        uploaderUserId,
        purpose,
        inspected.detectedMime,
        inspected.byteSize,
        inspected.sha256,
        subjectAgeBand,
        createdAt,
        expiresAt,
      );
      audit({
        uploadId: id,
        orgId,
        actorUserId: uploaderUserId,
        eventType: 'upload_registration_reserved',
        outcome: 'success',
        metadata: registrationAuditMetadata({
          inspected,
          purpose,
          subjectAgeBand,
          subjectAgeAttestationVersion,
          processingAuthorityAttestationVersion,
        }),
        now,
      });
      db.exec('COMMIT');
      transactionStarted = false;

      fs.writeFileSync(tempPath, buffer, { flag: 'wx', mode: 0o600, flush: true });
      fs.renameSync(tempPath, finalPath);
      db.exec('BEGIN IMMEDIATE');
      transactionStarted = true;
      const activated = db.prepare(`
        UPDATE upload_registry
        SET lifecycle_state = 'temporary'
        WHERE id = ? AND lifecycle_state = 'registering'
      `).run(id);
      if (Number(activated.changes) !== 1) {
        throw new UploadError(409, 'invalid_upload_state', 'The file cannot be moved to that state.');
      }
      audit({
        uploadId: id,
        orgId,
        actorUserId: uploaderUserId,
        eventType: 'upload_registered',
        outcome: 'success',
        metadata: registrationAuditMetadata({
          inspected,
          purpose,
          subjectAgeBand,
          subjectAgeAttestationVersion,
          processingAuthorityAttestationVersion,
        }),
        now,
      });
      db.exec('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try { db.exec('ROLLBACK'); } catch { /* preserve the primary failure */ }
        transactionStarted = false;
      }
      try {
        removeRegularFileIfPresent(tempPath);
        removeRegularFileIfPresent(finalPath);
        removeProviderBlock(id);
        const reserved = getById(id);
        if (reserved?.state === 'registering') {
          const failedAt = new Date().toISOString();
          db.exec('BEGIN IMMEDIATE');
          transactionStarted = true;
          db.prepare(`
            UPDATE upload_registry
            SET lifecycle_state = 'deleted', deleted_at = ?, expires_at = ?, original_name = '[deleted]'
            WHERE id = ? AND lifecycle_state = 'registering'
          `).run(failedAt, failedAt, id);
          audit({
            uploadId: id,
            orgId,
            actorUserId: uploaderUserId,
            eventType: 'upload_registration_failed',
            outcome: 'removed',
            metadata: { state_from: 'registering', state_to: 'deleted' },
          });
          db.exec('COMMIT');
          transactionStarted = false;
        }
      } catch {
        if (transactionStarted) {
          try { db.exec('ROLLBACK'); } catch { /* startup reconciliation retries */ }
          transactionStarted = false;
        }
        // Cleanup failure is intentionally not allowed to hide the primary
        // registration failure. The durable `registering` row remains denied
        // and is retried by startup/lifecycle reconciliation.
      }
      throw error;
    }
    return getById(id);
  }

  function registerLegacy({
    storedName,
    originalName,
    orgId,
    uploaderUserId,
    purpose,
    boundEntityType,
    boundEntityId,
    subjectAgeBand = 'unknown',
    now = new Date(),
  }) {
    const existing = getByStoredName(storedName);
    if (existing) return existing;
    const filePath = canonicalUploadPath(uploadsDir, storedName, { mustExist: true });
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > UPLOAD_POLICY.maxFileBytes) {
      throw new UploadError(404, 'legacy_upload_unavailable', 'File not found.');
    }
    const buffer = fs.readFileSync(filePath);
    let inspected;
    try {
      inspected = inspectUpload({
        buffer,
        originalName: originalName || storedName,
        declaredMime: '',
        purpose,
      });
    } catch (error) {
      if (!(error instanceof UploadError)) throw error;
      const extension = path.extname(storedName).toLowerCase();
      inspected = {
        originalName: safeOriginalName(originalName || storedName),
        extension: extension && extension.length <= 10 ? extension : '',
        // A legacy file that fails current signature validation remains
        // downloadable for an owner who can prove its exact durable
        // reference, but is intentionally isolated from provider egress.
        detectedMime: 'application/octet-stream',
        byteSize: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      };
    }
    const id = randomUUID();
    const timestamp = new Date(now).toISOString();
    try {
      db.prepare(`
        INSERT INTO upload_registry (
          id, stored_name, original_name, org_id, uploader_user_id, purpose,
          detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
          created_at, expires_at, bound_at, bound_entity_type, bound_entity_id, is_legacy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bound', ?, ?, NULL, ?, ?, ?, 1)
      `).run(
        id,
        storedName,
        inspected.originalName,
        orgId,
        uploaderUserId,
        purpose,
        inspected.detectedMime,
        inspected.byteSize,
        inspected.sha256,
        subjectAgeBand,
        timestamp,
        timestamp,
        boundEntityType,
        boundEntityId,
      );
    } catch (error) {
      const raced = getByStoredName(storedName);
      if (raced) return raced;
      throw error;
    }
    audit({
      uploadId: id,
      orgId,
      actorUserId: uploaderUserId,
      eventType: 'legacy_upload_registered',
      outcome: 'success',
      metadata: { purpose, byte_size: inspected.byteSize, detected_mime: inspected.detectedMime },
      now,
    });
    return getById(id);
  }

  function transition(id, state, { actorUserId, failure = false, now = new Date() } = {}) {
    const current = getById(id);
    if (!current) throw new UploadError(404, 'upload_not_found', 'File not found.');
    if (!['temporary', 'processing', 'review-pending', 'expired', 'deleted'].includes(state)) {
      throw new UploadError(409, 'invalid_upload_state', 'The file cannot be moved to that state.');
    }
    if (current.state === 'bound' || current.isLegacy) {
      throw new UploadError(409, 'bound_upload_immutable', 'The retained file cannot be changed by temporary-file lifecycle.');
    }
    if (current.state === 'registering') {
      throw new UploadError(409, 'invalid_upload_state', 'The file cannot be moved to that state.');
    }
    if (current.state === 'deleted') return current;
    const nowDate = new Date(now);
    const failureExpiry = new Date(nowDate.getTime() + UPLOAD_POLICY.failureCleanupMs).toISOString();
    let expiry = current.expiresAt;
    if (state === 'processing' || failure) {
      expiry = !expiry || failureExpiry < expiry ? failureExpiry : expiry;
    } else if (state === 'review-pending') {
      const createdMs = Date.parse(current.createdAt);
      if (Number.isFinite(createdMs)) {
        // Successful extraction restores only the unelapsed portion of the
        // original reviewed ceiling; repeated attempts never extend it.
        expiry = new Date(createdMs + UPLOAD_POLICY.referralTtlMs).toISOString();
      }
    }
    db.prepare(`
      UPDATE upload_registry
      SET lifecycle_state = ?, expires_at = ?, deleted_at = CASE WHEN ? = 'deleted' THEN ? ELSE deleted_at END
      WHERE id = ?
    `).run(state, expiry, state, nowDate.toISOString(), id);
    audit({
      uploadId: id,
      orgId: current.orgId,
      actorUserId: actorUserId || current.uploaderUserId,
      eventType: 'upload_state_changed',
      outcome: 'success',
      metadata: { state_from: current.state, state_to: state },
      now,
    });
    return getById(id);
  }

  function cancelTemporary(id, { actorUserId, now = new Date() } = {}) {
    const current = getById(id);
    if (!current || current.isLegacy || current.state === 'bound') {
      throw new UploadError(409, 'upload_not_temporary', 'A retained file cannot be cancelled.');
    }
    if (!actorUserId || current.uploaderUserId !== actorUserId) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    if (current.state === 'deleted') return current;
    const references = scanActiveUploadReferences(db, current);
    if (!references.complete || references.referenceCount > 0) {
      throw new UploadError(
        409,
        'upload_reference_present',
        'A file referenced by a clinical record cannot be cancelled.',
      );
    }
    const nowIso = new Date(now).toISOString();
    const filePath = canonicalUploadPath(uploadsDir, current.storedName);
    removeRegularFileIfPresent(filePath);
    removeProviderBlock(id);
    db.prepare(`
      UPDATE upload_registry
      SET lifecycle_state = 'deleted', deleted_at = ?, expires_at = ?, original_name = '[deleted]'
      WHERE id = ? AND is_legacy = 0 AND bound_at IS NULL
    `).run(nowIso, nowIso, id);
    audit({
      uploadId: id,
      orgId: current.orgId,
      actorUserId,
      eventType: 'temporary_upload_cancelled',
      outcome: 'removed',
      metadata: { state_from: current.state, state_to: 'deleted', cleanup_within_seconds: 0 },
      now,
    });
    return getById(id);
  }

  /**
   * A provider-returned DOB can contradict the action-bound 13+ attestation.
   * Persist only the categorical mismatch, block future provider retries and
   * make unbound live bytes immediately eligible for the minute cleanup job.
   * Bound/legacy clinical records remain retained and become provider-gated.
   */
  function quarantineExtractedUnder13(
    id,
    { actorUserId, now = new Date(), source = 'extracted' } = {},
  ) {
    const reviewedSource = source === 'reviewed';
    const initial = getById(id);
    if (!initial) throw new UploadError(404, 'upload_not_found', 'File not found.');
    // Deleted rows have neither provider eligibility nor live bytes. Avoid
    // creating a marker that would outlive the terminal registry record.
    if (initial.state === 'deleted') return initial;
    // The zero-byte marker is a separate durable no-retry control. It is
    // established before SQLite quarantine so a database abort cannot make
    // the same sensitive file eligible for another provider call.
    let markerError = null;
    try {
      establishProviderBlock(id);
    } catch (error) {
      // SQLite quarantine remains an independent fail-closed path. If it
      // succeeds, subject_age_band itself blocks provider reuse; if it also
      // fails, the database error below is surfaced to the controlled caller.
      markerError = error;
    }
    let transactionStarted = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      transactionStarted = true;
      const current = getById(id);
      if (!current || current.state === 'deleted') {
        db.exec('COMMIT');
        transactionStarted = false;
        return current;
      }
      const nowIso = new Date(now).toISOString();
      const removable = !current.isLegacy && current.state !== 'bound' && current.boundAt === null;
      db.prepare(`
        UPDATE upload_registry
        SET subject_age_band = 'under_13',
            lifecycle_state = CASE WHEN ? = 1 THEN 'expired' ELSE lifecycle_state END,
            expires_at = CASE WHEN ? = 1 THEN ? ELSE expires_at END
        WHERE id = ? AND lifecycle_state != 'deleted'
      `).run(removable ? 1 : 0, removable ? 1 : 0, nowIso, id);
      audit({
        uploadId: id,
        orgId: current.orgId,
        actorUserId: actorUserId || current.uploaderUserId,
        eventType: reviewedSource ? 'referral_review_age_gate' : 'post_extraction_age_gate',
        outcome: 'blocked',
        metadata: {
           code: reviewedSource ? 'reviewed_subject_under_13' : 'extracted_subject_under_13',
           state_from: current.state,
           state_to: removable ? 'expired' : current.state,
           live_access_revoked_immediately: removable,
           physical_cleanup_scheduled: removable,
         },
        now,
      });
      db.exec('COMMIT');
      transactionStarted = false;
      return getById(id);
    } catch (error) {
      if (transactionStarted) {
        try { db.exec('ROLLBACK'); } catch { /* preserve the primary failure */ }
      }
      throw markerError || error;
    }
  }

  /**
   * Quarantine every upload associated with a final reviewed DOB that is
   * under 13 before the referral commit transaction begins. Each upload gets
   * its own durable marker/database attempt so one fault cannot prevent later
   * uploads in the same referral from being made provider-ineligible.
   */
  function quarantineReviewedUnder13(ids, { actorUserId, now = new Date() } = {}) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > UPLOAD_POLICY.maxFilesPerExtraction) {
      throw new UploadError(400, 'invalid_upload_selection', 'Select the referral files to quarantine.');
    }
    if (typeof actorUserId !== 'string' || actorUserId.length === 0 || actorUserId.length > 200) {
      throw new UploadError(400, 'invalid_quarantine_actor', 'The referral quarantine actor is invalid.');
    }
    const quarantineTime = new Date(now);
    if (!Number.isFinite(quarantineTime.getTime())) {
      throw new UploadError(400, 'invalid_quarantine_time', 'The referral quarantine time is invalid.');
    }

    const uniqueIds = [...new Set(ids)];
    const failures = [];
    let quarantined = 0;
    let alreadyTerminal = 0;
    for (const id of uniqueIds) {
      if (
        typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ) {
        failures.push(new UploadError(404, 'upload_not_found', 'File not found.'));
        continue;
      }
      try {
        const result = quarantineExtractedUnder13(id, {
          actorUserId,
          now: quarantineTime,
          source: 'reviewed',
        });
        if (!result) {
          throw new UploadError(404, 'upload_not_found', 'File not found.');
        }
        if (result.state === 'deleted') alreadyTerminal += 1;
        else if (result.subjectAgeBand === 'under_13') quarantined += 1;
        else {
          throw new UploadError(
            503,
            'upload_quarantine_incomplete',
            'The referral could not be quarantined safely.',
          );
        }
      } catch (error) {
        failures.push(error);
      }
    }

    const result = Object.freeze({
      attempted: uniqueIds.length,
      quarantined,
      alreadyTerminal,
      failed: failures.length,
    });
    if (failures.length > 0) {
      const error = new UploadError(
        503,
        'upload_quarantine_incomplete',
        'The referral could not be quarantined safely.',
      );
      // Counts are content-free diagnostics. Causes are deliberately
      // non-enumerable so route serializers and structured logs cannot expose
      // internal paths or database details.
      Object.defineProperties(error, {
        quarantineResult: { value: result, enumerable: false },
        cause: {
          value: new AggregateError(failures, 'One or more referral uploads could not be quarantined.'),
          enumerable: false,
        },
      });
      throw error;
    }
    return result;
  }

  function bind(id, { orgId, actorUserId, entityType, entityId, now = new Date() }) {
    const current = getById(id);
    if (!current || current.orgId !== orgId || ['registering', 'deleted', 'expired'].includes(current.state)) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    if (current.state === 'bound') {
      if (current.boundEntityType === entityType && current.boundEntityId === entityId) return current;
      throw new UploadError(409, 'upload_already_bound', 'The file is already retained with another record.');
    }
    if (!current.isLegacy && current.uploaderUserId !== actorUserId) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    const timestamp = new Date(now).toISOString();
    db.prepare(`
      UPDATE upload_registry
      SET lifecycle_state = 'bound', expires_at = NULL, bound_at = ?,
          bound_entity_type = ?, bound_entity_id = ?
      WHERE id = ?
    `).run(timestamp, entityType, entityId, id);
    audit({
      uploadId: id,
      orgId,
      actorUserId,
      eventType: 'upload_bound',
      outcome: 'success',
      metadata: { state_from: current.state, state_to: 'bound' },
      now,
    });
    return getById(id);
  }

  /**
   * Revoke ordinary delivery when a durable record no longer refers to a
   * bound upload (or is deleted), while preserving the object behind its
   * registry tombstone for the applicable clinical-record period or hold.
   * `expired` is reused as the existing fail-closed isolated state; bound
   * references deliberately keep these bytes outside temporary cleanup.
   */
  function retireBoundForEntity({
    entityType,
    entityId,
    actorUserId,
    retainedUploadIds = [],
    now = new Date(),
  }) {
    const retained = new Set(retainedUploadIds.map((id) => String(id).toLowerCase()));
    const rows = db.prepare(`
      SELECT * FROM upload_registry
      WHERE bound_entity_type = ? AND bound_entity_id = ? AND lifecycle_state = 'bound'
      ORDER BY created_at ASC
    `).all(entityType, entityId);
    let isolated = 0;
    if (rows.length === 0) return { isolated };
    let transactionStarted = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      transactionStarted = true;
      for (const row of rows) {
        if (retained.has(String(row.id).toLowerCase())) continue;
        const recordedAt = new Date(now).toISOString();
        const reviewDueAt = new Date(new Date(now).getTime() + UPLOAD_POLICY.dispositionReviewMs).toISOString();
        db.prepare(`
          UPDATE upload_registry
          SET lifecycle_state = 'expired', expires_at = NULL
          WHERE id = ? AND lifecycle_state = 'bound'
        `).run(row.id);
        db.prepare(`
          INSERT INTO upload_disposition (
            upload_id, org_id, status, reason_code, planned_action,
            review_due_at, recorded_at, updated_at
          ) VALUES (?, ?, 'review-required', 'source_record_reference_removed',
                    'determine-lawful-retention-transfer-or-deletion', ?, ?, ?)
          ON CONFLICT(upload_id) DO UPDATE SET
            org_id = excluded.org_id,
            status = excluded.status,
            reason_code = excluded.reason_code,
            planned_action = excluded.planned_action,
            review_due_at = excluded.review_due_at,
            updated_at = excluded.updated_at
        `).run(row.id, row.org_id, reviewDueAt, recordedAt, recordedAt);
        audit({
          uploadId: row.id,
          orgId: row.org_id,
          actorUserId: actorUserId || 'system:entity-lifecycle',
          eventType: 'bound_upload_isolated',
          outcome: 'retained',
          metadata: { state_from: 'bound', state_to: 'expired', code: 'source_record_reference_removed' },
          now,
        });
        isolated += 1;
      }
      db.exec('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try { db.exec('ROLLBACK'); } catch { /* preserve the primary failure */ }
      }
      throw error;
    }
    return { isolated };
  }

  /**
   * Resolve the safe branch of an upload-disposition decision. The application
   * has no independently verifiable clinical-record transfer destination and
   * cannot make filesystem deletion atomic with SQLite, so transfer/delete
   * requests are deliberately refused. An authenticated, database-verified
   * administrator can record a bounded retention basis and next review date.
   */
  function resolveUploadDisposition({
    uploadId,
    orgId,
    actorUserId,
    resolution,
    resolutionVersion,
    retentionBasis,
    expectedUpdatedAt,
    now = new Date(),
  }) {
    assertStoredActiveAdmin(actorUserId);
    if (
      typeof uploadId !== 'string' || uploadId.length === 0 || uploadId.length > 120 ||
      typeof orgId !== 'string' || orgId.length === 0 || orgId.length > 120
    ) {
      throw new UploadError(400, 'invalid_disposition_reference', 'Select a valid upload disposition.');
    }
    if (resolutionVersion !== UPLOAD_DISPOSITION_RESOLUTION_VERSION) {
      throw new UploadError(400, 'invalid_disposition_resolution_version', 'Refresh AssessSuite before resolving this upload.');
    }
    if (!['retain', 'transfer', 'delete'].includes(resolution)) {
      throw new UploadError(400, 'invalid_disposition_resolution', 'Select a supported upload resolution.');
    }
    if (resolution !== 'retain') {
      throw new UploadError(
        409,
        'upload_disposition_external_proof_required',
        'Transfer or deletion requires independently verified completion outside this resolver.',
      );
    }
    if (!UPLOAD_DISPOSITION_RETENTION_BASES.has(retentionBasis)) {
      throw new UploadError(400, 'invalid_disposition_retention_basis', 'Select a supported retention basis.');
    }
    if (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      throw new UploadError(400, 'invalid_disposition_revision', 'Refresh the disposition report before resolving this upload.');
    }
    const disposition = db.prepare(`
      SELECT * FROM upload_disposition
      WHERE upload_id = ? AND org_id = ?
    `).get(uploadId, orgId);
    if (!disposition) {
      throw new UploadError(404, 'upload_disposition_not_found', 'Upload disposition not found.');
    }
    if (disposition.updated_at !== expectedUpdatedAt) {
      throw new UploadError(409, 'upload_disposition_changed', 'Refresh the disposition report before resolving this upload.');
    }
    const upload = getById(uploadId);
    if (!upload || upload.orgId !== orgId || upload.state === 'deleted') {
      throw new UploadError(409, 'upload_disposition_partial', 'The upload disposition cannot be resolved from current records.');
    }
    const inspection = inspectUploadDispositions({ db, uploadsDir, now, orgId, uploadId });
    const residual = inspection.rows[0];
    if (!residual) {
      throw new UploadError(409, 'upload_disposition_partial', 'The upload disposition cannot be resolved from current records.');
    }

    const nowDate = new Date(now);
    const priorUpdatedMs = Date.parse(disposition.updated_at);
    if (Number.isNaN(nowDate.getTime()) || !Number.isFinite(priorUpdatedMs)) {
      throw new UploadError(400, 'invalid_disposition_revision', 'Refresh the disposition report before resolving this upload.');
    }
    const monotonicNow = new Date(
      Math.max(nowDate.getTime(), priorUpdatedMs + 1),
    );
    const updatedAt = monotonicNow.toISOString();
    const reviewDueAt = new Date(
      monotonicNow.getTime() + UPLOAD_POLICY.dispositionRetentionReviewMs,
    ).toISOString();
    let transactionStarted = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      transactionStarted = true;
      const updated = db.prepare(`
        UPDATE upload_disposition
        SET status = 'retained', planned_action = 'reassess-lawful-retention',
            review_due_at = ?, updated_at = ?
        WHERE upload_id = ? AND org_id = ? AND updated_at = ?
      `).run(reviewDueAt, updatedAt, uploadId, orgId, expectedUpdatedAt);
      if (Number(updated.changes) !== 1) {
        throw new UploadError(409, 'upload_disposition_changed', 'Refresh the disposition report before resolving this upload.');
      }
      audit({
        uploadId,
        orgId,
        actorUserId,
        eventType: 'upload_disposition_resolved',
        outcome: 'retained',
        metadata: {
          resolution: 'retain',
          resolution_version: resolutionVersion,
          retention_basis: retentionBasis,
          reference_count: residual.referenceCount,
          scan_complete: residual.scanComplete,
          local_bytes_state: residual.localBytesState,
        },
        now: monotonicNow,
      });
      db.exec('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try { db.exec('ROLLBACK'); } catch { /* preserve the controlled failure */ }
      }
      throw error;
    }
    return inspectUploadDispositions({ db, uploadsDir, now: monotonicNow, orgId, uploadId });
  }

  function reserveExtractionUsage({ userId, orgId, uploadCount, now = new Date() }) {
    const nowDate = new Date(now);
    const minuteAgo = new Date(nowDate.getTime() - 60 * 1000).toISOString();
    const dayAgo = new Date(nowDate.getTime() - DAY_MS).toISOString();
    const monthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString();
    const estimated = uploadCount * UPLOAD_POLICY.estimatedCostPerDocumentMicrousd;
    const aggregate = (where, params, since) =>
      db.prepare(`
        SELECT COUNT(*) AS requests,
               COALESCE(SUM(upload_count), 0) AS documents,
               COALESCE(SUM(
                 CASE
                   WHEN status = 'succeeded' AND actual_cost_microusd IS NOT NULL THEN actual_cost_microusd
                   ELSE estimated_cost_microusd
                 END
               ), 0) AS cost
        FROM extraction_usage
        WHERE ${where} AND created_at >= ?
      `).get(...params, since);
    const userMinute = aggregate('user_id = ?', [userId], minuteAgo);
    const orgMinute = aggregate('org_id = ?', [orgId], minuteAgo);
    const userDaily = aggregate('user_id = ?', [userId], dayAgo);
    const orgDaily = aggregate('org_id = ?', [orgId], dayAgo);
    const monthly = aggregate('1 = 1', [], monthStart);

    const limited =
      Number(userMinute.requests) >= UPLOAD_POLICY.extractionUserPerMinute ||
      Number(orgMinute.requests) >= UPLOAD_POLICY.extractionOrgPerMinute ||
      Number(userDaily.documents) + uploadCount > UPLOAD_POLICY.extractionUserDailyDocuments ||
      Number(orgDaily.documents) + uploadCount > UPLOAD_POLICY.extractionOrgDailyDocuments ||
      Number(userDaily.cost) + estimated > UPLOAD_POLICY.extractionUserDailyCostMicrousd ||
      Number(orgDaily.cost) + estimated > UPLOAD_POLICY.extractionOrgDailyCostMicrousd ||
      Number(monthly.cost) + estimated > UPLOAD_POLICY.extractionMonthlyCircuitMicrousd;
    if (limited) {
      throw new UploadError(429, 'extraction_limit_reached', 'Document extraction limit reached. Please try again later.');
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO extraction_usage
        (id, user_id, org_id, upload_count, estimated_cost_microusd, actual_cost_microusd, status, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, NULL, 'reserved', ?, NULL)
    `).run(id, userId, orgId, uploadCount, estimated, nowDate.toISOString());
    return { id, estimatedCostMicrousd: estimated };
  }

  function completeExtractionUsage(id, { succeeded, actualCostMicrousd = null, now = new Date() }) {
    db.prepare(`
      UPDATE extraction_usage
      SET status = ?, actual_cost_microusd = ?, completed_at = ?
      WHERE id = ? AND status = 'reserved'
    `).run(succeeded ? 'succeeded' : 'failed', actualCostMicrousd, new Date(now).toISOString(), id);
  }

  // Startup reconciliation runs before the registry is exposed to any route.
  // A scheduled caller may invoke the same idempotent operation later if a
  // runtime filesystem fault left a row in the denied registering state.
  reconcileInterruptedRegistrations();

  return {
    getById,
    getByStoredName,
    hasReferralProcessingAuthority,
    getUploadDispositionReport,
    register,
    registerLegacy,
    transition,
    bind,
    retireBoundForEntity,
    audit,
    cancelTemporary,
    quarantineExtractedUnder13,
    quarantineReviewedUnder13,
    isProviderBlocked,
    reconcileInterruptedRegistrations,
    reconcileHistoricalRowlessUploadArtifacts: ({ now = new Date() } = {}) =>
      reconcileHistoricalRowlessUploadArtifacts({ db, uploadsDir, now }),
    resolveUploadDisposition,
    reserveExtractionUsage,
    completeExtractionUsage,
  };
}

export function extractUploadIdsFromValue(value) {
  const ids = new Set();
  const visit = (current, depth) => {
    if (depth > 12) {
      throw new UploadError(400, 'upload_reference_structure_too_complex', 'The file-reference structure is too complex.');
    }
    if (current === null || current === undefined) return;
    if (typeof current === 'string') {
      const re = /\/(?:uploads|api\/files)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:$|[?#/])/gi;
      for (const match of current.matchAll(re)) ids.add(match[1].toLowerCase());
      return;
    }
    if (Array.isArray(current)) {
      if (current.length > 1000) {
        throw new UploadError(400, 'upload_reference_structure_too_complex', 'The file-reference structure is too complex.');
      }
      for (const item of current) visit(item, depth + 1);
      return;
    }
    if (typeof current === 'object') {
      const children = Object.values(current);
      if (children.length > 1000) {
        throw new UploadError(400, 'upload_reference_structure_too_complex', 'The file-reference structure is too complex.');
      }
      for (const item of children) visit(item, depth + 1);
    }
  };
  visit(value, 0);
  return [...ids];
}

function scanValueForUploadReference(value, upload, depth = 0) {
  if (depth > 12) return { found: false, complete: false };
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    const id = String(upload.id || '').toLowerCase();
    const storedName = String(upload.stored_name || upload.storedName || '').toLowerCase();
    const found =
      lower === id ||
      (storedName && lower === storedName) ||
      lower.includes(`/uploads/${id}`) ||
      lower.includes(`/api/files/${id}`) ||
      (storedName && lower.includes(`/uploads/${storedName}`));
    return { found, complete: true };
  }
  if (value === null || value === undefined || typeof value !== 'object') {
    return { found: false, complete: true };
  }
  const children = Array.isArray(value) ? value : Object.values(value);
  if (children.length > 1000) return { found: false, complete: false };
  let found = false;
  let complete = true;
  for (const child of children) {
    const result = scanValueForUploadReference(child, upload, depth + 1);
    found ||= result.found;
    complete &&= result.complete;
  }
  return { found, complete };
}

function scanActiveUploadReferences(db, upload) {
  const result = { referenceCount: 0, complete: true };
  let tables;
  try {
    tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'entity_%'
      ORDER BY name ASC
    `).all();
  } catch {
    return { referenceCount: 0, complete: false };
  }
  const tokens = [String(upload.id || ''), String(upload.stored_name || upload.storedName || '')]
    .filter(Boolean);
  for (const { name } of tables) {
    if (!/^entity_[A-Za-z0-9_]+$/.test(name)) {
      result.complete = false;
      continue;
    }
    let rows;
    try {
      const where = tokens.map(() => 'data LIKE ?').join(' OR ');
      rows = where
        ? db.prepare(`SELECT data FROM "${name}" WHERE ${where}`).all(...tokens.map((token) => `%${token}%`))
        : [];
    } catch {
      result.complete = false;
      continue;
    }
    for (const row of rows) {
      let value;
      try {
        value = JSON.parse(row.data);
      } catch {
        result.complete = false;
        continue;
      }
      const scanned = scanValueForUploadReference(value, upload);
      if (scanned.found) result.referenceCount += 1;
      if (!scanned.complete) result.complete = false;
    }
  }
  return result;
}

function inspectLocalUploadBytes(uploadsDir, upload) {
  if (!upload) return { state: 'unknown', path: null };
  let filePath;
  try {
    filePath = canonicalUploadPath(uploadsDir, upload.stored_name || upload.storedName);
  } catch {
    return { state: 'unsafe', path: null };
  }
  if (!fs.existsSync(filePath)) return { state: 'missing', path: filePath };
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return { state: 'unsafe', path: null };
    if (Number(upload.byte_size ?? upload.byteSize) !== stat.size) return { state: 'mismatch', path: null };
    const digest = createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (digest !== upload.sha256) return { state: 'mismatch', path: null };
    return { state: 'present', path: filePath };
  } catch {
    return { state: 'unsafe', path: null };
  }
}

/**
 * Content-free administrative report for every disposition row. It performs a
 * fresh exhaustive entity-reference and byte-integrity check, and says when a
 * result is partial instead of inferring that an upload is orphaned.
 */
export function inspectUploadDispositions({ db, uploadsDir, now = new Date(), orgId = null, uploadId = null }) {
  const clauses = [];
  const params = [];
  if (orgId !== null) { clauses.push('d.org_id = ?'); params.push(orgId); }
  if (uploadId !== null) { clauses.push('d.upload_id = ?'); params.push(uploadId); }
  const rows = db.prepare(`
    SELECT d.*, r.stored_name, r.byte_size, r.sha256, r.lifecycle_state,
           r.bound_at, r.bound_entity_type, r.bound_entity_id, r.is_legacy
    FROM upload_disposition d
    LEFT JOIN upload_registry r ON r.id = d.upload_id
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY d.review_due_at ASC, d.upload_id ASC
  `).all(...params);
  const nowMs = new Date(now).getTime();
  const inspected = rows.map((row) => {
    const hasRegistry = typeof row.stored_name === 'string';
    const references = hasRegistry ? scanActiveUploadReferences(db, { ...row, id: row.upload_id }) : { referenceCount: 0, complete: false };
    const bytes = inspectLocalUploadBytes(uploadsDir, hasRegistry ? row : null);
    const bound =
      row.lifecycle_state === 'bound' ||
      Boolean(row.bound_at || row.bound_entity_id || row.is_legacy);
    const nonterminal = row.status === 'review-required' || row.status === 'retained';
    const reviewDueMs = Date.parse(row.review_due_at);
    const overdue = nonterminal && Number.isFinite(nowMs) && Number.isFinite(reviewDueMs) && reviewDueMs <= nowMs;
    const partial =
      !hasRegistry ||
      !references.complete ||
      !Number.isFinite(reviewDueMs) ||
      ['unknown', 'unsafe', 'mismatch'].includes(bytes.state);
    const actionable = nonterminal && !partial && !bound && references.referenceCount === 0;
    return {
      uploadId: row.upload_id,
      orgId: row.org_id,
      status: row.status,
      reasonCode: row.reason_code,
      plannedAction: row.planned_action,
      reviewDueAt: row.review_due_at,
      updatedAt: row.updated_at,
      registryState: row.lifecycle_state || 'missing',
      referenceCount: references.referenceCount,
      scanComplete: references.complete,
      localBytesState: bytes.state,
      overdue,
      bound,
      partial,
      actionable,
    };
  });
  return {
    total: inspected.length,
    nonterminal: inspected.filter((row) => row.status === 'review-required' || row.status === 'retained').length,
    overdue: inspected.filter((row) => row.overdue).length,
    actionable: inspected.filter((row) => row.actionable).length,
    referenced: inspected.filter((row) => row.referenceCount > 0).length,
    bound: inspected.filter((row) => row.bound).length,
    partial: inspected.filter((row) => row.partial).length,
    rows: inspected,
  };
}

function isolateCleanupCandidate({ db, row, now, reasonCode, references }) {
  const recordedAt = new Date(now).toISOString();
  const reviewDueAt = new Date(new Date(now).getTime() + UPLOAD_POLICY.dispositionReviewMs).toISOString();
  const auditExpiry = new Date(new Date(now).getTime() + UPLOAD_POLICY.auditRetentionMs).toISOString();
  let transactionStarted = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    transactionStarted = true;
    db.prepare(`
      UPDATE upload_registry
      SET lifecycle_state = 'expired', expires_at = NULL
      WHERE id = ? AND is_legacy = 0 AND bound_at IS NULL
        AND bound_entity_type IS NULL AND bound_entity_id IS NULL
        AND lifecycle_state IN ('temporary', 'processing', 'review-pending', 'expired')
    `).run(row.id);
    db.prepare(`
      INSERT INTO upload_disposition (
        upload_id, org_id, status, reason_code, planned_action,
        review_due_at, recorded_at, updated_at
      ) VALUES (?, ?, 'review-required', ?,
                'determine-lawful-retention-transfer-or-deletion', ?, ?, ?)
      ON CONFLICT(upload_id) DO UPDATE SET
        org_id = excluded.org_id,
        status = excluded.status,
        reason_code = excluded.reason_code,
        planned_action = excluded.planned_action,
        review_due_at = excluded.review_due_at,
        updated_at = excluded.updated_at
    `).run(row.id, row.org_id, reasonCode, reviewDueAt, recordedAt, recordedAt);
    db.prepare(`
      INSERT INTO upload_audit
        (id, upload_id, org_id, actor_user_id, event_type, outcome, metadata_json, created_at, expires_at, legal_hold)
      VALUES (?, ?, ?, 'system:lifecycle', 'upload_cleanup_isolated', 'retained', ?, ?, ?, ?)
    `).run(
      randomUUID(),
      row.id,
      row.org_id,
      JSON.stringify({
        state_from: row.lifecycle_state,
        state_to: 'expired',
        code: reasonCode,
        reference_count: Number(references?.referenceCount || 0),
        scan_complete: references?.complete === true,
      }),
      recordedAt,
      auditExpiry,
      process.env.UPLOAD_AUDIT_LEGAL_HOLD === '1' ? 1 : 0,
    );
    db.exec('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try { db.exec('ROLLBACK'); } catch { /* preserve the cleanup failure */ }
    }
    throw error;
  }
}

export function cleanupExpiredUploads({ db, uploadsDir, now = new Date(), dryRun = false }) {
  const nowIso = new Date(now).toISOString();
  const candidates = db.prepare(`
    SELECT * FROM upload_registry
    WHERE is_legacy = 0
      AND bound_at IS NULL
      AND bound_entity_type IS NULL
      AND bound_entity_id IS NULL
      AND lifecycle_state IN ('temporary', 'processing', 'review-pending', 'expired')
      AND expires_at IS NOT NULL
      AND expires_at <= ?
    ORDER BY expires_at ASC
  `).all(nowIso);
  const result = {
    examined: candidates.length,
    removed: 0,
    missing: 0,
    retained: 0,
    isolated: 0,
    partial: 0,
    dryRun: Boolean(dryRun),
  };
  for (const row of candidates) {
    if (row.lifecycle_state === 'bound' || row.is_legacy || row.bound_entity_id) {
      result.retained += 1;
      continue;
    }
    const references = scanActiveUploadReferences(db, { ...row, id: row.id });
    if (!references.complete || references.referenceCount > 0) {
      result.retained += 1;
      if (!references.complete) result.partial += 1;
      if (!dryRun) {
        isolateCleanupCandidate({
          db,
          row,
          now,
          reasonCode: references.complete ? 'cleanup_reference_present' : 'cleanup_reference_scan_incomplete',
          references,
        });
        result.isolated += 1;
      }
      continue;
    }
    let filePath;
    try {
      filePath = canonicalUploadPath(uploadsDir, row.stored_name);
    } catch {
      result.partial += 1;
      result.retained += 1;
      if (!dryRun) {
        isolateCleanupCandidate({
          db,
          row,
          now,
          reasonCode: 'cleanup_path_validation_failed',
          references,
        });
        result.isolated += 1;
      }
      continue;
    }
    const exists = fs.existsSync(filePath);
    if (!dryRun) {
      try {
        if (exists) removeRegularFileIfPresent(filePath);
        removeRegularFileIfPresent(canonicalUploadPath(uploadsDir, providerBlockName(row.id)));
        TRANSIENT_PROVIDER_BLOCKS.delete(row.id);
      } catch {
        result.partial += 1;
        result.retained += 1;
        isolateCleanupCandidate({
          db,
          row,
          now,
          reasonCode: 'physical_cleanup_failed',
          references,
        });
        result.isolated += 1;
        continue;
      }
      db.prepare(`
        UPDATE upload_registry
        SET lifecycle_state = 'deleted', deleted_at = ?, original_name = '[deleted]'
        WHERE id = ? AND is_legacy = 0 AND bound_at IS NULL
          AND lifecycle_state IN ('temporary', 'processing', 'review-pending', 'expired')
      `).run(nowIso, row.id);
      const auditExpiry = new Date(new Date(now).getTime() + UPLOAD_POLICY.auditRetentionMs).toISOString();
      db.prepare(`
        INSERT INTO upload_audit
          (id, upload_id, org_id, actor_user_id, event_type, outcome, metadata_json, created_at, expires_at, legal_hold)
        VALUES (?, ?, ?, ?, 'upload_cleanup', ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        row.id,
        row.org_id,
        'system:lifecycle',
        exists ? 'removed' : 'already_missing',
        JSON.stringify({ dry_run: false, state_from: row.lifecycle_state, state_to: 'deleted' }),
        nowIso,
        auditExpiry,
        process.env.UPLOAD_AUDIT_LEGAL_HOLD === '1' ? 1 : 0,
      );
    }
    if (exists) result.removed += 1;
    else result.missing += 1;
  }
  return result;
}

export function cleanupExpiredUploadAudit({ db, now = new Date(), dryRun = false }) {
  if (process.env.UPLOAD_AUDIT_LEGAL_HOLD === '1') return { removed: 0, dryRun: Boolean(dryRun), legalHold: true };
  const nowIso = new Date(now).toISOString();
  const count = Number(
    db.prepare('SELECT COUNT(*) AS n FROM upload_audit WHERE legal_hold = 0 AND expires_at <= ?').get(nowIso)?.n || 0,
  );
  const usageCutoff = new Date(new Date(now).getTime() - UPLOAD_POLICY.auditRetentionMs).toISOString();
  const usageCount = Number(
    db.prepare('SELECT COUNT(*) AS n FROM extraction_usage WHERE created_at <= ?').get(usageCutoff)?.n || 0,
  );
  const registryCount = Number(
    db.prepare(`
      SELECT COUNT(*) AS n FROM upload_registry
      WHERE lifecycle_state = 'deleted' AND deleted_at IS NOT NULL AND deleted_at <= ?
    `).get(usageCutoff)?.n || 0,
  );
  if (!dryRun) {
    db.prepare('DELETE FROM upload_audit WHERE legal_hold = 0 AND expires_at <= ?').run(nowIso);
    db.prepare('DELETE FROM extraction_usage WHERE created_at <= ?').run(usageCutoff);
    db.prepare(`
      DELETE FROM upload_registry
      WHERE lifecycle_state = 'deleted' AND deleted_at IS NOT NULL AND deleted_at <= ?
    `).run(usageCutoff);
  }
  return { removed: count + usageCount + registryCount, dryRun: Boolean(dryRun), legalHold: false };
}
