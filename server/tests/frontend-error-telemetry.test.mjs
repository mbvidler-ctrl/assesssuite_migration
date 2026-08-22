import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FRONTEND_REPLAY_NETWORK_ALLOW_URLS,
  FRONTEND_REPLAY_NETWORK_DENY_URLS,
  FRONTEND_TELEMETRY_ALLOWED_ORIGINS,
  PHYSIO_FRONTEND_REPLAY_NETWORK_ALLOW_URLS,
  PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS,
  TELEMETRY_FILE_BYTES_OMITTED,
  TELEMETRY_REDACTED,
  captureFrontendException,
  clearFrontendTelemetryUser,
  createFrontendBeforeSend,
  createFrontendIntegrations,
  createFrontendReplayOptions,
  createFrontendSentryOptions,
  initialiseFrontendErrorTelemetry,
  sanitizeCredentialString,
  sanitizeFrontendTelemetryEvent,
  sanitizeReplayRecordingEvent,
  sanitizeTelemetryUrl,
  sanitizeTelemetryValue,
  setFrontendTelemetryUser,
} from '../../src/lib/errorTelemetry.js';

const RELEASE = 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63';
const VALID_DSN = 'https://public_key@o4511822688813056.ingest.us.sentry.io/4511827129663488';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const credentialField = ['pass', 'word'].join('');
const authHeaderField = ['author', 'ization'].join('');
const accessField = ['access', '_', 'token'].join('');
const resetCredentialField = ['reset', 'Token'].join('');
const replacementCredentialField = ['new', 'Password'].join('');
const confirmationCredentialField = ['confirm', 'Password'].join('');
const resetQueryField = ['to', 'ken'].join('');

function runtime(overrides = {}) {
  return {
    PROD: true,
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_ENVIRONMENT: 'production',
    VITE_SENTRY_RELEASE: RELEASE,
    ...overrides,
  };
}

function fakeSentry() {
  const calls = [];
  const integration = (name) => (options) => ({ name, options });
  return {
    calls,
    reactRouterBrowserTracingIntegration: integration('BrowserTracing'),
    replayIntegration: integration('Replay'),
    browserProfilingIntegration: integration('BrowserProfiling'),
    httpClientIntegration: integration('HttpClient'),
    extraErrorDataIntegration: integration('ExtraErrorData'),
    contextLinesIntegration: integration('ContextLines'),
    reportingObserverIntegration: integration('ReportingObserver'),
    consoleLoggingIntegration: integration('ConsoleLogs'),
    captureConsoleIntegration: integration('CaptureConsole'),
    init: (options) => calls.push(['init', options]),
    captureException: (error) => calls.push(['capture', error]),
    setUser: (user) => calls.push(['user', user]),
    setTag: (name, value) => calls.push(['tag', name, value]),
    getCurrentScope: () => ({ removeTag: (name) => calls.push(['remove-tag', name]) }),
  };
}

test('telemetry remains exclusive to the authenticated application build', () => {
  const appEntry = fs.readFileSync(path.join(repoRoot, 'apps', 'app-ep', 'src', 'main.jsx'), 'utf8');
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');
  const landingEntry = fs.readFileSync(path.join(repoRoot, 'apps', 'landing', 'src', 'main.jsx'), 'utf8');

  assert.match(appEntry, /@\/lib\/errorTelemetry\.js/);
  assert.match(appEntry, /initialiseFrontendErrorTelemetry\(\)/);
  assert.equal((appSource.match(/<TelemetryRoutes>/g) || []).length, 2);
  assert.equal((appSource.match(/<\/TelemetryRoutes>/g) || []).length, 2);
  assert.match(appSource, /wrapReactRouterRouting\(Routes\)/);
  assert.doesNotMatch(landingEntry, /Sentry|errorTelemetry|TelemetryRoutes/);
});

test('broad event capture keeps requested PII and clinical context but removes credentials and bytes', () => {
  const event = {
    message: 'Jane Example opened a clinical assessment',
    user: { id: 'user-42', email: 'jane@example.test', username: 'Jane Example' },
    request: {
      url: `https://app.assesssuite.com/api/entities/Client?email=jane@example.test&${accessField}=dummy-value`,
      headers: {
        'content-type': 'application/json',
        [authHeaderField]: 'Bearer dummy-value',
      },
      data: {
        diagnosis: 'Clinical context remains visible',
        [credentialField]: 'dummy-value',
      },
    },
    extra: {
      clientName: 'Jane Example',
      bytes: new Uint8Array([1, 2, 3]),
    },
    breadcrumbs: [{ category: 'ui.click', message: 'Jane Example selected assessment' }],
  };

  const sanitized = sanitizeFrontendTelemetryEvent(event, {
    environment: 'production',
    release: RELEASE,
  });
  const serialized = JSON.stringify(sanitized);
  assert.match(serialized, /Jane Example/);
  assert.match(serialized, /jane@example\.test/);
  assert.match(serialized, /Clinical context remains visible/);
  assert.equal(sanitized.request.headers[authHeaderField], TELEMETRY_REDACTED);
  assert.equal(sanitized.request.data[credentialField], TELEMETRY_REDACTED);
  assert.equal(sanitized.extra.bytes, TELEMETRY_FILE_BYTES_OMITTED);
  assert.equal(sanitized.release, RELEASE);
  assert.equal(sanitized.environment, 'production');
  assert.equal(sanitized.tags.surface, 'assesssuite-app');
  assert.ok(!serialized.includes('dummy-value'));
});

test('URL and free-text scrubbers retain analytics context while removing credential-like values', () => {
  const url = sanitizeTelemetryUrl(
    `https://app.assesssuite.com/api/items?email=jane@example.test&${accessField}=dummy-value#section`,
  );
  assert.match(url, /email=jane%40example\.test/);
  assert.match(url, /%5BFiltered%5D/);
  assert.ok(!url.includes('dummy-value'));

  const scrubbed = sanitizeCredentialString('Jane Example: Bearer dummy-value');
  assert.match(scrubbed, /Jane Example/);
  assert.match(scrubbed, /\[Filtered\]/);
  assert.ok(!scrubbed.includes('dummy-value'));
});

test('beforeSend clears attachments while retaining a rich event', () => {
  const attachments = [{ filename: 'clinical.bin', data: new Uint8Array([4, 5, 6]) }];
  const beforeSend = createFrontendBeforeSend({ environment: 'production', release: RELEASE });
  const event = beforeSend({ message: 'Jane Example', extra: { diagnosis: 'Example' } }, { attachments });
  assert.equal(attachments.length, 0);
  assert.equal(event.message, 'Jane Example');
  assert.equal(event.extra.diagnosis, 'Example');
});

test('Replay captures unmasked DOM and JSON API detail while permanently excluding media and file routes', () => {
  const options = createFrontendReplayOptions();
  assert.equal(options.maskAllText, false);
  assert.equal(options.maskAllInputs, false);
  assert.equal(options.blockAllMedia, true);
  assert.equal(options.networkCaptureBodies, true);
  assert.equal(options.attachRawBodyFromRequest, true);
  assert.ok(options.mask.some((selector) => selector.includes('type="password"')));
  assert.ok(options.block.includes('input[type="file"]'));
  assert.ok(!options.networkRequestHeaders.includes(authHeaderField));
  assert.ok(!options.networkRequestHeaders.includes('cookie'));

  const jsonApiUrl = 'https://app.assesssuite.com/api/entities/Client';
  assert.ok(FRONTEND_REPLAY_NETWORK_ALLOW_URLS.some((matcher) => matcher.test(jsonApiUrl)));
  for (const excluded of [
    'https://app.assesssuite.com/api/integrations/Core/UploadFile',
    'https://app.assesssuite.com/api/functions/transcribeSession',
    'https://app.assesssuite.com/api/integrations/Core/ExtractDataFromUploadedFile',
    'https://app.assesssuite.com/uploads/example-id',
    'https://app.assesssuite.com/api/files/example-id',
    'https://app.assesssuite.com/api/download/example-id',
  ]) {
    assert.ok(FRONTEND_REPLAY_NETWORK_DENY_URLS.some((matcher) => matcher.test(excluded)), excluded);
  }
});

test('Replay network hook keeps normal PII bodies and strips secrets and file-transfer bodies', () => {
  const ordinary = sanitizeReplayRecordingEvent({
    type: 5,
    data: {
      tag: 'performanceSpan',
      payload: {
        op: 'resource.fetch',
        description: 'https://app.assesssuite.com/api/entities/Client',
        data: {
          request: {
            headers: { 'content-type': 'application/json' },
            body: { email: 'jane@example.test', diagnosis: 'Example', [credentialField]: 'dummy-value' },
          },
          response: { headers: { 'content-type': 'application/json' }, body: { ok: true } },
        },
      },
    },
  });
  assert.equal(ordinary.data.payload.data.request.body.email, 'jane@example.test');
  assert.equal(ordinary.data.payload.data.request.body.diagnosis, 'Example');
  assert.equal(ordinary.data.payload.data.request.body[credentialField], TELEMETRY_REDACTED);

  const transfer = sanitizeReplayRecordingEvent({
    type: 5,
    data: {
      tag: 'performanceSpan',
      payload: {
        op: 'resource.xhr',
        description: 'https://app.assesssuite.com/api/integrations/Core/UploadFile',
        data: {
          request: { headers: { 'content-type': 'multipart/form-data' }, body: 'binary-like-content' },
          response: { headers: { 'content-type': 'application/json' }, body: { file_url: '/uploads/id' } },
        },
      },
    },
  });
  assert.equal(transfer.data.payload.data.request.body, TELEMETRY_FILE_BYTES_OMITTED);
  assert.equal(transfer.data.payload.data.response.body, TELEMETRY_FILE_BYTES_OMITTED);
});

test('password-reset bearer and replacement credentials are removed from URL, object and raw Replay bodies', () => {
  const resetPage = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'ResetPassword.jsx'), 'utf8');
  assert.match(resetPage, /searchParams\.get\("token"\)/);
  assert.match(resetPage, /resetPassword\(\{ resetToken, newPassword \}\)/);

  const resetUrl = sanitizeTelemetryUrl(
    `https://app.assesssuite.com/reset-password?${resetQueryField}=live-reset-bearer&email=jane@example.test`,
  );
  assert.match(resetUrl, /email=jane%40example\.test/);
  assert.match(resetUrl, /%5BFiltered%5D/);
  assert.ok(!resetUrl.includes('live-reset-bearer'));

  const compoundQuery = sanitizeTelemetryUrl(
    'https://app.assesssuite.com/invite?inviteToken=live-invite-bearer&newPassword=temporary-value',
  );
  assert.ok(!compoundQuery.includes('live-invite-bearer'));
  assert.ok(!compoundQuery.includes('temporary-value'));
  assert.equal((compoundQuery.match(/%5BFiltered%5D/g) || []).length, 2);

  const objectBody = sanitizeTelemetryValue({
    [resetCredentialField]: 'live-reset-bearer',
    [replacementCredentialField]: 'Correct Horse Battery Staple',
    [confirmationCredentialField]: 'Correct Horse Battery Staple',
    inputTokens: 123,
  });
  assert.equal(objectBody[resetCredentialField], TELEMETRY_REDACTED);
  assert.equal(objectBody[replacementCredentialField], TELEMETRY_REDACTED);
  assert.equal(objectBody[confirmationCredentialField], TELEMETRY_REDACTED);
  assert.equal(objectBody.inputTokens, 123, 'non-credential usage counts must remain observable');

  const replay = sanitizeReplayRecordingEvent({
    type: 5,
    data: {
      tag: 'performanceSpan',
      payload: {
        op: 'resource.fetch',
        description: `https://app.assesssuite.com/api/auth/reset-password?${resetQueryField}=live-reset-bearer`,
        data: {
          request: {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              [resetCredentialField]: 'live-reset-bearer',
              [replacementCredentialField]: 'Correct Horse Battery Staple',
            }),
          },
          response: { headers: { 'content-type': 'application/json' }, body: { ok: true } },
        },
      },
    },
  });
  const serialized = JSON.stringify(replay);
  assert.ok(!serialized.includes('live-reset-bearer'));
  assert.ok(!serialized.includes('Correct Horse Battery Staple'));
  assert.match(serialized, /\[Filtered\]/);
});

test('Sentry options sample all supported products and keep credential collection disabled', () => {
  const sentry = fakeSentry();
  const additional = createFrontendIntegrations(sentry);
  const options = createFrontendSentryOptions(runtime(), additional, sentry);

  assert.equal(options.sendDefaultPii, true);
  assert.equal(options.dataCollection.userInfo, true);
  assert.equal(options.dataCollection.cookies, false);
  assert.deepEqual(options.dataCollection.httpBodies, [
    'incomingRequest', 'outgoingRequest', 'incomingResponse', 'outgoingResponse',
  ]);
  assert.equal(options.autoSessionTracking, true);
  assert.equal(options.sendClientReports, true);
  assert.equal(options.maxBreadcrumbs, 100);
  assert.equal(options.attachStacktrace, true);
  assert.equal(options.sampleRate, 1);
  assert.equal(options.tracesSampleRate, 1);
  assert.equal(options.profileSessionSampleRate, 1);
  assert.equal(options.profileLifecycle, 'trace');
  assert.equal(options.replaysSessionSampleRate, 1);
  assert.equal(options.replaysOnErrorSampleRate, 1);
  assert.equal(options.enableLogs, true);
  assert.equal(options.enableMetrics, true);
  assert.deepEqual(options.tracePropagationTargets, FRONTEND_TELEMETRY_ALLOWED_ORIGINS);

  const merged = options.integrations([{ name: 'Dedupe' }]);
  const names = merged.map((integration) => integration.name);
  for (const expected of [
    'Dedupe', 'BrowserTracing', 'Replay', 'BrowserProfiling', 'HttpClient',
    'ExtraErrorData', 'ContextLines', 'ReportingObserver', 'ConsoleLogs', 'CaptureConsole',
  ]) {
    assert.ok(names.includes(expected), expected);
  }
  assert.deepEqual(
    additional.find((integration) => integration.name === 'ConsoleLogs').options.levels,
    ['debug', 'info', 'warn', 'error', 'log', 'trace', 'assert'],
  );
});

test('production gating, error capture, and authenticated identity lifecycle are deterministic', () => {
  const sentry = fakeSentry();
  assert.equal(initialiseFrontendErrorTelemetry(runtime({ PROD: false }), sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry(runtime({ VITE_SENTRY_ENVIRONMENT: 'staging' }), sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry(runtime({ VITE_SENTRY_RELEASE: RELEASE.slice(1) }), sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry(runtime({
    VITE_SENTRY_DSN: 'https://public_key@o4511822688813056.ingest.us.sentry.io/999999',
  }), sentry), false);
  assert.equal(sentry.calls.length, 0);

  assert.equal(initialiseFrontendErrorTelemetry(runtime(), sentry), true);
  assert.equal(sentry.calls[0][0], 'init');

  assert.equal(setFrontendTelemetryUser({
    id: 'user-42',
    email: 'jane@example.test',
    full_name: 'Jane Example',
    role: 'admin',
  }, sentry), true);
  assert.deepEqual(sentry.calls.find((call) => call[0] === 'user')[1], {
    id: 'user-42', email: 'jane@example.test', username: 'Jane Example', role: 'admin',
  });
  assert.deepEqual(sentry.calls.find((call) => call[0] === 'tag'), ['tag', 'user.role', 'admin']);

  const error = new TypeError('Jane Example opened a client');
  captureFrontendException(error, sentry);
  assert.strictEqual(sentry.calls.find((call) => call[0] === 'capture')[1], error);
  assert.equal(captureFrontendException('not-an-error', sentry), undefined);

  assert.equal(clearFrontendTelemetryUser(sentry), true);
  assert.deepEqual(sentry.calls.at(-2), ['user', null]);
  assert.deepEqual(sentry.calls.at(-1), ['remove-tag', 'user.role']);
});

test('browser telemetry binds the Physio bundle to physio-production', () => {
  const sentry = fakeSentry();
  assert.equal(initialiseFrontendErrorTelemetry(runtime({
    VITE_PROFESSION: 'physio',
    VITE_SENTRY_ENVIRONMENT: 'physio-production',
    VITE_SENTRY_RELEASE: `physio-production@${RELEASE}`,
  }), sentry), true);
  assert.equal(sentry.calls[0][1].environment, 'physio-production');
  assert.equal(sentry.calls[0][1].release, `physio-production@${RELEASE}`);
  assert.deepEqual(
    sentry.calls[0][1].tracePropagationTargets,
    PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS,
  );
  const replay = sentry.calls[0][1].integrations([])
    .find((integration) => integration.name === 'Replay');
  assert.deepEqual(replay.options.networkDetailAllowUrls, PHYSIO_FRONTEND_REPLAY_NETWORK_ALLOW_URLS);
  for (const origin of [
    'https://physio.app.assesssuite.com',
    'https://assesssuite-physio-production.fly.dev',
  ]) {
    const absolute = `${origin}/api/apps/local-assesssuite-physio/entities/Client`;
    const relative = new URL('/api/apps/local-assesssuite-physio/entities/Client', origin).href;
    assert.ok(PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS.some((matcher) => matcher.test(absolute)));
    assert.ok(PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS.some((matcher) => matcher.test(relative)));
    assert.ok(PHYSIO_FRONTEND_REPLAY_NETWORK_ALLOW_URLS.some((matcher) => matcher.test(absolute)));
  }
  assert.equal(
    PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS
      .some((matcher) => matcher.test('https://app.assesssuite.com/api/apps/local-assesssuite/entities/Client')),
    false,
  );

  assert.equal(initialiseFrontendErrorTelemetry(runtime({
    VITE_PROFESSION: 'physio',
    VITE_SENTRY_ENVIRONMENT: 'physio-production',
    VITE_SENTRY_RELEASE: RELEASE,
  }), fakeSentry()), false);

  assert.equal(initialiseFrontendErrorTelemetry(runtime({
    VITE_PROFESSION: 'physio',
    VITE_SENTRY_ENVIRONMENT: 'production',
  }), fakeSentry()), false);
  assert.equal(initialiseFrontendErrorTelemetry(runtime({
    VITE_PROFESSION: 'exercise-physiology',
    VITE_SENTRY_ENVIRONMENT: 'physio-production',
    VITE_SENTRY_RELEASE: `physio-production@${RELEASE}`,
  }), fakeSentry()), false);
});

test('AuthContext binds and clears Sentry identity without exposing the application bearer value', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'AuthContext.jsx'), 'utf8');
  assert.match(source, /setFrontendTelemetryUser\(currentUser\)/);
  assert.ok((source.match(/clearFrontendTelemetryUser\(\)/g) || []).length >= 3);
  assert.doesNotMatch(source, /setFrontendTelemetryUser\([^)]*appParams\.token/);
});

test('generic value sanitizer tolerates cycles and preserves useful PII', () => {
  const value = { email: 'jane@example.test' };
  value.self = value;
  const sanitized = sanitizeTelemetryValue(value);
  assert.equal(sanitized.email, 'jane@example.test');
  assert.equal(sanitized.self, '[Circular]');
});
