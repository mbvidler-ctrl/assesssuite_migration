// WP2 — InvokeLLM must fail closed on shape, not just on the feature flag.
//
// A caller must not be able to add a parameter (e.g. add_context_from_
// internet) that implies capability this server does not implement (web
// retrieval, tool use, ...) and have it silently ignored. Modelled on E37/
// E37a in extraction-matrix.test.mjs.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  activateUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const INVOKE_ROUTE = '/integration-endpoints/Core/InvokeLLM';

test('an unknown InvokeLLM parameter is rejected with 400 even though prompt-only still works', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: '',
  });
  try {
    const adminToken = await loginAdmin(server);
    const clinician = await registerUser(server, 'synthetic-invokellm-contract@example.test');
    await activateUser(server, adminToken, clinician.id);

    const baseline = await requestJson(
      server,
      `/api/apps/${server.appId}${INVOKE_ROUTE}`,
      { method: 'POST', token: clinician.token, body: { prompt: 'synthetic baseline check' } },
    );
    assert.equal(baseline.status, 200, baseline.text);

    const withDeadParam = await requestJson(
      server,
      `/api/apps/${server.appId}${INVOKE_ROUTE}`,
      {
        method: 'POST',
        token: clinician.token,
        body: { prompt: 'synthetic baseline check', add_context_from_internet: true },
      },
    );
    assert.equal(withDeadParam.status, 400, withDeadParam.text);
    assert.match(withDeadParam.body?.error || '', /add_context_from_internet/);
    // The refusal must carry a specific, machine-readable code — not the
    // generic 'internal_error' sentinel a client would otherwise have to
    // treat as an unclassified server fault (see server/integrations.mjs's
    // handleCoreIntegration error mapper).
    assert.equal(withDeadParam.body?.code, 'unsupported_parameter', withDeadParam.text);
  } finally {
    await server.stop();
  }
});

test('param-shape validation runs before the feature-flag check', async () => {
  const isolated = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const adminToken = await loginAdmin(isolated);
    const result = await requestJson(
      isolated,
      `/api/apps/${isolated.appId}${INVOKE_ROUTE}`,
      { method: 'POST', token: adminToken, body: { prompt: 'x', tools: ['web_search'] } },
    );
    // Shape is rejected (400) before the flag-disabled 503 would otherwise
    // fire — a deliberate, testable ordering decision (see WP2 brief risk 2).
    assert.equal(result.status, 400, result.text);
    assert.match(result.body?.error || '', /tools/);
    assert.equal(result.body?.code, 'unsupported_parameter', result.text);
  } finally {
    await isolated.stop();
  }
});

test('add_context_from_internet no longer appears in any client call site', () => {
  const callSites = [
    ['src', 'pages', 'TreatmentProtocols.jsx'],
    ['src', 'pages', 'AssessmentAudit.jsx'],
    ['src', 'pages', 'ClientConditions.jsx'],
  ];
  for (const segments of callSites) {
    const source = fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
    assert.doesNotMatch(source, /add_context_from_internet/, segments.join('/'));
  }
});
