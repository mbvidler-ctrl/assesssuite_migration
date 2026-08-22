import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { admitGitHubArtifacts } from '../../scripts/github-artifact-admission.mjs';

const applicationSha = 'a'.repeat(40);
const artifactDigest = `sha256:${'b'.repeat(64)}`;
const repository = 'mbvidler-ctrl/assesssuite_migration';
const apiCredentialFixture = (length) => Buffer.alloc(length, 0x78).toString('ascii');
const validApiCredential = apiCredentialFixture(32);
const shortApiCredential = apiCredentialFixture(8);

function spec(overrides = {}) {
  return {
    repository,
    application_sha: applicationSha,
    artifacts: [{
      key: 'candidate',
      id: '123',
      expected_digest: artifactDigest,
      maximum_bytes: 1_073_741_824,
      name_patterns: [`^physio-candidate-${applicationSha}$`],
      workflow_path: '.github/workflows/physio-production-prepare-release.yml',
      allowed_conclusions: ['success'],
      ...overrides,
    }],
  };
}

async function withApi({ artifact = {}, run = {} } = {}, callback) {
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');
    if (request.url === `/repos/${repository}/actions/artifacts/123`) {
      response.end(JSON.stringify({
        id: 123,
        name: `physio-candidate-${applicationSha}`,
        digest: artifactDigest,
        expired: false,
        size_in_bytes: 4096,
        workflow_run: { id: 456, head_sha: applicationSha },
        ...artifact,
      }));
      return;
    }
    if (request.url === `/repos/${repository}/actions/runs/456`) {
      response.end(JSON.stringify({
        id: 456,
        run_attempt: 1,
        head_sha: applicationSha,
        head_branch: 'main',
        status: 'completed',
        conclusion: 'success',
        event: 'workflow_dispatch',
        path: '.github/workflows/physio-production-prepare-release.yml',
        repository: { full_name: repository },
        head_repository: { full_name: repository },
        ...run,
      }));
      return;
    }
    response.statusCode = 404;
    response.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('admits an exact repository-scoped artifact and resolves its source run ID', async () => {
  await withApi({}, async (apiBase) => {
    const receipt = await admitGitHubArtifacts(spec(), { token: validApiCredential, apiBase });
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.artifacts.candidate.workflow_run_id, 456);
    assert.equal(receipt.artifacts.candidate.workflow_run_attempt, 1);
    assert.equal(receipt.artifacts.candidate.workflow_run_head_branch, 'main');
    assert.equal(receipt.artifacts.candidate.digest, artifactDigest);
    assert.equal(receipt.artifacts.candidate.workflow_run_path,
      '.github/workflows/physio-production-prepare-release.yml');
  });
});

test('rejects artifact digest or application-SHA drift', async () => {
  await withApi({ artifact: { digest: `sha256:${'c'.repeat(64)}` } }, async (apiBase) => {
    await assert.rejects(
      admitGitHubArtifacts(spec(), { token: validApiCredential, apiBase }),
      /artifact metadata differs/,
    );
  });
  await withApi({ artifact: { workflow_run: { id: 456, head_sha: 'd'.repeat(40) } } }, async (apiBase) => {
    await assert.rejects(
      admitGitHubArtifacts(spec(), { token: validApiCredential, apiBase }),
      /artifact metadata differs/,
    );
  });
});

test('rejects an artifact larger than its exact pre-download bound', async () => {
  await withApi({ artifact: { size_in_bytes: 1_073_741_825 } }, async (apiBase) => {
    await assert.rejects(
      admitGitHubArtifacts(spec(), { token: validApiCredential, apiBase }),
      /artifact metadata differs/,
    );
  });
});

test('rejects unsafe bounds, unanchored names, and duplicate artifact IDs before any request', async () => {
  for (const overrides of [
    { maximum_bytes: 0 },
    { maximum_bytes: 1.5 },
    { maximum_bytes: 1_073_741_825 },
    { name_patterns: [`physio-candidate-${applicationSha}`] },
  ]) {
    await assert.rejects(
      admitGitHubArtifacts(spec(overrides), { token: validApiCredential }),
    );
  }
  const duplicate = spec();
  duplicate.artifacts.push({ ...duplicate.artifacts[0], key: 'candidate_copy' });
  await assert.rejects(
    admitGitHubArtifacts(duplicate, { token: validApiCredential }),
    /duplicate artifact ID/,
  );
});

test('rejects caller-widened or unreviewed artifact-family bounds before any request', async () => {
  await assert.rejects(
    admitGitHubArtifacts(spec({
      workflow_path: '.github/workflows/physio-production-bootstrap.yml',
      key: 'bootstrap',
      name_patterns: [`^physio-production-bootstrap-${applicationSha}$`],
      maximum_bytes: 33_554_433,
    }), { token: validApiCredential }),
    /maximum bytes differs from its reviewed artifact family/,
  );
  await assert.rejects(
    admitGitHubArtifacts(spec({ key: 'invented_family' }), {
      token: validApiCredential,
    }),
    /artifact family is not reviewed/,
  );
  await assert.rejects(
    admitGitHubArtifacts(spec({
      name_patterns: [`^physio-sentry-release-${applicationSha}$`],
    }), { token: validApiCredential }),
    /name patterns differ from its reviewed artifact family/,
  );
});

test('rejects a foreign workflow, repository, branch, event, or non-admitted conclusion', async () => {
  for (const run of [
    { path: '.github/workflows/ci.yml' },
    { repository: { full_name: 'foreign/repository' } },
    { head_branch: 'candidate-branch' },
    { event: 'push' },
    { conclusion: 'failure' },
  ]) {
    await withApi({ run }, async (apiBase) => {
      await assert.rejects(
        admitGitHubArtifacts(spec(), { token: validApiCredential, apiBase }),
        /workflow-run metadata differs/,
      );
    });
  }
});

test('permits a failed prior run only when a resume spec explicitly admits it', async () => {
  const artifactName = `physio-publication-started-${applicationSha}`;
  const workflowPath = '.github/workflows/physio-production-publish.yml';
  await withApi({ artifact: { name: artifactName }, run: { conclusion: 'failure', path: workflowPath } }, async (apiBase) => {
    const receipt = await admitGitHubArtifacts(spec({
      key: 'resume_started_effect',
      expected_digest: null,
      maximum_bytes: 33_554_432,
      name_patterns: [`^${artifactName}$`, `^physio-production-publication-${applicationSha}$`],
      workflow_path: workflowPath,
      allowed_conclusions: ['success', 'failure', 'cancelled', 'timed_out'],
    }), { token: validApiCredential, apiBase });
    assert.equal(receipt.artifacts.resume_started_effect.workflow_run_conclusion, 'failure');
  });
});

test('the complete reviewed artifact-family table validates and cannot widen conclusions or digest posture', async () => {
  const success = ['success'];
  const resume = ['success', 'failure', 'cancelled', 'timed_out'];
  const sha = applicationSha;
  const zero64 = '0'.repeat(64);
  const failedSha = 'c'.repeat(40);
  const rows = [
    ['candidate', '.github/workflows/physio-production-prepare-release.yml', 1_073_741_824,
      [`^physio-candidate-${sha}$`], success, artifactDigest],
    ['sentry_release', '.github/workflows/physio-production-prepare-release.yml', 536_870_912,
      [`^physio-sentry-release-${sha}$`], success, artifactDigest],
    ['sentry_resume_effect', '.github/workflows/physio-production-prepare-release.yml', 33_554_432,
      [`^physio-sentry-phase-[a-z-]+-${sha}-g[0-9]+$`, `^physio-sentry-release-${sha}$`], resume, artifactDigest],
    ['state_snapshot', '.github/workflows/physio-production-state-snapshot.yml', 33_554_432,
      [`^physio-production-state-${sha}$`], success, artifactDigest],
    ['canary', '.github/workflows/physio-production-exact-image-canary.yml', 33_554_432,
      [`^physio-exact-image-canary-${sha}$`], success, artifactDigest],
    ['resume_effect', '.github/workflows/physio-production-exact-image-canary.yml', 33_554_432,
      [`^physio-exact-image-canary-effect-${zero64}$`], resume, artifactDigest],
    ['resume_success', '.github/workflows/physio-production-exact-image-canary.yml', 33_554_432,
      [`^physio-exact-image-canary-${sha}$`], resume, artifactDigest],
    ['bootstrap', '.github/workflows/physio-production-bootstrap.yml', 33_554_432,
      [`^physio-production-bootstrap-${sha}$`], success, artifactDigest],
    ['production_bootstrap', '.github/workflows/physio-production-bootstrap.yml', 33_554_432,
      [`^physio-production-bootstrap-${sha}$`], success, artifactDigest],
    ['resume_action', '.github/workflows/physio-production-bootstrap.yml', 33_554_432,
      [`^physio-bootstrap-started-${sha}$`, `^physio-bootstrap-provider-admission-${sha}$`,
        `^physio-production-bootstrap-${sha}$`], resume, null],
    ['stripe_webhook', '.github/workflows/physio-production-stripe-webhook.yml', 33_554_432,
      [`^physio-production-stripe-webhook-${sha}$`], success, artifactDigest],
    ['resume_started_effect', '.github/workflows/physio-production-stripe-webhook.yml', 33_554_432,
      [`^physio-stripe-webhook-started-${sha}$`, `^physio-stripe-webhook-plan-${sha}(?:-[1-9][0-9]*)?$`,
        `^physio-stripe-webhook-compensation-phase-${sha}-[0-9]+-[0-9]+$`,
        `^physio-production-stripe-webhook-${sha}$`], resume, null],
    ['webhook_archive_source', '.github/workflows/physio-production-stripe-webhook.yml', 33_554_432,
      [`^physio-stripe-webhook-compensation-phase-${sha}-[0-9]+-[0-9]+$`,
        `^physio-production-stripe-webhook-${sha}$`], resume, artifactDigest],
    ['stripe_webhook_archive', '.github/workflows/physio-production-webhook-archive.yml', 67_108_864,
      [`^physio-webhook-archive-${sha}$`], success, artifactDigest],
    ['publication', '.github/workflows/physio-production-publish.yml', 33_554_432,
      [`^physio-production-publication-${sha}$`], success, artifactDigest],
    ['resume_started_effect', '.github/workflows/physio-production-publish.yml', 33_554_432,
      [`^physio-publication-started-${sha}$`, `^physio-production-publication-${sha}$`], resume, null],
    ['resume_deploy_effect', '.github/workflows/physio-production-deploy.yml', 67_108_864,
      [`^physio-deploy-(?:started|phase|terminal|completed-reuse)-${sha}(?:-[A-Za-z0-9_-]+)?$`], resume, artifactDigest],
    ['rollback_target', '.github/workflows/physio-production-deploy.yml', 67_108_864,
      [`^physio-deploy-${sha}-[1-9][0-9]*$`], success, artifactDigest],
    ['resume_rollback_effect', '.github/workflows/physio-production-rollback.yml', 33_554_432,
      [`^physio-rollback-(?:started|phase|terminal|completed-reuse)-${failedSha}-[A-Za-z0-9_-]+$`], resume, artifactDigest],
  ];
  assert.equal(rows.length, 19);
  for (const [index, [key, workflowPath, maximumBytes, namePatterns, allowedConclusions, expectedDigest]] of rows.entries()) {
    await assert.rejects(
      admitGitHubArtifacts({
        repository,
        application_sha: sha,
        artifacts: [{
          key,
          id: String(index + 1),
          expected_digest: expectedDigest,
          maximum_bytes: maximumBytes,
          name_patterns: namePatterns,
          workflow_path: workflowPath,
          allowed_conclusions: allowedConclusions,
        }],
      }, { token: shortApiCredential }),
      /GitHub token is unavailable or malformed/,
      `${workflowPath}:${key} should pass the closed family policy before token admission`,
    );
  }

  await assert.rejects(
    admitGitHubArtifacts(spec({ allowed_conclusions: resume }), { token: validApiCredential }),
    /allowed conclusions differ from its reviewed artifact family/,
  );
  await assert.rejects(
    admitGitHubArtifacts(spec({ expected_digest: null }), { token: validApiCredential }),
    /expected digest is invalid/,
  );
});
