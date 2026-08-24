import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowDirectory = path.join(root, '.github', 'workflows');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8').replaceAll('\r\n', '\n');
}

function workflow(name) {
  return read('.github', 'workflows', name);
}

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

function allPhysioReleaseWorkflows() {
  return fs.readdirSync(workflowDirectory)
    .filter((name) => /^physio-production-.+\.yml$/.test(name))
    .sort()
    .map((name) => ({ name, source: workflow(name) }));
}

function mutationIndex(source) {
  const patterns = [
    /\bfly apps create\b/,
    /\bfly volumes create\b/,
    /\bfly secrets import\b/,
    /\bdocker push\b/,
    /\bfly deploy\b/,
    /\bfly machine (?:run|update|stop|restart|destroy)\b/,
  ];
  return Math.min(...patterns
    .map((pattern) => source.search(pattern))
    .filter((index) => index >= 0), Number.POSITIVE_INFINITY);
}

function exactArtifactSpecRow(source, key, label) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(
    `\\{\\s*key:\\s*['"]${escapedKey}['"]([\\s\\S]*?)\\}\\s*(?=,\\s*(?:\\{\\s*key:|\\](?:\\s*\\})?)|\\](?:\\s*\\})?|\\))`,
    'u',
  ));
  assert.ok(match, `${label}: exact ${key} artifact specification row is missing`);
  return match[0];
}

function environmentKeyForValue(environment, value, label) {
  const matches = Object.entries(environment || {}).filter(([, candidate]) => candidate === value);
  assert.equal(matches.length, 1, `${label}: expected exactly one environment binding for ${value}`);
  return matches[0][0];
}

function specificationUsesEnvironment(source, property, environmentKey) {
  if (source.includes(`${property}: process.env.${environmentKey}`)) return true;
  const alias = source.match(new RegExp(
    `const\\s+([a-zA-Z][a-zA-Z0-9_]*)\\s*=\\s*process\\.env\\.${environmentKey}\\s*;`,
  ))?.[1];
  if (alias && source.includes(`${property}: ${alias}`)) return true;
  const exportedAlias = source.match(new RegExp(`([A-Z][A-Z0-9_]*)=["']\\$${environmentKey}["']`))?.[1];
  if (!exportedAlias) return false;
  if (source.includes(`${property}: process.env.${exportedAlias}`)) return true;
  const exportedJavaScriptAlias = source.match(new RegExp(
    `const\\s+([a-zA-Z][a-zA-Z0-9_]*)\\s*=\\s*process\\.env\\.${exportedAlias}\\s*;`,
  ))?.[1];
  return Boolean(exportedJavaScriptAlias && source.includes(`${property}: ${exportedJavaScriptAlias}`));
}

const artifactProducerWorkflow = Object.freeze({
  'physio-production-prepare-release.yml': Object.freeze({
    state_snapshot: 'physio-production-state-snapshot.yml',
    sentry_resume_effect: 'physio-production-prepare-release.yml',
  }),
  'physio-production-exact-image-canary.yml': Object.freeze({
    candidate: 'physio-production-prepare-release.yml',
    resume_effect: 'physio-production-exact-image-canary.yml',
    resume_success: 'physio-production-exact-image-canary.yml',
  }),
  'physio-production-bootstrap.yml': Object.freeze({
    candidate: 'physio-production-prepare-release.yml',
    canary: 'physio-production-exact-image-canary.yml',
    resume_action: 'physio-production-bootstrap.yml',
  }),
  'physio-production-stripe-webhook.yml': Object.freeze({
    bootstrap: 'physio-production-bootstrap.yml',
    resume_started_effect: 'physio-production-stripe-webhook.yml',
  }),
  'physio-production-webhook-archive.yml': Object.freeze({
    webhook_archive_source: 'physio-production-stripe-webhook.yml',
  }),
  'physio-production-publish.yml': Object.freeze({
    candidate: 'physio-production-prepare-release.yml',
    canary: 'physio-production-exact-image-canary.yml',
    bootstrap: 'physio-production-bootstrap.yml',
    stripe_webhook_archive: 'physio-production-webhook-archive.yml',
    resume_started_effect: 'physio-production-publish.yml',
  }),
  'physio-production-deploy.yml': Object.freeze({
    publication: 'physio-production-publish.yml',
    canary: 'physio-production-exact-image-canary.yml',
    production_bootstrap: 'physio-production-bootstrap.yml',
    stripe_webhook_archive: 'physio-production-webhook-archive.yml',
    sentry_release: 'physio-production-prepare-release.yml',
  }),
  'physio-production-rollback.yml': Object.freeze({
    rollback_target: 'physio-production-deploy.yml',
    resume_rollback_effect: 'physio-production-rollback.yml',
  }),
});

test('manual release workflows stay within the GitHub workflow_dispatch input ceiling', () => {
  for (const { name, source } of allPhysioReleaseWorkflows()) {
    const document = yaml.load(source);
    const inputNames = Object.keys(document.on?.workflow_dispatch?.inputs || {});
    assert.ok(inputNames.length <= 25,
      `${name} declares ${inputNames.length} workflow_dispatch inputs; GitHub permits at most 25`);
  }
});

test('every cross-run artifact download binds its exact source run and repository before use', () => {
  const helper = read('scripts', 'github-artifact-admission.mjs');
  for (const marker of [
    '/repos/${repository}/actions/artifacts/${artifactId}',
    'artifact?.workflow_run?.id',
    '/repos/${repository}/actions/runs/${runId}',
    'artifact?.workflow_run?.head_sha !== applicationSha',
    'artifact?.expired !== false',
    'row.expected_digest !== null && digest !== row.expected_digest',
    'artifact?.size_in_bytes',
    'row.maximum_bytes',
    "run?.status !== 'completed'",
    '!row.allowed_conclusions.includes(run?.conclusion)',
    "run?.event !== 'workflow_dispatch'",
    "run?.head_branch !== 'main'",
    'run?.path !== row.workflow_path',
    'run?.repository?.full_name !== repository',
    'run?.head_repository?.full_name !== repository',
    'workflow_run_id: runId',
    'workflow_run_head_branch: run.head_branch',
    'lines.push(`${key}_run_id=${row.workflow_run_id}`)',
    'const artifactIds = new Set()',
    'artifactIds.has(artifactId)',
    "pattern.startsWith('^')",
    "pattern.endsWith('$')",
  ]) assert.ok(helper.includes(marker), `shared GitHub artifact resolver is missing ${marker}`);
  assert.match(helper,
    /sizeInBytes\s*>\s*row\.maximum_bytes|size_in_bytes[^\n]*>[^\n]*maximum_bytes/,
    'shared GitHub artifact resolver must reject artifacts above their per-artifact byte ceiling');
  assert.match(helper, /redirect:\s*'error'/,
    'shared GitHub artifact resolver must reject redirected provider metadata');
  assert.match(helper, /response\.status\s*!==\s*200/,
    'shared GitHub artifact resolver must require an exact successful REST response');
  assert.match(helper, /X-GitHub-Api-Version['"]?:\s*['"]2022-11-28['"]/,
    'shared GitHub artifact resolver must pin the provider API version');

  let externalDownloads = 0;
  let sameRunDownloads = 0;
  for (const { name, source } of allPhysioReleaseWorkflows()) {
    const document = yaml.load(source);
    const dispatchInputs = document.on?.workflow_dispatch?.inputs || {};
    const jobs = document.jobs || {};
    for (const [jobName, job] of Object.entries(jobs)) {
      const steps = job.steps || [];
      for (const [downloadIndex, step] of steps.entries()) {
        if (!String(step.uses || '').startsWith('actions/download-artifact@')) continue;
        const artifactExpression = step.with?.['artifact-ids'];
        assert.equal(typeof artifactExpression, 'string', `${name}: download has no exact artifact ID`);
        const external = artifactExpression.match(/^\$\{\{ inputs\.([a-z0-9_]+_artifact_id) \}\}$/);
        const sameRun = artifactExpression.match(/^\$\{\{ needs\.[a-z0-9_]+\.outputs\.[a-z0-9_]+ \}\}$/);
        assert.ok(external || sameRun,
          `${name}: artifact download is neither exact external nor same-run output`);
        if (sameRun) {
          sameRunDownloads += 1;
          assert.ok(
            step.with?.['run-id'] === undefined || step.with?.['run-id'] === '${{ github.run_id }}',
            `${name}: same-run artifact must remain current-run scoped`,
          );
          continue;
        }
        externalDownloads += 1;
        const artifactInput = external[1];
        const prefix = artifactInput.replace(/_artifact_id$/, '');
        const artifactInputExpression = `\${{ inputs.${artifactInput} }}`;
        assert.ok(dispatchInputs[artifactInput], `${name}: missing dispatch input ${artifactInput}`);
        const runBinding = step.with?.['run-id'];
        const localResolverBinding = typeof runBinding === 'string'
          ? runBinding.match(new RegExp(`^\\$\\{\\{ steps\\.([a-z0-9_]+)\\.outputs\\.${prefix}_run_id \\}\\}$`))
          : null;
        const upstreamResolverBinding = typeof runBinding === 'string'
          ? runBinding.match(new RegExp(`^\\$\\{\\{ needs\\.([a-z0-9_]+)\\.outputs\\.${prefix}_run_id \\}\\}$`))
          : null;
        assert.ok(localResolverBinding || upstreamResolverBinding,
          `${name}: ${artifactInput} download is not bound to an exact REST-derived ${prefix}_run_id`);
        assert.equal(step.with?.repository, '${{ github.repository }}',
          `${name}: ${artifactInput} download is not fixed to the current repository`);
        assert.equal(step.with?.['github-token'], '${{ github.token }}',
          `${name}: ${artifactInput} cross-run download lacks the repository-scoped token`);

        let resolverJob = job;
        let resolverSteps = steps;
        let resolverId;
        let resolverIndex;
        if (localResolverBinding) {
          resolverId = localResolverBinding[1];
          resolverIndex = resolverSteps.findIndex((candidate) => candidate.id === resolverId);
          assert.ok(resolverIndex >= 0 && resolverIndex < downloadIndex,
            `${name}: ${artifactInput} REST resolver must complete before its download`);
        } else {
          const resolverJobName = upstreamResolverBinding[1];
          const declaredNeeds = Array.isArray(job.needs) ? job.needs : [job.needs].filter(Boolean);
          assert.ok(declaredNeeds.includes(resolverJobName),
            `${name}: ${jobName} does not depend on ${resolverJobName} before reusing its admitted run ID`);
          resolverJob = jobs[resolverJobName];
          assert.ok(resolverJob, `${name}: ${artifactInput} references missing resolver job ${resolverJobName}`);
          const jobOutput = resolverJob.outputs?.[`${prefix}_run_id`];
          const outputBinding = typeof jobOutput === 'string'
            ? jobOutput.match(new RegExp(`^\\$\\{\\{ steps\\.([a-z0-9_]+)\\.outputs\\.${prefix}_run_id \\}\\}$`))
            : null;
          assert.ok(outputBinding,
            `${name}: ${resolverJobName} does not export an exact resolver-owned ${prefix}_run_id`);
          resolverId = outputBinding[1];
          resolverSteps = resolverJob.steps || [];
          resolverIndex = resolverSteps.findIndex((candidate) => candidate.id === resolverId);
          assert.ok(resolverIndex >= 0,
            `${name}: ${artifactInput} upstream REST resolver ${resolverId} is missing`);
        }
        const resolver = resolverSteps[resolverIndex];
        const validatorCheckoutRef = name === 'physio-production-rollback.yml'
          ? '${{ inputs.trusted_workflow_sha }}'
          : '${{ inputs.application_sha }}';
        const checkoutIndex = resolverSteps.findIndex((candidate) =>
          String(candidate.uses || '').startsWith('actions/checkout@') &&
          candidate.with?.ref === validatorCheckoutRef &&
          candidate.with?.['persist-credentials'] === false);
        assert.ok(checkoutIndex >= 0 && checkoutIndex < resolverIndex,
          `${name}: ${artifactInput} resolver must execute from the exact credential-free application checkout`);
        assert.equal(typeof resolver.run, 'string',
          `${name}: ${artifactInput} resolver has no provider-metadata admission script`);
        const artifactIdEnvironmentKey = environmentKeyForValue(
          resolver.env, artifactInputExpression, `${name}: ${artifactInput}`,
        );
        const repositoryEnvironmentEntries = Object.entries(resolver.env || {})
          .filter(([, value]) => value === '${{ github.repository }}');
        assert.ok(repositoryEnvironmentEntries.length <= 1,
          `${name}: ${artifactInput} has ambiguous repository environment bindings`);
        const admittedRunSha = name === 'physio-production-rollback.yml'
          ? (prefix === 'rollback_target'
              ? '${{ inputs.rollback_release_sha }}'
              : '${{ inputs.trusted_workflow_sha }}')
          : '${{ inputs.application_sha }}';
        const applicationShaEnvironmentKey = environmentKeyForValue(
          resolver.env, admittedRunSha, `${name}: ${artifactInput}`,
        );
        assert.equal(resolver.env?.GITHUB_TOKEN, '${{ github.token }}',
          `${name}: ${artifactInput} resolver lacks the repository-scoped GitHub token`);
        assert.doesNotMatch(JSON.stringify(resolver.env || {}), /secrets\./,
          `${name}: ${artifactInput} resolver may not receive Fly, Stripe or Sentry provider secrets`);
        const admissionSource = resolver.run;
        const producer = artifactProducerWorkflow[name]?.[prefix];
        assert.ok(producer, `${name}: ${prefix} has no exact producer workflow contract`);
        const specificationRow = exactArtifactSpecRow(
          admissionSource, prefix, `${name}: ${artifactInput}`,
        );
        for (const marker of [
          'scripts/github-artifact-admission.mjs',
          '--spec',
          '--output',
          '--github-output',
          'maximum_bytes',
          'name_patterns',
          'workflow_path',
          'allowed_conclusions',
        ]) {
          assert.ok(admissionSource.includes(marker),
            `${name}: ${artifactInput} resolver specification is missing ${marker}`);
        }
        if (repositoryEnvironmentEntries.length === 1) {
          assert.ok(admissionSource.includes(`repository: process.env.${repositoryEnvironmentEntries[0][0]}`),
            `${name}: ${prefix} resolver specification is not bound to the repository environment`);
        } else {
          assert.match(admissionSource,
            /repository:\s*['"]mbvidler-ctrl\/assesssuite_migration['"]/,
            `${name}: ${prefix} resolver specification is not fixed to the production repository`);
        }
        assert.ok(specificationUsesEnvironment(
          admissionSource, 'application_sha', applicationShaEnvironmentKey,
        ),
          `${name}: ${prefix} resolver specification is not bound to the application-SHA environment`);
        assert.ok(specificationUsesEnvironment(
          `${admissionSource}\n${specificationRow}`, 'id', artifactIdEnvironmentKey,
        ),
          `${name}: ${prefix} resolver row is not bound to its exact artifact-ID environment`);
        assert.ok(specificationRow.includes(`workflow_path: '.github/workflows/${producer}'`),
          `${name}: ${prefix} resolver row is not bound to ${producer}`);
        assert.match(specificationRow, /maximum_bytes:\s*[1-9][0-9_]*/,
          `${name}: ${prefix} resolver lacks an exact positive artifact byte ceiling`);
        const namePatternsBlock = specificationRow.match(
          /name_patterns:\s*\[([\s\S]*?)\],\s*workflow_path:/,
        )?.[1];
        assert.ok(namePatternsBlock,
          `${name}: ${prefix} resolver artifact-name admission is missing`);
        const namePatterns = [...namePatternsBlock.matchAll(/([`'"])(.*?)\1/gu)]
          .map((match) => match[2]);
        assert.ok(namePatterns.length > 0 && namePatterns.every((pattern) =>
          pattern.startsWith('^') && pattern.endsWith('$')),
        `${name}: ${prefix} resolver artifact-name admission is not exactly anchored`);
        const isBoundedResume = prefix.startsWith('resume_') || prefix === 'sentry_resume_effect' ||
          prefix === 'webhook_archive_source';
        if (isBoundedResume) {
          assert.match(specificationRow,
            /allowed_conclusions:\s*\[['"]success['"],\s*['"]failure['"],\s*['"]cancelled['"],\s*['"]timed_out['"]\]/,
            `${name}: ${prefix} resolver lacks the exact bounded resume conclusion set`);
          if (prefix === 'sentry_resume_effect' || prefix === 'resume_effect' ||
              prefix === 'resume_success' || prefix === 'resume_deploy_effect' ||
              prefix === 'resume_rollback_effect' || prefix === 'webhook_archive_source') {
            const digestEnvironmentKey = environmentKeyForValue(
              resolver.env,
              `\${{ inputs.${prefix}_artifact_digest }}`,
              `${name}: ${artifactInput}`,
            );
            assert.ok(specificationUsesEnvironment(
              `${admissionSource}\n${specificationRow}`, 'expected_digest', digestEnvironmentKey,
            ), `${name}: ${prefix} resume is not bound to its supplied exact artifact digest`);
          } else {
            assert.match(specificationRow, /expected_digest:\s*null/,
              `${name}: ${prefix} may omit a dispatch digest only through an explicit null resume contract`);
          }
        } else {
          assert.match(specificationRow, /allowed_conclusions:\s*\[['"]success['"]\]/,
            `${name}: normal ${prefix} predecessor must admit only a successful producer run`);
          const digestEnvironmentKey = environmentKeyForValue(
            resolver.env,
            `\${{ inputs.${prefix}_artifact_digest }}`,
            `${name}: ${artifactInput}`,
          );
          assert.ok(specificationUsesEnvironment(
            `${admissionSource}\n${specificationRow}`, 'expected_digest', digestEnvironmentKey,
          ),
            `${name}: ${prefix} resolver row does not bind its exact dispatch digest`);
        }
      }
    }
  }
  assert.ok(externalDownloads >= 15,
    `release chain found only ${externalDownloads} cross-run downloads; expected the complete predecessor graph`);
  assert.ok(sameRunDownloads >= 5,
    `release chain found only ${sameRunDownloads} same-run downloads; expected durable intra-run effects`);
});

test('release order starts with a provider-readback snapshot and no state mutation', () => {
  const source = workflow('physio-production-state-snapshot.yml');
  assert.match(source, /name: Physio production state snapshot - read only/);
  assert.match(source, /physio-production-state\.json/);
  assert.match(source, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(source, /\$\{\{ secrets\.FLY_API_TOKEN \}\}/);
  assert.doesNotMatch(source, /\bfly (?:apps create|volumes (?:create|destroy)|secrets import|deploy|machine (?:run|update|stop|restart|destroy)|certs (?:add|create|setup)|dns)\b/);
  assert.doesNotMatch(source, /\bdocker (?:build|save|load|tag|push|run|create)\b/);
});

test('candidate preparation consumes the snapshot, seals one archive and creates Sentry release without Fly', () => {
  const source = workflow('physio-production-prepare-release.yml');

  for (const marker of [
    'state_snapshot_artifact_id:',
    'state_snapshot_artifact_digest:',
    'state_snapshot_receipt_sha256:',
    'candidate-image.tar.gz',
    'candidate-image.oci.tar.gz',
    'candidate-oci-descriptors.json',
    'candidate-build-receipt.json',
    'archive_sha256:',
    'oci_archive_sha256:',
    'oci_manifest_digest:',
    'oci_descriptor_manifest_sha256:',
    'local_image_id:',
    'sentry_release:',
    'actions/upload-artifact@',
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  ordered(source, [
    'actions/download-artifact@',
    'physio-production-state.json',
    'target "candidate"',
    'target "sourcemaps"',
    'docker buildx bake --allow="fs.write=$source_maps" --file "$bake" --pull candidate sourcemaps',
    'docker save "$candidate"',
    'image import "ocidir://$oci_layout:$APPLICATION_SHA"',
    'image mod "ocidir://$oci_layout:$APPLICATION_SHA" --to-oci --replace',
    'scripts/physio-oci-image.mjs write-descriptors',
    'candidate-image.oci.tar.gz',
    'sentry_release:',
    /(?:Reconcile or )?upload and finalize exact Sentry release/i,
    'candidate-build-receipt.json',
    'Upload immutable candidate archive',
  ], 'candidate preparation');

  assert.equal((source.match(/docker buildx bake/g) || []).length, 1,
    'runtime and source-map evidence must come from one multi-target BuildKit invocation');
  assert.match(source,
    /regctl-linux-amd64[\s\S]*c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467[\s\S]*(?:VCSTag|grep -F ['"]v0\.11\.5['"])/,
    'credential-free OCI normalization must use the checksum-pinned regctl 0.11.5 binary');

  assert.doesNotMatch(source, /\$\{\{ secrets\.FLY_API_TOKEN \}\}|\bflyctl\b|\bfly (?:apps|volumes|machines?|secrets|deploy|certs|dns)\b/);
  assert.doesNotMatch(source, /registry\.fly\.io|\bdocker (?:tag|push)\b|physio-production-publication\.json/);
  assert.doesNotMatch(source, /bootstrap_receipt|expected_volume_id|publication_artifact|immutable_image:/);
});

test('candidate sealing safely extracts source maps and closes both downloaded receipt chains', () => {
  const source = workflow('physio-production-prepare-release.yml');
  const sealIndex = source.indexOf('\n  seal:\n');
  assert.ok(sealIndex >= 0, 'candidate preparation has no final seal job');
  const sentryJob = source.slice(source.indexOf('\n  sentry_release:\n'), sealIndex);
  const sealJob = source.slice(sealIndex);

  assert.doesNotMatch(sentryJob, /tar -xzf "\$core\/sentry-source-maps\.tar\.gz"/,
    'untrusted source-map members may not be extracted by raw tar');
  assert.match(sentryJob, /tarfile\.open/,
    'source-map extraction must inspect every member before extraction');
  assert.match(sentryJob, /(?:isfile\(\)|isreg\(\))/,
    'source-map extraction must admit regular files only');
  assert.match(sentryJob, /(?:resolve\(\)|commonpath)/,
    'source-map extraction must prove every resolved target stays under its destination');

  assert.match(source, /candidate_core_receipt_sha256/,
    'the core receipt raw hash must be a first-class handoff');
  assert.ok((sealJob.match(/sha256sum --check --strict SHA256SUMS/g) || []).length >= 2,
    'the seal must revalidate both downloaded checksum manifests');
  assert.match(sealJob, /validate-release/,
    'the seal must independently validate the downloaded Sentry release receipt');
  assert.match(sealJob, /candidate-core-receipt\.json[\s\S]*contract_version[\s\S]*application_sha/,
    'the seal must independently validate candidate-core identity and content');
  assert.match(sealJob, /receipt_sha256: process\.env\.CORE_RECEIPT_SHA/,
    'the final candidate receipt must bind the exact candidate-core receipt bytes');
});

test('real-provider canary runs the sealed local image with no Fly, service, mount, volume or DNS surface', () => {
  const source = workflow('physio-production-exact-image-canary.yml');
  const runner = read('scripts', 'physio-exact-image-canary.mjs');
  const combined = `${source}\n${runner}`;

  for (const marker of [
    'candidate_artifact_id:',
    'candidate_artifact_digest:',
    'candidate_receipt_sha256:',
    'archive_sha256:',
    'local_image_id:',
    'OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}',
    'docker load',
    "'run', '--detach', '--rm'",
    "'--network', 'bridge'",
    'physio-exact-image-canary',
  ]) assert.ok(combined.includes(marker), `local canary is missing ${marker}`);

  ordered(source, [
    'actions/download-artifact@',
    'candidate-build-receipt.json',
    /sha256sum.+candidate-image\.tar\.gz/s,
    'docker load',
    'produce-local',
    'actions/upload-artifact@',
  ], 'local canary');

  assert.equal((source.match(/\$\{\{ secrets\./g) || []).length, 1,
    'the local canary may receive only the OpenAI provider secret');
  assert.doesNotMatch(source, /\$\{\{ secrets\.FLY_API_TOKEN \}\}|\bflyctl\b|\bfly (?:apps|volumes|machines?|secrets|deploy|certs|dns)\b/);
  assert.doesNotMatch(runner, /FLYCTL_PATH|\bflyJson\b|typeof process\.env\.FLY_API_TOKEN\s*===\s*['"]string['"]|\bfly (?:apps|volumes|machines?|secrets|deploy|certs|dns)\b/);
  assert.doesNotMatch(source, /publication_artifact|publication_receipt|expected_volume_id|immutable_image:/);
  assert.doesNotMatch(combined, /['"]--(?:publish|publish-all|volume|mount|port|service|skip-dns-registration)['"]|['"]--network['"]\s*,?\s*['"]host['"]|registry\.fly\.io/);
  assert.doesNotMatch(source, /(?:^|\s)-(?:p|v)(?:\s|$)/m);
});

test('local canary reconciles committed-but-response-lost Docker creation without deleting an arbitrary carrier', () => {
  const runner = read('scripts', 'physio-exact-image-canary.mjs');
  const createMatch = /const created = await runProcess\(docker, \[\s*'run'/.exec(runner);
  const createIndex = createMatch?.index ?? -1;
  const finallyIndex = runner.indexOf('} finally {', createIndex);
  assert.ok(createIndex >= 0 && finallyIndex > createIndex, 'local Docker creation block is missing');
  const uncertainCreation = runner.slice(createIndex, finallyIndex);

  assert.doesNotMatch(runner, /requireTrue\(existing === null, 'deterministic_container_name_already_exists'\)/,
    'an exact prior canary carrier must be reconciled, not made permanently retry-blocking');
  assert.match(uncertainCreation, /catch\s*\([^)]*\)[\s\S]*dockerInspect\(docker, 'container', exactContainerName/,
    'a lost docker-run response must be resolved through the deterministic name');
  assert.match(uncertainCreation, /catch\s*\([^)]*\)[\s\S]*assertLocalCanaryContainer/,
    'response-loss cleanup must prove exact image, labels and topology before capture');
  assert.match(runner.slice(runner.indexOf('const existing ='), createIndex),
    /if\s*\(existing\)[\s\S]*assertLocalCanaryContainer[\s\S]*\['rm', '--force', existing\.Id\]/,
    'resume may destroy only an exact matching prior canary container');
});

test('local provider canary persists a replay-safe effect ledger before any billable call', () => {
  const source = workflow('physio-production-exact-image-canary.yml');
  const runner = read('scripts', 'physio-exact-image-canary.mjs');
  const contract = read('scripts', 'physio-exact-image-canary-contract.mjs');
  const admitIndex = source.indexOf('\n  admit:\n');
  const startIndex = source.indexOf('\n  start:\n', admitIndex);
  const canaryIndex = source.indexOf('\n  canary:\n', startIndex);
  assert.ok(admitIndex >= 0 && startIndex > admitIndex && canaryIndex > startIndex,
    'provider canary must separate candidate admission, durable STARTED evidence and paid execution');
  const admitJob = source.slice(admitIndex, startIndex);
  const startJob = source.slice(startIndex, canaryIndex);
  const canaryJob = source.slice(canaryIndex);

  assert.doesNotMatch(`${admitJob}\n${startJob}`, /\$\{\{ secrets\.OPENAI_API_KEY \}\}/,
    'no provider credential may exist before the durable STARTED artifact');
  assert.match(startJob, /needs:\s*admit|needs:\s*\[[^\]]*admit[^\]]*\]/,
    'STARTED evidence must consume exact credential-free candidate admission');
  for (const marker of [
    'assesssuite-physio-exact-image-canary-effect/1.0.0',
    "result: 'STARTED'",
    'provider_effect_id',
    'candidate_receipt_sha256',
    'candidate_archive_sha256',
    'local_image_id',
    'provider_task_set',
    'maximum_cost_microusd',
    'capability_intent_id',
    'authority_reference',
    'audio_fixture_sha256',
    'document_fixture_sha256',
    'provider_call_maximum',
    'actions/upload-artifact@',
  ]) assert.ok(startJob.includes(marker), `provider canary STARTED packet is missing ${marker}`);
  assert.match(startJob, /provider_call_maximum:\s*8/,
    'the durable effect budget must admit exactly eight paid provider calls');
  assert.doesNotMatch(startJob, /docker exec|produce-local|ALLOW_PAID_PROVIDER_PROBE|OPENAI_API_KEY/,
    'STARTED evidence may not itself contact or enable the provider');

  assert.match(canaryJob, /needs:\s*\[[^\]]*admit[^\]]*start[^\]]*\]/,
    'paid canary execution must depend on admission and durable STARTED evidence');
  ordered(canaryJob, [
    'Download durable provider-canary STARTED effect',
    'sha256sum --check --strict SHA256SUMS',
    'started_effect_receipt_sha256',
    'OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}',
    'produce-local',
  ], 'provider canary durable effect boundary');
  assert.match(canaryJob, /if:\s*\$\{\{ always\(\) \}\}[\s\S]*Upload bounded exact-image canary effect evidence/,
    'completed or ambiguous canary evidence must upload after every provider outcome');
  for (const marker of [
    'STARTED_UNRESOLVED',
    'COMPLETED',
    'partial_provider_request_id_hashes',
    'partial_provider_usage',
    'provider_effect_id',
    'candidate_artifact_id',
    'candidate_artifact_digest',
    'candidate_artifact_admission_receipt_sha256',
    'candidate_artifact_execution_admission_receipt_sha256',
    'provider_canary_admission_receipt_sha256',
    'provider_task_set',
    'maximum_cost_microusd',
    'capability_intent_id',
    'authority_reference',
    'audio_fixture_sha256',
    'document_fixture_sha256',
    'started_effect_receipt_sha256',
  ]) assert.ok(`${canaryJob}\n${runner}\n${contract}`.includes(marker),
    `provider canary terminal evidence is missing ${marker}`);

  for (const argument of [
    '--provider-effect-id',
    '--effect-ledger',
    '--started-effect-receipt-sha256',
  ]) assert.ok(runner.includes(argument), `provider canary producer is missing ${argument}`);
  assert.match(runner,
    /catch\s*\([^)]*\)[\s\S]*STARTED_UNRESOLVED[\s\S]*writeFileSync|finally\s*\{[\s\S]*STARTED_UNRESOLVED[\s\S]*writeFileSync/,
    'provider failures must persist an unresolved terminal ledger before propagating');
  assert.match(contract, /provider_call_maximum[\s\S]*(?:!==\s*8|===\s*8)/,
    'the effect contract must reject a paid-call budget other than eight');
  assert.match(contract, /partial_provider_request_id_hashes[\s\S]*sha256:/,
    'partial provider request evidence must remain content-free and hash-bound');
  assert.match(source,
    /prior_effect[\s\S]*(?:STARTED_UNRESOLVED|ambiguous)[\s\S]*(?:replay[^\n]*forbidden|exit 1)/i,
    'a previously ambiguous provider effect must fail closed before another paid call');
});

test('publication and deployment admit the complete canary success packet through one owning validator', () => {
  const contract = [
    read('scripts', 'physio-exact-image-canary-contract.mjs'),
    read('scripts', 'physio-exact-image-canary-success-contract.mjs'),
  ].join('\n');
  const publication = workflow('physio-production-publish.yml');
  const publicationDocument = yaml.load(publication);
  const deployAdmission = read('scripts', 'physio-deploy-admission.mjs');
  const packetFiles = [
    'SHA256SUMS',
    'canary-completed-effect-reconciliation.json',
    'canary-effect-reconciliation.json',
    'candidate-artifact-admission.json',
    'candidate-artifact-execution-admission.json',
    'physio-exact-image-canary.json',
    'provider-canary-admission.json',
    'provider-canary-started-effect.json',
  ];

  for (const marker of [
    'readAndValidatePhysioExactImageCanarySuccessPacket',
    'PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_FILES',
    'validatePhysioExactImageCanaryReceipt',
    'validatePhysioCanaryEffectReceipt',
    'assesssuite-physio-exact-image-canary-completed-effect/1.0.0',
    'STARTED',
    'COMPLETED',
    'provider_effect_id',
    'candidate_artifact_id',
    'candidate_artifact_digest',
    'candidate_artifact_admission_receipt_sha256',
    'candidate_artifact_execution_admission_receipt_sha256',
    'provider_canary_admission_receipt_sha256',
    'provider_task_set',
    'maximum_cost_microusd',
    'capability_intent_id',
    'authority_reference',
    'audio_fixture_sha256',
    'document_fixture_sha256',
    'expectedCapabilityBindingSha256',
    'capabilityBindingSha256',
    'started_effect_receipt_sha256',
    'effect_reconciliation_receipt_sha256',
    'partial_provider_calls',
    'partial_provider_usage',
    'actual_cost_microusd',
  ]) assert.ok(contract.includes(marker), `canary success-packet validator is missing ${marker}`);
  for (const file of packetFiles) assert.ok(contract.includes(file),
    `canary success-packet validator does not own ${file}`);
  assert.match(contract, /lstatSync|O_NOFOLLOW/,
    'the owning validator must inspect packet files without following links');
  assert.match(contract, /isSymbolicLink\(\)/,
    'the owning validator must reject linked packet members');
  assert.match(contract, /SHA256SUMS/,
    'the owning validator must verify the packet checksum manifest itself');
  assert.match(contract, /provider_call_maximum[\s\S]*(?:!==\s*8|===\s*8)/,
    'the owning validator must bind completion to exactly eight paid provider calls');
  assert.match(contract,
    /partial_provider_usage[\s\S]*actual_cost_microusd[\s\S]*actual_cost_microusd/,
    'the owning validator must reconcile terminal provider usage to the final canary cost');

  const canaryCapabilityBindingInput = publicationDocument.on?.workflow_dispatch?.inputs
    ?.canary_capability_binding_sha256;
  assert.ok(canaryCapabilityBindingInput,
    'publication dispatch must receive the exact upstream canary intent/authority binding');
  assert.equal(canaryCapabilityBindingInput.required, true,
    'the upstream canary intent/authority binding may not be optional');

  assert.match(publication,
    /physio-exact-image-canary-contract\.mjs validate-success-packet[\s\S]{0,800}--packet "\$RUNNER_TEMP\/canary"/,
    'publication must invoke the owning validator over the whole downloaded canary packet');
  for (const binding of [
    '--application-sha "$APPLICATION_SHA"',
    '--immutable-image "$LOCAL_IMAGE_ID"',
    '--candidate-archive-sha256 "$ARCHIVE_SHA"',
    '--canary-receipt-sha256 "$CANARY_SHA"',
    '--candidate-artifact-id "$CANDIDATE_ID"',
    '--candidate-artifact-digest "$CANDIDATE_DIGEST"',
    '--candidate-receipt-sha256 "$CANDIDATE_SHA"',
    '--capability-binding-sha256 "$CANARY_CAPABILITY_BINDING_SHA"',
    '--maximum-cost-microusd 5000000',
  ]) assert.ok(publication.includes(binding),
    `publication full-packet validation is missing ${binding}`);
  const packetAdmissionIndex = publication.indexOf('validate-success-packet');
  const publicationMutationIndex = mutationIndex(publication);
  assert.ok(packetAdmissionIndex >= 0 && packetAdmissionIndex < publicationMutationIndex,
    'complete canary packet admission must precede registry credentials and publication');

  assert.match(deployAdmission,
    /readAndValidatePhysioExactImageCanarySuccessPacket\(canaryPacket,/,
    'deploy admission must invoke the same owning validator over CANARY_PACKET');
  for (const binding of [
    "expectedApplicationSha: env('APPLICATION_SHA')",
    'expectedImmutableImage: publication.local_image_id',
    'expectedCandidateArchiveSha256: publication.archive_sha256',
    "expectedCanaryReceiptSha256: env('CANARY_RECEIPT_SHA256')",
    'expectedCandidateArtifactId: Number(publication.candidate_artifact_id)',
    'expectedCandidateArtifactDigest: publication.candidate_artifact_digest',
    'expectedCandidateReceiptSha256: publication.candidate_receipt_sha256',
    'expectedCapabilityBindingSha256: publication.canary_capability_binding_sha256',
    'maximumCostMicrousd: 5_000_000',
  ]) assert.ok(deployAdmission.includes(binding),
    `deploy full-packet validation is missing ${binding}`);
  assert.doesNotMatch(deployAdmission,
    /validatePhysioExactImageCanaryReceipt\(readJson\(canaryFile\)/,
    'deploy may not authorize from the summary canary receipt alone');
  const publicationCanaryCall = publication.slice(
    publication.indexOf('validate-success-packet'),
    publication.indexOf('bootstrap=', publication.indexOf('validate-success-packet')),
  );
  assert.doesNotMatch(publicationCanaryCall,
    /--capability-intent-id "\$INTENT"|--authority-reference "\$AUTHORITY"/,
    'publication may not pretend its own L5 envelope is the upstream provider-canary envelope');
  const deployCanaryCall = deployAdmission.slice(
    deployAdmission.indexOf('readAndValidatePhysioExactImageCanarySuccessPacket'),
    deployAdmission.indexOf('validateBootstrap(',
      deployAdmission.indexOf('readAndValidatePhysioExactImageCanarySuccessPacket')),
  );
  assert.doesNotMatch(deployCanaryCall,
    /expectedCapabilityIntentId:\s*env\('CAPABILITY_INTENT_ID'\)|expectedAuthorityReference:\s*env\('AUTHORITY_REFERENCE'\)/,
    'deploy may not pretend its own L5 envelope is the upstream provider-canary envelope');
});

test('Fly bootstrap is admitted only by the exact local-canary receipt and creates no service', () => {
  const source = workflow('physio-production-bootstrap.yml');
  const admissionJobIndex = source.indexOf('\n  admit:\n');
  const startJobIndex = source.indexOf('\n  start:\n', admissionJobIndex);
  const ledgerStartedJobIndex = source.indexOf('\n  ledger_started:\n', startJobIndex);
  const providerJobIndex = source.indexOf('\n  provider:\n', ledgerStartedJobIndex);
  const ledgerProviderJobIndex = source.indexOf('\n  ledger_provider:\n', providerJobIndex);
  const bootstrapJobIndex = source.indexOf('\n  bootstrap:\n', ledgerProviderJobIndex);
  const ledgerTerminalJobIndex = source.indexOf('\n  ledger_terminal:\n', bootstrapJobIndex);
  assert.ok(admissionJobIndex >= 0 && startJobIndex > admissionJobIndex &&
    ledgerStartedJobIndex > startJobIndex && providerJobIndex > ledgerStartedJobIndex &&
    ledgerProviderJobIndex > providerJobIndex && bootstrapJobIndex > ledgerProviderJobIndex &&
    ledgerTerminalJobIndex > bootstrapJobIndex,
  'bootstrap must isolate admit→start→STARTED append→provider readback→provider append→effect→terminal append');
  const admissionJob = source.slice(admissionJobIndex, startJobIndex);
  const startJob = source.slice(startJobIndex, ledgerStartedJobIndex);
  const ledgerStartedJob = source.slice(ledgerStartedJobIndex, providerJobIndex);
  const providerJob = source.slice(providerJobIndex, ledgerProviderJobIndex);
  const ledgerProviderJob = source.slice(ledgerProviderJobIndex, bootstrapJobIndex);
  const bootstrapJob = source.slice(bootstrapJobIndex, ledgerTerminalJobIndex);
  const ledgerTerminalJob = source.slice(ledgerTerminalJobIndex);
  const firstMutation = mutationIndex(bootstrapJob);
  assert.ok(Number.isFinite(firstMutation), 'bootstrap has no bounded Fly mutation');

  for (const marker of [
    'canary_artifact_id:',
    'canary_artifact_digest:',
    'canary_receipt_sha256:',
    'candidate_receipt_sha256:',
    'archive_sha256:',
    'exact_image_canary_receipt_sha256:',
    'physio-bootstrap-admission.json',
    'needs: admit',
    'fly apps create',
    'fly volumes create assesssuite_physio_data',
    'fly secrets import --app "$app" --stage --dns-checks=false',
    'assesssuite-physio-candidate-build/3.0.0',
  ]) assert.ok(source.includes(marker), `post-canary bootstrap is missing ${marker}`);
  assert.doesNotMatch(source, /assesssuite-physio-candidate-build\/2\.0\.0/,
    'post-canary bootstrap may not admit the superseded pre-OCI candidate contract');

  assert.doesNotMatch(admissionJob, /\$\{\{ secrets\./,
    'credential-free admission may not receive any repository or environment secret');
  assert.equal(mutationIndex(admissionJob), Number.POSITIVE_INFINITY,
    'credential-free admission may not mutate Fly');
  assert.match(startJob, /needs: admit/,
    'durable STARTED evidence must consume the exact credential-free admission');
  assert.equal(mutationIndex(startJob), Number.POSITIVE_INFINITY,
    'durable STARTED evidence may fingerprint secrets but may not mutate Fly');
  assert.match(ledgerStartedJob, /permissions:\n\s+contents: write\n\s+actions: read/);
  assert.match(ledgerStartedJob, /physio-bootstrap-ledger\.mjs append/);
  assert.equal(mutationIndex(ledgerStartedJob), Number.POSITIVE_INFINITY,
    'STARTED ledger append job may not call a provider');
  assert.match(providerJob, /needs: \[admit, start, ledger_started\]/);
  assert.match(providerJob, /Re-admit the immutable handoff without provider credentials/);
  assert.match(providerJob, /Reconcile authoritative Fly state and persist provider-admitted generation/);
  assert.equal(mutationIndex(providerJob), Number.POSITIVE_INFINITY,
    'authoritative provider readback job may not execute the admitted mutation');
  assert.match(ledgerProviderJob, /permissions:\n\s+contents: write\n\s+actions: read/);
  assert.match(ledgerProviderJob, /needs: \[start, ledger_started, provider\]/);
  assert.match(ledgerProviderJob, /physio-bootstrap-ledger\.mjs append/);
  assert.equal(mutationIndex(ledgerProviderJob), Number.POSITIVE_INFINITY,
    'provider ledger append job may not call a provider');
  ordered(bootstrapJob, [
    'needs: [admit, start, provider, ledger_provider]',
    'Download exact durably admitted provider handoff',
    'Re-admit exact provider ledger handoff before any effect',
    'sha256sum --check --strict SHA256SUMS',
    'FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}',
    'fly apps create',
    'fly volumes create assesssuite_physio_data',
    'fly secrets import --app "$app" --stage --dns-checks=false',
  ], 'credential-scoped Fly bootstrap');
  assert.doesNotMatch(bootstrapJob, /contents: write/,
    'provider-effect job may not hold repository write authority');
  assert.match(ledgerTerminalJob, /needs: \[start, provider, ledger_provider, bootstrap\]/);
  assert.match(ledgerTerminalJob, /permissions:\n\s+contents: write\n\s+actions: read/);
  assert.match(ledgerTerminalJob, /physio-bootstrap-ledger\.mjs append/);
  assert.equal(mutationIndex(ledgerTerminalJob), Number.POSITIVE_INFINITY,
    'terminal ledger append job may not call a provider');
  assert.doesNotMatch(source, /\bfly deploy\b|\bfly machine (?:run|update|restart)\b|\bfly certs (?:add|create|setup)\b|\bfly dns\b/);
});

test('Fly bootstrap resolves uncertain app and volume creation and leaves webhook completion to its exact provider lane', () => {
  const source = workflow('physio-production-bootstrap.yml');
  const appCreate = source.indexOf('fly apps create');
  const volumeCreate = source.indexOf('fly volumes create');
  const secretPrestate = source.indexOf('secret_prestate=');
  const secretImport = source.indexOf('fly secrets import', secretPrestate);
  const secretPoststate = source.indexOf('secrets-after.stderr', secretImport);
  assert.ok(appCreate >= 0 && volumeCreate > appCreate, 'bootstrap mutations are missing or reordered');
  assert.ok(secretPrestate > volumeCreate && secretImport > secretPrestate && secretPoststate > secretImport,
    'secret reconciliation must read prestate, restage the exact bundle and read poststate');

  assert.match(source, /resume_(?:started_)?(?:effect|action)_receipt_sha256:/,
    'an unresolved started bootstrap action requires an explicit resume binding');
  assert.match(source.slice(Math.max(0, appCreate - 300), appCreate), /(?:if\s+!|set \+e)/,
    'app creation must capture an uncertain provider result instead of exiting immediately');
  assert.match(source.slice(appCreate, volumeCreate), /fly apps list/,
    'app creation must be followed by exact provider readback even after a lost response');
  assert.match(source.slice(Math.max(appCreate, volumeCreate - 400), volumeCreate), /(?:if\s+!|set \+e)/,
    'volume creation must capture an uncertain provider result instead of exiting immediately');
  assert.match(source.slice(volumeCreate), /fly volumes list/,
    'volume creation must be followed by exact provider readback even after a lost response');
  assert.match(source, /bootstrap-(?:effect-)?reconciliation\.json/,
    'bootstrap must preserve a bounded provider reconciliation record');
  assert.match(source, /if: \$\{\{ always\(\) \}\}[\s\S]*Upload exact production bootstrap receipt/,
    'bootstrap evidence must upload on failed and uncertain outcomes');

  const secretReconciliation = source.slice(secretPrestate, source.indexOf('fly certs list', secretPoststate));
  assert.match(secretReconciliation, /COMPLETE_PRESTATE_EXACT_RESTAGE_REQUIRED/,
    'a complete secret-name prestate may not be accepted as proof of intended values');
  assert.doesNotMatch(source.slice(secretPrestate, secretImport), /COMMITTED_RECONCILED_FROM_EXACT_READBACK/,
    'name/digest readback alone must not claim exact intended-value reconciliation');
  assert.match(secretReconciliation,
    /secret_import_exit_code[^\n]*-ne 0[\s\S]*secret_prestate[^\n]*COMPLETE[\s\S]*cmp --silent[^\n]*secrets-before-sanitized\.json[^\n]*secrets-sanitized\.json[\s\S]*exit 1/,
    'a lost restage response with an unchanged complete digest map must remain STARTED_UNRESOLVED');
  assert.match(secretReconciliation, /COMMITTED_CONFIRMED_BY_SUCCESSFUL_EXACT_STAGE_AND_READBACK/,
    'successful exact bundle restage plus complete readback must be the primary completion proof');
  assert.match(secretReconciliation, /COMMITTED_CONFIRMED_BY_CHANGED_EXACT_STAGE_READBACK_AFTER_RESPONSE_LOSS/,
    'response-loss reconciliation must require a changed complete provider digest map');

  assert.doesNotMatch(source, /STRIPE_WEBHOOK_SECRET/,
    'bootstrap cannot require the signing secret before the exact Stripe endpoint exists');
  assert.match(source, /webhook_secret_pending: true/,
    'bootstrap must declare the narrowly pending post-bootstrap webhook secret');
  assert.doesNotMatch(source, /production_ready: true/,
    'app-and-volume bootstrap alone is not production-ready');
});

test('Stripe webhook evidence exposes only the exact mission metadata and scans every packet recursively', async () => {
  const helperRelativePath = path.join('scripts', 'physio-stripe-webhook-evidence.mjs');
  const helperPath = path.join(root, helperRelativePath);
  assert.ok(fs.existsSync(helperPath),
    'the Stripe webhook lane needs one shared executable evidence sanitizer');

  const helperSource = read(helperRelativePath);
  for (const marker of [
    'STRIPE_WEBHOOK_METADATA_KEYS',
    'sanitizeStripeWebhookEndpoint',
    'assertWebhookEvidenceTreeSafe',
    'validateCompletedStripeWebhookPacket',
    'COMPLETED_PACKET_CORE_FILES',
    'appId',
    'applicationSha',
    'bootstrapReceiptSha256',
    'capabilityIntentId',
    'professionId',
    'withFileTypes: true',
  ]) assert.ok(helperSource.includes(marker), `webhook evidence sanitizer is missing ${marker}`);
  assert.match(helperSource, /Object\.keys\([^)]*metadata[^)]*\)\.sort\(/,
    'provider metadata must be compared as an exact key set');
  assert.match(helperSource, /readdirSync\([^)]+,\s*\{\s*withFileTypes:\s*true\s*\}\)/,
    'packet evidence must be walked as a recursive directory tree');
  assert.doesNotMatch(helperSource, /metadata:\s*(?:row|value|endpoint)\.metadata|\.\.\.(?:row|value|endpoint)/,
    'provider objects and metadata must be reconstructed from an explicit allowlist');

  const helper = await import(`${pathToFileURL(helperPath).href}?test=${Date.now()}`);
  assert.deepEqual(helper.STRIPE_WEBHOOK_METADATA_KEYS, [
    'appId',
    'applicationSha',
    'bootstrapReceiptSha256',
    'capabilityIntentId',
    'effectGeneration',
    'professionId',
    'requestSha256',
    'startedEffectReceiptSha256',
  ], 'provider metadata must contain exactly the mission identity and durable effect-generation keys');

  const expectedMetadata = Object.freeze({
    appId: 'local-assesssuite-physio',
    applicationSha: 'a'.repeat(40),
    bootstrapReceiptSha256: 'b'.repeat(64),
    capabilityIntentId: 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:stripe-webhook',
    effectGeneration: '3',
    professionId: 'physio',
    requestSha256: 'c'.repeat(64),
    startedEffectReceiptSha256: 'd'.repeat(64),
  });
  const endpoint = Object.freeze({
    id: 'we_physioExact',
    url: 'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook',
    status: 'enabled',
    api_version: '2026-07-29.dahlia',
    enabled_events: ['checkout.session.completed', 'customer.subscription.deleted',
      'customer.subscription.paused', 'invoice.payment_failed'],
    metadata: expectedMetadata,
    secret: ['excluded', 'provider', 'credential', 'fixture'].join('-'),
    livemode: true,
  });
  const sanitized = helper.sanitizeStripeWebhookEndpoint(endpoint, expectedMetadata);
  assert.deepEqual(Object.keys(sanitized).sort(),
    ['api_version', 'enabled_events', 'id', 'metadata', 'status', 'url']);
  assert.deepEqual(sanitized.metadata, expectedMetadata);
  assert.equal('secret' in sanitized, false);
  assert.equal('livemode' in sanitized, false,
    'even harmless-looking provider extras must not enter the bounded receipt');

  for (const metadata of [
    { ...expectedMetadata, supportContact: 'clinician@example.invalid' },
    { ...expectedMetadata, auditNote: ['neutral', 'credential', 'fixture'].join('-') },
    { ...expectedMetadata, effectGeneration: '03' },
    { ...expectedMetadata, effectGeneration: '-1' },
    { ...expectedMetadata, requestSha256: 'f'.repeat(63) },
    { ...expectedMetadata, startedEffectReceiptSha256: 'F'.repeat(64) },
  ]) {
    assert.throws(
      () => helper.sanitizeStripeWebhookEndpoint({ ...endpoint, metadata }, expectedMetadata),
      /metadata|key|exact|allowlist/i,
      'a neutral-name PII or credential metadata extra must fail closed',
    );
  }

  const packetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-webhook-evidence-'));
  try {
    const nested = path.join(packetRoot, 'nested', 'provider');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'endpoint.json'), `${JSON.stringify(sanitized)}\n`,
      { flag: 'wx', mode: 0o600 });
    assert.doesNotThrow(() => helper.assertWebhookEvidenceTreeSafe(packetRoot));
    fs.writeFileSync(path.join(nested, 'foreign-metadata.json'), `${JSON.stringify({
      ...sanitized,
      metadata: { ...expectedMetadata, supportContact: 'clinician@example.invalid' },
    })}\n`, { flag: 'wx', mode: 0o600 });
    assert.throws(() => helper.assertWebhookEvidenceTreeSafe(packetRoot),
      /metadata|key|exact|allowlist|credential|PII|secret/i,
      'the recursive scanner must reach nested provider evidence and reject metadata extras');
  } finally {
    fs.rmSync(packetRoot, { recursive: true, force: true });
  }

  const source = workflow('physio-production-stripe-webhook.yml');
  assert.doesNotMatch(source, /metadata:\s*row\.metadata|const sanitized = \{ \.\.\.row \}/,
    'the workflow may not copy raw provider metadata or response objects into a packet');
  const endpointSanitizerUses = source.match(
    /(?:physio-stripe-webhook-evidence\.mjs sanitize-endpoint|(?:sanitizeStripeWebhookEndpoint|classifyStripeWebhookEndpointLineage)\s*\()/g,
  ) || [];
  assert.ok(endpointSanitizerUses.length >= 4,
    'provider probe, existing endpoint, create response and authoritative readback must all use the exact sanitizer');
  const document = yaml.load(source);
  let uploadCount = 0;
  for (const [jobName, job] of Object.entries(document.jobs || {})) {
    const steps = job.steps || [];
    for (const [uploadIndex, upload] of steps.entries()) {
      if (!String(upload.uses || '').startsWith('actions/upload-artifact@')) continue;
      uploadCount += 1;
      const scan = steps[uploadIndex - 1];
      assert.match(scan?.id || '', /^packet_scan(?:_completed)?$/,
        `${jobName}: the immediately preceding step must own the upload safety decision`);
      assert.equal(scan?.if, '${{ always() }}',
        `${jobName}: packet scanning must run even after an earlier failure or uncertain provider response`);
      assert.match(scan?.run || '', /node scripts\/physio-stripe-webhook-evidence\.mjs scan\s+--root\s+/,
        `${jobName}: upload packet is not admitted by the shared recursive scanner`);
      const uploadPath = String(upload.with?.path || '')
        .replace('${{ runner.temp }}', '$RUNNER_TEMP');
      assert.ok(uploadPath && (scan.run.includes(`"${uploadPath}"`) || scan.run.includes(`'${uploadPath}'`)),
        `${jobName}: recursive scanner is not bound to the exact uploaded root ${uploadPath}`);
      assert.match(String(upload.if || ''), new RegExp(
        `always\\(\\).*steps\\.${scan.id}\\.outcome == 'success'`,
      ),
        `${jobName}: an unsafe or failed scan must prevent artifact upload`);
      const checkoutIndex = steps.findIndex((candidate) =>
        String(candidate.uses || '').startsWith('actions/checkout@') &&
        candidate.with?.ref === '${{ inputs.application_sha }}' &&
        candidate.with?.['persist-credentials'] === false);
      assert.ok(checkoutIndex >= 0 && checkoutIndex < uploadIndex - 1,
        `${jobName}: scanner must execute from the exact credential-free application source`);
    }
  }
  assert.equal(uploadCount, 7,
    'the exact webhook workflow must scan all seven durable admission, replay, compensation, and completion uploads');
  const startJob = document.jobs?.start;
  const startStep = startJob?.steps?.find((step) => step.id === 'start');
  assert.ok(startStep, 'webhook workflow is missing its durable start/reconciliation step');
  const completedBranch = String(startStep.run || '').slice(
    String(startStep.run || '').indexOf('if [[ -f "$RUNNER_TEMP/resume/physio-production-stripe-webhook.json" ]]'),
    String(startStep.run || '').indexOf("IFS=$'\\t' read -r prior_generation prior_request_sha"),
  );
  for (const marker of [
    'validateCompletedStripeWebhookPacket',
    'webhook-completed-reuse',
    "echo 'resume_completed=true'",
    'completed_receipt_sha256',
    'started_receipt_sha256',
    'request_sha256',
    'exit 0',
  ]) assert.ok(completedBranch.includes(marker),
    `completed webhook read-only reuse is missing ${marker}`);
  assert.doesNotMatch(completedBranch,
    /\/v1\/webhook_endpoints|fly secrets import|-X\s+(?:POST|DELETE)|STRIPE_SECRET_KEY:\s*\$\{\{ secrets|FLY_API_TOKEN:\s*\$\{\{ secrets/,
    'an exact completed webhook packet must be reused without provider calls, mutation or credentials');
  assert.equal(document.jobs?.probe?.if,
    "${{ needs.start.outputs.resume_completed != 'true' }}",
    'provider probing must be skipped after exact completed webhook reuse');
  assert.equal(document.jobs?.compensate?.if,
    "${{ needs.start.outputs.resume_completed != 'true' }}",
    'provider compensation must be skipped after exact completed webhook reuse');
  assert.equal(document.jobs?.effect?.if,
    "${{ needs.start.outputs.resume_completed != 'true' }}",
    'provider mutation must be skipped after exact completed webhook reuse');
  for (const [label, downstream] of [
    ['publication webhook admission', workflow('physio-production-publish.yml')],
    ['deploy webhook admission', read('scripts', 'physio-deploy-admission.mjs')],
  ]) {
    assert.match(downstream, /validateCompletedStripeWebhookPacket\s*\(/,
      `${label} must re-run the owning complete webhook packet validator`);
    assert.match(downstream, /bootstrapReceiptSha256/,
      `${label} must bind the endpoint metadata to the exact bootstrap receipt`);
  }
  for (const releaseWorkflow of [
    'physio-production-publish.yml',
    'physio-production-deploy.yml',
  ]) {
    assert.ok(workflow(releaseWorkflow)
      .includes("sha('scripts/physio-stripe-webhook-evidence.mjs')"),
    `${releaseWorkflow}: frozen release source graph omits the webhook evidence sanitizer`);
  }
});

test('Stripe webhook hard-loss resume cannot compensate a newer endpoint or reuse a deleted generation key', async () => {
  const helperPath = path.join(root, 'scripts', 'physio-stripe-webhook-evidence.mjs');
  const helperSource = read('scripts', 'physio-stripe-webhook-evidence.mjs');
  const helper = await import(`${pathToFileURL(helperPath).href}?lineage=${Date.now()}`);
  assert.equal(typeof helper.classifyStripeWebhookEndpointLineage, 'function',
    'one owning helper must classify exact current/prior endpoint lineage and reject every other generation');

  const applicationSha = 'a'.repeat(40);
  const bootstrapReceiptSha256 = 'b'.repeat(64);
  const capabilityIntentId = 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:stripe-webhook';
  const metadata = (generation, request, effect) => Object.freeze({
    appId: 'local-assesssuite-physio',
    applicationSha,
    bootstrapReceiptSha256,
    capabilityIntentId,
    effectGeneration: String(generation),
    professionId: 'physio',
    requestSha256: request,
    startedEffectReceiptSha256: effect,
  });
  const currentMetadata = metadata(4, 'c'.repeat(64), 'd'.repeat(64));
  const priorMetadata = metadata(3, 'e'.repeat(64), 'f'.repeat(64));
  const endpoint = (providerMetadata) => ({
    id: 'we_physioLineage',
    url: 'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook',
    status: 'enabled',
    api_version: '2026-07-29.dahlia',
    enabled_events: ['checkout.session.completed', 'customer.subscription.deleted',
      'customer.subscription.paused', 'invoice.payment_failed'],
    metadata: providerMetadata,
  });
  const classify = (providerMetadata) => helper.classifyStripeWebhookEndpointLineage(
    endpoint(providerMetadata),
    { currentMetadata, priorMetadata },
  );
  assert.equal(classify(currentMetadata).lineage, 'CURRENT');
  assert.equal(classify(priorMetadata).lineage, 'PRIOR');
  for (const unadmittedMetadata of [
    metadata(5, '1'.repeat(64), '2'.repeat(64)),
    metadata(3, '1'.repeat(64), 'f'.repeat(64)),
    metadata(3, 'e'.repeat(64), '2'.repeat(64)),
    metadata(2, '3'.repeat(64), '4'.repeat(64)),
  ]) {
    assert.throws(() => classify(unadmittedMetadata), /generation|lineage|metadata|newer|exact/i,
      'newer, older or hash-divergent endpoint lineage must fail closed');
  }
  for (const marker of [
    'effectGeneration',
    'requestSha256',
    'startedEffectReceiptSha256',
    'CURRENT',
    'PRIOR',
  ]) assert.ok(helperSource.includes(marker), `shared endpoint-lineage helper is missing ${marker}`);

  const source = workflow('physio-production-stripe-webhook.yml');
  for (const marker of [
    'metadata[effectGeneration]',
    'metadata[requestSha256]',
    'metadata[startedEffectReceiptSha256]',
    'classifyStripeWebhookEndpointLineage',
    'observed_endpoint_lineage',
    'observed_endpoint_effect_generation',
    'observed_endpoint_request_sha256',
    'observed_endpoint_started_effect_receipt_sha256',
    'prior_idempotency_key_sha256',
  ]) assert.ok(source.includes(marker), `webhook hard-loss lineage is missing ${marker}`);

  const document = yaml.load(source);
  const probeRun = String(document.jobs?.probe?.steps?.find((step) => step.id === 'probe')?.run || '');
  const effectRun = String(document.jobs?.effect?.steps?.find((step) => step.id === 'effect')?.run || '');
  const compensateSteps = document.jobs?.compensate?.steps || [];
  const compensationRun = compensateSteps.map((step) => String(step.run || '')).join('\n');
  const compensationDeleteRun = String(compensateSteps.find((step) => step.id === 'delete')?.run || '');
  assert.ok(probeRun && compensationRun && compensationDeleteRun && effectRun,
    'webhook probe/compensation/effect source is missing');
  for (const [providerField, compensationField] of [
    ['effectGeneration', 'effect_generation'],
    ['requestSha256', 'request_sha256'],
    ['startedEffectReceiptSha256', 'started_effect_receipt_sha256'],
  ]) {
    assert.ok(probeRun.includes(providerField), `credentialed probe does not bind endpoint ${providerField}`);
    assert.ok(compensationRun.includes(compensationField),
      `provider compensation does not bind endpoint ${compensationField}`);
    assert.ok(effectRun.includes(providerField), `provider CREATE/readback does not bind endpoint ${providerField}`);
  }
  assert.doesNotMatch(probeRun, /Object\.entries\([^)]*Metadata[^)]*\)\s*\n?\s*\.some\(/,
    'partial metadata matches may not classify a provider endpoint before a destructive recovery');

  assert.doesNotMatch(effectRun, /(?:^|\s)-X\s+DELETE\b/m,
    'bounded orphan compensation DELETE must be isolated from the CREATE effect job');
  const deleteIndex = compensationRun.indexOf('-X DELETE');
  assert.ok(deleteIndex >= 0, 'bounded orphan compensation DELETE is missing');
  const compensationAdmission = compensationRun;
  for (const marker of [
    'plan.endpoint_lineage',
    "'PRIOR'",
    'target_effect_generation',
    'target_request_sha256',
    'target_effect_identity_receipt_sha256',
    'prior_request_sha256',
    'prior_effect_receipt_sha256',
    'provider_plan_receipt_sha256',
  ]) assert.ok(compensationAdmission.includes(marker),
    `compensation is not fail-closed on admitted prior lineage field ${marker}`);
  assert.match(compensationAdmission,
    /priorEffect\.effect_generation\s*\+\s*1\s*!==\s*request\.effect_generation/,
    'compensation must reject any endpoint generation other than the exact immediately preceding effect');
  assert.doesNotMatch(compensationAdmission,
    /Object\.entries\([^)]*Metadata[^)]*\)\s*\n?\s*\.some\(/,
    'a partial metadata match may never authorize compensation');
  for (const marker of [
    'RECONCILED_STILL_APPLIED',
    'RETRY_BARRIER_ARTIFACT_ID',
    'target_id',
  ]) assert.ok(compensationDeleteRun.includes(marker),
    `bounded compensation DELETE is missing its durable same-target barrier ${marker}`);

  const startRun = String(document.jobs?.start?.steps?.find((step) => step.id === 'start')?.run || '');
  for (const marker of [
    'prior_idempotency_key_sha256',
    'idempotency_key_sha256',
    'effect_generation',
    'resume_started_effect_receipt_sha256',
  ]) assert.ok(startRun.includes(marker), `resumed idempotency lineage is missing ${marker}`);
  assert.match(startRun,
    /(?:idempotency_key_sha256|IDEMPOTENCY_SHA)[^\n]*(?:===|==|!=|!==)[^\n]*(?:prior_idempotency_key_sha256|PRIOR_IDEMPOTENCY)/,
    'each resumed generation must explicitly reject reuse of the admitted prior/deleted idempotency key');
});

test('exact publication is a unique post-canary operation over byte-identical candidate bytes', () => {
  const workflows = allPhysioReleaseWorkflows();
  const publishers = workflows.filter(({ source }) => /\bimage copy(?:\s+--[a-z-]+)*\s+["']?\$local_ref\b/.test(source));
  assert.equal(publishers.length, 1, 'exactly one workflow may publish the accepted image archive');
  const [{ name, source }] = publishers;
  assert.notEqual(name, 'physio-production-prepare-release.yml');
  assert.notEqual(name, 'physio-production-exact-image-canary.yml');
  assert.ok(workflows.every(({ source: releaseSource }) => !/\bdocker push\b/.test(releaseSource)),
    'release workflows must publish the frozen OCI descriptor graph, not reserialize with docker push');

  for (const marker of [
    'candidate_artifact_id:',
    'candidate_artifact_digest:',
    'candidate_receipt_sha256:',
    'canary_receipt_sha256:',
    'bootstrap_receipt_sha256:',
    'stripe_webhook_archive_artifact_id:',
    'stripe_webhook_archive_receipt_sha256:',
    'stripe_webhook_receipt_sha256:',
    'candidate-image.tar.gz',
    'candidate-image.oci.tar.gz',
    'candidate-oci-descriptors.json',
    'archive_sha256:',
    'oci_archive_sha256:',
    'oci_manifest_digest:',
    'oci_descriptor_manifest_sha256:',
    'local_image_id:',
    'immutable_image:',
    'image_digest:',
    'stripe_webhook_secret_staged:',
    'physio-production-publication.json',
  ]) assert.ok(source.includes(marker), `${name} is missing publication binding ${marker}`);

  for (const file of [
    'e2e/physio-live/live-qa-contract.mjs',
    'e2e/physio-live/physio-live.spec.mjs',
    'e2e/physio-live/qa-journey-manifest.json',
    'e2e/physio-live/expected-capabilities-manifest.json',
    'e2e/physio-live/playwright.config.mjs',
    'e2e/physio-live/global-setup.mjs',
    'e2e/physio-live/global-teardown.mjs',
    'scripts/physio-exact-image-canary-fixture.mjs',
    'server/tests/fixtures/physio-exact-image-canary/synthetic-physio-canary.wav',
    'server/uploadRegistry.mjs',
    'server/tests/support/synthetic-fixtures.mjs',
    'src/lib/referralExtractionSchema.js',
    'src/lib/referralWorkflow.js',
    'server/tests/physio-live-qa-contract.test.mjs',
    'e2e/physio-live-self-service/self-service-contract.mjs',
    'e2e/physio-live-self-service/provision.spec.mjs',
    'e2e/physio-live-self-service/trusted-browser-checkout.mjs',
    'e2e/physio-live-self-service/stripe-live-readback.mjs',
    'e2e/physio-live-self-service/stripe-live-payment-validation.mjs',
    'e2e/physio-live-self-service/validate-payment.mjs',
    'e2e/physio-live-self-service/finalize.spec.mjs',
    'e2e/physio-live-self-service/resume-cleanup.mjs',
    'e2e/physio-live-self-service/email-provider-readback.mjs',
    'e2e/physio-live-self-service/journey-support.mjs',
    'e2e/physio-live-self-service/global-setup.mjs',
    'e2e/physio-live-self-service/global-teardown.mjs',
    'e2e/physio-live-self-service/playwright.config.mjs',
    'e2e/physio-live-self-service/journey-manifest.json',
    'server/stripeGateway.mjs',
    'server/functions/createCheckoutSession.mjs',
    'package.json',
    'package-lock.json',
    'scripts/run-physio-live-self-service.mjs',
    'scripts/physio-oci-image.mjs',
    'scripts/physio-deploy-admission.mjs',
    'scripts/physio-webhook-ledger.mjs',
    '.github/workflows/physio-production-webhook-archive.yml',
    'server/tests/physio-webhook-ledger.test.mjs',
    'server/tests/support/server-harness.mjs',
    'e2e/physio-offline-journey/runtime-fixture.mjs',
    'e2e/physio-offline-journey/vite-child.mjs',
    'e2e/physio-offline-journey/physio-offline-journey.spec.mjs',
    'apps/app-physio/vite.config.js',
    'apps/_shared/makeAppConfig.mjs',
    'vite.config.js',
    'src/utils/index.ts',
    'src/pages/Calendar.jsx',
    'src/pages/TestRunner.jsx',
    'src/components/assessments/AssessmentTestRunnerRouter.jsx',
    'server/tests/assessment-return-routing-contract.test.mjs',
    'server/tests/physio-live-self-service-contract.test.mjs',
    'server/tests/physio-live-payment-validation-contract.test.mjs',
  ]) assert.ok(source.includes(`sha('${file}')`), `${name} does not freeze live-QA source ${file}`);

  for (const marker of [
    'stripe_webhook_archive_artifact_id:',
    'stripe_webhook_archive_artifact_digest:',
    'stripe_webhook_archive_receipt_sha256:',
    'stripe-endpoint-readback.json',
    'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook',
    '2026-07-29.dahlia',
    'checkout.session.completed',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'invoice.payment_failed',
    'started_effect_receipt_sha256',
    'stripe_signing_secret_sha256',
    'fly_webhook_secret_digest',
    'provider_request_id_hashes_sha256',
  ]) assert.ok(source.includes(marker), `${name} does not fully admit the webhook evidence ${marker}`);

  const admitJobIndex = source.indexOf('\n  admit:\n');
  const publishJobIndex = source.indexOf('\n  publish:\n', admitJobIndex);
  assert.ok(admitJobIndex >= 0 && publishJobIndex > admitJobIndex,
    'publication must separate credential-free durable admission from provider mutation');
  const admitJob = source.slice(admitJobIndex, publishJobIndex);
  const publishJob = source.slice(publishJobIndex);
  ordered(admitJob, [
    'publication-effect-reconciliation.json',
    'actions/upload-artifact@',
  ], 'durable publication admission');
  assert.doesNotMatch(admitJob, /\$\{\{ secrets\./,
    'durable publication STARTED evidence must be persisted without provider credentials');
  ordered(publishJob, [
    'actions/download-artifact@',
    'candidate-build-receipt.json',
    /sha256sum.+candidate-image\.tar\.gz/s,
    'docker load',
    'verify-descriptors',
    'FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}',
    'verify-registry-readback',
    /image copy(?:\s+--[a-z-]+)*\s+["']?\$local_ref/,
    'verify-registry-readback',
    'registry-descriptor-readback.json',
    'physio-production-publication.json',
  ], 'exact provider publication');
  assert.doesNotMatch(source, /\bdocker (?:build|tag|push)\b|\bfly deploy\b/);
  assert.match(source,
    /regctl-linux-amd64[\s\S]*c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467[\s\S]*(?:VCSTag|version)/,
    'registry transport must be both version- and checksum-pinned');
  assert.doesNotMatch(source,
    /(?:grep|awk|sed)[^\n]*(?:404|MANIFEST_UNKNOWN|NAME_UNKNOWN)|imagetools inspect/,
    'registry absence may not be inferred from CLI stderr, text matching or an undifferentiated exit status');
  assert.match(source, /--mode ['"]?absent['"]?/,
    'pre-mutation registry admission must use the typed exact-absence validator');
  assert.match(source, /--mode ['"]?present['"]?/,
    'publication and response-loss reconciliation must use the exact-present descriptor validator');
  assert.match(source, /registry-mutation-started/,
    'publication must durably distinguish a provider mutation from a pre-mutation failure');
  assert.match(source,
    /image copy[\s\S]*copy_exit_code[\s\S]*verify-registry-readback[\s\S]*--mode present/,
    'a copy response loss must be reconciled through exact registry readback before completion');
  assert.ok((source.match(/--max-filesize\s+(?:4_194_304|4194304)/g) || []).length >= 2,
    'both registry manifest GETs must enforce the bounded four-MiB evidence surface');
  assert.match(source, /rm -f[^\n]*curl-auth\.cfg/,
    'the temporary raw-token curl config must be removed on every provider-step exit');
  for (const evidenceFile of [
    'registry-prestate-head.headers',
    'registry-prestate-head.stderr',
    'registry-prestate-get.headers',
    'registry-prestate-get.stderr',
    'registry-prestate-get.body',
  ]) assert.ok(source.includes(`'${evidenceFile}'`),
    `failed or uncertain publication does not hash ${evidenceFile}`);
  const publicationDispatch = source.slice(0, source.indexOf('permissions:'));
  assert.doesNotMatch(publicationDispatch,
    /(?:provision|live_payment_validation|finalization)_receipt_sha256:/,
    'publication cannot consume post-deploy self-service evidence and create a release cycle');
});

test('registry protocol validator distinguishes exact absence and compares the complete frozen descriptor', () => {
  const helper = read('scripts', 'physio-oci-image.mjs');

  for (const marker of [
    "headStatus !== 404 || getStatus !== 404",
    "payload.errors.length !== 1",
    "['MANIFEST_UNKNOWN', 'NAME_UNKNOWN']",
    "headStatus !== 200 || getStatus !== 200",
    "docker-content-digest",
    "content-length",
    "content-type",
    "raw.length !== source.manifest_size",
    "sha256:${sha256(raw)}",
    "manifest.config?.digest !== source.config.digest",
    "application/vnd.oci.image.index.v1+json",
    "['schemaVersion', 'mediaType', 'manifests']",
    "source.layers",
    "ABSENT_EXACT_HEAD_GET_404",
    "PRESENT_EXACT_DESCRIPTOR",
  ]) assert.ok(helper.includes(marker), `registry protocol validator is missing ${marker}`);

  assert.match(helper, /statusLines\.length !== 1/,
    'redirect or multi-response status chains must fail closed');
  assert.match(helper, /rows\.length !== 1/,
    'duplicate security-relevant registry headers must fail closed');
  assert.match(helper, /raw\.length\s*>\s*(?:4_194_304|4194304|4\s*\*\s*1024\s*\*\s*1024)/,
    'the typed registry parser must reject an oversized response even if curl bounds regress');
  assert.doesNotMatch(helper, /includes\(['"]not found['"]\)|match\([^\n]*404|stderr/i,
    'typed provider classification may not fall back to human-readable error text');
});

test('Physio Sentry releases are target-qualified while the application SHA remains raw', () => {
  const identity = read('packages', 'profession-config', 'sentry-release.mjs');
  for (const marker of [
    "export const PHYSIO_SENTRY_RELEASE_PREFIX = 'physio-production@'",
    "if (professionId === 'physio') return `${PHYSIO_SENTRY_RELEASE_PREFIX}${releaseSha}`",
    "if (professionId === 'exercise-physiology') return releaseSha",
    "environment === 'physio-production'",
    "environment === 'production'",
  ]) assert.ok(identity.includes(marker), `shared Sentry identity is missing ${marker}`);

  const dockerfile = read('Dockerfile.physio');
  assert.match(dockerfile, /RELEASE_SHA=\$\{RELEASE_SHA\}/,
    'the version/readiness SHA must remain the raw application commit');
  assert.match(dockerfile, /VITE_SENTRY_RELEASE=physio-production@\$\{RELEASE_SHA\}/,
    'the Physio browser bundle must use the target-qualified Sentry release');
  assert.match(dockerfile, /SENTRY_RELEASE=physio-production@\$\{RELEASE_SHA\}/,
    'the Physio server runtime must use the same target-qualified Sentry release');
  assert.doesNotMatch(dockerfile, /(?:VITE_)?SENTRY_RELEASE=\$\{RELEASE_SHA\}/,
    'the Physio image may not reuse the raw EP Sentry release identity');

  const posture = read('server', 'productionPosture.mjs');
  const serverTelemetry = read('server', 'telemetry.mjs');
  const browserTelemetry = read('src', 'lib', 'errorTelemetry.js');
  assert.match(posture, /sentryReleaseForProfession\('physio', environment\.RELEASE_SHA\)/,
    'Physio readiness must derive its exact target-qualified Sentry release');
  assert.match(serverTelemetry, /sentryReleaseForProfession\(active\.professionId, releaseCandidate\)/,
    'server telemetry must derive release identity from the admitted profession');
  assert.match(browserTelemetry, /normalizeSentryReleaseForEnvironment\(expectedEnvironment, runtime\.VITE_SENTRY_RELEASE\)/,
    'browser telemetry must validate release identity against the active target environment');

  const sentryContract = read('scripts', 'physio-sentry-release-contract.mjs');
  assert.match(sentryContract, /sentryReleaseForProfession/,
    'Sentry receipt validators must share the profession release-identity helper');
  assert.doesNotMatch(sentryContract, /receipt\.release_version\s*!==\s*applicationSha/,
    'Physio Sentry receipts may not validate a raw application SHA as the provider release ID');

  const prepare = workflow('physio-production-prepare-release.yml');
  const sentryReleaseJob = prepare.slice(prepare.indexOf('\n  sentry_release:\n'));
  assert.match(prepare,
    /release_version:\s*sentryReleaseForProfession\('physio', process\.env\.APPLICATION_SHA\)/,
    'source-map evidence must derive the exact target-qualified release ID');
  assert.match(sentryReleaseJob, /SENTRY_RELEASE_VERSION="physio-production@\$APPLICATION_SHA"/,
    'the Sentry release job must derive one immutable target-qualified version');
  for (const pattern of [
    /encoded_release="\$\(RELEASE="\$SENTRY_RELEASE_VERSION"/,
    /release_url="\$REGION_URL\/api\/0\/organizations\/unimatter\/releases\/\$encoded_release\/"/,
    /files_url="\$REGION_URL\/api\/0\/projects\/unimatter\/assesssuite-production\/releases\/\$encoded_release\/files\/"/,
    /request create POST "\$REGION_URL\/api\/0\/organizations\/unimatter\/releases\/"/,
    /request finalize PUT "\$release_url"/,
    /request final GET "\$release_url"/,
    /request delete DELETE "\$release_url"/,
  ]) assert.match(sentryReleaseJob, pattern,
    `Sentry release preparation does not consistently use ${String(pattern)}`);
  assert.doesNotMatch(sentryReleaseJob,
    /(?:RELEASE|release_version)="\$APPLICATION_SHA"|row\.version !== process\.env\.APPLICATION_SHA/,
    'Sentry preparation may not fall back to the cross-target raw SHA identity');
  assert.doesNotMatch(sentryReleaseJob, /sentry-cli|continue-on-error:/,
    'the replay-safe release lane must use exact REST receipts and fail closed');
  const prepareDocument = yaml.load(prepare);
  const sentryStart = prepareDocument.jobs?.sentry_start;
  const sentryPhase = sentryStart?.steps?.find((step) => step.id === 'phase');
  const sentryPhaseUpload = sentryStart?.steps?.find((step) => step.id === 'upload_phase');
  const sentryStartJob = prepare.slice(prepare.indexOf('\n  sentry_start:\n'), prepare.indexOf('\n  sentry_release:\n'));
  const completedReuse = String(sentryPhase?.run || '');
  for (const marker of ['validate-release-packet', 'resume_completed=true', 'exit 0']) {
    assert.ok(completedReuse.includes(marker),
      `an exact completed Sentry packet does not short-circuit through ${marker}`);
  }
  assert.equal(sentryPhaseUpload?.if, "${{ steps.phase.outputs.resume_completed != 'true' }}",
    'completed read-only reuse must not leave a new unbound STARTED artifact');
  const completedRevalidation = prepareDocument.jobs?.sentry_release?.steps
    ?.find((step) => step.id === 'revalidate_completed');
  assert.equal(completedRevalidation?.if, "${{ needs.sentry_start.outputs.resume_completed == 'true' }}",
    'completed reuse must always take a fresh provider readback');
  for (const marker of [
    'request organization', 'request project', 'request release', 'deploy-page-$page',
    'files-page-$page', 'download-$index', 'provider-current-readiness-readback.json',
    'provider-current-readiness-request-id-hashes.json', 'sentry-current-readiness.json',
  ]) assert.ok(String(completedRevalidation?.run || '').includes(marker),
    `completed Sentry readiness revalidation is missing ${marker}`);
  assert.doesNotMatch(String(completedRevalidation?.run || ''),
    /--request\s+(?:POST|PUT|DELETE)|request\s+\S+\s+(?:POST|PUT|DELETE)/,
    'completed reuse provider revalidation must remain read-only');
  assert.match(sentryReleaseJob,
    /Reuse exact completed Sentry packet after fresh readback with zero provider mutations[\s\S]*validate-release-packet/,
    'completed reuse must package the fresh readback and revalidate the full final packet');
  assert.match(sentryStartJob, /Exhaustively deny unadmitted prior exact-SHA Sentry effects[\s\S]*actions\/artifacts\?per_page=100&page=\$page/,
    'fresh generation zero must exhaustively deny prior exact-SHA Sentry effect artifacts');
  for (const marker of [
    'CREATE_REUSE',
    'COMPENSATION_COMPLETE',
    'COMPENSATION_STARTED',
    'COMPENSATION_COMPLETED',
    'CREATE_UPLOAD_FINALIZE_STARTED',
    'phase-????.json',
    'reconciliation-????.json',
    'extract-provider-request-ids',
  ]) assert.ok(prepare.includes(marker), `Sentry phase recovery is missing ${marker}`);
  assert.match(sentryStartJob, /validate-phase-packet/,
    'every non-completed Sentry resume must revalidate its complete phase chain');

  const deploy = workflow('physio-production-deploy.yml');
  const sentryDeploymentJob = deploy.slice(deploy.indexOf('\n  sentry_deployment:\n'));
  assert.match(sentryDeploymentJob,
    /SENTRY_RELEASE_VERSION:\s*physio-production@\$\{\{ inputs\.application_sha \}\}/,
    'the Sentry deployment job must bind the same target-qualified version');
  assert.match(sentryDeploymentJob,
    /deployments_url="https:\/\/sentry\.io\/api\/0\/organizations\/\$SENTRY_ORG\/releases\/\$encoded_release\/deploys\/"[\s\S]*physio-sentry-deployment-api\.mjs create/,
    'the post-deploy association must target the qualified Physio release');
  assert.match(sentryDeploymentJob, /row\.version !== process\.env\.SENTRY_RELEASE_VERSION/,
    'the post-deploy provider readback must prove the qualified Physio release');
  assert.match(sentryDeploymentJob, /release_version:\s*process\.env\.SENTRY_RELEASE_VERSION/,
    'the Sentry deployment receipt must preserve the qualified provider release ID');
  assert.doesNotMatch(sentryDeploymentJob,
    /sentry-cli releases deploys "\$APPLICATION_SHA"|row\.version !== process\.env\.APPLICATION_SHA|release_version:\s*process\.env\.APPLICATION_SHA/,
    'post-deploy association may not rejoin the raw EP release namespace');
});

test('deploy consumes the complete chain, never rebuilds, and records Sentry deployment only after PASS', () => {
  const source = workflow('physio-production-deploy.yml');
  const firstMutation = mutationIndex(source);
  assert.ok(Number.isFinite(firstMutation), 'deploy has no bounded provider mutation');

  for (const marker of [
    'publication_artifact_id:',
    'publication_receipt_sha256:',
    'canary_artifact_id:',
    'canary_receipt_sha256:',
    'production_bootstrap_artifact_id:',
    'production_bootstrap_receipt_sha256:',
    'stripe_webhook_archive_artifact_id:',
    'stripe_webhook_archive_artifact_digest:',
    'stripe_webhook_archive_receipt_sha256:',
    'stripe_webhook_receipt_sha256:',
    'sentry_release_artifact_id:',
    'sentry_release_receipt_sha256:',
    'archive_sha256',
    'local_image_id',
    'oci_archive_sha256',
    'oci_manifest_digest',
    'oci_descriptor_manifest_sha256',
    'registry_protocol_final_sha256',
    'publisher_tool',
    'release_execution_source_sha256',
    'exact_image_canary_receipt_sha256',
    'production_bootstrap_receipt_sha256',
    'stripe_webhook_receipt_sha256',
    'sentry_release_receipt_sha256',
    'immutable_image',
    'image_digest',
    'assesssuite-physio-image-publication/3.0.0',
    'assesssuite-physio-bootstrap/3.0.0',
    'assesssuite-physio-stripe-webhook-bootstrap/1.0.0',
    'assesssuite-physio-sentry-release/1.0.0',
  ]) assert.ok(source.includes(marker), `deploy is missing chain binding ${marker}`);

  assert.doesNotMatch(source,
    /assesssuite-physio-image-publication\/1\.0\.0|assesssuite-physio-bootstrap\/2\.0\.0|assesssuite-physio-exact-image-canary\/2\.0\.0/,
    'deploy may not admit a superseded release-chain contract');

  const providerCredentialIndex = source.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const artifactMetadataIndex = source.indexOf('node scripts/github-artifact-admission.mjs');
  const firstArtifactDownloadIndex = source.indexOf('actions/download-artifact@');
  assert.ok(artifactMetadataIndex >= 0 && artifactMetadataIndex < providerCredentialIndex,
    'the shared exact artifact/run admission must complete before provider credentials');
  assert.ok(firstArtifactDownloadIndex >= 0 && artifactMetadataIndex < firstArtifactDownloadIndex,
    'the shared bounded artifact/run admission must precede predecessor downloads');
  assert.doesNotMatch(source, /size_in_bytes\s*>\s*5_000_000_000/,
    'small release-evidence packets may not inherit an effectively unbounded five-GB download allowance');
  for (const marker of [
    'PUBLICATION_ARTIFACT_ID',
    'CANARY_ARTIFACT_ID',
    'PRODUCTION_BOOTSTRAP_ARTIFACT_ID',
    'STRIPE_WEBHOOK_ARCHIVE_ARTIFACT_ID',
    'STRIPE_WEBHOOK_ARCHIVE_RECEIPT_SHA256',
    'SENTRY_RELEASE_ARTIFACT_ID',
    'upstream-artifact-metadata.json',
    'upstream_artifact_metadata_sha256',
    'workflow_run',
    'head_sha',
    'expired',
    'digest',
  ]) assert.ok(source.includes(marker), `deploy artifact-metadata admission is missing ${marker}`);

  const publicationSource = workflow('physio-production-publish.yml');
  const frozenSources = [...publicationSource.matchAll(/sha\('([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(frozenSources.length >= 40, 'publication source graph is unexpectedly incomplete');
  for (const file of frozenSources) {
    assert.ok(source.includes(`sha('${file}')`) || source.includes(`sha256('${file}')`),
      `deploy does not independently re-admit frozen execution source ${file}`);
  }

  const admissionEnd = Math.max(
    source.indexOf('physio-production-publication.json'),
    source.indexOf('physio-exact-image-canary'),
    source.indexOf('physio-production-bootstrap.json'),
    source.indexOf('physio-production-stripe-webhook.json'),
    source.indexOf('physio-sentry-release.json'),
    source.indexOf('validate-release'),
  );
  assert.ok(admissionEnd >= 0 && admissionEnd < firstMutation,
    'publication, canary, bootstrap, webhook and prepared Sentry release must be admitted before the first provider mutation');
  assert.match(source,
    /physio-exact-image-canary-contract\.mjs validate[\s\S]{0,600}--immutable-image "\$LOCAL_IMAGE_ID"[\s\S]{0,300}--candidate-archive-sha256 "\$ARCHIVE_SHA(?:256)?"/,
    'deploy must validate the pre-publication canary against its local image ID and exact Docker archive');
  assert.doesNotMatch(source,
    /physio-exact-image-canary-contract\.mjs validate[\s\S]{0,600}--immutable-image "\$IMMUTABLE_IMAGE"/,
    'deploy may not create a release-order cycle by pretending the local canary knew the later registry digest');
  assert.doesNotMatch(source, /\bdocker (?:build|save|load|tag|push)\b/);
  assert.match(source, /registry\.fly\.io\/assesssuite-physio-production@sha256:/);
  assert.doesNotMatch(source, /\bfly deploy\b[^\n]*:(?:latest|main)\b/);
  const deployDispatch = source.slice(0, source.indexOf('permissions:'));
  assert.doesNotMatch(deployDispatch,
    /(?:provision|live_payment_validation|finalization)_receipt_sha256:/,
    'deploy cannot require receipts produced only after the Fly service exists');
  assert.match(source, /https:\/\/assesssuite-physio-production\.fly\.dev/,
    'the first deployed journey must remain addressable on the Fly hostname');
  assert.doesNotMatch(source, /\bfly certs (?:add|create)|\bcloudflare\b|\bdnscontrol\b/i,
    'deploy cannot attach custom DNS/TLS before Fly-host self-service and live QA');

  ordered(source, [
    "contract_version: 'assesssuite-physio-deploy/3.0.0', result: 'PASS'",
    'physio-sentry-deployment-api.mjs create',
    "contract_version: 'assesssuite-physio-sentry-deployment/2.0.0', result: 'PASS'",
    'validate-deployment',
  ], 'post-PASS Sentry deployment');
  const sentryDeploymentJob = source.slice(source.indexOf('sentry_deployment:'));
  assert.match(sentryDeploymentJob, /started_effect_receipt_sha256/,
    'Sentry deployment completion must bind the exact durable pre-mutation STARTED receipt');
  const sentryProviderApi = read('scripts', 'physio-sentry-deployment-api.mjs');
  assert.match(sentryProviderApi, /results="\(\?:true\|false\)"/,
    'Sentry deployment inventory must inspect the provider pagination signal');
  assert.match(sentryProviderApi, /exactly one next relation is required/,
    'Sentry pagination admission must require one unambiguous next-page relation');
  assert.match(sentryProviderApi, /next results flag absent/,
    'Sentry exact absence must fail closed without an explicit pagination result');
  assert.match(sentryProviderApi, /response\.status !== 200/,
    'Sentry provider inventory must reject non-successful page responses');
  for (const marker of [
    'provider_mutation_calls_attempted', 'provider_mutation_calls_confirmed',
    'provider_inventory_calls_attempted', 'provider_inventory_calls_confirmed',
    'provider_mutation_http_receipt_sha256', 'mutation_x_sentry_request_id_sha256',
  ]) assert.ok(sentryDeploymentJob.includes(marker),
    `Sentry deployment evidence is missing ${marker}`);
  const sentryContract = read('scripts', 'physio-sentry-release-contract.mjs');
  assert.match(sentryContract, /receipt\.deployment_url !== 'https:\/\/assesssuite-physio-production\.fly\.dev'/,
    'the pre-DNS Sentry deployment receipt must name the already verified Fly hostname');
  assert.doesNotMatch(sentryContract, /receipt\.deployment_url !== 'https:\/\/physio\.app\.assesssuite\.com'/,
    'the initial deployment receipt may not claim the not-yet-attached custom hostname');
});

test('deploy continues each durable provider phase only from the maximal protected ledger tip', () => {
  const source = workflow('physio-production-deploy.yml');
  const document = yaml.load(source);
  const inputs = document.on?.workflow_dispatch?.inputs || {};
  for (const name of [
    'continuation_ledger_commit_sha',
    'continuation_ledger_record_sha256',
  ]) {
    assert.ok(inputs[name], `deploy dispatch is missing exact protected-ledger input ${name}`);
    assert.equal(inputs[name].default, '0', `${name} must use exact zero only for the initial run`);
  }
  assert.equal(inputs.resume_deploy_effect_artifact_id, undefined,
    'an expiring artifact ID may not authorise a deploy continuation');
  assert.equal(inputs.resume_deploy_effect_artifact_digest, undefined,
    'an expiring artifact digest may not authorise a deploy continuation');

  const ledger = read('scripts', 'physio-deploy-ledger.mjs');
  for (const marker of [
    "DEPLOY_LEDGER_BRANCH = 'assesssuite-physio-deploy-ledger'",
    'inventoryDeployLedger', 'materialize-remote', 'latest_record_commit_sha',
    'force: false', 'ledger_provisioning_receipt_sha256', 'bypass_actors',
  ]) assert.ok(ledger.includes(marker), `protected deploy ledger is missing ${marker}`);
  for (const marker of [
    'physio-deploy-ledger.mjs inventory', 'physio-deploy-ledger.mjs materialize-remote',
    'CONTINUATION_LEDGER_COMMIT_SHA', 'CONTINUATION_LEDGER_RECORD_SHA256',
    '[[ "$EXPECTED_COMMIT" == "$ACTUAL_COMMIT" && "$EXPECTED_RECORD" == "$ACTUAL_RECORD" ]]',
  ]) assert.ok(source.includes(marker), `deploy continuation admission is missing ${marker}`);

  const contract = read('scripts', 'physio-release-contract.mjs');
  for (const marker of [
    'validate-deploy-resume-packet',
    'assesssuite-physio-deploy-effect-reconciliation/2.0.0',
    'STARTED',
    'SNAPSHOT_COMPLETED',
    'LIVE_MUTATION_STARTED',
    'POST_RESTART_VERIFIED',
    'COMPLETED',
    'STARTED_UNRESOLVED',
    'application_sha',
    'immutable_image',
    'publication_receipt_sha256',
    'canary_receipt_sha256',
    'bootstrap_receipt_sha256',
    'stripe_webhook_receipt_sha256',
    'sentry_release_receipt_sha256',
    'capability_intent_id',
    'authority_reference',
    'expected_volume_id',
    'SHA256SUMS',
  ]) assert.ok(contract.includes(marker), `deploy phase-resume contract is missing ${marker}`);
  assert.match(contract, /lstatSync|O_NOFOLLOW/,
    'deploy resume validation must not follow prior packet links');
  assert.match(contract, /isSymbolicLink\(\)/,
    'deploy resume validation must reject linked packet members');

  const validationIndex = source.indexOf('validate-deploy-resume-packet');
  const providerCredentialIndex = source.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const firstMutation = mutationIndex(source);
  assert.ok(validationIndex >= 0 && validationIndex < providerCredentialIndex &&
    validationIndex < firstMutation,
  'prior deploy phase must be fully admitted before any Fly credential or mutation');
  for (const binding of [
    '--application-sha "$APPLICATION_SHA"',
    '--immutable-image "$IMMUTABLE_IMAGE"',
    '--capability-intent-id "$CAPABILITY_INTENT_ID"',
    '--authority-reference "$AUTHORITY_REFERENCE"',
    '--expected-volume-id "$EXPECTED_VOLUME_ID"',
  ]) assert.ok(source.includes(binding), `deploy phase-resume validation is missing ${binding}`);

  for (const phase of [
    'STARTED',
    'SNAPSHOT_COMPLETED',
    'LIVE_MUTATION_STARTED',
    'POST_RESTART_VERIFIED',
    'COMPLETED',
  ]) {
    assert.match(source, new RegExp(`Upload[^\\n]*(?:deploy[^\\n]*)?${phase.replaceAll('_', '[- _]')}`, 'i'),
      `deploy must durably upload ${phase} before the next external phase`);
  }
  assert.match(source,
    /resume_completed[\s\S]{0,1800}(?:provider_calls_attempted[\s\S]{0,180}provider_calls_confirmed|exit 0)/,
    'an exact completed deploy packet must return read-only without another Fly effect');
  assert.match(source,
    /STARTED_UNRESOLVED[\s\S]{0,2000}(?:provider[_ -]readback|machines?[^\n]*list|snapshots?[^\n]*list)/i,
    'an uncertain deploy phase must reconcile exact provider state before continuation');
  const sentrySteps = document.jobs?.sentry_deployment?.steps || [];
  assert.equal(document.jobs?.sentry_deployment?.if,
    "${{ needs.deploy.result == 'success' && ((needs.deploy.outputs.deploy_phase == 'DEPLOY_COMPLETED' && needs.archive_deploy_transition.result == 'success') || (needs.deploy.outputs.deploy_phase == 'SENTRY_ASSOCIATION_STARTED' && needs.archive_deploy_transition.result == 'skipped')) }}",
    'Sentry may start only after the protected deploy-completion append or its exact current-run handoff');
  const flySelector = document.jobs?.deploy?.steps?.find((step) => step.id === 'transition_artifact');
  assert.match(String(flySelector?.run || ''),
    /RESUME_COMPLETED === 'true' \|\| process\.env\.FLY_COMPLETED === 'true'/,
    'the Sentry continuation run must not deadlock by demanding another Fly transition artifact');
  assert.equal(document.jobs?.archive_deploy_transition?.uses,
    './.github/workflows/physio-deploy-ledger-archive.yml');
  assert.deepEqual(document.jobs?.archive_deploy_transition?.permissions,
    { contents: 'write', actions: 'read' });
  assert.equal(document.jobs?.continue_fly_transition?.uses,
    './.github/workflows/physio-deploy-continuation.yml');
  assert.deepEqual(document.jobs?.continue_fly_transition?.permissions,
    { contents: 'read', actions: 'write' });
  assert.match(document.jobs?.continue_fly_transition?.if || '',
    /archive_deploy_transition\.result == 'success'/,
    'the next Fly effect must wait for a successful protected append');
  assert.match(document.jobs?.continue_sentry_transition?.if || '',
    /archive_sentry_transition\.result == 'success'/,
    'the next Sentry effect must wait for a successful protected append');
  const stepById = (id) => sentrySteps.find((step) => step.id === id);
  const unresolvedCondition =
    "${{ always() && steps.select_sentry_transition.outputs.action == 'effect' && steps.sentry_effect.outputs.association_completed != 'true' }}";
  const terminalSeal = stepById('seal_sentry_terminal');
  const terminalUpload = stepById('upload_sentry_terminal');
  assert.equal(terminalSeal?.if, unresolvedCondition,
    'Sentry failure or response loss must seal the unresolved phase and exact deploy result');
  assert.equal(terminalUpload?.if, unresolvedCondition,
    'Sentry failure or response loss must always upload the sealed unresolved envelope');
  assert.equal(terminalUpload?.with?.path,
    '${{ runner.temp }}/physio-deploy-sentry-terminal-envelope');
  for (const marker of [
    '"$envelope/phase"',
    '"$envelope/deploy-result"',
    'sha256sum --check --strict SHA256SUMS',
  ]) assert.ok(String(terminalSeal?.run || '').includes(marker),
    `terminal Sentry resume envelope is missing ${marker}`);

  const finalReceipt = stepById('final_v2');
  const finalUpload = stepById('upload_final_v2');
  assert.equal(finalReceipt?.if,
    "${{ steps.sentry_plan.outputs.association_completed == 'true' || steps.sentry_effect.outputs.association_completed == 'true' }}",
  'the Sentry PASS receipt must remain impossible until association is authoritatively complete');
  assert.equal(finalUpload?.with?.path, '${{ runner.temp }}/sentry-deployment-final-v2');
  const successSeal = stepById('seal_sentry_success_envelope');
  const successUpload = stepById('upload_sentry_success_envelope');
  assert.equal(successSeal?.if, "${{ steps.upload_final_v2.outputs.artifact-id != '' }}",
    'completed resume sealing must require the exact uploaded Sentry PASS receipt');
  assert.equal(successUpload?.if, "${{ steps.seal_sentry_success_envelope.outcome == 'success' }}");
  assert.equal(successUpload?.with?.path,
    '${{ runner.temp }}/physio-deploy-sentry-success-envelope');
  for (const marker of [
    '"$envelope/phase"',
    '"$envelope/deploy-result"',
    '"$envelope/sentry-result"',
    'sentry.deploy_receipt_sha256 !== h(process.env.DEPLOY_RECEIPT)',
    'sha256sum --check --strict SHA256SUMS',
  ]) assert.ok(String(successSeal?.run || '').includes(marker),
    `completed Sentry resume envelope is missing ${marker}`);
});

test('rollback persists and resumes a durable phase ledger before every destructive provider sequence', () => {
  const source = workflow('physio-production-rollback.yml');
  const document = yaml.load(source);
  const inputs = document.on?.workflow_dispatch?.inputs || {};
  for (const name of [
    'rollback_target_artifact_id',
    'rollback_target_artifact_digest',
    'rollback_target_receipt_sha256',
    'resume_rollback_effect_artifact_id',
    'resume_rollback_effect_artifact_digest',
  ]) {
    assert.ok(inputs[name], `rollback dispatch is missing exact cross-run input ${name}`);
    assert.equal(inputs[name].required, true, `${name} must be explicit on every rollback dispatch`);
  }
  assert.equal(inputs.resume_rollback_effect_artifact_id.default, '0',
    'fresh rollback must represent no prior phase artifact with exact ID 0');
  assert.equal(inputs.resume_rollback_effect_artifact_digest.default, '0',
    'fresh rollback must represent no prior phase digest with exact value 0');

  const contract = read('scripts', 'physio-release-contract.mjs');
  for (const marker of [
    'validate-rollback-resume-packet',
    'assesssuite-physio-rollback-effect-reconciliation/1.0.0',
    'STARTED',
    'SNAPSHOT_COMPLETED',
    'RESTORE_VERIFIED',
    'TARGET_VERIFIED',
    'LIVE_MUTATION_STARTED',
    'POST_RESTART_VERIFIED',
    'COMPLETED',
    'STARTED_UNRESOLVED',
    'failed_application_sha',
    'current_immutable_image',
    'rollback_mode',
    'rollback_release_sha',
    'rollback_immutable_image',
    'rollback_target_artifact_id',
    'rollback_target_artifact_digest',
    'rollback_target_receipt_sha256',
    'rollback_target_config_sha256',
    'rollback-target-config.toml',
    'expected_machine_id',
    'expected_volume_id',
    'capability_intent_id',
    'authority_reference',
    'SHA256SUMS',
  ]) assert.ok(contract.includes(marker), `rollback phase-resume contract is missing ${marker}`);
  assert.match(contract, /lstatSync|O_NOFOLLOW/,
    'rollback resume validation must not follow prior packet links');
  assert.match(contract, /isSymbolicLink\(\)/,
    'rollback resume validation must reject linked packet members');

  const targetAdmissionIndex = source.indexOf('rollback-target-config.toml');
  const targetReceiptIndex = source.indexOf('rollback_target_receipt_sha256');
  const targetMutationIndex = Math.min(...[
    source.search(/\bfly machine update\b[^\n]*\$ROLLBACK_IMMUTABLE_IMAGE/),
    source.search(/\bfly deploy\b[^\n]*\$ROLLBACK_IMMUTABLE_IMAGE/),
  ].filter((index) => index >= 0), Number.POSITIVE_INFINITY);
  assert.ok(targetAdmissionIndex >= 0 && targetReceiptIndex >= 0 &&
    targetAdmissionIndex < targetMutationIndex && targetReceiptIndex < targetMutationIndex,
  'rollback target SHA, digest, receipt and exact config bytes must be admitted before target mutation');
  const recordedConfigApplied = /--config\s+["']?\$[^\n"']*(?:ROLLBACK_TARGET_CONFIG|rollback-target-config)/i.test(source);
  const currentConfigProvedEquivalent = /(?:cmp\s+--silent|sha256sum)[^\n]*(?:rollback-target-config\.toml|ROLLBACK_TARGET_CONFIG)[\s\S]{0,500}(?:fly\.physio\.production\.toml|CONFIG_SHA256)/i.test(source);
  assert.ok(recordedConfigApplied || currentConfigProvedEquivalent,
    'rollback must apply recorded config bytes or prove the current config byte-equivalent before mutation');
  assert.doesNotMatch(source,
    /fly machine update[^\n]*--image\s+["']?\$ROLLBACK_IMMUTABLE_IMAGE["']?(?:\s*\\)?\s*\n(?!(?:[^\n]*(?:rollback-target-config|ROLLBACK_TARGET_CONFIG|config-byte-equivalent)))/i,
    'a current-image-only rollback update without recorded-config proof is forbidden');

  const jobs = Object.entries(document.jobs || {});
  const startEntry = jobs.find(([, job]) => JSON.stringify(job).includes(
    'assesssuite-physio-rollback-effect-reconciliation/1.0.0',
  ));
  assert.ok(startEntry, 'rollback requires a separate credential-free durable STARTED job');
  const [startName, startJob] = startEntry;
  const startSource = JSON.stringify(startJob);
  assert.doesNotMatch(startSource, /secrets\.FLY_API_TOKEN|\bfly (?:volumes?|machines?)\b/,
    'rollback STARTED admission may not receive credentials or mutate Fly');
  assert.match(startSource, /actions\/upload-artifact@/,
    'rollback STARTED evidence must be uploaded before provider mutation');
  const effectEntry = jobs.find(([, job]) => JSON.stringify(job).includes('fly volumes snapshots create'));
  assert.ok(effectEntry, 'rollback provider-effect job is missing');
  const [, effectJob] = effectEntry;
  const declaredNeeds = Array.isArray(effectJob.needs) ? effectJob.needs : [effectJob.needs].filter(Boolean);
  assert.ok(declaredNeeds.includes(startName),
    'rollback provider mutation must depend on durable STARTED/resume admission');
  assert.match(String(effectJob.if || ''), /resume_completed\s*!=\s*'true'/,
    'completed rollback reuse must skip the provider-effect job entirely');

  const validationIndex = source.indexOf('validate-rollback-resume-packet');
  const providerCredentialIndex = source.indexOf('FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}');
  const firstMutation = mutationIndex(source);
  assert.ok(validationIndex >= 0 && validationIndex < providerCredentialIndex &&
    validationIndex < firstMutation,
  'prior rollback phase must be fully admitted before any Fly credential or mutation');
  for (const phase of [
    'STARTED',
    'SNAPSHOT_COMPLETED',
    'RESTORE_VERIFIED',
    'TARGET_VERIFIED',
    'LIVE_MUTATION_STARTED',
    'POST_RESTART_VERIFIED',
    'COMPLETED',
  ]) {
    assert.match(source, new RegExp(`Upload[^\\n]*(?:rollback[^\\n]*)?${phase.replaceAll('_', '[- _]')}`, 'i'),
      `rollback must durably upload ${phase} before the next external phase`);
  }
  assert.match(source,
    /resume_completed[\s\S]{0,1600}(?:provider_calls_executed[^\n]*0|exit 0)/,
    'an exact completed rollback packet must return read-only without another Fly effect');
  assert.match(source,
    /STARTED_UNRESOLVED[\s\S]{0,2400}(?:provider[_ -]readback|machines?[^\n]*list|volumes?[^\n]*list|snapshots?[^\n]*list)/i,
    'an uncertain rollback phase must reconcile exact provider state before continuation');
  assert.match(source,
    /if:\s*\$\{\{ always\(\) \}\}[\s\S]{0,500}Upload[^\n]*(?:rollback[^\n]*)?(?:terminal|effect|receipt)/i,
    'rollback must always persist a terminal or unresolved phase packet');
});
