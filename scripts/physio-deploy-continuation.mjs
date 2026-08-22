#!/usr/bin/env node

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEPLOY_CONTINUATION_CONTRACT = 'assesssuite-physio-deploy-continuation/1.0.0';
export const DEPLOY_WORKFLOW_PATH = '.github/workflows/physio-production-deploy.yml';
export const DEPLOY_WORKFLOW_API_ID = 'physio-production-deploy.yml';
export const DEPLOY_REF = 'main';

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const INTEGER = /^[1-9][0-9]*$/u;
const EXACT_INPUT_NAMES = Object.freeze([
  'application_sha', 'immutable_image',
  'publication_artifact_id', 'publication_artifact_digest', 'publication_receipt_sha256',
  'canary_artifact_id', 'canary_artifact_digest', 'canary_receipt_sha256',
  'production_bootstrap_artifact_id', 'production_bootstrap_artifact_digest',
  'production_bootstrap_receipt_sha256',
  'stripe_webhook_archive_artifact_id', 'stripe_webhook_archive_artifact_digest',
  'stripe_webhook_archive_receipt_sha256',
  'sentry_release_artifact_id', 'sentry_release_artifact_digest', 'sentry_release_receipt_sha256',
  'expected_volume_id', 'config_sha256', 'capability_intent_id', 'authority_reference',
  'continuation_ledger_commit_sha', 'continuation_ledger_record_sha256', 'confirmation',
]);

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function exactKeys(value, names, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...names].sort())) {
    fail(code, 'input keys differ');
  }
}

function cleanString(value, label, pattern = null) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024 || /[\r\n\0]/u.test(value) ||
      (pattern && !pattern.test(value))) fail('DEPLOY_CONTINUATION_INPUT_INVALID', label);
  return value;
}

export function validateContinuationInputs(inputs) {
  exactKeys(inputs, EXACT_INPUT_NAMES, 'DEPLOY_CONTINUATION_INPUT_INVALID');
  cleanString(inputs.application_sha, 'application_sha', SHA40);
  cleanString(inputs.immutable_image, 'immutable_image',
    /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/u);
  for (const name of ['publication_artifact_id', 'canary_artifact_id',
    'production_bootstrap_artifact_id', 'stripe_webhook_archive_artifact_id',
    'sentry_release_artifact_id', 'expected_volume_id']) {
    cleanString(inputs[name], name, name === 'expected_volume_id' ? /^vol_[A-Za-z0-9]+$/u : INTEGER);
  }
  for (const name of ['publication_artifact_digest', 'canary_artifact_digest',
    'production_bootstrap_artifact_digest', 'stripe_webhook_archive_artifact_digest',
    'sentry_release_artifact_digest']) cleanString(inputs[name], name, DIGEST);
  for (const name of ['publication_receipt_sha256', 'canary_receipt_sha256',
    'production_bootstrap_receipt_sha256', 'stripe_webhook_archive_receipt_sha256',
    'sentry_release_receipt_sha256', 'config_sha256', 'continuation_ledger_record_sha256']) {
    cleanString(inputs[name], name, SHA256);
  }
  cleanString(inputs.continuation_ledger_commit_sha, 'continuation_ledger_commit_sha', SHA40);
  cleanString(inputs.capability_intent_id, 'capability_intent_id', /^[A-Za-z0-9][A-Za-z0-9._:-]{2,255}$/u);
  cleanString(inputs.authority_reference, 'authority_reference');
  if (inputs.confirmation !== 'DEPLOY assesssuite-physio-production FIRST RELEASE EXACT DIGEST') {
    fail('DEPLOY_CONTINUATION_INPUT_INVALID', 'confirmation');
  }
  return inputs;
}

export function buildContinuationRequest(inputs) {
  validateContinuationInputs(inputs);
  return { ref: DEPLOY_REF, inputs: Object.fromEntries(EXACT_INPUT_NAMES.map((name) => [name, inputs[name]])) };
}

export function continuationRunTitle(inputs) {
  validateContinuationInputs(inputs);
  return `Physio deploy ${inputs.application_sha} after ${inputs.continuation_ledger_record_sha256}`;
}

function validateRun(run, repository, inputs) {
  return run && Number.isSafeInteger(run.id) && run.id > 0 &&
    run.name === 'Physio production deploy - exact digest first release' &&
    run.display_title === continuationRunTitle(inputs) && run.event === 'workflow_dispatch' &&
    run.head_branch === DEPLOY_REF && run.head_sha === inputs.application_sha &&
    run.path === DEPLOY_WORKFLOW_PATH && run.repository?.full_name === repository &&
    run.head_repository?.full_name === repository &&
    ['queued', 'in_progress', 'completed', 'requested', 'waiting', 'pending'].includes(run.status);
}

export function createContinuationGitHubClient({ repository, token, fetchImpl = fetch }) {
  cleanString(repository, 'repository', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
  cleanString(token, 'token');
  const base = `https://api.github.com/repos/${repository}`;
  const headers = { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28' };
  async function request(path, options = {}) {
    const response = await fetchImpl(`${base}${path}`, { ...options,
      headers: { ...headers, ...(options.headers || {}) }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    const body = await response.text();
    if (body.length > 2_097_152) fail('DEPLOY_CONTINUATION_API_OVERSIZE', path);
    return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body };
  }
  return { repository, request };
}

export async function listExactContinuationRuns({ client, inputs }) {
  validateContinuationInputs(inputs);
  const matches = [];
  const seenRunIds = new Set();
  let expectedTotalCount = null;
  let observedCount = 0;
  for (let page = 1; page <= 100; page += 1) {
    const query = new URLSearchParams({ branch: DEPLOY_REF, event: 'workflow_dispatch', per_page: '100', page: String(page) });
    const response = await client.request(`/actions/workflows/${DEPLOY_WORKFLOW_API_ID}/runs?${query}`);
    if (response.status !== 200) fail('DEPLOY_CONTINUATION_API_STATUS', `runs ${response.status}`);
    let row;
    try { row = JSON.parse(response.body); } catch { fail('DEPLOY_CONTINUATION_API_JSON', 'runs'); }
    if (!row || !Number.isSafeInteger(row.total_count) || !Array.isArray(row.workflow_runs) ||
        row.total_count < 0 || row.total_count > 10_000 || row.workflow_runs.length > 100) {
      fail('DEPLOY_CONTINUATION_API_SCHEMA', 'runs');
    }
    if (expectedTotalCount === null) expectedTotalCount = row.total_count;
    if (row.total_count !== expectedTotalCount) {
      fail('DEPLOY_CONTINUATION_API_PAGINATION', 'total_count changed during inventory');
    }
    for (const run of row.workflow_runs) {
      if (!Number.isSafeInteger(run?.id) || run.id <= 0 || seenRunIds.has(run.id)) {
        fail('DEPLOY_CONTINUATION_API_PAGINATION', 'duplicate or invalid run id');
      }
      seenRunIds.add(run.id);
      if (validateRun(run, client.repository, inputs)) matches.push(run);
    }
    observedCount += row.workflow_runs.length;
    if (observedCount > expectedTotalCount) {
      fail('DEPLOY_CONTINUATION_API_PAGINATION', 'inventory exceeds total_count');
    }
    if (observedCount === expectedTotalCount) break;
    if (row.workflow_runs.length < 100) {
      fail('DEPLOY_CONTINUATION_API_PAGINATION', 'inventory terminated before total_count');
    }
    if (page === 100) fail('DEPLOY_CONTINUATION_API_PAGINATION', 'run history exceeds bound');
  }
  if (observedCount !== expectedTotalCount) {
    fail('DEPLOY_CONTINUATION_API_PAGINATION', 'inventory is incomplete');
  }
  return matches.sort((left, right) => left.id - right.id);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchContinuation({ client, inputs, pollAttempts = 20, pollIntervalMs = 3_000,
  sleepImpl = sleep }) {
  const request = buildContinuationRequest(inputs);
  const existing = await listExactContinuationRuns({ client, inputs });
  if (existing.length > 0) {
    return { contract_version: DEPLOY_CONTINUATION_CONTRACT, result: 'PASS', disposition: 'APPLIED',
      dispatch_calls_attempted: 0, dispatch_responses_confirmed: 0,
      exact_matching_run_ids: existing.map((run) => run.id), selected_run_id: existing[0].id,
      workflow: DEPLOY_WORKFLOW_PATH, ref: DEPLOY_REF,
      application_sha: inputs.application_sha,
      ledger_commit_sha: inputs.continuation_ledger_commit_sha,
      ledger_record_sha256: inputs.continuation_ledger_record_sha256 };
  }
  let mutation = null;
  let mutationError = null;
  try {
    mutation = await client.request(`/actions/workflows/${DEPLOY_WORKFLOW_API_ID}/dispatches`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request),
    });
  } catch (error) {
    mutationError = error;
  }
  const mutationConfirmed = mutation?.status === 204;
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    if (attempt > 0) await sleepImpl(pollIntervalMs);
    const matches = await listExactContinuationRuns({ client, inputs });
    if (matches.length > 0) {
      return { contract_version: DEPLOY_CONTINUATION_CONTRACT, result: 'PASS', disposition: 'APPLIED',
        dispatch_calls_attempted: 1, dispatch_responses_confirmed: mutationConfirmed ? 1 : 0,
        exact_matching_run_ids: matches.map((run) => run.id), selected_run_id: matches[0].id,
        workflow: DEPLOY_WORKFLOW_PATH, ref: DEPLOY_REF,
        application_sha: inputs.application_sha,
        ledger_commit_sha: inputs.continuation_ledger_commit_sha,
        ledger_record_sha256: inputs.continuation_ledger_record_sha256 };
    }
  }
  const status = mutation?.status ?? null;
  const detail = mutationError ? mutationError.message : `HTTP ${status}`;
  fail(mutationConfirmed ? 'DEPLOY_CONTINUATION_DISPATCH_UNOBSERVED' :
    'DEPLOY_CONTINUATION_DISPATCH_AMBIGUOUS', detail);
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--') || index + 1 >= argv.length) fail('DEPLOY_CONTINUATION_USAGE', name);
    out[name.slice(2)] = argv[++index];
  }
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.repository || !args.inputs || !args.output) {
    fail('DEPLOY_CONTINUATION_USAGE', '--repository --inputs --output required');
  }
  const inputs = JSON.parse(fs.readFileSync(args.inputs, 'utf8'));
  const client = createContinuationGitHubClient({ repository: args.repository,
    token: process.env.GITHUB_TOKEN || '' });
  const result = await dispatchContinuation({ client, inputs });
  fs.writeFileSync(args.output, `${JSON.stringify({ ...result, reconciled_at: new Date().toISOString() }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
}
