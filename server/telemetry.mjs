// Minimal, dependency-free server error telemetry.
//
// This module deliberately observes only the final HTTP status. It never
// receives response bodies, request bodies, headers, identities or exception
// objects, and it reduces request URLs to one of the finite route families
// below before constructing an event.

import https from 'node:https';
import { randomUUID } from 'node:crypto';

const COALESCE_WINDOW_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 1_500;
const OBSERVED_CLIENT_REJECTIONS = new Set([409, 413, 422, 429]);
const EXACT_RELEASE = /^[0-9a-f]{40}$/i;
const APPROVED_SENTRY_HOST = 'o4511822688813056.ingest.us.sentry.io';
const APPROVED_SENTRY_PROJECT_ID = '4511827129663488';

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

const ROUTE_FAMILY_SET = new Set(ROUTE_FAMILIES);
const UNINITIALIZED = Symbol('uninitialized-sentry-configuration');

function pathnameFromRequestTarget(target) {
  if (
    typeof target !== 'string' ||
    !target.startsWith('/') ||
    target.length === 0 ||
    target.length > 8_192
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
    /^\/api\/apps\/[^/]+\/analytics\/track\/batch$/.test(pathname) ||
    /^\/api\/app-logs\/[^/]+\/log-user-in-app\/[^/]+$/.test(pathname)
  ) return 'telemetry_stub';
  if (/^\/api\/apps\/public\/prod\/public-settings\/by-id\/[^/]+$/.test(pathname)) {
    return 'public_settings';
  }
  if (pathname.startsWith('/uploads/') || pathname.startsWith('/api/files/')) return 'files';
  if (
    /^\/api\/apps\/[^/]+\/auth\/[^/]+$/.test(pathname) ||
    pathname === '/api/apps/auth/logout' ||
    /^\/api\/apps\/[^/]+\/(?:users|runtime\/users)\/invite-user$/.test(pathname)
  ) return 'auth';
  if (/^\/api\/apps\/[^/]+\/entities(?:\/|$)/.test(pathname)) return 'entities';
  if (
    /^\/api\/apps\/[^/]+\/functions\/[^/]+$/.test(pathname) ||
    /^\/functions\/[^/]+$/.test(pathname)
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
    dsn.protocol !== 'https:' ||
    dsn.hostname !== APPROVED_SENTRY_HOST ||
    dsn.search ||
    dsn.hash ||
    dsn.password ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(dsn.username)
  ) return null;

  const pathSegments = dsn.pathname.split('/').filter(Boolean);
  const projectId = pathSegments.pop();
  if (projectId !== APPROVED_SENTRY_PROJECT_ID || pathSegments.length !== 0) return null;

  const prefix = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
  const endpoint = new URL(`${prefix}/api/${projectId}/envelope/`, dsn.origin);
  return Object.freeze({ endpoint, publicKey: dsn.username });
}

function safeRelease(environment) {
  const candidate = environment.RELEASE_SHA;
  if (typeof candidate !== 'string' || !EXACT_RELEASE.test(candidate)) return null;
  const release = candidate.toLowerCase();
  if (environment.SENTRY_RELEASE !== undefined && environment.SENTRY_RELEASE !== release) return null;
  return release;
}

function safeEnvironment(environment) {
  if (environment.NODE_ENV !== 'production') return null;
  if (environment.SENTRY_ENVIRONMENT !== undefined && environment.SENTRY_ENVIRONMENT !== 'production') return null;
  return 'production';
}

function normalizeStatus(status) {
  if (!Number.isInteger(status)) return null;
  if (status >= 500 && status <= 599) return status;
  return OBSERVED_CLIENT_REJECTIONS.has(status) ? status : null;
}

function buildEvent({ eventId, timestamp, release, environment, status, routeFamily }) {
  const serverError = status >= 500;
  return {
    event_id: eventId,
    timestamp,
    platform: 'node',
    level: serverError ? 'error' : 'warning',
    release,
    environment,
    tags: {
      status: String(status),
      error_class: serverError ? 'http_server_error' : 'http_request_rejected',
      route_family: ROUTE_FAMILY_SET.has(routeFamily) ? routeFamily : 'unknown',
    },
  };
}

function buildEnvelope(event) {
  const eventJson = JSON.stringify(event);
  return [
    JSON.stringify({ event_id: event.event_id }),
    JSON.stringify({ type: 'event', content_type: 'application/json', length: Buffer.byteLength(eventJson) }),
    eventJson,
    '',
  ].join('\n');
}

export function createSentryEnvelopeTransport({ requestImpl = https.request, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const boundedTimeout = Number.isFinite(timeoutMs)
    ? Math.min(5_000, Math.max(100, Math.trunc(timeoutMs)))
    : DEFAULT_TIMEOUT_MS;

  return function sendSentryEnvelope(configuration, envelope) {
    let request;
    try {
      request = requestImpl({
        protocol: 'https:',
        hostname: configuration.endpoint.hostname,
        port: configuration.endpoint.port || undefined,
        path: `${configuration.endpoint.pathname}${configuration.endpoint.search}`,
        method: 'POST',
        agent: false,
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'Content-Length': Buffer.byteLength(envelope),
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${configuration.publicKey}`,
        },
      }, (response) => {
        try {
          response.on('error', () => {});
          response.socket?.unref?.();
          response.resume();
        } catch {
          // Provider-response handling is deliberately silent and isolated.
        }
      });
      request.once('socket', (socket) => {
        try {
          socket.unref?.();
        } catch {
          // The socket lifecycle is never allowed to escape telemetry.
        }
      });
      request.once('error', () => {});
      request.setTimeout(boundedTimeout, () => {
        try {
          request.destroy();
        } catch {
          // Timeout cleanup remains best-effort.
        }
      });
      request.end(envelope);
    } catch {
      try {
        request?.destroy();
      } catch {
        // Telemetry transport is intentionally failure-isolated.
      }
    }
  };
}

export function createErrorTelemetry({
  environment = process.env,
  now = Date.now,
  randomId = randomUUID,
  transport = createSentryEnvelopeTransport(),
} = {}) {
  let configuration = UNINITIALIZED;
  let lastSentAt = Number.NEGATIVE_INFINITY;

  function getConfiguration() {
    if (configuration === UNINITIALIZED) {
      const sentry = parseSentryDsn(environment.SENTRY_DSN);
      const release = safeRelease(environment);
      const environmentName = safeEnvironment(environment);
      configuration = sentry && release && environmentName
        ? Object.freeze({ sentry, release, environment: environmentName })
        : null;
    }
    return configuration;
  }

  function captureStatus(statusCode, routeFamily) {
    const status = normalizeStatus(statusCode);
    if (status === null) return false;
    const configurationValue = getConfiguration();
    if (!configurationValue) return false;

    const currentTime = Number(now());
    if (!Number.isFinite(currentTime)) return false;
    if (currentTime - lastSentAt < COALESCE_WINDOW_MS) {
      return false;
    }

    const eventId = String(randomId()).replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(eventId)) return false;
    const event = buildEvent({
      eventId,
      timestamp: currentTime / 1_000,
      release: configurationValue.release,
      environment: configurationValue.environment,
      status,
      routeFamily,
    });
    const envelope = buildEnvelope(event);
    lastSentAt = currentTime;

    try {
      const result = transport(configurationValue.sentry, envelope);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      // An observability failure must never become an application failure.
    }
    return true;
  }

  function observe(req, res) {
    try {
      const routeFamily = classifyRouteFamily(req?.url);
      res.once('finish', () => {
        try {
          captureStatus(res.statusCode, routeFamily);
        } catch {
          // A response is already complete here; telemetry remains best-effort.
        }
      });
    } catch {
      // Non-standard response objects must not affect request handling.
    }
  }

  return Object.freeze({ captureStatus, observe });
}
