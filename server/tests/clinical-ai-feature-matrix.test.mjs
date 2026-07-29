// Feature-matrix coverage for the InvokeLLM ("Core") integration endpoint
// across the six distinct request shapes used by the 11 clinical-AI call
// sites in src/. Existing coverage (extraction-matrix.test.mjs E37/E37a)
// only proved the flag-off 503 and the flag-on/LLM_REQUIRED=0 mock branch
// for a single plain-prompt shape; this suite generalises across all six
// shapes AND — the highest-value addition — exercises the LLM_REQUIRED=1
// production posture against a fake real chat/completions provider, a
// branch no test in this repository previously reached.
//
// Known limitation: PROTOCOL_SCHEMA below is a reduced-but-topologically-
// faithful copy of TreatmentProtocols.jsx's PROTOCOL_RESPONSE_SCHEMA — it
// keeps all nine top-level keys but simplifies some nested sub-schemas. The
// drift guards in section "drift guards" below only assert that top-level
// (and, for the small schemas, every leaf) key name still appears in the
// source file; they do not assert full structural equality, so a
// restructuring (not just a rename) of the client schema may not be caught.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { activateUser, loginAdmin, registerUser, requestJson, startTestServer } from './support/server-harness.mjs';
import { startFakeOpenAIChat } from './support/fake-openai-chat.mjs';
import { MODEL_FAST, MODEL_QUALITY, pickModel } from '../llm.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

const INVOKE_LLM_ROUTE = (appId) => `/api/apps/${appId}/integration-endpoints/Core/InvokeLLM`;

async function invokeLlm(server, token, body) {
  return requestJson(server, INVOKE_LLM_ROUTE(server.appId), { method: 'POST', token, body });
}

// WP3 hardening added a clinical-release gate to InvokeLLM (identical to the
// one handleExtractDataFromUploadedFile already enforced): the bootstrap
// admin has no country/profession, so it is never clinically eligible (see
// src/lib/clinicalRelease.js). Boots A and B only prove the flag-off 503,
// which fires before the eligibility gate is ever consulted, so they keep
// using the plain admin token. Every boot that expects InvokeLLM to actually
// run needs a provisioned, fully activated clinician instead — a stronger
// fixture, not a weakened assertion.
async function loginEligibleClinician(server) {
  const adminToken = await loginAdmin(server);
  const clinician = await registerUser(server, 'feature-matrix-clinician@example.test');
  await activateUser(server, adminToken, clinician.id);
  return clinician.token;
}

// ---------------------------------------------------------------------------
// Shape fixtures — copied verbatim (or, where noted, structurally reduced)
// from the live call sites so the matrix is testing the real shapes that
// reach the server, not shapes invented for convenience.
// ---------------------------------------------------------------------------

// Shape 1: plain prompt, no schema. Mirrors src/pages/ClientConditions.jsx:73-76.
const PLAIN_PROMPT_BODY = {
  prompt: 'Suggest appropriate physical and psychological assessment tests for osteoarthritis. Return only the assessment names, one per line.',
};

// Shape 2: medication-alerts-shaped schema. Exact object literal at
// src/components/client/MedicationAlerts.jsx:71-87.
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
const MEDICATION_ALERTS_BODY = {
  prompt: 'For each medication below, write one concise sentence on its most relevant consideration for physical exercise. 1. Metoprolol',
  response_json_schema: MEDICATION_ALERTS_SCHEMA,
};

// Shape 3: protocol schema. Reduced-but-topologically-faithful copy of
// src/pages/TreatmentProtocols.jsx:76-176 PROTOCOL_RESPONSE_SCHEMA — all
// nine top-level keys are kept, nested sub-schemas are simplified (see the
// file-level comment above on the drift-guard limitation this implies).
// add_context_from_internet: true reproduces the finding that
// server/integrations.mjs:676 never reads this field (no-op) — asserted
// below via hasTools === false.
const PROTOCOL_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'object', properties: { pathophysiology: { type: 'string' }, functional_impact: { type: 'string' }, prevalence: { type: 'string' } } },
    assessment: { type: 'object', properties: { key_assessments: { type: 'array', items: { type: 'string' } }, evidence_base: { type: 'string' } } },
    exercise_prescription: { type: 'object', properties: { exercises: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dosage: { type: 'string' } } } }, frequency: { type: 'string' } } },
    progression: { type: 'object', properties: { phases: { type: 'array', items: { type: 'object', properties: { phase_name: { type: 'string' } } } } } },
    contraindications: { type: 'object', properties: { absolute: { type: 'array', items: { type: 'string' } }, relative: { type: 'array', items: { type: 'string' } } } },
    outcomes: { type: 'object', properties: { expected_timeframe: { type: 'string' }, key_outcomes: { type: 'array', items: { type: 'string' } } } },
    meta_analysis_summary: { type: 'object', properties: { key_findings: { type: 'array', items: { type: 'string' } } } },
    references: { type: 'array', items: { type: 'object', properties: { citation: { type: 'string' } } } },
    clinical_note: { type: 'string' },
  },
};
const PROTOCOL_BODY = {
  prompt: 'Create a comprehensive, evidence-informed exercise rehabilitation protocol for the clinical topic "osteoarthritis".',
  add_context_from_internet: true,
  response_json_schema: PROTOCOL_SCHEMA,
};

// Shape 4: nutrition/flat-multi-string schema. Exact object literal at
// src/components/client/NutritionPlanCreator.jsx:171-178.
const NUTRITION_SCHEMA = {
  type: 'object',
  properties: {
    general_advice: { type: 'string' },
    sample_meal_plan: { type: 'string' },
    behavioral_strategies: { type: 'string' },
  },
};
const NUTRITION_BODY = {
  prompt: 'Create a nutrition plan example for a client with a weight-loss goal.',
  response_json_schema: NUTRITION_SCHEMA,
};

// Shape 5: SOAP-assist schema. src/components/calendar/SOAPNoteModal.jsx:1472-1476.
const SOAP_ASSIST_SCHEMA = { type: 'object', properties: { assessment: { type: 'string' } } };
const SOAP_ASSIST_BODY = {
  prompt: 'Write a concise clinical assessment that interprets the subjective and objective data.',
  response_json_schema: SOAP_ASSIST_SCHEMA,
};

// Shape 6: report-section — plain prompt, but characteristically long
// (SectionEditor.jsx handleGenerateAll), forcing MODEL_QUALITY via the
// length branch of pickModel() rather than the width branch.
const REPORT_SECTION_PROMPT = (
  'Generate the full narrative content for this report section, using the client\'s clinical history, ' +
  'assessment findings and stated goals. Write in Australian English, in a professional clinical register. '
).repeat(20);
const REPORT_SECTION_BODY = { prompt: REPORT_SECTION_PROMPT };

const SIX_SHAPES = [
  { name: 'plain-prompt', body: PLAIN_PROMPT_BODY, hasSchema: false },
  { name: 'medication-alerts', body: MEDICATION_ALERTS_BODY, hasSchema: true },
  { name: 'protocol', body: PROTOCOL_BODY, hasSchema: true },
  { name: 'nutrition', body: NUTRITION_BODY, hasSchema: true },
  { name: 'soap-assist', body: SOAP_ASSIST_BODY, hasSchema: true },
  { name: 'report-section', body: REPORT_SECTION_BODY, hasSchema: false },
];

before(() => {
  assert.ok(
    REPORT_SECTION_BODY.prompt.length > 1800,
    `REPORT_SECTION_BODY fixture drifted below the pickModel() length threshold (length=${REPORT_SECTION_BODY.prompt.length})`,
  );
});

// ---------------------------------------------------------------------------
// Drift guards — additive to (not a replacement for)
// treatment-protocol-catalogue.test.mjs. If a call-site schema is edited in
// the client without a matching update here, these fail loudly rather than
// letting the fixtures silently drift out of sync with production shapes.
// ---------------------------------------------------------------------------

test('drift guard: PROTOCOL_SCHEMA top-level keys still exist in TreatmentProtocols.jsx', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/pages/TreatmentProtocols.jsx'), 'utf8');
  for (const key of Object.keys(PROTOCOL_SCHEMA.properties)) {
    assert.match(source, new RegExp(`\\b${key}\\b`), `expected TreatmentProtocols.jsx to still declare "${key}"`);
  }
});

test('drift guard: MEDICATION_ALERTS_SCHEMA leaf keys still exist in MedicationAlerts.jsx', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/components/client/MedicationAlerts.jsx'), 'utf8');
  for (const key of ['alerts', 'medication_name', 'alert_text']) {
    assert.match(source, new RegExp(`\\b${key}\\b`), `expected MedicationAlerts.jsx to still declare "${key}"`);
  }
});

test('drift guard: NUTRITION_SCHEMA leaf keys still exist in NutritionPlanCreator.jsx', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/components/client/NutritionPlanCreator.jsx'), 'utf8');
  for (const key of ['general_advice', 'sample_meal_plan', 'behavioral_strategies']) {
    assert.match(source, new RegExp(`\\b${key}\\b`), `expected NutritionPlanCreator.jsx to still declare "${key}"`);
  }
});

// ---------------------------------------------------------------------------
// Boot A — flag disabled, LLM_REQUIRED unset. Every shape 503s identically.
// ---------------------------------------------------------------------------

test('Boot A: GENERAL_CLINICAL_LLM_ENABLED=0 disables all six shapes identically', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const admin = await loginAdmin(server);
    for (const shape of SIX_SHAPES) {
      const result = await invokeLlm(server, admin, shape.body);
      assert.equal(result.status, 503, `${shape.name}: ${result.text}`);
      assert.equal(result.body?.error, 'General AI generation is disabled on this server.', shape.name);
    }
  } finally {
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// Boot B — flag disabled AND LLM_REQUIRED=1. Proves the flag gate fires
// before LLM_REQUIRED is ever consulted (locks in the check ordering in
// server/integrations.mjs:668-675) — identical message to boot A.
// ---------------------------------------------------------------------------

test('Boot B: flag-off 503 is identical even when LLM_REQUIRED=1 (flag gate fires first)', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0', LLM_REQUIRED: '1' });
  try {
    const admin = await loginAdmin(server);
    for (const shape of SIX_SHAPES) {
      const result = await invokeLlm(server, admin, shape.body);
      assert.equal(result.status, 503, `${shape.name}: ${result.text}`);
      assert.equal(result.body?.error, 'General AI generation is disabled on this server.', shape.name);
    }
  } finally {
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// Boot C — flag on, LLM_REQUIRED=0, no key at all: pure mock path. This
// generalises E37a (extraction-matrix.test.mjs) across all six shapes/11
// surfaces instead of only the plain-prompt case.
// ---------------------------------------------------------------------------

test('Boot C: flag on + LLM_REQUIRED=0 + no key serves the deterministic mock for every shape', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '0' });
  try {
    const admin = await loginEligibleClinician(server);

    const plain = await invokeLlm(server, admin, PLAIN_PROMPT_BODY);
    assert.equal(plain.status, 200, plain.text);
    assert.equal(typeof plain.body, 'string');
    assert.match(plain.body, /placeholder narrative content generated by the local InvokeLLM mock/i);

    const reportSection = await invokeLlm(server, admin, REPORT_SECTION_BODY);
    assert.equal(reportSection.status, 200, reportSection.text);
    assert.equal(typeof reportSection.body, 'string');
    assert.match(reportSection.body, /placeholder narrative content generated by the local InvokeLLM mock/i);

    const medicationAlerts = await invokeLlm(server, admin, MEDICATION_ALERTS_BODY);
    assert.equal(medicationAlerts.status, 200, medicationAlerts.text);
    assert.ok(Array.isArray(medicationAlerts.body.alerts));
    assert.equal(typeof medicationAlerts.body.alerts[0].medication_name, 'string');
    assert.match(medicationAlerts.body.alerts[0].medication_name, /^Mock /i);
    assert.match(medicationAlerts.body.alerts[0].alert_text, /^Mock /i);

    const protocol = await invokeLlm(server, admin, PROTOCOL_BODY);
    assert.equal(protocol.status, 200, protocol.text);
    assert.match(protocol.body.overview.pathophysiology, /^Mock /i);
    assert.match(protocol.body.clinical_note, /^Mock /i);

    const nutrition = await invokeLlm(server, admin, NUTRITION_BODY);
    assert.equal(nutrition.status, 200, nutrition.text);
    assert.match(nutrition.body.general_advice, /^Mock /i);
    assert.match(nutrition.body.sample_meal_plan, /^Mock /i);
    assert.match(nutrition.body.behavioral_strategies, /^Mock /i);

    const soapAssist = await invokeLlm(server, admin, SOAP_ASSIST_BODY);
    assert.equal(soapAssist.status, 200, soapAssist.text);
    assert.match(soapAssist.body.assessment, /^Mock /i);
  } finally {
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// Boot D — flag on, LLM_REQUIRED=1, no key at all: production posture with
// no provider configured. A different 503 message from boots A/B.
// ---------------------------------------------------------------------------

test('Boot D: flag on + LLM_REQUIRED=1 + no key 503s with a distinct "not configured" message', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '1' });
  try {
    const admin = await loginEligibleClinician(server);
    const result = await invokeLlm(server, admin, PLAIN_PROMPT_BODY);
    assert.equal(result.status, 503, result.text);
    assert.equal(result.body?.error, 'AI generation is not configured on this server.');
    assert.notEqual(
      result.body.error,
      'General AI generation is disabled on this server.',
      'the flag-off and key-not-configured 503s must stay distinct messages',
    );
  } finally {
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// Boot E — real-provider path (LLM_REQUIRED=1, fake real chat/completions
// provider wired via OPENAI_CHAT_TEST_BASE_URL). This is the highest-value
// addition: the production posture (LLM_REQUIRED=1 with a real-shaped
// provider actually answering) that no test in this repository previously
// exercised.
// ---------------------------------------------------------------------------

test('Boot E: real-provider path under LLM_REQUIRED=1 against the fake chat/completions provider', async (t) => {
  const fakeChat = await startFakeOpenAIChat();
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
    OPENAI_API_KEY: 'synthetic-provider-key-canary',
    OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
    // This boot drives well over a dozen sequential calls from the same
    // clinician across its sub-tests; raise the per-account burst ceiling so
    // the WP3 rate limiter (proven separately in
    // invoke-llm-throttling.test.mjs) never interferes with what this suite
    // is actually testing (provider wiring, model selection, de-identification).
    GENERAL_CLINICAL_LLM_USER_BURST_LIMIT: '60',
  });
  try {
    const admin = await loginEligibleClinician(server);

    await t.test('default mode: all six shapes reach the fake provider and get synthetic content', async () => {
      for (const shape of SIX_SHAPES) {
        fakeChat.reset();
        const result = await invokeLlm(server, admin, shape.body);
        assert.equal(result.status, 200, `${shape.name}: ${result.text}`);
        assert.equal(fakeChat.calls.length, 1, `${shape.name}: expected exactly one outbound provider call`);
        if (shape.hasSchema) {
          const flat = JSON.stringify(result.body);
          assert.match(flat, /Synthetic chat-provider/, shape.name);
        } else {
          assert.equal(typeof result.body, 'string', shape.name);
          assert.match(result.body, /^SYNTHETIC_CHAT_PROVIDER_RESPONSE/, shape.name);
        }
      }
    });

    await t.test('model selection matches pickModel() for every shape (imported, not hardcoded)', async () => {
      for (const shape of SIX_SHAPES) {
        fakeChat.reset();
        const result = await invokeLlm(server, admin, shape.body);
        assert.equal(result.status, 200, `${shape.name}: ${result.text}`);
        const expectedModel = pickModel(shape.body.prompt, shape.body.response_json_schema);
        assert.equal(fakeChat.calls[0].model, expectedModel, shape.name);
      }
      // Sanity: the two "wide"/"long" shapes are the MODEL_QUALITY ones, the
      // rest are MODEL_FAST — pinning the concrete expectation, not just
      // "whatever pickModel says", so a change to pickModel's own thresholds
      // is visible here too.
      assert.equal(pickModel(PROTOCOL_BODY.prompt, PROTOCOL_SCHEMA), MODEL_QUALITY, 'protocol schema is "wide"');
      assert.equal(pickModel(REPORT_SECTION_BODY.prompt, undefined), MODEL_QUALITY, 'report-section prompt is "long"');
      assert.equal(pickModel(MEDICATION_ALERTS_BODY.prompt, MEDICATION_ALERTS_SCHEMA), MODEL_FAST);
      assert.equal(pickModel(NUTRITION_BODY.prompt, NUTRITION_SCHEMA), MODEL_FAST);
      assert.equal(pickModel(SOAP_ASSIST_BODY.prompt, SOAP_ASSIST_SCHEMA), MODEL_FAST);
    });

    await t.test('de-identification: email/AU-phone/ID-shaped digits are redacted before egress', async () => {
      fakeChat.reset();
      const sensitivePrompt = {
        prompt: 'Client contact: jane.synthetic@example.test, 0412 345 678, ref 123456789.',
      };
      const result = await invokeLlm(server, admin, sensitivePrompt);
      assert.equal(result.status, 200, result.text);
      assert.equal(fakeChat.calls.length, 1);
      const sent = fakeChat.calls[0].userContent;
      assert.match(sent, /\[REDACTED_EMAIL\]/);
      assert.match(sent, /\[REDACTED_PHONE\]/);
      assert.match(sent, /\[REDACTED_ID\]/);
      assert.ok(!sent.includes('jane.synthetic@example.test'), 'raw email must not reach the provider');
      assert.ok(!sent.includes('0412 345 678'), 'raw phone must not reach the provider');
      assert.ok(!sent.includes('123456789'), 'raw ID-shaped digit run must not reach the provider');
    });

    await t.test('no-op confirmation: add_context_from_internet never reaches the provider as a tool', async () => {
      fakeChat.reset();
      const result = await invokeLlm(server, admin, PROTOCOL_BODY);
      assert.equal(result.status, 200, result.text);
      assert.equal(fakeChat.calls.length, 1);
      assert.equal(fakeChat.calls[0].hasTools, false);
    });

    await t.test('failure sub-modes', async () => {
      fakeChat.reset();
      fakeChat.setMode('malformed-json');
      const malformed = await invokeLlm(server, admin, MEDICATION_ALERTS_BODY);
      assert.equal(malformed.status, 502, malformed.text);
      assert.equal(malformed.body?.error, 'AI generation failed.');

      fakeChat.reset();
      fakeChat.setMode('provider-500');
      const providerError = await invokeLlm(server, admin, PLAIN_PROMPT_BODY);
      assert.equal(providerError.status, 502, providerError.text);
      assert.equal(providerError.body?.error, 'AI generation failed.');

      fakeChat.reset();
      fakeChat.setMode('empty-choices');
      const emptyPlain = await invokeLlm(server, admin, PLAIN_PROMPT_BODY);
      // Documents a genuine, previously-invisible behaviour: an empty
      // real-provider response is currently a silent 200 success for
      // non-schema surfaces (content ?? '' in server/llm.mjs callOpenAI()).
      assert.equal(emptyPlain.status, 200, emptyPlain.text);
      assert.equal(emptyPlain.body, '');

      fakeChat.reset();
      fakeChat.setMode('empty-choices');
      const emptySchema = await invokeLlm(server, admin, MEDICATION_ALERTS_BODY);
      // JSON.parse('') throws, so the schema branch 502s instead.
      assert.equal(emptySchema.status, 502, emptySchema.text);
      assert.equal(emptySchema.body?.error, 'AI generation failed.');
    });
  } finally {
    await server.stop();
    await fakeChat.stop();
  }
});

// ---------------------------------------------------------------------------
// Boot G — mock-fallback-on-real-failure path (LLM_REQUIRED=0, real provider
// wired but returning errors): previously zero coverage.
// ---------------------------------------------------------------------------

test('Boot G: real-provider failure with LLM_REQUIRED=0 silently falls back to the mock', async () => {
  const fakeChat2 = await startFakeOpenAIChat();
  fakeChat2.setMode('provider-500');
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: 'synthetic-provider-key-canary',
    OPENAI_CHAT_TEST_BASE_URL: fakeChat2.baseUrl,
  });
  try {
    const admin = await loginEligibleClinician(server);
    const result = await invokeLlm(server, admin, MEDICATION_ALERTS_BODY);
    assert.equal(result.status, 200, result.text);
    assert.ok(Array.isArray(result.body.alerts));
    assert.match(result.body.alerts[0].medication_name, /^Mock /i);
    assert.match(result.body.alerts[0].alert_text, /^Mock /i);
    assert.match(
      server.getOutput(),
      /\[llm\] real model failed; using the explicit non-production mock fallback/,
    );
  } finally {
    await server.stop();
    await fakeChat2.stop();
  }
});
