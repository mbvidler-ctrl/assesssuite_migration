import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const selftest = argv.includes('--selftest');
const positional = argv.filter((value) => value !== '--selftest');
if (positional.length > 1) {
  process.stderr.write('usage: node scripts/validate-production-state-snapshot-workflow.mjs [workflow] [--selftest]\n');
  process.exit(2);
}

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const workflowPath = path.resolve(
  positional[0] || path.join(repoRoot, '.github', 'workflows', 'production-state-snapshot.yml'),
);
const validatorSha256 = crypto.createHash('sha256').update(fs.readFileSync(scriptPath)).digest('hex');

function normalized(value) {
  return value.replaceAll('\r\n', '\n');
}

function countOf(source, needle) {
  return source.split(needle).length - 1;
}

function replaceOnce(source, from, to, name) {
  const count = countOf(source, from);
  if (count !== 1) throw new Error(`mutation ${name} expected one target, found ${count}`);
  return source.replace(from, to);
}

function validateWorkflow(rawSource) {
  const source = normalized(rawSource);
  const failures = [];
  const fail = (message) => failures.push(message);
  const requireText = (needle, label) => {
    if (!source.includes(needle)) fail(`missing ${label}`);
  };
  const requireCount = (needle, count, label) => {
    const actual = countOf(source, needle);
    if (actual !== count) fail(`${label} count is ${actual}, expected ${count}`);
  };
  const section = (start, end, label) => {
    const startIndex = source.indexOf(start);
    const endIndex = startIndex === -1 ? -1 : source.indexOf(end, startIndex + start.length);
    if (startIndex === -1 || endIndex === -1) {
      fail(`missing bounded ${label} section`);
      return '';
    }
    return source.slice(startIndex, endIndex);
  };

  if (source.length > 60_000) fail('workflow exceeds the reviewed size bound');
  if (source.includes('\0') || source.includes('\t')) fail('workflow contains NUL or tab characters');
  if (!source.endsWith('\n')) fail('workflow must end with a newline');
  requireCount('name: Production state snapshot - read only', 1, 'workflow name');
  requireCount('\non:\n  workflow_dispatch:\n', 1, 'manual-only trigger');
  if (/^\s{2}(?:push|pull_request|schedule|repository_dispatch|workflow_run):/m.test(source)) {
    fail('workflow contains a non-manual trigger');
  }

  const inputBlock = section('    inputs:\n', '\npermissions:', 'workflow inputs');
  const inputMatches = [...inputBlock.matchAll(/^ {6}([a-z][a-z0-9_]*):$/gm)];
  const inputNames = inputMatches.map((match) => match[1]);
  const expectedInputs = ['trusted_workflow_sha', 'capability_intent_id', 'authority_reference', 'confirmation'];
  if (JSON.stringify(inputNames) !== JSON.stringify(expectedInputs)) fail('workflow input interface differs from the four reviewed fields');
  for (let index = 0; index < inputMatches.length; index += 1) {
    const input = inputMatches[index][1];
    const start = inputMatches[index].index;
    const next = inputMatches[index + 1]?.index;
    const block = inputBlock.slice(start, next);
    if (!block.includes('        required: true') || !block.includes('        type: string')) {
      fail(`${input} is not a required string input`);
    }
  }

  requireText('permissions:\n  contents: read\n', 'read-only permissions');
  if (/permissions:[\s\S]*?\b(?:write|write-all)\b/.test(section('permissions:\n', '\nconcurrency:', 'permissions'))) {
    fail('workflow requests write permissions');
  }
  requireText('concurrency:\n  group: assesssuite-production\n  cancel-in-progress: false\n', 'shared production concurrency lock');

  const jobsBlock = source.slice(source.indexOf('\njobs:\n') + 1);
  const jobNames = [...jobsBlock.matchAll(/^ {2}([a-z][a-z0-9_]*):\n {4}name:/gm)].map((match) => match[1]);
  if (JSON.stringify(jobNames) !== JSON.stringify(['snapshot'])) fail('workflow must contain only the snapshot job');
  requireText('    runs-on: ubuntu-24.04\n    timeout-minutes: 15\n    environment: production\n', 'pinned runner, timeout, and production environment');

  const stepNames = [...source.matchAll(/^ {6}- name: (.+)$/gm)].map((match) => match[1]);
  const expectedStepNames = [
    'Validate trusted read-only dispatch and inputs',
    'Check out exact trusted workflow SHA',
    'Verify exact trusted main and snapshot workflow contract',
    'Install checksum-verified flyctl 0.4.71',
    'Final secret-bearing read-only Fly production state capture',
    'Upload bounded content-free production state receipt',
    'Emit content-free snapshot summary',
  ];
  if (JSON.stringify(stepNames) !== JSON.stringify(expectedStepNames)) fail('workflow step set or order differs');

  const actionRefs = [...source.matchAll(/^\s+uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  const expectedActionRefs = [
    'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  ];
  if (JSON.stringify(actionRefs) !== JSON.stringify(expectedActionRefs)) fail('third-party action set or pin differs');
  requireText('          ref: ${{ inputs.trusted_workflow_sha }}\n          fetch-depth: 0\n          persist-credentials: false\n', 'exact credential-free checkout');

  const dispatch = section(
    '      - name: Validate trusted read-only dispatch and inputs\n',
    '\n      - name: Check out exact trusted workflow SHA',
    'dispatch validation',
  );
  for (const marker of [
    '[[ "$REPOSITORY" == "mbvidler-ctrl/assesssuite_migration" ]]',
    '[[ "$ACTOR" == "mbvidler-ctrl" ]]',
    '[[ "$TRIGGERING_ACTOR" == "mbvidler-ctrl" ]]',
    '[[ "$IS_FORK" == "false" ]]',
    '[[ "$EVENT_REF" == "refs/heads/main" ]]',
    '[[ "$WORKFLOW_REF" == "mbvidler-ctrl/assesssuite_migration/.github/workflows/production-state-snapshot.yml@refs/heads/main" ]]',
    '[[ "$TRUSTED_WORKFLOW_SHA" =~ ^[0-9a-f]{40}$ ]]',
    '[[ "$WORKFLOW_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]',
    '[[ "$EVENT_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]',
    '[[ "$CAPABILITY_INTENT_ID" =~ ^[A-Za-z0-9._:-]{1,160}$ ]]',
    '[[ "$AUTHORITY_REFERENCE" =~ ^[A-Za-z0-9._:/-]{1,240}$ ]]',
    '[[ "$CONFIRMATION" == "SNAPSHOT assesssuite-production READ ONLY" ]]',
  ]) if (!dispatch.includes(marker)) fail(`dispatch validation lacks ${marker}`);

  const trusted = section(
    '      - name: Verify exact trusted main and snapshot workflow contract\n',
    '\n      - name: Install checksum-verified flyctl 0.4.71',
    'trusted-main verification',
  );
  for (const marker of [
    'git rev-parse --verify \'HEAD^{commit}\'',
    'git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main',
    '[[ -z "$(git status --porcelain --untracked-files=no)" ]]',
    '[[ -f .github/workflows/production-state-snapshot.yml && ! -L .github/workflows/production-state-snapshot.yml ]]',
    '[[ -f scripts/validate-production-state-snapshot-workflow.mjs && ! -L scripts/validate-production-state-snapshot-workflow.mjs ]]',
    'sha256sum --check --strict',
    'node scripts/validate-production-state-snapshot-workflow.mjs .github/workflows/production-state-snapshot.yml',
    'node scripts/validate-production-state-snapshot-workflow.mjs .github/workflows/production-state-snapshot.yml --selftest',
  ]) if (!trusted.includes(marker)) fail(`trusted-main verification lacks ${marker}`);
  const pinnedValidator = trusted.match(/EXPECTED_SNAPSHOT_VALIDATOR_SHA256:\s*([0-9a-f]{64})/i)?.[1];
  if (pinnedValidator !== validatorSha256) fail('snapshot validator SHA-256 pin does not match the exact validator bytes');

  const install = section(
    '      - name: Install checksum-verified flyctl 0.4.71\n',
    '\n      - name: Final secret-bearing read-only Fly production state capture',
    'flyctl installation',
  );
  for (const marker of [
    "curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location",
    'https://github.com/superfly/flyctl/releases/download/v0.4.71/flyctl_0.4.71_Linux_x86_64.tar.gz',
    'a782dceed173d215c000ab94e2b08623c22267edff6d90ebe3010b3f9b671dc2',
    'sha256sum --check --strict',
    'install -m 0755 "$bin_dir/flyctl" "$bin_dir/fly"',
    '"$bin_dir/flyctl" version | grep -F \'0.4.71\'',
  ]) if (!install.includes(marker)) fail(`flyctl installation lacks ${marker}`);

  requireCount('${{ secrets.FLY_API_TOKEN }}', 1, 'Fly secret expression');
  requireCount('${{ secrets.', 1, 'all secret expressions');
  const capture = section(
    '      - name: Final secret-bearing read-only Fly production state capture\n',
    '\n      - name: Upload bounded content-free production state receipt',
    'secret-bearing state capture',
  );
  if (!capture.includes('          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}')) fail('Fly token is absent from the sole secret-bearing step');
  for (const marker of [
    'set -euo pipefail\n          set +x\n          umask 077',
    '[[ -n "$FLY_API_TOKEN" ]]',
    'app=assesssuite-production',
    'install -d -m 0700 "$state_dir" "$receipt_dir"',
    'trap cleanup EXIT',
    'git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main',
    'timeout --signal=TERM --kill-after=10s 60s fly "$@" --app "$app" --json >"$output" 2>"$error_file"',
    'env -u FLY_API_TOKEN curl --proto \'=https\' --tlsv1.2 --fail --silent --show-error',
    '--max-time 15 --max-filesize 65536',
    "read_public_version 'https://assesssuite.com'",
    "read_public_version 'https://assesssuite-production.fly.dev'",
    'env -u FLY_API_TOKEN node --input-type=module',
    'machines.length !== 1 || volumes.length !== 1',
    "machine.state !== 'started'",
    "volume.name !== 'assesssuite_data'",
    'volume.encrypted !== true',
    'volume.attached_machine_id !== machineId',
    'volume.snapshot_retention !== 5',
    'volume.auto_backup_enabled !== true',
    "mounts[0]?.path !== '/app/server/data'",
    'JSON.stringify(initialRelease) !== JSON.stringify(finalRelease)',
    'JSON.stringify(initialImage) !== JSON.stringify(finalImage)',
    'JSON.stringify(initialTopology) !== JSON.stringify(finalTopology)',
    'initialImage.immutable_image, initialImage.tag_ref',
    'if (apexSha !== flySha)',
    "schema_version: 'assesssuite-production-state-snapshot-v1'",
    "result: 'PASS'",
    'current_release: initialRelease.release',
    'immutable_image: initialImage.immutable_image',
    'public_release_sha: apexSha',
    'machine_count: 1',
    'volume_count: 1',
    'scheduled_snapshots: true',
    'snapshot_retention_days: 5',
    'if (Buffer.byteLength(encoded) > 8192)',
    "flag: 'wx'",
    'rm -rf "$state_dir"',
    '[[ -f "$receipt" && ! -L "$receipt" && "$(wc -c <"$receipt")" -le 8192 ]]',
  ]) if (!capture.includes(marker)) fail(`secret-bearing state capture lacks ${marker}`);

  const readCalls = [...capture.matchAll(/^ {10}read_fly_json (.+)$/gm)].map((match) => match[1]);
  const expectedReadCalls = [
    'initial-releases releases --image',
    'initial-image image show',
    'initial-machines machines list',
    'initial-volumes volumes list',
    'final-releases releases --image',
    'final-image image show',
    'final-machines machines list',
    'final-volumes volumes list',
  ];
  if (JSON.stringify(readCalls) !== JSON.stringify(expectedReadCalls)) fail('read-only Fly query set or stable-read order differs');

  if (/\b(?:eval|source)\b|\bset\s+-x\b|\bprintenv\b|\benv\s*(?:\||>|$)|\bcat\s+[^\n]*(?:state_dir|FLY_API_TOKEN)|\btee\b/.test(capture)) {
    fail('secret-bearing step contains a logging, evaluation, or environment-disclosure primitive');
  }
  if (/\bfly\s+(?:deploy|launch|scale|destroy|restart|ssh|proxy|logs|machine\s+(?:run|start|stop|restart|update|destroy|clone)|machines\s+(?:run|start|stop|restart|update|destroy|clone)|volumes?\s+(?:create|destroy|delete|extend|fork|update)|secrets?\s+(?:set|unset|import|deploy)|releases?\s+rollback|ips?\s+(?:allocate|release)|certs?\s+(?:add|remove)|apps?\s+(?:create|destroy))\b/i.test(capture)) {
    fail('secret-bearing step contains a Fly mutation or expansive observation command');
  }
  if (/\b(?:curl|wget)\b/.test(capture.replaceAll("env -u FLY_API_TOKEN curl --proto '=https' --tlsv1.2 --fail --silent --show-error", ''))) {
    fail('secret-bearing step contains an unreviewed network client invocation');
  }

  const upload = section(
    '      - name: Upload bounded content-free production state receipt\n',
    '\n      - name: Emit content-free snapshot summary',
    'receipt upload',
  );
  for (const marker of [
    'uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    'name: assesssuite-production-state-snapshot-${{ github.run_id }}-${{ github.run_attempt }}',
    'path: ${{ runner.temp }}/production-state-receipt/production-state-snapshot.json',
    'if-no-files-found: error',
    'retention-days: 3\n',
    'compression-level: 0',
    'overwrite: false',
  ]) if (!upload.includes(marker)) fail(`receipt upload lacks ${marker}`);
  if (/\*|production-state-raw|runner\.temp\s*$/m.test(upload)) fail('receipt upload path is broader than the exact bounded JSON file');
  if (!source.includes('ARTIFACT_DIGEST: sha256:${{ steps.upload.outputs.artifact-digest }}')) {
    fail('snapshot summary does not canonicalise the GitHub artifact digest');
  }
  for (const marker of [
    '[[ "$ARTIFACT_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]',
    'echo "- Artifact digest: $ARTIFACT_DIGEST"',
  ]) if (!source.includes(marker)) fail(`snapshot summary lacks ${marker}`);

  const beforeCapture = source.slice(0, source.indexOf('      - name: Final secret-bearing read-only Fly production state capture'));
  const afterCapture = source.slice(source.indexOf('\n      - name: Upload bounded content-free production state receipt'));
  if (beforeCapture.includes('FLY_API_TOKEN') || afterCapture.includes('FLY_API_TOKEN')) fail('Fly token appears outside the sole secret-bearing step');
  if (/\b(?:npm|npx|node)\s+(?:ci|install|run)|\bdocker\b/.test(capture)) fail('secret-bearing step executes application or container tooling');

  return failures;
}

const source = fs.readFileSync(workflowPath, 'utf8');
const failures = validateWorkflow(source);
if (failures.length) {
  process.stderr.write(`production state snapshot workflow contract failed:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}

if (selftest) {
  const mutations = [
    ['trigger-push', 'on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:'],
    ['permissions-write', 'permissions:\n  contents: read', 'permissions:\n  contents: write'],
    ['input-expanded', '      confirmation:\n', '      unsafe_override:\n        required: true\n        type: string\n      confirmation:\n'],
    ['extra-job', '\njobs:\n  snapshot:\n', '\njobs:\n  unsafe:\n    name: Unsafe\n    runs-on: ubuntu-24.04\n  snapshot:\n'],
    ['environment-removed', '    environment: production\n', ''],
    ['actor-bypass', '[[ "$ACTOR" == "mbvidler-ctrl" ]]', '[[ -n "$ACTOR" ]]'],
    ['triggering-actor-bypass', '[[ "$TRIGGERING_ACTOR" == "mbvidler-ctrl" ]]', '[[ -n "$TRIGGERING_ACTOR" ]]'],
    ['workflow-sha-bypass', '[[ "$WORKFLOW_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', 'true'],
    ['event-sha-bypass', '[[ "$EVENT_SHA" == "$TRUSTED_WORKFLOW_SHA" ]]', 'true'],
    ['confirmation-weakened', '[[ "$CONFIRMATION" == "SNAPSHOT assesssuite-production READ ONLY" ]]', '[[ -n "$CONFIRMATION" ]]'],
    ['capability-intent-weakened', '[[ "$CAPABILITY_INTENT_ID" =~ ^[A-Za-z0-9._:-]{1,160}$ ]]', '[[ -n "$CAPABILITY_INTENT_ID" ]]'],
    ['checkout-unpinned', 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0', 'actions/checkout@main'],
    ['upload-unpinned', 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', 'actions/upload-artifact@v4'],
    [
      'remote-main-check-removed',
      '          trap cleanup EXIT\n\n          [[ "$(git rev-parse --verify \'HEAD^{commit}\')" == "$TRUSTED_WORKFLOW_SHA" ]]\n          [[ "$(git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main | awk \'NR == 1 { print $1 }\')" == "$TRUSTED_WORKFLOW_SHA" ]]',
      '          trap cleanup EXIT\n\n          [[ "$(git rev-parse --verify \'HEAD^{commit}\')" == "$TRUSTED_WORKFLOW_SHA" ]]\n          true',
    ],
    ['validator-pin-mutated', `EXPECTED_SNAPSHOT_VALIDATOR_SHA256: ${validatorSha256}`, `EXPECTED_SNAPSHOT_VALIDATOR_SHA256: ${'0'.repeat(64)}`],
    ['secret-duplicated', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n', '          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n          SECOND_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n'],
    ['xtrace-enabled', '          set +x\n', '          set -x\n'],
    ['fly-mutation-injected', '          read_fly_json initial-releases releases --image\n', '          fly volumes destroy vol_attacker --app "$app" --yes\n          read_fly_json initial-releases releases --image\n'],
    ['initial-image-read-removed', '          read_fly_json initial-image image show\n', ''],
    ['final-release-read-removed', '          read_fly_json final-releases releases --image\n', ''],
    ['topology-count-bypass', 'if (machines.length !== 1 || volumes.length !== 1)', 'if (false)'],
    ['encryption-bypass', 'volume.encrypted !== true', 'false'],
    ['snapshot-retention-bypass', 'volume.snapshot_retention !== 5', 'false'],
    ['scheduled-snapshot-bypass', 'volume.auto_backup_enabled !== true', 'false'],
    ['stable-image-bypass', 'JSON.stringify(initialImage) !== JSON.stringify(finalImage)', 'false'],
    ['public-sha-bypass', 'if (apexSha !== flySha)', 'if (false)'],
    ['receipt-field-removed', "            public_release_sha: apexSha,\n", ''],
    ['receipt-bound-weakened', 'if (Buffer.byteLength(encoded) > 8192)', 'if (false)'],
    ['upload-broadened', 'path: ${{ runner.temp }}/production-state-receipt/production-state-snapshot.json', 'path: ${{ runner.temp }}'],
    ['retention-weakened', 'retention-days: 3\n', 'retention-days: 30\n'],
    ['artifact-digest-prefix-removed', 'ARTIFACT_DIGEST: sha256:${{ steps.upload.outputs.artifact-digest }}', 'ARTIFACT_DIGEST: ${{ steps.upload.outputs.artifact-digest }}'],
    ['artifact-digest-shape-weakened', '[[ "$ARTIFACT_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]', '[[ -n "$ARTIFACT_DIGEST" ]]'],
  ];
  const escaped = [];
  for (const [name, from, to] of mutations) {
    const mutated = replaceOnce(normalized(source), from, to, name);
    if (validateWorkflow(mutated).length === 0) escaped.push(name);
  }
  if (escaped.length) {
    process.stderr.write(`production state snapshot workflow mutation selftest failed; mutation(s) escaped:\n- ${escaped.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`production state snapshot workflow mutation selftest passed (${mutations.length}/${mutations.length} rejected)\n`);
} else {
  process.stdout.write('production state snapshot workflow contract passed\n');
}
