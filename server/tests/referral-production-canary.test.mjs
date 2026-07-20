import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  CHECK_NAMES,
  REQUIRED_CANARY_ACKNOWLEDGEMENT,
  runIsolatedReferralCanary,
  runProductionReferralCanary,
} from '../../scripts/referral-production-canary.mjs';
import { startFakeOpenAI } from './support/fake-openai.mjs';
import { startTestServer } from './support/server-harness.mjs';

test('isolated server proves its actual listener is loopback-only', async () => {
  const server = await startTestServer({ ASSESSSUITE_BIND_HOST: '0.0.0.0' });
  try {
    assert.equal(server.listenerAddress, '127.0.0.1');
    assert.equal(Number.isInteger(server.listenerPort), true);
    assert.equal(new URL(server.baseUrl).hostname, server.listenerAddress);
    assert.equal(Number(new URL(server.baseUrl).port), server.listenerPort);
  } finally {
    await server.stop();
  }
});

test('production referral canary refuses execution unless every production gate is exact', async () => {
  const releaseSha = 'a'.repeat(40);
  const base = {
    NODE_ENV: 'production',
    RELEASE_SHA: releaseSha,
    RUN_REFERRAL_PRODUCTION_CANARY: REQUIRED_CANARY_ACKNOWLEDGEMENT,
    ALLOW_PAID_PROVIDER_PROBE: '1',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    OPENAI_API_KEY: 'not-emitted-test-credential',
  };

  for (const key of Object.keys(base)) {
    const environment = { ...base };
    delete environment[key];
    const summary = await runProductionReferralCanary(environment);
    assert.equal(summary.result, 'REFUSED', key);
    assert.equal(summary.failure_stage, 'gate', key);
    assert.equal(summary.isolation.production_database_writes, 0, key);
    assert.equal(summary.isolation.production_upload_writes, 0, key);
  }

  for (const forbidden of ['DOCUMENT_EXTRACTION_TEST_BASE_URL', 'OPENAI_DOCUMENT_EXTRACTION_MODEL']) {
    const summary = await runProductionReferralCanary({ ...base, [forbidden]: 'forbidden-override' });
    assert.equal(summary.result, 'REFUSED', forbidden);
  }
});

test('isolated canary exercises the full installed-SDK journey against a local provider', async () => {
  const provider = await startFakeOpenAI();
  try {
    const summary = await runIsolatedReferralCanary({
      providerMode: 'local-test',
      testProviderBaseUrl: provider.baseUrl,
      releaseSha: 'b'.repeat(40),
      gatesAccepted: true,
    });
    assert.equal(summary.result, 'PASS');
    assert.equal(summary.failure_stage, null);
    assert.equal(summary.checks.real_provider_mode, false);
    for (const check of CHECK_NAMES.filter((name) => name !== 'real_provider_mode')) {
      assert.equal(summary.checks[check], true, check);
    }
    assert.equal(summary.isolation.production_database_writes, 0);
    assert.equal(summary.isolation.production_upload_writes, 0);
    assert.equal(summary.isolation.external_email_sends, 0);
    assert.equal(provider.calls.length, 1);
  } finally {
    await provider.stop();
  }
});

test('output firewall accepts only the fixed content-free summary schema', async () => {
  const provider = await startFakeOpenAI();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-canary-output-'));
  try {
    const summary = await runIsolatedReferralCanary({
      providerMode: 'local-test',
      testProviderBaseUrl: provider.baseUrl,
      releaseSha: 'c'.repeat(40),
      gatesAccepted: true,
    });
    // The production validator requires real-provider mode for PASS. Convert
    // that one mode bit only; all journey checks were executed above.
    summary.checks.real_provider_mode = true;
    const acceptedPath = path.join(tempRoot, 'accepted.jsonl');
    fs.writeFileSync(acceptedPath, `${JSON.stringify(summary)}\n`, { mode: 0o600 });
    const accepted = spawnSync(
      process.execPath,
      ['scripts/validate-referral-production-canary-output.mjs', acceptedPath],
      { cwd: path.resolve('.'), encoding: 'utf8' },
    );
    assert.equal(accepted.status, 0, accepted.stderr);

    const rejectedPath = path.join(tempRoot, 'rejected.jsonl');
    fs.writeFileSync(
      rejectedPath,
      `${JSON.stringify({ ...summary, provider_output: 'synthetic content must not pass' })}\n`,
      { mode: 0o600 },
    );
    const rejected = spawnSync(
      process.execPath,
      ['scripts/validate-referral-production-canary-output.mjs', rejectedPath],
      { cwd: path.resolve('.'), encoding: 'utf8' },
    );
    assert.notEqual(rejected.status, 0);
    assert.doesNotMatch(rejected.stderr, /synthetic content must not pass/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    await provider.stop();
  }
});
