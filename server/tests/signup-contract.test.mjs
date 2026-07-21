import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_BUNDLE_IDS,
  EVENT_TYPES,
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
  fingerprint,
  isLegalDocumentPublicationApproved,
} from '../../src/lib/legal/documentRegistry.js';
import { effectiveLegalContent } from '../../src/lib/legal/effectiveContent.js';
import {
  currentLegalReceiptRequirements,
  hasCurrentLegalAcceptance as hasCurrentBrowserLegalAcceptance,
  selectedOrganizationLegalAcceptanceStatus,
} from '../../src/lib/legal/acceptanceGate.js';
import { isInitialClinicalReleaseEligible } from '../../src/lib/clinicalRelease.js';
import {
  resolveLegalConsentAudience,
  resolveLegalConsentAudiences,
} from '../../src/lib/legal/consentAudience.js';
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
const profileEditorPath = path.join(repoRoot, 'src', 'pages', 'MyProfile.jsx');
const legalNoticesPath = path.join(repoRoot, 'src', 'pages', 'LegalNotices.jsx');
const acceptancePath = path.join(repoRoot, 'src', 'lib', 'legal', 'recordAcceptance.js');
const legalContentDir = path.join(repoRoot, 'src', 'legal-content');
const serverIndexSource = fs.readFileSync(path.join(repoRoot, 'server', 'index.mjs'), 'utf8');
const integrationsSource = fs.readFileSync(path.join(repoRoot, 'server', 'integrations.mjs'), 'utf8');

const consentSource = fs.readFileSync(consentPath, 'utf8');
const profileSource = fs.readFileSync(profilePath, 'utf8');
const profileEditorSource = fs.readFileSync(profileEditorPath, 'utf8');
const legalNoticesSource = fs.readFileSync(legalNoticesPath, 'utf8');
const layoutSource = fs.readFileSync(path.join(repoRoot, 'src', 'Layout.jsx'), 'utf8');
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
  assert.match(legalNoticesSource, /<ConsentSection/);
  assert.doesNotMatch(legalNoticesSource, /PractitionerNoticesSection/);
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
  assert.doesNotMatch(profileSource, /Country of Practice|Select your country|value=["'](?:usa|canada|new_zealand|united_kingdom)["']/i);
  assert.match(profileSource, /country:\s*["']australia["']/);
  assert.match(profileSource, /Accredited Exercise Physiologist \(AEP\)/);
  assert.match(profileSource, /<SelectItem value=["']Gym Management["']>Gym Management<\/SelectItem>/);
  assert.match(profileSource, /<SelectItem value=["']Clinic Management["']>Clinic Management<\/SelectItem>/);
  assert.doesNotMatch(
    profileSource,
    /<SelectItem value=["'](?:Physiotherapist|Occupational Therapist|Psychologist|Dietitian|Other)["']>/,
  );
  assert.doesNotMatch(profileEditorSource, /Country of Practice|Select country|United States|Canada|New Zealand|United Kingdom/i);
  assert.match(profileEditorSource, /Accredited Exercise Physiologist \(AEP\)/);
  assert.match(profileEditorSource, /<SelectItem value=["']Gym Management["']>Gym Management<\/SelectItem>/);
  assert.match(profileEditorSource, /<SelectItem value=["']Clinic Management["']>Clinic Management<\/SelectItem>/);
  assert.doesNotMatch(
    profileEditorSource,
    /<SelectItem value=["'](?:Exercise Scientist|Dual Exercise Scientist & Exercise Physiologist)["']>/,
  );
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
    assert.equal(isLegalDocumentPublicationApproved(doc), true, `${id} must be enacted before clickwrap`);
    const content = fs.readFileSync(path.join(legalContentDir, doc.file), 'utf8');
    assert.doesNotMatch(
      content,
      /\*\*Release status:\*\*[^\r\n]*(?:\bDRAFT\b|NOT APPROVED)|\bProposed provider\b|\bProposed issuer\b|\bCurrent proposed plans\b/i,
    );
    assert.match(consentSource, new RegExp(`getLegalDocument\\(["']${id}["']\\)`));
    assert.equal(`/legal/${doc.slug}`.startsWith('/legal/'), true);
  }
  assert.match(consentSource, /to=\{`\/legal\/\$\{doc\.slug\}`\}/);
});

test('S05 unchecked mandatory consent returns before any backend mutation', () => {
  sourceOrder(
    'if (!consent.accepted) newErrors.consentAccepted',
    'if (!validateForm())',
    'ensureFounderOrganization({',
    'base44.auth.updateMe',
    'recordLegalAcceptanceBundle({ orgId: org.id, marketingOptIn: consent.marketing })',
  );
  assert.match(profileSource, /if\s*\(\s*!validateForm\(\)\s*\)\s*\{[\s\S]*?return;[\s\S]*?\}/);
});

test('S06 invited clinician produces exactly three document-bound events', () => {
  assert.equal(PRACTITIONER_NOTICE_IDS.length, 3);
  assert.match(serverIndexSource, /const documentIds = ownerBundle[\s\S]*?: \[\.\.\.PRACTITIONER_NOTICE_IDS\]/);
  assert.match(serverIndexSource, /const actorCapacity = ownerBundle \? 'practice owner' : 'invited clinician'/);
});

test('S07 founding owner produces exactly eight document-bound events', () => {
  assert.equal(PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length, 8);
  assert.equal(CONTRACT_BUNDLE_IDS.length, 5);
  assert.match(serverIndexSource, /\[\.\.\.PRACTITIONER_NOTICE_IDS, \.\.\.CONTRACT_BUNDLE_IDS\]/);
  assert.match(serverIndexSource, /event_type:\s*receipt\.eventType/);
  assert.match(serverIndexSource, /BEGIN IMMEDIATE[\s\S]*?COMMIT[\s\S]*?ROLLBACK/);
  assert.ok(PRACTITIONER_NOTICE_IDS.every((id) => typeof LEGAL_DOCUMENTS[id].eventType === 'string'));
  assert.ok(CONTRACT_BUNDLE_IDS.every(
    (id) => LEGAL_DOCUMENTS[id].eventType === EVENT_TYPES.CONTRACT_ACCEPTANCE,
  ));
});

test('S08 each document event records the displayed version, title, and exact content fingerprint', () => {
  assert.match(serverIndexSource, /effectiveLegalContent\(raw,/);
  assert.match(serverIndexSource, /document_title:\s*document\.title/);
  assert.match(serverIndexSource, /document_fingerprint:\s*receipt\.fingerprint/);
  assert.match(serverIndexSource, /suite_version:\s*LEGAL_SUITE_VERSION/);
  assert.match(acceptanceSource, /RecordLegalAcceptanceBundle/);
  for (const id of [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]) {
    const doc = LEGAL_DOCUMENTS[id];
    const content = fs.readFileSync(path.join(legalContentDir, doc.file), 'utf8');
    const displayed = effectiveLegalContent(content, {
      status: 'effective',
      effectiveDate: '19 July 2026',
    });
    assert.equal(typeof doc.title, 'string');
    assert.ok(doc.title.length > 0);
    assert.match(fingerprint(displayed), /^sha256-[0-9a-f]{64}$/);
    assert.equal(displayed, content);
    assert.match(SUITE_VERSION, /\S/);
  }
  const aiNotice = LEGAL_DOCUMENTS['ai-notice'];
  const aiContent = fs.readFileSync(path.join(legalContentDir, aiNotice.file), 'utf8');
  assert.equal(aiNotice.controlledRevision, '2026-07-21.2');
  assert.equal(aiNotice.revisionAuthority, 'Mission UM-AUTO-20260720-ASSESSSUITE-REFERRAL-RECOVERY');
  assert.match(aiContent, /The revised bytes produce a new document fingerprint/);
  assert.match(aiContent, /no separately entered date of birth is required for the provider gate/);
  assert.match(aiContent, /`store: false`, `background: false`, `prompt_cache_retention: in_memory`/);
  assert.match(aiContent, /durable content-free no-retry quarantine marker/);
  assert.match(aiContent, /Immediately before provider contact, its live expiry is durably reduced/);
  assert.match(aiContent, /Routine production retention of content-free upload and extraction audit receipts is exactly 730 days/);
  assert.match(aiContent, /snapshots and backups capture encrypted volume block devices without decrypting them/);
  assert.match(aiContent, /Fly exposes no separate per-snapshot encryption field/);
  assert.match(aiContent, /does not store or verify those underlying patient-level records/);
  assert.match(aiContent, /For up to four selected files, AssessSuite sends one separate request per file/);
  assert.match(aiContent, /deterministically merges the results in selected-file order inside the application/);
  assert.match(aiContent, /If any required file or per-file provider request fails, the whole selected set fails/);
  assert.match(aiContent, /selected existing client has a reviewed date of birth showing an under-13 patient/);
  assert.match(aiContent, /Every upload in that review then becomes unavailable to the application and remains blocked from provider retry/);

  const privacy = LEGAL_DOCUMENTS.privacy;
  const privacyContent = fs.readFileSync(path.join(legalContentDir, privacy.file), 'utf8');
  assert.equal(privacy.controlledRevision, '2026-07-21.2');
  assert.equal(privacy.revisionAuthority, 'Mission UM-AUTO-20260720-ASSESSSUITE-REFERRAL-RECOVERY');
  assert.match(privacyContent, /Physical deletion occurs only when cleanup succeeds/);
  assert.match(privacyContent, /removed from recurring minute-by-minute cleanup selection/);
  assert.match(privacyContent, /does not retroactively purge bytes already captured in an unexpired snapshot/);
  assert.match(privacyContent, /one separate Responses API request for each selected referral file, up to four files/);
  assert.match(privacyContent, /does not send all selected files in a single provider request or report partial success/);
  assert.match(privacyContent, /create\/update commit also fails before any clinical write/);
  assert.match(fingerprint(privacyContent), /^sha256-[0-9a-f]{64}$/);

  for (const id of ['terms', 'dpa', 'subprocessors']) {
    assert.equal(LEGAL_DOCUMENTS[id].controlledRevision, '2026-07-21.1');
    assert.equal(
      LEGAL_DOCUMENTS[id].revisionAuthority,
      'Mission UM-AUTO-20260720-ASSESSSUITE-REFERRAL-RECOVERY',
    );
  }
});

test('S09 marketing records zero events when declined and one when selected', () => {
  assert.match(profileSource, /marketingOptIn:\s*consent\.marketing/);
  assert.match(integrationsSource, /marketingOptIn:\s*body\?\.marketing_opt_in === true/);
  assert.match(serverIndexSource, /if \(marketingOptIn\) \{[\s\S]*?EVENT_TYPES\.MARKETING_CONSENT/);
  assert.match(serverIndexSource, /event_type:\s*EVENT_TYPES\.MARKETING_CONSENT[\s\S]*?document_id:\s*null/);
});

test('S10 founding-owner state cannot diverge between render and submission', () => {
  sourceOrder(
    'const liveAudience = resolveLegalConsentAudience(existingMembers)',
    'liveAudience.ownerBundle !== consentAudience.ownerBundle',
    'ensureFounderOrganization({',
  );
  assert.match(profileSource, /liveAudience\.orgId !== consentAudience\.orgId/);
  assert.match(profileSource, /liveAudience\.willCreateOrganization !== consentAudience\.willCreateOrganization/);
  assert.match(profileSource, /setConsent\(prev => \(\{ \.\.\.prev, accepted: false \}\)\)/);
  assert.match(profileSource, /<ConsentSection[\s\S]*?isFoundingOwner=\{consentAudience\?\.ownerBundle !== false\}/);
});

test('S14 owner clickwrap survives post-membership acceptance failure and role parity is preserved', () => {
  const firstAttempt = resolveLegalConsentAudience([]);
  assert.deepEqual(firstAttempt, {
    orgId: null,
    ownerBundle: true,
    willCreateOrganization: true,
  });

  // Simulate the retry after the first attempt created the owner membership
  // but RecordLegalAcceptanceBundle failed before recording any receipts.
  const retry = resolveLegalConsentAudience([
    { org_id: 'org-created-before-failure', role: 'owner', is_primary: true },
  ]);
  assert.deepEqual(retry, {
    orgId: 'org-created-before-failure',
    ownerBundle: true,
    willCreateOrganization: false,
  });
  assert.equal(firstAttempt.ownerBundle, retry.ownerBundle);

  const invited = resolveLegalConsentAudience([
    { org_id: 'org-invited', role: 'member', is_primary: true },
  ]);
  assert.equal(invited.ownerBundle, false);

  const primaryOwner = resolveLegalConsentAudience([
    { org_id: 'org-secondary', role: 'member', is_primary: false },
    { org_id: 'org-primary', role: 'owner', is_primary: true },
  ]);
  assert.equal(primaryOwner.orgId, 'org-primary');
  assert.equal(primaryOwner.ownerBundle, true);
  assert.match(layoutSource, /resolveLegalConsentAudience\(memberships\)/);
  assert.match(layoutSource, /org_id:\s*legalAudience\.orgId/);
  assert.match(layoutSource, /LegalNotices\?org_id=/);
  assert.match(legalNoticesSource, /resolveLegalConsentAudiences\(membershipRows\)/);
  assert.match(legalNoticesSource, /resolveLegalConsentAudience\(membershipRows, requestedOrgId\)/);
  assert.doesNotMatch(legalNoticesSource, /membershipRows\.find\(/);
  assert.match(legalNoticesSource, /Acceptance is recorded separately for each practice membership/);
});

test('S11 server rejects forged notice rows and accepts only its complete derived bundle', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-signup-gate@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);

    const before = await requestJson(server, `/api/apps/${server.appId}/entities/Client`, { token: user.token });
    assert.equal(before.status, 403);
    assert.equal(before.body?.message, 'current legal acceptance required');

    const forged = await requestJson(server, `/api/apps/${server.appId}/entities/LegalAcceptanceEvent`, {
      method: 'POST',
      token: user.token,
      body: {
        event_type: EVENT_TYPES.AI_TRANSPARENCY_CONSENT,
        user_email: user.email,
        org_id: organization.id,
        suite_version: SUITE_VERSION,
      },
    });
    assert.equal(forged.status, 403, forged.text);

    const bundle = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(bundle.status, 200, bundle.text);
    assert.equal(bundle.body?.recorded, 3);
    assert.equal(bundle.body?.owner_bundle, false);

    const receipts = await requestJson(server, `/api/apps/${server.appId}/entities/LegalAcceptanceEvent`, {
      token: user.token,
    });
    assert.equal(receipts.status, 200, receipts.text);
    assert.equal(receipts.body.length, 3);
    assert.ok(receipts.body.every((event) => /^sha256-[0-9a-f]{64}$/.test(event.document_fingerprint)));
    for (const receipt of receipts.body) {
      const document = LEGAL_DOCUMENTS[receipt.document_id];
      const raw = fs.readFileSync(path.join(legalContentDir, document.file), 'utf8');
      assert.equal(receipt.document_title, document.title);
      assert.equal(receipt.document_fingerprint, fingerprint(raw));
      assert.equal(receipt.event_type, document.eventType);
      assert.equal(receipt.suite_version, SUITE_VERSION);
    }

    const after = await requestJson(server, `/api/apps/${server.appId}/entities/Client`, { token: user.token });
    assert.equal(after.status, 200, after.text);
    assert.ok(Array.isArray(after.body));
  } finally {
    await server.stop();
  }
});

test('S12 checkbox labelling, focus, and described text remain accessible', () => {
  assert.match(
    consentSource,
    /id="consent-accepted"[\s\S]*?aria-describedby=\{error[\s\S]*?consent-accepted-details consent-accepted-error/,
  );
  assert.match(consentSource, /aria-invalid=\{Boolean\(error\)\}/);
  assert.match(consentSource, /<Label htmlFor="consent-accepted"/);
  assert.match(consentSource, /<ul id="consent-accepted-details"/);
  assert.match(
    consentSource,
    /<p[\s\S]*?id="consent-accepted-error"[\s\S]*?role="alert"[\s\S]*?aria-live="assertive"[\s\S]*?aria-atomic="true"/,
  );
  assert.match(consentSource, /id="consent-marketing"/);
  assert.match(consentSource, /<Label[\s\S]*?htmlFor="consent-marketing"/);
  assert.doesNotMatch(consentSource, /tabIndex=\{?-1\}?/);
});

test('S13 owner bundle records eight typed, document-bound receipts', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-owner-signup-gate@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user, 'owner');

    const bundle = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(bundle.status, 200, bundle.text);
    assert.equal(bundle.body?.recorded, 8);
    assert.equal(bundle.body?.owner_bundle, true);

    const receipts = await requestJson(server, `/api/apps/${server.appId}/entities/LegalAcceptanceEvent`, {
      token: user.token,
    });
    assert.equal(receipts.status, 200, receipts.text);
    assert.equal(receipts.body.length, 8);
    assert.ok(receipts.body.every((event) => typeof event.event_type === 'string' && event.event_type.length > 0));
    assert.deepEqual(
      new Set(receipts.body.map((event) => event.document_id)),
      new Set([...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]),
    );
    for (const receipt of receipts.body) {
      const document = LEGAL_DOCUMENTS[receipt.document_id];
      const raw = fs.readFileSync(path.join(legalContentDir, document.file), 'utf8');
      assert.equal(receipt.document_title, document.title);
      assert.equal(receipt.document_fingerprint, fingerprint(raw));
      assert.equal(receipt.event_type, document.eventType);
      assert.equal(receipt.suite_version, SUITE_VERSION);
    }
  } finally {
    await server.stop();
  }
});

test('S15 enacted public instruments do not incorporate the draft retention policy', () => {
  const prohibited = /Customer-Facing Retention and Exit Schedule|\bPart A\b|Records Retention, Export, Deletion and Exit Policy/i;
  for (const file of fs.readdirSync(legalContentDir).filter((name) => name.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(legalContentDir, file), 'utf8');
    assert.doesNotMatch(raw, prohibited, file);
  }
});

test('S16 browser gate matches the server document-bound, role-dependent receipt contract', () => {
  const orgId = 'org-synthetic-parity';
  const legalSettings = { status: 'effective', effective_date: '19 July 2026' };
  const readContent = (filename) => fs.readFileSync(path.join(legalContentDir, filename), 'utf8');
  const asEvents = (requirements) => requirements.map((required) => ({
    org_id: orgId,
    suite_version: required.suiteVersion,
    event_type: required.eventType,
    document_id: required.documentId,
    document_title: required.documentTitle,
    document_fingerprint: required.documentFingerprint,
  }));

  const memberRequirements = currentLegalReceiptRequirements({
    ownerBundle: false,
    legalSettings,
    readContent,
  });
  const ownerRequirements = currentLegalReceiptRequirements({
    ownerBundle: true,
    legalSettings,
    readContent,
  });
  assert.equal(memberRequirements.length, 3);
  assert.equal(ownerRequirements.length, 8);

  const memberEvents = asEvents(memberRequirements);
  const ownerEvents = asEvents(ownerRequirements);
  const accepted = (events, ownerBundle = false) => hasCurrentBrowserLegalAcceptance({
    events,
    orgId,
    ownerBundle,
    legalSettings,
    readContent,
  });
  assert.equal(accepted(memberEvents), true);
  assert.equal(accepted(ownerEvents, true), true);
  assert.equal(accepted(memberEvents, true), false, 'an owner cannot pass with notice-only receipts');
  assert.equal(accepted(memberEvents.slice(1)), false, 'a partial practitioner bundle must be stale');

  const mutations = {
    org_id: 'org-other',
    suite_version: 'RC-stale',
    event_type: 'wrong_event',
    document_id: 'wrong-document',
    document_title: 'Wrong title',
    document_fingerprint: `sha256-${'0'.repeat(64)}`,
  };
  for (const [field, value] of Object.entries(mutations)) {
    const altered = memberEvents.map((event) => ({ ...event }));
    altered[0][field] = value;
    assert.equal(accepted(altered), false, `${field} mismatch must route to re-acceptance`);
  }

  assert.match(layoutSource, /selectedOrganizationLegalAcceptanceStatus\(\{/);
  assert.match(layoutSource, /orgId:\s*legalAudience\.orgId/);
  assert.match(layoutSource, /legalSettings:\s*appPublicSettings\?\.public_settings\?\.legal/);
  assert.match(layoutSource, /readContent:\s*loadLegalContent/);
  assert.doesNotMatch(layoutSource, /REQUIRED_NOTICE_EVENT_TYPES/);
});

test('S17 browser and server share the exact clinical-release profile predicate', () => {
  assert.equal(isInitialClinicalReleaseEligible({
    country: 'australia',
    profession: 'Exercise Physiologist',
  }), true);
  assert.equal(isInitialClinicalReleaseEligible({
    country: 'Australia',
    profession: 'Exercise Physiologist',
  }), false);
  assert.equal(isInitialClinicalReleaseEligible({
    country: 'australia',
    profession: 'Physiotherapist',
  }), false);
  assert.equal(isInitialClinicalReleaseEligible({ profession: 'Exercise Physiologist' }), false);
  assert.match(layoutSource, /isInitialClinicalReleaseEligible\(freshUser\)/);
  assert.match(layoutSource, /ProfileSetup\?reason=clinical-profile/);
});

test('S18 acceptance is enforced independently for every selectable practice', () => {
  const legalSettings = { status: 'effective', effective_date: '19 July 2026' };
  const readContent = (filename) => fs.readFileSync(path.join(legalContentDir, filename), 'utf8');
  const memberships = [
    // The weaker duplicate deliberately arrives first: owner must still win.
    { org_id: 'org-secondary-owner', role: 'member', is_primary: false },
    { org_id: 'org-primary-member', role: 'member', is_primary: true },
    { org_id: 'org-secondary-owner', role: 'owner', is_primary: false },
  ];
  const audiences = resolveLegalConsentAudiences(memberships);
  assert.deepEqual(audiences, [
    { orgId: 'org-primary-member', ownerBundle: false, willCreateOrganization: false },
    { orgId: 'org-secondary-owner', ownerBundle: true, willCreateOrganization: false },
  ]);
  assert.deepEqual(resolveLegalConsentAudience(memberships, 'org-secondary-owner'), {
    orgId: 'org-secondary-owner',
    ownerBundle: true,
    willCreateOrganization: false,
  });

  const eventsFor = (audience) => currentLegalReceiptRequirements({
    ownerBundle: audience.ownerBundle,
    legalSettings,
    readContent,
  }).map((required) => ({
    org_id: audience.orgId,
    suite_version: required.suiteVersion,
    event_type: required.eventType,
    document_id: required.documentId,
    document_title: required.documentTitle,
    document_fingerprint: required.documentFingerprint,
  }));
  const completeEvents = audiences.flatMap(eventsFor);
  for (const audience of audiences) {
    assert.equal(selectedOrganizationLegalAcceptanceStatus({
      events: completeEvents,
      memberships,
      orgId: audience.orgId,
      legalSettings,
      readContent,
    }).accepted, true);
  }

  const staleSecondary = completeEvents.map((event) => (
    event.org_id === 'org-secondary-owner' && event.document_id === 'ai-notice'
      ? { ...event, document_fingerprint: `sha256-${'0'.repeat(64)}` }
      : event
  ));
  const secondaryStatus = selectedOrganizationLegalAcceptanceStatus({
    events: staleSecondary,
    memberships,
    orgId: 'org-secondary-owner',
    legalSettings,
    readContent,
  });
  assert.equal(secondaryStatus.accepted, false);
  assert.equal(secondaryStatus.reason, 'acceptance_required');
  assert.deepEqual(secondaryStatus.missingDocumentIds, ['ai-notice']);

  const wrongOrgReceipts = selectedOrganizationLegalAcceptanceStatus({
    events: completeEvents.filter((event) => event.org_id === 'org-primary-member'),
    memberships,
    orgId: 'org-secondary-owner',
    legalSettings,
    readContent,
  });
  assert.equal(wrongOrgReceipts.accepted, false);
  assert.ok(wrongOrgReceipts.missingDocumentIds.includes('ai-notice'));

  const missingMembership = selectedOrganizationLegalAcceptanceStatus({
    events: completeEvents,
    memberships,
    orgId: 'org-not-a-membership',
    legalSettings,
    readContent,
  });
  assert.deepEqual(missingMembership, {
    accepted: false,
    orgId: 'org-not-a-membership',
    ownerBundle: false,
    missingDocumentIds: [],
    reason: 'membership_missing',
  });
});

test('S19 server rejects a stale AI-notice fingerprint and a fresh bundle restores access', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-fingerprint-reacceptance@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);
    const route = `/api/apps/${server.appId}/entities/Client?q=${encodeURIComponent(JSON.stringify({
      org_id: organization.id,
    }))}`;

    const initialBundle = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(initialBundle.status, 200, initialBundle.text);
    const initiallyAllowed = await requestJson(server, route, { token: user.token });
    assert.equal(initiallyAllowed.status, 200, initiallyAllowed.text);

    const assuranceDb = new DatabaseSync(server.dbPath);
    try {
      const rows = assuranceDb.prepare('SELECT id, data FROM entity_LegalAcceptanceEvent').all();
      const update = assuranceDb.prepare('UPDATE entity_LegalAcceptanceEvent SET data = ? WHERE id = ?');
      let changed = 0;
      for (const row of rows) {
        const receipt = JSON.parse(row.data);
        if (
          receipt.user_email === user.email
          && receipt.org_id === organization.id
          && receipt.document_id === 'ai-notice'
        ) {
          receipt.document_fingerprint = `sha256-${'0'.repeat(64)}`;
          changed += Number(update.run(JSON.stringify(receipt), row.id).changes);
        }
      }
      assert.equal(changed, 1);
    } finally {
      assuranceDb.close();
    }

    const staleBlocked = await requestJson(server, route, { token: user.token });
    assert.equal(staleBlocked.status, 403, staleBlocked.text);
    assert.equal(staleBlocked.body?.message, 'current legal acceptance required');

    const refreshedBundle = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(refreshedBundle.status, 200, refreshedBundle.text);
    const restored = await requestJson(server, route, { token: user.token });
    assert.equal(restored.status, 200, restored.text);
  } finally {
    await server.stop();
  }
});

test('S20 a mid-bundle receipt failure rolls back every receipt and a retry creates one complete bundle', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-bundle-atomicity@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);
    const assuranceDb = new DatabaseSync(server.dbPath);
    try {
      assuranceDb.exec(`
        CREATE TRIGGER synthetic_legal_bundle_midloop_fault
        BEFORE INSERT ON entity_LegalAcceptanceEvent
        WHEN json_extract(NEW.data, '$.document_id') = 'ai-notice'
        BEGIN
          SELECT RAISE(ABORT, 'synthetic_legal_bundle_midloop_fault');
        END;
      `);
    } finally {
      assuranceDb.close();
    }

    const failed = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: true } },
    );
    assert.equal(failed.status, 500, failed.text);

    const afterFailure = new DatabaseSync(server.dbPath);
    try {
      assert.equal(afterFailure.prepare('SELECT COUNT(*) AS n FROM entity_LegalAcceptanceEvent').get().n, 0);
      afterFailure.exec('DROP TRIGGER synthetic_legal_bundle_midloop_fault;');
    } finally {
      afterFailure.close();
    }

    const retry = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: true } },
    );
    assert.equal(retry.status, 200, retry.text);
    assert.equal(retry.body?.recorded, PRACTITIONER_NOTICE_IDS.length + 1);

    const afterRetry = new DatabaseSync(server.dbPath);
    try {
      const rows = afterRetry.prepare('SELECT data FROM entity_LegalAcceptanceEvent').all()
        .map((row) => JSON.parse(row.data));
      assert.equal(rows.length, PRACTITIONER_NOTICE_IDS.length + 1);
      assert.equal(new Set(rows.map((row) => `${row.event_type}\u0000${row.document_id || ''}`)).size, rows.length);
      assert.equal(rows.filter((row) => row.event_type === EVENT_TYPES.MARKETING_CONSENT).length, 1);
      assert.deepEqual(
        new Set(rows.filter((row) => row.document_id).map((row) => row.document_id)),
        new Set(PRACTITIONER_NOTICE_IDS),
      );
    } finally {
      afterRetry.close();
    }
  } finally {
    await server.stop();
  }
});

test('S21 a successful owner and marketing bundle replay is response-stable and creates no duplicate events', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-bundle-replay@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user, 'owner');
    const request = {
      method: 'POST',
      token: user.token,
      body: { org_id: organization.id, marketing_opt_in: true },
    };
    const route = `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`;

    const first = await requestJson(server, route, request);
    assert.equal(first.status, 200, first.text);
    assert.deepEqual(first.body, {
      status: 'success',
      recorded: PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length + 1,
      owner_bundle: true,
    });

    // Simulate a response-lost retry by sending the identical request again.
    const replay = await requestJson(server, route, request);
    assert.equal(replay.status, 200, replay.text);
    assert.deepEqual(replay.body, first.body);

    const assuranceDb = new DatabaseSync(server.dbPath);
    try {
      const rows = assuranceDb.prepare('SELECT data FROM entity_LegalAcceptanceEvent').all()
        .map((row) => JSON.parse(row.data));
      assert.equal(rows.length, first.body.recorded);
      assert.equal(rows.filter((row) => row.event_type === EVENT_TYPES.MARKETING_CONSENT).length, 1);
      assert.equal(
        new Set(rows.map((row) => `${row.event_type}\u0000${row.document_id || ''}`)).size,
        rows.length,
      );
    } finally {
      assuranceDb.close();
    }
  } finally {
    await server.stop();
  }
});

test('S22 weaker-first duplicate membership records the owner bundle and permits clinical access', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-owner-wins-membership@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user, 'member');
    const strongerDuplicate = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/OrganizationMember`,
      {
        method: 'POST',
        token: adminToken,
        body: {
          org_id: organization.id,
          user_email: user.email,
          role: 'owner',
          is_primary: false,
        },
      },
    );
    assert.equal(strongerDuplicate.status, 200, strongerDuplicate.text);

    const bundle = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(bundle.status, 200, bundle.text);
    assert.equal(bundle.body?.owner_bundle, true);
    assert.equal(bundle.body?.recorded, PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length);

    const clinical = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/Client?q=${encodeURIComponent(JSON.stringify({
        org_id: organization.id,
      }))}`,
      { token: user.token },
    );
    assert.equal(clinical.status, 200, clinical.text);

    const assuranceDb = new DatabaseSync(server.dbPath);
    try {
      const rows = assuranceDb.prepare('SELECT data FROM entity_LegalAcceptanceEvent').all()
        .map((row) => JSON.parse(row.data));
      assert.equal(rows.length, PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length);
      assert.deepEqual(
        new Set(rows.map((row) => row.document_id)),
        new Set([...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]),
      );
    } finally {
      assuranceDb.close();
    }
  } finally {
    await server.stop();
  }
});

test('S23 a partial historical owner bundle heals by inserting only the missing receipt', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-partial-bundle-heal@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user, 'owner');
    const route = `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`;
    const request = {
      method: 'POST',
      token: user.token,
      body: { org_id: organization.id, marketing_opt_in: false },
    };

    const initial = await requestJson(server, route, request);
    assert.equal(initial.status, 200, initial.text);
    assert.equal(initial.body?.recorded, PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length);

    const partialDb = new DatabaseSync(server.dbPath);
    try {
      const target = partialDb.prepare('SELECT id, data FROM entity_LegalAcceptanceEvent').all()
        .find((row) => JSON.parse(row.data).document_id === 'ai-notice');
      assert.ok(target, 'the synthetic bundle must contain the AI notice receipt');
      assert.equal(
        partialDb.prepare('DELETE FROM entity_LegalAcceptanceEvent WHERE id = ?').run(target.id).changes,
        1,
      );
      assert.equal(
        partialDb.prepare('SELECT COUNT(*) AS n FROM entity_LegalAcceptanceEvent').get().n,
        PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length - 1,
      );
    } finally {
      partialDb.close();
    }

    const healed = await requestJson(server, route, request);
    assert.equal(healed.status, 200, healed.text);
    assert.deepEqual(healed.body, initial.body);

    const assuranceDb = new DatabaseSync(server.dbPath);
    try {
      const rows = assuranceDb.prepare('SELECT data FROM entity_LegalAcceptanceEvent').all()
        .map((row) => JSON.parse(row.data));
      const expectedDocumentIds = [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS];
      assert.equal(rows.length, expectedDocumentIds.length);
      for (const documentId of expectedDocumentIds) {
        assert.equal(
          rows.filter((row) => row.document_id === documentId).length,
          1,
          `${documentId} must have exactly one receipt after healing`,
        );
      }
    } finally {
      assuranceDb.close();
    }
  } finally {
    await server.stop();
  }
});

test('S24 later marketing opt-in adds one event without duplicating the mandatory owner bundle', async () => {
  const server = await startTestServer();
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-later-marketing-opt-in@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user, 'owner');
    const route = `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`;

    const mandatoryOnly = await requestJson(server, route, {
      method: 'POST',
      token: user.token,
      body: { org_id: organization.id, marketing_opt_in: false },
    });
    assert.equal(mandatoryOnly.status, 200, mandatoryOnly.text);
    assert.equal(
      mandatoryOnly.body?.recorded,
      PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length,
    );

    const withMarketing = await requestJson(server, route, {
      method: 'POST',
      token: user.token,
      body: { org_id: organization.id, marketing_opt_in: true },
    });
    assert.equal(withMarketing.status, 200, withMarketing.text);
    assert.deepEqual(withMarketing.body, {
      status: 'success',
      recorded: PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length + 1,
      owner_bundle: true,
    });

    const assuranceDb = new DatabaseSync(server.dbPath);
    try {
      const rows = assuranceDb.prepare('SELECT data FROM entity_LegalAcceptanceEvent').all()
        .map((row) => JSON.parse(row.data));
      const mandatoryRows = rows.filter((row) => row.document_id);
      assert.equal(rows.length, PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length + 1);
      assert.equal(mandatoryRows.length, PRACTITIONER_NOTICE_IDS.length + CONTRACT_BUNDLE_IDS.length);
      assert.equal(new Set(mandatoryRows.map((row) => row.document_id)).size, mandatoryRows.length);
      assert.equal(rows.filter((row) => row.event_type === EVENT_TYPES.MARKETING_CONSENT).length, 1);
    } finally {
      assuranceDb.close();
    }
  } finally {
    await server.stop();
  }
});
