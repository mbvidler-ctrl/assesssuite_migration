import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrl, outputDirectory] = process.argv.slice(2);

// Each case pins the responsive mode the viewport must select, so a landscape
// phone can never silently receive the desktop composition again and desktop
// viewports can never silently inherit the compact styling.
const CASES = [
  { width: 390, height: 844, mode: 'compact-portrait' },
  { width: 480, height: 1000, mode: 'compact-portrait' },
  { width: 844, height: 390, mode: 'compact-landscape', screenshot: 'hero-844x390.png', routeCheck: true },
  { width: 915, height: 412, mode: 'compact-landscape', screenshot: 'hero-915x412.png' },
  { width: 932, height: 430, mode: 'compact-landscape', screenshot: 'hero-932x430.png' },
  { width: 1024, height: 768, mode: 'desktop' },
  { width: 1280, height: 1000, mode: 'desktop', screenshot: 'hero-1280x1000.png', routeCheck: true },
  { width: 1920, height: 1080, mode: 'desktop' },
];

const MODE_CONTRACT = {
  'compact-portrait': { h1FontSize: '36px', heroPaddingTop: '60px', navLinksDisplay: 'none' },
  'compact-landscape': { h1FontSize: '32px', heroPaddingTop: '40px', navLinksDisplay: 'none' },
  desktop: { h1FontSize: '56px', heroPaddingTop: '100px', navLinksDisplay: 'flex' },
};

if (!baseUrl || !outputDirectory) {
  throw new Error('Usage: node scripts/stage2/measure-hero-cta.mjs <base-url> <output-directory>');
}

const landingUrl = new URL('/', baseUrl).toString();
// Optional override for environments that provide Chromium outside the
// Playwright registry (e.g. a preinstalled system browser).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: CASES[0].width, height: CASES[0].height } });
const measurements = [];
const screenshots = [];

const rectsIntersect = (a, b) =>
  a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const openLanding = async () => {
  await page.goto(landingUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.hero-ctas').waitFor({ state: 'visible' });
  // Best-effort font settle for screenshot fidelity only; geometry assertions
  // do not depend on webfont availability.
  await page
    .evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2000))]))
    .catch(() => {});
};

try {
  for (const testCase of CASES) {
    const { width, height, mode } = testCase;
    await page.setViewportSize({ width, height });
    await openLanding();

    // The hero CTA sits below the fold on short landscape viewports; the
    // mission contract is measured with the control scrolled into view, which
    // also makes the sticky-header intersection check meaningful.
    await page.locator('.hero-ctas .btn-primary').evaluate((button) => {
      button.scrollIntoView({ block: 'center', behavior: 'instant' });
    });

    const measurement = await page.evaluate(() => {
      const container = document.querySelector('.hero-ctas');
      const primary = container?.querySelector('.btn-primary');
      const signIn = container?.querySelector('p');
      const signInLink = container?.querySelector('a');
      const navLinks = document.querySelector('.lp .nav-links');
      const navBar = document.querySelector('.lp nav');
      const heroHeading = document.querySelector('.lp .hero h1');
      const hero = document.querySelector('.lp .hero');
      const toRect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const containerComputed = container ? getComputedStyle(container) : null;

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentScrollWidth: document.documentElement.scrollWidth,
        flexDirection: containerComputed?.flexDirection ?? null,
        alignItems: containerComputed?.alignItems ?? null,
        containerWidth: container ? container.getBoundingClientRect().width : null,
        navLinksDisplay: navLinks ? getComputedStyle(navLinks).display : null,
        h1FontSize: heroHeading ? getComputedStyle(heroHeading).fontSize : null,
        heroPaddingTop: hero ? getComputedStyle(hero).paddingTop : null,
        primary: toRect(primary),
        nav: toRect(navBar),
        signIn: toRect(signIn),
        signInLink: toRect(signInLink),
        signInText: signInLink?.textContent?.trim() ?? null,
      };
    });

    const expected = MODE_CONTRACT[mode];
    const primary = measurement.primary;
    const centerDelta = primary ? Math.abs(primary.left + primary.width / 2 - width / 2) : Infinity;
    const failures = [];

    if (measurement.documentScrollWidth > width) failures.push('horizontal overflow');
    if (measurement.flexDirection !== 'column') failures.push('hero-ctas is not a column');
    if (measurement.alignItems !== 'center') failures.push('hero-ctas does not center children');
    if (centerDelta > 5) failures.push(`primary CTA off-center by ${centerDelta.toFixed(2)}px`);
    if (!primary || primary.left < 0 || primary.right > width || primary.top < 0 || primary.bottom > height) {
      failures.push('primary CTA not fully within viewport after scroll into view');
    }
    if (!primary || primary.width < 44 || primary.height < 44) failures.push('primary CTA below 44x44 usable target');
    if (rectsIntersect(primary, measurement.nav)) failures.push('primary CTA intersects sticky header');
    if (!primary || !measurement.signIn || primary.bottom > measurement.signIn.top + 1) {
      failures.push('sign-in text is not below the primary CTA');
    }
    if (!measurement.signInLink || measurement.signInLink.width <= 0 || measurement.signInLink.height <= 0) {
      failures.push('sign-in link is not visibly rendered');
    }
    if (measurement.signInText !== 'Sign in') failures.push('sign-in link text changed');
    if (measurement.navLinksDisplay !== expected.navLinksDisplay) {
      failures.push(`nav-links display is ${measurement.navLinksDisplay}, expected ${expected.navLinksDisplay}`);
    }
    if (measurement.h1FontSize !== expected.h1FontSize) {
      failures.push(`hero h1 font-size is ${measurement.h1FontSize}, expected ${expected.h1FontSize}`);
    }
    if (measurement.heroPaddingTop !== expected.heroPaddingTop) {
      failures.push(`hero padding-top is ${measurement.heroPaddingTop}, expected ${expected.heroPaddingTop}`);
    }

    if (failures.length > 0) {
      throw new Error(
        `Hero CTA geometry failed at ${width}x${height} (${mode}): ${failures.join('; ')} :: ${JSON.stringify(measurement)}`,
      );
    }

    if (testCase.screenshot) {
      fs.mkdirSync(outputDirectory, { recursive: true });
      const screenshotPath = path.join(outputDirectory, testCase.screenshot);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshots.push({
        case: `${width}x${height}`,
        file: testCase.screenshot,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex'),
      });
    }

    if (testCase.routeCheck) {
      await page.locator('.hero-ctas .btn-primary').click();
      await page.waitForURL('**/register', { timeout: 15000 });
      await openLanding();
      await page.locator('.hero-ctas p a').evaluate((link) => {
        link.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await page.locator('.hero-ctas p a').click();
      await page.waitForURL('**/login', { timeout: 15000 });
      await openLanding();
    }

    measurements.push({ width, height, mode, centerDelta: Number(centerDelta.toFixed(3)), routeChecked: Boolean(testCase.routeCheck), ...measurement });
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, 'hero-cta-measurement.json'),
    JSON.stringify({
      schema_version: 'assesssuite.hero-cta-measurement.v2',
      base_url: landingUrl,
      generated_at: new Date().toISOString(),
      cases: CASES.map(({ width, height, mode }) => ({ width, height, mode })),
      measurements,
      screenshots,
    }, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log('Hero CTA geometry passed at ' + CASES.length + ' viewports (' + screenshots.length + ' screenshots captured).');
} finally {
  await page.close();
  await browser.close();
}
