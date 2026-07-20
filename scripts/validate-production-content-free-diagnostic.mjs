// Independent output firewall for production-content-free-diagnostic.mjs.
// Reads the captured remote stdout and writes a canonical JSON record only
// after every key and value has matched the closed output contract.

import fs from 'node:fs';

const ISO_UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const TOP_LEVEL_KEYS = [
  'classification',
  'counts',
  'events',
  'events_truncated',
  'observed_at_utc',
  'schema_version',
  'preflight_truncated',
  'unextracted_attempt_preflight',
  'window_end_utc',
  'window_start_utc',
];
const PREFLIGHT_KEYS = ['attempt', 'classification'];
const COUNT_KEYS = [
  'authority_attestations',
  'extraction_failures',
  'extraction_successes',
  'referral_uploads_registered',
];
const EVENT_KEYS = [
  'attempt',
  'code',
  'outcome',
  'provider_contact_attempted',
  'provider_request_constructed',
  'provider_status_class',
  'stage',
  'timestamp_utc',
];
const CLASSIFICATIONS = new Set([
  'extraction_failed_after_provider_contact',
  'extraction_failed_before_provider_contact',
  'extraction_succeeded',
  'no_referral_upload_registered',
  'upload_registered_without_extraction_audit',
]);
const STAGES = new Set([
  'document_extraction',
  'processing_authority_attested',
  'upload_registered',
  'upload_state_changed',
]);
const OUTCOMES = new Set(['failed', 'other', 'success']);
const PROVIDER_STATUS_CLASSES = new Set(['2xx', '3xx', '4xx', '5xx', 'network', 'none']);
const PREFLIGHT_CLASSIFICATIONS = new Set([
  'acceptance_required',
  'account_inactive',
  'clinical_release_unavailable',
  'preflight_passed_no_extraction_audit',
]);
const CODES = new Set([
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
  'none',
  'other',
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

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function assertContract(condition) {
  if (!condition) throw new Error('invalid_contract');
}

export function validateContentFreeDiagnostic(value, { expectedStartUtc, expectedEndUtc } = {}) {
  assertContract(exactKeys(value, TOP_LEVEL_KEYS));
  assertContract(value.schema_version === 'assesssuite.content-free-referral-diagnostic.v1');
  assertContract(value.window_start_utc === expectedStartUtc && value.window_end_utc === expectedEndUtc);
  assertContract(ISO_UTC_SECONDS.test(value.observed_at_utc || ''));
  assertContract(CLASSIFICATIONS.has(value.classification));
  assertContract(typeof value.events_truncated === 'boolean');
  assertContract(typeof value.preflight_truncated === 'boolean');
  assertContract(exactKeys(value.counts, COUNT_KEYS));
  for (const count of Object.values(value.counts)) {
    assertContract(Number.isSafeInteger(count) && count >= 0 && count <= 100_000);
  }
  assertContract(Array.isArray(value.events) && value.events.length <= 50);
  assertContract(
    Array.isArray(value.unextracted_attempt_preflight) &&
    value.unextracted_attempt_preflight.length <= 50,
  );
  for (const preflight of value.unextracted_attempt_preflight) {
    assertContract(exactKeys(preflight, PREFLIGHT_KEYS));
    assertContract(/^attempt_\d{3}$/.test(preflight.attempt || ''));
    assertContract(PREFLIGHT_CLASSIFICATIONS.has(preflight.classification));
  }
  let previousTimestamp = '';
  for (const event of value.events) {
    assertContract(exactKeys(event, EVENT_KEYS));
    assertContract(/^attempt_\d{3}$/.test(event.attempt || ''));
    assertContract(ISO_UTC_SECONDS.test(event.timestamp_utc || ''));
    assertContract(event.timestamp_utc >= expectedStartUtc && event.timestamp_utc <= expectedEndUtc);
    assertContract(!previousTimestamp || event.timestamp_utc >= previousTimestamp);
    previousTimestamp = event.timestamp_utc;
    assertContract(STAGES.has(event.stage));
    assertContract(OUTCOMES.has(event.outcome));
    assertContract(CODES.has(event.code));
    assertContract(typeof event.provider_request_constructed === 'boolean');
    assertContract(typeof event.provider_contact_attempted === 'boolean');
    assertContract(PROVIDER_STATUS_CLASSES.has(event.provider_status_class));
    if (event.stage !== 'document_extraction') {
      assertContract(event.code === 'none');
      assertContract(event.provider_request_constructed === false);
      assertContract(event.provider_contact_attempted === false);
      assertContract(event.provider_status_class === 'none');
    }
  }
  return value;
}

if (process.argv[1]?.endsWith('validate-production-content-free-diagnostic.mjs')) {
  try {
    const [inputPath, outputPath, expectedStartUtc, expectedEndUtc] = process.argv.slice(2);
    const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean);
    assertContract(lines.length === 1);
    const parsed = JSON.parse(lines[0]);
    const valid = validateContentFreeDiagnostic(parsed, { expectedStartUtc, expectedEndUtc });
    fs.writeFileSync(outputPath, `${JSON.stringify(valid, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  } catch {
    // The calling workflow emits a fixed error. Never echo raw output,
    // exception text, paths or parsed values from this firewall.
    process.exitCode = 1;
  }
}
