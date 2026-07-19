import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_BUNDLE_IDS,
  EVENT_TYPES,
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
  fingerprint,
} from '../../src/lib/legal/documentRegistry.js';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const consentPath = path.join(repoRoot, 'src', 'components', 'legal', 'ConsentSection.jsx');
const profilePath = path.join(repoRoot, 'src', 'pages', 'ProfileSetup.jsx');
const acceptancePath = path.join(repoRoot, 'src', 'lib', 'legal', 'recordAcceptance.js');
const legalContentDir = path.join(repoRoot, 'src', 'legal-content');

const consentSource = fs.readFileSync(consentPath, 'utf8');
const profileSource = fs.readFileSync(profilePath, 'utf8');
const acceptanceSource = fs.readFileSync(acceptancePath, 'utf8');

function occurrences(source, expression) {
  return [...source.matchAll(expression)].length;
}

function sourceOrder(...needles) {
  let prior = -1;
  for (const needle of needles) {
    const next = profileSource.indexOf(needle);
    assert.notEqual(next, -1, `missing source contract: ${needle}`);
    assert.ok(next > prior, `source contract out of order: ${needle}`);
    prior = next;
  }
}

test('S01 exactly one mandatory and one optional checkbox render for both audiences', () => {
  assert.equal(occurrences(consentSource, /<Checkbox\b/g), 2);
  assert.equal(occurrences(consentSource, /id="consent-accepted"/g), 1);
  assert.equal(occurrences(consentSource, /id="consent-marketing"/g), 1);
  assert.ok(!/isFoundingOwner\s*&&\s*\(\s*<Checkbox\b/s.test(consentSource));
});

test('S02 marketing is default-off and non-blocking', () => {
  assert.match(profileSource, /marketing:\s*false/);
  assert.doesNotMatch(profileSource, /if\s*\(\s*!consent\.marketing\s*\)/);
  assert.match(consentSource, /Unticked by default; refusing has no\s+effect on your account/);
});

test('S03 paediatric and jurisdiction controls, validation, and payload fields are absent', () => {
  assert.doesNotMatch(profileSource, /\badult_only_confirmed\s*:/);
  assert.doesNotMatch(profileSource, /\bserved_jurisdictions\s*:/);
  assert.doesNotMatch(profileSource, /name=["'](?:adult_only_confirmed|served_jurisdictions)["']/);
  assert.doesNotMatch(consentSource, /id=["'](?:adult-only|served-jurisdictions)/);
});

test('S04 every hyperlink resolves to its intended current instrument', () => {
  const expectedIds = [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS];
  assert.deepEqual(expectedIds, [
    'collection-notice', 'clinical-use-notice', 'ai-notice',
    'terms', 'dpa', 'aup', 'subscription', 'subprocessors',
  ]);
  for (const id of expectedIds) {
    const doc = LEGAL_DOCUMENTS[id];
    assert.ok(doc?.publicRoute, `${id} must be a public instrument`);
    assert.match(consentSource, new RegExp(`getLegalDocument\\(["']${id}["']\\)`));
    assert.equal(`/legal/${doc.slug}`.startsWith('/legal/'), true);
  }
  assert.match(consentSource, /to=\{`\/legal\/\$\{doc\.slug\}`\}/);
});

test('S05 unchecked mandatory consent returns before any backend mutation', () => {
  sourceOrder(
    'if (!consent.accepted) newErrors.consentAccepted',
    'if (!validateForm())',
    'base44.entities.Organization.create',
    'base44.auth.updateMe',
    'recordLegalEvents(events)',
  );
  assert.match(profileSource, /if\s*\(\s*!validateForm\(\)\s*\)\s*\{[\s\S]*?return;[\s\S]*?\}/);
});

test('S06 invited clinician produces exactly three document-bound events', () => {
  assert.equal(PRACTITIONER_NOTICE_IDS.length, 3);
  assert.match(profileSource, /documentId:\s*["']collection-notice["']/);
  assert.match(profileSource, /documentId:\s*["']clinical-use-notice["']/);
  assert.match(profileSource, /documentId:\s*["']ai-notice["']/);
  assert.match(profileSource, /const actorCapacity = foundingNewOrg \? ["']practice owner["'] : ["']invited clinician["']/);
});

test('S07 founding owner produces exactly eight document-bound events', () => {
  assert.equal(PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length, 8);
  assert.equal(CONTRACT_BUNDLE_IDS.length, 5);
  assert.match(profileSource, /if\s*\(foundingNewOrg\)\s*\{[\s\S]*?CONTRACT_BUNDLE_IDS\.map/);
  assert.match(profileSource, /eventType:\s*EVENT_TYPES\.CONTRACT_ACCEPTANCE/);
});

test('S08 each document event records the displayed version, title, and exact content fingerprint', () => {
  assert.match(acceptanceSource, /documentTitle\s*=\s*doc\.title/);
  assert.match(acceptanceSource, /documentFingerprint\s*=\s*fingerprint\(loadLegalContent\(doc\.file\)\)/);
  assert.match(acceptanceSource, /suite_version:\s*SUITE_VERSION/);
  for (const id of [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]) {
    const doc = LEGAL_DOCUMENTS[id];
    const content = fs.readFileSync(path.join(legalContentDir, doc.file), 'utf8');
    assert.equal(typeof doc.title, 'string');
    assert.ok(doc.title.length > 0);
    assert.match(fingerprint(content), /^fnv-[0-9a-f]+-\d+$/);
    assert.match(SUITE_VERSION, /\S/);
  }
});

test('S09 marketing records zero events when declined and one when selected', () => {
  assert.equal(occurrences(profileSource, /EVENT_TYPES\.MARKETING_CONSENT/g), 1);
  assert.match(profileSource, /if\s*\(consent\.marketing\)\s*\{[\s\S]*?events\.push\(\{\s*eventType:\s*EVENT_TYPES\.MARKETING_CONSENT/);
  assert.doesNotMatch(profileSource, /MARKETING_CONSENT[\s\S]{0,160}documentId/);
});

test('S10 founding-owner state cannot diverge between render and submission', () => {
  sourceOrder(
    'const foundingNewOrg = !existingMembers || existingMembers.length === 0',
    'foundingNewOrg !== isNewOrg',
    'base44.entities.Organization.create',
  );
  assert.match(profileSource, /if\s*\(typeof isNewOrg !== ["']boolean["'] \|\| foundingNewOrg !== isNewOrg\)/);
  assert.match(profileSource, /setConsent\(prev => \(\{ \.\.\.prev, accepted: false \}\)\)/);
  assert.match(profileSource, /<ConsentSection[\s\S]*?isFoundingOwner=\{isNewOrg\}/);
});

test('S11 server clinical-access gate remains satisfied by the three current notice events', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-signup-gate@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);

    const before = await requestJson(server, `/api/apps/${server.appId}/entities/Client`, { token: user.token });
    assert.equal(before.status, 403);
    assert.equal(before.body?.message, 'current legal acceptance required');

    for (const documentId of PRACTITIONER_NOTICE_IDS) {
      const doc = LEGAL_DOCUMENTS[documentId];
      const created = await requestJson(server, `/api/apps/${server.appId}/entities/LegalAcceptanceEvent`, {
        method: 'POST',
        token: user.token,
        body: {
          event_type: doc.eventType,
          user_email: user.email,
          org_id: organization.id,
          suite_version: SUITE_VERSION,
          document_id: documentId,
          document_title: doc.title,
          actor_capacity: 'invited clinician',
        },
      });
      assert.equal(created.status, 200, created.text);
    }

    const after = await requestJson(server, `/api/apps/${server.appId}/entities/Client`, { token: user.token });
    assert.equal(after.status, 200, after.text);
    assert.ok(Array.isArray(after.body));
  } finally {
    await server.stop();
  }
});

test('S12 checkbox labelling, focus, and described text remain accessible', () => {
  assert.match(consentSource, /id="consent-accepted"[\s\S]*?aria-describedby="consent-accepted-details"/);
  assert.match(consentSource, /<Label htmlFor="consent-accepted"/);
  assert.match(consentSource, /<ul id="consent-accepted-details"/);
  assert.match(consentSource, /id="consent-marketing"/);
  assert.match(consentSource, /<Label[\s\S]*?htmlFor="consent-marketing"/);
  assert.doesNotMatch(consentSource, /tabIndex=\{?-1\}?/);
});
