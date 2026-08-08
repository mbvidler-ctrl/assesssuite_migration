import { appParams } from "@/lib/app-params";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_LIMIT = 100;
const CONTENT_FIELD_PATTERN = /^(?:body|client_name|content|input|output|patient_name|payload|prompt|query|subject_name|text)$/i;

export class CoreApiError extends Error {
  constructor(message, { code = "CORE_REQUEST_FAILED", status = 0, retryable = false } = {}) {
    super(message);
    this.name = "CoreApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function isLocalOrigin(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function resolveCoreServerUrl(pathname) {
  if (typeof window === "undefined") {
    throw new CoreApiError("Core is only available in the browser.", { code: "CORE_BROWSER_REQUIRED" });
  }

  const configured = new URL(appParams.serverUrl || window.location.origin, window.location.origin);
  const pageOrigin = window.location.origin;
  if (configured.origin !== pageOrigin && !(isLocalOrigin(configured.origin) && isLocalOrigin(pageOrigin))) {
    throw new CoreApiError("The configured Core server origin is not permitted.", {
      code: "CORE_SERVER_ORIGIN_DENIED",
    });
  }

  return new URL(pathname, `${configured.origin}/`);
}

function assertContentFree(value, path = "response") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertContentFree(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (CONTENT_FIELD_PATTERN.test(key)) {
      throw new CoreApiError("Core returned a field that is not permitted in the assurance view.", {
        code: "CORE_RESPONSE_CONTENT_FIELD_DENIED",
      });
    }
    assertContentFree(child, `${path}.${key}`);
  }
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {unknown} value
 * @param {{ requestedLimit?: number }} [context]
 */
export function normaliseCoreAssuranceResponse(value, { requestedLimit = 25 } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CoreApiError("Core returned an invalid assurance response.", {
      code: "CORE_RESPONSE_INVALID",
    });
  }
  assertContentFree(value);

  const responseValue = /** @type {Record<string, unknown>} */ (value);
  const schema = objectOrEmpty(responseValue.schema);
  const environment = objectOrEmpty(responseValue.environment);
  const summary = objectOrEmpty(responseValue.summary);
  const publishedLimit = summary.limit;
  const windowLimit = Number.isSafeInteger(publishedLimit) && publishedLimit >= 1 && publishedLimit <= MAX_LIMIT
    ? publishedLimit
    : Math.min(MAX_LIMIT, Math.max(1, Number.isSafeInteger(requestedLimit) ? requestedLimit : 25));
  return Object.freeze({
    schema: Object.freeze({
      version: typeof schema.version === "string" ? schema.version : null,
      checksum: typeof schema.checksum === "string" ? schema.checksum : null,
    }),
    environment: Object.freeze({
      mode: typeof environment.mode === "string" ? environment.mode : "sandbox",
      production_enabled: environment.production_enabled === true,
    }),
    summary: Object.freeze({ ...summary }),
    windowLimit,
    capabilities: Object.freeze(arrayOrEmpty(responseValue.capabilities)),
    config_versions: Object.freeze(arrayOrEmpty(responseValue.config_versions)),
    runs: Object.freeze(arrayOrEmpty(responseValue.runs)),
    artifacts: Object.freeze(arrayOrEmpty(responseValue.artifacts)),
    reviews: Object.freeze(arrayOrEmpty(responseValue.reviews)),
    jobs: Object.freeze(arrayOrEmpty(responseValue.jobs)),
  });
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new CoreApiError("Core returned a non-JSON response.", {
      code: "CORE_RESPONSE_NOT_JSON",
      status: response.status,
      retryable: response.status >= 500,
    });
  }
  try {
    return await response.json();
  } catch {
    throw new CoreApiError("Core returned malformed JSON.", {
      code: "CORE_RESPONSE_INVALID_JSON",
      status: response.status,
      retryable: response.status >= 500,
    });
  }
}

/**
 * @param {{
 *   orgId?: string,
 *   limit?: number,
 *   signal?: AbortSignal,
 *   timeoutMs?: number,
 * }} [options]
 */
export async function fetchCoreAssurance({ orgId, limit = 25, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof orgId !== "string" || !orgId.trim()) {
    throw new CoreApiError("Select an organisation to view Core assurance.", { code: "CORE_ORG_REQUIRED" });
  }
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number.isSafeInteger(limit) ? limit : 25));
  const url = resolveCoreServerUrl("/api/core/v1/admin/assurance");
  url.searchParams.set("org_id", orgId.trim());
  url.searchParams.set("limit", String(safeLimit));

  const token = window.localStorage.getItem("base44_access_token");
  if (!token) {
    throw new CoreApiError("Your session is unavailable. Sign in again.", {
      code: "CORE_SESSION_REQUIRED",
      status: 401,
    });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), Math.min(30_000, Math.max(1_000, timeoutMs)));
  const abortFromCaller = () => controller.abort("cancelled");
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-App-Id": appParams.appId,
      },
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    const payload = await readJson(response);
    if (!response.ok) {
      const status = response.status;
      const knownCode = typeof payload?.error?.code === "string"
        ? payload.error.code
        : typeof payload?.code === "string" ? payload.code : "CORE_REQUEST_FAILED";
      throw new CoreApiError(
        status === 403 ? "Admin access to Core assurance was denied."
          : status === 404 ? "Core assurance is not available on this server."
            : "Core assurance could not be loaded.",
        { code: knownCode, status, retryable: status >= 500 || status === 429 },
      );
    }
    return normaliseCoreAssuranceResponse(payload, { requestedLimit: safeLimit });
  } catch (error) {
    if (error instanceof CoreApiError) throw error;
    if (controller.signal.aborted) {
      throw new CoreApiError(
        signal?.aborted ? "Core assurance loading was cancelled." : "Core assurance timed out.",
        { code: signal?.aborted ? "CORE_REQUEST_CANCELLED" : "CORE_REQUEST_TIMEOUT", retryable: !signal?.aborted },
      );
    }
    throw new CoreApiError("Core assurance is unavailable.", {
      code: "CORE_NETWORK_UNAVAILABLE",
      retryable: true,
    });
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
