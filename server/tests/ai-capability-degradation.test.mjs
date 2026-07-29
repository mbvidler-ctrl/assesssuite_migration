import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AI_COPY,
  aiErrorMessage,
  classifyAiError,
  mergeCapabilityOverrides,
  readCapabilities,
  resolveAiSurfaceState,
} from '../../src/lib/aiCapabilities.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const moduleSource = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'aiCapabilities.js'), 'utf8');

test('D01 backward compat — old server payload without a capabilities block', () => {
  const capabilities = readCapabilities({ public_settings: { transcription_enabled: false, legal: {} } });
  assert.deepEqual(capabilities.general_clinical_llm, { available: true, reason: 'unknown', published: false });
  assert.deepEqual(capabilities.document_extraction, { available: true, reason: 'unknown', published: false });
  // The legacy bridge: transcription_enabled substitutes for the missing block.
  assert.deepEqual(capabilities.transcription, { available: false, reason: 'switched_off', published: true });
});

test('D02 pass-through — a full capabilities payload normalises unchanged', () => {
  const payload = {
    public_settings: {
      transcription_enabled: false,
      legal: {},
      capabilities: {
        version: 1,
        general_clinical_llm: { available: true, reason: 'available' },
        transcription: { available: false, reason: 'switched_off' },
        document_extraction: { available: false, reason: 'unconfigured' },
      },
    },
  };
  const capabilities = readCapabilities(payload);
  assert.deepEqual(capabilities.general_clinical_llm, { available: true, reason: 'available', published: true });
  assert.deepEqual(capabilities.transcription, { available: false, reason: 'switched_off', published: true });
  assert.deepEqual(capabilities.document_extraction, { available: false, reason: 'unconfigured', published: true });
});

test('D03 malformed/absent tolerance — never throws, always unknown-optimistic', () => {
  const cases = [
    undefined,
    {},
    { public_settings: {} },
    { public_settings: { capabilities: null } },
    { public_settings: { capabilities: [] } },
    { public_settings: { capabilities: { general_clinical_llm: { available: 'yes' } } } },
  ];
  for (const input of cases) {
    const capabilities = readCapabilities(input);
    for (const key of ['general_clinical_llm', 'transcription', 'document_extraction']) {
      assert.equal(capabilities[key].available, true, `${key} for ${JSON.stringify(input)}`);
      assert.equal(capabilities[key].reason, 'unknown', `${key} for ${JSON.stringify(input)}`);
    }
  }

  // Forward compat: an unknown top-level key and a higher version do not
  // break parsing, and a known-good entry is still read correctly.
  const forwardCompat = readCapabilities({
    public_settings: {
      capabilities: {
        version: 99,
        general_clinical_llm: { available: true, reason: 'available' },
        some_future_key: 'x',
      },
    },
  });
  assert.deepEqual(forwardCompat.general_clinical_llm, { available: true, reason: 'available', published: true });
});

test('D04 classifyAiError', () => {
  assert.equal(
    classifyAiError({ response: { status: 503, data: { code: 'ai_capability_disabled', error: 'General AI generation is disabled on this server.' } } }),
    'withdrawn',
  );
  // The new-bundle/old-server bridge: legacy pre-capabilities shape.
  assert.equal(
    classifyAiError({ response: { status: 503, data: { code: 'internal_error', error: 'General AI generation is disabled on this server.' } } }),
    'withdrawn',
  );
  assert.equal(
    classifyAiError({ response: { status: 503, data: { code: 'ai_provider_unconfigured', error: 'AI generation is not configured on this server.' } } }),
    'unconfigured',
  );
  assert.equal(classifyAiError({ response: { status: 502, data: {} } }), 'provider_failed');
  // A transport failure must NEVER read as a withdrawal.
  assert.equal(classifyAiError(new Error('Network Error')), 'request_failed');
  assert.equal(classifyAiError({}), 'request_failed');
  assert.equal(classifyAiError(null), 'request_failed');
});

test('D04a a per-account authorisation refusal is permanent, not a transient outage', () => {
  // The WP3 eligibility gate returns clinical_release_unavailable / account_inactive
  // at HTTP 403. These are permanent for this account and must NEVER be shown
  // as "try again".
  for (const code of ['clinical_release_unavailable', 'account_inactive']) {
    const error = { response: { status: 403, data: { code, error: 'AI generation is not approved for this account profile.' } } };
    assert.equal(classifyAiError(error), 'not_authorised', code);
    assert.equal(aiErrorMessage(classifyAiError(error)), AI_COPY.notAuthorised, code);
    // It must not read as the transient request-failed copy.
    assert.notEqual(aiErrorMessage(classifyAiError(error)), AI_COPY.requestFailed, code);

    // The affordance closes (retrying cannot succeed) rather than staying live.
    const surface = resolveAiSurfaceState({ capability: { available: true, reason: 'available' }, error });
    assert.equal(surface.mode, 'unavailable', code);
    assert.equal(surface.canTrigger, false, code);
  }
});

test('D05 resolveAiSurfaceState', () => {
  const switchedOff = { available: false, reason: 'switched_off' };
  const unconfigured = { available: false, reason: 'unconfigured' };
  const available = { available: true, reason: 'available' };
  const unknown = { available: true, reason: 'unknown' };

  const off = resolveAiSurfaceState({ capability: switchedOff });
  assert.equal(off.mode, 'unavailable');
  assert.equal(off.canTrigger, false);
  assert.equal(off.message, AI_COPY.unavailableSwitchedOffShort);

  const notConfigured = resolveAiSurfaceState({ capability: unconfigured });
  assert.equal(notConfigured.mode, 'unavailable');
  assert.equal(notConfigured.canTrigger, false);
  assert.equal(notConfigured.message, AI_COPY.unavailableUnconfiguredShort);

  const transportFailure = resolveAiSurfaceState({ capability: available, error: new Error('Network Error') });
  assert.equal(transportFailure.mode, 'failed');
  assert.equal(transportFailure.canTrigger, true);

  // A runtime withdrawal closes the affordance even when the cached
  // capability still says available (the client has not refreshed yet).
  const withdrawnMidSession = resolveAiSurfaceState({
    capability: available,
    error: { response: { status: 503, data: { code: 'ai_capability_disabled', error: 'General AI generation is disabled on this server.' } } },
  });
  assert.equal(withdrawnMidSession.mode, 'unavailable');
  assert.equal(withdrawnMidSession.canTrigger, false);

  const ready = resolveAiSurfaceState({ capability: unknown });
  assert.equal(ready.mode, 'ready');
  assert.equal(ready.canTrigger, true);
});

test('D06 the F7 invariant — an AI failure never suppresses non-AI content', () => {
  const switchedOff = { available: false, reason: 'switched_off' };
  const available = { available: true, reason: 'available' };

  assert.equal(
    resolveAiSurfaceState({ capability: switchedOff, hasNonAiContent: true }).showNonAiContent,
    true,
  );
  assert.equal(
    resolveAiSurfaceState({
      capability: available,
      error: new Error('Network Error'),
      hasNonAiContent: true,
    }).showNonAiContent,
    true,
  );
  assert.equal(
    resolveAiSurfaceState({
      capability: available,
      error: { response: { status: 502, data: {} } },
      hasNonAiContent: true,
    }).showNonAiContent,
    true,
  );
});

test('D07 mergeCapabilityOverrides', () => {
  const capabilities = {
    general_clinical_llm: { available: true, reason: 'available', published: true },
    transcription: { available: true, reason: 'unknown', published: false },
  };
  const merged = mergeCapabilityOverrides(capabilities, { general_clinical_llm: 'switched_off' });
  assert.deepEqual(merged.general_clinical_llm, { available: false, reason: 'switched_off', published: true });
  // Unrelated keys untouched.
  assert.deepEqual(merged.transcription, { available: true, reason: 'unknown', published: false });
});

// Short labels and badges (button text, status words, headings) are not
// sentences and are exempt from the terminal-punctuation check below.
const LABEL_KEYS = new Set([
  'featureName', 'ruleBasedBadge', 'aiAssistedBadge',
  'statusOn', 'statusOff', 'statusUnconfigured', 'statusUnknown',
  'panelTitle', 'panelLastChecked', 'panelRecheck',
]);

test('D08 copy discipline — Australian English, no server internals', () => {
  for (const [key, value] of Object.entries(AI_COPY)) {
    assert.doesNotMatch(
      value,
      /analyz|customiz|organiz|recogniz|personaliz|prioritiz|\bcolor\b|\bcenter\b|\blicense\b|\blabeled\b|\bunauthorized\b/i,
      `${key}: American spelling in "${value}"`,
    );
    assert.doesNotMatch(
      value,
      /503|502|LLM|InvokeLLM|disabled on this server|undefined|\[object/i,
      `${key}: server internals leaked in "${value}"`,
    );
    assert.notEqual(value.trim(), '', `${key} must not be empty`);
    assert.doesNotMatch(value, /  /, `${key}: double space in "${value}"`);
    if (!LABEL_KEYS.has(key)) {
      assert.match(value, /[.…?]$/, `${key} must end with a full stop, ellipsis or question mark`);
    }
  }
});

test('D09 no alias — this module stays importable under node --test', () => {
  assert.doesNotMatch(moduleSource, /from '@\//);
});
