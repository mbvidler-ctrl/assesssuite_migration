// Read-only, content-free referral incident diagnostic.
//
// This file is encoded and executed in the running Fly machine by the
// one-shot incident production-content-free-diagnostic workflow. It must
// never emit request bodies, filenames, identifiers, document content, raw
// metadata, arbitrary exception text or database rows.

import { DatabaseSync } from 'node:sqlite';

const PRODUCTION_DB_PATH = '/app/server/data/app.db';
const MAX_WINDOW_MS = 4 * 60 * 60 * 1000;
const MAX_LOOKBACK_MS = 72 * 60 * 60 * 1000;
const MAX_EVENTS = 50;
const ISO_UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ISO_UTC_DATABASE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const OBSERVED_EVENTS = new Set([
  'upload_registered',
  'processing_authority_attested',
  'upload_state_changed',
  'document_extraction',
]);

const SAFE_FAILURE_CODES = new Set([
  'account_inactive',
  'acceptance_required',
  'clinical_release_unavailable',
  'csv_too_complex',
  'csv_too_large',
  'empty_csv',
  'extraction_busy',
  'extraction_disabled',
  'extraction_failed',
  'extraction_model_override_forbidden',
  'extraction_payload_too_large',
  'health_data_terms_unconfirmed',
  'invalid_csv',
  'invalid_schema',
  'invalid_schema_const',
  'invalid_schema_enum',
  'invalid_schema_format',
  'invalid_schema_items',
  'invalid_schema_properties',
  'invalid_schema_required',
  'invalid_schema_root',
  'invalid_schema_shape',
  'missing_file',
  'processing_authority_required',
  'provider_empty_response',
  'provider_error',
  'provider_incomplete',
  'provider_malformed_output',
  'provider_malformed_response',
  'provider_not_configured',
  'provider_policy_violation',
  'provider_refusal',
  'provider_response_too_large',
  'provider_timeout',
  'provider_unavailable',
  'schema_additional_properties',
  'schema_invalid_provider_output',
  'schema_too_wide',
  'unsafe_schema_description',
  'unsupported_document_type',
  'unsupported_schema_keyword',
  'upload_changed',
  'upload_not_found',
]);

const CURRENT_AI_ACCEPTANCE = Object.freeze({
  suiteVersion: 'RC-2026.07.19',
  eventType: 'ai_transparency_consent',
  documentId: 'ai-notice',
  documentTitle: 'AssessSuite AI and Automated Processing Transparency Notice',
  documentFingerprint: 'sha256-4899c9e2f997e411fd1b2f8e668e765c82bf260c358b04127011b99a55d1725e',
});
const ELIGIBLE_PROFESSIONS = new Set([
  'Exercise Physiologist',
  'Gym Management',
  'Clinic Management',
]);

function parseWindow(startUtc, endUtc, now = new Date()) {
  if (!ISO_UTC_SECONDS.test(startUtc || '') || !ISO_UTC_SECONDS.test(endUtc || '')) {
    throw new Error('invalid_window');
  }
  const startMs = Date.parse(startUtc);
  const endMs = Date.parse(endUtc);
  const nowMs = now.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('invalid_window');
  }
  if (endMs - startMs > MAX_WINDOW_MS) throw new Error('window_too_wide');
  if (startMs < nowMs - MAX_LOOKBACK_MS || endMs > nowMs + 5 * 60 * 1000) {
    throw new Error('window_out_of_bounds');
  }
  return { startUtc, endUtc };
}

function safeMetadata(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeOutcome(value) {
  return value === 'success' || value === 'failed' ? value : 'other';
}

function safeCode(value) {
  return typeof value === 'string' && SAFE_FAILURE_CODES.has(value) ? value : value ? 'other' : 'none';
}

function safeProviderStatusClass(value) {
  return ['2xx', '3xx', '4xx', '5xx', 'network'].includes(value) ? value : 'none';
}

function safeTimestamp(value) {
  if (!ISO_UTC_DATABASE.test(value || '') || !Number.isFinite(Date.parse(value))) {
    throw new Error('unexpected_timestamp');
  }
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function classify({ registeredUploads, events }) {
  const latestExtraction = [...events].reverse().find((event) => event.stage === 'document_extraction');
  if (latestExtraction?.outcome === 'success') return 'extraction_succeeded';
  if (latestExtraction?.outcome === 'failed') {
    return latestExtraction.provider_contact_attempted
      ? 'extraction_failed_after_provider_contact'
      : 'extraction_failed_before_provider_contact';
  }
  if (registeredUploads > 0) return 'upload_registered_without_extraction_audit';
  return 'no_referral_upload_registered';
}

function classifyCurrentPreflight(db, upload) {
  const user = db.prepare(`
    SELECT json_extract(data, '$.email') AS email,
           json_extract(data, '$.country') AS country,
           json_extract(data, '$.profession') AS profession,
           json_extract(data, '$.account_status') AS account_status
    FROM entity_User
    WHERE id = ?
  `).get(upload.uploader_user_id);
  if (!user || user.country !== 'australia' || !ELIGIBLE_PROFESSIONS.has(user.profession)) {
    return 'clinical_release_unavailable';
  }
  if (user.account_status !== 'active') return 'account_inactive';
  const accepted = db.prepare(`
    SELECT 1 AS accepted
    FROM entity_LegalAcceptanceEvent
    WHERE json_extract(data, '$.user_email') = ?
      AND json_extract(data, '$.org_id') = ?
      AND json_extract(data, '$.suite_version') = ?
      AND json_extract(data, '$.event_type') = ?
      AND json_extract(data, '$.document_id') = ?
      AND json_extract(data, '$.document_title') = ?
      AND json_extract(data, '$.document_fingerprint') = ?
    LIMIT 1
  `).get(
    user.email,
    upload.org_id,
    CURRENT_AI_ACCEPTANCE.suiteVersion,
    CURRENT_AI_ACCEPTANCE.eventType,
    CURRENT_AI_ACCEPTANCE.documentId,
    CURRENT_AI_ACCEPTANCE.documentTitle,
    CURRENT_AI_ACCEPTANCE.documentFingerprint,
  );
  return accepted ? 'preflight_passed_no_extraction_audit' : 'acceptance_required';
}

export function buildContentFreeDiagnostic({
  dbPath = PRODUCTION_DB_PATH,
  startUtc,
  endUtc,
  now = new Date(),
} = {}) {
  const window = parseWindow(startUtc, endUtc, now);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec('PRAGMA query_only = ON;');

    const registeredUploads = Number(
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM upload_registry
        WHERE purpose = 'referral-extraction'
          AND created_at >= ?
          AND created_at <= ?
      `).get(window.startUtc, window.endUtc)?.count || 0,
    );

    const uploadRows = db.prepare(`
      SELECT id, org_id, uploader_user_id
      FROM upload_registry
      WHERE purpose = 'referral-extraction'
        AND created_at >= ?
        AND created_at <= ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(window.startUtc, window.endUtc, MAX_EVENTS).reverse();

    const auditAggregate = db.prepare(`
        SELECT COUNT(*) AS event_count,
               COALESCE(SUM(CASE
                 WHEN audit.event_type = 'processing_authority_attested' THEN 1 ELSE 0
               END), 0) AS authority_attestations,
               COALESCE(SUM(CASE
                 WHEN audit.event_type = 'document_extraction' AND audit.outcome = 'success' THEN 1 ELSE 0
               END), 0) AS extraction_successes,
               COALESCE(SUM(CASE
                 WHEN audit.event_type = 'document_extraction' AND audit.outcome = 'failed' THEN 1 ELSE 0
               END), 0) AS extraction_failures
        FROM upload_audit AS audit
        INNER JOIN upload_registry AS upload ON upload.id = audit.upload_id
        WHERE upload.purpose = 'referral-extraction'
          AND audit.created_at >= ?
          AND audit.created_at <= ?
          AND audit.event_type IN (
            'upload_registered',
            'processing_authority_attested',
            'upload_state_changed',
            'document_extraction'
          )
      `).get(window.startUtc, window.endUtc);
    const rowCount = Number(auditAggregate?.event_count || 0);

    const rows = db.prepare(`
      SELECT audit.upload_id, audit.event_type, audit.outcome,
             audit.metadata_json, audit.created_at
      FROM upload_audit AS audit
      INNER JOIN upload_registry AS upload ON upload.id = audit.upload_id
      WHERE upload.purpose = 'referral-extraction'
        AND audit.created_at >= ?
        AND audit.created_at <= ?
        AND audit.event_type IN (
          'upload_registered',
          'processing_authority_attested',
          'upload_state_changed',
          'document_extraction'
        )
      ORDER BY audit.created_at DESC, audit.id DESC
      LIMIT ?
    `).all(window.startUtc, window.endUtc, MAX_EVENTS).reverse();

    const attemptOrdinals = new Map(
      uploadRows.map((upload, index) => [upload.id, index + 1]),
    );
    const events = rows.map((row) => {
      if (!OBSERVED_EVENTS.has(row.event_type)) throw new Error('unexpected_event');
      if (!attemptOrdinals.has(row.upload_id)) {
        attemptOrdinals.set(row.upload_id, attemptOrdinals.size + 1);
      }
      const metadata = safeMetadata(row.metadata_json);
      return {
        attempt: `attempt_${String(attemptOrdinals.get(row.upload_id)).padStart(3, '0')}`,
        timestamp_utc: safeTimestamp(row.created_at),
        stage: row.event_type,
        outcome: safeOutcome(row.outcome),
        code: row.event_type === 'document_extraction' ? safeCode(metadata.code) : 'none',
        provider_request_constructed:
          row.event_type === 'document_extraction' && metadata.provider_request_constructed === true,
        provider_contact_attempted:
          row.event_type === 'document_extraction' && metadata.provider_contact_attempted === true,
        provider_status_class:
          row.event_type === 'document_extraction'
            ? safeProviderStatusClass(metadata.provider_status_class)
            : 'none',
      };
    });

    const extractionAuditExists = db.prepare(`
      SELECT 1 AS observed
      FROM upload_audit
      WHERE upload_id = ?
        AND event_type = 'document_extraction'
        AND created_at >= ?
        AND created_at <= ?
      LIMIT 1
    `);
    const extractionAuditedUploads = new Set(
      uploadRows
        .filter((upload) => extractionAuditExists.get(upload.id, window.startUtc, window.endUtc))
        .map((upload) => upload.id),
    );
    const unextractedAttemptPreflight = uploadRows
      .filter((upload) => !extractionAuditedUploads.has(upload.id))
      .map((upload) => ({
        attempt: `attempt_${String(attemptOrdinals.get(upload.id)).padStart(3, '0')}`,
        classification: classifyCurrentPreflight(db, upload),
      }));

    const result = {
      schema_version: 'assesssuite.content-free-referral-diagnostic.v1',
      observed_at_utc: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      window_start_utc: window.startUtc,
      window_end_utc: window.endUtc,
      classification: classify({ registeredUploads, events }),
      counts: {
        referral_uploads_registered: registeredUploads,
        authority_attestations: Number(auditAggregate?.authority_attestations || 0),
        extraction_successes: Number(auditAggregate?.extraction_successes || 0),
        extraction_failures: Number(auditAggregate?.extraction_failures || 0),
      },
      preflight_truncated: registeredUploads > MAX_EVENTS,
      unextracted_attempt_preflight: unextractedAttemptPreflight,
      events_truncated: rowCount > MAX_EVENTS,
      events,
    };
    return result;
  } finally {
    db.close();
  }
}

if (process.env.ASSESSSUITE_CONTENT_FREE_DIAGNOSTIC_EXECUTE === '1') {
  try {
    const result = buildContentFreeDiagnostic({
      dbPath: PRODUCTION_DB_PATH,
      startUtc: process.env.ASSESSSUITE_DIAGNOSTIC_START_UTC,
      endUtc: process.env.ASSESSSUITE_DIAGNOSTIC_END_UTC,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    // Deliberately value-blind. The workflow publishes only a fixed generic
    // failure if the remote query or its output contract is invalid.
    process.exitCode = 1;
  }
}
