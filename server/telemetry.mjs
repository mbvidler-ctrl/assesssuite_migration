// Loading the Node SDK and its native profiler is intentionally limited to the
// production runtime. Tests and local assurance use injected SDK doubles and
// should not pay several seconds of native instrumentation startup before the
// loopback server can bind.
let Sentry = null;
if (process.env.NODE_ENV === 'production') {
  try {
    Sentry = await import('@sentry/node');
  } catch {
    // Telemetry is additive. An unavailable SDK must not stop AssessSuite.
  }
}

const FILTERED = '[Filtered]';
const FILTERED_BINARY = '[Filtered: binary or uploaded file content]';
const FILTERED_BODY = '[Filtered: raw upload or binary request body]';
const OMITTED_RESPONSE_BODY = '[Omitted: response body is not safe bounded JSON]';
const MAX_SANITIZE_DEPTH = 12;
const MAX_SANITIZE_KEYS = 1_000;
const MAX_RESPONSE_BODY_BYTES = 64 * 1024;
const EXACT_RELEASE = /^[0-9a-f]{40}$/i;
const APPROVED_SENTRY_HOST = 'o4511822688813056.ingest.us.sentry.io';
const APPROVED_SENTRY_PROJECT_ID = '4511827129663488';

let defaultProfilingIntegrationFactory = null;
if (process.env.NODE_ENV === 'production') {
  try {
    const profilingModule = await import('@sentry/profiling-node');
    if (typeof profilingModule.nodeProfilingIntegration === 'function') {
      defaultProfilingIntegrationFactory = profilingModule.nodeProfilingIntegration;
    }
  } catch {
    // Profiling is additive. A missing or incompatible native binary must never
    // prevent AssessSuite from serving requests or disable the remaining SDK.
  }
}

export const ROUTE_FAMILIES = Object.freeze([
  'auth',
  'entities',
  'files',
  'functions',
  'integrations',
  'public_settings',
  'service',
  'static',
  'telemetry_stub',
  'unknown',
]);

export function browserProfilingDocumentPolicyHeaders(filePath) {
  return typeof filePath === 'string' && /\.html$/i.test(filePath)
    ? { 'Document-Policy': 'js-profiling' }
    : {};
}

const ROUTE_FAMILY_SET = new Set(ROUTE_FAMILIES);

const SENSITIVE_FIELD = /(?:^|[_-])(?:authorization|proxy[_-]?authorization|cookie|set[_-]?cookie|password|passcode|pin|otp|one[_-]?time[_-]?(?:code|password)|csrf|xsrf|api[_-]?key|private[_-]?key|secret[_-]?key|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|session[_-]?token|id[_-]?token|(?:stripe|webhook|payment|provider|hmac)[_-]?signature|webhook[_-]?secret|card[_-]?(?:number|cvc|cvv|expiry)|cvc|cvv|payment[_-]?(?:method|credential)|bank[_-]?account|account[_-]?number|routing[_-]?number)(?:$|[_-])/i;
const SENSITIVE_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-csrf-token|x-xsrf-token|csrf-token|x-auth-token|stripe-signature)$/i;
const SENSITIVE_QUERY = /^(?:access_token|refresh_token|id_token|session_token|token|code|otp|password|passcode|api_key|client_secret|secret|signature|csrf|xsrf)$/i;
const BINARY_CONTENT_TYPE = /^(?:audio|video|image)\/|(?:multipart\/form-data|application\/(?:octet-stream|pdf|zip|x-zip-compressed|vnd\.|msword))/i;
const RAW_UPLOAD_ROUTE = /\/(?:uploads|api\/files)(?:\/|$)|\/(?:functions\/transcribeSession|integration-endpoints\/Core\/UploadFile)(?:[/?#]|$)/i;

function pathnameFromRequestTarget(target) {
  if (
    typeof target !== 'string'
    || !target.startsWith('/')
    || target.length === 0
    || target.length > 8_192
  ) return '';
  try {
    return new URL(target, 'http://request.invalid').pathname;
  } catch {
    return '';
  }
}

export function classifyRouteFamily(requestTarget) {
  const pathname = pathnameFromRequestTarget(requestTarget);
  if (!pathname) return 'unknown';
  if (pathname === '/api/version') return 'service';
  if (
    /^\/api\/apps\/[^/]+\/analytics\/track\/batch$/.test(pathname)
    || /^\/api\/app-logs\/[^/]+\/log-user-in-app\/[^/]+$/.test(pathname)
  ) return 'telemetry_stub';
  if (/^\/api\/apps\/public\/prod\/public-settings\/by-id\/[^/]+$/.test(pathname)) {
    return 'public_settings';
  }
  if (pathname.startsWith('/uploads/') || pathname.startsWith('/api/files/')) return 'files';
  if (
    /^\/api\/apps\/[^/]+\/auth\/[^/]+$/.test(pathname)
    || pathname === '/api/apps/auth/logout'
    || /^\/api\/apps\/[^/]+\/(?:users|runtime\/users)\/invite-user$/.test(pathname)
  ) return 'auth';
  if (/^\/api\/apps\/[^/]+\/entities(?:\/|$)/.test(pathname)) return 'entities';
  if (
    /^\/api\/apps\/[^/]+\/functions\/[^/]+$/.test(pathname)
    || /^\/functions\/[^/]+$/.test(pathname)
  ) return 'functions';
  if (/^\/api\/apps\/[^/]+\/integration-endpoints(?:\/|$)/.test(pathname)) return 'integrations';
  if (pathname.startsWith('/api/')) return 'service';
  if (pathname.startsWith('/assets/') || pathname === '/' || !pathname.includes('.')) return 'static';
  return 'unknown';
}

function parseSentryDsn(rawDsn) {
  if (typeof rawDsn !== 'string' || rawDsn.length === 0 || rawDsn.length > 2_048) return null;
  let dsn;
  try {
    dsn = new URL(rawDsn);
  } catch {
    return null;
  }
  if (
    dsn.protocol !== 'https:'
    || dsn.hostname !== APPROVED_SENTRY_HOST
    || dsn.search
    || dsn.hash
    || dsn.password
    || !/^[A-Za-z0-9_-]{1,256}$/.test(dsn.username)
  ) return null;

  const pathSegments = dsn.pathname.split('/').filter(Boolean);
  const projectId = pathSegments.pop();
  if (projectId !== APPROVED_SENTRY_PROJECT_ID || pathSegments.length !== 0) return null;
  return dsn.toString();
}

function productionConfiguration(environment) {
  const dsn = parseSentryDsn(environment.SENTRY_DSN);
  const releaseCandidate = environment.RELEASE_SHA;
  if (!dsn || typeof releaseCandidate !== 'string' || !EXACT_RELEASE.test(releaseCandidate)) return null;
  const release = releaseCandidate.toLowerCase();
  if (environment.NODE_ENV !== 'production') return null;
  if (environment.SENTRY_RELEASE !== undefined && environment.SENTRY_RELEASE !== release) return null;
  if (environment.SENTRY_ENVIRONMENT !== undefined && environment.SENTRY_ENVIRONMENT !== 'production') return null;
  return Object.freeze({ dsn, release, environment: 'production' });
}

function isSensitiveField(key) {
  if (typeof key !== 'string') return false;
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return SENSITIVE_FIELD.test(normalized);
}

function scrubSecretPatterns(value) {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/gi, 'Bearer [Filtered]')
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, 'Basic [Filtered]')
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/g, FILTERED)
    .replace(/\b(?:sk-proj|whsec|gh[pousr])_[A-Za-z0-9_-]{8,}\b/g, FILTERED)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, FILTERED)
    .replace(/((?:password|passcode|otp|csrf|xsrf|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|session[_-]?token|authorization|cookie|stripe[_-]?signature)\s*[:=]\s*)[^\s,;&]+/gi, `$1${FILTERED}`)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, FILTERED);
}

export function redactUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return rawUrl;
  try {
    const absolute = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(rawUrl);
    const parsed = new URL(rawUrl, 'http://telemetry.invalid');
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY.test(key)) parsed.searchParams.set(key, FILTERED);
    }
    const serialized = absolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return scrubSecretPatterns(serialized);
  } catch {
    return scrubSecretPatterns(rawUrl);
  }
}

function sanitizeQueryString(value) {
  if (typeof value !== 'string') return sanitizeTelemetryValue(value);
  try {
    const query = new URLSearchParams(value.startsWith('?') ? value.slice(1) : value);
    for (const key of [...query.keys()]) {
      if (SENSITIVE_QUERY.test(key)) query.set(key, FILTERED);
    }
    return query.toString();
  } catch {
    return scrubSecretPatterns(value);
  }
}

export function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const clean = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = String(rawKey);
    clean[key] = SENSITIVE_HEADER.test(key) || isSensitiveField(key)
      ? FILTERED
      : sanitizeTelemetryValue(rawValue, { key });
  }
  return clean;
}

function sanitizeString(value, key) {
  if (isSensitiveField(key)) return FILTERED;
  if (/^data:[^;,]+;base64,/i.test(value)) return FILTERED_BINARY;
  return scrubSecretPatterns(value);
}

export function sanitizeTelemetryValue(value, state = {}) {
  const {
    key = '',
    depth = 0,
    seen = new WeakSet(),
  } = state;
  if (isSensitiveField(key)) return FILTERED;
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sanitizeString(value, key);
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (depth >= MAX_SANITIZE_DEPTH) return '[Truncated]';

  if (
    Buffer.isBuffer(value)
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
  ) return FILTERED_BINARY;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_SANITIZE_KEYS).map((entry) => sanitizeTelemetryValue(entry, {
      key,
      depth: depth + 1,
      seen,
    }));
  }

  if (
    value?.type === 'Buffer'
    && Array.isArray(value?.data)
  ) return FILTERED_BINARY;

  const clean = {};
  const entries = Object.entries(value).slice(0, MAX_SANITIZE_KEYS);
  for (const [childKey, childValue] of entries) {
    const sanitized = sanitizeTelemetryValue(childValue, {
      key: childKey,
      depth: depth + 1,
      seen,
    });
    if (sanitized !== undefined) clean[childKey] = sanitized;
  }
  return clean;
}

function contentTypeFromHeaders(headers) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers['content-type'] ?? headers['Content-Type'];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export function shouldExcludeIncomingRequestBody(rawUrl, request) {
  const contentType = contentTypeFromHeaders(request?.headers);
  return BINARY_CONTENT_TYPE.test(contentType) || RAW_UPLOAD_ROUTE.test(String(rawUrl || ''));
}

function isSafeJsonContentType(contentType) {
  return /^(?:application|text)\/(?:[A-Za-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(String(contentType || ''));
}

function safeResponseContext({ status, body, contentType } = {}) {
  const cleanContentType = boundedString(String(contentType || ''), 256) || '';
  const statusCode = Number(status);
  const base = {
    status_code: Number.isInteger(statusCode) ? statusCode : undefined,
    content_type: cleanContentType,
  };
  if (!isSafeJsonContentType(cleanContentType)) {
    return { ...base, body: OMITTED_RESPONSE_BODY };
  }
  const cleanBody = sanitizeTelemetryValue(body);
  let serialized;
  try {
    serialized = JSON.stringify(cleanBody);
  } catch {
    return { ...base, body: OMITTED_RESPONSE_BODY };
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_RESPONSE_BODY_BYTES) {
    return {
      ...base,
      body: OMITTED_RESPONSE_BODY,
      body_bytes: Buffer.byteLength(serialized, 'utf8'),
    };
  }
  return { ...base, body: cleanBody, body_bytes: Buffer.byteLength(serialized, 'utf8') };
}

function sanitizeRequest(request) {
  if (!request || typeof request !== 'object') return request;
  const clean = sanitizeTelemetryValue(request);
  if (clean.headers) clean.headers = sanitizeHeaders(clean.headers);
  if ('cookies' in clean) clean.cookies = FILTERED;
  if (typeof clean.url === 'string') clean.url = redactUrl(clean.url);
  if ('query_string' in clean) clean.query_string = sanitizeQueryString(clean.query_string);
  if (shouldExcludeIncomingRequestBody(clean.url, { headers: clean.headers })) {
    if ('data' in clean) clean.data = FILTERED_BODY;
  }
  return clean;
}

export function sanitizeTelemetryEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const clean = sanitizeTelemetryValue(event);
  if (clean.request) clean.request = sanitizeRequest(clean.request);
  if (Array.isArray(clean.breadcrumbs)) {
    clean.breadcrumbs = clean.breadcrumbs.map((breadcrumb) => {
      const result = sanitizeTelemetryValue(breadcrumb);
      if (result?.data?.url) result.data.url = redactUrl(result.data.url);
      if (result?.data?.headers) result.data.headers = sanitizeHeaders(result.data.headers);
      return result;
    });
  }
  return clean;
}

function safeIntegration(factory, options) {
  if (typeof factory !== 'function') return null;
  try {
    return options === undefined ? factory() : factory(options);
  } catch {
    return null;
  }
}

function allRuntimeMetrics() {
  return {
    cpuUtilization: true,
    cpuTime: true,
    memRss: true,
    memHeapUsed: true,
    memHeapTotal: true,
    memExternal: true,
    eventLoopDelayMin: true,
    eventLoopDelayMax: true,
    eventLoopDelayMean: true,
    eventLoopDelayP50: true,
    eventLoopDelayP90: true,
    eventLoopDelayP99: true,
    eventLoopUtilization: true,
    uptime: true,
  };
}

export function buildSentryOptions({
  configuration,
  sdk = Sentry,
  profilingIntegrationFactory = defaultProfilingIntegrationFactory,
} = {}) {
  const integrations = [
    safeIntegration(sdk.httpIntegration, {
      breadcrumbs: true,
      spans: true,
      trackIncomingRequestsAsSessions: true,
      sessionFlushingDelayMS: 60_000,
      tracePropagation: true,
      ignoreStaticAssets: false,
      dropSpansForIncomingRequestStatusCodes: [],
      maxIncomingRequestBodySize: 'always',
      ignoreIncomingRequestBody: (url, request) => shouldExcludeIncomingRequestBody(url, request),
      ignoreOutgoingRequests: (url) => String(url || '').includes(APPROVED_SENTRY_HOST),
      incomingRequestSpanHook: (span, request) => {
        try {
          span.setAttribute('assesssuite.route_family', classifyRouteFamily(request?.url));
          span.setAttribute('http.request.method', String(request?.method || 'UNKNOWN'));
        } catch {
          // Span enrichment is strictly best-effort.
        }
      },
    }),
    safeIntegration(sdk.requestDataIntegration, {
      include: {
        cookies: false,
        data: true,
        headers: true,
        ip: true,
        query_string: true,
        url: true,
      },
    }),
    safeIntegration(sdk.nodeContextIntegration),
    safeIntegration(sdk.contextLinesIntegration),
    safeIntegration(sdk.localVariablesIntegration),
    safeIntegration(sdk.extraErrorDataIntegration, { depth: 10 }),
    safeIntegration(sdk.processSessionIntegration),
    safeIntegration(sdk.nodeRuntimeMetricsIntegration, {
      collect: allRuntimeMetrics(),
      collectionIntervalMs: 30_000,
    }),
    safeIntegration(sdk.consoleLoggingIntegration, {
      levels: ['debug', 'info', 'warn', 'error', 'log', 'assert', 'trace'],
    }),
    safeIntegration(sdk.fsIntegration),
    safeIntegration(profilingIntegrationFactory),
  ].filter(Boolean);

  return {
    dsn: configuration.dsn,
    release: configuration.release,
    environment: configuration.environment,
    sampleRate: 1,
    tracesSampleRate: 1,
    profileSessionSampleRate: 1,
    profileLifecycle: 'trace',
    sendDefaultPii: true,
    includeLocalVariables: true,
    attachStacktrace: true,
    enableLogs: true,
    enableMetrics: true,
    sendClientReports: true,
    maxBreadcrumbs: 100,
    normalizeDepth: 10,
    normalizeMaxBreadth: 1_000,
    maxValueLength: 8_192,
    shutdownTimeout: 2_000,
    registerEsmLoaderHooks: true,
    skipOpenTelemetrySetup: false,
    tracePropagationTargets: [
      'app.assesssuite.com',
      'assesssuite-production.fly.dev',
      'localhost',
      '127.0.0.1',
    ],
    dataCollection: {
      userInfo: true,
      cookies: false,
      httpHeaders: {
        request: { deny: ['authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'x-csrf-token', 'x-xsrf-token', 'stripe-signature'] },
        response: { deny: ['set-cookie', 'authorization', 'x-api-key'] },
      },
      // v10 data-collection posture enables both server directions. Incoming
      // file/multipart bodies are denied by ignoreIncomingRequestBody; this
      // module additionally records only bounded JSON response bodies.
      httpBodies: ['incomingRequest', 'outgoingResponse'],
      urlQueryParams: { deny: ['access_token', 'refresh_token', 'id_token', 'session_token', 'token', 'code', 'otp', 'password', 'api_key', 'client_secret', 'secret', 'signature', 'csrf', 'xsrf'] },
      graphQL: { document: true, variables: true },
      genAI: { inputs: true, outputs: true },
      databaseQueryData: true,
      stackFrameVariables: { deny: ['authorization', 'cookie', 'password', 'passcode', 'otp', 'csrf', 'xsrf', 'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken', 'stripeSignature', 'cardNumber', 'cvc', 'cvv'] },
      frameContextLines: 10,
    },
    integrations,
    beforeSend: (event) => sanitizeTelemetryEvent(event),
    beforeSendTransaction: (event) => sanitizeTelemetryEvent(event),
    beforeSendSpan: (span) => sanitizeTelemetryValue(span),
    beforeBreadcrumb: (breadcrumb) => sanitizeTelemetryValue(breadcrumb),
    beforeSendLog: (log) => sanitizeTelemetryValue(log),
    beforeSendMetric: (metric) => sanitizeTelemetryValue(metric),
  };
}

function boundedString(value, maxLength = 8_192) {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, maxLength);
}

function requestIp(req) {
  const forwarded = req?.headers?.['fly-client-ip'] ?? req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  return boundedString(first?.trim() || req?.socket?.remoteAddress, 128);
}

function requestContext(req, identity = {}) {
  const rawUrl = boundedString(req?.url) || '/';
  const method = boundedString(req?.method, 32) || 'UNKNOWN';
  const user = identity?.user && typeof identity.user === 'object' ? identity.user : null;
  const orgIds = Array.isArray(identity?.orgIds)
    ? identity.orgIds.filter((value) => typeof value === 'string').slice(0, 100)
    : [];
  const sentryUser = user ? sanitizeTelemetryValue({
    id: boundedString(user.id, 256),
    email: boundedString(user.email, 512),
    username: boundedString(user.full_name || user.email, 512),
    ip_address: requestIp(req),
    role: boundedString(user.role, 128),
    account_status: boundedString(user.account_status, 128),
  }) : (requestIp(req) ? { ip_address: requestIp(req) } : null);

  return Object.freeze({
    method,
    rawUrl,
    url: redactUrl(rawUrl),
    routeFamily: classifyRouteFamily(rawUrl),
    user: sentryUser,
    identity: sanitizeTelemetryValue({
      authenticated: Boolean(user),
      user_id: user?.id,
      email: user?.email,
      full_name: user?.full_name,
      role: user?.role,
      account_status: user?.account_status,
      org_ids: orgIds,
    }),
    request: sanitizeTelemetryValue({
      method,
      url: redactUrl(rawUrl),
      headers: sanitizeHeaders(req?.headers || {}),
      ip_address: requestIp(req),
      request_id: req?.headers?.['fly-request-id'] || req?.headers?.['x-request-id'],
    }),
  });
}

function applyContextToScope(scope, context, statusCode) {
  if (!scope || !context) return;
  scope.setUser?.(context.user);
  scope.setTag?.('route_family', context.routeFamily);
  scope.setTag?.('http.method', context.method);
  if (Number.isInteger(statusCode)) scope.setTag?.('http.status_code', String(statusCode));
  scope.setContext?.('assesssuite_identity', context.identity);
  scope.setContext?.('assesssuite_request', context.request);
  if (context.response) scope.setContext?.('assesssuite_response', context.response);
  scope.setFingerprint?.(['assesssuite-http', context.routeFamily, String(statusCode || 'request')]);
}

export function createErrorTelemetry({
  environment = process.env,
  sdk = Sentry,
  profilingIntegrationFactory = defaultProfilingIntegrationFactory,
} = {}) {
  const configuration = productionConfiguration(environment);
  const requestContexts = new WeakMap();
  const responseRequests = new WeakMap();
  const responseContexts = new WeakMap();
  const requestsWithCapturedException = new WeakSet();
  let enabled = false;

  if (configuration) {
    try {
      sdk.init(buildSentryOptions({ configuration, sdk, profilingIntegrationFactory }));
      enabled = typeof sdk.isEnabled === 'function' ? Boolean(sdk.isEnabled()) : true;
    } catch {
      enabled = false;
    }
  }

  function withCapturedContext(context, statusCode, callback) {
    if (!enabled || !context || typeof callback !== 'function') return false;
    try {
      if (typeof sdk.withScope === 'function') {
        sdk.withScope((scope) => {
          applyContextToScope(scope, context, statusCode);
          callback();
        });
      } else {
        callback();
      }
      return true;
    } catch {
      return false;
    }
  }

  function runIsolated(callback) {
    if (typeof callback !== 'function') return undefined;
    if (!enabled || typeof sdk.withIsolationScope !== 'function') return callback();
    let invoked = false;
    try {
      return sdk.withIsolationScope(() => {
        invoked = true;
        return callback();
      });
    } catch {
      // Observability must not stop request handling, including when scope
      // creation itself fails. Never execute a request callback twice.
      return invoked ? undefined : callback();
    }
  }

  function contextWithResponse(context, req) {
    const response = req && typeof req === 'object' ? responseContexts.get(req) : null;
    return response ? { ...context, response } : context;
  }

  function captureStatus(statusCode, routeFamily = 'unknown', contextOverride = null) {
    const status = Number(statusCode);
    if (!Number.isInteger(status) || status < 500 || status > 599 || !enabled) return false;
    const context = contextOverride || Object.freeze({
      method: 'UNKNOWN',
      url: '/',
      routeFamily: ROUTE_FAMILY_SET.has(routeFamily) ? routeFamily : 'unknown',
      user: null,
      identity: { authenticated: false, org_ids: [] },
      request: { method: 'UNKNOWN', url: '/' },
    });
    return withCapturedContext(context, status, () => {
      sdk.captureMessage?.(`HTTP ${status} response (${context.routeFamily})`, 'error');
    });
  }

  function captureException(error, req, res) {
    if (!enabled) return false;
    const context = contextWithResponse(requestContexts.get(req) || requestContext(req), req);
    if (req && typeof req === 'object') requestsWithCapturedException.add(req);
    return withCapturedContext(context, res?.statusCode, () => sdk.captureException?.(error));
  }

  function observe(req, res, identity = {}) {
    if (!enabled) return false;
    try {
      const context = requestContext(req, identity);
      if (req && typeof req === 'object') requestContexts.set(req, context);
      if (res && typeof res === 'object' && req && typeof req === 'object') responseRequests.set(res, req);
      const scope = sdk.getIsolationScope?.() || sdk.getCurrentScope?.();
      applyContextToScope(scope, context);
      sdk.addBreadcrumb?.({
        category: 'http.request',
        type: 'http',
        level: 'info',
        message: `${context.method} ${context.url}`,
        data: context.request,
      });
      res?.once?.('finish', () => {
        try {
          const status = Number(res.statusCode);
          if (status >= 500 && status <= 599 && !requestsWithCapturedException.has(req)) {
            captureStatus(status, context.routeFamily, contextWithResponse(context, req));
          }
        } catch {
          // Completed responses cannot be affected by an observability failure.
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  function observeResponse(res, response) {
    if (!enabled || !res || typeof res !== 'object') return false;
    try {
      const cleanResponse = safeResponseContext(response);
      const req = responseRequests.get(res);
      if (req && typeof req === 'object') responseContexts.set(req, cleanResponse);
      const scope = sdk.getIsolationScope?.() || sdk.getCurrentScope?.();
      scope?.setContext?.('assesssuite_response', cleanResponse);
      sdk.addBreadcrumb?.({
        category: 'http.response',
        type: 'http',
        level: Number(cleanResponse.status_code) >= 500 ? 'error' : 'info',
        message: `HTTP ${cleanResponse.status_code || 'response'}`,
        data: cleanResponse,
      });
      const activeSpan = sdk.getActiveSpan?.();
      activeSpan?.setAttribute?.('assesssuite.response.status_code', cleanResponse.status_code);
      activeSpan?.setAttribute?.('assesssuite.response.content_type', cleanResponse.content_type);
      activeSpan?.setAttribute?.('assesssuite.response.body', JSON.stringify(cleanResponse.body));
      activeSpan?.setAttribute?.('assesssuite.response.body_bytes', cleanResponse.body_bytes);
      return true;
    } catch {
      return false;
    }
  }

  async function flush(timeoutMs = 2_000) {
    if (!enabled || typeof sdk.flush !== 'function') return false;
    try {
      return Boolean(await sdk.flush(timeoutMs));
    } catch {
      return false;
    }
  }

  return Object.freeze({
    enabled,
    captureException,
    captureStatus,
    flush,
    observe,
    observeResponse,
    runIsolated,
  });
}
