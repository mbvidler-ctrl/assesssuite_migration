import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sanitiseAnalyticsEvent } from '../../apps/landing/src/analytics.js';
import {
  APPROVED_LANDING_LEGAL_DOCUMENTS,
  getApprovedLandingLegalDocumentBySlug,
} from '../../apps/landing/src/approvedLegalDocuments.js';
import {
  LEGAL_DOCUMENTS,
  isLegalDocumentPublicationApproved,
} from '../../src/lib/legal/documentRegistry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('landing analytics keeps only public production paths and strips query data', () => {
  const event = sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://assesssuite.com/?utm_source=private#section' },
    'https://assesssuite.com',
  );
  assert.equal(event.url, 'https://assesssuite.com/');
  assert.equal(event.type, 'pageview');

  const legal = sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://www.assesssuite.com/legal/privacy?token=secret' },
    'https://www.assesssuite.com',
  );
  assert.equal(legal.url, 'https://www.assesssuite.com/legal/privacy');

  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://assesssuite.com/legal/jane-doe-depression?patient=123' },
    'https://assesssuite.com',
  ), null);
  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://assesssuite.com/legal/website-terms' },
    'https://assesssuite.com',
  ), null);
  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://assesssuite.com/legal/vulnerability-disclosure' },
    'https://assesssuite.com',
  ), null);
  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'http://assesssuite.com/legal/privacy' },
    'https://assesssuite.com',
  ), null);

  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://app.assesssuite.com/Dashboard?client=123' },
    'https://app.assesssuite.com',
  ), null);
  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://assesssuite.com/login' },
    'https://assesssuite.com',
  ), null);
  assert.equal(sanitiseAnalyticsEvent(
    { type: 'pageview', url: 'https://preview-branch.vercel.app/' },
    'https://preview-branch.vercel.app',
  ), null);
  assert.equal(sanitiseAnalyticsEvent(
    { type: 'event', name: 'future-custom-event', url: 'https://assesssuite.com/' },
    'https://assesssuite.com',
  ), null);
});

test('landing legal routes and imports fail closed for unapproved drafts', () => {
  const draftIds = ['website-terms', 'vulnerability-disclosure'];
  for (const id of draftIds) {
    const draft = LEGAL_DOCUMENTS[id];
    assert.equal(draft.publicRoute, false);
    assert.equal(isLegalDocumentPublicationApproved(draft), false);
    assert.equal(getApprovedLandingLegalDocumentBySlug(draft.slug), null);
  }

  const approvedRegistryEntries = Object.entries(LEGAL_DOCUMENTS)
    .filter(([, doc]) => doc.publicRoute && isLegalDocumentPublicationApproved(doc));
  assert.deepEqual(
    Object.keys(APPROVED_LANDING_LEGAL_DOCUMENTS).sort(),
    approvedRegistryEntries.map(([id]) => id).sort(),
  );
  for (const [id, landingDoc] of Object.entries(APPROVED_LANDING_LEGAL_DOCUMENTS)) {
    const registryDoc = LEGAL_DOCUMENTS[id];
    assert.deepEqual(
      {
        title: landingDoc.title,
        slug: landingDoc.slug,
        file: landingDoc.file,
        releaseStatus: landingDoc.releaseStatus,
        effectiveDate: landingDoc.effectiveDate,
        publicRoute: landingDoc.publicRoute,
      },
      {
        title: registryDoc.title,
        slug: registryDoc.slug,
        file: registryDoc.file,
        releaseStatus: registryDoc.releaseStatus,
        effectiveDate: registryDoc.effectiveDate,
        publicRoute: registryDoc.publicRoute,
      },
    );
    assert.equal(isLegalDocumentPublicationApproved(landingDoc), true);
  }

  const rawImportMap = read('apps/landing/src/approvedLegalContent.js');
  const marketingLegalPage = read('apps/landing/src/MarketingLegalDocument.jsx');
  assert.doesNotMatch(rawImportMap, /import\.meta\.glob|09_website_terms|28_vulnerability_disclosure/);
  for (const [, doc] of approvedRegistryEntries) {
    assert.match(rawImportMap, new RegExp(doc.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(marketingLegalPage, /loadLegalContent/);
  assert.match(marketingLegalPage, /getApprovedLandingLegalDocumentBySlug/);
  assert.match(marketingLegalPage, /!isLegalDocumentPublicationApproved\(doc\)/);
});

test('marketing entry has no authenticated application or API provider imports', () => {
  const marketingApp = read('apps/landing/src/MarketingApp.jsx');
  const landing = read('src/pages/LandingLive.jsx');
  const platformApp = read('src/App.jsx');
  const marketingMain = read('apps/landing/src/main.jsx');
  const platformMain = read('apps/app-ep/src/main.jsx');

  assert.doesNotMatch(marketingApp, /(?:import|from)\s+['"][^'"]*(?:AuthContext|base44)|\/api\/|\/functions\//);
  assert.match(marketingApp, /BLOCKED_BACKEND_PATH/);
  assert.doesNotMatch(landing, /(?:import|from)\s+['"][^'"]*(?:AuthContext|base44)|\buseAuth\s*\(|\buseNavigate\s*\(/);
  assert.doesNotMatch(platformApp, /pages\/LandingLive/);
  assert.match(marketingMain, /@vercel\/analytics\/react/);
  assert.doesNotMatch(platformMain, /@vercel\/analytics|Analytics/);
});

test('build and routing configuration preserves the split-hosting boundary', () => {
  const packageJson = JSON.parse(read('package.json'));
  const vercel = JSON.parse(read('vercel.json'));
  const platformHtml = read('apps/app-ep/index.html');
  const landingConfig = read('apps/landing/vite.config.js');
  const vercelIgnore = read('.vercelignore');

  assert.equal(packageJson.scripts.build, 'npm run build:platform');
  assert.equal(vercel.buildCommand, 'npm run build:landing');
  assert.equal(vercel.outputDirectory, 'apps/landing/dist');
  assert.deepEqual(vercel.rewrites, [{ source: '/legal/:slug', destination: '/' }]);
  assert.ok(vercel.redirects.some((redirect) => (
    redirect.source === '/Settings'
      && redirect.destination === 'https://app.assesssuite.com/MyProfile'
  )));
  assert.ok(vercel.redirects.some((redirect) => redirect.destination === 'https://app.assesssuite.com/:path'));
  assert.ok(vercel.redirects.every((redirect) => !/(?:api|functions|uploads)/i.test(redirect.source)));
  assert.match(platformHtml, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(landingConfig, /\bserverPort\s*:|\bproxy\s*:/);
  for (const ignored of ['.env', 'node_modules', 'dist', 'apps/app-ep', 'server']) {
    assert.match(vercelIgnore, new RegExp(`^${ignored.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('published analytics notices match the bounded implementation', () => {
  const cookieNotice = read('src/legal-content/10_cookie_analytics_and_tracking_notice.md');
  const privacyPolicy = read('src/legal-content/03_privacy_policy.md');
  const subprocessorSchedule = read('src/legal-content/25_approved_subprocessor_and_cross_border_schedule_template.md');
  const registry = read('src/lib/legal/documentRegistry.js');
  const marketingLegalPage = read('apps/landing/src/MarketingLegalDocument.jsx');

  for (const source of [cookieNotice, privacyPolicy, subprocessorSchedule]) {
    assert.match(source, /Vercel Web Analytics/);
    assert.match(source, /Patient Data/);
  }
  assert.match(cookieNotice, /does not configure custom events/);
  assert.match(cookieNotice, /query string and URL fragment/);
  assert.doesNotMatch(cookieNotice, /Off by default until PIA/);
  assert.match(registry, /2026-08-02\.1/);
  assert.match(registry, /LIMITED PUBLIC-SITE ANALYTICS ONLY/);
  assert.match(registry, /effectiveDate: '2 August 2026'/);
  assert.match(marketingLegalPage, /doc\.effectiveDate \|\| SUITE_EFFECTIVE_DATE/);
});
