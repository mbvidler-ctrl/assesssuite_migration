// Deterministic browser walkthrough of the reporting workflow:
// create request -> inspect gaps -> draft with sources -> approve/snapshot ->
// change a source -> explicit refresh/amend. Screenshots are written to
// docs/reporting/walkthrough so the pull request carries a visual record.

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { startWalkthroughRuntime } from './runtime.mjs';

const SCREENSHOT_DIR = path.resolve(import.meta.dirname, '../../../docs/reporting/walkthrough');

async function chooseIdentity(page, baseUrl, key) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const switcher = page.getByTestId('switch-identity');
  if (await switcher.count()) await switcher.click();
  await page.getByTestId(`identity-${key}`).click();
  await expect(page.getByTestId('principal')).toBeVisible();
}

async function expectStatus(page, status) {
  await expect(page.getByTestId('request-page')).toHaveAttribute('data-status', status);
}

test('the reporting workflow runs end to end against synthetic data', async ({ page }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const runtime = await startWalkthroughRuntime();
  const shot = (name) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
  const evidence = { steps: [] };
  const record = (step, detail) => evidence.steps.push({ step, ...detail });

  try {
    // 1. Outputs list as the treating clinician.
    await chooseIdentity(page, runtime.baseUrl, 'treating');
    await expect(page.getByTestId('outputs-page')).toBeVisible();
    await expect(page.getByTestId('overdue-banner')).toBeVisible();
    await expect(page.getByTestId('requests-table').locator('tbody tr')).toHaveCount(3);
    await shot('01-outputs-list');
    record('outputs-list', { requests: 3, overdue: true });

    // 2. Episode workspace for the patient with evidence gaps.
    await page.goto(`${runtime.baseUrl}/episodes/episode-synthetic-shoulder-1`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('episode-page')).toBeVisible();
    await expect(page.getByText('Synthetic demonstration patient')).toBeVisible();
    await shot('02-episode-evidence-gaps');

    // 3. New report request from the episode context.
    await page.getByTestId('request-report').click();
    await expect(page.getByTestId('new-request-form')).toBeVisible();
    await page.locator('#purpose').fill('Progress report requested by the employer rehabilitation coordinator');
    await page.locator('#recipient_name').fill('Synthetic Rehabilitation Coordinator');
    await page.locator('#recipient_role').selectOption('employer_rehab_provider');
    await page.locator('#recipient_organisation').fill('Synthetic Retail Group');
    await page.locator('#clinical_questions').fill('Can the patient safely stock overhead shelves?\nWhen is a return to full duties expected?');
    await page.locator('#due_date').fill('2026-09-20');
    await shot('03-new-request-dialog');
    await page.getByTestId('create-request-submit').click();
    await expectStatus(page, 'requested');
    await shot('04-request-created-with-gaps');
    record('request-created', { url: page.url() });

    // 4. Assemble evidence and start a draft: facts sections show what is missing.
    await page.getByTestId('assemble-evidence').click();
    await expectStatus(page, 'assembling_evidence');
    await expect(page.getByTestId('completeness-panel')).toBeVisible();
    await page.getByTestId('start-draft').click();
    await expectStatus(page, 'draft');
    await expect(page.getByTestId('sections')).toBeVisible();
    await expect(page.getByTestId('sections').getByText('No goals are recorded for this episode.', { exact: true })).toBeVisible();
    await shot('05-draft-with-gaps-shoulder');

    // 5. The seeded referrer update for the patient with rich evidence: import the pinned AI-assisted draft.
    await page.goto(`${runtime.baseUrl}/requests/${runtime.seeded.updateRequestId}`, { waitUntil: 'domcontentloaded' });
    await expectStatus(page, 'draft');
    await page.getByTestId('import-ai-clinical_functional_update').click();
    await expect(page.getByTestId('ai-attribution')).toBeVisible();
    await expect(page.getByText('AI-assisted draft — review required').first()).toBeVisible();
    await shot('06-ai-assisted-draft-imported');

    // 6. Clinician-authored plan, save, review the AI text, submit.
    await page.getByTestId('narrative-current_plan').fill('Continue the graded running progression and strengthening for four weeks, then reassess. (Synthetic clinician-authored text.)');
    await page.getByTestId('save-draft').click();
    await expect(page.getByTestId('notice-message')).toContainText('Draft saved');
    await page.getByTestId('mark-reviewed-clinical_functional_update').click();
    await expect(page.getByText('AI-assisted draft — clinician reviewed').first()).toBeVisible();
    await page.getByTestId('submit-review').click();
    await expectStatus(page, 'needs_review');
    await page.getByRole('tab', { name: 'Review' }).click();
    await expect(page.getByText('Your identity cannot approve reports.')).toBeVisible();
    await shot('07-needs-review-treating-cannot-approve');

    // 7. The senior clinician approves; an immutable snapshot is created.
    await chooseIdentity(page, runtime.baseUrl, 'senior');
    await page.goto(`${runtime.baseUrl}/requests/${runtime.seeded.updateRequestId}`, { waitUntil: 'domcontentloaded' });
    await expectStatus(page, 'needs_review');
    await page.getByRole('tab', { name: 'Review' }).click();
    await page.locator('#approval_note').fill('Reviewed against the pinned sources.');
    await page.getByTestId('approve-button').click();
    await expectStatus(page, 'approved');
    await expect(page.getByTestId('snapshot-list').locator('li')).toHaveCount(1);
    await shot('08-approved-snapshot');
    await page.getByTestId('open-snapshot').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await expect(page.getByTestId('document-frame')).toBeVisible();
    await page.waitForTimeout(500);
    await shot('09-approved-document');
    await page.keyboard.press('Escape');
    const firstSnapshotHref = await page.getByTestId('snapshot-list').locator('a').first().getAttribute('href');

    // 8. A later source change: add a reassessment to the episode.
    await page.goto(`${runtime.baseUrl}/episodes/episode-synthetic-knee-1`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('simulate-reassessment').click();
    await expect(page.getByTestId('demo-message')).toContainText('Existing drafts and snapshots are unchanged');

    // 9. The approved report is unchanged; an amendment exposes the new evidence and requires an explicit refresh.
    await page.goto(`${runtime.baseUrl}/requests/${runtime.seeded.updateRequestId}`, { waitUntil: 'domcontentloaded' });
    await expectStatus(page, 'approved');
    await expect(page.getByTestId('stale-banner')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Review' }).click();
    await page.locator('#amendment_reason').fill('Include the reassessment recorded after approval');
    await page.getByTestId('open-amendment').click();
    await expectStatus(page, 'amendment_in_progress');
    await expect(page.getByTestId('stale-banner')).toBeVisible();
    await page.getByRole('tab', { name: /Sources/ }).click();
    await expect(page.getByTestId('staleness-alert')).toBeVisible();
    await shot('10-amendment-new-evidence-available');
    await page.getByTestId('refresh-sources').click();
    await expect(page.getByTestId('notice-message')).toContainText('Sources refreshed');
    await expect(page.getByText('Pinned sources match the current records.')).toBeVisible();
    await shot('11-sources-refreshed-new-revision');

    // 10. Re-review the carried-forward AI text, submit and approve the successor snapshot.
    await page.getByTestId('mark-reviewed-clinical_functional_update').click();
    await page.getByTestId('submit-review').click();
    await expectStatus(page, 'needs_review');
    await page.getByRole('tab', { name: 'Review' }).click();
    await page.getByTestId('approve-button').click();
    await expectStatus(page, 'approved');
    await expect(page.getByTestId('snapshot-list').locator('li')).toHaveCount(2);
    await expect(page.getByText(/Supersedes /).first()).toBeVisible();
    await shot('12-amended-snapshot-chain');

    // 11. The original snapshot remains on record, marked superseded.
    await page.goto(`${runtime.baseUrl}${firstSnapshotHref}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('superseded-alert')).toBeVisible();
    await page.waitForTimeout(500);
    await shot('13-original-snapshot-superseded');

    // 12. Admission: the practice administrator cannot author.
    await chooseIdentity(page, runtime.baseUrl, 'admin');
    await page.goto(`${runtime.baseUrl}/requests/${runtime.seeded.progressRequestId}`, { waitUntil: 'domcontentloaded' });
    await expectStatus(page, 'approved');
    await expect(page.getByTestId('save-draft')).toHaveCount(0);
    await shot('14-administrator-read-only');

    // 13. Responsive check on a narrow viewport.
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(runtime.baseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('outputs-page')).toBeVisible();
    await shot('15-mobile-outputs-list');

    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'walkthrough-evidence.json'), JSON.stringify({
      evidenceKind: 'offline-loopback-browser-walkthrough',
      dataset: 'synthetic fixtures only',
      provider: 'none (AI drafting fails closed)',
      recordedAt: 'deterministic seed clock; screenshots taken during the run',
      steps: evidence.steps,
    }, null, 2));
  } finally {
    await runtime.stop();
  }
});
