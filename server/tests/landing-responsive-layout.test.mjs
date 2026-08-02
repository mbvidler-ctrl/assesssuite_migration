import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const landingSource = fs.readFileSync(path.join(repositoryRoot, 'src/pages/LandingLive.jsx'), 'utf8');

const COMPACT_QUERY = '@media (max-width: 900px), (max-height: 520px) and (orientation: landscape) {';
const SHORT_LANDSCAPE_QUERY = '@media (max-height: 520px) and (orientation: landscape) {';

test('compact layout covers short landscape phone viewports, not just narrow widths', () => {
  assert.ok(landingSource.includes(COMPACT_QUERY), 'combined width/short-landscape media query is missing');
  assert.doesNotMatch(
    landingSource,
    /@media \(max-width: 900px\) \{/,
    'width-only media query has returned; landscape phones would receive the desktop layout',
  );

  const compactBlockStart = landingSource.indexOf(COMPACT_QUERY);
  const shortLandscapeStart = landingSource.indexOf(SHORT_LANDSCAPE_QUERY);
  assert.ok(shortLandscapeStart > compactBlockStart, 'short-landscape tightening block must follow the combined block');

  const compactBlock = landingSource.slice(compactBlockStart, shortLandscapeStart);
  assert.match(compactBlock, /\.lp \.nav-links \{ display: none; \}/, 'compact mode must hide the desktop nav links');
  assert.match(compactBlock, /\.lp \.hero h1 \{ font-size: 36px; \}/, 'compact mode must reduce the hero heading');

  const shortLandscapeBlock = landingSource.slice(shortLandscapeStart);
  assert.match(shortLandscapeBlock, /\.lp \.hero \{ padding: 40px 24px 40px; \}/, 'short landscape mode must tighten hero padding');
  assert.match(shortLandscapeBlock, /\.lp \.hero h1 \{ font-size: 32px; \}/, 'short landscape mode must tighten the hero heading');
});

test('hero CTA container is a full-width centred column', () => {
  const heroCtasRule = landingSource.match(/\.lp \.hero-ctas \{([^}]*)\}/);
  assert.ok(heroCtasRule, '.hero-ctas rule is missing');
  for (const declaration of ['display: flex', 'flex-direction: column', 'align-items: center', 'width: 100%']) {
    assert.ok(heroCtasRule[1].includes(declaration), `.hero-ctas rule must declare ${declaration}`);
  }
});

test('hero CTA and sign-in cross to the application origin with stable routes', () => {
  const heroCtas = landingSource.match(/<div className="hero-ctas">([\s\S]*?)<\/div>/);
  assert.ok(heroCtas, 'hero-ctas markup is missing');
  assert.match(
    heroCtas[1],
    /<a href=\{appHref\('\/register'\)\} className="btn-primary"/,
    'primary hero CTA must be an anchor crossing to the application /register route',
  );
  assert.match(heroCtas[1], /Already using AssessSuite\?/, 'sign-in helper copy must remain with the hero CTA');
  assert.match(
    heroCtas[1],
    /<a href=\{appHref\('\/login'\)\}/,
    'sign-in link must cross to the application /login route',
  );
});
