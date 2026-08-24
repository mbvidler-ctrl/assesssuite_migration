#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createDeployLedgerGitHubClient,
  inventoryDeployLedger,
} from './physio-deploy-ledger.mjs';

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      fail('DEPLOY_LEDGER_BARRIER_ARGUMENT_INVALID', token);
    }
    const key = token.slice(2);
    if (Object.hasOwn(args, key)) fail('DEPLOY_LEDGER_BARRIER_ARGUMENT_DUPLICATE', key);
    args[key] = argv[++index];
  }
  return args;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function effectReceiptSha256(packetDirectory) {
  const file = `${packetDirectory}/deploy-effect-reconciliation.json`;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 2_097_152) {
    fail('DEPLOY_LEDGER_BARRIER_EFFECT_INVALID', file);
  }
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function exactRecord(inventory, artifactId, artifactDigest, effectReceipt) {
  const matches = inventory.records.filter((entry) => entry.record.artifact.id === artifactId);
  if (matches.length > 1) fail('DEPLOY_LEDGER_BARRIER_DUPLICATE_ARTIFACT', String(artifactId));
  const match = matches[0] ?? null;
  if (match && (match.record.artifact.digest !== artifactDigest ||
      match.record.effect_receipt_sha256 !== effectReceipt)) {
    fail('DEPLOY_LEDGER_BARRIER_JOIN_INVALID', String(artifactId));
  }
  if (match && inventory.latest_record?.artifact.id !== artifactId) {
    fail('DEPLOY_LEDGER_BARRIER_NOT_TIP', String(artifactId));
  }
  if (!match && inventory.latest_record && inventory.latest_record.artifact.id >= artifactId) {
    fail('DEPLOY_LEDGER_BARRIER_OUTRUN', String(artifactId));
  }
  return match;
}

export async function enforceDeployLedgerBarrier({ repository, applicationSha, artifactId, artifactDigest,
  sourceRunId, sourceRunAttempt, packetDirectory, provisioningReceiptSha256, token,
  client, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maximumPolls = 120, now = () => new Date() }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository || '') ||
      !SHA40.test(applicationSha || '') || !Number.isSafeInteger(artifactId) || artifactId <= 0 ||
      !/^sha256:[0-9a-f]{64}$/u.test(artifactDigest || '') ||
      !Number.isSafeInteger(sourceRunId) || sourceRunId <= 0 ||
      !Number.isSafeInteger(sourceRunAttempt) || sourceRunAttempt <= 0 ||
      !SHA256.test(provisioningReceiptSha256 || '') || !Number.isSafeInteger(maximumPolls) ||
      maximumPolls < 1 || maximumPolls > 240) {
    fail('DEPLOY_LEDGER_BARRIER_ARGUMENT_INVALID', 'identity differs');
  }
  const github = client ?? createDeployLedgerGitHubClient({ repository, token });
  const effectReceipt = effectReceiptSha256(packetDirectory);
  let inventory = await inventoryDeployLedger({ client: github, repository, applicationSha });
  if (inventory.ledger_provisioning_receipt_sha256 !== provisioningReceiptSha256) {
    fail('DEPLOY_LEDGER_BARRIER_PROVISIONING_MISMATCH', 'exact L5 receipt differs');
  }
  let record = exactRecord(inventory, artifactId, artifactDigest, effectReceipt);
  let dispatched = false;
  let dispatchResponseLost = false;
  const dispatch = {
    ref: 'main',
    inputs: {
      application_sha: applicationSha,
      source_artifact_id: String(artifactId),
      source_artifact_digest: artifactDigest,
      source_run_id: String(sourceRunId),
      source_run_attempt: String(sourceRunAttempt),
      confirmation: `ARCHIVE DEPLOY PACKET ${applicationSha} ${artifactId}`,
    },
  };
  const dispatchRequestSha256 = createHash('sha256').update(canonicalJson(dispatch)).digest('hex');
  if (!record) {
    try {
      await github.request('POST', '/actions/workflows/physio-deploy-ledger-archive.yml/dispatches', dispatch, [204]);
      dispatched = true;
    } catch {
      dispatchResponseLost = true;
    }
    for (let poll = 0; poll < maximumPolls; poll += 1) {
      if (poll > 0) await sleep(5_000);
      try {
        inventory = await inventoryDeployLedger({ client: github, repository, applicationSha });
        if (inventory.ledger_provisioning_receipt_sha256 !== provisioningReceiptSha256) {
          fail('DEPLOY_LEDGER_BARRIER_PROVISIONING_MISMATCH', 'receipt drift during polling');
        }
        record = exactRecord(inventory, artifactId, artifactDigest, effectReceipt);
        if (record) break;
      } catch (error) {
        if (/BARRIER_(?:OUTRUN|JOIN|DUPLICATE|NOT_TIP|PROVISIONING)/u.test(error.message)) throw error;
      }
    }
  }
  if (!record) fail('DEPLOY_LEDGER_BARRIER_TIMEOUT', String(artifactId));
  return {
    contract_version: 'assesssuite-physio-deploy-ledger-barrier/1.0.0', result: 'PASS', repository,
    application_sha: applicationSha, source_artifact_id: artifactId,
    source_artifact_digest: artifactDigest, source_run_id: sourceRunId,
    source_run_attempt: sourceRunAttempt, effect_receipt_sha256: effectReceipt,
    provisioning_receipt_sha256: provisioningReceiptSha256,
    dispatch_request_sha256: dispatchRequestSha256, dispatch_confirmed: dispatched,
    dispatch_response_lost_or_rejected: dispatchResponseLost,
    ledger_record_sha256: record.sha256, ledger_commit_sha: record.commit_sha,
    ledger_head_sha: inventory.ledger_head_sha, packet_ordinal: record.record.packet_ordinal,
    phase: record.record.phase, completed_at: now().toISOString(),
  };
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (!args.output) fail('DEPLOY_LEDGER_BARRIER_ARGUMENT_INVALID', '--output is required');
  const result = await enforceDeployLedgerBarrier({
    repository: args.repository,
    applicationSha: args['application-sha'],
    artifactId: Number(args['artifact-id']),
    artifactDigest: args['artifact-digest'],
    sourceRunId: Number(args['source-run-id']),
    sourceRunAttempt: Number(args['source-run-attempt']),
    packetDirectory: args['packet-directory'],
    provisioningReceiptSha256: args['provisioning-receipt-sha256'],
    token: options.token ?? process.env.GITHUB_TOKEN,
    client: options.client,
    sleep: options.sleep,
    maximumPolls: options.maximumPolls,
    now: options.now,
  });
  fs.writeFileSync(args.output, canonicalJson(result), { flag: 'wx', mode: 0o600 });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
