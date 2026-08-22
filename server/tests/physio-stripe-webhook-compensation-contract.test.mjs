import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyStripeWebhookCompensationProviderList,
  validateStripeWebhookCompensationPacket,
} from '../../scripts/physio-stripe-webhook-evidence.mjs';

const APP_SHA = 'a'.repeat(40);
const BOOTSTRAP_SHA = 'b'.repeat(64);
const INTENT = 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:stripe-webhook';
const AUTHORITY = 'UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP';
const ENDPOINT_URL =
  'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook';
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'invoice.payment_failed',
];
const ZERO = '0'.repeat(64);

const sha = (value) => createHash('sha256').update(value).digest('hex');
const shaFile = (file) => sha(fs.readFileSync(file));
const writeJson = (root, name, value) => fs.writeFileSync(
  path.join(root, name),
  `${JSON.stringify(value, null, 2)}\n`,
);

function writeChecksums(root) {
  const lines = fs.readdirSync(root).filter((name) => name !== 'SHA256SUMS').sort()
    .map((name) => `${shaFile(path.join(root, name))}  ${name}`);
  fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

function request({ generation, identitySha, priorEffectSha, priorRequestSha,
  priorAdmissionSha, priorIdempotencySha, predecessorControlSha = generation === 0
    ? ZERO : priorEffectSha, predecessorControlKind = generation === 0
    ? 'NOT_APPLICABLE' : 'EFFECT_RECONCILIATION' }) {
  const idempotencyKey = `physio-webhook-${sha([
    APP_SHA, BOOTSTRAP_SHA, INTENT, String(generation), priorEffectSha,
  ].join('|')).slice(0, 40)}`;
  const row = {
    endpoint: ENDPOINT_URL,
    api_version: '2026-07-29.dahlia',
    enabled_events: EVENTS,
    metadata: {
      appId: 'local-assesssuite-physio',
      applicationSha: APP_SHA,
      bootstrapReceiptSha256: BOOTSTRAP_SHA,
      capabilityIntentId: INTENT,
      effectGeneration: String(generation),
      professionId: 'physio',
      startedEffectReceiptSha256: identitySha,
    },
    capability_intent_id: INTENT,
    authority_reference: AUTHORITY,
    effect_generation: generation,
    prior_effect_receipt_sha256: priorEffectSha,
    predecessor_control_receipt_sha256: predecessorControlSha,
    predecessor_control_kind: predecessorControlKind,
    prior_request_sha256: priorRequestSha,
    prior_artifact_admission_sha256: priorAdmissionSha,
    idempotency_key_sha256: sha(idempotencyKey),
    prior_idempotency_key_sha256: priorIdempotencySha,
  };
  row.request_sha256 = sha(JSON.stringify(row));
  row.metadata.requestSha256 = row.request_sha256;
  return row;
}

function identity(generation, requestRow) {
  return {
    contract_version: 'assesssuite-physio-stripe-webhook-effect-identity/1.0.0',
    result: 'STARTED',
    application: 'assesssuite-physio-production',
    application_sha: APP_SHA,
    bootstrap_receipt_sha256: BOOTSTRAP_SHA,
    exact_image_canary_receipt_sha256: 'c'.repeat(64),
    capability_intent_id: INTENT,
    authority_reference: AUTHORITY,
    effect_generation: generation,
    prior_effect_receipt_sha256: requestRow.prior_effect_receipt_sha256,
    predecessor_control_receipt_sha256: requestRow.predecessor_control_receipt_sha256 ??
      (generation === 0 ? ZERO : requestRow.prior_effect_receipt_sha256),
    predecessor_control_kind: requestRow.predecessor_control_kind ??
      (generation === 0 ? 'NOT_APPLICABLE' : 'EFFECT_RECONCILIATION'),
    prior_request_sha256: requestRow.prior_request_sha256,
    prior_artifact_admission_sha256: requestRow.prior_artifact_admission_sha256,
    idempotency_key_sha256: requestRow.idempotency_key_sha256,
    prior_idempotency_key_sha256: requestRow.prior_idempotency_key_sha256,
  };
}

function endpoint(metadata, id = 'we_prior123') {
  return {
    id,
    url: ENDPOINT_URL,
    status: 'enabled',
    api_version: '2026-07-29.dahlia',
    enabled_events: EVENTS,
    metadata,
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-webhook-compensation-'));
  const selectedArtifactName = `physio-stripe-webhook-started-${APP_SHA}`;
  const selectedArtifactDigest = `sha256:${'1'.repeat(64)}`;
  const admission = {
    contract_version: 'assesssuite-github-artifact-admission/1.0.0',
    result: 'PASS',
    repository: 'mbvidler-ctrl/assesssuite_migration',
    application_sha: APP_SHA,
    artifacts: { resume_started_effect: {
      id: 123,
      name: selectedArtifactName,
      digest: selectedArtifactDigest,
      size_in_bytes: 1234,
      workflow_run_id: 456,
    } },
    admitted_at: '2026-08-22T00:00:00.000Z',
  };
  writeJson(root, 'resume-artifact-admission.json', admission);
  writeJson(root, 'resume-sibling-inventory.json', {
    contract_version: 'assesssuite-webhook-resume-sibling-inventory/1.0.0',
    result: 'PASS',
    application_sha: APP_SHA,
    source_run_id: 456,
    selected_artifact_id: 123,
    selected_artifact_name: selectedArtifactName,
    selected_lifecycle_kind: 'STARTED',
    selected_is_latest: true,
    eligible_artifacts: [{
      id: 123,
      name: selectedArtifactName,
      digest: selectedArtifactDigest,
      expired: false,
      size_in_bytes: 1234,
      lifecycle_kind: 'STARTED',
      generation: null,
      revision: null,
    }],
    inventoried_at: '2026-08-22T00:00:00.000Z',
  });
  writeJson(root, 'outstanding-effect-inventory.json', {
    contract_version: 'assesssuite-outstanding-effect-inventory/2.0.0',
    result: 'NOT_APPLICABLE',
    application_sha: APP_SHA,
    historical_artifact_count: null,
    historical_artifact_classes: ['STARTED', 'PROVIDER_PLAN', 'COMPENSATION_PHASE', 'EFFECT', 'COMPLETED'],
    expired_metadata_included: true,
    pages_scanned: null,
  });

  const priorPlaceholderIdentity = identity(0, {
    prior_effect_receipt_sha256: ZERO,
    predecessor_control_receipt_sha256: ZERO,
    predecessor_control_kind: 'NOT_APPLICABLE',
    prior_request_sha256: ZERO,
    prior_artifact_admission_sha256: shaFile(path.join(root, 'resume-artifact-admission.json')),
    idempotency_key_sha256: 'd'.repeat(64),
    prior_idempotency_key_sha256: ZERO,
  });
  writeJson(root, 'prior-stripe-webhook-effect-identity.json', priorPlaceholderIdentity);
  const priorIdentitySha = shaFile(path.join(root, 'prior-stripe-webhook-effect-identity.json'));
  const priorRequest = request({
    generation: 0,
    identitySha: priorIdentitySha,
    priorEffectSha: ZERO,
    priorRequestSha: ZERO,
    priorAdmissionSha: shaFile(path.join(root, 'resume-artifact-admission.json')),
    priorIdempotencySha: ZERO,
  });
  priorPlaceholderIdentity.idempotency_key_sha256 = priorRequest.idempotency_key_sha256;
  writeJson(root, 'prior-stripe-webhook-effect-identity.json', priorPlaceholderIdentity);
  const stablePriorIdentitySha = shaFile(path.join(root, 'prior-stripe-webhook-effect-identity.json'));
  priorRequest.metadata.startedEffectReceiptSha256 = stablePriorIdentitySha;
  const priorForHash = structuredClone(priorRequest);
  delete priorForHash.request_sha256;
  delete priorForHash.metadata.requestSha256;
  priorRequest.request_sha256 = sha(JSON.stringify(priorForHash));
  priorRequest.metadata.requestSha256 = priorRequest.request_sha256;
  writeJson(root, 'prior-stripe-webhook-request-manifest.json', priorRequest);
  writeJson(root, 'prior-stripe-webhook-effect-reconciliation.json', {
    contract_version: 'assesssuite-physio-stripe-webhook-effect-reconciliation/1.0.0',
    result: 'STARTED_UNRESOLVED',
    application_sha: APP_SHA,
    bootstrap_receipt_sha256: BOOTSTRAP_SHA,
    capability_intent_id: INTENT,
    authority_reference: AUTHORITY,
    effect_generation: 0,
    predecessor_control_receipt_sha256: ZERO,
    predecessor_control_kind: 'NOT_APPLICABLE',
    request_sha256: priorRequest.request_sha256,
    effect_identity_receipt_sha256: stablePriorIdentitySha,
    idempotency_key_sha256: priorRequest.idempotency_key_sha256,
  });
  const priorEffectSha = shaFile(path.join(root, 'prior-stripe-webhook-effect-reconciliation.json'));

  const currentIdentitySeed = identity(1, {
    prior_effect_receipt_sha256: priorEffectSha,
    predecessor_control_receipt_sha256: priorEffectSha,
    predecessor_control_kind: 'EFFECT_RECONCILIATION',
    prior_request_sha256: priorRequest.request_sha256,
    prior_artifact_admission_sha256: shaFile(path.join(root, 'resume-artifact-admission.json')),
    idempotency_key_sha256: 'e'.repeat(64),
    prior_idempotency_key_sha256: priorRequest.idempotency_key_sha256,
  });
  writeJson(root, 'stripe-webhook-effect-identity.json', currentIdentitySeed);
  const currentIdentitySha = shaFile(path.join(root, 'stripe-webhook-effect-identity.json'));
  const currentRequest = request({
    generation: 1,
    identitySha: currentIdentitySha,
    priorEffectSha,
    priorRequestSha: priorRequest.request_sha256,
    priorAdmissionSha: shaFile(path.join(root, 'resume-artifact-admission.json')),
    priorIdempotencySha: priorRequest.idempotency_key_sha256,
  });
  currentIdentitySeed.idempotency_key_sha256 = currentRequest.idempotency_key_sha256;
  writeJson(root, 'stripe-webhook-effect-identity.json', currentIdentitySeed);
  const stableCurrentIdentitySha = shaFile(path.join(root, 'stripe-webhook-effect-identity.json'));
  currentRequest.metadata.startedEffectReceiptSha256 = stableCurrentIdentitySha;
  const currentForHash = structuredClone(currentRequest);
  delete currentForHash.request_sha256;
  delete currentForHash.metadata.requestSha256;
  currentRequest.request_sha256 = sha(JSON.stringify(currentForHash));
  currentRequest.metadata.requestSha256 = currentRequest.request_sha256;
  writeJson(root, 'stripe-webhook-request-manifest.json', currentRequest);
  writeJson(root, 'stripe-webhook-effect-reconciliation.json', {
    contract_version: 'assesssuite-physio-stripe-webhook-effect-reconciliation/1.0.0',
    result: 'STARTED',
    application: 'assesssuite-physio-production',
    application_sha: APP_SHA,
    bootstrap_receipt_sha256: BOOTSTRAP_SHA,
    exact_image_canary_receipt_sha256: 'c'.repeat(64),
    admission_receipt_sha256: '9'.repeat(64),
    capability_intent_id: INTENT,
    authority_reference: AUTHORITY,
    resume_started_effect_receipt_sha256: priorEffectSha,
    prior_request_sha256: priorRequest.request_sha256,
    effect_generation: 1,
    predecessor_control_receipt_sha256: priorEffectSha,
    predecessor_control_kind: 'EFFECT_RECONCILIATION',
    prior_artifact_admission_sha256: shaFile(path.join(root, 'resume-artifact-admission.json')),
    request_sha256: currentRequest.request_sha256,
    effect_identity_receipt_sha256: stableCurrentIdentitySha,
    idempotency_key_sha256: currentRequest.idempotency_key_sha256,
    prior_idempotency_key_sha256: priorRequest.idempotency_key_sha256,
    prior_effect_resolution: 'PENDING',
    prior_effect_readback_sha256: null,
    orphan_compensation_contract_version:
      'assesssuite-physio-stripe-webhook-orphan-compensation/1.0.0',
    orphan_compensation_policy:
      'delete-exact-metadata-bound-endpoint-prove-absence-then-recreate',
    orphan_compensation_authorized: true,
    orphan_endpoint_compensated: false,
    orphan_endpoint_id_sha256: null,
    compensation_delete_request_id_sha256: null,
    compensation_absence_readback_sha256: null,
    provider_list_before_sha256: null,
    provider_create_exit_code: null,
    provider_create_http_status: null,
    provider_endpoint_readback_sha256: null,
    fly_secret_prestate: null,
    fly_secret_import_exit_code: null,
    fly_secret_readback_sha256: null,
    started_at: '2026-08-22T00:00:01.000Z',
    completed_at: null,
  });
  const startedSha = shaFile(path.join(root, 'stripe-webhook-effect-reconciliation.json'));
  const target = endpoint(priorRequest.metadata);
  writeJson(root, 'stripe-provider-probe.json', {
    has_more: false,
    exact_url_count: 1,
    physio_metadata_bound_count: 1,
    exact_endpoint: target,
  });
  writeJson(root, 'provider-probe-request-id-hashes.json', {
    contract_version: 'assesssuite-provider-request-id-hashes/1.0.0',
    provider: 'stripe',
    hashes: { provider_probe: 'f'.repeat(64) },
  });
  const plan = {
    contract_version: 'assesssuite-physio-stripe-webhook-effect-plan/1.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: APP_SHA,
    bootstrap_receipt_sha256: BOOTSTRAP_SHA,
    capability_intent_id: INTENT,
    authority_reference: AUTHORITY,
    started_effect_receipt_sha256: startedSha,
    request_sha256: currentRequest.request_sha256,
    effect_generation: 1,
    prior_effect_receipt_sha256: priorEffectSha,
    prior_effect_resolution: 'COMMIT_PRESENT_REQUIRES_COMPENSATION',
    prior_effect_readback_sha256: shaFile(path.join(root, 'stripe-provider-probe.json')),
    provider_state: 'EXACT',
    planned_action: 'RECONCILE_OR_COMPENSATE_EXACT',
    exact_endpoint_id: target.id,
    exact_endpoint_id_sha256: sha(target.id),
    endpoint_lineage: 'PRIOR',
    endpoint_effect_generation: 0,
    endpoint_request_sha256: priorRequest.request_sha256,
    endpoint_started_effect_receipt_sha256: stablePriorIdentitySha,
    observed_endpoint_lineage: 'PRIOR',
    observed_endpoint_effect_generation: 0,
    observed_endpoint_request_sha256: priorRequest.request_sha256,
    observed_endpoint_started_effect_receipt_sha256: stablePriorIdentitySha,
    current_effect_identity_receipt_sha256: stableCurrentIdentitySha,
    provider_probe_readback_sha256: shaFile(path.join(root, 'stripe-provider-probe.json')),
    provider_probe_request_id_hashes_sha256: shaFile(path.join(root, 'provider-probe-request-id-hashes.json')),
    provider_mutation_absent: true,
    probed_at: '2026-08-22T00:00:02.000Z',
  };
  writeJson(root, 'stripe-provider-plan.json', plan);
  const planSha = shaFile(path.join(root, 'stripe-provider-plan.json'));
  const lineageSha = sha([
    priorEffectSha,
    shaFile(path.join(root, 'prior-stripe-webhook-request-manifest.json')),
    stablePriorIdentitySha,
  ].join('|'));
  const effectIdentity = sha(JSON.stringify({
    operation: 'DELETE',
    effect_generation: 1,
    request_sha256: currentRequest.request_sha256,
    provider_plan_receipt_sha256: planSha,
    target_endpoint_id_sha256: sha(target.id),
    target_request_sha256: priorRequest.request_sha256,
    target_effect_identity_receipt_sha256: stablePriorIdentitySha,
  }));
  const phase0 = {
    contract_version: 'assesssuite-physio-stripe-webhook-compensation-phase/2.0.0',
    result: 'STARTED',
    phase: 'DELETE_INTENT',
    operation: 'DELETE',
    revision: 0,
    application_sha: APP_SHA,
    artifact_admission_sha256: shaFile(path.join(root, 'resume-artifact-admission.json')),
    authority_reference: AUTHORITY,
    bootstrap_receipt_sha256: BOOTSTRAP_SHA,
    capability_intent_id: INTENT,
    completed_at: null,
    compensation_effect_identity_sha256: effectIdentity,
    created_at: '2026-08-22T00:00:03.000Z',
    delete_request_id_sha256: null,
    delete_response_sha256: null,
    effect_generation: 1,
    effect_identity_receipt_sha256: stableCurrentIdentitySha,
    idempotency_key_sha256: currentRequest.idempotency_key_sha256,
    previous_phase_receipt_sha256: ZERO,
    prior_effect_lineage_sha256: lineageSha,
    prior_effect_receipt_sha256: priorEffectSha,
    provider_plan_receipt_sha256: planSha,
    readback_request_id_hashes_sha256: null,
    readback_sha256: null,
    request_sha256: currentRequest.request_sha256,
    started_effect_receipt_sha256: startedSha,
    target_effect_generation: 0,
    target_effect_identity_receipt_sha256: stablePriorIdentitySha,
    target_endpoint_id: target.id,
    target_endpoint_id_sha256: sha(target.id),
    target_metadata: priorRequest.metadata,
    target_request_sha256: priorRequest.request_sha256,
  };
  writeJson(root, 'stripe-webhook-compensation-phase-000.json', phase0);
  writeChecksums(root);
  return { root, phase0, target };
}

function appendReadback(root, previous, revision, applied, { withDelete = false } = {}) {
  const suffix = String(revision).padStart(3, '0');
  const readback = {
    has_more: false,
    exact_url_count: applied ? 1 : 0,
    physio_metadata_bound_count: applied ? 1 : 0,
    exact_endpoint: applied ? endpoint(previous.target_metadata, previous.target_endpoint_id) : null,
  };
  writeJson(root, `stripe-webhook-compensation-readback-${suffix}.json`, readback);
  writeJson(root, `stripe-webhook-compensation-request-id-hashes-${suffix}.json`, {
    contract_version: 'assesssuite-provider-request-id-hash/2.0.0',
    provider: 'stripe',
    operation: 'LIST',
    request_id_sha256: sha(`req-list-${revision}`),
  });
  let deleteResponseSha = null;
  let deleteRequestIdSha = null;
  if (withDelete) {
    writeJson(root, `stripe-webhook-compensation-delete-response-${suffix}.json`, {
      id: previous.target_endpoint_id,
      deleted: true,
    });
    deleteResponseSha = shaFile(path.join(root,
      `stripe-webhook-compensation-delete-response-${suffix}.json`));
    deleteRequestIdSha = sha(`req-delete-${revision}`);
  }
  const phase = {
    ...previous,
    result: applied ? 'STARTED' : 'PASS',
    phase: applied ? 'RECONCILED_STILL_APPLIED' : 'COMPENSATION_COMPLETED',
    revision,
    previous_phase_receipt_sha256: shaFile(path.join(root,
      `stripe-webhook-compensation-phase-${String(revision - 1).padStart(3, '0')}.json`)),
    readback_sha256: shaFile(path.join(root, `stripe-webhook-compensation-readback-${suffix}.json`)),
    readback_request_id_hashes_sha256: shaFile(path.join(root,
      `stripe-webhook-compensation-request-id-hashes-${suffix}.json`)),
    delete_response_sha256: deleteResponseSha,
    delete_request_id_sha256: deleteRequestIdSha,
    created_at: `2026-08-22T00:00:0${3 + revision}.000Z`,
    completed_at: applied ? null : `2026-08-22T00:00:0${3 + revision}.500Z`,
  };
  writeJson(root, `stripe-webhook-compensation-phase-${suffix}.json`, phase);
  writeChecksums(root);
  return phase;
}

function validate(root, requireCompleted) {
  const phases = fs.readdirSync(root)
    .filter((name) => /^stripe-webhook-compensation-phase-[0-9]{3}\.json$/.test(name)).sort();
  return validateStripeWebhookCompensationPacket(root, {
    applicationSha: APP_SHA,
    authorityReference: AUTHORITY,
    bootstrapReceiptSha256: BOOTSTRAP_SHA,
    capabilityIntentId: INTENT,
    controlReceiptSha256: shaFile(path.join(root, phases.at(-1))),
    requireCompleted,
  });
}

test('loss before DELETE preserves one immutable DELETE_INTENT generation', () => {
  const value = fixture();
  try {
    const proof = validate(value.root, false);
    assert.equal(proof.effect_generation, 1);
    assert.equal(proof.latest_phase, 'DELETE_INTENT');
    assert.equal(proof.compensation_completed, false);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('DELETE response lost and not applied remains a same-target retry-start phase', () => {
  const value = fixture();
  try {
    appendReadback(value.root, value.phase0, 1, true);
    const proof = validate(value.root, false);
    assert.equal(proof.latest_phase, 'RECONCILED_STILL_APPLIED');
    assert.equal(proof.target_endpoint_id, value.target.id);
    assert.equal(proof.effect_generation, 1);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('DELETE applied with response lost is recovered by authoritative absence before CREATE', () => {
  const value = fixture();
  try {
    const retry = appendReadback(value.root, value.phase0, 1, true);
    appendReadback(value.root, retry, 2, false);
    const proof = validate(value.root, true);
    assert.equal(proof.latest_phase, 'COMPENSATION_COMPLETED');
    assert.equal(proof.compensation_delete_request_id_sha256, null);
    assert.equal(proof.orphan_endpoint_compensated, true);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('acknowledged DELETE is joined to terminal exhaustive absence evidence', () => {
  const value = fixture();
  try {
    const retry = appendReadback(value.root, value.phase0, 1, true);
    appendReadback(value.root, retry, 2, false, { withDelete: true });
    const proof = validate(value.root, true);
    assert.match(proof.compensation_delete_request_id_sha256, /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('duplicate, drifted, newer, and paginated provider readbacks are denied', () => {
  const value = fixture();
  try {
    const expected = {
      capabilityIntentId: INTENT,
      endpointUrl: ENDPOINT_URL,
      targetEndpointId: value.target.id,
      targetMetadata: value.phase0.target_metadata,
    };
    assert.throws(() => classifyStripeWebhookCompensationProviderList({
      has_more: false,
      data: [value.target, { ...value.target, id: 'we_duplicate456' }],
    }, expected), /duplicates/);
    assert.throws(() => classifyStripeWebhookCompensationProviderList({
      has_more: false,
      data: [{ ...value.target, metadata: { ...value.target.metadata, requestSha256: '9'.repeat(64) } }],
    }, expected), /metadata identity differs/);
    assert.throws(() => classifyStripeWebhookCompensationProviderList({
      has_more: false,
      data: [{ ...value.target, metadata: { ...value.target.metadata, effectGeneration: '2' } }],
    }, expected), /metadata identity differs/);
    assert.throws(() => classifyStripeWebhookCompensationProviderList({
      has_more: true,
      data: [],
    }, expected), /paginated/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('tampered compensation phase chain fails after checksums are honestly recomputed', () => {
  const value = fixture();
  try {
    const retry = appendReadback(value.root, value.phase0, 1, true);
    appendReadback(value.root, retry, 2, false);
    const phase = JSON.parse(fs.readFileSync(path.join(value.root,
      'stripe-webhook-compensation-phase-002.json'), 'utf8'));
    phase.previous_phase_receipt_sha256 = '7'.repeat(64);
    writeJson(value.root, 'stripe-webhook-compensation-phase-002.json', phase);
    writeChecksums(value.root);
    assert.throws(() => validate(value.root, true), /immutable intent or lineage differs/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('benign-looking extras cannot bypass exact compensation artifact schemas', () => {
  const value = fixture();
  try {
    const planPath = path.join(value.root, 'stripe-provider-plan.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    plan.audit_note = 'looks harmless';
    writeJson(value.root, 'stripe-provider-plan.json', plan);
    writeChecksums(value.root);
    assert.throws(() => validate(value.root, false), /exact key allowlist differs/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('a selected STARTED artifact is denied when a later sibling plan exists in the same run', () => {
  const value = fixture();
  try {
    const inventoryPath = path.join(value.root, 'resume-sibling-inventory.json');
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    inventory.eligible_artifacts.push({
      id: 124,
      name: `physio-stripe-webhook-plan-${APP_SHA}`,
      digest: `sha256:${'2'.repeat(64)}`,
      expired: false,
      size_in_bytes: 2345,
      lifecycle_kind: 'PROVIDER_PLAN',
      generation: null,
      revision: null,
    });
    writeJson(value.root, 'resume-sibling-inventory.json', inventory);
    writeChecksums(value.root);
    assert.throws(() => validate(value.root, false),
      /selected resume artifact is not the exact latest lifecycle control/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('same-run compensation controls cannot be reclassified across effect generations', () => {
  const value = fixture();
  try {
    const inventoryPath = path.join(value.root, 'resume-sibling-inventory.json');
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const first = {
      id: 124,
      name: `physio-stripe-webhook-compensation-phase-${APP_SHA}-1-0`,
      digest: `sha256:${'2'.repeat(64)}`,
      expired: false,
      size_in_bytes: 2345,
      lifecycle_kind: 'COMPENSATION_PHASE',
      generation: 1,
      revision: 0,
    };
    const selected = {
      id: 125,
      name: `physio-stripe-webhook-compensation-phase-${APP_SHA}-2-1`,
      digest: `sha256:${'3'.repeat(64)}`,
      expired: false,
      size_in_bytes: 3456,
      lifecycle_kind: 'COMPENSATION_PHASE',
      generation: 2,
      revision: 1,
    };
    inventory.eligible_artifacts.push(first, selected);
    inventory.selected_artifact_id = selected.id;
    inventory.selected_artifact_name = selected.name;
    inventory.selected_lifecycle_kind = selected.lifecycle_kind;
    writeJson(value.root, 'resume-sibling-inventory.json', inventory);
    const admissionPath = path.join(value.root, 'resume-artifact-admission.json');
    const admission = JSON.parse(fs.readFileSync(admissionPath, 'utf8'));
    admission.artifacts.resume_started_effect = {
      id: selected.id,
      name: selected.name,
      digest: selected.digest,
      size_in_bytes: selected.size_in_bytes,
      workflow_run_id: inventory.source_run_id,
    };
    writeJson(value.root, 'resume-artifact-admission.json', admission);
    writeChecksums(value.root);
    assert.throws(() => validate(value.root, false),
      /compensation artifacts span multiple effect generations/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('numbered compensation resume admission requires an exact sibling-inventory pair', () => {
  const value = fixture();
  try {
    fs.copyFileSync(path.join(value.root, 'resume-artifact-admission.json'),
      path.join(value.root, 'compensation-resume-artifact-admission-001.json'));
    writeChecksums(value.root);
    assert.throws(() => validate(value.root, false),
      /compensation resume admission and sibling-inventory pairs differ/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('a resumed generation cannot erase its sibling lineage as NOT_APPLICABLE', () => {
  const value = fixture();
  try {
    writeJson(value.root, 'resume-sibling-inventory.json', {
      contract_version: 'assesssuite-webhook-resume-sibling-inventory/1.0.0',
      result: 'NOT_APPLICABLE',
      application_sha: APP_SHA,
      source_run_id: null,
      selected_artifact_id: null,
      selected_artifact_name: null,
      selected_lifecycle_kind: null,
      selected_is_latest: true,
      eligible_artifacts: [],
      inventoried_at: null,
    });
    writeChecksums(value.root);
    assert.throws(() => validate(value.root, false), /resume sibling applicability/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});
