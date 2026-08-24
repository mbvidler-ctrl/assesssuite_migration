import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowPath = path.join(
  repoRoot,
  '.github',
  'workflows',
  'physio-production-exact-image-canary.yml',
);
const workflowSource = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');

function job(source, name) {
  const marker = `\n  ${name}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `workflow is missing the ${name} job`);
  const remainder = source.slice(start + marker.length);
  const next = remainder.search(/\n  [a-z][a-z0-9_-]*:\n/);
  return next === -1 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

function step(source, name) {
  const marker = `      - name: ${name}\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `workflow is missing the ${name} step`);
  const remainder = source.slice(start + marker.length);
  const next = remainder.indexOf('\n      - name: ');
  return next === -1 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

function ordered(source, markers, label) {
  let cursor = -1;
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor + 1);
    assert.ok(next > cursor, `${label} is missing or misorders ${marker}`);
    cursor = next;
  }
}

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function assertNoDuplicateJobKeys(source) {
  for (const name of ['admit', 'start', 'canary', 'reconcile', 'reuse']) {
    const keys = [...job(source, name).matchAll(/^    ([a-z][a-z0-9_-]*):/gm)]
      .map((match) => match[1]);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    assert.deepEqual(duplicates, [], `${name} contains duplicate YAML job keys`);
  }
}

function assertProviderSecretBoundary(source) {
  const admit = job(source, 'admit');
  const start = job(source, 'start');
  const canary = job(source, 'canary');
  const reconcile = job(source, 'reconcile');
  const reuse = job(source, 'reuse');
  const providerCredentialReference = '${{ secrets.OPENAI_API_KEY }}';

  assert.doesNotMatch(source.slice(0, source.indexOf('\njobs:\n')), /\$\{\{\s*secrets\./,
    'provider credentials may not be bound at workflow scope');
  assert.doesNotMatch(admit, /\$\{\{\s*secrets\.|\bALLOW_PAID_PROVIDER_PROBE\b|\bproduce-local\b/,
    'credential-free admission may not receive a provider secret or start a paid call');
  assert.doesNotMatch(start, /\$\{\{\s*secrets\.|\bALLOW_PAID_PROVIDER_PROBE\b|\bproduce-local\b/,
    'STARTED persistence may not receive a provider secret or start a paid call');
  assert.doesNotMatch(reconcile,
    /\$\{\{\s*secrets\.|\bOPENAI_API_KEY\b|\bALLOW_PAID_PROVIDER_PROBE\b|\bproduce-local\b/,
    'COMPLETED reconciliation must be a zero-provider-call evidence path');
  assert.doesNotMatch(reuse,
    /\$\{\{\s*secrets\.|\bOPENAI_API_KEY\b|\bALLOW_PAID_PROVIDER_PROBE\b|\bproduce-local\b/,
    'existing-success readback must be a zero-provider-call evidence path');
  assert.equal(occurrences(source, /\$\{\{\s*secrets\.OPENAI_API_KEY\s*\}\}/g), 1,
    'the paid provider credential must have one step-local binding');
  assert.match(canary, /^  canary:\n[\s\S]*?\n    needs: \[admit, start\]\n/m,
    'the paid canary must wait for both admission and durable STARTED persistence');
  assert.match(start, /if: \$\{\{ needs\.admit\.outputs\.admission_mode == 'fresh' \}\}/,
    'a completed-effect resume may not write another STARTED receipt');
  assert.match(canary, /if: \$\{\{ needs\.admit\.outputs\.admission_mode == 'fresh' \}\}/,
    'a completed-effect resume may not enter the paid canary job');
  assert.match(reconcile,
    /if: \$\{\{ needs\.admit\.outputs\.admission_mode == 'resume_completed' \}\}/,
    'only an admitted completed effect may enter zero-call reconciliation');
  assert.match(reuse,
    /if: \$\{\{ needs\.admit\.outputs\.admission_mode == 'resume_success' \}\}/,
    'only an exactly admitted existing success may enter zero-call readback');

  ordered(canary, [
    'Download durable provider-canary STARTED effect',
    'Verify durable provider-canary STARTED boundary',
    providerCredentialReference,
    'produce-local',
  ], 'provider-secret boundary');

  const providerStep = step(canary, 'Run exact local image provider canary');
  assert.match(providerStep, /env:\n\s+OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/,
    'the provider credential must be scoped only to the paid producer step');
  assert.match(providerStep, /set \+x/,
    'the provider producer must disable shell tracing before touching the credential');
}

function assertSameRunArtifactProvenance(source) {
  const start = job(source, 'start');
  const canary = job(source, 'canary');
  const admissionDownload = step(start, 'Download exact provider-canary admission');
  const startedDownload = step(canary, 'Download durable provider-canary STARTED effect');
  const writeStarted = step(start, 'Verify admission and write STARTED effect');
  const verifyStarted = step(canary, 'Verify durable provider-canary STARTED boundary');

  assert.match(admissionDownload,
    /artifact-ids: \$\{\{ needs\.admit\.outputs\.admission_artifact_id \}\}/);
  assert.match(admissionDownload, /repository: \$\{\{ github\.repository \}\}/);
  assert.match(admissionDownload, /run-id: \$\{\{ github\.run_id \}\}/,
    'the STARTED job must consume admission from this exact workflow run');
  assert.match(admissionDownload, /github-token: \$\{\{ github\.token \}\}/);

  assert.match(startedDownload,
    /artifact-ids: \$\{\{ needs\.start\.outputs\.started_artifact_id \}\}/);
  assert.match(startedDownload, /repository: \$\{\{ github\.repository \}\}/);
  assert.match(startedDownload, /run-id: \$\{\{ github\.run_id \}\}/,
    'the paid job must consume STARTED from this exact workflow run');
  assert.match(startedDownload, /github-token: \$\{\{ github\.token \}\}/);

  for (const [block, label] of [
    [writeStarted, 'admission-to-STARTED'],
    [verifyStarted, 'STARTED-to-provider'],
  ]) {
    assert.match(block, /sha256sum --check --strict SHA256SUMS/,
      `${label} must verify the sealed file manifest`);
    assert.match(block, /candidate-artifact-admission\.json/,
      `${label} must preserve the exact source-run admission`);
    assert.match(block, /provider-canary-admission\.json/,
      `${label} must preserve the exact canary admission`);
  }
  assert.match(writeStarted,
    /sha256sum "\$admission\/provider-canary-admission\.json"[\s\S]*== "\$ADMISSION_RECEIPT_SHA256"/,
    'STARTED persistence must bind the raw admission receipt hash');
  assert.match(verifyStarted,
    /sha256sum "\$started\/provider-canary-started-effect\.json"[\s\S]*== "\$STARTED_EFFECT_RECEIPT_SHA256"/,
    'the paid job must bind the raw STARTED receipt hash');
  assert.match(verifyStarted,
    /github_run_id: Number\(process\.env\.GITHUB_RUN_ID_VALUE\), github_run_attempt: 1/,
    'the STARTED receipt must identify this run and first attempt');

  for (const download of source.matchAll(
    /uses: actions\/download-artifact@[\s\S]*?(?=\n      - name: |\n  [a-z][a-z0-9_-]*:\n|$)/g,
  )) {
    assert.match(download[0], /artifact-ids:/,
      'release evidence downloads must use immutable artifact IDs, not names');
    assert.match(download[0], /repository: \$\{\{ github\.repository \}\}/);
    assert.match(download[0], /run-id:/,
      'every cross-job or cross-run artifact download needs an exact source run');
    assert.match(download[0], /github-token: \$\{\{ github\.token \}\}/);
    assert.match(download[0], /merge-multiple:\s*true/,
      'single-ID evidence downloads must extract into the exact declared path');
  }
}

function assertDeterministicEffectAndReplayRefusal(source) {
  const admit = job(source, 'admit');
  const stableStart = admit.indexOf('const stableEffect = {');
  const stableEnd = admit.indexOf('const effectIdentity = {');
  const identityStart = stableEnd;
  const identityEnd = admit.indexOf('const effectHex = sha(JSON.stringify(effectIdentity));');
  assert.ok(stableStart >= 0 && stableEnd > stableStart && identityEnd > identityStart,
    'admission must separate candidate evidence from one canonical effect identity');
  const stableEffect = admit.slice(stableStart, stableEnd);
  const effectIdentity = admit.slice(identityStart, identityEnd);

  for (const marker of [
    'application_sha: process.env.APPLICATION_SHA',
    'candidate_artifact_id: Number(process.env.CANDIDATE_ARTIFACT_ID)',
    'candidate_artifact_digest: process.env.CANDIDATE_ARTIFACT_DIGEST',
    'candidate_receipt_sha256: process.env.CANDIDATE_RECEIPT_SHA256',
    'candidate_archive_sha256: process.env.ARCHIVE_SHA256',
    'local_image_id: process.env.LOCAL_IMAGE_ID',
    'provider_task_set: process.env.PROVIDER_TASK_SET',
    'provider_call_maximum: 8',
    'maximum_cost_microusd: Number(process.env.MAXIMUM_COST_MICROUSD)',
    'capability_intent_id: process.env.CAPABILITY_INTENT_ID',
    'authority_reference: process.env.AUTHORITY_REFERENCE',
    'audio_fixture_sha256: PHYSIO_CANARY_AUDIO_SHA256',
    'document_fixture_sha256: documentFixtureSha256',
  ]) assert.ok(stableEffect.includes(marker), `stable provider-effect identity is missing ${marker}`);

  for (const marker of [
    "contract_version: 'assesssuite-physio-exact-image-canary-effect-identity/1.0.0'",
    'application: stableEffect.application',
    'application_sha: stableEffect.application_sha',
    'capability_intent_id: stableEffect.capability_intent_id',
    "provider_action: 'exact-eight-real-provider-canary'",
    'audio_fixture_sha256: stableEffect.audio_fixture_sha256',
    'document_fixture_sha256: stableEffect.document_fixture_sha256',
  ]) assert.ok(effectIdentity.includes(marker), `canonical provider-effect identity is missing ${marker}`);
  assert.doesNotMatch(effectIdentity,
    /github(?:_|\.)run|run_attempt|new Date|admitted_at|started_at|completed_at|candidate_artifact|archive_sha|local_image_id|maximum_cost|authority_reference/i,
    'run-local, packaging, budget, or prose data would make replay identity replaceable');
  assert.match(admit, /provider_effect_id: `sha256:\$\{effectHex\}`/);

  for (const name of [
    '`physio-exact-image-canary-started-${process.env.PROVIDER_EFFECT_HEX}`',
    '`physio-exact-image-canary-effect-${process.env.PROVIDER_EFFECT_HEX}`',
    '`physio-exact-image-canary-${process.env.APPLICATION_SHA}`',
  ]) assert.ok(admit.includes(name), `prior-effect search is missing ${name}`);
  assert.match(admit, /name=\$\{encodeURIComponent\(name\)\}/,
    'prior-effect artifact lookup must use the exact deterministic artifact name');
  assert.match(admit, /response\.status !== 200/,
    'replay admission must fail closed when prior-effect readback fails');
  assert.match(admit, /Buffer\.byteLength\(body\) > 1_048_576/,
    'prior-effect metadata must have a bounded response size');
  assert.doesNotMatch(admit, /filter\(\(row\) => row\?\.expired === false\)/,
    'fresh replay admission must not erase expired prior-effect evidence');
  assert.match(admit, /typeof row\?\.expired !== 'boolean'/,
    'prior-effect metadata must expose an explicit retention state');
  assert.match(admit,
    /prior_effect artifact is expired; replay and resume are forbidden pending durable reconciliation/,
    'expired prior effects must remain replay-blocking and fail explicit resume closed');
  assert.match(admit,
    /prior_effect exists; ambiguous STARTED_UNRESOLVED or completed replay forbidden/,
    'any STARTED, terminal effect, or completed canary must forbid fresh replay');

  for (const marker of [
    "resume_effect_artifact_id:",
    "resume_effect_artifact_digest:",
    "resume_success_artifact_id:",
    "resume_success_artifact_digest:",
    "if [[ \"$RESUME_EFFECT_ARTIFACT_ID\" == '0' ]]; then",
    "[[ \"$RESUME_EFFECT_ARTIFACT_DIGEST\" == '0' ]]",
    "effects[0]?.id !== Number(resumeId)",
    "effects[0]?.digest !== process.env.RESUME_EFFECT_ARTIFACT_DIGEST",
    "started.length !== 1 || effects.length !== 1",
    "admission_mode=resume_completed",
    "admission_mode=resume_success",
    "name_patterns: [`^physio-exact-image-canary-effect-${process.env.PROVIDER_EFFECT_HEX}$`]",
    "workflow_path: '.github/workflows/physio-production-exact-image-canary.yml'",
    "Validate exact COMPLETED effect for zero-call reconciliation",
    "effect.result !== 'COMPLETED'",
    "effect.provider_call_maximum !== 8",
    "effect.partial_provider_usage?.calls_succeeded !== 8",
    "effect.partial_provider_usage?.usage_complete !== true",
    "successes[0]?.id !== Number(process.env.RESUME_SUCCESS_ARTIFACT_ID)",
    "successes[0]?.digest !== process.env.RESUME_SUCCESS_ARTIFACT_DIGEST",
    "name_patterns: [`^physio-exact-image-canary-${process.env.APPLICATION_SHA}$`]",
  ]) assert.ok(source.includes(marker), `controlled completed-effect reconciliation is missing ${marker}`);
}

function assertFirstAttemptOnly(source) {
  for (const name of ['admit', 'start', 'canary', 'reconcile', 'reuse']) {
    const block = job(source, name);
    const attemptBinding = block.match(
      /([A-Z0-9_]*RUN_ATTEMPT[A-Z0-9_]*): \$\{\{ github\.run_attempt \}\}/,
    );
    assert.ok(attemptBinding, `${name} must bind github.run_attempt before doing work`);
    const variable = attemptBinding[1];
    const refusal = new RegExp(`\\[\\[ "\\$${variable}" == '1' \\]\\]`);
    assert.match(block, refusal, `${name} must reject every GitHub rerun attempt`);
    const refusalIndex = block.search(refusal);
    const firstEffectIndex = Math.min(...[
      block.indexOf('actions/download-artifact@'),
      block.indexOf('actions/upload-artifact@'),
      block.indexOf('produce-local'),
    ].filter((index) => index >= 0));
    assert.ok(refusalIndex >= 0 && refusalIndex < firstEffectIndex,
      `${name} must reject a rerun before downloading, persisting, or invoking effect evidence`);
  }
}

function assertExactCandidateSourceRun(source) {
  const admit = job(source, 'admit');
  const canary = job(source, 'canary');
  const start = job(source, 'start');
  assert.equal(occurrences(source,
    /workflow_path: '\.github\/workflows\/physio-production-prepare-release\.yml'/g), 1,
  'candidate metadata must have one credential-free admission and no drifting re-resolution');
  assert.match(admit, /id: process\.env\.CANDIDATE_ID/);
  assert.match(admit, /expected_digest: process\.env\.CANDIDATE_DIGEST/);
  assert.match(admit, /name_patterns: \[`\^physio-candidate-\$\{process\.env\.APPLICATION_SHA\}\$`\]/);
  assert.match(admit,
    /workflow_path: '\.github\/workflows\/physio-production-prepare-release\.yml'/);
  assert.match(admit, /allowed_conclusions: \['success'\]/);
  assert.match(admit, /run-id: \$\{\{ steps\.artifacts\.outputs\.candidate_run_id \}\}/,
    'credential-free admission must download bytes from its helper-admitted source run');

  assert.match(start,
    /CANDIDATE_SOURCE_RUN_ID: \$\{\{ needs\.admit\.outputs\.candidate_run_id \}\}/,
    'STARTED must preserve the original candidate source-run identity');
  assert.match(start,
    /candidate_source_run_id: Number\(process\.env\.CANDIDATE_SOURCE_RUN_ID\)/,
    'the admission receipt must validate its original source run before STARTED');
  assert.match(canary, /run-id: \$\{\{ needs\.admit\.outputs\.candidate_run_id \}\}/,
    'execution must download the candidate only from the originally admitted source run');
  assert.doesNotMatch(canary,
    /github-artifact-admission\.mjs|steps\.artifacts\.outputs\.candidate_run_id/,
    'execution may not re-resolve mutable metadata or introduce a second source-run output');
  assert.match(canary,
    /sha256sum "\$started\/candidate-artifact-admission\.json"[\s\S]*== "\$SOURCE_ADMISSION_RECEIPT_SHA256"/,
    'the paid boundary must verify the original source-run admission raw hash');
  assert.match(canary,
    /"\$RUNNER_TEMP\/provider-canary-started\/candidate-artifact-admission\.json"[\s\S]*"\$effect_packet\/candidate-artifact-execution-admission\.json"/,
    'execution evidence must be a byte-identical copy of the original admitted metadata');

  const sourceHashCheck = canary.indexOf(
    '[[ "$(sha256sum "$started/candidate-artifact-admission.json"',
  );
  const providerCredentialReference = canary.indexOf('${{ secrets.OPENAI_API_KEY }}');
  assert.ok(sourceHashCheck >= 0 && sourceHashCheck < providerCredentialReference,
    'source-run receipt reconciliation must complete before provider credentials are exposed');
}

function assertContentFreeTerminalEvidence(source) {
  const canary = job(source, 'canary');
  const seal = step(canary, 'Seal content-free provider effect evidence');
  const effectUpload = step(canary, 'Upload bounded exact-image canary effect evidence');

  assert.match(seal, /if: \$\{\{ always\(\) \}\}/,
    'terminal reconciliation must run even after producer failure');
  assert.match(effectUpload, /if: \$\{\{ always\(\) \}\}/,
    'terminal effect evidence must upload even after producer failure');
  assert.match(effectUpload, /path: \$\{\{ runner\.temp \}\}\/physio-canary-effect/,
    'terminal evidence must upload only the bounded content-free packet');
  assert.doesNotMatch(effectUpload,
    /physio-canary-private|producer\.(?:stdout|stderr)|path: \$\{\{ runner\.temp \}\}\s*$/m,
    'private provider transcripts or the whole temp directory may not be uploaded');

  ordered(seal, [
    'producer.stdout',
    'producer.stderr',
    'stdout_sha="sha256:',
    'stderr_sha="sha256:',
    'producer_stdout_sha256:',
    'producer_stderr_sha256:',
    'rm -f "$private/producer.stdout" "$private/producer.stderr"',
    'validate-effect',
  ], 'content-free effect sealing');
  assert.doesNotMatch(canary,
    /(?:install|cp|mv)[^\n]*(?:producer\.stdout|producer\.stderr)[^\n]*\$effect_packet/,
    'raw provider transcripts may never enter the effect packet');
  assert.match(seal, /partial_provider_request_id_hashes: \[\]/,
    'even fallback reconciliation must expose only provider-ID hashes');
  assert.match(seal, /error_receipt_sha256: `sha256:/,
    'fallback reconciliation must hash, rather than publish, error content');
  assert.doesNotMatch(effectUpload, /include-hidden-files:\s*true/,
    'terminal evidence must not scoop up hidden runner files');
  assert.match(seal,
    /if \[\[ ! -e "\$private\/producer-exit-code" \]\]; then[\s\S]*printf '%s\\n' '125' >"\$private\/producer-exit-code"[\s\S]*fi/,
    'seal must synthesize an unresolved producer status when any post-STARTED pre-producer step fails');
  assert.match(seal, /started_packet="\$RUNNER_TEMP\/provider-canary-started"/,
    'seal must recover durable STARTED inputs independently of the producer step');
  for (const file of [
    'provider-canary-started-effect.json',
    'provider-canary-admission.json',
    'candidate-artifact-admission.json',
  ]) assert.ok(seal.includes(file),
    `seal must recover ${file} independently of whether the producer step started`);
}

function assertCompletedEightCallSuccessGate(source) {
  const canary = job(source, 'canary');
  const seal = step(canary, 'Seal content-free provider effect evidence');
  const successUpload = step(canary, 'Upload successful bounded exact-image canary receipt');

  ordered(seal, [
    'validate-effect',
    '[[ "$result" == \'COMPLETED\' ]]',
    'physio-exact-image-canary-contract.mjs validate',
    'canary_receipt_sha256=',
    'echo "producer_exit_code=$producer_status"',
  ], 'COMPLETED success gate');
  assert.match(seal, /provider_call_maximum: 8/,
    'fallback and terminal effect evidence must retain the eight-call ceiling');
  assert.match(successUpload,
    /if: \$\{\{ steps\.seal_effect\.outputs\.producer_exit_code == '0' \}\}/,
    'the success artifact may only follow a fully sealed zero-exit provider result');
  assert.match(successUpload,
    /name: physio-exact-image-canary-\$\{\{ inputs\.application_sha \}\}/);
  assert.match(successUpload, /path: \$\{\{ runner\.temp \}\}\/physio-canary-receipt/);
  assert.ok(canary.indexOf('Upload bounded exact-image canary effect evidence') <
      canary.indexOf('Upload successful bounded exact-image canary receipt'),
  'durable terminal effect evidence must precede publication of a PASS receipt');

  const reconcile = job(source, 'reconcile');
  ordered(reconcile, [
    'Download exact completed-effect admission packet',
    'sha256sum --check --strict SHA256SUMS',
    'physio-exact-image-canary-contract.mjs validate-effect',
    'physio-exact-image-canary-contract.mjs validate',
    "provider_call_maximum: 8",
    "echo 'provider_calls_executed=0'",
    'Publish reconciled exact-image canary success artifact',
    'Prove reconciliation executed no provider calls',
  ], 'zero-call COMPLETED reconciliation');
  assert.match(reconcile,
    /name: physio-exact-image-canary-\$\{\{ inputs\.application_sha \}\}/,
    'reconciliation must publish the same exact success-artifact contract');
  assert.doesNotMatch(reconcile,
    /\$\{\{\s*secrets\.|\bOPENAI_API_KEY\b|\bproduce-local\b|\bALLOW_PAID_PROVIDER_PROBE\b/,
    'completed-effect reconciliation may not possess or invoke a provider credential');

  const reuse = job(source, 'reuse');
  ordered(reuse, [
    'Download exact admitted success-readback packet',
    'sha256sum --check --strict SHA256SUMS',
    'provider_calls_executed: 0',
    "echo 'provider_calls_executed=0'",
    'Upload exact existing-success readback evidence',
    'Prove success readback executed no provider calls',
  ], 'zero-call existing-success readback');
  assert.match(reuse,
    /canary_artifact_id: \$\{\{ needs\.admit\.outputs\.existing_success_artifact_id \}\}/,
    'existing-success readback must return the exact already-published artifact ID');
  assert.match(reuse,
    /canary_artifact_digest: \$\{\{ needs\.admit\.outputs\.existing_success_artifact_digest \}\}/,
    'existing-success readback must return the exact already-published artifact digest');
  assert.doesNotMatch(reuse,
    /\$\{\{\s*secrets\.|\bOPENAI_API_KEY\b|\bproduce-local\b|\bALLOW_PAID_PROVIDER_PROBE\b/,
    'existing-success readback may not possess or invoke a provider credential');
}

function assertNoInfrastructureSurface(source) {
  assert.match(source,
    /I_ACKNOWLEDGE_THIS_USES_ONLY_SYNTHETIC_FIXTURES_IN_A_DISPOSABLE_NO_SERVICE_NO_VOLUME_NO_DNS_CONTAINER/);
  assert.match(source, /^permissions:\n  contents: read\n  actions: read\n/m,
    'the isolated canary needs only source and artifact read access');
  assert.doesNotMatch(source, /\$\{\{\s*secrets\.(?:FLY|CLOUDFLARE|DNS|AWS|AZURE|GCP)[A-Z0-9_]*\s*\}\}/i,
    'the no-service canary may not receive infrastructure credentials');
  assert.doesNotMatch(source,
    /^\s*(?:fly|flyctl|cloudflared|cloudflare|terraform|pulumi|kubectl|helm|docker compose|systemctl|service)\b/im,
    'the exact-image canary may not mutate a service, volume, DNS, or deployment surface');
  assert.doesNotMatch(source,
    /^\s*(?:services|volumes|ports):\s*(?:\n|$)/im,
    'the canary workflow may not declare network services, volumes, or published ports');
  assert.doesNotMatch(source,
    /docker run[^\n]*(?:--publish|-p\s|--volume|-v\s|--mount)/i,
    'a direct container invocation may not publish a port or attach a volume');
}

function assertCanaryExecutionSourceGraph() {
  const paths = [
    'scripts/physio-exact-image-canary.mjs',
    'scripts/physio-exact-image-canary-contract.mjs',
    '.github/workflows/physio-production-exact-image-canary.yml',
    'server/tests/physio-exact-image-canary.test.mjs',
  ];
  const graphConsumers = [
    path.join(repoRoot, '.github', 'workflows', 'physio-production-publish.yml'),
    path.join(repoRoot, '.github', 'workflows', 'physio-production-deploy.yml'),
    path.join(repoRoot, 'scripts', 'physio-deploy-admission.mjs'),
  ];
  for (const consumer of graphConsumers) {
    const source = fs.readFileSync(consumer, 'utf8').replaceAll('\r\n', '\n');
    for (const requiredPath of paths) {
      assert.ok(source.includes(requiredPath),
        `${path.relative(repoRoot, consumer)} does not freeze ${requiredPath}`);
    }
  }
}

test('exact-image canary keeps provider credentials behind durable same-run STARTED evidence', () => {
  assertNoDuplicateJobKeys(workflowSource);
  assertProviderSecretBoundary(workflowSource);
  assertSameRunArtifactProvenance(workflowSource);
  assertFirstAttemptOnly(workflowSource);
});

test('provider-effect identity is deterministic and retained prior effects forbid replay', () => {
  assertDeterministicEffectAndReplayRefusal(workflowSource);
});

test('candidate execution is rebound to the exact originally admitted source run', () => {
  assertExactCandidateSourceRun(workflowSource);
});

test('always-upload effect evidence is content-free and success requires COMPLETED eight-call proof', () => {
  assertContentFreeTerminalEvidence(workflowSource);
  assertCompletedEightCallSuccessGate(workflowSource);
});

test('provider canary has no Fly, DNS, volume, port, or service mutation surface', () => {
  assertNoInfrastructureSurface(workflowSource);
});

test('publication and deploy freeze the complete canary execution source graph', () => {
  assertCanaryExecutionSourceGraph();
});

test('tamper cases are rejected by the focused workflow contract', async (t) => {
  const cases = [
    {
      name: 'provider secret moved into STARTED job',
      validate: assertProviderSecretBoundary,
      source: workflowSource.replace(
        '  start:\n',
        '  start:\n    env:\n      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}\n',
      ),
    },
    {
      name: 'STARTED admission downloaded from another run',
      validate: assertSameRunArtifactProvenance,
      source: workflowSource.replace(
        'run-id: ${{ github.run_id }}',
        'run-id: ${{ needs.admit.outputs.candidate_run_id }}',
      ),
    },
    {
      name: 'workflow run contaminates deterministic effect identity',
      validate: assertDeterministicEffectAndReplayRefusal,
      source: workflowSource.replace(
        "const effectIdentity = {\n",
        "const effectIdentity = {\n            github_run_id: process.env.GITHUB_RUN_ID,\n",
      ),
    },
    {
      name: 'prior terminal effect is no longer rejected',
      validate: assertDeterministicEffectAndReplayRefusal,
      source: workflowSource.replace(
        'prior_effect exists; ambiguous STARTED_UNRESOLVED or completed replay forbidden; exit 1',
        'prior effect tolerated',
      ),
    },
    {
      name: 'STARTED job accepts reruns',
      validate: assertFirstAttemptOnly,
      source: workflowSource.replace(
        '      - name: Refuse workflow rerun before STARTED publication\n        shell: bash\n        env:\n          RUN_ATTEMPT: ${{ github.run_attempt }}\n        run: |\n          set -euo pipefail\n          [[ "$RUN_ATTEMPT" == \'1\' ]]',
        '      - name: Refuse workflow rerun before STARTED publication\n        shell: bash\n        env:\n          RUN_ATTEMPT: ${{ github.run_attempt }}\n        run: |\n          set -euo pipefail\n          [[ "$RUN_ATTEMPT" -ge \'1\' ]]',
      ),
    },
    {
      name: 'execution downloads the candidate from the current workflow run',
      validate: assertExactCandidateSourceRun,
      source: workflowSource.replace(
        'run-id: ${{ needs.admit.outputs.candidate_run_id }}',
        'run-id: ${{ github.run_id }}',
      ),
    },
    {
      name: 'terminal upload exposes private transcripts',
      validate: assertContentFreeTerminalEvidence,
      source: workflowSource.replace(
        'path: ${{ runner.temp }}/physio-canary-effect',
        'path: ${{ runner.temp }}/physio-canary-private',
      ),
    },
    {
      name: 'success artifact uploads regardless of terminal result',
      validate: assertCompletedEightCallSuccessGate,
      source: workflowSource.replace(
        "if: ${{ steps.seal_effect.outputs.producer_exit_code == '0' }}",
        'if: ${{ always() }}',
      ),
    },
    {
      name: 'Fly deployment command added',
      validate: assertNoInfrastructureSurface,
      source: `${workflowSource}\n      - name: forbidden\n        run: |\n          fly deploy\n`,
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, () => {
      assert.notEqual(scenario.source, workflowSource,
        `tamper fixture ${scenario.name} did not alter the workflow`);
      assert.throws(() => scenario.validate(scenario.source));
    });
  }
});
