import { expect, test } from '@playwright/test';

async function snapshot(page) {
  return page.evaluate(() => globalThis.__epAssessmentBrowser.snapshot());
}

test('the shared canonical runner preserves a zero EP score, SOAP detail and clinician notes', async ({ page }) => {
  await page.goto('/e2e/ep-assessment-runner/');
  await expect(page.getByText('FRAIL Scale', { exact: true })).toBeVisible();

  await page.getByPlaceholder(/Jot notes as you assess/).fill('Observed steady breathing throughout.');
  const noOptions = page.getByLabel('No', { exact: true });
  await expect(noOptions).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) await noOptions.nth(index).click();

  await expect(page.getByText('0 / 5', { exact: true })).toBeVisible();
  await expect(page.getByText('5 / 5 answered', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save Questionnaire' }).click();
  await expect(page.getByRole('heading', { name: 'EP runner result receipt' })).toBeVisible();

  const state = await snapshot(page);
  expect(state.base44Calls).toEqual([]);
  expect(state.result).toMatchObject({
    status: 'completed',
    result_value: 0,
    notes: 'Observed steady breathing throughout.',
    additional_data: {
      measurement_type: 'questionnaire',
      responses: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  });
  expect(state.result.additional_data.soap_text).toContain('FRAIL Scale: 0/5');
  expect(state.result.additional_data.soap_text.match(/Answer: No/g)).toHaveLength(5);
});

test('an unknown canonical assessment fails loudly and never reaches a generic runner', async ({ page }) => {
  await page.goto('/e2e/ep-assessment-runner/?scenario=unknown');
  await expect(page.getByRole('heading', { name: 'Assessment route not registered' })).toBeVisible();
  await expect(page.getByText(/has no canonical runner route/)).toBeVisible();
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
  expect((await snapshot(page)).base44Calls).toEqual([]);
});
