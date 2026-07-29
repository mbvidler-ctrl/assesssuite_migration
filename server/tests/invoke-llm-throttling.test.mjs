// WP3 hardening: per-account fixed-window rate limiting and the concurrency
// cap on the general clinical InvokeLLM endpoint. server/llmAdmission.mjs
// carries the module-level detail (boundedSetting, createGeneralLlmAdmission,
// createGeneralLlmThrottle); this suite proves the HTTP-visible behaviour
// (T7-T9) plus the two properties that are only honestly testable in-process
// (T10-T11).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activateUser, loginAdmin, registerUser, requestJson, startTestServer } from './support/server-harness.mjs';
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
