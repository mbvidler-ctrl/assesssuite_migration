const MAX_PUBLIC_DETAILS_LENGTH = 500;
const MAX_TOKEN_LENGTH = 80;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object';
}

function normalizePublicText(value, maximumLength = MAX_PUBLIC_DETAILS_LENGTH) {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, maximumLength);
}

function normalizeToken(value, fallback) {
  const normalized = normalizePublicText(value, MAX_TOKEN_LENGTH);
  if (!normalized || !/^[A-Za-z0-9_.:-]+$/.test(normalized)) return fallback;
  return normalized;
}

function normalizeStatus(value) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function normalizeDiagnosticReference(...values) {
  const diagnosticReference = values.find(
    (value) => typeof value === 'string' && UUID_V4_PATTERN.test(value),
  );
  return diagnosticReference || null;
}

function responseData(response) {
  return isRecord(response) && isRecord(response.data) ? response.data : null;
}

function publicDetailsFrom(data) {
  if (!data) return null;
  // These are the server-controlled, user-facing fields used by the migration
  // shim and common Axios APIs. Never fall back to serialising the response.
  return normalizePublicText(data.details)
    || normalizePublicText(data.detail)
    || normalizePublicText(data.error)
    || normalizePublicText(data.message);
}

/**
 * Normalise the installed Base44 SDK's Base44Error contract while retaining
 * Axios compatibility. The returned object deliberately excludes response
 * bodies, request configuration, filenames and submitted clinical data.
 *
 * @param {unknown} error
 * @param {{stage?: string, fallbackDetails?: string}} [options]
 * @returns {{stage: string, status: number|null, code: string, diagnosticReference: string|null, details: string}}
 */
export function normalizeSdkError(error, options = {}) {
  const source = isRecord(error) ? error : {};
  const sdkData = isRecord(source.data) ? source.data : null;
  const axiosResponse = isRecord(source.response) ? source.response : null;
  const axiosData = responseData(axiosResponse);
  const originalError = isRecord(source.originalError) ? source.originalError : null;
  const originalResponse = originalError && isRecord(originalError.response)
    ? originalError.response
    : null;
  const originalData = responseData(originalResponse);

  const status = normalizeStatus(source.status)
    ?? normalizeStatus(axiosResponse?.status)
    ?? normalizeStatus(originalResponse?.status);
  const code = normalizeToken(
    source.code || sdkData?.code || axiosData?.code || originalData?.code,
    status ? `http_${status}` : 'request_failed',
  );
  const fallbackDetails = normalizePublicText(options.fallbackDetails)
    || 'The request could not be completed.';

  return {
    stage: normalizeToken(options.stage, 'request'),
    status,
    code,
    diagnosticReference: normalizeDiagnosticReference(
      source.diagnostic_reference,
      sdkData?.diagnostic_reference,
      axiosData?.diagnostic_reference,
      originalData?.diagnostic_reference,
    ),
    details: publicDetailsFrom(sdkData)
      || publicDetailsFrom(axiosData)
      || publicDetailsFrom(originalData)
      || fallbackDetails,
  };
}

/**
 * Return content-free fields suitable for browser and platform logging.
 * Public details are intentionally omitted because they may describe a
 * clinical workflow even though they are safe to show to the current user.
 */
export function sdkErrorLogMetadata(error, options = {}) {
  const { stage, status, code, diagnosticReference } = normalizeSdkError(error, options);
  return { stage, status, code, diagnosticReference };
}
