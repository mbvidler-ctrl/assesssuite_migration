import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

const EXPECTED_USAGE_DASHBOARD_VIEWERS = [
  'brenton@primehealthclinics.com',
  'mb.vidler@gmail.com',
];

const USAGE_DASHBOARD_ALLOWLIST_SOURCES = [
  {
    relativePath: 'server/index.mjs',
    pattern: /const\s+USAGE_DASHBOARD_VIEWER_EMAILS\s*=\s*new Set\(\[([\s\S]*?)\]\);/u,
  },
  {
    relativePath: 'src/Layout.jsx',
    pattern: /const\s+usageDashboardViewerEmails\s*=\s*new Set\(\[([\s\S]*?)\]\);/u,
  },
  {
    relativePath: 'src/pages/UsageOverview.jsx',
    pattern: /const\s+VIEWER_EMAILS\s*=\s*new Set\(\[([\s\S]*?)\]\);/u,
  },
];

const METRIC_KEYS = [
  'day',
  'marketing_page_load',
  'successful_sign_in',
  'new_verified_account',
  'app_open',
];

function assertSummarySchema(summary, rangeDays) {
  assert.deepEqual(Object.keys(summary), ['time_zone', 'range_days', 'daily']);
  assert.equal(summary.time_zone, 'Australia/Brisbane');
  assert.equal(summary.range_days, rangeDays);
  assert.equal(summary.daily.length, rangeDays);
  for (const row of summary.daily) {
    assert.deepEqual(Object.keys(row), METRIC_KEYS);
    assert.match(row.day, /^\d{4}-\d{2}-\d{2}$/);
    for (const key of METRIC_KEYS.slice(1)) {
      assert.equal(Number.isSafeInteger(row[key]), true, `${key} must be a safe integer`);
      assert.ok(row[key] >= 0, `${key} must be non-negative`);
    }
  }
  const sortedDays = summary.daily.map((row) => row.day).toSorted();
  assert.deepEqual(summary.daily.map((row) => row.day), sortedDays);
}

function todaysMetrics(summary) {
  return summary.daily.at(-1);
}

function readLiteralAllowlist({ relativePath, pattern }) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const match = pattern.exec(source);
  assert.ok(match, `${relativePath} must retain a literal named-viewer Set`);
  return [...match[1].matchAll(/["']([^"']+)["']/gu)]
    .map(([, email]) => email.trim().toLowerCase())
    .toSorted();
}

test('marketing page-load accepts only exact production origins and a zero-byte body', async () => {
  const server = await startTestServer();
  try {
    for (const origin of ['https://assesssuite.com', 'https://www.assesssuite.com']) {
      const accepted = await fetch(`${server.baseUrl}/api/usage/page-load`, {
        method: 'POST',
        headers: { Origin: origin },
      });
      assert.equal(accepted.status, 204, await accepted.text());
      assert.equal(accepted.headers.get('access-control-allow-origin'), origin);
    }

    for (const headers of [
      {},
      { Origin: 'https://evil.example' },
      { Origin: 'HTTPS://ASSESSSUITE.COM' },
      { Origin: 'https://assesssuite.com/' },
    ]) {
      const rejected = await fetch(`${server.baseUrl}/api/usage/page-load`, { method: 'POST', headers });
      assert.equal(rejected.status, 403, await rejected.text());
    }
    const nonEmpty = await fetch(`${server.baseUrl}/api/usage/page-load`, {
      method: 'POST',
      headers: { Origin: 'https://assesssuite.com' },
      body: 'patient@example.test',
    });
    assert.equal(nonEmpty.status, 413, await nonEmpty.text());
    const wrongMethod = await fetch(`${server.baseUrl}/api/usage/page-load`, {
      method: 'GET',
      headers: { Origin: 'https://assesssuite.com' },
    });
    assert.equal(wrongMethod.status, 405, await wrongMethod.text());

    const adminToken = await loginAdmin(server);
    const summary = await requestJson(server, '/api/usage/summary?days=3', { token: adminToken });
    assert.equal(summary.status, 200, summary.text);
    assertSummarySchema(summary.body, 3);
    assert.deepEqual(todaysMetrics(summary.body), {
      day: todaysMetrics(summary.body).day,
      marketing_page_load: 2,
      successful_sign_in: 1,
      new_verified_account: 0,
      app_open: 0,
    });
  } finally {
    await server.stop();
  }
});

test('authentication and AppOpen counters include only completed, valid milestones', async () => {
  const server = await startTestServer();
  try {
    const badLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@local.test', password: 'wrong-password' },
    });
    assert.equal(badLogin.status, 401, badLogin.text);
    const adminToken = await loginAdmin(server);

    const email = 'synthetic-usage-account@example.test';
    const registration = await requestJson(server, `/api/apps/${server.appId}/auth/register`, {
      method: 'POST',
      body: { email, password: 'Synthetic-Assurance-Password-1!' },
    });
    assert.equal(registration.status, 200, registration.text);
    let summary = await requestJson(server, '/api/usage/summary?days=1', { token: adminToken });
    assert.equal(todaysMetrics(summary.body).new_verified_account, 0);

    const verification = await requestJson(server, `/api/apps/${server.appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email, otp_code: '000000' },
    });
    assert.equal(verification.status, 200, verification.text);
    const userToken = verification.body.access_token;
    const duplicateVerification = await requestJson(server, `/api/apps/${server.appId}/auth/verify-otp`, {
      method: 'POST',
      body: { email, otp_code: '000000' },
    });
    assert.equal(duplicateVerification.status, 200, duplicateVerification.text);

    const appOpenRoute = `/api/app-logs/${server.appId}/log-user-in-app/AppOpen`;
    const anonymous = await requestJson(server, appOpenRoute, {
      method: 'POST',
      body: { email: 'patient@example.test', path: '/private/client/123' },
    });
    const invalid = await requestJson(server, appOpenRoute, {
      method: 'POST',
      token: 'invalid-session-token',
      body: { referrer: 'https://private.example/patient' },
    });
    const wrongSentinel = await requestJson(
      server,
      `/api/app-logs/${server.appId}/log-user-in-app/app_open`,
      { method: 'POST', token: userToken, body: { value: 'AppOpen' } },
    );
    const valid = await requestJson(server, appOpenRoute, {
      method: 'POST',
      token: userToken,
      body: { user: email, url: '/private/client/123', free_text: 'must not persist' },
    });
    for (const response of [anonymous, invalid, wrongSentinel, valid]) {
      assert.equal(response.status, 204, response.text);
      assert.equal(response.text, '');
    }

    const nonAdminSummary = await requestJson(server, '/api/usage/summary?days=1', { token: userToken });
    assert.equal(nonAdminSummary.status, 403, nonAdminSummary.text);
    const anonymousSummary = await requestJson(server, '/api/usage/summary?days=1');
    assert.equal(anonymousSummary.status, 401, anonymousSummary.text);
    for (const query of ['days=0', 'days=91', 'days=1.5', 'days=30&days=1', 'other=1']) {
      const rejected = await requestJson(server, `/api/usage/summary?${query}`, { token: adminToken });
      assert.equal(rejected.status, 400, `${query}: ${rejected.text}`);
    }

    summary = await requestJson(server, '/api/usage/summary', { token: adminToken });
    assert.equal(summary.status, 200, summary.text);
    assertSummarySchema(summary.body, 30);
    assert.deepEqual(todaysMetrics(summary.body), {
      day: todaysMetrics(summary.body).day,
      marketing_page_load: 0,
      successful_sign_in: 1,
      new_verified_account: 1,
      app_open: 1,
    });
    const maximumRange = await requestJson(server, '/api/usage/summary?days=90', { token: adminToken });
    assert.equal(maximumRange.status, 200, maximumRange.text);
    assertSummarySchema(maximumRange.body, 90);

    const db = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const rows = db.prepare('SELECT * FROM usage_daily_aggregate').all();
      const serialized = JSON.stringify(rows);
      for (const forbidden of [
        'patient@example.test',
        'synthetic-usage-account@example.test',
        'invalid-session-token',
        '/private/client/123',
        'private.example',
        'must not persist',
      ]) assert.equal(serialized.includes(forbidden), false, forbidden);
      assert.deepEqual(Object.keys(rows[0]), METRIC_KEYS);
    } finally {
      db.close();
    }
  } finally {
    await server.stop();
  }
});

test('dashboard summary uses a fail-closed constant-time secret and the exact admin schema', async () => {
  const dashboardToken = 'synthetic-dashboard-token-that-must-never-appear';
  const server = await startTestServer({ ASSESSSUITE_DASHBOARD_METRICS_TOKEN: dashboardToken });
  try {
    const route = '/api/usage/dashboard-summary?days=2';
    const missing = await requestJson(server, route);
    const wrong = await requestJson(server, route, {
      headers: { 'X-AssessSuite-Dashboard-Token': 'wrong-token' },
    });
    assert.equal(missing.status, 404, missing.text);
    assert.equal(wrong.status, 404, wrong.text);
    assert.equal(missing.text, wrong.text);

    const adminToken = await loginAdmin(server);
    const admin = await requestJson(server, '/api/usage/summary?days=2', { token: adminToken });
    const dashboard = await requestJson(server, route, {
      headers: { 'X-AssessSuite-Dashboard-Token': dashboardToken },
    });
    assert.equal(dashboard.status, 200, dashboard.text);
    assert.deepEqual(dashboard.body, admin.body);
    assertSummarySchema(dashboard.body, 2);

    const invalidQueryWithoutToken = await requestJson(server, '/api/usage/dashboard-summary?days=0');
    assert.equal(invalidQueryWithoutToken.status, 404, invalidQueryWithoutToken.text);
    const invalidQueryWithToken = await requestJson(server, '/api/usage/dashboard-summary?days=0', {
      headers: { 'X-AssessSuite-Dashboard-Token': dashboardToken },
    });
    assert.equal(invalidQueryWithToken.status, 400, invalidQueryWithToken.text);

    const combinedOutput = [missing.text, wrong.text, dashboard.text, server.getOutput()].join('\n');
    assert.equal(combinedOutput.includes(dashboardToken), false);
  } finally {
    await server.stop();
  }

  const unsetServer = await startTestServer({ ASSESSSUITE_DASHBOARD_METRICS_TOKEN: '' });
  try {
    const unset = await requestJson(unsetServer, '/api/usage/dashboard-summary?days=2', {
      headers: { 'X-AssessSuite-Dashboard-Token': dashboardToken },
    });
    assert.equal(unset.status, 404, unset.text);
    assert.equal(unset.text.includes(dashboardToken), false);
    assert.equal(unsetServer.getOutput().includes(dashboardToken), false);
  } finally {
    await unsetServer.stop();
  }

  const weakToken = 'too-short';
  const weakServer = await startTestServer({ ASSESSSUITE_DASHBOARD_METRICS_TOKEN: weakToken });
  try {
    const weak = await requestJson(weakServer, '/api/usage/dashboard-summary?days=2', {
      headers: { 'X-AssessSuite-Dashboard-Token': weakToken },
    });
    assert.equal(weak.status, 404, weak.text);
    assert.equal(weak.text.includes(weakToken), false);
    assert.equal(weakServer.getOutput().includes(weakToken), false);
  } finally {
    await weakServer.stop();
  }
});

test('the server and client named-viewer allowlists stay identical and limited to the approved viewers', () => {
  const expected = EXPECTED_USAGE_DASHBOARD_VIEWERS.toSorted();
  for (const source of USAGE_DASHBOARD_ALLOWLIST_SOURCES) {
    assert.deepEqual(readLiteralAllowlist(source), expected, `${source.relativePath} allowlist drifted`);
  }
});

test('the simple usage dashboard is available only to admins and its two named viewers', async () => {
  const server = await startTestServer();
  try {
    const namedViewers = [
      await registerUser(server, 'Brenton@primehealthclinics.com'),
      await registerUser(server, 'MB.Vidler@gmail.com'),
    ];
    const unrelated = await registerUser(server, 'unrelated-viewer@example.test');

    for (const viewer of namedViewers) {
      const allowed = await requestJson(server, '/api/usage/summary?days=30', { token: viewer.token });
      assert.equal(allowed.status, 200, allowed.text);
      assertSummarySchema(allowed.body, 30);
    }

    const denied = await requestJson(server, '/api/usage/summary?days=30', { token: unrelated.token });
    assert.equal(denied.status, 403, denied.text);
    assert.deepEqual(denied.body, { message: 'dashboard access required' });
  } finally {
    await server.stop();
  }
});
