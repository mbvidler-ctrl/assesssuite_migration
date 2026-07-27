import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrl, outputDirectory] = process.argv.slice(2);
const WIDTHS = [1920, 1440, 1280, 1024, 900, 768, 480, 390];

if (!baseUrl || !outputDirectory) {
  throw new Error('Usage: node scripts/stage2/measure-hero-cta.mjs <base-url> <output-directory>');
}

const landingUrl = new URL('/', baseUrl).toString();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: WIDTHS[0], height: 1000 } });
const measurements = [];

try {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(landingUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.hero-ctas').waitFor({ state: 'visible' });

    const measurement = await page.locator('.hero-ctas').evaluate((container) => {
      const primary = container.querySelector('.btn-primary');
      const signIn = container.querySelector('p');
      const signInLink = container.querySelector('a');
      const containerBox = container.getBoundingClientRect();
      const primaryBox = primary?.getBoundingClientRect();
      const signInBox = signIn?.getBoundingClientRect();
      const computed = getComputedStyle(container);

      return {
        viewportWidth: window.innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        flexDirection: computed.flexDirection,
        alignItems: computed.alignItems,
        primary: primaryBox && {
          left: primaryBox.left,
          right: primaryBox.right,
          top: primaryBox.top,
          bottom: primaryBox.bottom,
          width: primaryBox.width,
          height: primaryBox.height,
        },
        signIn: signInBox && {
          top: signInBox.top,
          bottom: signInBox.bottom,
        },
        signInText: signInLink?.textContent?.trim() ?? null,
        containerWidth: containerBox.width,
      };
    });

    const centeredPrimary = measurement.primary &&
      Math.abs(measurement.primary.left + (measurement.primary.width / 2) - (width / 2)) <= 5;
    const primaryInViewport = measurement.primary &&
      measurement.primary.left >= 0 &&
      measurement.primary.right <= width;
    const verticallySeparated = measurement.primary && measurement.signIn &&
      measurement.primary.bottom <= measurement.signIn.top + 1;

    if (
      measurement.flexDirection !== 'column' ||
      measurement.alignItems !== 'center' ||
      !centeredPrimary ||
      !primaryInViewport ||
      !verticallySeparated ||
      measurement.documentScrollWidth > width ||
      measurement.signInText !== 'Sign in'
    ) {
      throw new Error('Hero CTA geometry failed at width ' + width + ': ' + JSON.stringify(measurement));
    }

    measurements.push({ width, ...measurement });
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, 'hero-cta-measurement.json'),
    JSON.stringify({
      schema_version: 'assesssuite.hero-cta-measurement.v1',
      base_url: landingUrl,
      widths: WIDTHS,
      measurements,
    }, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log('Hero CTA geometry passed at ' + WIDTHS.length + ' viewport widths.');
} finally {
  await page.close();
  await browser.close();
}
