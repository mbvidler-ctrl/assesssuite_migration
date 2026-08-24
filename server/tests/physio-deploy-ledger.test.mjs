import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';
import {
  DEPLOY_LEDGER_BRANCH,
  appendDeployLedgerRecord,
  buildDeployLedgerPacket,
  buildDeployLedgerProvisioningReceipt,
  inventoryDeployLedger,
  materializeDeployLedgerPacket,
} from '../../scripts/physio-deploy-ledger.mjs';
import { enforceDeployLedgerBarrier } from '../../scripts/physio-deploy-ledger-barrier.mjs';

const repository = 'mbvidler-ctrl/assesssuite_migration';
const applicationSha = 'a'.repeat(40);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

class DeployLedgerFixture {
  constructor({ protectedBranch = true, deletion = true, nonFastForward = true,
    linearHistory = true,
    runtimeUpdatedAt = '2026-08-22T00:00:00.000Z', runtimeBypassActors } = {}) {
    this.protectedBranch = protectedBranch;
    this.deletion = deletion;
    this.nonFastForward = nonFastForward;
    this.linearHistory = linearHistory;
    this.counter = 20;
    this.patchMode = 'success';
    this.patchBodies = [];
    this.dispatchCalls = [];
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.ruleset = {
      id: 9107,
      name: DEPLOY_LEDGER_BRANCH,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: [`refs/heads/${DEPLOY_LEDGER_BRANCH}`], exclude: [] } },
      rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }, { type: 'required_linear_history' }],
      updated_at: '2026-08-22T00:00:00.000Z',
      bypass_actors: [],
    };
    this.runtimeRuleset = structuredClone(this.ruleset);
    this.runtimeRuleset.updated_at = runtimeUpdatedAt;
    if (runtimeBypassActors === undefined) delete this.runtimeRuleset.bypass_actors;
    else this.runtimeRuleset.bypass_actors = runtimeBypassActors;
    const genesisBytes = Buffer.from(canonical({
      contract_version: 'assesssuite-physio-deploy-ledger-genesis/1.0.0', repository,
      ledger_branch: DEPLOY_LEDGER_BRANCH,
      purpose: 'protected append-only AssessSuite Physio deploy and Sentry effect ledger',
    }));
    const genesisBlob = gitBlobSha(genesisBytes);
    this.blobs.set(genesisBlob, genesisBytes);
    const treeSha = this.nextSha();
    const commitSha = this.nextSha();
    this.trees.set(treeSha, [{ path: 'deploy-ledger/genesis.json', mode: '100644', type: 'blob',
      sha: genesisBlob, size: genesisBytes.length }]);
    this.commits.set(commitSha, { sha: commitSha,
      message: 'Initialize protected AssessSuite Physio deploy ledger', tree: { sha: treeSha }, parents: [] });
    const receipt = buildDeployLedgerProvisioningReceipt({ repository, fullRuleset: this.ruleset,
      genesisReadback: {
        genesis_blob_path: 'deploy-ledger/genesis.json', genesis_blob_sha: genesisBlob,
        genesis_blob_sha256: sha256(genesisBytes),
        genesis_commit_message: 'Initialize protected AssessSuite Physio deploy ledger',
        genesis_commit_sha: commitSha, genesis_parent_count: 0,
        genesis_ref_readback_sha: commitSha, genesis_tree_sha: treeSha,
      },
      provisionedAt: '2026-08-22T00:00:01.000Z' });
    const provisioningBytes = Buffer.from(canonical(receipt));
    this.provisioningReceiptSha256 = sha256(provisioningBytes);
    const provisioningBlob = gitBlobSha(provisioningBytes);
    this.blobs.set(provisioningBlob, provisioningBytes);
    const provisioningTreeSha = this.nextSha();
    const provisioningCommitSha = this.nextSha();
    this.trees.set(provisioningTreeSha, [
      { path: 'deploy-ledger/genesis.json', mode: '100644', type: 'blob', sha: genesisBlob,
        size: genesisBytes.length },
      { path: 'deploy-ledger/provisioning.json', mode: '100644', type: 'blob', sha: provisioningBlob,
        size: provisioningBytes.length },
    ]);
    this.commits.set(provisioningCommitSha, { sha: provisioningCommitSha,
      message: 'Bind external L5 deploy ledger provisioning receipt', tree: { sha: provisioningTreeSha },
      parents: [{ sha: commitSha }] });
    this.headSha = provisioningCommitSha;
  }

  nextSha() {
    return (this.counter++).toString(16).padStart(40, '0');
  }

  status(status, detail) {
    const error = new Error(`DEPLOY_LEDGER_API_STATUS_${status}: ${detail}`);
    error.status = status;
    return error;
  }

  async request(method, endpoint, body) {
    if (method === 'GET' && endpoint === `/branches/${DEPLOY_LEDGER_BRANCH}`) {
      return { value: { name: DEPLOY_LEDGER_BRANCH, protected: this.protectedBranch,
        protection: { enabled: this.protectedBranch }, commit: { sha: this.headSha } } };
    }
    if (method === 'GET' && endpoint === `/rules/branches/${DEPLOY_LEDGER_BRANCH}`) {
      return { value: [
        ...(this.deletion ? [{ type: 'deletion' }] : []),
        ...(this.nonFastForward ? [{ type: 'non_fast_forward' }] : []),
        ...(this.linearHistory ? [{ type: 'required_linear_history' }] : []),
      ] };
    }
    if (method === 'GET' && endpoint === `/rulesets/${this.ruleset.id}`) {
      return { value: structuredClone(this.runtimeRuleset), headers: {} };
    }
    if (method === 'GET' && endpoint === `/git/ref/heads/${DEPLOY_LEDGER_BRANCH}`) {
      return { value: { ref: `refs/heads/${DEPLOY_LEDGER_BRANCH}`,
        object: { type: 'commit', sha: this.headSha } } };
    }
    const history = endpoint.match(/^\/commits\?sha=assesssuite-physio-deploy-ledger&per_page=100&page=(\d+)$/u);
    if (method === 'GET' && history) {
      const rows = [];
      let cursor = this.headSha;
      while (cursor) {
        const commit = this.commits.get(cursor);
        rows.push({ sha: commit.sha, parents: structuredClone(commit.parents) });
        cursor = commit.parents[0]?.sha;
      }
      const page = Number(history[1]);
      return { value: rows.slice((page - 1) * 100, page * 100) };
    }
    const commitMatch = endpoint.match(/^\/git\/commits\/([0-9a-f]{40})$/u);
    if (method === 'GET' && commitMatch) {
      const value = this.commits.get(commitMatch[1]);
      if (!value) throw this.status(404, endpoint);
      return { value: structuredClone(value) };
    }
    const treeMatch = endpoint.match(/^\/git\/trees\/([0-9a-f]{40})\?recursive=1$/u);
    if (method === 'GET' && treeMatch) {
      const value = this.trees.get(treeMatch[1]);
      if (!value) throw this.status(404, endpoint);
      return { value: { sha: treeMatch[1], truncated: false, tree: structuredClone(value) } };
    }
    const blobMatch = endpoint.match(/^\/git\/blobs\/([0-9a-f]{40})$/u);
    if (method === 'GET' && blobMatch) {
      const bytes = this.blobs.get(blobMatch[1]);
      if (!bytes) throw this.status(404, endpoint);
      return { value: { sha: blobMatch[1], encoding: 'base64', size: bytes.length,
        content: bytes.toString('base64') } };
    }
    if (method === 'POST' && endpoint === '/git/blobs') {
      const bytes = Buffer.from(body.content, 'base64');
      const sha = gitBlobSha(bytes);
      this.blobs.set(sha, bytes);
      return { value: { sha } };
    }
    if (method === 'POST' && endpoint === '/actions/workflows/physio-deploy-ledger-archive.yml/dispatches') {
      this.dispatchCalls.push(structuredClone(body));
      return { status: 204, value: null };
    }
    if (method === 'POST' && endpoint === '/git/trees') {
      const entries = structuredClone(this.trees.get(body.base_tree));
      for (const addition of body.tree) {
        if (entries.some((entry) => entry.path === addition.path)) throw this.status(422, endpoint);
        entries.push({ ...addition, size: this.blobs.get(addition.sha).length });
      }
      const sha = this.nextSha();
      this.trees.set(sha, entries);
      return { value: { sha } };
    }
    if (method === 'POST' && endpoint === '/git/commits') {
      const sha = this.nextSha();
      this.commits.set(sha, { sha, message: body.message, tree: { sha: body.tree },
        parents: body.parents.map((parent) => ({ sha: parent })) });
      return { value: { sha } };
    }
    if (method === 'PATCH' && endpoint === `/git/refs/heads/${DEPLOY_LEDGER_BRANCH}`) {
      this.patchBodies.push(structuredClone(body));
      assert.equal(body.force, false);
      const commit = this.commits.get(body.sha);
      if (!commit || commit.parents[0]?.sha !== this.headSha) throw this.status(422, endpoint);
      this.headSha = body.sha;
      if (this.patchMode === 'response-loss') {
        this.patchMode = 'success';
        throw this.status(599, 'response loss');
      }
      return { value: { ref: `refs/heads/${DEPLOY_LEDGER_BRANCH}`, object: { sha: body.sha } } };
    }
    throw new Error(`unhandled fixture request ${method} ${endpoint}`);
  }
}

function writePacketDirectory({ application = applicationSha, ordinal = 0, phase = 'STARTED',
  result = 'STARTED', priorDirectory = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-deploy-ledger-packet-'));
  const phaseRoot = path.join(root, 'phase');
  fs.mkdirSync(phaseRoot);
  if (priorDirectory) {
    for (const name of fs.readdirSync(path.join(priorDirectory, 'phase'))) {
      if (!['SHA256SUMS', 'deploy-effect-reconciliation.json', 'deploy-provider-readback.json'].includes(name)) {
        fs.copyFileSync(path.join(priorDirectory, 'phase', name), path.join(phaseRoot, name));
      }
    }
  }
  const effect = Buffer.from(canonical({
    contract_version: 'assesssuite-physio-deploy-effect-reconciliation/2.0.0',
    application: 'assesssuite-physio-production', application_sha: application,
    phase, result, packet_ordinal: ordinal, phase_ordinal: ordinal, phase_revision: 0,
  }));
  const readback = Buffer.from(canonical({
    contract_version: 'assesssuite-physio-deploy-provider-readback/1.0.0',
    application: 'assesssuite-physio-production', phase,
    result: result === 'STARTED_UNRESOLVED' ? 'STARTED_UNRESOLVED' : result === 'COMPLETED' ? 'PASS' : 'NOT_OBSERVED',
  }));
  fs.writeFileSync(path.join(phaseRoot, 'deploy-effect-reconciliation.json'), effect);
  fs.writeFileSync(path.join(phaseRoot, 'deploy-provider-readback.json'), readback);
  if (!priorDirectory) fs.writeFileSync(path.join(phaseRoot, 'deploy-admission.json'), '{}\n');
  if (ordinal > 0) fs.writeFileSync(path.join(phaseRoot,
    `deploy-phase-${String(ordinal).padStart(4, '0')}-${phase}-r00.json`), effect);
  const files = fs.readdirSync(phaseRoot).sort();
  const sums = files.map((name) => `${sha256(fs.readFileSync(path.join(phaseRoot, name)))}  ${name}`).join('\n');
  fs.writeFileSync(path.join(phaseRoot, 'SHA256SUMS'), `${sums}\n`);
  return root;
}

function rewritePhaseSums(root) {
  const phase = path.join(root, 'phase');
  const files = fs.readdirSync(phase).filter((name) => name !== 'SHA256SUMS').sort();
  fs.writeFileSync(path.join(phase, 'SHA256SUMS'),
    `${files.map((name) => `${sha256(fs.readFileSync(path.join(phase, name)))}  ${name}`).join('\n')}\n`);
}

function artifact({ id, ordinal, sha = applicationSha, run = 7000 }) {
  return {
    id,
    name: `physio-deploy-phase-${sha}-${String(ordinal).padStart(3, '0')}-ledger-${run}-1`,
    digest: `sha256:${(id % 16).toString(16).repeat(64)}`,
    run_id: run,
    run_attempt: 1,
    workflow_path: '.github/workflows/physio-production-deploy.yml',
    workflow_conclusion: 'failure',
  };
}

async function appendPacket(fixture, directory, { id, ordinal, sha = applicationSha, responseLoss = false }) {
  const inventory = await inventoryDeployLedger({ client: fixture, repository, applicationSha: sha });
  if (responseLoss) fixture.patchMode = 'response-loss';
  return appendDeployLedgerRecord({
    client: fixture, repository, applicationSha: sha, expectedHeadSha: inventory.ledger_head_sha,
    expectedProvisioningReceiptSha256: fixture.provisioningReceiptSha256,
    now: () => new Date(`2026-08-22T00:00:${String(id).padStart(2, '0')}.000Z`),
    request: {
      repository, ledger_branch: DEPLOY_LEDGER_BRANCH, application_sha: sha,
      ledger_provisioning_receipt_sha256: fixture.provisioningReceiptSha256,
      artifact: artifact({ id, ordinal, sha }), resume_packet: buildDeployLedgerPacket(directory),
    },
  });
}

test('deploy ledger packet is recursive, checksum-exact, secret rejecting, and safely materialized', () => {
  const directory = writePacketDirectory();
  const bundle = buildDeployLedgerPacket(directory, ['not-present-secret']);
  const output = `${directory}-materialized`;
  materializeDeployLedgerPacket(bundle, output);
  assert.deepEqual(fs.readFileSync(path.join(output, 'phase', 'deploy-effect-reconciliation.json')),
    fs.readFileSync(path.join(directory, 'phase', 'deploy-effect-reconciliation.json')));
  fs.writeFileSync(path.join(directory, 'phase', 'secret.txt'), 'exact-secret');
  const phase = path.join(directory, 'phase');
  const files = fs.readdirSync(phase).filter((name) => name !== 'SHA256SUMS').sort();
  fs.writeFileSync(path.join(phase, 'SHA256SUMS'),
    `${files.map((name) => `${sha256(fs.readFileSync(path.join(phase, name)))}  ${name}`).join('\n')}\n`);
  assert.throws(() => buildDeployLedgerPacket(directory, ['exact-secret']), /SECRET_REJECTED/);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.rmSync(output, { recursive: true, force: true });
});

test('credential-free deploy ledger rejects encoded, split, binary, archive and portable-path attacks', () => {
  const fixtureValue = ['credential', 'fixture', 'value', '0123456789'].join('-');
  const directory = writePacketDirectory();
  const phase = path.join(directory, 'phase');
  const admission = path.join(phase, 'deploy-admission.json');
  const cases = [
    Buffer.from(`${JSON.stringify({ encoded: Buffer.from(fixtureValue).toString('base64') })}\n`),
    Buffer.from(`${JSON.stringify({ encoded: encodeURIComponent(fixtureValue) })}\n`),
    Buffer.from(`${JSON.stringify({ parts: [fixtureValue.slice(0, 16), fixtureValue.slice(16)] })}\n`),
  ];
  for (const bytes of cases) {
    fs.writeFileSync(admission, bytes);
    rewritePhaseSums(directory);
    assert.throws(() => buildDeployLedgerPacket(directory, [fixtureValue]), /SECRET_REJECTED/);
  }

  fs.writeFileSync(admission, '{}\n');
  fs.writeFileSync(path.join(phase, 'fragment-a.txt'), fixtureValue.slice(0, 16));
  fs.writeFileSync(path.join(phase, 'fragment-b.txt'), fixtureValue.slice(16));
  rewritePhaseSums(directory);
  assert.throws(() => buildDeployLedgerPacket(directory, [fixtureValue]), /SECRET_REJECTED/);
  fs.rmSync(path.join(phase, 'fragment-a.txt'));
  fs.rmSync(path.join(phase, 'fragment-b.txt'));

  fs.writeFileSync(path.join(phase, 'binary.json'), Buffer.from([0, 255, 0, 254]));
  rewritePhaseSums(directory);
  assert.throws(() => buildDeployLedgerPacket(directory), /BINARY_REJECTED/);
  fs.rmSync(path.join(phase, 'binary.json'));
  fs.writeFileSync(path.join(phase, 'evidence.zip'), 'not-an-archive');
  rewritePhaseSums(directory);
  assert.throws(() => buildDeployLedgerPacket(directory), /FILE_TYPE_REJECTED/);

  const validDirectory = writePacketDirectory();
  const valid = buildDeployLedgerPacket(validDirectory);
  const alias = structuredClone(valid.files[0]);
  alias.path = alias.path.toUpperCase();
  valid.files.push(alias);
  valid.files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  valid.total_size_bytes += alias.size_bytes;
  assert.throws(() => materializeDeployLedgerPacket(valid, `${directory}-portable`), /PACKET_INVALID/);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.rmSync(validDirectory, { recursive: true, force: true });
});

test('ledger rejects absent immutable protection and runtime ruleset version drift', async () => {
  await assert.rejects(inventoryDeployLedger({ client: new DeployLedgerFixture({ protectedBranch: false }),
    repository, applicationSha }), /BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryDeployLedger({ client: new DeployLedgerFixture({ deletion: false }),
    repository, applicationSha }), /BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryDeployLedger({ client: new DeployLedgerFixture({ nonFastForward: false }),
    repository, applicationSha }), /BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryDeployLedger({ client: new DeployLedgerFixture({ linearHistory: false }),
    repository, applicationSha }), /BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryDeployLedger({ client: new DeployLedgerFixture({
    runtimeUpdatedAt: '2026-08-22T00:00:02.000Z' }), repository, applicationSha }), /PROVISIONING_DRIFT/);
});

test('L5 provisioning receipt rejects every bypass actor before protected provisioning append', () => {
  const fixture = new DeployLedgerFixture();
  assert.throws(() => buildDeployLedgerProvisioningReceipt({ repository,
    fullRuleset: { ...fixture.ruleset,
      bypass_actors: [{ actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' }] },
    genesisReadback: {}, provisionedAt: '2026-08-22T00:00:01.000Z' }), /RULESET_BYPASS_INVALID/);
});

test('L5 provisioning requires the exact linear no-bypass ruleset before genesis evidence', () => {
  const fixture = new DeployLedgerFixture();
  const genesisReadback = {
    genesis_blob_path: 'deploy-ledger/genesis.json', genesis_blob_sha: '1'.repeat(40),
    genesis_blob_sha256: '2'.repeat(64),
    genesis_commit_message: 'Initialize protected AssessSuite Physio deploy ledger',
    genesis_commit_sha: '3'.repeat(40), genesis_parent_count: 0,
    genesis_ref_readback_sha: '3'.repeat(40), genesis_tree_sha: '4'.repeat(40),
  };
  for (const invalidRuleset of [
    { ...fixture.ruleset, rules: fixture.ruleset.rules.filter((row) => row.type !== 'required_linear_history') },
    { ...fixture.ruleset, rules: [...fixture.ruleset.rules, { type: 'pull_request' }] },
    { ...fixture.ruleset, rules: fixture.ruleset.rules.map((row) => row.type === 'deletion'
      ? { type: row.type, parameters: {} } : row) },
  ]) {
    assert.throws(() => buildDeployLedgerProvisioningReceipt({ repository,
      fullRuleset: invalidRuleset, genesisReadback, provisionedAt: '2026-08-22T00:00:01.000Z' }),
    /RULESET_INVALID/);
  }
  assert.throws(() => buildDeployLedgerProvisioningReceipt({ repository,
    fullRuleset: fixture.ruleset, genesisReadback, provisionedAt: '2026-08-21T23:59:59.000Z' }),
  /predates exact ruleset version/);
});

test('append is optimistic, non-force, exact-readback, and reconciles lost ref-update response', async () => {
  const fixture = new DeployLedgerFixture();
  const directory = writePacketDirectory();
  const result = await appendPacket(fixture, directory, { id: 1, ordinal: 0, responseLoss: true });
  assert.equal(result.update_response_lost_or_rejected, true);
  assert.equal(fixture.patchBodies[0].force, false);
  const inventory = await inventoryDeployLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.record_count, 1);
  assert.equal(inventory.latest_record_sha256, result.ledger_record_sha256);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('provider-side barrier dispatches only the credential-free writer and waits for exact protected tip', async () => {
  const fixture = new DeployLedgerFixture();
  const directory = writePacketDirectory();
  let appended = false;
  const result = await enforceDeployLedgerBarrier({
    repository, applicationSha, artifactId: 1, artifactDigest: artifact({ id: 1, ordinal: 0 }).digest,
    sourceRunId: 7000, sourceRunAttempt: 1, packetDirectory: path.join(directory, 'phase'),
    provisioningReceiptSha256: fixture.provisioningReceiptSha256, client: fixture, maximumPolls: 2,
    sleep: async () => {
      if (!appended) {
        appended = true;
        await appendPacket(fixture, directory, { id: 1, ordinal: 0 });
      }
    },
    now: () => new Date('2026-08-22T00:00:03.000Z'),
  });
  assert.equal(result.result, 'PASS');
  assert.equal(result.dispatch_confirmed, true);
  assert.equal(fixture.dispatchCalls.length, 1);
  assert.equal(fixture.dispatchCalls[0].inputs.source_artifact_id, '1');
  assert.equal(result.ledger_head_sha, result.ledger_commit_sha);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('latest lineage advances one packet, admits newer exact transport refresh, and rejects old/stale artifacts', async () => {
  const fixture = new DeployLedgerFixture();
  const first = writePacketDirectory();
  await appendPacket(fixture, first, { id: 1, ordinal: 0 });
  const second = writePacketDirectory({ ordinal: 1, phase: 'SNAPSHOT_COMPLETED', result: 'COMPLETED',
    priorDirectory: first });
  await appendPacket(fixture, second, { id: 2, ordinal: 1 });
  await appendPacket(fixture, second, { id: 3, ordinal: 1 });
  await assert.rejects(appendPacket(fixture, first, { id: 4, ordinal: 0 }), /NON_MAXIMAL_LINEAGE/);
  const changed = writePacketDirectory({ ordinal: 1, phase: 'SNAPSHOT_COMPLETED', result: 'STARTED_UNRESOLVED',
    priorDirectory: first });
  await assert.rejects(appendPacket(fixture, changed, { id: 5, ordinal: 1 }), /TRANSPORT_REFRESH_INVALID/);
  const inventory = await inventoryDeployLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.record_count, 3);
  assert.equal(inventory.latest_record.artifact.id, 3);
  fs.rmSync(first, { recursive: true, force: true });
  fs.rmSync(second, { recursive: true, force: true });
  fs.rmSync(changed, { recursive: true, force: true });
});

test('one fixed protected branch audits global linear history for multiple application SHAs', async () => {
  const fixture = new DeployLedgerFixture();
  const first = writePacketDirectory();
  await appendPacket(fixture, first, { id: 1, ordinal: 0 });
  const otherSha = 'b'.repeat(40);
  const other = writePacketDirectory({ application: otherSha });
  await appendPacket(fixture, other, { id: 2, ordinal: 0, sha: otherSha });
  const a = await inventoryDeployLedger({ client: fixture, repository, applicationSha });
  const b = await inventoryDeployLedger({ client: fixture, repository, applicationSha: otherSha });
  assert.equal(a.record_count, 1);
  assert.equal(b.record_count, 1);
  assert.equal(a.ledger_head_sha, b.ledger_head_sha);
  assert.equal(a.audited_commit_count, 4);
  fs.rmSync(first, { recursive: true, force: true });
  fs.rmSync(other, { recursive: true, force: true });
});

test('global history rejects delete, replacement, unrelated additions, and merge commits', async () => {
  async function seeded() {
    const fixture = new DeployLedgerFixture();
    const directory = writePacketDirectory();
    await appendPacket(fixture, directory, { id: 1, ordinal: 0 });
    fs.rmSync(directory, { recursive: true, force: true });
    return fixture;
  }
  for (const kind of ['delete', 'replace', 'unrelated', 'merge']) {
    const fixture = await seeded();
    const parent = fixture.headSha;
    const parentCommit = fixture.commits.get(parent);
    const tree = structuredClone(fixture.trees.get(parentCommit.tree.sha));
    if (kind === 'delete') tree.pop();
    if (kind === 'replace') tree.find((entry) => entry.path.includes('/records/')).sha = 'f'.repeat(40);
    if (kind === 'unrelated') tree.push({ path: 'unrelated.txt', mode: '100644', type: 'blob',
      sha: 'e'.repeat(40), size: 1 });
    const treeSha = fixture.nextSha();
    fixture.trees.set(treeSha, tree);
    const commitSha = fixture.nextSha();
    fixture.commits.set(commitSha, { sha: commitSha, message: `${kind} attack`, tree: { sha: treeSha },
      parents: kind === 'merge' ? [{ sha: parent }, { sha: fixture.nextSha() }] : [{ sha: parent }] });
    fixture.headSha = commitSha;
    await assert.rejects(inventoryDeployLedger({ client: fixture, repository, applicationSha }),
      /DEPLOY_LEDGER_(?:HISTORY|BLOB|TREE|CHAIN|API_STATUS)/);
  }
});

test('deploy workflow gives repository write only to the provider-free ledger archive job', () => {
  const deployPath = path.resolve('.github/workflows/physio-production-deploy.yml');
  const archivePath = path.resolve('.github/workflows/physio-deploy-ledger-archive.yml');
  const actionPath = path.resolve('.github/actions/upload-deploy-ledger-packet/action.yml');
  const continuationPath = path.resolve('.github/workflows/physio-deploy-continuation.yml');
  const deploySource = fs.readFileSync(deployPath, 'utf8').replaceAll('\r\n', '\n');
  const archiveSource = fs.readFileSync(archivePath, 'utf8').replaceAll('\r\n', '\n');
  const actionSource = fs.readFileSync(actionPath, 'utf8').replaceAll('\r\n', '\n');
  const continuationSource = fs.readFileSync(continuationPath, 'utf8').replaceAll('\r\n', '\n');
  const deploy = yaml.load(deploySource);
  const archive = yaml.load(archiveSource);
  assert.deepEqual(deploy.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(deploy.jobs.deploy.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(deploy.jobs.sentry_deployment.permissions, { contents: 'read', actions: 'read' });
  for (const name of ['archive_deploy_transition', 'archive_sentry_transition']) {
    assert.deepEqual(deploy.jobs[name].permissions, { contents: 'write', actions: 'read' });
    assert.equal(deploy.jobs[name].environment, undefined);
    assert.match(deploy.jobs[name].uses, /physio-deploy-ledger-archive\.yml$/u);
  }
  for (const name of ['continue_fly_transition', 'continue_sentry_transition']) {
    assert.deepEqual(deploy.jobs[name].permissions, { contents: 'read', actions: 'write' });
    assert.equal(deploy.jobs[name].environment, undefined);
    assert.match(deploy.jobs[name].uses, /physio-deploy-continuation\.yml$/u);
  }
  assert.deepEqual(archive.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(archive.jobs.archive.permissions, { contents: 'write', actions: 'read' });
  assert.doesNotMatch(archiveSource, /secrets\.|environment:\s*physio-production/u);
  assert.doesNotMatch(actionSource, /physio-deploy-ledger-barrier\.mjs|workflow_dispatch|GITHUB_TOKEN/u);
  assert.match(actionSource, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/u);
  assert.doesNotMatch(continuationSource, /actions\/checkout|secrets\.|environment:\s*physio-production|id-token/u);
  assert.match(continuationSource, /actions:\s*write/u);
  assert.match(continuationSource, /actions\/workflows\/physio-production-deploy\.yml\/dispatches/u);
  assert.equal((deploySource.match(/uses: \.\/\.github\/actions\/upload-deploy-ledger-packet/gu) || []).length, 31);
  assert.equal((deploySource.match(/uses: actions\/upload-artifact@/gu) || []).length, 3);
});

test('manual old-artifact resume is removed and exact protected tip is admitted before credentials', () => {
  const source = fs.readFileSync(path.resolve('.github/workflows/physio-production-deploy.yml'), 'utf8')
    .replaceAll('\r\n', '\n');
  assert.doesNotMatch(source, /resume_deploy_effect_artifact_(?:id|digest)|resume_deploy_effect_receipt_sha256/u);
  assert.match(source, /Inventory and materialize the exact maximal protected deploy-ledger tip/u);
  assert.match(source, /Reject every retained deploy artifact newer than the exact protected tip/u);
  assert.match(source, /protected deploy ledger archive pending/u);
  assert.ok(source.indexOf('Inventory and materialize the exact maximal protected deploy-ledger tip') <
    source.indexOf('Admit exact prior deploy phase or deny unresolved fresh history'));
  assert.ok(source.indexOf('Reject every retained deploy artifact newer than the exact protected tip') <
    source.indexOf('Build exact deploy phase runtime from the trusted workflow'));
});
