import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import {
  CANONICAL_REFERRAL_PROFILE_FULL_39,
  fullFieldReferralPdfFixture,
} from './support/syntheticReferralFixtures.mjs';

export const PARITY_NAMESPACE = 'asr-r2-20260721';
export const PARITY_BASE_URL = 'http://127.0.0.1:48787';
export const PARITY_PROVIDER_CALL_LIMIT = 1;
export const PARITY_DB_PATH = '/app/server/data/assesssuite-parity.db';
export const PARITY_UPLOADS_DIR = '/app/server/data/assesssuite-parity-uploads';
export const PARITY_APP_ID = 'local-assesssuite';
export const PARITY_ADMIN_EMAIL = 'admin@asr-r2-20260721.seed.test';
export const PARITY_RECEIPT_BEGIN = 'ASSESSSUITE_PARITY_RECEIPT_BEGIN';
export const PARITY_RECEIPT_END = 'ASSESSSUITE_PARITY_RECEIPT_END';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNNER_PATH = fileURLToPath(import.meta.url);
const FIXTURE_PATH = path.join(REPO_ROOT, 'server', 'tests', 'support', 'syntheticReferralFixtures.mjs');
const CLEANUP_PATH = path.join(REPO_ROOT, 'server', 'tests', 'production-parity-cleanup.mjs');
const CONFIG_PATH = path.join(REPO_ROOT, 'fly.production.toml');
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export const BROWSER_RECEIPT_KEYS = Object.freeze([
  'schema_version',
  'action',
  'result',
  'namespace',
  'wave_id',
  'runner_sha256',
  'fixture_sha256',
  'cleanup_sha256',
  'config_sha256',
  'base_url',
  'synthetic_user_count',
  'synthetic_document_count',
  'provider_call_limit',
  'profile_setup_post_payment_surface',
  'mandatory_checkbox_count',
  'marketing_checkbox_count',
  'marketing_default_checked',
  'required_notice_links_present',
  'adult_only_control_present',
  'paediatric_control_present',
  'state_territory_jurisdiction_control_present',
  'date_of_birth_control_present',
  'signup_acceptance_submissions',
  'signup_acceptance_retry_requests',
  'single_practice_uploader_present',
  'multi_practice_uploader_present',
  'mandatory_review_presented',
  'review_commit_required',
  'referral_commit_performed',
  'api_observed_client_records_created',
  'screenshot_files',
  'screenshot_sha256',
]);

const CLINICAL_ENTITIES = Object.freeze([
  'AdverseEvent',
  'Appointment',
  'AssessmentRequest',
  'Client',
  'ClientAssessment',
  'ClientCondition',
  'ClientDocument',
  'ClientNutritionPlan',
  'ClientOnboardingEpisode',
  'ClientReport',
  'Payment',
  'SOAPNote',
  'SavedReport',
]);

export const REVIEW_CONTROLS = Object.freeze({
  full_name: ['Full Name', 'value'],
  date_of_birth: ['Date of Birth', 'value'],
  gender: ['Gender', 'Female'],
  phone: ['Phone', 'value'],
  email: ['Email', 'value'],
  address: ['Address', 'value'],
  referral_source: ['Referral Source', 'General Practitioner'],
  referral_source_name: ['Referrer Name', 'value'],
  referral_source_address: ['Referrer Address', 'value'],
  referral_source_email: ['Referrer Email', 'value'],
  referral_provider_number: ['Provider Number', 'value'],
  referral_reason: ['Referral Reason', 'value'],
  referral_date: ['Referral Date', 'value'],
  funding_source: ['Funding Source', 'WorkCover QLD'],
  medicare_number: ['Medicare Number', 'value'],
  medicare_irn: ['Medicare IRN', 'value'],
  dva_card_number: ['DVA Card Number', 'value'],
  dva_card_type: ['DVA Card Type', 'Gold'],
  dva_file_number: ['DVA File Number', 'value'],
  dva_accepted_conditions: ['DVA Accepted Conditions', 'value'],
  ndis_number: ['NDIS Number', 'value'],
  ndis_goals: ['NDIS Goals', 'value'],
  private_health_fund_name: ['Health Fund Name', 'value'],
  private_health_fund_number: ['Member Number', 'value'],
  workcover_claim_number: ['WorkCover Claim Number', 'value'],
  workcover_date_of_injury: ['Date of Injury', 'value'],
  workcover_injury_description: ['Injury Description', 'value'],
  primary_condition: ['Primary Condition', 'value'],
  comorbidities: ['Other Conditions', 'value'],
  medications: ['Current Medications', 'value'],
  medical_history: ['Relevant Medical History', 'value'],
  primary_gp_name: ['GP Name', 'value'],
  primary_gp_clinic_name: ['Clinic Name', 'value'],
  primary_gp_address: ['GP Address', 'value'],
  primary_gp_phone: ['GP Phone', 'value'],
  primary_gp_email: ['GP Email', 'value'],
  primary_gp_provider_number: ['GP Provider Number', 'value'],
  client_goals: ['Goals', 'goals-value'],
  medicare_referral_type: ['Medicare Referral Type', 'Chronic Disease Management (CDM)'],
});

function required(environment, name, expected) {
  if (environment[name] !== expected) throw new Error(`invalid_${name.toLowerCase()}`);
}

export function deriveParityIdentity(waveId) {
  if (waveId !== 'wave-1' && waveId !== 'wave-2') throw new Error('invalid_wave_id');
  const digest = createHash('sha256').update(`${PARITY_NAMESPACE}:${waveId}:credential`).digest('hex');
  return Object.freeze({
    email: `practitioner.${waveId}@${PARITY_NAMESPACE}.seed.test`,
    password: `Asr!${digest.slice(0, 28)}`,
    primaryOrganizationName: `${PARITY_NAMESPACE} ${waveId} primary practice`,
    secondaryOrganizationName: `${PARITY_NAMESPACE} ${waveId} secondary practice`,
  });
}

export function lfNormalizedSha256(filePath) {
  const bytes = fs.readFileSync(filePath);
  const normalized = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'), 'utf8');
  return createHash('sha256').update(normalized).digest('hex');
}

export function expectedArtifactHashes() {
  return Object.freeze({
    runner_sha256: lfNormalizedSha256(RUNNER_PATH),
    fixture_sha256: lfNormalizedSha256(FIXTURE_PATH),
    cleanup_sha256: lfNormalizedSha256(CLEANUP_PATH),
    config_sha256: lfNormalizedSha256(CONFIG_PATH),
  });
}

export function assertParityWaveEnvironment(environment = process.env) {
  required(environment, 'NODE_ENV', 'production');
  required(environment, 'PARITY_ASSURANCE_MODE', '1');
  required(environment, 'PARITY_NAMESPACE', PARITY_NAMESPACE);
  required(environment, 'PARITY_BASE_URL', PARITY_BASE_URL);
  required(environment, 'PARITY_PROVIDER_CALL_LIMIT', String(PARITY_PROVIDER_CALL_LIMIT));
  required(environment, 'ASSESSSUITE_DB_PATH', PARITY_DB_PATH);
  required(environment, 'UPLOADS_DIR', PARITY_UPLOADS_DIR);
  required(environment, 'OUTBOUND_EMAIL_ENABLED', '0');
  required(environment, 'OUTBOUND_SMS_ENABLED', '0');
  required(environment, 'PAYMENTS_ENABLED', '0');
  required(environment, 'DOCUMENT_EXTRACTION_ENABLED', '1');
  required(environment, 'DOCUMENT_EXTRACTION_UNDER_13_ENABLED', '0');
  required(environment, 'OPENAI_HEALTH_DATA_TERMS_CONFIRMED', '1');
  required(environment, 'GENERAL_CLINICAL_LLM_ENABLED', '0');
  required(environment, 'TRANSCRIPTION_ENABLED', '0');
  required(environment, 'ALLOW_OPEN_REGISTRATION', '0');
  required(environment, 'ADMIN_EMAIL', PARITY_ADMIN_EMAIL);
  if (environment.PARITY_WAVE_ID !== 'wave-1' && environment.PARITY_WAVE_ID !== 'wave-2') {
    throw new Error('invalid_parity_wave_id');
  }
  if (environment.SELFTEST === '1') throw new Error('selftest_forbidden');
  if (environment.DOCUMENT_EXTRACTION_TEST_BASE_URL) throw new Error('test_provider_forbidden');
  if (environment.ASSESSSUITE_DB_PATH_ACK) throw new Error('database_ack_forbidden');
  if (!path.isAbsolute(environment.PARITY_ARTIFACT_DIR || '')) {
    throw new Error('invalid_parity_artifact_dir');
  }

  const expected = expectedArtifactHashes();
  const supplied = {
    runner_sha256: environment.PARITY_RUNNER_SHA256,
    fixture_sha256: environment.PARITY_FIXTURE_SHA256,
    cleanup_sha256: environment.PARITY_CLEANUP_SHA256,
    config_sha256: environment.PARITY_CONFIG_SHA256,
  };
  for (const [name, value] of Object.entries(supplied)) {
    if (!HASH_PATTERN.test(value || '') || value !== expected[name]) throw new Error(`invalid_${name}`);
  }
  return Object.freeze({
    waveId: environment.PARITY_WAVE_ID,
    identity: deriveParityIdentity(environment.PARITY_WAVE_ID),
    hashes: expected,
    artifactDir: path.resolve(environment.PARITY_ARTIFACT_DIR),
  });
}

export function makeBrowserReceipt({ waveId, hashes, clientRecordsCreated, screenshots }) {
  const receipt = {
    schema_version: 'assesssuite.production-parity.v1',
    action: 'browser-wave',
    result: 'PASS',
    namespace: PARITY_NAMESPACE,
    wave_id: waveId,
    ...hashes,
    base_url: PARITY_BASE_URL,
    synthetic_user_count: 1,
    synthetic_document_count: 1,
    provider_call_limit: PARITY_PROVIDER_CALL_LIMIT,
    profile_setup_post_payment_surface: true,
    mandatory_checkbox_count: 1,
    marketing_checkbox_count: 1,
    marketing_default_checked: false,
    required_notice_links_present: true,
    adult_only_control_present: false,
    paediatric_control_present: false,
    state_territory_jurisdiction_control_present: false,
    date_of_birth_control_present: false,
    signup_acceptance_submissions: 1,
    signup_acceptance_retry_requests: 1,
    single_practice_uploader_present: waveId === 'wave-1',
    multi_practice_uploader_present: waveId === 'wave-2',
    mandatory_review_presented: true,
    review_commit_required: true,
    referral_commit_performed: false,
    api_observed_client_records_created: clientRecordsCreated,
    screenshot_files: screenshots.files,
    screenshot_sha256: screenshots.sha256,
  };
  assert.deepEqual(Object.keys(receipt), BROWSER_RECEIPT_KEYS);
  return receipt;
}

function prepareScreenshotPaths(directory, waveId) {
  const root = path.resolve(directory);
  fs.mkdirSync(root, { recursive: true });
  if (fs.readdirSync(root).length !== 0) throw new Error('artifact_directory_not_empty');
  const basenames = [
    `${PARITY_NAMESPACE}-${waveId}-signup-consent.png`,
    `${PARITY_NAMESPACE}-${waveId}-referral-uploader.png`,
    `${PARITY_NAMESPACE}-${waveId}-mandatory-review.png`,
  ];
  const paths = basenames.map((basename) => path.resolve(root, basename));
  if (paths.some((candidate) => path.dirname(candidate) !== root || fs.existsSync(candidate))) {
    throw new Error('invalid_artifact_path');
  }
  return Object.freeze({
    basenames,
    signup: paths[0],
    uploader: paths[1],
    review: paths[2],
  });
}

function screenshotReceipt(directory, basenames) {
  const actual = fs.readdirSync(directory).sort();
  assert.deepEqual(actual, [...basenames].sort());
  const sha256 = Object.fromEntries(basenames.map((basename) => [
    basename,
    createHash('sha256').update(fs.readFileSync(path.join(directory, basename))).digest('hex'),
  ]));
  return { files: [...basenames], sha256 };
}

export function frameParityReceipt(receipt) {
  const json = JSON.stringify(receipt);
  if (json.includes('\n') || Buffer.byteLength(json) > 8_192) throw new Error('invalid_receipt');
  return `${PARITY_RECEIPT_BEGIN}\n${json}\n${PARITY_RECEIPT_END}`;
}

async function clinicalCounts(page) {
  return page.evaluate(async ({ appId, entityNames }) => {
    const sessionValue = window.localStorage.getItem('base44_access_token');
    if (!sessionValue) throw new Error('missing_browser_session');
    let total = 0;
    let clients = 0;
    for (const entityName of entityNames) {
      const response = await window.fetch(`/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}`, {
        headers: { Authorization: `Bearer ${sessionValue}`, 'X-App-Id': appId },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('clinical_count_failed');
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error('clinical_count_invalid');
      total += body.length;
      if (entityName === 'Client') clients = body.length;
    }
    return { total, clients };
  }, { appId: PARITY_APP_ID, entityNames: CLINICAL_ENTITIES });
}

async function assertFullMandatoryReview(dialog) {
  assert.equal(Object.keys(CANONICAL_REFERRAL_PROFILE_FULL_39).length, 39);
  assert.deepEqual(
    new Set(Object.keys(REVIEW_CONTROLS)),
    new Set(Object.keys(CANONICAL_REFERRAL_PROFILE_FULL_39)),
  );
  for (const [field, value] of Object.entries(CANONICAL_REFERRAL_PROFILE_FULL_39)) {
    const expected = Array.isArray(value) ? value.join('\n') : String(value);
    const [label, mode] = REVIEW_CONTROLS[field];
    if (mode === 'goals-value') {
      const goalsCard = dialog.getByText(label, { exact: true }).locator('..').locator('..');
      assert.equal(await goalsCard.locator('textarea').inputValue(), expected, `review_field_${field}`);
      continue;
    }
    const fieldContainer = dialog.getByText(label, { exact: true }).locator('..');
    if (mode === 'value') {
      assert.equal(
        await fieldContainer.locator('input, textarea').first().inputValue(),
        expected,
        `review_field_${field}`,
      );
    } else {
      assert.equal(
        (await fieldContainer.getByRole('combobox').textContent()).trim(),
        mode,
        `review_select_${field}`,
      );
    }
  }
  await assert.doesNotReject(async () => {
    await dialog.getByRole('button', { name: 'Create New Client', exact: true }).waitFor({ state: 'visible' });
  });
  assert.equal(await dialog.getByRole('alert').count(), 0);
}

async function exerciseSignupConsent(page, contract, screenshotPath) {
  await page.goto(`${PARITY_BASE_URL}/ProfileSetup?app_id=${PARITY_APP_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { name: 'Welcome to AssessSuite', exact: true }).waitFor();
  const consentSection = page.getByText('Consent', { exact: true }).locator('..').locator('..');
  await consentSection.waitFor({ state: 'visible' });
  const mandatory = consentSection.getByRole('checkbox', { name: 'I confirm that:', exact: true });
  const marketing = consentSection.getByRole('checkbox', { name: /Optional: send me product updates/ });
  assert.equal(await mandatory.count(), 1);
  assert.equal(await marketing.count(), 1);
  assert.equal(await marketing.getAttribute('aria-checked'), 'false');
  assert.equal(await consentSection.getByRole('checkbox').count(), 2);

  const requiredLinks = [
    ['/legal/collection-notice', 'Practitioner Account Collection Notice'],
    ['/legal/clinical-use-notice', 'Clinical Use and Professional Responsibility Notice'],
    ['/legal/ai-notice', 'AI and Automated Processing Transparency Notice'],
  ];
  for (const [href, name] of requiredLinks) {
    const link = consentSection.getByRole('link', { name, exact: true });
    assert.equal(await link.count(), 1);
    assert.equal(new URL(await link.getAttribute('href'), PARITY_BASE_URL).pathname, href);
  }
  assert.equal(await consentSection.getByRole('link').count(), requiredLinks.length);

  const adultOnlyControlPresent = await page.locator(
    '[name="adult_only_confirmed"], #adult_only_confirmed, #adult-only, [aria-label*="adult only" i]',
  ).count() > 0;
  const paediatricControlPresent = await page.locator(
    '[name*="paediatric" i], [id*="paediatric" i], [aria-label*="paediatric" i]',
  ).count() > 0;
  const jurisdictionControlPresent = await page.getByRole('combobox', {
    name: /state|territory|jurisdiction|country of practice/i,
  }).count() > 0 || await page.locator(
    '[name="served_jurisdictions"], #served_jurisdictions, #served-jurisdictions',
  ).count() > 0;
  const dateOfBirthControlPresent = await page.locator(
    'input[type="date"], input[name="date_of_birth"], #date_of_birth',
  ).count() > 0;
  assert.equal(adultOnlyControlPresent, false);
  assert.equal(paediatricControlPresent, false);
  assert.equal(jurisdictionControlPresent, false);
  assert.equal(dateOfBirthControlPresent, false);
  await consentSection.screenshot({ path: screenshotPath });

  await page.getByLabel('Your Full Name *', { exact: true }).fill('AssessSuite Synthetic Practitioner');
  await page.getByLabel('Professional Qualifications *', { exact: true }).fill(
    'Bachelor of Clinical Exercise Physiology (synthetic)',
  );
  await page.getByLabel('Clinic Name *', { exact: true }).fill(`${PARITY_NAMESPACE} synthetic clinic`);
  await page.getByLabel('Clinic Address *', { exact: true }).fill(
    '1 Synthetic Gate Way, Brisbane QLD 4000',
  );
  await page.getByLabel('Clinic Phone *', { exact: true }).fill('+61 7 3000 0202');
  await page.getByLabel('Clinic Email *', { exact: true }).fill(
    `clinic.${contract.waveId}@${PARITY_NAMESPACE}.seed.test`,
  );
  await mandatory.click();
  assert.equal(await mandatory.getAttribute('aria-checked'), 'true');
  assert.equal(await marketing.getAttribute('aria-checked'), 'false');
  await page.getByRole('button', { name: 'Complete Setup', exact: true }).click();
  await page.waitForURL((url) => url.pathname.toLowerCase().endsWith('/dashboard'), { timeout: 30_000 });

  const retryAccepted = await page.evaluate(async ({ appId, expectedEmail }) => {
    const sessionValue = window.localStorage.getItem('base44_access_token');
    if (!sessionValue) throw new Error('missing_browser_session');
    const headers = { Authorization: `Bearer ${sessionValue}`, 'X-App-Id': appId };
    const membersResponse = await window.fetch(
      `/api/apps/${encodeURIComponent(appId)}/entities/OrganizationMember`,
      { headers, cache: 'no-store' },
    );
    if (!membersResponse.ok) throw new Error('membership_retry_lookup_failed');
    const members = await membersResponse.json();
    if (!Array.isArray(members)) throw new Error('membership_retry_lookup_invalid');
    const membership = members.find((row) => row.user_email === expectedEmail && row.is_primary === true);
    if (!membership?.org_id) throw new Error('membership_retry_target_missing');
    const legalRows = async () => {
      const response = await window.fetch(
        `/api/apps/${encodeURIComponent(appId)}/entities/LegalAcceptanceEvent`,
        { headers, cache: 'no-store' },
      );
      if (!response.ok) throw new Error('signup_acceptance_rows_unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('signup_acceptance_rows_invalid');
      return rows
        .filter((row) => row.user_email === expectedEmail && row.org_id === membership.org_id)
        .map((row) => row.id)
        .sort();
    };
    const beforeRetryIds = await legalRows();
    if (beforeRetryIds.length !== 3) throw new Error('signup_acceptance_initial_bundle_invalid');
    const retryResponse = await window.fetch(
      `/api/apps/${encodeURIComponent(appId)}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: membership.org_id, marketing_opt_in: false }),
        cache: 'no-store',
      },
    );
    if (!retryResponse.ok) throw new Error('signup_acceptance_retry_failed');
    const retry = await retryResponse.json();
    if (retry?.status !== 'success' || retry.recorded !== 3 || retry.owner_bundle !== false) {
      throw new Error('signup_acceptance_retry_invalid');
    }
    const afterRetryIds = await legalRows();
    if (JSON.stringify(afterRetryIds) !== JSON.stringify(beforeRetryIds)) {
      throw new Error('signup_acceptance_retry_duplicated');
    }
    return true;
  }, { appId: PARITY_APP_ID, expectedEmail: contract.identity.email });
  assert.equal(retryAccepted, true);
}

export async function runBrowserWave(environment = process.env) {
  const contract = assertParityWaveEnvironment(environment);
  const screenshotPaths = prepareScreenshotPaths(contract.artifactDir, contract.waveId);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${PARITY_BASE_URL}/Login?app_id=${PARITY_APP_ID}`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(contract.identity.email);
    await page.getByLabel('Password', { exact: true }).fill(contract.identity.password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForFunction(() => Boolean(window.localStorage.getItem('base44_access_token')));
    await exerciseSignupConsent(page, contract, screenshotPaths.signup);
    await page.goto(`${PARITY_BASE_URL}/Clients?app_id=${PARITY_APP_ID}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Client Library', exact: true }).waitFor();

    const before = await clinicalCounts(page);
    await page.getByRole('button', { name: 'Upload Referral', exact: true }).click();
    const uploader = page.getByText('Upload Referral Document', { exact: true }).locator('..').locator('..');
    await page.locator('#referral-upload').waitFor({ state: 'attached' });
    assert.equal(await uploader.locator('input[type="date"]').count(), 0);
    assert.equal(await uploader.locator('input[type="checkbox"]').count(), 0);

    const practiceSelector = page.getByLabel('Choose practice for this referral', { exact: true });
    if (contract.waveId === 'wave-2') {
      await practiceSelector.waitFor({ state: 'visible' });
      assert.match(await practiceSelector.textContent(), /Select the practice that owns this referral/);
      await practiceSelector.click();
      await page.getByRole('option', {
        name: `${contract.identity.primaryOrganizationName} (primary)`,
        exact: true,
      }).click();
    }

    await page.locator('#referral-upload').setInputFiles({
      name: `${PARITY_NAMESPACE}-${contract.waveId}-full-39.pdf`,
      mimeType: 'application/pdf',
      buffer: fullFieldReferralPdfFixture(),
    });
    const extractButton = page.getByRole('button', { name: 'Extract Data from 1 file(s)', exact: true });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => (
      button.textContent?.trim().includes('Extract Data from 1 file(s)') && !button.disabled
    )));
    if (contract.waveId === 'wave-1') {
      assert.equal(await practiceSelector.count(), 0);
    }
    await uploader.screenshot({ path: screenshotPaths.uploader });
    await extractButton.click();
    const dialog = page.getByRole('dialog', { name: 'Review Extracted Data' });
    await dialog.waitFor({ state: 'visible', timeout: 120_000 });
    assert.equal(await page.getByText('Referral processing was not completed', { exact: true }).count(), 0);
    assert.equal(await page.locator('[data-sonner-toast][data-type="error"]').count(), 0);
    await assertFullMandatoryReview(dialog);
    await dialog.screenshot({ path: screenshotPaths.review });

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Extract Data from 1 file(s)', exact: true }).waitFor({
      state: 'detached',
    });
    const after = await clinicalCounts(page);
    assert.deepEqual(after, before);
    const clientRecordsCreated = after.clients - before.clients;
    assert.equal(clientRecordsCreated, 0);
    const screenshots = screenshotReceipt(contract.artifactDir, screenshotPaths.basenames);
    await context.close();
    return makeBrowserReceipt({
      waveId: contract.waveId,
      hashes: contract.hashes,
      clientRecordsCreated,
      screenshots,
    });
  } finally {
    await browser.close();
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  if (process.argv[2] !== 'run-wave') {
    process.stderr.write('ASSESSSUITE_PARITY_FAILED\n');
    process.exitCode = 1;
  } else {
    runBrowserWave()
      .then((receipt) => process.stdout.write(`${frameParityReceipt(receipt)}\n`))
      .catch(() => {
        process.stderr.write('ASSESSSUITE_PARITY_FAILED\n');
        process.exitCode = 1;
      });
  }
}
