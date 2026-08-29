import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateCompletedStripeWebhookPacket } from '../../scripts/physio-stripe-webhook-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowPath = path.join(
  root,
  '.github',
  'workflows',
  'physio-production-stripe-webhook.yml',
);

function ordered(source, markers, label) {
  let cursor = -1;
  for (const marker of markers) {
    const next = typeof marker === 'string'
      ? source.indexOf(marker, cursor + 1)
      : source.slice(cursor + 1).search(marker) + cursor + 1;
    assert.ok(next > cursor, `${label}: missing or out-of-order marker ${String(marker)}`);
    cursor = next;
  }
}

test('post-bootstrap Stripe webhook lane creates one exact endpoint and stages only its signing secret', () => {
  assert.ok(fs.existsSync(workflowPath), 'the exact post-bootstrap Stripe webhook workflow is required');
  const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
  const endpoint = 'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook';

  for (const marker of [
    'bootstrap_artifact_id:',
    'bootstrap_artifact_digest:',
    'bootstrap_receipt_sha256:',
    'exact_image_canary_receipt_sha256:',
    'resume_started_effect_receipt_sha256:',
    'started_effect_receipt_sha256:',
    'assesssuite-physio-stripe-webhook-bootstrap/1.0.0',
    endpoint,
    '2026-07-29.dahlia',
    'checkout.session.completed',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'invoice.payment_failed',
    'STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}',
    'FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}',
    "'Idempotency-Key'",
    'webhook_endpoint_create_response_unknown',
    'STRIPE_WEBHOOK_SECRET',
    'fly secrets import --app "$app" --stage --dns-checks=false',
    'stripe_webhook_secret_staged: true',
    'stripe_signing_secret_sha256:',
    'fly_webhook_secret_digest:',
    'provider_request_id_hashes_sha256:',
    'provider_endpoint_count: 1',
    'physio-production-stripe-webhook.json',
  ]) assert.ok(source.includes(marker), `Stripe webhook bootstrap is missing ${marker}`);

  ordered(source, [
    'actions/download-artifact@',
    'physio-production-bootstrap.json',
    /\/v1\/webhook_endpoints\?limit=/,
    /POST[\s\S]{0,240}\/v1\/webhook_endpoints/,
    /\/v1\/webhook_endpoints\//,
    'STRIPE_WEBHOOK_SECRET',
    'fly secrets import --app "$app" --stage --dns-checks=false',
    'fly secrets list',
    'physio-production-stripe-webhook.json',
    'actions/upload-artifact@',
  ], 'post-bootstrap webhook creation and staging');

  assert.match(source, /metadata\[appId\][\s\S]{0,160}local-assesssuite-physio/);
  assert.match(source, /metadata\[professionId\][\s\S]{0,120}physio/);
  assert.match(source, /metadata\[bootstrapReceiptSha256\]/);
  assert.match(source, /metadata\[applicationSha\]/);
  assert.match(source, /metadata\[capabilityIntentId\]/);
  assert.match(source, /value\?\.has_more !== false/,
    'the pre-effect endpoint inventory must reject an incomplete Stripe page');
  assert.match(source, /list\?\.has_more !== false/,
    'the authoritative post-effect inventory must reject an incomplete Stripe page');
  assert.match(source, /\[\[ "\$STRIPE_SECRET_KEY" == rk_live_\* \|\| "\$STRIPE_SECRET_KEY" == sk_live_\* \]\]/,
    'the effect must prefer an authorised restricted live key while retaining deliberate live secret-key fallback');
  assert.match(source, /status !== 'Staged'/);
  assert.match(source, /\^\[0-9a-f\]\{16,64\}\$/,
    'Fly signing-secret admission needs a bounded exact digest readback');
  const rawReadbackWrite = source.indexOf('>"$work/stripe-endpoint-readback.raw.json"');
  const sanitizedReadbackBinding = source.indexOf('READBACK="$work/stripe-endpoint-readback.raw.json"', rawReadbackWrite);
  assert.ok(rawReadbackWrite >= 0 && sanitizedReadbackBinding > rawReadbackWrite,
    'raw Stripe endpoint retrieval must remain in work storage and feed the bounded sanitizer');
  assert.match(source, /READBACK_SANITIZED="\$packet\/stripe-endpoint-readback\.json"/,
    'the packet may contain only the exact allowlisted endpoint readback');
  const leakGuard = source.slice(source.indexOf('const allowedSecretKeys'), source.indexOf('(cd "$packet"', source.indexOf('const allowedSecretKeys')));
  for (const safeMetadataKey of [
    'stripe_webhook_secret_staged',
    'stripe_signing_secret_sha256',
    'fly_secret_names_readback_sha256',
    'fly_webhook_secret_digest',
    'fly_secret_prestate',
    'fly_secret_import_exit_code',
    'fly_secret_readback_sha256',
  ]) assert.ok(leakGuard.includes(`'${safeMetadataKey}'`),
    `the leak scanner would reject safe bounded metadata ${safeMetadataKey}`);
  assert.match(leakGuard, /whsec_\[A-Za-z0-9\]\+/,
    'the final packet must reject a raw Stripe signing secret');
  assert.match(leakGuard, /secretValues\.some/,
    'the final packet must reject either raw provider credential value');
  assert.match(source, /if: \$\{\{ always\(\) \}\}[\s\S]*actions\/upload-artifact@/,
    'failed or uncertain endpoint effects must leave a bounded replay record');
  assert.doesNotMatch(source, /(?:echo|printf|tee)[^\n]*(?:\$STRIPE_WEBHOOK_SECRET|\$signing_secret)/,
    'the signing secret may be piped only into staged Fly secrets, never workflow logs');
  assert.doesNotMatch(source, /\bfly (?:deploy|machine (?:run|update|restart)|certs|dns)\b/,
    'the webhook lane may not create a service, deploy, attach DNS or mutate certificates');
  assert.doesNotMatch(source, /\bdocker (?:build|save|load|tag|push|run|create)\b/);

  const providerEffectStep = source.slice(
    source.indexOf('- name: Create exact Stripe endpoint and stage its signing secret'),
    source.indexOf('- name: Scan bounded webhook provider effect evidence'),
  );
  const providerEffectRun = providerEffectStep.slice(providerEffectStep.indexOf('        run: |'));
  assert.doesNotMatch(
    providerEffectRun,
    /\$\{\{/,
    'the large provider-effect script must consume step outputs through env so GitHub does not exceed its expression limit',
  );
});

test('provider mutation is bound to one durable STARTED packet and leaves a resumable uncertain state', () => {
  const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
  const startIndex = source.indexOf('Persist exact webhook STARTED effect before provider mutation');
  const effectIndex = source.indexOf('Create exact Stripe endpoint and stage its signing secret');
  const firstProviderPost = source.indexOf('-X POST "$stripe_api/v1/webhook_endpoints"');
  assert.ok(startIndex >= 0 && effectIndex > startIndex && firstProviderPost > effectIndex,
    'the durable STARTED job must precede the credentialed provider effect');

  for (const marker of [
    'started_receipt_sha256: ${{ steps.start.outputs.started_receipt_sha256 }}',
    'artifact-ids: ${{ needs.start.outputs.started_artifact_id }}',
    "${{ needs.start.outputs.started_receipt_sha256 }}",
    "${{ needs.start.outputs.request_sha256 }}",
    "expected=$'SHA256SUMS\\noutstanding-effect-inventory.json\\nresume-artifact-admission.json\\nresume-sibling-inventory.json\\nstripe-webhook-effect-identity.json\\nstripe-webhook-effect-reconciliation.json\\nstripe-webhook-request-manifest.json'",
    '(cd "$started" && sha256sum --check --strict SHA256SUMS)',
    'row.started_effect_receipt_sha256 = process.env.STARTED_RECEIPT_SHA',
    "? 'STARTED_UNRESOLVED' : 'FAILED'",
    "['STARTED','STARTED_UNRESOLVED'].includes(row.result)",
    'provider-mutation-started',
    'assesssuite-physio-stripe-webhook-effect-plan/1.0.0',
    'provider_plan_receipt_sha256:',
    'provider_plan_artifact_id:',
    'provider_mutation_absent: true',
    'webhook has historical STARTED, provider-plan, compensation-phase, effect, or completed evidence; explicit exact resume is required',
    "typeof row?.expired !== 'boolean'",
    'expired_metadata_included: true',
    '`^physio-stripe-webhook-plan-${sha}(?:-[1-9][0-9]*)?$`',
    'assesssuite-outstanding-effect-inventory/2.0.0',
    'NOT_APPLIED_BY_AUTHORITATIVE_ABSENCE',
    'COMMIT_PRESENT_REQUIRES_COMPENSATION',
    'effect_generation=$((prior_generation + 1))',
    'prior_effect_receipt_sha256: process.env.PRIOR_EFFECT_SHA',
    'prior_request_sha256: process.env.PRIOR_REQUEST_SHA',
  ]) assert.ok(source.includes(marker), `durable webhook effect is missing ${marker}`);

  const resumeSpec = source.slice(
    source.indexOf('const sha = process.env.APPLICATION_SHA;'),
    source.indexOf('fs.writeFileSync(process.env.SPEC',
      source.indexOf('const sha = process.env.APPLICATION_SHA;')),
  );
  const resumeNamePatterns = resumeSpec.match(/`\^physio-[^`]+`/g) || [];
  assert.equal(resumeNamePatterns.length, 4,
    'resume admission must remain within the shared four-pattern maximum');
  assert.doesNotMatch(resumeSpec,
    /`\^physio-stripe-webhook-plan-\$\{sha\}\$`[\s\S]*`\^physio-stripe-webhook-plan-\$\{sha\}-/,
    'exact and revisioned provider plans must share one anchored admission pattern');
  assert.doesNotMatch(source.slice(
    source.indexOf('const historical = rows.filter'),
    source.indexOf("throw new Error('webhook has historical", source.indexOf('const historical = rows.filter')),
  ), /expired\s*===\s*false|!row\.expired/,
  'fresh resume=0 denial must include expired historical webhook artifacts');

  const startedManifest = source.slice(
    source.indexOf('REQUEST="$packet/stripe-webhook-request-manifest.json"'),
    source.indexOf('request.request_sha256', source.indexOf('REQUEST="$packet/stripe-webhook-request-manifest.json"')),
  );
  assert.match(startedManifest, /capabilityIntentId: process\.env\.INTENT/,
    'the exact capability intent must be inside the durable provider request manifest');

  ordered(source, [
    'Persist exact webhook STARTED effect before provider mutation',
    'Upload durable webhook STARTED effect',
    'Freeze exact Stripe endpoint prestate before any mutation',
    'Upload durable exact provider plan',
    'Download durable webhook STARTED effect',
    'Download durable exact provider plan',
    '(cd "$started" && sha256sum --check --strict SHA256SUMS)',
    '== "$STARTED_RECEIPT_SHA256"',
    'row.started_effect_receipt_sha256 = process.env.STARTED_RECEIPT_SHA',
    'GET /v1/webhook_endpoints?limit=100',
    'provider-mutation-started',
    '-X POST "$stripe_api/v1/webhook_endpoints"',
  ], 'durable webhook STARTED binding');

  const startGeneration = source.slice(
    source.indexOf('Seal content-free STARTED effect packet'),
    source.indexOf('Upload durable webhook STARTED effect'),
  );
  for (const marker of [
    "!['STARTED','STARTED_UNRESOLVED'].includes(row.result)",
    'calculatedRequestSha !== storedRequestSha',
    'request.effect_generation !== row.effect_generation',
    'effect_generation=$((prior_generation + 1))',
    '$CAPABILITY_INTENT_ID|$effect_generation|$prior_effect_receipt_sha',
  ]) assert.ok(startGeneration.includes(marker), `webhook generation binding is missing ${marker}`);

  const providerPlan = source.slice(
    source.indexOf('Freeze exact Stripe endpoint prestate before any mutation'),
    source.indexOf('Resolve durable Stripe webhook compensation before CREATE'),
  );
  for (const marker of [
    'stripe-provider-plan.json',
    'exact_endpoint_id_sha256:',
    "planned_action: exact ? 'RECONCILE_OR_COMPENSATE_EXACT' : 'CREATE_FROM_PROVEN_ABSENCE'",
    'provider_probe_readback_sha256:',
    'provider_probe_request_id_hashes_sha256:',
    'provider_mutation_absent: true',
  ]) assert.ok(providerPlan.includes(marker), `durable provider plan is missing ${marker}`);
  assert.doesNotMatch(providerPlan, /-X (?:POST|DELETE)|fly secrets import/,
    'the durable provider plan job must remain read-only');

  const compensationStart = source.indexOf('Resolve durable Stripe webhook compensation before CREATE');
  const retryBarrier = source.indexOf('Upload durable RECONCILED_STILL_APPLIED and DELETE_RETRY_STARTED barrier');
  const deleteStart = source.indexOf('Bounded same-ID DELETE retry and authoritative absence proof');
  const createStart = source.indexOf('if [[ "$reconciled_existing" == \'false\' ]]; then', deleteStart);
  const endpointReadback = source.indexOf('stripe-endpoint-readback.headers', createStart);
  assert.ok(compensationStart >= 0 && retryBarrier > compensationStart && deleteStart > retryBarrier &&
    createStart > deleteStart && endpointReadback > createStart,
  'revisioned durable compensation and its upload barrier must precede DELETE and CREATE');
  const compensation = source.slice(compensationStart, createStart);
  for (const marker of [
    'assesssuite-physio-stripe-webhook-compensation-phase/2.0.0',
    "phase: plan.provider_state === 'ABSENT' ? 'NOT_APPLICABLE' : 'DELETE_INTENT'",
    "phase: endpoint ? 'RECONCILED_STILL_APPLIED' : 'COMPENSATION_COMPLETED'",
    "phase: 'COMPENSATION_COMPLETED'",
    'compensation_effect_identity_sha256',
    'previous_phase_receipt_sha256',
    'artifact_admission_sha256',
    'RETRY_BARRIER_ARTIFACT_ID',
    '-X DELETE',
    'exact_endpoint: null',
  ]) assert.ok(compensation.includes(marker), `exact webhook compensation is missing ${marker}`);
  ordered(compensation, [
    'Fresh exhaustive compensation provider readback',
    'Upload durable RECONCILED_STILL_APPLIED and DELETE_RETRY_STARTED barrier',
    'Bounded same-ID DELETE retry and authoritative absence proof',
    'Validate terminal compensation chain',
    'Upload durable COMPENSATION_COMPLETED PASS',
  ], 'durable compensation phase order');
  assert.doesNotMatch(source.slice(createStart), /-X DELETE/,
    'the CREATE/effect job must not contain a second inline compensation DELETE');
  assert.match(source.slice(createStart, endpointReadback), /-X POST "\$stripe_api\/v1\/webhook_endpoints"/,
    'current-generation CREATE must remain after terminal compensation');
  assert.match(source.slice(createStart, endpointReadback),
    /metadata\[effectGeneration\][\s\S]*metadata\[requestSha256\][\s\S]*metadata\[startedEffectReceiptSha256\]/,
    'current-generation create or replay must carry all exact durable lineage metadata');
});

test('latest lifecycle control preserves incomplete compensation and advances terminal compensation once', () => {
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  const applicationSha = 'a'.repeat(40);
  const bootstrapSha = 'b'.repeat(64);
  const intent = 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:stripe-webhook';
  const zero = '0'.repeat(64);
  const request = (generation, priorEffect, priorRequest, priorIdempotency, effectIdentity) => {
    const idempotencyKey = `physio-webhook-${sha(`${applicationSha}|${bootstrapSha}|${intent}|${generation}|${priorEffect}`).slice(0, 40)}`;
    const row = {
      endpoint: 'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook',
      api_version: '2026-07-29.dahlia',
      enabled_events: ['checkout.session.completed', 'customer.subscription.deleted',
        'customer.subscription.paused', 'invoice.payment_failed'],
      metadata: { appId: 'local-assesssuite-physio', applicationSha,
        bootstrapReceiptSha256: bootstrapSha, capabilityIntentId: intent,
        effectGeneration: String(generation), professionId: 'physio',
        startedEffectReceiptSha256: effectIdentity },
      capability_intent_id: intent,
      effect_generation: generation,
      prior_effect_receipt_sha256: priorEffect,
      predecessor_control_receipt_sha256: generation === 0 ? zero : priorEffect,
      predecessor_control_kind: generation === 0 ? 'NOT_APPLICABLE' : 'EFFECT_RECONCILIATION',
      prior_request_sha256: priorRequest,
      prior_artifact_admission_sha256: 'c'.repeat(64),
      idempotency_key_sha256: sha(idempotencyKey),
      prior_idempotency_key_sha256: priorIdempotency,
    };
    const requestSha = sha(JSON.stringify(row));
    return { row: { ...row, metadata: { ...row.metadata, requestSha256: requestSha },
      request_sha256: requestSha }, idempotencyKey };
  };
  const fresh = request(0, zero, zero, zero, 'd'.repeat(64));
  const unresolvedReceiptSha = sha(JSON.stringify({ result: 'STARTED_UNRESOLVED',
    effect_generation: 0, request_sha256: fresh.row.request_sha256 }));
  const resumed = request(1, unresolvedReceiptSha, fresh.row.request_sha256,
    fresh.row.idempotency_key_sha256, 'e'.repeat(64));
  assert.equal(resumed.row.effect_generation, fresh.row.effect_generation + 1);
  assert.equal(resumed.row.prior_request_sha256, fresh.row.request_sha256);
  assert.equal(resumed.row.prior_effect_receipt_sha256, unresolvedReceiptSha);
  assert.notEqual(resumed.row.request_sha256, fresh.row.request_sha256);
  assert.notEqual(resumed.idempotencyKey, fresh.idempotencyKey);
  assert.notEqual(resumed.row.idempotency_key_sha256, resumed.row.prior_idempotency_key_sha256);
  assert.equal(resumed.row.metadata.effectGeneration, '1');
  assert.equal(resumed.row.metadata.requestSha256, resumed.row.request_sha256);

  const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
  const compensationResume = source.slice(
    source.indexOf('if [[ -n "$latest_compensation_phase" ]]'),
    source.indexOf('if [[ "$terminal_compensation_boundary" != \'true\' && -f',
      source.indexOf('if [[ -n "$latest_compensation_phase" ]]')),
  );
  for (const marker of [
    'validateStripeWebhookCompensationPacket',
    'proof.effect_generation',
    'proof.request_sha256',
    'proof.started_effect_receipt_sha256',
    'proof.effect_identity_receipt_sha256',
    'proof.latest_phase_receipt_sha256',
    'proof.compensation_completed',
    'terminal_compensation_boundary=true',
    "predecessor_control_kind='TERMINAL_COMPENSATION'",
    'predecessor_control_receipt_sha="$compensation_control_sha"',
  ]) assert.ok(compensationResume.includes(marker),
    `compensation recovery is missing ${marker}`);
  const incompleteBranch = compensationResume.slice(
    compensationResume.indexOf("else\n                install -m 0600"),
    compensationResume.indexOf('fi\n            fi'),
  );
  for (const marker of [
    'compensation-resume-artifact-admission.json',
    'compensation-resume-sibling-inventory.json',
    "echo 'compensation_resume=true'",
    'exit 0',
  ]) assert.ok(incompleteBranch.includes(marker),
    `same-generation incomplete compensation recovery is missing ${marker}`);
  assert.doesNotMatch(incompleteBranch, /effect_generation=\$\(\(prior_generation \+ 1\)\)/,
    'incomplete compensation must remain in the same generation');
  const postControl = source.slice(
    source.indexOf('if [[ "$terminal_compensation_boundary" != \'true\' ]]; then'),
    source.indexOf('IDENTITY="$packet/stripe-webhook-effect-identity.json"'),
  );
  ordered(postControl, [
    'prior_effect_receipt_sha="$RESUME_RECEIPT_SHA256"',
    '[[ "$(sha256sum "$prior"',
    'effect_generation=$((prior_generation + 1))',
    'idempotency_key="physio-webhook-',
  ], 'terminal compensation generation advance');
  assert.match(source, /id: probe\n\s+if: \$\{\{ needs\.start\.outputs\.compensation_resume != 'true' \}\}/,
    'terminal compensation must force a fresh provider probe while incomplete compensation skips it');
  assert.match(source,
    /idempotency_key="physio-webhook-\$\(printf '%s' "\$APPLICATION_SHA\|\$BOOTSTRAP_RECEIPT_SHA256\|\$CAPABILITY_INTENT_ID\|\$effect_generation\|\$prior_effect_receipt_sha256"/,
    'effect replay must reconstruct the unchanged idempotency identity from the immutable request lineage');
});

test('resume admission is bound to the exact latest sibling artifact and rejects ambiguity', () => {
  const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
  const sibling = source.slice(
    source.indexOf('sibling_pages="$RUNNER_TEMP/webhook-resume-sibling-pages"'),
    source.indexOf('prior="$RUNNER_TEMP/resume/stripe-webhook-effect-reconciliation.json"'),
  );
  for (const marker of [
    '/actions/runs/$RESUME_RUN_ID/artifacts?per_page=100&page=$page',
    'resume-sibling-inventory.json',
    'selected_is_latest: true',
    'selected webhook resume artifact is not the exact latest source-run lifecycle control',
    "['STARTED','PROVIDER_PLAN','EFFECT_OR_COMPLETED']",
    'COMPENSATION_PHASE',
  ]) assert.ok(sibling.includes(marker), `latest sibling admission is missing ${marker}`);
  assert.match(sibling, /admitted\?\.workflow_run_id !== Number\(process\.env\.SOURCE_RUN_ID\)/,
    'selected admission must be joined to the exact source run');
  assert.match(sibling, /new Set\(ids\)\.size !== ids\.length/,
    'duplicate artifact identities must be denied');
  assert.doesNotMatch(sibling, /metadata:\s*(?:row|value|endpoint)\.metadata|\.\.\.(?:row|value|endpoint)/,
    'provider and artifact metadata must be rebuilt through explicit allowlists');
});

test('latest authoritative ABSENT plan is accepted without inventing prior endpoint lineage', () => {
  const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
  const planResume = source.slice(
    source.indexOf('if [[ "$terminal_compensation_boundary" != \'true\' && -f "$RUNNER_TEMP/resume/stripe-provider-plan.json" ]]'),
    source.indexOf('if [[ -f "$RUNNER_TEMP/resume/physio-production-stripe-webhook.json" ]]'),
  );
  for (const marker of [
    "plan.provider_state === 'ABSENT'",
    "plan.endpoint_lineage !== 'NONE'",
    "plan.observed_endpoint_lineage !== 'NONE'",
    'probe.exact_url_count !== 0',
    'probe.physio_metadata_bound_count !== 0',
    'probe.exact_endpoint !== null',
    "echo 'compensation_resume=true'",
  ]) assert.ok(planResume.includes(marker), `ABSENT plan recovery is missing ${marker}`);
  assert.match(planResume, /provider_state === 'EXACT'[\s\S]*provider_state === 'ABSENT'/,
    'EXACT and ABSENT provider plans must be deliberate disjoint branches');
});

test('a completed webhook packet is validated and republished without a new provider effect', () => {
  const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
  const start = source.slice(
    source.indexOf('Persist exact webhook STARTED effect before provider mutation'),
    source.indexOf('Freeze exact Stripe endpoint prestate before any mutation'),
  );
  for (const marker of [
    'validateCompletedStripeWebhookPacket',
    "echo 'resume_completed=true'",
    'webhook-completed-reuse',
    'Scan exact completed webhook packet for read-only reuse',
    'Upload exact read-only reused webhook completion',
    "steps.start.outputs.resume_completed != 'true'",
    "steps.start.outputs.resume_completed == 'true'",
  ]) assert.ok(start.includes(marker), `completed webhook reuse is missing ${marker}`);
  assert.match(source, /probe:[\s\S]{0,220}if: \$\{\{ needs\.start\.outputs\.resume_completed != 'true' \}\}/,
    'Stripe/Fly provider probing must be skipped after exact completed-packet reuse');
  assert.match(source, /effect:[\s\S]{0,240}if: \$\{\{ needs\.start\.outputs\.resume_completed != 'true' \}\}/,
    'Stripe/Fly mutation must be skipped after exact completed-packet reuse');
  const completedBranch = start.slice(
    start.indexOf('if [[ -f "$RUNNER_TEMP/resume/physio-production-stripe-webhook.json" ]]'),
    start.indexOf("IFS=$'\\t' read -r prior_generation prior_request_sha"),
  );
  assert.doesNotMatch(completedBranch, /\/v1\/webhook_endpoints|fly secrets import|-X (?:POST|DELETE)/,
    'completed reuse must remain a credential-free, read-only packet validation and repackaging path');
  const producerFinalization = source.slice(
    source.lastIndexOf('(cd "$packet"'),
    source.indexOf('Scan bounded webhook provider effect evidence'),
  );
  ordered(producerFinalization, [
    'sha256sum --check --strict SHA256SUMS',
    'validateCompletedStripeWebhookPacket',
    ': >"$work/finalization-complete"',
  ], 'completed webhook producer validation');
});

test('completed webhook packet validation rejects unchecksummed nested evidence', () => {
  const packet = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-webhook-nested-'));
  try {
    fs.mkdirSync(path.join(packet, 'nested'));
    fs.writeFileSync(path.join(packet, 'nested', 'omitted.json'), '{}\n');
    assert.throws(() => validateCompletedStripeWebhookPacket(packet, {
      applicationSha: 'a'.repeat(40),
      authorityReference: 'UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP',
      bootstrapReceiptSha256: 'b'.repeat(64),
      canaryReceiptSha256: 'c'.repeat(64),
      capabilityIntentId: 'physio-webhook-bootstrap',
      effectReceiptSha256: 'd'.repeat(64),
    }), /exact flat regular-file set/);
  } finally {
    fs.rmSync(packet, { recursive: true, force: true });
  }
});

test('runtime exposes the exact unauthenticated signed-Stripe handler selected by the provider lane', () => {
  const index = fs.readFileSync(path.join(root, 'server', 'functions', 'index.mjs'), 'utf8');
  const webhook = fs.readFileSync(path.join(root, 'server', 'functions', 'stripeWebhook.mjs'), 'utf8');
  assert.match(index, /stripeWebhook/);
  assert.match(index, /stripeWebhook is[\s\S]{0,120}tokenless/);
  assert.match(webhook, /stripe-signature/);
  assert.match(webhook, /STRIPE_WEBHOOK_SECRET/);
  assert.match(webhook, /verifyStripeSignature/);
});
