import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PHYSIO_CANARY_PROVIDER_TASK_MAP,
  PHYSIO_CANARY_PROVIDER_TASK_SET,
  PHYSIO_CANARY_TASK_IDS,
  PHYSIO_CANARY_TTL_SECONDS,
  readAndValidatePhysioCanaryEffectReceipt,
  validatePhysioCanaryEffectReceipt,
  validatePhysioExactImageCanaryReceipt,
} from '../../scripts/physio-exact-image-canary-contract.mjs';
import {
  assertPhysioCanaryProviderTaskMapping,
  assertLocalCanaryContainer,
  buildPhysioProductionCanaryRuntimePlan,
  parseProviderProgress,
  parseInnerReceipt,
  prepareProviderEffectLedgerTarget,
  sanitizedChildCanaryFailure,
  startPhysioCanaryServer,
  physioCanaryContainerName,
  verifySharedSoapAiParity,
  verifyPhysioDisabledCoreIntegrations,
  verifyProductionArtifactPosture,
  writeProviderEffectLedger,
} from '../../scripts/physio-exact-image-canary.mjs';
import {
  PHYSIO_CANARY_AUDIO_BYTES,
  PHYSIO_CANARY_AUDIO_EXPECTED_MARKER,
  PHYSIO_CANARY_AUDIO_SHA256,
  readAndValidatePhysioCanaryAudioFixture,
} from '../../scripts/physio-exact-image-canary-fixture.mjs';
import {
  buildPhysioCanaryReferralPdf,
} from '../../scripts/physio-exact-image-canary-document-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const digest = (character) => `sha256:${character.repeat(64)}`;
const shaReceipt = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function success(kind = 'tokens') {
  const usage = kind === 'audio'
    ? { audio_seconds: 2, estimated_cost_microusd: 200 }
    : kind === 'document'
      ? { request_units: 1, estimated_cost_microusd: 900 }
      : { input_tokens: 101, cached_input_tokens: 0, output_tokens: 23, estimated_cost_microusd: 500 };
  return {
    status: 'PASS',
    provider_posture: 'real',
    provider: 'openai',
    model: kind === 'audio' ? 'whisper-1' : 'gpt-4.1-mini-2025-04-14',
    provider_request_id: digest('a'),
    schema_receipt_sha256: digest('b'),
    ...(kind === 'document' ? { provider_response_sha256: digest('c') } : {}),
    usage_delta: usage,
  };
}

function fault() {
  return {
    status: 'PASS',
    non_2xx_verified: true,
    http_status: 502,
    error_code: 'provider_failed',
    provider_contact_attempted: true,
    placeholder_success: false,
    persisted_false_success: false,
  };
}

function validReceipt() {
  return {
    contract_version: 'assesssuite-physio-exact-image-canary/3.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: '1'.repeat(40),
    immutable_image: digest('2'),
    image_digest: digest('2'),
    candidate_archive_sha256: digest('c'),
    profession_id: 'physio',
    app_id: 'local-assesssuite-physio',
    carrier_type: 'local-docker',
    carrier_id_sha256: digest('3'),
    isolated_candidate_image_verified: true,
    prior_carrier_reconciled: false,
    prior_carrier_admission_readback_sha256: digest('4'),
    carrier_pre_destroy_readback_sha256: digest('5'),
    carrier_post_destroy_readback_sha256: digest('6'),
    remaining_exact_namespace_container_count: 0,
    disposable_container_destroyed: true,
    host_port_binding_count: 0,
    mount_count: 0,
    custom_dns_count: 0,
    network_mode: 'bridge',
    docker_volume_inventory_unchanged: true,
    production_mock_scan_passed: true,
    production_runtime: {
      mode: 'production-process',
      strict_canary_mode: true,
      observed_child_node_env: 'production',
      production_bootstrap_completed: true,
      success_bootstrap_receipt_sha256: digest('4'),
      fault_bootstrap_receipt_sha256: digest('5'),
      success_version_receipt_sha256: digest('6'),
      fault_version_receipt_sha256: digest('7'),
      success_capability_vector_sha256: digest('8'),
      fault_capability_vector_sha256: digest('9'),
      runtime_tree_manifest_receipt_sha256: digest('a'),
      observed_release_sha: '1'.repeat(40),
      observed_immutable_image: digest('2'),
      server_entry_sequence: 'productionBootstrap-to-server/index',
      loopback_only: true,
      ephemeral_storage: true,
      ephemeral_state_removed: true,
      test_harness_used: false,
      fixed_otp_used: false,
      success_live_proof: true,
      fault_live_proof: true,
    },
    bounded_paid_calls: { maximum: 8, succeeded: 8 },
    cost_ceiling_microusd: 3_000_000,
    actual_cost_microusd: 4_100,
    tasks: Object.fromEntries(PHYSIO_CANARY_TASK_IDS.map((taskId) => [taskId, {
      success: success(),
      fault: fault(),
      structured_schema_valid: true,
      editable_persistence_verified: true,
      persistence_receipt_sha256: digest('d'),
    }])),
    transcription: {
      success: success('audio'), fault: fault(), real_media_fixture: true,
      fixture_receipt_sha256: digest('e'),
    },
    extraction: {
      success: success('document'), fault: fault(), real_document_fixture: true,
      fixture_receipt_sha256: digest('f'),
    },
    started_at: '2026-08-22T01:00:00.000Z',
    completed_at: '2026-08-22T01:01:00.000Z',
  };
}

function validEffectReceipt() {
  const costs = [500, 500, 500, 500, 500, 500, 200, 900];
  const partialProviderCalls = PHYSIO_CANARY_PROVIDER_TASK_SET.map((providerTask, index) => ({
    call_ordinal: index + 1,
    provider_task: providerTask,
    provider_request_id_sha256: digest(String((index + 1) % 10)),
    usage_receipt_sha256: digest(String((index + 2) % 10)),
    actual_cost_microusd: costs[index],
  }));
  return {
    contract_version: 'assesssuite-physio-exact-image-canary-effect/1.0.0',
    result: 'COMPLETED',
    application: 'assesssuite-physio-production',
    application_sha: '1'.repeat(40),
    provider_effect_id: digest('7'),
    candidate_archive_sha256: digest('c'),
    local_image_id: digest('2'),
    provider_call_maximum: 8,
    maximum_cost_microusd: 3_000_000,
    started_effect_receipt_sha256: '4'.repeat(64),
    partial_provider_calls: partialProviderCalls,
    partial_provider_request_id_hashes: partialProviderCalls.map(
      (row) => row.provider_request_id_sha256,
    ),
    partial_provider_usage: {
      usage_complete: true,
      calls_succeeded: 8,
      actual_cost_microusd: 4_100,
      last_observed_call_ordinal: 8,
    },
    producer_exit_code: 0,
    producer_stdout_sha256: shaReceipt('success\n'),
    producer_stderr_sha256: shaReceipt(''),
    error_receipt_sha256: null,
    completed_at: '2026-08-22T01:02:00.000Z',
  };
}

function changed(mutator) {
  const receipt = structuredClone(validReceipt());
  mutator(receipt);
  return receipt;
}

function productionEnvironment(overrides = {}) {
  return {
    NODE_ENV: 'production',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    LLM_REQUIRED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    TRANSCRIPTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    OPENAI_API_KEY: `sk-proj-${'x'.repeat(40)}`,
    PHYSIO_EXACT_IMAGE_CANARY_MODE: '1',
    RUN_PHYSIO_EXACT_IMAGE_CANARY:
      'I_ACKNOWLEDGE_THIS_USES_ONLY_SYNTHETIC_FIXTURES_IN_A_DISPOSABLE_NO_SERVICE_NO_VOLUME_NO_DNS_CONTAINER',
    ALLOW_PAID_PROVIDER_PROBE: '1',
    PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT:
      '/tmp/physio-exact-image-canary-bootstrap-success.json',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    ALLOW_OPEN_REGISTRATION: '0',
    APP_URL: 'https://physio.app.assesssuite.com',
    EXPECTED_APP_URL: 'https://physio.app.assesssuite.com',
    UPLOADS_DIR: '/app/server/data/physio-uploads',
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    OPENAI_MODEL_FAST: 'gpt-4.1-mini-2025-04-14',
    OPENAI_MODEL_QUALITY: 'gpt-4.1-2025-04-14',
    OPENAI_TRANSCRIBE_MODEL: 'whisper-1',
    RELEASE_SHA: '1'.repeat(40),
    BUILD_TIMESTAMP: '2026-08-22T01:00:00Z',
    PHYSIO_CANARY_IMMUTABLE_IMAGE:
      digest('2'),
    PHYSIO_CANARY_CANDIDATE_ARCHIVE_SHA256: digest('c'),
    PHYSIO_CANARY_CARRIER_ID: 'a'.repeat(64),
    ...overrides,
  };
}

test('content-free exact-image receipt accepts exact six-task, audio and document evidence', () => {
  const receipt = validReceipt();
  assert.equal(validatePhysioExactImageCanaryReceipt(receipt, {
    expectedApplicationSha: receipt.application_sha,
    expectedImmutableImage: receipt.immutable_image,
    maximumCostMicrousd: 3_000_000,
  }), receipt);
  assert.deepEqual(Object.keys(receipt.tasks), PHYSIO_CANARY_TASK_IDS);
});

test('terminal provider-effect contract accepts only exact completed or unresolved states', () => {
  const completed = validEffectReceipt();
  assert.equal(validatePhysioCanaryEffectReceipt(completed, {
    expectedApplicationSha: completed.application_sha,
    expectedProviderEffectId: completed.provider_effect_id,
    expectedStartedEffectReceiptSha256: completed.started_effect_receipt_sha256,
    expectedImmutableImage: completed.local_image_id,
    expectedCandidateArchiveSha256: completed.candidate_archive_sha256,
    maximumCostMicrousd: completed.maximum_cost_microusd,
  }), completed);

  const unresolved = structuredClone(completed);
  unresolved.result = 'STARTED_UNRESOLVED';
  unresolved.partial_provider_calls = unresolved.partial_provider_calls.slice(0, 2);
  unresolved.partial_provider_request_id_hashes =
    unresolved.partial_provider_request_id_hashes.slice(0, 2);
  unresolved.partial_provider_usage = {
    usage_complete: false,
    calls_succeeded: 2,
    actual_cost_microusd: 1_000,
    last_observed_call_ordinal: 2,
  };
  unresolved.producer_exit_code = 17;
  unresolved.producer_stdout_sha256 = shaReceipt('');
  unresolved.producer_stderr_sha256 = shaReceipt('deterministic failure\n');
  unresolved.error_receipt_sha256 = digest('e');
  assert.equal(validatePhysioCanaryEffectReceipt(unresolved), unresolved);

  for (const mutate of [
    (row) => { row.producer_exit_code = null; },
    (row) => { row.producer_stdout_sha256 = 'raw stdout'; },
    (row) => { row.partial_provider_calls[1].call_ordinal = 3; },
    (row) => { row.partial_provider_usage.actual_cost_microusd += 1; },
    (row) => { row.partial_provider_calls[0].provider_request_id_sha256 = digest('f'); },
    (row) => { row.unexpected = true; },
  ]) {
    const malformed = structuredClone(completed);
    mutate(malformed);
    assert.throws(() => validatePhysioCanaryEffectReceipt(malformed), /receipt rejected/);
  }

  const falseCompletion = structuredClone(unresolved);
  falseCompletion.result = 'COMPLETED';
  falseCompletion.producer_exit_code = 0;
  falseCompletion.error_receipt_sha256 = null;
  assert.throws(() => validatePhysioCanaryEffectReceipt(falseCompletion),
    /completed provider effect differs/);

  const falseUnresolved = structuredClone(unresolved);
  falseUnresolved.producer_exit_code = 0;
  assert.throws(() => validatePhysioCanaryEffectReceipt(falseUnresolved),
    /unresolved provider effect differs/);
});

test('provider progress is content-free, ordinal-bound and rejects malformed or ambiguous rows', () => {
  const prefix = 'PHYSIO_EXACT_IMAGE_CANARY_PROVIDER_CALL ';
  const rows = PHYSIO_CANARY_PROVIDER_TASK_SET.slice(0, 2).map((providerTask, index) => ({
    call_ordinal: index + 1,
    provider_task: providerTask,
    provider_request_id_sha256: digest(String(index + 1)),
    usage_receipt_sha256: digest(String(index + 3)),
    actual_cost_microusd: 500,
  }));
  const stdout = rows.map((row) => `${prefix}${JSON.stringify(row)}`).join('\n');
  assert.deepEqual(parseProviderProgress(stdout), rows);
  assert.throws(() => parseProviderProgress(`${stdout}\n${prefix}{not-json}`),
    /provider_progress_json_invalid/);
  assert.throws(() => parseProviderProgress(`${prefix}${JSON.stringify({
    ...rows[0], call_ordinal: 2,
  })}`), /provider_progress_row_invalid/);
  assert.throws(() => parseProviderProgress(`${prefix}${JSON.stringify({
    ...rows[0], raw_provider_request_id: 'req_secret',
  })}`), /provider_progress_row_keys_differ/);
});

test('child canary failures preserve exactly one bounded code and hide all other stderr', () => {
  const warning = '(node:123) ExperimentalWarning: synthetic warning';
  const bounded = 'physio_canary_initial_assessment_summary_provider_success_failed';
  assert.equal(sanitizedChildCanaryFailure(
    `${warning}\nPhysio exact-image canary producer failed: ${bounded}\n`,
    'docker',
    1,
  ), bounded);
  assert.equal(sanitizedChildCanaryFailure(
    `secret detail\nPhysio exact-image canary producer failed: ${bounded}\n` +
      'Physio exact-image canary producer failed: physio_canary_second_failure\n',
    'C:\\Program Files\\Docker\\docker.exe',
    137,
  ), 'physio_canary_command_failed_c_program_files_docker_docker_exe_137');
});

test('terminal effect ledger is atomically published once with exact producer stream hashes', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-effect-'));
  const ledger = path.join(temporary, 'canary-effect-reconciliation.json');
  const producerStdout = '{"artifact":"receipt","sha256":"abc"}\n';
  const producerStderr = '';
  try {
    assert.equal(prepareProviderEffectLedgerTarget(ledger), ledger);
    const row = writeProviderEffectLedger({
      file: ledger,
      result: 'COMPLETED',
      providerEffectId: digest('7'),
      startedEffectReceiptSha256: '4'.repeat(64),
      applicationSha: '1'.repeat(40),
      immutableImage: digest('2'),
      candidateArchiveSha256: digest('c'),
      maximumCostMicrousd: 3_000_000,
      receipt: validReceipt(),
      producerExitCode: 0,
      producerStdout,
      producerStderr,
    });
    assert.equal(row.result, 'COMPLETED');
    assert.equal(row.producer_exit_code, 0);
    assert.equal(row.producer_stdout_sha256, shaReceipt(producerStdout));
    assert.equal(row.producer_stderr_sha256, shaReceipt(producerStderr));
    assert.equal(row.partial_provider_calls.length, 8);
    assert.deepEqual(row.partial_provider_calls.map((call) => call.call_ordinal),
      [1, 2, 3, 4, 5, 6, 7, 8]);
    const admitted = readAndValidatePhysioCanaryEffectReceipt(ledger, {
      expectedApplicationSha: '1'.repeat(40),
      expectedProviderEffectId: digest('7'),
      expectedStartedEffectReceiptSha256: '4'.repeat(64),
    });
    assert.deepEqual(admitted, row);

    const originalBytes = fs.readFileSync(ledger);
    assert.throws(() => writeProviderEffectLedger({
      file: ledger,
      result: 'STARTED_UNRESOLVED',
      providerEffectId: digest('7'),
      startedEffectReceiptSha256: '4'.repeat(64),
      applicationSha: '1'.repeat(40),
      immutableImage: digest('2'),
      candidateArchiveSha256: digest('c'),
      maximumCostMicrousd: 3_000_000,
      producerExitCode: 1,
      producerStdout: '',
      producerStderr: 'failure\n',
      error: new Error('failure'),
    }), /effect_ledger_already_exists/);
    assert.deepEqual(fs.readFileSync(ledger), originalBytes,
      'a prior terminal effect ledger must never be overwritten');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('unresolved effect ledger preserves only validated partial calls and exact failure bytes', () => {
  const prefix = 'PHYSIO_EXACT_IMAGE_CANARY_PROVIDER_CALL ';
  const calls = PHYSIO_CANARY_PROVIDER_TASK_SET.slice(0, 2).map((providerTask, index) => ({
    call_ordinal: index + 1,
    provider_task: providerTask,
    provider_request_id_sha256: digest(String(index + 1)),
    usage_receipt_sha256: digest(String(index + 3)),
    actual_cost_microusd: 500,
  }));
  const progressStdout = calls.map((row) => `${prefix}${JSON.stringify(row)}`).join('\n');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-unresolved-'));
  const ledger = path.join(temporary, 'canary-effect-reconciliation.json');
  const producerStderr =
    'Physio exact-image canary producer failed: physio_canary_provider_failed\n';
  try {
    const row = writeProviderEffectLedger({
      file: ledger,
      result: 'STARTED_UNRESOLVED',
      providerEffectId: digest('7'),
      startedEffectReceiptSha256: '4'.repeat(64),
      applicationSha: '1'.repeat(40),
      immutableImage: digest('2'),
      candidateArchiveSha256: digest('c'),
      maximumCostMicrousd: 3_000_000,
      progressStdout,
      producerExitCode: 1,
      producerStdout: '',
      producerStderr,
      error: new Error('physio_canary_provider_failed'),
    });
    assert.equal(row.result, 'STARTED_UNRESOLVED');
    assert.deepEqual(row.partial_provider_calls, calls);
    assert.deepEqual(row.partial_provider_usage, {
      usage_complete: false,
      calls_succeeded: 2,
      actual_cost_microusd: 1_000,
      last_observed_call_ordinal: 2,
    });
    assert.equal(row.producer_exit_code, 1);
    assert.equal(row.producer_stdout_sha256, shaReceipt(''));
    assert.equal(row.producer_stderr_sha256, shaReceipt(producerStderr));
    assert.match(JSON.stringify(row), /sha256:/);
    assert.doesNotMatch(JSON.stringify(row), /req_secret|provider output|patient/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('produce-local failure process bytes exactly match its no-provider terminal ledger', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-cli-streams-'));
  const ledger = path.join(temporary, 'canary-effect-reconciliation.json');
  const output = path.join(temporary, 'physio-exact-image-canary.json');
  const environment = { ...process.env };
  delete environment.OPENAI_API_KEY;
  for (const forbidden of [
    'SENTRY_AUTH_TOKEN', 'SENTRY_DSN', 'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY',
  ]) delete environment[forbidden];
  Object.assign(environment, {
    RUN_PHYSIO_EXACT_IMAGE_CANARY:
      'I_ACKNOWLEDGE_THIS_USES_ONLY_SYNTHETIC_FIXTURES_IN_A_DISPOSABLE_NO_SERVICE_NO_VOLUME_NO_DNS_CONTAINER',
    ALLOW_PAID_PROVIDER_PROBE: '1',
  });
  try {
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'physio-exact-image-canary.mjs'),
      'produce-local',
      '--application-sha', '1'.repeat(40),
      '--immutable-image', digest('2'),
      '--candidate-archive-sha256', digest('c'),
      '--container-name', `assesssuite-physio-canary-${'1'.repeat(12)}`,
      '--ttl-seconds', '1800',
      '--provider-task-set', PHYSIO_CANARY_PROVIDER_TASK_SET.join(','),
      '--maximum-cost-microusd', '3000000',
      '--output', output,
      '--provider-effect-id', digest('7'),
      '--effect-ledger', ledger,
      '--started-effect-receipt-sha256', '4'.repeat(64),
    ], {
      cwd: root,
      env: environment,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr,
      'Physio exact-image canary producer failed: physio_canary_provider_credential_missing\n');
    const terminal = readAndValidatePhysioCanaryEffectReceipt(ledger);
    assert.equal(terminal.result, 'STARTED_UNRESOLVED');
    assert.equal(terminal.producer_exit_code, result.status);
    assert.equal(terminal.producer_stdout_sha256, shaReceipt(result.stdout));
    assert.equal(terminal.producer_stderr_sha256, shaReceipt(result.stderr));
    assert.deepEqual(terminal.partial_provider_calls, []);
    assert.equal(terminal.partial_provider_usage.calls_succeeded, null);
    assert.equal(fs.existsSync(output), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('effect reader fails closed on malformed, linked, empty and oversized artifacts', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-effect-read-'));
  const ledger = path.join(temporary, 'canary-effect-reconciliation.json');
  try {
    fs.writeFileSync(ledger, '{malformed');
    assert.throws(() => readAndValidatePhysioCanaryEffectReceipt(ledger), /not valid JSON/);
    fs.rmSync(ledger);
    fs.writeFileSync(ledger, '');
    assert.throws(() => readAndValidatePhysioCanaryEffectReceipt(ledger), /empty or oversized/);
    fs.rmSync(ledger);
    fs.writeFileSync(ledger, 'x'.repeat(65_537));
    assert.throws(() => readAndValidatePhysioCanaryEffectReceipt(ledger), /empty or oversized/);
    fs.rmSync(ledger);
    const target = path.join(temporary, 'target.json');
    fs.writeFileSync(target, JSON.stringify(validEffectReceipt()));
    try {
      fs.symlinkSync(target, ledger, 'file');
      assert.throws(() => readAndValidatePhysioCanaryEffectReceipt(ledger), /linked/);
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error;
      t.diagnostic(`symlink negative case unavailable on this platform: ${error.code}`);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('control-plane eight-name task set maps exactly to six public IDs plus transcription and extraction', () => {
  assert.equal(assertPhysioCanaryProviderTaskMapping(), true);
  assert.deepEqual(
    PHYSIO_CANARY_PROVIDER_TASK_SET.map((name) => PHYSIO_CANARY_PROVIDER_TASK_MAP[name]),
    [...PHYSIO_CANARY_TASK_IDS, 'transcription', 'extraction'],
  );
  assert.throws(() => assertPhysioCanaryProviderTaskMapping([
    ...PHYSIO_CANARY_PROVIDER_TASK_SET.slice(0, -1), 'document_extraction',
  ]), /provider_task_set_differs/);
});

test('frozen synthetic speech fixture has exact RIFF bytes marker and SHA-256', () => {
  const fixture = readAndValidatePhysioCanaryAudioFixture(root);
  assert.equal(fixture.byteLength, PHYSIO_CANARY_AUDIO_BYTES);
  assert.equal(fixture.sha256, PHYSIO_CANARY_AUDIO_SHA256);
  assert.equal(fixture.expectedMarker, PHYSIO_CANARY_AUDIO_EXPECTED_MARKER);
  assert.equal(fixture.bytes.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(fixture.bytes.subarray(8, 12).toString('ascii'), 'WAVE');
});

test('frozen canary referral is a deterministic real PDF outside the test harness', () => {
  const fixture = buildPhysioCanaryReferralPdf();
  assert.equal(fixture.length, 952);
  assert.equal(fixture.subarray(0, 8).toString('ascii'), '%PDF-1.4');
  assert.equal(createHash('sha256').update(fixture).digest('hex'),
    '1fd002a0e2665d0ee5b6e49ad7816d73176654fd46367f18a7ed304eba2c7e1c');
});

test('carrier identity is deterministic from release SHA with an exact 1800-second TTL', () => {
  assert.equal(
    physioCanaryContainerName('a'.repeat(40)),
    `assesssuite-physio-canary-${'a'.repeat(12)}`,
  );
  assert.equal(PHYSIO_CANARY_TTL_SECONDS, 1800);
  assert.throws(() => physioCanaryContainerName('moving-tag'), /container_name_release_sha_invalid/);
});

test('cleanup admission binds captured carrier ID, immutable image, labels, command and zero-resource topology', () => {
  const applicationSha = 'a'.repeat(40);
  const immutableImage = digest('2');
  const candidateArchiveSha256 = digest('c');
  const containerId = 'b'.repeat(64);
  const containerName = physioCanaryContainerName(applicationSha);
  const carrier = {
    Id: containerId,
    Name: `/${containerName}`,
    Image: immutableImage,
    State: { Running: true },
    Config: {
      Cmd: ['sleep', String(PHYSIO_CANARY_TTL_SECONDS)],
      Env: ['NODE_VERSION=24'],
      // Docker preserves Dockerfile EXPOSE metadata even when the carrier has
      // no published host port. HostConfig.PortBindings is the network-effect
      // boundary the canary must enforce.
      ExposedPorts: { '8787/tcp': {} },
      Labels: {
        'assesssuite-canary-role': 'physio-exact-image',
        'assesssuite-release-sha': applicationSha,
        'assesssuite-candidate-archive-sha256': candidateArchiveSha256,
      },
    },
    HostConfig: {
      AutoRemove: true,
      Privileged: false,
      ReadonlyRootfs: false,
      NetworkMode: 'bridge',
      RestartPolicy: { Name: 'no' },
      Binds: null,
      Dns: null,
      PortBindings: {},
    },
    Mounts: [],
  };
  const options = {
    containerId,
    containerName,
    immutableImage,
    applicationSha,
    candidateArchiveSha256,
    ttlSeconds: PHYSIO_CANARY_TTL_SECONDS,
  };
  assert.equal(assertLocalCanaryContainer(carrier, options), carrier);
  assert.throws(() => assertLocalCanaryContainer({ ...carrier, Id: 'd'.repeat(64) }, options),
    /local_container_id_differs/);
  assert.throws(() => assertLocalCanaryContainer({ ...carrier, Image: digest('e') }, options),
    /local_container_image_differs/);
  assert.throws(() => assertLocalCanaryContainer({ ...carrier, Mounts: [{}] }, options),
    /local_container_topology_differs/);
  assert.throws(() => assertLocalCanaryContainer({
    ...carrier,
    HostConfig: {
      ...carrier.HostConfig,
      PortBindings: { '8787/tcp': [{ HostIp: '0.0.0.0', HostPort: '8787' }] },
    },
  }, options), /local_container_topology_differs/);
});

test('inner receipt sentinels tolerate tool warnings but reject ambiguous payloads', () => {
  const payload = { result: 'mechanics-only', count: 8 };
  const framed = [
    'flyctl informational prefix',
    'PHYSIO_EXACT_IMAGE_CANARY_RECEIPT_BEGIN',
    JSON.stringify(payload),
    'PHYSIO_EXACT_IMAGE_CANARY_RECEIPT_END',
    'node informational suffix',
  ].join('\n');
  assert.deepEqual(parseInnerReceipt(framed), payload);
  assert.throws(() => parseInnerReceipt(`${framed}\n${framed}`), /receipt_sentinel_differs/);
  assert.throws(() => parseInnerReceipt('{"result":"unframed"}'), /receipt_sentinel_differs/);
});

test('offline injectable process runner proves launch mechanics but is ineligible for live evidence', async () => {
  let observedPlan = null;
  const server = await startPhysioCanaryServer({
    phase: 'success',
    maximumCostMicrousd: 3_000_000,
    environment: productionEnvironment(),
    portResolver: async () => 43_217,
    stateResetter: async () => true,
    processRunner: async (plan) => {
      observedPlan = plan;
      return {
        baseUrl: plan.baseUrl,
        listenerAddress: '127.0.0.1',
        listenerPort: plan.port,
        bootstrapReceiptSha256: digest('a'),
        observedNodeEnv: 'production',
        observedReleaseSha: plan.environment.RELEASE_SHA,
        versionReceiptSha256: digest('b'),
        capabilityVectorSha256: digest('c'),
        liveProofEligible: true,
        async stop() { return true; },
      };
    },
  });
  assert.ok(observedPlan);
  assert.equal(observedPlan.command, 'sh');
  assert.deepEqual(observedPlan.args,
    ['-c', 'node server/productionBootstrap.mjs && exec node server/index.mjs']);
  assert.equal(observedPlan.environment.NODE_ENV, 'production');
  assert.equal(observedPlan.environment.SELFTEST, '0');
  assert.equal(observedPlan.environment.PHYSIO_EXACT_IMAGE_CANARY_MODE, '1');
  assert.equal(observedPlan.environment.ASSESSSUITE_BIND_HOST, '127.0.0.1');
  assert.equal(observedPlan.environment.ASSESSSUITE_DB_PATH, undefined);
  assert.equal(observedPlan.environment.ASSESSSUITE_DB_PATH_ACK, undefined);
  assert.equal(server.liveProofEligible, false);
  assert.equal(server.productionMockScanPassed, true);
});

test('fault launch bootstraps with the real key before the sole explicit server-key replacement', () => {
  const environment = productionEnvironment();
  const plan = buildPhysioProductionCanaryRuntimePlan({
    phase: 'fault',
    port: 43_218,
    maximumCostMicrousd: 3_000_000,
    environment,
    adminEmail: 'physio-canary-admin-fixture@example.test',
    adminPassword: `Canary-${'a'.repeat(40)}!9a`,
    clinicianPassword: `Canary-${'b'.repeat(40)}!9a`,
  });
  assert.equal(plan.environment.OPENAI_API_KEY, environment.OPENAI_API_KEY);
  assert.equal(plan.environment.NODE_ENV, 'production');
  assert.match(plan.args[1], /^node server\/productionBootstrap\.mjs && \{/);
  assert.match(plan.args[1], /export OPENAI_API_KEY='physio-exact-image-canary-invalid-provider-credential'/);
  assert.match(plan.args[1], /exec node server\/index\.mjs/);
  assert.equal((plan.args[1].match(/OPENAI_API_KEY/g) || []).length, 1);
});

test('provider_request_id is contract-stable but only accepts a lowercase SHA-256 digest', () => {
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.provider_request_id = 'req_abc123';
  })), /provider_request_id must be sha256/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.provider_request_id = 'sha256:abcd';
  })), /provider_request_id must be sha256/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.provider_request_id = digest('A');
  })), /provider_request_id must be sha256/);
});

test('fake-provider mechanics never satisfy real-provider completion', () => {
  const mechanicsOnly = changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.provider_posture = 'mechanics-only';
  });
  assert.throws(() => validatePhysioExactImageCanaryReceipt(mechanicsOnly), /not a real provider receipt/);
});

test('mutable model aliases and forged production-process evidence fail closed', () => {
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.model = 'gpt-4.1-mini';
  })), /not a pinned provider-reported text snapshot/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.extraction.success.model = 'gpt-4.1';
  })), /not a pinned provider-reported text snapshot/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.production_runtime.observed_child_node_env = 'test';
  })), /does not prove the strict production process journey/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.production_runtime.test_harness_used = true;
  })), /does not prove the strict production process journey/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.production_runtime.success_live_proof = false;
  })), /does not prove the strict production process journey/);
});

test('task token, transcription audio and extraction request-unit deltas fail closed', () => {
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[1]].success.usage_delta.output_tokens = 0;
  })), /output_tokens must be a positive integer/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.transcription.success.usage_delta.audio_seconds = 0;
  })), /no positive audio usage/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.extraction.success.usage_delta.request_units = 0;
  })), /request_units must be a positive integer/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.extraction.success.provider_response_sha256 = 'raw-provider-response';
  })), /provider_response_sha256 must be sha256/);
});

test('placeholder success, persistence gaps, topology changes and extra content are rejected', () => {
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.transcription.fault.placeholder_success = true;
  })), /does not prove a loud provider failure/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.tasks[PHYSIO_CANARY_TASK_IDS[2]].editable_persistence_verified = false;
  })), /lacks schema\/editable persistence proof/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.mount_count = 1;
  })), /isolated exact-image/);
  assert.throws(() => validatePhysioExactImageCanaryReceipt(changed((receipt) => {
    receipt.provider_output = 'forbidden';
  })), /key set differs/);
});

test('executed production artifact scan passes only the real fail-closed runtime posture', () => {
  assert.equal(verifyProductionArtifactPosture({
    environment: productionEnvironment(),
    root,
    distRoot: path.join(root, 'dist'),
    sealedRuntime: false,
  }), true);
  assert.throws(() => verifyProductionArtifactPosture({
    environment: productionEnvironment({ SELFTEST: '1' }),
    root,
    distRoot: path.join(root, 'dist'),
    sealedRuntime: false,
  }), /production_posture_selftest_active/);
  assert.throws(() => verifyProductionArtifactPosture({
    environment: productionEnvironment({ OPENAI_CHAT_TEST_BASE_URL: 'http:\/\/127.0.0.1:9999' }),
    root,
    distRoot: path.join(root, 'dist'),
    sealedRuntime: false,
  }), /openai_chat_test_base_url_active/);
  assert.throws(() => verifyProductionArtifactPosture({
    environment: productionEnvironment({ GENERAL_CLINICAL_LLM_ENABLED: '0' }),
    root,
    distRoot: path.join(root, 'dist'),
    sealedRuntime: false,
  }), /production_posture_general_clinical_llm_enabled_differs/);
});

test('production artifact scan rejects a forbidden mock output marker in shipped bytes', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-artifact-scan-'));
  try {
    fs.writeFileSync(path.join(temporary, 'index.html'),
      '<meta name="description" content="AssessSuite Physio test"><title>AssessSuite Physio</title>\n');
    fs.writeFileSync(path.join(temporary, 'candidate.js'),
      'export const result = "SYNTHETIC_CHAT_PROVIDER_RESPONSE";\n');
    assert.throws(() => verifyProductionArtifactPosture({
      environment: productionEnvironment(),
      root,
      distRoot: temporary,
      sealedRuntime: false,
    }), /artifact_scan_bundle_marker_candidate_js/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('production artifact scan rejects legacy and non-Physio product markers in shipped bytes', () => {
  for (const marker of [
    'https://media.base44.com/example.png',
    'Superagent One',
    'Testing bypass — demo only',
    'admin@local.test',
    'clinician@org-alpha.seed.test',
    'owner@org-alpha.seed.test',
    'change-me-local',
    'SeedDemo!2026',
  ]) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-surface-scan-'));
    try {
      fs.writeFileSync(path.join(temporary, 'index.html'),
        '<meta name="description" content="AssessSuite Physio test"><title>AssessSuite Physio</title>\n');
      fs.writeFileSync(path.join(temporary, 'candidate.js'),
        `export const forbiddenSurface = ${JSON.stringify(marker)};\n`);
      assert.throws(() => verifyProductionArtifactPosture({
        environment: productionEnvironment(),
        root,
        distRoot: temporary,
        sealedRuntime: false,
      }), /artifact_scan_bundle_non_physio_marker_candidate_js/);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
});

test('production artifact scan proves shared SOAP AI parity is enabled through the profession contract', () => {
  const source = read('src', 'components', 'calendar', 'SOAPNoteModal.jsx');
  assert.equal(verifySharedSoapAiParity(source), true);

  const unguardedPlan = source.replace(
    '{sharedSectionAiAllowed && (\n                            <Button',
    '{true && (\n                            <Button',
  );
  assert.notEqual(unguardedPlan, source, 'test fixture must remove the plan AI profession gate');
  assert.throws(() => verifySharedSoapAiParity(unguardedPlan),
    /artifact_scan_soap_shared_ai_not_feature_gated/);

  assert.throws(() => verifySharedSoapAiParity(`${source}\nbase44.integrations.Core.InvokeLLM({});`),
    /artifact_scan_soap_shared_ai_call_count_differs/);
});

test('production artifact scan proves unused SMS and placeholder image surfaces are unreachable in Physio before body parsing', () => {
  const professionSource = read('packages', 'profession-config', 'professions', 'physiotherapy.mjs');
  const serverIndexSource = read('server', 'index.mjs');
  const integrationsSource = read('server', 'integrations.mjs');
  assert.equal(verifyPhysioDisabledCoreIntegrations({ professionSource, serverIndexSource, integrationsSource }), true);

  const exposedImage = professionSource.replace(
    "disabledCoreIntegrationIds: ['SendSMS', 'GenerateImage']",
    "disabledCoreIntegrationIds: ['SendSMS']",
  );
  assert.notEqual(exposedImage, professionSource, 'negative fixture must re-expose GenerateImage');
  assert.throws(() => verifyPhysioDisabledCoreIntegrations({
    professionSource: exposedImage,
    serverIndexSource,
    integrationsSource,
  }), /artifact_scan_physio_disabled_integrations_manifest_differs/);

  const lateGate = integrationsSource.replace(
    'const { body, files } = await parseIntegrationBody(req, endpointName);',
    'const { body, files } = await parseIntegrationBody(req, endpointName);\n  // context.disabledCoreIntegrationIds?.includes(endpointName)',
  ).replace(
    "  if (context.disabledCoreIntegrationIds?.includes(endpointName)) {\n    return sendJson(res, 404, { message: `integration endpoint ${endpointName} not found` });\n  }\n",
    '',
  );
  assert.notEqual(lateGate, integrationsSource, 'negative fixture must move the gate after body parsing');
  assert.throws(() => verifyPhysioDisabledCoreIntegrations({
    professionSource,
    serverIndexSource,
    integrationsSource: lateGate,
  }), /artifact_scan_disabled_integration_gate_after_body_parse/);
});

test('producer statically binds one exact no-service/no-volume/no-custom-DNS local Docker carrier and cleans it', () => {
  const source = read('scripts', 'physio-exact-image-canary.mjs');
  assert.match(source, /'run', '--detach', '--rm', '--name', exactContainerName/);
  assert.match(source, /'--network', 'bridge'/);
  assert.match(source, /Object\.keys\(container\?\.HostConfig\?\.PortBindings \|\| \{\}\)\.length === 0/);
  assert.match(source, /Array\.isArray\(container\?\.Mounts\) && container\.Mounts\.length === 0/);
  assert.doesNotMatch(source, /'--network', 'host'|'--publish'|'--volume'/);
  assert.match(source, /'rm', '--force', containerId/);
  assert.match(source, /same_name_replacement_container_detected/);
  assert.match(source, /prior_local_container_reconciliation_failed/);
  assert.match(source, /carrier_pre_destroy_readback_sha256/);
  assert.match(source, /remaining_exact_namespace_container_count/);
  assert.match(source, /PHYSIO_CANARY_TTL_SECONDS/);
  assert.match(source, /INNER_EXEC_TIMEOUT_SECONDS = 1_500/);
  assert.match(source, /'GENERAL_CLINICAL_LLM_ENABLED=1'/);
  assert.doesNotMatch(source, /physio-canary-\$\{applicationSha\.slice\(0, 12\)\}-\$\{randomUUID/);
  assert.doesNotMatch(source, /2700s|'2400'/);
  assert.match(source, /dockerVolumeInventory\(docker\), initialVolumeInventory/);
  assert.match(source, /containerId, 'node', '\/app\/scripts\/physio-exact-image-canary\.mjs', 'run-inside'/);
  assert.match(source, /node server\/productionBootstrap\.mjs && exec node server\/index\.mjs/);
  assert.match(source, /PHYSIO_EXACT_IMAGE_CANARY_MODE=1/);
  assert.match(source, /APP_URL=\$\{PHYSIO_PUBLIC_APP_URL\}/);
  assert.match(source, /UPLOADS_DIR=\$\{PHYSIO_CANARY_UPLOADS_DIR\}/);
});

test('inside journey uses normal authenticated routes for all exact tasks, transcription and extraction', () => {
  const source = read('scripts', 'physio-exact-image-canary.mjs');
  const contract = read('scripts', 'physio-exact-image-canary-contract.mjs');
  for (const taskId of PHYSIO_CANARY_TASK_IDS) assert.match(contract, new RegExp(taskId.replaceAll('.', '\\.')));
  assert.match(source, /functions\/physioAiTask/);
  assert.match(source, /functions\/transcribeSession/);
  assert.equal((source.match(/care_episode_id:\s*subject\.episodeId/g) || []).length, 4);
  assert.equal((source.match(/client_id:\s*subject\.clientId/g) || []).length, 2);
  assert.match(source, /integration-endpoints\/Core\/ExtractDataFromUploadedFile/);
  assert.match(source, /integration-endpoints\/Core\/InvokeLLM/);
  assert.match(source, /action:\s*'dissect_to_soap'/);
  assert.match(source, /legacySoapResponse\.status === 403/);
  assert.match(source, /genericResponse\.status === 403/);
  assert.match(source, /profession_ai_surface_unavailable/);
  assert.match(source, /before\.length === after\.length/);
  assert.match(source, /provider_request_id_hash === usage\.provider_request_id_hash/);
  assert.match(source, /persistEditableTaskDraft/);
  assert.match(source, /INVALID_PROVIDER_CREDENTIAL/);
  assert.match(source, /response\.status === 502/);
  assert.match(source, /PHYSIO_CANARY_MAX_PAID_CALLS/);
  assert.match(source, /verifyProductionArtifactPosture/);
  assert.match(source, /buildPhysioProductionCanaryRuntimePlan/);
  assert.match(source, /productionBootstrap-to-server\/index/);
  assert.doesNotMatch(source, /startTestServer|server\/tests|server-harness|otp_code|verify-otp|000000/);
  assert.doesNotMatch(source, /NODE_ENV:\s*['"]test['"]/);
  assert.doesNotMatch(source, /production_mock_scan_passed:\s*true/);
});

test('deploy gate accepts only hashed request IDs and document request-unit/response receipts', () => {
  const workflowSource = read('.github', 'workflows', 'physio-production-deploy.yml');
  const contract = read('scripts', 'physio-exact-image-canary-contract.mjs');
  assert.match(workflowSource, /physio-exact-image-canary-contract\.mjs validate/);
  assert.match(workflowSource, /node scripts\/physio-deploy-admission\.mjs/);
  assert.match(contract, /sha\(value\.provider_request_id, `\$\{label\}\.success\.provider_request_id`\)/);
  assert.match(contract, /validateProviderBase\(value\.success, 'extraction', 'document'\)/);
  assert.match(contract, /positiveInteger\(value\.usage_delta\.request_units/);
  assert.match(contract, /sha\(value\.provider_response_sha256/);
});
