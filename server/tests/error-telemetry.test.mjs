import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  buildSentryOptions,
  browserProfilingDocumentPolicyHeaders,
  classifyRouteFamily,
  createErrorTelemetry,
  redactUrl,
  ROUTE_FAMILIES,
  sanitizeTelemetryEvent,
  sanitizeTelemetryValue,
  shouldExcludeIncomingRequestBody,
} from '../telemetry.mjs';
import { sentryReleaseForProfession } from '../../packages/profession-config/sentry-release.mjs';

const VALID_DSN = 'https://public_key@o4511822688813056.ingest.us.sentry.io/4511827129663488';
const RELEASE = 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63';
const CREDENTIAL_KEYS = Object.freeze({
  pass: ['pass', 'word'].join(''),
  api: ['api', 'Key'].join(''),
  client: ['client', 'Secret'].join(''),
  access: ['access', 'Token'].join(''),
});

class FakeResponse extends EventEmitter {
  constructor(statusCode = 200) {
    super();
    this.statusCode = statusCode;
  }
}

function validEnvironment(overrides = {}) {
  return {
    SENTRY_DSN: VALID_DSN,
    RELEASE_SHA: RELEASE,
    NODE_ENV: 'production',
    ...overrides,
  };
}

function integrationFactory(name, calls) {
  return (options) => {
    const integration = { name, options };
    calls.integrations.push(integration);
    return integration;
  };
}

function fakeScope() {
  const values = {
    contexts: {},
    fingerprint: null,
    tags: {},
    user: null,
  };
  return {
    values,
    setContext: (key, value) => { values.contexts[key] = value; },
    setFingerprint: (value) => { values.fingerprint = value; },
    setTag: (key, value) => { values.tags[key] = value; },
    setUser: (value) => { values.user = value; },
  };
}

function fakeSdk({ initThrows = false } = {}) {
  const scopeStorage = new AsyncLocalStorage();
  const calls = {
    activeSpanAttributes: {},
    breadcrumbs: [],
    exceptions: [],
    flushes: [],
    init: [],
    integrations: [],
    messages: [],
    isolationScopes: [],
    scopes: [],
  };
  const isolationScope = fakeScope();
  const sdk = {
    calls,
    init(options) {
      calls.init.push(options);
      if (initThrows) throw new Error('synthetic Sentry initialization failure');
    },
    isEnabled: () => !initThrows,
    addBreadcrumb: (value) => calls.breadcrumbs.push(value),
    captureException: (value) => calls.exceptions.push(value),
    captureMessage: (message, level) => calls.messages.push({ message, level }),
    flush: async (timeout) => {
      calls.flushes.push(timeout);
      return true;
    },
    getActiveSpan: () => ({
      setAttribute: (key, value) => { calls.activeSpanAttributes[key] = value; },
    }),
    getIsolationScope: () => scopeStorage.getStore() || isolationScope,
    withIsolationScope: (callback) => {
      const scope = fakeScope();
      calls.isolationScopes.push(scope);
      return scopeStorage.run(scope, () => callback(scope));
    },
    withScope: (callback) => {
      const scope = fakeScope();
      calls.scopes.push(scope);
      return callback(scope);
    },
  };
  for (const [property, name] of Object.entries({
    consoleLoggingIntegration: 'ConsoleLogs',
    contextLinesIntegration: 'ContextLines',
    extraErrorDataIntegration: 'ExtraErrorData',
    fsIntegration: 'FileSystem',
    httpIntegration: 'Http',
    localVariablesIntegration: 'LocalVariables',
    nodeContextIntegration: 'NodeContext',
    nodeRuntimeMetricsIntegration: 'NodeRuntimeMetrics',
    processSessionIntegration: 'ProcessSession',
    requestDataIntegration: 'RequestData',
  })) sdk[property] = integrationFactory(name, calls);
  return sdk;
}

test('finite route classification remains stable while full URL context is captured separately', () => {
  const cases = [
    ['/api/apps/app/entities/Client/client-123?email=patient@example.com', 'entities'],
    ['/api/apps/app/functions/transcribeSession?file=record.pdf', 'functions'],
    ['/functions/createCheckoutSession?org=private-org', 'functions'],
    ['/api/apps/app/integration-endpoints/Core/InvokeLLM?prompt=private', 'integrations'],
    ['/uploads/private-file-name.pdf?access_token=secret', 'files'],
    ['/api/apps/app/auth/login?email=patient@example.com', 'auth'],
    ['/some/patient@example.com', 'unknown'],
    ['not a valid target', 'unknown'],
  ];
  for (const [target, expected] of cases) {
    const family = classifyRouteFamily(target);
    assert.equal(family, expected);
    assert.ok(ROUTE_FAMILIES.includes(family));
  }
  assert.equal(
    redactUrl('/api/apps/app/auth/login?email=patient@example.com&access_token=private-token'),
    '/api/apps/app/auth/login?email=patient%40example.com&access_token=[Filtered]',
  );
});

test('production SDK configuration enables complete error, trace, profile, log, metric, request and session capture', () => {
  const sdk = fakeSdk();
  const profiling = integrationFactory('ProfilingIntegration', sdk.calls);
  const telemetry = createErrorTelemetry({
    environment: validEnvironment(),
    sdk,
    profilingIntegrationFactory: profiling,
  });

  assert.equal(telemetry.enabled, true);
  assert.equal(sdk.calls.init.length, 1);
  const options = sdk.calls.init[0];
  assert.equal(options.dsn, VALID_DSN);
  assert.equal(options.release, RELEASE);
  assert.equal(options.environment, 'production');
  assert.equal(options.sampleRate, 1);
  assert.equal(options.tracesSampleRate, 1);
  assert.equal(options.profileSessionSampleRate, 1);
  assert.equal(options.profileLifecycle, 'trace');
  assert.equal(options.sendDefaultPii, true);
  assert.equal(options.includeLocalVariables, true);
  assert.equal(options.attachStacktrace, true);
  assert.equal(options.enableLogs, true);
  assert.equal(options.enableMetrics, true);
  assert.equal(options.dataCollection.userInfo, true);
  assert.equal(options.dataCollection.cookies, false);
  assert.deepEqual(options.dataCollection.httpBodies, ['incomingRequest', 'outgoingResponse']);
  assert.deepEqual(
    new Set(options.integrations.map(({ name }) => name)),
    new Set([
      'Http',
      'RequestData',
      'NodeContext',
      'ContextLines',
      'LocalVariables',
      'ExtraErrorData',
      'ProcessSession',
      'NodeRuntimeMetrics',
      'ConsoleLogs',
      'FileSystem',
      'ProfilingIntegration',
    ]),
  );

  const http = options.integrations.find(({ name }) => name === 'Http').options;
  assert.equal(http.breadcrumbs, true);
  assert.equal(http.spans, true);
  assert.equal(http.trackIncomingRequestsAsSessions, true);
  assert.equal(http.sessionFlushingDelayMS, 60_000);
  assert.equal(http.maxIncomingRequestBodySize, 'always');
  assert.deepEqual(http.dropSpansForIncomingRequestStatusCodes, []);
  assert.equal(http.ignoreStaticAssets, false);
  assert.equal(
    http.ignoreIncomingRequestBody('/api/apps/app/entities/Client', {
      headers: { 'content-type': 'application/json' },
    }),
    false,
  );
  assert.equal(
    http.ignoreIncomingRequestBody('/api/apps/app/functions/transcribeSession', {
      headers: { 'content-type': 'application/json' },
    }),
    true,
  );

  const metrics = options.integrations.find(({ name }) => name === 'NodeRuntimeMetrics').options;
  assert.equal(Object.values(metrics.collect).every(Boolean), true);
});

test('PII and useful clinical context remain while credentials and payment data are deeply redacted', () => {
  const original = {
    request: {
      method: 'POST',
      url: 'https://app.assesssuite.com/api/apps/app/entities/Client/client-123?email=jane@example.com&access_token=url-secret',
      query_string: 'email=jane%40example.com&api_key=query-secret',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Synthetic Browser',
        'x-forwarded-for': '203.0.113.42',
        authorization: 'Bearer private-session-token',
        cookie: 'session=private-cookie',
        'x-api-key': 'provider-key',
        'stripe-signature': 'payment-signature',
      },
      cookies: { session: 'private-cookie' },
      data: {
        patient_name: 'Jane Example',
        email: 'jane@example.com',
        diagnosis: 'Knee osteoarthritis',
        clinical_note: 'Pain increased after stairs.',
        clinician_signature: 'Dr Example, treating clinician',
        [CREDENTIAL_KEYS.pass]: 'fixture-redaction-a',
        otpCode: '123456',
        [CREDENTIAL_KEYS.api]: 'fixture-redaction-b',
        paymentMethod: 'pm_private',
        cardNumber: '4242 4242 4242 4242',
        nested: { [CREDENTIAL_KEYS.client]: 'fixture-redaction-c', safe_value: 'retained' },
      },
    },
    user: {
      id: 'user-123',
      email: 'clinician@example.com',
      username: 'Dr Example',
      ip_address: '203.0.113.42',
      role: 'clinician',
    },
    extra: {
      safe: 'observable',
      authorization: 'Bearer another-secret',
      diagnostic: 'password=inline-secret',
    },
  };

  const clean = sanitizeTelemetryEvent(original);
  assert.equal(clean.request.data.patient_name, 'Jane Example');
  assert.equal(clean.request.data.email, 'jane@example.com');
  assert.equal(clean.request.data.diagnosis, 'Knee osteoarthritis');
  assert.equal(clean.request.data.clinical_note, 'Pain increased after stairs.');
  assert.equal(clean.request.data.clinician_signature, 'Dr Example, treating clinician');
  assert.equal(clean.request.data.nested.safe_value, 'retained');
  assert.equal(clean.user.email, 'clinician@example.com');
  assert.equal(clean.user.ip_address, '203.0.113.42');
  assert.equal(clean.request.headers['user-agent'], 'Synthetic Browser');
  assert.equal(clean.request.headers.authorization, '[Filtered]');
  assert.equal(clean.request.headers.cookie, '[Filtered]');
  assert.equal(clean.request.headers['x-api-key'], '[Filtered]');
  assert.equal(clean.request.headers['stripe-signature'], '[Filtered]');
  assert.equal(clean.request.cookies, '[Filtered]');
  assert.equal(clean.request.data[CREDENTIAL_KEYS.pass], '[Filtered]');
  assert.equal(clean.request.data.otpCode, '[Filtered]');
  assert.equal(clean.request.data[CREDENTIAL_KEYS.api], '[Filtered]');
  assert.equal(clean.request.data.paymentMethod, '[Filtered]');
  assert.equal(clean.request.data.cardNumber, '[Filtered]');
  assert.equal(clean.request.data.nested[CREDENTIAL_KEYS.client], '[Filtered]');
  assert.equal(clean.extra.authorization, '[Filtered]');
  assert.equal(clean.extra.diagnostic, 'password=[Filtered]');
  assert.match(clean.request.url, /email=jane%40example\.com/);
  assert.doesNotMatch(clean.request.url, /url-secret/);
  assert.match(clean.request.query_string, /email=jane%40example\.com/);
  assert.doesNotMatch(clean.request.query_string, /query-secret/);

  const serialized = JSON.stringify(clean);
  for (const secret of [
    'private-session-token',
    'private-cookie',
    'provider-key',
    'payment-signature',
    'fixture-redaction-a',
    '123456',
    'fixture-redaction-b',
    'pm_private',
    '4242 4242 4242 4242',
    'fixture-redaction-c',
    'another-secret',
    'inline-secret',
    'url-secret',
    'query-secret',
  ]) assert.equal(serialized.includes(secret), false, secret);
});

test('multipart, audio, file and transcription request bodies are omitted while ordinary JSON is eligible', () => {
  assert.equal(shouldExcludeIncomingRequestBody('/api/apps/app/integration-endpoints/Core/UploadFile', {
    headers: { 'content-type': 'multipart/form-data; boundary=private' },
  }), true);
  assert.equal(shouldExcludeIncomingRequestBody('/api/apps/app/functions/transcribeSession', {
    headers: { 'content-type': 'application/json' },
  }), true);
  assert.equal(shouldExcludeIncomingRequestBody('/api/apps/app/entities/Client', {
    headers: { 'content-type': 'audio/webm' },
  }), true);
  assert.equal(shouldExcludeIncomingRequestBody('/api/apps/app/entities/Client', {
    headers: { 'content-type': 'application/json' },
  }), false);

  const clean = sanitizeTelemetryEvent({
    request: {
      url: '/api/apps/app/integration-endpoints/Core/UploadFile',
      headers: { 'content-type': 'multipart/form-data; boundary=private' },
      data: 'raw-clinical-file-bytes',
    },
  });
  assert.equal(clean.request.data, '[Filtered: raw upload or binary request body]');
  assert.equal(sanitizeTelemetryValue(Buffer.from('raw-clinical-file-bytes')), '[Filtered: binary or uploaded file content]');
  assert.equal(JSON.stringify(clean).includes('raw-clinical-file-bytes'), false);
});

test('each 5xx is captured with authenticated identity and no coalescing; handled exceptions do not duplicate', async () => {
  const sdk = fakeSdk();
  const telemetry = createErrorTelemetry({
    environment: validEnvironment(),
    sdk,
    profilingIntegrationFactory: integrationFactory('ProfilingIntegration', sdk.calls),
  });
  const request = {
    method: 'POST',
    url: '/api/apps/app/entities/Client/client-123?email=jane@example.com',
    headers: {
      authorization: 'Bearer private-session-token',
      'content-type': 'application/json',
      'fly-client-ip': '203.0.113.42',
      'fly-request-id': 'request-123',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const identity = {
    user: {
      id: 'user-123',
      email: 'clinician@example.com',
      full_name: 'Dr Example',
      role: 'clinician',
      account_status: 'active',
    },
    orgIds: ['org-a', 'org-b'],
  };

  const firstResponse = new FakeResponse(500);
  assert.equal(telemetry.observe(request, firstResponse, identity), true);
  firstResponse.emit('finish');

  const secondRequest = { ...request, url: '/api/version' };
  const secondResponse = new FakeResponse(503);
  telemetry.observe(secondRequest, secondResponse, identity);
  secondResponse.emit('finish');
  assert.equal(sdk.calls.messages.length, 2);
  assert.equal(sdk.calls.scopes[0].values.user.email, 'clinician@example.com');
  assert.equal(sdk.calls.scopes[0].values.contexts.assesssuite_identity.full_name, 'Dr Example');
  assert.deepEqual(sdk.calls.scopes[0].values.contexts.assesssuite_identity.org_ids, ['org-a', 'org-b']);
  assert.equal(sdk.calls.scopes[0].values.contexts.assesssuite_request.headers.authorization, '[Filtered]');

  const handledRequest = { ...request, url: '/api/apps/app/functions/generateExerciseProgram' };
  const handledResponse = new FakeResponse(500);
  telemetry.observe(handledRequest, handledResponse, identity);
  const syntheticError = Object.assign(new Error('provider failed'), {
    [CREDENTIAL_KEYS.api]: 'fixture-redaction-d',
  });
  assert.equal(telemetry.captureException(syntheticError, handledRequest, { statusCode: 500 }), true);
  handledResponse.emit('finish');
  assert.equal(sdk.calls.exceptions.length, 1);
  assert.equal(sdk.calls.messages.length, 2);
  assert.equal(await telemetry.flush(250), true);
  assert.deepEqual(sdk.calls.flushes, [250]);
});

test('bounded JSON response content is captured and sanitized while binary and oversized bodies are omitted', () => {
  const sdk = fakeSdk();
  const telemetry = createErrorTelemetry({
    environment: validEnvironment(),
    sdk,
    profilingIntegrationFactory: integrationFactory('ProfilingIntegration', sdk.calls),
  });

  const safeValues = telemetry.runIsolated(() => {
    const req = {
      method: 'POST',
      url: '/api/apps/app/entities/Assessment',
      headers: { 'content-type': 'application/json' },
    };
    const res = new FakeResponse(200);
    telemetry.observe(req, res, {
      user: { id: 'user-response', email: 'clinician@example.com' },
      orgIds: ['org-response'],
    });
    assert.equal(telemetry.observeResponse(res, {
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: {
        assessment_name: 'Functional assessment',
        clinician_signature: 'Dr Example',
        [CREDENTIAL_KEYS.api]: 'fixture-redaction-response',
      },
    }), true);
    return sdk.getIsolationScope().values;
  });

  assert.equal(safeValues.contexts.assesssuite_response.body.assessment_name, 'Functional assessment');
  assert.equal(safeValues.contexts.assesssuite_response.body.clinician_signature, 'Dr Example');
  assert.equal(safeValues.contexts.assesssuite_response.body[CREDENTIAL_KEYS.api], '[Filtered]');
  assert.match(sdk.calls.activeSpanAttributes['assesssuite.response.body'], /Functional assessment/);
  assert.doesNotMatch(sdk.calls.activeSpanAttributes['assesssuite.response.body'], /fixture-redaction-response/);

  for (const candidate of [
    { contentType: 'application/pdf', body: 'raw-clinical-document' },
    { contentType: 'application/json', body: { note: 'x'.repeat(70 * 1024) } },
  ]) {
    const req = { method: 'GET', url: '/api/files/file-id', headers: {} };
    const res = new FakeResponse(200);
    telemetry.observe(req, res);
    telemetry.observeResponse(res, { status: 200, ...candidate });
  }
  const serializedBreadcrumbs = JSON.stringify(sdk.calls.breadcrumbs);
  assert.doesNotMatch(serializedBreadcrumbs, /raw-clinical-document/);
  assert.doesNotMatch(serializedBreadcrumbs, /x{100}/);
});

test('explicit isolation keeps concurrent authenticated identities and organisations separate', async () => {
  const sdk = fakeSdk();
  const telemetry = createErrorTelemetry({
    environment: validEnvironment(),
    sdk,
    profilingIntegrationFactory: integrationFactory('ProfilingIntegration', sdk.calls),
  });

  const observeIdentity = (suffix, delay) => telemetry.runIsolated(async () => {
    const res = new FakeResponse(200);
    telemetry.observe({
      method: 'GET',
      url: `/api/apps/app/entities/Client/client-${suffix}`,
      headers: {},
    }, res, {
      user: { id: `user-${suffix}`, email: `${suffix}@example.com` },
      orgIds: [`org-${suffix}`],
    });
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sdk.getIsolationScope().values;
  });

  const [first, second] = await Promise.all([
    observeIdentity('first', 10),
    observeIdentity('second', 0),
  ]);
  assert.equal(first.user.id, 'user-first');
  assert.deepEqual(first.contexts.assesssuite_identity.org_ids, ['org-first']);
  assert.equal(second.user.id, 'user-second');
  assert.deepEqual(second.contexts.assesssuite_identity.org_ids, ['org-second']);
});

test('invalid configuration and SDK failures remain application-open with zero telemetry activity', () => {
  for (const environment of [
    {},
    validEnvironment({ SENTRY_DSN: 'https://key@example.invalid/1' }),
    validEnvironment({ RELEASE_SHA: 'not-a-release' }),
    validEnvironment({ NODE_ENV: 'test' }),
    validEnvironment({ SENTRY_ENVIRONMENT: 'staging' }),
    validEnvironment({ SENTRY_RELEASE: '1111111111111111111111111111111111111111' }),
  ]) {
    const sdk = fakeSdk();
    const telemetry = createErrorTelemetry({ environment, sdk });
    assert.equal(telemetry.enabled, false);
    assert.equal(sdk.calls.init.length, 0);
    assert.equal(telemetry.observe({}, new FakeResponse(500)), false);
  }

  const failedSdk = fakeSdk({ initThrows: true });
  let telemetry;
  assert.doesNotThrow(() => {
    telemetry = createErrorTelemetry({
      environment: validEnvironment(),
      sdk: failedSdk,
      profilingIntegrationFactory: integrationFactory('ProfilingIntegration', failedSdk.calls),
    });
  });
  assert.equal(telemetry.enabled, false);
  const response = new FakeResponse(500);
  assert.doesNotThrow(() => telemetry.observe({ url: '/api/version' }, response));
  assert.equal(response.listenerCount('finish'), 0);
  assert.equal(telemetry.captureStatus(500, 'service'), false);
});

test('the same source SHA has distinct EP and Physio Sentry release identities', () => {
  assert.equal(sentryReleaseForProfession('exercise-physiology', RELEASE), RELEASE);
  assert.equal(sentryReleaseForProfession('physio', RELEASE), `physio-production@${RELEASE}`);
  assert.notEqual(
    sentryReleaseForProfession('exercise-physiology', RELEASE),
    sentryReleaseForProfession('physio', RELEASE),
  );
  assert.equal(sentryReleaseForProfession('physio', RELEASE.toUpperCase()), null);
  assert.equal(sentryReleaseForProfession('unknown', RELEASE), null);
});

test('server telemetry uses a distinct Physio production environment and rejects cross-target labels', () => {
  const physioEnvironment = validEnvironment({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    SENTRY_ENVIRONMENT: 'physio-production',
    SENTRY_RELEASE: `physio-production@${RELEASE}`,
  });
  const physioSdk = fakeSdk();
  const enabled = createErrorTelemetry({ environment: physioEnvironment, sdk: physioSdk });
  assert.equal(enabled.enabled, true);
  assert.equal(physioSdk.calls.init[0].environment, 'physio-production');
  assert.equal(physioSdk.calls.init[0].release, `physio-production@${RELEASE}`);

  for (const environment of [
    { ...physioEnvironment, SENTRY_ENVIRONMENT: 'production' },
    { ...physioEnvironment, SENTRY_RELEASE: RELEASE },
    validEnvironment({ SENTRY_ENVIRONMENT: 'physio-production' }),
  ]) {
    const telemetry = createErrorTelemetry({ environment, sdk: fakeSdk() });
    assert.equal(telemetry.enabled, false);
  }
});

test('browser profiling policy applies only to platform HTML documents', () => {
  assert.deepEqual(
    browserProfilingDocumentPolicyHeaders('C:/app/dist/index.html'),
    { 'Document-Policy': 'js-profiling' },
  );
  assert.deepEqual(browserProfilingDocumentPolicyHeaders('C:/app/dist/app.js'), {});
  assert.deepEqual(browserProfilingDocumentPolicyHeaders('/api/version'), {});
});

test('buildSentryOptions callbacks independently scrub events, spans, breadcrumbs, logs and metrics', () => {
  const sdk = fakeSdk();
  const options = buildSentryOptions({
    configuration: { dsn: VALID_DSN, release: RELEASE, environment: 'production' },
    sdk,
    profilingIntegrationFactory: integrationFactory('ProfilingIntegration', sdk.calls),
  });
  for (const [callback, payload] of [
    [options.beforeSend, { extra: { [CREDENTIAL_KEYS.pass]: 'fixture-redaction-e', email: 'person@example.com' } }],
    [options.beforeSendTransaction, { contexts: { request: { [CREDENTIAL_KEYS.api]: 'fixture-redaction-f' } } }],
    [options.beforeSendSpan, { data: { authorization: 'Bearer secret' } }],
    [options.beforeBreadcrumb, { data: { cookie: 'private' } }],
    [options.beforeSendLog, { level: 'error', message: 'password=private', attributes: { user: 'person@example.com' } }],
    [options.beforeSendMetric, { name: 'metric', tags: { [CREDENTIAL_KEYS.access]: 'fixture-redaction-g' } }],
  ]) {
    const clean = callback(payload);
    const serialized = JSON.stringify(clean);
    assert.equal(serialized.includes('secret'), false);
    assert.equal(serialized.includes('private'), false);
  }
});
