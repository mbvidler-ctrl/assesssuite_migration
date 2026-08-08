import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  classifyRouteFamily,
  createErrorTelemetry,
  createSentryEnvelopeTransport,
  ROUTE_FAMILIES,
} from '../telemetry.mjs';

const VALID_DSN = 'https://public_key@o4511822688813056.ingest.us.sentry.io/4511827129663488';
const EVENT_ID = '01234567-89ab-cdef-0123-456789abcdef';

class FakeResponse extends EventEmitter {
  constructor(statusCode) {
    super();
    this.statusCode = statusCode;
  }
}

function decodedEvent(envelope) {
  const lines = envelope.split('\n');
  assert.equal(JSON.parse(lines[1]).type, 'event');
  return JSON.parse(lines[2]);
}

function telemetryHarness(overrides = {}) {
  const envelopes = [];
  const environment = {
    SENTRY_DSN: VALID_DSN,
    RELEASE_SHA: 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63',
    NODE_ENV: 'production',
    ...overrides.environment,
  };
  const telemetry = createErrorTelemetry({
    environment,
    now: overrides.now || (() => 1_000_000),
    randomId: () => EVENT_ID,
    transport: overrides.transport || ((configuration, envelope) => envelopes.push({ configuration, envelope })),
  });
  return { telemetry, envelopes, environment };
}

test('finite route classification never returns a raw request path or query', () => {
  const cases = [
    ['/api/apps/app/entities/Client/secret-patient-id?email=patient@example.com', 'entities'],
    ['/api/apps/app/functions/transcribeSession?file=private-record.pdf', 'functions'],
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
    assert.equal(family.includes('?'), false);
    assert.equal(family.includes('@'), false);
  }
});

test('unmonitored 4xx responses are ignored and missing or invalid DSNs cause zero network activity', () => {
  for (const sentryDsn of [VALID_DSN, undefined, '', 'not-a-url', 'http://key@example.test/1']) {
    let networkCalls = 0;
    const telemetry = createErrorTelemetry({
      environment: sentryDsn === undefined ? {} : { SENTRY_DSN: sentryDsn },
      randomId: () => EVENT_ID,
      transport: () => { networkCalls += 1; },
    });
    const response = new FakeResponse(sentryDsn === VALID_DSN ? 404 : 500);
    telemetry.observe({ url: '/api/apps/app/entities/Client?email=patient@example.com' }, response);
    response.emit('finish');
    assert.equal(networkCalls, 0, String(sentryDsn));
  }
});

test('selected operational rejections are visible without request content', () => {
  const { telemetry, envelopes } = telemetryHarness();
  const response = new FakeResponse(413);
  telemetry.observe({
    url: '/api/apps/app/integration-endpoints/Core/InvokeLLM?prompt=private-patient-context',
    body: { prompt: 'must never leave the process' },
  }, response);
  response.emit('finish');

  assert.equal(envelopes.length, 1);
  const serialized = envelopes[0].envelope;
  assert.equal(serialized.includes('private-patient-context'), false);
  assert.equal(serialized.includes('must never leave the process'), false);
  const event = decodedEvent(serialized);
  assert.equal(event.level, 'warning');
  assert.deepEqual(event.tags, {
    status: '413',
    error_class: 'http_request_rejected',
    route_family: 'integrations',
  });
});

test('DSN configuration is parsed lazily after environment loading', () => {
  const environment = {};
  let networkCalls = 0;
  const telemetry = createErrorTelemetry({
    environment,
    randomId: () => EVENT_ID,
    transport: () => { networkCalls += 1; },
  });
  environment.SENTRY_DSN = VALID_DSN;
  environment.RELEASE_SHA = 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63';
  environment.NODE_ENV = 'production';
  const response = new FakeResponse(500);
  telemetry.observe({ url: '/api/version' }, response);
  response.emit('finish');
  assert.equal(networkCalls, 1);
});

test('final 5xx statuses from core and function-router responder paths are captured', () => {
  let currentTime = 1_000_000;
  const { telemetry, envelopes } = telemetryHarness({ now: () => currentTime });

  const coreResponse = new FakeResponse(200);
  telemetry.observe({ url: '/api/apps/app/entities/Client/private-id' }, coreResponse);
  coreResponse.statusCode = 503;
  coreResponse.emit('finish');

  currentTime += 60_001;
  const functionResponse = new FakeResponse(200);
  telemetry.observe({ url: '/api/apps/app/functions/transcribeSession' }, functionResponse);
  functionResponse.statusCode = 500;
  functionResponse.emit('finish');

  assert.equal(envelopes.length, 2);
  assert.deepEqual(envelopes.map(({ envelope }) => {
    const event = decodedEvent(envelope);
    return [event.tags.status, event.tags.route_family];
  }), [['503', 'entities'], ['500', 'functions']]);
});

test('event and envelope contain only strict safe fields and no request PII', () => {
  const { telemetry, envelopes } = telemetryHarness();
  const response = new FakeResponse(500);
  telemetry.observe({
    url: '/api/apps/app/entities/Client/patient-record-SHOULD-NOT-LEAK?email=patient@example.com&file=private-report.pdf',
    headers: { authorization: 'Bearer private-token', cookie: 'session=private' },
    socket: { remoteAddress: '203.0.113.42' },
    body: { patient: 'Jane Example', organization: 'Secret Clinic' },
    user: { email: 'clinician@example.com' },
  }, response);
  response.emit('finish');

  assert.equal(envelopes.length, 1);
  const serialized = envelopes[0].envelope;
  for (const forbidden of [
    'patient@example.com',
    'private-report.pdf',
    'Bearer private-token',
    'session=private',
    '203.0.113.42',
    'Jane Example',
    'Secret Clinic',
    'clinician@example.com',
    'patient-record-SHOULD-NOT-LEAK',
    'message',
    'exception',
    'request',
    'user',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);

  const event = decodedEvent(serialized);
  assert.deepEqual(Object.keys(event).sort(), [
    'environment', 'event_id', 'level', 'platform', 'release', 'tags', 'timestamp',
  ]);
  assert.deepEqual(Object.keys(event.tags).sort(), [
    'error_class', 'route_family', 'status',
  ]);
  assert.deepEqual(event.tags, {
    status: '500',
    error_class: 'http_server_error',
    route_family: 'entities',
  });
});

test('invalid release, environment or project scope causes zero transport activity', () => {
  for (const environment of [
    { SENTRY_DSN: VALID_DSN, SENTRY_RELEASE: 'patient@example.com', SENTRY_ENVIRONMENT: 'production' },
    { SENTRY_DSN: VALID_DSN, SENTRY_RELEASE: 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63', SENTRY_ENVIRONMENT: 'staging' },
    { SENTRY_DSN: 'https://public_key@o4511822688813056.ingest.us.sentry.io/999999', SENTRY_RELEASE: 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63', SENTRY_ENVIRONMENT: 'production' },
    { SENTRY_DSN: VALID_DSN, NODE_ENV: 'test', SENTRY_ENVIRONMENT: 'production', RELEASE_SHA: 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63' },
    { SENTRY_DSN: VALID_DSN, NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'production', RELEASE_SHA: undefined, SENTRY_RELEASE: 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63' },
    { SENTRY_DSN: VALID_DSN, NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'production', RELEASE_SHA: 'da253ebfbcd8fe5ac5f379ff1f2589cf0730ab63', SENTRY_RELEASE: '1111111111111111111111111111111111111111' },
  ]) {
    const { telemetry, envelopes } = telemetryHarness({ environment });
    assert.equal(telemetry.captureStatus(500, 'service'), false);
    assert.equal(envelopes.length, 0);
  }
});

test('one event per minute coalesces failures without expanding the outbound allowlist', () => {
  let currentTime = 1_000_000;
  const { telemetry, envelopes } = telemetryHarness({ now: () => currentTime });
  assert.equal(telemetry.captureStatus(500, 'service'), true);
  for (let index = 0; index < 10_050; index += 1) {
    currentTime += 1;
    assert.equal(telemetry.captureStatus(503, 'functions'), false);
  }
  assert.equal(envelopes.length, 1);

  currentTime = 1_060_001;
  assert.equal(telemetry.captureStatus(503, 'functions'), true);
  assert.equal(envelopes.length, 2);
  assert.equal('extra' in decodedEvent(envelopes[1].envelope), false);
});

test('telemetry failures never throw, alter the response, or create unhandled rejections', async () => {
  const hostileRequest = Object.defineProperty({}, 'url', {
    get() { throw new Error('non-standard request getter failure'); },
  });
  const hostileHarness = telemetryHarness();
  const untouchedResponse = new FakeResponse(500);
  assert.doesNotThrow(() => hostileHarness.telemetry.observe(hostileRequest, untouchedResponse));
  assert.equal(untouchedResponse.listenerCount('finish'), 0);

  for (const transport of [
    () => { throw new Error('provider failure with sensitive response'); },
    () => Promise.reject(new Error('provider rejection with sensitive response')),
  ]) {
    const { telemetry } = telemetryHarness({ transport });
    const response = new FakeResponse(502);
    telemetry.observe({ url: '/functions/transcribeSession' }, response);
    assert.doesNotThrow(() => response.emit('finish'));
    assert.equal(response.statusCode, 502);
    await new Promise((resolve) => setImmediate(resolve));
  }
});

test('default HTTPS transport is short-lived, unrefed, and consumes provider responses silently', () => {
  const calls = [];
  const socket = { unref: () => calls.push('unref') };
  const providerResponse = new EventEmitter();
  providerResponse.resume = () => calls.push('resume');
  const request = new EventEmitter();
  request.setTimeout = (timeout, callback) => {
    calls.push(['timeout', timeout]);
    request.timeoutCallback = callback;
  };
  request.destroy = () => calls.push('destroy');
  request.end = (body) => calls.push(['end', body]);
  const requestImpl = (options, callback) => {
    calls.push(['options', options]);
    callback(providerResponse);
    return request;
  };
  const transport = createSentryEnvelopeTransport({ requestImpl, timeoutMs: 250 });
  transport({ endpoint: new URL('https://o123.ingest.sentry.io/api/1/envelope/'), publicKey: 'key' }, 'envelope');
  request.emit('socket', socket);
  request.timeoutCallback();

  const options = calls.find((entry) => Array.isArray(entry) && entry[0] === 'options')[1];
  assert.equal(options.agent, false);
  assert.equal(options.method, 'POST');
  assert.deepEqual(calls.filter((entry) => entry === 'unref' || entry === 'resume' || entry === 'destroy'), [
    'resume', 'unref', 'destroy',
  ]);
  assert.deepEqual(calls.find((entry) => Array.isArray(entry) && entry[0] === 'timeout'), ['timeout', 250]);
});
