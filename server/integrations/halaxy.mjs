const HALAXY_ENDPOINTS = Object.freeze({
  au: 'https://au-api.halaxy.com/main',
  eu: 'https://eu-api.halaxy.com/main',
});

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 30_000;
const USER_AGENT = 'AssessSuite (support@assesssuite.com)';

export class HalaxyApiError extends Error {
  constructor(message, { code = 'halaxy_provider_error', status = 502, retryAfter = null } = {}) {
    super(message);
    this.name = 'HalaxyApiError';
    this.code = code;
    this.httpStatus = status;
    this.retryAfter = retryAfter;
  }
}

export function resolveHalaxyRegion(value) {
  const region = String(value || 'au').trim().toLowerCase();
  if (!Object.hasOwn(HALAXY_ENDPOINTS, region)) {
    throw new HalaxyApiError('Select a supported Halaxy data region.', {
      code: 'halaxy_region_invalid',
      status: 400,
    });
  }
  return region;
}

function requireCredential(value, name) {
  const clean = String(value || '').trim();
  if (!clean || clean.length > 512 || /[\r\n\0]/.test(clean)) {
    throw new HalaxyApiError(`A valid Halaxy ${name} is required.`, {
      code: 'halaxy_credentials_invalid',
      status: 400,
    });
  }
  return clean;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HalaxyApiError('Halaxy did not respond before the connection timed out.', {
        code: 'halaxy_timeout',
        status: 504,
      });
    }
    throw new HalaxyApiError('Halaxy could not be reached.', {
      code: 'halaxy_unreachable',
      status: 502,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readProviderResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HalaxyApiError('Halaxy returned an unreadable response.', {
      code: 'halaxy_invalid_response',
      status: 502,
    });
  }
}

function providerFailure(response, body) {
  if (response.status === 401 || response.status === 403) {
    return new HalaxyApiError('Halaxy rejected the saved API credentials or permissions.', {
      code: 'halaxy_authorization_failed',
      status: 422,
    });
  }
  if (response.status === 429) {
    return new HalaxyApiError('Halaxy rate-limited this request. Try again after the indicated delay.', {
      code: 'halaxy_rate_limited',
      status: 429,
      retryAfter: response.headers.get('retry-after'),
    });
  }
  const operationOutcome = Array.isArray(body?.issue)
    ? body.issue.map((issue) => issue?.diagnostics || issue?.details?.text).filter(Boolean).join('; ')
    : '';
  const suffix = operationOutcome ? ` ${operationOutcome.slice(0, 300)}` : '';
  return new HalaxyApiError(`Halaxy returned HTTP ${response.status}.${suffix}`.trim(), {
    code: 'halaxy_provider_rejected_request',
    status: 502,
  });
}

function retryDelayMs(response, attempt) {
  const retryAfter = String(response?.headers?.get?.('retry-after') || '').trim();
  if (retryAfter !== '') {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(250, Math.round(seconds * 1000)));
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(250, date - Date.now()));
    }
  }
  return Math.min(MAX_RETRY_DELAY_MS, 500 * (2 ** attempt));
}

function retryableStatus(status) {
  return status === 429 || [500, 502, 503, 504].includes(status);
}

function uncertainWriteFailure() {
  return new HalaxyApiError(
    'Halaxy did not confirm whether this write was applied. Review Halaxy before trying the export again.',
    { code: 'halaxy_write_outcome_uncertain', status: 502 },
  );
}

export function createHalaxyClient({
  clientId,
  clientSecret,
  region = 'au',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  sleepImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (typeof sleepImpl !== 'function') throw new TypeError('A sleep implementation is required');
  const retryLimit = Number.isSafeInteger(maxRetries) ? Math.min(Math.max(maxRetries, 0), 3) : DEFAULT_MAX_RETRIES;
  const resolvedRegion = resolveHalaxyRegion(region);
  const resolvedClientId = requireCredential(clientId, 'Client ID');
  const resolvedClientSecret = requireCredential(clientSecret, 'Client Secret');
  const baseUrl = HALAXY_ENDPOINTS[resolvedRegion];
  let token = null;
  let tokenExpiresAt = 0;

  async function providerRequest(url, options, { retrySafe = false } = {}) {
    for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
      try {
        const response = await fetchWithTimeout(fetchImpl, url, options, timeoutMs);
        const body = await readProviderResponse(response);
        if (response.ok) return { response, body };
        if (retrySafe && attempt < retryLimit && retryableStatus(response.status)) {
          await sleepImpl(retryDelayMs(response, attempt));
          continue;
        }
        if (!retrySafe && [500, 502, 503, 504].includes(response.status)) {
          throw uncertainWriteFailure();
        }
        throw providerFailure(response, body);
      } catch (error) {
        const retryableNetworkFailure = error instanceof HalaxyApiError
          && ['halaxy_timeout', 'halaxy_unreachable'].includes(error.code);
        const ambiguousWriteResponse = error instanceof HalaxyApiError
          && error.code === 'halaxy_invalid_response';
        if (!retrySafe && (retryableNetworkFailure || ambiguousWriteResponse)) {
          throw uncertainWriteFailure();
        }
        if (!retryableNetworkFailure || attempt >= retryLimit) throw error;
        await sleepImpl(Math.min(MAX_RETRY_DELAY_MS, 500 * (2 ** attempt)));
      }
    }
    throw new HalaxyApiError('Halaxy could not complete the request.', { code: 'halaxy_retry_exhausted' });
  }

  async function authenticate() {
    if (token && Date.now() < tokenExpiresAt - 30_000) return token;
    const { body } = await providerRequest(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: resolvedClientId,
        client_secret: resolvedClientSecret,
      }),
    }, { retrySafe: true });
    const accessToken = String(body?.access_token || '').trim();
    if (!accessToken) {
      throw new HalaxyApiError('Halaxy did not return an access token.', {
        code: 'halaxy_token_missing',
        status: 502,
      });
    }
    const expiresIn = Math.min(Math.max(Number(body?.expires_in) || 900, 60), 3600);
    token = accessToken;
    tokenExpiresAt = Date.now() + expiresIn * 1000;
    return token;
  }

  async function request(pathname, { method = 'GET', body = null, headers = {} } = {}) {
    const safePath = String(pathname || '');
    if (!safePath.startsWith('/') || safePath.startsWith('//') || /[\r\n\0]/.test(safePath)) {
      throw new TypeError('Halaxy resource path is invalid');
    }
    const accessToken = await authenticate();
    const normalizedMethod = String(method || 'GET').toUpperCase();
    const retrySafe = ['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod);
    const { response, body: responseBody } = await providerRequest(`${baseUrl}${safePath}`, {
      method: normalizedMethod,
      headers: {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
        ...headers,
      },
      ...(body == null ? {} : { body: JSON.stringify(body) }),
    }, { retrySafe });
    return {
      body: responseBody,
      status: response.status,
      rateLimit: {
        limit: Number(response.headers.get('x-ratelimit-limit')) || null,
        remaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
      },
      etag: response.headers.get('etag') || null,
    };
  }

  async function testConnection() {
    // A one-row Patient search proves both OAuth and the practice's Patient
    // permission while deliberately returning no patient details to the UI.
    const result = await request('/Patient?_count=1&_summary=count');
    return {
      connected: true,
      region: resolvedRegion,
      fhirVersion: 'R4B',
      patientReadAvailable: true,
      visiblePatientCount: Number.isFinite(Number(result.body?.total))
        ? Number(result.body.total)
        : null,
      rateLimit: result.rateLimit,
    };
  }

  return Object.freeze({ authenticate, request, testConnection, region: resolvedRegion, baseUrl });
}

export const HALAXY_REGIONS = Object.freeze({ ...HALAXY_ENDPOINTS });
