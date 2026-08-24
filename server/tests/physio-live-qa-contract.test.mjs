import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  PHYSIO_LIVE_QA_CLEANUP_CONTRACT_VERSION,
  PHYSIO_LIVE_QA_CLEANUP_OUTCOME,
  PHYSIO_LIVE_QA_ACCEPTANCE_PASSES,
  PHYSIO_LIVE_QA_JOURNEY_CONTRACT_VERSION,
  PHYSIO_LIVE_QA_PROJECTS,
  PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION,
  PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION,
  PHYSIO_LIVE_QA_TASK_IDS,
  finalizePhysioLiveQaReceipt,
  resolvePhysioLiveQaConfiguration,
  sha256,
  validateProjectReceipt,
  writeProjectReceipt,
} from '../../e2e/physio-live/live-qa-contract.mjs';

const REPO_ROOT = process.cwd();
const E2E_ROOT = path.join(REPO_ROOT, 'e2e', 'physio-live');
const SHA = 'a'.repeat(40);
const DIGEST = `registry.fly.io/assesssuite-physio-production@sha256:${'b'.repeat(64)}`;
const CHECKSUM = 'c'.repeat(64);
const SELF_SERVICE_EMAIL =
  'synthetic+assesssuite-physio-self-service-123456abcdef@example.test';

function environment(overrides = {}) {
  return {
    PHYSIO_LIVE_QA_ORIGIN: 'https://assesssuite-physio-production.fly.dev',
    PHYSIO_LIVE_QA_ACCEPTANCE_PASS: 'acceptance-1-fly-host',
    PHYSIO_LIVE_QA_EMAIL: SELF_SERVICE_EMAIL,
    PHYSIO_LIVE_QA_PASSWORD: 'Synthetic-Live-QA-Password-1!',
    PHYSIO_LIVE_QA_EXPECTED_EMAIL_SHA256: sha256(SELF_SERVICE_EMAIL),
    PHYSIO_LIVE_QA_EXPECTED_SHA: SHA,
    PHYSIO_LIVE_QA_EXPECTED_IMAGE: DIGEST,
    PHYSIO_LIVE_QA_EXPECTED_CATALOGUE_CHECKSUM: CHECKSUM,
    PHYSIO_LIVE_QA_PLAYWRIGHT_CONFIG_SHA256: sha256(
      fs.readFileSync(path.join(E2E_ROOT, 'playwright.config.mjs')),
    ),
    PHYSIO_LIVE_QA_JOURNEY_MANIFEST_SHA256: sha256(
      fs.readFileSync(path.join(E2E_ROOT, 'qa-journey-manifest.json')),
    ),
    PHYSIO_LIVE_QA_CAPABILITIES_MANIFEST_SHA256: sha256(
      fs.readFileSync(path.join(E2E_ROOT, 'expected-capabilities-manifest.json')),
    ),
    PHYSIO_LIVE_QA_DEPLOY_RECEIPT_SHA256: 'f'.repeat(64),
    PHYSIO_LIVE_QA_EXACT_IMAGE_CANARY_RECEIPT_SHA256: '1'.repeat(64),
    PHYSIO_LIVE_QA_MAX_PROVIDER_COST_MICROUSD: '2000000',
    PHYSIO_LIVE_QA_SEQUENCE_ID: 'assesssuite-physio-qa-123456abcdef',
    PHYSIO_LIVE_QA_NAMESPACE: 'physio-live-qa-123456abcdef',
    PHYSIO_LIVE_QA_SELF_SERVICE_SEQUENCE_ID:
      'assesssuite-physio-self-service-123456abcdef',
    PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION:
      PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION,
    PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_RECEIPT_SHA256: '2'.repeat(64),
    PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CLEANUP_LEDGER_SHA256: '3'.repeat(64),
    PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION:
      PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION,
    PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256: '4'.repeat(64),
    PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CLEANUP_LEDGER_SHA256:
      '5'.repeat(64),
    ...overrides,
  };
}

function providerReceipt(taskId) {
  return {
    status: 'PASS',
    task_id: taskId,
    task_version: `${taskId}/schema-1.0.0`,
    task_contract_version: 'physio-ai-task-contract/2.0.0',
    provider_receipt_contract_version: 'physio-ai-provider-receipt/1.0.0',
    provider: 'openai',
    model: 'gpt-production-model',
    provider_status: 200,
    finish_reason: 'stop',
    provider_request_id_hash: 'd'.repeat(64),
    input_tokens: 10,
    cached_input_tokens: 1,
    output_tokens: 5,
    actual_cost_microusd: 1,
    persistence_receipt_sha256: 'e'.repeat(64),
    validated_output_receipt_sha256: '2'.repeat(64),
  };
}

function providerPathReceipt(configuration, feature) {
  return {
    status: 'PASS',
    feature,
    simulated: false,
    provider_receipt_contract_version: 'assesssuite-provider-call-receipt/1.0.0',
    provider: 'openai',
    model: feature === 'transcription' ? 'whisper-1' : 'gpt-4.1-mini-2025-04-14',
    provider_status: feature === 'transcription' ? 200 : '2xx',
    provider_request_id_hash: '3'.repeat(64),
    actual_cost_microusd: 1,
    usage_receipt_sha256: '4'.repeat(64),
    exact_image_canary_receipt_sha256: configuration.exactImageCanaryReceiptSha256,
    fixture_sha256: '5'.repeat(64),
    grounded_output_sha256: '6'.repeat(64),
  };
}

function cleanupReceipt() {
  return {
    contract_version: PHYSIO_LIVE_QA_CLEANUP_CONTRACT_VERSION,
    result: 'PASS',
    outcome: PHYSIO_LIVE_QA_CLEANUP_OUTCOME,
    client_id_sha256: '7'.repeat(64),
    active_namespace_client_count: 0,
    archived_namespace_client_count: 1,
    child_entity_count: 6,
    child_row_residue_count: 0,
    children_terminal_readback_sha256: '8'.repeat(64),
    temporary_upload_count: 2,
    temporary_upload_id_set_sha256: '9'.repeat(64),
    cancel_response_http_status: 200,
    cancel_response_status: 'success',
    cancel_response_deleted_count: 2,
    terminal_upload_http_status: 404,
    terminal_upload_http_statuses_sha256: 'a'.repeat(64),
    terminal_upload_unavailable_count: 2,
    upload_residue_count: 0,
  };
}

function projectReceipt(configuration, project) {
  const cleanup = cleanupReceipt();
  return {
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
    project,
    synthetic_namespace_sha256: sha256(configuration.namespace),
    tasks: PHYSIO_LIVE_QA_TASK_IDS.map(providerReceipt),
    provider_paths: {
      transcription: providerPathReceipt(configuration, 'transcription'),
      extraction: providerPathReceipt(configuration, 'extraction'),
    },
    provider_call_count: 8,
    task_actual_cost_microusd: 6,
    actual_provider_cost_microusd: 8,
    journey: {
      public_entry_verified: true,
      normal_login_verified: true,
      assessment_zero_score_persisted: true,
      episode_created_and_reloaded: true,
      structured_initial_assessment_persisted: true,
      episode_discharge_and_reopen_verified: true,
      download_verified: true,
      print_verified: true,
      transcription_real_and_grounded: true,
      extraction_real_and_grounded: true,
      temporary_uploads_cancelled: true,
      synthetic_client_archived_and_children_removed: true,
    },
    cleanup,
    cleanup_receipt_sha256: sha256(JSON.stringify(cleanup)),
    console_error_count: 0,
    page_error_count: 0,
    started_at: '2026-08-22T01:00:00.000Z',
    completed_at: '2026-08-22T01:10:00.000Z',
  };
}

test('live QA configuration binds exact host passes, release identity, projects and synthetic namespace', () => {
  const journeyManifest = JSON.parse(
    fs.readFileSync(path.join(E2E_ROOT, 'qa-journey-manifest.json'), 'utf8'),
  );
  assert.equal(
    journeyManifest.contract_version,
    PHYSIO_LIVE_QA_JOURNEY_CONTRACT_VERSION,
  );
  const fly = resolvePhysioLiveQaConfiguration(environment());
  assert.equal(fly.origin, 'https://assesssuite-physio-production.fly.dev');
  assert.equal(fly.acceptancePass, 'acceptance-1-fly-host');
  assert.equal(fly.catalogueCount, 236);
  assert.equal(fly.applicationSha, SHA);
  assert.equal(fly.immutableImage, DIGEST);
  assert.equal(
    fly.selfServiceProvisionContractVersion,
    'assesssuite-physio-live-self-service-provision/4.0.0',
  );
  assert.equal(fly.selfServiceProvisionReceiptSha256, '2'.repeat(64));
  assert.equal(fly.selfServiceProvisionCleanupLedgerSha256, '3'.repeat(64));
  assert.equal(
    fly.selfServicePaymentValidationContractVersion,
    PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION,
  );
  assert.equal(fly.selfServicePaymentValidationReceiptSha256, '4'.repeat(64));
  assert.equal(fly.selfServicePaymentValidationCleanupLedgerSha256, '5'.repeat(64));
  assert.equal(
    fly.selfServiceSequenceId,
    'assesssuite-physio-self-service-123456abcdef',
  );
  assert.deepEqual(PHYSIO_LIVE_QA_PROJECTS, ['chromium-desktop', 'chromium-mobile']);
  assert.deepEqual(PHYSIO_LIVE_QA_ACCEPTANCE_PASSES, [
    'acceptance-1-fly-host',
    'acceptance-2-custom-host-post-restart',
  ]);
  assert.deepEqual(PHYSIO_LIVE_QA_TASK_IDS, [
    'physio.initial_assessment_summary.v1',
    'physio.soap_note.v1',
    'physio.management_plan.v1',
    'physio.progress_comparison.v1',
    'physio.referrer_update.v1',
    'physio.discharge_summary.v1',
  ]);

  const custom = resolvePhysioLiveQaConfiguration(environment({
    PHYSIO_LIVE_QA_ORIGIN: 'https://physio.app.assesssuite.com',
    PHYSIO_LIVE_QA_ACCEPTANCE_PASS: 'acceptance-2-custom-host-post-restart',
    PHYSIO_LIVE_QA_PRIOR_FLY_QA_RECEIPT_SHA256: '8'.repeat(64),
    PHYSIO_LIVE_QA_RESTART_RECEIPT_SHA256: '9'.repeat(64),
    PHYSIO_LIVE_QA_DNS_READBACK_MANIFEST_SHA256: 'a'.repeat(64),
    PHYSIO_LIVE_QA_TLS_CERTIFICATE_RECEIPT_SHA256: 'b'.repeat(64),
  }));
  assert.equal(custom.origin, 'https://physio.app.assesssuite.com');

  for (const overrides of [
    { PHYSIO_LIVE_QA_ORIGIN: 'http://assesssuite-physio-production.fly.dev' },
    { PHYSIO_LIVE_QA_ORIGIN: 'https://physio.app.assesssuite.com' },
    { PHYSIO_LIVE_QA_EXPECTED_SHA: 'main' },
    { PHYSIO_LIVE_QA_EXPECTED_IMAGE: 'registry.fly.io/assesssuite-physio-production:latest' },
    { PHYSIO_LIVE_QA_PASSWORD: 'too-short' },
    { PHYSIO_LIVE_QA_EXPECTED_EMAIL_SHA256: '0'.repeat(64) },
    { PHYSIO_LIVE_QA_NAMESPACE: 'production' },
    { PHYSIO_LIVE_QA_NAMESPACE: 'physio-live-qa-abcdef123456' },
    {
      PHYSIO_LIVE_QA_EMAIL:
        'unrelated+assesssuite-physio-self-service-abcdef123456@example.test',
      PHYSIO_LIVE_QA_EXPECTED_EMAIL_SHA256: sha256(
        'unrelated+assesssuite-physio-self-service-abcdef123456@example.test',
      ),
    },
    {
      PHYSIO_LIVE_QA_SELF_SERVICE_SEQUENCE_ID:
        'assesssuite-physio-self-service-abcdef123456',
    },
    { PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION: 'legacy/1.0.0' },
    { PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_RECEIPT_SHA256: 'not-a-hash' },
    { PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CLEANUP_LEDGER_SHA256: 'not-a-hash' },
    { PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION: 'legacy/1.0.0' },
    { PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256: 'not-a-hash' },
    {
      PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CLEANUP_LEDGER_SHA256:
        'not-a-hash',
    },
    { PHYSIO_LIVE_QA_MAX_PROVIDER_COST_MICROUSD: '2000001' },
  ]) {
    assert.throws(() => resolvePhysioLiveQaConfiguration(environment(overrides)));
  }
});

test('project receipts require all real provider tasks, ordinary journey proofs and zero browser errors', () => {
  const configuration = resolvePhysioLiveQaConfiguration(environment());
  const valid = projectReceipt(configuration, 'chromium-desktop');
  assert.equal(validateProjectReceipt(valid, configuration), valid);

  const missingTask = structuredClone(valid);
  missingTask.tasks.pop();
  assert.throws(() => validateProjectReceipt(missingTask, configuration), /incomplete/);

  const simulated = structuredClone(valid);
  simulated.tasks[0].provider = 'mock-provider';
  assert.throws(() => validateProjectReceipt(simulated, configuration), /Non-production/);

  const zeroUsage = structuredClone(valid);
  zeroUsage.tasks[0].output_tokens = 0;
  assert.throws(() => validateProjectReceipt(zeroUsage, configuration), /Invalid provider/);

  const missingCleanup = structuredClone(valid);
  missingCleanup.journey.synthetic_client_archived_and_children_removed = false;
  assert.throws(() => validateProjectReceipt(missingCleanup, configuration), /archived_and_children/);

  const genericCleanupClaim = structuredClone(valid);
  delete genericCleanupClaim.journey.synthetic_client_archived_and_children_removed;
  genericCleanupClaim.journey.synthetic_cleanup_verified = true;
  assert.throws(() => validateProjectReceipt(genericCleanupClaim, configuration), /fields differ/);

  for (const mutate of [
    (cleanup) => { cleanup.cancel_response_http_status = 500; },
    (cleanup) => { cleanup.cancel_response_status = 'error'; },
    (cleanup) => { cleanup.cancel_response_deleted_count = 1; },
    (cleanup) => { cleanup.terminal_upload_unavailable_count = 1; },
    (cleanup) => { cleanup.terminal_upload_http_status = 200; },
    (cleanup) => { cleanup.terminal_upload_http_statuses_sha256 = ''; },
    (cleanup) => { cleanup.upload_residue_count = 1; },
    (cleanup) => { cleanup.archived_namespace_client_count = 0; },
    (cleanup) => { cleanup.child_row_residue_count = 1; },
    (cleanup) => { cleanup.outcome = 'zero_residue_cleanup'; },
  ]) {
    const invalidCleanup = structuredClone(valid);
    mutate(invalidCleanup.cleanup);
    invalidCleanup.cleanup_receipt_sha256 = sha256(JSON.stringify(invalidCleanup.cleanup));
    assert.throws(
      () => validateProjectReceipt(invalidCleanup, configuration),
      /cleanup evidence differs/,
    );
  }

  const uncommittedCleanup = structuredClone(valid);
  uncommittedCleanup.cleanup.client_id_sha256 = 'f'.repeat(64);
  assert.throws(() => validateProjectReceipt(uncommittedCleanup, configuration), /receipt.*differs/);

  const rawCleanup = structuredClone(valid);
  rawCleanup.cleanup.upload_ids = ['must-never-persist'];
  rawCleanup.cleanup_receipt_sha256 = sha256(JSON.stringify(rawCleanup.cleanup));
  assert.throws(() => validateProjectReceipt(rawCleanup, configuration), /fields differ/);

  const missingStructuredExam = structuredClone(valid);
  missingStructuredExam.journey.structured_initial_assessment_persisted = false;
  assert.throws(() => validateProjectReceipt(missingStructuredExam, configuration), /structured_initial_assessment/);

  const rawOutput = structuredClone(valid);
  rawOutput.raw_response = { prompt: 'must never persist' };
  assert.throws(() => validateProjectReceipt(rawOutput, configuration), /fields differ/);

  const taskPrompt = structuredClone(valid);
  taskPrompt.tasks[0].prompt = 'must never persist';
  assert.throws(() => validateProjectReceipt(taskPrompt, configuration), /fields differ/);

  const excessiveCost = structuredClone(valid);
  excessiveCost.tasks[0].actual_cost_microusd = configuration.providerCostCeilingMicrousd;
  excessiveCost.task_actual_cost_microusd = configuration.providerCostCeilingMicrousd + 5;
  excessiveCost.actual_provider_cost_microusd = configuration.providerCostCeilingMicrousd + 7;
  assert.throws(() => validateProjectReceipt(excessiveCost, configuration), /cost evidence/);

  const browserError = structuredClone(valid);
  browserError.console_error_count = 1;
  assert.throws(() => validateProjectReceipt(browserError, configuration), /runtime evidence/);

  const unrelatedProvision = structuredClone(valid);
  unrelatedProvision.self_service_provision_receipt_sha256 = 'f'.repeat(64);
  assert.throws(
    () => validateProjectReceipt(unrelatedProvision, configuration),
    /self_service_provision_receipt_sha256 differs/,
  );

  const unrelatedPaymentValidation = structuredClone(valid);
  unrelatedPaymentValidation.self_service_payment_validation_receipt_sha256 = 'f'.repeat(64);
  assert.throws(
    () => validateProjectReceipt(unrelatedPaymentValidation, configuration),
    /self_service_payment_validation_receipt_sha256 differs/,
  );
});

test('two project fragments assemble one content-free checksummed receipt', () => {
  const evidenceDirectory = fs.mkdtempSync(path.join(REPO_ROOT, 'output-physio-live-contract-'));
  const runtimeEnvironment = environment({ PHYSIO_LIVE_QA_EVIDENCE_DIR: evidenceDirectory });
  const configuration = resolvePhysioLiveQaConfiguration(runtimeEnvironment);
  try {
    for (const project of PHYSIO_LIVE_QA_PROJECTS) {
      writeProjectReceipt(projectReceipt(configuration, project), configuration);
    }
    const receiptPath = finalizePhysioLiveQaReceipt(runtimeEnvironment);
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.projects.length, 2);
    assert.deepEqual(receipt.projects.map((entry) => entry.project), PHYSIO_LIVE_QA_PROJECTS);
    assert.equal(receipt.projects.every(
      (entry) => entry.cleanup_outcome === PHYSIO_LIVE_QA_CLEANUP_OUTCOME,
    ), true);
    assert.equal(receipt.projects.every(
      (entry) => entry.archived_namespace_client_count === 1
        && entry.child_row_residue_count === 0
        && entry.upload_residue_count === 0,
    ), true);
    assert.equal(receipt.projects.every(
      (entry) => entry.self_service_provision_receipt_sha256 === '2'.repeat(64)
        && entry.self_service_provision_cleanup_ledger_sha256 === '3'.repeat(64)
        && entry.self_service_provision_contract_version
          === PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION
        && entry.self_service_payment_validation_receipt_sha256 === '4'.repeat(64)
        && entry.self_service_payment_validation_cleanup_ledger_sha256 === '5'.repeat(64)
        && entry.self_service_payment_validation_contract_version
          === PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION
        && entry.self_service_sequence_id
          === 'assesssuite-physio-self-service-123456abcdef',
    ), true);
    const checksumLine = fs.readFileSync(path.join(evidenceDirectory, 'SHA256SUMS'), 'utf8').trim();
    assert.equal(checksumLine, `${sha256(fs.readFileSync(receiptPath))}  physio-live-qa-receipt.json`);
    const serialized = JSON.stringify(receipt);
    assert.doesNotMatch(serialized, /Synthetic-Live-QA-Password|synthetic\+assesssuite-physio/);
    assert.deepEqual(Object.keys(receipt).sort(), [
      'acceptance_pass', 'actual_provider_cost_microusd', 'app_id', 'application',
      'application_sha', 'catalogue_checksum', 'catalogue_count', 'completed_at',
      'contract_version', 'deploy_receipt_sha256', 'exact_image_canary_receipt_sha256',
      'expected_capabilities_manifest_sha256', 'immutable_image', 'max_provider_cost_microusd',
      'origin', 'playwright_config_sha256', 'profession_id', 'projects',
      'qa_journey_manifest_sha256', 'result', 'sequence_id', 'started_at',
      'self_service_provision_cleanup_ledger_sha256',
      'self_service_provision_contract_version', 'self_service_provision_receipt_sha256',
      'self_service_payment_validation_cleanup_ledger_sha256',
      'self_service_payment_validation_contract_version',
      'self_service_payment_validation_receipt_sha256',
      'self_service_sequence_id', 'synthetic_account_email_sha256',
    ].sort());
  } finally {
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('custom-host receipt is ordered after Fly QA and binds restart, DNS and TLS readbacks', () => {
  const evidenceDirectory = fs.mkdtempSync(path.join(REPO_ROOT, 'output-physio-custom-live-contract-'));
  const runtimeEnvironment = environment({
    PHYSIO_LIVE_QA_EVIDENCE_DIR: evidenceDirectory,
    PHYSIO_LIVE_QA_ORIGIN: 'https://physio.app.assesssuite.com',
    PHYSIO_LIVE_QA_ACCEPTANCE_PASS: 'acceptance-2-custom-host-post-restart',
    PHYSIO_LIVE_QA_PRIOR_FLY_QA_RECEIPT_SHA256: '8'.repeat(64),
    PHYSIO_LIVE_QA_RESTART_RECEIPT_SHA256: '9'.repeat(64),
    PHYSIO_LIVE_QA_DNS_READBACK_MANIFEST_SHA256: 'a'.repeat(64),
    PHYSIO_LIVE_QA_TLS_CERTIFICATE_RECEIPT_SHA256: 'b'.repeat(64),
  });
  const configuration = resolvePhysioLiveQaConfiguration(runtimeEnvironment);
  try {
    for (const project of PHYSIO_LIVE_QA_PROJECTS) {
      writeProjectReceipt(projectReceipt(configuration, project), configuration);
    }
    const receipt = JSON.parse(fs.readFileSync(finalizePhysioLiveQaReceipt(runtimeEnvironment), 'utf8'));
    assert.equal(receipt.prior_fly_qa_receipt_sha256, '8'.repeat(64));
    assert.equal(receipt.restart_receipt_sha256, '9'.repeat(64));
    assert.equal(receipt.dns_readback_manifest_sha256, 'a'.repeat(64));
    assert.equal(receipt.tls_certificate_receipt_sha256, 'b'.repeat(64));
    assert.equal(receipt.self_service_provision_receipt_sha256, '2'.repeat(64));
    assert.equal(receipt.self_service_provision_cleanup_ledger_sha256, '3'.repeat(64));
    assert.equal(
      receipt.self_service_provision_contract_version,
      PHYSIO_LIVE_QA_SELF_SERVICE_PROVISION_CONTRACT_VERSION,
    );
    assert.equal(receipt.self_service_payment_validation_receipt_sha256, '4'.repeat(64));
    assert.equal(
      receipt.self_service_payment_validation_cleanup_ledger_sha256,
      '5'.repeat(64),
    );
    assert.equal(
      receipt.self_service_payment_validation_contract_version,
      PHYSIO_LIVE_QA_SELF_SERVICE_PAYMENT_VALIDATION_CONTRACT_VERSION,
    );
    assert.equal(
      receipt.self_service_sequence_id,
      'assesssuite-physio-self-service-123456abcdef',
    );
    assert.equal(receipt.projects.every((entry) => entry.provider_call_count === 8), true);
    assert.equal(receipt.actual_provider_cost_microusd, 16);
  } finally {
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('both acceptance receipts bind one immutable self-service provision and account sequence', () => {
  const root = fs.mkdtempSync(path.join(REPO_ROOT, 'output-physio-two-pass-live-contract-'));
  const flyDirectory = path.join(root, 'fly');
  const customDirectory = path.join(root, 'custom');
  fs.mkdirSync(flyDirectory);
  fs.mkdirSync(customDirectory);
  try {
    const flyEnvironment = environment({ PHYSIO_LIVE_QA_EVIDENCE_DIR: flyDirectory });
    const flyConfiguration = resolvePhysioLiveQaConfiguration(flyEnvironment);
    for (const project of PHYSIO_LIVE_QA_PROJECTS) {
      writeProjectReceipt(projectReceipt(flyConfiguration, project), flyConfiguration);
    }
    const flyPath = finalizePhysioLiveQaReceipt(flyEnvironment);
    const flyHash = sha256(fs.readFileSync(flyPath));

    const customEnvironment = environment({
      PHYSIO_LIVE_QA_EVIDENCE_DIR: customDirectory,
      PHYSIO_LIVE_QA_ORIGIN: 'https://physio.app.assesssuite.com',
      PHYSIO_LIVE_QA_ACCEPTANCE_PASS: 'acceptance-2-custom-host-post-restart',
      PHYSIO_LIVE_QA_PRIOR_FLY_QA_RECEIPT_SHA256: flyHash,
      PHYSIO_LIVE_QA_RESTART_RECEIPT_SHA256: '9'.repeat(64),
      PHYSIO_LIVE_QA_DNS_READBACK_MANIFEST_SHA256: 'a'.repeat(64),
      PHYSIO_LIVE_QA_TLS_CERTIFICATE_RECEIPT_SHA256: 'b'.repeat(64),
    });
    const customConfiguration = resolvePhysioLiveQaConfiguration(customEnvironment);
    for (const project of PHYSIO_LIVE_QA_PROJECTS) {
      writeProjectReceipt(projectReceipt(customConfiguration, project), customConfiguration);
    }
    const fly = JSON.parse(fs.readFileSync(flyPath, 'utf8'));
    const custom = JSON.parse(
      fs.readFileSync(finalizePhysioLiveQaReceipt(customEnvironment), 'utf8'),
    );
    for (const field of [
      'self_service_provision_receipt_sha256',
      'self_service_provision_cleanup_ledger_sha256',
      'self_service_provision_contract_version',
      'self_service_sequence_id',
      'self_service_payment_validation_receipt_sha256',
      'self_service_payment_validation_cleanup_ledger_sha256',
      'self_service_payment_validation_contract_version',
      'synthetic_account_email_sha256',
    ]) {
      assert.equal(custom[field], fly[field], `${field} changed between acceptance passes`);
      assert.equal(
        custom.projects.every((project) => project[field] === custom[field]),
        true,
        `${field} was not echoed by each custom-host project receipt`,
      );
      assert.equal(
        fly.projects.every((project) => project[field] === fly[field]),
        true,
        `${field} was not echoed by each Fly-host project receipt`,
      );
    }
    assert.equal(custom.prior_fly_qa_receipt_sha256, flyHash);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('durable Playwright source is serial, dual-viewport, exact-image bound and covers the full normal journey', () => {
  const config = fs.readFileSync(path.join(E2E_ROOT, 'playwright.config.mjs'), 'utf8');
  const setup = fs.readFileSync(path.join(E2E_ROOT, 'global-setup.mjs'), 'utf8');
  const teardown = fs.readFileSync(path.join(E2E_ROOT, 'global-teardown.mjs'), 'utf8');
  const journey = fs.readFileSync(path.join(E2E_ROOT, 'physio-live.spec.mjs'), 'utf8');

  assert.match(config, /workers:\s*1/);
  assert.match(config, /retries:\s*0/);
  assert.match(config, /forbidOnly:\s*true/);
  assert.match(config, /trace:\s*['"]off['"]/);
  assert.match(config, /screenshot:\s*['"]off['"]/);
  assert.match(config, /video:\s*['"]off['"]/);
  assert.doesNotMatch(config, /retain-on-failure|only-on-failure/);
  assert.match(config, /chromium-desktop/);
  assert.match(config, /chromium-mobile/);
  assert.match(config, /globalSetup:\s*['"]\.\/global-setup\.mjs['"]/);
  assert.match(config, /globalTeardown:\s*['"]\.\/global-teardown\.mjs['"]/);
  assert.match(setup, /exactPriorOutputs/);
  assert.match(teardown, /finalizePhysioLiveQaReceipt/);
  assert.doesNotMatch(journey, /\b(?:test|describe)\.(?:skip|fixme)\b|\btest\.fail\b/);

  for (const marker of [
    '/auth/login',
    'NewAssessment',
    'Save DASS-21 to Client Record',
    'PhysioCareEpisode',
    'physio_screen_outcome_none',
    'physio_subj_presenting_complaint',
    'physio_obj_diagnosis_clinical_impression',
    'provider_receipt',
    'physioAiTask',
    'transcribeSession',
    'ExtractDataFromUploadedFile',
    'CancelTemporaryUploads',
    'CancelTemporaryUploads cleanup',
    'terminalReadbacks',
    'synthetic_client_archived_and_children_removed',
    'Download JSON',
    'Print draft',
    'Complete discharge',
    'removeSyntheticChildren',
    'writeProjectReceipt',
  ]) {
    assert.ok(journey.includes(marker), `live journey missing ${marker}`);
  }
  assert.equal((journey.match(/provider_request_id_hash/g) || []).length >= 4, true);
  assert.match(journey, /expect\(cancellation\.deleted\)\.toBe\(ids\.length\)/);
  assert.match(journey, /expect\(archivedClients\)\.toHaveLength\(1\)/);
  assert.doesNotMatch(journey, /cancellationError/);
  assert.doesNotMatch(journey, /page\.route\(|mock-provider|SELFTEST\s*=|PARITY_ASSURANCE_MODE\s*=/);
});
