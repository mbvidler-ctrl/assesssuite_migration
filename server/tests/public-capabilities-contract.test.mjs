import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activateUser, startTestServer, registerUser, requestJson, loginAdmin } from './support/server-harness.mjs';

// Every predicate this endpoint publishes is also the enforcement predicate
// at the call site (server/capabilities.mjs). This suite is the pinned proof
// that publication and enforcement never drift apart again — the 21-28 July
// 2026 outage was invisible to every client precisely because no channel
// reported the server-level posture that the endpoints were already
// enforcing. No cell here sets a real provider key, so no request ever
// leaves the machine.

const ALLOWED_REASONS = new Set(['available', 'switched_off', 'unconfigured']);

// The /public-settings route is unauthenticated (server/index.mjs's
// isPublicRoute allow-list), so an anonymous caller now gets only a coarse
// general_clinical_llm.available boolean, with the switched_off/unconfigured
// reason withheld — that distinction discloses whether a provider credential
// is currently present on the server. A caller presenting a valid bearer
// token still gets the full tri-state, which is what the parity checks below
// (publication == enforcement) need, so they pass an authenticated token.
async function fetchPublicSettings(server, token) {
  return requestJson(server, `/api/apps/public/prod/public-settings/by-id/${server.appId}`, { token });
}

// WP3 hardening added a clinical-release gate to InvokeLLM: the bootstrap
// admin has no country/profession, so it is never clinically eligible (see
// src/lib/clinicalRelease.js). Every check in this suite that expects
// InvokeLLM to reach the flag/posture branch under test (rather than being
// refused on eligibility first) needs a provisioned, fully activated
// clinician instead of the plain admin token.
async function loginEligibleClinician(server) {
  const adminToken = await loginAdmin(server);
  const clinician = await registerUser(server, 'public-capabilities-clinician@example.test');
  await activateUser(server, adminToken, clinician.id);
  return clinician.token;
}

test('C01 capabilities block shape — switched on, no provider required', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: '',
  });
  try {
    const adminToken = await loginAdmin(server);
    const { status, body } = await fetchPublicSettings(server, adminToken);
    assert.equal(status, 200);
    assert.equal(body.public_settings.capabilities.version, 1);
    assert.deepEqual(body.public_settings.capabilities.general_clinical_llm, {
      available: true,
      reason: 'available',
    });
    // Legacy keys survive untouched.
    assert.equal(typeof body.public_settings.transcription_enabled, 'boolean');
    assert.equal(body.public_settings.legal.status, 'rc');

    const keys = Object.keys(body.public_settings.capabilities).sort();
    assert.deepEqual(keys, ['document_extraction', 'general_clinical_llm', 'transcription', 'version']);
    for (const key of ['document_extraction', 'general_clinical_llm', 'transcription']) {
      const entry = body.public_settings.capabilities[key];
      assert.equal(typeof entry.available, 'boolean', key);
      assert.ok(ALLOWED_REASONS.has(entry.reason), `${key} reason: ${entry.reason}`);
    }
  } finally {
    await server.stop();
  }
});

test('C02 agreement, switched off — publication matches enforcement', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const adminToken = await loginAdmin(server);
    const { body } = await fetchPublicSettings(server, adminToken);
    assert.deepEqual(body.public_settings.capabilities.general_clinical_llm, {
      available: false,
      reason: 'switched_off',
    });

    const invoke = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token: adminToken, body: { prompt: 'synthetic C02 check' } },
    );
    assert.equal(invoke.status, 503, invoke.text);
    assert.equal(invoke.body?.code, 'ai_capability_disabled');
    assert.equal(invoke.body?.error, 'General AI generation is disabled on this server.');
  } finally {
    await server.stop();
  }
});

test('C03 agreement, unconfigured — the production "flag on, no provider" posture', async () => {
  // selftest:true reproduces (offline) the production posture where
  // GENERAL_CLINICAL_LLM_ENABLED=1 and LLM_REQUIRED=1 but no provider key is
  // present: llmEnabled() returns false under SELFTEST=1 regardless of key.
  const server = await startTestServer(
    { GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '1', OPENAI_API_KEY: '' },
    { selftest: true },
  );
  try {
    const clinicianToken = await loginEligibleClinician(server);
    const { body } = await fetchPublicSettings(server, clinicianToken);
    assert.deepEqual(body.public_settings.capabilities.general_clinical_llm, {
      available: false,
      reason: 'unconfigured',
    });

    const invoke = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token: clinicianToken, body: { prompt: 'synthetic C03 check' } },
    );
    assert.equal(invoke.status, 503, invoke.text);
    assert.equal(invoke.body?.code, 'ai_provider_unconfigured');
    assert.equal(invoke.body?.error, 'AI generation is not configured on this server.');
  } finally {
    await server.stop();
  }
});

test('C04 transcription and document extraction mirror their switches', async () => {
  // selftest:false — transcriptionAvailable() also accepts SELFTEST, so the
  // default harness boot would confound this assertion (§1, R4). document_
  // extraction has no such carve-out and is unaffected either way.
  const server = await startTestServer(
    { TRANSCRIPTION_ENABLED: '1', DOCUMENT_EXTRACTION_ENABLED: '0' },
    { selftest: false },
  );
  try {
    const { body } = await fetchPublicSettings(server);
    assert.equal(body.public_settings.capabilities.transcription.available, true);
    assert.deepEqual(body.public_settings.capabilities.document_extraction, {
      available: false,
      reason: 'switched_off',
    });
  } finally {
    await server.stop();
  }

  const inverse = await startTestServer(
    { TRANSCRIPTION_ENABLED: '0', DOCUMENT_EXTRACTION_ENABLED: '1' },
    { selftest: false },
  );
  try {
    const { body } = await fetchPublicSettings(inverse);
    assert.equal(body.public_settings.capabilities.transcription.available, false);
    assert.equal(body.public_settings.capabilities.document_extraction.available, true);
  } finally {
    await inverse.stop();
  }

  // Legacy-mirror lock, scoped to non-SELFTEST because the legacy alias and
  // the capabilities mirror deliberately diverge under SELFTEST (§1).
  const nonSelftest = await startTestServer(
    { TRANSCRIPTION_ENABLED: '1' },
    { selftest: false },
  );
  try {
    const { body } = await fetchPublicSettings(nonSelftest);
    assert.equal(
      body.public_settings.transcription_enabled,
      body.public_settings.capabilities.transcription.available,
    );
  } finally {
    await nonSelftest.stop();
  }
});

test('C05 SELFTEST carve-out — GENERAL_CLINICAL_LLM_ENABLED genuinely unset', async () => {
  // Node's spawn drops env entries whose value is undefined, so this
  // reliably UNSETS the variable even when CI exports it. Do NOT pass '' —
  // that would defeat the `=== undefined` carve-out. This is the
  // configuration the whole assurance fleet and `npm run selftest` run
  // under, and the one every outage-era gate was blind to.
  const server = await startTestServer(
    { GENERAL_CLINICAL_LLM_ENABLED: undefined },
    { selftest: true },
  );
  try {
    const clinicianToken = await loginEligibleClinician(server);
    const { body } = await fetchPublicSettings(server, clinicianToken);
    assert.deepEqual(body.public_settings.capabilities.general_clinical_llm, {
      available: true,
      reason: 'available',
    });

    const invoke = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token: clinicianToken, body: { prompt: 'synthetic C05 check' } },
    );
    assert.equal(invoke.status, 200, invoke.text);
  } finally {
    await server.stop();
  }
});

test('C06 public channel — capabilities present with no Authorization header', async () => {
  const server = await startTestServer();
  try {
    const { status, body } = await requestJson(
      server,
      `/api/apps/public/prod/public-settings/by-id/${server.appId}`,
    );
    assert.equal(status, 200);
    assert.ok(body.public_settings.capabilities);
    // Anonymous shape: a coarse boolean only, no reason disclosed (see C10).
    assert.equal(typeof body.public_settings.capabilities.general_clinical_llm.available, 'boolean');
    assert.equal(
      Object.hasOwn(body.public_settings.capabilities.general_clinical_llm, 'reason'),
      false,
    );
  } finally {
    await server.stop();
  }
});

test('C10 anonymous callers get a coarse general_clinical_llm boolean; authenticated callers get the full reason', async () => {
  // The finding this pins: prior to the fix, an unauthenticated caller could
  // distinguish "feature switched off" from "provider credential absent" —
  // pre-auth fingerprinting of server provider-configuration state.
  const unconfigured = await startTestServer(
    { GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '1', OPENAI_API_KEY: '' },
    { selftest: true },
  );
  const switchedOff = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const anonUnconfigured = await fetchPublicSettings(unconfigured);
    const anonSwitchedOff = await fetchPublicSettings(switchedOff);

    // Both anonymous responses carry only the coarse boolean — no `reason`
    // key at all — so the two distinct server postures are indistinguishable
    // to an unauthenticated caller.
    assert.deepEqual(
      Object.keys(anonUnconfigured.body.public_settings.capabilities.general_clinical_llm),
      ['available'],
    );
    assert.deepEqual(
      Object.keys(anonSwitchedOff.body.public_settings.capabilities.general_clinical_llm),
      ['available'],
    );
    assert.equal(anonUnconfigured.body.public_settings.capabilities.general_clinical_llm.available, false);
    assert.equal(anonSwitchedOff.body.public_settings.capabilities.general_clinical_llm.available, false);

    // transcription/document_extraction are plain feature switches, not
    // provider-presence signals, and remain fully disclosed even anonymously.
    assert.ok(Object.hasOwn(anonUnconfigured.body.public_settings.capabilities.transcription, 'reason'));

    // An authenticated caller still gets the full, distinguishable posture.
    const adminToken = await loginAdmin(unconfigured);
    const authUnconfigured = await fetchPublicSettings(unconfigured, adminToken);
    assert.deepEqual(authUnconfigured.body.public_settings.capabilities.general_clinical_llm, {
      available: false,
      reason: 'unconfigured',
    });
  } finally {
    await unconfigured.stop();
    await switchedOff.stop();
  }
});

test('C07 config-only rollback pair — the incident-scenario test', async () => {
  // The exact fly.production vs fly.rollback.production divergence pinned by
  // R00. Proves an already-loaded browser tab can detect a mid-session
  // rollback by re-fetching this one existing endpoint, with no bundle
  // change.
  const candidate = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1' });
  const rollback = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const candidateResponse = await fetchPublicSettings(candidate);
    const rollbackResponse = await fetchPublicSettings(rollback);

    assert.notEqual(
      candidateResponse.body.public_settings.capabilities.general_clinical_llm.available,
      rollbackResponse.body.public_settings.capabilities.general_clinical_llm.available,
    );
    assert.equal(
      candidateResponse.body.public_settings.capabilities.version,
      rollbackResponse.body.public_settings.capabilities.version,
    );

    const withoutGeneralClinicalLlm = (publicSettings) => {
      const { capabilities, ...rest } = publicSettings;
      const { general_clinical_llm, ...otherCapabilities } = capabilities;
      return { ...rest, capabilities: otherCapabilities };
    };
    assert.deepEqual(
      withoutGeneralClinicalLlm(candidateResponse.body.public_settings),
      withoutGeneralClinicalLlm(rollbackResponse.body.public_settings),
    );
  } finally {
    await candidate.stop();
    await rollback.stop();
  }
});

test('C08 release-gate additive compat — the deploy/rollback jq -e predicate is untouched', async () => {
  const server = await startTestServer({
    LEGAL_STATUS: 'effective',
    LEGAL_EFFECTIVE_DATE: '19 July 2026',
  });
  try {
    const { body } = await fetchPublicSettings(server);
    assert.equal(body.public_settings.legal.status, 'effective');
    assert.equal(body.public_settings.legal.effective_date, '19 July 2026');
  } finally {
    await server.stop();
  }
});

test('C09 non-leakage — no secret, provider or infrastructure token in the body', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
    OPENAI_API_KEY: '',
  });
  try {
    const { text } = await fetchPublicSettings(server);
    assert.doesNotMatch(text, /OPENAI|sk-|API_KEY|fly\.io|LLM_REQUIRED/i);
  } finally {
    await server.stop();
  }
});
