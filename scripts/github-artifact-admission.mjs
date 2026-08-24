#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/;

const SUCCESS_ONLY = Object.freeze(['success']);
const RESUME_CONCLUSIONS = Object.freeze(['success', 'failure', 'cancelled', 'timed_out']);

function exactPatternList(build) {
  return (patterns, applicationSha) =>
    JSON.stringify(patterns) === JSON.stringify(build(applicationSha));
}

function reviewedFamily(maximumBytes, allowedConclusions, digestPolicy, acceptsNamePatterns) {
  return Object.freeze({ maximumBytes, allowedConclusions, digestPolicy, acceptsNamePatterns });
}

// A caller supplies transport coordinates, but it cannot redefine the reviewed
// artifact family. Each family closes the source workflow, semantic key, byte
// ceiling, name-pattern grammar, conclusion set and digest posture together.
const ARTIFACT_FAMILY_POLICIES = new Map([
  ['.github/workflows/physio-production-prepare-release.yml:candidate', reviewedFamily(
    1_073_741_824, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-candidate-${sha}$`]),
  )],
  ['.github/workflows/physio-production-prepare-release.yml:sentry_release', reviewedFamily(
    536_870_912, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-sentry-release-${sha}$`]),
  )],
  ['.github/workflows/physio-production-prepare-release.yml:sentry_resume_effect', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'required',
    exactPatternList((sha) => [
      `^physio-sentry-phase-[a-z-]+-${sha}-g[0-9]+$`,
      `^physio-sentry-release-${sha}$`,
    ]),
  )],
  ['.github/workflows/physio-production-state-snapshot.yml:state_snapshot', reviewedFamily(
    33_554_432, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-production-state-${sha}$`]),
  )],
  ['.github/workflows/physio-production-exact-image-canary.yml:canary', reviewedFamily(
    33_554_432, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-exact-image-canary-${sha}$`]),
  )],
  ['.github/workflows/physio-production-exact-image-canary.yml:resume_effect', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'required',
    (patterns) => patterns.length === 1 &&
      /^\^physio-exact-image-canary-effect-[0-9a-f]{64}\$$/u.test(patterns[0]),
  )],
  ['.github/workflows/physio-production-exact-image-canary.yml:resume_success', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'required',
    exactPatternList((sha) => [`^physio-exact-image-canary-${sha}$`]),
  )],
  ['.github/workflows/physio-production-bootstrap.yml:bootstrap', reviewedFamily(
    33_554_432, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-production-bootstrap-${sha}$`]),
  )],
  ['.github/workflows/physio-production-bootstrap.yml:production_bootstrap', reviewedFamily(
    33_554_432, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-production-bootstrap-${sha}$`]),
  )],
  ['.github/workflows/physio-production-bootstrap.yml:resume_action', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'null',
    exactPatternList((sha) => [
      `^physio-bootstrap-started-${sha}$`,
      `^physio-bootstrap-provider-admission-${sha}$`,
      `^physio-production-bootstrap-${sha}$`,
    ]),
  )],
  ['.github/workflows/physio-production-stripe-webhook.yml:stripe_webhook', reviewedFamily(
    33_554_432, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-production-stripe-webhook-${sha}$`]),
  )],
  ['.github/workflows/physio-production-stripe-webhook.yml:resume_started_effect', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'null',
    exactPatternList((sha) => [
      `^physio-stripe-webhook-started-${sha}$`,
      `^physio-stripe-webhook-plan-${sha}(?:-[1-9][0-9]*)?$`,
      `^physio-stripe-webhook-compensation-phase-${sha}-[0-9]+-[0-9]+$`,
      `^physio-production-stripe-webhook-${sha}$`,
    ]),
  )],
  ['.github/workflows/physio-production-stripe-webhook.yml:webhook_archive_source', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'required',
    exactPatternList((sha) => [
      `^physio-stripe-webhook-compensation-phase-${sha}-[0-9]+-[0-9]+$`,
      `^physio-production-stripe-webhook-${sha}$`,
    ]),
  )],
  ['.github/workflows/physio-production-webhook-archive.yml:stripe_webhook_archive', reviewedFamily(
    67_108_864, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-webhook-archive-${sha}$`]),
  )],
  ['.github/workflows/physio-production-publish.yml:publication', reviewedFamily(
    33_554_432, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-production-publication-${sha}$`]),
  )],
  ['.github/workflows/physio-production-publish.yml:resume_started_effect', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'null',
    exactPatternList((sha) => [
      `^physio-publication-started-${sha}$`,
      `^physio-production-publication-${sha}$`,
    ]),
  )],
  ['.github/workflows/physio-production-deploy.yml:resume_deploy_effect', reviewedFamily(
    67_108_864, RESUME_CONCLUSIONS, 'required',
    exactPatternList((sha) => [
      `^physio-deploy-(?:started|phase|terminal|completed-reuse)-${sha}(?:-[A-Za-z0-9_-]+)?$`,
    ]),
  )],
  ['.github/workflows/physio-production-deploy.yml:rollback_target', reviewedFamily(
    67_108_864, SUCCESS_ONLY, 'required',
    exactPatternList((sha) => [`^physio-deploy-${sha}-[1-9][0-9]*$`]),
  )],
  ['.github/workflows/physio-production-rollback.yml:resume_rollback_effect', reviewedFamily(
    33_554_432, RESUME_CONCLUSIONS, 'required',
    (patterns) => patterns.length === 1 &&
      /^\^physio-rollback-\(\?:started\|phase\|terminal\|completed-reuse\)-[0-9a-f]{40}-\[A-Za-z0-9_-\]\+\$$/u
        .test(patterns[0]),
  )],
]);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} keys differ`);
}

function positiveInteger(value, label) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) fail(`${label} must be a positive safe integer`);
  return number;
}

function boundedString(value, pattern, label, max = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || !pattern.test(value)) {
    fail(`${label} is invalid`);
  }
  return value;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    result[key.slice(2)] = value;
  }
  exactKeys(result, ['github-output', 'output', 'spec'], 'arguments');
  return result;
}

function readRegularJson(file, maxBytes = 131_072) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > maxBytes) {
    fail(`JSON input is not a bounded regular file: ${resolved}`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

async function readJsonResponse(url, token) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'assesssuite-physio-release-admission',
    },
  });
  if (response.status !== 200) fail(`GitHub metadata readback returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:;|$)/i.test(contentType)) fail('GitHub metadata response is not JSON');
  const body = await response.text();
  if (Buffer.byteLength(body) > 1_048_576) fail('GitHub metadata response exceeds 1 MiB');
  return JSON.parse(body);
}

function validateSpec(spec) {
  exactKeys(spec, ['application_sha', 'artifacts', 'repository'], 'spec');
  boundedString(spec.repository, REPOSITORY, 'repository', 200);
  boundedString(spec.application_sha, SHA40, 'application SHA', 40);
  if (!Array.isArray(spec.artifacts) || spec.artifacts.length < 1 || spec.artifacts.length > 12) {
    fail('artifact spec count is invalid');
  }
  const keys = new Set();
  const artifactIds = new Set();
  for (const row of spec.artifacts) {
    exactKeys(row, ['allowed_conclusions', 'expected_digest', 'id', 'key', 'maximum_bytes', 'name_patterns', 'workflow_path'], `artifact ${row?.key || '?'}`);
    boundedString(row.key, KEY, 'artifact key', 64);
    if (keys.has(row.key)) fail(`duplicate artifact key: ${row.key}`);
    keys.add(row.key);
    const artifactId = positiveInteger(row.id, `${row.key} artifact ID`);
    if (artifactIds.has(artifactId)) fail(`duplicate artifact ID: ${artifactId}`);
    artifactIds.add(artifactId);
    boundedString(row.workflow_path, WORKFLOW_PATH, `${row.key} workflow path`, 240);
    const family = `${row.workflow_path}:${row.key}`;
    const policy = ARTIFACT_FAMILY_POLICIES.get(family);
    if (policy === undefined) fail(`${row.key} artifact family is not reviewed`);
    const maximumBytes = positiveInteger(row.maximum_bytes, `${row.key} maximum bytes`);
    if (maximumBytes !== policy.maximumBytes) fail(`${row.key} maximum bytes differs from its reviewed artifact family`);
    if (policy.digestPolicy === 'required') {
      boundedString(row.expected_digest, SHA256, `${row.key} expected digest`, 71);
    } else if (row.expected_digest !== null) {
      fail(`${row.key} expected digest posture differs from its reviewed artifact family`);
    }
    if (!Array.isArray(row.allowed_conclusions) || row.allowed_conclusions.length < 1 ||
        row.allowed_conclusions.some((value) => !['success', 'failure', 'cancelled', 'timed_out'].includes(value))) {
      fail(`${row.key} allowed conclusions differ`);
    }
    if (JSON.stringify(row.allowed_conclusions) !== JSON.stringify(policy.allowedConclusions)) {
      fail(`${row.key} allowed conclusions differ from its reviewed artifact family`);
    }
    if (!Array.isArray(row.name_patterns) || row.name_patterns.length < 1 || row.name_patterns.length > 4 ||
        row.name_patterns.some((value) => typeof value !== 'string' || value.length < 1 || value.length > 240)) {
      fail(`${row.key} name patterns differ`);
    }
    for (const pattern of row.name_patterns) {
      if (!pattern.startsWith('^') || !pattern.endsWith('$')) fail(`${row.key} name pattern must be anchored`);
      new RegExp(pattern, 'u');
    }
    if (!policy.acceptsNamePatterns(row.name_patterns, spec.application_sha)) {
      fail(`${row.key} name patterns differ from its reviewed artifact family`);
    }
  }
  return spec;
}

async function admitArtifact({ row, repository, applicationSha, token, apiBase }) {
  const artifactId = positiveInteger(row.id, `${row.key} artifact ID`);
  const artifact = await readJsonResponse(`${apiBase}/repos/${repository}/actions/artifacts/${artifactId}`, token);
  const runId = positiveInteger(artifact?.workflow_run?.id, `${row.key} source run ID`);
  const digest = boundedString(artifact?.digest, SHA256, `${row.key} artifact digest`, 71);
  const sizeInBytes = positiveInteger(artifact?.size_in_bytes, `${row.key} artifact size`);
  const nameMatches = row.name_patterns.some((pattern) => new RegExp(pattern, 'u').test(artifact?.name || ''));
  if (artifact?.id !== artifactId || artifact?.expired !== false || artifact?.workflow_run?.head_sha !== applicationSha ||
      sizeInBytes > row.maximum_bytes || !nameMatches ||
      (row.expected_digest !== null && digest !== row.expected_digest)) {
    fail(`${row.key} artifact metadata differs`);
  }
  const run = await readJsonResponse(`${apiBase}/repos/${repository}/actions/runs/${runId}`, token);
  if (run?.id !== runId || run?.head_sha !== applicationSha || run?.status !== 'completed' ||
      !Number.isSafeInteger(run?.run_attempt) || run.run_attempt < 1 ||
      !row.allowed_conclusions.includes(run?.conclusion) || run?.event !== 'workflow_dispatch' ||
      run?.head_branch !== 'main' || run?.path !== row.workflow_path ||
      run?.repository?.full_name !== repository ||
      run?.head_repository?.full_name !== repository) {
    fail(`${row.key} workflow-run metadata differs`);
  }
  return {
    id: artifactId,
    name: artifact.name,
    digest,
    expired: false,
    size_in_bytes: sizeInBytes,
    maximum_bytes: row.maximum_bytes,
    workflow_run_id: runId,
    workflow_run_attempt: run.run_attempt,
    workflow_run_head_sha: run.head_sha,
    workflow_run_head_branch: run.head_branch,
    workflow_run_path: run.path,
    workflow_run_event: run.event,
    workflow_run_conclusion: run.conclusion,
    repository,
  };
}

export async function admitGitHubArtifacts(spec, {
  token,
  apiBase = 'https://api.github.com',
} = {}) {
  validateSpec(spec);
  if (typeof token !== 'string' || token.length < 20 || token.length > 512 || /[\r\n]/.test(token)) {
    fail('GitHub token is unavailable or malformed');
  }
  const artifacts = {};
  for (const row of spec.artifacts) {
    artifacts[row.key] = await admitArtifact({
      row,
      repository: spec.repository,
      applicationSha: spec.application_sha,
      token,
      apiBase,
    });
  }
  return {
    contract_version: 'assesssuite-github-artifact-admission/1.0.0',
    result: 'PASS',
    repository: spec.repository,
    application_sha: spec.application_sha,
    artifacts,
    admitted_at: new Date().toISOString(),
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const spec = validateSpec(readRegularJson(args.spec));
  const receipt = await admitGitHubArtifacts(spec, { token: process.env.GITHUB_TOKEN });
  const outputPath = path.resolve(args.output);
  const githubOutputPath = path.resolve(args['github-output']);
  if (fs.existsSync(outputPath) || fs.lstatSync(path.dirname(outputPath)).isSymbolicLink()) fail('output path is unsafe or already exists');
  const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
  fs.writeFileSync(outputPath, bytes, { flag: 'wx', mode: 0o600 });
  const receiptSha = createHash('sha256').update(bytes).digest('hex');
  const lines = [`artifact_admission_receipt_sha256=${receiptSha}`];
  for (const [key, row] of Object.entries(receipt.artifacts)) {
    lines.push(`${key}_run_id=${row.workflow_run_id}`);
    lines.push(`${key}_artifact_digest=${row.digest}`);
  }
  fs.appendFileSync(githubOutputPath, `${lines.join('\n')}\n`, { encoding: 'utf8' });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
