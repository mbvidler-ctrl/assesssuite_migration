// WP3 hardening: the clinical release gate and the prompt/schema size
// ceiling on the general clinical InvokeLLM endpoint. Existing coverage
// (extraction-matrix.test.mjs E37/E37a, clinical-ai-feature-matrix.test.mjs)
// only proved the flag-on/flag-off behaviour with the bootstrap admin, which
// bootstrapAdmin() creates with no country/profession — so it is NEVER
// clinically eligible under isInitialClinicalReleaseEligible. This suite
// proves the eligibility/account-status gate itself, independent of the flag.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activateUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const INVOKE_LLM_ROUTE = (appId) => `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`;

async function invokeLlm(server, token, body) {
  return requestJson(server, INVOKE_LLM_ROUTE(server.appId), { method: 'POST', token, body });
}

const MEDICATION_ALERTS_SCHEMA = {
  type: 'object',
  properties: {
    alerts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          medication_name: { type: 'string' },
          alert_text: { type: 'string' },
        },
        required: ['medication_name', 'alert_text'],
      },
    },
  },
  required: ['alerts'],
};

// T1 (RED before the fix — today returns 200 with the mock prose string):
// a registered, unapproved user with no country/profession and
// account_status: 'pending' must be refused before InvokeLLM ever runs.
test('T1: an unapproved registered user is refused with clinical_release_unavailable', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0', OPENAI_API_KEY: '' });
  try {
    const user = await registerUser(server, 'wp3-unapproved@example.test');
    const result = await invokeLlm(server, user.token, { prompt: 'synthetic' });
    assert.equal(result.status, 403, result.text);
    assert.equal(result.body?.code, 'clinical_release_unavailable', result.text);
  } finally {
    await server.stop();
  }
});

// T2: eligible profile (country + profession) but still pending must be
// refused independently, with a distinct code — proves the two gate limbs
// are independent.
test('T2: an eligible-profile but still-pending user is refused with account_inactive', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0', OPENAI_API_KEY: '' });
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'wp3-eligible-pending@example.test');
    const update = await requestJson(server, `/api/apps/${server.appId}/entities/User/${user.id}`, {
      method: 'PUT',
      token: adminToken,
      body: { country: 'australia', profession: 'Exercise Physiologist' },
    });
    assert.equal(update.status, 200, update.text);
    const result = await invokeLlm(server, user.token, { prompt: 'synthetic' });
    assert.equal(result.status, 403, result.text);
    assert.equal(result.body?.code, 'account_inactive', result.text);
  } finally {
    await server.stop();
  }
});

// T3: active account_status but no country/profession must still be refused
// on the eligibility limb, proving account_status alone is not sufficient.
test('T3: an active but ineligible-profile user is refused with clinical_release_unavailable', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0', OPENAI_API_KEY: '' });
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'wp3-active-ineligible@example.test');
    const update = await requestJson(server, `/api/apps/${server.appId}/entities/User/${user.id}`, {
      method: 'PUT',
      token: adminToken,
      body: { account_status: 'active' },
    });
    assert.equal(update.status, 200, update.text);
    const result = await invokeLlm(server, user.token, { prompt: 'synthetic' });
    assert.equal(result.status, 403, result.text);
    assert.equal(result.body?.code, 'clinical_release_unavailable', result.text);
  } finally {
    await server.stop();
  }
});

// T4 (GREEN both before and after — the no-regression guard): a fully
// activated clinician keeps working for both InvokeLLM shapes, including the
// MedicationAlerts-shaped schema.
test('T4: a fully activated clinician can still call InvokeLLM (plain prompt and schema)', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0', OPENAI_API_KEY: '' });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await registerUser(server, 'wp3-active-eligible@example.test');
    await activateUser(server, adminToken, clinician.id);

    const plain = await invokeLlm(server, clinician.token, { prompt: 'Write a short clinical note.' });
    assert.equal(plain.status, 200, plain.text);
    assert.equal(typeof plain.body, 'string');
    assert.match(plain.body, /placeholder narrative content generated by the local InvokeLLM mock/i);

    const schema = await invokeLlm(server, clinician.token, {
      prompt: 'Give medication alerts',
      response_json_schema: MEDICATION_ALERTS_SCHEMA,
    });
    assert.equal(schema.status, 200, schema.text);
    assert.ok(Array.isArray(schema.body?.alerts));
    assert.equal(typeof schema.body.alerts[0].medication_name, 'string');
    assert.equal(typeof schema.body.alerts[0].alert_text, 'string');
  } finally {
    await server.stop();
  }
});

// T5 (GREEN before and after — ordering/no-leak guard): the flag-off 503
// fires ahead of the new gate, byte-identical to the pre-existing rollback
// posture, even for a fully eligible user.
test('T5: the flag-off 503 still fires before the eligibility gate, for a fully eligible user', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await registerUser(server, 'wp3-flag-off-eligible@example.test');
    await activateUser(server, adminToken, clinician.id);
    const result = await invokeLlm(server, clinician.token, { prompt: 'synthetic' });
    assert.equal(result.status, 503, result.text);
    assert.equal(result.body?.error, 'General AI generation is disabled on this server.');
  } finally {
    await server.stop();
  }
});

// T7 (RED before the fix — today the admin gets 403 clinical_release_
// unavailable): the bootstrap admin (no country/profession, so never
// clinically eligible under isInitialClinicalReleaseEligible) must be
// exempted from the eligibility gate the same way the functions router
// exempts admins (server/functions/index.mjs:167-172), so the admin-only
// Assessment Audit AI surface (src/pages/AssessmentAudit.jsx) keeps working.
test('T7: the bootstrap admin is exempt from the clinical-eligibility gate (plain prompt and schema)', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0', OPENAI_API_KEY: '' });
  try {
    const adminToken = await loginAdmin(server);

    const plain = await invokeLlm(server, adminToken, { prompt: 'Write a short clinical note.' });
    assert.equal(plain.status, 200, plain.text);
    assert.equal(typeof plain.body, 'string');
    assert.match(plain.body, /placeholder narrative content generated by the local InvokeLLM mock/i);

    const schema = await invokeLlm(server, adminToken, {
      prompt: 'Give medication alerts',
      response_json_schema: MEDICATION_ALERTS_SCHEMA,
    });
    assert.equal(schema.status, 200, schema.text);
    assert.ok(Array.isArray(schema.body?.alerts));
  } finally {
    await server.stop();
  }
});

// T6: the prompt/schema size ceiling — required and bounded.
test('T6: a missing prompt is refused with prompt_required, an oversized prompt with prompt_too_large', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0', OPENAI_API_KEY: '' });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await registerUser(server, 'wp3-size-ceiling@example.test');
    await activateUser(server, adminToken, clinician.id);

    const missing = await invokeLlm(server, clinician.token, {});
    assert.equal(missing.status, 400, missing.text);
    assert.equal(missing.body?.code, 'prompt_required', missing.text);

    const oversized = await invokeLlm(server, clinician.token, { prompt: 'x'.repeat(40_000) });
    assert.equal(oversized.status, 413, oversized.text);
    assert.equal(oversized.body?.code, 'prompt_too_large', oversized.text);
  } finally {
    await server.stop();
  }
});
