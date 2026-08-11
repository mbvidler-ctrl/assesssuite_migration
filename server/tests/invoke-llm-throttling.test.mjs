// WP3 hardening: per-account fixed-window rate limiting and the concurrency
// cap on the general clinical InvokeLLM endpoint. server/llmAdmission.mjs
// carries the module-level detail (boundedSetting, createGeneralLlmAdmission,
// createGeneralLlmThrottle); this suite proves the HTTP-visible behaviour
// (T7-T9) plus the two properties that are only honestly testable in-process
// (T10-T11).

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { activateUser, loginAdmin, registerUser, requestJson, startTestServer } from './support/server-harness.mjs';
import { startFakeOpenAIChat } from './support/fake-openai-chat.mjs';
import { LlmAccessError, boundedSetting, createGeneralLlmAdmission } from '../llmAdmission.mjs';

const INVOKE_LLM_ROUTE = (appId) => `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`;

async function invokeLlm(server, token, body) {
  return requestJson(server, INVOKE_LLM_ROUTE(server.appId), { method: 'POST', token, body });
}

async function activatedClinician(server, adminToken, email) {
  const user = await registerUser(server, email);
  await activateUser(server, adminToken, user.id);
  return user;
}

// T7 (RED before the fix — today the 4th call also returns 200): a
// per-account burst ceiling of 3 lets exactly 3 calls through, then refuses
// the 4th with a machine-readable code and a human-readable wait estimate.
test('T7: the per-account burst limit refuses the call after the configured ceiling', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: '',
    GENERAL_CLINICAL_LLM_USER_BURST_LIMIT: '3',
  });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await activatedClinician(server, adminToken, 'wp3-throttle-burst@example.test');

    for (let i = 0; i < 3; i += 1) {
      const result = await invokeLlm(server, clinician.token, { prompt: `synthetic ${i}` });
      assert.equal(result.status, 200, `call ${i}: ${result.text}`);
    }
    const fourth = await invokeLlm(server, clinician.token, { prompt: 'synthetic 4th' });
    assert.equal(fourth.status, 429, fourth.text);
    assert.equal(fourth.body?.code, 'llm_rate_limited', fourth.text);
    assert.match(fourth.body?.error || '', /try again in about \d+ seconds/i);
  } finally {
    await server.stop();
  }
});

// T8 (RED): the limit is per account, not global — a second clinician on the
// same server is unaffected by the first clinician's exhausted burst window.
test('T8: the per-account burst limit does not lock out a different clinician', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: '',
    GENERAL_CLINICAL_LLM_USER_BURST_LIMIT: '3',
  });
  try {
    const adminToken = await loginAdmin(server);
    const first = await activatedClinician(server, adminToken, 'wp3-throttle-first@example.test');
    const second = await activatedClinician(server, adminToken, 'wp3-throttle-second@example.test');

    for (let i = 0; i < 3; i += 1) {
      const result = await invokeLlm(server, first.token, { prompt: `synthetic ${i}` });
      assert.equal(result.status, 200, `first clinician call ${i}: ${result.text}`);
    }
    const exhausted = await invokeLlm(server, first.token, { prompt: 'synthetic exhausted' });
    assert.equal(exhausted.status, 429, exhausted.text);

    const stillOk = await invokeLlm(server, second.token, { prompt: 'synthetic second clinician' });
    assert.equal(stillOk.status, 200, stillOk.text);
  } finally {
    await server.stop();
  }
});

// T9 (RED): the global ceiling is the cost cap of last resort, independent
// of how generous the per-user burst limit is.
test('T9: the global rate ceiling refuses a request once the shared window is exhausted', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: '',
    GENERAL_CLINICAL_LLM_USER_BURST_LIMIT: '60',
    GENERAL_CLINICAL_LLM_GLOBAL_LIMIT: '2',
  });
  try {
    const adminToken = await loginAdmin(server);
    const first = await activatedClinician(server, adminToken, 'wp3-throttle-global-a@example.test');
    const second = await activatedClinician(server, adminToken, 'wp3-throttle-global-b@example.test');

    const one = await invokeLlm(server, first.token, { prompt: 'global one' });
    assert.equal(one.status, 200, one.text);
    const two = await invokeLlm(server, second.token, { prompt: 'global two' });
    assert.equal(two.status, 200, two.text);
    const three = await invokeLlm(server, first.token, { prompt: 'global three' });
    assert.equal(three.status, 429, three.text);
    assert.equal(three.body?.code, 'llm_rate_limited', three.text);
  } finally {
    await server.stop();
  }
});

// T12 (RED before the fix — today a busy rejection has already burned a
// burst-limit token): a concurrency 429 (llm_busy) must not cost the caller
// any of their per-minute burst allowance, exactly as the size ceiling
// already documents for itself ("checked before the rate limiter is
// consumed so a junk-sized request is rejected without burning the caller's
// window" — server/llmAdmission.mjs). The real chat/completions fake is used
// (loopback-only, synthetic key) so the first call genuinely holds its
// concurrency slot across an await, instead of racing the deterministic
// mock's synchronous return (see T10's comment on why that would be flaky).
test('T12: a concurrency 429 (llm_busy) does not consume a burst-limit token', async () => {
  const fakeChat = await startFakeOpenAIChat();
  fakeChat.setMode('timeout');
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: 'synthetic-llm-busy-refund-canary',
    OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
    // The fake provider's 'timeout' mode holds for 5s; the client aborts
    // after this much shorter window, so the first call keeps its
    // concurrency slot for a known, generous interval without the test
    // itself waiting 5 seconds.
    OPENAI_CHAT_TEST_TIMEOUT_MS: '300',
    GENERAL_CLINICAL_LLM_USER_CONCURRENCY: '1',
    GENERAL_CLINICAL_LLM_USER_BURST_LIMIT: '2',
  });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await activatedClinician(server, adminToken, 'wp3-llm-busy-refund@example.test');

    const first = invokeLlm(server, clinician.token, { prompt: 'holds the slot' });
    // Give the first call a head start so it has consumed its concurrency
    // slot (a synchronous step, reached long before the 300ms provider
    // abort) before the second call is dispatched.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const busy = await invokeLlm(server, clinician.token, { prompt: 'refused for busyness' });
    assert.equal(busy.status, 429, busy.text);
    assert.equal(busy.body?.code, 'llm_busy', busy.text);

    const firstResult = await first;
    assert.equal(firstResult.status, 200, firstResult.text);

    // With a burst limit of 2: the first call spent one token, and the busy
    // rejection above must not have spent the second. This third call is
    // therefore only the SECOND consumption and must succeed; if the busy
    // rejection had already burned a token, this would be the third
    // consumption and would be refused with llm_rate_limited instead.
    const third = await invokeLlm(server, clinician.token, { prompt: 'still within the burst budget' });
    assert.equal(third.status, 200, third.text);
  } finally {
    await server.stop();
    await fakeChat.stop();
  }
});

// T10 (unit, deterministic — RED because server/llmAdmission.mjs does not
// exist yet). Why concurrency is not driven over HTTP: with the deterministic
// mock there is no `await` between slot acquire and return
// (instantiateSchema is synchronous), so two in-flight requests can never
// overlap inside the slot — an HTTP concurrency test would be structurally
// flaky. This in-process unit test is the honest form.
test('T10: createGeneralLlmAdmission enforces per-account and global concurrency caps', () => {
  const admission = createGeneralLlmAdmission({ globalMax: 2, userMax: 1 });

  const releaseU1 = admission.acquire('u1');
  assert.throws(
    () => admission.acquire('u1'),
    (error) => error instanceof LlmAccessError && error.httpStatus === 429 && error.code === 'llm_busy',
  );

  const releaseU2 = admission.acquire('u2');
  assert.throws(
    () => admission.acquire('u3'),
    (error) => error instanceof LlmAccessError && error.httpStatus === 429 && error.code === 'llm_busy',
  );

  releaseU1();
  assert.equal(admission.active().global, 1);
  const releaseU1Again = admission.acquire('u1');
  assert.equal(admission.active().global, 2);

  // A repeated release is a no-op, not a double decrement.
  releaseU1();
  releaseU1();
  assert.equal(admission.active().global, 2);

  releaseU1Again();
  releaseU2();
  assert.equal(admission.active().global, 0);
  assert.equal(admission.active().users.size, 0);
});

// T11: boundedSetting ignores garbage/out-of-range low values (falls back)
// and clamps an over-large value to the maximum — an operator cannot widen
// the cap past the hard bound, nor fail it open with a bad value.
test('T11: boundedSetting falls back on garbage/out-of-range-low and clamps out-of-range-high', () => {
  const spec = { name: 'WP3_TEST_BOUNDED_SETTING', fallback: 5, min: 1, max: 10 };
  assert.equal(boundedSetting({ [spec.name]: 'abc' }, spec.name, spec.fallback, spec.min, spec.max), 5);
  assert.equal(boundedSetting({ [spec.name]: '0' }, spec.name, spec.fallback, spec.min, spec.max), 5);
  assert.equal(boundedSetting({ [spec.name]: '-1' }, spec.name, spec.fallback, spec.min, spec.max), 5);
  assert.equal(boundedSetting({ [spec.name]: '999' }, spec.name, spec.fallback, spec.min, spec.max), 10);
  assert.equal(boundedSetting({ [spec.name]: '7' }, spec.name, spec.fallback, spec.min, spec.max), 7);
  assert.equal(boundedSetting({}, spec.name, spec.fallback, spec.min, spec.max), 5);
});

test('T13: a real InvokeLLM call is durably settled from provider usage without changing its response shape', async () => {
  const fakeChat = await startFakeOpenAIChat();
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
    OPENAI_API_KEY: 'synthetic-durable-usage-canary',
    OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
  });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await activatedClinician(server, adminToken, 'durable-usage@example.test');
    const result = await invokeLlm(server, clinician.token, { prompt: 'Return a short clinical summary.' });
    assert.equal(result.status, 200, result.text);
    assert.equal(typeof result.body, 'string', 'the public InvokeLLM contract must remain a bare string');
    assert.equal(fakeChat.calls.length, 1);
    assert.equal(fakeChat.calls[0].maxCompletionTokens, 32_768);

    const auditDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const row = auditDb.prepare(`
        SELECT feature, model, status, estimated_cost_microusd, actual_cost_microusd,
               input_tokens, cached_input_tokens, output_tokens, provider_request_id_hash
        FROM api_usage_reservation
      `).get();
      assert.equal(row.feature, 'invoke_llm');
      assert.equal(row.model, 'gpt-4.1-mini');
      assert.equal(row.status, 'succeeded');
      assert.equal(row.estimated_cost_microusd, 70_000);
      assert.equal(row.actual_cost_microusd, 82);
      assert.equal(row.input_tokens, 100);
      assert.equal(row.cached_input_tokens, 20);
      assert.equal(row.output_tokens, 30);
      assert.match(row.provider_request_id_hash, /^[a-f0-9]{64}$/);
    } finally {
      auditDb.close();
    }
  } finally {
    await server.stop();
    await fakeChat.stop();
  }
});

test('T14: durable per-user denial occurs before a second provider call', async () => {
  const fakeChat = await startFakeOpenAIChat();
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
    OPENAI_API_KEY: 'synthetic-durable-cap-canary',
    OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
    AI_USAGE_USER_ROLLING_24H_CALLS: '1',
  });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await activatedClinician(server, adminToken, 'durable-cap@example.test');
    const first = await invokeLlm(server, clinician.token, { prompt: 'first paid request' });
    assert.equal(first.status, 200, first.text);

    const denied = await invokeLlm(server, clinician.token, { prompt: 'must not reach provider' });
    assert.equal(denied.status, 429, denied.text);
    assert.equal(denied.body?.code, 'api_usage_cap_reached');
    assert.equal(typeof denied.body?.resets_at, 'string');
    assert.equal(Number.isInteger(denied.body?.retry_after_seconds), true);
    assert.equal(fakeChat.calls.length, 1, 'quota denial must happen before provider egress');

    const auditDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      assert.equal(
        Number(auditDb.prepare('SELECT COUNT(*) AS count FROM api_usage_reservation').get().count),
        1,
        'a denied call is not itself a usage reservation',
      );
    } finally {
      auditDb.close();
    }
  } finally {
    await server.stop();
    await fakeChat.stop();
  }
});
