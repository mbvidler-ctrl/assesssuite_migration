import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { startOfflinePhysioRuntime } from './runtime-fixture.mjs';
import { physioOfflineSelectors as selector } from './selectors.mjs';

const PASSWORD = 'Synthetic-Physio-Browser-Password-1!';
const PHYSIO_APP_ID = 'local-assesssuite-physio';
const CLIENT_NAME = 'Synthetic Offline Physio Patient';
const EPISODE_TITLE = 'Synthetic right knee rehabilitation';
const EDITED_REPORT_MARKER = 'Clinician reviewed in the deterministic offline journey.';
const FAC_NAME = 'Functional Ambulation Categories (FAC)';

function syntheticIdentity(projectName) {
  const device = projectName.startsWith('mobile') ? 'mobile' : 'desktop';
  return {
    device,
    practitionerName: `Synthetic Offline ${device} Physiotherapist`,
    email: `synthetic-physio-offline-${device}@example.test`,
    clientEmail: `synthetic-patient-${device}@example.test`,
  };
}

async function expectPath(page, pathname) {
  await expect.poll(
    () => new URL(page.url()).pathname.toLowerCase(),
    { timeout: 30_000 },
  ).toBe(pathname.toLowerCase());
}

async function activateReachableControl(page, control) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  // Chromium can decide that a control inside the long assessment library is
  // visible to its scroll container while it remains below the mobile visual
  // viewport. Centre it explicitly before proving pointer reachability.
  await control.evaluate((element) => element.scrollIntoView({
    behavior: 'auto',
    block: 'center',
    inline: 'nearest',
  }));
  await expect.poll(() => control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
  const reachability = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const centreX = rect.left + (rect.width / 2);
    const centreY = rect.top + (rect.height / 2);
    const hitTarget = document.elementFromPoint(centreX, centreY);

    return {
      bottom: rect.bottom,
      centreX,
      centreY,
      height: rect.height,
      hitTargetIsControl: hitTarget === element || element.contains(hitTarget),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });

  expect(reachability.width).toBeGreaterThan(0);
  expect(reachability.height).toBeGreaterThan(0);
  expect(reachability.left).toBeGreaterThanOrEqual(0);
  expect(reachability.right).toBeLessThanOrEqual(reachability.innerWidth);
  expect(reachability.top).toBeGreaterThanOrEqual(0);
  expect(reachability.bottom).toBeLessThanOrEqual(reachability.innerHeight);
  expect(reachability.hitTargetIsControl).toBe(true);

  if ((page.viewportSize()?.width || Number.POSITIVE_INFINITY) <= 500) {
    // Pixel 7 emulation on Windows can perform a second, stale-coordinate
    // scroll during locator/touch activation on long forms. The hit-test above
    // proves pointer reachability; native focus + Enter proves the same button
    // remains operable through its semantic control contract.
    await control.focus();
    await page.keyboard.press('Enter');
    return;
  }
  await control.click();
}

async function activateAndOnboardPractitioner(page, runtime, identity) {
  await page.goto(`${runtime.frontendBaseUrl}/register`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  // The monolithic legacy App graph can take materially longer on a cold,
  // cache-empty Windows worker; this is the one deliberately long bootstrap
  // wait. Subsequent route assertions retain the normal suite timeout.
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true }))
    .toBeVisible({ timeout: 90_000 });
  await page.locator(selector.registration.fullName).fill(identity.practitionerName);
  await page.locator(selector.registration.email).fill(identity.email);
  await page.locator(selector.registration.password).fill(PASSWORD);
  await page.locator(selector.registration.confirmation).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Verify your email', exact: true })).toBeVisible();
  await page.locator(selector.registration.verificationCode).fill('000000');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await expectPath(page, '/PaymentRequired');
  await expect(page.getByText('236 canonical outcome measures and assessments', { exact: true })).toBeVisible();

  const checkoutResponse = page.waitForResponse((response) => (
    response.url().includes('/functions/createCheckoutSession') && response.status() === 200
  ));
  await page.getByRole('button', { name: 'Start Monthly Trial', exact: true }).click();
  await checkoutResponse;
  const checkout = await runtime.completeCheckout(identity.email);
  expect(checkout.userId).toBeTruthy();
  await page.waitForURL(/\/mock-stripe\/checkout\/mock_cs_/, {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });

  await page.goto(`${runtime.frontendBaseUrl}/Dashboard`, { waitUntil: 'domcontentloaded' });
  await expectPath(page, '/ProfileSetup');
  await expect(page.getByRole('heading', { name: 'Welcome to AssessSuite', exact: true })).toBeVisible();

  await page.locator(selector.profile.clinicianName).fill(identity.practitionerName);
  await page.getByText('Select your profession', { exact: true }).click();
  await page.getByRole('option', { name: 'Registered Physiotherapist (Ahpra)', exact: true }).click();
  await page.locator(selector.profile.qualifications).fill('Synthetic Bachelor of Physiotherapy');
  await page.locator(selector.profile.registrationNumber).fill(`SYN-AHPRA-${identity.device.toUpperCase()}`);
  await page.locator(selector.profile.clinicName).fill(`Synthetic Offline ${identity.device} Physio Clinic`);
  await page.locator(selector.profile.clinicAddress).fill('1 Synthetic Browser Way, Sydney NSW 2000');
  await page.locator(selector.profile.clinicPhone).fill('0200000101');
  await page.locator(selector.profile.clinicEmail).fill(identity.email);
  await page.locator(selector.profile.consent).click();
  await page.getByRole('button', { name: 'Complete Setup', exact: true }).click();
  await expectPath(page, '/Dashboard');
  await expect(page.getByRole('heading', { name: new RegExp(identity.practitionerName) })).toBeVisible();
}

async function createAndEditClient(page, runtime, identity) {
  await page.goto(`${runtime.frontendBaseUrl}/Onboarding`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Client Onboarding/i })).toBeVisible();
  await page.locator(selector.client.fullName).fill(CLIENT_NAME);
  await page.locator(selector.client.dateOfBirth).fill('1988-06-15');
  await page.locator(selector.client.phone).fill('0400000001');
  await page.locator(selector.client.email).fill(identity.clientEmail);
  const finishLater = page.getByRole('button', { name: 'Save & Finish Later', exact: true });
  await activateReachableControl(page, finishLater);
  await expectPath(page, '/ClientProfile');
  const clientId = new URL(page.url()).searchParams.get('id');
  expect(clientId).toBeTruthy();
  await expect(page.getByRole('heading', { name: CLIENT_NAME, exact: true })).toBeVisible();

  await activateReachableControl(
    page,
    page.getByRole('button', { name: 'Edit contact details', exact: true }),
  );
  await expect(page.getByRole('heading', { name: 'Edit Contact Details', exact: true })).toBeVisible();
  await page.locator('#phone').fill('0400000099');
  await page.locator('#email').fill(identity.clientEmail);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('0400000099', { exact: true })).toBeVisible();

  return clientId;
}

async function completeInitialEpisode(page, runtime, clientId) {
  await page.goto(`${runtime.frontendBaseUrl}/PhysioEpisodes?client_id=${encodeURIComponent(clientId)}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByText('Physiotherapy workspace', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Patient', { exact: true })).toHaveValue(clientId);
  await page.getByPlaceholder('e.g. Right ACL rehabilitation').fill(EPISODE_TITLE);
  await page.getByPlaceholder('e.g. Right knee').fill('Right knee');
  await page.getByText('Presenting problem', { exact: true }).locator('..').locator('textarea').fill(
    'Synthetic gradual-onset knee pain affecting stairs and squatting.',
  );
  const episodeReload = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && response.url().includes('/entities/PhysioCareEpisode?q=')
    && response.status() === 200
  ));
  await page.getByRole('button', { name: 'Start and save episode', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('episode_id')).toBeTruthy();
  const episodeId = new URL(page.url()).searchParams.get('episode_id');
  await episodeReload;
  await expect(page.getByRole('button', { name: 'Save episode', exact: true }).first()).toBeVisible();

  const negativeAnswers = page.locator(selector.redFlag.negativeAnswers);
  await expect(negativeAnswers.first()).toBeVisible();
  const negativeCount = await negativeAnswers.count();
  expect(negativeCount).toBeGreaterThan(10);
  for (let index = 0; index < negativeCount; index += 1) await negativeAnswers.nth(index).click();
  await page.locator(selector.redFlag.noRedFlagsOutcome).click();
  await page.locator(selector.redFlag.clinicalReasoning).fill(
    'All structured red-flag questions answered negatively; proceed with routine objective examination.',
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.locator(selector.subjective.presentingComplaint)).toBeVisible();
  await page.locator(selector.subjective.presentingComplaint).fill('Right knee pain on stairs and loaded flexion.');
  await page.locator(selector.subjective.bodyChartArea).fill('Right anterior knee');
  await page.locator(selector.subjective.mechanism).fill('Gradual onset after increased running volume.');
  await page.locator(selector.subjective.duration).fill('Three weeks');
  await page.locator(selector.subjective.goals).fill('Return to pain-free stairs and five-kilometre running.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.locator(selector.objective.observation)).toBeVisible();
  await page.locator(selector.objective.observation).fill('Mild dynamic knee valgus during single-leg squat.');
  await page.locator(selector.objective.functionalTests).fill('Step-down reproduces familiar anterior knee pain.');
  await page.locator(selector.objective.impression).fill('Load-related patellofemoral presentation.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  for (const step of ['Red-flag screen', 'Subjective', 'Objective']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${step}\\s+Complete$`) })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Save episode', exact: true }).first().click();
  await expect(page.getByText('Care episode saved.', { exact: true }).first()).toBeVisible();

  return { episodeId, episodeUrl: page.url() };
}

async function addAndCompleteZeroScoreAssessment(page, runtime, clientId, episodeId, episodeUrl) {
  const assessmentLibraryUrl = new URL('/AssessmentLibrary', runtime.frontendBaseUrl);
  assessmentLibraryUrl.searchParams.set('mode', 'run');
  assessmentLibraryUrl.searchParams.set('clientId', clientId);
  assessmentLibraryUrl.searchParams.set('careEpisodeId', episodeId);
  assessmentLibraryUrl.searchParams.set('returnTo', episodeUrl);
  await page.goto(assessmentLibraryUrl.toString(), { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Showing 236 of 236 assessments', { exact: true })).toBeVisible();
  const search = page.getByPlaceholder(selector.librarySearchPlaceholder);
  await search.fill(FAC_NAME);
  await expect(page.getByText('Showing 1 of 236 assessments', { exact: true })).toBeVisible();
  await page.getByText(FAC_NAME, { exact: true }).click();
  const addToClient = page.getByRole('button', { name: 'Add to Client', exact: true });
  await activateReachableControl(page, addToClient);
  await expect(page.getByRole('heading', { name: 'Functional Ambulation Categories', exact: true })).toBeVisible();
  await expect.poll(async () => (await runtime.entityRows('ClientAssessment'))
    .filter((row) => row.client_id === clientId
      && row.physio_care_episode_id === episodeId
      && row.status === 'pending').length).toBe(1);
  if ((page.viewportSize()?.width || Number.POSITIVE_INFINITY) <= 500) {
    await expect(page.getByRole('button', { name: 'Open clinician notes', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(/Jot notes as you assess/)).toBeHidden();
  }
  await activateReachableControl(page, page.getByRole('button', { name: /Non-functional/ }));
  await expect(page.getByText('0 / 5', { exact: true })).toBeVisible();
  await activateReachableControl(page, page.getByRole('button', { name: 'Save', exact: true }));
  await expect(page.getByText('Assessment Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('0 category', { exact: true })).toBeVisible();
  const clientAssessmentWrite = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes('/entities/ClientAssessment/')
  ));
  await page.getByRole('button', { name: 'Save Assessment', exact: true }).click();
  expect((await clientAssessmentWrite).status()).toBe(200);

  await expect.poll(async () => (await runtime.entityRows('ClientAssessment'))
    .filter((row) => row.client_id === clientId
      && row.physio_care_episode_id === episodeId
      && row.status === 'completed'
      && row.result_value === 0).length).toBe(1);
  await expectPath(page, '/PhysioEpisodes');
  await expect(page.getByLabel('Measure name')).toHaveValue(FAC_NAME);
  await expect(page.getByLabel('Baseline')).toHaveValue('0');
  await expect(page.getByLabel('Current')).toHaveValue('0');
}

function editFirstGeneratedString(value) {
  const draft = JSON.parse(value);
  const pending = [draft];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const key of Object.keys(current)) {
      if (typeof current[key] === 'string') {
        current[key] = `${current[key]} ${EDITED_REPORT_MARKER}`;
        return JSON.stringify(draft, null, 2);
      }
      if (current[key] && typeof current[key] === 'object') pending.push(current[key]);
    }
  }
  throw new Error('The synthetic provider draft did not contain an editable string.');
}

async function exerciseReportWorkspace(page, context, runtime) {
  await expect(page.getByText('Physiotherapy AI workspace', { exact: true })).toBeVisible();
  await page.locator(selector.ai.additionalContext).fill('Use synthetic episode facts only; demonstrate editable report output.');
  await page.getByRole('button', { name: 'Generate Initial assessment summary', exact: true }).click();
  const editor = page.locator(selector.ai.editableDraft);
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.fill(editFirstGeneratedString(await editor.inputValue()));
  await editor.blur();
  await expect(page.getByText('Clinician edited', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^assesssuite-physio-physio\.initial_assessment_summary\.v1-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const downloaded = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(JSON.stringify(downloaded.draft)).toContain(EDITED_REPORT_MARKER);
  expect(downloaded.task_type).toBe('physio.initial_assessment_summary.v1');
  expect(downloaded.provenance).toBeTruthy();

  const printPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Print draft', exact: true }).click();
  const printPage = await printPromise;
  await expect(printPage.locator('body')).toContainText(EDITED_REPORT_MARKER);
  await expect.poll(() => printPage.evaluate(() => window.__offlinePrintCalls || 0)).toBeGreaterThan(0);
  await printPage.close();

  await page.getByRole('button', { name: 'Save as report draft', exact: true }).click();
  await expect(page.getByText('Draft saved to the clinical record', { exact: true })).toBeVisible();
  await page.getByText('Client Reports', { exact: true }).click();
  await expect(page.getByText('Initial assessment summary — AI-assisted draft', { exact: true })).toBeVisible();
  expect(runtime.providerCalls.length).toBeGreaterThanOrEqual(1);
}

async function exerciseSoapWorkspace(page) {
  await activateReachableControl(page, page.getByRole('button', { name: 'New SOAP Note', exact: true }));
  await expect(page.getByRole('heading', { name: new RegExp(`SOAP Note - ${CLIENT_NAME}`) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI Help', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dissect to SOAP', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /SMS/i })).toHaveCount(0);
  await expect(page.locator('img[src*="placeholder" i], img[src*="unsplash" i], img[src*="physio-pedia" i], img[src*="wikimedia" i]')).toHaveCount(0);

  await page.locator('#subjective').fill('Synthetic patient reports improved stair tolerance after graded loading.');
  await page.locator('#objective').fill('Synthetic step-down control improved; FAC score remains explicitly zero.');
  await page.locator('#assessment').fill('Synthetic load tolerance is improving with a remaining functional deficit.');
  await page.locator('#plan').fill('Continue graded strengthening and reassess function next visit.');
  await activateReachableControl(
    page,
    page.getByRole('button', { name: 'Save Draft', exact: true }),
  );
  await expect(page.getByText('Draft saved successfully.', { exact: true }).first()).toBeVisible();
  await page.locator('#subjective').fill('Synthetic edited subjective: stairs improving after graded loading.');
  await activateReachableControl(page, page.getByRole('button', { name: 'Publish', exact: true }));
  await expect(page.getByText('Note published and locked.', { exact: true }).first()).toBeVisible();
  await activateReachableControl(
    page,
    page.getByRole('button', { name: 'Close', exact: true }).first(),
  );

  await page.getByText('Client SOAP Notes', { exact: true }).click();
  const soapNotesCard = page.getByText('Client SOAP Notes', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  await activateReachableControl(
    page,
    soapNotesCard.getByRole('button', { name: 'View', exact: true }),
  );
  await activateReachableControl(page, page.getByRole('button', { name: 'Amend Note', exact: true }));
  await page.locator('#plan').fill('Amended synthetic plan: progress graded strengthening and document response.');
  await activateReachableControl(page, page.getByRole('button', { name: 'Save Changes', exact: true }));
  await expect(page.getByText('Changes saved and note re-locked.', { exact: true }).first()).toBeVisible();

  const printPromise = page.waitForEvent('popup');
  await activateReachableControl(page, page.getByRole('button', { name: 'Print', exact: true }));
  const printPage = await printPromise;
  await expect(printPage.locator('body')).toContainText('Amended synthetic plan');
  await expect.poll(() => printPage.evaluate(() => window.__offlinePrintCalls || 0)).toBeGreaterThan(0);
  await printPage.close();
  await activateReachableControl(
    page,
    page.getByRole('button', { name: 'Close', exact: true }).first(),
  );
}

async function assertRestartPersistence(page, runtime, clientId, episodeId) {
  expect(await page.evaluate(() => window.localStorage.getItem('base44_app_id'))).toBe(PHYSIO_APP_ID);
  await runtime.restart();
  await page.goto(
    `${runtime.frontendBaseUrl}/PhysioEpisodes?client_id=${encodeURIComponent(clientId)}&episode_id=${encodeURIComponent(episodeId)}`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect(page.getByRole('heading', { name: CLIENT_NAME, exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('e.g. Right ACL rehabilitation')).toHaveValue(EPISODE_TITLE);
  await page.getByText('Client Reports', { exact: true }).click();
  await expect(page.getByText('Initial assessment summary — AI-assisted draft', { exact: true })).toBeVisible();
  await page.getByText('Client SOAP Notes', { exact: true }).click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Measure name')).toHaveValue(FAC_NAME);
  await expect(page.getByLabel('Baseline')).toHaveValue('0');
  await expect(page.getByLabel('Current')).toHaveValue('0');
}

test('normal Physio route survives a complete deterministic offline clinical journey and restart', async ({ page, context }, testInfo) => {
  const identity = syntheticIdentity(testInfo.project.name);
  const runtime = await startOfflinePhysioRuntime();
  await context.addInitScript(() => {
    window.__offlinePrintCalls = 0;
    window.print = () => { window.__offlinePrintCalls += 1; };
    window.close = () => { window.__offlineCloseRequested = true; };
  });

  try {
    await activateAndOnboardPractitioner(page, runtime, identity);
    const clientId = await createAndEditClient(page, runtime, identity);
    const { episodeId, episodeUrl } = await completeInitialEpisode(page, runtime, clientId);
    await addAndCompleteZeroScoreAssessment(page, runtime, clientId, episodeId, episodeUrl);
    await page.goto(episodeUrl, { waitUntil: 'domcontentloaded' });
    await exerciseReportWorkspace(page, context, runtime);
    await exerciseSoapWorkspace(page);
    await assertRestartPersistence(page, runtime, clientId, episodeId);

    const [clients, episodes, assessments, reports, notes] = await Promise.all([
      runtime.entityRows('Client'),
      runtime.entityRows('PhysioCareEpisode'),
      runtime.entityRows('ClientAssessment'),
      runtime.entityRows('SavedReport'),
      runtime.entityRows('SOAPNote'),
    ]);
    const evidence = {
      evidenceKind: 'offline-loopback-browser-journey',
      project: testInfo.project.name,
      canonicalLibraryCount: 236,
      provider: 'repository loopback fake OpenAI-compatible chat adapter',
      persistedRows: {
        clients: clients.filter((row) => row.id === clientId).length,
        careEpisodes: episodes.filter((row) => row.client_id === clientId).length,
        completedAssessments: assessments.filter((row) => row.client_id === clientId && row.status === 'completed').length,
        savedReports: reports.filter((row) => row.client_id === clientId).length,
        publishedSoapNotes: notes.filter((row) => row.client_id === clientId && row.status === 'published').length,
      },
    };
    expect(evidence.persistedRows).toEqual({
      clients: 1,
      careEpisodes: 1,
      completedAssessments: 1,
      savedReports: 1,
      publishedSoapNotes: 1,
    });
    await testInfo.attach('offline-journey-evidence.json', {
      body: Buffer.from(JSON.stringify(evidence, null, 2)),
      contentType: 'application/json',
    });
  } finally {
    await runtime.stop();
  }
});
