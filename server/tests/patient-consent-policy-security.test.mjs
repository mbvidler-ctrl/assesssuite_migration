import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...segments) => fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');

test('onboarding fails closed when no valid active consent policy exists', () => {
  const consent = read('src', 'components', 'onboarding', 'Consent.jsx');
  const quick = read('src', 'components', 'onboarding', 'QuickOnboardModal.jsx');
  for (const source of [consent, quick]) {
    assert.doesNotMatch(source, /const\s+DEFAULT_POLICY\s*=/);
    assert.match(source, /const\s+policyReady\s*=\s*Boolean/);
    assert.match(source, /activePolicy\.is_active\s*===\s*true/);
    assert.match(source, /operative wording/);
  }
});

test('quick onboarding records only displayed consent decisions and binds the signed policy snapshot', () => {
  const quick = read('src', 'components', 'onboarding', 'QuickOnboardModal.jsx');
  assert.doesNotMatch(quick, /consent_confirmed:\s*true/);
  assert.doesNotMatch(quick, /privacy_consent:\s*true/);
  assert.doesNotMatch(quick, /assessment_consent:\s*true/);
  assert.doesNotMatch(quick, /pricing_explained:\s*true/);
  assert.match(quick, /visibleConsentItems\.some\(item\s*=>\s*item\.key\s*===\s*'primary'\)/);
  assert.match(quick, /signed_policy_id:\s*currentPolicy\.id/);
  assert.match(quick, /signed_policy_snapshot:/);
});

test('full onboarding binds the consent policy to the client practice, not the primary membership', () => {
  const consent = read('src', 'components', 'onboarding', 'Consent.jsx');
  const onboarding = read('src', 'pages', 'Onboarding.jsx');
  assert.match(onboarding, /orgId=\{formData\.org_id \|\| null\}/);
  assert.match(consent, /typeof orgId === 'string' && orgId \? orgId : null/);
  assert.match(consent, /memberships[^;]*\.find\(\(membership\) => membership\.org_id === requestedOrgId\)/);
  assert.match(consent, /ClinicPolicy\.filter\(\{\s*org_id: policyOrgId,\s*is_active: true/);
  assert.match(consent, /selectedMembership\.org_id !== resolvedPolicyOrgId/);
});

test('an old signature cannot be rebound to a changed policy or stale policy content', () => {
  const consent = read('src', 'components', 'onboarding', 'Consent.jsx');
  assert.match(consent, /function signedEvidenceMatchesPolicy/);
  assert.match(consent, /snapshot\.texts\[item\.formKey\][\s\S]*snapshot\.texts\[item\.quickKey\]/);
  assert.match(consent, /digital_signature: evidenceMatches \? data\.digital_signature : ""/);
  assert.match(consent, /setHasSignature\(evidenceMatches\)/);
  assert.match(consent, /policyContractKey\(currentPolicy\) !== policyContractKey\(activePolicy\)/);
  assert.match(consent, /invalidateConsentForPolicyChange\('The active patient-consent policy changed/);
});

test('quick onboarding clears cancelled patient state and rejects a blank canvas as a signature', () => {
  const quick = read('src', 'components', 'onboarding', 'QuickOnboardModal.jsx');
  assert.match(quick, /const EMPTY_FORM_DATA = Object\.freeze/);
  assert.match(quick, /const EMPTY_CONSENTS = Object\.freeze/);
  assert.match(quick, /const resetQuickOnboardState = \(\) => \{[\s\S]*setFormData\(\{ \.\.\.EMPTY_FORM_DATA \}\)[\s\S]*setConsents\(\{ \.\.\.EMPTY_CONSENTS \}\)[\s\S]*signatureHasInkRef\.current = false/);
  assert.match(quick, /onOpenChange=\{\(open\) => \{ if \(!open\) handleClose\(\); \}\}/);
  assert.match(quick, /if \(!hasSignature \|\| !signatureHasInkRef\.current\)/);
  assert.match(quick, /if \(!signatureHasInkRef\.current \|\| !canvasRef\.current\)/);
  assert.match(quick, /policyContractKey\(currentPolicy\) !== policyContractKey\(activePolicy\)/);
});
