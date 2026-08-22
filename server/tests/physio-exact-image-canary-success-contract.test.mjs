import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PHYSIO_CANARY_PROVIDER_TASK_SET,
  PHYSIO_CANARY_TASK_IDS,
  PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_FILES,
  readAndValidatePhysioExactImageCanarySuccessPacket,
} from '../../scripts/physio-exact-image-canary-contract.mjs';
import { buildPhysioCanaryReferralPdf } from
  '../../scripts/physio-exact-image-canary-document-fixture.mjs';
import { PHYSIO_CANARY_AUDIO_SHA256 } from
  '../../scripts/physio-exact-image-canary-fixture.mjs';
import {
  derivePhysioCanaryCapabilityBindingSha256,
  derivePhysioCanaryProviderEffectId,
} from '../../scripts/physio-exact-image-canary-success-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const contractCli = path.join(root, 'scripts', 'physio-exact-image-canary-contract.mjs');
const dataFiles = PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_FILES.filter(
  (name) => name !== 'SHA256SUMS',
);
const applicationSha = '1'.repeat(40);
const immutableImage = `sha256:${'2'.repeat(64)}`;
const archiveSha256 = `sha256:${'c'.repeat(64)}`;
const maximumCostMicrousd = 3_000_000;
const artifactId = 123;
const artifactDigest = `sha256:${'a'.repeat(64)}`;
const candidateReceiptSha256 = 'b'.repeat(64);
const capabilityIntentId = 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP';
const authorityReference = 'mission:UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP-LIVE';

const prefixedDigest = (character) => `sha256:${character.repeat(64)}`;
const rawHash = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const canonicalUsage = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalUsage).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalUsage(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
};

function providerSuccess(kind = 'tokens') {
  const usageDelta = kind === 'audio'
    ? { audio_seconds: 2, estimated_cost_microusd: 200 }
    : kind === 'document'
      ? { request_units: 1, estimated_cost_microusd: 900 }
      : {
          input_tokens: 101,
          cached_input_tokens: 0,
          output_tokens: 23,
          estimated_cost_microusd: 500,
        };
  return {
    status: 'PASS',
    provider_posture: 'real',
    provider: 'openai',
    model: kind === 'audio' ? 'whisper-1' : 'gpt-4.1-mini-2025-04-14',
    provider_request_id: prefixedDigest('a'),
    schema_receipt_sha256: prefixedDigest('b'),
    ...(kind === 'document' ? { provider_response_sha256: prefixedDigest('c') } : {}),
    usage_delta: usageDelta,
  };
}

function providerFault() {
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

function canaryReceipt() {
  return {
    contract_version: 'assesssuite-physio-exact-image-canary/3.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    immutable_image: immutableImage,
    image_digest: immutableImage,
    candidate_archive_sha256: archiveSha256,
    profession_id: 'physio',
    app_id: 'local-assesssuite-physio',
    carrier_type: 'local-docker',
    carrier_id_sha256: prefixedDigest('3'),
    isolated_candidate_image_verified: true,
    prior_carrier_reconciled: false,
    prior_carrier_admission_readback_sha256: prefixedDigest('4'),
    carrier_pre_destroy_readback_sha256: prefixedDigest('5'),
    carrier_post_destroy_readback_sha256: prefixedDigest('6'),
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
      success_bootstrap_receipt_sha256: prefixedDigest('4'),
      fault_bootstrap_receipt_sha256: prefixedDigest('5'),
      success_version_receipt_sha256: prefixedDigest('6'),
      fault_version_receipt_sha256: prefixedDigest('7'),
      success_capability_vector_sha256: prefixedDigest('8'),
      fault_capability_vector_sha256: prefixedDigest('9'),
      runtime_tree_manifest_receipt_sha256: prefixedDigest('a'),
      observed_release_sha: applicationSha,
      observed_immutable_image: immutableImage,
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
    cost_ceiling_microusd: maximumCostMicrousd,
    actual_cost_microusd: 4_100,
    tasks: Object.fromEntries(PHYSIO_CANARY_TASK_IDS.map((taskId) => [taskId, {
      success: providerSuccess(),
      fault: providerFault(),
      structured_schema_valid: true,
      editable_persistence_verified: true,
      persistence_receipt_sha256: prefixedDigest('d'),
    }])),
    transcription: {
      success: providerSuccess('audio'),
      fault: providerFault(),
      real_media_fixture: true,
      fixture_receipt_sha256: prefixedDigest('e'),
    },
    extraction: {
      success: providerSuccess('document'),
      fault: providerFault(),
      real_document_fixture: true,
      fixture_receipt_sha256: prefixedDigest('f'),
    },
    started_at: '2026-08-22T01:00:00.000Z',
    completed_at: '2026-08-22T01:01:00.000Z',
  };
}

function refreshManifest(directory) {
  const manifest = dataFiles.map((name) => (
    `${rawHash(fs.readFileSync(path.join(directory, name)))}  ${name}`
  )).join('\n');
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), `${manifest}\n`);
}

function readJson(directory, name) {
  return JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
}

function writeJson(directory, name, value) {
  fs.writeFileSync(path.join(directory, name), canonical(value));
}

function mutateJson(directory, name, mutator) {
  const value = readJson(directory, name);
  mutator(value);
  writeJson(directory, name, value);
  return value;
}

function buildPacket(directory) {
  const candidate = {
    contract_version: 'assesssuite-github-artifact-admission/1.0.0',
    result: 'PASS',
    repository: 'mbvidler-ctrl/assesssuite_migration',
    application_sha: applicationSha,
    artifacts: {
      candidate: {
        id: artifactId,
        name: `physio-candidate-${applicationSha}`,
        digest: artifactDigest,
        expired: false,
        size_in_bytes: 123_456,
        maximum_bytes: 1_073_741_824,
        workflow_run_id: 456,
        workflow_run_head_sha: applicationSha,
        workflow_run_head_branch: 'main',
        workflow_run_path: '.github/workflows/physio-production-prepare-release.yml',
        workflow_run_event: 'workflow_dispatch',
        workflow_run_conclusion: 'success',
        repository: 'mbvidler-ctrl/assesssuite_migration',
      },
    },
    admitted_at: '2026-08-22T00:58:00.000Z',
  };
  writeJson(directory, 'candidate-artifact-admission.json', candidate);
  writeJson(directory, 'candidate-artifact-execution-admission.json', candidate);
  const candidateHash = rawHash(canonical(candidate));

  const provider = {
    contract_version: 'assesssuite-physio-exact-image-canary-admission/1.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    candidate_artifact_id: artifactId,
    candidate_artifact_digest: artifactDigest,
    candidate_receipt_sha256: candidateReceiptSha256,
    candidate_archive_sha256: archiveSha256,
    oci_archive_sha256: prefixedDigest('d'),
    oci_manifest_digest: prefixedDigest('e'),
    oci_descriptor_manifest_sha256: 'f'.repeat(64),
    local_image_id: immutableImage,
    provider_task_set: PHYSIO_CANARY_PROVIDER_TASK_SET.join(','),
    provider_call_maximum: 8,
    maximum_cost_microusd: maximumCostMicrousd,
    capability_intent_id: capabilityIntentId,
    authority_reference: authorityReference,
    audio_fixture_sha256: PHYSIO_CANARY_AUDIO_SHA256,
    document_fixture_sha256: rawHash(buildPhysioCanaryReferralPdf()),
    provider_effect_id: prefixedDigest('0'),
    candidate_artifact_admission_receipt_sha256: candidateHash,
    candidate_source_run_id: 456,
    admitted_at: '2026-08-22T00:59:00.000Z',
  };
  provider.provider_effect_id = derivePhysioCanaryProviderEffectId(provider);
  writeJson(directory, 'provider-canary-admission.json', provider);
  const providerHash = rawHash(canonical(provider));

  const sharedProvider = Object.fromEntries([
    'application', 'application_sha', 'candidate_artifact_id', 'candidate_artifact_digest',
    'candidate_receipt_sha256', 'candidate_archive_sha256', 'oci_archive_sha256',
    'oci_manifest_digest', 'oci_descriptor_manifest_sha256', 'local_image_id',
    'provider_task_set', 'provider_call_maximum', 'maximum_cost_microusd',
    'capability_intent_id', 'authority_reference', 'audio_fixture_sha256',
    'document_fixture_sha256', 'provider_effect_id',
  ].map((name) => [name, provider[name]]));
  const started = {
    contract_version: 'assesssuite-physio-exact-image-canary-effect/1.0.0',
    result: 'STARTED',
    ...sharedProvider,
    candidate_admission_receipt_sha256: providerHash,
    candidate_artifact_admission_receipt_sha256: candidateHash,
    github_run_id: 789,
    github_run_attempt: 1,
    started_at: '2026-08-22T01:00:00.000Z',
  };
  writeJson(directory, 'provider-canary-started-effect.json', started);

  const canary = canaryReceipt();
  writeJson(directory, 'physio-exact-image-canary.json', canary);
  const successes = [
    ...PHYSIO_CANARY_TASK_IDS.map((taskId) => canary.tasks[taskId].success),
    canary.transcription.success,
    canary.extraction.success,
  ];
  const partialCalls = PHYSIO_CANARY_PROVIDER_TASK_SET.map((providerTask, index) => ({
    call_ordinal: index + 1,
    provider_task: providerTask,
    provider_request_id_sha256: successes[index].provider_request_id,
    usage_receipt_sha256: `sha256:${rawHash(canonicalUsage(successes[index].usage_delta))}`,
    actual_cost_microusd: successes[index].usage_delta.estimated_cost_microusd,
  }));
  const effect = {
    contract_version: 'assesssuite-physio-exact-image-canary-effect/1.0.0',
    result: 'COMPLETED',
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    provider_effect_id: provider.provider_effect_id,
    candidate_archive_sha256: archiveSha256,
    local_image_id: immutableImage,
    provider_call_maximum: 8,
    maximum_cost_microusd: maximumCostMicrousd,
    started_effect_receipt_sha256: rawHash(canonical(started)),
    partial_provider_calls: partialCalls,
    partial_provider_request_id_hashes: partialCalls.map(
      (row) => row.provider_request_id_sha256,
    ),
    partial_provider_usage: {
      usage_complete: true,
      calls_succeeded: 8,
      actual_cost_microusd: 4_100,
      last_observed_call_ordinal: 8,
    },
    producer_exit_code: 0,
    producer_stdout_sha256: prefixedDigest('8'),
    producer_stderr_sha256: prefixedDigest('9'),
    error_receipt_sha256: null,
    completed_at: '2026-08-22T01:02:00.000Z',
  };
  writeJson(directory, 'canary-effect-reconciliation.json', effect);

  const fileHash = (name) => rawHash(fs.readFileSync(path.join(directory, name)));
  const completed = {
    contract_version: 'assesssuite-physio-exact-image-canary-completed-effect/1.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    provider_effect_id: provider.provider_effect_id,
    provider_call_maximum: 8,
    started_effect_receipt_sha256: fileHash('provider-canary-started-effect.json'),
    effect_reconciliation_receipt_sha256: fileHash('canary-effect-reconciliation.json'),
    canary_receipt_sha256: fileHash('physio-exact-image-canary.json'),
    provider_canary_admission_receipt_sha256: fileHash('provider-canary-admission.json'),
    candidate_artifact_admission_receipt_sha256:
      fileHash('candidate-artifact-admission.json'),
    candidate_artifact_execution_admission_receipt_sha256:
      fileHash('candidate-artifact-execution-admission.json'),
    reconciled_at: '2026-08-22T01:03:00.000Z',
  };
  writeJson(directory, 'canary-completed-effect-reconciliation.json', completed);
  refreshManifest(directory);
  return { candidate, provider, started, canary, effect, completed };
}

function withPacket(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-canary-success-packet-'));
  try {
    const receipts = buildPacket(directory);
    return run(directory, receipts);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function validate(directory, expectedCanaryReceiptSha256) {
  const capabilityBindingSha256 = derivePhysioCanaryCapabilityBindingSha256({
    capability_intent_id: capabilityIntentId,
    authority_reference: authorityReference,
  });
  return readAndValidatePhysioExactImageCanarySuccessPacket(directory, {
    expectedApplicationSha: applicationSha,
    expectedImmutableImage: immutableImage,
    expectedCandidateArchiveSha256: archiveSha256,
    expectedCanaryReceiptSha256,
    expectedProviderEffectId: derivePhysioCanaryProviderEffectId({
      application: 'assesssuite-physio-production',
      application_sha: applicationSha,
      capability_intent_id: capabilityIntentId,
      audio_fixture_sha256: PHYSIO_CANARY_AUDIO_SHA256,
      document_fixture_sha256: rawHash(buildPhysioCanaryReferralPdf()),
    }),
    expectedCandidateArtifactId: artifactId,
    expectedCandidateArtifactDigest: artifactDigest,
    expectedCandidateReceiptSha256: candidateReceiptSha256,
    expectedCapabilityIntentId: capabilityIntentId,
    expectedAuthorityReference: authorityReference,
    expectedCapabilityBindingSha256: capabilityBindingSha256,
    maximumCostMicrousd,
  });
}

test('exact eight-file packet passes the shared API and realistic CLI boundary', () => {
  withPacket((directory) => {
    const canaryHash = rawHash(fs.readFileSync(
      path.join(directory, 'physio-exact-image-canary.json'),
    ));
    const admitted = validate(directory, canaryHash);
    assert.equal(admitted.result, 'PASS');
    assert.equal(admitted.applicationSha, applicationSha);
    assert.equal(admitted.candidateArtifactId, artifactId);
    assert.equal(admitted.capabilityBindingSha256,
      derivePhysioCanaryCapabilityBindingSha256({
        capability_intent_id: capabilityIntentId,
        authority_reference: authorityReference,
      }));
    assert.equal(admitted.receipts.effect.partial_provider_calls.length, 8);

    const cli = spawnSync(process.execPath, [
      contractCli,
      'validate-success-packet',
      '--packet', directory,
      '--application-sha', applicationSha,
      '--immutable-image', immutableImage,
      '--candidate-archive-sha256', archiveSha256,
      '--canary-receipt-sha256', canaryHash,
      '--capability-binding-sha256', admitted.capabilityBindingSha256,
      '--maximum-cost-microusd', String(maximumCostMicrousd),
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /success packet: PASS/);
  });
});

test('packet filesystem and checksum boundary fails closed', async (t) => {
  await t.test('extra member', () => withPacket((directory) => {
    fs.writeFileSync(path.join(directory, 'unadmitted.json'), '{}\n');
    assert.throws(() => validate(directory), /packet file set differs/);
  }));
  await t.test('checksum mismatch', () => withPacket((directory) => {
    fs.appendFileSync(path.join(directory, 'physio-exact-image-canary.json'), ' ');
    assert.throws(() => validate(directory), /checksum differs/);
  }));
  await t.test('noncanonical JSON despite refreshed checksum', () => withPacket((directory) => {
    const file = path.join(directory, 'provider-canary-admission.json');
    fs.writeFileSync(file, JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))));
    refreshManifest(directory);
    assert.throws(() => validate(directory), /not canonical JSON/);
  }));
  await t.test('linked packet member', (subtest) => withPacket((directory) => {
    const target = path.join(directory, 'outside.json');
    const member = path.join(directory, 'provider-canary-admission.json');
    fs.copyFileSync(member, target);
    fs.rmSync(member);
    try {
      fs.symlinkSync(target, member, 'file');
    } catch (error) {
      if (error?.code === 'EPERM') return subtest.skip('symlink creation is unavailable');
      throw error;
    }
    fs.rmSync(target);
    assert.throws(() => validate(directory), /linked|packet file set differs/);
  }));
});

test('strict admissions reject schema drift, reruns and wrong candidate source', async (t) => {
  for (const [name, file, mutate, pattern] of [
    ['provider extra key', 'provider-canary-admission.json',
      (row) => { row.unexpected = true; }, /provider admission key set differs/],
    ['STARTED rerun attempt', 'provider-canary-started-effect.json',
      (row) => { row.github_run_attempt = 2; }, /STARTED github_run_attempt differs/],
    ['candidate source branch', 'candidate-artifact-admission.json',
      (row) => { row.artifacts.candidate.workflow_run_head_branch = 'dev'; },
      /candidate source branch differs/],
  ]) {
    await t.test(name, () => withPacket((directory) => {
      mutateJson(directory, file, mutate);
      refreshManifest(directory);
      assert.throws(() => validate(directory), pattern);
    }));
  }
  await t.test('capability binding from another child envelope', () => withPacket((directory) => {
    assert.throws(() => readAndValidatePhysioExactImageCanarySuccessPacket(directory, {
      expectedApplicationSha: applicationSha,
      expectedCapabilityBindingSha256: '0'.repeat(64),
    }), /expected capability binding SHA differs/);
  }));
});

test('raw hash joins and original/execution admission byte identity reject tampering', async (t) => {
  await t.test('STARTED no longer joins provider admission', () => withPacket((directory) => {
    mutateJson(directory, 'provider-canary-started-effect.json', (row) => {
      row.candidate_admission_receipt_sha256 = '0'.repeat(64);
    });
    const startedHash = rawHash(fs.readFileSync(
      path.join(directory, 'provider-canary-started-effect.json'),
    ));
    mutateJson(directory, 'canary-effect-reconciliation.json', (row) => {
      row.started_effect_receipt_sha256 = startedHash;
    });
    mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
      row.started_effect_receipt_sha256 = startedHash;
      row.effect_reconciliation_receipt_sha256 = rawHash(fs.readFileSync(
        path.join(directory, 'canary-effect-reconciliation.json'),
      ));
    });
    refreshManifest(directory);
    assert.throws(() => validate(directory), /STARTED\/provider admission hash join differs/);
  }));
  await t.test('execution admission differs even when completed hash is refreshed', () => (
    withPacket((directory) => {
      mutateJson(directory, 'candidate-artifact-execution-admission.json', (row) => {
        row.admitted_at = '2026-08-22T00:58:01.000Z';
      });
      mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
        row.candidate_artifact_execution_admission_receipt_sha256 = rawHash(
          fs.readFileSync(path.join(directory, 'candidate-artifact-execution-admission.json')),
        );
      });
      refreshManifest(directory);
      assert.throws(() => validate(directory), /original\/execution admission bytes differ/);
    })
  ));
  await t.test('completed reconciliation hash lies', () => withPacket((directory) => {
    mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
      row.canary_receipt_sha256 = '0'.repeat(64);
    });
    refreshManifest(directory);
    assert.throws(() => validate(directory), /canary_receipt_sha256 join differs/);
  }));
});

test('shared effect identity, source run, eight calls and final cost reject tampering', async (t) => {
  await t.test('provider effect ID cannot be relabelled consistently', () => withPacket((directory) => {
    const forged = prefixedDigest('f');
    for (const name of [
      'provider-canary-admission.json',
      'provider-canary-started-effect.json',
      'canary-effect-reconciliation.json',
      'canary-completed-effect-reconciliation.json',
    ]) mutateJson(directory, name, (row) => { row.provider_effect_id = forged; });
    refreshManifest(directory);
    assert.throws(() => validate(directory), /derived provider_effect_id differs/);
  }));
  await t.test('candidate source run is cross-bound', () => withPacket((directory) => {
    mutateJson(directory, 'provider-canary-admission.json', (row) => {
      row.candidate_source_run_id += 1;
    });
    const providerHash = rawHash(fs.readFileSync(
      path.join(directory, 'provider-canary-admission.json'),
    ));
    mutateJson(directory, 'provider-canary-started-effect.json', (row) => {
      row.candidate_admission_receipt_sha256 = providerHash;
    });
    mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
      row.provider_canary_admission_receipt_sha256 = providerHash;
      row.started_effect_receipt_sha256 = rawHash(fs.readFileSync(
        path.join(directory, 'provider-canary-started-effect.json'),
      ));
    });
    mutateJson(directory, 'canary-effect-reconciliation.json', (row) => {
      row.started_effect_receipt_sha256 = rawHash(fs.readFileSync(
        path.join(directory, 'provider-canary-started-effect.json'),
      ));
    });
    mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
      row.effect_reconciliation_receipt_sha256 = rawHash(fs.readFileSync(
        path.join(directory, 'canary-effect-reconciliation.json'),
      ));
    });
    refreshManifest(directory);
    assert.throws(() => validate(directory), /provider\/candidate source run ID differs/);
  }));
  await t.test('COMPLETED cannot claim seven calls', () => withPacket((directory) => {
    mutateJson(directory, 'canary-effect-reconciliation.json', (row) => {
      row.partial_provider_calls.pop();
      row.partial_provider_request_id_hashes.pop();
      row.partial_provider_usage = {
        usage_complete: false,
        calls_succeeded: 7,
        actual_cost_microusd: 3_200,
        last_observed_call_ordinal: 7,
      };
    });
    refreshManifest(directory);
    assert.throws(() => validate(directory), /completed provider effect differs/);
  }));
  await t.test('final canary cost must equal terminal effect cost', () => withPacket((directory) => {
    mutateJson(directory, 'physio-exact-image-canary.json', (row) => {
      row.actual_cost_microusd += 1;
    });
    mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
      row.canary_receipt_sha256 = rawHash(fs.readFileSync(
        path.join(directory, 'physio-exact-image-canary.json'),
      ));
    });
    refreshManifest(directory);
    assert.throws(() => validate(directory), /actual provider cost differs/);
  }));
  await t.test('final provider request cannot be spliced from another eight-call run', () => (
    withPacket((directory) => {
      mutateJson(directory, 'physio-exact-image-canary.json', (row) => {
        row.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.provider_request_id = prefixedDigest('f');
      });
      mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
        row.canary_receipt_sha256 = rawHash(fs.readFileSync(
          path.join(directory, 'physio-exact-image-canary.json'),
        ));
      });
      refreshManifest(directory);
      assert.throws(() => validate(directory), /provider call 1 provider_request_id_sha256 differs/);
    })
  ));
  await t.test('final usage receipt cannot be spliced while preserving aggregate cost', () => (
    withPacket((directory) => {
      mutateJson(directory, 'physio-exact-image-canary.json', (row) => {
        const first = row.tasks[PHYSIO_CANARY_TASK_IDS[0]].success.usage_delta;
        const second = row.tasks[PHYSIO_CANARY_TASK_IDS[1]].success.usage_delta;
        first.input_tokens += 1;
        second.input_tokens -= 1;
      });
      mutateJson(directory, 'canary-completed-effect-reconciliation.json', (row) => {
        row.canary_receipt_sha256 = rawHash(fs.readFileSync(
          path.join(directory, 'physio-exact-image-canary.json'),
        ));
      });
      refreshManifest(directory);
      assert.throws(() => validate(directory), /provider call 1 usage_receipt_sha256 differs/);
    })
  ));
});

test('success-packet CLI rejects duplicate and unknown arguments', () => {
  for (const args of [
    ['validate-success-packet', '--packet', 'x', '--packet', 'y'],
    ['validate-success-packet', '--packet', 'x', '--unknown', 'y'],
  ]) {
    const result = spawnSync(process.execPath, [contractCli, ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing, duplicated or unknown/);
  }
});
