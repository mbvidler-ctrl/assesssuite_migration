import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

import {
  DEPLOY_REF,
  DEPLOY_WORKFLOW_PATH,
  buildContinuationRequest,
  dispatchContinuation,
} from '../../scripts/physio-deploy-continuation.mjs';

const applicationSha = 'a'.repeat(40);
const ledgerCommitSha = 'b'.repeat(40);
const ledgerRecordSha = 'c'.repeat(64);

function inputs(overrides = {}) {
  return {
    application_sha: applicationSha,
    immutable_image: `registry.fly.io/assesssuite-physio-production@sha256:${'d'.repeat(64)}`,
    publication_artifact_id: '101', publication_artifact_digest: `sha256:${'1'.repeat(64)}`,
    publication_receipt_sha256: '2'.repeat(64),
    canary_artifact_id: '102', canary_artifact_digest: `sha256:${'3'.repeat(64)}`,
    canary_receipt_sha256: '4'.repeat(64),
    production_bootstrap_artifact_id: '103',
    production_bootstrap_artifact_digest: `sha256:${'5'.repeat(64)}`,
    production_bootstrap_receipt_sha256: '6'.repeat(64),
    stripe_webhook_archive_artifact_id: '104',
    stripe_webhook_archive_artifact_digest: `sha256:${'7'.repeat(64)}`,
    stripe_webhook_archive_receipt_sha256: '8'.repeat(64),
    sentry_release_artifact_id: '105', sentry_release_artifact_digest: `sha256:${'9'.repeat(64)}`,
    sentry_release_receipt_sha256: '0'.repeat(64), expected_volume_id: 'vol_123abc',
    config_sha256: 'e'.repeat(64), capability_intent_id: 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP',
    authority_reference: 'UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP-LIVE',
    continuation_ledger_commit_sha: ledgerCommitSha,
    continuation_ledger_record_sha256: ledgerRecordSha,
    confirmation: 'DEPLOY assesssuite-physio-production FIRST RELEASE EXACT DIGEST',
    ...overrides,
  };
}

function run(id, row = inputs()) {
  return { id, name: 'Physio production deploy - exact digest first release',
    display_title: `Physio deploy ${row.application_sha} after ${row.continuation_ledger_record_sha256}`,
    event: 'workflow_dispatch', head_branch: DEPLOY_REF, head_sha: row.application_sha,
    path: DEPLOY_WORKFLOW_PATH, status: 'queued',
    repository: { full_name: 'mbvidler-ctrl/assesssuite_migration' },
    head_repository: { full_name: 'mbvidler-ctrl/assesssuite_migration' } };
}

function response(status, body = '') {
  return { status, headers: {}, body };
}

test('continuation request has a closed input set and cannot choose workflow or ref', () => {
  const row = inputs();
  assert.deepEqual(buildContinuationRequest(row), { ref: 'main', inputs: row });
  assert.throws(() => buildContinuationRequest({ ...row, workflow: 'foreign.yml' }),
    /DEPLOY_CONTINUATION_INPUT_INVALID/);
  assert.throws(() => buildContinuationRequest({ ...row, continuation_ledger_record_sha256: 'f'.repeat(64),
    confirmation: 'foreign' }), /DEPLOY_CONTINUATION_INPUT_INVALID/);
});

test('lost dispatch response is reconciled by the exact immutable run identity', async () => {
  const row = inputs();
  let dispatched = false;
  let postCalls = 0;
  const client = { repository: 'mbvidler-ctrl/assesssuite_migration', async request(url, options = {}) {
    if (options.method === 'POST') {
      postCalls += 1;
      assert.equal(url, '/actions/workflows/physio-production-deploy.yml/dispatches');
      assert.deepEqual(JSON.parse(options.body), { ref: 'main', inputs: row });
      dispatched = true;
      throw new Error('socket closed after request body');
    }
    return response(200, JSON.stringify({ total_count: dispatched ? 1 : 0,
      workflow_runs: dispatched ? [run(8001, row)] : [] }));
  } };
  const result = await dispatchContinuation({ client, inputs: row, pollAttempts: 2, pollIntervalMs: 0,
    sleepImpl: async () => {} });
  assert.equal(result.disposition, 'APPLIED');
  assert.equal(result.dispatch_calls_attempted, 1);
  assert.equal(result.dispatch_responses_confirmed, 0);
  assert.equal(result.selected_run_id, 8001);
  assert.equal(postCalls, 1);
});

test('an exact existing or concurrent duplicate continuation never dispatches again', async () => {
  const row = inputs();
  let postCalls = 0;
  const client = { repository: 'mbvidler-ctrl/assesssuite_migration', async request(url, options = {}) {
    if (options.method === 'POST') { postCalls += 1; return response(204); }
    return response(200, JSON.stringify({ total_count: 4, workflow_runs: [
      run(8102, row), run(8101, row),
      { ...run(7999, row), display_title: `Physio deploy ${applicationSha} after ${'f'.repeat(64)}` },
      { ...run(7998, row), path: '.github/workflows/foreign.yml' },
    ] }));
  } };
  const result = await dispatchContinuation({ client, inputs: row });
  assert.deepEqual(result.exact_matching_run_ids, [8101, 8102]);
  assert.equal(result.selected_run_id, 8101);
  assert.equal(result.dispatch_calls_attempted, 0);
  assert.equal(postCalls, 0);
});

test('continuation inventory fails closed on truncation, total drift, and duplicate run IDs', async () => {
  const row = inputs();
  const cases = [
    [{ total_count: 2, workflow_runs: [{ ...run(8201, row), display_title: 'foreign' }] }],
    [{ total_count: 2, workflow_runs: [run(8202, row), run(8202, row)] }],
    [
      { total_count: 101, workflow_runs: Array.from({ length: 100 }, (_, index) =>
        ({ ...run(8300 + index, row), display_title: `foreign-${index}` })) },
      { total_count: 102, workflow_runs: [run(8401, row), run(8402, row)] },
    ],
  ];
  for (const pages of cases) {
    let getCalls = 0;
    let postCalls = 0;
    const client = { repository: 'mbvidler-ctrl/assesssuite_migration', async request(_url, options = {}) {
      if (options.method === 'POST') { postCalls += 1; return response(204); }
      const page = pages[Math.min(getCalls++, pages.length - 1)];
      return response(200, JSON.stringify(page));
    } };
    await assert.rejects(dispatchContinuation({ client, inputs: row, pollAttempts: 1,
      pollIntervalMs: 0, sleepImpl: async () => {} }), /PAGINATION/);
    assert.equal(postCalls, 0);
  }
});

test('workflow serialises duplicate runs and rejects a stale protected tip before every provider transition', () => {
  const file = path.resolve('.github/workflows/physio-production-deploy.yml');
  const source = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  const workflow = yaml.load(source);
  assert.deepEqual(workflow.concurrency, { group: 'assesssuite-physio-production', 'cancel-in-progress': false });
  assert.equal(workflow.jobs.continue_fly_transition.environment, undefined);
  assert.equal(workflow.jobs.continue_sentry_transition.environment, undefined);
  assert.deepEqual(workflow.jobs.continue_fly_transition.permissions, { contents: 'read', actions: 'write' });
  assert.deepEqual(workflow.jobs.continue_sentry_transition.permissions, { contents: 'read', actions: 'write' });
  for (const jobName of ['continue_fly_transition', 'continue_sentry_transition']) {
    const encoded = JSON.stringify(workflow.jobs[jobName]);
    assert.doesNotMatch(encoded, /actions\/checkout|secrets\.|FLY_API_TOKEN:\$\{\{|SENTRY_AUTH_TOKEN:\$\{\{|id-token/u);
    assert.match(encoded, /\.github\/workflows\/physio-deploy-continuation\.yml/u);
  }
  const continuationSource = fs.readFileSync(
    path.resolve('.github/workflows/physio-deploy-continuation.yml'), 'utf8').replaceAll('\r\n', '\n');
  assert.match(continuationSource, /observedCount !== expectedTotalCount/u);
  assert.match(continuationSource, /seenRunIds\.has\(run\.id\)/u);
  const bind = source.indexOf('Bind an automatic continuation to the exact protected tip that authorised it');
  const selector = source.indexOf('Select exactly one credential-bearing Fly transition for this workflow run');
  const firstProvider = source.indexOf('timeout --signal=TERM', selector);
  assert.ok(bind > 0 && selector > bind && firstProvider > selector);
  assert.match(source.slice(bind, selector), /\[\[ "\$EXPECTED_COMMIT" == "\$ACTUAL_COMMIT" && "\$EXPECTED_RECORD" == "\$ACTUAL_RECORD" \]\]/u);
});
