import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/react';

import {
  FRONTEND_TELEMETRY_ALLOWED_ORIGINS,
  SAFE_EXCEPTION_VALUE,
  captureFrontendException,
  createFrontendBeforeSend,
  createFrontendSentryOptions,
  initialiseFrontendErrorTelemetry,
  sanitizeDebugMeta,
  sanitizeFrameLocation,
  sanitizeFrontendErrorEvent,
} from '../../src/lib/errorTelemetry.js';

const RELEASE = 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63';
const VALID_DSN = 'https://public_key@o4511822688813056.ingest.us.sentry.io/4511827129663488';
const SAFE_DEBUG_ID = '12345678-1234-1234-1234-123456789abc';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function hostileExceptionEvent() {
  return {
    event_id: 'ABCDEF0123456789ABCDEF0123456789',
    timestamp: 1_786_000_000.125,
    message: 'Patient jane@example.com body=secret token=Bearer-abc',
    transaction: '/patients/4321987654321?email=jane@example.com',
    level: 'warning',
    logger: 'console',
    culprit: 'jane@example.com',
    user: { id: '4321987654321', email: 'jane@example.com', ip_address: '203.0.113.4' },
    request: {
      url: 'https://app.assesssuite.com/patient?email=jane@example.com#secret',
      data: 'clinical body',
      headers: { authorization: 'Bearer secret' },
      cookies: 'session=secret',
    },
    contexts: {
      patient: { name: 'Jane Example', diagnosis: 'private' },
      trace: { trace_id: 'untrusted' },
    },
    extra: { clinicalNote: 'private body' },
    breadcrumbs: [{ category: 'console', message: 'jane@example.com opened a patient' }],
    tags: { patient: 'Jane Example', surface: 'attacker-controlled' },
    fingerprint: ['patient-jane@example.com'],
    exception: {
      values: [{
        type: 'TypeError jane@example.com',
        value: 'Clinical note for Jane Example: secret body',
        mechanism: { data: { handler: 'patient-4321987654321' } },
        stacktrace: {
          frames: [
            {
              filename: 'https://evil.example/steal.js?patient=jane@example.com#secret',
              abs_path: 'C:\\Users\\Jane\\patient-secret.jsx',
              function: 'steal jane@example.com',
              lineno: 12,
              colno: 4,
              vars: { patient: 'Jane Example' },
              context_line: 'const patient = "Jane Example";',
              pre_context: ['clinical body'],
              post_context: ['token=secret'],
            },
            {
              filename: 'https://app.assesssuite.com/assets/index-DYkT-4PM.js?patient=jane@example.com#token',
              abs_path: 'https://app.assesssuite.com/assets/index-DYkT-4PM.js?auth=secret',
              function: 'render jane@example.com',
              lineno: 431,
              colno: 19,
              vars: { note: 'clinical body' },
              context_line: 'Bearer secret',
              module: 'patient/JaneExample',
            },
          ],
        },
      }],
    },
    debug_meta: {
      images: [
        {
          type: 'sourcemap',
          code_file: 'https://app.assesssuite.com/assets/index-DYkT-4PM.js?patient=jane@example.com#token',
          debug_id: SAFE_DEBUG_ID.toUpperCase(),
          code_id: 'patient-jane@example.com',
        },
        {
          type: 'sourcemap',
          code_file: 'https://evil.example/steal.js?secret=clinical-body',
          debug_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
      ],
      patient: 'Jane Example',
    },
  };
}

test('frontend event sanitizer drops non-exception events', () => {
  assert.equal(sanitizeFrontendErrorEvent({ message: 'jane@example.com' }), null);
  assert.equal(createFrontendBeforeSend({ release: RELEASE })({ breadcrumbs: [] }), null);

  const hostileGetter = {};
  Object.defineProperty(hostileGetter, 'exception', {
    get() {
      throw new Error('private body');
    },
  });
  assert.equal(createFrontendBeforeSend({ release: RELEASE })(hostileGetter), null);
});

test('telemetry is wired only into the authenticated application entry', () => {
  const appEntry = fs.readFileSync(path.join(repoRoot, 'apps', 'app-ep', 'src', 'main.jsx'), 'utf8');
  const landingEntry = fs.readFileSync(path.join(repoRoot, 'apps', 'landing', 'src', 'main.jsx'), 'utf8');
  assert.match(appEntry, /@\/lib\/errorTelemetry\.js/);
  assert.match(appEntry, /initialiseFrontendErrorTelemetry\(\)/);
  assert.doesNotMatch(landingEntry, /Sentry|errorTelemetry|beforeSend/);
});

test('hostile exception input is reduced to the strict error allowlist', () => {
  const sanitized = sanitizeFrontendErrorEvent(hostileExceptionEvent(), {
    environment: 'production',
    release: RELEASE,
  });

  assert.deepEqual(Object.keys(sanitized).sort(), [
    'debug_meta',
    'environment',
    'event_id',
    'exception',
    'level',
    'platform',
    'release',
    'tags',
    'timestamp',
  ]);
  assert.equal(sanitized.level, 'error');
  assert.equal(sanitized.platform, 'javascript');
  assert.equal(sanitized.exception.values.length, 1);
  assert.equal(sanitized.exception.values[0].type, 'Error');
  assert.equal(sanitized.exception.values[0].value, SAFE_EXCEPTION_VALUE);
  assert.deepEqual(sanitized.tags, {
    surface: 'assesssuite-app',
    environment: 'production',
    release: RELEASE,
  });

  const serialized = JSON.stringify(sanitized);
  for (const forbidden of [
    'jane@example.com',
    'Jane Example',
    '4321987654321',
    'clinical body',
    'Bearer secret',
    'patient=',
    'auth=',
    '#token',
    'evil.example',
    '203.0.113.4',
  ]) {
    assert.ok(!serialized.includes(forbidden), `sanitized event leaked ${forbidden}`);
  }

  assert.deepEqual(sanitized.exception.values[0].stacktrace.frames, [{
    function: 'anonymous',
    in_app: true,
    filename: 'https://app.assesssuite.com/assets/index-DYkT-4PM.js',
    abs_path: 'https://app.assesssuite.com/assets/index-DYkT-4PM.js',
    lineno: 431,
    colno: 19,
  }]);
  assert.deepEqual(sanitized.debug_meta, {
    images: [{
      type: 'sourcemap',
      code_file: 'https://app.assesssuite.com/assets/index-DYkT-4PM.js',
      debug_id: SAFE_DEBUG_ID,
    }],
  });
});

test('location and debug metadata sanitizer retain only production assets', () => {
  assert.deepEqual(FRONTEND_TELEMETRY_ALLOWED_ORIGINS, ['https://app.assesssuite.com']);
  assert.equal(
    sanitizeFrameLocation('https://app.assesssuite.com/assets/chunk.js?token=secret#x'),
    'https://app.assesssuite.com/assets/chunk.js',
  );
  assert.equal(sanitizeFrameLocation('/assets/chunk.js?token=secret'), '/assets/chunk.js');
  assert.equal(sanitizeFrameLocation('https://example.com/assets/chunk.js'), undefined);
  assert.equal(sanitizeFrameLocation('C:\\Users\\Jane\\chunk.js'), undefined);
  assert.equal(sanitizeDebugMeta({ patient: 'Jane Example' }), undefined);
});

test('Sentry options disable non-error telemetry and rebuild events from trusted statics', () => {
  const integrations = [{ name: 'safe-global-errors' }];
  const options = createFrontendSentryOptions({
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_ENVIRONMENT: 'production',
    VITE_SENTRY_RELEASE: RELEASE,
  }, integrations);

  assert.equal(options.defaultIntegrations, false);
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.autoSessionTracking, false);
  assert.equal(options.sendClientReports, false);
  assert.equal(options.maxBreadcrumbs, 0);
  assert.equal(options.tracesSampleRate, 0);
  assert.equal(options.profilesSampleRate, 0);
  assert.equal(options.replaysSessionSampleRate, 0);
  assert.equal(options.replaysOnErrorSampleRate, 0);
  assert.equal(options.enableLogs, false);
  assert.equal(options.beforeBreadcrumb({ message: 'jane@example.com' }), null);
  assert.strictEqual(options.integrations, integrations);

  const event = hostileExceptionEvent();
  event.release = 'attacker-release-jane@example.com';
  event.environment = 'patient-Jane-Example';
  const sanitized = options.beforeSend(event);
  assert.equal(sanitized.release, RELEASE);
  assert.equal(sanitized.environment, 'production');
});

test('initialisation is production-and-DSN gated and capture is Error-only', () => {
  const calls = [];
  const sentry = {
    globalHandlersIntegration: (options) => ({ name: 'GlobalHandlers', options }),
    dedupeIntegration: () => ({ name: 'Dedupe' }),
    makeFetchTransport: () => ({ send: () => Promise.resolve({ statusCode: 200 }), flush: () => Promise.resolve(true) }),
    init: (options) => calls.push(['init', options]),
    captureException: (error) => calls.push(['capture', error]),
  };

  assert.equal(initialiseFrontendErrorTelemetry({ PROD: false, VITE_SENTRY_DSN: 'dsn' }, sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry({ PROD: true }, sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry({
    PROD: true,
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_RELEASE: RELEASE.slice(0, 39),
    VITE_SENTRY_ENVIRONMENT: 'production',
  }, sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry({
    PROD: true,
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_RELEASE: RELEASE,
    VITE_SENTRY_ENVIRONMENT: 'staging',
  }, sentry), false);
  assert.equal(initialiseFrontendErrorTelemetry({
    PROD: true,
    VITE_SENTRY_DSN: 'https://public_key@o4511822688813056.ingest.us.sentry.io/999999',
    VITE_SENTRY_RELEASE: RELEASE,
    VITE_SENTRY_ENVIRONMENT: 'production',
  }, sentry), false);
  assert.equal(calls.length, 0);

  assert.equal(initialiseFrontendErrorTelemetry({
    PROD: true,
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_RELEASE: RELEASE,
    VITE_SENTRY_ENVIRONMENT: 'production',
  }, {
    globalHandlersIntegration: () => {
      throw new Error('telemetry integration failed');
    },
  }), false);

  assert.equal(initialiseFrontendErrorTelemetry({
    PROD: true,
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_RELEASE: RELEASE,
    VITE_SENTRY_ENVIRONMENT: 'production',
  }, sentry), true);
  assert.equal(calls[0][0], 'init');
  assert.deepEqual(calls[0][1].integrations.map((integration) => integration.name), [
    'GlobalHandlers',
    'Dedupe',
  ]);

  assert.equal(captureFrontendException('not an Error', sentry), undefined);
  const error = new TypeError('private body');
  captureFrontendException(error, sentry);
  assert.strictEqual(calls.at(-1)[1], error);
});

test('real Sentry SDK transport emits only the strict envelope and event allowlists', async () => {
  const envelopes = [];
  const captureTransport = () => ({
    send: (envelope) => {
      envelopes.push(envelope);
      return Promise.resolve({ statusCode: 200 });
    },
    flush: () => Promise.resolve(true),
  });
  const options = createFrontendSentryOptions({
    VITE_SENTRY_DSN: VALID_DSN,
    VITE_SENTRY_ENVIRONMENT: 'production',
    VITE_SENTRY_RELEASE: RELEASE,
  }, [], { makeFetchTransport: captureTransport });
  Sentry.init(options);

  const error = new TypeError('Patient jane@example.com token=secret clinical body');
  error.patient = { name: 'Jane Example', medicare: '4321987654321' };
  Sentry.captureException(error);
  await Sentry.flush(1_000);

  assert.equal(envelopes.length, 1);
  const [header, items] = envelopes[0];
  assert.deepEqual(Object.keys(header), ['event_id']);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0][0], { type: 'event' });
  const event = items[0][1];
  assert.deepEqual(Object.keys(event).sort(), [
    'environment', 'event_id', 'exception', 'level', 'platform', 'release', 'tags', 'timestamp',
  ]);
  const serialized = JSON.stringify(envelopes[0]);
  for (const forbidden of ['sdk', 'sent_at', 'jane@example.com', 'Jane Example', '4321987654321', 'clinical body', 'secret']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
