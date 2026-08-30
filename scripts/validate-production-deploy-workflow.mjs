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
const LIVE_PRODUCTION_BASE_SHA = '145958d895aef289b9652f850e32e237f2b62f70';
const TOML_PROCESS_CONTRACT_MARKERS = [
  'import tomllib',
  'def process_entries(value, path=()):',
  "if key == 'processes':",
  'entries.extend(process_entries(nested, next_path))',
  'entries.extend(process_entries(nested, path + (index,)))',
  'for raw_path in sys.argv[1:]:',
  "with path.open('rb') as stream:",
  'document = tomllib.load(stream)',
  'except (OSError, UnicodeError, tomllib.TOMLDecodeError) as error:',
  "process_entries(document) != [(('http_service', 'processes'), ['app'])]",
];
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
  ['scripts/scan-release-diff.mjs', '8eed6357833ba8430786192e2d6be1a2bbedab3153dfef684729549e307fad80'],
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
    'candidate_image_artifact_digest: sha256:${{ steps.upload_candidate.outputs.artifact-digest }}',
    'release_control_artifact_id: ${{ steps.upload_controls.outputs.artifact-id }}',
    'release_control_artifact_digest: sha256:${{ steps.upload_controls.outputs.artifact-digest }}',
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
  'Check out trusted rollback controls and complete history',
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
      'expected_current_image', 'expected_machine_id', 'expected_volume_id', 'expected_legacy_volume_id',
      'rollback_source_sha', 'rollback_source_branch', 'rollback_config_sha256',
      'rollback_image', 'capability_intent_id',
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
  requireStepText(dispatchStepName, '[[ "$ROLLBACK_SOURCE_BRANCH" == "main" ]]', 'rollback default-branch binding');
  if (kind === 'prepare') {
    requireStepText(dispatchStepName, '[[ "$ROLLBACK_SOURCE_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', 'rollback and workflow SHA identity');
  }
  if (kind === 'rollback') {
    requireStepText(dispatchStepName, '[[ "$EXPECTED_LEGACY_VOLUME_ID" =~ ^vol_[A-Za-z0-9]+$ ]]', 'legacy volume input shape');
    requireStepText(dispatchStepName, '[[ "$EXPECTED_VOLUME_ID" != "$EXPECTED_LEGACY_VOLUME_ID" ]]', 'active and legacy volume distinction');
    requireCount('EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}', 2, 'legacy volume input bindings');
    requireCount('ROLLBACK_RELEASE_SHA: ${{ inputs.rollback_source_sha }}', 2, 'derived rollback release SHA bindings');
    requireStepText(
      dispatchStepName,
      '[[ "$FAILED_APPLICATION_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]',
      'failed application and workflow SHA identity',
    );
    requireStepText(dispatchStepName, '[[ "$ROLLBACK_SOURCE_SHA" != "$FAILED_APPLICATION_SHA" ]]', 'strict ancestor rollback source distinction');
    requireStepText(
      verificationStepName,
      'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' "$config"',
      'rollback general clinical AI enabled posture',
    );
    requireStepText(
      verificationStepName,
      'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' "$config"',
      'rollback transcription disabled posture',
    );
  }

  const verificationControls = [
    ['refs/heads/main', 'initial trusted-main binding'],
    ['== "$TRUSTED_WORKFLOW_SHA" ]]', 'initial trusted-main equality'],
    ['== "$ROLLBACK_CONFIG_SHA256" ]]', 'initial rollback-config digest binding'],
    ['(server/)?seed\\.mjs', 'full seed entrypoint denylist'],
    ['npm[[:space:]]+run[[:space:]]+seed', 'npm seed command denylist'],
    ['synthetic data reseeds on every boot', 'full seed startup denylist'],
    ['server/productionBootstrap.mjs', 'catalogue-only bootstrap requirement'],
    ["python3 -I - \"$config\" <<'PY'", 'isolated semantic Fly process contract'],
    ['snapshot_retention = 5', 'five-day snapshot config'],
    ['scheduled_snapshots = true', 'scheduled snapshot config'],
    ['source = "assesssuite_data_r12"', 'active r12 volume mount source'],
    ['UPLOAD_AUDIT_RETENTION_DAYS = "730"', 'upload audit retention config'],
    ['UPLOAD_CLEANUP_INTERVAL_MINUTES = "1"', 'upload cleanup config'],
    ['fly.rollback.production.toml', 'default-branch rollback config path'],
  ];
  if (kind === 'prepare') verificationControls.unshift(['refs/heads/$ROLLBACK_SOURCE_BRANCH', 'initial rollback remote-tip binding']);
  if (kind === 'rollback') {
    verificationControls.push(['git -C "$source_dir" merge-base --is-ancestor "$ROLLBACK_SOURCE_SHA" "$FAILED_APPLICATION_SHA"', 'rollback ancestor proof']);
    verificationControls.push(['EXPECTED_APP_URL = "https://app.assesssuite.com"', 'exact application URL config']);
  }
  for (const [needle, label] of verificationControls) requireStepText(verificationStepName, needle, label);
  for (const marker of TOML_PROCESS_CONTRACT_MARKERS) {
    requireStepText(verificationStepName, marker, `semantic Fly process contract ${marker}`);
  }

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
    'machines.length !== 1', 'volumes.length !== 2',
    'machine.id !== process.env.EXPECTED_MACHINE_ID',
    "machine.state !== 'started'",
    'new Set(volumes.map((row) => row?.id)).size !== 2',
    'new Set(volumes.map((row) => row?.name)).size !== 2',
    "row?.name === 'assesssuite_data_r12'",
    "row?.name === 'assesssuite_data'",
    'volume.id !== process.env.EXPECTED_VOLUME_ID',
    "volume.name !== 'assesssuite_data_r12'",
    "volume.region !== 'syd'", "volume.state !== 'created'",
    'volume.size_gb !== 3', 'volume.encrypted !== true',
    'volume.attached_machine_id !== machine.id',
    'volume.snapshot_retention !== 5', 'volume.auto_backup_enabled !== true',
    "legacyVolume.name !== 'assesssuite_data'",
    kind === 'rollback'
      ? 'legacyVolume.id !== process.env.EXPECTED_LEGACY_VOLUME_ID'
      : '!/^vol_[A-Za-z0-9]+$/.test(legacyVolume.id)',
    "legacyVolume.region !== 'syd'", "legacyVolume.state !== 'created'",
    'legacyVolume.size_gb !== 3',
    'legacyVolume.encrypted !== true',
    'legacyVolume.attached_machine_id !== null', 'legacyVolume.attached_alloc_id !== null',
    'legacyVolume.snapshot_retention !== 5', 'legacyVolume.auto_backup_enabled !== true',
    'mounts.length !== 1', "mounts[0]?.path !== '/app/server/data'",
    'mounts[0]?.volume !== volume.id', 'mounts[0]?.name !== volume.name',
    'mounts[0]?.encrypted !== true',
    'mounts[0]?.size_gb !== 3',
  ]) if (!topology.includes(needle)) fail(`topology contract lacks ${needle}`);
  if (/^\s*return 0\s*$/m.test(topology) || topology.includes('&& false')) fail('topology function has a fail-open bypass');
  if (kind === 'rollback') {
    for (const needle of [
      'local command_timeout_seconds=${2:-60}',
      '[[ "$command_timeout_seconds" =~ ^([1-9]|[1-5][0-9]|60)$ ]] || return 1',
      'if ! timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
      'fly machines list --app "$app" --json',
      'fly volumes list --app "$app" --json',
      'local topology_status=0',
      "env -u FLY_API_TOKEN node --input-type=module <<'NODE' || topology_status=$?",
      'return "$topology_status"',
    ]) if (!topology.includes(needle)) fail(`rollback topology failure propagation lacks ${needle}`);
    if (countOf(topology, 'if ! timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"') !== 2 ||
        countOf(topology, 'return 1') < 2) {
      fail('rollback topology queries do not both propagate bounded failures explicitly');
    }
  }
  const releaseReader = functionBody('current_release', 'assert_topology');
  for (const needle of [
    'local command_timeout_seconds=${2:-60}',
    'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
    'fly machines list --app "$app" --json',
    "const completeStatuses = new Set(['complete', 'completed', 'success', 'succeeded']);",
    "const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled']);",
    'const seenVersions = new Set();',
    'const releases = rows.map((row) => {',
    "const match = /^v?([1-9][0-9]*)$/.exec(String(rawId));",
    "if (seenVersions.has(version)) throw new Error('Fly returned duplicate numeric release versions');",
    'const inProgress = row.InProgress ?? row.inProgress ?? row.in_progress;',
    "if (inProgress !== undefined && typeof inProgress !== 'boolean') {",
    "if (inProgress !== undefined && typeof inProgress !== 'boolean') {",
    'const completed = releases.filter((item) => completeStatuses.has(item.releaseStatus));',
    "if (completed.length === 0) throw new Error('Fly returned no completed release rows');",
    'const latest = completed.reduce((current, item) => item.version > current.version ? item : current);',
    "if (latest.inProgress === true) throw new Error('Latest completed Fly release is still marked in progress');",
    'for (const item of releases.filter((candidate) => candidate.version > latest.version)) {',
    'if (item.inProgress === true || !terminalFailureStatuses.has(item.releaseStatus)) {',
    'if (!Array.isArray(machines) || machines.length !== 1)',
    "if (machineId !== process.env.EXPECTED_MACHINE_ID || machineState !== 'started' ||",
    "registry !== 'registry.fly.io' || repository !== 'assesssuite-production'",
    "!/^sha256:[0-9a-f]{64}$/.test(String(digest))",
    'const configuredImage = machine.config?.image ?? machine.Config?.image;',
    'if (configuredImage !== immutableImage || releaseImage !== immutableImage)',
    'process.stdout.write(`v${latest.version}\\t${immutableImage}`);',
  ]) if (!releaseReader.includes(needle)) fail(`release/Machine binding lacks ${needle}`);
  for (const forbidden of [
    'fly image show ',
    '|| rows[0]',
    'const latest = completed[0]',
    'const latest = releases[0]',
    'if (![immutableImage, tagImage].filter(Boolean).includes(releaseImage))',
  ]) {
    if (releaseReader.includes(forbidden)) fail(`release/Machine binding retains stale control ${forbidden}`);
  }

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
  if (kind === 'rollback') {
    for (const needle of ["'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN'", "'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY'", "boundaryState = 'exact-eleven';"]) {
      if (!secrets.includes(needle)) fail(`rollback exact eleven-name secret boundary lacks ${needle}`);
    }
  }
  if (/^\s*return 0\s*$/m.test(secrets) || secrets.includes('&& false')) fail('secret boundary has a fail-open bypass');

  requireText('a782dceed173d215c000ab94e2b08623c22267edff6d90ebe3010b3f9b671dc2', 'pinned flyctl archive digest');
  requireText(
    'curl --fail --location --silent --show-error --max-time 120',
    'bounded flyctl archive download',
  );
  requireText("'[\"sh\",\"-c\",\"node server/productionBootstrap.mjs && exec node server/index.mjs\"]'", 'exact catalogue-only image command');
  requireText("'[\"docker-entrypoint.sh\"]'", 'exact image entrypoint');
  if (kind === 'prepare') {
    requireText('io.assesssuite.rollback-proof', 'rollback compatibility proof label');
    requireText('io.assesssuite.trusted-workflow', 'rollback build-workflow provenance label');
    requireText('registering-state+39-field-per-file-merge+age-quarantine+referral-commit-receipt-replay', 'complete rollback proof label value');
  } else {
    requireText('ref: ${{ inputs.trusted_workflow_sha }}', 'trusted rollback-control checkout');
    requireStepText(verificationStepName, '== "$TRUSTED_WORKFLOW_SHA" ]]', 'trusted rollback-control checkout identity');
    requireStepText(finalStepName, 'org.opencontainers.image.revision', 'rollback image OCI revision binding');
    requireStepText(finalStepName, 'read_version \'https://app.assesssuite.com\' "$FAILED_APPLICATION_SHA"', 'current version check before mutation');
    requireStepText(finalStepName, "'Exercise Physiology at its Clinical Best.'", 'pre-split landing marker');
    requireStepText(finalStepName, 'for route in legal/privacy login; do', 'legal and application route verification');
    requireStepText(finalStepName, 'assert_topology postrollback', 'postrollback r12 and detached-legacy topology verification');
    requireStepText(finalStepName, 'fly secrets set APP_URL=https://app.assesssuite.com --stage --app "$app"', 'exact application URL staged secret');
  }
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
    requireText('PRODUCTION_BASE_SHA: 6a8ec8d70d87d7b17bcb89e03a9fea4e2871b6d5', 'exact production-base revision');
    requireCount('PRODUCTION_BASE_SHA: 6a8ec8d70d87d7b17bcb89e03a9fea4e2871b6d5', 3, 'production-base revision uses');
    requireCount('node scripts/check-dependency-audit.mjs', 1, 'fail-closed dependency vulnerability audit');
    requireText('EXPECTED_RELEASE_SCANNER_SHA256: 8eed6357833ba8430786192e2d6be1a2bbedab3153dfef684729549e307fad80', 'trusted release-scanner digest');
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
      "volume.name !== 'assesssuite_data_r12'",
      'volume.snapshot_retention !== 5', 'volume.auto_backup_enabled !== true',
      'volume.encrypted !== true',
    ]) if (!enforcement.includes(needle)) fail(`prepare volume-policy enforcement lacks ${needle}`);
    if (/^\s*return 0\s*$/m.test(enforcement) || enforcement.includes('&& false')) {
      fail('prepare volume-policy enforcement has a fail-open bypass');
    }
    requireCount('[[ "$(timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]', 3, 'bounded initial and pre/post-publication trusted-main freezes');
    if (countOf(active, 'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin') !== 6) {
      fail('prepare rollback-image remote observations are not all bounded to 60 seconds');
    }
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
    if (!active.includes('timeout-minutes: 70')) fail('standalone rollback job timeout differs');
    requireStepText(
      dispatchStepName,
      'printf \'ROLLBACK_JOB_STARTED_EPOCH=%s\\n\' "$(date -u +%s)" >> "$GITHUB_ENV"',
      'standalone rollback job-start timestamp',
    );
    for (const needle of [
      'rollback_job_timeout_seconds=4200',
      'maximum_bounded_rollback_path_seconds=2624',
      'maximum_pre_mutation_elapsed_seconds=1200',
      '(( maximum_pre_mutation_elapsed_seconds + maximum_bounded_rollback_path_seconds <= rollback_job_timeout_seconds ))',
      'rollback_job_started_epoch=${ROLLBACK_JOB_STARTED_EPOCH:-0}',
      '"$rollback_job_elapsed_seconds" -gt "$maximum_pre_mutation_elapsed_seconds"',
      "write_summary 'ROLLBACK TIME RESERVE EXHAUSTED BEFORE THE FIRST PRODUCTION MUTATION'",
    ]) requireStepText(finalStepName, needle, 'standalone rollback time reserve ' + needle);
    const rollbackReserveBeforeFirstMutation =
      '          rollback_job_timeout_seconds=4200\n' +
      '          maximum_bounded_rollback_path_seconds=2624\n' +
      '          maximum_pre_mutation_elapsed_seconds=1200\n' +
      '          (( maximum_pre_mutation_elapsed_seconds + maximum_bounded_rollback_path_seconds <= rollback_job_timeout_seconds ))\n' +
      '          rollback_job_started_epoch=${ROLLBACK_JOB_STARTED_EPOCH:-0}\n' +
      '          rollback_job_elapsed_seconds=$(( $(date -u +%s) - rollback_job_started_epoch ))\n' +
      '          if [[ "$rollback_job_started_epoch" -le 0 || "$rollback_job_elapsed_seconds" -lt 0 \\\n' +
      '            || "$rollback_job_elapsed_seconds" -gt "$maximum_pre_mutation_elapsed_seconds" ]]; then\n' +
      "            write_summary 'ROLLBACK TIME RESERVE EXHAUSTED BEFORE THE FIRST PRODUCTION MUTATION'\n" +
      '            exit 1\n' +
      '          fi\n' +
      '          if [[ "$rollback_initial_boundary_state" == \'transition-pending\' ]]; then';
    if (!finalActive.includes(rollbackReserveBeforeFirstMutation) ||
        countOf(finalActive, 'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"') !== 1) {
      fail('standalone rollback time-reserve refusal is not immediately before the first production mutation');
    }
    if (countOf(active, 'timeout --signal=TERM --kill-after=10s 60s git -C "') !== 3) {
      fail('standalone rollback Git remote observations are not all bounded to 60 seconds');
    }
    const rollbackObserver = functionBody('wait_for_rollback_observer_stabilization', 'write_summary');
    for (const needle of [
      'local max_attempts=5',
      'local required_consecutive_matches=2',
      'local retry_delay_seconds=10',
      'local command_timeout_seconds=20',
      'while (( attempt <= max_attempts )); do',
      'assert_topology "rollback-observer-$attempt" "$command_timeout_seconds"',
      'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
      'fly releases --app "$app" --image --json >"$observer_releases_json"',
      'rollback_current="$(current_release "$observer_releases_json" "$command_timeout_seconds")"',
      'if [[ ! "$rollback_release" =~ ^v[1-9][0-9]*$',
      '|| ! "$final_prior_release" =~ ^v[1-9][0-9]*$ ]]',
      '(( 10#${rollback_release#v} <= 10#${final_prior_release#v} ))',
      "attempt_failure='rollback-release-not-newer-than-final-prior'",
      'elif [[ "$rollback_image_actual" != "$ROLLBACK_IMAGE" ]]; then',
      'elif [[ "$rollback_current" == "$last_matching_observation" ]]; then',
      'consecutive_matches=$((consecutive_matches + 1))',
      'if (( consecutive_matches >= required_consecutive_matches )); then',
      'if [[ -n "$attempt_failure" ]]; then',
      'consecutive_matches=0',
      "last_matching_observation=''",
      'sleep "$retry_delay_seconds"',
      'attempt=$((attempt + 1))',
      'return 0',
      'return 1',
    ]) if (!rollbackObserver.includes(needle)) fail(`rollback observer stabilization lacks ${needle}`);
    if (!rollbackObserver ||
        rollbackObserver.includes('fly deploy ') ||
        rollbackObserver.includes('write_summary ') ||
        rollbackObserver.includes('exit ') ||
        countOf(rollbackObserver, 'return 0') !== 1 ||
        countOf(rollbackObserver, 'return 1') !== 1) {
      fail('standalone rollback observer can fail open or redeploy before convergence is exhausted');
    }
    const observerLoop = rollbackObserver.indexOf('while (( attempt <= max_attempts )); do');
    const observerTopology = rollbackObserver.indexOf(
      'assert_topology "rollback-observer-$attempt" "$command_timeout_seconds"',
      observerLoop,
    );
    const observerReleaseTimeout = rollbackObserver.indexOf(
      'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
      observerTopology,
    );
    const observerReleaseQuery = rollbackObserver.indexOf(
      'fly releases --app "$app" --image --json >"$observer_releases_json"',
      observerReleaseTimeout,
    );
    const observerBinding = rollbackObserver.indexOf(
      'rollback_current="$(current_release "$observer_releases_json" "$command_timeout_seconds")"',
      observerReleaseQuery,
    );
    const observerNewRelease = rollbackObserver.indexOf(
      '(( 10#${rollback_release#v} <= 10#${final_prior_release#v} ))',
      observerBinding,
    );
    const observerExactImage = rollbackObserver.indexOf(
      'elif [[ "$rollback_image_actual" != "$ROLLBACK_IMAGE" ]]; then',
      observerNewRelease,
    );
    const observerThreshold = rollbackObserver.indexOf(
      'if (( consecutive_matches >= required_consecutive_matches )); then',
      observerExactImage,
    );
    const observerSuccess = rollbackObserver.indexOf('return 0', observerThreshold);
    const observerMismatchBranch = rollbackObserver.indexOf(
      'if [[ -n "$attempt_failure" ]]; then',
      observerSuccess,
    );
    const observerConsecutiveReset = rollbackObserver.indexOf(
      'consecutive_matches=0',
      observerMismatchBranch,
    );
    const observerIdentityReset = rollbackObserver.indexOf(
      "last_matching_observation=''",
      observerMismatchBranch,
    );
    const observerAttemptIncrement = rollbackObserver.indexOf(
      'attempt=$((attempt + 1))',
      observerIdentityReset,
    );
    const observerDone = rollbackObserver.lastIndexOf('done');
    const observerFailure = rollbackObserver.indexOf('return 1', observerDone);
    if ([observerLoop, observerTopology, observerReleaseTimeout, observerReleaseQuery,
      observerBinding, observerNewRelease,
      observerExactImage, observerThreshold, observerSuccess, observerMismatchBranch,
      observerConsecutiveReset, observerIdentityReset, observerAttemptIncrement,
      observerDone, observerFailure].some((offset) => offset < 0) ||
        !(observerLoop < observerTopology &&
          observerTopology < observerReleaseTimeout &&
          observerReleaseTimeout < observerReleaseQuery &&
          observerReleaseQuery < observerBinding &&
          observerBinding < observerNewRelease &&
          observerNewRelease < observerExactImage &&
          observerExactImage < observerThreshold &&
          observerThreshold < observerSuccess &&
          observerSuccess < observerMismatchBranch &&
          observerMismatchBranch < observerConsecutiveReset &&
          observerConsecutiveReset < observerIdentityReset &&
          observerIdentityReset < observerAttemptIncrement &&
          observerAttemptIncrement < observerDone &&
          observerDone < observerFailure)) {
      fail('standalone rollback observer does not enforce ordered, consecutive, bounded exact observations');
    }
    requireStepText(
      finalStepName,
      'rollback_config="$rollback_dir/fly.rollback.production.toml"',
      'final default-branch rollback config path',
    );
    requireStepText(dispatchStepName, '[[ "$CONFIRMATION" == "ROLLBACK assesssuite-production COMPATIBILITY IMAGE" ]]', 'explicit emergency rollback confirmation');
    requireStepText(dispatchStepName, '[[ "$INCIDENT_REFERENCE" =~ ^[A-Za-z0-9._:/-]{1,240}$ ]]', 'incident reference shape');
    requireStepText(
      dispatchStepName,
      '[[ "$EXPECTED_CURRENT_IMAGE" =~ ^registry\\.fly\\.io/assesssuite-production@sha256:[0-9a-f]{64}$ ]]',
      'immutable digest-only expected current image',
    );
    if (/\bdocker push\b/.test(active)) fail('emergency rollback workflow may not publish a new image');
    requireCount('fly deploy "$rollback_dir"', 1, 'single emergency rollback deploy command');
    requireStepText(dispatchStepName, '[[ "$ROLLBACK_IMAGE" =~ ^registry\\.fly\\.io/assesssuite-production@sha256:[0-9a-f]{64}$ ]]', 'digest-only rollback image input');
    requireStepText(finalStepName, '--image "$ROLLBACK_IMAGE"', 'digest-pinned emergency rollback deploy');
    requireStepText(finalStepName, 'assert_secret_name_boundary final forbid', 'final secret-name drift check');
    for (const needle of [
      "const settled = JSON.stringify([...required].sort());",
      "const transitionPending = JSON.stringify([...required, 'GENERAL_CLINICAL_LLM_ENABLED'].sort());",
      'if (observed === settled) {',
      'BOUNDARY_STATE_PATH="$boundary_state_path"',
      'rollback_initial_boundary_state="$(<"$RUNNER_TEMP/initial-secret-boundary-state")"',
      '[[ "$rollback_initial_boundary_state" == \'settled\' || "$rollback_initial_boundary_state" == \'transition-pending\' ]]',
      'if [[ "$rollback_initial_boundary_state" == \'transition-pending\' ]]; then',
      'elif [[ "$rollback_initial_boundary_state" != \'settled\' ]]; then',
      'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"',
    ]) requireStepText(finalStepName, needle, 'retry-aware rollback secret boundary ' + needle);
    if (finalActive.includes('LEGAL_STATUS') || finalActive.includes('LEGAL_EFFECTIVE_DATE')) {
      fail('emergency rollback reintroduces legal metadata as Fly secrets');
    }
    if (countOf(finalActive, 'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"') !== 1) {
      fail('emergency rollback transitional secret removal is not singular');
    }
    requireStepText(finalStepName, "read_version 'https://app.assesssuite.com'", 'application-host rollback version verification');
    requireStepText(finalStepName, "read_version 'https://assesssuite-production.fly.dev'", 'Fly-domain rollback version verification');
    requireStepText(finalStepName, "read_public_surface 'https://app.assesssuite.com' 'rollback-apex'", 'application-host rollback public-surface verification');
    requireStepText(finalStepName, "read_public_surface 'https://assesssuite-production.fly.dev' 'rollback-fly'", 'Fly-domain rollback public-surface verification');
    requireCount('[[ "$(timeout --signal=TERM --kill-after=10s 60s git -C "$rollback_dir" ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]', 2, 'bounded preflight and final-predeploy trusted-main freezes');
    const rollbackCommand = finalActive.indexOf('timeout --signal=TERM --kill-after=30s 420s fly deploy "$rollback_dir"');
    const rollbackStatusCapture = finalActive.indexOf('--yes || rollback_status=$?', rollbackCommand);
    const observerCall = finalActive.indexOf('if ! wait_for_rollback_observer_stabilization; then');
    const observerFailureSummary = finalActive.indexOf(
      'write_summary "ROLLBACK COMMAND EXIT ${rollback_status}; OBSERVER STABILIZATION FAILED (${rollback_observer_failure:-unknown})"',
      observerCall,
    );
    const observerFailureExit = finalActive.indexOf('exit 1', observerFailureSummary);
    const reconciledCommandFailure = finalActive.indexOf(
      'if [[ "$rollback_status" -ne 0 ]]; then',
      observerFailureExit,
    );
    const postrollbackBoundaryCheck = finalActive.indexOf(
      'assert_secret_name_boundary postrollback forbid',
      reconciledCommandFailure,
    );
    const commandFailureWindow = rollbackCommand >= 0 && observerCall > rollbackCommand
      ? finalActive.slice(rollbackCommand, observerCall)
      : '';
    if (rollbackCommand < 0 || rollbackStatusCapture < 0 || observerCall < 0 ||
        observerFailureSummary < 0 || observerFailureExit < 0 || reconciledCommandFailure < 0 ||
        postrollbackBoundaryCheck < 0 || /\b(?:exit|return)(?:\s|;|$)/m.test(commandFailureWindow) ||
        !(rollbackCommand < rollbackStatusCapture &&
          rollbackStatusCapture < observerCall &&
          observerCall < observerFailureSummary &&
          observerFailureSummary < observerFailureExit &&
          observerFailureExit < reconciledCommandFailure &&
          reconciledCommandFailure < postrollbackBoundaryCheck)) {
      fail('standalone rollback does not always observe, reconcile, or report command and observer status');
    }
    const order = [
      'assert_topology prior',
      'assert_secret_name_boundary initial allow',
      'assert_topology final-predeploy',
      '[[ "$final_prior_release" == "$EXPECTED_CURRENT_RELEASE" ]]',
      "read_version 'https://app.assesssuite.com' \"$FAILED_APPLICATION_SHA\"",
      'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"',
      'fly secrets set APP_URL=https://app.assesssuite.com --stage --app "$app"',
      'assert_secret_name_boundary final forbid',
      'fly deploy "$rollback_dir"',
      'if ! wait_for_rollback_observer_stabilization; then',
      'assert_secret_name_boundary postrollback forbid',
      "read_version 'https://app.assesssuite.com' \"$ROLLBACK_RELEASE_SHA\"",
      "read_public_surface 'https://app.assesssuite.com' 'rollback-apex'",
    ].map((needle) => finalActive.indexOf(needle));
    if (order.some((position) => position < 0) ||
        order.some((position, index) => index > 0 && position <= order[index - 1])) {
      fail('emergency rollback checks and deploy are not in the reviewed order');
    }
    for (const forbidden of [
      'assert_topology rollback',
      'rollback_current="$(current_release "$new_json")"',
      '[[ "$rollback_image_actual" == "$ROLLBACK_IMAGE" ]]',
    ]) {
      if (finalActive.includes(forbidden)) fail(`standalone rollback retains a one-shot observer: ${forbidden}`);
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
  const replaceEvery = (name, from, to, expected) => cases.push({
    name,
    mutate: (value) => {
      const found = countOf(value, from);
      if (found !== expected) throw new Error(`mutation ${name} expected ${expected} targets, found ${found}`);
      return value.replaceAll(from, to);
    },
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
      '      - name: Fail-closed dependency vulnerability audit\n        run: node scripts/check-dependency-audit.mjs',
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
  if (kind === 'prepare') {
    shadow('shadow-rollback-workflow-sha-identity', '          [[ "$ROLLBACK_SOURCE_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$ROLLBACK_SOURCE_SHA" ]]');
  }
  if (kind === 'rollback') {
    shadow('shadow-failed-application-workflow-sha-identity', '          [[ "$FAILED_APPLICATION_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', '          [[ -n "$FAILED_APPLICATION_SHA" ]]');
    shadow('shadow-rollback-source-distinction', '          [[ "$ROLLBACK_SOURCE_SHA" != "$FAILED_APPLICATION_SHA" ]]', '          [[ -n "$ROLLBACK_SOURCE_SHA" ]]');
    shadow('shadow-rollback-job-timeout', '    timeout-minutes: 70', '    timeout-minutes: 25');
    replace(
      'rollback-general-clinical-ai-posture-disabled',
      'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' "$config"',
      'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' "$config"',
    );
    replace(
      'rollback-transcription-posture-enabled',
      'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' "$config"',
      'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' "$config"',
    );
  }
  replace(
    'seed-denylist-removed',
    '|npm[[:space:]]+run[[:space:]]+seed|synthetic data reseeds on every boot',
    '|synthetic data reseeds on every boot',
  );
  replace(
    'fly-process-contract-invocation-removed',
    "          python3 -I - \"$config\" <<'PY'",
    "          true <<'PY'",
  );
  replace(
    'fly-process-contract-parser-bypassed',
    '              document = tomllib.load(stream)',
    '              document = {}',
  );
  replace(
    'fly-process-contract-dictionary-recursion-removed',
    '                      entries.extend(process_entries(nested, next_path))',
    '                      true',
  );
  replace(
    'fly-process-contract-array-recursion-removed',
    '                  entries.extend(process_entries(nested, path + (index,)))',
    '                  true',
  );
  replace(
    'fly-process-contract-argv-narrowed-to-first-config',
    '          for raw_path in sys.argv[1:]:',
    '          for raw_path in sys.argv[1:2]:',
  );
  replace(
    'fly-process-contract-exact-selector-weakened',
    "              if process_entries(document) != [(('http_service', 'processes'), ['app'])]:",
    "              if False:",
  );
  replace(
    'release-reader-all-rows-bypass',
    '          const releases = rows.map((row) => {',
    '          const releases = rows.slice(0, 1).map((row) => {',
  );
  replace(
    'release-reader-numeric-version-bypass',
    "            const match = /^v?([1-9][0-9]*)$/.exec(String(rawId));",
    "            const match = /^v?(.+)$/.exec(String(rawId));",
  );
  replace(
    'release-reader-duplicate-version-bypass',
    "            if (seenVersions.has(version)) throw new Error('Fly returned duplicate numeric release versions');",
    '            if (false) throw new Error();',
  );
  replace(
    'release-reader-completed-filter-bypass',
    '          const completed = releases.filter((item) => completeStatuses.has(item.releaseStatus));',
    '          const completed = releases;',
  );
  replace(
    'release-reader-latest-completed-bypass',
    '          const latest = completed.reduce((current, item) => item.version > current.version ? item : current);',
    '          const latest = completed[0];',
  );
  replace(
    'release-reader-latest-inprogress-bypass',
    "          if (latest.inProgress === true) throw new Error('Latest completed Fly release is still marked in progress');",
    '          if (false) throw new Error();',
  );
  replace(
    'release-reader-higher-state-bypass',
    '            if (item.inProgress === true || !terminalFailureStatuses.has(item.releaseStatus)) {',
    '            if (false) {',
  );
  replace(
    'release-reader-unknown-higher-state-accepted',
    "          const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled']);",
    "          const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled', 'pending']);",
  );
  replace(
    'release-reader-machine-query-replaced',
    '              fly machines list --app "$app" --json >"$machine_json"; then',
    '              fly image show --app "$app" --json >"$machine_json"; then',
  );
  replace(
    'release-reader-sole-machine-bypass',
    "          if (!Array.isArray(machines) || machines.length !== 1) throw new Error('Fly returned a non-sole Machine inventory');",
    '          if (false) throw new Error();',
  );
  replace(
    'release-reader-machine-identity-bypass',
    '          if (machineId !== process.env.EXPECTED_MACHINE_ID || machineState !== \'started\' ||',
    '          if (false || machineState !== \'started\' ||',
  );
  replace(
    'release-reader-machine-state-bypass',
    '          if (machineId !== process.env.EXPECTED_MACHINE_ID || machineState !== \'started\' ||',
    '          if (machineId !== process.env.EXPECTED_MACHINE_ID || false ||',
  );
  replace(
    'release-reader-machine-image-ref-bypass',
    "              registry !== 'registry.fly.io' || repository !== 'assesssuite-production' ||",
    '              false ||',
  );
  replace(
    'release-reader-machine-digest-bypass',
    '              !/^sha256:[0-9a-f]{64}$/.test(String(digest))) {',
    '              false) {',
  );
  replace(
    'release-reader-release-config-image-binding-bypass',
    '          if (configuredImage !== immutableImage || releaseImage !== immutableImage) {',
    '          if (false) {',
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
    'topology-two-volume-count-bypassed',
    '          if (!Array.isArray(machines) || machines.length !== 1 || !Array.isArray(volumes) || volumes.length !== 2) {',
    '          if (!Array.isArray(machines) || machines.length !== 1 || !Array.isArray(volumes)) {',
  );
  replace(
    'topology-volume-name-uniqueness-bypassed',
    '              new Set(volumes.map((row) => row?.name)).size !== 2) {',
    '              false) {',
  );
  replace(
    'topology-active-volume-selector-changed',
    "          const volume = volumes.find((row) => row?.name === 'assesssuite_data_r12');",
    "          const volume = volumes.find((row) => row?.name === 'assesssuite_data');",
  );
  replace(
    'topology-active-volume-name-bypassed',
    "volume.id !== process.env.EXPECTED_VOLUME_ID || volume.name !== 'assesssuite_data_r12'",
    'volume.id !== process.env.EXPECTED_VOLUME_ID || false',
  );
  replace(
    'topology-legacy-detachment-bypassed',
    'legacyVolume.attached_machine_id !== null',
    'false',
  );
  replace(
    'topology-legacy-policy-bypassed',
    'legacyVolume.snapshot_retention !== 5',
    'false',
  );
  replace(
    'topology-machine-started-state-bypassed',
    "machine.state !== 'started'",
    'false',
  );
  replace(
    'topology-legacy-id-binding-bypassed',
    kind === 'rollback'
      ? 'legacyVolume.id !== process.env.EXPECTED_LEGACY_VOLUME_ID'
      : '!/^vol_[A-Za-z0-9]+$/.test(legacyVolume.id)',
    'false',
  );
  replace(
    'topology-legacy-state-bypassed',
    "legacyVolume.state !== 'created'",
    'false',
  );
  replace(
    'topology-legacy-encryption-bypassed',
    'legacyVolume.encrypted !== true',
    'false',
  );
  replace(
    'topology-legacy-auto-backup-bypassed',
    'legacyVolume.auto_backup_enabled !== true',
    'false',
  );
  replace(
    'topology-active-mount-name-bypassed',
    'mounts[0]?.name !== volume.name',
    'false',
  );
  replace(
    'topology-config-source-reverted',
    'source = "assesssuite_data_r12"',
    'source = "assesssuite_data"',
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
  if (kind === 'prepare') {
    replace(
      'proof-label-removed',
      `          [[ "$(docker image inspect "$${imageVariable}" --format '{{ index .Config.Labels "io.assesssuite.rollback-proof" }}')" == 'registering-state+39-field-per-file-merge+age-quarantine+referral-commit-receipt-replay' ]]`,
      '          true',
    );
    cases.push({
      name: 'prepare-remote-timeouts-removed',
      mutate: (value) => {
        const target = 'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin';
        if (countOf(value, target) !== 6) {
          throw new Error('mutation prepare-remote-timeouts-removed expected six targets');
        }
        return value.replaceAll(target, 'git ls-remote --exit-code origin');
      },
    });
    replace(
      'prepare-flyctl-download-timeout-removed',
      '          curl --fail --location --silent --show-error --max-time 120 \\',
      '          curl --fail --location --silent --show-error \\',
    );
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
      '          EXPECTED_RELEASE_SCANNER_SHA256: 8eed6357833ba8430786192e2d6be1a2bbedab3153dfef684729549e307fad80',
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
    replaceEvery(
      'rollback-legacy-volume-input-rebound-to-active',
      '          EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}',
      '          EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_volume_id }}',
      2,
    );
    replace(
      'rollback-volume-distinction-bypassed',
      '          [[ "$EXPECTED_VOLUME_ID" != "$EXPECTED_LEGACY_VOLUME_ID" ]]',
      '          true',
    );
    replaceEvery(
      'rollback-release-sha-rebound-to-failed-candidate',
      '          ROLLBACK_RELEASE_SHA: ${{ inputs.rollback_source_sha }}',
      '          ROLLBACK_RELEASE_SHA: ${{ inputs.failed_application_sha }}',
      2,
    );
    replace('rollback-controls-checkout-rebound-to-old-image-source', '          ref: ${{ inputs.trusted_workflow_sha }}', '          ref: ${{ inputs.rollback_source_sha }}');
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
      'rollback-settled-retry-refused',
      'if (observed === settled) {',
      'if (false) {',
    );
    replace(
      'rollback-general-secret-removal-omitted',
      'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"',
      'true # GENERAL_CLINICAL_LLM_ENABLED staged-secret removal omitted',
    );
    replace(
      'rollback-general-secret-removal-premature',
      '          # Final just-in-time freeze immediately before the sole application mutation.',
      '          timeout --signal=TERM --kill-after=10s 60s \\\n            fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"\n\n          # Final just-in-time freeze immediately before the sole application mutation.',
    );
    replace(
      'final-main-check-removed',
      '          # Final just-in-time freeze immediately before the sole application mutation.\n' +
        '          [[ "$(git -C "$rollback_dir" rev-parse --verify \'HEAD^{commit}\')" == "$TRUSTED_WORKFLOW_SHA" ]]\n' +
        '          [[ "$(timeout --signal=TERM --kill-after=10s 60s git -C "$rollback_dir" ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]\n' +
        '          git -C "$rollback_dir" cat-file -e "$ROLLBACK_SOURCE_SHA^{commit}"\n' +
        '          git -C "$rollback_dir" merge-base --is-ancestor "$ROLLBACK_SOURCE_SHA" "$FAILED_APPLICATION_SHA"',
      '          # Final just-in-time freeze immediately before the sole application mutation.\n          true',
    );
    replace(
      'expected-current-image-tag-accepted',
      '          [[ "$EXPECTED_CURRENT_IMAGE" =~ ^registry\\.fly\\.io/assesssuite-production@sha256:[0-9a-f]{64}$ ]]',
      '          [[ "$EXPECTED_CURRENT_IMAGE" =~ ^registry\\.fly\\.io/assesssuite-production(:[A-Za-z0-9._-]{1,128}|@sha256:[0-9a-f]{64})$ ]]',
    );
    replace(
      'topology-node-status-propagation-removed',
      "            LABEL=\"$label\" env -u FLY_API_TOKEN node --input-type=module <<'NODE' || topology_status=$?",
      "            LABEL=\"$label\" env -u FLY_API_TOKEN node --input-type=module <<'NODE'",
    );
    replace(
      'rollback-observer-max-attempts-reduced-to-one',
      '            local max_attempts=5',
      '            local max_attempts=1',
    );
    replace(
      'rollback-observer-consecutive-matches-reduced-to-one',
      '            local required_consecutive_matches=2',
      '            local required_consecutive_matches=1',
    );
    replace(
      'rollback-observer-topology-bypass',
      '              if ! assert_topology "rollback-observer-$attempt" "$command_timeout_seconds"; then',
      '              if false; then',
    );
    replace(
      'rollback-observer-release-query-bypass',
      '                fly releases --app "$app" --image --json >"$observer_releases_json"; then',
      '                true >"$observer_releases_json"; then',
    );
    replace(
      'rollback-observer-release-timeout-removed',
      '              elif ! timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s" \\\n' +
        '                fly releases --app "$app" --image --json >"$observer_releases_json"; then',
      '              elif ! fly releases --app "$app" --image --json >"$observer_releases_json"; then',
    );
    replace(
      'rollback-observer-new-release-proof-bypass',
      '                  || (( 10#${rollback_release#v} <= 10#${final_prior_release#v} )); then',
      '                  || false; then',
    );
    replace(
      'rollback-observer-exact-image-bypass',
      '                elif [[ "$rollback_image_actual" != "$ROLLBACK_IMAGE" ]]; then',
      '                elif false; then',
    );
    replace(
      'rollback-observer-consecutive-identity-bypass',
      '                elif [[ "$rollback_current" == "$last_matching_observation" ]]; then',
      '                elif [[ -n "$rollback_current" ]]; then',
    );
    replace(
      'rollback-observer-caller-bypass',
      '          if ! wait_for_rollback_observer_stabilization; then',
      '          if false; then',
    );
    replace(
      'rollback-command-failure-short-circuits-observer',
      '          rollback_observer_failure=\'\'\n          if ! wait_for_rollback_observer_stabilization; then',
      '          if [[ "$rollback_status" -ne 0 ]]; then exit 1; fi\n          rollback_observer_failure=\'\'\n          if ! wait_for_rollback_observer_stabilization; then',
    );
    replace(
      'rollback-command-success-short-circuits-observer',
      '          rollback_observer_failure=\'\'\n          if ! wait_for_rollback_observer_stabilization; then',
      '          exit 0\n          rollback_observer_failure=\'\'\n          if ! wait_for_rollback_observer_stabilization; then',
    );
    cases.push({
      name: 'rollback-time-reserve-moved-after-first-mutation',
      mutate: (value) => {
        const reserve =
          '          rollback_job_timeout_seconds=4200\n' +
          '          maximum_bounded_rollback_path_seconds=2624\n' +
          '          maximum_pre_mutation_elapsed_seconds=1200\n' +
          '          (( maximum_pre_mutation_elapsed_seconds + maximum_bounded_rollback_path_seconds <= rollback_job_timeout_seconds ))\n' +
          '          rollback_job_started_epoch=${ROLLBACK_JOB_STARTED_EPOCH:-0}\n' +
          '          rollback_job_elapsed_seconds=$(( $(date -u +%s) - rollback_job_started_epoch ))\n' +
          '          if [[ "$rollback_job_started_epoch" -le 0 || "$rollback_job_elapsed_seconds" -lt 0 \\\n' +
          '            || "$rollback_job_elapsed_seconds" -gt "$maximum_pre_mutation_elapsed_seconds" ]]; then\n' +
          "            write_summary 'ROLLBACK TIME RESERVE EXHAUSTED BEFORE THE FIRST PRODUCTION MUTATION'\n" +
          '            exit 1\n' +
          '          fi\n';
        const firstMutation =
          '          if [[ "$rollback_initial_boundary_state" == \'transition-pending\' ]]; then\n' +
          '            timeout --signal=TERM --kill-after=10s 60s \\\n' +
          '              fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"\n' +
          '          elif [[ "$rollback_initial_boundary_state" != \'settled\' ]]; then\n' +
          '            exit 1\n' +
          '          fi\n';
        return replaceOnce(
          value,
          reserve + firstMutation,
          firstMutation + reserve,
          'rollback-time-reserve-moved-after-first-mutation',
        );
      },
    });
    replace(
      'rollback-job-timeout-reduced',
      '    timeout-minutes: 70',
      '    timeout-minutes: 25',
    );
    replace(
      'rollback-time-reserve-gate-removed',
      '          (( maximum_pre_mutation_elapsed_seconds + maximum_bounded_rollback_path_seconds <= rollback_job_timeout_seconds ))',
      '          true',
    );
    replace(
      'rollback-pre-mutation-deadline-expanded',
      '          maximum_pre_mutation_elapsed_seconds=1200',
      '          maximum_pre_mutation_elapsed_seconds=3600',
    );
    replace(
      'rollback-flyctl-download-timeout-removed',
      '          curl --fail --location --silent --show-error --max-time 120 \\',
      '          curl --fail --location --silent --show-error \\',
    );
    cases.push({
      name: 'rollback-main-remote-timeouts-removed',
      mutate: (value) => {
        const target = 'timeout --signal=TERM --kill-after=10s 60s git -C "$rollback_dir" ls-remote --exit-code origin refs/heads/main';
        if (countOf(value, target) !== 2) {
          throw new Error('mutation rollback-main-remote-timeouts-removed expected two targets');
        }
        return value.replaceAll(
          target,
          'git -C "$rollback_dir" ls-remote --exit-code origin refs/heads/main',
        );
      },
    });
    replace(
      'rollback-observer-redeploy-inside-loop',
      '              sleep "$retry_delay_seconds"',
      '              fly deploy "$rollback_dir" --app "$app" --image "$ROLLBACK_IMAGE" --yes\n              sleep "$retry_delay_seconds"',
    );
    replace(
      'rollback-observer-attempt-increment-removed',
      '              attempt=$((attempt + 1))',
      '              true # rollback observer attempt increment removed',
    );
    replace(
      'rollback-observer-consecutive-reset-removed',
      "                consecutive_matches=0\n                last_matching_observation=''",
      "                true # rollback observer consecutive reset removed\n                last_matching_observation=''",
    );
    replace(
      'public-surface-check-removed',
      "          if ! read_public_surface 'https://app.assesssuite.com' 'rollback-apex' \\",
      '          if false \\',
    );
    replace('rollback-ancestor-proof-bypassed', '          git -C "$source_dir" merge-base --is-ancestor "$ROLLBACK_SOURCE_SHA" "$FAILED_APPLICATION_SHA"', '          true');
    replace('rollback-pre-mutation-version-rebound-to-source', "read_version 'https://app.assesssuite.com' \"$FAILED_APPLICATION_SHA\" \"$RUNNER_TEMP/pre-mutation-app-version.json\"", "read_version 'https://app.assesssuite.com' \"$ROLLBACK_SOURCE_SHA\" \"$RUNNER_TEMP/pre-mutation-app-version.json\"");
    replace('rollback-old-landing-marker-removed', "            'Exercise Physiology at its Clinical Best.',", "            'unrelated marker',");
    replace('rollback-legal-app-routes-removed', '            for route in legal/privacy login; do', '            for route in root-only; do');
    replace('rollback-post-topology-removed', '          if ! assert_topology postrollback; then', '          if false; then');
    replace('rollback-app-url-staging-mutated', 'fly secrets set APP_URL=https://app.assesssuite.com --stage --app "$app"', 'fly secrets set APP_URL=https://assesssuite.com --stage --app "$app"');
    replace(
      'rollback-dashboard-token-allowlist-removed',
      "            'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN',",
      "            'OPENAI_API_KEY', 'SENTRY_DSN',",
    );
    replace('rollback-integration-encryption-key-removed', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n", '');
    replace('rollback-exact-eleven-marker-reverted', "boundaryState = 'exact-eleven';", "boundaryState = 'exact-ten';");
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
  replace('secret-allowlist-extra-app-key', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n          ];", "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY', 'UPLOAD_AUDIT_LEGAL_HOLD',\n          ];");
  replace('dashboard-token-allowlist-removed', "            'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN',", "            'OPENAI_API_KEY', 'SENTRY_DSN',");
  replace('integration-encryption-key-removed', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n", '');
  replace('cleanup-aggregate-proof-removed', "'rows_deleted','usage_aggregate_rows_deleted','files_deleted'", "'rows_deleted','files_deleted'");
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
  requireText(
    'GENERAL_CLINICAL_LLM_ENABLED = "1"\' fly.production.toml',
    'parity-reviewed candidate general clinical AI enabled posture',
  );
  requireText(
    'TRANSCRIPTION_ENABLED = "1"\' fly.production.toml',
    'parity-reviewed candidate transcription enabled posture',
  );

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
  if (!prepare.includes("python3 -I - fly.production.toml <<'PY'")) {
    fail('parity preparation does not invoke the isolated semantic Fly process contract');
  }
  for (const marker of TOML_PROCESS_CONTRACT_MARKERS) {
    if (!prepare.includes(marker)) fail('parity semantic Fly process contract missing ' + marker);
  }
  for (const needle of [
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main',
    'timeout --signal=TERM --kill-after=30s 300s docker pull --platform linux/amd64',
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120",
  ]) requireText(needle, 'bounded parity remote operation ' + needle);
  const parityFlyctlDownload =
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
    '            --output "$archive" \\\n' +
    "            'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz'";
  if (countOf(active, 'git ls-remote') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main') !== 1 ||
      countOf(active, 'docker pull') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=30s 300s docker pull --platform linux/amd64') !== 1 ||
      countOf(active, 'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz') !== 1 ||
      countOf(active, parityFlyctlDownload) !== 1) {
    fail('parity remote operations are not exclusively bound to their reviewed bounded commands');
  }

  if (prepare.includes('${{ secrets.FLY_API_TOKEN }}')) fail('Fly token enters parity preparation');
  for (const needle of [
    'FROM mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48',
    'RUN npm ci --ignore-scripts', 'ENTRYPOINT ["node", "server/tests/production-parity-wave.mjs"]',
    'CMD ["run-wave"]', 'docker build --tag "assesssuite-parity-runner:$APPLICATION_SHA"',
    'docker save "$image" | gzip -1 -n',
    'parity_runner_artifact_id: ${{ steps.upload_runner.outputs.artifact-id }}',
    'parity_runner_artifact_digest: sha256:${{ steps.upload_runner.outputs.artifact-digest }}',
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

  const exactEleven = "'ADMIN_PASSWORD', 'APP_URL', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',\n            'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_ANNUAL',\n            'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN',\n            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY'";
  if (!effect.includes(exactEleven) || !effect.includes('JSON.stringify([...names].sort()) !== JSON.stringify([...expected].sort())') || !effect.includes('Parity requires the exact eleven-name production secret allowlist')) fail('parity exact eleven-name secret allowlist is absent');
  for (const needle of [
    "'rows_deleted','usage_aggregate_rows_deleted','files_deleted'",
    'row.usage_aggregate_rows_deleted > row.rows_deleted',
  ]) if (!effect.includes(needle)) fail('parity aggregate cleanup proof lacks ' + needle);
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
    'const parsedReleases = releases.map((row) => {',
    "const match = /^v?([1-9][0-9]*)$/.exec(String(rawId));",
    "const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled']);",
    "if (seenVersions.has(version)) throw new Error('Fly returned duplicate numeric release versions');",
    'const completed = parsedReleases.filter((item) => completeStatuses.has(item.status));',
    'const latest = completed.reduce((current, item) => item.version > current.version ? item : current);',
    "if (latest.inProgress === true) throw new Error('Latest completed Fly release is still marked in progress');",
    'if (item.inProgress === true || !terminalFailureStatuses.has(item.status)) {',
    'const productionMachines = machines.filter((m) => (m.id ?? m.ID) === process.env.EXPECTED_PRODUCTION_MACHINE_ID);',
    "if (productionMachines.length !== 1) throw new Error('Exact production Machine inventory differs');",
    "if (prodState !== 'started' || (prod.region ?? prod.Region) !== 'syd' ||",
    "registry !== 'registry.fly.io' || repository !== 'assesssuite-production' ||",
    "!/^sha256:[0-9a-f]{64}$/.test(String(digest))",
    'const configuredImage = prod.config?.image ?? prod.Config?.image;',
    'immutableImage !== process.env.LIVE_IMAGE',
    'configuredImage !== immutableImage || releaseImage !== immutableImage',
    'const prodVolume = volumes.find((v) => v.id === process.env.EXPECTED_PRODUCTION_VOLUME_ID);',
    "activeVolumes.length !== 1 || activeVolumes[0]?.id !== prodVolume?.id",
    "prodVolume.name !== 'assesssuite_data_r12'",
    "prodVolume.region !== 'syd'", 'prodVolume.size_gb !== 3',
    'prodVolume.encrypted !== true',
    'prodVolume.attached_machine_id !== prod.id',
    'prodVolume.snapshot_retention !== 5',
    'prodVolume.auto_backup_enabled !== true',
    "const legacyVolumes = volumes.filter((v) => v.name === 'assesssuite_data');",
    'legacyVolumes.length !== 1',
    "legacyVolume.state !== 'created'", "legacyVolume.region !== 'syd'",
    'legacyVolume.size_gb !== 3', 'legacyVolume.encrypted !== true',
    'legacyVolume.attached_machine_id !== null',
    'legacyVolume.attached_alloc_id !== null',
    'legacyVolume.snapshot_retention !== 5',
    'legacyVolume.auto_backup_enabled !== true',
    "process.env.CURRENT_VOLUME_ID === prodVolume.id || process.env.CURRENT_VOLUME_ID === legacyVolume.id",
    'v.id !== prodVolume.id && v.id !== legacyVolume.id',
    "prodMounts[0]?.name !== 'assesssuite_data_r12'",
    'prodMounts[0]?.volume !== prodVolume.id', "prodMounts[0]?.path !== '/app/server/data'",
    'prodMounts[0]?.encrypted !== true', 'prodMounts[0]?.size_gb !== 3',
  ]) requireText(needle, 'parity production release/Machine binding ' + needle);
  requireText('source = "assesssuite_data_r12"', 'parity active r12 volume mount source');
  for (const forbidden of [
    '.find((r) =>',
    '|| releases[0]',
    'fly image show ',
  ]) {
    if (active.includes(forbidden)) fail('parity production release/Machine binding retains stale control ' + forbidden);
  }

  for (const needle of [
    'fly proxy 48787:8787 "$current_private_ipv6" --app "$app" --bind-addr 127.0.0.1 --quiet',
    'fly machine exec "$current_machine_id" "$command" --app "$app"',
    '--volume "$current_volume_id:/app/server/data"',
    '--metadata "assesssuite-campaign=$PARITY_NAMESPACE"',
    "c.metadata?.['assesssuite-campaign'] !== 'asr-r2-20260721'",
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
  replace(
    'candidate-general-clinical-ai-posture-disabled',
    'GENERAL_CLINICAL_LLM_ENABLED = "1"\' fly.production.toml',
    'GENERAL_CLINICAL_LLM_ENABLED = "0"\' fly.production.toml',
  );
  replace(
    'candidate-transcription-posture-disabled',
    'TRANSCRIPTION_ENABLED = "1"\' fly.production.toml',
    'TRANSCRIPTION_ENABLED = "0"\' fly.production.toml',
  );
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
  replace('secret-allowlist-extra-app-key', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n          ];", "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY', 'UPLOAD_AUDIT_LEGAL_HOLD',\n          ];");
  replace('dashboard-token-allowlist-removed', "            'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN',", "            'OPENAI_API_KEY', 'SENTRY_DSN',");
  replace('integration-encryption-key-removed', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n", '');
  replace('cleanup-aggregate-proof-removed', "'rows_deleted','usage_aggregate_rows_deleted','files_deleted'", "'rows_deleted','files_deleted'");
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
  replace('artifact-digest-prefix-removed', 'parity_runner_artifact_digest: sha256:${{ steps.upload_runner.outputs.artifact-digest }}', 'parity_runner_artifact_digest: ${{ steps.upload_runner.outputs.artifact-digest }}');
  replace('campaign-selector-metadata-removed', '--metadata "assesssuite-campaign=$PARITY_NAMESPACE" ', '');
  replace(
    'candidate-process-contract-invocation-removed',
    "          python3 -I - fly.production.toml <<'PY'",
    "          true <<'PY'",
  );
  replace(
    'candidate-process-contract-parser-bypassed',
    '              document = tomllib.load(stream)',
    '              document = {}',
  );
  replace(
    'candidate-process-contract-dictionary-recursion-removed',
    '                      entries.extend(process_entries(nested, next_path))',
    '                      true',
  );
  replace(
    'candidate-process-contract-array-recursion-removed',
    '                  entries.extend(process_entries(nested, path + (index,)))',
    '                  true',
  );
  replace(
    'candidate-process-contract-argv-narrowed-to-first-config',
    '          for raw_path in sys.argv[1:]:',
    '          for raw_path in sys.argv[1:2]:',
  );
  replace(
    'candidate-process-contract-exact-selector-weakened',
    "              if process_entries(document) != [(('http_service', 'processes'), ['app'])]:",
    "              if False:",
  );
  replace(
    'parity-release-all-rows-bypass',
    '          const parsedReleases = releases.map((row) => {',
    '          const parsedReleases = releases.slice(0, 1).map((row) => {',
  );
  replace(
    'parity-release-numeric-version-bypass',
    "            const match = /^v?([1-9][0-9]*)$/.exec(String(rawId));",
    "            const match = /^v?(.+)$/.exec(String(rawId));",
  );
  replace(
    'parity-release-duplicate-version-bypass',
    "            if (seenVersions.has(version)) throw new Error('Fly returned duplicate numeric release versions');",
    '            if (false) throw new Error();',
  );
  replace(
    'parity-release-completed-filter-bypass',
    '          const completed = parsedReleases.filter((item) => completeStatuses.has(item.status));',
    '          const completed = parsedReleases;',
  );
  replace(
    'parity-release-latest-selection-bypass',
    '          const latest = completed.reduce((current, item) => item.version > current.version ? item : current);',
    '          const latest = completed[0];',
  );
  replace(
    'parity-release-latest-inprogress-bypass',
    "          if (latest.inProgress === true) throw new Error('Latest completed Fly release is still marked in progress');",
    '          if (false) throw new Error();',
  );
  replace(
    'parity-higher-release-state-bypass',
    '            if (item.inProgress === true || !terminalFailureStatuses.has(item.status)) {',
    '            if (false) {',
  );
  replace(
    'parity-unknown-higher-release-state-accepted',
    "          const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled']);",
    "          const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled', 'pending']);",
  );
  replace(
    'parity-production-machine-inventory-bypass',
    "          if (productionMachines.length !== 1) throw new Error('Exact production Machine inventory differs');",
    '          if (false) throw new Error();',
  );
  replace(
    'parity-production-machine-state-bypass',
    "          if (prodState !== 'started' || (prod.region ?? prod.Region) !== 'syd' ||",
    "          if (false || (prod.region ?? prod.Region) !== 'syd' ||",
  );
  replace(
    'parity-production-machine-image-ref-bypass',
    "              registry !== 'registry.fly.io' || repository !== 'assesssuite-production' ||",
    '              false ||',
  );
  replace(
    'parity-production-machine-digest-bypass',
    '              !/^sha256:[0-9a-f]{64}$/.test(String(digest))) {',
    '              false) {',
  );
  replace(
    'parity-production-live-image-bypass',
    '              immutableImage !== process.env.LIVE_IMAGE ||',
    '              false ||',
  );
  replace(
    'parity-production-release-config-binding-bypass',
    '              configuredImage !== immutableImage || releaseImage !== immutableImage) {',
    '              false) {',
  );
  replace(
    'parity-main-remote-timeout-removed',
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main',
    'git ls-remote --exit-code origin refs/heads/main',
  );
  replace(
    'parity-proxy-image-pull-timeout-removed',
    'timeout --signal=TERM --kill-after=30s 300s docker pull --platform linux/amd64',
    'docker pull --platform linux/amd64',
  );
  replace(
    'parity-flyctl-download-timeout-removed',
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120",
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location",
  );
  replace(
    'parity-main-remote-bounded-dummy-unbounded-real',
    '          [[ "$(timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$APPLICATION_SHA" ]]',
    '          if false; then\n' +
      '            timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main >/dev/null\n' +
      '          fi\n' +
      '          [[ "$(git ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$APPLICATION_SHA" ]]',
  );
  replace(
    'parity-proxy-image-bounded-dummy-unbounded-real',
    '          timeout --signal=TERM --kill-after=30s 300s docker pull --platform linux/amd64 docker.io/library/node:24.4.1-bookworm-slim@sha256:36ae19f59c91f3303c7a648f07493fe14c4bd91320ac8d898416327bacf1bbfa >/dev/null',
    '          if false; then\n' +
      '            timeout --signal=TERM --kill-after=30s 300s docker pull --platform linux/amd64 docker.io/library/node:24.4.1-bookworm-slim@sha256:36ae19f59c91f3303c7a648f07493fe14c4bd91320ac8d898416327bacf1bbfa >/dev/null\n' +
      '          fi\n' +
      '          docker pull --platform linux/amd64 docker.io/library/node:24.4.1-bookworm-slim@sha256:36ae19f59c91f3303c7a648f07493fe14c4bd91320ac8d898416327bacf1bbfa >/dev/null',
  );
  replace(
    'parity-flyctl-bounded-dummy-unbounded-real',
    "          curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
      '            --output "$archive" \\\n' +
      "            'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz'",
    '          if false; then\n' +
      "            curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
      '              --output "$archive" \\\n' +
      "              'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz'\n" +
      '          fi\n' +
      "          curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \\\n" +
      '            --output "$archive" \\\n' +
      "            'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz'",
  );
  replace(
    'parity-topology-config-source-reverted',
    'source = "assesssuite_data_r12"',
    'source = "assesssuite_data"',
  );
  replace(
    'parity-active-volume-name-bypassed',
    "prodVolume.name !== 'assesssuite_data_r12'",
    'false',
  );
  replace(
    'parity-active-volume-policy-bypassed',
    'prodVolume.snapshot_retention !== 5',
    'false',
  );
  replace(
    'parity-legacy-detachment-bypassed',
    'legacyVolume.attached_machine_id !== null',
    'false',
  );
  replace(
    'parity-legacy-policy-bypassed',
    'legacyVolume.snapshot_retention !== 5',
    'false',
  );
  replace(
    'parity-legacy-volume-misclassified',
    'v.id !== prodVolume.id && v.id !== legacyVolume.id',
    'v.id !== prodVolume.id',
  );
  replace(
    'parity-production-mount-name-bypassed',
    "prodMounts[0]?.name !== 'assesssuite_data_r12'",
    'false',
  );
  replace(
    'parity-expected-active-volume-id-unbound',
    'const prodVolume = volumes.find((v) => v.id === process.env.EXPECTED_PRODUCTION_VOLUME_ID);',
    "const prodVolume = volumes.find((v) => v.name === 'assesssuite_data_r12');",
  );
  replace(
    'parity-active-volume-attachment-bypassed',
    'prodVolume.attached_machine_id !== prod.id',
    'false',
  );
  replace(
    'parity-production-mount-volume-bypassed',
    'prodMounts[0]?.volume !== prodVolume.id',
    'false',
  );
  replace(
    'parity-production-mount-path-bypassed',
    "prodMounts[0]?.path !== '/app/server/data'",
    'false',
  );
  replace(
    'parity-current-volume-production-selection-bypassed',
    "process.env.CURRENT_VOLUME_ID === prodVolume.id || process.env.CURRENT_VOLUME_ID === legacyVolume.id",
    'false',
  );
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
  const parsedDeploySteps = parseSteps(deploy, failures);
  const deployStep = (name) => parsedDeploySteps.find((step) => step.name === name)?.body || '';

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
  if (!deploy.includes('runs-on: ubuntu-24.04') || !deploy.includes('timeout-minutes: 120')) fail('deploy job runner or timeout differs');

  const expectedInputs = [
    'trusted_workflow_sha','application_sha','candidate_config_sha256','rollback_config_sha256',
    'expected_current_release','expected_current_image','expected_machine_id','expected_volume_id',
    'expected_legacy_volume_id','rollback_source_sha','rollback_image','extraction_runtime_mode','provider_terms_attestation',
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
  if (countOf(active, '${{ secrets.FLY_API_TOKEN }}') !== 1 ||
      countOf(active, '${{ secrets.SENTRY_AUTH_TOKEN }}') !== 0 ||
      countOf(active, '${{ secrets.SENTRY_DSN }}') !== 1 ||
      countOf(active, '${{ secrets.ASSESSSUITE_DASHBOARD_METRICS_TOKEN }}') !== 1 ||
      countOf(active, '${{ secrets.') !== 3) fail('deploy credential expressions differ from the fresh Fly-only runner design');
  if (deploy.includes('actions/checkout@') || /(^|\n)\s*(?:npm|npx|docker)\s/.test(deploy) ||
      /(^|\n)\s*node\s+(?:candidate|server|scripts)\//.test(deploy) || deploy.includes('working-directory:')) {
    fail('deploy job can execute candidate or repository code');
  }
  const finalFlyStep = deployStep('Final secret-bearing Fly release command and public verification');
  if (finalFlyStep.includes('${{ secrets.SENTRY_AUTH_TOKEN }}') || countOf(finalFlyStep, '${{ secrets.FLY_API_TOKEN }}') !== 1 || countOf(finalFlyStep, '${{ secrets.SENTRY_DSN }}') !== 1 || countOf(finalFlyStep, '${{ secrets.ASSESSSUITE_DASHBOARD_METRICS_TOKEN }}') !== 1) fail('final Fly step credential boundary differs');
  if (/(^|\n)\s+(?:npm|npx)\s/.test(finalFlyStep) || finalFlyStep.includes('actions/checkout@')) fail('final Fly step can execute repository package code');
  if (/(^|\n)\s+needs:/.test(deploy) || deploy.includes('needs.') || deploy.includes('CANDIDATE_IMAGE_REF: ${{ needs.publish_image')) fail('deploy retains an in-run or cyclic publication dependency');

  for (const needle of [
    'artifact-ids: ${{ inputs.deploy_bundle_artifact_id }}',
    'github-token: ${{ github.token }}', 'repository: mbvidler-ctrl/assesssuite_migration',
    'run-id: ${{ inputs.preparation_run_id }}', 'path: ${{ runner.temp }}/deploy-bundle',
    'merge-multiple: true',
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
    'expected_files=$\'candidate-build-receipt.json\\ncompatibility-receipt.json\\ndeploy-bundle-manifest.json\\nfly.production.toml\\nfly.rollback.production.toml\\npublication-receipt.json\\nsentry-source-map-manifest.json\'',
    '[[ "$actual_files" == "$expected_files" ]]', "stat -c '%F'", '[[ -f "$bundle/$file" && ! -L "$bundle/$file" ]]',
    '[[ "$(sha256sum "$manifest" | awk \'{print $1}\')" == "$DEPLOY_BUNDLE_MANIFEST_SHA256" ]]',
    'raw !== `${JSON.stringify(value)}\\n`', "same(manifest.schema_version, 'assesssuite.deploy-bundle-manifest.v2', 'Manifest schema')",
    "same(manifest.result, 'PASS', 'Manifest result')", "same(manifest.publication_run_id, e.PREPARATION_RUN_ID, 'Manifest run id')",
    "same(manifest.publication_run_attempt, e.PREPARATION_RUN_ATTEMPT, 'Manifest run attempt')",
    "same(manifest.candidate_image_ref, e.CANDIDATE_IMAGE_REF, 'Manifest candidate image ref')",
    "same(manifest.application_image_digest, e.APPLICATION_IMAGE_DIGEST, 'Manifest application image digest')",
    "same(manifest.rollback_source_sha, e.ROLLBACK_SOURCE_SHA, 'Manifest rollback source SHA')",
    "same(manifest.rollback_image_ref, e.EXPECTED_CURRENT_IMAGE, 'Manifest expected current image ref')",
    "same(manifest.publication_receipt_sha256, digest('publication-receipt.json'), 'Publication receipt hash')",
    "same(manifest.compatibility_receipt_sha256, digest('compatibility-receipt.json'), 'Compatibility receipt hash')",
    "same(manifest.source_map_manifest_sha256, digest('sentry-source-map-manifest.json'), 'Source-map manifest hash')",
    "['publication_receipt_sha256',manifest.publication_receipt_sha256]",
    'JSON.stringify(manifest.markers) !== JSON.stringify(markers)', 'BUILD_TIMESTAMP=${manifest.build_timestamp}',
  ]) requireText(needle, 'sealed deploy-bundle control ' + needle);
  requireText('CANDIDATE_IMAGE_REF: registry.fly.io/assesssuite-production@${{ inputs.application_image_digest }}', 'predeclared candidate digest reference');
  requireText('[[ "$CANDIDATE_IMAGE_REF" == "registry.fly.io/assesssuite-production@$APPLICATION_IMAGE_DIGEST" ]]', 'candidate digest/ref identity');
  requireText('[[ "$DEPLOY_BUNDLE_ARTIFACT_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]', 'canonical deploy-bundle artifact digest');
  requireText('[[ "$CONFIRMATION" == "DEPLOY assesssuite-production EXACT SHA" ]]', 'exact deployment confirmation');
  requireText('ROLLBACK_SOURCE_SHA: ${{ inputs.rollback_source_sha }}', 'independent rollback source SHA input binding');
  if (countOf(deploy, 'ROLLBACK_SOURCE_SHA: ${{ inputs.rollback_source_sha }}') !== 3) fail('rollback source SHA is not bound independently at all three deploy gates');
  requireText('EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}', 'independent legacy volume ID input binding');
  if (countOf(deploy, 'EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}') !== 3) fail('legacy volume ID is not bound independently at all three deploy gates');
  requireText('[[ "$EXPECTED_MACHINE_ID" =~ ^[0-9a-f]{14,32}$ && "$EXPECTED_VOLUME_ID" =~ ^vol_[A-Za-z0-9]+$ && "$EXPECTED_LEGACY_VOLUME_ID" =~ ^vol_[A-Za-z0-9]+$ ]]', 'active and legacy volume input shapes');
  requireText('[[ "$EXPECTED_VOLUME_ID" != "$EXPECTED_LEGACY_VOLUME_ID" ]]', 'active and legacy volume distinction');
  if (countOf(deploy, 'ROLLBACK_RELEASE_SHA: ${{ inputs.rollback_source_sha }}') !== 2) fail('rollback release SHA is not derived from the rollback source in both deploy gates');
  requireText('[[ "$ROLLBACK_RELEASE_SHA" == "$ROLLBACK_SOURCE_SHA" ]]', 'rollback release/source identity');
  requireText('[[ "$ROLLBACK_IMAGE" == "$EXPECTED_CURRENT_IMAGE" ]]', 'rollback image/current image identity');
  requireText('row.merge_base_commit?.sha !== process.env.ROLLBACK_SOURCE_SHA', 'GitHub rollback ancestor proof');
  requireText("same(manifest.rollback_source_sha, e.ROLLBACK_SOURCE_SHA, 'Manifest rollback source SHA')", 'manifest rollback source binding');
  requireText("['rollback_source_sha',e.ROLLBACK_SOURCE_SHA]", 'compatibility rollback source binding');
  requireText("same(manifest.expected_legacy_volume_id, e.EXPECTED_LEGACY_VOLUME_ID, 'Manifest legacy volume ID')", 'manifest legacy volume binding');
  requireText("['expected_legacy_volume_id',e.EXPECTED_LEGACY_VOLUME_ID]", 'publication and compatibility legacy volume binding');
  requireText("read_version 'https://app.assesssuite.com' \"$ROLLBACK_SOURCE_SHA\" \"$RUNNER_TEMP/pre-mutation-app-version.json\"", 'pre-mutation application-host version freeze');
  requireText("read_version 'https://assesssuite-production.fly.dev' \"$ROLLBACK_SOURCE_SHA\" \"$RUNNER_TEMP/pre-mutation-fly-version.json\"", 'pre-mutation Fly-domain version freeze');
  requireText("'Exercise Physiology at its Clinical Best.'", 'postrollback pre-split landing marker');
  requireText('for route in legal/privacy login; do', 'postrollback legal and application route checks');
  requireText('assert_volume_snapshot_policy postrollback "$EXPECTED_VOLUME_ID" "$EXPECTED_MACHINE_ID"', 'postrollback r12 and detached-legacy topology check');
  const publicSurfaceStart = finalFlyStep.indexOf('read_public_surface() {');
  const publicSurfaceEnd = publicSurfaceStart < 0
    ? -1
    : finalFlyStep.indexOf('assert_secret_name_boundary() {', publicSurfaceStart);
  const publicSurface = publicSurfaceStart >= 0 && publicSurfaceEnd > publicSurfaceStart
    ? finalFlyStep.slice(publicSurfaceStart, publicSurfaceEnd)
    : '';
  for (const needle of [
    "!/^\\/assets\\/[A-Za-z0-9._-]+\\.js$/.test(match[1])",
    'if [[ "$surface_mode" == \'candidate\' ]]; then',
    '"$url${asset_path}.map"',
    '"$url/assets%2F..%2Findex.html"',
    '--path-as-is --silent --show-error --max-time 10 --max-filesize 65536',
    '[[ "$map_status" == \'404\' ]] || return 1',
    '[[ "$(<"$map_body")" == \'{"message":"not found"}\' ]] || return 1',
    '[[ "$traversal_status" == \'404\' ]] || return 1',
    '[[ "$(<"$traversal_body")" == \'{"message":"not found"}\' ]] || return 1',
  ]) if (!publicSurface.includes(needle)) fail('candidate source-map/traversal canary lacks ' + needle);
  const candidateCanaryGuard = publicSurface.indexOf('if [[ "$surface_mode" == \'candidate\' ]]; then');
  const candidateCanaryEnd = candidateCanaryGuard < 0 ? -1 : publicSurface.indexOf('            fi', candidateCanaryGuard);
  for (const needle of ['"$url${asset_path}.map"', '"$url/assets%2F..%2Findex.html"']) {
    const offset = publicSurface.indexOf(needle);
    if (offset < candidateCanaryGuard || candidateCanaryEnd <= offset) {
      fail('candidate source-map/traversal canary is not bounded to candidate mode: ' + needle);
    }
  }
  requireText("read_public_surface 'https://app.assesssuite.com' 'apex'", 'candidate application-host public-surface verification');
  requireText("read_public_surface 'https://assesssuite-production.fly.dev' 'fly'", 'candidate direct-Fly public-surface verification');
  requireText('[[ "$reviewed_mode" == "$EXTRACTION_RUNTIME_MODE" ]]', 'deploy extraction-mode config binding');
  requireText('[[ "$reviewed_under_age_mode" == "$UNDER_AGE_ZDR_RUNTIME_MODE" ]]', 'deploy under-age config binding');
  requireText(
    'production_volume_id="$EXPECTED_VOLUME_ID"\n' +
    '          production_machine_id="$EXPECTED_MACHINE_ID"',
    'predeploy snapshot identity binding',
  );

  const secretOffset = deploy.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const bundleOffset = deploy.indexOf('Validate sealed controls and compatibility receipt before secret injection');
  if (secretOffset < 0 || bundleOffset < 0 || secretOffset < bundleOffset) fail('Fly token is injected before sealed bundle verification');
  for (const needle of [
    '[[ -z "${FLY_API_TOKEN:-}" ]]', 'empty-deploy-context', 'fly deploy "$deploy_source_dir"',
    '--remote-only', '--skip-release-command', '--image "$candidate_image_ref"', '--image "$ROLLBACK_IMAGE"',
    'refs/heads/main', 'assert_secret_name_boundary initial allow', 'assert_secret_name_boundary final forbid',
    'assert_secret_name_boundary postrollback forbid', 'assert_secret_name_boundary postactivation forbid',
  ]) requireText(needle, 'remote-only production control ' + needle);
  requireText('source = "assesssuite_data_r12"', 'active r12 volume mount source');
  requireText('EXPECTED_APP_URL = "https://app.assesssuite.com"', 'exact application URL config boundary');
  if (countOf(deploy, 'EXPECTED_APP_URL = "https://app.assesssuite.com"') !== 2) fail('deploy does not validate EXPECTED_APP_URL in both reviewed configs');
  requireText('fly secrets set APP_URL=https://app.assesssuite.com SENTRY_DSN="$SENTRY_DSN" ASSESSSUITE_DASHBOARD_METRICS_TOKEN="$ASSESSSUITE_DASHBOARD_METRICS_TOKEN" --stage --app "$app"', 'exact application URL, Sentry DSN and dashboard token staged secrets');
  if (countOf(deploy, 'fly secrets set ') !== 1 || /\bfly\s+(?:machine\s+restart|restart)\b/.test(deploy)) {
    fail('dashboard token must be staged in the sole candidate secret mutation without a separate restart');
  }
  const topologyStart = deploy.indexOf('          assert_topology() {');
  const topologyEnd = topologyStart < 0 ? -1 : deploy.indexOf('          volume_identity() {', topologyStart);
  const topology = topologyStart >= 0 && topologyEnd > topologyStart
    ? deploy.slice(topologyStart, topologyEnd)
    : '';
  for (const needle of [
    'volumes.length !== 2',
    "machine.state !== 'started'",
    'new Set(volumes.map((row) => row.id)).size !== 2',
    'new Set(volumes.map((row) => row.name)).size !== 2',
    "volumes.find((row) => row.name === 'assesssuite_data_r12')",
    "volumes.find((row) => row.name === 'assesssuite_data')",
    "volume.name !== 'assesssuite_data_r12'",
    'volume.id !== process.env.EXPECTED_VOLUME_ID',
    "volume.state !== 'created'", "volume.region !== 'syd'",
    'volume.size_gb !== 3', 'volume.encrypted !== true',
    'volume.attached_machine_id !== machineId',
    'volume.snapshot_retention !== 5', 'volume.auto_backup_enabled !== true',
    'mounts[0]?.volume !== volume.id', 'mounts[0]?.name !== volume.name',
    "mounts[0]?.path !== '/app/server/data'", 'mounts[0]?.encrypted !== true',
    'mounts[0]?.size_gb !== 3',
    'legacyVolume.id !== process.env.EXPECTED_LEGACY_VOLUME_ID',
    "legacyVolume.state !== 'created'", "legacyVolume.region !== 'syd'",
    'legacyVolume.attached_machine_id !== null',
    'legacyVolume.attached_alloc_id !== null',
    'legacyVolume.size_gb !== 3',
    'legacyVolume.encrypted !== true',
    'legacyVolume.snapshot_retention !== 5',
    'legacyVolume.auto_backup_enabled !== true',
  ]) if (!topology.includes(needle)) fail('two-volume production topology control lacks ' + needle);
  if (countOf(deploy, '--remote-only') !== 2 || countOf(deploy, '--skip-release-command') !== 2 ||
      countOf(deploy, 'fly deploy "$deploy_source_dir"') !== 2) fail('candidate and rollback are not both remote-only empty-context deploys');
  if (countOf(deploy, 'assert_fly_process_contract() {') !== 2 ||
      countOf(deploy, "python3 -I - \"$@\" <<'PY'") !== 2 ||
      countOf(deploy, 'assert_fly_process_contract "$candidate_config" "$rollback_config"') !== 2) {
    fail('candidate and rollback configs do not pass both isolated semantic Fly process gates');
  }
  for (const marker of TOML_PROCESS_CONTRACT_MARKERS) {
    if (countOf(deploy, marker) !== 2) fail('deploy semantic Fly process contracts differ at ' + marker);
  }
  if (deploy.includes('app = "node server/productionBootstrap.mjs && exec node server/index.mjs"')) {
    fail('deploy config contract reintroduces a flyctl-tokenized process command instead of inheriting the image CMD');
  }
  const exactEleven = "'ADMIN_PASSWORD', 'APP_URL', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',\n            'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_PRICE_ID_ANNUAL',\n            'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN',\n            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY'";
  if (!deploy.includes(exactEleven) || deploy.includes('UPLOAD_AUDIT_LEGAL_HOLD')) fail('deploy exact eleven-name application-secret allowlist differs');
  for (const needle of [
    "const settled = JSON.stringify([...required].sort());",
    "const preDashboard = JSON.stringify(required.filter((name) => name !== 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN').sort());",
    "const transitionPending = JSON.stringify([...required, 'GENERAL_CLINICAL_LLM_ENABLED'].sort());",
    "const preDashboardTransitionPending = JSON.stringify([...required.filter((name) => name !== 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN'), 'GENERAL_CLINICAL_LLM_ENABLED'].sort());",
    "if (observed === settled) {", "} else if (observed === preDashboard) {", "} else if (observed === transitionPending) {", "} else if (observed === preDashboardTransitionPending) {",
    "boundaryState = 'settled';", "boundaryState = 'pre-dashboard';", "boundaryState = 'transition-pending';", "boundaryState = 'pre-dashboard-transition-pending';", "boundaryState = 'exact-eleven';",
    'BOUNDARY_STATE_PATH="$boundary_state_path"',
    'initial_boundary_state="$(<"$RUNNER_TEMP/initial-secret-boundary-state")"',
    '[[ "$initial_boundary_state" == \'settled\' || "$initial_boundary_state" == \'pre-dashboard\' || "$initial_boundary_state" == \'transition-pending\' || "$initial_boundary_state" == \'pre-dashboard-transition-pending\' ]]',
    'if [[ "$initial_boundary_state" == \'transition-pending\' || "$initial_boundary_state" == \'pre-dashboard-transition-pending\' ]]; then',
    'elif [[ "$initial_boundary_state" != \'settled\' && "$initial_boundary_state" != \'pre-dashboard\' ]]; then',
    'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"',
  ]) requireText(needle, 'reviewed transitional secret boundary ' + needle);
  for (const needle of [
    'SENTRY_DSN_VALUE="$SENTRY_DSN" node --input-type=module',
    "parsed.hostname !== 'o4511822688813056.ingest.us.sentry.io'",
    "parsed.pathname !== '/4511827129663488'",
    "!/^[0-9a-f]{32}$/.test(parsed.username)",
  ]) if (!finalFlyStep.includes(needle)) fail('final Fly step exact Sentry DSN validation missing ' + needle);
  for (const needle of [
    'ASSESSSUITE_DASHBOARD_METRICS_TOKEN_VALUE="$ASSESSSUITE_DASHBOARD_METRICS_TOKEN" node --input-type=module',
    "const byteLength = Buffer.byteLength(value, 'utf8');",
    'byteLength < 32 || byteLength > 4096',
    '/[\\r\\n]/.test(value)',
  ]) if (!finalFlyStep.includes(needle)) fail('final Fly step dashboard token validation missing ' + needle);
  if (/(?:echo|printf)[^\n]*ASSESSSUITE_DASHBOARD_METRICS_TOKEN/.test(finalFlyStep) || !finalFlyStep.includes('set +x')) {
    fail('dashboard token could enter release logs');
  }
  if (deploy.includes('sentry-cli') || deploy.includes('sourcemaps inject') || deploy.includes('sourcemaps upload') || deploy.includes('SENTRY_AUTH_TOKEN')) {
    fail('fresh Fly runner retains Sentry upload tooling or credential material');
  }
  if (deploy.includes('LEGAL_STATUS') || deploy.includes('LEGAL_EFFECTIVE_DATE')) {
    fail('legal metadata re-enters the Fly secret-name boundary');
  }
  if (countOf(deploy, 'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"') !== 1) {
    fail('transitional GENERAL_CLINICAL_LLM_ENABLED removal is not singular');
  }
  const transitionalRemoval = deploy.indexOf('fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"');
  const finalSecretBoundary = deploy.indexOf('if ! assert_secret_name_boundary final forbid; then');
  const candidateDeploy = deploy.indexOf('fly deploy "$deploy_source_dir"', finalSecretBoundary);
  const postactivationBoundary = deploy.indexOf('assert_secret_name_boundary postactivation forbid', candidateDeploy);
  if (postactivationBoundary < candidateDeploy) fail('exact-eleven secret boundary is not re-proved after candidate activation');
  for (const needle of [
    'printf \'DEPLOY_JOB_STARTED_EPOCH=%s\\n\' "$(date -u +%s)" >> "$GITHUB_ENV"',
    'curl --fail --location --silent --show-error --max-time 120',
    'deployment_job_timeout_seconds=7200',
    'maximum_post_gate_path_seconds=4888',
    'maximum_gate_elapsed_seconds=1200',
    '(( maximum_gate_elapsed_seconds + maximum_post_gate_path_seconds <= deployment_job_timeout_seconds ))',
    '"$deploy_job_elapsed_seconds" -gt "$maximum_gate_elapsed_seconds"',
  ]) requireText(needle, 'bounded deploy recovery budget ' + needle);
  const deployReserveBeforeFirstMutation =
    '          deployment_job_timeout_seconds=7200\n' +
    '          maximum_post_gate_path_seconds=4888\n' +
    '          maximum_gate_elapsed_seconds=1200\n' +
    '          (( maximum_gate_elapsed_seconds + maximum_post_gate_path_seconds <= deployment_job_timeout_seconds ))\n' +
    '          deploy_job_elapsed_seconds=$(( $(date -u +%s) - DEPLOY_JOB_STARTED_EPOCH ))\n' +
    '          if [[ "$DEPLOY_JOB_STARTED_EPOCH" -le 0 || "$deploy_job_elapsed_seconds" -lt 0 \\\n' +
    '            || "$deploy_job_elapsed_seconds" -gt "$maximum_gate_elapsed_seconds" ]]; then\n' +
    "            echo 'The deployment job no longer has the reviewed time reserve for snapshot, candidate verification and automatic image rollback.' >&2\n" +
    "            append_summary 'FAILED; rollback-reserved deployment time gate closed before snapshot or application deployment'\n" +
    '            exit 1\n' +
    '          fi\n\n' +
    '          if ! create_predeploy_volume_snapshot; then';
  if (!deploy.includes(deployReserveBeforeFirstMutation) ||
      countOf(deploy, 'if ! create_predeploy_volume_snapshot; then') !== 1) {
    fail('deploy time-reserve refusal is not immediately before the first production mutation');
  }
  if (countOf(
    deploy,
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main',
  ) !== 2) {
    fail('deploy remote-main observations are not both bounded to 60 seconds');
  }
  if (countOf(
    deploy,
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --max-time 60",
  ) !== 4) {
    fail('deploy GitHub control downloads are not all bounded to 60 seconds');
  }
  const predeployFreezes = [
    'deploy_job_elapsed_seconds=$(( $(date -u +%s) - DEPLOY_JOB_STARTED_EPOCH ))',
    'if ! create_predeploy_volume_snapshot; then',
    'remote_main_sha="$(timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main',
    '[[ "$(sha256sum "$candidate_config" | awk \'{print $1}\')" == "$CANDIDATE_CONFIG_SHA256" ]]',
    'if ! assert_volume_snapshot_policy final-predeploy "$EXPECTED_VOLUME_ID" "$EXPECTED_MACHINE_ID"; then',
    'if [[ "$final_prior_release" != "$EXPECTED_CURRENT_RELEASE"',
  ].map((needle) => deploy.indexOf(needle));
  if (predeployFreezes.some((offset) => offset < 0 || offset >= transitionalRemoval) ||
      transitionalRemoval < 0 || finalSecretBoundary < 0 || candidateDeploy < 0 ||
      !(transitionalRemoval < finalSecretBoundary && finalSecretBoundary < candidateDeploy)) {
    fail('conditional transitional secret removal is not last-mutation ordered');
  }

  const observerStart = deploy.indexOf('wait_for_candidate_observer_stabilization() {');
  const rollbackObserverStart = deploy.indexOf('wait_for_rollback_observer_stabilization() {');
  const observerEnd = observerStart < 0 ? -1 : rollbackObserverStart;
  const observer = observerStart >= 0 && observerEnd > observerStart
    ? deploy.slice(observerStart, observerEnd)
    : '';
  const rollbackObserverEnd = rollbackObserverStart < 0
    ? -1
    : deploy.indexOf('append_summary() {', rollbackObserverStart);
  const rollbackObserver = rollbackObserverStart >= 0 && rollbackObserverEnd > rollbackObserverStart
    ? deploy.slice(rollbackObserverStart, rollbackObserverEnd)
    : '';
  for (const needle of [
    'local max_attempts=5',
    'local required_consecutive_matches=2',
    'local retry_delay_seconds=10',
    'local command_timeout_seconds=20',
    'while (( attempt <= max_attempts )); do',
    'assert_volume_snapshot_policy "candidate-observer-$attempt"',
    '"$production_volume_id" "$production_machine_id" "$command_timeout_seconds"',
    'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
    'fly releases --app "$app" --image --json >"$new_json"',
    'candidate_current="$(current_release "$new_json" "$command_timeout_seconds")"',
    "local candidate_attempt_release=''",
    "local candidate_attempt_image=''",
    'IFS=$\'\\t\' read -r candidate_attempt_release candidate_attempt_image <<<"$candidate_current"',
    'if [[ ! "$candidate_attempt_release" =~ ^v[1-9][0-9]*$',
    '|| ! "$final_prior_release" =~ ^v[1-9][0-9]*$ ]]',
    '(( 10#${candidate_attempt_release#v} <= 10#${final_prior_release#v} ))',
    "attempt_failure='candidate-release-not-newer-than-final-prior'",
    'elif [[ "$candidate_attempt_image" != "$candidate_image_ref" ]]; then',
    'elif [[ "$candidate_current" == "$last_matching_observation" ]]; then',
    'consecutive_matches=$((consecutive_matches + 1))',
    'if (( consecutive_matches >= required_consecutive_matches )); then',
    'candidate_release="$candidate_attempt_release"',
    'candidate_image="$candidate_attempt_image"',
    'if [[ -n "$attempt_failure" ]]; then',
    'consecutive_matches=0',
    "last_matching_observation=''",
    'sleep "$retry_delay_seconds"',
    'attempt=$((attempt + 1))',
    'return 0',
    'return 1',
  ]) {
    if (!observer.includes(needle)) fail('candidate observer stabilization contract missing ' + needle);
  }
  if (!observer ||
      observer.includes('rollback_now') ||
      observer.includes('verification_failure=') ||
      observer.includes('exit ') ||
      countOf(observer, 'return 0') !== 1 ||
      countOf(observer, 'return 1') !== 1) {
    fail('candidate observer can fail open or initiate destructive rollback before stabilization is exhausted');
  }
  const observerLoop = observer.indexOf('while (( attempt <= max_attempts )); do');
  const observerTopology = observer.indexOf(
    'assert_volume_snapshot_policy "candidate-observer-$attempt"',
    observerLoop,
  );
  const observerReleaseTimeout = observer.indexOf(
    'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
    observerTopology,
  );
  const observerReleaseQuery = observer.indexOf(
    'fly releases --app "$app" --image --json >"$new_json"',
    observerReleaseTimeout,
  );
  const observerBinding = observer.indexOf(
    'candidate_current="$(current_release "$new_json" "$command_timeout_seconds")"',
    observerReleaseQuery,
  );
  const observerReleaseValues = observer.indexOf(
    'IFS=$\'\\t\' read -r candidate_attempt_release candidate_attempt_image <<<"$candidate_current"',
    observerBinding,
  );
  const observerNewRelease = observer.indexOf(
    '(( 10#${candidate_attempt_release#v} <= 10#${final_prior_release#v} ))',
    observerReleaseValues,
  );
  const observerExactImage = observer.indexOf(
    'elif [[ "$candidate_attempt_image" != "$candidate_image_ref" ]]; then',
    observerNewRelease,
  );
  const observerThreshold = observer.indexOf(
    'if (( consecutive_matches >= required_consecutive_matches )); then',
    observerExactImage,
  );
  const observerReleasePublication = observer.indexOf(
    'candidate_release="$candidate_attempt_release"',
    observerThreshold,
  );
  const observerImagePublication = observer.indexOf(
    'candidate_image="$candidate_attempt_image"',
    observerReleasePublication,
  );
  const observerSuccess = observer.indexOf('return 0', observerImagePublication);
  const observerDone = observer.lastIndexOf('done');
  const observerFailure = observer.indexOf('return 1', observerDone);
  const observerMismatchBranch = observer.indexOf('if [[ -n "$attempt_failure" ]]; then', observerExactImage);
  const observerConsecutiveReset = observer.indexOf('consecutive_matches=0', observerMismatchBranch);
  const observerIdentityReset = observer.indexOf("last_matching_observation=''", observerMismatchBranch);
  const observerAttemptIncrement = observer.indexOf('attempt=$((attempt + 1))', observerMismatchBranch);
  if ([observerLoop, observerTopology, observerReleaseTimeout, observerReleaseQuery,
    observerBinding, observerReleaseValues, observerNewRelease, observerExactImage, observerThreshold,
    observerReleasePublication, observerImagePublication,
    observerSuccess, observerDone, observerFailure, observerMismatchBranch, observerConsecutiveReset,
    observerIdentityReset, observerAttemptIncrement].some((offset) => offset < 0) ||
      !(observerLoop < observerTopology &&
        observerTopology < observerReleaseTimeout &&
        observerReleaseTimeout < observerReleaseQuery &&
        observerReleaseQuery < observerBinding &&
        observerBinding < observerReleaseValues &&
        observerReleaseValues < observerNewRelease &&
        observerNewRelease < observerExactImage &&
        observerExactImage < observerThreshold &&
        observerThreshold < observerReleasePublication &&
        observerReleasePublication < observerImagePublication &&
        observerImagePublication < observerSuccess &&
        observerSuccess < observerMismatchBranch &&
        observerMismatchBranch < observerConsecutiveReset &&
        observerConsecutiveReset < observerIdentityReset &&
        observerIdentityReset < observerAttemptIncrement &&
        observerAttemptIncrement < observerDone &&
         observerDone < observerFailure)) {
    fail('candidate observer does not enforce ordered, consecutive, bounded exact observations');
  }
  for (const needle of [
    'local max_attempts=5',
    'local required_consecutive_matches=2',
    'local retry_delay_seconds=10',
    'local command_timeout_seconds=20',
    'while (( attempt <= max_attempts )); do',
    'assert_volume_snapshot_policy "rollback-observer-$attempt"',
    '"$production_volume_id" "$production_machine_id" "$command_timeout_seconds"',
    'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
    'fly releases --app "$app" --image --json >"$rollback_json"',
    'rollback_current="$(current_release "$rollback_json" "$command_timeout_seconds")"',
    'if [[ ! "$rollback_release" =~ ^v[1-9][0-9]*$',
    '|| ! "$candidate_release" =~ ^v[1-9][0-9]*$',
    '|| ! "$final_prior_release" =~ ^v[1-9][0-9]*$ ]]',
    '10#${rollback_release#v} <= 10#${candidate_release#v}',
    '10#${rollback_release#v} <= 10#${final_prior_release#v}',
    "attempt_failure='rollback-release-not-newer-than-candidate-and-final-prior'",
    'elif [[ "$rollback_image_actual" != "$ROLLBACK_IMAGE" ]]; then',
    'elif [[ "$rollback_current" == "$last_matching_observation" ]]; then',
    'consecutive_matches=$((consecutive_matches + 1))',
    'if (( consecutive_matches >= required_consecutive_matches )); then',
    'if [[ -n "$attempt_failure" ]]; then',
    'consecutive_matches=0',
    "last_matching_observation=''",
    'sleep "$retry_delay_seconds"',
    'attempt=$((attempt + 1))',
    'return 0',
    'return 1',
  ]) {
    if (!rollbackObserver.includes(needle)) fail('rollback observer stabilization contract missing ' + needle);
  }
  if (!rollbackObserver ||
      rollbackObserver.includes('rollback_now') ||
      rollbackObserver.includes('verification_failure=') ||
      rollbackObserver.includes('fly deploy ') ||
      rollbackObserver.includes('append_summary ') ||
      rollbackObserver.includes('exit ') ||
      countOf(rollbackObserver, 'return 0') !== 1 ||
      countOf(rollbackObserver, 'return 1') !== 1) {
    fail('rollback observer can fail open or initiate another rollback before stabilization is exhausted');
  }
  const rollbackObserverLoop = rollbackObserver.indexOf('while (( attempt <= max_attempts )); do');
  const rollbackObserverTopology = rollbackObserver.indexOf(
    'assert_volume_snapshot_policy "rollback-observer-$attempt"',
    rollbackObserverLoop,
  );
  const rollbackObserverReleaseTimeout = rollbackObserver.indexOf(
    'timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s"',
    rollbackObserverTopology,
  );
  const rollbackObserverReleaseQuery = rollbackObserver.indexOf(
    'fly releases --app "$app" --image --json >"$rollback_json"',
    rollbackObserverReleaseTimeout,
  );
  const rollbackObserverBinding = rollbackObserver.indexOf(
    'rollback_current="$(current_release "$rollback_json" "$command_timeout_seconds")"',
    rollbackObserverReleaseQuery,
  );
  const rollbackObserverExactImage = rollbackObserver.indexOf(
    'elif [[ "$rollback_image_actual" != "$ROLLBACK_IMAGE" ]]; then',
    rollbackObserverBinding,
  );
  const rollbackObserverNewRelease = rollbackObserver.indexOf(
    '10#${rollback_release#v} <= 10#${candidate_release#v}',
    rollbackObserverBinding,
  );
  const rollbackObserverNewerThanPrior = rollbackObserver.indexOf(
    '10#${rollback_release#v} <= 10#${final_prior_release#v}',
    rollbackObserverNewRelease,
  );
  const rollbackObserverThreshold = rollbackObserver.indexOf(
    'if (( consecutive_matches >= required_consecutive_matches )); then',
    rollbackObserverExactImage,
  );
  const rollbackObserverSuccess = rollbackObserver.indexOf('return 0', rollbackObserverThreshold);
  const rollbackObserverDone = rollbackObserver.lastIndexOf('done');
  const rollbackObserverFailure = rollbackObserver.indexOf('return 1', rollbackObserverDone);
  const rollbackObserverMismatchBranch = rollbackObserver.indexOf(
    'if [[ -n "$attempt_failure" ]]; then',
    rollbackObserverExactImage,
  );
  const rollbackObserverConsecutiveReset = rollbackObserver.indexOf(
    'consecutive_matches=0',
    rollbackObserverMismatchBranch,
  );
  const rollbackObserverIdentityReset = rollbackObserver.indexOf(
    "last_matching_observation=''",
    rollbackObserverMismatchBranch,
  );
  const rollbackObserverAttemptIncrement = rollbackObserver.indexOf(
    'attempt=$((attempt + 1))',
    rollbackObserverMismatchBranch,
  );
  if ([rollbackObserverLoop, rollbackObserverTopology, rollbackObserverReleaseTimeout,
    rollbackObserverReleaseQuery, rollbackObserverBinding,
    rollbackObserverNewRelease, rollbackObserverNewerThanPrior,
    rollbackObserverExactImage, rollbackObserverThreshold, rollbackObserverSuccess,
    rollbackObserverDone, rollbackObserverFailure, rollbackObserverMismatchBranch,
    rollbackObserverConsecutiveReset, rollbackObserverIdentityReset,
    rollbackObserverAttemptIncrement].some((offset) => offset < 0) ||
      !(rollbackObserverLoop < rollbackObserverTopology &&
        rollbackObserverTopology < rollbackObserverReleaseTimeout &&
        rollbackObserverReleaseTimeout < rollbackObserverReleaseQuery &&
        rollbackObserverReleaseQuery < rollbackObserverBinding &&
        rollbackObserverBinding < rollbackObserverNewRelease &&
        rollbackObserverNewRelease < rollbackObserverNewerThanPrior &&
        rollbackObserverNewerThanPrior < rollbackObserverExactImage &&
        rollbackObserverExactImage < rollbackObserverThreshold &&
        rollbackObserverThreshold < rollbackObserverSuccess &&
        rollbackObserverSuccess < rollbackObserverMismatchBranch &&
        rollbackObserverMismatchBranch < rollbackObserverConsecutiveReset &&
        rollbackObserverConsecutiveReset < rollbackObserverIdentityReset &&
        rollbackObserverIdentityReset < rollbackObserverAttemptIncrement &&
        rollbackObserverAttemptIncrement < rollbackObserverDone &&
        rollbackObserverDone < rollbackObserverFailure)) {
    fail('rollback observer does not enforce ordered, consecutive, bounded exact observations');
  }
  if (countOf(deploy, 'local command_timeout_seconds=${2:-60}') !== 1 ||
      countOf(deploy, 'local command_timeout_seconds=${4:-60}') !== 2 ||
      countOf(deploy, '[[ "$command_timeout_seconds" =~ ^([1-9]|[1-5][0-9]|60)$ ]] || return 1') !== 3 ||
      !deploy.includes('assert_topology "$label" "$expected_volume_id" "$expected_machine_id" "$command_timeout_seconds"')) {
    fail('observer command deadlines are not bounded through the release, Machine and topology helpers');
  }
  for (const needle of [
    'local topology_status=0',
    "env -u FLY_API_TOKEN node --input-type=module <<'NODE' || topology_status=$?",
    'if [[ "$topology_status" -ne 0 ]]; then',
    'return "$topology_status"',
    'local policy_status=0',
    "env -u FLY_API_TOKEN node --input-type=module <<'NODE' || policy_status=$?",
    'return "$policy_status"',
  ]) {
    if (!deploy.includes(needle)) fail('observer topology failure propagation missing ' + needle);
  }
  for (const needle of [
    'fly machines list --app "$app" --json',
    "const completeStatuses = new Set(['complete', 'completed', 'success', 'succeeded']);",
    "const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled']);",
    'const seenVersions = new Set();',
    'const releases = rows.map((row) => {',
    "const match = /^v?([1-9][0-9]*)$/.exec(String(rawId));",
    "if (seenVersions.has(version)) throw new Error('Fly returned duplicate numeric release versions');",
    'const inProgress = row.InProgress ?? row.inProgress ?? row.in_progress;',
    'const completed = releases.filter((item) => completeStatuses.has(item.releaseStatus));',
    "if (completed.length === 0) throw new Error('Fly returned no completed release rows');",
    'const latest = completed.reduce((current, item) => item.version > current.version ? item : current);',
    "if (latest.inProgress === true) throw new Error('Latest completed Fly release is still marked in progress');",
    'for (const item of releases.filter((candidate) => candidate.version > latest.version)) {',
    'if (item.inProgress === true || !terminalFailureStatuses.has(item.releaseStatus)) {',
    'if (!Array.isArray(machines) || machines.length !== 1)',
    "if (machineId !== process.env.EXPECTED_MACHINE_ID || machineState !== 'started' ||",
    "registry !== 'registry.fly.io' || repository !== 'assesssuite-production'",
    "!/^sha256:[0-9a-f]{64}$/.test(String(digest))",
    'const configuredImage = machine.config?.image ?? machine.Config?.image;',
    'if (configuredImage !== immutableImage || releaseImage !== immutableImage)',
    'const id = `v${latest.version}`;',
  ]) {
    if (!deploy.includes(needle)) fail('current release selection contract missing ' + needle);
  }
  for (const forbidden of [
    'fly image show ',
    '|| rows[0]',
    'const latest = completed[0]',
    'const latest = releases[0]',
    'if (![immutableImage, tagImage].filter(Boolean).includes(releaseImage))',
  ]) {
    if (deploy.includes(forbidden)) fail('current release selection retains stale control ' + forbidden);
  }
  if (countOf(deploy, "candidate_release=''") !== 1 ||
      countOf(deploy, "candidate_image=''") !== 1 ||
      countOf(deploy, 'candidate_release="$candidate_attempt_release"') !== 1 ||
      countOf(deploy, 'candidate_image="$candidate_attempt_image"') !== 1) {
    fail('candidate release/image globals are not preserved exactly once after observer stabilization');
  }
  const failedCandidateBranch = deploy.indexOf('if [[ "$deploy_status" -ne 0 ]]; then', candidateDeploy);
  const failedCandidateObserver = deploy.indexOf(
    'if ! wait_for_candidate_observer_stabilization; then',
    failedCandidateBranch,
  );
  const failedCandidateSummary = deploy.indexOf(
    'append_summary "FAILED; candidate deploy command exit ${deploy_status}; candidate release was not proved (${candidate_observer_failure:-unknown}); automatic rollback was not attempted"',
    failedCandidateObserver,
  );
  const failedCandidateObserverExit = deploy.indexOf('exit 1', failedCandidateSummary);
  const failedCandidateRollback = deploy.indexOf(
    'if ! rollback_now "fly-deploy-exit-${deploy_status};candidate-proved-at-${candidate_release}"; then',
    failedCandidateObserverExit,
  );
  const verificationFailureInit = deploy.indexOf("verification_failure=''", failedCandidateRollback);
  const failedCandidateAnchoredRollbackBlock =
    '            if ! rollback_now "fly-deploy-exit-${deploy_status};candidate-proved-at-${candidate_release}"; then\n' +
    "              echo 'Automatic image rollback did not verify successfully.' >&2\n" +
    '            fi\n' +
    '            exit 1\n' +
    '          fi\n\n' +
    "          verification_failure=''";
  const failedCandidateAnchoredRollback = deploy.indexOf(
    failedCandidateAnchoredRollbackBlock,
    failedCandidateObserverExit,
  );
  const failedCandidateFinalExit = failedCandidateAnchoredRollback < 0
    ? -1
    : failedCandidateAnchoredRollback +
      failedCandidateAnchoredRollbackBlock.indexOf('            exit 1\n');
  const unprovedCandidateWindow = failedCandidateBranch >= 0 && failedCandidateObserver > failedCandidateBranch
    ? deploy.slice(failedCandidateBranch, failedCandidateObserver)
    : '';
  if ([failedCandidateBranch, failedCandidateObserver, failedCandidateSummary,
    failedCandidateObserverExit, failedCandidateRollback, failedCandidateAnchoredRollback,
    failedCandidateFinalExit,
    verificationFailureInit].some((offset) => offset < 0) ||
      unprovedCandidateWindow.includes('rollback_now') ||
      /\b(?:exit|return)(?:\s|;|$)/m.test(unprovedCandidateWindow) ||
      !(candidateDeploy < failedCandidateBranch &&
        failedCandidateBranch < failedCandidateObserver &&
        failedCandidateObserver < failedCandidateSummary &&
        failedCandidateSummary < failedCandidateObserverExit &&
        failedCandidateObserverExit < failedCandidateRollback &&
        failedCandidateRollback < failedCandidateFinalExit &&
        failedCandidateFinalExit < verificationFailureInit)) {
    fail('failed candidate command can roll back without first proving and preserving the exact candidate release');
  }
  const observerCall = deploy.indexOf(
    'if ! wait_for_candidate_observer_stabilization; then',
    verificationFailureInit,
  );
  const observerTimeoutFailure = deploy.indexOf(
    'verification_failure="candidate-observer-stabilization-timeout:${candidate_observer_failure:-unknown}"',
    observerCall,
  );
  const firstPublicCheck = deploy.indexOf(
    "elif ! read_version 'https://app.assesssuite.com' \"$APPLICATION_SHA\"",
    observerCall,
  );
  const verificationRollback = deploy.indexOf('if [[ -n "$verification_failure" ]]; then', observerCall);
  const preservedCandidateGate = deploy.indexOf(
    'if [[ ! "$candidate_release" =~ ^v[1-9][0-9]*$',
    verificationRollback,
  );
  const preservedCandidateImage = deploy.indexOf(
    '|| "$candidate_image" != "$candidate_image_ref"',
    preservedCandidateGate,
  );
  const preservedCandidateReleaseOrder = deploy.indexOf(
    '(( 10#${candidate_release#v} <= 10#${final_prior_release#v} ))',
    preservedCandidateImage,
  );
  const unprovedCandidateRollbackRefusal = deploy.indexOf(
    'append_summary "FAILED; candidate release was not globally preserved after observer stabilization; automatic rollback was not attempted (${verification_failure})"',
    preservedCandidateReleaseOrder,
  );
  const unprovedCandidateRollbackExit = deploy.indexOf(
    'exit 1',
    unprovedCandidateRollbackRefusal,
  );
  const verificationRollbackCall = deploy.indexOf(
    'if ! rollback_now "$verification_failure"; then',
    verificationRollback,
  );
  const verificationFailureExit = deploy.indexOf('exit 1', verificationRollbackCall);
  const unprovedVerificationRollbackWindow = verificationRollback >= 0 &&
      preservedCandidateGate > verificationRollback
    ? deploy.slice(verificationRollback, preservedCandidateGate)
    : '';
  if ([observerCall, observerTimeoutFailure, firstPublicCheck, verificationRollback,
    preservedCandidateGate, preservedCandidateImage, preservedCandidateReleaseOrder,
    unprovedCandidateRollbackRefusal, unprovedCandidateRollbackExit,
    verificationRollbackCall, verificationFailureExit].some((offset) => offset < 0) ||
      unprovedVerificationRollbackWindow.includes('rollback_now') ||
      !(candidateDeploy < observerCall &&
        observerCall < observerTimeoutFailure &&
        observerTimeoutFailure < firstPublicCheck &&
        firstPublicCheck < verificationRollback &&
        verificationRollback < preservedCandidateGate &&
        preservedCandidateGate < preservedCandidateImage &&
        preservedCandidateImage < preservedCandidateReleaseOrder &&
        preservedCandidateReleaseOrder < unprovedCandidateRollbackRefusal &&
        unprovedCandidateRollbackRefusal < unprovedCandidateRollbackExit &&
        unprovedCandidateRollbackExit < verificationRollbackCall &&
         verificationRollbackCall < verificationFailureExit)) {
    fail('verification rollback can run without a stabilized, globally preserved candidate release');
  }
  const rollbackNowStart = deploy.indexOf('rollback_now() {');
  const rollbackNowEnd = rollbackNowStart < 0
    ? -1
    : deploy.indexOf('[[ "$candidate_image_ref" == "$CANDIDATE_IMAGE_REF" ]]', rollbackNowStart);
  const rollbackNow = rollbackNowStart >= 0 && rollbackNowEnd > rollbackNowStart
    ? deploy.slice(rollbackNowStart, rollbackNowEnd)
    : '';
  const candidateCommandWindow = candidateDeploy >= 0 && failedCandidateBranch > candidateDeploy
    ? deploy.slice(candidateDeploy, failedCandidateBranch)
    : '';
  const exactCandidateDeployCommand =
    'fly deploy "$deploy_source_dir" \\\n' +
    '            --config "$candidate_config" \\\n' +
    '            --strategy immediate \\\n' +
    '            --ha=false \\\n' +
    '            --update-only \\\n' +
    '            --remote-only \\\n' +
    '            --skip-release-command \\\n' +
    '            --app "$app" \\\n' +
    '            --image "$candidate_image_ref" \\\n' +
    '            --yes || deploy_status=$?';
  const exactRollbackDeployCommand =
    'fly deploy "$deploy_source_dir" \\\n' +
    '              --config "$rollback_config" \\\n' +
    '              --strategy immediate \\\n' +
    '              --ha=false \\\n' +
    '              --update-only \\\n' +
    '              --remote-only \\\n' +
    '              --skip-release-command \\\n' +
    '              --app "$app" \\\n' +
    '              --image "$ROLLBACK_IMAGE" \\\n' +
    '              --yes || rollback_command_status=$?';
  if (countOf(candidateCommandWindow, exactCandidateDeployCommand) !== 1 ||
      countOf(candidateCommandWindow, 'fly deploy "$deploy_source_dir"') !== 1 ||
      countOf(rollbackNow, exactRollbackDeployCommand) !== 1 ||
      countOf(rollbackNow, 'fly deploy "$deploy_source_dir"') !== 1) {
    fail('candidate and rollback fly deploy argv are not exactly bound to their scoped config and immutable image');
  }
  const rollbackDeploy = rollbackNow.indexOf('fly deploy "$deploy_source_dir"');
  const rollbackCommandStatusCapture = rollbackNow.indexOf(
    '--yes || rollback_command_status=$?',
    rollbackDeploy,
  );
  const rollbackObserverCall = rollbackNow.indexOf('if ! wait_for_rollback_observer_stabilization; then');
  const rollbackObserverFailureSummary = rollbackNow.indexOf(
    'append_summary "FAILED; rollback command exit ${rollback_command_status}; observer stabilization exhausted (${rollback_observer_failure:-unknown}; $reason)"',
    rollbackObserverCall,
  );
  const rollbackObserverFailureReturn = rollbackNow.indexOf('return 1', rollbackObserverFailureSummary);
  const reconciledRollbackCommandFailure = rollbackNow.indexOf(
    'if [[ "$rollback_command_status" -ne 0 ]]; then',
    rollbackObserverFailureReturn,
  );
  const rollbackPublicCheck = rollbackNow.indexOf(
    "if ! read_version 'https://app.assesssuite.com' \"$ROLLBACK_RELEASE_SHA\"",
    reconciledRollbackCommandFailure,
  );
  const rollbackCommandWindow = rollbackDeploy >= 0 && rollbackObserverCall > rollbackDeploy
    ? rollbackNow.slice(rollbackDeploy, rollbackObserverCall)
    : '';
  if (!rollbackNow ||
      [rollbackDeploy, rollbackCommandStatusCapture, rollbackObserverCall,
        rollbackObserverFailureSummary, rollbackObserverFailureReturn,
        reconciledRollbackCommandFailure, rollbackPublicCheck].some((offset) => offset < 0) ||
      /\b(?:exit|return)(?:\s|;|$)/m.test(rollbackCommandWindow) ||
      !(rollbackDeploy < rollbackCommandStatusCapture &&
        rollbackCommandStatusCapture < rollbackObserverCall &&
        rollbackObserverCall < rollbackObserverFailureSummary &&
        rollbackObserverFailureSummary < rollbackObserverFailureReturn &&
        rollbackObserverFailureReturn < reconciledRollbackCommandFailure &&
        reconciledRollbackCommandFailure < rollbackPublicCheck)) {
    fail('automatic rollback does not always observe, reconcile, or report command and observer status');
  }
  if (!deploy.includes(
    '            if ! rollback_now "$verification_failure"; then\n' +
      "              echo 'Automatic rollback did not verify successfully.' >&2\n" +
      '            fi\n' +
      '            exit 1\n' +
      '          fi',
  )) {
    fail('verification-failure rollback branch does not terminate with its own anchored failure exit');
  }
  for (const forbidden of [
    'assert_volume_snapshot_policy candidate "$production_volume_id" "$production_machine_id"',
    "verification_failure='candidate-topology-or-volume-snapshot-policy-mismatch'",
    "verification_failure='release-query-failed'",
    "verification_failure='release-response-invalid'",
    "verification_failure='deployed-image-mismatch'",
  ]) {
    if (deploy.includes(forbidden)) fail('one-shot candidate observer failure can still reach rollback: ' + forbidden);
  }
  for (const forbidden of [
    'assert_volume_snapshot_policy rollback "$production_volume_id" "$production_machine_id"',
    'rollback_current="$(current_release "$rollback_json")"',
    '[[ "$rollback_image_actual" == "$ROLLBACK_IMAGE" ]]',
  ]) {
    if (rollbackNow.includes(forbidden)) fail('automatic rollback still uses a one-shot observer: ' + forbidden);
  }
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
  const sentryUpload = jobBody('upload_sentry_source_maps');
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
  const liveBaseMarker = `PRODUCTION_BASE_SHA: ${LIVE_PRODUCTION_BASE_SHA}`;
  if (countOf(active, liveBaseMarker) !== 2 || countOf(active, 'PRODUCTION_BASE_SHA: ') !== 2) {
    fail('prepare-release production-base pins do not both match the exact live production source');
  }
  if (countOf(active, 'git merge-base --is-ancestor "$PRODUCTION_BASE_SHA" HEAD') !== 2) {
    fail('prepare-release does not prove live-base ancestry before both differential gates');
  }
  for (const [needle, label] of [
    ['GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.production.toml', 'candidate general clinical AI enabled posture'],
    ['TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.production.toml', 'candidate transcription enabled posture'],
    ['GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.rollback.production.toml', 'rollback general clinical AI enabled posture'],
    ['TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' fly.rollback.production.toml', 'rollback transcription disabled posture'],
  ]) {
    if (countOf(active, needle) !== 1) fail('prepare-release does not enforce the exact ' + label);
  }
  if (JSON.stringify(jobs) !== JSON.stringify(['gates','upload_sentry_source_maps','publish_image','exact_image_compatibility'])) fail('prepare-release job sequence differs: ' + JSON.stringify(jobs));
  if (!sentryUpload.includes('needs: gates') || !publish.includes('needs: [gates, upload_sentry_source_maps]') || !compatibility.includes('needs: [gates, publish_image]')) fail('prepare-release DAG differs');
  if (gates.includes('needs.publish_image') || gates.includes('CANDIDATE_IMAGE_REF:')) fail('gates illegally references downstream publication output');

  const expectedInputs = ['trusted_workflow_sha','application_sha','candidate_config_sha256','rollback_config_sha256','rollback_source_sha','expected_current_image','expected_volume_id','expected_legacy_volume_id','rollback_image','extraction_runtime_mode','provider_terms_attestation','provider_terms_evidence_id','under_age_zdr_runtime_mode','under_age_zdr_attestation','under_age_zdr_evidence_id','capability_intent_id','authority_reference','confirmation'];
  const declaredInputs = [...trigger.matchAll(/^      ([a-z0-9_]+):$/gm)].map((match) => match[1]);
  if (JSON.stringify(declaredInputs.sort()) !== JSON.stringify([...expectedInputs].sort())) fail('prepare-release dispatch interface differs');
  requireText('[[ "$CONFIRMATION" == "PREPARE assesssuite-production EXACT SHA" ]]', 'exact preparation confirmation');
  requireText('[[ "$SOURCE_BRANCH" == "main" ]]', 'fixed main source branch');
  requireText('[[ "$ROLLBACK_SOURCE_BRANCH" == "main" ]]', 'fixed main rollback branch');
  requireText('ROLLBACK_SOURCE_SHA: ${{ inputs.rollback_source_sha }}', 'independent rollback source SHA');
  if (countOf(active, 'ROLLBACK_SOURCE_SHA: ${{ inputs.rollback_source_sha }}') !== 6) fail('prepare-release rollback source is not bound through all gates, receipts and summary');
  requireText('EXPECTED_VOLUME_ID: ${{ inputs.expected_volume_id }}', 'independent active volume ID');
  requireText('EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}', 'independent legacy volume ID');
  if (countOf(active, 'EXPECTED_VOLUME_ID: ${{ inputs.expected_volume_id }}') !== 5 || countOf(active, 'EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}') !== 5) fail('prepare-release volume IDs are not bound through all five gates and receipts');
  requireText('[[ "$EXPECTED_VOLUME_ID" =~ ^vol_[A-Za-z0-9]+$ && "$EXPECTED_LEGACY_VOLUME_ID" =~ ^vol_[A-Za-z0-9]+$ ]]', 'active and legacy volume input shapes');
  requireText('[[ "$EXPECTED_VOLUME_ID" != "$EXPECTED_LEGACY_VOLUME_ID" ]]', 'active and legacy volume distinction');
  requireText('[[ "$ROLLBACK_SOURCE_SHA" != "$APPLICATION_SHA" ]]', 'strictly distinct rollback source');
  requireText('git merge-base --is-ancestor "$ROLLBACK_SOURCE_SHA" "$APPLICATION_SHA"', 'rollback source ancestor proof');
  requireText('[[ "$ROLLBACK_IMAGE" == "$EXPECTED_CURRENT_IMAGE" ]]', 'rollback/current image identity');
  requireText('rollback_source_sha: process.env.ROLLBACK_SOURCE_SHA', 'rollback source receipt binding');
  if (countOf(active, 'rollback_source_sha: process.env.ROLLBACK_SOURCE_SHA') !== 2 || !active.includes('rollback_source_sha: e.ROLLBACK_SOURCE_SHA')) fail('all three prepare-release receipts do not bind rollback source SHA');
  requireText('expected_legacy_volume_id: process.env.EXPECTED_LEGACY_VOLUME_ID', 'legacy volume receipt binding');
  if (countOf(active, 'expected_legacy_volume_id: process.env.EXPECTED_LEGACY_VOLUME_ID') !== 2 || !active.includes('expected_legacy_volume_id: e.EXPECTED_LEGACY_VOLUME_ID')) fail('all three prepare-release receipts do not bind the legacy volume ID');
  requireText('EXPECTED_APP_URL = "https://app.assesssuite.com"', 'exact application URL in both configs');
  if (countOf(active, 'EXPECTED_APP_URL = "https://app.assesssuite.com"') < 2) fail('prepare-release does not validate both exact app URL configs');
  if (publish.includes('io.assesssuite.rollback-proof') || publish.includes('io.assesssuite.trusted-workflow')) fail('prepare-release incorrectly requires rollback-only labels on the frozen current candidate image');
  requireText('source = "assesssuite_data_r12"', 'prepare-release active r12 volume mount source');
  if (!gates.includes("python3 -I - fly.production.toml <<'PY'")) {
    fail('prepare-release gates do not invoke the isolated semantic Fly process contract');
  }
  for (const marker of TOML_PROCESS_CONTRACT_MARKERS) {
    if (!gates.includes(marker)) fail('prepare-release semantic Fly process contract missing ' + marker);
  }
  for (const needle of [
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH"',
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main',
    'timeout --signal=TERM --kill-after=10s 120s git fetch --no-tags --force origin',
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120",
  ]) requireText(needle, 'bounded prepare-release remote operation ' + needle);
  const prepareReleaseFlyctlDownload =
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
    '            --output "$fly_archive" \\\n' +
    "            'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz'";
  const prepareReleaseRegctlDownload =
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
    '            --output "$regctl_binary" \\\n' +
    "            'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64'";
  if (countOf(active, 'git ls-remote') !== 2 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH"') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main') !== 1 ||
      countOf(active, 'git fetch') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 120s git fetch --no-tags --force origin') !== 1 ||
      countOf(active, 'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz') !== 1 ||
      countOf(active, prepareReleaseFlyctlDownload) !== 1 ||
      countOf(active, 'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64') !== 1 ||
      countOf(active, prepareReleaseRegctlDownload) !== 1 ||
      countOf(active, '"$RUNNER_TEMP/fly" auth docker') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s "$RUNNER_TEMP/fly" auth docker') !== 1 ||
      countOf(active, '"$RUNNER_TEMP/regctl" registry login registry.fly.io -u x --pass-stdin') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s "$RUNNER_TEMP/regctl" registry login registry.fly.io -u x --pass-stdin') !== 1 ||
      countOf(active, '"$regctl" image copy --force-recursive "$local_ref" "$new_image_tag"') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=30s 600s "$regctl" image copy --force-recursive "$local_ref" "$new_image_tag"') !== 1 ||
      countOf(active, '"$regctl" image digest "$new_image_tag"') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s "$regctl" image digest "$new_image_tag"') !== 1 ||
      countOf(active, '"$regctl" blob get "$registry_repo" "$digest"') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=30s 600s "$regctl" blob get "$registry_repo" "$digest"') !== 1 ||
      countOf(active, '"$regctl" manifest get "$ROLLBACK_IMAGE" --format raw-body') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=10s 60s "$regctl" manifest get "$ROLLBACK_IMAGE" --format raw-body') !== 1 ||
      countOf(active, '"$regctl" blob get "$registry_repo" "$rollback_image_id"') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=30s 300s "$regctl" blob get "$registry_repo" "$rollback_image_id"') !== 1 ||
      countOf(active, '"$regctl" image export "$ROLLBACK_IMAGE"') !== 1 ||
      countOf(active, 'timeout --signal=TERM --kill-after=30s 600s "$regctl" image export "$ROLLBACK_IMAGE"') !== 1) {
    fail('prepare-release remote operations are not exclusively bound to their reviewed bounded commands');
  }
  for (const needle of [
    'candidate_image_artifact_digest: sha256:${{ steps.upload_candidate.outputs.artifact-digest }}',
    'release_control_artifact_digest: sha256:${{ steps.upload_controls.outputs.artifact-digest }}',
    'publication_artifact_digest: sha256:${{ steps.upload_publication.outputs.artifact-digest }}',
    'compatibility_artifact_digest: sha256:${{ steps.upload_compatibility.outputs.artifact-digest }}',
    'deploy_bundle_artifact_digest: sha256:${{ steps.upload_deploy_bundle.outputs.artifact-digest }}',
    'COMPATIBILITY_ARTIFACT_DIGEST: sha256:${{ steps.upload_compatibility.outputs.artifact-digest }}',
    'DEPLOY_BUNDLE_ARTIFACT_DIGEST: sha256:${{ steps.upload_deploy_bundle.outputs.artifact-digest }}',
  ]) requireText(needle, 'canonical GitHub artifact digest handoff ' + needle);

  const expectedGateSteps = [
    'Validate trusted dispatch context and inputs','Check out exact application SHA','Verify exact SHA and remote branch tip',
    'Set up Node.js 24','Validate Fly and Docker credential/topology boundary','Install locked dependencies',
    'Fail-closed dependency vulnerability audit','Validate the exact trusted workflow control',
    'Require the referral assurance entrypoints and reviewed canary code','Build and verify split-hosting surfaces','Typecheck against exact production-base differential',
    'Lint with exact legacy-baseline containment','Existing deterministic server and entry-guard gates','Existing seeded launch-gate suite',
    'Existing public-evidence service gates','Mission assurance aggregate','Rendered referral browser journey gate',
    'Secret and high-entropy diff scan','Build exact candidate image locally without credentials',
    'Preserve the exact gated candidate image','Preserve sealed release controls',
  ];
  const expectedPublishSteps = ['Download exact gated candidate by immutable artifact ID','Validate and load candidate image as data only','Install checksum-verified flyctl 0.4.71 and regctl 0.11.5 without credentials','Acquire isolated registry credential','Publish immutable image and seal compatibility bundle','Upload sealed publication receipt and rollback image data'];
  const expectedSentrySteps = ['Download exact gated source-map data by immutable artifact ID','Validate and extract sealed source-map data without executing candidate code','Install checksum-verified sentry-cli 3.6.2 without credentials','Upload exact release source maps with the isolated Sentry credential'];
  const expectedCompatibilitySteps = ['Check out exact candidate into the no-secret proof runner','Download exact candidate image by immutable artifact ID','Download exact publication bundle by immutable artifact ID','Set up Node.js 24 for isolated compatibility proof','Verify immutable handoff and run exact-image compatibility proof','Upload bounded compatibility proof receipt','Seal bounded deploy bundle from exact regular files','Upload bounded deploy bundle','Emit immutable publication summary'];
  if (JSON.stringify(stepsIn(gates)) !== JSON.stringify(expectedGateSteps)) fail('prepare-release gate steps differ');
  if (JSON.stringify(stepsIn(sentryUpload)) !== JSON.stringify(expectedSentrySteps)) fail('prepare-release Sentry upload steps differ');
  if (JSON.stringify(stepsIn(publish)) !== JSON.stringify(expectedPublishSteps)) fail('prepare-release publication steps differ');
  if (JSON.stringify(stepsIn(compatibility)) !== JSON.stringify(expectedCompatibilitySteps)) fail('prepare-release compatibility steps differ');
  requireText("for (const script of ['build:platform', 'build:landing', 'verify:split-build', 'test:split-hosting'])", 'complete split-hosting package-script declaration');
  requireText('if (!pkg.scripts?.[script])', 'fail-closed split-hosting package-script check');
  for (const script of ['build:platform', 'build:landing', 'verify:split-build', 'test:split-hosting']) {
    if (!gates.includes(`npm run ${script}`)) fail('prepare-release split-hosting gate is not executed: ' + script);
  }
  if (countOf(active, 'npm run build:platform') !== 2) {
    fail('prepare-release must run the platform build once in baseline gates and once for the sealed Sentry artifact');
  }
  for (const [needle, label] of [
    ['is_prohibited_release_filename() {', 'release filename predicate'],
    ['local normalized=${changed_file,,}', 'case-normalized filename check'],
    ['if [[ "$changed_file" == \'.env.example\' ]]; then', 'exact root .env.example exception'],
    ['"$normalized" =~ (^|/)\\.env($|\\.)', 'all other .env and .env.* filenames prohibited'],
    ['"$normalized" =~ (^|/)(credentials?|secrets?)\\.(json|txt|pem|key)$', 'credential filename prohibition'],
    ['done < <(git diff --name-only -z "$PRODUCTION_BASE_SHA"...HEAD)', 'NUL-safe exact release filename diff'],
    ['if is_prohibited_release_filename "$changed_file"; then', 'filename predicate invocation'],
    ['if [[ -s "$prohibited_file_list" ]]; then', 'nonempty prohibited filename refusal'],
    ['git diff --binary "$PRODUCTION_BASE_SHA"...HEAD >"$RUNNER_TEMP/release.diff"', 'unfiltered release content scan input'],
  ]) requireText(needle, label);
  if (active.includes('*/.env.example') || active.includes(':!.env.example')) {
    fail('prepare-release broadens or removes the one exact root .env.example content-scanned exception');
  }

  const actions = [...active.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)].map((match) => match[1]);
  if (actions.length !== 13) fail('prepare-release pinned action count differs');
  for (const action of actions) if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(action)) fail('prepare-release action is not SHA pinned: ' + action);
  if (countOf(active, '${{ secrets.FLY_API_TOKEN }}') !== 1 || countOf(active, '${{ secrets.SENTRY_DSN }}') !== 1 || countOf(active, '${{ secrets.SENTRY_AUTH_TOKEN }}') !== 1 || countOf(active, '${{ secrets.') !== 3) fail('prepare-release Sentry and Fly credential expressions differ');
  if (countOf(gates, '${{ secrets.SENTRY_DSN }}') !== 1 || gates.includes('${{ secrets.FLY_API_TOKEN }}') || gates.includes('${{ secrets.SENTRY_AUTH_TOKEN }}') ||
      countOf(sentryUpload, '${{ secrets.SENTRY_AUTH_TOKEN }}') !== 1 || sentryUpload.includes('${{ secrets.FLY_API_TOKEN }}') || sentryUpload.includes('${{ secrets.SENTRY_DSN }}') ||
      publish.includes('${{ secrets.SENTRY_AUTH_TOKEN }}') || publish.includes('${{ secrets.SENTRY_DSN }}') || compatibility.includes('${{ secrets.') || /(^|\n)\s+FLY_API_TOKEN:\s/.test(compatibility)) fail('prepare-release credential placement differs');
  const candidateBuildStep = parseSteps(gates, failures).find((step) => step.name === 'Build exact candidate image locally without credentials')?.body || '';
  if (countOf(candidateBuildStep, 'SENTRY_DSN: ${{ secrets.SENTRY_DSN }}') !== 1 || candidateBuildStep.includes('SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}') || candidateBuildStep.includes('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}')) fail('public Sentry DSN is not isolated to the candidate build gate');
  const parsedSentrySteps = parseSteps(sentryUpload, failures);
  const sentryDataStep = parsedSentrySteps.find((step) => step.name === 'Validate and extract sealed source-map data without executing candidate code')?.body || '';
  const sentryInstallStep = parsedSentrySteps.find((step) => step.name === 'Install checksum-verified sentry-cli 3.6.2 without credentials')?.body || '';
  const sentryCredentialStep = parsedSentrySteps.find((step) => step.name === 'Upload exact release source maps with the isolated Sentry credential')?.body || '';
  if (sentryUpload.includes('actions/checkout@') || /(^|\n)\s*(?:npm|npx|docker)\s/.test(sentryUpload) || sentryUpload.includes('working-directory:') ||
      /(^|\n)\s*node\s+(?:candidate|server|scripts)\//.test(sentryUpload)) fail('fresh Sentry runner can execute candidate or repository code');
  if (sentryDataStep.includes('${{ secrets.') || sentryInstallStep.includes('${{ secrets.') || countOf(sentryCredentialStep, '${{ secrets.SENTRY_AUTH_TOKEN }}') !== 1 ||
      sentryCredentialStep.includes('${{ secrets.FLY_API_TOKEN }}') || sentryCredentialStep.includes('${{ secrets.SENTRY_DSN }}')) fail('Sentry auth token is not isolated to the final upload step');
  if (sentryCredentialStep.includes('python3 ') || sentryCredentialStep.includes('node ') || sentryCredentialStep.includes('curl ') || sentryCredentialStep.includes('tar ')) fail('credentialed Sentry step can execute unverified tooling or parse candidate data');
  if (publish.includes('actions/checkout@') || /(^|\n)\s*(npm|npx)\s/.test(publish) ||
      /(^|\n)\s*docker\s+(?:build|run|create|start|exec)\b/.test(publish) || publish.includes('fly deploy ')) {
    fail('credentialed publication job can execute candidate code or mutate production');
  }
  if (countOf(publish, 'DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config') !== 1 ||
      countOf(publish, 'REGCTL_CONFIG: ${{ runner.temp }}/publication-regctl-config.json') !== 2 ||
      !publish.includes('rm -f "$derived_token" "$DOCKER_CONFIG/config.json"') ||
      !publish.includes('rm -f "$REGCTL_CONFIG"') || !publish.includes('[[ ! -e "$REGCTL_CONFIG" ]]') ||
      publish.includes('DOCKER_CONFIG: ~/.docker') || publish.includes('REGCTL_CONFIG: ~/.regctl')) {
    fail('publication registry credential isolation differs');
  }
  const authOffset = publish.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const pushOffset = publish.indexOf('Publish immutable image and seal compatibility bundle');
  const credentialInputMarker = 'FLY_API_' + 'TOKEN:';
  if (authOffset < 0 || pushOffset < 0 || authOffset > pushOffset || publish.slice(pushOffset).includes(credentialInputMarker)) fail('Fly token leaks into publication processing');
  if (publish.includes('printf \'%s\' "$FLY_API_TOKEN"') || publish.includes('<<<"$FLY_API_TOKEN"')) {
    fail('long-lived Fly API token is used directly as a registry credential');
  }
  for (const needle of [
    "'a782dceed173d215c000ab94e2b08623c22267edff6d90ebe3010b3f9b671dc2'",
    "'c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467'",
    'fly_version="$("$RUNNER_TEMP/fly" version)"',
    "grep -E '^[^[:space:]]+[[:space:]]+v0\\.4\\.71[[:space:]]+linux/amd64([[:space:]]|$)'",
    'timeout --signal=TERM --kill-after=10s 60s "$RUNNER_TEMP/fly" auth docker',
    "config.auths?.['registry.fly.io']?.auth",
    "username !== 'x' || !credential.startsWith('fm2_')",
    "fs.writeFileSync(process.env.DERIVED_TOKEN, credential, { flag: 'wx', mode: 0o600 })",
    'env -u FLY_API_TOKEN timeout --signal=TERM --kill-after=10s 60s "$RUNNER_TEMP/regctl" registry login registry.fly.io -u x --pass-stdin',
    '<"$derived_token" >/dev/null',
    'unset FLY_API_TOKEN',
    '[[ ! -e "$derived_token" && ! -e "$DOCKER_CONFIG" ]]',
    "tarfile.open(archive_path, mode='r:gz')",
    'not (member.isdir() or member.isfile())',
    "destination.open('xb')",
    "row.mediaType !== 'application/vnd.oci.image.manifest.v1+json'",
    'row.config?.digest !== process.env.CANDIDATE_IMAGE_ID',
    '"$regctl" image copy --force-recursive "$local_ref" "$new_image_tag"',
    '[[ "$remote_digest" == "$candidate_registry_digest" ]]',
    'cmp --silent "$local_blob" "$remote_blob"',
    'trap cleanup_registry_auth EXIT',
    '"$regctl" registry logout registry.fly.io >/dev/null 2>&1 || true',
    '--name "assesssuite-rollback:$ROLLBACK_SOURCE_SHA"',
  ]) if (!publish.includes(needle)) fail('prepare-release canonical OCI publication boundary missing ' + needle);

  for (const needle of [
    'artifact-ids: ${{ needs.gates.outputs.candidate_image_artifact_id }}',
    'artifact-ids: ${{ needs.publish_image.outputs.publication_artifact_id }}',
    '[[ -z "${FLY_API_TOKEN:-}" ]]', 'npm run test:forward-rollback-compatibility',
    '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -eq 1 ]]',
    'release_control_artifact_id: process.env.RELEASE_CONTROL_ARTIFACT_ID',
    'release_control_artifact_digest: process.env.RELEASE_CONTROL_ARTIFACT_DIGEST',
    "schema_version: 'assesssuite.exact-image-compatibility-receipt.v2'",
    'expected_volume_id: process.env.EXPECTED_VOLUME_ID',
    'expected_legacy_volume_id: process.env.EXPECTED_LEGACY_VOLUME_ID',
  ]) if (!compatibility.includes(needle)) fail('prepare-release compatibility boundary missing ' + needle);
  requireText("schema_version: 'assesssuite.image-publication-receipt.v2'", 'prepare-release publication receipt v2');
  for (const needle of [
    "schema_version: 'assesssuite.deploy-bundle-manifest.v2'", "result: 'PASS'",
    "expected_files=$'candidate-build-receipt.json\\ncompatibility-receipt.json\\ndeploy-bundle-manifest.json\\nfly.production.toml\\nfly.rollback.production.toml\\npublication-receipt.json\\nsentry-source-map-manifest.json'",
    '[[ "$actual_files" == "$expected_files" ]]', 'name: deploy-bundle-${{ needs.gates.outputs.application_sha }}',
    'retention-days: 3', 'path: ${{ runner.temp }}/deploy-bundle',
    'deploy_bundle_artifact_id: ${{ steps.upload_deploy_bundle.outputs.artifact-id }}',
    'deploy_bundle_artifact_digest: sha256:${{ steps.upload_deploy_bundle.outputs.artifact-digest }}',
    'deploy_bundle_manifest_sha256: ${{ steps.bundle.outputs.deploy_bundle_manifest_sha256 }}',
    'APPLICATION_IMAGE_DIGEST: ${{ needs.publish_image.outputs.candidate_registry_digest }}',
    'application_image_digest: e.APPLICATION_IMAGE_DIGEST,',
  ]) if (!compatibility.includes(needle)) fail('prepare-release deploy-bundle boundary missing ' + needle);
  for (const needle of [
    'VITE_SENTRY_DSN="$SENTRY_DSN" VITE_SENTRY_RELEASE="$APPLICATION_SHA" VITE_SENTRY_ENVIRONMENT=production',
    './node_modules/.bin/sentry-cli sourcemaps inject dist',
    '--build-arg "SENTRY_DSN=$SENTRY_DSN"', "schema_version: 'assesssuite.sentry-source-map-manifest.v1'",
    "schema_version: 'assesssuite.candidate-build-receipt.v3'", 'source_map_manifest_sha256', 'source_map_archive_sha256',
    "docker export \"$image_container\" | tar -tf - | grep -Eq '(^|/)[^/]+\\.map$'",
    "throw new Error('Byte-proven JavaScript differs from the exact candidate image output')",
    'install -m 0600 "$source_map_manifest" "$RUNNER_TEMP/release-control/sentry-source-map-manifest.json"',
    '${{ runner.temp }}/sentry-source-map-manifest.json', '${{ runner.temp }}/sentry-source-maps.tar.gz',
    "parsed.hostname !== 'o4511822688813056.ingest.us.sentry.io'", "parsed.pathname !== '/4511827129663488'",
    "!/^[0-9a-f]{32}$/.test(parsed.username)",
  ]) requireText(needle, 'prepare-release source-map control ' + needle);
  for (const needle of [
    'artifact-ids: ${{ needs.gates.outputs.candidate_image_artifact_id }}',
    "expected_files=$'candidate-build-receipt.json\\ncandidate-image.tar.gz\\ncandidate-image.tar.gz.sha256\\nsentry-source-map-manifest.json\\nsentry-source-maps.tar.gz'",
    'Source-map archive contains a non-data member', 'Source-map archive file set differs',
    'Runtime JavaScript debug ID does not match its source map',
    "'https://github.com/getsentry/sentry-cli/releases/download/3.6.2/sentry-cli-Linux-x86_64'",
    "'3a4bbf2c0d06378d4e59b337647483751a0a2b1603db5fd4991847d0cfd6478c'",
    'SENTRY_ORG: unimatter', 'SENTRY_PROJECT: assesssuite-production',
    '"$sentry_cli" sourcemaps upload', '--release "$APPLICATION_SHA"', "--url-prefix '~/assets'", '--validate',
    '"$sentry_cli" releases finalize "$APPLICATION_SHA"',
  ]) if (!sentryUpload.includes(needle)) fail('fresh-runner Sentry upload control missing ' + needle);
  if (compatibility.includes('copy_regular candidate/server') || compatibility.includes('copy_regular candidate/src') || compatibility.includes('copy_regular candidate/scripts')) fail('deploy bundle can include application code');
  if (compatibility.includes('rollback-image.tar.gz') && compatibility.slice(compatibility.indexOf('Seal bounded deploy bundle')).includes('rollback-image.tar.gz')) fail('deploy bundle contains image archive data');
  if (active.includes('UPLOAD_AUDIT_LEGAL_HOLD') || active.includes('continue-on-error:') || active.includes('set -x') || active.includes('set -o xtrace')) fail('prepare-release has extra app secret or fail-open/logging control');
  return failures;
}

function deployMutationCasesV2(source) {
  const cases = [];
  const replace = (name, from, to) => cases.push({ name, mutate: (value) => replaceOnce(value, from, to, name) });
  const replaceWithin = (name, startMarker, endMarker, from, to) => cases.push({
    name,
    mutate: (value) => {
      if (countOf(value, startMarker) !== 1 || countOf(value, endMarker) !== 1) {
        throw new Error(`mutation ${name} could not isolate its function boundary`);
      }
      const start = value.indexOf(startMarker);
      const end = value.indexOf(endMarker, start + startMarker.length);
      if (start < 0 || end <= start) throw new Error(`mutation ${name} has an invalid function boundary`);
      const body = value.slice(start, end);
      return value.slice(0, start) + replaceOnce(body, from, to, name) + value.slice(end);
    },
  });
  const replaceEvery = (name, from, to, expected) => cases.push({
    name,
    mutate: (value) => {
      const found = countOf(value, from);
      if (found !== expected) {
        throw new Error(`mutation ${name} expected ${expected} targets, found ${found}`);
      }
      return value.replaceAll(from, to);
    },
  });
  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  actions: read\n  contents: read', 'permissions:\n  actions: write\n  contents: write');
  replace('input-interface-expanded', '      confirmation:\n', '      unsafe_override:\n        required: true\n        type: string\n      confirmation:\n');
  replace('extra-job', '\njobs:\n  deploy:\n', '\njobs:\n  unsafe:\n    runs-on: ubuntu-24.04\n  deploy:\n');
  replace('checkout-injected', '    steps:\n      - name: Record the rollback-reserved deployment-job deadline', '    steps:\n      - name: Unauthorized checkout\n        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n      - name: Record the rollback-reserved deployment-job deadline');
  replace('npm-injected', '          app=assesssuite-production\n          release_control_dir="$RUNNER_TEMP/deploy-bundle"', '          npm ci\n          app=assesssuite-production\n          release_control_dir="$RUNNER_TEMP/deploy-bundle"');
  replace('sentry-auth-token-injected', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}\n          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}');
  replace('dashboard-github-secret-removed', '          ASSESSSUITE_DASHBOARD_METRICS_TOKEN: ${{ secrets.ASSESSSUITE_DASHBOARD_METRICS_TOKEN }}\n', '');
  replace('dashboard-token-length-gate-weakened', 'byteLength < 32 || byteLength > 4096', 'byteLength < 8 || byteLength > 4096');
  replace('deploy-sentry-dsn-host-mutated', "parsed.hostname !== 'o4511822688813056.ingest.us.sentry.io'", "parsed.hostname !== 'example.invalid'");
  replace('deploy-sentry-dsn-project-mutated', "parsed.pathname !== '/4511827129663488'", "parsed.pathname !== '/0'");
  replace(
    'pre-dashboard-initial-state-rejected-before-staging',
    '          elif [[ "$initial_boundary_state" != \'settled\' && "$initial_boundary_state" != \'pre-dashboard\' ]]; then',
    '          elif [[ "$initial_boundary_state" != \'settled\' ]]; then',
  );
  replace('docker-injected', '          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"', '          docker run candidate\n          install -d -m 0700 "$RUNNER_TEMP/empty-deploy-context"');
  replace('in-run-needs-injected', '    runs-on: ubuntu-24.04\n', '    needs: publish_image\n    runs-on: ubuntu-24.04\n');
  replace('bundle-download-by-name', '          artifact-ids: ${{ inputs.deploy_bundle_artifact_id }}', '          name: deploy-bundle');
  replace('bundle-download-merge-disabled', '          merge-multiple: true', '          merge-multiple: false');
  replace('bundle-download-run-id-removed', '          run-id: ${{ inputs.preparation_run_id }}\n', '');
  replace('bundle-download-token-removed', '          github-token: ${{ github.token }}\n', '');
  replace('bundle-download-repository-changed', '          repository: mbvidler-ctrl/assesssuite_migration', '          repository: attacker/fork');
  replace('run-path-bypass', "          same(row.path, '.github/workflows/production-prepare-release.yml', 'workflow path');", '          true;');
  replace('run-success-bypass', "          same(row.conclusion, 'success', 'conclusion');", '          true;');
  replace('run-head-bypass', "          same(row.head_sha, process.env.APPLICATION_SHA, 'head SHA');", '          true;');
  replace('run-actor-bypass', "          same(row.actor?.login, 'mbvidler-ctrl', 'actor');", '          true;');
  replace('artifact-digest-bypass', "          same(row.digest, process.env.DEPLOY_BUNDLE_ARTIFACT_DIGEST, 'digest');", '          true;');
  replace('artifact-digest-shape-weakened', '[[ "$DEPLOY_BUNDLE_ARTIFACT_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]', '[[ "$DEPLOY_BUNDLE_ARTIFACT_DIGEST" =~ ^[0-9a-f]{64}$ ]]');
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
  replaceEvery('rollback-source-input-rebound-to-candidate', '          ROLLBACK_SOURCE_SHA: ${{ inputs.rollback_source_sha }}', '          ROLLBACK_SOURCE_SHA: ${{ inputs.application_sha }}', 3);
  replaceEvery('legacy-volume-input-rebound-to-active', '          EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}', '          EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_volume_id }}', 3);
  replace('volume-id-distinction-bypassed', '          [[ "$EXPECTED_VOLUME_ID" != "$EXPECTED_LEGACY_VOLUME_ID" ]]', '          true');
  replaceEvery('derived-rollback-release-rebound-to-candidate', '          ROLLBACK_RELEASE_SHA: ${{ inputs.rollback_source_sha }}', '          ROLLBACK_RELEASE_SHA: ${{ inputs.application_sha }}', 2);
  replace('rollback-image-current-identity-bypassed', '          [[ "$ROLLBACK_IMAGE" == "$EXPECTED_CURRENT_IMAGE" ]]', '          true');
  replace('rollback-ancestor-merge-base-bypassed', '              row.merge_base_commit?.sha !== process.env.ROLLBACK_SOURCE_SHA ||', '              false ||');
  replace('manifest-rollback-source-bypass', "          same(manifest.rollback_source_sha, e.ROLLBACK_SOURCE_SHA, 'Manifest rollback source SHA');", '          true;');
  replace('manifest-legacy-volume-bypass', "          same(manifest.expected_legacy_volume_id, e.EXPECTED_LEGACY_VOLUME_ID, 'Manifest legacy volume ID');", '          true;');
  replace('manifest-expected-current-rollback-image-bypass', "          same(manifest.rollback_image_ref, e.EXPECTED_CURRENT_IMAGE, 'Manifest expected current image ref');", '          true;');
  replace('pre-mutation-app-version-rebound-to-candidate', "read_version 'https://app.assesssuite.com' \"$ROLLBACK_SOURCE_SHA\" \"$RUNNER_TEMP/pre-mutation-app-version.json\"", "read_version 'https://app.assesssuite.com' \"$APPLICATION_SHA\" \"$RUNNER_TEMP/pre-mutation-app-version.json\"");
  replace('postrollback-old-landing-marker-removed', "              'Exercise Physiology at its Clinical Best.',", "              'unrelated marker',");
  replace('postrollback-legal-app-routes-removed', '              for route in legal/privacy login; do', '              for route in root-only; do');
  replace('postrollback-topology-check-removed', '            if ! assert_volume_snapshot_policy postrollback "$EXPECTED_VOLUME_ID" "$EXPECTED_MACHINE_ID"; then', '            if false; then');
  replace(
    'candidate-entry-asset-parser-weakened',
    "if (!match || !/^\\/assets\\/[A-Za-z0-9._-]+\\.js$/.test(match[1])) {",
    "if (!match || !match[1].startsWith('/assets/')) {",
  );
  replace('candidate-map-target-fabricated', '"$url${asset_path}.map"', '"$url/assets/fabricated.js.map"');
  replace('candidate-map-status-bypassed', '[[ "$map_status" == \'404\' ]] || return 1', 'true # map status bypassed');
  replace('candidate-map-body-bypassed', '[[ "$(<"$map_body")" == \'{"message":"not found"}\' ]] || return 1', 'true # map body bypassed');
  replace('candidate-traversal-target-substituted', '"$url/assets%2F..%2Findex.html"', '"$url/assets/definitely-missing.js"');
  replace('candidate-traversal-status-bypassed', '[[ "$traversal_status" == \'404\' ]] || return 1', 'true # traversal status bypassed');
  replace('candidate-traversal-body-bypassed', '[[ "$(<"$traversal_body")" == \'{"message":"not found"}\' ]] || return 1', 'true # traversal body bypassed');
  replace('candidate-traversal-path-normalisation-reenabled', 'curl --path-as-is --silent --show-error --max-time 10 --max-filesize 65536', 'curl --silent --show-error --max-time 10 --max-filesize 65536');
  replace("candidate-direct-fly-public-surface-rebound", "read_public_surface 'https://assesssuite-production.fly.dev' 'fly'", "read_public_surface 'https://app.assesssuite.com' 'fly'");
  replace('candidate-expected-app-url-check-removed', '          [[ "$(grep -Fxc \'  EXPECTED_APP_URL = "https://app.assesssuite.com"\' "$candidate_config")" -eq 1 ]]', '          true');
  replace('app-url-secret-staging-mutated', 'fly secrets set APP_URL=https://app.assesssuite.com SENTRY_DSN="$SENTRY_DSN" ASSESSSUITE_DASHBOARD_METRICS_TOKEN="$ASSESSSUITE_DASHBOARD_METRICS_TOKEN" --stage --app "$app"', 'fly secrets set APP_URL=https://assesssuite.com SENTRY_DSN="$SENTRY_DSN" ASSESSSUITE_DASHBOARD_METRICS_TOKEN="$ASSESSSUITE_DASHBOARD_METRICS_TOKEN" --stage --app "$app"');
  replace('dashboard-token-not-staged', ' SENTRY_DSN="$SENTRY_DSN" ASSESSSUITE_DASHBOARD_METRICS_TOKEN="$ASSESSSUITE_DASHBOARD_METRICS_TOKEN" --stage', ' SENTRY_DSN="$SENTRY_DSN" --stage');
  replace('dashboard-token-separate-restart', '          deploy_status=0', '          fly machine restart --app "$app"\n          deploy_status=0');
  replace('postactivation-secret-boundary-removed', '          elif ! assert_secret_name_boundary postactivation forbid; then', '          elif false; then');
  replace(
    'mutable-candidate-ref',
    '          PREPARATION_RUN_ID: ${{ inputs.preparation_run_id }}\n          CANDIDATE_IMAGE_REF: registry.fly.io/assesssuite-production@${{ inputs.application_image_digest }}',
    '          PREPARATION_RUN_ID: ${{ inputs.preparation_run_id }}\n          CANDIDATE_IMAGE_REF: registry.fly.io/assesssuite-production:latest',
  );
  replace('secret-injected-before-receipt', '          GH_TOKEN: ${{ github.token }}', '          GH_TOKEN: ${{ github.token }}\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  replace('remote-only-removed', '              --remote-only \\\n', '');
  replace('skip-release-command-removed', '              --skip-release-command \\\n', '');
  replace('empty-context-replaced', 'fly deploy "$deploy_source_dir" \\\n            --config "$candidate_config"', 'fly deploy "$GITHUB_WORKSPACE/candidate" \\\n            --config "$candidate_config"');
  replace('secret-allowlist-extra', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n          ];", "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY', 'UPLOAD_AUDIT_LEGAL_HOLD',\n          ];");
  replace('dashboard-token-final-allowlist-removed', "            'OPENAI_API_KEY', 'SENTRY_DSN', 'ASSESSSUITE_DASHBOARD_METRICS_TOKEN',", "            'OPENAI_API_KEY', 'SENTRY_DSN',");
  replace('integration-encryption-key-final-allowlist-removed', "            'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY',\n", '');
  replace(
    'secret-allowlist-legal-metadata-reintroduced',
    "const transitionPending = JSON.stringify([...required, 'GENERAL_CLINICAL_LLM_ENABLED'].sort());",
    "const transitionPending = JSON.stringify([...required, 'GENERAL_CLINICAL_LLM_ENABLED', 'LEGAL_STATUS', 'LEGAL_EFFECTIVE_DATE'].sort());",
  );
  replace(
    'settled-retry-refused',
    'if (observed === settled) {',
    'if (false) {',
  );
  replace(
    'general-clinical-llm-secret-removal-omitted',
    'fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"',
    'true # GENERAL_CLINICAL_LLM_ENABLED staged-secret removal omitted',
  );
  replace(
    'predeploy-snapshot-identity-unbound',
    'production_volume_id="$EXPECTED_VOLUME_ID"\n' +
      '          production_machine_id="$EXPECTED_MACHINE_ID"',
    "production_volume_id=''\n" +
      "          production_machine_id=''",
  );
  cases.push({
    name: 'general-clinical-llm-secret-removal-premature',
    mutate: (value) => {
      const withoutRemoval = replaceOnce(
        value,
        '          timeout --signal=TERM --kill-after=10s 60s \\\n              fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"\n',
        '',
        'general-clinical-llm-secret-removal-premature',
      );
      return replaceOnce(
        withoutRemoval,
        '          deploy_job_elapsed_seconds=$(( $(date -u +%s) - DEPLOY_JOB_STARTED_EPOCH ))',
        '          timeout --signal=TERM --kill-after=10s 60s \\\n            fly secrets unset GENERAL_CLINICAL_LLM_ENABLED --stage --app "$app"\n\n          deploy_job_elapsed_seconds=$(( $(date -u +%s) - DEPLOY_JOB_STARTED_EPOCH ))',
        'general-clinical-llm-secret-removal-premature',
      );
    },
  });
  replaceEvery(
    'process-contract-rollback-config-dropped',
    '          assert_fly_process_contract "$candidate_config" "$rollback_config"',
    '          assert_fly_process_contract "$candidate_config"',
    2,
  );
  replaceEvery(
    'process-contract-parser-bypassed',
    '              document = tomllib.load(stream)',
    '              document = {}',
    2,
  );
  replaceEvery(
    'process-contract-dictionary-recursion-removed',
    '                      entries.extend(process_entries(nested, next_path))',
    '                      true',
    2,
  );
  replaceEvery(
    'process-contract-array-recursion-removed',
    '                  entries.extend(process_entries(nested, path + (index,)))',
    '                  true',
    2,
  );
  replaceEvery(
    'process-contract-argv-narrowed-to-first-config',
    '          for raw_path in sys.argv[1:]:',
    '          for raw_path in sys.argv[1:2]:',
    2,
  );
  replaceEvery(
    'process-contract-exact-selector-weakened',
    "              if process_entries(document) != [(('http_service', 'processes'), ['app'])]:",
    "              if False:",
    2,
  );
  replace(
    'release-reader-all-rows-bypass',
    '          const releases = rows.map((row) => {',
    '          const releases = rows.slice(0, 1).map((row) => {',
  );
  replace(
    'release-reader-numeric-version-bypass',
    "            const match = /^v?([1-9][0-9]*)$/.exec(String(rawId));",
    "            const match = /^v?(.+)$/.exec(String(rawId));",
  );
  replace(
    'release-reader-duplicate-version-bypass',
    "            if (seenVersions.has(version)) throw new Error('Fly returned duplicate numeric release versions');",
    '            if (false) throw new Error();',
  );
  replace(
    'release-reader-unknown-higher-state-accepted',
    "          const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled']);",
    "          const terminalFailureStatuses = new Set(['failed', 'failure', 'cancelled', 'canceled', 'pending']);",
  );
  replace(
    'release-reader-higher-state-bypass',
    '            if (item.inProgress === true || !terminalFailureStatuses.has(item.releaseStatus)) {',
    '            if (false) {',
  );
  replace(
    'release-reader-machine-query-replaced',
    '              fly machines list --app "$app" --json >"$machine_json"; then',
    '              fly image show --app "$app" --json >"$machine_json"; then',
  );
  replace(
    'release-reader-sole-machine-bypass',
    "          if (!Array.isArray(machines) || machines.length !== 1) throw new Error('Fly returned a non-sole Machine inventory');",
    '          if (false) throw new Error();',
  );
  replace(
    'release-reader-machine-identity-bypass',
    '          if (machineId !== process.env.EXPECTED_MACHINE_ID || machineState !== \'started\' ||',
    '          if (false || machineState !== \'started\' ||',
  );
  replace(
    'release-reader-machine-state-bypass',
    '          if (machineId !== process.env.EXPECTED_MACHINE_ID || machineState !== \'started\' ||',
    '          if (machineId !== process.env.EXPECTED_MACHINE_ID || false ||',
  );
  replace(
    'release-reader-machine-image-ref-bypass',
    "              registry !== 'registry.fly.io' || repository !== 'assesssuite-production' ||",
    '              false ||',
  );
  replace(
    'release-reader-machine-digest-bypass',
    '              !/^sha256:[0-9a-f]{64}$/.test(String(digest))) {',
    '              false) {',
  );
  replace(
    'release-reader-release-config-image-binding-bypass',
    '          if (configuredImage !== immutableImage || releaseImage !== immutableImage) {',
    '          if (false) {',
  );
  const candidateObserverFunction = 'wait_for_candidate_observer_stabilization() {';
  const rollbackObserverFunction = 'wait_for_rollback_observer_stabilization() {';
  const observerFunctionsEnd = 'append_summary() {';
  replace(
    'observer-topology-status-propagation-removed',
    "              env -u FLY_API_TOKEN node --input-type=module <<'NODE' || topology_status=$?",
    "              env -u FLY_API_TOKEN node --input-type=module <<'NODE'",
  );
  replaceWithin(
    'observer-max-attempts-reduced-to-one',
    candidateObserverFunction,
    rollbackObserverFunction,
    '            local max_attempts=5',
    '            local max_attempts=1',
  );
  replaceWithin(
    'observer-consecutive-matches-reduced-to-one',
    candidateObserverFunction,
    rollbackObserverFunction,
    '            local required_consecutive_matches=2',
    '            local required_consecutive_matches=1',
  );
  replaceWithin(
    'observer-command-timeout-expanded',
    candidateObserverFunction,
    rollbackObserverFunction,
    '            local command_timeout_seconds=20',
    '            local command_timeout_seconds=60',
  );
  replaceWithin(
    'observer-early-success-exit',
    candidateObserverFunction,
    rollbackObserverFunction,
    '            while (( attempt <= max_attempts )); do',
    '            exit 0\n            while (( attempt <= max_attempts )); do',
  );
  replace(
    'observer-topology-bypass',
    '              if ! assert_volume_snapshot_policy "candidate-observer-$attempt" \\\n' +
      '                "$production_volume_id" "$production_machine_id" "$command_timeout_seconds"; then',
    '              if false; then',
  );
  replace(
    'observer-release-machine-binding-bypass',
    '              elif ! candidate_current="$(current_release "$new_json" "$command_timeout_seconds")"; then',
    '              elif false; then',
  );
  replace(
    'observer-release-timeout-removed',
    '              elif ! timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s" \\\n' +
      '                fly releases --app "$app" --image --json >"$new_json"; then',
    '              elif ! fly releases --app "$app" --image --json >"$new_json"; then',
  );
  replace(
    'observer-completed-release-filter-bypass',
    '          const completed = releases.filter((item) => completeStatuses.has(item.releaseStatus));',
    '          const completed = releases;',
  );
  replace(
    'observer-latest-completed-release-selection-bypass',
    '          const latest = completed.reduce((current, item) => item.version > current.version ? item : current);',
    '          const latest = completed[0];',
  );
  replace(
    'observer-latest-completed-inprogress-bypass',
    "          if (latest.inProgress === true) throw new Error('Latest completed Fly release is still marked in progress');",
    '          if (false) throw new Error();',
  );
  replace(
    'observer-exact-image-bypass',
    '                elif [[ "$candidate_attempt_image" != "$candidate_image_ref" ]]; then',
    '                elif false; then',
  );
  replace(
    'observer-candidate-new-release-proof-bypass',
    '                  || (( 10#${candidate_attempt_release#v} <= 10#${final_prior_release#v} )); then',
    '                  || false; then',
  );
  replace(
    'observer-candidate-release-published-before-threshold',
    '                  if (( consecutive_matches >= required_consecutive_matches )); then\n' +
      '                    candidate_release="$candidate_attempt_release"',
    '                  candidate_release="$candidate_attempt_release"\n' +
      '                  if (( consecutive_matches >= required_consecutive_matches )); then',
  );
  replace(
    'observer-consecutive-observation-identity-bypass',
    '                elif [[ "$candidate_current" == "$last_matching_observation" ]]; then',
    '                elif [[ -n "$candidate_current" ]]; then',
  );
  replace(
    'observer-timeout-failure-bypass',
    "          verification_failure=''\n" +
      "          candidate_observer_failure=''\n" +
      '          if ! wait_for_candidate_observer_stabilization; then',
    "          verification_failure=''\n" +
      "          candidate_observer_failure=''\n" +
      '          if false; then',
  );
  replaceWithin(
    'observer-destructive-rollback-in-loop',
    candidateObserverFunction,
    rollbackObserverFunction,
    '              sleep "$retry_delay_seconds"',
    '              rollback_now "transient-observer-mismatch"\n              sleep "$retry_delay_seconds"',
  );
  replaceWithin(
    'observer-attempt-increment-removed',
    candidateObserverFunction,
    rollbackObserverFunction,
    '              attempt=$((attempt + 1))',
    '              true # observer attempt increment removed',
  );
  replaceWithin(
    'observer-consecutive-reset-removed',
    candidateObserverFunction,
    rollbackObserverFunction,
    '                consecutive_matches=0\n                last_matching_observation=\'\'',
    '                true # observer consecutive-match reset removed\n                last_matching_observation=\'\'',
  );
  replace(
    'observer-observation-identity-reset-removed',
    '                last_matching_observation=\'\'\n                candidate_attempt_release=\'\'',
    '                true # observer matching-identity reset removed\n                candidate_attempt_release=\'\'',
  );
  replaceWithin(
    'rollback-observer-max-attempts-reduced-to-one',
    rollbackObserverFunction,
    observerFunctionsEnd,
    '            local max_attempts=5',
    '            local max_attempts=1',
  );
  replaceWithin(
    'rollback-observer-consecutive-matches-reduced-to-one',
    rollbackObserverFunction,
    observerFunctionsEnd,
    '            local required_consecutive_matches=2',
    '            local required_consecutive_matches=1',
  );
  replaceWithin(
    'rollback-observer-command-timeout-expanded',
    rollbackObserverFunction,
    observerFunctionsEnd,
    '            local command_timeout_seconds=20',
    '            local command_timeout_seconds=60',
  );
  replaceWithin(
    'rollback-observer-early-success-exit',
    rollbackObserverFunction,
    observerFunctionsEnd,
    '            while (( attempt <= max_attempts )); do',
    '            exit 0\n            while (( attempt <= max_attempts )); do',
  );
  replace(
    'rollback-observer-topology-bypass',
    '              if ! assert_volume_snapshot_policy "rollback-observer-$attempt" \\\n' +
      '                "$production_volume_id" "$production_machine_id" "$command_timeout_seconds"; then',
    '              if false; then',
  );
  replace(
    'rollback-observer-release-query-bypass',
    '                fly releases --app "$app" --image --json >"$rollback_json"; then',
    '                true >"$rollback_json"; then',
  );
  replace(
    'rollback-observer-release-machine-binding-bypass',
    '              elif ! rollback_current="$(current_release "$rollback_json" "$command_timeout_seconds")"; then',
    '              elif false; then',
  );
  replace(
    'rollback-observer-release-timeout-removed',
    '              elif ! timeout --signal=TERM --kill-after=10s "${command_timeout_seconds}s" \\\n' +
      '                fly releases --app "$app" --image --json >"$rollback_json"; then',
    '              elif ! fly releases --app "$app" --image --json >"$rollback_json"; then',
  );
  replace(
    'rollback-observer-newer-than-candidate-bypass',
    '                  || (( 10#${rollback_release#v} <= 10#${candidate_release#v} \\',
    '                  || (( false \\',
  );
  replace(
    'rollback-observer-newer-than-prior-bypass',
    '                    || 10#${rollback_release#v} <= 10#${final_prior_release#v} )); then',
    '                    || false )); then',
  );
  replace(
    'rollback-observer-exact-image-bypass',
    '                elif [[ "$rollback_image_actual" != "$ROLLBACK_IMAGE" ]]; then',
    '                elif false; then',
  );
  replace(
    'rollback-observer-consecutive-observation-identity-bypass',
    '                elif [[ "$rollback_current" == "$last_matching_observation" ]]; then',
    '                elif [[ -n "$rollback_current" ]]; then',
  );
  replace(
    'rollback-observer-caller-bypass',
    '            if ! wait_for_rollback_observer_stabilization; then',
    '            if false; then',
  );
  replace(
    'automatic-rollback-command-failure-short-circuits-observer',
    "            rollback_observer_failure=''\n            if ! wait_for_rollback_observer_stabilization; then",
    "            if [[ \"$rollback_command_status\" -ne 0 ]]; then return 1; fi\n" +
      "            rollback_observer_failure=''\n            if ! wait_for_rollback_observer_stabilization; then",
  );
  replace(
    'automatic-rollback-command-success-short-circuits-observer',
    "            rollback_observer_failure=''\n            if ! wait_for_rollback_observer_stabilization; then",
    "            return 0\n" +
      "            rollback_observer_failure=''\n            if ! wait_for_rollback_observer_stabilization; then",
  );
  replace(
    'failed-candidate-observer-bypass',
    '            if ! wait_for_candidate_observer_stabilization; then\n' +
      '              append_summary "FAILED; candidate deploy command exit ${deploy_status}; candidate release was not proved',
    '            if false; then\n' +
      '              append_summary "FAILED; candidate deploy command exit ${deploy_status}; candidate release was not proved',
  );
  replace(
    'failed-candidate-rollback-before-proof',
    "            candidate_observer_failure=''\n            if ! wait_for_candidate_observer_stabilization; then",
    "            candidate_observer_failure=''\n" +
      '            rollback_now "unproved-candidate"\n' +
      '            if ! wait_for_candidate_observer_stabilization; then',
  );
  replace(
    'failed-candidate-success-short-circuits-observer',
    "            candidate_observer_failure=''\n            if ! wait_for_candidate_observer_stabilization; then",
    "            exit 0\n" +
      "            candidate_observer_failure=''\n            if ! wait_for_candidate_observer_stabilization; then",
  );
  replaceWithin(
    'rollback-observer-destructive-rollback-in-loop',
    rollbackObserverFunction,
    observerFunctionsEnd,
    '              sleep "$retry_delay_seconds"',
    '              rollback_now "transient-rollback-observer-mismatch"\n              sleep "$retry_delay_seconds"',
  );
  replaceWithin(
    'rollback-observer-attempt-increment-removed',
    rollbackObserverFunction,
    observerFunctionsEnd,
    '              attempt=$((attempt + 1))',
    '              true # rollback observer attempt increment removed',
  );
  replaceWithin(
    'rollback-observer-consecutive-reset-removed',
    rollbackObserverFunction,
    observerFunctionsEnd,
    "                consecutive_matches=0\n                last_matching_observation=''",
    "                true # rollback observer consecutive reset removed\n                last_matching_observation=''",
  );
  replace(
    'observer-timeout-rollback-bypass',
    '            if ! rollback_now "$verification_failure"; then',
    '            if false; then',
  );
  cases.push({
    name: 'candidate-and-rollback-image-bindings-swapped',
    mutate: (value) => {
      const candidate = '--image "$candidate_image_ref"';
      const rollback = '--image "$ROLLBACK_IMAGE"';
      if (countOf(value, candidate) !== 1 || countOf(value, rollback) !== 1) {
        throw new Error('mutation candidate-and-rollback-image-bindings-swapped expected one target each');
      }
      return value
        .replace(candidate, '--image "$SWAPPED_IMAGE_SENTINEL"')
        .replace(rollback, candidate)
        .replace('--image "$SWAPPED_IMAGE_SENTINEL"', rollback);
    },
  });
  cases.push({
    name: 'candidate-and-rollback-config-bindings-swapped',
    mutate: (value) => {
      const candidate = '--config "$candidate_config"';
      const rollback = '--config "$rollback_config"';
      if (countOf(value, candidate) !== 1 || countOf(value, rollback) !== 1) {
        throw new Error('mutation candidate-and-rollback-config-bindings-swapped expected one target each');
      }
      return value
        .replace(candidate, '--config "$SWAPPED_CONFIG_SENTINEL"')
        .replace(rollback, candidate)
        .replace('--config "$SWAPPED_CONFIG_SENTINEL"', rollback);
    },
  });
  cases.push({
    name: 'candidate-config-displaced-to-decoy',
    mutate: (value) => {
      const name = 'candidate-config-displaced-to-decoy';
      const displaced = replaceOnce(
        value,
        '            --config "$candidate_config" \\',
        '            --config "/tmp/unreviewed-candidate.toml" \\',
        name,
      );
      return replaceOnce(
        displaced,
        '\n          if [[ "$deploy_status" -ne 0 ]]; then',
        '\n          true --config "$candidate_config"\n          if [[ "$deploy_status" -ne 0 ]]; then',
        name,
      );
    },
  });
  cases.push({
    name: 'candidate-image-displaced-to-decoy',
    mutate: (value) => {
      const name = 'candidate-image-displaced-to-decoy';
      const displaced = replaceOnce(
        value,
        '            --image "$candidate_image_ref" \\',
        '            --image "registry.fly.io/assesssuite-production@sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" \\',
        name,
      );
      return replaceOnce(
        displaced,
        '\n          if [[ "$deploy_status" -ne 0 ]]; then',
        '\n          true --image "$candidate_image_ref"\n          if [[ "$deploy_status" -ne 0 ]]; then',
        name,
      );
    },
  });
  cases.push({
    name: 'rollback-config-displaced-to-decoy',
    mutate: (value) => {
      const name = 'rollback-config-displaced-to-decoy';
      const displaced = replaceOnce(
        value,
        '              --config "$rollback_config" \\',
        '              --config "/tmp/unreviewed-rollback.toml" \\',
        name,
      );
      return replaceOnce(
        displaced,
        "              --yes || rollback_command_status=$?\n            rollback_observer_failure=''",
        "              --yes || rollback_command_status=$?\n" +
          '            true --config "$rollback_config"\n' +
          "            rollback_observer_failure=''",
        name,
      );
    },
  });
  cases.push({
    name: 'rollback-image-displaced-to-decoy',
    mutate: (value) => {
      const name = 'rollback-image-displaced-to-decoy';
      const displaced = replaceOnce(
        value,
        '              --image "$ROLLBACK_IMAGE" \\',
        '              --image "registry.fly.io/assesssuite-production@sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" \\',
        name,
      );
      return replaceOnce(
        displaced,
        "              --yes || rollback_command_status=$?\n            rollback_observer_failure=''",
        "              --yes || rollback_command_status=$?\n" +
          '            true --image "$ROLLBACK_IMAGE"\n' +
          "            rollback_observer_failure=''",
        name,
      );
    },
  });
  replace(
    'failed-candidate-rollback-anchored-exit-removed',
    '            if ! rollback_now "fly-deploy-exit-${deploy_status};candidate-proved-at-${candidate_release}"; then\n' +
      "              echo 'Automatic image rollback did not verify successfully.' >&2\n" +
      '            fi\n' +
      '            exit 1\n' +
      '          fi\n\n' +
      "          verification_failure=''",
    '            if ! rollback_now "fly-deploy-exit-${deploy_status};candidate-proved-at-${candidate_release}"; then\n' +
      "              echo 'Automatic image rollback did not verify successfully.' >&2\n" +
      '            fi\n' +
      '            true\n' +
      '          fi\n\n' +
      "          verification_failure=''",
  );
  replace(
    'verification-rollback-anchored-exit-removed',
    "            if ! rollback_now \"$verification_failure\"; then\n" +
      "              echo 'Automatic rollback did not verify successfully.' >&2\n" +
      "            fi\n" +
      '            exit 1\n' +
      '          fi',
    "            if ! rollback_now \"$verification_failure\"; then\n" +
      "              echo 'Automatic rollback did not verify successfully.' >&2\n" +
      "            fi\n" +
      '            true\n' +
      '          fi',
  );
  replace(
    'verification-rollback-preserved-candidate-gate-bypass',
    '            if [[ ! "$candidate_release" =~ ^v[1-9][0-9]*$ \\',
    '            if false && [[ ! "$candidate_release" =~ ^v[1-9][0-9]*$ \\',
  );
  replace(
    'verification-rollback-before-preserved-candidate-proof',
    '          if [[ -n "$verification_failure" ]]; then\n' +
      '            if [[ ! "$candidate_release" =~ ^v[1-9][0-9]*$ \\',
    '          if [[ -n "$verification_failure" ]]; then\n' +
      '            rollback_now "unproved-candidate"\n' +
      '            if [[ ! "$candidate_release" =~ ^v[1-9][0-9]*$ \\',
  );
  replace('deploy-job-timeout-reduced', '    timeout-minutes: 120', '    timeout-minutes: 90');
  replace(
    'deploy-pre-mutation-deadline-expanded',
    '          maximum_gate_elapsed_seconds=1200',
    '          maximum_gate_elapsed_seconds=3600',
  );
  replace(
    'deploy-time-reserve-proof-removed',
    '          (( maximum_gate_elapsed_seconds + maximum_post_gate_path_seconds <= deployment_job_timeout_seconds ))',
      '          true',
  );
  cases.push({
    name: 'deploy-time-reserve-moved-after-first-mutation',
    mutate: (value) => {
      const reserve =
        '          deployment_job_timeout_seconds=7200\n' +
        '          maximum_post_gate_path_seconds=4888\n' +
        '          maximum_gate_elapsed_seconds=1200\n' +
        '          (( maximum_gate_elapsed_seconds + maximum_post_gate_path_seconds <= deployment_job_timeout_seconds ))\n' +
        '          deploy_job_elapsed_seconds=$(( $(date -u +%s) - DEPLOY_JOB_STARTED_EPOCH ))\n' +
        '          if [[ "$DEPLOY_JOB_STARTED_EPOCH" -le 0 || "$deploy_job_elapsed_seconds" -lt 0 \\\n' +
        '            || "$deploy_job_elapsed_seconds" -gt "$maximum_gate_elapsed_seconds" ]]; then\n' +
        "            echo 'The deployment job no longer has the reviewed time reserve for snapshot, candidate verification and automatic image rollback.' >&2\n" +
        "            append_summary 'FAILED; rollback-reserved deployment time gate closed before snapshot or application deployment'\n" +
        '            exit 1\n' +
        '          fi\n\n';
      const firstMutation =
        '          if ! create_predeploy_volume_snapshot; then\n' +
        "            echo 'The content-free on-demand predeploy volume snapshot did not reach created status within the bounded gate.' >&2\n" +
        "            append_summary 'FAILED; on-demand predeploy snapshot gate failed before application deployment'\n" +
        '            exit 1\n' +
        '          fi\n\n';
      return replaceOnce(
        value,
        reserve + firstMutation,
        firstMutation + reserve,
        'deploy-time-reserve-moved-after-first-mutation',
      );
    },
  });
  replace(
    'deploy-flyctl-download-timeout-removed',
    '          curl --fail --location --silent --show-error --max-time 120 \\',
    '          curl --fail --location --silent --show-error \\',
  );
  replaceEvery(
    'deploy-remote-main-timeouts-removed',
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main',
    'git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main',
    2,
  );
  replaceEvery(
    'deploy-github-control-timeouts-removed',
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --max-time 60",
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error",
    4,
  );
  replace(
    'deploy-topology-config-source-reverted',
    'source = "assesssuite_data_r12"',
    'source = "assesssuite_data"',
  );
  replaceWithin(
    'deploy-topology-two-volume-count-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '          if (volumes.length !== 2) throw new Error(`Expected exactly two Fly volumes; found ${volumes.length}`);',
    '          if (false) throw new Error();',
  );
  replaceWithin(
    'deploy-topology-volume-name-uniqueness-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '              new Set(volumes.map((row) => row.name)).size !== 2) {',
    '              false) {',
  );
  replaceWithin(
    'deploy-topology-active-selector-changed',
    '          assert_topology() {',
    '          volume_identity() {',
    "          const volume = volumes.find((row) => row.name === 'assesssuite_data_r12');",
    "          const volume = volumes.find((row) => row.name === 'assesssuite_data');",
  );
  replaceWithin(
    'deploy-topology-active-id-unbound',
    '          assert_topology() {',
    '          volume_identity() {',
    '          if (process.env.EXPECTED_VOLUME_ID && volume.id !== process.env.EXPECTED_VOLUME_ID) {',
    '          if (false) {',
  );
  replaceWithin(
    'deploy-topology-machine-state-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    "          if ((machine.region ?? machine.Region) !== 'syd' || machine.state !== 'started') {",
    "          if ((machine.region ?? machine.Region) !== 'syd' || false) {",
  );
  replaceWithin(
    'deploy-topology-legacy-detachment-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '              legacyVolume.attached_machine_id !== null || legacyVolume.attached_alloc_id !== null ||',
    '              false ||',
  );
  replaceWithin(
    'deploy-topology-legacy-policy-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '              legacyVolume.snapshot_retention !== 5 || legacyVolume.auto_backup_enabled !== true) {',
    '              false) {',
  );
  replaceWithin(
    'deploy-topology-active-attachment-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '              volume.attached_machine_id !== machineId || volume.snapshot_retention !== 5 ||',
    '              false || volume.snapshot_retention !== 5 ||',
  );
  replaceWithin(
    'deploy-topology-active-policy-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '              volume.auto_backup_enabled !== true) {',
    '              false) {',
  );
  replaceWithin(
    'deploy-topology-legacy-id-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    '          if (legacyVolume.id !== process.env.EXPECTED_LEGACY_VOLUME_ID || legacyVolume.state !== \'created\' ||',
    '          if (false || legacyVolume.state !== \'created\' ||',
  );
  replaceWithin(
    'deploy-topology-legacy-state-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    "legacyVolume.state !== 'created'",
    'false',
  );
  replaceWithin(
    'deploy-topology-legacy-encryption-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    'legacyVolume.encrypted !== true',
    'false',
  );
  replaceWithin(
    'deploy-topology-active-mount-volume-bypassed',
    '          assert_topology() {',
    '          volume_identity() {',
    'mounts[0]?.volume !== volume.id',
    'false',
  );
  replace('postrollback-secret-check-removed', '            if ! assert_secret_name_boundary postrollback forbid; then', '            if false; then');
  replace('validator-pin-mutated', '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + '0'.repeat(64));
  return cases;
}

function prepareReleaseMutationCases(source) {
  const cases = [];
  const replace = (name, from, to) => cases.push({ name, mutate: (value) => replaceOnce(value, from, to, name) });
  const replaceEvery = (name, from, to, expected) => cases.push({
    name,
    mutate: (value) => {
      const found = countOf(value, from);
      if (found !== expected) throw new Error(`mutation ${name} expected ${expected} targets, found ${found}`);
      return value.replaceAll(from, to);
    },
  });
  replace('trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:');
  replace('permissions-write', 'permissions:\n  contents: read', 'permissions:\n  contents: write');
  replaceEvery(
    'live-production-base-rebound',
    `PRODUCTION_BASE_SHA: ${LIVE_PRODUCTION_BASE_SHA}`,
    'PRODUCTION_BASE_SHA: ' + '0'.repeat(40),
    2,
  );
  replace(
    'typecheck-live-base-ancestry-bypassed',
    '          git merge-base --is-ancestor "$PRODUCTION_BASE_SHA" HEAD\n          base_dir=',
    '          true\n          base_dir=',
  );
  replace(
    'candidate-general-clinical-ai-posture-disabled',
    'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.production.toml',
    'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' fly.production.toml',
  );
  replace(
    'candidate-transcription-posture-disabled',
    'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.production.toml',
    'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' fly.production.toml',
  );
  replace(
    'rollback-general-clinical-ai-posture-disabled',
    'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.rollback.production.toml',
    'GENERAL_CLINICAL_LLM_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' fly.rollback.production.toml',
  );
  replace(
    'rollback-transcription-posture-enabled',
    'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"0"[[:space:]]*$\' fly.rollback.production.toml',
    'TRANSCRIPTION_ENABLED[[:space:]]*=[[:space:]]*"1"[[:space:]]*$\' fly.rollback.production.toml',
  );
  replace('input-interface-expanded', '      confirmation:\n', '      unsafe_override:\n        required: true\n        type: string\n      confirmation:\n');
  replace('sentry-upload-needs-removed', '  upload_sentry_source_maps:\n    name: Upload byte-proven source maps from a fresh data-only runner\n    needs: gates', '  upload_sentry_source_maps:\n    name: Upload byte-proven source maps from a fresh data-only runner');
  replace('publish-sentry-gate-removed', '    needs: [gates, upload_sentry_source_maps]\n    runs-on: ubuntu-24.04', '    needs: gates\n    runs-on: ubuntu-24.04');
  replace('compatibility-needs-publish-removed', '    needs: [gates, publish_image]', '    needs: gates');
  replace('sentry-upload-job-merged', '\n  upload_sentry_source_maps:\n', '\n  upload_sentry_source_maps_merged:\n');
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
  replace('sentry-upload-checkout-injected', '      - name: Download exact gated source-map data by immutable artifact ID', '      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n      - name: Download exact gated source-map data by immutable artifact ID');
  replace('sentry-upload-npm-injected', '          artifact="$RUNNER_TEMP/candidate-data"', '          npm ci\n          artifact="$RUNNER_TEMP/candidate-data"');
  replace('sentry-upload-fly-token-injected', '          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}\n          SENTRY_ORG: unimatter', '          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          SENTRY_ORG: unimatter');
  replace('sentry-upload-token-moved-into-cli-install', '      - name: Install checksum-verified sentry-cli 3.6.2 without credentials\n        shell: bash\n        run: |', '      - name: Install checksum-verified sentry-cli 3.6.2 without credentials\n        shell: bash\n        env:\n          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}\n        run: |');
  replace('sentry-cli-checksum-mutated', "'3a4bbf2c0d06378d4e59b337647483751a0a2b1603db5fd4991847d0cfd6478c'", "'0a4bbf2c0d06378d4e59b337647483751a0a2b1603db5fd4991847d0cfd6478c'");
  replace('sentry-source-map-archive-broadened', "expected_files=$'candidate-build-receipt.json\\ncandidate-image.tar.gz\\ncandidate-image.tar.gz.sha256\\nsentry-source-map-manifest.json\\nsentry-source-maps.tar.gz'", "expected_files=$'candidate-build-receipt.json\\ncandidate-image.tar.gz\\ncandidate-image.tar.gz.sha256\\nsentry-source-map-manifest.json\\nsentry-source-maps.tar.gz\\nunsafe.sh'");
  replace('sentry-dsn-host-mutated', "parsed.hostname !== 'o4511822688813056.ingest.us.sentry.io'", "parsed.hostname !== 'example.invalid'");
  replace('sentry-dsn-project-mutated', "parsed.pathname !== '/4511827129663488'", "parsed.pathname !== '/0'");
  replace('publish-npm-injected', '          local_ref="ocidir://$candidate_oci:$APPLICATION_SHA"', '          npm ci\n          local_ref="ocidir://$candidate_oci:$APPLICATION_SHA"');
  replace('publish-docker-run-injected', '          local_ref="ocidir://$candidate_oci:$APPLICATION_SHA"', '          docker run "$local_image"\n          local_ref="ocidir://$candidate_oci:$APPLICATION_SHA"');
  replace('publish-fly-deploy-injected', '          local_ref="ocidir://$candidate_oci:$APPLICATION_SHA"', '          fly deploy .\n          local_ref="ocidir://$candidate_oci:$APPLICATION_SHA"');
  replace('publication-default-docker-config', '          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config', '          DOCKER_CONFIG: ~/.docker');
  replace('publication-default-regctl-config', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config\n          REGCTL_CONFIG: ${{ runner.temp }}/publication-regctl-config.json', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          DOCKER_CONFIG: ${{ runner.temp }}/publication-docker-config\n          REGCTL_CONFIG: ~/.regctl/config.json');
  replace('publication-auth-cleanup-removed', '            rm -f "$REGCTL_CONFIG"', '            true');
  replace('publication-flyctl-checksum-mutated', "'a782dceed173d215c000ab94e2b08623c22267edff6d90ebe3010b3f9b671dc2'", "'0782dceed173d215c000ab94e2b08623c22267edff6d90ebe3010b3f9b671dc2'");
  replace('publication-regctl-checksum-mutated', "'c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467'", "'093aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467'");
  replace('publication-registry-exchange-shape-bypassed', "username !== 'x' || !credential.startsWith('fm2_')", 'false');
  replace('publication-registry-exchange-timeout-removed', 'timeout --signal=TERM --kill-after=10s 60s "$RUNNER_TEMP/fly" auth docker', '"$RUNNER_TEMP/fly" auth docker');
  replace('publication-direct-long-lived-token-injected', '<"$derived_token" >/dev/null', '<<<"$FLY_API_TOKEN" >/dev/null');
  replace('publication-archive-member-type-bypassed', 'not (member.isdir() or member.isfile())', 'False');
  replace('publication-config-identity-bypassed', 'row.config?.digest !== process.env.CANDIDATE_IMAGE_ID', 'false');
  replace('publication-remote-digest-bypassed', '          [[ "$remote_digest" == "$candidate_registry_digest" ]]', '          true');
  replace('publication-blob-byte-compare-bypassed', '            cmp --silent "$local_blob" "$remote_blob"', '            true');
  replace('publication-cleanup-trap-removed', '          trap cleanup_registry_auth EXIT', '          true');
  replace('compatibility-secret-injected', '        working-directory: candidate\n        env:\n          APPLICATION_SHA:', '        working-directory: candidate\n        env:\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          APPLICATION_SHA:');
  replace('compatibility-marker-weakened', '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -eq 1 ]]', '[[ "$(grep -Fxc "# $marker=PASS" "$proof_log")" -ge 1 ]]');
  replace('bundle-file-set-bypass', '          [[ "$actual_files" == "$expected_files" ]]\n          deploy_bundle_manifest_sha256=', '          true\n          deploy_bundle_manifest_sha256=');
  replace('bundle-code-injected', '          copy_regular candidate/fly.production.toml fly.production.toml 65536', '          copy_regular candidate/server/index.mjs index.mjs 65536\n          copy_regular candidate/fly.production.toml fly.production.toml 65536');
  replace('bundle-retention-weakened', '          retention-days: 3', '          retention-days: 1');
  replace('bundle-upload-broadened', '          path: ${{ runner.temp }}/deploy-bundle', '          path: ${{ runner.temp }}');
  replace('candidate-artifact-digest-prefix-removed', 'candidate_image_artifact_digest: sha256:${{ steps.upload_candidate.outputs.artifact-digest }}', 'candidate_image_artifact_digest: ${{ steps.upload_candidate.outputs.artifact-digest }}');
  replace('deploy-bundle-artifact-digest-prefix-removed', 'deploy_bundle_artifact_digest: sha256:${{ steps.upload_deploy_bundle.outputs.artifact-digest }}', 'deploy_bundle_artifact_digest: ${{ steps.upload_deploy_bundle.outputs.artifact-digest }}');
  replace('manifest-candidate-digest-bypass', "            application_image_digest: e.APPLICATION_IMAGE_DIGEST,", "            application_image_digest: 'sha256:' + '0'.repeat(64),");
  replace(
    'candidate-process-contract-invocation-removed',
    "          python3 -I - fly.production.toml <<'PY'",
    "          true <<'PY'",
  );
  replace(
    'candidate-process-contract-parser-bypassed',
    '              document = tomllib.load(stream)',
    '              document = {}',
  );
  replace(
    'candidate-process-contract-dictionary-recursion-removed',
    '                      entries.extend(process_entries(nested, next_path))',
    '                      true',
  );
  replace(
    'candidate-process-contract-array-recursion-removed',
    '                  entries.extend(process_entries(nested, path + (index,)))',
    '                  true',
  );
  replace(
    'candidate-process-contract-argv-narrowed-to-first-config',
    '          for raw_path in sys.argv[1:]:',
    '          for raw_path in sys.argv[1:2]:',
  );
  replace(
    'candidate-process-contract-exact-selector-weakened',
    "              if process_entries(document) != [(('http_service', 'processes'), ['app'])]:",
    "              if False:",
  );
  replace(
    'prepare-release-source-remote-timeout-removed',
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH"',
    'git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH"',
  );
  replace(
    'prepare-release-main-remote-timeout-removed',
    'timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main',
    'git ls-remote --exit-code origin refs/heads/main',
  );
  replace(
    'prepare-release-fetch-timeout-removed',
    'timeout --signal=TERM --kill-after=10s 120s git fetch --no-tags --force origin',
    'git fetch --no-tags --force origin',
  );
  replace(
    'prepare-release-regctl-download-timeout-removed',
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
      '            --output "$regctl_binary" \\\n' +
      "            'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64'",
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \\\n" +
      '            --output "$regctl_binary" \\\n' +
      "            'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64'",
  );
  replace(
    'prepare-release-source-remote-bounded-dummy-unbounded-real',
    '          remote_sha="$(timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH" | awk \'NR == 1 { print $1 }\')"',
    '          if false; then\n' +
      '            timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH" >/dev/null\n' +
      '          fi\n' +
      '          remote_sha="$(git ls-remote --exit-code origin "refs/heads/$SOURCE_BRANCH" | awk \'NR == 1 { print $1 }\')"',
  );
  replace(
    'prepare-release-main-remote-bounded-dummy-unbounded-real',
    '          trusted_remote_sha="$(timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')"',
    '          if false; then\n' +
      '            timeout --signal=TERM --kill-after=10s 60s git ls-remote --exit-code origin refs/heads/main >/dev/null\n' +
      '          fi\n' +
      '          trusted_remote_sha="$(git ls-remote --exit-code origin refs/heads/main | awk \'NR == 1 { print $1 }\')"',
  );
  replace(
    'prepare-release-fetch-bounded-dummy-unbounded-real',
    '          timeout --signal=TERM --kill-after=10s 120s git fetch --no-tags --force origin "refs/heads/main:refs/remotes/origin/main"',
    '          if false; then\n' +
      '            timeout --signal=TERM --kill-after=10s 120s git fetch --no-tags --force origin "refs/heads/main:refs/remotes/origin/main"\n' +
      '          fi\n' +
      '          git fetch --no-tags --force origin "refs/heads/main:refs/remotes/origin/main"',
  );
  replace(
    'prepare-release-regctl-bounded-dummy-unbounded-real',
    "          curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
      '            --output "$regctl_binary" \\\n' +
      "            'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64'",
    '          if false; then\n' +
      "            curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --max-time 120 \\\n" +
      '              --output "$regctl_binary" \\\n' +
      "              'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64'\n" +
      '          fi\n' +
      "          curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \\\n" +
      '            --output "$regctl_binary" \\\n' +
      "            'https://github.com/regclient/regclient/releases/download/v0.11.5/regctl-linux-amd64'",
  );
  replace(
    'prepare-release-rollback-image-export-bounded-dummy-unbounded-real',
    '          timeout --signal=TERM --kill-after=30s 600s "$regctl" image export "$ROLLBACK_IMAGE" \\\n            "$RUNNER_TEMP/publication/rollback-image.tar" --name "assesssuite-rollback:$ROLLBACK_SOURCE_SHA"',
    '          if false; then\n' +
      '            timeout --signal=TERM --kill-after=30s 600s "$regctl" image export "$ROLLBACK_IMAGE" \\\n' +
      '              "$RUNNER_TEMP/publication/rollback-image.tar" --name "assesssuite-rollback:$ROLLBACK_SOURCE_SHA"\n' +
      '          fi\n' +
      '          "$regctl" image export "$ROLLBACK_IMAGE" \\\n' +
      '            "$RUNNER_TEMP/publication/rollback-image.tar" --name "assesssuite-rollback:$ROLLBACK_SOURCE_SHA"',
  );
  replace(
    'prepare-release-topology-config-source-reverted',
    'source = "assesssuite_data_r12"',
    'source = "assesssuite_data"',
  );
  cases.push({
    name: 'prepare-release-rollback-source-rebound-to-candidate',
    mutate: (value) => {
      const from = '          ROLLBACK_SOURCE_SHA: ${{ inputs.rollback_source_sha }}';
      if (countOf(value, from) !== 6) throw new Error('mutation prepare-release-rollback-source-rebound-to-candidate expected six targets');
      return value.replaceAll(from, '          ROLLBACK_SOURCE_SHA: ${{ inputs.application_sha }}');
    },
  });
  cases.push({
    name: 'prepare-release-legacy-volume-input-rebound-to-active',
    mutate: (value) => {
      const from = '          EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_legacy_volume_id }}';
      if (countOf(value, from) !== 5) throw new Error('mutation prepare-release-legacy-volume-input-rebound-to-active expected five targets');
      return value.replaceAll(from, '          EXPECTED_LEGACY_VOLUME_ID: ${{ inputs.expected_volume_id }}');
    },
  });
  replaceEvery('prepare-release-volume-distinction-bypassed', '          [[ "$EXPECTED_VOLUME_ID" != "$EXPECTED_LEGACY_VOLUME_ID" ]]', '          true', 2);
  replace('prepare-release-ancestor-proof-bypassed', '          git merge-base --is-ancestor "$ROLLBACK_SOURCE_SHA" "$APPLICATION_SHA"', '          true');
  replace('prepare-release-rollback-current-image-identity-bypassed', '          [[ "$ROLLBACK_IMAGE" == "$EXPECTED_CURRENT_IMAGE" ]]', '          true');
  cases.push({
    name: 'prepare-release-publication-rollback-source-receipt-rebound',
    mutate: (value) => {
      const from = '            rollback_source_sha: process.env.ROLLBACK_SOURCE_SHA,';
      if (countOf(value, from) !== 2) throw new Error('mutation prepare-release-publication-rollback-source-receipt-rebound expected two targets');
      return value.replaceAll(from, '            rollback_source_sha: process.env.APPLICATION_SHA,');
    },
  });
  cases.push({
    name: 'prepare-release-legacy-volume-receipts-rebound-to-active',
    mutate: (value) => {
      const from = 'expected_legacy_volume_id: process.env.EXPECTED_LEGACY_VOLUME_ID';
      if (countOf(value, from) !== 2) throw new Error('mutation prepare-release-legacy-volume-receipts-rebound-to-active expected two targets');
      return value.replaceAll(from, 'expected_legacy_volume_id: process.env.EXPECTED_VOLUME_ID');
    },
  });
  replace('prepare-release-manifest-legacy-volume-rebound-to-active', '            expected_legacy_volume_id: e.EXPECTED_LEGACY_VOLUME_ID,', '            expected_legacy_volume_id: e.EXPECTED_VOLUME_ID,');
  replace(
    'prepare-release-platform-build-removed',
    '          npm run build:platform\n          npm run build:landing',
    '          true\n          npm run build:landing',
  );
  replace('prepare-release-landing-build-removed', '          npm run build:landing', '          true');
  replace('prepare-release-split-build-verification-removed', '          npm run verify:split-build', '          true');
  replace('prepare-release-split-hosting-test-removed', '          npm run test:split-hosting', '          true');
  replace('prepare-release-env-example-exception-broadened', '            if [[ "$changed_file" == \'.env.example\' ]]; then', '            if [[ "$changed_file" == \'.env.example\' || "$changed_file" == */.env.example ]]; then');
  replace('prepare-release-env-filename-gate-weakened', '            if [[ "$normalized" =~ (^|/)\\.env($|\\.) \\', '            if [[ "$normalized" =~ (^|/)\\.env$ \\');
  replace('prepare-release-filename-predicate-bypassed', '            if is_prohibited_release_filename "$changed_file"; then', '            if false; then');
  replace('prepare-release-env-example-removed-from-content-scan', '          git diff --binary "$PRODUCTION_BASE_SHA"...HEAD >"$RUNNER_TEMP/release.diff"', '          git diff --binary "$PRODUCTION_BASE_SHA"...HEAD -- . \':!.env.example\' >"$RUNNER_TEMP/release.diff"');
  replace('prepare-release-candidate-expected-app-url-check-removed', '          [[ "$(grep -Fxc \'  EXPECTED_APP_URL = "https://app.assesssuite.com"\' fly.production.toml)" -eq 1 ]]', '          true');
  replace('confirmation-weakened', '          [[ "$CONFIRMATION" == "PREPARE assesssuite-production EXACT SHA" ]]', '          [[ -n "$CONFIRMATION" ]]');
  replace('validator-pin-mutated', '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + validatorSelfSha256, '          EXPECTED_TRUSTED_VALIDATOR_SHA256: ' + '0'.repeat(64));
  return cases;
}

const RETIRED_PREPARE_ROLLBACK_WORKFLOW = `name: RETIRED - Production prepare rollback image

on:
  workflow_dispatch:
    inputs:
      acknowledgement:
        description: Type RETIRED to acknowledge that this operator path is obsolete
        required: true
        type: string

permissions:
  contents: read

concurrency:
  group: assesssuite-production
  cancel-in-progress: false

jobs:
  retired:
    name: Refuse obsolete compatibility-image preparation
    runs-on: ubuntu-24.04
    timeout-minutes: 1
    steps:
      - name: Retired workflow refuses execution
        shell: bash
        run: |
          set -euo pipefail
          echo 'This operator path is retired. Use production-prepare-release.yml with the dispatch-frozen current production image.' >&2
          exit 1
`;

function validateRetiredPrepareRollbackWorkflow(input) {
  const source = normalized(input);
  const failures = [];
  if (source !== RETIRED_PREPARE_ROLLBACK_WORKFLOW) {
    failures.push('retired rollback-image workflow differs from the exact fail-closed tombstone');
  }
  for (const forbidden of [
    '${{ secrets.', 'uses:', 'FLY_API_TOKEN', 'fly deploy', 'fly volumes',
    'docker ', 'npm ', 'node ', 'curl ', 'gh ', 'contents: write', 'continue-on-error:',
  ]) {
    if (withoutCommentOnlyLines(source).includes(forbidden)) {
      failures.push('retired rollback-image workflow contains executable or privileged control ' + forbidden);
    }
  }
  return failures;
}

function retiredPrepareRollbackMutationCases() {
  const replace = (name, from, to) => ({
    name,
    mutate: (value) => replaceOnce(value, from, to, name),
  });
  return [
    replace('retired-name-reactivated', 'name: RETIRED - Production prepare rollback image', 'name: Production prepare rollback image'),
    replace('retired-trigger-expanded', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:'),
    replace('retired-input-made-optional', '        required: true', '        required: false'),
    replace('retired-permission-expanded', '  contents: read', '  contents: write'),
    replace('retired-timeout-expanded', '    timeout-minutes: 1', '    timeout-minutes: 60'),
    replace('retired-refusal-removed', '          exit 1', '          exit 0'),
    replace('retired-secret-injected', '        shell: bash', '        env:\n          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n        shell: bash'),
    replace('retired-production-command-injected', '          exit 1', '          fly deploy --app assesssuite-production --yes\n          exit 1'),
  ];
}

const workflowName = path.basename(workflowPath);
const workflowKind = workflowName === 'production-deploy.yml'
  ? 'deploy'
  : workflowName === 'production-prepare-release.yml'
    ? 'prepare_release'
  : workflowName === 'production-prepare-rollback-image.yml'
    ? 'retired_prepare'
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
  : workflowKind === 'retired_prepare'
    ? validateRetiredPrepareRollbackWorkflow
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
    : workflowKind === 'retired_prepare'
      ? retiredPrepareRollbackMutationCases()
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
