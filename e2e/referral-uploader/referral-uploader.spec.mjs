import { expect, test } from '@playwright/test';

const syntheticPdf = {
  name: 'Synthetic_GP_Referral.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n% Synthetic browser assurance fixture only\n%%EOF\n'),
};

async function openScenario(page, scenario = 'success') {
  await page.goto(`/e2e/referral-uploader/?scenario=${scenario}`);
  await expect(page.getByText('Upload Referral Document', { exact: true })).toBeVisible();
}

async function attachSyntheticReferral(page) {
  await page.locator('#referral-upload').setInputFiles(syntheticPdf);
  await expect(page.getByText(syntheticPdf.name, { exact: true })).toBeVisible();
}

async function extractAndOpenReview(page) {
  await attachSyntheticReferral(page);
  await page.getByRole('button', { name: /Extract Data from 1 file\(s\)/ }).click();
  await expect(page.getByRole('dialog', { name: 'Review Extracted Data' })).toBeVisible();
}

async function state(page) {
  return page.evaluate(() => globalThis.__referralAssurance.snapshot());
}

test('single-practice journey hides unnecessary ownership, DOB and checkbox controls and preserves the extraction payload contract', async ({ page }) => {
  await openScenario(page, 'success');

  await expect(page.getByText('Choose practice for this referral', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Owning practice', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/drag and drop/i)).toHaveCount(0);
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);

  await attachSyntheticReferral(page);
  const extractButton = page.getByRole('button', { name: 'Extract Data from 1 file(s)' });
  await expect(extractButton).toBeEnabled();
  await extractButton.click();
  await expect(page.getByRole('dialog', { name: 'Review Extracted Data' })).toBeVisible();

  const snapshot = await state(page);
  expect(snapshot.calls.upload).toEqual([{
    org_id: 'org-one',
    purpose: 'referral-extraction',
    processing_authority_confirmed: true,
    processing_authority_attestation_version: 'referral-processing-authority-v2026-07-21.1',
    subject_age_confirmation: '13_or_over',
    subject_age_attestation_version: 'referral-subject-age-attestation-v2026-07-21.1',
    file: {
      name: syntheticPdf.name,
      type: syntheticPdf.mimeType,
      size: syntheticPdf.buffer.length,
    },
  }]);
  expect(snapshot.calls.extract).toHaveLength(1);
  expect(snapshot.calls.extract[0]).toMatchObject({
    org_id: 'org-one',
    file_urls: ['/uploads/synthetic-upload-1'],
    processing_authority_confirmed: true,
    processing_authority_attestation_version: 'referral-processing-authority-v2026-07-21.1',
    schema_type: 'object',
  });
  expect(snapshot.calls.extract[0].schema_fields).toEqual(expect.arrayContaining([
    'full_name',
    'date_of_birth',
    'primary_condition',
    'medications',
    'client_goals',
  ]));
  expect(snapshot.calls.writes).toEqual([]);
});

test('multi-practice journey requires and honours an explicit practice selection', async ({ page }) => {
  await openScenario(page, 'multi');
  await attachSyntheticReferral(page);

  const practice = page.getByRole('combobox', { name: 'Choose practice for this referral' });
  await expect(practice).toContainText('Select the practice that owns this referral');
  const extractButton = page.getByRole('button', { name: 'Extract Data from 1 file(s)' });
  await expect(extractButton).toBeDisabled();
  expect((await state(page)).calls.upload).toEqual([]);

  await practice.click();
  await page.getByRole('option', { name: 'Synthetic Secondary Practice' }).click();
  await expect(practice).toContainText('Synthetic Secondary Practice');
  await expect(extractButton).toBeEnabled();
  await extractButton.click();
  await expect(page.getByRole('dialog', { name: 'Review Extracted Data' })).toBeVisible();

  const snapshot = await state(page);
  expect(snapshot.calls.upload[0].org_id).toBe('org-two');
  expect(snapshot.calls.extract[0].org_id).toBe('org-two');
  expect(snapshot.calls.writes).toEqual([]);
});

test('installed Base44Error details reach a safe persistent toast without leaking the original request', async ({ page }) => {
  const consoleMessages = [];
  page.on('console', (message) => consoleMessages.push(message.text()));
  await openScenario(page, 'sdk-error');
  await attachSyntheticReferral(page);
  await page.getByRole('button', { name: 'Extract Data from 1 file(s)' }).click();

  const safeDetails = 'Current AI document-extraction acceptance is required.';
  await expect(page.getByRole('alert').getByText(safeDetails, { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').getByText(
    'Reference: 38b4329d-4674-4ff2-a3bb-e231b45676ac',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByLabel('Notifications alt+T').getByText(safeDetails, { exact: true })).toBeVisible();
  await expect(page.getByText('The referral could not be processed. No client data was changed.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Synthetic Hidden Person', { exact: true })).toHaveCount(0);

  const snapshot = await state(page);
  expect(snapshot.calls.writes).toEqual([]);
  expect(snapshot.calls.cancel).toEqual([{
    org_id: 'org-one',
    upload_ids: ['synthetic-upload-1'],
  }]);
  expect(consoleMessages.join('\n')).not.toContain('Synthetic hidden referral payload');
  expect(consoleMessages.join('\n')).not.toContain('Synthetic Hidden Person');
});

test('the local-server generic-disable SDK contract renders persistently with its safe support reference', async ({ page }) => {
  await openScenario(page, 'sdk-generic-disabled');
  await attachSyntheticReferral(page);
  await page.getByRole('button', { name: 'Extract Data from 1 file(s)' }).click();

  const safeDetails = 'Automated extraction is approved only for the referral workflow.';
  await expect(page.getByRole('alert').getByText(safeDetails, { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').getByText(
    'Reference: 3eff37ad-e846-4ce4-9f9b-486f15bb8faa',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByLabel('Notifications alt+T').getByText(safeDetails, { exact: true })).toBeVisible();

  const snapshot = await state(page);
  expect(snapshot.calls.writes).toEqual([]);
  expect(snapshot.calls.cancel).toEqual([{
    org_id: 'org-one',
    upload_ids: ['synthetic-upload-1'],
  }]);
});

test('cancelling mandatory review schedules temporary upload cleanup and performs no clinical write', async ({ page }) => {
  await openScenario(page, 'success');
  await extractAndOpenReview(page);
  expect((await state(page)).calls.writes).toEqual([]);

  await page.getByRole('dialog', { name: 'Review Extracted Data' })
    .getByRole('button', { name: 'Cancel' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Review Extracted Data' })).toHaveCount(0);

  await expect.poll(async () => (await state(page)).calls.cancel).toEqual([{
    org_id: 'org-one',
    upload_ids: ['synthetic-upload-1'],
  }]);
  expect((await state(page)).calls.writes).toEqual([]);
});

test('tenant-complete possible matches are keyboard operable and never cross practice boundaries', async ({ page }) => {
  await openScenario(page, 'match');
  await extractAndOpenReview(page);

  const review = page.getByRole('dialog', { name: 'Review Extracted Data' });
  const match = review.getByRole('button', { name: /Synthetic Referral Person.*DOB: 1987-04-03/ });
  await expect(match).toHaveAttribute('aria-pressed', 'false');
  await match.focus();
  await page.keyboard.press('Space');
  await expect(match).toHaveAttribute('aria-pressed', 'true');
  await expect(review.getByRole('button', { name: 'Update Synthetic Referral Person' })).toBeVisible();

  const snapshot = await state(page);
  expect(snapshot.calls.clientQueries).toEqual([{ org_id: 'org-one' }]);
  await expect(review.getByRole('button', { name: /Synthetic Referral Person.*DOB: 1987-04-03/ })).toHaveCount(1);
  expect(snapshot.calls.writes).toEqual([]);
});

test('editing the final reviewed identity clears a selected client that no longer matches', async ({ page }) => {
  await openScenario(page, 'match');
  await extractAndOpenReview(page);

  const review = page.getByRole('dialog', { name: 'Review Extracted Data' });
  const match = review.getByRole('button', { name: /Synthetic Referral Person.*DOB: 1987-04-03/ });
  await match.click();
  await expect(review.getByRole('button', { name: 'Update Synthetic Referral Person' })).toBeVisible();

  const fullNameInput = review.getByText('Full Name', { exact: true }).locator('..').locator('input');
  await fullNameInput.fill('Different Reviewed Person');

  await expect(match).toHaveCount(0);
  await expect(review.getByRole('button', { name: 'Update Synthetic Referral Person' })).toHaveCount(0);
  await expect(review.getByRole('button', { name: 'Create New Client' })).toBeVisible();

  await fullNameInput.fill('Synthetic Referral Person');
  await expect(match).toBeVisible();
  await match.click();
  await expect(review.getByRole('button', { name: 'Update Synthetic Referral Person' })).toBeVisible();

  const dateOfBirthInput = review.getByText('Date of Birth', { exact: true }).locator('..').locator('input');
  await dateOfBirthInput.fill('1988-04-03');
  await expect(match).toHaveCount(0);
  await expect(review.getByRole('button', { name: 'Update Synthetic Referral Person' })).toHaveCount(0);
  await expect(review.getByRole('button', { name: 'Create New Client' })).toBeVisible();
  expect((await state(page)).calls.writes).toEqual([]);
});

test('two immediate extraction clicks enter only one upload and provider path', async ({ page }) => {
  await openScenario(page, 'success');
  await attachSyntheticReferral(page);

  const extractButton = page.getByRole('button', { name: 'Extract Data from 1 file(s)' });
  await extractButton.evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.getByRole('dialog', { name: 'Review Extracted Data' })).toBeVisible();
  const snapshot = await state(page);
  expect(snapshot.calls.upload).toHaveLength(1);
  expect(snapshot.calls.extract).toHaveLength(1);
  expect(snapshot.calls.clientQueries).toEqual([{ org_id: 'org-one' }]);
  expect(snapshot.calls.writes).toEqual([]);
});

test('outer-shell unmount schedules cleanup for a review-pending temporary upload', async ({ page }) => {
  await openScenario(page, 'success');
  await extractAndOpenReview(page);
  expect((await state(page)).calls.cancel).toEqual([]);

  await page.evaluate(() => globalThis.__referralAssurance.unmount());
  await expect(page.getByText('Upload Referral Document', { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await state(page)).calls.cancel).toEqual([{
    org_id: 'org-one',
    upload_ids: ['synthetic-upload-1'],
  }]);
  expect((await state(page)).calls.writes).toEqual([]);
});

test('unmount during a later upload cleans every earlier file already stored', async ({ page }) => {
  await openScenario(page, 'partial-upload-unmount');
  const secondPdf = {
    ...syntheticPdf,
    name: 'Synthetic_GP_Referral_2.pdf',
  };
  await page.locator('#referral-upload').setInputFiles([syntheticPdf, secondPdf]);
  await page.getByRole('button', { name: /Extract Data from 2 file\(s\)/ }).click();
  await expect.poll(async () => (await state(page)).calls.upload).toHaveLength(2);

  await page.evaluate(() => globalThis.__referralAssurance.unmount());
  await expect.poll(async () => (await state(page)).calls.cancel).toEqual([
    {
      org_id: 'org-one',
      upload_ids: ['synthetic-upload-1'],
    },
    {
      org_id: 'org-one',
      upload_ids: ['synthetic-upload-2'],
    },
  ]);
  const snapshot = await state(page);
  expect(snapshot.calls.extract).toEqual([]);
  expect(snapshot.calls.functions).toEqual([]);
  expect(snapshot.calls.writes).toEqual([]);
});

test('only the practitioner-reviewed values are persisted after affirmative review', async ({ page }) => {
  await openScenario(page, 'success');
  await extractAndOpenReview(page);
  expect((await state(page)).calls.writes).toEqual([]);

  const review = page.getByRole('dialog', { name: 'Review Extracted Data' });
  const fullNameInput = review.getByText('Full Name', { exact: true }).locator('..').locator('input');
  await fullNameInput.fill('Synthetic Practitioner Reviewed');
  await review.getByRole('button', { name: 'Create New Client' }).click();
  await expect(page.getByText('Client "Synthetic Practitioner Reviewed" created successfully!', { exact: true })).toBeVisible();

  const snapshot = await state(page);
  expect(snapshot.calls.writes).toEqual([]);
  expect(snapshot.calls.functions).toHaveLength(1);
  expect(snapshot.calls.functions[0]).toMatchObject({
    name: 'commitReviewedReferral',
    payload: {
      org_id: 'org-one',
      operation: 'create',
      client_id: null,
      review_confirmed: true,
      review_version: 'referral-review-commit-v2026-07-21.1',
      client: {
        full_name: 'Synthetic Practitioner Reviewed',
        date_of_birth: '1987-04-03',
        gender: 'other',
      },
      upload_ids: ['synthetic-upload-1'],
      historical_assessments: [],
    },
  });
  expect(snapshot.calls.functions[0].payload.idempotency_key).toMatch(/^[0-9a-f-]{36}$/i);
  expect(snapshot.calls.functions[0].payload.conditions).toEqual(expect.arrayContaining([
    { condition_name: 'Synthetic primary condition', condition_type: 'primary' },
    { condition_name: 'Synthetic comorbidity', condition_type: 'comorbidity' },
    { condition_name: 'Medication', condition_type: 'comorbidity', medication: 'Synthetic medication' },
    {
      condition_name: 'Relevant medical history',
      condition_type: 'comorbidity',
      notes: 'Synthetic reviewed medical history',
    },
  ]));
  expect(snapshot.calls.functions[0].payload.client).not.toHaveProperty('org_id');
  expect(snapshot.calls.functions[0].payload.client).not.toHaveProperty('assigned_clinician_email');
  expect(snapshot.calls.functions[0].payload.client).not.toHaveProperty('consent_confirmed');
  expect(snapshot.calls.functions[0].payload.client).not.toHaveProperty('medical_history');
  await expect.poll(async () => (await state(page)).calls.callbacks).toEqual([{
    type: 'created',
    id: 'synthetic-client-created',
    org_id: 'org-one',
  }]);
});

test('an uncertain atomic commit reconciles with the same key and a new extraction rotates it', async ({ page }) => {
  await openScenario(page, 'commit-retry');
  await extractAndOpenReview(page);

  const review = page.getByRole('dialog', { name: 'Review Extracted Data' });
  const createButton = review.getByRole('button', { name: 'Create New Client' });
  await createButton.click();
  await expect(review).toHaveCount(0);

  let snapshot = await state(page);
  expect(snapshot.calls.functions).toHaveLength(2);
  const firstKey = snapshot.calls.functions[0].payload.idempotency_key;
  expect(snapshot.calls.functions[1].payload.idempotency_key).toBe(firstKey);
  expect(snapshot.calls.cancel).toEqual([]);
  expect(snapshot.calls.writes).toEqual([]);

  await extractAndOpenReview(page);
  await page.getByRole('dialog', { name: 'Review Extracted Data' })
    .getByRole('button', { name: 'Create New Client' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Review Extracted Data' })).toHaveCount(0);
  snapshot = await state(page);
  expect(snapshot.calls.functions).toHaveLength(3);
  expect(snapshot.calls.functions[2].payload.idempotency_key).not.toBe(firstKey);
  expect(snapshot.calls.writes).toEqual([]);
});

test('two uncertain commit responses preserve the review and report only the truthful unconfirmed result', async ({ page }) => {
  await openScenario(page, 'commit-double-uncertain');
  await extractAndOpenReview(page);

  const review = page.getByRole('dialog', { name: 'Review Extracted Data' });
  await review.getByRole('button', { name: 'Create New Client' }).click();

  await expect(review).toBeVisible();
  await expect(page.getByText(
    'The save result could not be confirmed. Retry this same review; AssessSuite will safely return the original result if it was already saved.',
    { exact: true },
  ).first()).toBeVisible();
  await expect(page.getByText(/No client data was changed/)).toHaveCount(0);

  const snapshot = await state(page);
  expect(snapshot.calls.functions).toHaveLength(2);
  expect(snapshot.calls.functions[1].payload.idempotency_key)
    .toBe(snapshot.calls.functions[0].payload.idempotency_key);
  expect(snapshot.calls.writes).toEqual([]);
  expect(snapshot.calls.callbacks).toEqual([]);
});
