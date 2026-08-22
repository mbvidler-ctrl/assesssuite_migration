import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  LEDGER_BRANCH,
  appendLedgerRecord,
  admitResumeAgainstLedger,
  buildPacketBundle,
  buildPacketScanProof,
  buildProvisioningContract,
  buildProvisioningReceipt,
  inventoryLedger,
  materializePacketBundle,
  main as ledgerMain,
  verifyProviderDigestMap,
} from '../../scripts/physio-bootstrap-ledger.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowPath = path.join(root, '.github', 'workflows', 'physio-production-bootstrap.yml');
const source = fs.readFileSync(workflowPath, 'utf8').replaceAll('\r\n', '\n');
const workflow = yaml.load(source);
const repository = 'mbvidler-ctrl/assesssuite_migration';
const applicationSha = 'a'.repeat(40);
const zeroSha256 = '0'.repeat(64);

function step(job, name) {
  const value = workflow.jobs[job].steps.find((candidate) => candidate.name === name);
  assert.ok(value, `${job} step ${name} is missing`);
  return value;
}

function indexOf(marker) {
  const value = source.indexOf(marker);
  assert.ok(value >= 0, `workflow marker is missing: ${marker}`);
  return value;
}

function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

class LedgerGitFixture {
  constructor({ branchPresent = true, protectedBranch = true, rulesReadable = true,
    deletionProtected = true, nonFastForwardProtected = true,
    runtimeRulesetReadable = true, runtimeRulesetUpdatedAt = '2026-08-22T00:00:00.000Z',
    runtimeBypassActors } = {}) {
    this.branchPresent = branchPresent;
    this.protectedBranch = protectedBranch;
    this.rulesReadable = rulesReadable;
    this.deletionProtected = deletionProtected;
    this.nonFastForwardProtected = nonFastForwardProtected;
    this.runtimeRulesetReadable = runtimeRulesetReadable;
    this.runtimeBypassActors = runtimeBypassActors;
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.counter = 16;
    this.patchMode = 'success';
    this.historyNeverTerminates = false;
    this.patchBodies = [];
    this.ruleset = {
      id: 8417,
      name: LEDGER_BRANCH,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: [`refs/heads/${LEDGER_BRANCH}`], exclude: [] } },
      rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
      updated_at: '2026-08-22T00:00:00.000Z',
      bypass_actors: [],
    };
    this.runtimeRuleset = { ...structuredClone(this.ruleset), updated_at: runtimeRulesetUpdatedAt };
    if (runtimeBypassActors !== undefined) this.runtimeRuleset.bypass_actors = runtimeBypassActors;
    else delete this.runtimeRuleset.bypass_actors;
    const genesisBytes = Buffer.from(`${JSON.stringify({
      contract_version: 'assesssuite-physio-bootstrap-ledger-genesis/1.0.0',
      repository,
      ledger_branch: LEDGER_BRANCH,
      purpose: 'protected append-only AssessSuite Physio bootstrap effect ledger',
    }, null, 2)}\n`);
    const genesisBlobSha = gitBlobSha(genesisBytes);
    this.blobs.set(genesisBlobSha, genesisBytes);
    const treeSha = this.nextSha();
    const genesisSha = this.nextSha();
    this.trees.set(treeSha, [{ path: 'bootstrap-ledger/genesis.json', mode: '100644', type: 'blob',
      sha: genesisBlobSha, size: genesisBytes.length }]);
    this.commits.set(genesisSha, { sha: genesisSha, message: 'Initialize protected AssessSuite Physio bootstrap ledger',
      tree: { sha: treeSha }, parents: [] });
    const provisioningReceipt = buildProvisioningReceipt({ repository, fullRuleset: this.ruleset,
      genesisReadback: {
        genesis_commit_sha: genesisSha,
        genesis_parent_count: 0,
        genesis_commit_message: 'Initialize protected AssessSuite Physio bootstrap ledger',
        genesis_tree_sha: treeSha,
        genesis_blob_path: 'bootstrap-ledger/genesis.json',
        genesis_blob_sha: genesisBlobSha,
        genesis_blob_sha256: createHash('sha256').update(genesisBytes).digest('hex'),
        genesis_ref_readback_sha: genesisSha,
      },
      provisionedAt: '2026-08-22T00:00:01.000Z' });
    const provisioningBytes = Buffer.from(`${JSON.stringify(provisioningReceipt, null, 2)}\n`);
    const provisioningBlobSha = gitBlobSha(provisioningBytes);
    const provisioningTreeSha = this.nextSha();
    const provisioningCommitSha = this.nextSha();
    this.blobs.set(provisioningBlobSha, provisioningBytes);
    this.trees.set(provisioningTreeSha, [
      ...structuredClone(this.trees.get(treeSha)),
      { path: 'bootstrap-ledger/provisioning.json', mode: '100644', type: 'blob',
        sha: provisioningBlobSha, size: provisioningBytes.length },
    ]);
    this.commits.set(provisioningCommitSha, { sha: provisioningCommitSha,
      message: 'Bind external L5 bootstrap ledger provisioning receipt',
      tree: { sha: provisioningTreeSha }, parents: [{ sha: genesisSha }] });
    this.headSha = provisioningCommitSha;
  }

  nextSha() {
    const value = this.counter.toString(16).padStart(40, '0');
    this.counter += 1;
    return value;
  }

  statusError(status, detail) {
    const error = new Error(`LEDGER_API_STATUS_${status}: ${detail}`);
    error.status = status;
    return error;
  }

  async request(method, endpoint, body) {
    if (method === 'GET' && endpoint === `/branches/${LEDGER_BRANCH}`) {
      if (!this.branchPresent) throw this.statusError(404, endpoint);
      return { value: { name: LEDGER_BRANCH, protected: this.protectedBranch,
        protection: { enabled: this.protectedBranch }, commit: { sha: this.headSha } } };
    }
    if (method === 'GET' && endpoint === `/rules/branches/${LEDGER_BRANCH}`) {
      if (!this.rulesReadable) throw this.statusError(403, endpoint);
      const value = [];
      if (this.deletionProtected) value.push({ type: 'deletion' });
      if (this.nonFastForwardProtected) value.push({ type: 'non_fast_forward' });
      return { value };
    }
    if (method === 'GET' && endpoint === `/rulesets/${this.ruleset.id}`) {
      if (!this.runtimeRulesetReadable) throw this.statusError(403, endpoint);
      return { value: structuredClone(this.runtimeRuleset) };
    }
    if (method === 'GET' && endpoint === `/git/ref/heads/${LEDGER_BRANCH}`) {
      return { value: { ref: `refs/heads/${LEDGER_BRANCH}`, object: { type: 'commit', sha: this.headSha } } };
    }
    const historyMatch = endpoint.match(/^\/commits\?sha=assesssuite-physio-bootstrap-ledger&per_page=100&page=(\d+)$/u);
    if (method === 'GET' && historyMatch) {
      if (this.historyNeverTerminates) {
        return { value: Array.from({ length: 100 }, (_, index) => ({
          sha: (index + 1).toString(16).padStart(40, '0'), parents: [], commit: { tree: { sha: 'f'.repeat(40) } },
        })) };
      }
      const rows = [];
      let cursor = this.headSha;
      while (cursor) {
        const commit = this.commits.get(cursor);
        rows.push({ sha: commit.sha, parents: structuredClone(commit.parents),
          commit: { message: commit.message, tree: structuredClone(commit.tree) } });
        cursor = commit.parents[0]?.sha;
      }
      const page = Number(historyMatch[1]);
      return { value: rows.slice((page - 1) * 100, page * 100) };
    }
    const commitMatch = endpoint.match(/^\/git\/commits\/([0-9a-f]{40})$/u);
    if (method === 'GET' && commitMatch) {
      const value = this.commits.get(commitMatch[1]);
      if (!value) throw this.statusError(404, endpoint);
      return { value };
    }
    const treeMatch = endpoint.match(/^\/git\/trees\/([0-9a-f]{40})\?recursive=1$/u);
    if (method === 'GET' && treeMatch) {
      const entries = this.trees.get(treeMatch[1]);
      if (!entries) throw this.statusError(404, endpoint);
      return { value: { sha: treeMatch[1], truncated: false, tree: structuredClone(entries) } };
    }
    const blobMatch = endpoint.match(/^\/git\/blobs\/([0-9a-f]{40})$/u);
    if (method === 'GET' && blobMatch) {
      const bytes = this.blobs.get(blobMatch[1]);
      if (!bytes) throw this.statusError(404, endpoint);
      return { value: { sha: blobMatch[1], encoding: 'base64', size: bytes.length,
        content: bytes.toString('base64') } };
    }
    if (method === 'POST' && endpoint === '/git/blobs') {
      const bytes = Buffer.from(body.content, 'base64');
      const sha = gitBlobSha(bytes);
      this.blobs.set(sha, bytes);
      return { value: { sha } };
    }
    if (method === 'POST' && endpoint === '/git/trees') {
      const base = this.trees.get(body.base_tree);
      if (!base) throw this.statusError(422, endpoint);
      const entries = structuredClone(base);
      for (const addition of body.tree) {
        if (entries.some(({ path: existing }) => existing === addition.path)) {
          throw this.statusError(422, 'immutable record path already exists');
        }
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
    if (method === 'PATCH' && endpoint === `/git/refs/heads/${LEDGER_BRANCH}`) {
      this.patchBodies.push(structuredClone(body));
      assert.equal(body.force, false, 'ledger update may never force the ref');
      const commit = this.commits.get(body.sha);
      if (!commit || commit.parents.length !== 1 || commit.parents[0].sha !== this.headSha) {
        throw this.statusError(422, 'non-fast-forward');
      }
      if (this.patchMode === 'non-fast-forward') {
        const adversarySha = this.nextSha();
        this.commits.set(adversarySha, { sha: adversarySha, message: 'concurrent append',
          tree: commit.tree, parents: [{ sha: this.headSha }] });
        this.headSha = adversarySha;
        throw this.statusError(422, 'non-fast-forward');
      }
      this.headSha = body.sha;
      if (this.patchMode === 'response-loss') {
        this.patchMode = 'success';
        throw this.statusError(599, 'simulated response loss');
      }
      return { value: { ref: `refs/heads/${LEDGER_BRANCH}`, object: { sha: body.sha } } };
    }
    throw new Error(`unhandled fixture request ${method} ${endpoint}`);
  }
}

function artifactFor({ generation, stage, id, targetApplicationSha = applicationSha }) {
  const type = stage === 'STARTED' ? 'bootstrap-started'
    : ['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(stage)
      ? 'bootstrap-provider-admission' : 'production-bootstrap';
  const packet = packetFor({ generation, stage });
  const hash = (name) => packet.files.find((file) => file.name === name)?.sha256;
  return {
    id,
    name: `physio-${type}-${targetApplicationSha}`,
    digest: `sha256:${((generation + id) % 16).toString(16).repeat(64)}`,
    effect_receipt_sha256: hash('bootstrap-effect-reconciliation.json'),
    packet_receipt_sha256: stage === 'STARTED' ? null : hash(stage === 'TERMINAL'
      ? 'physio-production-bootstrap.json' : 'bootstrap-provider-admission.json'),
    ...(['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(stage) ? {
      artifact_readback_sha256: hash('bootstrap-provider-admission-upload-readback.json'),
    } : {}),
  };
}

function packetFor({ generation, stage }) {
  const entries = [['bootstrap-effect-reconciliation.json', Buffer.from(`${JSON.stringify({ generation, stage })}\n`)]];
  if (['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(stage)) {
    entries.push(['bootstrap-provider-admission.json',
      Buffer.from(`${JSON.stringify({ generation, stage, result: 'PASS' })}\n`)]);
    entries.push(['bootstrap-provider-admission-upload-readback.json',
      Buffer.from(`${JSON.stringify({ generation, artifact_readback: true })}\n`)]);
  } else if (stage === 'TERMINAL') {
    entries.push(['physio-production-bootstrap.json',
      Buffer.from(`${JSON.stringify({ generation, result: 'PASS' })}\n`)]);
  }
  entries.sort(([left], [right]) => left.localeCompare(right));
  const sums = Buffer.from(entries.map(([name, bytes]) =>
    `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`).join(''));
  return {
    contract_version: 'assesssuite-physio-bootstrap-ledger-packet/1.0.0',
    total_size_bytes: sums.length + entries.reduce((total, [, bytes]) => total + bytes.length, 0),
    files: [
      { name: 'SHA256SUMS', size_bytes: sums.length,
        sha256: createHash('sha256').update(sums).digest('hex'), content_base64: sums.toString('base64') },
      ...entries.map(([name, bytes]) => ({ name, size_bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), content_base64: bytes.toString('base64') })),
    ],
  };
}

function packetScanFor(packet, secretEntries = []) {
  return buildPacketScanProof(packet, secretEntries);
}

async function appendStage(fixture, { generation, stage, id, effectResult, responseLoss = false,
  retryOrdinal, targetApplicationSha = applicationSha }) {
  const before = await inventoryLedger({ client: fixture, repository, applicationSha: targetApplicationSha });
  const packet = packetFor({ generation, stage });
  if (responseLoss) fixture.patchMode = 'response-loss';
  return appendLedgerRecord({
    client: fixture,
    repository,
    applicationSha: targetApplicationSha,
    expectedHeadSha: before.ledger_head_sha,
    now: () => new Date(Date.parse('2026-08-22T00:01:00.000Z') + id * 1000),
    request: {
      repository,
      ledger_branch: LEDGER_BRANCH,
      application_sha: targetApplicationSha,
      ledger_provisioning_receipt_sha256: before.ledger_provisioning_receipt_sha256,
      stage,
      ...(retryOrdinal === undefined ? {} : { retry_ordinal: retryOrdinal }),
      effect_generation: generation,
      effect_result: effectResult,
      artifact: artifactFor({ generation, stage, id, targetApplicationSha }),
      resume_packet: packet,
      packet_scan: packetScanFor(packet),
      workflow_run_id: 10_000 + id,
      workflow_run_attempt: 1,
    },
  });
}

function retainedArtifact({ id, name, digestCharacter, expired, runId = id + 100 }) {
  return {
    id,
    name,
    digest: `sha256:${digestCharacter.repeat(64)}`,
    size_in_bytes: 4096,
    expired,
    workflow_run: { id: runId, head_sha: applicationSha },
    created_at: `2026-08-22T00:00:${String(id).padStart(2, '0')}Z`,
    expires_at: '2026-09-21T00:00:00Z',
  };
}

function runRetainedHistory({ artifacts, resumeId = '0', resumeDigest = '0' }) {
  const run = step('start', 'Inventory retained bootstrap artifact transport after durable ledger').run;
  const match = run.match(/INVENTORY="\$inventory" node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/u);
  assert.ok(match, 'retained artifact inventory executable is missing');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-bootstrap-retained-history-'));
  const inventory = path.join(temp, 'inventory.json');
  const githubOutput = path.join(temp, 'github-output.txt');
  const runs = Object.fromEntries(artifacts.map((artifact) => [artifact.workflow_run.id, {
    id: artifact.workflow_run.id,
    head_sha: applicationSha,
    head_branch: 'main',
    path: '.github/workflows/physio-production-bootstrap.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    repository: { full_name: repository },
    head_repository: { full_name: repository },
  }]));
  const fetchStub = `
const fixtures = JSON.parse(process.env.TEST_GITHUB_FIXTURES);
globalThis.fetch = async (rawUrl) => {
  const url = new URL(rawUrl);
  let value;
  const artifactMatch = url.pathname.match(/\\/actions\\/artifacts\\/(\\d+)$/u);
  const runMatch = url.pathname.match(/\\/actions\\/runs\\/(\\d+)$/u);
  if (artifactMatch) value = fixtures.artifacts.find(({ id }) => id === Number(artifactMatch[1]));
  else if (runMatch) value = fixtures.runs[runMatch[1]];
  else if (url.pathname.endsWith('/actions/artifacts')) {
    const name = url.searchParams.get('name');
    const rows = fixtures.artifacts.filter((artifact) => artifact.name === name);
    value = { total_count: rows.length, artifacts: rows };
  }
  return { status: value ? 200 : 404, text: async () => JSON.stringify(value ?? { message: 'not found' }) };
};
`;
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: `${fetchStub}\n${match[1]}\n`,
    encoding: 'utf8',
    env: { ...process.env, TEST_GITHUB_FIXTURES: JSON.stringify({ artifacts, runs }), INVENTORY: inventory,
      REPOSITORY: repository, APPLICATION_SHA: applicationSha, RESUME_ID: resumeId,
      RESUME_DIGEST: resumeDigest, GITHUB_OUTPUT: githubOutput,
      GITHUB_TOKEN: 'test-only-content-free-token' },
  });
  const receipt = fs.existsSync(inventory) ? JSON.parse(fs.readFileSync(inventory, 'utf8')) : null;
  fs.rmSync(temp, { recursive: true, force: true });
  return { ...result, receipt };
}

test('protected ledger is credential-free generation authority before retained-artifact history', () => {
  assert.deepEqual(Object.keys(workflow.jobs),
    ['admit', 'start', 'ledger_started', 'provider', 'ledger_provider', 'bootstrap', 'ledger_terminal']);
  assert.equal(workflow.jobs.start.needs, 'admit');
  assert.equal(workflow.jobs.ledger_started.needs, 'start');
  assert.deepEqual(workflow.jobs.provider.needs, ['admit', 'start', 'ledger_started']);
  assert.deepEqual(workflow.jobs.ledger_provider.needs, ['start', 'ledger_started', 'provider']);
  assert.deepEqual(workflow.jobs.bootstrap.needs, ['admit', 'start', 'provider', 'ledger_provider']);
  assert.deepEqual(workflow.jobs.ledger_terminal.needs, ['start', 'provider', 'ledger_provider', 'bootstrap']);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.permissions.actions, 'read');
  assert.deepEqual(Object.entries(workflow.jobs).filter(([, job]) => job.permissions?.contents === 'write')
    .map(([name]) => name), ['ledger_started', 'ledger_provider', 'ledger_terminal']);
  for (const jobName of ['ledger_started', 'ledger_provider', 'ledger_terminal']) {
    assert.deepEqual(workflow.jobs[jobName].permissions, { contents: 'write', actions: 'read' });
    const jobSource = JSON.stringify(workflow.jobs[jobName]);
    assert.equal(workflow.jobs[jobName].environment, undefined);
    assert.doesNotMatch(jobSource, /secrets\./);
    assert.doesNotMatch(jobSource,
      /\bfly (?:apps|volumes|secrets|certs|machines|deploy|machine)\b|api\.fly\.io|sentry\.io\/api|api\.stripe\.com/iu);
    assert.match(jobSource, /expected-packet-bundle-sha256/);
  }
  for (const jobName of ['admit', 'start', 'provider', 'bootstrap']) {
    assert.equal(workflow.jobs[jobName].permissions, undefined);
    assert.notEqual(workflow.jobs[jobName].permissions?.actions, 'write');
    assert.notEqual(workflow.jobs[jobName].permissions?.contents, 'write');
  }
  const ledger = step('start', 'Inventory protected append-only bootstrap ledger before retained artifacts');
  const retained = step('start', 'Inventory retained bootstrap artifact transport after durable ledger');
  const secretFingerprint = step('start', 'Build content-free secret fingerprint and persist STARTED');
  assert.match(ledger.run, /physio-bootstrap-ledger\.mjs inventory/);
  assert.equal(workflow.on.workflow_dispatch.inputs.ledger_provisioning_receipt_sha256.required, true);
  assert.match(ledger.run, /--provisioning-receipt-sha256 "\$LEDGER_PROVISIONING_RECEIPT_SHA256"/);
  assert.match(ledger.run, /git rev-parse HEAD/);
  assert.match(ledger.run, /\[\[ -z "\$\{FLY_API_TOKEN:-\}" \]\]/);
  assert.ok(indexOf(ledger.name) < indexOf(retained.name));
  assert.ok(indexOf(retained.name) < indexOf(secretFingerprint.name));
  assert.match(source, /assesssuite-physio-bootstrap-ledger/);
  assert.match(source, /bootstrap-retained-artifact-history-inventory\.json/);
  assert.match(source, /Scan exact STARTED packet against every provider secret value/);
  assert.match(source, /Scan exact terminal packet against every provider secret value/);
  assert.doesNotMatch(source, /contract_version: 'assesssuite-physio-bootstrap-history-inventory/);
});

test('branch ledger fails closed when absent, unreadable, unprotected, or force/deletion-capable', async () => {
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({ branchPresent: false }), repository, applicationSha }),
    /LEDGER_BRANCH_ABSENT/);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({ protectedBranch: false }), repository, applicationSha }),
    /LEDGER_BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({ rulesReadable: false }), repository, applicationSha }),
    /LEDGER_PROTECTION_UNREADABLE/);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({ deletionProtected: false }), repository, applicationSha }),
    /LEDGER_BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({ nonFastForwardProtected: false }), repository, applicationSha }),
    /LEDGER_BRANCH_UNPROTECTED/);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({ runtimeRulesetReadable: false }), repository, applicationSha }),
    /LEDGER_RULESET_UNREADABLE/);
  const genesisOnly = new LedgerGitFixture();
  genesisOnly.headSha = [...genesisOnly.commits.values()].find((commit) => commit.parents.length === 0).sha;
  await assert.rejects(inventoryLedger({ client: genesisOnly, repository, applicationSha }),
    /LEDGER_HISTORY_INVALID/);
});

test('external L5 no-bypass receipt is joined to exact live ruleset identity and version', async () => {
  const contract = buildProvisioningContract(repository);
  assert.equal(contract.production_workflow_may_create_branch, false);
  assert.equal(contract.production_workflow_may_create_or_modify_protection, false);
  assert.deepEqual(contract.provisioning_order.slice(0, 3), [
    'CREATE_RULESET_TARGETING_EXACT_NONEXISTENT_REF',
    'VERIFY_EXACT_REF_RULESET_ACTIVE_WITH_DELETION_AND_NON_FAST_FORWARD_RULES',
    'CREATE_CANONICAL_ZERO_PARENT_GENESIS_COMMIT_AND_EXACT_REF',
  ]);
  assert.equal(contract.mandatory_external_receipt_sha256_input, 'ledger_provisioning_receipt_sha256');
  const exact = await inventoryLedger({ client: new LedgerGitFixture(), repository, applicationSha });
  assert.equal(exact.ledger_provisioning_receipt.bypass_actors.length, 0);
  assert.equal(exact.ledger_provisioning_receipt.visible_ruleset.name, LEDGER_BRANCH);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({
    runtimeRulesetUpdatedAt: '2026-08-22T00:00:02.000Z',
  }), repository, applicationSha }), /LEDGER_RULESET_DRIFT/);
  await assert.rejects(inventoryLedger({ client: new LedgerGitFixture({
    runtimeBypassActors: [{ actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' }],
  }), repository, applicationSha }), /LEDGER_RULESET_BYPASS_DRIFT/);
  const receipt = exact.ledger_provisioning_receipt;
  assert.throws(() => buildProvisioningReceipt({ repository, fullRuleset: new LedgerGitFixture().ruleset,
    genesisReadback: {
      genesis_blob_path: receipt.genesis_blob_path,
      genesis_blob_sha: receipt.genesis_blob_sha,
      genesis_blob_sha256: receipt.genesis_blob_sha256,
      genesis_commit_message: receipt.genesis_commit_message,
      genesis_commit_sha: receipt.genesis_commit_sha,
      genesis_parent_count: receipt.genesis_parent_count,
      genesis_ref_readback_sha: receipt.genesis_ref_readback_sha,
      genesis_tree_sha: receipt.genesis_tree_sha,
    },
    provisionedAt: '2026-08-21T23:59:59.000Z',
  }), /LEDGER_PROVISIONING_ORDER_INVALID/);
  assert.throws(() => buildProvisioningReceipt({ repository, fullRuleset: {
    ...new LedgerGitFixture().ruleset,
    bypass_actors: [{ actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' }],
  }, provisionedAt: '2026-08-22T00:00:01.000Z' }), /LEDGER_RULESET_BYPASS_INVALID/);
});

test('ledger append is immutable, optimistic, non-force, exactly read back, and response-loss safe', async () => {
  const fixture = new LedgerGitFixture();
  const started = await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1,
    effectResult: 'STARTED', responseLoss: true });
  assert.equal(started.update_response_lost_or_rejected, true);
  assert.equal(started.record.stage, 'STARTED');
  assert.equal(fixture.patchBodies[0].force, false);
  const inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.record_count, 1);
  assert.equal(inventory.latest_record_sha256, started.ledger_record_sha256);
  assert.equal(inventory.latest_record.predecessor_commit_sha, started.predecessor_commit_sha);
  assert.equal(inventory.ledger_head_sha, started.ledger_commit_sha);
});

test('ledger rejects pre-provision and regressing record clocks before creating an invalid commit', async () => {
  const fixture = new LedgerGitFixture();
  const before = await inventoryLedger({ client: fixture, repository, applicationSha });
  const startedPacket = packetFor({ generation: 0, stage: 'STARTED' });
  const request = {
    repository, ledger_branch: LEDGER_BRANCH, application_sha: applicationSha,
    ledger_provisioning_receipt_sha256: before.ledger_provisioning_receipt_sha256,
    stage: 'STARTED', effect_generation: 0, effect_result: 'STARTED',
    artifact: artifactFor({ generation: 0, stage: 'STARTED', id: 1 }),
    resume_packet: startedPacket,
    packet_scan: packetScanFor(startedPacket),
    workflow_run_id: 30001, workflow_run_attempt: 1,
  };
  const originalHead = fixture.headSha;
  await assert.rejects(appendLedgerRecord({ client: fixture, repository, applicationSha,
    expectedHeadSha: originalHead, request, now: () => new Date('2026-08-21T23:59:59.000Z') }),
  /LEDGER_RECORD_PREPROVISIONED/);
  assert.equal(fixture.headSha, originalHead);
  await appendLedgerRecord({ client: fixture, repository, applicationSha,
    expectedHeadSha: originalHead, request, now: () => new Date('2026-08-22T00:05:00.000Z') });
  const startedHead = fixture.headSha;
  const inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  const providerPacket = packetFor({ generation: 0, stage: 'PROVIDER_ADMISSION' });
  const providerRequest = {
    ...request,
    ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
    stage: 'PROVIDER_ADMISSION',
    artifact: artifactFor({ generation: 0, stage: 'PROVIDER_ADMISSION', id: 2 }),
    resume_packet: providerPacket,
    packet_scan: packetScanFor(providerPacket),
    workflow_run_id: 30002,
  };
  await assert.rejects(appendLedgerRecord({ client: fixture, repository, applicationSha,
    expectedHeadSha: startedHead, request: providerRequest,
    now: () => new Date('2026-08-22T00:04:59.000Z') }), /LEDGER_RECORD_TIME_REGRESSION/);
  assert.equal(fixture.headSha, startedHead);
});

test('ledger append cryptographically joins stage semantics to exact named packet receipts', async () => {
  async function rejectModified(stage, modify, pattern) {
    const fixture = new LedgerGitFixture();
    if (stage !== 'STARTED') {
      await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
    }
    const before = await inventoryLedger({ client: fixture, repository, applicationSha });
    const packet = packetFor({ generation: 0, stage });
    const request = {
      repository, ledger_branch: LEDGER_BRANCH, application_sha: applicationSha,
      ledger_provisioning_receipt_sha256: before.ledger_provisioning_receipt_sha256,
      stage, ...(stage === 'PROVIDER_RECONCILIATION' ? { retry_ordinal: 1 } : {}),
      effect_generation: 0,
      effect_result: stage === 'TERMINAL' ? 'COMPLETED' : stage === 'PROVIDER_RECONCILIATION'
        ? 'RECOVERY_RETRY_ADMITTED' : 'STARTED',
      artifact: artifactFor({ generation: 0, stage, id: 9 }),
      resume_packet: packet,
      packet_scan: packetScanFor(packet),
      workflow_run_id: 20009,
      workflow_run_attempt: 1,
    };
    modify(request);
    await assert.rejects(appendLedgerRecord({ client: fixture, repository, applicationSha,
      expectedHeadSha: before.ledger_head_sha, request }), pattern);
  }

  await rejectModified('PROVIDER_ADMISSION', (request) => {
    request.artifact.effect_receipt_sha256 = request.artifact.packet_receipt_sha256;
  }, /LEDGER_EFFECT_RECEIPT_JOIN_INVALID/);
  await rejectModified('STARTED', (request) => {
    request.artifact = artifactFor({ generation: 0, stage: 'PROVIDER_ADMISSION', id: 9 });
  }, /LEDGER_ARTIFACT_STAGE_MISMATCH/);
  await rejectModified('STARTED', (request) => {
    request.effect_result = 'COMPLETED';
  }, /LEDGER_EFFECT_RESULT_INVALID/);
  await rejectModified('STARTED', (request) => {
    request.resume_packet.files.push(structuredClone(request.resume_packet.files.at(-1)));
    request.resume_packet.files.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    request.resume_packet.total_size_bytes = request.resume_packet.files.reduce(
      (total, file) => total + file.size_bytes, 0);
  }, /LEDGER_PACKET_INVALID/);
  await rejectModified('STARTED', (request) => {
    const effect = request.resume_packet.files.find(({ name }) => name === 'bootstrap-effect-reconciliation.json');
    effect.name = 'Bootstrap-effect-reconciliation.json';
    const sums = request.resume_packet.files.find(({ name }) => name === 'SHA256SUMS');
    const bytes = Buffer.from(sums.content_base64, 'base64');
    const renamed = Buffer.from(bytes.toString('utf8').replace(
      'bootstrap-effect-reconciliation.json', 'Bootstrap-effect-reconciliation.json'));
    sums.content_base64 = renamed.toString('base64');
    sums.size_bytes = renamed.length;
    sums.sha256 = createHash('sha256').update(renamed).digest('hex');
    request.resume_packet.total_size_bytes = request.resume_packet.files.reduce(
      (total, file) => total + file.size_bytes, 0);
    request.resume_packet.files.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  }, /LEDGER_PACKET_SCAN_PROOF_INVALID/);
  await rejectModified('STARTED', (request) => {
    request.resume_packet = packetFor({ generation: 1, stage: 'STARTED' });
  }, /LEDGER_PACKET_SCAN_PROOF_INVALID/);
});

test('global history and expired-artifact materialization preserve exact terminal packet bytes', async () => {
  const fixture = new LedgerGitFixture();
  await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
  await appendStage(fixture, { generation: 0, stage: 'PROVIDER_ADMISSION', id: 2, effectResult: 'STARTED' });
  await appendStage(fixture, { generation: 0, stage: 'TERMINAL', id: 3, effectResult: 'COMPLETED' });
  const inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-ledger-terminal-materialize-'));
  const output = path.join(temp, 'packet');
  materializePacketBundle(inventory.latest_record.resume_packet, output, {
    packetScanProof: inventory.latest_record.packet_scan,
    secretEntries: [],
  });
  const expected = inventory.latest_record.resume_packet.files;
  for (const file of expected) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(output, file.name))).digest('hex'), file.sha256);
  }
  assert.equal(createHash('sha256').update(
    fs.readFileSync(path.join(output, 'bootstrap-effect-reconciliation.json'))).digest('hex'),
  inventory.latest_record.artifact.effect_receipt_sha256);
  assert.equal(createHash('sha256').update(
    fs.readFileSync(path.join(output, 'physio-production-bootstrap.json'))).digest('hex'),
  inventory.latest_record.artifact.packet_receipt_sha256);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('one fixed branch proves global history while isolating exact application-SHA generation namespaces', async () => {
  const fixture = new LedgerGitFixture();
  const applicationShaB = 'b'.repeat(40);
  await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
  await appendStage(fixture, { generation: 0, stage: 'PROVIDER_ADMISSION', id: 2, effectResult: 'STARTED' });
  await appendStage(fixture, { generation: 0, stage: 'TERMINAL', id: 3, effectResult: 'COMPLETED' });
  await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 4, effectResult: 'STARTED',
    targetApplicationSha: applicationShaB });
  const first = await inventoryLedger({ client: fixture, repository, applicationSha });
  const second = await inventoryLedger({ client: fixture, repository, applicationSha: applicationShaB });
  assert.equal(first.record_count, 3);
  assert.equal(first.latest_record.stage, 'TERMINAL');
  assert.equal(first.next_effect_generation, 1);
  assert.equal(second.record_count, 1);
  assert.equal(second.latest_record.stage, 'STARTED');
  assert.equal(second.next_effect_generation, 0);
  assert.equal(first.audited_commit_count, 6);
  assert.equal(second.audited_commit_count, 6);
  assert.equal(first.ledger_head_sha, second.ledger_head_sha);
});

test('ledger rejects non-fast-forward update and raw-byte tamper', async () => {
  const raced = new LedgerGitFixture();
  const before = await inventoryLedger({ client: raced, repository, applicationSha });
  const racedPacket = packetFor({ generation: 0, stage: 'STARTED' });
  raced.patchMode = 'non-fast-forward';
  await assert.rejects(appendLedgerRecord({
    client: raced, repository, applicationSha, expectedHeadSha: before.ledger_head_sha,
    request: { repository, ledger_branch: LEDGER_BRANCH, application_sha: applicationSha,
      ledger_provisioning_receipt_sha256: before.ledger_provisioning_receipt_sha256,
      stage: 'STARTED', effect_generation: 0, effect_result: 'STARTED',
      artifact: artifactFor({ generation: 0, stage: 'STARTED', id: 1 }),
      resume_packet: racedPacket, packet_scan: packetScanFor(racedPacket),
      workflow_run_id: 10001, workflow_run_attempt: 1 },
  }), /LEDGER_NON_FAST_FORWARD/);

  const tampered = new LedgerGitFixture();
  await appendStage(tampered, { generation: 0, stage: 'STARTED', id: 2, effectResult: 'STARTED' });
  const tree = tampered.trees.get(tampered.commits.get(tampered.headSha).tree.sha);
  const entry = tree.find(({ path: entryPath }) => entryPath.includes('/records/'));
  tampered.blobs.set(entry.sha, Buffer.from('{"tampered":true}\n'));
  await assert.rejects(inventoryLedger({ client: tampered, repository, applicationSha }), /LEDGER_BLOB_TAMPERED/);
});

test('ledger rejects unresolved generation jump, tail deletion, replacement, unrelated commit, and merge', async () => {
  const unresolved = new LedgerGitFixture();
  await appendStage(unresolved, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
  await assert.rejects(appendStage(unresolved, { generation: 1, stage: 'STARTED', id: 2,
    effectResult: 'STARTED' }), /LEDGER_UNRESOLVED_GENERATION/);

  async function completedFixture() {
    const fixture = new LedgerGitFixture();
    await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
    await appendStage(fixture, { generation: 0, stage: 'PROVIDER_ADMISSION', id: 2, effectResult: 'STARTED' });
    await appendStage(fixture, { generation: 0, stage: 'TERMINAL', id: 3, effectResult: 'COMPLETED' });
    return fixture;
  }

  const deleted = await completedFixture();
  const deleteParent = deleted.headSha;
  const deleteTree = structuredClone(deleted.trees.get(deleted.commits.get(deleteParent).tree.sha));
  deleteTree.pop();
  const deleteTreeSha = deleted.nextSha();
  const deleteCommitSha = deleted.nextSha();
  deleted.trees.set(deleteTreeSha, deleteTree);
  deleted.commits.set(deleteCommitSha, { sha: deleteCommitSha, message: 'delete ledger tail',
    tree: { sha: deleteTreeSha }, parents: [{ sha: deleteParent }] });
  deleted.headSha = deleteCommitSha;
  await assert.rejects(inventoryLedger({ client: deleted, repository, applicationSha }),
    /LEDGER_(?:HISTORY|CHAIN|STAGE)/);

  const replaced = await completedFixture();
  const replaceParent = replaced.headSha;
  const replaceTree = structuredClone(replaced.trees.get(replaced.commits.get(replaceParent).tree.sha));
  const firstRecord = replaceTree.find(({ path: entryPath }) => entryPath.includes('/records/0000000000-'));
  const replacementBytes = Buffer.from(replaced.blobs.get(firstRecord.sha).toString('utf8').replace('00:01:00', '00:09:00'));
  firstRecord.sha = gitBlobSha(replacementBytes);
  replaced.blobs.set(firstRecord.sha, replacementBytes);
  const replaceTreeSha = replaced.nextSha();
  const replaceCommitSha = replaced.nextSha();
  replaced.trees.set(replaceTreeSha, replaceTree);
  replaced.commits.set(replaceCommitSha, { sha: replaceCommitSha, message: 'replace historical ledger record',
    tree: { sha: replaceTreeSha }, parents: [{ sha: replaceParent }] });
  replaced.headSha = replaceCommitSha;
  await assert.rejects(inventoryLedger({ client: replaced, repository, applicationSha }),
    /LEDGER_(?:CHAIN|HISTORY)/);

  const unrelated = await completedFixture();
  const unrelatedParent = unrelated.headSha;
  const unrelatedTreeSha = unrelated.nextSha();
  const unrelatedCommitSha = unrelated.nextSha();
  unrelated.trees.set(unrelatedTreeSha,
    [...structuredClone(unrelated.trees.get(unrelated.commits.get(unrelatedParent).tree.sha)),
      { path: 'unrelated.txt', mode: '100644', type: 'blob', sha: 'f'.repeat(40), size: 1 }]);
  unrelated.commits.set(unrelatedCommitSha, { sha: unrelatedCommitSha, message: 'unrelated commit',
    tree: { sha: unrelatedTreeSha }, parents: [{ sha: unrelatedParent }] });
  unrelated.headSha = unrelatedCommitSha;
  await assert.rejects(inventoryLedger({ client: unrelated, repository, applicationSha }), /LEDGER_HISTORY_INVALID/);

  const merged = await completedFixture();
  const mergeParent = merged.headSha;
  const mergeSha = merged.nextSha();
  merged.commits.set(mergeSha, { sha: mergeSha, message: 'merge commit',
    tree: structuredClone(merged.commits.get(mergeParent).tree),
    parents: [{ sha: mergeParent }, { sha: merged.nextSha() }] });
  merged.headSha = mergeSha;
  await assert.rejects(inventoryLedger({ client: merged, repository, applicationSha }), /LEDGER_HISTORY_INVALID/);
});

test('ledger history pagination is exhaustive and bounded', async () => {
  const fixture = new LedgerGitFixture();
  let id = 1;
  for (let generation = 0; generation < 34; generation += 1) {
    await appendStage(fixture, { generation, stage: 'STARTED', id: id++, effectResult: 'STARTED' });
    await appendStage(fixture, { generation, stage: 'PROVIDER_ADMISSION', id: id++, effectResult: 'STARTED' });
    await appendStage(fixture, { generation, stage: 'TERMINAL', id: id++, effectResult: 'COMPLETED' });
  }
  const inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.record_count, 102);
  assert.equal(inventory.audited_commit_count, 104);
  const endless = new LedgerGitFixture();
  endless.historyNeverTerminates = true;
  await assert.rejects(inventoryLedger({ client: endless, repository, applicationSha }),
    /LEDGER_HISTORY_BOUND_EXCEEDED/);
});

test('ledger packet bundle is bounded, checksum-exact, materializable, and rejects exact secret bytes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-ledger-packet-'));
  const packet = path.join(temp, 'packet');
  const restored = path.join(temp, 'restored');
  fs.mkdirSync(packet);
  const receipt = Buffer.from('{"result":"STARTED"}\n');
  fs.writeFileSync(path.join(packet, 'bootstrap-effect-reconciliation.json'), receipt);
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
    `${createHash('sha256').update(receipt).digest('hex')}  bootstrap-effect-reconciliation.json\n`);
  const bundle = buildPacketBundle(packet, ['never-present-secret']);
  const scanProof = packetScanFor(bundle, [{ name: 'TEST_DURABLE_SECRET', value: 'never-present-secret' }]);
  materializePacketBundle(bundle, restored, {
    packetScanProof: scanProof,
    secretEntries: [{ name: 'TEST_DURABLE_SECRET', value: 'never-present-secret' }],
  });
  assert.throws(() => materializePacketBundle(bundle, path.join(temp, 'wrong-secret-set'), {
    packetScanProof: scanProof,
    secretEntries: [{ name: 'TEST_DURABLE_SECRET', value: 'different-runtime-value' }],
  }), /LEDGER_PACKET_SCAN_SECRET_SET_MISMATCH/);
  assert.deepEqual(fs.readdirSync(restored).sort(), fs.readdirSync(packet).sort());
  assert.deepEqual(fs.readFileSync(path.join(restored, 'bootstrap-effect-reconciliation.json')), receipt);
  fs.writeFileSync(path.join(packet, 'credential.txt'), 'exact-secret-value');
  const credential = fs.readFileSync(path.join(packet, 'credential.txt'));
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
    `${createHash('sha256').update(receipt).digest('hex')}  bootstrap-effect-reconciliation.json\n` +
    `${createHash('sha256').update(credential).digest('hex')}  credential.txt\n`);
  assert.throws(() => buildPacketBundle(packet, ['exact-secret-value']), /LEDGER_PACKET_SECRET_REJECTED/);
  fs.writeFileSync(path.join(packet, 'credential.txt'), 'abc');
  const shortCredential = fs.readFileSync(path.join(packet, 'credential.txt'));
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
    `${createHash('sha256').update(receipt).digest('hex')}  bootstrap-effect-reconciliation.json\n` +
    `${createHash('sha256').update(shortCredential).digest('hex')}  credential.txt\n`);
  assert.throws(() => buildPacketBundle(packet, ['abc']), /LEDGER_PACKET_SECRET_REJECTED/);
  fs.rmSync(path.join(packet, 'credential.txt'));
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
    `${createHash('sha256').update(receipt).digest('hex')}  bootstrap-effect-reconciliation.json\n\n`);
  assert.throws(() => buildPacketBundle(packet), /LEDGER_PACKET_SUMS_INVALID/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('ledger packet scanner rejects credential encodings, split tokens, binary payloads, and decode bombs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-ledger-packet-encoding-'));
  const packet = path.join(temp, 'packet');
  fs.mkdirSync(packet);
  const providerPrefix = `${['s', 'k'].join('')}_${['l', 'i', 'v', 'e'].join('')}_`;
  const providerValue = `${providerPrefix}ABCDEFGHIJKLMNOPQRSTUVWXYZ012345`;
  const writeEntries = (entries) => {
    for (const existing of fs.readdirSync(packet)) fs.rmSync(path.join(packet, existing), { force: true });
    const normalized = entries.map(([name, value]) =>
      [name, Buffer.isBuffer(value) ? value : Buffer.from(value)]).sort(([left], [right]) => left.localeCompare(right));
    for (const [name, bytes] of normalized) fs.writeFileSync(path.join(packet, name), bytes);
    fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
      normalized.map(([name, bytes]) =>
        `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`).join(''));
  };
  const writePayload = (value, name = 'evidence.json') => writeEntries([[name, value]]);
  const encoded = Buffer.from(providerValue).toString('base64');
  const urlEncoded = encodeURIComponent(providerValue);
  const fullwidthProvider = [...providerValue].map((character) => {
    const code = character.charCodeAt(0);
    return code >= 0x21 && code <= 0x7e ? String.fromCharCode(code + 0xfee0) : character;
  }).join('');
  const attacks = [
    JSON.stringify({ value: providerValue }),
    JSON.stringify({ value: `${providerPrefix.slice(0, 3)} ${providerPrefix.slice(3)}ABCDEFGHIJKLMNOPQRSTUVWXYZ012345` }),
    JSON.stringify({ value: `${providerPrefix.slice(0, 3)}\u200b${providerPrefix.slice(3)}ABCDEFGHIJKLMNOPQRSTUVWXYZ012345` }),
    JSON.stringify({ value: encoded }),
    JSON.stringify({ value: encoded.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '') }),
    JSON.stringify({ value: `${encoded.slice(0, 8)} ${encoded.slice(8)}` }),
    JSON.stringify([encoded.slice(0, 8), encoded.slice(8)]),
    JSON.stringify({ value: urlEncoded }),
    JSON.stringify({ value: encodeURIComponent(urlEncoded) }),
    JSON.stringify({ value: Buffer.from(encoded).toString('base64') }),
    JSON.stringify({ value: providerValue }).replaceAll('_', '\\u005f'),
    JSON.stringify({ value: providerValue.toUpperCase() }),
    JSON.stringify({ value: fullwidthProvider }),
    JSON.stringify({ value: ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ') }),
  ];
  for (const attack of attacks) {
    writePayload(`${attack}\n`);
    assert.throws(() => buildPacketBundle(packet, [providerValue]), /LEDGER_PACKET_SECRET_REJECTED/,
      `encoded credential escaped rejection: ${attack.slice(0, 80)}`);
  }
  const opaqueValue = ['violet', 'river', 'opaque', 'value', '42'].join('-');
  writePayload(`${JSON.stringify({ value: Buffer.from(opaqueValue).toString('base64') })}\n`);
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_SECRET_REJECTED/);
  let depthExhaustion = opaqueValue;
  for (let depth = 0; depth < 5; depth += 1) depthExhaustion = Buffer.from(depthExhaustion).toString('base64');
  writePayload(`${JSON.stringify({ value: depthExhaustion })}\n`);
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_DECODE_DEPTH_EXCEEDED/);

  const twoWay = 17;
  writeEntries([
    ['z-first.txt', opaqueValue.slice(0, twoWay)],
    ['a-second.txt', opaqueValue.slice(twoWay)],
  ]);
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_DISTRIBUTED_SECRET_REJECTED/);
  const thirds = [opaqueValue.slice(0, 9), opaqueValue.slice(9, 22), opaqueValue.slice(22)];
  writeEntries([['z-one.txt', thirds[0]], ['m-two.txt', thirds[1]], ['a-three.txt', thirds[2]]]);
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_DISTRIBUTED_SECRET_REJECTED/);
  const fragments = opaqueValue.match(/.{1,4}/gu);
  writeEntries(fragments.map((fragment, index) =>
    [`part-${String(fragments.length - index).padStart(2, '0')}.txt`, fragment]));
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_DISTRIBUTED_SECRET_REJECTED/);
  writePayload(`${JSON.stringify({ tail: opaqueValue.slice(18), head: opaqueValue.slice(0, 18) })}\n`);
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_DISTRIBUTED_SECRET_REJECTED/);
  writeEntries([
    [`${opaqueValue.slice(0, 20)}.txt`, 'ordinary'],
    ['tail.txt', ` ${opaqueValue.slice(20, 26)}\n${opaqueValue.slice(26)} `],
  ]);
  assert.throws(() => buildPacketBundle(packet, [opaqueValue]), /LEDGER_PACKET_DISTRIBUTED_SECRET_REJECTED/);
  writePayload(`${JSON.stringify({ value: 'cafe\u0301-secret-value' })}\n`);
  assert.throws(() => buildPacketBundle(packet, ['café-secret-value']), /LEDGER_PACKET_SECRET_REJECTED/);
  writePayload(Buffer.from([0xff, 0xfe, 0x00]), 'evidence.txt');
  assert.throws(() => buildPacketBundle(packet), /LEDGER_PACKET_BINARY_REJECTED/);
  writePayload(Buffer.from('PK\u0003\u0004archive'), 'evidence.zip');
  assert.throws(() => buildPacketBundle(packet), /LEDGER_PACKET_INVALID|LEDGER_PACKET_FILE_TYPE_REJECTED/);
  writePayload(`${JSON.stringify({ value: 'A'.repeat(5_700_000) })}\n`);
  assert.throws(() => buildPacketBundle(packet), /LEDGER_PACKET_DECODE_BOUND_EXCEEDED/);
  writePayload(`${'['.repeat(5_000)}"safe"${']'.repeat(5_000)}\n`);
  assert.throws(() => buildPacketBundle(packet), /LEDGER_PACKET_DECODE_BOUND_EXCEEDED/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('ledger packet IO rejects linked roots and detects a file replacement during descriptor read', (context) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-ledger-packet-path-'));
  const packet = path.join(temp, 'packet');
  fs.mkdirSync(packet);
  const effectPath = path.join(packet, 'effect.json');
  const firstEffect = Buffer.from('{"result":"STARTED"}\n');
  fs.writeFileSync(effectPath, firstEffect);
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
    `${createHash('sha256').update(firstEffect).digest('hex')}  effect.json\n`);
  const linkedPacket = path.join(temp, 'linked-packet');
  try {
    fs.symlinkSync(packet, linkedPacket, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    assert.fail(`test could not create a local linked packet root: ${error.message}`);
  }
  assert.throws(() => buildPacketBundle(linkedPacket), /LEDGER_PACKET_LINK_REJECTED/);

  const originalReadSync = fs.readSync;
  let replaced = false;
  fs.readSync = function adversarialReadSync(descriptor, buffer, offset, length, position) {
    const count = originalReadSync.call(fs, descriptor, buffer, offset, length, position);
    if (!replaced && length === firstEffect.length) {
      replaced = true;
      fs.writeFileSync(effectPath, Buffer.from('{"result":"STOPPED"}\n'));
    }
    return count;
  };
  try {
    assert.throws(() => buildPacketBundle(packet), /LEDGER_PACKET_RACE_REJECTED/);
    assert.equal(replaced, true, 'adversarial replacement hook did not execute');
  } finally {
    fs.readSync = originalReadSync;
    fs.rmSync(temp, { recursive: true, force: true });
  }
  assert.ok(context, 'node test context remains available after cleanup');
});

test('append job rejects packet bytes that differ from the producer exhaustive secret-scan receipt', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-ledger-packet-scan-'));
  const packet = path.join(temp, 'packet');
  fs.mkdirSync(packet);
  const effect = Buffer.from('{"result":"STARTED"}\n');
  fs.writeFileSync(path.join(packet, 'effect.json'), effect);
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'),
    `${createHash('sha256').update(effect).digest('hex')}  effect.json\n`);
  const scanOutput = path.join(temp, 'scan.json');
  const scan = await ledgerMain(['scan-packet', '--packet-directory', packet, '--output', scanOutput]);
  assert.match(scan.packet_bundle_sha256, /^[0-9a-f]{64}$/u);
  const request = path.join(temp, 'request.json');
  fs.writeFileSync(request, '{}\n');
  await assert.rejects(ledgerMain([
    'append', '--repository', repository, '--application-sha', applicationSha,
    '--expected-head-sha', '1'.repeat(40), '--request', request, '--packet-directory', packet,
    '--expected-packet-bundle-sha256', '0'.repeat(64), '--output', path.join(temp, 'append.json'),
  ], { client: new LedgerGitFixture() }), /LEDGER_PACKET_SCAN_RECEIPT_MISMATCH/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('provider equality probe rejects barrier-to-effect digest drift and accepts exact stable maps', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-provider-digest-map-'));
  const expectedPath = path.join(temp, 'expected.json');
  const stablePath = path.join(temp, 'stable.json');
  const driftedPath = path.join(temp, 'drifted.json');
  const value = { contract_version: 'assesssuite-fly-secret-metadata/1.0.0', secrets: [
    { name: 'ADMIN_PASSWORD', digest: 'a'.repeat(16), status: 'Staged' },
  ] };
  const stable = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(expectedPath, stable);
  fs.writeFileSync(stablePath, stable);
  fs.writeFileSync(driftedPath, `${JSON.stringify({ ...value, secrets: [
    { name: 'ADMIN_PASSWORD', digest: 'b'.repeat(16), status: 'Staged' },
  ] }, null, 2)}\n`);
  assert.equal(verifyProviderDigestMap(expectedPath, stablePath).result, 'PASS');
  assert.throws(() => verifyProviderDigestMap(expectedPath, driftedPath), /LEDGER_PROVIDER_DIGEST_DRIFT/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('generation chain advances gen7 to reuse gen8 and then next STARTED gen9', async () => {
  const fixture = new LedgerGitFixture();
  let id = 1;
  for (let generation = 0; generation <= 7; generation += 1) {
    await appendStage(fixture, { generation, stage: 'STARTED', id: id++, effectResult: 'STARTED' });
    await appendStage(fixture, { generation, stage: 'PROVIDER_ADMISSION', id: id++, effectResult: 'STARTED' });
    await appendStage(fixture, { generation, stage: 'TERMINAL', id: id++, effectResult: 'COMPLETED' });
  }
  let inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.latest_record.effect_generation, 7);
  assert.equal(inventory.next_effect_generation, 8);
  const generation7TerminalSha = inventory.latest_record_sha256;
  await appendStage(fixture, { generation: 8, stage: 'STARTED', id: id++, effectResult: 'STARTED' });
  inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.active_predecessor_terminal_record_sha256, generation7TerminalSha);
  await appendStage(fixture, { generation: 8, stage: 'PROVIDER_ADMISSION', id: id++, effectResult: 'STARTED' });
  await appendStage(fixture, { generation: 8, stage: 'TERMINAL', id: id++, effectResult: 'COMPLETED' });
  inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.latest_record.effect_generation, 8);
  assert.equal(inventory.latest_record.effect_result, 'COMPLETED');
  assert.equal(inventory.next_effect_generation, 9);
  await appendStage(fixture, { generation: 9, stage: 'STARTED', id: id++, effectResult: 'STARTED' });
  inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.latest_record.effect_generation, 9);
  assert.equal(inventory.latest_record.stage, 'STARTED');
});

test('same-generation provider response loss appends monotonic retry barriers before terminal', async () => {
  const fixture = new LedgerGitFixture();
  await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
  const admission = await appendStage(fixture, { generation: 0, stage: 'PROVIDER_ADMISSION', id: 2,
    effectResult: 'STARTED', responseLoss: true });
  const first = await appendStage(fixture, { generation: 0, stage: 'PROVIDER_RECONCILIATION', id: 3,
    retryOrdinal: 1, effectResult: 'RECOVERY_RETRY_ADMITTED', responseLoss: true });
  const second = await appendStage(fixture, { generation: 0, stage: 'PROVIDER_RECONCILIATION', id: 4,
    retryOrdinal: 2, effectResult: 'RECOVERY_RETRY_ADMITTED', responseLoss: true });
  await assert.rejects(appendStage(fixture, { generation: 0, stage: 'PROVIDER_RECONCILIATION', id: 5,
    retryOrdinal: 4, effectResult: 'RECOVERY_RETRY_ADMITTED' }), /LEDGER_APPEND_STAGE_MISMATCH/);
  const terminal = await appendStage(fixture, { generation: 0, stage: 'TERMINAL', id: 6,
    effectResult: 'COMPLETED', responseLoss: true });
  assert.equal(admission.update_response_lost_or_rejected, true);
  assert.equal(first.update_response_lost_or_rejected, true);
  assert.equal(second.update_response_lost_or_rejected, true);
  assert.equal(terminal.update_response_lost_or_rejected, true);
  assert.equal(first.record.retry_ordinal, 1);
  assert.equal(second.record.retry_ordinal, 2);
  assert.equal(terminal.record.effect_generation, 0);
  const inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.equal(inventory.latest_record.stage, 'TERMINAL');
  assert.equal(inventory.next_effect_generation, 1);
});

test('dispatch resume must identify exact ledger tip and cannot reset after artifacts disappear', async () => {
  const fixture = new LedgerGitFixture();
  const started = await appendStage(fixture, { generation: 0, stage: 'STARTED', id: 1, effectResult: 'STARTED' });
  await appendStage(fixture, { generation: 0, stage: 'PROVIDER_ADMISSION', id: 2, effectResult: 'STARTED' });
  const completed = await appendStage(fixture, { generation: 0, stage: 'TERMINAL', id: 3, effectResult: 'COMPLETED' });
  const inventory = await inventoryLedger({ client: fixture, repository, applicationSha });
  assert.throws(() => admitResumeAgainstLedger(inventory, { artifactId: '0', artifactDigest: '0',
    receiptSha256: zeroSha256, priorGeneration: '-1' }), /LEDGER_RESUME_INPUT_MISMATCH/);
  assert.doesNotThrow(() => admitResumeAgainstLedger(inventory, {
    artifactId: String(completed.record.artifact.id), artifactDigest: completed.record.artifact.digest,
    receiptSha256: completed.record.artifact.effect_receipt_sha256, priorGeneration: '0',
  }));
  assert.notEqual(started.ledger_record_sha256, completed.ledger_record_sha256);
});

test('deleted or expired transport falls back to ledger bytes and unledgered response-loss transport is ignored', () => {
  const name = `physio-production-bootstrap-${applicationSha}`;
  const exact = retainedArtifact({ id: 20, name, digestCharacter: 'b', expired: false });
  const deleted = runRetainedHistory({ artifacts: [], resumeId: String(exact.id), resumeDigest: exact.digest });
  assert.equal(deleted.status, 0, deleted.stderr);
  assert.equal(deleted.receipt.resume_transport_state, 'LEDGER_PACKET_FALLBACK');
  const expired = runRetainedHistory({ artifacts: [{ ...exact, expired: true }],
    resumeId: String(exact.id), resumeDigest: exact.digest });
  assert.equal(expired.status, 0, expired.stderr);
  assert.equal(expired.receipt.resume_transport_state, 'LEDGER_PACKET_FALLBACK');
  const newer = retainedArtifact({ id: 21, name: `physio-bootstrap-started-${applicationSha}`,
    digestCharacter: 'c', expired: false });
  const outrun = runRetainedHistory({ artifacts: [exact, newer],
    resumeId: String(exact.id), resumeDigest: exact.digest });
  assert.equal(outrun.status, 0, outrun.stderr);
  assert.equal(outrun.receipt.selected_artifact_id, exact.id);
  assert.equal(outrun.receipt.unledgered_transport_ignored, true);
  assert.deepEqual(outrun.receipt.unledgered_artifact_ids, [newer.id]);
  const startFallback = step('start', 'Materialize exact resume packet from protected ledger when artifact transport is gone');
  const providerFallback = step('provider', 'Materialize exact prior packet from protected ledger for provider reconciliation');
  assert.match(startFallback.run, /physio-bootstrap-ledger\.mjs materialize/);
  assert.match(providerFallback.run, /physio-bootstrap-ledger\.mjs materialize/);
});

test('provider admission is in the branch ledger before any possible Fly mutation', () => {
  const upload = step('provider', 'Upload durable authoritative provider admission before mutation');
  const readback = step('provider', 'Read back durable provider admission artifact metadata');
  const ledger = step('ledger_provider', 'Persist immutable provider-admission record in protected bootstrap ledger');
  const gate = step('bootstrap', 'Gate provider mutation or exact completed-state reuse');
  const mutation = step('bootstrap', 'Bootstrap exact app volume and pre-webhook staged secret set');
  assert.match(ledger.run, /physio-bootstrap-ledger\.mjs append/);
  assert.match(ledger.run, /--expected-head-sha/);
  assert.match(gate.run, /PROVIDER_LEDGER_OUTCOME/);
  assert.ok(indexOf(upload.name) < indexOf(readback.name));
  assert.ok(indexOf(readback.name) < indexOf(ledger.name));
  assert.ok(indexOf(ledger.name) < indexOf(gate.name));
  assert.ok(indexOf(gate.name) < indexOf(mutation.name));
  assert.equal(mutation.if, "${{ needs.provider.outputs.provider_action == 'MUTATE' }}");
});

test('unresolved STARTED and provider tips resume the same generation through durable retry barriers', () => {
  const fresh = step('start', 'Build content-free secret fingerprint and persist STARTED');
  const recover = step('start', 'Recover exact same-generation STARTED packet from protected ledger');
  const bootstrapRecover = step('provider', 'Materialize same-generation STARTED handoff from protected ledger');
  const predecessorRecover = step('provider',
    'Materialize predecessor terminal packet for unresolved STARTED exact-state reuse');
  const provider = step('provider', 'Reconcile authoritative Fly state and persist provider-admitted generation').run;
  const ledger = step('ledger_provider', 'Persist immutable provider-admission record in protected bootstrap ledger').run;
  assert.match(fresh.if, /ledger_prior_stage == 'TERMINAL'/);
  assert.match(recover.if, /ledger_prior_stage == 'STARTED'/);
  assert.match(recover.if, /ledger_prior_stage == 'PROVIDER_RECONCILIATION'/);
  assert.match(recover.run, /active_started_record_sha256|STARTED_RECORD_SHA256/);
  assert.match(bootstrapRecover.run, /materialize-remote/);
  assert.match(predecessorRecover.if, /prior_ledger_stage == 'STARTED'/);
  assert.match(predecessorRecover.run, /predecessor_terminal_record_sha256|PREDECESSOR_TERMINAL_RECORD_SHA256/);
  assert.match(provider, /admit_durable_provider_authority/);
  assert.match(provider, /ADMITTED_APP_CREATE_APPLIED/);
  assert.match(provider, /ADMITTED_VOLUME_CREATE_APPLIED/);
  assert.match(provider, /DURABLE_PROVIDER_MUTATION_RECONCILED_FOR_EXACT_RETRY/);
  assert.match(ledger, /stage: process\.env\.LEDGER_STAGE/);
  assert.match(ledger, /retry_ordinal: process\.env\.LEDGER_STAGE === 'PROVIDER_RECONCILIATION'/);
  assert.match(ledger, /--expected-head-sha "\$EXPECTED_LEDGER_HEAD_SHA"/);
});

test('provider response-loss recovery replays only admitted effects and requires an exact secret equality probe', () => {
  const mutation = step('bootstrap', 'Bootstrap exact app volume and pre-webhook staged secret set').run;
  assert.match(mutation, /MUTATION_RESUME_STATE/);
  assert.match(mutation, /inspect-app[\s\S]*?--mode present/);
  assert.match(mutation, /inspect-topology[\s\S]*?--mode bootstrapped/);
  assert.match(mutation, /verify-provider-digest-map/);
  assert.match(mutation, /Partial Fly secret state lacks a durable same-generation reconciliation barrier/);
  assert.match(mutation, /Exact staged-secret equality probe response was lost; same-generation durable retry is required/);
  assert.match(mutation, /post-import-secret-digest-stability\.json/);
  assert.match(mutation, /COMMITTED_CONFIRMED_BY_SUCCESSFUL_EXACT_STAGE_AND_READBACK_WITH_STABLE_DIGEST_MAP/);
  assert.equal((mutation.match(/\bfly apps create\b/gu) || []).length, 1);
  assert.equal((mutation.match(/\bfly volumes create\b/gu) || []).length, 1);
  assert.equal((mutation.match(/\bfly secrets import\b/gu) || []).length, 1);
});

test('completed exact state creates a new read-only terminal receipt with fresh readbacks and no mutation', () => {
  const provider = step('provider', 'Reconcile authoritative Fly state and persist provider-admitted generation').run;
  const reuse = step('bootstrap', 'Terminalise current generation as exact read-only reuse').run;
  const mutation = step('bootstrap', 'Bootstrap exact app volume and pre-webhook staged secret set');
  const result = step('bootstrap', 'Select exact new or read-only reused bootstrap result').run;
  for (const marker of [
    "effect.result = 'COMPLETED'",
    "effect.completion_mode = 'REUSED_EXACT_STATE_READ_ONLY'",
    'effect.provider_mutation_occurred = false',
    'effect.predecessor_artifact_id',
    'effect.predecessor_artifact_digest',
    'effect.predecessor_effect_receipt_sha256',
    'effect.predecessor_effect_generation',
    'organization_raw_readback_sha256',
    'apps_raw_readback_sha256',
    'machines_readback_sha256',
    'volumes_readback_sha256',
    'bootstrap_effect_reconciliation_sha256: effectSha',
  ]) assert.match(reuse, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(provider, /predecessor-bootstrap-effect-reconciliation\.json/);
  assert.match(provider, /predecessor-physio-production-bootstrap\.json/);
  assert.match(reuse, /PREDECESSOR_EFFECT_GENERATION/);
  assert.equal(step('bootstrap', 'Terminalise current generation as exact read-only reuse').env
    .PREDECESSOR_EFFECT_GENERATION, '${{ needs.start.outputs.reuse_predecessor_effect_generation }}');
  assert.doesNotMatch(reuse,
    /\bfly apps create\b|\bfly volumes create\b|\bfly secrets import\b|\bfly deploy\b|\bfly machine (?:run|update|stop|restart|destroy)\b/);
  assert.equal(mutation.if, "${{ needs.provider.outputs.provider_action == 'MUTATE' }}");
  assert.match(result, /row\.effect_generation !== Number\(process\.env\.EFFECT_GENERATION\)/);
  assert.match(result, /row\.bootstrap_effect_reconciliation_sha256 !== effectSha/);
  assert.match(result, /row\.predecessor_effect_generation !== row\.effect_generation - 1/);
});

test('terminal artifact is appended to the protected ledger and replay corridor creates no machine, cert, or DNS', () => {
  const terminal = step('ledger_terminal', 'Persist immutable terminal or reuse record in protected bootstrap ledger');
  assert.match(terminal.run, /stage: 'TERMINAL'/);
  assert.match(terminal.run, /effect_receipt_sha256: process\.env\.EFFECT_SHA/);
  assert.match(terminal.run, /packet_receipt_sha256: packetReceipt/);
  assert.match(terminal.run, /--expected-head-sha "\$EXPECTED_LEDGER_HEAD_SHA"/);
  assert.doesNotMatch(source,
    /\bfly deploy\b|\bfly machine (?:run|update|stop|restart|destroy)\b|\bfly certs (?:add|create|setup)\b|\bfly dns\b/);
  assert.match(source, /fly certs list --app "\$app" --json/);
});
