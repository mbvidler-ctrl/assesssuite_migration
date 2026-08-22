import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const componentPath = path.join(root, 'src', 'components', 'onboarding', 'PhysioRedFlagScreen.jsx');
const source = fs.readFileSync(componentPath, 'utf8');

test('red-flag completion fails closed on unanswered or undocumented findings', () => {
  assert.match(source, /if \(!value\) newErrors\[key\] = "Select Yes, No, or Unsure\."/);
  assert.match(source, /value === "yes" \|\| value === "unsure"/);
  assert.match(source, /newErrors\[`\$\{key\}_details`\] = "Document the positive or uncertain finding\."/);
  assert.match(source, /const newErrors = validateForCompletion\(\)/);
});

test('positive or uncertain findings cannot be persisted as a clear screen', () => {
  assert.match(source, /hasPositiveResponse && formData\.physio_screen_outcome === "no_red_flags"/);
  assert.match(source, /disabled=\{hasPositiveResponse\}/);
  assert.match(source, /A positive or uncertain finding cannot be saved as a clear screen\./);
});

test('positive findings capture a complete escalation record', () => {
  for (const field of [
    'physio_screen_escalation_disposition',
    'physio_screen_escalation_recipient',
    'physio_screen_escalation_time',
    'physio_screen_activity_restriction',
  ]) {
    assert.match(source, new RegExp(`newErrors\\.${field}`), `${field} must be validated`);
    assert.ok(
      source.includes(`id="${field}"`) || source.includes(`value={formData.${field}}`),
      `${field} must be rendered`,
    );
  }
});

test('completed and draft saves carry a versioned structured summary', () => {
  assert.match(source, /schema_version: 1/);
  assert.match(source, /completion_status: completionStatus/);
  assert.match(source, /responses,/);
  assert.match(source, /finding_keys:/);
  assert.match(source, /onNext\(buildStructuredPayload\("complete"\)\)/);
  assert.match(source, /onSaveAndFinishLater\(buildStructuredPayload\("draft"\)\)/);
});
