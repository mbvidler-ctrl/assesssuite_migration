import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readAndValidatePhysioExactImageCanarySuccessPacket,
} from './physio-exact-image-canary-contract.mjs';
import { validatePhysioSentryReleasePacket } from './physio-sentry-release-contract.mjs';
import { validateCompletedStripeWebhookPacket } from './physio-stripe-webhook-evidence.mjs';

const HASH_RE = /^[0-9a-f]{64}$/;
const PREFIXED_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ID_RE = /^[1-9][0-9]*$/;
const IMAGE_RE = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/;
const SAFE_INTENT_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const SAFE_AUTHORITY_RE = /^[A-Za-z0-9._:/-]{1,240}$/;
const FLY_HANDLER = 'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook';
const WEBHOOK_EVENTS = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'invoice.payment_failed',
]);

const RELEASE_SOURCE_PATHS = Object.freeze({
  live_qa_contract: 'e2e/physio-live/live-qa-contract.mjs',
  live_qa_spec: 'e2e/physio-live/physio-live.spec.mjs',
  live_qa_journey_manifest: 'e2e/physio-live/qa-journey-manifest.json',
  expected_capabilities_manifest: 'e2e/physio-live/expected-capabilities-manifest.json',
  live_qa_playwright_config: 'e2e/physio-live/playwright.config.mjs',
  live_qa_global_setup: 'e2e/physio-live/global-setup.mjs',
  live_qa_global_teardown: 'e2e/physio-live/global-teardown.mjs',
  exact_image_canary_fixture: 'scripts/physio-exact-image-canary-fixture.mjs',
  exact_image_canary_runner: 'scripts/physio-exact-image-canary.mjs',
  exact_image_canary_contract: 'scripts/physio-exact-image-canary-contract.mjs',
  exact_image_canary_success_contract: 'scripts/physio-exact-image-canary-success-contract.mjs',
  exact_image_canary_workflow: '.github/workflows/physio-production-exact-image-canary.yml',
  exact_image_canary_contract_test: 'server/tests/physio-exact-image-canary.test.mjs',
  exact_image_canary_success_contract_test: 'server/tests/physio-exact-image-canary-success-contract.test.mjs',
  exact_image_canary_workflow_test: 'server/tests/physio-exact-image-canary-workflow.test.mjs',
  oci_image_contract: 'scripts/physio-oci-image.mjs',
  deploy_admission: 'scripts/physio-deploy-admission.mjs',
  github_artifact_admission: 'scripts/github-artifact-admission.mjs',
  stripe_webhook_evidence: 'scripts/physio-stripe-webhook-evidence.mjs',
  stripe_webhook_ledger: 'scripts/physio-webhook-ledger.mjs',
  stripe_webhook_archive_workflow: '.github/workflows/physio-production-webhook-archive.yml',
  stripe_webhook_ledger_test: 'server/tests/physio-webhook-ledger.test.mjs',
  exact_image_canary_audio: 'server/tests/fixtures/physio-exact-image-canary/synthetic-physio-canary.wav',
  upload_registry: 'server/uploadRegistry.mjs',
  synthetic_fixtures: 'server/tests/support/synthetic-fixtures.mjs',
  referral_extraction_schema: 'src/lib/referralExtractionSchema.js',
  referral_workflow: 'src/lib/referralWorkflow.js',
  live_qa_contract_test: 'server/tests/physio-live-qa-contract.test.mjs',
  self_service_contract: 'e2e/physio-live-self-service/self-service-contract.mjs',
  self_service_provision: 'e2e/physio-live-self-service/provision.spec.mjs',
  trusted_browser_checkout: 'e2e/physio-live-self-service/trusted-browser-checkout.mjs',
  stripe_live_readback: 'e2e/physio-live-self-service/stripe-live-readback.mjs',
  stripe_live_payment_validation: 'e2e/physio-live-self-service/stripe-live-payment-validation.mjs',
  validate_payment: 'e2e/physio-live-self-service/validate-payment.mjs',
  self_service_finalize: 'e2e/physio-live-self-service/finalize.spec.mjs',
  self_service_resume_cleanup: 'e2e/physio-live-self-service/resume-cleanup.mjs',
  email_provider_readback: 'e2e/physio-live-self-service/email-provider-readback.mjs',
  journey_support: 'e2e/physio-live-self-service/journey-support.mjs',
  self_service_global_setup: 'e2e/physio-live-self-service/global-setup.mjs',
  self_service_global_teardown: 'e2e/physio-live-self-service/global-teardown.mjs',
  self_service_playwright_config: 'e2e/physio-live-self-service/playwright.config.mjs',
  self_service_journey_manifest: 'e2e/physio-live-self-service/journey-manifest.json',
  stripe_gateway: 'server/stripeGateway.mjs',
  create_checkout_session: 'server/functions/createCheckoutSession.mjs',
  package_json: 'package.json',
  package_lock: 'package-lock.json',
  self_service_wrapper: 'scripts/run-physio-live-self-service.mjs',
  self_service_contract_test: 'server/tests/physio-live-self-service-contract.test.mjs',
  live_payment_validation_contract_test: 'server/tests/physio-live-payment-validation-contract.test.mjs',
  server_harness: 'server/tests/support/server-harness.mjs',
  offline_runtime_fixture: 'e2e/physio-offline-journey/runtime-fixture.mjs',
  offline_vite_child: 'e2e/physio-offline-journey/vite-child.mjs',
  offline_journey_spec: 'e2e/physio-offline-journey/physio-offline-journey.spec.mjs',
  physio_vite_config: 'apps/app-physio/vite.config.js',
  shared_app_config: 'apps/_shared/makeAppConfig.mjs',
  root_vite_config: 'vite.config.js',
  route_utils: 'src/utils/index.ts',
  calendar_page: 'src/pages/Calendar.jsx',
  test_runner_page: 'src/pages/TestRunner.jsx',
  assessment_runner_router: 'src/components/assessments/AssessmentTestRunnerRouter.jsx',
  assessment_return_routing_contract_test: 'server/tests/assessment-return-routing-contract.test.mjs',
});

function fail(message) {
  throw new Error(`Physio deploy admission: ${message}`);
}

function hashBytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hashFile(file) {
  return hashBytes(fs.readFileSync(file));
}

function readJson(file, maximumBytes = 1_048_576) {
  const resolved = path.resolve(file || '');
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > maximumBytes) {
    fail(`invalid JSON file ${path.basename(resolved)}`);
  }
  const bytes = fs.readFileSync(resolved);
  if (bytes.includes(13) || bytes.at(-1) !== 10 || bytes.at(-2) === 10) {
    fail(`${path.basename(resolved)} is not canonical single-LF JSON`);
  }
  return JSON.parse(bytes.toString('utf8'));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} key set differs`);
  }
}

function requireHash(value, label, prefixed = false) {
  if (!(prefixed ? PREFIXED_HASH_RE : HASH_RE).test(value || '')) fail(`${label} differs`);
}

function env(name) {
  const value = process.env[name] || '';
  if (!value) fail(`missing ${name}`);
  return value;
}

function same(value, expected, label) {
  if (value !== expected) fail(`${label} differs`);
}

export function readPhysioSentryDeployCapability(packet) {
  const phase = readJson(path.join(path.resolve(packet || ''), 'sentry-phase-packet', 'sentry-phase.json'));
  if (!SAFE_INTENT_RE.test(phase.capability_intent_id || '') ||
      !SAFE_AUTHORITY_RE.test(phase.authority_reference || '')) {
    fail('Sentry phase child capability or authority differs');
  }
  return {
    capabilityIntentId: phase.capability_intent_id,
    authorityReference: phase.authority_reference,
  };
}

function validatePublication(file, packet) {
  const row = readJson(file);
  exactKeys(row, [
    'application', 'application_sha', 'archive_sha256', 'authority_reference',
    'bootstrap_artifact_digest', 'bootstrap_artifact_id', 'bootstrap_authority_reference',
    'bootstrap_capability_binding_sha256', 'bootstrap_capability_intent_id', 'bootstrap_receipt_sha256',
    'byte_identical_candidate_verified', 'canary_artifact_digest', 'canary_artifact_id',
    'canary_authority_reference', 'canary_capability_binding_sha256',
    'canary_capability_intent_id', 'canary_receipt_sha256',
    'candidate_artifact_digest', 'candidate_artifact_id', 'candidate_receipt_sha256',
    'canonical_oci_manifest_and_blobs_verified', 'capability_intent_id', 'completed_at',
    'contract_version', 'custom_certificate_count', 'effect_generation',
    'effect_reconciliation_receipt_sha256',
    'fly_hostname_precedes_custom_dns', 'fly_webhook_secret_digest', 'github_artifact_admission_sha256', 'image_digest',
    'immutable_image', 'local_image_id', 'machine_count', 'oci_archive_sha256',
    'oci_descriptor_manifest_sha256', 'oci_manifest_digest', 'prior_effect_readback_sha256',
    'prior_effect_receipt_sha256', 'prior_effect_resolution', 'profession_id',
    'publication_payload_sha256', 'publication_request_sha256', 'publisher_tool',
    'registry_protocol_final_sha256', 'registry_readback_sha256', 'registry_tag',
    'release_execution_source_sha256', 'result', 'sentry_release_artifact_digest',
    'sentry_release_artifact_id', 'sentry_release_receipt_sha256', 'started_effect_receipt_sha256',
    'stripe_api_version', 'stripe_signing_secret_sha256', 'stripe_webhook_archive_artifact_digest',
    'stripe_webhook_archive_artifact_id', 'stripe_webhook_archive_receipt_sha256',
    'stripe_webhook_enabled_events', 'stripe_webhook_endpoint',
    'stripe_webhook_endpoint_id', 'stripe_webhook_receipt_sha256', 'stripe_webhook_secret_staged',
    'stripe_webhook_authority_reference', 'stripe_webhook_capability_binding_sha256',
    'stripe_webhook_capability_intent_id', 'stripe_webhook_ledger_commit_sha',
    'stripe_webhook_ledger_packet_manifest_sha256', 'stripe_webhook_ledger_record_sha256',
    'stripe_webhook_source_artifact_digest', 'stripe_webhook_source_artifact_id',
    'webhook_provider_request_id_hashes_sha256',
  ], 'publication receipt');
  same(row.contract_version, 'assesssuite-physio-image-publication/3.0.0', 'publication contract');
  same(row.result, 'PASS', 'publication result');
  same(row.application, 'assesssuite-physio-production', 'publication application');
  same(row.application_sha, env('APPLICATION_SHA'), 'publication application SHA');
  same(row.profession_id, 'physio', 'publication profession');
  same(row.immutable_image, env('IMMUTABLE_IMAGE'), 'publication immutable image');
  if (!IMAGE_RE.test(row.immutable_image)) fail('publication immutable image shape differs');
  same(row.image_digest, row.immutable_image.split('@')[1], 'publication image digest');
  same(row.oci_manifest_digest, row.image_digest, 'publication OCI manifest digest');
  if (!ID_RE.test(row.candidate_artifact_id || '') || !PREFIXED_HASH_RE.test(row.candidate_artifact_digest || '')) {
    fail('publication candidate artifact identity differs');
  }
  for (const [id, digest, label] of [
    [row.canary_artifact_id, row.canary_artifact_digest, 'canary'],
    [row.bootstrap_artifact_id, row.bootstrap_artifact_digest, 'bootstrap'],
    [row.stripe_webhook_archive_artifact_id, row.stripe_webhook_archive_artifact_digest,
      'webhook archive'],
    [String(row.stripe_webhook_source_artifact_id), row.stripe_webhook_source_artifact_digest,
      'webhook archive source'],
  ]) {
    if (!ID_RE.test(id || '') || !PREFIXED_HASH_RE.test(digest || '')) {
      fail(`publication ${label} artifact identity differs`);
    }
  }
  same(row.canary_receipt_sha256, env('CANARY_RECEIPT_SHA256'), 'publication canary receipt');
  requireHash(row.canary_capability_binding_sha256,
    'publication canary capability binding SHA');
  same(row.bootstrap_receipt_sha256, env('PRODUCTION_BOOTSTRAP_RECEIPT_SHA256'), 'publication bootstrap receipt');
  same(row.stripe_webhook_archive_artifact_id, env('STRIPE_WEBHOOK_ARTIFACT_ID'),
    'publication webhook archive artifact ID');
  same(row.stripe_webhook_archive_artifact_digest, env('STRIPE_WEBHOOK_ARTIFACT_DIGEST'),
    'publication webhook archive artifact digest');
  same(row.stripe_webhook_archive_receipt_sha256, env('PHYSIO_STRIPE_WEBHOOK_ARCHIVE_RECEIPT_SHA256'),
    'publication webhook archive receipt');
  same(row.stripe_webhook_receipt_sha256, env('STRIPE_WEBHOOK_RECEIPT_SHA256'), 'publication webhook receipt');
  same(String(row.stripe_webhook_source_artifact_id), env('PHYSIO_STRIPE_WEBHOOK_SOURCE_ARTIFACT_ID'),
    'publication original webhook artifact ID');
  same(row.stripe_webhook_source_artifact_digest, env('PHYSIO_STRIPE_WEBHOOK_SOURCE_ARTIFACT_DIGEST'),
    'publication original webhook artifact digest');
  same(row.stripe_webhook_ledger_commit_sha, env('PHYSIO_STRIPE_WEBHOOK_LEDGER_COMMIT_SHA'),
    'publication webhook ledger commit');
  same(row.stripe_webhook_ledger_record_sha256, env('PHYSIO_STRIPE_WEBHOOK_LEDGER_RECORD_SHA256'),
    'publication webhook ledger record');
  same(row.stripe_webhook_ledger_packet_manifest_sha256,
    env('PHYSIO_STRIPE_WEBHOOK_LEDGER_PACKET_MANIFEST_SHA256'),
    'publication webhook ledger packet manifest');
  same(row.sentry_release_artifact_id, env('SENTRY_RELEASE_ARTIFACT_ID'), 'publication Sentry artifact ID');
  same(row.sentry_release_artifact_digest, env('SENTRY_RELEASE_ARTIFACT_DIGEST'), 'publication Sentry artifact digest');
  same(row.sentry_release_receipt_sha256, env('SENTRY_RELEASE_RECEIPT_SHA256'), 'publication Sentry receipt');
  if (!SAFE_INTENT_RE.test(row.capability_intent_id || '') ||
      !SAFE_AUTHORITY_RE.test(row.authority_reference || '') ||
      row.capability_intent_id === env('CAPABILITY_INTENT_ID')) {
    fail('publication child capability or authority differs');
  }
  for (const [intent, authority, label] of [
    [row.canary_capability_intent_id, row.canary_authority_reference, 'canary'],
    [row.bootstrap_capability_intent_id, row.bootstrap_authority_reference, 'bootstrap'],
    [row.stripe_webhook_capability_intent_id, row.stripe_webhook_authority_reference, 'webhook'],
  ]) {
    if (!SAFE_INTENT_RE.test(intent || '') || !SAFE_AUTHORITY_RE.test(authority || '') ||
        intent === env('CAPABILITY_INTENT_ID') || intent === row.capability_intent_id) {
      fail(`publication ${label} child capability or authority differs`);
    }
  }
  if (new Set([row.canary_capability_intent_id, row.bootstrap_capability_intent_id,
    row.stripe_webhook_capability_intent_id]).size !== 3) {
    fail('canary, bootstrap and webhook child capabilities are collapsed');
  }
  for (const [value, label, prefixed] of [
    [row.archive_sha256, 'archive SHA', true], [row.oci_archive_sha256, 'OCI archive SHA', true],
    [row.oci_descriptor_manifest_sha256, 'OCI descriptor receipt SHA', false],
    [row.local_image_id, 'local image ID', true], [row.registry_readback_sha256, 'registry readback SHA', false],
    [row.registry_protocol_final_sha256, 'registry protocol SHA', false],
    [row.started_effect_receipt_sha256, 'publication STARTED SHA', false],
    [row.effect_reconciliation_receipt_sha256, 'publication reconciliation SHA', false],
    [row.github_artifact_admission_sha256, 'publication GitHub artifact admission SHA', false],
    [row.stripe_signing_secret_sha256, 'Stripe signing-secret SHA', false],
    [row.webhook_provider_request_id_hashes_sha256, 'webhook request-ID SHA', false],
    [row.bootstrap_capability_binding_sha256, 'bootstrap capability binding SHA', false],
    [row.stripe_webhook_capability_binding_sha256, 'webhook capability binding SHA', false],
    [row.publication_payload_sha256, 'publication payload SHA', false],
    [row.publication_request_sha256, 'publication request SHA', false],
    [row.prior_effect_receipt_sha256, 'publication predecessor effect SHA', false],
    [row.stripe_webhook_archive_receipt_sha256, 'webhook archive receipt SHA', false],
    [row.stripe_webhook_ledger_record_sha256, 'webhook ledger record SHA', false],
    [row.stripe_webhook_ledger_packet_manifest_sha256, 'webhook ledger packet manifest SHA', false],
  ]) requireHash(value, label, prefixed);
  if (!/^[0-9a-f]{40}$/.test(row.stripe_webhook_ledger_commit_sha || '')) {
    fail('publication webhook ledger commit differs');
  }
  if (!/^[0-9a-f]{16,64}$/.test(row.fly_webhook_secret_digest || '') ||
      row.machine_count !== 0 || row.custom_certificate_count !== 0 ||
      row.fly_hostname_precedes_custom_dns !== true || row.byte_identical_candidate_verified !== true ||
      row.canonical_oci_manifest_and_blobs_verified !== true || row.stripe_webhook_secret_staged !== true ||
      row.stripe_webhook_endpoint !== FLY_HANDLER || row.stripe_api_version !== '2026-07-29.dahlia' ||
      JSON.stringify(row.stripe_webhook_enabled_events) !== JSON.stringify(WEBHOOK_EVENTS) ||
      row.publisher_tool?.name !== 'regctl' || row.publisher_tool?.version !== 'v0.11.5' ||
      !Number.isSafeInteger(row.effect_generation) || row.effect_generation < 0 ||
      !['NOT_APPLICABLE', 'NOT_COMMITTED_BY_AUTHORITATIVE_ABSENCE', 'COMMITTED_EXACT']
        .includes(row.prior_effect_resolution) ||
      (row.prior_effect_resolution === 'NOT_APPLICABLE' && row.prior_effect_readback_sha256 !== null) ||
      (row.prior_effect_resolution !== 'NOT_APPLICABLE' && !HASH_RE.test(row.prior_effect_readback_sha256 || '')) ||
      row.publisher_tool?.sha256 !== 'c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467') {
    fail('publication proof differs');
  }
  const expectedSources = Object.fromEntries(Object.entries(RELEASE_SOURCE_PATHS).map(([key, source]) => [key, hashFile(source)]));
  if (JSON.stringify(row.release_execution_source_sha256) !== JSON.stringify(expectedSources)) {
    fail('publication execution source graph differs');
  }
  const bootstrapCapability = {
    authority_reference: row.bootstrap_authority_reference,
    capability_intent_id: row.bootstrap_capability_intent_id,
    receipt_sha256: row.bootstrap_receipt_sha256,
    scope: 'fly-bootstrap',
  };
  const webhookCapability = {
    authority_reference: row.stripe_webhook_authority_reference,
    capability_intent_id: row.stripe_webhook_capability_intent_id,
    effect_receipt_sha256: null,
    receipt_sha256: row.stripe_webhook_receipt_sha256,
    scope: 'stripe-webhook',
  };
  const webhookReceipt = readJson(path.join(env('WEBHOOK_PACKET'), 'physio-production-stripe-webhook.json'));
  webhookCapability.effect_receipt_sha256 = webhookReceipt.effect_reconciliation_receipt_sha256;
  same(hashBytes(JSON.stringify(bootstrapCapability)), row.bootstrap_capability_binding_sha256,
    'publication bootstrap capability binding');
  same(hashBytes(JSON.stringify(webhookCapability)), row.stripe_webhook_capability_binding_sha256,
    'publication webhook capability binding');
  const payload = {
    action: 'publish-byte-identical-candidate-to-immutable-registry',
    application: 'assesssuite-physio-production', application_sha: row.application_sha,
    archive_sha256: row.archive_sha256, authority_reference: row.authority_reference,
    bootstrap_artifact_digest: row.bootstrap_artifact_digest,
    bootstrap_artifact_id: row.bootstrap_artifact_id,
    bootstrap_receipt_sha256: row.bootstrap_receipt_sha256,
    canary_artifact_digest: row.canary_artifact_digest, canary_artifact_id: row.canary_artifact_id,
    canary_authority_reference: row.canary_authority_reference,
    canary_capability_binding_sha256: row.canary_capability_binding_sha256,
    canary_capability_intent_id: row.canary_capability_intent_id,
    canary_receipt_sha256: row.canary_receipt_sha256,
    candidate_artifact_digest: row.candidate_artifact_digest,
    candidate_artifact_id: row.candidate_artifact_id,
    candidate_receipt_sha256: row.candidate_receipt_sha256,
    capability_intent_id: row.capability_intent_id, local_image_id: row.local_image_id,
    oci_archive_sha256: row.oci_archive_sha256,
    oci_descriptor_manifest_sha256: row.oci_descriptor_manifest_sha256,
    oci_manifest_digest: row.oci_manifest_digest, registry_tag: row.registry_tag,
    stripe_webhook_archive_artifact_digest: row.stripe_webhook_archive_artifact_digest,
    stripe_webhook_archive_artifact_id: row.stripe_webhook_archive_artifact_id,
    stripe_webhook_archive_receipt_sha256: row.stripe_webhook_archive_receipt_sha256,
    stripe_webhook_receipt_sha256: row.stripe_webhook_receipt_sha256,
  };
  same(hashBytes(JSON.stringify(payload)), row.publication_payload_sha256,
    'publication canonical payload SHA');
  const request = {
    authority_reference: row.authority_reference,
    capability_intent_id: row.capability_intent_id,
    effect_generation: row.effect_generation,
    prior_effect_receipt_sha256: row.prior_effect_receipt_sha256,
    publication_payload_sha256: row.publication_payload_sha256,
  };
  same(hashBytes(JSON.stringify(request)), row.publication_request_sha256,
    'publication canonical request SHA');
  const zero = '0'.repeat(64);
  if ((row.effect_generation === 0 && (row.prior_effect_receipt_sha256 !== zero ||
      row.prior_effect_resolution !== 'NOT_APPLICABLE')) ||
      (row.effect_generation > 0 && (row.prior_effect_receipt_sha256 === zero ||
      row.prior_effect_resolution === 'NOT_APPLICABLE'))) {
    fail('publication effect-generation lineage differs');
  }
  const descriptor = readJson(path.join(packet, 'registry-descriptor-readback.json'));
  const protocol = readJson(path.join(packet, 'registry-protocol-final.json'));
  same(hashFile(path.join(packet, 'registry-descriptor-readback.json')), row.registry_readback_sha256, 'registry descriptor receipt SHA');
  same(hashFile(path.join(packet, 'registry-protocol-final.json')), row.registry_protocol_final_sha256, 'registry protocol receipt SHA');
  same(descriptor.immutable_image, row.immutable_image, 'registry descriptor immutable image');
  same(descriptor.manifest_digest, row.image_digest, 'registry descriptor manifest');
  if (descriptor.exact_manifest_and_all_blobs_verified !== true || protocol.result !== 'PASS') fail('registry exact-byte proof differs');
  return row;
}

function validateBootstrap(file, publication) {
  const row = readJson(file);
  same(row.contract_version, 'assesssuite-physio-bootstrap/3.0.0', 'bootstrap contract');
  same(row.result, 'PASS', 'bootstrap result');
  same(row.application, 'assesssuite-physio-production', 'bootstrap application');
  same(row.application_sha, env('APPLICATION_SHA'), 'bootstrap application SHA');
  same(row.profession_id, 'physio', 'bootstrap profession');
  same(row.region, 'syd', 'bootstrap region');
  same(row.volume_id, env('EXPECTED_VOLUME_ID'), 'bootstrap volume');
  same(row.archive_sha256, publication.archive_sha256, 'bootstrap archive');
  same(row.oci_archive_sha256, publication.oci_archive_sha256, 'bootstrap OCI archive');
  same(row.oci_manifest_digest, publication.oci_manifest_digest, 'bootstrap OCI manifest');
  same(row.oci_descriptor_manifest_sha256, publication.oci_descriptor_manifest_sha256, 'bootstrap OCI descriptor');
  same(row.local_image_id, publication.local_image_id, 'bootstrap local image');
  same(row.exact_image_canary_receipt_sha256, env('CANARY_RECEIPT_SHA256'), 'bootstrap canary');
  same(row.capability_intent_id, publication.bootstrap_capability_intent_id,
    'bootstrap upstream capability intent');
  same(row.authority_reference, publication.bootstrap_authority_reference,
    'bootstrap upstream authority');
  const names = ['ADMIN_PASSWORD', 'APP_URL', 'EXPECTED_APP_URL', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'SENTRY_DSN',
    'STRIPE_PRICE_ID_ANNUAL', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_SECRET_KEY'].sort();
  if (row.machine_count !== 0 || row.custom_certificate_count !== 0 || row.production_ready !== false ||
      row.webhook_secret_pending !== true || row.app_url_equals_expected_app_url !== true ||
      row.volume_name !== 'assesssuite_physio_data' || row.volume_size_gb !== 3 ||
      row.volume_snapshot_retention_days !== 5 || row.scheduled_snapshots !== true ||
      JSON.stringify(row.staged_secret_names) !== JSON.stringify(names) ||
      JSON.stringify(row.observed_secret_names) !== JSON.stringify(names)) fail('bootstrap proof differs');
  for (const field of ['started_effect_receipt_sha256', 'bootstrap_effect_reconciliation_sha256',
    'organization_readback_sha256', 'secret_bundle_fingerprint_sha256', 'machines_readback_sha256',
    'volumes_readback_sha256', 'secret_names_readback_sha256']) requireHash(row[field], `bootstrap ${field}`);
  return row;
}

function validateWebhook(file, packet, publication) {
  const row = readJson(file);
  same(row.contract_version, 'assesssuite-physio-stripe-webhook-bootstrap/1.0.0', 'webhook contract');
  same(row.result, 'PASS', 'webhook result');
  same(row.application, 'assesssuite-physio-production', 'webhook application');
  same(row.application_sha, env('APPLICATION_SHA'), 'webhook application SHA');
  same(row.profession_id, 'physio', 'webhook profession');
  same(row.bootstrap_receipt_sha256, env('PRODUCTION_BOOTSTRAP_RECEIPT_SHA256'), 'webhook bootstrap receipt');
  same(row.exact_image_canary_receipt_sha256, env('CANARY_RECEIPT_SHA256'), 'webhook canary receipt');
  same(row.stripe_webhook_endpoint, FLY_HANDLER, 'webhook endpoint');
  same(row.stripe_api_version, '2026-07-29.dahlia', 'webhook API version');
  same(row.capability_intent_id, publication.stripe_webhook_capability_intent_id,
    'webhook upstream capability intent');
  same(row.authority_reference, publication.stripe_webhook_authority_reference,
    'webhook upstream authority');
  if (!['restricted_live', 'secret_live'].includes(row.stripe_credential_mode) || row.provider_endpoint_count !== 1 ||
      row.stripe_webhook_secret_staged !== true || row.production_ready_for_publication !== true ||
      !Number.isSafeInteger(row.effect_generation) || row.effect_generation < 0 ||
      JSON.stringify(row.enabled_events) !== JSON.stringify(WEBHOOK_EVENTS)) fail('webhook proof differs');
  for (const field of ['admission_receipt_sha256', 'request_sha256', 'started_effect_receipt_sha256',
    'effect_identity_receipt_sha256',
    'effect_reconciliation_receipt_sha256', 'provider_endpoint_readback_sha256',
    'fly_secret_names_readback_sha256', 'stripe_signing_secret_sha256', 'provider_request_id_hashes_sha256']) {
    requireHash(row[field], `webhook ${field}`);
  }
  if (!/^[0-9a-f]{16,64}$/.test(row.fly_webhook_secret_digest || '')) fail('webhook staged digest differs');
  validateCompletedStripeWebhookPacket(packet, {
    applicationSha: env('APPLICATION_SHA'),
    authorityReference: row.authority_reference,
    bootstrapReceiptSha256: env('PRODUCTION_BOOTSTRAP_RECEIPT_SHA256'),
    capabilityIntentId: row.capability_intent_id,
    canaryReceiptSha256: env('CANARY_RECEIPT_SHA256'),
    effectReceiptSha256: row.effect_reconciliation_receipt_sha256,
  });
  return row;
}

function main() {
  const publicationPacket = path.resolve(env('PUBLICATION_PACKET'));
  const canaryPacket = path.resolve(env('CANARY_PACKET'));
  const bootstrapPacket = path.resolve(env('BOOTSTRAP_PACKET'));
  const webhookPacket = path.resolve(env('WEBHOOK_PACKET'));
  const sentryPacket = path.resolve(env('SENTRY_PACKET'));
  const publicationFile = path.join(publicationPacket, 'physio-production-publication.json');
  const canaryFile = path.join(canaryPacket, 'physio-exact-image-canary.json');
  const bootstrapFile = path.join(bootstrapPacket, 'physio-production-bootstrap.json');
  const webhookFile = path.join(webhookPacket, 'physio-production-stripe-webhook.json');
  const sentryFile = path.join(sentryPacket, 'physio-sentry-release.json');
  for (const [file, expected, label] of [
    [publicationFile, env('PUBLICATION_RECEIPT_SHA256'), 'publication'],
    [canaryFile, env('CANARY_RECEIPT_SHA256'), 'canary'],
    [bootstrapFile, env('PRODUCTION_BOOTSTRAP_RECEIPT_SHA256'), 'bootstrap'],
    [webhookFile, env('STRIPE_WEBHOOK_RECEIPT_SHA256'), 'webhook'],
    [sentryFile, env('SENTRY_RELEASE_RECEIPT_SHA256'), 'Sentry release'],
  ]) same(hashFile(file), expected, `${label} raw receipt SHA`);
  const publication = validatePublication(publicationFile, publicationPacket);
  const canaryProof = readAndValidatePhysioExactImageCanarySuccessPacket(canaryPacket, {
    expectedApplicationSha: env('APPLICATION_SHA'),
    expectedImmutableImage: publication.local_image_id,
    expectedCandidateArchiveSha256: publication.archive_sha256,
    expectedCanaryReceiptSha256: env('CANARY_RECEIPT_SHA256'),
    expectedCandidateArtifactId: Number(publication.candidate_artifact_id),
    expectedCandidateArtifactDigest: publication.candidate_artifact_digest,
    expectedCandidateReceiptSha256: publication.candidate_receipt_sha256,
    expectedCapabilityBindingSha256: publication.canary_capability_binding_sha256,
    maximumCostMicrousd: 5_000_000,
  });
  same(canaryProof.receipts.providerAdmission.capability_intent_id,
    publication.canary_capability_intent_id, 'publication canary child intent');
  same(canaryProof.receipts.providerAdmission.authority_reference,
    publication.canary_authority_reference, 'publication canary child authority');
  validateBootstrap(bootstrapFile, publication);
  const webhook = validateWebhook(webhookFile, webhookPacket, publication);
  same(publication.stripe_webhook_endpoint_id, webhook.stripe_webhook_endpoint_id, 'publication webhook endpoint ID');
  same(publication.stripe_signing_secret_sha256, webhook.stripe_signing_secret_sha256, 'publication signing-secret hash');
  same(publication.fly_webhook_secret_digest, webhook.fly_webhook_secret_digest, 'publication Fly webhook-secret digest');
  const sentryReceipt = readJson(sentryFile);
  const sentryCapability = readPhysioSentryDeployCapability(sentryPacket);
  if (
      [publication.capability_intent_id, publication.canary_capability_intent_id,
        publication.bootstrap_capability_intent_id, publication.stripe_webhook_capability_intent_id,
        env('CAPABILITY_INTENT_ID')].includes(sentryCapability.capabilityIntentId)) {
    fail('Sentry child capability or authority differs');
  }
  validatePhysioSentryReleasePacket(sentryPacket, {
    applicationSha: env('APPLICATION_SHA'),
    capabilityIntentId: sentryCapability.capabilityIntentId,
    authorityReference: sentryCapability.authorityReference,
  });
  const output = env('GITHUB_ENV_PATH');
  fs.appendFileSync(output, [
    `PHYSIO_DEPLOY_ARCHIVE_SHA256=${publication.archive_sha256}`,
    `PHYSIO_DEPLOY_OCI_ARCHIVE_SHA256=${publication.oci_archive_sha256}`,
    `PHYSIO_DEPLOY_OCI_MANIFEST_DIGEST=${publication.oci_manifest_digest}`,
    `PHYSIO_DEPLOY_OCI_DESCRIPTOR_MANIFEST_SHA256=${publication.oci_descriptor_manifest_sha256}`,
    `PHYSIO_DEPLOY_LOCAL_IMAGE_ID=${publication.local_image_id}`,
    `PHYSIO_DEPLOY_STRIPE_WEBHOOK_ENDPOINT_ID=${webhook.stripe_webhook_endpoint_id}`,
    `PHYSIO_DEPLOY_FLY_WEBHOOK_SECRET_DIGEST=${webhook.fly_webhook_secret_digest}`,
    `PHYSIO_DEPLOY_SENTRY_SOURCE_MAP_MANIFEST_SHA256=${sentryReceipt.source_map_manifest_sha256}`,
    `PHYSIO_DEPLOY_SENTRY_SOURCE_MAP_ARCHIVE_SHA256=${sentryReceipt.source_map_archive_sha256}`,
    `PHYSIO_DEPLOY_PUBLICATION_CAPABILITY_INTENT_ID=${publication.capability_intent_id}`,
    `PHYSIO_DEPLOY_PUBLICATION_AUTHORITY_REFERENCE=${publication.authority_reference}`,
    `PHYSIO_DEPLOY_CANARY_CAPABILITY_INTENT_ID=${publication.canary_capability_intent_id}`,
    `PHYSIO_DEPLOY_CANARY_AUTHORITY_REFERENCE=${publication.canary_authority_reference}`,
    `PHYSIO_DEPLOY_BOOTSTRAP_CAPABILITY_INTENT_ID=${publication.bootstrap_capability_intent_id}`,
    `PHYSIO_DEPLOY_BOOTSTRAP_AUTHORITY_REFERENCE=${publication.bootstrap_authority_reference}`,
    `PHYSIO_DEPLOY_STRIPE_WEBHOOK_CAPABILITY_INTENT_ID=${webhook.capability_intent_id}`,
    `PHYSIO_DEPLOY_STRIPE_WEBHOOK_AUTHORITY_REFERENCE=${webhook.authority_reference}`,
    `PHYSIO_DEPLOY_SENTRY_CAPABILITY_INTENT_ID=${sentryCapability.capabilityIntentId}`,
    `PHYSIO_DEPLOY_SENTRY_AUTHORITY_REFERENCE=${sentryCapability.authorityReference}`,
  ].join('\n') + '\n', 'utf8');
  process.stdout.write('{"result":"PASS"}\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  }
}
