import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

function readSrc(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

// Strips block and line comments so a guard-defeating mutation cannot hide
// behind prose that merely mentions the guarded identifier (e.g. a doc
// comment saying "ai.canTrigger flips mid-session" instead of the real
// `if (!ai.canTrigger)` check). None of the files this suite reads contain a
// "//" inside a string literal, so this simple pass is safe here.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

// Brace-matches the body of an arrow function declared as
// `const <marker> = ...(...) => { ... }`, returning just the text between the
// outermost braces. Used to scope an assertion to a single function's body
// instead of the whole file, so surrounding prose/state cannot satisfy it.
function extractArrowBody(src, marker) {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `expected to find "${marker}"`);
  const arrowIdx = src.indexOf('=>', start);
  assert.ok(arrowIdx >= 0, `expected an arrow function after "${marker}"`);
  const braceStart = src.indexOf('{', arrowIdx);
  assert.ok(braceStart >= 0, `expected a function body after "${marker}"`);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return src.slice(braceStart + 1, i - 1);
}

const CONSUMER_FILES = [
  'src/pages/TreatmentProtocols.jsx',
  'src/components/client/MedicationAlerts.jsx',
  'src/components/client/AssessmentRecommendations.jsx',
  'src/pages/ClientConditions.jsx',
  'src/components/reports/wizard-steps/SectionEditor.jsx',
  'src/components/client/NutritionPlanCreator.jsx',
  'src/components/calendar/SOAPNoteModal.jsx',
  'src/pages/AssessmentAudit.jsx',
];

test('H01 consumption — useAiCapability is the only capabilities reader', () => {
  for (const file of CONSUMER_FILES) {
    const src = readSrc(file);
    assert.match(src, /useAiCapability\(/, `${file} must call useAiCapability()`);
    assert.doesNotMatch(src, /public_settings\?\.capabilities/, `${file} must not read public_settings directly`);
  }
});

test('H02 no raw transport text reaches a clinician', () => {
  for (const file of CONSUMER_FILES) {
    const src = readSrc(file);
    assert.doesNotMatch(src, /\$\{error\?\.message/, `${file} must not interpolate error.message into user-facing copy`);
    assert.doesNotMatch(src, /Failed to generate the treatment protocol: /, `${file} must not use the raw transport-text template`);
  }
});

test('H03 no US spelling in AI-availability copy sites', () => {
  for (const file of CONSUMER_FILES) {
    const src = readSrc(file);
    assert.doesNotMatch(src, /Analyzing conditions|analyze conditions|analyzing medications/i, file);
  }
});

test('H04 the V2 fix — MedicationAlerts no longer gates non-AI content behind !error', () => {
  const src = readSrc('src/components/client/MedicationAlerts.jsx');
  // Scoped, semantic check: brace-match the JSX expression that actually
  // renders renderDetails(false) and assert on that expression alone. A
  // reformat (line wraps, extra whitespace) cannot break this because the
  // negated character class spans newlines; operand order or an added
  // conjunct show up directly as a failing/passing membership check on the
  // extracted expression rather than as an exact-string mismatch.
  const guard = /\{([^{}]*?renderDetails\(false\))\}/.exec(src);
  assert.ok(guard, 'MedicationAlerts.jsx must render renderDetails(false) from a JSX expression');
  assert.doesNotMatch(guard[1], /error/, 'renderDetails(false) must not be gated on error/aiErrorKind state');
  assert.match(guard[1], /!isLoading/, 'renderDetails(false) must still be gated on !isLoading');
});

test('H05 AssessmentRecommendations honesty', () => {
  const src = readSrc('src/components/client/AssessmentRecommendations.jsx');
  assert.match(src, /source === 'ai'/);
  assert.match(src, /AI_COPY\.ruleBasedBadge/);
  assert.doesNotMatch(src, /AI-Suggested Assessments/);

  // Scoped, semantic check: brace-match the JSX expression that renders
  // <AIDisclosureNote and assert both its guarding conditions are present in
  // that expression, regardless of operand order or added whitespace.
  const disclosure = /\{([^{}]*?<AIDisclosureNote)/.exec(src);
  assert.ok(disclosure, 'AssessmentRecommendations.jsx must render <AIDisclosureNote from a JSX expression');
  assert.match(disclosure[1], /source === 'ai'/, 'AIDisclosureNote must be gated on source === \'ai\'');
  assert.match(disclosure[1], /recommendations\.length > 0/, 'AIDisclosureNote must be gated on recommendations.length > 0');
});

test('H06 affordance discipline — no surface hides its AI button', () => {
  const protocolsSrc = readSrc('src/pages/TreatmentProtocols.jsx');
  // Scoped, semantic check: find the disabled= expression that references
  // !ai.canTrigger and assert isLoading is gated in that SAME expression,
  // rather than pinning the exact operand order/spacing.
  const disabledExpr = /disabled=\{([^{}]*!ai\.canTrigger[^{}]*)\}/.exec(protocolsSrc);
  assert.ok(disabledExpr, 'TreatmentProtocols.jsx must gate its AI action with a disabled= expression referencing !ai.canTrigger');
  assert.match(disabledExpr[1], /isLoading/, 'the same disabled= expression must also gate on isLoading');

  const classB = [
    'src/components/reports/wizard-steps/SectionEditor.jsx',
    'src/components/client/NutritionPlanCreator.jsx',
    'src/components/calendar/SOAPNoteModal.jsx',
    'src/pages/AssessmentAudit.jsx',
  ];
  for (const file of classB) {
    const src = readSrc(file);
    assert.match(src, /!ai\.canTrigger/, `${file} must gate a disabled= expression with !ai.canTrigger`);
  }
  for (const file of CONSUMER_FILES) {
    const src = readSrc(file);
    assert.doesNotMatch(src, /ai\.canTrigger && <Button/, `${file} must not conditionally hide its Button`);
  }
});

test('H07 no call against a withdrawn capability', () => {
  for (const file of [
    'src/components/client/MedicationAlerts.jsx',
    'src/components/client/AssessmentRecommendations.jsx',
    'src/pages/ClientConditions.jsx',
  ]) {
    // Comments stripped first, so a doc comment mentioning ai.canTrigger (or
    // a useEffect dependency-array entry, which is not a comment but also
    // does not gate anything) cannot stand in for the real guard. The guard
    // itself must be the structural `if (!ai.canTrigger) { ...; return; }`
    // early return, not a bare textual occurrence of the identifier.
    const src = stripComments(readSrc(file));
    const guard = /if\s*\(\s*!ai\.canTrigger\s*\)\s*\{[\s\S]*?return;\s*\}/.exec(src);
    const invokeIndex = src.indexOf('InvokeLLM(');
    assert.ok(guard, `${file} must contain an early-return guard: if (!ai.canTrigger) { ...; return; }`);
    assert.ok(invokeIndex >= 0, `${file} must call InvokeLLM(`);
    assert.ok(guard.index < invokeIndex, `${file}: the !ai.canTrigger early-return guard must precede InvokeLLM(`);
  }
});

test('H08 ClientConditions never silently empty', () => {
  const src = readSrc('src/pages/ClientConditions.jsx');
  assert.match(src, /suggestionState/);
  assert.doesNotMatch(src, /catch \(error\) \{\s*console\.error\("Error generating suggestions:", error\);\s*\}/);
});

test('H09 operator panel mounted', () => {
  const profileSrc = readSrc('src/pages/MyProfile.jsx');
  assert.match(profileSrc, /AiFeatureStatusCard/);
  assert.match(profileSrc, /value="ai"/);

  const cardSrc = readSrc('src/components/settings/AiFeatureStatusCard.jsx');
  assert.match(cardSrc, /capabilityStatusLabel/);
  assert.match(cardSrc, /AI_COPY\.panelRecheck/);
  assert.doesNotMatch(cardSrc, /createAxiosClient|fetch\(/);
});

test('H10 AuthContext contract', () => {
  const src = readSrc('src/lib/AuthContext.jsx');
  assert.match(src, /noteCapabilityWithdrawn/);
  assert.match(src, /refreshPublicSettings/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /appPublicSettings/);

  // Scoped, semantic check: brace-match the refreshPublicSettings function
  // body itself (comments stripped) and assert directly on it, rather than
  // an arbitrary character-count proximity window. This survives both an
  // added comment/JSDoc between the function and an unrelated identifier
  // (which merely widens a proximity window) and a defect placed anywhere
  // within the function body (which a fixed-size window can walk out of).
  const body = extractArrowBody(stripComments(src), 'const refreshPublicSettings');
  assert.doesNotMatch(
    body,
    /setIsLoadingPublicSettings/,
    'refreshPublicSettings must never touch isLoadingPublicSettings — src/App.jsx gates the whole SPA on that flag',
  );
  assert.doesNotMatch(
    body,
    /checkAppState\(/,
    'refreshPublicSettings must not delegate to checkAppState() — that would blank the app to a loading screen and re-run auth mid-consult',
  );
});

test('H11 anti-drift — index.mjs never reads the raw env var; capabilities.mjs is the single source', () => {
  const indexSource = readSrc('server/index.mjs');
  assert.match(indexSource, /publicCapabilities\(\)/);
  assert.doesNotMatch(indexSource, /GENERAL_CLINICAL_LLM_ENABLED/);

  const capabilitiesSource = readSrc('server/capabilities.mjs');
  assert.match(capabilitiesSource, /export function generalClinicalLlmPosture/);

  const integrationsSource = readSrc('server/integrations.mjs');
  assert.match(integrationsSource, /generalClinicalLlmSwitchedOn\(\)/);
  assert.doesNotMatch(integrationsSource, /process\.env\.GENERAL_CLINICAL_LLM_ENABLED/);
});
