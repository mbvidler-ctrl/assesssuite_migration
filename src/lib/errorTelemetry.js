import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { normalizeSentryReleaseForEnvironment } from '../../packages/profession-config/sentry-release.mjs';

export const FRONTEND_TELEMETRY_SURFACE = 'assesssuite-app';
export const FRONTEND_TELEMETRY_ALLOWED_ORIGINS = Object.freeze([
  /^https:\/\/app\.assesssuite\.com(?:\/|$)/i,
]);
export const PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS = Object.freeze([
  /^https:\/\/physio\.app\.assesssuite\.com(?:\/|$)/i,
  /^https:\/\/assesssuite-physio-production\.fly\.dev(?:\/|$)/i,
]);
export const TELEMETRY_REDACTED = '[Filtered]';
export const TELEMETRY_FILE_BYTES_OMITTED = '[File bytes omitted]';

const APPROVED_SENTRY_HOST = 'o4511822688813056.ingest.us.sentry.io';
const APPROVED_SENTRY_PROJECT_ID = '4511827129663488';
const MAX_SANITIZE_DEPTH = 16;

const SENSITIVE_FIELD_NAMES = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'cookies',
  'setcookie',
  'password',
  'passwd',
  'pwd',
  'secret',
  'clientsecret',
  'apikey',
  'xapikey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authtoken',
  'sessiontoken',
  'token',
  'csrftoken',
  'xsrf',
  'otp',
  'verificationcode',
  'magiclink',
  'stripesignature',
  'cardnumber',
  'securitycode',
  'cvc',
  'cvv',
  'paymentsecret',
  'paymentmethod',
]);

const SENSITIVE_FIELD_SUFFIXES = Object.freeze([
  'token',
  'password',
  'passwd',
  'secret',
]);

const AUTH_CALLBACK_FIELD_NAMES = new Set([
  ...SENSITIVE_FIELD_NAMES,
  'code',
  'codeverifier',
  'state',
]);

const SAFE_REPLAY_REQUEST_HEADERS = Object.freeze([
  'accept-language',
  'baggage',
  'origin',
  'referer',
  'sentry-trace',
  'x-app-id',
  'x-org-id',
  'x-request-id',
  'x-requested-with',
]);

const SAFE_REPLAY_RESPONSE_HEADERS = Object.freeze([
  'cache-control',
  'content-disposition',
  'etag',
  'last-modified',
  'retry-after',
  'server-timing',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'x-request-id',
]);

export const FRONTEND_REPLAY_NETWORK_ALLOW_URLS = Object.freeze([
  /^https:\/\/app\.assesssuite\.com\/(?:api|entities|functions|integrations)(?:\/|$)/i,
]);
export const PHYSIO_FRONTEND_REPLAY_NETWORK_ALLOW_URLS = Object.freeze([
  /^https:\/\/physio\.app\.assesssuite\.com\/(?:api|entities|functions|integrations)(?:\/|$)/i,
  /^https:\/\/assesssuite-physio-production\.fly\.dev\/(?:api|entities|functions|integrations)(?:\/|$)/i,
]);

export const FRONTEND_REPLAY_NETWORK_DENY_URLS = Object.freeze([
  /(?:\/uploads?\/|\/api\/files?\/|uploadfile|download|extractdatafromuploadedfile|transcribesession|\/audio(?:\/|$)|\/media(?:\/|$)|\/attachments?(?:\/|$))/i,
]);

export const FRONTEND_REPLAY_MASK_SELECTORS = Object.freeze([
  '.sentry-mask',
  '[data-sentry-mask]',
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  'input[autocomplete^="cc-"]',
  'input[name*="password" i]',
  'input[name*="secret" i]',
  'input[name*="token" i]',
  'input[name*="authorization" i]',
  'input[name*="card" i]',
  'input[name*="cvc" i]',
  'input[name*="cvv" i]',
]);

export const FRONTEND_REPLAY_BLOCK_SELECTORS = Object.freeze([
  '.sentry-block',
  '[data-sentry-block]',
  'input[type="file"]',
]);

let telemetryInitialised = false;

function compactFieldName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSensitiveTelemetryField(value) {
  const compact = compactFieldName(value);
  return SENSITIVE_FIELD_NAMES.has(compact) ||
    SENSITIVE_FIELD_SUFFIXES.some((suffix) => compact.endsWith(suffix));
}

function isBinaryValue(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true;
  return typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value);
}

function isAuthCallbackPath(pathname) {
  return /(?:^|\/)(?:auth|login|signin|oauth|callback|reset-password)(?:\/|$)/i.test(pathname || '');
}

function sensitiveQueryField(name, pathname) {
  const compact = compactFieldName(name);
  return isSensitiveTelemetryField(name) ||
    (isAuthCallbackPath(pathname) && AUTH_CALLBACK_FIELD_NAMES.has(compact));
}

export function sanitizeTelemetryUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  const absolute = /^https?:\/\//i.test(value);
  const relative = value.startsWith('/');
  if (!absolute && !relative) return sanitizeCredentialString(value);

  try {
    const parsed = new URL(value, 'https://app.assesssuite.com');
    const queryFieldNames = [];
    parsed.searchParams.forEach((_value, name) => queryFieldNames.push(name));
    for (const name of queryFieldNames) {
      if (sensitiveQueryField(name, parsed.pathname)) {
        parsed.searchParams.set(name, TELEMETRY_REDACTED);
      }
    }
    if (parsed.hash && /(?:token|secret|password|authorization|session|code)=/i.test(parsed.hash)) {
      parsed.hash = '#[Filtered]';
    }
    return absolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return sanitizeCredentialString(value);
  }
}

export function sanitizeCredentialString(value) {
  if (typeof value !== 'string') return value;
  if (/^data:[^,]*;base64,/i.test(value)) return TELEMETRY_FILE_BYTES_OMITTED;

  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${TELEMETRY_REDACTED}`)
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, `Basic ${TELEMETRY_REDACTED}`)
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/gi, TELEMETRY_REDACTED)
    .replace(/\bwhsec_[A-Za-z0-9_-]{8,}\b/gi, TELEMETRY_REDACTED)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, TELEMETRY_REDACTED)
    .replace(
      /\b([a-z0-9_-]*(?:token|password|passwd|secret)|pwd|authorization|cookie|otp|verification[_-]?code|card[_-]?number|cvc|cvv)(["']?\s*[:=]\s*["']?)[^"'&,;\r\n}]+/gi,
      `$1$2${TELEMETRY_REDACTED}`,
    );
}

function sanitizeTelemetryValueInternal(value, fieldName, seen, depth) {
  if (isSensitiveTelemetryField(fieldName)) return TELEMETRY_REDACTED;
  if (isBinaryValue(value)) return TELEMETRY_FILE_BYTES_OMITTED;
  if (typeof value === 'string') {
    const scrubbed = sanitizeCredentialString(value);
    return /(?:url|uri|href|pathname|transaction|description)$/i.test(fieldName || '')
      ? sanitizeTelemetryUrl(scrubbed)
      : scrubbed;
  }
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_SANITIZE_DEPTH) return '[Depth limited]';
  if (seen.has(value)) return '[Circular]';

  seen.add(value);
  if (Array.isArray(value)) {
    const sanitized = value.map((item) => sanitizeTelemetryValueInternal(item, fieldName, seen, depth + 1));
    seen.delete(value);
    return sanitized;
  }

  const sanitized = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = sanitizeTelemetryValueInternal(item, key, seen, depth + 1);
  }
  seen.delete(value);
  return sanitized;
}

export function sanitizeTelemetryValue(value, fieldName = '') {
  return sanitizeTelemetryValueInternal(value, fieldName, new WeakSet(), 0);
}

function isFileTransferUrl(value) {
  return typeof value === 'string' && FRONTEND_REPLAY_NETWORK_DENY_URLS.some((matcher) => matcher.test(value));
}

export function sanitizeReplayRecordingEvent(event) {
  const sanitized = sanitizeTelemetryValue(event);
  const payload = sanitized?.data?.payload;
  if (!payload || !['resource.fetch', 'resource.xhr'].includes(payload.op)) return sanitized;

  payload.description = sanitizeTelemetryUrl(payload.description);
  const contentTypes = [
    payload.data?.request?.headers?.['content-type'],
    payload.data?.response?.headers?.['content-type'],
  ].filter(Boolean).join(' ');
  const containsFileBody = isFileTransferUrl(payload.description) ||
    /(?:multipart\/|audio\/|video\/|image\/|application\/pdf|application\/octet-stream)/i.test(contentTypes);
  if (containsFileBody) {
    if (payload.data?.request && Object.hasOwn(payload.data.request, 'body')) {
      payload.data.request.body = TELEMETRY_FILE_BYTES_OMITTED;
    }
    if (payload.data?.response && Object.hasOwn(payload.data.response, 'body')) {
      payload.data.response.body = TELEMETRY_FILE_BYTES_OMITTED;
    }
  }
  return sanitized;
}

function isApprovedSentryDsn(rawDsn) {
  if (typeof rawDsn !== 'string' || rawDsn.length === 0 || rawDsn.length > 2_048) return false;
  try {
    const dsn = new URL(rawDsn);
    return dsn.protocol === 'https:' &&
      dsn.hostname === APPROVED_SENTRY_HOST &&
      dsn.pathname === `/${APPROVED_SENTRY_PROJECT_ID}` &&
      !dsn.search && !dsn.hash && !dsn.password &&
      /^[A-Za-z0-9_-]{1,256}$/.test(dsn.username);
  } catch {
    return false;
  }
}

function sanitizeStaticMetadata(metadata = {}) {
  if (!['production', 'physio-production'].includes(metadata.environment)) return null;
  const release = normalizeSentryReleaseForEnvironment(metadata.environment, metadata.release);
  if (!release) return null;
  return {
    environment: metadata.environment,
    release,
    surface: FRONTEND_TELEMETRY_SURFACE,
  };
}

export function sanitizeFrontendTelemetryEvent(event, metadata = {}) {
  const safeMetadata = sanitizeStaticMetadata(metadata);
  if (!safeMetadata || !event || typeof event !== 'object') return null;
  const sanitized = sanitizeTelemetryValue(event);
  sanitized.environment = safeMetadata.environment;
  sanitized.release = safeMetadata.release;
  sanitized.tags = {
    ...(sanitized.tags && typeof sanitized.tags === 'object' ? sanitized.tags : {}),
    surface: safeMetadata.surface,
    environment: safeMetadata.environment,
    release: safeMetadata.release,
  };
  return sanitized;
}

export function createFrontendBeforeSend(metadata = {}) {
  const safeMetadata = sanitizeStaticMetadata(metadata);
  return (event, hint = {}) => {
    try {
      if (!safeMetadata) return null;
      // AssessSuite does not add attachments. Clearing this hook input ensures an
      // error object can never smuggle uploaded file bytes into an event.
      if (Array.isArray(hint.attachments)) hint.attachments.length = 0;
      return sanitizeFrontendTelemetryEvent(event, safeMetadata);
    } catch {
      return null;
    }
  };
}

function createFrontendBeforeSendValue() {
  return (value) => {
    try {
      return sanitizeTelemetryValue(value);
    } catch {
      return null;
    }
  };
}

function telemetryOrigins(environment) {
  return environment === 'physio-production'
    ? PHYSIO_FRONTEND_TELEMETRY_ALLOWED_ORIGINS
    : FRONTEND_TELEMETRY_ALLOWED_ORIGINS;
}

function replayNetworkAllowUrls(environment) {
  return environment === 'physio-production'
    ? PHYSIO_FRONTEND_REPLAY_NETWORK_ALLOW_URLS
    : FRONTEND_REPLAY_NETWORK_ALLOW_URLS;
}

export function createFrontendReplayOptions(environment = 'production') {
  return {
    maskAllText: false,
    maskAllInputs: false,
    blockAllMedia: true,
    maskAttributes: [],
    mask: [...FRONTEND_REPLAY_MASK_SELECTORS],
    block: [...FRONTEND_REPLAY_BLOCK_SELECTORS],
    networkDetailAllowUrls: [...replayNetworkAllowUrls(environment)],
    networkDetailDenyUrls: [...FRONTEND_REPLAY_NETWORK_DENY_URLS],
    networkCaptureBodies: true,
    networkRequestHeaders: [...SAFE_REPLAY_REQUEST_HEADERS],
    networkResponseHeaders: [...SAFE_REPLAY_RESPONSE_HEADERS],
    attachRawBodyFromRequest: true,
    beforeAddRecordingEvent: sanitizeReplayRecordingEvent,
  };
}

function mergeIntegrations(defaultIntegrations = [], additionalIntegrations = []) {
  const byName = new Map();
  for (const integration of [...defaultIntegrations, ...additionalIntegrations]) {
    if (integration && typeof integration.name === 'string') byName.set(integration.name, integration);
  }
  return [...byName.values()];
}

export function createFrontendIntegrations(sentry = Sentry, environment = 'production') {
  const integrations = [
    sentry.reactRouterBrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
      instrumentPageLoad: true,
      instrumentNavigation: true,
      enableLongTask: true,
      enableLongAnimationFrame: true,
      enableInp: true,
      traceFetch: true,
      traceXHR: true,
      enableHTTPTimings: true,
      linkPreviousTrace: 'session-storage',
      consistentTraceSampling: true,
    }),
    sentry.replayIntegration(createFrontendReplayOptions(environment)),
    sentry.browserProfilingIntegration(),
    sentry.httpClientIntegration(),
    sentry.extraErrorDataIntegration({ depth: 10 }),
    sentry.contextLinesIntegration(),
    sentry.reportingObserverIntegration(),
    sentry.consoleLoggingIntegration({
      levels: ['debug', 'info', 'warn', 'error', 'log', 'trace', 'assert'],
    }),
    sentry.captureConsoleIntegration({ levels: ['error'], handled: true }),
  ];
  return integrations;
}

export function createFrontendSentryOptions(runtime = {}, additionalIntegrations = []) {
  const metadata = sanitizeStaticMetadata({
    environment: runtime.VITE_SENTRY_ENVIRONMENT,
    release: runtime.VITE_SENTRY_RELEASE,
  });
  if (!metadata || !isApprovedSentryDsn(runtime.VITE_SENTRY_DSN)) return null;

  const beforeSendValue = createFrontendBeforeSendValue();
  /** @type {import('@sentry/react').BrowserOptions & { autoSessionTracking: boolean }} */
  const options = {
    dsn: runtime.VITE_SENTRY_DSN,
    environment: metadata.environment,
    release: metadata.release,
    integrations: (defaults) => mergeIntegrations(defaults, additionalIntegrations),
    sendDefaultPii: true,
    dataCollection: {
      userInfo: true,
      cookies: false,
      httpHeaders: { request: true, response: true },
      httpBodies: /** @type {Array<'incomingRequest' | 'outgoingRequest' | 'incomingResponse' | 'outgoingResponse'>} */ ([
        'incomingRequest',
        'outgoingRequest',
        'incomingResponse',
        'outgoingResponse',
      ]),
      urlQueryParams: true,
      graphQL: { document: true, variables: true },
      genAI: { inputs: true, outputs: true },
      databaseQueryData: true,
      stackFrameVariables: true,
      frameContextLines: 20,
    },
    autoSessionTracking: true,
    sendClientReports: true,
    maxBreadcrumbs: 100,
    attachStacktrace: true,
    sampleRate: 1,
    tracesSampleRate: 1,
    profileSessionSampleRate: 1,
    profileLifecycle: 'trace',
    replaysSessionSampleRate: 1,
    replaysOnErrorSampleRate: 1,
    tracePropagationTargets: [...telemetryOrigins(metadata.environment)],
    enableLogs: true,
    enableMetrics: true,
    normalizeDepth: 10,
    normalizeMaxBreadth: 1_000,
    maxValueLength: 8_192,
    debug: false,
    beforeBreadcrumb: beforeSendValue,
    beforeSend: createFrontendBeforeSend(metadata),
    beforeSendTransaction: beforeSendValue,
    beforeSendSpan: beforeSendValue,
    beforeSendLog: beforeSendValue,
    beforeSendMetric: beforeSendValue,
  };
  return options;
}

export function initialiseFrontendErrorTelemetry(runtime = import.meta.env, sentry = Sentry) {
  telemetryInitialised = false;
  if (runtime?.PROD !== true || typeof runtime?.VITE_SENTRY_DSN !== 'string') return false;
  if (!isApprovedSentryDsn(runtime.VITE_SENTRY_DSN)) return false;
  const expectedEnvironment = runtime.VITE_PROFESSION === 'physio'
    ? 'physio-production'
    : 'production';
  if (
    runtime.VITE_SENTRY_ENVIRONMENT !== expectedEnvironment
    || !normalizeSentryReleaseForEnvironment(expectedEnvironment, runtime.VITE_SENTRY_RELEASE)
  ) return false;

  try {
    const integrations = createFrontendIntegrations(sentry, expectedEnvironment);
    const options = createFrontendSentryOptions(runtime, integrations);
    if (!options) return false;
    sentry.init(options);
    telemetryInitialised = true;
    return true;
  } catch {
    return false;
  }
}

function normalizeIdentityValue(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = sanitizeCredentialString(String(value).trim());
  return normalized && normalized !== TELEMETRY_REDACTED ? normalized.slice(0, 512) : undefined;
}

export function setFrontendTelemetryUser(user, sentry = Sentry) {
  if (!telemetryInitialised || !user || typeof user !== 'object') return false;
  const id = normalizeIdentityValue(user.id);
  const email = normalizeIdentityValue(user.email);
  const username = normalizeIdentityValue(
    user.full_name || user.name || user.display_name || user.username || user.email,
  );
  const role = normalizeIdentityValue(user.role);
  const identity = {
    ...(id ? { id } : {}),
    ...(email ? { email } : {}),
    ...(username ? { username } : {}),
    ...(role ? { role } : {}),
  };
  if (Object.keys(identity).length === 0) return false;
  sentry.setUser(identity);
  if (role) sentry.setTag('user.role', role);
  return true;
}

export function clearFrontendTelemetryUser(sentry = Sentry) {
  if (!telemetryInitialised) return false;
  sentry.setUser(null);
  const scope = sentry.getCurrentScope?.();
  const removeTag = scope && /** @type {{ removeTag?: (key: string) => void }} */ (scope).removeTag;
  if (typeof removeTag === 'function') {
    removeTag.call(scope, 'user.role');
  } else {
    scope?.setTag?.('user.role', undefined);
  }
  return true;
}

export function captureFrontendException(error, sentry = Sentry) {
  if (!telemetryInitialised || !(error instanceof Error)) return undefined;
  return sentry.captureException(error);
}
