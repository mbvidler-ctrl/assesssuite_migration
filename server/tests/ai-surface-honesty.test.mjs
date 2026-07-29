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
  assert.doesNotMatch(src, /!isLoading && !error && renderDetails\(false\)/);
  assert.match(src, /\{!isLoading && renderDetails\(false\)\}/);
  assert.doesNotMatch(src, /!expanded && !isLoading && !error/);
});

test('H05 AssessmentRecommendations honesty', () => {
  const src = readSrc('src/components/client/AssessmentRecommendations.jsx');
  assert.match(src, /source === 'ai'/);
  assert.match(src, /AI_COPY\.ruleBasedBadge/);
  assert.doesNotMatch(src, /AI-Suggested Assessments/);
  assert.match(src, /source === 'ai' && recommendations\.length > 0 && <AIDisclosureNote/);
  assert.doesNotMatch(src, /\{recommendations\.length > 0 && <AIDisclosureNote/);
});

test('H06 affordance discipline — no surface hides its AI button', () => {
  const protocolsSrc = readSrc('src/pages/TreatmentProtocols.jsx');
  assert.match(protocolsSrc, /disabled=\{isLoading \|\| !ai\.canTrigger\}/);

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
    const src = readSrc(file);
    const guardIndex = src.indexOf('ai.canTrigger');
    const invokeIndex = src.indexOf('InvokeLLM(');
    assert.ok(guardIndex >= 0, `${file} must reference ai.canTrigger`);
    assert.ok(invokeIndex >= 0, `${file} must call InvokeLLM(`);
    assert.ok(guardIndex < invokeIndex, `${file}: ai.canTrigger must be checked before InvokeLLM( is called`);
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
  assert.doesNotMatch(src, /refreshPublicSettings[\s\S]{0,400}setIsLoadingPublicSettings/);
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
