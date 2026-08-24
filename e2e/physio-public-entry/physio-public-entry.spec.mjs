import { expect, test } from '@playwright/test';

const viewports = [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'mobile', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`public Physio entry is complete and responsive on ${viewport.label}`, async ({ page }) => {
    const consoleFailures = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) consoleFailures.push(message.text());
    });
    page.on('pageerror', (error) => consoleFailures.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/e2e/physio-public-entry/');

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Assessment, documentation and outcomes in one clinical thread.',
    })).toBeVisible();
    await expect(page.getByText('236 canonical assessments', { exact: true })).toBeVisible();
    await expect(page.getByText('Six structured AI workflows', { exact: true })).toBeVisible();
    await expect(page.getByText('From first presentation to discharge', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create your account' })).toHaveAttribute('href', '/register');
    await expect(page.getByRole('link', { name: 'Sign in to your practice' })).toHaveAttribute('href', '/login');
    await expect(page.getByText(/AssessSuite Physiotherapy/).last()).toBeVisible();

    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      visibleTextLength: document.body.innerText.trim().length,
      backgroundColor: getComputedStyle(document.querySelector('#root > div')).backgroundColor,
      headerLayout: getComputedStyle(document.querySelector('header > div')).display,
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.visibleTextLength).toBeGreaterThan(1_000);
    expect(geometry.backgroundColor).toBe('rgb(245, 250, 249)');
    expect(geometry.headerLayout).toBe('flex');
    expect(consoleFailures).toEqual([]);
  });
}
