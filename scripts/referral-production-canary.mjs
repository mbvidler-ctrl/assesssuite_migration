// Privacy-safe production canary for the referral extraction journey.
//
// This command is intended to be invoked inside the exact Fly release image.
// It starts a second loopback-only server whose SQLite database and upload
// directory live under a newly-created operating-system temporary directory.
// The installed @base44/sdk then exercises the real upload -> extract ->
// practitioner review -> client/document persistence path. Only the in-memory
// repository-generated synthetic PDF is sent to the production provider.
// The live production server, database and upload volume are never addressed.
//
// Standard output is a single, fixed-schema, content-free JSON record. Raw
// provider output, fixture text, identifiers, request bodies, server output,
// errors and secrets are deliberately never emitted.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { createClient } from '@base44/sdk';

import { DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK } from '../server/documentExtraction.mjs';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../server/uploadRegistry.mjs';
import {
  CANONICAL_REFERRAL_PROFILE_A,
  pdfFixture,
} from '../server/tests/support/synthetic-fixtures.mjs';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../src/lib/referralExtractionSchema.js';
import {
  buildReferralClientData,
  buildReferralConditionData,
  prepareReferralReviewData,
} from '../src/lib/referralReview.js';
import {
  buildReviewedReferralCommitPayload,
  commitReviewedReferral,
  createReferralCommitIdempotencyKey,
} from '../src/lib/referralCommit.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE,
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../src/lib/referralWorkflow.js';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from '../server/tests/support/server-harness.mjs';
export {
  CANARY_NAME,
  CANARY_SCHEMA_VERSION,
  CHECK_NAMES,
  FAILURE_STAGES,
  REQUIRED_CANARY_ACKNOWLEDGEMENT,
  SYNTHETIC_REFERRAL_FILENAME,
} from './referral-production-canary-contract.mjs';
import {
  CANARY_NAME,
  CANARY_SCHEMA_VERSION,
  CHECK_NAMES,
  REQUIRED_CANARY_ACKNOWLEDGEMENT,
  SYNTHETIC_REFERRAL_FILENAME,
} from './referral-production-canary-contract.mjs';

const RELEASE_SHA_RE = /^[0-9a-f]{40}$/;
const PRODUCTION_DATA_ROOT = path.resolve('/app/server/data');

function emptyChecks() {
  return Object.fromEntries(CHECK_NAMES.map((name) => [name, false]));
}

function pathIsInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeReleaseSha(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return RELEASE_SHA_RE.test(normalized) ? normalized : null;
}

function extractionIsGrounded(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
  if (typeof output.full_name !== 'string' || output.full_name.trim().toLowerCase() !== 'alex river') return false;
  if (output.date_of_birth !== CANONICAL_REFERRAL_PROFILE_A.date_of_birth) return false;
  if (output.referral_source !== CANONICAL_REFERRAL_PROFILE_A.referral_source) return false;
  if (typeof output.referral_source_name !== 'string' || !output.referral_source_name.toLowerCase().includes('synthetic')) return false;
  if (typeof output.primary_condition !== 'string' || !output.primary_condition.toLowerCase().includes('ankle sprain')) return false;
  if (!Array.isArray(output.comorbidities)) return false;
  if (!output.comorbidities.some((value) => String(value).trim().toLowerCase().includes('asthma'))) return false;
  if (typeof output.primary_gp_name !== 'string' || !output.primary_gp_name.toLowerCase().includes('synthetic')) return false;
  return !/mock|placeholder|dummy|unknown patient/i.test(JSON.stringify(output));
}

export function productionCanaryGates(env = process.env) {
  return Object.freeze({
    explicit_acknowledgement:
      env.RUN_REFERRAL_PRODUCTION_CANARY === REQUIRED_CANARY_ACKNOWLEDGEMENT,
    paid_provider_gate: env.ALLOW_PAID_PROVIDER_PROBE === '1',
    production_runtime: env.NODE_ENV === 'production',
    release_identity_present: Boolean(safeReleaseSha(env.RELEASE_SHA)),
    extraction_enabled: env.DOCUMENT_EXTRACTION_ENABLED === '1',
    health_data_terms_confirmed: env.OPENAI_HEALTH_DATA_TERMS_CONFIRMED === '1',
    provider_credential_present:
      typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.trim().length > 0,
    provider_override_absent: !env.DOCUMENT_EXTRACTION_TEST_BASE_URL,
    model_override_absent: !env.OPENAI_DOCUMENT_EXTRACTION_MODEL,
  });
}

function allTrue(record) {
  return Object.values(record).every((value) => value === true);
}

function buildSummary({
  result,
  failureStage,
  releaseSha,
  fixtureSha256,
  checks,
}) {
  return {
    schema_version: CANARY_SCHEMA_VERSION,
    canary: CANARY_NAME,
    observed_at_utc: new Date().toISOString(),
    release_sha: safeReleaseSha(releaseSha),
    result,
    failure_stage: failureStage,
    fixture: {
      provenance: 'repository-generated-synthetic-pdf',
      requested_filename_contract: true,
      byte_sha256: fixtureSha256,
    },
    isolation: {
      database: 'temporary',
      uploads: 'temporary',
      production_database_writes: 0,
      production_upload_writes: 0,
      external_email_sends: 0,
      temporary_storage_removed: checks.temporary_storage_removed,
    },
    checks,
  };
}

function providerEnvironment({ providerMode, testProviderBaseUrl }) {
  const common = {
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_USER_PER_MINUTE: '60',
    DOCUMENT_EXTRACTION_ORG_PER_MINUTE: '180',
    DOCUMENT_EXTRACTION_USER_DAILY_DOCUMENTS: '500',
    DOCUMENT_EXTRACTION_ORG_DAILY_DOCUMENTS: '2000',
    DOCUMENT_EXTRACTION_USER_DAILY_COST_USD: '10',
    DOCUMENT_EXTRACTION_ORG_DAILY_COST_USD: '20',
    DOCUMENT_EXTRACTION_MONTHLY_CIRCUIT_USD: '29',
    DOCUMENT_EXTRACTION_ESTIMATED_COST_PER_DOCUMENT_USD: '0.01',
    UPLOAD_USER_PER_MINUTE: '60',
    UPLOAD_ORG_PER_MINUTE: '240',
    // SELFTEST disables real email even if a future harness change were to
    // alter environment precedence. Clearing the key is defence in depth.
    RESEND_API_KEY: '',
  };

  if (providerMode === 'production-probe') {
    return {
      ...common,
      DOCUMENT_EXTRACTION_TEST_BASE_URL: '',
      DOCUMENT_EXTRACTION_PROVIDER_PROBE: '1',
      DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK,
    };
  }

  if (providerMode === 'local-test' && typeof testProviderBaseUrl === 'string') {
    return {
      ...common,
      DOCUMENT_EXTRACTION_TEST_BASE_URL: testProviderBaseUrl,
      DOCUMENT_EXTRACTION_PROVIDER_PROBE: '',
      DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK: '',
      OPENAI_API_KEY: 'synthetic-referral-canary-test-key',
      OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
    };
  }

  throw new Error('unsupported canary provider mode');
}

/**
 * Executes the journey and returns only the fixed-schema, content-free
 * summary. `local-test` exists solely so the isolation and SDK orchestration
 * can be regression-tested without a paid provider call.
 */
export async function runIsolatedReferralCanary({
  providerMode,
  testProviderBaseUrl,
  releaseSha,
  gatesAccepted = providerMode === 'production-probe',
} = {}) {
  const fixtureBytes = pdfFixture();
  const fixtureSha256 = createHash('sha256').update(fixtureBytes).digest('hex');
  const checks = emptyChecks();
  checks.gates_accepted = Boolean(gatesAccepted);
  checks.real_provider_mode = providerMode === 'production-probe';

  let stage = 'start_isolated_server';
  let server = null;
  let sdk = null;
  let tempRoot = null;
  let failed = false;
  let failureStage = null;

  try {
    server = await startTestServer(providerEnvironment({ providerMode, testProviderBaseUrl }));
    tempRoot = server.tempRoot;
    checks.temporary_paths_isolated =
      pathIsInside(tempRoot, server.dbPath) &&
      pathIsInside(tempRoot, server.uploadsDir) &&
      !pathIsInside(PRODUCTION_DATA_ROOT, server.dbPath) &&
      !pathIsInside(PRODUCTION_DATA_ROOT, server.uploadsDir);
    if (!checks.temporary_paths_isolated) throw new Error('isolation check failed');

    stage = 'authenticate';
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-referral-canary@example.test');
    await activateUser(server, adminToken, user.id);
    const organisation = await createOrganizationForUser(server, adminToken, user);

    stage = 'legal_acceptance';
    const acceptance = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organisation.id, marketing_opt_in: false } },
    );
    if (acceptance.status !== 200) throw new Error('acceptance failed');

    stage = 'sdk_authentication';
    sdk = createClient({
      appId: server.appId,
      serverUrl: server.baseUrl,
      token: user.token,
      requiresAuth: false,
    });
    const currentUser = await sdk.auth.me();
    checks.installed_sdk_authenticated = currentUser?.email === user.email;
    if (!checks.installed_sdk_authenticated) throw new Error('sdk auth failed');

    stage = 'organisation_resolution';
    const memberships = await sdk.entities.OrganizationMember.filter({ user_email: currentUser.email });
    const currentMembership = memberships.find((membership) => membership.is_primary) || memberships[0];
    checks.primary_organisation_resolved = currentMembership?.org_id === organisation.id;
    if (!checks.primary_organisation_resolved) throw new Error('organisation resolution failed');

    const clientsBefore = await sdk.entities.Client.filter({ org_id: organisation.id });

    stage = 'upload';
    const upload = await sdk.integrations.Core.UploadFile({
      file: new File([fixtureBytes], SYNTHETIC_REFERRAL_FILENAME, { type: 'application/pdf' }),
      org_id: organisation.id,
      purpose: 'referral-extraction',
      processing_authority_confirmed: true,
      processing_authority_attestation_version:
        REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      subject_age_confirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
      subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
    });
    checks.upload_registered = /^\/uploads\/[0-9a-f-]+$/i.test(upload?.file_url || '');
    if (!checks.upload_registered || typeof upload?.upload_id !== 'string') {
      throw new Error('upload registration failed');
    }

    stage = 'extraction';
    const extraction = await sdk.integrations.Core.ExtractDataFromUploadedFile({
      org_id: organisation.id,
      file_urls: [upload.file_url],
      json_schema: REFERRAL_EXTRACTION_SCHEMA,
      processing_authority_confirmed: true,
      processing_authority_attestation_version:
        REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    });
    checks.extraction_grounded = extraction?.status === 'success' && extractionIsGrounded(extraction.output);
    if (!checks.extraction_grounded) throw new Error('extraction grounding failed');

    const clientsAfterExtraction = await sdk.entities.Client.filter({ org_id: organisation.id });
    checks.no_client_before_review = clientsAfterExtraction.length === clientsBefore.length;
    if (!checks.no_client_before_review) throw new Error('pre-review write detected');

    stage = 'audit_verification';
    const auditDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const uploadRow = auditDb.prepare(`
        SELECT original_name, sha256, lifecycle_state
        FROM upload_registry
        WHERE id = ?
      `).get(upload.upload_id);
      checks.requested_filename_registered =
        uploadRow?.original_name === SYNTHETIC_REFERRAL_FILENAME && uploadRow?.sha256 === fixtureSha256;

      const registeredAudit = auditDb.prepare(`
        SELECT metadata_json
        FROM upload_audit
        WHERE upload_id = ? AND event_type = 'upload_registered' AND outcome = 'success'
      `).get(upload.upload_id);
      let registeredMetadata = null;
      try {
        registeredMetadata = registeredAudit ? JSON.parse(registeredAudit.metadata_json) : null;
      } catch {
        registeredMetadata = null;
      }
      checks.age_attestation_provenance_recorded =
        registeredMetadata?.subject_age_attestation_source === REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE &&
        registeredMetadata?.subject_age_attestation_version === REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION &&
        registeredMetadata?.subject_age_band === REFERRAL_SUBJECT_AGE_CONFIRMATION &&
        registeredMetadata?.processing_authority_attestation_source ===
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE &&
        registeredMetadata?.processing_authority_attestation_version ===
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION &&
        registeredMetadata?.processing_authority_confirmed === true &&
        !Object.keys(registeredMetadata || {}).some((key) => /date.of.birth|dob/i.test(key));

      const auditRows = auditDb.prepare(`
        SELECT outcome, metadata_json
        FROM upload_audit
        WHERE upload_id = ? AND event_type = 'document_extraction'
      `).all(upload.upload_id);
      const successfulAudit = auditRows.find((row) => row.outcome === 'success');
      let metadata = null;
      try {
        metadata = successfulAudit ? JSON.parse(successfulAudit.metadata_json) : null;
      } catch {
        metadata = null;
      }
      checks.extraction_provider_contacted =
        metadata?.provider_contact_attempted === true && metadata?.provider_status_class === '2xx';
      checks.canonical_schema_verified = metadata?.schema_hash === REFERRAL_EXTRACTION_SCHEMA_SHA256;
      checks.provider_policy_enforced =
        metadata?.request_store_disabled === true &&
        metadata?.request_background_disabled === true &&
        metadata?.request_prompt_cache_in_memory === true &&
        metadata?.request_tools_disabled === true &&
        metadata?.request_inline_only === true &&
        metadata?.request_conversation_state_disabled === true;
    } finally {
      auditDb.close();
    }
    if (
      !checks.requested_filename_registered ||
      !checks.age_attestation_provenance_recorded ||
      !checks.extraction_provider_contacted ||
      !checks.canonical_schema_verified ||
      !checks.provider_policy_enforced
    ) {
      throw new Error('audit verification failed');
    }

    stage = 'review_persistence';
    const reviewedData = prepareReferralReviewData({
      ...extraction.output,
      full_name: `${extraction.output.full_name} — Practitioner Reviewed`,
      // The synthetic provider fixture omits gender. This explicit canary-only
      // value represents the practitioner's mandatory review of that field.
      gender: 'other',
    });
    const commitPayload = buildReviewedReferralCommitPayload({
      idempotencyKey: createReferralCommitIdempotencyKey(),
      orgId: organisation.id,
      operation: 'create',
      client: buildReferralClientData(reviewedData),
      conditions: buildReferralConditionData(reviewedData),
      uploadIds: [upload.upload_id],
    });
    const commitResult = await commitReviewedReferral(sdk, commitPayload);
    const replayResult = await commitReviewedReferral(sdk, commitPayload);
    const clientsAfterReview = await sdk.entities.Client.filter({ org_id: organisation.id });
    const reviewedClient = clientsAfterReview.find((client) => client.id === commitResult.client_id);
    const retainedDocuments = await sdk.entities.ClientDocument.filter({
      org_id: organisation.id,
      client_id: commitResult.client_id,
    });
    const retainedDocument = retainedDocuments[0];
    checks.reviewed_client_created =
      commitResult.status === 'success' &&
      commitResult.operation === 'create' &&
      replayResult.client_id === commitResult.client_id &&
      clientsAfterReview.length === clientsBefore.length + 1 &&
      reviewedClient?.org_id === organisation.id &&
      reviewedClient?.assigned_clinician_email === currentUser.email;
    checks.document_retained =
      commitResult.counts?.documents_retained === 1 &&
      retainedDocuments.length === 1 &&
      retainedDocument?.org_id === organisation.id &&
      retainedDocument?.file_url === upload.file_url;
    if (!checks.reviewed_client_created || !checks.document_retained) {
      throw new Error('review persistence failed');
    }

    stage = 'retention_verification';
    const retentionDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const retainedUpload = retentionDb.prepare(`
        SELECT lifecycle_state, bound_entity_type, bound_entity_id
        FROM upload_registry
        WHERE id = ?
      `).get(upload.upload_id);
      const receipt = retentionDb.prepare(`
        SELECT client_id
        FROM referral_commit_receipt
        WHERE idempotency_key = ?
      `).get(commitPayload.idempotency_key);
      checks.upload_bound =
        retainedUpload?.lifecycle_state === 'bound' &&
        retainedUpload?.bound_entity_type === 'ClientDocument' &&
        retainedUpload?.bound_entity_id === retainedDocument.id &&
        receipt?.client_id === commitResult.client_id;
    } finally {
      retentionDb.close();
    }
    if (!checks.upload_bound) throw new Error('retention verification failed');
  } catch {
    failed = true;
    failureStage = stage;
  } finally {
    try {
      sdk?.cleanup();
    } catch {
      failed = true;
      failureStage ||= 'cleanup';
    }
    if (server) {
      try {
        await server.stop();
      } catch {
        failed = true;
        failureStage ||= 'cleanup';
      }
    }
    checks.temporary_storage_removed = Boolean(tempRoot) && !fs.existsSync(tempRoot);
    if (!checks.temporary_storage_removed) {
      failed = true;
      failureStage ||= 'cleanup';
    }
  }

  const productionCheckPass = CHECK_NAMES.every((name) => checks[name] === true);
  const testCheckPass = CHECK_NAMES
    .filter((name) => name !== 'real_provider_mode')
    .every((name) => checks[name] === true);
  const passed = !failed && (providerMode === 'production-probe' ? productionCheckPass : testCheckPass);

  return buildSummary({
    result: passed ? 'PASS' : 'FAIL',
    failureStage: passed ? null : failureStage || 'cleanup',
    releaseSha,
    fixtureSha256,
    checks,
  });
}

export async function runProductionReferralCanary(env = process.env) {
  const fixtureSha256 = createHash('sha256').update(pdfFixture()).digest('hex');
  const gates = productionCanaryGates(env);
  if (!allTrue(gates)) {
    return buildSummary({
      result: 'REFUSED',
      failureStage: 'gate',
      releaseSha: env.RELEASE_SHA,
      fixtureSha256,
      checks: emptyChecks(),
    });
  }
  return runIsolatedReferralCanary({
    providerMode: 'production-probe',
    releaseSha: env.RELEASE_SHA,
    gatesAccepted: true,
  });
}

async function main() {
  const summary = await runProductionReferralCanary();
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.result === 'REFUSED') process.exitCode = 2;
  else if (summary.result !== 'PASS') process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) await main();
