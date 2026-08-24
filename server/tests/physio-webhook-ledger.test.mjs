import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  WEBHOOK_LEDGER_BRANCH,
  appendWebhookLedgerRecord,
  buildWebhookArchiveReceipt,
  buildWebhookLedgerRulesetProvisioningReceipt,
  buildWebhookPacketBundle,
  createWebhookLedgerGitHubClient,
  createWebhookLedgerGenesis,
  appendWebhookLedgerProvisioningReceipt,
  genesisBytes,
  inspectWebhookLedger,
  materializeWebhookPacketFromLedger,
  materializeWebhookPacketBundle,
  validateWebhookArchiveReceipt,
} from '../../scripts/physio-webhook-ledger.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repository = 'maxwell/assesssuite';
const applicationSha = 'a'.repeat(40);
const otherApplicationSha = 'b'.repeat(40);
const H = (value) => createHash('sha256').update(value).digest('hex');
const G = (value) => createHash('sha1').update(value).digest('hex');
const blobSha = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function response(status, value) {
  return { status, async text() { return value === null ? '' : JSON.stringify(value); } };
}

class FakeGitHub {
  constructor({ initialize = true } = {}) {
    this.blobs = new Map();
    this.trees = new Map();
    this.commits = new Map();
    this.responseLoss = false;
    this.protected = true;
    this.forcePushes = false;
    this.deletions = false;
    this.linear = true;
    this.historyNeverTerminates = false;
    this.historyPagesRequested = new Set();
    this.rulesetId = 731;
    this.rulesetUpdatedAt = '2026-08-22T11:00:00.000Z';
    this.rulesetNodeId = 'RRS_assesssuite_physio_webhook';
    this.runtimeOmitsBypassActors = true;
    this.includeRecursiveTreeNodes = true;
    const genesis = genesisBytes(repository);
    const genesisBlob = blobSha(genesis);
    const genesisTree = G('genesis-tree');
    const genesisCommit = G('genesis-commit');
    this.blobs.set(genesisBlob, genesis);
    this.trees.set(genesisTree, new Map([['.ledger/genesis.json', {
      path: '.ledger/genesis.json', mode: '100644', type: 'blob', sha: genesisBlob,
    }]]));
    this.commits.set(genesisCommit, { sha: genesisCommit,
      message: 'AssessSuite Physio webhook ledger genesis', tree: { sha: genesisTree }, parents: [] });
    this.genesisHead = genesisCommit;
    const genesisReadback = {
      genesis_commit_sha: genesisCommit,
      genesis_parent_count: 0,
      genesis_commit_message: 'AssessSuite Physio webhook ledger genesis',
      genesis_tree_sha: genesisTree,
      genesis_blob_path: '.ledger/genesis.json',
      genesis_blob_sha: genesisBlob,
      genesis_blob_sha256: H(genesis),
      genesis_ref_readback_sha: genesisCommit,
    };
    this.rulesetReceipt = buildWebhookLedgerRulesetProvisioningReceipt({ repository, observedAt:
      '2026-08-22T11:01:00.000Z', ruleset: this.rulesetObject(true), genesisReadback });
    const provisioning = Buffer.from(`${JSON.stringify(this.rulesetReceipt, null, 2)}\n`);
    const provisioningBlob = blobSha(provisioning);
    const provisioningTree = G('provisioning-tree');
    const provisioningCommit = G('provisioning-commit');
    this.blobs.set(provisioningBlob, provisioning);
    this.trees.set(provisioningTree, new Map([
      ...this.trees.get(genesisTree),
      ['.ledger/provisioning.json', { path: '.ledger/provisioning.json', mode: '100644', type: 'blob',
        sha: provisioningBlob }],
    ]));
    this.commits.set(provisioningCommit, { sha: provisioningCommit,
      message: 'Bind AssessSuite Physio webhook ledger provisioning receipt',
      tree: { sha: provisioningTree }, parents: [{ sha: genesisCommit }] });
    this.provisioningHead = provisioningCommit;
    this.head = initialize ? provisioningCommit : null;
  }

  rulesetObject(includeBypass) {
    return { id: this.rulesetId, node_id: this.rulesetNodeId,
      name: 'Protect AssessSuite Physio webhook ledger', target: 'branch', enforcement: 'active',
      updated_at: this.rulesetUpdatedAt,
      ...(includeBypass ? { bypass_actors: [] } : {}),
      conditions: { ref_name: { include: [`refs/heads/${WEBHOOK_LEDGER_BRANCH}`], exclude: [] } },
      rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }, { type: 'required_linear_history' }] };
  }

  history() {
    const rows = [];
    let cursor = this.head;
    const seen = new Set();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      rows.push(cursor);
      cursor = this.commits.get(cursor)?.parents?.[0]?.sha;
    }
    return rows;
  }

  async fetch(url, options) {
    const endpoint = new URL(url).pathname.replace(`/repos/${repository}`, '') + new URL(url).search;
    const method = options.method;
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === 'GET' && endpoint === `/git/ref/heads/${WEBHOOK_LEDGER_BRANCH}`) {
      return response(this.head ? 200 : 404, this.head ? { ref: `refs/heads/${WEBHOOK_LEDGER_BRANCH}`,
        object: { type: 'commit', sha: this.head } } : null);
    }
    if (method === 'GET' && endpoint === '/rulesets?includes_parents=false&per_page=100&page=1') {
      return response(200, [{ id: this.rulesetId, name: 'Protect AssessSuite Physio webhook ledger' }]);
    }
    if (method === 'GET' && endpoint === `/rulesets/${this.rulesetId}?includes_parents=false`) {
      return response(200, this.rulesetObject(!this.runtimeOmitsBypassActors));
    }
    if (method === 'GET' && endpoint === `/branches/${WEBHOOK_LEDGER_BRANCH}`) {
      return response(this.head ? 200 : 404, this.head ? { name: WEBHOOK_LEDGER_BRANCH,
        commit: { sha: this.head }, protected: this.protected } : null);
    }
    if (method === 'GET' && endpoint === `/rules/branches/${WEBHOOK_LEDGER_BRANCH}`) {
      const types = [
        ...(this.deletions ? [] : ['deletion']),
        ...(this.forcePushes ? [] : ['non_fast_forward']),
        ...(this.linear ? ['required_linear_history'] : []),
      ];
      return response(200, types.map((type) => ({ type })));
    }
    const history = endpoint.match(/^\/commits\?sha=assesssuite-physio-webhook-ledger&per_page=100&page=(\d+)$/u);
    if (method === 'GET' && history) {
      const page = Number(history[1]);
      this.historyPagesRequested.add(page);
      if (this.historyNeverTerminates) return response(200, Array.from({ length: 100 }, (_, index) =>
        ({ sha: G(`endless-${page}-${index}`) })));
      const rows = this.history().slice((page - 1) * 100, page * 100).map((sha) => ({ sha }));
      return response(200, rows);
    }
    const commitGet = endpoint.match(/^\/git\/commits\/([0-9a-f]{40})$/u);
    if (method === 'GET' && commitGet) return response(this.commits.has(commitGet[1]) ? 200 : 404,
      this.commits.get(commitGet[1]) || null);
    const treeGet = endpoint.match(/^\/git\/trees\/([0-9a-f]{40})\?recursive=1$/u);
    if (method === 'GET' && treeGet) {
      const tree = this.trees.get(treeGet[1]);
      const rows = tree ? [...tree.values()] : [];
      if (tree && this.includeRecursiveTreeNodes) {
        const directories = new Set();
        for (const row of rows) {
          const parts = row.path.split('/');
          for (let index = 1; index < parts.length; index += 1) directories.add(parts.slice(0, index).join('/'));
        }
        rows.unshift(...[...directories].sort().map((entry) => ({ path: entry, mode: '040000',
          type: 'tree', sha: G(`tree-node-${treeGet[1]}-${entry}`) })));
      }
      return response(tree ? 200 : 404, tree ? { sha: treeGet[1], truncated: false, tree: rows } : null);
    }
    const blobGet = endpoint.match(/^\/git\/blobs\/([0-9a-f]{40})$/u);
    if (method === 'GET' && blobGet) {
      const bytes = this.blobs.get(blobGet[1]);
      return response(bytes ? 200 : 404, bytes ? { sha: blobGet[1], encoding: 'base64',
        content: bytes.toString('base64'), truncated: false } : null);
    }
    if (method === 'POST' && endpoint === '/git/blobs') {
      const bytes = Buffer.from(body.content, body.encoding);
      const sha = blobSha(bytes);
      this.blobs.set(sha, bytes);
      return response(201, { sha });
    }
    if (method === 'POST' && endpoint === '/git/trees') {
      const base = body.base_tree ? new Map(this.trees.get(body.base_tree)) : new Map();
      for (const row of body.tree) base.set(row.path, row);
      const sha = G(JSON.stringify([...base.entries()]));
      this.trees.set(sha, base);
      return response(201, { sha });
    }
    if (method === 'POST' && endpoint === '/git/commits') {
      const sha = G(JSON.stringify(body));
      const commit = { sha, message: body.message, tree: { sha: body.tree },
        parents: body.parents.map((parent) => ({ sha: parent })) };
      this.commits.set(sha, commit);
      return response(201, commit);
    }
    if (method === 'PATCH' && endpoint === `/git/refs/heads/${WEBHOOK_LEDGER_BRANCH}`) {
      assert.equal(body.force, false);
      assert.equal(this.commits.get(body.sha)?.parents?.[0]?.sha, this.head);
      this.head = body.sha;
      if (this.responseLoss) {
        this.responseLoss = false;
        throw new Error('simulated response loss after accepted ref append');
      }
      return response(200, { ref: `refs/heads/${WEBHOOK_LEDGER_BRANCH}`, object: { sha: this.head } });
    }
    if (method === 'POST' && endpoint === '/git/refs') {
      if (this.head || body.ref !== `refs/heads/${WEBHOOK_LEDGER_BRANCH}` || !this.commits.has(body.sha)) {
        return response(422, null);
      }
      this.head = body.sha;
      return response(201, { ref: body.ref, object: { sha: body.sha } });
    }
    return response(404, null);
  }

  client() {
    const syntheticAuthFixture = String.fromCharCode(120).repeat(40);
    return createWebhookLedgerGitHubClient({ repository, token: syntheticAuthFixture,
      fetchImpl: this.fetch.bind(this), apiBase: 'https://api.github.test' });
  }
}

function makePacket(temp, body = '{"result":"PASS"}\n') {
  const packet = path.join(temp, `packet-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(packet);
  fs.writeFileSync(path.join(packet, 'evidence.json'), body);
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'), `${H(body)}  evidence.json\n`);
  return packet;
}

function addCompensationPhaseMember(packet, revision = 0) {
  const name = `stripe-webhook-compensation-phase-${String(revision).padStart(3, '0')}.json`;
  if (!fs.existsSync(path.join(packet, name))) fs.writeFileSync(path.join(packet, name), '{"fixture":true}\n');
  const sums = fs.readdirSync(packet).filter((entry) => entry !== 'SHA256SUMS').sort()
    .map((entry) => `${H(fs.readFileSync(path.join(packet, entry)))}  ${entry}`).join('\n');
  fs.writeFileSync(path.join(packet, 'SHA256SUMS'), `${sums}\n`);
  return packet;
}

function source({ app = applicationSha, id = 10, run = 20, revision = 0, kind = 'COMPENSATION',
  generation = 0, receipt = H(`receipt-${id}`) } = {}) {
  return {
    artifact_admission_sha256: H(`admission-${id}`),
    artifact_digest: `sha256:${H(`artifact-${id}`)}`,
    artifact_expired: false,
    artifact_id: id,
    artifact_maximum_bytes: 33_554_432,
    artifact_name: kind === 'COMPLETED' ? `physio-production-stripe-webhook-${app}` :
      `physio-stripe-webhook-compensation-phase-${app}-${generation}-${revision}`,
    artifact_receipt_sha256: receipt,
    artifact_size_in_bytes: 4096,
    repository,
    workflow_run_attempt: 1,
    workflow_run_conclusion: kind === 'COMPLETED' ? 'success' : 'failure',
    workflow_run_event: 'workflow_dispatch',
    workflow_run_head_branch: 'main',
    workflow_run_head_sha: app,
    workflow_run_id: run,
    workflow_run_path: '.github/workflows/physio-production-stripe-webhook.yml',
  };
}

function lifecycle({ generation = 0, revision = 0, kind = 'COMPENSATION', result = 'UNRESOLVED',
  started = H('started'), request = H(`request-${generation}`) } = {}) {
  return {
    kind,
    result,
    effect_generation: generation,
    started_effect_receipt_sha256: started,
    request_sha256: request,
    control_receipt_sha256: H(`control-${generation}-${revision}-${kind}`),
    effect_receipt_sha256: kind === 'COMPLETED' ? H(`effect-${generation}`) : null,
    latest_revision: kind === 'COMPENSATION' ? revision : null,
  };
}

async function append(fixture, packet, options = {}) {
  const lifecycleValue = lifecycle({ generation: options.generation, revision: options.revision,
    kind: options.kind, result: options.result, started: options.started, request: options.request });
  if (lifecycleValue.kind === 'COMPENSATION') addCompensationPhaseMember(packet, lifecycleValue.latest_revision);
  return appendWebhookLedgerRecord({ client: fixture.client(), repository,
    applicationSha: options.app || applicationSha,
    request: { packet: buildWebhookPacketBundle(packet),
      source: source({ app: options.app, id: options.id, run: options.run,
        revision: options.sourceRevision ?? options.revision,
        generation: options.sourceGeneration ?? options.generation, kind: options.kind,
        receipt: options.sourceReceipt || lifecycleValue.control_receipt_sha256 }),
      lifecycle: lifecycleValue },
    recordedAt: options.recordedAt || '2026-08-22T12:00:00.000Z' });
}

test('ledger is globally audited, application-isolated, and appends exact immutable records', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-'));
  const fixture = new FakeGitHub();
  const first = await append(fixture, makePacket(temp), { id: 1, run: 10, revision: 0 });
  assert.equal(first.response_loss_reconciled, false);
  const second = await append(fixture, makePacket(temp), { app: otherApplicationSha, id: 2, run: 11,
    revision: 0, started: H('other-started') });
  const inventory = await inspectWebhookLedger({ client: fixture.client(), repository });
  assert.equal(inventory.audited_commit_count, 4);
  assert.equal(inventory.application_records.get(applicationSha).length, 1);
  assert.equal(inventory.application_records.get(otherApplicationSha).length, 1);
  assert.equal(second.record.application_sequence, 0);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('zero-parent genesis is static and its descendant binds exact L5 ruleset and genesis readback', () => {
  const fixture = new FakeGitHub();
  const genesis = JSON.parse(genesisBytes(repository));
  assert.deepEqual(Object.keys(genesis).sort(), ['contract_version', 'ledger_branch', 'purpose', 'repository']);
  assert.equal(fixture.rulesetReceipt.ruleset_id, fixture.rulesetId);
  assert.equal(fixture.rulesetReceipt.bypass_actor_count, 0);
  assert.equal(fixture.rulesetReceipt.genesis_commit_sha, fixture.genesisHead);
  assert.match(fixture.rulesetReceipt.full_object_sha256, /^[0-9a-f]{64}$/u);
  assert.throws(() => buildWebhookLedgerRulesetProvisioningReceipt({ repository,
    observedAt: '2026-08-22T11:01:00.000Z',
    ruleset: { ...fixture.rulesetObject(true), bypass_actors: [{ actor_id: 1 }] },
    genesisReadback: {
      genesis_commit_sha: fixture.rulesetReceipt.genesis_commit_sha,
      genesis_parent_count: fixture.rulesetReceipt.genesis_parent_count,
      genesis_commit_message: fixture.rulesetReceipt.genesis_commit_message,
      genesis_tree_sha: fixture.rulesetReceipt.genesis_tree_sha,
      genesis_blob_path: fixture.rulesetReceipt.genesis_blob_path,
      genesis_blob_sha: fixture.rulesetReceipt.genesis_blob_sha,
      genesis_blob_sha256: fixture.rulesetReceipt.genesis_blob_sha256,
      genesis_ref_readback_sha: fixture.rulesetReceipt.genesis_ref_readback_sha,
    } }),
  /WEBHOOK_LEDGER_RULESET_INVALID/);
});

test('L5 provisioning creates static zero-parent genesis then exact receipt descendant', async () => {
  const fixture = new FakeGitHub({ initialize: false });
  fixture.runtimeOmitsBypassActors = false;
  const genesis = await createWebhookLedgerGenesis({ client: fixture.client(), repository });
  assert.equal(genesis.genesis_commit_sha, fixture.head);
  assert.equal(fixture.commits.get(fixture.head).parents.length, 0);
  const genesisReadback = Object.fromEntries(Object.entries(genesis)
    .filter(([key]) => key.startsWith('genesis_')));
  const receipt = buildWebhookLedgerRulesetProvisioningReceipt({ repository,
    observedAt: '2026-08-22T11:01:00.000Z', ruleset: fixture.rulesetObject(true), genesisReadback });
  fixture.runtimeOmitsBypassActors = true;
  const result = await appendWebhookLedgerProvisioningReceipt({ client: fixture.client(), repository,
    provisioningReceipt: receipt, expectedGenesisSha: genesis.genesis_commit_sha });
  assert.equal(result.ledger_provisioning_commit_sha, fixture.head);
  assert.equal(result.audited_commit_count, 2);
  assert.equal(result.ruleset_id, fixture.rulesetId);
  assert.equal(fixture.commits.get(fixture.head).parents[0].sha, genesis.genesis_commit_sha);
});

test('genesis rejects inactive, mis-scoped, bypassed, or incomplete rulesets before any provider write', async () => {
  const mutations = [
    (ruleset) => ({ ...ruleset, enforcement: 'evaluate' }),
    (ruleset) => ({ ...ruleset, target: 'tag' }),
    (ruleset) => ({ ...ruleset, conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } } }),
    (ruleset) => ({ ...ruleset, bypass_actors: [{ actor_id: 1 }] }),
    (ruleset) => ({ ...ruleset, rules: ruleset.rules.filter((row) => row.type !== 'required_linear_history') }),
  ];
  for (const mutate of mutations) {
    const fixture = new FakeGitHub({ initialize: false });
    fixture.runtimeOmitsBypassActors = false;
    const pristineRuleset = fixture.rulesetObject.bind(fixture);
    fixture.rulesetObject = (includeBypass) => mutate(pristineRuleset(includeBypass));
    const countsBefore = [fixture.blobs.size, fixture.trees.size, fixture.commits.size];
    await assert.rejects(
      createWebhookLedgerGenesis({ client: fixture.client(), repository }),
      /WEBHOOK_LEDGER_RULESET_INVALID/u,
    );
    assert.equal(fixture.head, null);
    assert.deepEqual([fixture.blobs.size, fixture.trees.size, fixture.commits.size], countsBefore);
  }
});

test('provisioning receipt cannot predate the exact ruleset version', async () => {
  const fixture = new FakeGitHub({ initialize: false });
  fixture.runtimeOmitsBypassActors = false;
  const genesis = await createWebhookLedgerGenesis({ client: fixture.client(), repository });
  const genesisReadback = Object.fromEntries(Object.entries(genesis)
    .filter(([key]) => key.startsWith('genesis_')));
  const receipt = buildWebhookLedgerRulesetProvisioningReceipt({ repository,
    observedAt: '2026-08-22T11:01:00.000Z', ruleset: fixture.rulesetObject(true), genesisReadback });
  const countsBefore = [fixture.blobs.size, fixture.trees.size, fixture.commits.size];
  await assert.rejects(appendWebhookLedgerProvisioningReceipt({ client: fixture.client(), repository,
    provisioningReceipt: { ...receipt, observed_at: '2026-08-22T10:59:59.000Z' },
    expectedGenesisSha: genesis.genesis_commit_sha }), /WEBHOOK_LEDGER_RULESET_INVALID/u);
  assert.equal(fixture.head, genesis.genesis_commit_sha);
  assert.deepEqual([fixture.blobs.size, fixture.trees.size, fixture.commits.size], countsBefore);
});

test('ref response loss reconciles by exact path, blob, record, manifest, and provider readback', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-response-loss-'));
  const fixture = new FakeGitHub();
  fixture.responseLoss = true;
  const result = await append(fixture, makePacket(temp), { id: 3, run: 12 });
  assert.equal(result.response_loss_reconciled, true);
  assert.match(result.ledger_record_blob_sha, /^[0-9a-f]{40}$/u);
  assert.match(result.ledger_record_sha256, /^[0-9a-f]{64}$/u);
  assert.match(result.packet_manifest_sha256, /^[0-9a-f]{64}$/u);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('same source coordinates cannot be rebound to changed packet bytes or lifecycle', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-replay-'));
  const fixture = new FakeGitHub();
  await append(fixture, makePacket(temp), { id: 4, run: 13 });
  await assert.rejects(append(fixture, makePacket(temp, '{"changed":true}\n'), { id: 4, run: 13 }),
    /WEBHOOK_LEDGER_SOURCE_REPLAY_CONFLICT/);
  await assert.rejects(append(new FakeGitHub(), makePacket(temp), { id: 400, run: 1300,
    sourceReceipt: H('not-the-validated-control') }), /WEBHOOK_LEDGER_RECORD_INVALID/);
  await assert.rejects(append(new FakeGitHub(), makePacket(temp), { id: 401, run: 1301,
    generation: 1, revision: 0, sourceGeneration: 0, sourceRevision: 1 }),
  /WEBHOOK_LEDGER_RECORD_INVALID/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('wrong lifecycle predecessor, stalled revision, and completed-generation replay fail closed', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-lineage-'));
  const fixture = new FakeGitHub();
  await append(fixture, makePacket(temp), { id: 5, run: 14, revision: 0 });
  await assert.rejects(append(fixture, makePacket(temp), { id: 6, run: 15, revision: 0 }),
    /WEBHOOK_LEDGER_CHAIN_INVALID/);
  await append(fixture, makePacket(temp), { id: 7, run: 16, revision: 1 });
  await append(fixture, makePacket(temp), { id: 8, run: 17, kind: 'COMPLETED', result: 'COMPLETED' });
  await assert.rejects(append(fixture, makePacket(temp), { id: 9, run: 18, kind: 'COMPLETED',
    result: 'COMPLETED' }), /WEBHOOK_LEDGER_CHAIN_INVALID/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('lifecycle transition table rejects terminal reclassification, jumps and cross-generation identity reuse', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-transition-table-'));
  const attempt = async (prior, next, accepted) => {
    const fixture = new FakeGitHub();
    await append(fixture, makePacket(temp), { ...prior, id: 40, run: 140 });
    const operation = append(fixture, makePacket(temp), { ...next, id: 41, run: 141 });
    if (accepted) await operation;
    else await assert.rejects(operation, /WEBHOOK_LEDGER_CHAIN_INVALID/);
  };
  await attempt({ kind: 'COMPLETED', result: 'COMPLETED', generation: 0 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 1, revision: 0,
      started: H('new-started') }, false);
  await attempt({ kind: 'COMPENSATION', result: 'COMPENSATED', generation: 0, revision: 1 },
    { kind: 'COMPLETED', result: 'COMPLETED', generation: 0 }, false);
  await attempt({ kind: 'COMPENSATION', result: 'COMPENSATED', generation: 0, revision: 1 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 2, revision: 0,
      started: H('jump-started') }, false);
  await attempt({ kind: 'COMPENSATION', result: 'COMPENSATED', generation: 0, revision: 1 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 1, revision: 0 }, false);
  await attempt({ kind: 'COMPENSATION', result: 'COMPENSATED', generation: 0, revision: 1 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 1, revision: 0,
      started: H('generation-one-started') }, true);
  await attempt({ kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 0, revision: 0 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 0, revision: 1 }, true);
  await attempt({ kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 0, revision: 0 },
    { kind: 'COMPLETED', result: 'COMPLETED', generation: 0 }, true);
  await attempt({ kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 0, revision: 0 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 1, revision: 0,
      started: H('early-next-generation') }, false);
  await attempt({ kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 0, revision: 0 },
    { kind: 'COMPENSATION', result: 'UNRESOLVED', generation: 0, revision: 1,
      request: H('changed-same-generation-request') }, false);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('history rejects fork/merge, truncation, replacement, deletion, unrelated path and weak protection', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-history-'));
  const build = async () => {
    const fixture = new FakeGitHub();
    await append(fixture, makePacket(temp), { id: Math.floor(Math.random() * 100000) + 100, run: 100 });
    return fixture;
  };
  const merged = await build();
  merged.commits.get(merged.head).parents.push({ sha: G('foreign-parent') });
  await assert.rejects(inspectWebhookLedger({ client: merged.client(), repository }), /WEBHOOK_LEDGER_HISTORY_INVALID/);
  const replaced = await build();
  const headTreeSha = replaced.commits.get(replaced.head).tree.sha;
  replaced.trees.get(headTreeSha).set('.ledger/genesis.json', { path: '.ledger/genesis.json', mode: '100644',
    type: 'blob', sha: blobSha(Buffer.from('replacement')) });
  await assert.rejects(inspectWebhookLedger({ client: replaced.client(), repository }), /WEBHOOK_LEDGER_HISTORY_INVALID/);
  const unrelated = await build();
  const unrelatedTree = unrelated.trees.get(unrelated.commits.get(unrelated.head).tree.sha);
  unrelatedTree.set('foreign.txt', { path: 'foreign.txt', mode: '100644', type: 'blob', sha: G('foreign') });
  await assert.rejects(inspectWebhookLedger({ client: unrelated.client(), repository }), /WEBHOOK_LEDGER_HISTORY_INVALID/);
  const truncated = await build();
  const truncatedRow = (await inspectWebhookLedger({ client: truncated.client(), repository })).records[0];
  const truncatedReceipt = buildWebhookArchiveReceipt({
    contract_version: 'assesssuite-physio-webhook-ledger-append/1.0.0', result: 'PASS',
    response_loss_reconciled: false, repository, ledger_branch: WEBHOOK_LEDGER_BRANCH,
    ledger_ruleset_id: truncated.rulesetId, ledger_genesis_sha: truncated.genesisHead,
    ledger_head_sha: truncated.head, ledger_commit_sha: truncatedRow.commit_sha,
    ledger_record_path: truncatedRow.path, ledger_record_blob_sha: truncatedRow.blob_sha,
    ledger_record_sha256: truncatedRow.sha256,
    packet_manifest_sha256: truncatedRow.record.packet_manifest_sha256, record: truncatedRow.record,
  });
  truncated.head = truncated.genesisHead;
  await assert.rejects(materializeWebhookPacketFromLedger({ client: truncated.client(), repository,
    applicationSha, archiveReceipt: truncatedReceipt, outputDirectory: path.join(temp, 'truncated-output'),
    expectation: {} }), /WEBHOOK_LEDGER_(?:MATERIALIZATION|HISTORY)_INVALID/);
  const weak = await build();
  weak.forcePushes = true;
  await assert.rejects(inspectWebhookLedger({ client: weak.client(), repository }), /WEBHOOK_LEDGER_PROTECTION_INVALID/);
  const hiddenBypassDrift = await build();
  hiddenBypassDrift.rulesetUpdatedAt = '2026-08-22T11:02:00.000Z';
  await assert.rejects(inspectWebhookLedger({ client: hiddenBypassDrift.client(), repository }),
    /WEBHOOK_LEDGER_RULESET_INVALID/);
  const visibleBypass = await build();
  visibleBypass.runtimeOmitsBypassActors = false;
  const originalRulesetObject = visibleBypass.rulesetObject.bind(visibleBypass);
  visibleBypass.rulesetObject = (includeBypass) => ({ ...originalRulesetObject(includeBypass),
    ...(includeBypass ? { bypass_actors: [{ actor_id: 1 }] } : {}) });
  await assert.rejects(inspectWebhookLedger({ client: visibleBypass.client(), repository }),
    /WEBHOOK_LEDGER_RULESET_INVALID/);
  const endless = new FakeGitHub();
  endless.historyNeverTerminates = true;
  await assert.rejects(inspectWebhookLedger({ client: endless.client(), repository }),
    /WEBHOOK_LEDGER_HISTORY_(?:OVERSIZE|PAGINATION_INVALID)/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('history audit and expired rehydration reject swapped compensation artifact coordinates', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-coordinate-audit-'));
  const fixture = new FakeGitHub();
  const appended = await append(fixture, makePacket(temp), { id: 501, run: 1501,
    generation: 1, revision: 0 });
  const receipt = buildWebhookArchiveReceipt(appended);
  const inventory = await inspectWebhookLedger({ client: fixture.client(), repository });
  const row = inventory.records[0];
  const tampered = structuredClone(row.record);
  tampered.source.artifact_name =
    `physio-stripe-webhook-compensation-phase-${applicationSha}-0-1`;
  const bytes = Buffer.from(`${JSON.stringify(tampered, null, 2)}\n`);
  const replacementBlob = blobSha(bytes);
  fixture.blobs.set(replacementBlob, bytes);
  const headTree = fixture.trees.get(fixture.commits.get(fixture.head).tree.sha);
  headTree.set(row.path, { ...headTree.get(row.path), sha: replacementBlob });
  await assert.rejects(inspectWebhookLedger({ client: fixture.client(), repository }),
    /WEBHOOK_LEDGER_RECORD_INVALID/);
  await assert.rejects(materializeWebhookPacketFromLedger({ client: fixture.client(), repository,
    applicationSha, archiveReceipt: receipt, outputDirectory: path.join(temp, 'expired-coordinate-output'),
    expectation: {} }), /WEBHOOK_LEDGER_RECORD_INVALID/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('packet bundle is checksum exact, secret-free, bounded and materializes after source expiry', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-packet-'));
  const packet = makePacket(temp);
  const bundle = buildWebhookPacketBundle(packet, ['never-present']);
  const restored = path.join(temp, 'restored-after-source-artifact-expiry');
  materializeWebhookPacketBundle(bundle, restored, ['never-present']);
  assert.equal(fs.readFileSync(path.join(restored, 'evidence.json'), 'utf8'), '{"result":"PASS"}\n');
  fs.writeFileSync(path.join(packet, 'credential.json'), '{"secret":"whsec_leaked"}\n');
  assert.throws(() => buildWebhookPacketBundle(packet), /WEBHOOK_LEDGER_SECRET_REJECTED/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('expired-artifact ledger rehydration re-runs the owning validator before releasing stored bytes', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-owning-validator-'));
  const fixture = new FakeGitHub();
  const appended = await append(fixture, makePacket(temp), { id: 310, run: 311,
    kind: 'COMPLETED', result: 'COMPLETED' });
  const receipt = buildWebhookArchiveReceipt(appended);
  await assert.rejects(materializeWebhookPacketFromLedger({ client: fixture.client(), repository,
    applicationSha, archiveReceipt: receipt, outputDirectory: path.join(temp, 'expired-rehydration'),
    expectation: { applicationSha, authorityReference: 'UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP',
      bootstrapReceiptSha256: H('bootstrap'), canaryReceiptSha256: H('canary'),
      capabilityIntentId: 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:webhook',
      effectReceiptSha256: H('effect') } }), /completed packet/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('packet content policy rejects encoded, split, nested and oversized credential material', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-content-policy-'));
  const providerPrefix = `${['s', 'k'].join('')}_${['l', 'i', 'v', 'e'].join('')}_`;
  const providerValue = `${providerPrefix}ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
  const rejected = [
    providerValue.toUpperCase(),
    providerValue.replace(/_/gu, ' _ '),
    Buffer.from(providerValue).toString('base64'),
    Buffer.from(` ${providerValue}>`).toString('base64url'),
    `${Buffer.from(providerValue).toString('base64')}=`,
    Buffer.from(Buffer.from(providerValue).toString('base64')).toString('base64'),
    providerValue.replaceAll('_', '%5f'),
  ];
  for (const [index, value] of rejected.entries()) {
    const packet = makePacket(temp, `${JSON.stringify({ value })}\n`);
    assert.throws(() => buildWebhookPacketBundle(packet), /WEBHOOK_LEDGER_SECRET_REJECTED/,
      `encoded credential variant ${index} was accepted`);
  }
  const splitPacket = makePacket(temp, `${JSON.stringify({ fragments:
    [providerPrefix.slice(0, 3), providerPrefix.slice(3), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] })}\n`);
  assert.throws(() => buildWebhookPacketBundle(splitPacket), /WEBHOOK_LEDGER_SECRET_REJECTED/);
  const encoded = Buffer.from(providerValue).toString('base64');
  const splitEncodedPacket = makePacket(temp, `${JSON.stringify({ fragments:
    [encoded.slice(0, 10), encoded.slice(10, 24), encoded.slice(24)] })}\n`);
  assert.throws(() => buildWebhookPacketBundle(splitEncodedPacket), /WEBHOOK_LEDGER_SECRET_REJECTED/);
  const opaqueValue = ['violet', 'river', 'opaque', 'value', '42'].join('-');
  let depthExhaustion = opaqueValue;
  for (let depth = 0; depth < 5; depth += 1) depthExhaustion = Buffer.from(depthExhaustion).toString('base64');
  const depthPacket = makePacket(temp, `${JSON.stringify({ value: depthExhaustion })}\n`);
  assert.throws(() => buildWebhookPacketBundle(depthPacket, [opaqueValue]),
    /WEBHOOK_LEDGER_DECODE_DEPTH_EXCEEDED/);
  const depthBytes = Buffer.from(`${JSON.stringify({ value: depthExhaustion })}\n`);
  const depthSums = Buffer.from(`${H(depthBytes)}  evidence.json\n`);
  const storedDepthBundle = {
    contract_version: 'assesssuite-physio-webhook-ledger-packet/1.0.0',
    total_size_bytes: depthSums.length + depthBytes.length,
    files: [
      { name: 'SHA256SUMS', size_bytes: depthSums.length, sha256: H(depthSums),
        content_base64: depthSums.toString('base64') },
      { name: 'evidence.json', size_bytes: depthBytes.length, sha256: H(depthBytes),
        content_base64: depthBytes.toString('base64') },
    ],
  };
  assert.throws(() => materializeWebhookPacketBundle(storedDepthBundle,
    path.join(temp, 'expired-depth-output'), [opaqueValue]), /WEBHOOK_LEDGER_DECODE_DEPTH_EXCEEDED/);
  const distributedPacket = path.join(temp, 'distributed-packet');
  fs.mkdirSync(distributedPacket);
  const distributedEntries = [
    ['z-first.json', Buffer.from(`${JSON.stringify({ value: opaqueValue.slice(0, 12) })}\n`)],
    ['m-second.json', Buffer.from(`${JSON.stringify({ value: opaqueValue.slice(12, 21) })}\n`)],
    ['a-third.json', Buffer.from(`${JSON.stringify({ value: opaqueValue.slice(21) })}\n`)],
  ];
  for (const [name, bytes] of distributedEntries) fs.writeFileSync(path.join(distributedPacket, name), bytes);
  fs.writeFileSync(path.join(distributedPacket, 'SHA256SUMS'), distributedEntries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, bytes]) => `${H(bytes)}  ${name}\n`).join(''));
  assert.throws(() => buildWebhookPacketBundle(distributedPacket, [opaqueValue]),
    /WEBHOOK_LEDGER_DISTRIBUTED_SECRET_REJECTED/);
  const decodeBomb = makePacket(temp, `${JSON.stringify({ opaque: Buffer.alloc(2 * 1024 * 1024 + 1, 0x41)
    .toString('base64') })}\n`);
  assert.throws(() => buildWebhookPacketBundle(decodeBomb), /WEBHOOK_LEDGER_DECODE_BOUNDS_EXCEEDED/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('packet inventory rejects case collisions, Unicode names, binary containers and noncanonical sums', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-inventory-attacks-'));
  const bundleFromFiles = (entries) => {
    const files = [...entries].sort(([left], [right]) => left.localeCompare(right)).map(([name, bytes]) => ({
      name, size_bytes: bytes.length, sha256: H(bytes), content_base64: bytes.toString('base64'),
    }));
    return { contract_version: 'assesssuite-physio-webhook-ledger-packet/1.0.0',
      total_size_bytes: files.reduce((sum, row) => sum + row.size_bytes, 0), files };
  };
  const lower = Buffer.from('{"result":"PASS"}\n');
  const upper = Buffer.from('{"result":"PASS"}\n');
  const caseSums = Buffer.from(`${H(upper)}  Evidence.json\n${H(lower)}  evidence.json\n`);
  assert.throws(() => materializeWebhookPacketBundle(bundleFromFiles([
    ['Evidence.json', upper], ['SHA256SUMS', caseSums], ['evidence.json', lower],
  ]), path.join(temp, 'case-output')), /WEBHOOK_LEDGER_PACKET_INVALID/);
  const unicode = Buffer.from('{"result":"PASS"}\n');
  const unicodeSums = Buffer.from(`${H(unicode)}  evidencé.json\n`);
  assert.throws(() => materializeWebhookPacketBundle(bundleFromFiles([
    ['SHA256SUMS', unicodeSums], ['evidencé.json', unicode],
  ]), path.join(temp, 'unicode-output')), /WEBHOOK_LEDGER_PACKET_INVALID/);
  const binaryDirectory = path.join(temp, 'binary-packet');
  fs.mkdirSync(binaryDirectory);
  const binary = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x41, 0x42, 0x43]);
  fs.writeFileSync(path.join(binaryDirectory, 'evidence.json'), binary);
  fs.writeFileSync(path.join(binaryDirectory, 'SHA256SUMS'), `${H(binary)}  evidence.json\n`);
  assert.throws(() => buildWebhookPacketBundle(binaryDirectory), /WEBHOOK_LEDGER_BINARY_REJECTED/);
  const noncanonical = makePacket(temp);
  fs.writeFileSync(path.join(noncanonical, 'SHA256SUMS'), `${H('{"result":"PASS"}\n')}  evidence.json`);
  assert.throws(() => buildWebhookPacketBundle(noncanonical), /WEBHOOK_LEDGER_PACKET_SUMS_INVALID/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('history pagination exhausts beyond the first 100 global commits', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-pagination-'));
  const fixture = new FakeGitHub();
  const packet = buildWebhookPacketBundle(addCompensationPhaseMember(makePacket(temp), 0));
  for (let index = 0; index < 101; index += 1) {
    const app = H(`pagination-app-${index}`).slice(0, 40);
    const lifecycleValue = lifecycle({ started: H(`pagination-started-${index}`) });
    await appendWebhookLedgerRecord({ client: fixture.client(), repository, applicationSha: app,
      request: { packet,
        source: source({ app, id: 1000 + index, run: 2000 + index,
          receipt: lifecycleValue.control_receipt_sha256 }),
        lifecycle: lifecycleValue },
      recordedAt: '2026-08-22T12:00:00.000Z' });
  }
  const inventory = await inspectWebhookLedger({ client: fixture.client(), repository });
  assert.equal(inventory.audited_commit_count, 103);
  assert.ok(fixture.historyPagesRequested.has(2));
  fs.rmSync(temp, { recursive: true, force: true });
});

test('archive receipt is exact, nested, and rejects forgery', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-ledger-receipt-'));
  const fixture = new FakeGitHub();
  const appended = await append(fixture, makePacket(temp), { id: 30, run: 31, kind: 'COMPLETED',
    result: 'COMPLETED' });
  const receipt = buildWebhookArchiveReceipt(appended, '2026-08-22T12:01:00.000Z');
  const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
  const expected = { repository, applicationSha, archiveArtifactId: 44,
    archiveArtifactDigest: `sha256:${H('archive')}`,
    archiveArtifactName: `physio-webhook-archive-${applicationSha}`,
    archiveReceiptSha256: H(bytes) };
  assert.equal(validateWebhookArchiveReceipt(receipt, expected), receipt);
  assert.throws(() => validateWebhookArchiveReceipt({ ...receipt, ledger_record_sha256: H('forged') }, expected),
    /WEBHOOK_LEDGER_RECEIPT_INVALID|WEBHOOK_LEDGER_MATERIALIZATION_INVALID/);
  const forgedControl = { ...receipt, lifecycle_control_receipt_sha256: H('different-valid-looking-final') };
  const forgedExpected = { ...expected,
    archiveReceiptSha256: H(`${JSON.stringify(forgedControl, null, 2)}\n`) };
  assert.throws(() => validateWebhookArchiveReceipt(forgedControl, forgedExpected),
    /WEBHOOK_LEDGER_RECEIPT_INVALID/);
  const forgedName = { ...receipt,
    source_artifact_name: `physio-production-stripe-webhook-${otherApplicationSha}` };
  assert.throws(() => validateWebhookArchiveReceipt(forgedName, { ...expected,
    archiveReceiptSha256: H(`${JSON.stringify(forgedName, null, 2)}\n`) }),
  /WEBHOOK_LEDGER_RECEIPT_INVALID/);
  const forgedSourceId = { ...receipt, source_artifact_id: receipt.source_artifact_id + 1 };
  await assert.rejects(materializeWebhookPacketFromLedger({ client: fixture.client(), repository,
    applicationSha, archiveReceipt: forgedSourceId, outputDirectory: path.join(temp, 'forged-source-output'),
    expectation: {} }), /WEBHOOK_LEDGER_MATERIALIZATION_INVALID/);
  for (const field of ['ledger_provisioning_commit_sha', 'ledger_provisioning_receipt_sha256']) {
    const forgedProvisioning = { ...receipt, [field]: field.endsWith('_sha256') ? H(field) : G(field) };
    await assert.rejects(materializeWebhookPacketFromLedger({ client: fixture.client(), repository,
      applicationSha, archiveReceipt: forgedProvisioning,
      outputDirectory: path.join(temp, `forged-${field}-output`), expectation: {} }),
    /WEBHOOK_LEDGER_MATERIALIZATION_INVALID/u);
  }
  fs.rmSync(temp, { recursive: true, force: true });
});

test('archive workflow contract re-runs the owning validators and uses isolated write authority', () => {
  const helper = fs.readFileSync(path.join(root, 'scripts', 'physio-webhook-ledger.mjs'), 'utf8');
  assert.match(helper, /validateCompletedStripeWebhookPacket/);
  assert.match(helper, /validateStripeWebhookCompensationPacket/);
  assert.match(helper, /materializeWebhookPacketFromLedger[\s\S]+validateWebhookPacketForArchive/);
  assert.match(helper, /\/rules\/branches\/\$\{encodeURIComponent\(WEBHOOK_LEDGER_BRANCH\)\}/);
  assert.match(helper, /provider_updated_at/);
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows',
    'physio-production-webhook-archive.yml'), 'utf8');
  const workflowDocument = yaml.load(workflow);
  const writer = workflowDocument.jobs.archive;
  assert.deepEqual(writer.permissions, { contents: 'write', actions: 'read' });
  assert.equal(writer.environment, undefined,
    'the protected-ledger writer may not inherit a production environment');
  assert.match(workflow, /permissions:\n\s+contents: read\n\s+actions: read/);
  assert.match(workflow, /archive:\n[\s\S]+permissions:\n\s+contents: write\n\s+actions: read/);
  assert.match(workflow, /--secret-env-names GITHUB_TOKEN/,
    'source archival must scan for the exact ephemeral workflow credential');
  assert.doesNotMatch(workflow, /force:\s*true|git push|gh api/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\.|id-token:\s*write|\b(?:fly|stripe)\s+|curl\s|\/v1\//u,
    'the contents-write archive job must remain provider-credential and provider-call free');
  assert.doesNotMatch(workflow, /physio-webhook-ledger\.mjs create-genesis/,
    'ordinary workflow token may not provision the protected branch or its ruleset');
});

test('publication replaces rather than adds dispatch inputs and re-admits archive, ledger and packet joins', () => {
  const source = fs.readFileSync(path.join(root, '.github', 'workflows',
    'physio-production-publish.yml'), 'utf8');
  const inputs = Object.keys(yaml.load(source).on.workflow_dispatch.inputs);
  assert.equal(inputs.length, 25);
  for (const input of [
    'stripe_webhook_archive_artifact_id',
    'stripe_webhook_archive_artifact_digest',
    'stripe_webhook_archive_receipt_sha256',
  ]) assert.ok(inputs.includes(input));
  for (const removed of [
    'stripe_webhook_artifact_id',
    'stripe_webhook_artifact_digest',
    'stripe_webhook_receipt_sha256',
  ]) assert.ok(!inputs.includes(removed));
  for (const marker of [
    "key: 'stripe_webhook_archive'",
    "workflow_path: '.github/workflows/physio-production-webhook-archive.yml'",
    'validateWebhookArchiveReceipt',
    'materializeWebhookPacketFromLedger',
    'webhook-ledger-publication-readback',
    'stripe_webhook_source_artifact_id:',
    'stripe_webhook_ledger_commit_sha:',
    'stripe_webhook_ledger_record_sha256:',
    'stripe_webhook_ledger_packet_manifest_sha256:',
  ]) assert.ok(source.includes(marker), `publication archive join is missing ${marker}`);
});
