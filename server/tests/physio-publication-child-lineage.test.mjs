import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'physio-production-publish.yml');
const admissionPath = path.join(repoRoot, 'scripts', 'physio-deploy-admission.mjs');

function sources() {
  const workflowSource = fs.readFileSync(workflowPath, 'utf8');
  const workflow = yaml.load(workflowSource);
  const admit = workflow.jobs.admit.steps.find((step) => step.id === 'admit')?.run || '';
  const publish = workflow.jobs.publish.steps.find((step) => step.id === 'publish')?.run || '';
  return {
    workflow,
    workflowSource,
    admit,
    publish,
    admission: fs.readFileSync(admissionPath, 'utf8'),
  };
}

function assertChildLineage({ workflow, workflowSource, admit, publish, admission }) {
  assert.match(admit, /provider-canary-admission\.json/);
  assert.match(admit, /derivePhysioCanaryCapabilityBindingSha256/);
  assert.match(admit, /canary_capability_intent_id=\$canary_capability_intent_id/);
  assert.match(admit, /canary_authority_reference=\$canary_authority_reference/);
  assert.match(admit, /bootstrap\.capability_intent_id === process\.env\.CANARY_INTENT/);
  assert.match(admit, /webhook\.capability_intent_id === process\.env\.CANARY_INTENT/);
  assert.match(admit, /process\.env\.CANARY_INTENT === process\.env\.INTENT/);
  assert.ok((admit.match(/canary_capability_intent_id:/g) || []).length >= 2,
    'canary child intent must be persisted in publication STARTED and payload evidence');
  assert.ok((admit.match(/canary_authority_reference:/g) || []).length >= 2,
    'canary child authority must be persisted in publication STARTED and payload evidence');
  assert.match(publish, /canary_capability_intent_id: process\.env\.CANARY_INTENT/);
  assert.match(publish, /canary_authority_reference: process\.env\.CANARY_AUTHORITY/);
  assert.equal(workflow.jobs.admit.outputs.canary_capability_intent_id,
    '${{ steps.admit.outputs.canary_capability_intent_id }}');
  assert.equal(workflow.jobs.admit.outputs.canary_authority_reference,
    '${{ steps.admit.outputs.canary_authority_reference }}');
  assert.match(workflowSource,
    /CANARY_CAPABILITY_INTENT_ID: \$\{\{ needs\.admit\.outputs\.canary_capability_intent_id \}\}/);
  assert.match(workflowSource,
    /CANARY_AUTHORITY_REFERENCE: \$\{\{ needs\.admit\.outputs\.canary_authority_reference \}\}/);

  assert.match(admission, /canaryProof\.receipts\.providerAdmission\.capability_intent_id/);
  assert.match(admission, /canaryProof\.receipts\.providerAdmission\.authority_reference/);
  assert.match(admission,
    /new Set\(\[row\.canary_capability_intent_id, row\.bootstrap_capability_intent_id,/);
  assert.match(admission, /readPhysioSentryDeployCapability\(sentryPacket\)/);
  assert.match(admission, /sentry-phase-packet', 'sentry-phase\.json/);
  assert.doesNotMatch(admission, /sentryReceipt\.capability_intent_id/,
    'deploy admission must not read capability fields absent from the exact Sentry final receipt');
  assert.doesNotMatch(admission, /sentryReceipt\.authority_reference/,
    'deploy admission must derive Sentry authority from the recursively validated phase packet');
}

test('publication and deploy preserve distinct canary and Sentry child-envelope lineage', () => {
  assertChildLineage(sources());
});

test('child-envelope collapse tampering is rejected by the focused contract', () => {
  const source = sources();
  for (const [label, field, replacement] of [
    ['canary versus publication', 'admit',
      source.admit.replace('process.env.CANARY_INTENT === process.env.INTENT', 'false')],
    ['canary versus bootstrap', 'admit',
      source.admit.replace('bootstrap.capability_intent_id === process.env.CANARY_INTENT', 'false')],
    ['canary proof join', 'admission',
      source.admission.replace('canaryProof.receipts.providerAdmission.capability_intent_id',
        'publication.canary_capability_intent_id')],
    ['nested Sentry phase identity', 'admission',
      source.admission.replace("'sentry-phase-packet', 'sentry-phase.json'", "'physio-sentry-release.json'")],
  ]) {
    assert.throws(() => assertChildLineage({ ...source, [field]: replacement }),
      undefined, `${label} tamper should fail`);
  }
});
