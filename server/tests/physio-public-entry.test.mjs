import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('public Physio root is vertical-specific while the EP unauthenticated root remains login-bound', () => {
  const app = read('src/App.jsx');
  assert.match(app, /buildTimeProfession\.id === 'physio'/);
  assert.match(app, /return <PhysioPublicLanding \/>/);
  assert.match(app, /return <Navigate to="\/login" replace \/>/);

  const landing = read('src/pages/PhysioPublicLanding.jsx');
  assert.match(landing, /236 canonical assessments/);
  assert.match(landing, /Six structured AI workflows/);
  assert.match(landing, /Create your account/);
  assert.match(landing, /to="\/register"/);
  assert.match(landing, /to="\/login"/);
  assert.doesNotMatch(landing, /Exercise Physiolog|Accredited Exercise|\bAEP\b/);
});

test('Physio host metadata is indexable and describes the dedicated vertical', () => {
  const html = read('apps/app-physio/index.html');
  assert.match(html, /<title>AssessSuite Physio<\/title>/);
  assert.match(html, /assessment, episodes of care, outcome measures/i);
  assert.doesNotMatch(html, /noindex|nofollow|noarchive/i);
});

test('registration and shared authentication chrome use the active profession identity', () => {
  assert.match(read('src/pages/Register.jsx'), /buildTimeProfession\.productName/);
  assert.match(read('src/components/AuthLayout.jsx'), /buildTimeProfession\.shortName/);
});
