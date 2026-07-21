import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const cliArgs = process.argv.slice(2);
const selftest = cliArgs.includes('--selftest');
const workflowArg = cliArgs.find((value) => value !== '--selftest' && value !== '--print-self-sha');
const workflowPath = path.resolve(workflowArg || '.github/workflows/production-deploy.yml');
const rawSource = fs.readFileSync(workflowPath, 'utf8');
const validatorSelfSha256 = createHash('sha256')
  .update(fs.readFileSync(new URL(import.meta.url), 'utf8').replaceAll('\r\n', '\n'))
  .digest('hex');
if (cliArgs.includes('--print-self-sha')) {
  process.stdout.write(`${validatorSelfSha256}\n`);
  process.exit(0);
}

const EXPECTED_GATE_STEPS = [
  'Validate trusted dispatch context and inputs',
  'Check out exact application SHA',
  'Verify exact SHA and remote branch tip',
  'Set up Node.js 24',
  'Validate Fly and Docker credential/topology boundary',
  'Install locked dependencies',
  'Fail-closed dependency vulnerability audit',
  'Validate the exact trusted workflow control',
  'Require the referral assurance entrypoints and reviewed canary code',
  'Build',
  'Typecheck against exact production-base differential',
  'Lint with exact legacy-baseline containment',
  'Existing deterministic server and entry-guard gates',
  'Existing seeded launch-gate suite',
  'Existing public-evidence service gates',
  'Mission assurance aggregate',
  'Rendered referral browser journey gate',
  'Secret and high-entropy diff scan',
  'Build exact candidate image locally without credentials',
  'Preserve the exact gated candidate image',
];

const EXPECTED_DEPLOY_STEPS = [
  'Record the rollback-reserved deployment-job deadline',
  'Check out exact gated candidate',
  'Check out reviewed rollback configuration source',
  'Restore the exact gated candidate image',
  'Verify and load the gated candidate image without credentials',
  'Reverify release and rollback provenance without credentials',
  'Set up Node.js 24',
  'Install exact candidate dependencies for image compatibility proof',
  'Install checksum-verified flyctl 0.4.71',
  'Final secret-bearing Fly release command and public verification',
];

const REVIEWED_DIGESTS = new Map([
  ['scripts/referral-production-canary.mjs', '96c8ecb24cd67df81127923c33ecaea232fe3d8dbbec52006bc7fa7ecfa7a3ae'],
  ['scripts/referral-production-canary-contract.mjs', 'e244e9b332b31a14f4ca14d19fc0b7129e045674542cbb5540af3a613f68eb94'],
  ['scripts/validate-referral-production-canary-output.mjs', '55b257d0e732f83f4146b1c0dc836d4bfce730cdf81f935d696bc12adea57ab1'],
  ['scripts/scan-release-diff.mjs', '1b34b794ab79f5ea022525f31bf70397c629ca0a16baf4320503c6cfdbd36c5c'],
]);

function normalized(value) {
  return value.replaceAll('\r\n', '\n');
}

function withoutCommentOnlyLines(value) {
  return value
    .split('\n')
    .filter((line) => !/^\s*(?:#|\/\/)/.test(line))
    .join('\n');
}

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function parseSteps(source, failures) {
  const matches = [...source.matchAll(/^      - name: ([^\n]+)$/gm)];
  const steps = matches.map((match, index) => ({
    name: match[1].trim(),
    start: match.index,
    end: matches[index + 1]?.index ?? source.length,
    body: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
  return steps;
}

function validateDeployWorkflow(input) {
  const failures = [];
  const source = normalized(input);
  const active = withoutCommentOnlyLines(source);
  const fail = (message) => failures.push(message);
  const requireText = (needle, label = needle) => {
    if (!active.includes(needle)) fail('missing ' + label);
  };
  const jobBody = (name) => {
    const marker = '\n  ' + name + ':\n';
    const start = source.indexOf(marker);
    if (start < 0) {
      fail('missing job ' + name);
      return '';
    }
    const rest = source.slice(start + marker.length);
    const next = rest.search(/\n  [a-z0-9_]+:\n/);
    return marker + (next < 0 ? rest : rest.slice(0, next));
  };
  const stepsIn = (body) => [...body.matchAll(/^      - name: ([^\n]+)$/gm)].map((match) => match[1].trim());
  const expectSteps = (job, expected) => {
    const actual = stepsIn(jobBody(job));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(job + ' step sequence differs: ' + JSON.stringify(actual));
    if (new Set(actual).size !== actual.length) fail(job + ' contains duplicate step names');
  };

  if (source.includes('\t')) fail('workflow contains a literal tab');
  if (!source.endsWith('\n')) fail('workflow must end with one LF newline');
  const triggerStart = source.indexOf('\non:\n');
  const triggerEnd = source.indexOf('\npermissions:\n');
  const trigger = source.slice(triggerStart + 1, triggerEnd);
  if (!trigger.startsWith('on:\n  workflow_dispatch:\n')) fail('workflow is not manual-dispatch only');
  for (const forbidden of ['push:', 'pull_request:', 'pull_request_target:', 'schedule:', 'workflow_call:', 'workflow_run:', 'repository_dispatch:']) {
    if (withoutCommentOnlyLines(trigger).includes(forbidden)) fail('forbidden trigger ' + forbidden);
  }
  requireText('permissions:\n  contents: read\n\nconcurrency:', 'read-only workflow permissions');
  requireText('group: assesssuite-production\n  cancel-in-progress: false', 'production concurrency lock');
  requireText('EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, 'exact trusted workflow-validator digest');

  const jobsSource = source.slice(source.indexOf('\njobs:\n') + 6);
  const jobs = [...jobsSource.matchAll(/^  ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  const expectedJobs = ['gates', 'publish_image', 'exact_image_compatibility', 'deploy'];
  if (JSON.stringify(jobs) !== JSON.stringify(expectedJobs)) fail('deploy job sequence differs: ' + JSON.stringify(jobs));

  expectSteps('gates', [
    'Validate trusted dispatch context and inputs', 'Check out exact application SHA',
    'Verify exact SHA and remote branch tip', 'Set up Node.js 24',
    'Validate Fly and Docker credential/topology boundary', 'Install locked dependencies',
    'Fail-closed dependency vulnerability audit', 'Validate the exact trusted workflow control',
    'Require the referral assurance entrypoints and reviewed canary code', 'Build',
    'Typecheck against exact production-base differential', 'Lint with exact legacy-baseline containment',
    'Existing deterministic server and entry-guard gates', 'Existing seeded launch-gate suite',
    'Existing public-evidence service gates', 'Mission assurance aggregate',
    'Rendered referral browser journey gate', 'Secret and high-entropy diff scan',
    'Build exact candidate image locally without credentials', 'Preserve the exact gated candidate image',
    'Preserve sealed release controls',
  ]);
  expectSteps('publish_image', [
    'Download exact gated candidate by immutable artifact ID', 'Validate and load candidate image as data only',
    'Install checksum-verified flyctl 0.4.71 for registry authentication only',
    'Acquire isolated registry credential', 'Publish immutable image and seal compatibility bundle',
    'Upload sealed publication receipt and rollback image data',
  ]);
  expectSteps('exact_image_compatibility', [
    'Check out exact candidate into the no-secret proof runner',
    'Download exact candidate image by immutable artifact ID',
    'Download exact publication bundle by immutable artifact ID',
    'Set up Node.js 24 for isolated compatibility proof',
    'Verify immutable handoff and run exact-image compatibility proof',
    'Upload bounded compatibility proof receipt',
  ]);
  expectSteps('deploy', [
    'Record the rollback-reserved deployment-job deadline',
    'Download sealed release controls by immutable artifact ID',
    'Download bounded compatibility receipt by immutable artifact ID',
    'Validate sealed controls and compatibility receipt before secret injection',
    'Install checksum-verified flyctl 0.4.71',
    'Final secret-bearing Fly release command and public verification',
  ]);

  const gates = withoutCommentOnlyLines(jobBody('gates'));
  const publish = withoutCommentOnlyLines(jobBody('publish_image'));
  const compatibility = withoutCommentOnlyLines(jobBody('exact_image_compatibility'));
  const deploy = withoutCommentOnlyLines(jobBody('deploy'));
  if (!publish.includes('needs: gates')) fail('publish_image does not need gates');
  if (!compatibility.includes('needs: [gates, publish_image]')) fail('compatibility DAG differs');
  if (!deploy.includes('needs: [gates, publish_image, exact_image_compatibility]')) fail('deploy DAG differs');
  for (const body of [gates, publish, compatibility, deploy]) {
    if (!body.includes('runs-on: ubuntu-24.04')) fail('a deploy job lacks the exact fresh runner image');
  }

  const uses = [...active.matchAll(/^\s+uses:\s+([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]);
  if (uses.length !== 13) fail('expected 13 pinned action uses, found ' + uses.length);
  for (const action of uses) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(action)) fail('action is not pinned to a full commit SHA: ' + action);
  }

  for (const inputName of [
    'trusted_workflow_sha', 'application_sha', 'candidate_config_sha256',
    'rollback_config_sha256', 'source_branch', 'expected_current_release',
    'expected_current_image', 'expected_machine_id', 'expected_volume_id',
    'rollback_source_sha', 'rollback_source_branch', 'rollback_image',
    'rollback_release_sha', 'extraction_runtime_mode', 'provider_terms_attestation',
    'provider_terms_evidence_id', 'under_age_zdr_runtime_mode',
    'under_age_zdr_attestation', 'under_age_zdr_evidence_id',
    'capability_intent_id', 'authority_reference', 'confirmation',
  ]) {
    const found = countOf(withoutCommentOnlyLines(trigger), '      ' + inputName + ':');
    if (found !== 1) fail('dispatch input ' + inputName + ': expected 1, found ' + found);
  }

  for (const needle of [
    '[[ "$REPOSITORY" == "mbvidler-ctrl/assesssuite_migration" ]]',
    '[[ "$ACTOR" == "mbvidler-ctrl" ]]', '[[ "$TRIGGERING_ACTOR" == "mbvidler-ctrl" ]]',
    '[[ "$EVENT_REF" == "refs/heads/main" ]]', '[[ "$WORKFLOW_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]',
    '[[ "$APPLICATION_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '[[ "$ROLLBACK_SOURCE_SHA" == "$APPLICATION_SHA" ]]',
  ]) if (!gates.includes(needle)) fail('missing dispatch/provenance guard ' + needle);

  for (const needle of [
    'candidate_image_artifact_id: ${{ steps.upload_candidate.outputs.artifact-id }}',
    'candidate_image_artifact_digest: ${{ steps.upload_candidate.outputs.artifact-digest }}',
    'release_control_artifact_id: ${{ steps.upload_controls.outputs.artifact-id }}',
    'release_control_artifact_digest: ${{ steps.upload_controls.outputs.artifact-digest }}',
    'docker save "assesssuite-release-gate:$APPLICATION_SHA" | gzip -1 -n',
    'candidate-build-receipt.json',
  ]) if (!gates.includes(needle)) fail('missing immutable gate handoff ' + needle);

  if (countOf(active, '${{ secrets.FLY_API_TOKEN }}') !== 2 || countOf(active, '${{ secrets.') !== 2) fail('Fly credential expressions are not confined to publication auth and deployment');
  for (const forbidden of ['actions/checkout@', 'docker build ', 'docker run ', 'docker create ', 'docker start ', 'docker exec ', 'fly deploy ']) {
    if (publish.includes(forbidden)) fail('publication job contains forbidden candidate execution/control: ' + forbidden.trim());
  }
  if (/(^|\n)\s*(npm|npx)\s/.test(publish)) fail('publication job contains forbidden package execution');
  if (countOf(publish, 'DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config') !== 2 || publish.includes('DOCKER_CONFIG: ~/.docker')) {
    fail('publication registry credential is not confined to the two isolated Docker-config steps');
  }
  for (const needle of [
    'artifact-ids: ${{ needs.gates.outputs.candidate_image_artifact_id }}',
    'DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config',
    'FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}', '"$RUNNER_TEMP/fly" auth docker',
    'docker push "$new_image_tag"', 'docker pull "$ROLLBACK_IMAGE"',
    'docker save "$ROLLBACK_IMAGE" | gzip -1 -n', 'docker logout registry.fly.io',
    'rm -rf "$DOCKER_CONFIG"', '[[ ! -e "$DOCKER_CONFIG" ]]',
    'publication_artifact_id: ${{ steps.upload_publication.outputs.artifact-id }}',
    'candidate_image_ref: ${{ steps.publish.outputs.candidate_image_ref }}',
  ]) if (!publish.includes(needle)) fail('missing publication boundary ' + needle);

  if (compatibility.includes('${{ secrets.') || /(^|\n)\s+FLY_API_TOKEN:\s/.test(compatibility) ||
      compatibility.includes('fly auth ') || compatibility.includes('docker pull ')) {
    fail('no-secret compatibility job contains a credential or registry acquisition path');
  }
  for (const needle of [
    'artifact-ids: ${{ needs.gates.outputs.candidate_image_artifact_id }}',
    'artifact-ids: ${{ needs.publish_image.outputs.publication_artifact_id }}',
    '[[ -z "${FLY_API_TOKEN:-}" ]]', '"$(wc -c <"$publication")" -le 8192',
    "if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(keys))",
    "['application_sha',e.APPLICATION_SHA]", "['candidate_image_ref',e.CANDIDATE_IMAGE_REF]",
    "['rollback_image_ref',e.ROLLBACK_IMAGE]", 'npm run test:forward-rollback-compatibility',
    '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -eq 1 ]]',
    'ROLLBACK_PROOF_REGISTERING_STATE', 'ROLLBACK_PROOF_39_FIELD_PER_FILE_MERGE',
    'ROLLBACK_PROOF_AGE_QUARANTINE', 'ROLLBACK_PROOF_REFERRAL_COMMIT_RECEIPT_REPLAY',
    'compatibility_artifact_id: ${{ steps.upload_compatibility.outputs.artifact-id }}',
    'path: ${{ runner.temp }}/compatibility/compatibility-receipt.json',
  ]) if (!compatibility.includes(needle)) fail('missing compatibility proof boundary ' + needle);

  if (deploy.includes('actions/checkout@') || /(^|\n)\s*(npm|npx)\s/.test(deploy) ||
      /(^|\n)\s*docker\s/.test(deploy) || /(^|\n)\s*node\s+(?:candidate|server|scripts)\//.test(deploy)) {
    fail('credentialed deploy job contains candidate checkout, package execution, Docker, or repository Node');
  }
  const secretOffset = deploy.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const receiptOffset = deploy.indexOf('Validate sealed controls and compatibility receipt before secret injection');
  if (secretOffset < 0 || receiptOffset < 0 || secretOffset < receiptOffset) fail('deploy credential is injected before bounded receipt validation');
  for (const needle of [
    'artifact-ids: ${{ needs.gates.outputs.release_control_artifact_id }}',
    'artifact-ids: ${{ needs.exact_image_compatibility.outputs.compatibility_artifact_id }}',
    '"$(wc -c <"$receipt")" -le 8192', 'Compatibility receipt keys differ',
    '[[ -z "${FLY_API_TOKEN:-}" ]]\n          if env | grep -Eq \'^(FLY_API_TOKEN|DOCKER_AUTH_CONFIG)=\'; then exit 1; fi\n          control=',
    '[[ "$RELEASE_CONTROL_ARTIFACT_ID" =~ ^[1-9][0-9]*$ && "$RELEASE_CONTROL_ARTIFACT_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]',
    "['candidate_image_ref',env.CANDIDATE_IMAGE_REF]",
    '!/^[0-9a-f]{64}$/.test(row.publication_receipt_sha256)',
    'empty-deploy-context', 'candidate_image_ref="$CANDIDATE_IMAGE_REF"',
    '[[ "$candidate_image_ref" =~ ^registry\\.fly\\.io/assesssuite-production@sha256:[0-9a-f]{64}$ ]]',
    'fly deploy "$deploy_source_dir"', '--remote-only', '--skip-release-command',
    '--image "$candidate_image_ref"', '--image "$ROLLBACK_IMAGE"',
  ]) if (!deploy.includes(needle)) fail('missing remote-only deploy boundary ' + needle);
  if (countOf(deploy, '--remote-only') !== 2 || countOf(deploy, '--skip-release-command') !== 2) fail('candidate and rollback deploys do not both suppress local/release execution');
  if (countOf(deploy, 'fly deploy "$deploy_source_dir"') !== 2 || deploy.includes('fly deploy "$GITHUB_WORKSPACE/candidate"')) {
    fail('candidate and rollback deploys are not both confined to the trusted empty context');
  }

  const exactEight = "'ADMIN_PASSWORD', 'APP_URL', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',\n            'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_ANNUAL',\n            'OPENAI_API_KEY'";
  if (!deploy.includes(exactEight)) fail('exact eight-name production secret allowlist is absent');
  for (const needle of [
    "expected = [...required, 'LEGAL_STATUS', 'LEGAL_EFFECTIVE_DATE'];", 'expected = required;',
    'JSON.stringify([...names].sort()) !== JSON.stringify([...expected].sort())',
    'assert_secret_name_boundary initial allow', 'assert_secret_name_boundary final forbid',
  ]) if (!deploy.includes(needle)) fail('missing exact names-only secret transition ' + needle);
  if (deploy.includes('UPLOAD_AUDIT_LEGAL_HOLD')) fail('unreviewed app-consumed secret name enters the exact allowlist');

  for (const forbidden of ['continue-on-error:', 'set -x', 'set -o xtrace']) {
    if (active.includes(forbidden)) fail('workflow contains fail-open or secret-logging control ' + forbidden);
  }
  return failures;
}

const EXPECTED_PREPARE_STEPS = [
  'Validate trusted dispatch context and inputs',
  'Check out exact compatibility source SHA',
  'Verify exact rollback source and compatibility policy',
  'Set up Node.js 24',
  'Install locked dependencies',
  'Fail-closed dependency vulnerability audit',
  'Validate exact trusted release controls',
  'Require complete rollback proof contract',
  'Build, typecheck differential, selftest, and rollback proof',
  'Lint only compatibility-source changes',
  'Secret scan and local image gate',
  'Install checksum-verified flyctl 0.4.71',
  'Final secret-bearing compatibility image publication',
];

const EXPECTED_ROLLBACK_STEPS = [
  'Validate trusted rollback dispatch and inputs',
  'Check out reviewed rollback configuration source only',
  'Verify rollback provenance and compatibility configuration',
  'Set up Node.js 24',
  'Validate exact trusted release controls',
  'Install checksum-verified flyctl 0.4.71',
  'Final secret-bearing immutable rollback and verification',
];

function validateAuxWorkflow(input, kind) {
  const failures = [];
  const source = normalized(input);
  const active = withoutCommentOnlyLines(source);
  const steps = parseSteps(source, failures);
  const byName = new Map(steps.map((step) => [step.name, step]));
  const expectedSteps = kind === 'prepare' ? EXPECTED_PREPARE_STEPS : EXPECTED_ROLLBACK_STEPS;
  const finalStepName = expectedSteps.at(-1);
  const finalStep = byName.get(finalStepName);
  const finalActive = withoutCommentOnlyLines(finalStep?.body || '');
  const dispatchStepName = expectedSteps[0];
  const verificationStepName = expectedSteps[2];

  const fail = (message) => failures.push(message);
  const requireText = (needle, label = needle) => {
    if (!active.includes(needle)) fail(`missing ${label}`);
  };
  const requireCount = (needle, expected, label = needle) => {
    const count = countOf(active, needle);
    if (count !== expected) fail(`${label}: expected ${expected}, found ${count}`);
  };
  const requireAtLeast = (needle, expected, label = needle) => {
    const count = countOf(active, needle);
    if (count < expected) fail(`${label}: expected at least ${expected}, found ${count}`);
  };
  const requireStepText = (stepName, needle, label = needle) => {
    const step = byName.get(stepName);
    if (!step || !withoutCommentOnlyLines(step.body).includes(needle)) {
      fail(`missing ${label} in step ${stepName}`);
    }
  };
  const functionBody = (name, nextName) => {
    const body = finalActive;
    const signature = `          ${name}() {`;
    const signatureCount = countOf(body, signature);
    if (signatureCount !== 1) {
      fail(`exact ${name} function definition count differs: ${signatureCount}`);
      return '';
    }
    const start = body.indexOf(signature);
    const end = nextName ? body.indexOf(`          ${nextName}() {`, start + 1) : body.length;
    if (start < 0 || end < 0) {
      fail(`missing exact ${name} function boundary`);
      return '';
    }
    return body.slice(start, end);
  };

  if (source.includes('\t')) fail('workflow contains a literal tab');
  if (!source.endsWith('\n')) fail('workflow must end with one LF newline');
  const stepNames = steps.map((step) => step.name);
  if (JSON.stringify(stepNames) !== JSON.stringify(expectedSteps)) {
    fail(`${kind} step sequence differs: ${JSON.stringify(stepNames)}`);
  }
  if (new Set(stepNames).size !== stepNames.length) fail('workflow contains duplicate step names');

  const triggerStart = source.indexOf('\non:\n');
  const permissionsStart = source.indexOf('\npermissions:\n');
  const triggerBlock = source.slice(triggerStart + 1, permissionsStart);
  if (triggerStart < 0 || permissionsStart < 0 ||
      !triggerBlock.startsWith('on:\n  workflow_dispatch:\n')) {
    fail('workflow is not manual-dispatch only');
  }
  for (const forbiddenTrigger of [
    'push:', 'pull_request:', 'pull_request_target:', 'schedule:',
    'workflow_call:', 'workflow_run:', 'repository_dispatch:',
  ]) {
    if (withoutCommentOnlyLines(triggerBlock).includes(forbiddenTrigger)) fail(`forbidden trigger ${forbiddenTrigger}`);
  }
  requireText('permissions:\n  contents: read\n\nconcurrency:', 'read-only workflow permissions');
  requireText(
    `EXPECTED_TRUSTED_VALIDATOR_SHA256: ${validatorSelfSha256}`,
    'exact trusted workflow-validator digest',
  );
  requireStepText(
    'Validate exact trusted release controls',
    'sha256sum --check --strict',
    'trusted workflow-validator digest check',
  );
  if (/^\s*(?:id-token|actions|checks|deployments|packages|pull-requests|security-events|statuses):\s*(?:write|read-all|write-all)/m.test(active)) {
    fail('workflow grants an unreviewed permission');
  }
  for (const forbiddenControl of ['continue-on-error:', 'if: always()', 'if: success() ||', 'set -x', 'set -o xtrace']) {
    if (active.includes(forbiddenControl)) fail(`workflow contains fail-open or secret-logging control ${forbiddenControl}`);
  }

  const expectedInputs = kind === 'prepare'
    ? [
      'trusted_workflow_sha', 'rollback_source_sha', 'rollback_config_sha256',
      'expected_current_release', 'expected_current_image', 'expected_machine_id',
      'expected_volume_id', 'rollback_source_branch', 'superseded_legal_version',
      'new_legal_version', 'capability_intent_id', 'authority_reference', 'confirmation',
    ]
    : [
      'trusted_workflow_sha', 'failed_application_sha', 'expected_current_release',
      'expected_current_image', 'expected_machine_id', 'expected_volume_id',
      'rollback_source_sha', 'rollback_source_branch', 'rollback_config_sha256',
      'rollback_image', 'rollback_release_sha', 'capability_intent_id',
      'authority_reference', 'incident_reference', 'confirmation',
    ];
  const inputMatches = [...triggerBlock.matchAll(/^      ([a-z][a-z0-9_]+):$/gm)];
  const actualInputs = inputMatches.map((match) => match[1]);
  if (JSON.stringify(actualInputs) !== JSON.stringify(expectedInputs)) {
    fail(`dispatch input sequence differs: ${JSON.stringify(actualInputs)}`);
  }
  for (const [index, inputName] of expectedInputs.entries()) {
    const inputOffset = inputMatches[index]?.index ?? -1;
    const nextOffset = inputMatches[index + 1]?.index ?? triggerBlock.length;
    const block = inputOffset < 0 ? '' : triggerBlock.slice(inputOffset, nextOffset);
    if (!block.includes('        required: true\n') || !block.includes('        type: string\n')) {
      fail(`dispatch input ${inputName} is not a required string`);
    }
  }

  const uses = [...active.matchAll(/^\s+uses:\s+([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]);
  if (uses.length !== 2) fail(`expected 2 pinned action uses, found ${uses.length}`);
  for (const action of uses) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(action)) {
      fail(`action is not pinned to a full commit SHA: ${action}`);
    }
  }

  for (const [needle, label] of [
    ['[[ "$REPOSITORY" == "mbvidler-ctrl/assesssuite_migration" ]]', 'repository binding'],
    ['[[ "$ACTOR" == "mbvidler-ctrl" ]]', 'authorised actor binding'],
    ['[[ "$TRIGGERING_ACTOR" == "mbvidler-ctrl" ]]', 'authorised rerun actor binding'],
    ['[[ "$IS_FORK" == "false" ]]', 'fork rejection'],
    ['[[ "$EVENT_REF" == "refs/heads/main" ]]', 'default-branch dispatch binding'],
    ['[[ "$WORKFLOW_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', 'workflow SHA binding'],
    ['[[ "$EVENT_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', 'dispatch SHA binding'],
    ['[[ "$EXPECTED_CURRENT_RELEASE" =~ ^v[1-9][0-9]*$ ]]', 'release input shape'],
    ['[[ "$EXPECTED_MACHINE_ID" =~ ^[0-9a-f]{14,32}$ ]]', 'machine input shape'],
    ['[[ "$EXPECTED_VOLUME_ID" =~ ^vol_[A-Za-z0-9]+$ ]]', 'volume input shape'],
    ['[[ "$AUTHORITY_REFERENCE" =~ ^[A-Za-z0-9._:/-]{1,240}$ ]]', 'authority reference shape'],
    ['git check-ref-format "refs/heads/$ROLLBACK_SOURCE_BRANCH"', 'rollback branch validation'],
  ]) requireStepText(dispatchStepName, needle, label);
  for (const [needle, label] of [
    ['[[ "$ROLLBACK_SOURCE_BRANCH" == "main" ]]', 'rollback default-branch binding'],
    ['[[ "$ROLLBACK_SOURCE_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', 'rollback and workflow SHA identity'],
  ]) requireStepText(dispatchStepName, needle, label);
  if (kind === 'rollback') {
    requireStepText(
      dispatchStepName,
      '[[ "$FAILED_APPLICATION_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]',
      'failed application and workflow SHA identity',
    );
  }

  for (const [needle, label] of [
    ['refs/heads/$ROLLBACK_SOURCE_BRANCH', 'initial rollback remote-tip binding'],
    ['refs/heads/main', 'initial trusted-main binding'],
    ['== "$TRUSTED_WORKFLOW_SHA" ]]', 'initial trusted-main equality'],
    ['== "$ROLLBACK_CONFIG_SHA256" ]]', 'initial rollback-config digest binding'],
    ['(server/)?seed\\.mjs', 'full seed entrypoint denylist'],
    ['npm[[:space:]]+run[[:space:]]+seed', 'npm seed command denylist'],
    ['synthetic data reseeds on every boot', 'full seed startup denylist'],
    ['server/productionBootstrap.mjs', 'catalogue-only bootstrap requirement'],
    ['  app = "node server/productionBootstrap.mjs && exec node server/index.mjs"', 'catalogue-only Fly process override'],
    ['snapshot_retention = 5', 'five-day snapshot config'],
    ['scheduled_snapshots = true', 'scheduled snapshot config'],
    ['UPLOAD_AUDIT_RETENTION_DAYS = "730"', 'upload audit retention config'],
    ['UPLOAD_CLEANUP_INTERVAL_MINUTES = "1"', 'upload cleanup config'],
    ['fly.rollback.production.toml', 'default-branch rollback config path'],
  ]) requireStepText(verificationStepName, needle, label);

  const trustedStep = byName.get('Validate exact trusted release controls');
  for (const workflow of [
    'production-deploy.yml',
    'production-prepare-rollback-image.yml',
    'production-rollback.yml',
    'production-parity-assurance.yml',
  ]) {
    if (!trustedStep?.body.includes(workflow)) fail(`trusted control loop omits ${workflow}`);
  }
  requireStepText('Validate exact trusted release controls', '--selftest', 'trusted workflow mutation selftests');

  requireCount('${{ secrets.FLY_API_TOKEN }}', 1, 'Fly token expression');
  requireCount('${{ secrets.', 1, 'all GitHub secret expressions');
  if (!finalActive.includes('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}')) {
    fail('Fly token is not confined to the final step');
  }
  if (steps.at(-1)?.name !== finalStepName) fail('secret-bearing step is not the final workflow step');
  requireStepText(finalStepName, 'set -euo pipefail\n          set +x', 'fail-closed non-tracing shell');
  for (const line of finalActive.split('\n').filter((value) => /(?:^|\s)node(?:\s|$)/.test(value))) {
    if (!line.includes('env -u FLY_API_TOKEN node') && !line.includes('docker image inspect')) {
      fail(`local Node execution does not explicitly strip the Fly token: ${line.trim()}`);
    }
  }

  const topology = functionBody(
    'assert_topology',
    kind === 'prepare' ? 'enforce_volume_snapshot_policy' : 'assert_secret_name_boundary',
  );
  for (const needle of [
    'machines.length !== 1', 'volumes.length !== 1',
    'machine.id !== process.env.EXPECTED_MACHINE_ID',
    'volume.id !== process.env.EXPECTED_VOLUME_ID',
    'volume.size_gb !== 3', 'volume.encrypted !== true',
    'volume.attached_machine_id !== machine.id',
    'volume.snapshot_retention !== 5', 'volume.auto_backup_enabled !== true',
    'mounts.length !== 1', "mounts[0]?.path !== '/app/server/data'",
    'mounts[0]?.volume !== volume.id', 'mounts[0]?.encrypted !== true',
    'mounts[0]?.size_gb !== 3',
  ]) if (!topology.includes(needle)) fail(`topology contract lacks ${needle}`);
  if (/^\s*return 0\s*$/m.test(topology) || topology.includes('&& false')) fail('topology function has a fail-open bypass');

  const secrets = functionBody(
    'assert_secret_name_boundary',
    kind === 'prepare' ? null : 'read_version',
  );
  for (const needle of [
    'rows.length === 0', '/^(?:value|raw_value|secret_value)$/i',
    'new Set(names).size !== names.length',
    "'ADMIN_PASSWORD', 'APP_URL', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY'",
    "'NODE_ENV', 'SELFTEST', 'RELEASE_SHA', 'SOURCE_BRANCH', 'BUILD_TIMESTAMP'",
    "'DOCUMENT_EXTRACTION_TEST_BASE_URL', 'OPENAI_DOCUMENT_EXTRACTION_MODEL'",
    "'RUN_REFERRAL_PRODUCTION_CANARY'", "'LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS'",
    'configText.matchAll', 'env -u FLY_API_TOKEN node --input-type=module',
  ]) if (!secrets.includes(needle)) fail(`names-only secret boundary lacks ${needle}`);
  if (/^\s*return 0\s*$/m.test(secrets) || secrets.includes('&& false')) fail('secret boundary has a fail-open bypass');

  requireText('a782dceed173d215c000ab94e2b08623c22267edff6d90ebe3010b3f9b671dc2', 'pinned flyctl archive digest');
  requireText("'[\"sh\",\"-c\",\"node server/productionBootstrap.mjs && exec node server/index.mjs\"]'", 'exact catalogue-only image command');
  requireText("'[\"docker-entrypoint.sh\"]'", 'exact image entrypoint');
  requireText('io.assesssuite.rollback-proof', 'rollback compatibility proof label');
  requireText('io.assesssuite.trusted-workflow', 'rollback build-workflow provenance label');
  requireText('registering-state+39-field-per-file-merge+age-quarantine+referral-commit-receipt-replay', 'complete rollback proof label value');
  requireAtLeast('refs/heads/main', 3, 'trusted main-tip checks');
  requireAtLeast('== "$ROLLBACK_CONFIG_SHA256" ]]', 2, 'rollback config digest checks');
  requireAtLeast('assert_topology', 3, 'repeated topology checks');
  requireAtLeast('assert_secret_name_boundary', 3, 'repeated names-only secret checks');

  if (kind === 'prepare') {
    requireStepText(
      finalStepName,
      'config="$GITHUB_WORKSPACE/fly.rollback.production.toml"',
      'final default-branch rollback config path',
    );
    requireStepText(dispatchStepName, '[[ "$CONFIRMATION" == "PREPARE assesssuite-production COMPATIBILITY IMAGE AND VOLUME POLICY" ]]', 'explicit rollback-image and volume-policy confirmation');
    requireCount('io.assesssuite.rollback-proof', 2, 'rollback proof label creation and verification');
    requireCount('io.assesssuite.trusted-workflow', 2, 'rollback workflow label creation and verification');
    if (/\bfly deploy\b/.test(active)) fail('build-only rollback-image workflow contains a production deploy command');
    requireCount('docker push "$image_tag"', 1, 'single registry publication command');
    requireText('PRODUCTION_BASE_SHA: 183c8e47a0025ad311f5f6c1ea063c2feb430817', 'exact production-base revision');
    requireCount('PRODUCTION_BASE_SHA: 183c8e47a0025ad311f5f6c1ea063c2feb430817', 3, 'production-base revision uses');
    requireCount('npm audit --audit-level=moderate', 1, 'fail-closed dependency vulnerability audit');
    requireText('EXPECTED_RELEASE_SCANNER_SHA256: 1b34b794ab79f5ea022525f31bf70397c629ca0a16baf4320503c6cfdbd36c5c', 'trusted release-scanner digest');
    requireStepText('Build, typecheck differential, selftest, and rollback proof', 'node --test server/tests/production-startup.test.mjs', 'production-startup negative test');
    requireStepText('Build, typecheck differential, selftest, and rollback proof', 'npm run test:rollback-compatibility', 'rollback disabled-runtime compatibility proof execution');
    requireStepText('Build, typecheck differential, selftest, and rollback proof', 'npm run test:forward-rollback-compatibility >"$rollback_log"', 'forward/rollback shared-store proof execution');
    for (const marker of [
      'ROLLBACK_PROOF_REGISTERING_STATE',
      'ROLLBACK_PROOF_39_FIELD_PER_FILE_MERGE',
      'ROLLBACK_PROOF_AGE_QUARANTINE',
      'ROLLBACK_PROOF_REFERRAL_COMMIT_RECEIPT_REPLAY',
    ]) requireAtLeast(marker, 2, `rollback proof marker ${marker}`);
    requireStepText(finalStepName, '[[ "${#local_repo_digests[@]}" -eq 1 ]]', 'single local RepoDigest guard');
    requireStepText(finalStepName, '[[ "${local_repo_digests[0]}" == "$image_ref" ]]', 'local-to-remote digest binding');
    requireStepText(finalStepName, 'Production deployment performed: no', 'explicit no-deploy summary');
    requireStepText(finalStepName, '[[ "$post_release" == "$EXPECTED_CURRENT_RELEASE" ]]', 'post-publication release nonmutation');
    requireStepText(finalStepName, '[[ "$post_image" == "$EXPECTED_CURRENT_IMAGE" ]]', 'post-publication image nonmutation');
    requireStepText(finalStepName, 'assert_secret_name_boundary prepublication allow', 'build-only initial legacy-secret allowance');
    requireStepText(finalStepName, 'assert_secret_name_boundary postpublication allow', 'build-only final legacy-secret allowance');
    requireStepText(finalStepName, 'assert_topology prepolicy ignore', 'pre-mutation exact topology and encryption check');
    requireStepText(finalStepName, 'assert_topology prepublication exact', 'fresh post-mutation snapshot-policy check');
    requireStepText(finalStepName, 'assert_topology postpublication exact', 'post-publication snapshot-policy check');
    requireStepText(finalStepName, 'Production volume-policy mutation: exact five-day scheduled snapshots enforced and freshly verified', 'disclosed narrow volume-policy mutation');
    const enforcement = functionBody('enforce_volume_snapshot_policy', 'assert_secret_name_boundary');
    for (const needle of [
      'fly volumes update "$EXPECTED_VOLUME_ID"', '--snapshot-retention 5',
      '--scheduled-snapshots=true', 'volume.id !== process.env.EXPECTED_VOLUME_ID',
      'volume.attached_machine_id !== process.env.EXPECTED_MACHINE_ID',
      'volume.snapshot_retention !== 5', 'volume.auto_backup_enabled !== true',
      'volume.encrypted !== true',
    ]) if (!enforcement.includes(needle)) fail(`prepare volume-policy enforcement lacks ${needle}`);
    if (/^\s*return 0\s*$/m.test(enforcement) || enforcement.includes('&& false')) {
      fail('prepare volume-policy enforcement has a fail-open bypass');
    }
    requireCount('[[ "$(git ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]', 3, 'initial and pre/post-publication trusted-main freezes');
    const order = [
      'assert_topology prepolicy ignore',
      'assert_secret_name_boundary prepublication allow',
      '\n          enforce_volume_snapshot_policy\n',
      'assert_topology prepublication exact',
      'docker push "$image_tag"',
      'assert_topology postpublication exact',
      'assert_secret_name_boundary postpublication allow',
    ].map((needle) => finalActive.indexOf(needle));
    if (order.some((position) => position < 0) ||
        order.some((position, index) => index > 0 && position <= order[index - 1])) {
      fail('prepare workflow publication checks are not in the reviewed order');
    }
  } else {
    requireStepText(
      finalStepName,
      'rollback_config="$rollback_dir/fly.rollback.production.toml"',
      'final default-branch rollback config path',
    );
    requireStepText(dispatchStepName, '[[ "$CONFIRMATION" == "ROLLBACK assesssuite-production COMPATIBILITY IMAGE" ]]', 'explicit emergency rollback confirmation');
    requireStepText(dispatchStepName, '[[ "$INCIDENT_REFERENCE" =~ ^[A-Za-z0-9._:/-]{1,240}$ ]]', 'incident reference shape');
    requireCount('io.assesssuite.rollback-proof', 1, 'rollback proof label verification');
    requireCount('io.assesssuite.trusted-workflow', 1, 'rollback workflow label verification');
    if (/\bdocker push\b/.test(active)) fail('emergency rollback workflow may not publish a new image');
    requireCount('fly deploy "$rollback_dir"', 1, 'single emergency rollback deploy command');
    requireStepText(dispatchStepName, '[[ "$ROLLBACK_IMAGE" =~ ^registry\\.fly\\.io/assesssuite-production@sha256:[0-9a-f]{64}$ ]]', 'digest-only rollback image input');
    requireStepText(finalStepName, '--image "$ROLLBACK_IMAGE"', 'digest-pinned emergency rollback deploy');
    requireStepText(finalStepName, 'assert_secret_name_boundary final forbid', 'final secret-name drift check');
    requireStepText(finalStepName, 'fly secrets unset "${legacy_legal_secrets[@]}" --stage --app "$app"', 'legacy opaque legal-secret removal');
    requireStepText(finalStepName, "read_version 'https://assesssuite.com'", 'apex rollback version verification');
    requireStepText(finalStepName, "read_version 'https://assesssuite-production.fly.dev'", 'Fly-domain rollback version verification');
    requireStepText(finalStepName, "read_public_surface 'https://assesssuite.com' 'rollback-apex'", 'apex rollback public-surface verification');
    requireStepText(finalStepName, "read_public_surface 'https://assesssuite-production.fly.dev' 'rollback-fly'", 'Fly-domain rollback public-surface verification');
    requireCount('[[ "$(git -C "$rollback_dir" ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]', 2, 'preflight and final-predeploy trusted-main freezes');
    const order = [
      'assert_topology prior',
      'assert_secret_name_boundary initial allow',
      'fly secrets unset "${legacy_legal_secrets[@]}" --stage',
      'assert_topology final-predeploy',
      'assert_secret_name_boundary final forbid',
      'fly deploy "$rollback_dir"',
      'assert_topology rollback',
      'assert_secret_name_boundary postrollback forbid',
      "read_version 'https://assesssuite.com'",
      "read_public_surface 'https://assesssuite.com' 'rollback-apex'",
    ].map((needle) => finalActive.indexOf(needle));
    if (order.some((position) => position < 0) ||
        order.some((position, index) => index > 0 && position <= order[index - 1])) {
      fail('emergency rollback checks and deploy are not in the reviewed order');
    }
  }

  return failures;
}

function replaceOnce(source, from, to, label) {
  const count = countOf(source, from);
  if (count !== 1) throw new Error(`mutation ${label} expected one target, found ${count}`);
  return source.replace(from, to);
}

function auxMutationCases(source, kind) {
  const cases = [];
  const replace = (name, from, to) => cases.push({
    name,
    mutate: (value) => replaceOnce(value, from, to, name),
  });
  const shadow = (name, from, weakened) => replace(
    name,
    from,
    `${weakened}\n          # ${from.trim()}`,
  );

  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  contents: read', 'permissions:\n  contents: write');
  replace('action-unpinned', 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0', 'actions/checkout@main');
  replace(
    'trusted-parity-validator-removed',
    '            production-parity-assurance.yml; do',
    '            production-rollback.yml; do',
  );
  if (kind === 'prepare') {
    replace(
      'dependency-audit-removed',
      '      - name: Fail-closed dependency vulnerability audit\n        run: npm audit --audit-level=moderate',
      '      - name: Fail-closed dependency vulnerability audit\n        run: true',
    );
  }
  replace(
    'duplicate-fly-token',
    '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}',
    '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          SECOND_TOKEN: ${{ secrets.FLY_API_TOKEN }}',
  );
  replace(
    'duplicate-topology-function-override',
    '          assert_topology() {',
    '          assert_topology() { return 0; }\n\n          assert_topology() {',
  );
  replace(
    'enable-shell-trace',
    '          set +x\n          app=assesssuite-production',
    '          set -x\n          app=assesssuite-production',
  );
  shadow('shadow-workflow-sha', '          [[ "$WORKFLOW_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$WORKFLOW_SHA" ]]');
  shadow('shadow-event-sha', '          [[ "$EVENT_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$EVENT_SHA" ]]');
  shadow('shadow-rollback-main-branch', '          [[ "$ROLLBACK_SOURCE_BRANCH" == "main" ]]', '          [[ -n "$ROLLBACK_SOURCE_BRANCH" ]]');
  shadow('shadow-rollback-workflow-sha-identity', '          [[ "$ROLLBACK_SOURCE_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$ROLLBACK_SOURCE_SHA" ]]');
  if (kind === 'rollback') {
    shadow('shadow-failed-application-workflow-sha-identity', '          [[ "$FAILED_APPLICATION_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$FAILED_APPLICATION_SHA" ]]');
  }
  replace(
    'seed-denylist-removed',
    '|npm[[:space:]]+run[[:space:]]+seed|synthetic data reseeds on every boot',
    '|synthetic data reseeds on every boot',
  );
  replace(
    'fly-process-bootstrap-removed',
    '          [[ "$(grep -Fxc \'  app = "node server/productionBootstrap.mjs && exec node server/index.mjs"\' "$config")" -eq 1 ]]',
    '          [[ "$(grep -Fxc \'  app = "node server/index.mjs"\' "$config")" -eq 1 ]]',
  );
  const imageVariable = kind === 'prepare' ? 'image' : 'ROLLBACK_IMAGE';
  replace(
    'catalogue-command-removed',
    `          [[ "$(docker image inspect "$${imageVariable}" --format '{{json .Config.Cmd}}')" == '["sh","-c","node server/productionBootstrap.mjs && exec node server/index.mjs"]' ]]`,
    '          true',
  );
  replace(
    'topology-machine-identity-removed',
    '          if (machine.id !== process.env.EXPECTED_MACHINE_ID || !/^[0-9a-f]{14,32}$/.test(machine.id) ||',
    '          if (!/^[0-9a-f]{14,32}$/.test(machine.id) ||',
  );
  replace(
    'topology-size-assertion-disabled',
    "              volume.region !== 'syd' || volume.state !== 'created' || volume.size_gb !== 3 ||",
    "              volume.region !== 'syd' || volume.state !== 'created' || (volume.size_gb !== 3 && false) ||",
  );
  const topologyEncryption = kind === 'prepare'
    ? '              volume.encrypted !== true || volume.attached_machine_id !== machine.id) {'
    : '              volume.encrypted !== true || volume.attached_machine_id !== machine.id ||';
  replace(
    'topology-encryption-removed',
    topologyEncryption,
    topologyEncryption.replace('volume.encrypted !== true || ', ''),
  );
  replace(
    'secret-values-allowed',
    '                Object.keys(row).some((key) => /^(?:value|raw_value|secret_value)$/i.test(key))) {',
    '                false) {',
  );
  replace(
    'proof-label-removed',
    `          [[ "$(docker image inspect "$${imageVariable}" --format '{{ index .Config.Labels "io.assesssuite.rollback-proof" }}')" == 'registering-state+39-field-per-file-merge+age-quarantine+referral-commit-receipt-replay' ]]`,
    '          true',
  );

  if (kind === 'prepare') {
    replace(
      'rollback-config-path-reverted',
      '          config=fly.rollback.production.toml',
      '          config=fly.production.toml',
    );
    replace(
      'topology-scheduled-policy-disabled',
      '            if (volume.snapshot_retention !== 5 || volume.auto_backup_enabled !== true) {',
      '            if ((volume.snapshot_retention !== 5 && false) || volume.auto_backup_enabled !== true) {',
    );
    replace(
      'volume-policy-enforcement-early-success',
      '          enforce_volume_snapshot_policy() {\n            local update_json=',
      '          enforce_volume_snapshot_policy() {\n            return 0\n            local update_json=',
    );
    replace(
      'volume-policy-wrong-target',
      '            timeout --signal=TERM --kill-after=10s 60s fly volumes update "$EXPECTED_VOLUME_ID" \\',
      '            timeout --signal=TERM --kill-after=10s 60s fly volumes update "$EXPECTED_MACHINE_ID" \\',
    );
    replace(
      'volume-policy-scheduled-disabled',
      '              --scheduled-snapshots=true \\',
      '              --scheduled-snapshots=false \\',
    );
    replace(
      'inject-production-deploy',
      '          if ! push_output="$(timeout --signal=TERM --kill-after=30s 600s docker push "$image_tag" 2>&1)"; then',
      '          fly deploy --app assesssuite-production --yes\n          if ! push_output="$(timeout --signal=TERM --kill-after=30s 600s docker push "$image_tag" 2>&1)"; then',
    );
    replace(
      'scanner-pin-mutated',
      '          EXPECTED_RELEASE_SCANNER_SHA256: 1b34b794ab79f5ea022525f31bf70397c629ca0a16baf4320503c6cfdbd36c5c',
      `          EXPECTED_RELEASE_SCANNER_SHA256: ${'0'.repeat(64)}`,
    );
    replace(
      'proof-test-removed',
      '          npm run test:forward-rollback-compatibility >"$rollback_log"',
      '          true >"$rollback_log"',
    );
    replace(
      'post-release-check-removed',
      '          [[ "$post_release" == "$EXPECTED_CURRENT_RELEASE" ]]',
      '          true',
    );
    replace(
      'repodigest-check-removed',
      '          [[ "${local_repo_digests[0]}" == "$image_ref" ]]',
      '          true',
    );
  } else {
    replace(
      'rollback-config-path-reverted',
      '          config="$source_dir/fly.rollback.production.toml"',
      '          config="$source_dir/fly.production.toml"',
    );
    replace(
      'topology-scheduled-policy-disabled',
      '              volume.snapshot_retention !== 5 || volume.auto_backup_enabled !== true) {',
      '              (volume.snapshot_retention !== 5 && false) || volume.auto_backup_enabled !== true) {',
    );
    replace(
      'inject-image-push',
      '          timeout --signal=TERM --kill-after=30s 300s docker pull "$ROLLBACK_IMAGE"',
      '          docker push "$ROLLBACK_IMAGE"\n          timeout --signal=TERM --kill-after=30s 300s docker pull "$ROLLBACK_IMAGE"',
    );
    replace(
      'mutable-rollback-image',
      '            --image "$ROLLBACK_IMAGE" \\',
      '            --image registry.fly.io/assesssuite-production:latest \\',
    );
    replace(
      'final-secret-check-removed',
      '          assert_secret_name_boundary final forbid',
      '          true',
    );
    replace(
      'final-main-check-removed',
      '          # Final just-in-time freeze immediately before the sole application mutation.\n' +
        '          [[ "$(git -C "$rollback_dir" rev-parse --verify \'HEAD^{commit}\')" == "$ROLLBACK_SOURCE_SHA" ]]\n' +
        '          [[ "$(git -C "$rollback_dir" ls-remote --exit-code origin "refs/heads/$ROLLBACK_SOURCE_BRANCH" | awk \'NR == 1 { print $1 }\')" == "$ROLLBACK_SOURCE_SHA" ]]\n' +
        '          [[ "$(git -C "$rollback_dir" ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]',
      '          # Final just-in-time freeze immediately before the sole application mutation.\n          true',
    );
    replace(
      'public-surface-check-removed',
      "          if ! read_public_surface 'https://assesssuite.com' 'rollback-apex' \\",
      '          if false \\',
    );
  }
  return cases;
}

function deployMutationCases(source) {
  const cases = [];
  const replace = (name, from, to) => cases.push({ name, mutate: (value) => replaceOnce(value, from, to, name) });
  const shadow = (name, from, weakened) => replace(name, from, weakened + '\n          # ' + from.trim());

  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  contents: read', 'permissions:\n  contents: write');
  shadow('actor-bypass', '          [[ "$ACTOR" == "mbvidler-ctrl" ]]', '          [[ -n "$ACTOR" ]]');
  shadow('workflow-sha-bypass', '          [[ "$WORKFLOW_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$WORKFLOW_SHA" ]]');
  replace('publish-needs-gates-removed', '    needs: gates\n    runs-on: ubuntu-24.04', '    runs-on: ubuntu-24.04');
  replace('compat-needs-publish-removed', '    needs: [gates, publish_image]', '    needs: gates');
  replace('deploy-needs-compat-removed', '    needs: [gates, publish_image, exact_image_compatibility]', '    needs: [gates, publish_image]');
  replace('jobs-merged-publish-compat', '\n  exact_image_compatibility:\n', '\n  exact_image_compatibility_merged:\n');
  replace('jobs-merged-compat-deploy', '\n  deploy:\n', '\n  deploy_merged:\n');
  replace('publish-checkout-injected', '      - name: Validate and load candidate image as data only', '      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n      - name: Validate and load candidate image as data only');
  replace('publish-npm-injected', '          docker tag "$local_image" "$new_image_tag"', '          npm ci\n          docker tag "$local_image" "$new_image_tag"');
  replace('publish-docker-build-injected', '          docker tag "$local_image" "$new_image_tag"', '          docker build .\n          docker tag "$local_image" "$new_image_tag"');
  replace('publish-docker-run-injected', '          docker tag "$local_image" "$new_image_tag"', '          docker run "$local_image"\n          docker tag "$local_image" "$new_image_tag"');
  replace('publish-fly-deploy-injected', '          docker tag "$local_image" "$new_image_tag"', '          fly deploy .\n          docker tag "$local_image" "$new_image_tag"');
  replace(
    'publish-default-docker-config',
    '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config',
    '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          DOCKER_CONFIG: ~/.docker',
  );
  replace('publish-auth-cleanup-removed', '          rm -rf "$DOCKER_CONFIG"', '          true');
  replace('publish-fly-token-leaks-into-push', '          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config\n          APPLICATION_SHA:', '          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          APPLICATION_SHA:');
  replace(
    'publish-bundle-download-by-name',
    '      - name: Download exact gated candidate by immutable artifact ID\n        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0\n        with:\n          artifact-ids: ${{ needs.gates.outputs.candidate_image_artifact_id }}',
    '      - name: Download exact gated candidate by mutable artifact name\n        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0\n        with:\n          name: candidate-image',
  );
  replace('publish-bundle-artifact-id-output-removed', '      publication_artifact_id: ${{ steps.upload_publication.outputs.artifact-id }}', '      publication_artifact_id: missing');
  replace(
    'compat-secret-expression-injected',
    '        working-directory: candidate\n        env:\n          APPLICATION_SHA: ${{ needs.gates.outputs.application_sha }}\n          SOURCE_BRANCH:',
    '        working-directory: candidate\n        env:\n          APPLICATION_SHA: ${{ needs.gates.outputs.application_sha }}\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          SOURCE_BRANCH:',
  );
  replace(
    'compat-fly-auth-injected',
    '          [[ -z "${FLY_API_TOKEN:-}" ]]\n          if env | grep -Eq \'^(FLY_API_TOKEN|DOCKER_AUTH_CONFIG)=\'; then exit 1; fi\n          publication=',
    '          fly auth docker\n          [[ -z "${FLY_API_TOKEN:-}" ]]\n          if env | grep -Eq \'^(FLY_API_TOKEN|DOCKER_AUTH_CONFIG)=\'; then exit 1; fi\n          publication=',
  );
  replace('compat-docker-pull-injected', '          gzip -dc "$RUNNER_TEMP/candidate-image/candidate-image.tar.gz" | docker load >/dev/null', '          docker pull "$CANDIDATE_IMAGE_REF"\n          gzip -dc "$RUNNER_TEMP/candidate-image/candidate-image.tar.gz" | docker load >/dev/null');
  replace('compat-bundle-id-binding-removed', '          artifact-ids: ${{ needs.publish_image.outputs.publication_artifact_id }}', '          name: publication');
  replace('compat-candidate-digest-binding-removed', "['candidate_image_ref',e.CANDIDATE_IMAGE_REF]", "['candidate_image_ref',row.candidate_image_ref]");
  replace('compat-rollback-digest-binding-removed', "['rollback_image_ref',e.ROLLBACK_IMAGE]", "['rollback_image_ref',row.rollback_image_ref]");
  replace('compat-receipt-size-weakened', '"$(wc -c <"$publication")" -le 8192', '"$(wc -c <"$publication")" -le 999999');
  replace(
    'compat-receipt-extra-keys-allowed',
    "if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(keys)) throw new Error('Publication receipt keys differ');",
    "if (false) throw new Error('Publication receipt keys differ');",
  );
  replace('compat-marker-count-weakened', '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -eq 1 ]]', '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -ge 1 ]]');
  replace('compat-receipt-application-sha-removed', "['application_sha',e.APPLICATION_SHA]", "['application_sha',row.application_sha]");
  replace('compat-receipt-broad-upload-path', '          path: ${{ runner.temp }}/compatibility/compatibility-receipt.json', '          path: ${{ runner.temp }}/all-files');
  replace('deploy-checkout-injected', '    steps:\n      - name: Record the rollback-reserved deployment-job deadline', '    steps:\n      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n      - name: Record the rollback-reserved deployment-job deadline');
  replace('deploy-npm-injected', '          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"', '          npm ci\n          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"');
  replace('deploy-docker-injected', '          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"', '          docker run candidate\n          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"');
  replace('deploy-receipt-download-by-name', '          artifact-ids: ${{ needs.exact_image_compatibility.outputs.compatibility_artifact_id }}', '          name: compatibility');
  replace('deploy-receipt-sha-check-removed', '!/^[0-9a-f]{64}$/.test(row.publication_receipt_sha256)', 'false');
  replace('deploy-receipt-image-ref-check-removed', "['candidate_image_ref',env.CANDIDATE_IMAGE_REF]", "['candidate_image_ref',row.candidate_image_ref]");
  replace('deploy-control-artifact-id-check-removed', '[[ "$RELEASE_CONTROL_ARTIFACT_ID" =~ ^[1-9][0-9]*$', '[[ -n "$RELEASE_CONTROL_ARTIFACT_ID" && "$RELEASE_CONTROL_ARTIFACT_ID" =~ ^[1-9][0-9]*$');
  const injectedCredentialAssignment = [
    '          FLY_API_',
    'TOKEN="',
    '${FLY_API_TOKEN:-injected}',
    '"\n          [[ -n "$FLY_API_TOKEN" ]]\n          if env | grep -Eq \'^(FLY_API_TOKEN|DOCKER_AUTH_CONFIG)=\'; then exit 1; fi\n          control=',
  ].join('');
  replace(
    'deploy-secret-before-receipt-check',
    '          [[ -z "${FLY_API_TOKEN:-}" ]]\n          if env | grep -Eq \'^(FLY_API_TOKEN|DOCKER_AUTH_CONFIG)=\'; then exit 1; fi\n          control=',
    injectedCredentialAssignment,
  );
  replace(
    'deploy-empty-context-replaced-with-candidate-dir',
    'fly deploy "$deploy_source_dir" \\\n            --config "$candidate_config"',
    'fly deploy "$GITHUB_WORKSPACE/candidate" \\\n            --config "$candidate_config"',
  );
  replace('deploy-skip-release-command-removed', '              --skip-release-command \\\n', '');
  replace('deploy-remote-only-removed', '              --remote-only \\\n', '');
  replace('deploy-mutable-tag', 'candidate_image_ref="$CANDIDATE_IMAGE_REF"', 'candidate_image_ref="registry.fly.io/assesssuite-production:latest"');
  replace('secret-allowlist-extra-app-key', "            'OPENAI_API_KEY',\n          ];", "            'OPENAI_API_KEY', 'UPLOAD_AUDIT_LEGAL_HOLD',\n          ];");
  replace('validator-pin-mutated', '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + '0'.repeat(64));
  return cases;
}

const EXPECTED_PARITY_STEPS = [
  'Validate trusted parity dispatch and fixed mission inputs',
  'Check out exact application and workflow SHA',
  'Verify exact main provenance and frozen parity artefacts',
  'Set up Node.js 24',
  'Validate the exact trusted production workflow control',
  'Download exact predecessor receipt',
  'Validate predecessor receipt and exact effect sequence',
  'Install locked dependencies and pinned Chromium for browser wave',
  'Install checksum-verified flyctl 0.4.71',
  'Execute exactly one secret-bearing parity effect',
  'Upload content-free parity receipt',
  'Upload bounded synthetic screenshots only',
];

function validateParityWorkflow(input) {
  const failures = [];
  const source = normalized(input);
  const active = withoutCommentOnlyLines(source);
  const fail = (message) => failures.push(message);
  const requireText = (needle, label = needle) => {
    if (!active.includes(needle)) fail('missing ' + label);
  };
  const jobBody = (name) => {
    const marker = '\n  ' + name + ':\n';
    const start = source.indexOf(marker);
    if (start < 0) {
      fail('missing parity job ' + name);
      return '';
    }
    const rest = source.slice(start + marker.length);
    const next = rest.search(/\n  [a-z0-9_]+:\n/);
    return marker + (next < 0 ? rest : rest.slice(0, next));
  };
  const stepsIn = (body) => [...body.matchAll(/^      - name: ([^\n]+)$/gm)].map((match) => match[1].trim());
  const expectSteps = (job, expected) => {
    const actual = stepsIn(jobBody(job));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(job + ' parity step sequence differs: ' + JSON.stringify(actual));
  };

  if (source.includes('\t')) fail('parity workflow contains a literal tab');
  if (!source.endsWith('\n')) fail('parity workflow must end with one LF newline');
  const trigger = source.slice(source.indexOf('\non:\n') + 1, source.indexOf('\npermissions:\n'));
  if (!trigger.startsWith('on:\n  workflow_dispatch:\n')) fail('parity workflow is not manual-dispatch only');
  for (const forbidden of ['push:', 'pull_request:', 'pull_request_target:', 'schedule:', 'workflow_call:', 'workflow_run:', 'repository_dispatch:']) {
    if (withoutCommentOnlyLines(trigger).includes(forbidden)) fail('forbidden parity trigger ' + forbidden);
  }
  requireText('permissions:\n  actions: read\n  contents: read', 'parity read-only permissions');
  requireText('group: assesssuite-production\n  cancel-in-progress: false', 'shared production concurrency');
  requireText('EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, 'exact trusted parity validator digest');

  const jobsSource = source.slice(source.indexOf('\njobs:\n') + 6);
  const jobs = [...jobsSource.matchAll(/^  ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  if (JSON.stringify(jobs) !== JSON.stringify(['prepare', 'effect'])) fail('parity job sequence differs: ' + JSON.stringify(jobs));
  const prepare = withoutCommentOnlyLines(jobBody('prepare'));
  const effect = withoutCommentOnlyLines(jobBody('effect'));
  if (!effect.includes('needs: prepare')) fail('parity effect does not require fresh preparation');
  if (!prepare.includes('runs-on: ubuntu-24.04') || !effect.includes('runs-on: ubuntu-24.04')) fail('parity jobs do not use exact fresh runners');

  expectSteps('prepare', [
    'Validate trusted parity dispatch and fixed mission inputs',
    'Check out exact application and workflow SHA',
    'Verify exact main provenance and frozen parity artefacts',
    'Set up Node.js 24',
    'Validate the exact trusted production workflow control',
    'Download exact predecessor receipt',
    'Validate predecessor receipt and exact effect sequence',
    'Build hardened parity browser image without Fly credentials',
    'Upload hardened parity browser image',
  ]);
  expectSteps('effect', [
    'Download hardened parity browser image by immutable artifact ID',
    'Validate and load parity browser image as data only',
    'Install checksum-verified flyctl 0.4.71',
    'Execute exactly one secret-bearing parity effect',
    'Upload content-free parity receipt',
    'Upload bounded synthetic screenshots only',
  ]);

  const uses = [...active.matchAll(/^\s+uses:\s+([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]);
  if (uses.length !== 7) fail('expected 7 pinned parity action uses, found ' + uses.length);
  for (const action of uses) if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(action)) fail('parity action is not pinned: ' + action);

  const dispatchInputs = [
    'trusted_workflow_sha','application_sha','action','wave_id','expected_live_release','live_image',
    'candidate_config_sha256','parity_runner_sha256','parity_fixture_sha256','parity_cleanup_sha256',
    'parity_namespace','expected_production_machine_id','expected_production_volume_id',
    'parity_machine_id','parity_volume_id','parity_private_ipv6','predecessor_action',
    'predecessor_run_id','predecessor_receipt_sha256','effect_intent_id','effect_evidence_id',
    'authority_reference','confirmation','cleanup_chain_ack',
  ];
  for (const inputName of dispatchInputs) {
    const found = countOf(withoutCommentOnlyLines(trigger), '      ' + inputName + ':');
    if (found !== 1) fail('parity dispatch input ' + inputName + ': expected 1, found ' + found);
  }
  const declared = [...withoutCommentOnlyLines(trigger).matchAll(/^      ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  if (JSON.stringify(declared.sort()) !== JSON.stringify([...dispatchInputs].sort())) fail('parity dispatch interface gained or lost an input');

  for (const needle of [
    '[[ "$REPOSITORY" == "mbvidler-ctrl/assesssuite_migration" ]]',
    '[[ "$ACTOR" == "mbvidler-ctrl" ]]', '[[ "$TRIGGERING_ACTOR" == "mbvidler-ctrl" ]]',
    '[[ "$EVENT_REF" == "refs/heads/main" ]]', '[[ "$APPLICATION_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]',
    '[[ "$PARITY_NAMESPACE" == "asr-r2-20260721" ]]',
    '[[ "$ACTION" =~ ^(volume-create|machine-create|provider-wave|namespace-cleanup|machine-delete|volume-delete)$ ]]',
  ]) if (!prepare.includes(needle)) fail('missing parity provenance/mission guard ' + needle);

  if (prepare.includes('${{ secrets.FLY_API_TOKEN }}')) fail('Fly token enters parity preparation');
  for (const needle of [
    'FROM mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48',
    'RUN npm ci --ignore-scripts', 'ENTRYPOINT ["node", "server/tests/production-parity-wave.mjs"]',
    'CMD ["run-wave"]', 'docker build --tag "assesssuite-parity-runner:$APPLICATION_SHA"',
    'docker save "$image" | gzip -1 -n',
    'parity_runner_artifact_id: ${{ steps.upload_runner.outputs.artifact-id }}',
    'parity_runner_artifact_digest: ${{ steps.upload_runner.outputs.artifact-digest }}',
  ]) if (!prepare.includes(needle)) fail('missing frozen parity runner boundary ' + needle);

  if (countOf(active, '${{ secrets.FLY_API_TOKEN }}') !== 1) fail('parity Fly token expression differs');
  if (effect.includes('actions/checkout@') || /(^|\n)\s*(npm|npx)\s/.test(effect) ||
      /\bnode\s+server\/tests\/production-parity-wave\.mjs\s+run-wave/.test(effect)) {
    fail('credentialed parity effect executes candidate code on the host');
  }
  for (const needle of [
    'artifact-ids: ${{ needs.prepare.outputs.parity_runner_artifact_id }}',
    'sha256sum --check --strict parity-runner.tar.gz.sha256',
    'docker image inspect "assesssuite-parity-runner:$APPLICATION_SHA"',
    'docker pull --platform linux/amd64 docker.io/library/node:24.4.1-bookworm-slim@sha256:36ae19f59c91f3303c7a648f07493fe14c4bd91320ac8d898416327bacf1bbfa',
  ]) if (!effect.includes(needle)) fail('missing parity image handoff ' + needle);

  const browserStart = effect.indexOf('timeout --signal=TERM --kill-after=30s 900s docker run --rm');
  const browserEnd = effect.indexOf('>"$RUNNER_TEMP/browser.raw"', browserStart);
  const browser = browserStart >= 0 && browserEnd > browserStart ? effect.slice(browserStart, browserEnd) : '';
  if (!browser) fail('hardened browser container command is absent');
  for (const needle of [
    '--network "$browser_network"', '--read-only', '--cap-drop ALL',
    '--security-opt no-new-privileges:true', '--pids-limit 512', '--memory 1g', '--cpus 1',
    '--user "$(id -u):$(id -g)"', '--tmpfs /tmp:rw,nosuid,nodev,size=512m',
    '--mount type=bind,source="$RUNNER_TEMP/parity-screenshots",target=/artifacts',
    '--env PARITY_BASE_URL=http://parity-proxy:48787', '--env PARITY_ARTIFACT_DIR=/artifacts',
    '--entrypoint node "$parity_runner_image" server/tests/production-parity-wave.mjs run-wave',
  ]) if (!browser.includes(needle)) fail('missing hardened browser control ' + needle);
  if (countOf(browser, '--mount ') !== 1 || /docker\.sock|--privileged|--network host|--pid=host|--ipc=host|GITHUB_|ACTIONS_|FLY_API_TOKEN/.test(browser)) {
    fail('browser container has an extra host, socket, network, namespace, or credential path');
  }

  for (const needle of [
    'docker network create --driver bridge --internal "$browser_network"',
    'docker network create --driver bridge "$control_network"',
    '--network "$control_network" --add-host host.docker.internal:host-gateway',
    'docker network connect --alias parity-proxy "$browser_network" "$relay_container"',
    "proxy_image='docker.io/library/node:24.4.1-bookworm-slim@sha256:36ae19f59c91f3303c7a648f07493fe14c4bd91320ac8d898416327bacf1bbfa'",
    'cleanup_browser_boundary() {', 'cleanup_browser_boundary',
  ]) if (!effect.includes(needle)) fail('missing loopback relay/container cleanup boundary ' + needle);
  if (countOf(effect, 'cleanup_browser_boundary') !== 3) fail('browser boundary cleanup is not invoked on both trap and successful wave paths');

  const exactEight = "'ADMIN_PASSWORD', 'APP_URL', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',\n            'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_ANNUAL',\n            'OPENAI_API_KEY'";
  if (!effect.includes(exactEight) || !effect.includes('JSON.stringify([...names].sort()) !== JSON.stringify([...expected].sort())')) fail('parity exact eight-name secret allowlist is absent');
  if (effect.includes('UPLOAD_AUDIT_LEGAL_HOLD')) fail('parity secret allowlist contains an unreviewed app-consumed key');

  for (const needle of [
    "row.parity_machine_id !== 'NOT-CREATED' || row.parity_private_ipv6 !== 'NOT-CREATED' || row.parity_volume_id !== 'NOT-CREATED'",
    "row.action === 'machine-delete' && ['PASS', 'FAILED'].includes(row.result)",
    "const retryDelete = row.action === 'machine-delete' && row.result === 'FAILED'",
    'assert_inventory failure-final volume-only NOT-CREATED "$current_volume_id" NOT-CREATED',
    'assert_inventory failure-final clean NOT-CREATED NOT-CREATED NOT-CREATED',
    'assert_inventory post volume-only NOT-CREATED "$current_volume_id" NOT-CREATED\n              current_machine_id=NOT-CREATED\n              current_private_ipv6=NOT-CREATED',
    'assert_inventory post clean NOT-CREATED NOT-CREATED NOT-CREATED\n              current_volume_id=NOT-CREATED',
    '[[ "$current_machine_id" == "NOT-CREATED" && "$current_private_ipv6" == "NOT-CREATED" && "$current_volume_id" == "NOT-CREATED" ]]',
  ]) if (!active.includes(needle)) fail('missing parity cleanup recovery/terminal receipt control ' + needle);

  for (const needle of [
    'fly proxy 48787:8787 "$current_private_ipv6" --app "$app" --bind-addr 127.0.0.1 --quiet',
    'fly machine exec "$current_machine_id" "$command" --app "$app"',
    '--volume "$current_volume_id:/app/server/data"',
    '--restart no --autostart=false --autostop=off --skip-dns-registration',
    '--size 3 --region syd --snapshot-retention 5 --scheduled-snapshots=true',
    'browser.mandatory_checkbox_count !== 1', 'browser.marketing_default_checked !== false',
    'browser.mandatory_review_presented !== true', 'observation.provider_requests !== 1',
    'observation.payment_attempts !== 0 || observation.clinical_writes !== 0 || observation.referral_commits !== 0',
    'observation.production_volume_path_accesses !== 0',
    'path: ${{ runner.temp }}/bounded-synthetic-screenshots/*.png',
  ]) requireText(needle, needle);

  for (const forbiddenArtifact of ['playwright-report', 'test-results', 'trace.zip', 'storageState', 'cookies.json', '*.log']) {
    if (active.includes(forbiddenArtifact)) fail('unbounded browser artifact is present: ' + forbiddenArtifact);
  }
  return failures;
}

function parityMutationCases(source) {
  const cases = [];
  const replace = (name, from, to) => cases.push({ name, mutate: (value) => replaceOnce(value, from, to, name) });
  const shadow = (name, from, weakened) => replace(name, from, weakened + '\n          # ' + from.trim());

  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  actions: read\n  contents: read', 'permissions:\n  actions: write\n  contents: write');
  replace('different-concurrency', 'group: assesssuite-production', 'group: assesssuite-production-parity');
  replace('extra-browser-image-dispatch-input', '      cleanup_chain_ack:\n', '      browser_image:\n        required: true\n        type: string\n      cleanup_chain_ack:\n');
  replace('effect-needs-prepare-removed', '    needs: prepare\n    runs-on: ubuntu-24.04', '    runs-on: ubuntu-24.04');
  replace('jobs-merged', '\n  effect:\n', '\n  effect_merged:\n');
  replace('unpinned-browser-base', 'mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48', 'mcr.microsoft.com/playwright:latest');
  replace(
    'unpinned-proxy-image',
    "proxy_image='docker.io/library/node:24.4.1-bookworm-slim@sha256:36ae19f59c91f3303c7a648f07493fe14c4bd91320ac8d898416327bacf1bbfa'",
    "proxy_image='docker.io/library/node:latest'",
  );
  replace(
    'prep-fly-secret',
    '      - name: Build hardened parity browser image without Fly credentials\n        if: ${{ inputs.action == \'provider-wave\' }}\n        shell: bash\n        env:\n          APPLICATION_SHA: ${{ inputs.application_sha }}\n          PARITY_RUNNER_SHA256:',
    '      - name: Build hardened parity browser image without Fly credentials\n        if: ${{ inputs.action == \'provider-wave\' }}\n        shell: bash\n        env:\n          APPLICATION_SHA: ${{ inputs.application_sha }}\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          PARITY_RUNNER_SHA256:',
  );
  replace(
    'mutable-runner-tag',
    'docker build --tag "assesssuite-parity-runner:$APPLICATION_SHA"',
    'docker build --tag "assesssuite-parity-runner:latest"',
  );
  replace('non-internal-browser-network', 'docker network create --driver bridge --internal "$browser_network"', 'docker network create --driver bridge "$browser_network"');
  replace(
    'browser-on-control-network',
    '--network "$browser_network" --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
    '--network "$control_network" --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
  );
  replace('proxy-dual-home-removed', '              docker network connect --alias parity-proxy "$browser_network" "$relay_container"\n', '');
  replace('host-runner-restored', '              timeout --signal=TERM --kill-after=30s 900s docker run --rm \\\n', '              node server/tests/production-parity-wave.mjs run-wave\n              timeout --signal=TERM --kill-after=30s 900s docker run --rm \\\n');
  replace(
    'browser-readonly-removed',
    '--network "$browser_network" --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
    '--network "$browser_network" --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
  );
  replace(
    'browser-caps-restored',
    '--network "$browser_network" --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
    '--network "$browser_network" --read-only --cap-add SYS_ADMIN --security-opt no-new-privileges:true \\\n                --pids-limit 512',
  );
  replace(
    'browser-no-new-privileges-removed',
    '--network "$browser_network" --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
    '--network "$browser_network" --read-only --cap-drop ALL --security-opt seccomp=unconfined \\\n                --pids-limit 512',
  );
  replace('browser-resource-limit-removed', '--pids-limit 512 --memory 1g --cpus 1', '--pids-limit -1');
  replace('browser-root-user', '--user "$(id -u):$(id -g)"', '--user 0:0');
  replace('browser-secret-injected', '--env HOME=/tmp --env NODE_ENV=production', '--env FLY_API_TOKEN --env HOME=/tmp --env NODE_ENV=production');
  replace('browser-extra-host-mount', '--mount type=bind,source="$RUNNER_TEMP/parity-screenshots",target=/artifacts', '--mount type=bind,source=/,target=/host --mount type=bind,source="$RUNNER_TEMP/parity-screenshots",target=/artifacts');
  replace('browser-docker-socket', '--mount type=bind,source="$RUNNER_TEMP/parity-screenshots",target=/artifacts', '--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock --mount type=bind,source="$RUNNER_TEMP/parity-screenshots",target=/artifacts');
  replace(
    'browser-host-network',
    '--network "$browser_network" --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
    '--network host --read-only --cap-drop ALL --security-opt no-new-privileges:true \\\n                --pids-limit 512',
  );
  replace('browser-loopback-restored', '--env PARITY_BASE_URL=http://parity-proxy:48787', '--env PARITY_BASE_URL=http://127.0.0.1:48787');
  replace('runner-subcommand-removed', '--entrypoint node "$parity_runner_image" server/tests/production-parity-wave.mjs run-wave', '--entrypoint node "$parity_runner_image" server/tests/production-parity-wave.mjs');
  replace('browser-receipt-not-stdout', '>"$RUNNER_TEMP/browser.raw" 2>"$RUNNER_TEMP/browser.stderr"', '>/dev/null 2>"$RUNNER_TEMP/browser.stderr"');
  replace('browser-cleanup-removed', '              cleanup_browser_boundary\n              rm -f "$RUNNER_TEMP/browser.stderr"', '              rm -f "$RUNNER_TEMP/browser.stderr"');
  replace('secret-allowlist-extra-app-key', "            'OPENAI_API_KEY',\n          ];", "            'OPENAI_API_KEY', 'UPLOAD_AUDIT_LEGAL_HOLD',\n          ];");
  replace('fresh-wave-absence-proof-removed', "            if (row.action === 'volume-delete' && (row.parity_machine_id !== 'NOT-CREATED' || row.parity_private_ipv6 !== 'NOT-CREATED' || row.parity_volume_id !== 'NOT-CREATED'))", '            if (false)');
  replace('machine-delete-retry-removed', "            const retryDelete = row.action === 'machine-delete' && row.result === 'FAILED'", '            const retryDelete = false && row.action === \'machine-delete\'');
  replace('volume-delete-failed-machine-absence-removed', "row.action === 'machine-delete' && ['PASS', 'FAILED'].includes(row.result)", "row.action === 'machine-delete' && row.result === 'PASS'");
  replace('failure-machine-absence-reconciliation-removed', '                if assert_inventory failure-final volume-only NOT-CREATED "$current_volume_id" NOT-CREATED >/dev/null 2>&1; then', '                if false; then');
  replace('terminal-machine-id-assignment-removed', '              current_machine_id=NOT-CREATED\n              current_private_ipv6=NOT-CREATED', '              true');
  replace('terminal-volume-id-assignment-removed', '              current_volume_id=NOT-CREATED\n              [[ "$current_machine_id"', '              true\n              [[ "$current_machine_id"');
  replace('terminal-three-absence-proof-removed', '[[ "$current_machine_id" == "NOT-CREATED" && "$current_private_ipv6" == "NOT-CREATED" && "$current_volume_id" == "NOT-CREATED" ]]', 'true');
  replace('provider-count-bypass', 'observation.provider_requests !== 1', 'false');
  replace('clinical-write-bypass', 'observation.clinical_writes !== 0', 'false');
  replace('production-volume-path-access-bypass', 'observation.production_volume_path_accesses !== 0', 'false');
  replace('browser-review-bypass', 'browser.mandatory_review_presented !== true', 'false');
  replace('browser-signup-checkbox-bypass', 'browser.mandatory_checkbox_count !== 1', 'false');
  replace('screenshot-wide-upload', 'path: ${{ runner.temp }}/bounded-synthetic-screenshots/*.png', 'path: ${{ runner.temp }}/all-files');
  replace('validator-pin-mutated', '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + '0'.repeat(64));
  return cases;
}

function validateDeployWorkflowV2(input) {
  const failures = [];
  const source = normalized(input);
  const active = withoutCommentOnlyLines(source);
  const fail = (message) => failures.push(message);
  const requireText = (needle, label = needle) => { if (!active.includes(needle)) fail('missing ' + label); };
  const triggerStart = source.indexOf('\non:\n');
  const permissionStart = source.indexOf('\npermissions:\n');
  const trigger = triggerStart >= 0 && permissionStart > triggerStart ? source.slice(triggerStart + 1, permissionStart) : '';
  const jobsStart = source.indexOf('\njobs:\n');
  const jobsSource = jobsStart >= 0 ? source.slice(jobsStart + 6) : '';
  const jobs = [...jobsSource.matchAll(/^  ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  const deployMarker = '\n  deploy:\n';
  const deployStart = source.indexOf(deployMarker);
  const deploy = deployStart >= 0 ? withoutCommentOnlyLines(source.slice(deployStart)) : '';
  const steps = [...deploy.matchAll(/^      - name: ([^\n]+)$/gm)].map((match) => match[1].trim());

  if (source.includes('\t')) fail('deploy workflow contains a literal tab');
  if (!source.endsWith('\n')) fail('deploy workflow must end with one LF newline');
  if (!trigger.startsWith('on:\n  workflow_dispatch:\n')) fail('deploy workflow is not manual-dispatch only');
  for (const forbidden of ['push:', 'pull_request:', 'pull_request_target:', 'schedule:', 'workflow_call:', 'workflow_run:', 'repository_dispatch:']) {
    if (withoutCommentOnlyLines(trigger).includes(forbidden)) fail('forbidden deploy trigger ' + forbidden);
  }
  requireText('permissions:\n  actions: read\n  contents: read', 'exact deploy read-only permissions');
  requireText('group: assesssuite-production\n  cancel-in-progress: false', 'shared production concurrency');
  requireText('EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, 'exact trusted deploy validator digest');
  if (JSON.stringify(jobs) !== JSON.stringify(['deploy'])) fail('deploy job sequence differs: ' + JSON.stringify(jobs));
  if (!deploy.includes('runs-on: ubuntu-24.04') || !deploy.includes('timeout-minutes: 90')) fail('deploy job runner or timeout differs');

  const expectedInputs = [
    'trusted_workflow_sha','application_sha','candidate_config_sha256','rollback_config_sha256',
    'expected_current_release','expected_current_image','expected_machine_id','expected_volume_id',
    'rollback_image','rollback_release_sha','extraction_runtime_mode','provider_terms_attestation',
    'provider_terms_evidence_id','under_age_zdr_runtime_mode','under_age_zdr_attestation',
    'under_age_zdr_evidence_id','capability_intent_id','authority_reference','preparation_run_id',
    'application_image_digest','deploy_bundle_artifact_id','deploy_bundle_artifact_digest',
    'deploy_bundle_manifest_sha256','confirmation',
  ];
  const declaredInputs = [...trigger.matchAll(/^      ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  if (declaredInputs.length > 25 || JSON.stringify(declaredInputs.sort()) !== JSON.stringify([...expectedInputs].sort())) {
    fail('deploy dispatch input interface differs or exceeds the GitHub 25-input ceiling');
  }
  const expectedSteps = [
    'Record the rollback-reserved deployment-job deadline',
    'Validate immutable production intent and successful preparation run',
    'Download bounded deploy bundle by immutable artifact ID',
    'Validate sealed controls and compatibility receipt before secret injection',
    'Install checksum-verified flyctl 0.4.71',
    'Final secret-bearing Fly release command and public verification',
  ];
  if (JSON.stringify(steps) !== JSON.stringify(expectedSteps)) fail('deploy step sequence differs: ' + JSON.stringify(steps));

  const actions = [...active.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)].map((match) => match[1]);
  if (actions.length !== 1) fail('deploy must use exactly one pinned cross-run download action');
  for (const action of actions) if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(action)) fail('deploy action is not SHA pinned: ' + action);
  if (countOf(active, '${{ secrets.FLY_API_TOKEN }}') !== 1 || countOf(active, '${{ secrets.') !== 1) fail('deploy has more than the one late Fly credential expression');
  if (deploy.includes('actions/checkout@') || /(^|\n)\s*(npm|npx|docker)\s/.test(deploy) ||
      /(^|\n)\s*node\s+(?:candidate|server|scripts)\//.test(deploy) || deploy.includes('working-directory:')) {
    fail('deploy job can execute candidate or repository code');
  }
  if (/(^|\n)\s+needs:/.test(deploy) || deploy.includes('needs.') || deploy.includes('CANDIDATE_IMAGE_REF: ${{ needs.publish_image')) fail('deploy retains an in-run or cyclic publication dependency');

  for (const needle of [
    'artifact-ids: ${{ inputs.deploy_bundle_artifact_id }}',
    'github-token: ${{ github.token }}', 'repository: mbvidler-ctrl/assesssuite_migration',
    'run-id: ${{ inputs.preparation_run_id }}', 'path: ${{ runner.temp }}/deploy-bundle',
    'same(row.path, \'.github/workflows/production-prepare-release.yml\', \'workflow path\')',
    "same(row.event, 'workflow_dispatch', 'event')", "same(row.status, 'completed', 'status')",
    "same(row.conclusion, 'success', 'conclusion')", "same(row.head_branch, 'main', 'branch')",
    "same(row.head_sha, process.env.APPLICATION_SHA, 'head SHA')", "same(row.actor?.login, 'mbvidler-ctrl', 'actor')",
    "same(row.triggering_actor?.login, 'mbvidler-ctrl', 'triggering actor')",
    "same(row.digest, process.env.DEPLOY_BUNDLE_ARTIFACT_DIGEST, 'digest')",
    "same(row.expired, false, 'expiry state')", "same(row.workflow_run?.id, process.env.PREPARATION_RUN_ID, 'run id')",
    "same(row.workflow_run?.head_sha, process.env.APPLICATION_SHA, 'head SHA')",
    'Number.isSafeInteger(row.id)', 'Number.isSafeInteger(row.run_attempt)',
  ]) requireText(needle, 'cross-run deploy handoff control ' + needle);

  for (const needle of [
    'expected_files=$\'candidate-build-receipt.json\\ncompatibility-receipt.json\\ndeploy-bundle-manifest.json\\nfly.production.toml\\nfly.rollback.production.toml\\npublication-receipt.json\'',
    '[[ "$actual_files" == "$expected_files" ]]', "stat -c '%F'", '[[ -f "$bundle/$file" && ! -L "$bundle/$file" ]]',
    '[[ "$(sha256sum "$manifest" | awk \'{print $1}\')" == "$DEPLOY_BUNDLE_MANIFEST_SHA256" ]]',
    'raw !== `${JSON.stringify(value)}\\n`', "same(manifest.schema_version, 'assesssuite.deploy-bundle-manifest.v1', 'Manifest schema')",
    "same(manifest.result, 'PASS', 'Manifest result')", "same(manifest.publication_run_id, e.PREPARATION_RUN_ID, 'Manifest run id')",
    "same(manifest.publication_run_attempt, e.PREPARATION_RUN_ATTEMPT, 'Manifest run attempt')",
    "same(manifest.candidate_image_ref, e.CANDIDATE_IMAGE_REF, 'Manifest candidate image ref')",
    "same(manifest.application_image_digest, e.APPLICATION_IMAGE_DIGEST, 'Manifest application image digest')",
    "same(manifest.publication_receipt_sha256, digest('publication-receipt.json'), 'Publication receipt hash')",
    "same(manifest.compatibility_receipt_sha256, digest('compatibility-receipt.json'), 'Compatibility receipt hash')",
    "['publication_receipt_sha256',manifest.publication_receipt_sha256]",
    'JSON.stringify(manifest.markers) !== JSON.stringify(markers)', 'BUILD_TIMESTAMP=${manifest.build_timestamp}',
  ]) requireText(needle, 'sealed deploy-bundle control ' + needle);
  requireText('CANDIDATE_IMAGE_REF: registry.fly.io/assesssuite-production@${{ inputs.application_image_digest }}', 'predeclared candidate digest reference');
  requireText('[[ "$CANDIDATE_IMAGE_REF" == "registry.fly.io/assesssuite-production@$APPLICATION_IMAGE_DIGEST" ]]', 'candidate digest/ref identity');
  requireText('[[ "$CONFIRMATION" == "DEPLOY assesssuite-production EXACT SHA" ]]', 'exact deployment confirmation');
  requireText('[[ "$reviewed_mode" == "$EXTRACTION_RUNTIME_MODE" ]]', 'deploy extraction-mode config binding');
  requireText('[[ "$reviewed_under_age_mode" == "$UNDER_AGE_ZDR_RUNTIME_MODE" ]]', 'deploy under-age config binding');

  const secretOffset = deploy.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const bundleOffset = deploy.indexOf('Validate sealed controls and compatibility receipt before secret injection');
  if (secretOffset < 0 || bundleOffset < 0 || secretOffset < bundleOffset) fail('Fly token is injected before sealed bundle verification');
  for (const needle of [
    '[[ -z "${FLY_API_TOKEN:-}" ]]', 'empty-deploy-context', 'fly deploy "$deploy_source_dir"',
    '--remote-only', '--skip-release-command', '--image "$candidate_image_ref"', '--image "$ROLLBACK_IMAGE"',
    'refs/heads/main', 'assert_secret_name_boundary initial allow', 'assert_secret_name_boundary final forbid',
    'assert_secret_name_boundary postrollback forbid',
  ]) requireText(needle, 'remote-only production control ' + needle);
  if (countOf(deploy, '--remote-only') !== 2 || countOf(deploy, '--skip-release-command') !== 2 ||
      countOf(deploy, 'fly deploy "$deploy_source_dir"') !== 2) fail('candidate and rollback are not both remote-only empty-context deploys');
  const exactEight = "'ADMIN_PASSWORD', 'APP_URL', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',\n            'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_ANNUAL',\n            'OPENAI_API_KEY'";
  if (!deploy.includes(exactEight) || deploy.includes('UPLOAD_AUDIT_LEGAL_HOLD')) fail('deploy exact application-secret allowlist differs');
  for (const forbidden of ['continue-on-error:', 'set -x', 'set -o xtrace', 'fly auth docker', 'registry.fly.io/assesssuite-production:latest']) {
    if (active.includes(forbidden)) fail('deploy contains forbidden fail-open/mutable/registry control ' + forbidden);
  }
  return failures;
}

function validatePrepareReleaseWorkflow(input) {
  const failures = [];
  const source = normalized(input);
  const active = withoutCommentOnlyLines(source);
  const fail = (message) => failures.push(message);
  const requireText = (needle, label = needle) => { if (!active.includes(needle)) fail('missing ' + label); };
  const jobBody = (name) => {
    const marker = '\n  ' + name + ':\n';
    const start = source.indexOf(marker);
    if (start < 0) { fail('missing prepare-release job ' + name); return ''; }
    const rest = source.slice(start + marker.length);
    const next = rest.search(/\n  [a-z0-9_]+:\n/);
    return withoutCommentOnlyLines(marker + (next < 0 ? rest : rest.slice(0, next)));
  };
  const stepsIn = (body) => [...body.matchAll(/^      - name: ([^\n]+)$/gm)].map((match) => match[1].trim());
  const trigger = source.slice(source.indexOf('\non:\n') + 1, source.indexOf('\npermissions:\n'));
  const jobsSource = source.slice(source.indexOf('\njobs:\n') + 6);
  const jobs = [...jobsSource.matchAll(/^  ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  const gates = jobBody('gates');
  const publish = jobBody('publish_image');
  const compatibility = jobBody('exact_image_compatibility');

  if (source.includes('\t')) fail('prepare-release workflow contains a literal tab');
  if (!source.endsWith('\n')) fail('prepare-release workflow must end with one LF newline');
  if (!trigger.startsWith('on:\n  workflow_dispatch:\n')) fail('prepare-release is not manual-dispatch only');
  for (const forbidden of ['push:', 'pull_request:', 'pull_request_target:', 'schedule:', 'workflow_call:', 'workflow_run:', 'repository_dispatch:']) {
    if (withoutCommentOnlyLines(trigger).includes(forbidden)) fail('forbidden prepare-release trigger ' + forbidden);
  }
  requireText('permissions:\n  contents: read', 'prepare-release read-only permissions');
  if (active.includes('permissions:\n  actions:') || active.includes('contents: write')) fail('prepare-release permissions exceed contents read');
  requireText('group: assesssuite-production\n  cancel-in-progress: false', 'shared production concurrency');
  requireText('EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, 'exact prepare-release validator digest');
  if (JSON.stringify(jobs) !== JSON.stringify(['gates','publish_image','exact_image_compatibility'])) fail('prepare-release job sequence differs: ' + JSON.stringify(jobs));
  if (!publish.includes('needs: gates') || !compatibility.includes('needs: [gates, publish_image]')) fail('prepare-release DAG differs');
  if (gates.includes('needs.publish_image') || gates.includes('CANDIDATE_IMAGE_REF:')) fail('gates illegally references downstream publication output');

  const expectedInputs = ['trusted_workflow_sha','application_sha','candidate_config_sha256','rollback_config_sha256','rollback_image','extraction_runtime_mode','provider_terms_attestation','provider_terms_evidence_id','under_age_zdr_runtime_mode','under_age_zdr_attestation','under_age_zdr_evidence_id','capability_intent_id','authority_reference','confirmation'];
  const declaredInputs = [...trigger.matchAll(/^      ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  if (JSON.stringify(declaredInputs.sort()) !== JSON.stringify([...expectedInputs].sort())) fail('prepare-release dispatch interface differs');
  requireText('[[ "$CONFIRMATION" == "PREPARE assesssuite-production EXACT SHA" ]]', 'exact preparation confirmation');
  requireText('[[ "$SOURCE_BRANCH" == "main" ]]', 'fixed main source branch');
  requireText('[[ "$ROLLBACK_SOURCE_BRANCH" == "main" ]]', 'fixed main rollback branch');
  requireText('ROLLBACK_SOURCE_SHA: ${{ inputs.application_sha }}', 'fixed rollback source SHA');

  const expectedGateSteps = [
    'Validate trusted dispatch context and inputs','Check out exact application SHA','Verify exact SHA and remote branch tip',
    'Set up Node.js 24','Validate Fly and Docker credential/topology boundary','Install locked dependencies',
    'Fail-closed dependency vulnerability audit','Validate the exact trusted workflow control',
    'Require the referral assurance entrypoints and reviewed canary code','Build','Typecheck against exact production-base differential',
    'Lint with exact legacy-baseline containment','Existing deterministic server and entry-guard gates','Existing seeded launch-gate suite',
    'Existing public-evidence service gates','Mission assurance aggregate','Rendered referral browser journey gate',
    'Secret and high-entropy diff scan','Build exact candidate image locally without credentials',
    'Preserve the exact gated candidate image','Preserve sealed release controls',
  ];
  const expectedPublishSteps = ['Download exact gated candidate by immutable artifact ID','Validate and load candidate image as data only','Install checksum-verified flyctl 0.4.71 for registry authentication only','Acquire isolated registry credential','Publish immutable image and seal compatibility bundle','Upload sealed publication receipt and rollback image data'];
  const expectedCompatibilitySteps = ['Check out exact candidate into the no-secret proof runner','Download exact candidate image by immutable artifact ID','Download exact publication bundle by immutable artifact ID','Set up Node.js 24 for isolated compatibility proof','Verify immutable handoff and run exact-image compatibility proof','Upload bounded compatibility proof receipt','Seal bounded deploy bundle from exact regular files','Upload bounded deploy bundle','Emit immutable publication summary'];
  if (JSON.stringify(stepsIn(gates)) !== JSON.stringify(expectedGateSteps)) fail('prepare-release gate steps differ');
  if (JSON.stringify(stepsIn(publish)) !== JSON.stringify(expectedPublishSteps)) fail('prepare-release publication steps differ');
  if (JSON.stringify(stepsIn(compatibility)) !== JSON.stringify(expectedCompatibilitySteps)) fail('prepare-release compatibility steps differ');

  const actions = [...active.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)].map((match) => match[1]);
  if (actions.length !== 12) fail('prepare-release pinned action count differs');
  for (const action of actions) if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(action)) fail('prepare-release action is not SHA pinned: ' + action);
  if (countOf(active, '${{ secrets.FLY_API_TOKEN }}') !== 1 || countOf(active, '${{ secrets.') !== 1) fail('prepare-release Fly credential expression differs');
  if (gates.includes('${{ secrets.') || compatibility.includes('${{ secrets.') || /(^|\n)\s+FLY_API_TOKEN:\s/.test(compatibility)) fail('secret enters gates or compatibility job');
  if (publish.includes('actions/checkout@') || /(^|\n)\s*(npm|npx)\s/.test(publish) ||
      /(^|\n)\s*docker\s+(?:build|run|create|start|exec)\b/.test(publish) || publish.includes('fly deploy ')) {
    fail('credentialed publication job can execute candidate code or mutate production');
  }
  if (countOf(publish, 'DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config') !== 2 ||
      !publish.includes('rm -rf "$DOCKER_CONFIG"') || !publish.includes('[[ ! -e "$DOCKER_CONFIG" ]]') ||
      publish.includes('DOCKER_CONFIG: ~/.docker')) fail('publication Docker credential isolation differs');
  const authOffset = publish.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const pushOffset = publish.indexOf('Publish immutable image and seal compatibility bundle');
  const credentialInputMarker = 'FLY_API_' + 'TOKEN:';
  if (authOffset < 0 || pushOffset < 0 || authOffset > pushOffset || publish.slice(pushOffset).includes(credentialInputMarker)) fail('Fly token leaks into publication processing');

  for (const needle of [
    'artifact-ids: ${{ needs.gates.outputs.candidate_image_artifact_id }}',
    'artifact-ids: ${{ needs.publish_image.outputs.publication_artifact_id }}',
    '[[ -z "${FLY_API_TOKEN:-}" ]]', 'npm run test:forward-rollback-compatibility',
    '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -eq 1 ]]',
    'release_control_artifact_id: process.env.RELEASE_CONTROL_ARTIFACT_ID',
    'release_control_artifact_digest: process.env.RELEASE_CONTROL_ARTIFACT_DIGEST',
  ]) if (!compatibility.includes(needle)) fail('prepare-release compatibility boundary missing ' + needle);
  for (const needle of [
    "schema_version: 'assesssuite.deploy-bundle-manifest.v1'", "result: 'PASS'",
    "expected_files=$'candidate-build-receipt.json\\ncompatibility-receipt.json\\ndeploy-bundle-manifest.json\\nfly.production.toml\\nfly.rollback.production.toml\\npublication-receipt.json'",
    '[[ "$actual_files" == "$expected_files" ]]', 'name: deploy-bundle-${{ needs.gates.outputs.application_sha }}',
    'retention-days: 3', 'path: ${{ runner.temp }}/deploy-bundle',
    'deploy_bundle_artifact_id: ${{ steps.upload_deploy_bundle.outputs.artifact-id }}',
    'deploy_bundle_artifact_digest: ${{ steps.upload_deploy_bundle.outputs.artifact-digest }}',
    'deploy_bundle_manifest_sha256: ${{ steps.bundle.outputs.deploy_bundle_manifest_sha256 }}',
    'APPLICATION_IMAGE_DIGEST: ${{ needs.publish_image.outputs.candidate_registry_digest }}',
    'application_image_digest: e.APPLICATION_IMAGE_DIGEST,',
  ]) if (!compatibility.includes(needle)) fail('prepare-release deploy-bundle boundary missing ' + needle);
  if (compatibility.includes('copy_regular candidate/server') || compatibility.includes('copy_regular candidate/src') || compatibility.includes('copy_regular candidate/scripts')) fail('deploy bundle can include application code');
  if (compatibility.includes('rollback-image.tar.gz') && compatibility.slice(compatibility.indexOf('Seal bounded deploy bundle')).includes('rollback-image.tar.gz')) fail('deploy bundle contains image archive data');
  if (active.includes('UPLOAD_AUDIT_LEGAL_HOLD') || active.includes('continue-on-error:') || active.includes('set -x') || active.includes('set -o xtrace')) fail('prepare-release has extra app secret or fail-open/logging control');
  return failures;
}

function deployMutationCasesV2(source) {
  const cases = [];
  const replace = (name, from, to) => cases.push({ name, mutate: (value) => replaceOnce(value, from, to, name) });
  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  actions: read\n  contents: read', 'permissions:\n  actions: write\n  contents: write');
  replace('input-interface-expanded', '      confirmation:\n', '      unsafe_override:\n        required: true\n        type: string\n      confirmation:\n');
  replace('extra-job', '\njobs:\n  deploy:\n', '\njobs:\n  unsafe:\n    runs-on: ubuntu-24.04\n  deploy:\n');
  replace('checkout-injected', '    steps:\n      - name: Record the rollback-reserved deployment-job deadline', '    steps:\n      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n      - name: Record the rollback-reserved deployment-job deadline');
  replace('npm-injected', '          set -euo pipefail\n          set +x\n          [[ "$REPOSITORY"', '          set -euo pipefail\n          npm ci\n          set +x\n          [[ "$REPOSITORY"');
  replace('docker-injected', '          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"', '          docker run candidate\n          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"');
  replace('in-run-needs-injected', '    runs-on: ubuntu-24.04\n', '    needs: publish_image\n    runs-on: ubuntu-24.04\n');
  replace('bundle-download-by-name', '          artifact-ids: ${{ inputs.deploy_bundle_artifact_id }}', '          name: deploy-bundle');
  replace('bundle-download-run-id-removed', '          run-id: ${{ inputs.preparation_run_id }}\n', '');
  replace('bundle-download-token-removed', '          github-token: ${{ github.token }}\n', '');
  replace('bundle-download-repository-changed', '          repository: mbvidler-ctrl/assesssuite_migration', '          repository: attacker/fork');
  replace('run-path-bypass', "          same(row.path, '.github/workflows/production-prepare-release.yml', 'workflow path');", '          true;');
  replace('run-success-bypass', "          same(row.conclusion, 'success', 'conclusion');", '          true;');
  replace('run-head-bypass', "          same(row.head_sha, process.env.APPLICATION_SHA, 'head SHA');", '          true;');
  replace('run-actor-bypass', "          same(row.actor?.login, 'mbvidler-ctrl', 'actor');", '          true;');
  replace('artifact-digest-bypass', "          same(row.digest, process.env.DEPLOY_BUNDLE_ARTIFACT_DIGEST, 'digest');", '          true;');
  replace('artifact-expiry-bypass', "          same(row.expired, false, 'expiry state');", '          true;');
  replace('artifact-run-bypass', "          same(row.workflow_run?.id, process.env.PREPARATION_RUN_ID, 'run id');", '          true;');
  replace('manifest-hash-bypass', '          [[ "$(sha256sum "$manifest" | awk \'{print $1}\')" == "$DEPLOY_BUNDLE_MANIFEST_SHA256" ]]', '          true');
  replace('bundle-file-set-bypass', '          [[ "$actual_files" == "$expected_files" ]]', '          true');
  replace('canonical-json-bypass', '            if (raw !== `${JSON.stringify(value)}\\n`) throw new Error(`${name} is not canonical single-object JSON`);', '            if (false) throw new Error(`${name} is not canonical single-object JSON`);');
  replace('manifest-candidate-ref-bypass', "          same(manifest.candidate_image_ref, e.CANDIDATE_IMAGE_REF, 'Manifest candidate image ref');", '          true;');
  replace('manifest-digest-bypass', "          same(manifest.application_image_digest, e.APPLICATION_IMAGE_DIGEST, 'Manifest application image digest');", '          true;');
  replace('publication-hash-link-bypass', "          same(manifest.publication_receipt_sha256, digest('publication-receipt.json'), 'Publication receipt hash');", '          true;');
  replace('compatibility-hash-link-bypass', "          same(manifest.compatibility_receipt_sha256, digest('compatibility-receipt.json'), 'Compatibility receipt hash');", '          true;');
  replace('run-attempt-link-bypass', "          same(manifest.publication_run_attempt, e.PREPARATION_RUN_ATTEMPT, 'Manifest run attempt');", '          true;');
  replace(
    'mutable-candidate-ref',
    '          PREPARATION_RUN_ID: ${{ inputs.preparation_run_id }}\n          CANDIDATE_IMAGE_REF: registry.fly.io/assesssuite-production@${{ inputs.application_image_digest }}',
    '          PREPARATION_RUN_ID: ${{ inputs.preparation_run_id }}\n          CANDIDATE_IMAGE_REF: registry.fly.io/assesssuite-production:latest',
  );
  replace('secret-injected-before-receipt', '          GH_TOKEN: ${{ github.token }}', '          GH_TOKEN: ${{ github.token }}\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  replace('remote-only-removed', '              --remote-only \\\n', '');
  replace('skip-release-command-removed', '              --skip-release-command \\\n', '');
  replace('empty-context-replaced', 'fly deploy "$deploy_source_dir" \\\n            --config "$candidate_config"', 'fly deploy "$GITHUB_WORKSPACE/candidate" \\\n            --config "$candidate_config"');
  replace('secret-allowlist-extra', "            'OPENAI_API_KEY',\n          ];", "            'OPENAI_API_KEY', 'UPLOAD_AUDIT_LEGAL_HOLD',\n          ];");
  replace('postrollback-secret-check-removed', '            if ! assert_secret_name_boundary postrollback forbid; then', '            if false; then');
  replace('validator-pin-mutated', '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + '0'.repeat(64));
  return cases;
}

function prepareReleaseMutationCases(source) {
  const cases = [];
  const replace = (name, from, to) => cases.push({ name, mutate: (value) => replaceOnce(value, from, to, name) });
  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  contents: read', 'permissions:\n  contents: write');
  replace('input-interface-expanded', '      confirmation:\n', '      unsafe_override:\n        required: true\n        type: string\n      confirmation:\n');
  replace('publish-needs-removed', '    needs: gates\n    runs-on: ubuntu-24.04', '    runs-on: ubuntu-24.04');
  replace('compatibility-needs-publish-removed', '    needs: [gates, publish_image]', '    needs: gates');
  replace('jobs-merged', '\n  exact_image_compatibility:\n', '\n  exact_image_compatibility_merged:\n');
  replace(
    'cyclic-gates-reference',
    '      - name: Validate trusted dispatch context and inputs\n        shell: bash\n        env:\n          TRUSTED_WORKFLOW_SHA: ${{ inputs.trusted_workflow_sha }}\n          APPLICATION_SHA: ${{ inputs.application_sha }}\n          CANDIDATE_CONFIG_SHA256:',
    '      - name: Validate trusted dispatch context and inputs\n        shell: bash\n        env:\n          TRUSTED_WORKFLOW_SHA: ${{ inputs.trusted_workflow_sha }}\n          APPLICATION_SHA: ${{ inputs.application_sha }}\n          CANDIDATE_IMAGE_REF: ${{ needs.publish_image.outputs.candidate_image_ref }}\n          CANDIDATE_CONFIG_SHA256:',
  );
  replace(
    'gates-secret-injected',
    '      - name: Validate trusted dispatch context and inputs\n        shell: bash\n        env:\n          TRUSTED_WORKFLOW_SHA: ${{ inputs.trusted_workflow_sha }}\n          APPLICATION_SHA:',
    '      - name: Validate trusted dispatch context and inputs\n        shell: bash\n        env:\n          TRUSTED_WORKFLOW_SHA: ${{ inputs.trusted_workflow_sha }}\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          APPLICATION_SHA:',
  );
  replace('publish-checkout-injected', '      - name: Download exact gated candidate by immutable artifact ID', '      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n      - name: Download exact gated candidate by immutable artifact ID');
  replace('publish-npm-injected', '          docker tag "$local_image" "$new_image_tag"', '          npm ci\n          docker tag "$local_image" "$new_image_tag"');
  replace('publish-docker-run-injected', '          docker tag "$local_image" "$new_image_tag"', '          docker run "$local_image"\n          docker tag "$local_image" "$new_image_tag"');
  replace('publish-fly-deploy-injected', '          docker tag "$local_image" "$new_image_tag"', '          fly deploy .\n          docker tag "$local_image" "$new_image_tag"');
  replace('publication-default-docker-config', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          DOCKER_CONFIG: ~/.docker');
  replace('publication-auth-cleanup-removed', '          rm -rf "$DOCKER_CONFIG"', '          true');
  replace('compatibility-secret-injected', '        working-directory: candidate\n        env:\n          APPLICATION_SHA:', '        working-directory: candidate\n        env:\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          APPLICATION_SHA:');
  replace('compatibility-marker-weakened', '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -eq 1 ]]', '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -ge 1 ]]');
  replace('bundle-file-set-bypass', '          [[ "$actual_files" == "$expected_files" ]]', '          true');
  replace('bundle-code-injected', '          copy_regular candidate/fly.production.toml fly.production.toml 65536', '          copy_regular candidate/server/index.mjs index.mjs 65536\n          copy_regular candidate/fly.production.toml fly.production.toml 65536');
  replace('bundle-retention-weakened', '          retention-days: 3', '          retention-days: 1');
  replace('bundle-upload-broadened', '          path: ${{ runner.temp }}/deploy-bundle', '          path: ${{ runner.temp }}');
  replace('manifest-candidate-digest-bypass', "            application_image_digest: e.APPLICATION_IMAGE_DIGEST,", "            application_image_digest: 'sha256:' + '0'.repeat(64),");
  replace('confirmation-weakened', '          [[ "$CONFIRMATION" == "PREPARE assesssuite-production EXACT SHA" ]]', '          [[ -n "$CONFIRMATION" ]]');
  replace('validator-pin-mutated', '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + '0'.repeat(64));
  return cases;
}

const workflowName = path.basename(workflowPath);
const workflowKind = workflowName === 'production-deploy.yml'
  ? 'deploy'
  : workflowName === 'production-prepare-release.yml'
    ? 'prepare_release'
  : workflowName === 'production-prepare-rollback-image.yml'
    ? 'prepare'
    : workflowName === 'production-rollback.yml'
      ? 'rollback'
      : workflowName === 'production-parity-assurance.yml'
        ? 'parity'
      : null;
if (!workflowKind) {
  process.stderr.write(`unsupported production workflow: ${workflowName}\n`);
  process.exit(1);
}

const validator = workflowKind === 'deploy'
  ? validateDeployWorkflowV2
  : workflowKind === 'prepare_release'
    ? validatePrepareReleaseWorkflow
  : workflowKind === 'parity'
    ? validateParityWorkflow
    : (input) => validateAuxWorkflow(input, workflowKind);
const baseFailures = validator(rawSource);
if (baseFailures.length) {
  process.stderr.write(`production ${workflowKind} workflow contract failed:\n- ${baseFailures.join('\n- ')}\n`);
  process.exit(1);
}

if (selftest) {
  const cases = workflowKind === 'deploy'
    ? deployMutationCasesV2(normalized(rawSource))
    : workflowKind === 'prepare_release'
      ? prepareReleaseMutationCases(normalized(rawSource))
    : workflowKind === 'parity'
      ? parityMutationCases(normalized(rawSource))
      : auxMutationCases(normalized(rawSource), workflowKind);
  const escaped = [];
  for (const testCase of cases) {
    const mutated = testCase.mutate(normalized(rawSource));
    if (validator(mutated).length === 0) escaped.push(testCase.name);
  }
  if (escaped.length) {
    process.stderr.write(`workflow mutation selftest failed; mutation(s) escaped:\n- ${escaped.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`production ${workflowKind} workflow mutation selftest passed (${cases.length}/${cases.length} rejected)\n`);
} else {
  process.stdout.write(`production ${workflowKind} workflow contract passed\n`);
}
