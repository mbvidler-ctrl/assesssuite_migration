// Content-free, authenticated provider canary for the AssessSuite production
// patch. This script is intentionally NOT a public-production browser probe.
// It may run only inside a freshly bootstrapped, disposable Fly Machine that
// has no public service and whose data storage will be destroyed externally.
//
// The candidate server must already be listening on loopback. The script uses
// the server's bootstrap ADMIN_EMAIL / ADMIN_PASSWORD without ever emitting
// them, converts that sole ephemeral account into a synthetic clinician, and
// exercises exactly three paid provider calls:
//   1. one report InvokeLLM call;
//   2. one real audio transcription; and
//   3. one transcript-to-SOAP dissection.
// A fourth InvokeLLM request must then be refused by the canary-only three-call
// API cap before provider egress. Standard output is exactly one fixed-shape
// JSON receipt containing counts, booleans, byte lengths and SHA-256 hashes --
// never prompts, provider output, transcript text, credentials or identifiers.
//
// Required canary-specific environment (in addition to the candidate's normal
// production environment):
//   RUN_ASSESSSUITE_PRODUCTION_PATCH_CANARY=<REQUIRED_CANARY_ACKNOWLEDGEMENT>
//   ALLOW_PAID_PROVIDER_PROBE=1
//   ASSESSSUITE_PATCH_CANARY_MACHINE_ID=<the current FLY_MACHINE_ID>
//   ASSESSSUITE_PATCH_CANARY_SERVER_PID=<PID of node server/index.mjs>
//   CANARY_AUDIO_PATH=/tmp/<synthetic-or-canary-name>.{wav,mp3,mp4,webm}
//   CANARY_EXPECTED_TRANSCRIPT_MARKER=<a spoken synthetic/canary marker>
//
// AI_USAGE_USER_ROLLING_24H_CALLS=3 and the disabled outbound-action flags
// MUST be present on the server process itself, not added only to this command.
// The /proc check below enforces that distinction before any provider request.

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

export const CANARY_NAME = 'assesssuite-production-patch';
export const CANARY_SCHEMA_VERSION = 'assesssuite.production-patch-canary.v1';
export const REQUIRED_CANARY_ACKNOWLEDGEMENT =
  'I_ACKNOWLEDGE_THIS_RUNS_ONLY_IN_A_DISPOSABLE_NO_SERVICE_CANDIDATE_MACHINE_WITH_EPHEMERAL_DATA';

const RELEASE_SHA_RE = /^[0-9a-f]{40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPECTED_DB_PATH = '/app/server/data/app.db';
const AUDIO_ROOT = '/tmp';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const AI_ASSISTED_MARKER = '[AI-ASSISTED CONTENT - REQUIRES CLINICIAN REVIEW]';
const FORBIDDEN_PROVIDER_MARKER =
  /SYNTHETIC_CHAT_PROVIDER_RESPONSE|local InvokeLLM mock|placeholder response|simulation response/i;
const AUDIO_MIME_BY_EXTENSION = Object.freeze({
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
});

const CHECK_NAMES = Object.freeze([
  'gates_accepted',
  'loopback_target',
  'fresh_ephemeral_database',
  'bootstrap_authenticated',
  'synthetic_tenant_created',
  'synthetic_clinician_activated',
  'legal_acceptance_recorded',
  'synthetic_client_created',
  'suggestion_helper_deterministic',
  'report_provider_succeeded',
  'saved_report_persisted_and_reread',
  'audio_uploaded',
  'real_transcription_succeeded',
  'transcript_marker_matched',
  'real_soap_dissection_succeeded',
  'three_provider_attempts_recorded',
  'fourth_call_refused_by_user_cap',
  'denial_created_no_ledger_row',
]);

function emptyChecks() {
  return Object.fromEntries(CHECK_NAMES.map((name) => [name, false]));
}

function emptyEvidence() {
  return {
    machine_id_sha256: null,
    database_path_sha256: sha256(EXPECTED_DB_PATH),
    audio: {
      byte_count: null,
      sha256: null,
      expected_marker_sha256: null,
    },
    suggestions: {
      count: null,
      selection_sha256: null,
    },
    report: {
      provider_byte_count: null,
      provider_sha256: null,
      persisted_sha256: null,
    },
    transcription: {
      byte_count: null,
      sha256: null,
      simulated: null,
    },
    soap: {
      field_count: null,
      byte_count: null,
      sha256: null,
      simulated: null,
    },
    ledger: {
      baseline_rows: null,
      rows_after_three_calls: null,
      provider_attempt_rows_after_denial: null,
      succeeded_rows: null,
      provider_request_hash_rows: null,
      summary_sha256: null,
    },
    quota: {
      status: null,
      code: null,
      reset_present: null,
      retry_after_present: null,
    },
  };
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedMarker(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function pathIsInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeReleaseSha(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return RELEASE_SHA_RE.test(normalized) ? normalized : null;
}

function allTrue(record) {
  return Object.values(record).every((value) => value === true);
}

function isLoopbackUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !['', '/'].includes(parsed.pathname)
  ) {
    return null;
  }
  parsed.pathname = '/';
  return parsed;
}

function audioFixtureMetadata(environment) {
  const suppliedPath = environment.CANARY_AUDIO_PATH;
  const expectedMarker = environment.CANARY_EXPECTED_TRANSCRIPT_MARKER;
  if (!path.isAbsolute(suppliedPath || '') || !pathIsInside(AUDIO_ROOT, suppliedPath)) return null;
  if (!/(?:synthetic|canary)/i.test(path.basename(suppliedPath))) return null;
  const marker = normalizedMarker(expectedMarker);
  if (
    marker.length < 8 ||
    marker.length > 160 ||
    !/(?:synthetic|canary)/.test(marker)
  ) return null;

  let stat;
  try {
    stat = fs.lstatSync(suppliedPath);
  } catch {
    return null;
  }
  const extension = path.extname(suppliedPath).toLowerCase();
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size <= 0 ||
    stat.size > MAX_AUDIO_BYTES ||
    !AUDIO_MIME_BY_EXTENSION[extension]
  ) return null;

  return {
    path: suppliedPath,
    extension,
    mime: AUDIO_MIME_BY_EXTENSION[extension],
    marker,
    byteCount: stat.size,
  };
}

function serverProcessContract(environment) {
  const pid = environment.ASSESSSUITE_PATCH_CANARY_SERVER_PID;
  if (!/^[1-9][0-9]{0,9}$/.test(pid || '') || Number(pid) === process.pid) return null;
  let commandLine;
  let entries;
  try {
    commandLine = fs.readFileSync(`/proc/${pid}/cmdline`);
    entries = fs.readFileSync(`/proc/${pid}/environ`);
  } catch {
    return null;
  }
  if (
    commandLine.byteLength === 0 ||
    !commandLine.toString('utf8').split('\0').some((entry) => /(?:^|\/)server\/index\.mjs$/.test(entry))
  ) return null;

  const serverEnvironment = new Map();
  for (const entry of entries.toString('utf8').split('\0')) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    serverEnvironment.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  const exact = {
    NODE_ENV: 'production',
    LLM_REQUIRED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    TRANSCRIPTION_ENABLED: '1',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    AI_USAGE_USER_ROLLING_24H_CALLS: '3',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
  };
  if (Object.entries(exact).some(([name, value]) => serverEnvironment.get(name) !== value)) return null;
  if (
    serverEnvironment.get('SELFTEST') === '1' ||
    serverEnvironment.has('ASSESSSUITE_DB_PATH') ||
    serverEnvironment.get('PARITY_ASSURANCE_MODE') === '1' ||
    !nonEmptyString(serverEnvironment.get('OPENAI_API_KEY')) ||
    !nonEmptyString(serverEnvironment.get('ADMIN_EMAIL')) ||
    !nonEmptyString(serverEnvironment.get('ADMIN_PASSWORD')) ||
    safeReleaseSha(serverEnvironment.get('RELEASE_SHA')) !== safeReleaseSha(environment.RELEASE_SHA) ||
    serverEnvironment.get('FLY_MACHINE_ID') !== environment.FLY_MACHINE_ID
  ) return null;
  return { pid };
}

export function productionPatchCanaryGates(environment = process.env) {
  const baseUrl = isLoopbackUrl(
    environment.ASSESSSUITE_PATCH_CANARY_BASE_URL || 'http://127.0.0.1:8787',
  );
  const machineId = environment.FLY_MACHINE_ID;
  return Object.freeze({
    explicit_acknowledgement:
      environment.RUN_ASSESSSUITE_PRODUCTION_PATCH_CANARY === REQUIRED_CANARY_ACKNOWLEDGEMENT,
    paid_provider_gate: environment.ALLOW_PAID_PROVIDER_PROBE === '1',
    production_runtime: environment.NODE_ENV === 'production' && environment.SELFTEST !== '1',
    release_identity_present: Boolean(safeReleaseSha(environment.RELEASE_SHA)),
    fly_machine_target_pinned:
      nonEmptyString(machineId) &&
      environment.ASSESSSUITE_PATCH_CANARY_MACHINE_ID === machineId,
    server_process_contract_pinned: Boolean(serverProcessContract(environment)),
    loopback_target: Boolean(baseUrl),
    default_ephemeral_database:
      !environment.ASSESSSUITE_DB_PATH && environment.PARITY_ASSURANCE_MODE !== '1',
    bootstrap_credentials_present:
      nonEmptyString(environment.ADMIN_EMAIL) && nonEmptyString(environment.ADMIN_PASSWORD),
    real_provider_required:
      nonEmptyString(environment.OPENAI_API_KEY) &&
      environment.LLM_REQUIRED === '1' &&
      !environment.OPENAI_CHAT_TEST_BASE_URL,
    candidate_capabilities_enabled:
      environment.GENERAL_CLINICAL_LLM_ENABLED === '1' &&
      environment.TRANSCRIPTION_ENABLED === '1' &&
      environment.OPENAI_HEALTH_DATA_TERMS_CONFIRMED === '1',
    canary_call_cap_exact: environment.AI_USAGE_USER_ROLLING_24H_CALLS === '3',
    outbound_side_effects_disabled:
      environment.OUTBOUND_EMAIL_ENABLED === '0' &&
      environment.OUTBOUND_SMS_ENABLED === '0' &&
      environment.PAYMENTS_ENABLED === '0',
    synthetic_audio_valid: Boolean(audioFixtureMetadata(environment)),
  });
}

function receipt({ result, failureStage, checks, evidence, environment }) {
  return {
    schema_version: CANARY_SCHEMA_VERSION,
    canary: CANARY_NAME,
    observed_at_utc: new Date().toISOString(),
    release_sha: safeReleaseSha(environment.RELEASE_SHA),
    result,
    failure_stage: failureStage,
    isolation: {
      target: 'loopback-only-disposable-fly-machine',
      database: 'ephemeral-default-path',
      external_email_sends: 0,
      external_sms_sends: 0,
      payment_actions: 0,
      destruction: 'external-required',
    },
    checks,
    evidence,
  };
}

function fail(code = 'assertion') {
  const error = new Error('production patch canary assertion failed');
  error.canaryCode = code;
  throw error;
}

function requireTrue(value, code) {
  if (!value) fail(code);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertEntityList(result, expectedLength, code) {
  requireTrue(result.status === 200 && Array.isArray(result.body), `${code}-shape`);
  requireTrue(result.body.length === expectedLength, `${code}-count`);
}

function ledgerSnapshot(userId) {
  const db = new DatabaseSync(EXPECTED_DB_PATH, { readOnly: true });
  try {
    const rows = db.prepare(`
      SELECT feature, status, provider_request_id_hash
      FROM api_usage_reservation
      WHERE user_id = ?
      ORDER BY created_at, id
    `).all(userId).map((row) => ({
      feature: row.feature,
      status: row.status,
      provider_request_id_hash_present:
        typeof row.provider_request_id_hash === 'string' &&
        /^[a-f0-9]{64}$/i.test(row.provider_request_id_hash),
    }));
    const totalRows = Number(
      db.prepare('SELECT COUNT(*) AS count FROM api_usage_reservation').get().count,
    );
    return {
      rows,
      totalRows,
      succeededRows: rows.filter((row) => row.status === 'succeeded').length,
      providerRequestHashRows: rows.filter((row) => row.provider_request_id_hash_present).length,
      summarySha256: sha256(canonicalJson(rows)),
    };
  } finally {
    db.close();
  }
}

function assertThreeProviderRows(snapshot) {
  requireTrue(snapshot.totalRows === 3 && snapshot.rows.length === 3, 'ledger-count');
  requireTrue(snapshot.succeededRows === 3, 'ledger-success-count');
  requireTrue(snapshot.providerRequestHashRows === 3, 'ledger-provider-hash-count');
  const features = snapshot.rows.map((row) => row.feature).sort();
  requireTrue(
    canonicalJson(features) === canonicalJson(['invoke_llm', 'soap_dissection', 'transcription']),
    'ledger-feature-set',
  );
}

async function runCanary(environment = process.env) {
  const checks = emptyChecks();
  const evidence = emptyEvidence();
  const gates = productionPatchCanaryGates(environment);
  if (!allTrue(gates)) {
    return receipt({
      result: 'REFUSED',
      failureStage: 'gate',
      checks,
      evidence,
      environment,
    });
  }

  checks.gates_accepted = true;
  const baseUrl = isLoopbackUrl(
    environment.ASSESSSUITE_PATCH_CANARY_BASE_URL || 'http://127.0.0.1:8787',
  );
  const appId = environment.ASSESSSUITE_PATCH_CANARY_APP_ID || 'local-assesssuite';
  const fixture = audioFixtureMetadata(environment);
  evidence.machine_id_sha256 = sha256(environment.FLY_MACHINE_ID);
  evidence.audio.byte_count = fixture.byteCount;
  evidence.audio.expected_marker_sha256 = sha256(fixture.marker);
  requireTrue(/^[A-Za-z0-9_-]+$/.test(appId), 'app-id');
  checks.loopback_target = true;

  let stage = 'database_preflight';
  try {
    const dbStat = fs.lstatSync(EXPECTED_DB_PATH);
    requireTrue(dbStat.isFile() && !dbStat.isSymbolicLink(), 'database-path');

    async function request(route, {
      method = 'GET',
      token,
      json,
      form,
      timeoutMs = 240_000,
    } = {}) {
      const headers = {
        Accept: 'application/json',
        'X-App-Id': appId,
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (json !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(new URL(route, baseUrl), {
        method,
        headers,
        body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        fail('non-json-response');
      }
      return {
        status: response.status,
        body,
        raw: Buffer.from(text, 'utf8'),
      };
    }

    stage = 'authenticate';
    const login = await request(`/api/apps/${appId}/auth/login`, {
      method: 'POST',
      json: {
        email: environment.ADMIN_EMAIL,
        password: environment.ADMIN_PASSWORD,
      },
    });
    requireTrue(login.status === 200 && nonEmptyString(login.body?.access_token), 'bootstrap-login');
    requireTrue(UUID_RE.test(login.body?.user?.id || ''), 'bootstrap-user-id');
    requireTrue(login.body?.user?.role === 'admin', 'bootstrap-role');
    const token = login.body.access_token;
    const userId = login.body.user.id;
    checks.bootstrap_authenticated = true;

    stage = 'database_freshness';
    const [users, organizations, clients, reports] = await Promise.all([
      request(`/api/apps/${appId}/entities/User`, { token }),
      request(`/api/apps/${appId}/entities/Organization`, { token }),
      request(`/api/apps/${appId}/entities/Client`, { token }),
      request(`/api/apps/${appId}/entities/SavedReport`, { token }),
    ]);
    assertEntityList(users, 1, 'fresh-users');
    assertEntityList(organizations, 0, 'fresh-organizations');
    assertEntityList(clients, 0, 'fresh-clients');
    assertEntityList(reports, 0, 'fresh-reports');
    requireTrue(users.body[0]?.id === userId && users.body[0]?.role === 'admin', 'fresh-admin');
    const baselineLedger = ledgerSnapshot(userId);
    requireTrue(baselineLedger.totalRows === 0 && baselineLedger.rows.length === 0, 'fresh-ledger');
    evidence.ledger.baseline_rows = 0;
    checks.fresh_ephemeral_database = true;

    stage = 'synthetic_tenant';
    const nonce = randomUUID();
    const organization = await request(`/api/apps/${appId}/entities/Organization`, {
      method: 'POST',
      token,
      json: {
        name: `Synthetic Patch Canary Practice ${nonce}`,
        owner_email: environment.ADMIN_EMAIL,
        status: 'active',
        subscription_status: 'active',
        synthetic_canary: true,
      },
    });
    requireTrue(organization.status === 200 && UUID_RE.test(organization.body?.id || ''), 'organization-create');
    const orgId = organization.body.id;
    const membership = await request(`/api/apps/${appId}/entities/OrganizationMember`, {
      method: 'POST',
      token,
      json: {
        org_id: orgId,
        user_email: environment.ADMIN_EMAIL,
        role: 'owner',
        status: 'active',
        is_primary: true,
        synthetic_canary: true,
      },
    });
    requireTrue(membership.status === 200 && UUID_RE.test(membership.body?.id || ''), 'membership-create');
    checks.synthetic_tenant_created = true;

    stage = 'clinician_conversion';
    const converted = await request(
      `/api/apps/${appId}/entities/User/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        token,
        json: {
          role: 'user',
          account_status: 'active',
          subscription_status: 'active',
          email_verified: true,
          country: 'australia',
          profession: 'Exercise Physiologist',
          clinician_name: 'Synthetic Production Patch Canary Clinician',
          full_name: 'Synthetic Production Patch Canary Clinician',
        },
      },
    );
    requireTrue(
      converted.status === 200 &&
      converted.body?.role === 'user' &&
      converted.body?.account_status === 'active' &&
      converted.body?.country === 'australia' &&
      converted.body?.profession === 'Exercise Physiologist',
      'clinician-conversion',
    );
    checks.synthetic_clinician_activated = true;

    stage = 'legal_acceptance';
    const acceptance = await request(
      `/api/apps/${appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      {
        method: 'POST',
        token,
        json: { org_id: orgId, marketing_opt_in: false },
      },
    );
    requireTrue(acceptance.status === 200, 'legal-acceptance');
    checks.legal_acceptance_recorded = true;

    stage = 'synthetic_client';
    const client = await request(`/api/apps/${appId}/entities/Client`, {
      method: 'POST',
      token,
      json: {
        org_id: orgId,
        full_name: `Synthetic Production Patch Canary Client ${nonce}`,
        assigned_clinician_email: environment.ADMIN_EMAIL,
        primary_condition: 'Synthetic knee osteoarthritis scenario',
        referral_reason: 'Wholly synthetic provider canary',
        status: 'active',
        synthetic_canary: true,
      },
    });
    requireTrue(client.status === 200 && UUID_RE.test(client.body?.id || ''), 'client-create');
    const clientId = client.body.id;
    checks.synthetic_client_created = true;

    stage = 'suggestion_helper';
    const { discoverAssessments } = await import('../src/lib/clinical/assessmentDiscovery.js');
    requireTrue(typeof discoverAssessments === 'function', 'suggestion-helper-import');
    const suggestionInput = {
      conditions: [{ condition_name: 'Knee osteoarthritis' }],
      assessments: [
        {
          id: 'synthetic-knee-function-assessment',
          name: 'Synthetic Knee Function Measure',
          conditions_indicated: ['Knee osteoarthritis'],
        },
        {
          id: 'synthetic-pulmonary-assessment',
          name: 'Synthetic Pulmonary Measure',
          conditions_indicated: ['COPD'],
        },
        {
          id: 'synthetic-cardiac-assessment',
          name: 'Synthetic Cardiac Measure',
          conditions_indicated: ['Hypertension'],
        },
      ],
    };
    const firstSuggestions = discoverAssessments(suggestionInput);
    const reversedSuggestions = discoverAssessments({
      ...suggestionInput,
      assessments: [...suggestionInput.assessments].reverse(),
    });
    const suggestionIds = firstSuggestions.map((item) => item.id);
    requireTrue(
      suggestionIds.length === 1 &&
      suggestionIds[0] === 'synthetic-knee-function-assessment' &&
      canonicalJson(suggestionIds) === canonicalJson(reversedSuggestions.map((item) => item.id)),
      'suggestion-determinism',
    );
    evidence.suggestions.count = suggestionIds.length;
    evidence.suggestions.selection_sha256 = sha256(canonicalJson(suggestionIds));
    checks.suggestion_helper_deterministic = true;

    stage = 'report_provider';
    const reportGeneration = await request(
      `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`,
      {
        method: 'POST',
        token,
        json: {
          prompt: [
            'Draft one concise clinical progress-summary paragraph for a wholly synthetic adult exercise-physiology scenario.',
            'The synthetic scenario has knee osteoarthritis, improving walking tolerance, and no red flags.',
            'Do not invent identifiers, dates, contact details, provider numbers or scheme numbers.',
            'Return JSON with only the required clinical_summary string.',
          ].join(' '),
          response_json_schema: {
            type: 'object',
            properties: { clinical_summary: { type: 'string' } },
            required: ['clinical_summary'],
          },
        },
      },
    );
    const reportSection = reportGeneration.body?.clinical_summary;
    requireTrue(reportGeneration.status === 200 && nonEmptyString(reportSection), 'report-provider-shape');
    requireTrue(!FORBIDDEN_PROVIDER_MARKER.test(reportSection), 'report-provider-fallback');
    evidence.report.provider_byte_count = Buffer.byteLength(reportSection, 'utf8');
    evidence.report.provider_sha256 = sha256(reportSection);
    checks.report_provider_succeeded = true;

    stage = 'report_persistence';
    const reportHtml = [
      '<article data-synthetic-canary="true">',
      '<h1>Synthetic Production Patch Canary Report</h1>',
      `<p>${escapeHtml(AI_ASSISTED_MARKER)}</p>`,
      `<section>${escapeHtml(reportSection)}</section>`,
      '</article>',
    ].join('');
    const savedReportPayload = {
      client_id: clientId,
      org_id: orgId,
      report_type: 'progress_note',
      report_name: 'Synthetic Production Patch Canary Report',
      report_date: new Date().toISOString().slice(0, 10),
      assessment_ids: [],
      section_content: {
        clinical_summary: reportSection,
        clinical_summary_ai_drafted: true,
      },
      active_sections: ['clinical_summary'],
      ai_assisted_sections: ['clinical_summary'],
      report_html: reportHtml,
      status: 'final',
      synthetic_canary: true,
    };
    const savedReport = await request(`/api/apps/${appId}/entities/SavedReport`, {
      method: 'POST',
      token,
      json: savedReportPayload,
    });
    requireTrue(savedReport.status === 200 && UUID_RE.test(savedReport.body?.id || ''), 'report-create');
    const rereadReport = await request(
      `/api/apps/${appId}/entities/SavedReport/${encodeURIComponent(savedReport.body.id)}`,
      { token },
    );
    requireTrue(
      rereadReport.status === 200 &&
      rereadReport.body?.client_id === clientId &&
      rereadReport.body?.org_id === orgId &&
      rereadReport.body?.section_content?.clinical_summary === reportSection &&
      rereadReport.body?.report_html === reportHtml &&
      rereadReport.body?.status === 'final',
      'report-reread',
    );
    evidence.report.persisted_sha256 = sha256(canonicalJson({
      report_type: rereadReport.body.report_type,
      section_content: rereadReport.body.section_content,
      report_html: rereadReport.body.report_html,
      status: rereadReport.body.status,
    }));
    checks.saved_report_persisted_and_reread = true;

    stage = 'audio_upload';
    const audioBytes = fs.readFileSync(fixture.path);
    requireTrue(audioBytes.byteLength === fixture.byteCount, 'audio-size-race');
    evidence.audio.sha256 = sha256(audioBytes);
    const uploadForm = new FormData();
    uploadForm.append('org_id', orgId);
    uploadForm.append('purpose', 'audio-transcription');
    uploadForm.append(
      'file',
      new Blob([audioBytes], { type: fixture.mime }),
      `synthetic-production-patch-canary${fixture.extension}`,
    );
    const upload = await request(
      `/api/apps/${appId}/integration-endpoints/Core/UploadFile`,
      { method: 'POST', token, form: uploadForm },
    );
    requireTrue(
      upload.status === 200 &&
      UUID_RE.test(upload.body?.upload_id || '') &&
      upload.body?.file_url === `/uploads/${upload.body.upload_id}`,
      'audio-upload',
    );
    checks.audio_uploaded = true;

    stage = 'transcription';
    const transcription = await request(
      `/api/apps/${appId}/functions/transcribeSession`,
      {
        method: 'POST',
        token,
        json: {
          action: 'transcribe',
          audio_url: upload.body.file_url,
          org_id: orgId,
        },
      },
    );
    const transcript = transcription.body?.transcript;
    requireTrue(
      transcription.status === 200 &&
      transcription.body?.simulated === false &&
      nonEmptyString(transcript),
      'real-transcription',
    );
    evidence.transcription.byte_count = Buffer.byteLength(transcript, 'utf8');
    evidence.transcription.sha256 = sha256(transcript);
    evidence.transcription.simulated = false;
    checks.real_transcription_succeeded = true;
    requireTrue(normalizedMarker(transcript).includes(fixture.marker), 'transcript-marker');
    checks.transcript_marker_matched = true;

    stage = 'soap_dissection';
    const soap = await request(`/api/apps/${appId}/functions/transcribeSession`, {
      method: 'POST',
      token,
      json: { action: 'dissect_to_soap', transcript },
    });
    const soapFields = ['subjective', 'objective', 'assessment', 'plan'];
    requireTrue(
      soap.status === 200 &&
      soap.body?.success === true &&
      soap.body?.simulated === false &&
      soapFields.every((field) => nonEmptyString(soap.body?.[field])),
      'real-soap-dissection',
    );
    const soapContent = Object.fromEntries(soapFields.map((field) => [field, soap.body[field]]));
    evidence.soap.field_count = soapFields.length;
    evidence.soap.byte_count = Buffer.byteLength(canonicalJson(soapContent), 'utf8');
    evidence.soap.sha256 = sha256(canonicalJson(soapContent));
    evidence.soap.simulated = false;
    checks.real_soap_dissection_succeeded = true;

    stage = 'ledger_after_three';
    const ledgerAfterThree = ledgerSnapshot(userId);
    assertThreeProviderRows(ledgerAfterThree);
    evidence.ledger.rows_after_three_calls = ledgerAfterThree.rows.length;
    evidence.ledger.succeeded_rows = ledgerAfterThree.succeededRows;
    evidence.ledger.provider_request_hash_rows = ledgerAfterThree.providerRequestHashRows;
    evidence.ledger.summary_sha256 = ledgerAfterThree.summarySha256;
    checks.three_provider_attempts_recorded = true;

    stage = 'quota_refusal';
    const denied = await request(
      `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`,
      {
        method: 'POST',
        token,
        json: {
          prompt: 'Return one short sentence for this wholly synthetic API-cap canary.',
        },
      },
    );
    requireTrue(
      denied.status === 429 && denied.body?.code === 'api_usage_cap_reached',
      'quota-refusal',
    );
    evidence.quota.status = denied.status;
    evidence.quota.code = denied.body.code;
    evidence.quota.reset_present = nonEmptyString(denied.body?.resets_at);
    evidence.quota.retry_after_present = Number.isInteger(denied.body?.retry_after_seconds);
    requireTrue(
      evidence.quota.reset_present && evidence.quota.retry_after_present,
      'quota-retry-contract',
    );
    checks.fourth_call_refused_by_user_cap = true;

    stage = 'ledger_after_denial';
    const ledgerAfterDenial = ledgerSnapshot(userId);
    assertThreeProviderRows(ledgerAfterDenial);
    requireTrue(
      ledgerAfterDenial.summarySha256 === ledgerAfterThree.summarySha256,
      'denial-ledger-mutation',
    );
    evidence.ledger.provider_attempt_rows_after_denial = ledgerAfterDenial.rows.length;
    checks.denial_created_no_ledger_row = true;

    requireTrue(CHECK_NAMES.every((name) => checks[name] === true), 'check-completeness');
    return receipt({
      result: 'PASS',
      failureStage: null,
      checks,
      evidence,
      environment,
    });
  } catch {
    return receipt({
      result: 'FAIL',
      failureStage: stage,
      checks,
      evidence,
      environment,
    });
  }
}

export async function runProductionPatchCanary(environment = process.env) {
  return runCanary(environment);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const result = await runProductionPatchCanary();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.result !== 'PASS') process.exitCode = 1;
}
