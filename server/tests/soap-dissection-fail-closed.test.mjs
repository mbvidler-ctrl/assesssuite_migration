// dissect_to_soap fail-closed + explicit simulation labelling.
//
// Unlike extraction-matrix.test.mjs's transcribe-action coverage, dissect_to_soap
// touches no db/entities/uploads — it only reads env vars and calls
// invokeLLM/deidentify. These tests therefore do not spawn a child server
// process via server-harness.mjs; they import server/functions/transcribeSession.mjs
// directly (once, at module load) and drive its default export with a
// synthetic ctx, matching the in-process style used to empirically confirm
// this defect. All relevant env reads inside the handler happen at call
// time (not import time), so no ESM cache-busting is required between cases.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import transcribeSession from '../functions/transcribeSession.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const TRANSCRIBE_SESSION_SOURCE = path.join(repoRoot, 'server', 'functions', 'transcribeSession.mjs');

const SAMPLE_TRANSCRIPT = 'Clinician: How are you? Client: Better, still stiff mornings.';

async function withEnvironment(overrides, operation) {
  const previous = Object.fromEntries(
    Object.keys(overrides).map((name) => [name, process.env[name]]),
  );
  try {
    for (const [name, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return await operation();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function ctx(body) {
  return {
    body,
    user: { id: 'u1', email: 'clinician@example.test' },
    respond: (status, respBody) => ({ status, body: respBody }),
  };
}

test('dissect_to_soap fails loud (503) when LLM_REQUIRED=1 and no provider key is configured', async () => {
  await withEnvironment(
    {
      TRANSCRIPTION_ENABLED: '1',
      SELFTEST: '0',
      LLM_REQUIRED: '1',
      OPENAI_API_KEY: undefined,
    },
    async () => {
      const result = await transcribeSession(
        ctx({ action: 'dissect_to_soap', transcript: SAMPLE_TRANSCRIPT }),
      );
      assert.equal(result.status, 503, JSON.stringify(result.body));
      assert.equal(typeof result.body.error, 'string');
      assert.ok(result.body.error.length > 0);
      // Genuinely not a mock payload — the response must never reach mockSoap().
      assert.equal(result.body.success, undefined);
      assert.equal(result.body.simulated, undefined);
      // Defence in depth: confirms the fabricated mock text never leaks into
      // an error path.
      assert.ok(!JSON.stringify(result.body).includes('improved pain levels'));
    },
  );
});

test('dissect_to_soap labels its mock output as simulated when the mock path is legitimately used under self-test', async () => {
  await withEnvironment(
    {
      SELFTEST: '1',
    },
    async () => {
      const result = await transcribeSession(
        ctx({ action: 'dissect_to_soap', transcript: SAMPLE_TRANSCRIPT }),
      );
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.success, true);
      assert.equal(result.body.simulated, true);
      // All four SOAP fields are persisted free text (SOAPNote.subjective/
      // objective/assessment/plan) — each must carry its own durable
      // simulation notice, not just subjective, or three of four fields
      // enter the record as unlabelled fabricated clinical content.
      assert.match(result.body.subjective, /simulat/i);
      assert.match(result.body.objective, /simulat/i);
      assert.match(result.body.assessment, /simulat/i);
      assert.match(result.body.plan, /simulat/i);
    },
  );
});

test('dissect_to_soap mock is still labelled outside self-test when no key is configured and LLM_REQUIRED is unset (dev/staging convenience path)', async () => {
  await withEnvironment(
    {
      TRANSCRIPTION_ENABLED: '1',
      SELFTEST: '0',
      LLM_REQUIRED: undefined,
      OPENAI_API_KEY: undefined,
    },
    async () => {
      const result = await transcribeSession(
        ctx({ action: 'dissect_to_soap', transcript: SAMPLE_TRANSCRIPT }),
      );
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.simulated, true);
      assert.match(result.body.subjective, /simulat/i);
      assert.match(result.body.objective, /simulat/i);
      assert.match(result.body.assessment, /simulat/i);
      assert.match(result.body.plan, /simulat/i);
    },
  );
});

test('dissect_to_soap serves a labelled mock (never a hard error) when no transcript is supplied, even under LLM_REQUIRED=1', async () => {
  // Scope boundary, not a regression target (design decision D4): the empty-
  // transcript case is caller-input, not a provider failure, and this must
  // stay green both before and after the fix.
  await withEnvironment(
    {
      TRANSCRIPTION_ENABLED: '1',
      SELFTEST: '0',
      LLM_REQUIRED: '1',
      OPENAI_API_KEY: undefined,
    },
    async () => {
      const result = await transcribeSession(
        ctx({ action: 'dissect_to_soap', transcript: '' }),
      );
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.simulated, true);
      assert.equal(result.body.success, true);
    },
  );
});

test('the real-dissection success response always carries simulated: false (static check)', () => {
  // Deliberate lighter-weight check, not a behavioural test: transcribeSession.mjs
  // imports invokeLLM directly from ../llm.mjs with no injection seam, so
  // exercising the true real-provider-success branch offline is not possible
  // without either a live OpenAI call (forbidden) or a new DI seam (out of
  // scope for this fix). Instead we statically assert the real-result
  // respond() call always sets simulated: false exactly once.
  const source = fs.readFileSync(TRANSCRIBE_SESSION_SOURCE, 'utf8');
  const matches = source.match(/simulated: false/g) || [];
  assert.equal(matches.length, 1, 'expected exactly one "simulated: false" in transcribeSession.mjs');
});
