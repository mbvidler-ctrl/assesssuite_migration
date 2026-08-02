import * as Sentry from '@sentry/react';

export const FRONTEND_TELEMETRY_SURFACE = 'assesssuite-app';
export const FRONTEND_TELEMETRY_ALLOWED_ORIGINS = Object.freeze([
  'https://app.assesssuite.com',
]);
export const SAFE_EXCEPTION_VALUE = 'Application error';

const MAX_FUNCTION_LENGTH = 80;
const MAX_STACK_FRAMES = 50;
const SAFE_ERROR_TYPES = new Set([
  'AggregateError',
  'DOMException',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);
const SAFE_FUNCTION_NAME = /^(?:[A-Za-z_$][A-Za-z0-9_$]*)(?:(?:\.|#)[A-Za-z_$<>][A-Za-z0-9_$<>]*)*$/;
const SAFE_DEBUG_ID = /^[A-Fa-f0-9-]{8,64}$/;
const SAFE_EVENT_ID = /^[A-Fa-f0-9]{32}$/;
const SAFE_ASSET_PATH = /^\/assets\/[A-Za-z0-9._/-]+$/;
const EXACT_RELEASE = /^[0-9a-f]{40}$/i;
const APPROVED_SENTRY_HOST = 'o4511822688813056.ingest.us.sentry.io';
const APPROVED_SENTRY_PROJECT_ID = '4511827129663488';

let telemetryInitialised = false;

function safePositiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000
    ? value
    : undefined;
}

export function sanitizeErrorType(value) {
  return typeof value === 'string' && SAFE_ERROR_TYPES.has(value) ? value : 'Error';
}

export function sanitizeFunctionName(value) {
  if (typeof value !== 'string') return 'anonymous';
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > MAX_FUNCTION_LENGTH ||
    !SAFE_FUNCTION_NAME.test(candidate)
  ) {
    return 'anonymous';
  }
  return candidate;
}

export function sanitizeFrameLocation(value, allowedOrigins = FRONTEND_TELEMETRY_ALLOWED_ORIGINS) {
  if (typeof value !== 'string' || value.length > 2_048) return undefined;

  const withoutQueryOrFragment = value.split(/[?#]/, 1)[0];
  if (SAFE_ASSET_PATH.test(withoutQueryOrFragment)) return withoutQueryOrFragment;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  const allowed = new Set(allowedOrigins.map((origin) => String(origin).toLowerCase()));
  if (!allowed.has(parsed.origin.toLowerCase()) || !SAFE_ASSET_PATH.test(parsed.pathname)) {
    return undefined;
  }
  return `${parsed.origin}${parsed.pathname}`;
}

export function sanitizeStackFrame(frame, allowedOrigins = FRONTEND_TELEMETRY_ALLOWED_ORIGINS) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return undefined;

  const filename = sanitizeFrameLocation(frame.filename, allowedOrigins);
  const absPath = sanitizeFrameLocation(frame.abs_path, allowedOrigins);
  if (!filename && !absPath) return undefined;

  const sanitized = {
    function: sanitizeFunctionName(frame.function),
    in_app: true,
  };
  if (filename) sanitized.filename = filename;
  if (absPath) sanitized.abs_path = absPath;

  const lineNumber = safePositiveInteger(frame.lineno);
  const columnNumber = safePositiveInteger(frame.colno);
  if (lineNumber !== undefined) sanitized.lineno = lineNumber;
  if (columnNumber !== undefined) sanitized.colno = columnNumber;
  return sanitized;
}

export function sanitizeDebugMeta(debugMeta, allowedOrigins = FRONTEND_TELEMETRY_ALLOWED_ORIGINS) {
  if (!debugMeta || typeof debugMeta !== 'object' || !Array.isArray(debugMeta.images)) {
    return undefined;
  }

  const images = debugMeta.images.flatMap((image) => {
    if (!image || typeof image !== 'object') return [];
    const codeFile = sanitizeFrameLocation(image.code_file, allowedOrigins);
    const debugId = typeof image.debug_id === 'string' && SAFE_DEBUG_ID.test(image.debug_id)
      ? image.debug_id.toLowerCase()
      : undefined;
    if (!codeFile || !debugId) return [];
    return [{ type: 'sourcemap', code_file: codeFile, debug_id: debugId }];
  });

  return images.length > 0 ? { images } : undefined;
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
  if (metadata.environment !== 'production') return null;
  const release = typeof metadata.release === 'string' && EXACT_RELEASE.test(metadata.release)
    ? metadata.release.toLowerCase()
    : null;
  if (!release) return null;
  return {
    environment: 'production',
    release,
    surface: FRONTEND_TELEMETRY_SURFACE,
  };
}

export function sanitizeFrontendErrorEvent(
  event,
  metadata = {},
  allowedOrigins = FRONTEND_TELEMETRY_ALLOWED_ORIGINS,
) {
  const exception = event?.exception?.values?.[0];
  if (!exception || typeof exception !== 'object') return null;

  const frames = Array.isArray(exception.stacktrace?.frames)
    ? exception.stacktrace.frames
        .slice(-MAX_STACK_FRAMES)
        .map((frame) => sanitizeStackFrame(frame, allowedOrigins))
        .filter(Boolean)
    : [];
  const safeMetadata = sanitizeStaticMetadata(metadata);
  if (!safeMetadata) return null;
  const sanitized = {
    platform: 'javascript',
    level: 'error',
    exception: {
      values: [{
        type: sanitizeErrorType(exception.type),
        value: SAFE_EXCEPTION_VALUE,
        ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
      }],
    },
    environment: safeMetadata.environment,
    tags: {
      surface: safeMetadata.surface,
      environment: safeMetadata.environment,
      ...(safeMetadata.release ? { release: safeMetadata.release } : {}),
    },
  };

  if (safeMetadata.release) sanitized.release = safeMetadata.release;
  if (typeof event?.event_id === 'string' && SAFE_EVENT_ID.test(event.event_id)) {
    sanitized.event_id = event.event_id.toLowerCase();
  }
  if (typeof event?.timestamp === 'number' && Number.isFinite(event.timestamp)) {
    sanitized.timestamp = event.timestamp;
  }

  const debugMeta = sanitizeDebugMeta(event?.debug_meta, allowedOrigins);
  if (debugMeta) sanitized.debug_meta = debugMeta;
  return sanitized;
}

export function createFrontendBeforeSend(metadata = {}) {
  const safeMetadata = sanitizeStaticMetadata(metadata);
  return (event) => {
    try {
      if (!safeMetadata) return null;
      return sanitizeFrontendErrorEvent(event, safeMetadata);
    } catch {
      return null;
    }
  };
}

export function createStrictFrontendTransportFactory(metadata, transportFactory) {
  const safeMetadata = sanitizeStaticMetadata(metadata);
  if (!safeMetadata || typeof transportFactory !== 'function') return null;
  return (options) => {
    const transport = transportFactory(options);
    return {
      ...transport,
      send(envelope) {
        try {
          const items = Array.isArray(envelope?.[1]) ? envelope[1] : [];
          const eventItem = items.find((item) => item?.[0]?.type === 'event');
          const event = sanitizeFrontendErrorEvent(eventItem?.[1], safeMetadata);
          if (!event?.event_id) return Promise.resolve({ statusCode: 200 });
          return transport.send([
            { event_id: event.event_id },
            [[{ type: 'event' }, event]],
          ]);
        } catch {
          return Promise.resolve({ statusCode: 200 });
        }
      },
    };
  };
}

export function createFrontendSentryOptions(runtime = {}, integrations = [], sentry = Sentry) {
  const metadata = sanitizeStaticMetadata({
    environment: runtime.VITE_SENTRY_ENVIRONMENT,
    release: runtime.VITE_SENTRY_RELEASE,
  });
  if (!metadata || !isApprovedSentryDsn(runtime.VITE_SENTRY_DSN)) return null;
  const transport = createStrictFrontendTransportFactory(metadata, sentry.makeFetchTransport);
  if (!transport) return null;
  return {
    dsn: runtime.VITE_SENTRY_DSN,
    environment: metadata.environment,
    ...(metadata.release ? { release: metadata.release } : {}),
    defaultIntegrations: false,
    integrations,
    transport,
    sendDefaultPii: false,
    autoSessionTracking: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    attachStacktrace: false,
    sampleRate: 1,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    enableLogs: false,
    debug: false,
    beforeBreadcrumb: () => null,
    beforeSend: createFrontendBeforeSend(metadata),
  };
}

export function initialiseFrontendErrorTelemetry(runtime = import.meta.env, sentry = Sentry) {
  telemetryInitialised = false;
  if (runtime?.PROD !== true || typeof runtime?.VITE_SENTRY_DSN !== 'string') return false;
  if (!isApprovedSentryDsn(runtime.VITE_SENTRY_DSN)) return false;
  if (runtime.VITE_SENTRY_ENVIRONMENT !== 'production' || !EXACT_RELEASE.test(runtime.VITE_SENTRY_RELEASE || '')) return false;

  try {
    const integrations = [
      sentry.globalHandlersIntegration({ onerror: true, onunhandledrejection: true }),
      sentry.dedupeIntegration(),
    ];
    const options = createFrontendSentryOptions(runtime, integrations, sentry);
    if (!options) return false;
    sentry.init(options);
    telemetryInitialised = true;
    return true;
  } catch {
    return false;
  }
}

export function captureFrontendException(error, sentry = Sentry) {
  if (!telemetryInitialised || !(error instanceof Error)) return undefined;
  return sentry.captureException(error);
}
