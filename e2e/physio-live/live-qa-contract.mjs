import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PHYSIO_LIVE_QA_CONTRACT_VERSION = 'assesssuite-physio-live-qa/2.2.0';
export const PHYSIO_LIVE_QA_JOURNEY_CONTRACT_VERSION =
  'assesssuite-physio-live-qa-journey/2.0.0';
export const PHYSIO_LIVE_QA_CLEANUP_CONTRACT_VERSION =
  'assesssuite-physio-live-qa-cleanup/1.0.0';
export const PHYSIO_LIVE_QA_CLEANUP_OUTCOME =
  'synthetic_client_archived_and_children_removed';
export const PHYSIO_LIVE_QA_APPLICATION = 'assesssuite-physio-production';
export const PHYSIO_LIVE_QA_APP_ID = 'local-assesssuite-physio';
export const PHYSIO_LIVE_QA_PROFESSION_ID = 'physio';
export const PHYSIO_LIVE_QA_CATALOGUE_COUNT = 236;
export const PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION =
  'assesssuite-physio-live-self-service-provision/4.0.0';
export const PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION =
  'assesssuite-stripe-live-payment-validation/2.0.0';
export const PHYSIO_LIVE_QA_PROJECTS = Object.freeze([
  'chromium-desktop',
  'chromium-mobile',
]);
export const PHYSIO_LIVE_QA_TASK_IDS = Object.freeze([
  'physio.initial_assessment_summary.v1',
  'physio.soap_note.v1',
  'physio.management_plan.v1',
  'physio.progress_comparison.v1',
  'physio.referrer_update.v1',
  'physio.discharge_summary.v1',
]);
export const PHYSIO_LIVE_QA_ACCEPTANCE_PASSES = Object.freeze([
  'acceptance-1-fly-host',
  'acceptance-2-custom-host-post-restart',
]);

const SHA_256 = /^[0-9a-f]{64}$/;
const SHA_40 = /^[0-9a-f]{40}$/;
const IMAGE_DIGEST = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/;
const SEQUENCE_ID = /^assesssuite-physio-qa-[0-9a-f]{12}$/;
const NAMESPACE = /^physio-live-qa-[0-9a-f]{12}$/;
const SELF_SERVICE_SEQUENCE_ID = /^assesssuite-physio-self-service-[0-9a-f]{12}$/;
const SELF_SERVICE_ACCOUNT_ALIAS =
  /^[^@\s+]+\+assesssuite-physio-self-service-([0-9a-f]{12})@[^@\s]+$/i;
const PROVIDER_VALUE = /^[A-Za-z0-9._:+/-]{1,160}$/;
const PHYSIO_LIVE_QA_CHILD_ENTITY_COUNT = 6;
const PHYSIO_LIVE_QA_TEMPORARY_UPLOAD_COUNT = 2;
const TASK_RECEIPT_KEYS = Object.freeze([
  'actual_cost_microusd',
  'cached_input_tokens',
  'finish_reason',
  'input_tokens',
  'model',
  'output_tokens',
  'persistence_receipt_sha256',
  'provider',
  'provider_receipt_contract_version',
  'provider_request_id_hash',
  'provider_status',
  'status',
  'task_contract_version',
  'task_id',
  'task_version',
  'validated_output_receipt_sha256',
]);
const JOURNEY_KEYS = Object.freeze([
  'assessment_zero_score_persisted',
  'download_verified',
  'episode_created_and_reloaded',
  'episode_discharge_and_reopen_verified',
  'extraction_real_and_grounded',
  'normal_login_verified',
  'print_verified',
  'public_entry_verified',
  'structured_initial_assessment_persisted',
  'synthetic_client_archived_and_children_removed',
  'temporary_uploads_cancelled',
  'transcription_real_and_grounded',
]);
const CLEANUP_RECEIPT_KEYS = Object.freeze([
  'active_namespace_client_count',
  'archived_namespace_client_count',
  'cancel_response_deleted_count',
  'cancel_response_http_status',
  'cancel_response_status',
  'child_entity_count',
  'child_row_residue_count',
  'children_terminal_readback_sha256',
  'client_id_sha256',
  'contract_version',
  'outcome',
  'result',
  'temporary_upload_count',
  'temporary_upload_id_set_sha256',
  'terminal_upload_http_status',
  'terminal_upload_http_statuses_sha256',
  'terminal_upload_unavailable_count',
  'upload_residue_count',
]);
const PROVIDER_PATH_KEYS = Object.freeze(['extraction', 'transcription']);
const PROVIDER_PATH_RECEIPT_KEYS = Object.freeze([
  'actual_cost_microusd',
  'exact_image_canary_receipt_sha256',
  'feature',
  'fixture_sha256',
  'grounded_output_sha256',
  'model',
  'provider',
  'provider_receipt_contract_version',
  'provider_request_id_hash',
  'provider_status',
  'simulated',
  'status',
  'usage_receipt_sha256',
]);
const PROJECT_RECEIPT_KEYS = Object.freeze([
  'acceptance_pass',
  'app_id',
  'application',
  'application_sha',
  'catalogue_checksum',
  'catalogue_count',
  'completed_at',
  'console_error_count',
  'contract_version',
  'cleanup',
  'cleanup_receipt_sha256',
  'deploy_receipt_sha256',
  'dns_readback_manifest_sha256',
  'exact_image_canary_receipt_sha256',
  'expected_capabilities_manifest_sha256',
  'immutable_image',
  'journey',
  'origin',
  'page_error_count',
  'playwright_config_sha256',
  'profession_id',
  'project',
  'provider_call_count',
  'provider_cost_ceiling_microusd',
  'provider_paths',
  'prior_fly_qa_receipt_sha256',
  'qa_journey_manifest_sha256',
  'restart_receipt_sha256',
  'result',
  'self_service_provision_cleanup_ledger_sha256',
  'self_service_provision_contract_version',
  'self_service_provision_receipt_sha256',
  'self_service_payment_validation_cleanup_ledger_sha256',
  'self_service_payment_validation_contract_version',
  'self_service_payment_validation_receipt_sha256',
  'self_service_sequence_id',
  'sequence_id',
  'started_at',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
  'actual_provider_cost_microusd',
  'task_actual_cost_microusd',
  'tasks',
  'tls_certificate_receipt_sha256',
]);
const FINAL_RECEIPT_KEYS = Object.freeze([
  'acceptance_pass',
  'actual_provider_cost_microusd',
  'app_id',
  'application',
  'application_sha',
  'catalogue_checksum',
  'catalogue_count',
  'completed_at',
  'contract_version',
  'deploy_receipt_sha256',
  'exact_image_canary_receipt_sha256',
  'expected_capabilities_manifest_sha256',
  'immutable_image',
  'max_provider_cost_microusd',
  'origin',
  'playwright_config_sha256',
  'profession_id',
  'projects',
  'qa_journey_manifest_sha256',
  'result',
  'self_service_provision_cleanup_ledger_sha256',
  'self_service_provision_contract_version',
  'self_service_provision_receipt_sha256',
  'self_service_payment_validation_cleanup_ledger_sha256',
  'self_service_payment_validation_contract_version',
  'self_service_payment_validation_receipt_sha256',
  'self_service_sequence_id',
  'sequence_id',
  'started_at',
  'synthetic_account_email_sha256',
]);
const CUSTOM_FINAL_RECEIPT_KEYS = Object.freeze([
  'dns_readback_manifest_sha256',
  'prior_fly_qa_receipt_sha256',
  'restart_receipt_sha256',
  'tls_certificate_receipt_sha256',
]);
const FINAL_PROJECT_KEYS = Object.freeze([
  'actual_provider_cost_microusd',
  'archived_namespace_client_count',
  'child_row_residue_count',
  'cleanup_outcome',
  'cleanup_receipt_sha256',
  'completed_at',
  'extraction_receipt_sha256',
  'journey_receipt_sha256',
  'project',
  'provider_call_count',
  'result',
  'self_service_provision_cleanup_ledger_sha256',
  'self_service_provision_contract_version',
  'self_service_provision_receipt_sha256',
  'self_service_payment_validation_cleanup_ledger_sha256',
  'self_service_payment_validation_contract_version',
  'self_service_payment_validation_receipt_sha256',
  'self_service_sequence_id',
  'started_at',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
  'task_receipt_sha256',
  'transcription_receipt_sha256',
  'upload_residue_count',
]);

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new TypeError(`${label} fields differ`);
  }
}

function boundedPositiveInteger(environment, name, maximum) {
  const value = Number(required(environment, name));
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a bounded positive integer`);
  }
  return value;
}

function required(environment, name) {
  const value = typeof environment[name] === 'string' ? environment[name].trim() : '';
  if (!value) throw new TypeError(`${name} is required for Physio live QA`);
  return value;
}

function exactPattern(environment, name, pattern) {
  const value = required(environment, name);
  if (!pattern.test(value)) throw new TypeError(`${name} has an invalid release-bound value`);
  return value;
}

function exactSourceHash(environment, name, repoRoot, relativePath) {
  const expected = exactPattern(environment, name, SHA_256);
  const source = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, source);
  const stat = fs.lstatSync(source);
  if (
    !relative
    || relative.startsWith('..')
    || path.isAbsolute(relative)
    || !stat.isFile()
    || stat.isSymbolicLink()
    || sha256(fs.readFileSync(source)) !== expected
  ) {
    throw new TypeError(`${name} differs from the checked-out Physio live QA source`);
  }
  return expected;
}

function readSourceManifest(repoRoot, relativePath) {
  const source = path.resolve(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(source, 'utf8'));
  } catch {
    throw new TypeError(`${relativePath} is not valid JSON`);
  }
}

function assertSourceManifests(repoRoot) {
  const journey = readSourceManifest(repoRoot, 'e2e/physio-live/qa-journey-manifest.json');
  if (
    journey?.contract_version !== PHYSIO_LIVE_QA_JOURNEY_CONTRACT_VERSION
    || journey.application !== PHYSIO_LIVE_QA_APPLICATION
    || journey.app_id !== PHYSIO_LIVE_QA_APP_ID
    || journey.profession_id !== PHYSIO_LIVE_QA_PROFESSION_ID
    || journey.catalogue_count !== PHYSIO_LIVE_QA_CATALOGUE_COUNT
    || JSON.stringify(journey.browser_projects) !== JSON.stringify(PHYSIO_LIVE_QA_PROJECTS)
    || JSON.stringify(journey.account_provisioning) !== JSON.stringify({
      source: 'physio-live-self-service-provision',
      contract_version: PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION,
      provision_receipt_hash_required: true,
      immutable_provision_cleanup_ledger_hash_required: true,
      shared_sequence_suffix_hex_length: 12,
      same_account_for_both_acceptance_passes: true,
    })
    || JSON.stringify(journey.live_payment_validation) !== JSON.stringify({
      source: 'physio-live-self-service-validate-payment',
      contract_version: PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION,
      validation_receipt_hash_required: true,
      email_configuration_receipt_hash_derived_from_validation_receipt: true,
      immutable_validation_cleanup_ledger_hash_required: true,
      amount_aud_cents: 100,
      refunded_aud_cents: 100,
      shared_sequence_suffix_required: true,
    })
    || JSON.stringify(journey.physio_ai_task_ids) !== JSON.stringify(PHYSIO_LIVE_QA_TASK_IDS)
    || journey.normal_auth_only !== true
    || journey.synthetic_namespace_only !== true
    || journey.real_patient_data_allowed !== false
    || journey.ep_origin_access_allowed !== false
    || journey.cleanup_required !== true
    || journey.skipped_or_quarantined_steps_allowed !== false
  ) {
    throw new TypeError('The Physio live QA journey manifest differs from its executable contract');
  }
  const expectedCapabilities = readSourceManifest(
    repoRoot,
    'e2e/physio-live/expected-capabilities-manifest.json',
  );
  if (
    expectedCapabilities?.contract_version !== 'assesssuite-physio-live-qa-capabilities/1.0.0'
    || expectedCapabilities.profession_id !== PHYSIO_LIVE_QA_PROFESSION_ID
    || expectedCapabilities.app_id !== PHYSIO_LIVE_QA_APP_ID
    || expectedCapabilities.catalogue_count !== PHYSIO_LIVE_QA_CATALOGUE_COUNT
    || expectedCapabilities.required_dependencies_ready !== true
    || expectedCapabilities.capabilities?.general_clinical_llm?.status !== 'disabled'
    || ['physio_ai_tasks', 'transcription', 'document_extraction', 'transactional_email', 'payments']
      .some((name) => expectedCapabilities.capabilities?.[name]?.status !== 'ready')
  ) {
    throw new TypeError('The Physio live QA capabilities manifest differs from release posture');
  }
}

function exactUrl(environment) {
  const raw = required(environment, 'PHYSIO_LIVE_QA_ORIGIN').replace(/\/$/, '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError('PHYSIO_LIVE_QA_ORIGIN must be an absolute HTTPS URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new TypeError('PHYSIO_LIVE_QA_ORIGIN must be an origin-only HTTPS URL');
  }
  return raw;
}

function assertPassOrigin(acceptancePass, origin) {
  const hostname = new URL(origin).hostname.toLowerCase();
  if (
    acceptancePass === 'acceptance-1-fly-host'
    && hostname !== 'assesssuite-physio-production.fly.dev'
  ) {
    throw new TypeError('acceptance-1-fly-host must use the exact Fly provider hostname');
  }
  if (
    acceptancePass === 'acceptance-2-custom-host-post-restart'
    && hostname !== 'physio.app.assesssuite.com'
  ) {
    throw new TypeError('acceptance-2-custom-host-post-restart must use the exact custom hostname');
  }
}

export function resolvePhysioLiveQaConfiguration(environment = process.env) {
  const origin = exactUrl(environment);
  const acceptancePass = required(environment, 'PHYSIO_LIVE_QA_ACCEPTANCE_PASS');
  if (!PHYSIO_LIVE_QA_ACCEPTANCE_PASSES.includes(acceptancePass)) {
    throw new TypeError('PHYSIO_LIVE_QA_ACCEPTANCE_PASS is not an approved acceptance pass');
  }
  assertPassOrigin(acceptancePass, origin);

  const email = required(environment, 'PHYSIO_LIVE_QA_EMAIL');
  const password = required(environment, 'PHYSIO_LIVE_QA_PASSWORD');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    throw new TypeError('The named Physio live QA credential is unavailable or malformed');
  }
  const syntheticAccountEmailSha256 = exactPattern(
    environment,
    'PHYSIO_LIVE_QA_EXPECTED_EMAIL_SHA256',
    SHA_256,
  );
  if (sha256(email.toLowerCase()) !== syntheticAccountEmailSha256) {
    throw new TypeError('The named Physio live QA account differs from its intent binding');
  }
  const sequenceId = exactPattern(environment, 'PHYSIO_LIVE_QA_SEQUENCE_ID', SEQUENCE_ID);
  const namespace = exactPattern(environment, 'PHYSIO_LIVE_QA_NAMESPACE', NAMESPACE);
  const selfServiceSequenceId = exactPattern(
    environment,
    'PHYSIO_LIVE_QA_SELF_SERVICE_SEQUENCE_ID',
    SELF_SERVICE_SEQUENCE_ID,
  );
  const sequenceSuffix = sequenceId.slice(-12);
  if (
    sequenceSuffix !== namespace.slice(-12)
    || sequenceSuffix !== selfServiceSequenceId.slice(-12)
  ) {
    throw new TypeError('The Physio live QA, self-service and namespace sequence bindings differ');
  }
  const accountAlias = email.match(SELF_SERVICE_ACCOUNT_ALIAS);
  if (!accountAlias || accountAlias[1].toLowerCase() !== sequenceSuffix) {
    throw new TypeError('The Physio live QA account is not the exact self-service provision alias');
  }
  const selfServiceProvisionContractVersion = required(
    environment,
    'PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION',
  );
  if (
    selfServiceProvisionContractVersion
    !== PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION
  ) {
    throw new TypeError('The Physio live QA self-service provision contract version differs');
  }
  const selfServicePaymentValidationContractVersion = required(
    environment,
    'PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION',
  );
  if (
    selfServicePaymentValidationContractVersion
    !== PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION
  ) {
    throw new TypeError('The Physio live QA self-service payment-validation contract version differs');
  }
  const customHostPass = acceptancePass === 'acceptance-2-custom-host-post-restart';
  const customReceipt = (name) => (
    customHostPass ? exactPattern(environment, name, SHA_256) : null
  );

  const evidenceDirectory = path.resolve(
    environment.PHYSIO_LIVE_QA_EVIDENCE_DIR
      || path.join(process.cwd(), 'output', 'playwright', 'physio-live'),
  );
  const repoRoot = path.resolve(process.cwd());
  const relativeEvidence = path.relative(repoRoot, evidenceDirectory);
  if (!relativeEvidence || relativeEvidence.startsWith('..') || path.isAbsolute(relativeEvidence)) {
    throw new TypeError('PHYSIO_LIVE_QA_EVIDENCE_DIR must stay inside the repository');
  }
  assertSourceManifests(repoRoot);
  const playwrightConfigSha256 = exactSourceHash(
    environment,
    'PHYSIO_LIVE_QA_PLAYWRIGHT_CONFIG_SHA256',
    repoRoot,
    'e2e/physio-live/playwright.config.mjs',
  );
  const journeyManifestSha256 = exactSourceHash(
    environment,
    'PHYSIO_LIVE_QA_JOURNEY_MANIFEST_SHA256',
    repoRoot,
    'e2e/physio-live/qa-journey-manifest.json',
  );
  const capabilitiesManifestSha256 = exactSourceHash(
    environment,
    'PHYSIO_LIVE_QA_CAPABILITIES_MANIFEST_SHA256',
    repoRoot,
    'e2e/physio-live/expected-capabilities-manifest.json',
  );

  return Object.freeze({
    contractVersion: PHYSIO_LIVE_QA_CONTRACT_VERSION,
    application: PHYSIO_LIVE_QA_APPLICATION,
    appId: PHYSIO_LIVE_QA_APP_ID,
    professionId: PHYSIO_LIVE_QA_PROFESSION_ID,
    catalogueCount: PHYSIO_LIVE_QA_CATALOGUE_COUNT,
    origin,
    email,
    password,
    applicationSha: exactPattern(environment, 'PHYSIO_LIVE_QA_EXPECTED_SHA', SHA_40),
    immutableImage: exactPattern(environment, 'PHYSIO_LIVE_QA_EXPECTED_IMAGE', IMAGE_DIGEST),
    catalogueChecksum: exactPattern(
      environment,
      'PHYSIO_LIVE_QA_EXPECTED_CATALOGUE_CHECKSUM',
      SHA_256,
    ),
    playwrightConfigSha256,
    journeyManifestSha256,
    capabilitiesManifestSha256,
    deployReceiptSha256: exactPattern(environment, 'PHYSIO_LIVE_QA_DEPLOY_RECEIPT_SHA256', SHA_256),
    exactImageCanaryReceiptSha256: exactPattern(
      environment,
      'PHYSIO_LIVE_QA_EXACT_IMAGE_CANARY_RECEIPT_SHA256',
      SHA_256,
    ),
    providerCostCeilingMicrousd: (() => {
      const value = boundedPositiveInteger(
        environment,
        'PHYSIO_LIVE_QA_MAX_PROVIDER_COST_MICROUSD',
        2_000_000,
      );
      if (value !== 2_000_000) {
        throw new TypeError('PHYSIO_LIVE_QA_MAX_PROVIDER_COST_MICROUSD must equal its frozen intent ceiling');
      }
      return value;
    })(),
    syntheticAccountEmailSha256,
    selfServiceProvisionReceiptSha256: exactPattern(
      environment,
      'PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_RECEIPT_SHA256',
      SHA_256,
    ),
    selfServiceProvisionCleanupLedgerSha256: exactPattern(
      environment,
      'PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CLEANUP_LEDGER_SHA256',
      SHA_256,
    ),
    selfServiceProvisionContractVersion,
    selfServicePaymentValidationReceiptSha256: exactPattern(
      environment,
      'PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256',
      SHA_256,
    ),
    selfServicePaymentValidationCleanupLedgerSha256: exactPattern(
      environment,
      'PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CLEANUP_LEDGER_SHA256',
      SHA_256,
    ),
    selfServicePaymentValidationContractVersion,
    selfServiceSequenceId,
    restartReceiptSha256: customReceipt('PHYSIO_LIVE_QA_RESTART_RECEIPT_SHA256'),
    dnsReadbackManifestSha256: customReceipt('PHYSIO_LIVE_QA_DNS_READBACK_MANIFEST_SHA256'),
    tlsCertificateReceiptSha256: customReceipt('PHYSIO_LIVE_QA_TLS_CERTIFICATE_RECEIPT_SHA256'),
    priorFlyQaReceiptSha256: customReceipt('PHYSIO_LIVE_QA_PRIOR_FLY_QA_RECEIPT_SHA256'),
    sequenceId,
    namespace,
    acceptancePass,
    evidenceDirectory,
  });
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

function fragmentPath(configuration, projectName) {
  if (!PHYSIO_LIVE_QA_PROJECTS.includes(projectName)) {
    throw new TypeError(`Unsupported Physio live QA project: ${projectName}`);
  }
  return path.join(configuration.evidenceDirectory, `physio-live-qa-${projectName}.json`);
}

function assertProviderEvidence(task) {
  assertExactKeys(task, TASK_RECEIPT_KEYS, 'Physio live QA task receipt');
  if (
    task?.status !== 'PASS'
    || !PHYSIO_LIVE_QA_TASK_IDS.includes(task.task_id)
    || !PROVIDER_VALUE.test(task.task_version || '')
    || task.task_contract_version !== 'physio-ai-task-contract/2.0.0'
    || task.provider_receipt_contract_version !== 'physio-ai-provider-receipt/1.0.0'
    || !PROVIDER_VALUE.test(task.provider || '')
    || !PROVIDER_VALUE.test(task.model || '')
    || !Number.isInteger(task.provider_status)
    || task.provider_status < 200
    || task.provider_status >= 300
    || !PROVIDER_VALUE.test(task.finish_reason || '')
    || !SHA_256.test(task.provider_request_id_hash || '')
    || !Number.isSafeInteger(task.input_tokens)
    || task.input_tokens <= 0
    || !Number.isSafeInteger(task.cached_input_tokens)
    || task.cached_input_tokens < 0
    || task.cached_input_tokens > task.input_tokens
    || !Number.isSafeInteger(task.output_tokens)
    || task.output_tokens <= 0
    || !Number.isSafeInteger(task.actual_cost_microusd)
    || task.actual_cost_microusd < 0
    || !SHA_256.test(task.persistence_receipt_sha256 || '')
    || !SHA_256.test(task.validated_output_receipt_sha256 || '')
  ) {
    throw new TypeError(`Invalid provider evidence for ${task?.task_id || 'unknown task'}`);
  }
  if (/mock|fake|placeholder|fallback|simulat/i.test(`${task.provider}\n${task.model}`)) {
    throw new TypeError(`Non-production provider marker in ${task.task_id}`);
  }
}

function assertProviderPathEvidence(receipt, configuration, label) {
  assertExactKeys(receipt, PROVIDER_PATH_RECEIPT_KEYS, `Physio live QA ${label} receipt`);
  if (
    receipt.status !== 'PASS'
    || receipt.simulated !== false
    || receipt.feature !== label
    || receipt.exact_image_canary_receipt_sha256 !== configuration.exactImageCanaryReceiptSha256
    || receipt.provider_receipt_contract_version !== 'assesssuite-provider-call-receipt/1.0.0'
    || !PROVIDER_VALUE.test(receipt.provider || '')
    || !PROVIDER_VALUE.test(receipt.model || '')
    || !SHA_256.test(receipt.provider_request_id_hash || '')
    || !(
      (Number.isInteger(receipt.provider_status)
        && receipt.provider_status >= 200
        && receipt.provider_status < 300)
      || receipt.provider_status === '2xx'
    )
    || !SHA_256.test(receipt.fixture_sha256 || '')
    || !SHA_256.test(receipt.grounded_output_sha256 || '')
    || !SHA_256.test(receipt.usage_receipt_sha256 || '')
    || !Number.isSafeInteger(receipt.actual_cost_microusd)
    || receipt.actual_cost_microusd < 0
    || /mock|fake|placeholder|fallback|simulat/i.test(`${receipt.provider}\n${receipt.model}`)
  ) {
    throw new TypeError(`Physio live QA ${label} evidence differs`);
  }
}

function assertCleanupEvidence(cleanup) {
  assertExactKeys(cleanup, CLEANUP_RECEIPT_KEYS, 'Physio live QA cleanup receipt');
  if (
    cleanup.contract_version !== PHYSIO_LIVE_QA_CLEANUP_CONTRACT_VERSION
    || cleanup.result !== 'PASS'
    || cleanup.outcome !== PHYSIO_LIVE_QA_CLEANUP_OUTCOME
    || cleanup.active_namespace_client_count !== 0
    || cleanup.archived_namespace_client_count !== 1
    || cleanup.child_entity_count !== PHYSIO_LIVE_QA_CHILD_ENTITY_COUNT
    || cleanup.child_row_residue_count !== 0
    || cleanup.temporary_upload_count !== PHYSIO_LIVE_QA_TEMPORARY_UPLOAD_COUNT
    || cleanup.cancel_response_http_status !== 200
    || cleanup.cancel_response_status !== 'success'
    || cleanup.cancel_response_deleted_count !== cleanup.temporary_upload_count
    || cleanup.terminal_upload_http_status !== 404
    || cleanup.terminal_upload_unavailable_count !== cleanup.temporary_upload_count
    || cleanup.upload_residue_count !== 0
    || !SHA_256.test(cleanup.client_id_sha256 || '')
    || !SHA_256.test(cleanup.children_terminal_readback_sha256 || '')
    || !SHA_256.test(cleanup.temporary_upload_id_set_sha256 || '')
    || !SHA_256.test(cleanup.terminal_upload_http_statuses_sha256 || '')
  ) {
    throw new TypeError('Physio live QA cleanup evidence differs');
  }
}

export function validateProjectReceipt(receipt, configuration) {
  assertExactKeys(receipt, PROJECT_RECEIPT_KEYS, 'Physio live QA project receipt');
  const exact = {
    contract_version: configuration.contractVersion,
    result: 'PASS',
    application: configuration.application,
    application_sha: configuration.applicationSha,
    immutable_image: configuration.immutableImage,
    profession_id: configuration.professionId,
    app_id: configuration.appId,
    origin: configuration.origin,
    catalogue_count: configuration.catalogueCount,
    catalogue_checksum: configuration.catalogueChecksum,
    playwright_config_sha256: configuration.playwrightConfigSha256,
    qa_journey_manifest_sha256: configuration.journeyManifestSha256,
    expected_capabilities_manifest_sha256: configuration.capabilitiesManifestSha256,
    deploy_receipt_sha256: configuration.deployReceiptSha256,
    exact_image_canary_receipt_sha256: configuration.exactImageCanaryReceiptSha256,
    provider_cost_ceiling_microusd: configuration.providerCostCeilingMicrousd,
    synthetic_account_email_sha256: configuration.syntheticAccountEmailSha256,
    restart_receipt_sha256: configuration.restartReceiptSha256,
    dns_readback_manifest_sha256: configuration.dnsReadbackManifestSha256,
    tls_certificate_receipt_sha256: configuration.tlsCertificateReceiptSha256,
    prior_fly_qa_receipt_sha256: configuration.priorFlyQaReceiptSha256,
    self_service_provision_receipt_sha256: configuration.selfServiceProvisionReceiptSha256,
    self_service_provision_cleanup_ledger_sha256:
      configuration.selfServiceProvisionCleanupLedgerSha256,
    self_service_provision_contract_version: configuration.selfServiceProvisionContractVersion,
    self_service_payment_validation_receipt_sha256:
      configuration.selfServicePaymentValidationReceiptSha256,
    self_service_payment_validation_cleanup_ledger_sha256:
      configuration.selfServicePaymentValidationCleanupLedgerSha256,
    self_service_payment_validation_contract_version:
      configuration.selfServicePaymentValidationContractVersion,
    self_service_sequence_id: configuration.selfServiceSequenceId,
    sequence_id: configuration.sequenceId,
    acceptance_pass: configuration.acceptancePass,
  };
  for (const [key, value] of Object.entries(exact)) {
    if (receipt[key] !== value) throw new TypeError(`Physio live QA receipt ${key} differs`);
  }
  if (!PHYSIO_LIVE_QA_PROJECTS.includes(receipt.project)) {
    throw new TypeError('Physio live QA receipt project differs');
  }
  if (receipt.synthetic_namespace_sha256 !== sha256(configuration.namespace)) {
    throw new TypeError('Physio live QA namespace receipt differs');
  }
  assertCleanupEvidence(receipt.cleanup);
  if (
    !SHA_256.test(receipt.cleanup_receipt_sha256 || '')
    || receipt.cleanup_receipt_sha256 !== sha256(JSON.stringify(receipt.cleanup))
  ) throw new TypeError('Physio live QA cleanup receipt is missing or differs');
  const tasks = Array.isArray(receipt.tasks) ? receipt.tasks : [];
  if (tasks.length !== PHYSIO_LIVE_QA_TASK_IDS.length) {
    throw new TypeError('Physio live QA task evidence is incomplete');
  }
  tasks.forEach(assertProviderEvidence);
  if (new Set(tasks.map((task) => task.task_id)).size !== PHYSIO_LIVE_QA_TASK_IDS.length) {
    throw new TypeError('Physio live QA task evidence is duplicated');
  }
  for (const taskId of PHYSIO_LIVE_QA_TASK_IDS) {
    if (!tasks.some((task) => task.task_id === taskId)) {
      throw new TypeError(`Physio live QA task evidence missing ${taskId}`);
    }
  }
  const taskActualCostMicrousd = tasks.reduce((sum, task) => sum + task.actual_cost_microusd, 0);
  const providerPathActualCostMicrousd = Object.values(receipt.provider_paths || {})
    .reduce((sum, providerPath) => sum + Number(providerPath?.actual_cost_microusd || 0), 0);
  const actualProviderCostMicrousd = taskActualCostMicrousd + providerPathActualCostMicrousd;
  if (
    receipt.provider_call_count !== 8
    || receipt.task_actual_cost_microusd !== taskActualCostMicrousd
    || receipt.actual_provider_cost_microusd !== actualProviderCostMicrousd
    || actualProviderCostMicrousd > configuration.providerCostCeilingMicrousd
  ) {
    throw new TypeError('Physio live QA provider-call cost evidence differs');
  }
  assertExactKeys(receipt.provider_paths, PROVIDER_PATH_KEYS, 'Physio live QA provider paths');
  assertProviderPathEvidence(receipt.provider_paths.transcription, configuration, 'transcription');
  assertProviderPathEvidence(receipt.provider_paths.extraction, configuration, 'extraction');
  assertExactKeys(receipt.journey, JOURNEY_KEYS, 'Physio live QA journey receipt');
  const requiredTrue = [
    'public_entry_verified',
    'normal_login_verified',
    'assessment_zero_score_persisted',
    'episode_created_and_reloaded',
    'structured_initial_assessment_persisted',
    'episode_discharge_and_reopen_verified',
    'download_verified',
    'print_verified',
    'transcription_real_and_grounded',
    'extraction_real_and_grounded',
    'temporary_uploads_cancelled',
    'synthetic_client_archived_and_children_removed',
  ];
  for (const key of requiredTrue) {
    if (receipt.journey?.[key] !== true) throw new TypeError(`Physio live QA journey ${key} failed`);
  }
  if (
    receipt.console_error_count !== 0
    || receipt.page_error_count !== 0
    || !Number.isFinite(Date.parse(receipt.started_at || ''))
    || !Number.isFinite(Date.parse(receipt.completed_at || ''))
    || Date.parse(receipt.completed_at) < Date.parse(receipt.started_at)
  ) {
    throw new TypeError('Physio live QA runtime evidence differs');
  }
  return receipt;
}

export function writeProjectReceipt(receipt, configuration) {
  validateProjectReceipt(receipt, configuration);
  fs.mkdirSync(configuration.evidenceDirectory, { recursive: true });
  const target = fragmentPath(configuration, receipt.project);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporary, target);
  return target;
}

export function finalizePhysioLiveQaReceipt(environment = process.env) {
  const configuration = resolvePhysioLiveQaConfiguration(environment);
  const projects = PHYSIO_LIVE_QA_PROJECTS.map((projectName) => {
    const source = fragmentPath(configuration, projectName);
    if (!fs.existsSync(source)) throw new TypeError(`Missing live QA evidence for ${projectName}`);
    const project = validateProjectReceipt(JSON.parse(fs.readFileSync(source, 'utf8')), configuration);
    if (project.project !== projectName) {
      throw new TypeError(`Live QA evidence filename does not match ${projectName}`);
    }
    return project;
  });
  const receipt = {
    contract_version: configuration.contractVersion,
    result: 'PASS',
    application: configuration.application,
    application_sha: configuration.applicationSha,
    immutable_image: configuration.immutableImage,
    profession_id: configuration.professionId,
    app_id: configuration.appId,
    origin: configuration.origin,
    catalogue_count: configuration.catalogueCount,
    catalogue_checksum: configuration.catalogueChecksum,
    playwright_config_sha256: configuration.playwrightConfigSha256,
    qa_journey_manifest_sha256: configuration.journeyManifestSha256,
    expected_capabilities_manifest_sha256: configuration.capabilitiesManifestSha256,
    deploy_receipt_sha256: configuration.deployReceiptSha256,
    exact_image_canary_receipt_sha256: configuration.exactImageCanaryReceiptSha256,
    max_provider_cost_microusd: configuration.providerCostCeilingMicrousd,
    synthetic_account_email_sha256: configuration.syntheticAccountEmailSha256,
    self_service_provision_receipt_sha256: configuration.selfServiceProvisionReceiptSha256,
    self_service_provision_cleanup_ledger_sha256:
      configuration.selfServiceProvisionCleanupLedgerSha256,
    self_service_provision_contract_version: configuration.selfServiceProvisionContractVersion,
    self_service_payment_validation_receipt_sha256:
      configuration.selfServicePaymentValidationReceiptSha256,
    self_service_payment_validation_cleanup_ledger_sha256:
      configuration.selfServicePaymentValidationCleanupLedgerSha256,
    self_service_payment_validation_contract_version:
      configuration.selfServicePaymentValidationContractVersion,
    self_service_sequence_id: configuration.selfServiceSequenceId,
    sequence_id: configuration.sequenceId,
    acceptance_pass: configuration.acceptancePass,
    projects: projects.map((project) => ({
      project: project.project,
      result: project.result,
      synthetic_namespace_sha256: project.synthetic_namespace_sha256,
      task_receipt_sha256: sha256(JSON.stringify(project.tasks)),
      transcription_receipt_sha256: sha256(JSON.stringify(project.provider_paths.transcription)),
      extraction_receipt_sha256: sha256(JSON.stringify(project.provider_paths.extraction)),
      journey_receipt_sha256: sha256(JSON.stringify(project.journey)),
      cleanup_outcome: project.cleanup.outcome,
      archived_namespace_client_count: project.cleanup.archived_namespace_client_count,
      child_row_residue_count: project.cleanup.child_row_residue_count,
      upload_residue_count: project.cleanup.upload_residue_count,
      cleanup_receipt_sha256: project.cleanup_receipt_sha256,
      actual_provider_cost_microusd: project.actual_provider_cost_microusd,
      provider_call_count: project.provider_call_count,
      self_service_provision_receipt_sha256:
        project.self_service_provision_receipt_sha256,
      self_service_provision_cleanup_ledger_sha256:
        project.self_service_provision_cleanup_ledger_sha256,
      self_service_provision_contract_version:
        project.self_service_provision_contract_version,
      self_service_payment_validation_receipt_sha256:
        project.self_service_payment_validation_receipt_sha256,
      self_service_payment_validation_cleanup_ledger_sha256:
        project.self_service_payment_validation_cleanup_ledger_sha256,
      self_service_payment_validation_contract_version:
        project.self_service_payment_validation_contract_version,
      self_service_sequence_id: project.self_service_sequence_id,
      synthetic_account_email_sha256: project.synthetic_account_email_sha256,
      started_at: project.started_at,
      completed_at: project.completed_at,
    })),
    started_at: projects.map((project) => project.started_at).sort()[0],
    completed_at: projects.map((project) => project.completed_at).sort().at(-1),
    actual_provider_cost_microusd: projects.reduce(
      (sum, project) => sum + project.actual_provider_cost_microusd,
      0,
    ),
    ...(configuration.acceptancePass === 'acceptance-2-custom-host-post-restart'
      ? {
          prior_fly_qa_receipt_sha256: configuration.priorFlyQaReceiptSha256,
          restart_receipt_sha256: configuration.restartReceiptSha256,
          dns_readback_manifest_sha256: configuration.dnsReadbackManifestSha256,
          tls_certificate_receipt_sha256: configuration.tlsCertificateReceiptSha256,
        }
      : {}),
  };
  if (receipt.actual_provider_cost_microusd > configuration.providerCostCeilingMicrousd) {
    throw new TypeError('Physio live QA aggregate provider cost exceeded its intent ceiling');
  }
  assertExactKeys(
    receipt,
    configuration.acceptancePass === 'acceptance-2-custom-host-post-restart'
      ? [...FINAL_RECEIPT_KEYS, ...CUSTOM_FINAL_RECEIPT_KEYS]
      : FINAL_RECEIPT_KEYS,
    'Physio live QA final receipt',
  );
  for (const project of receipt.projects) {
    assertExactKeys(project, FINAL_PROJECT_KEYS, 'Physio live QA final project receipt');
  }
  const target = path.join(configuration.evidenceDirectory, 'physio-live-qa-receipt.json');
  fs.writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`);
  fs.writeFileSync(
    path.join(configuration.evidenceDirectory, 'SHA256SUMS'),
    `${sha256(fs.readFileSync(target))}  ${path.basename(target)}\n`,
  );
  return target;
}

export function cleanupTransientPhysioLiveQaEvidence(environment = process.env) {
  const configuration = resolvePhysioLiveQaConfiguration(environment);
  for (const projectName of PHYSIO_LIVE_QA_PROJECTS) {
    fs.rmSync(fragmentPath(configuration, projectName), { force: true });
  }
  fs.rmSync(path.join(configuration.evidenceDirectory, 'artifacts'), { recursive: true, force: true });
  fs.rmSync(path.join(configuration.evidenceDirectory, 'playwright-results.json'), { force: true });
}
