import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
  assert.doesNotMatch(marketingMain, /@vercel\/analytics|Analytics|beforeSend/);
  assert.doesNotMatch(platformMain, /@vercel\/analytics|Analytics/);

  const usageEndpoint = 'https://app.assesssuite.com/api/usage/page-load';
  assert.equal(marketingMain.split(usageEndpoint).length - 1, 1);
  assert.match(marketingMain, /if \(!import\.meta\.env\.PROD/);
  assert.match(marketingMain, /'https:\/\/assesssuite\.com'/);
  assert.match(marketingMain, /'https:\/\/www\.assesssuite\.com'/);
  assert.equal((marketingMain.match(/reportLandingPageLoad\(\);/g) || []).length, 1);

  const fetchOptions = marketingMain.match(/window\.fetch\(LANDING_PAGE_LOAD_ENDPOINT, \{([\s\S]*?)\n\s*\}\)/)?.[1];
  assert.ok(fetchOptions, 'expected the isolated landing usage request');
  assert.match(fetchOptions, /method:\s*'POST'/);
  assert.match(fetchOptions, /credentials:\s*'omit'/);
  assert.match(fetchOptions, /referrerPolicy:\s*'no-referrer'/);
  assert.match(fetchOptions, /keepalive:\s*true/);
  assert.doesNotMatch(fetchOptions, /\bbody\s*:/);
});

test('authenticated navigation keeps page logging and adds one tab-session AppOpen sentinel', () => {
  const tracker = read('src/lib/NavigationTracker.jsx');

  assert.match(tracker, /base44\.appLogs\.logUserInApp\(pageName\)/);
  assert.equal((tracker.match(/base44\.appLogs\.logUserInApp\('AppOpen'\)/g) || []).length, 1);
  assert.match(tracker, /if \(!isAuthenticated \|\| !claimAppOpenForBrowserSession\(\)\) return;/);
  assert.match(tracker, /window\.sessionStorage\.getItem\(APP_OPEN_SESSION_KEY\)/);
  assert.match(tracker, /window\.sessionStorage\.setItem\(APP_OPEN_SESSION_KEY, '1'\)/);
  assert.match(tracker, /\}, \[isAuthenticated\]\);/);
  assert.doesNotMatch(tracker, /localStorage|document\.referrer|navigator\.|location\.href[^\n]*AppOpen/);
});

test('admin analytics presents the four aggregate usage measures through an authenticated same-origin request', () => {
  const adminAnalytics = read('src/pages/AdminAnalytics.jsx');

  for (const marker of [
    '/api/usage/summary?days=30',
    'appParams.token',
    'appParams.appId',
    'credentials: "same-origin"',
    'redirect: "error"',
    'Page loads today',
    'Successful sign-ins today',
    'New verified accounts today',
    'App opens today',
    'Page loads are not individual people',
  ]) {
    assert.ok(adminAnalytics.includes(marker), `admin usage view lost ${marker}`);
  }
  assert.match(adminAnalytics, /Authorization:\s*`Bearer \$\{sessionValue\}`/);
  assert.doesNotMatch(adminAnalytics, /document\.referrer|navigator\.|location\.href/);
});

test('the private practice overview is independent of clinician onboarding gates', () => {
  const app = read('src/App.jsx');
  const layout = read('src/Layout.jsx');
  const overview = read('src/pages/UsageOverview.jsx');
  const server = read('server/index.mjs');

  assert.match(app, /ProtectedRoute unauthenticatedElement=\{<Navigate to="\/login" replace \/>\}/);
  assert.match(layout, /BYPASS_PATHS = \[[^\]]*"\/UsageOverview"[^\]]*\]/);
  assert.match(layout, /if \(isBypassPath\(location\.pathname\)\) return <>\{children\}<\/>;/);

  for (const source of [layout, overview, server]) {
    assert.match(source, /brenton@primehealthclinics\.com/);
    assert.match(source, /mb\.vidler@gmail\.com/);
  }
  assert.match(overview, /await base44\.auth\.me\(\)/);
  assert.match(overview, /if \(!canView\(user\)\)/);
  assert.match(overview, /fetch\("\/api\/usage\/summary\?days=30"/);
  assert.match(server, /if \(!sessionUser\) return sendError\(res, 401, 'authentication required'\)/);
  assert.match(server, /if \(!canViewUsageDashboard\(sessionUser\)\) return sendError\(res, 403, 'dashboard access required'\)/);
});

test('build and routing configuration preserves the split-hosting boundary', () => {
  const packageJson = JSON.parse(read('package.json'));
  const jsConfig = JSON.parse(read('jsconfig.json'));
  const vercel = JSON.parse(read('vercel.json'));
  const platformHtml = read('apps/app-ep/index.html');
  const landingConfig = read('apps/landing/vite.config.js');
  const splitVerifier = read('scripts/verify-split-build.mjs');
  const vercelIgnore = read('.vercelignore');
  const contentSecurityPolicy = vercel.headers
    .flatMap((route) => route.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value;

  assert.equal(packageJson.scripts.build, 'npm run build:platform');
  assert.ok(jsConfig.compilerOptions.types.includes('vite/client'));
  assert.equal(vercel.buildCommand, 'npm run build:landing');
  assert.equal(vercel.outputDirectory, 'apps/landing/dist');
  assert.deepEqual(vercel.rewrites, [{ source: '/legal/:slug', destination: '/' }]);
  assert.ok(vercel.redirects.some((redirect) => (
    redirect.source === '/Settings'
      && redirect.destination === 'https://app.assesssuite.com/MyProfile'
  )));
  assert.ok(vercel.redirects.some((redirect) => redirect.destination === 'https://app.assesssuite.com/:path'));
  assert.ok(vercel.redirects.every((redirect) => !/(?:api|functions|uploads)/i.test(redirect.source)));
  assert.ok(contentSecurityPolicy);
  assert.doesNotMatch(contentSecurityPolicy, /va\.vercel-scripts\.com/);
  assert.doesNotMatch(contentSecurityPolicy, /fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(contentSecurityPolicy, /(?:^|;\s*)script-src 'self'(?:;|$)/);
  const connectSource = contentSecurityPolicy.match(/(?:^|;\s*)connect-src ([^;]+)(?:;|$)/)?.[1];
  assert.equal(connectSource, "'self' https://app.assesssuite.com");
  assert.match(contentSecurityPolicy, /(?:^|;\s*)font-src 'self'(?:;|$)/);
  assert.match(splitVerifier, /landingUsageEndpoint = 'https:\/\/app\.assesssuite\.com\/api\/usage\/page-load'/);
  assert.match(splitVerifier, /usageEndpointOccurrences !== 1/);
  assert.match(splitVerifier, /landing\.replace\(landingUsageEndpoint, ''\)/);
  for (const marker of [
    "['/api/'",
    "['/functions/'",
    "['X-App-Id'",
    "['/api/apps/'",
    "['Bearer ${'",
    "['appLogs'",
    "['AuthProvider'",
    "['/_vercel/insights'",
    "['va.vercel-scripts.com'",
  ]) {
    assert.ok(splitVerifier.includes(marker), `compiled landing guard lost ${marker}`);
  }
  assert.match(platformHtml, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(landingConfig, /\bserverPort\s*:|\bproxy\s*:/);
  for (const ignored of ['.env', 'node_modules', 'dist', 'apps/app-ep', 'server']) {
    assert.match(vercelIgnore, new RegExp(`^${ignored.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('landing restores Plus Jakarta Sans from a self-hosted licensed asset', () => {
  const landing = read('src/pages/LandingLive.jsx');
  const landingMain = read('apps/landing/src/main.jsx');
  const fontCss = read('apps/landing/src/landing-fonts.css');
  const fontLicense = read('apps/landing/public/fonts/plus-jakarta-sans/OFL.txt');

  assert.match(landingMain, /import ['"]\.\/landing-fonts\.css['"]/);
  assert.match(fontCss, /@font-face/);
  assert.match(fontCss, /font-family:\s*['"]Plus Jakarta Sans['"]/);
  assert.match(fontCss, /font-weight:\s*200 800/);
  assert.match(fontCss, /font-display:\s*swap/);
  assert.match(fontCss, /url\(['"]\/fonts\/plus-jakarta-sans\/PlusJakartaSans-Variable\.woff2['"]\)/);
  assert.doesNotMatch(fontCss, /https?:|\/\//);
  assert.match(fontLicense, /SIL OPEN FONT LICENSE Version 1\.1/);

  for (const selector of [
    '\\.lp \\.hero h1',
    '\\.lp h2',
    '\\.lp \\.feature-card h3',
    '\\.lp \\.feature-card p',
  ]) {
    assert.match(
      landing,
      new RegExp(`${selector} \\{[^}]*font-family: 'Plus Jakarta Sans'`),
      `${selector} must prefer Plus Jakarta Sans`,
    );
  }
});

test('published analytics notices disclose disabled Vercel analytics and the aggregate-only replacement', () => {
  const packageJson = read('package.json');
  const packageLock = read('package-lock.json');
  const cookieNotice = read('src/legal-content/10_cookie_analytics_and_tracking_notice.md');
  const privacyPolicy = read('src/legal-content/03_privacy_policy.md');
  const subprocessorSchedule = read('src/legal-content/25_approved_subprocessor_and_cross_border_schedule_template.md');
  const registry = read('src/lib/legal/documentRegistry.js');
  const marketingLegalPage = read('apps/landing/src/MarketingLegalDocument.jsx');

  for (const source of [cookieNotice, privacyPolicy, subprocessorSchedule]) {
    assert.match(source, /Vercel Web Analytics/);
    assert.match(source, /Patient Data/);
    assert.match(source, /disabled/i);
    assert.match(source, /external referring URL/);
  }
  assert.match(cookieNotice, /custom events/);
  assert.match(cookieNotice, /query string and URL fragment/);
  assert.match(cookieNotice, /first-party aggregate/i);
  assert.match(cookieNotice, /Australia\/Brisbane/);
  assert.match(cookieNotice, /no raw measurement-event row/i);
  assert.doesNotMatch(cookieNotice, /Off by default until PIA/);
  assert.match(registry, /2026-08-02\.3/);
  assert.match(registry, /VERCEL WEB ANALYTICS DISABLED/);
  assert.match(registry, /FIRST-PARTY AGGREGATE MEASUREMENT/);
  assert.match(registry, /effectiveDate: '2 August 2026'/);
  assert.match(marketingLegalPage, /doc\.effectiveDate \|\| SUITE_EFFECTIVE_DATE/);
  assert.doesNotMatch(read('apps/landing/src/main.jsx'), /@vercel\/analytics|Analytics|beforeSend/);
  assert.doesNotMatch(packageJson, /@vercel\/analytics/);
  assert.doesNotMatch(packageLock, /@vercel\/analytics/);
});
