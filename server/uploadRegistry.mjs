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
    'signed_url',
    'range_request',
    'range_start',
    'range_end',
  ]);
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value]),
  );
}

export function createUploadRegistry(db, { uploadsDir }) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  function getById(id) {
    return mapUpload(db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(id));
  }

  function getByStoredName(storedName) {
    return mapUpload(db.prepare('SELECT * FROM upload_registry WHERE stored_name = ?').get(storedName));
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
    now = new Date(),
  }) {
    if (!['unknown', 'under_13', '13_or_over'].includes(subjectAgeBand)) {
      throw new UploadError(400, 'invalid_age_band', 'The subject age category is invalid.');
    }
    if (purpose === 'referral-extraction') {
      if (
        subjectAgeBand !== REFERRAL_SUBJECT_AGE_CONFIRMATION ||
        subjectAgeAttestationVersion !== REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION
      ) {
        throw new UploadError(
          400,
          'invalid_subject_age_attestation_provenance',
          'The patient age attestation is invalid.',
        );
      }
    } else if (subjectAgeAttestationVersion !== null) {
      throw new UploadError(
        400,
        'subject_age_attestation_not_applicable',
        'Patient age attestation is not accepted for this upload purpose.',
      );
    }
    const inspected = inspectUpload({ buffer, originalName, declaredMime, purpose });
    assertUploadQuota({ uploaderUserId, orgId, byteSize: inspected.byteSize, now });
    const id = randomUUID();
    const storedName = `${id}${inspected.extension}`;
    const finalPath = canonicalUploadPath(uploadsDir, storedName);
    const tempName = `${storedName}.pending-${randomUUID()}`;
    const tempPath = canonicalUploadPath(uploadsDir, tempName);
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(new Date(now).getTime() + UPLOAD_POLICY.referralTtlMs).toISOString();

    fs.writeFileSync(tempPath, buffer, { flag: 'wx', mode: 0o600 });
    try {
      fs.renameSync(tempPath, finalPath);
      db.prepare(`
        INSERT INTO upload_registry (
          id, stored_name, original_name, org_id, uploader_user_id, purpose,
          detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
          created_at, expires_at, is_legacy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'temporary', ?, ?, ?, 0)
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
    } catch (error) {
      try {
        if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
        if (fs.existsSync(finalPath)) fs.rmSync(finalPath);
      } catch {
        // Cleanup failure is intentionally not allowed to hide the primary
        // database/file registration failure.
      }
      throw error;
    }
    audit({
      uploadId: id,
      orgId,
      actorUserId: uploaderUserId,
      eventType: 'upload_registered',
      outcome: 'success',
      metadata: {
        byte_size: inspected.byteSize,
        detected_mime: inspected.detectedMime,
        purpose,
        ...(purpose === 'referral-extraction'
          ? {
              subject_age_attestation_source: REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE,
              subject_age_attestation_version: subjectAgeAttestationVersion,
              subject_age_band: subjectAgeBand,
            }
          : {}),
      },
      now,
    });
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
    if (current.state === 'deleted') return current;
    const nowDate = new Date(now);
    const failureExpiry = new Date(nowDate.getTime() + UPLOAD_POLICY.failureCleanupMs).toISOString();
    const expiry = failure
      ? !current.expiresAt || failureExpiry < current.expiresAt
        ? failureExpiry
        : current.expiresAt
      : current.expiresAt;
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
    const nowIso = new Date(now).toISOString();
    const filePath = canonicalUploadPath(uploadsDir, current.storedName);
    if (fs.existsSync(filePath)) {
      const stat = fs.lstatSync(filePath);
      if (stat.isFile() && !stat.isSymbolicLink()) fs.rmSync(filePath);
    }
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

  function bind(id, { orgId, actorUserId, entityType, entityId, now = new Date() }) {
    const current = getById(id);
    if (!current || current.orgId !== orgId || ['deleted', 'expired'].includes(current.state)) {
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
    for (const row of rows) {
      if (retained.has(String(row.id).toLowerCase())) continue;
      const recordedAt = new Date(now).toISOString();
      const reviewDueAt = new Date(new Date(now).getTime() + 30 * DAY_MS).toISOString();
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
    return { isolated };
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

  return {
    getById,
    getByStoredName,
    register,
    registerLegacy,
    transition,
    bind,
    retireBoundForEntity,
    audit,
    cancelTemporary,
    reserveExtractionUsage,
    completeExtractionUsage,
  };
}

export function extractUploadIdsFromValue(value) {
  const ids = new Set();
  const visit = (current, depth) => {
    if (depth > 12 || current === null || current === undefined) return;
    if (typeof current === 'string') {
      const re = /\/(?:uploads|api\/files)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:$|[?#/])/gi;
      for (const match of current.matchAll(re)) ids.add(match[1].toLowerCase());
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 1000)) visit(item, depth + 1);
      return;
    }
    if (typeof current === 'object') {
      for (const item of Object.values(current).slice(0, 1000)) visit(item, depth + 1);
    }
  };
  visit(value, 0);
  return [...ids];
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
  const result = { examined: candidates.length, removed: 0, missing: 0, retained: 0, dryRun: Boolean(dryRun) };
  for (const row of candidates) {
    if (row.lifecycle_state === 'bound' || row.is_legacy || row.bound_entity_id) {
      result.retained += 1;
      continue;
    }
    let filePath;
    try {
      filePath = canonicalUploadPath(uploadsDir, row.stored_name);
    } catch {
      result.missing += 1;
      continue;
    }
    const exists = fs.existsSync(filePath);
    if (!dryRun) {
      if (exists) {
        const stat = fs.lstatSync(filePath);
        if (stat.isFile() && !stat.isSymbolicLink()) fs.rmSync(filePath);
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
