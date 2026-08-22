import { resolveActiveProfessionContract } from '../packages/profession-config/runtime.mjs';

const PHYSIO_PUBLIC_ORIGINS = Object.freeze([
  'https://assesssuite-physio-production.fly.dev',
  'https://physio.app.assesssuite.com',
]);
const PHYSIO_PUBLIC_ORIGIN_SET = new Set(PHYSIO_PUBLIC_ORIGINS);

function isLoopbackHostname(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export class PublicRequestOriginError extends Error {
  constructor(message, code = 'public_request_origin_rejected') {
    super(message);
    this.name = 'PublicRequestOriginError';
    this.code = code;
  }
}

function oneHeader(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (value === undefined) return null;
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new PublicRequestOriginError(`${name} must contain exactly one value`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(',')) {
    throw new PublicRequestOriginError(`${name} must contain exactly one value`);
  }
  return trimmed;
}

function exactOrigin(value, { production }) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new PublicRequestOriginError('public origin is malformed');
  }
  const localHttp = !production
    && parsed.protocol === 'http:'
    && isLoopbackHostname(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localHttp) {
    throw new PublicRequestOriginError('public origin must use HTTPS');
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/'
      || parsed.search || parsed.hash) {
    throw new PublicRequestOriginError('public origin must be an origin without credentials or path');
  }
  return parsed.origin;
}

function exactHost(value, { production }) {
  let parsed;
  try {
    parsed = new URL(`https://${value}`);
  } catch {
    throw new PublicRequestOriginError('public request host is malformed');
  }
  const localDevelopmentHost = !production && isLoopbackHostname(parsed.hostname);
  if (parsed.username || parsed.password || parsed.pathname !== '/'
      || parsed.search || parsed.hash || (parsed.port && !localDevelopmentHost)) {
    throw new PublicRequestOriginError('public request host is malformed');
  }
  return parsed.host.toLowerCase();
}

function productionTarget(environment) {
  if (environment.NODE_ENV !== 'production') return null;
  let contract;
  try {
    contract = resolveActiveProfessionContract(environment);
  } catch {
    throw new PublicRequestOriginError('production target identity is invalid');
  }
  const expectedOrigin = `https://${contract.profession.deployment.intendedAppHost}`;
  const configuredOrigin = exactOrigin(String(environment.APP_URL || ''), { production: true });
  if (configuredOrigin !== expectedOrigin) {
    throw new PublicRequestOriginError('APP_URL does not match the active production target');
  }
  return { contract, configuredOrigin };
}

/**
 * Resolves redirects from request metadata controlled by the Fly edge. In a
 * normal Physio production request every supplied host/proto/origin value must
 * agree on one of the two exact public origins. A malformed or foreign header
 * fails closed; it never falls through to APP_URL. APP_URL is used only where
 * no request metadata exists (for example, a server-owned recovery link).
 */
export function resolvePublicRequestOrigin({ request = null, environment = process.env } = {}) {
  const target = productionTarget(environment);
  const productionPhysio = target?.contract.professionId === 'physio';

  // EP production historically generated server-owned links from its sealed
  // APP_URL. Preserve that boundary: request Host/forwarded headers are never
  // an authority for a non-Physio production reset target.
  if (target && !productionPhysio) return target.configuredOrigin;

  const headers = request?.headers || null;
  const host = headers ? oneHeader(headers, 'host') : null;
  const forwardedHost = headers ? oneHeader(headers, 'x-forwarded-host') : null;
  const originHeader = headers ? oneHeader(headers, 'origin') : null;
  const forwardedProto = headers ? oneHeader(headers, 'x-forwarded-proto') : null;
  const flyForwardedProto = headers ? oneHeader(headers, 'fly-forwarded-proto') : null;
  const hasRequestMetadata = Boolean(
    host || forwardedHost || originHeader || forwardedProto || flyForwardedProto,
  );

  if (hasRequestMetadata) {
    const protos = [forwardedProto, flyForwardedProto]
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    if (new Set(protos).size > 1 || protos.some((value) => !['http', 'https'].includes(value))) {
      throw new PublicRequestOriginError('public request proxy protocols do not agree');
    }
    const hosts = [host, forwardedHost]
      .filter(Boolean)
      .map((value) => exactHost(value, { production: productionPhysio }));
    if (hosts.length === 0) {
      throw new PublicRequestOriginError('public request host is missing');
    }
    if (new Set(hosts).size !== 1) {
      throw new PublicRequestOriginError('public request host headers do not agree');
    }
    const hostname = new URL(`https://${hosts[0]}`).hostname;
    const localDevelopmentHost = !target && isLoopbackHostname(hostname);
    if (!target && !localDevelopmentHost) {
      throw new PublicRequestOriginError('development public request host must be loopback');
    }
    const protocol = protos[0] || (localDevelopmentHost ? 'http' : 'https');
    if (protocol !== 'https' && !localDevelopmentHost) {
      throw new PublicRequestOriginError('public request proxy protocol must be HTTPS');
    }
    const requestOrigin = `${protocol}://${hosts[0]}`;
    if (originHeader) {
      const suppliedOrigin = exactOrigin(originHeader, { production: productionPhysio });
      if (suppliedOrigin !== requestOrigin) {
        throw new PublicRequestOriginError('public request Origin does not match its host');
      }
    }
    if (productionPhysio && !PHYSIO_PUBLIC_ORIGIN_SET.has(requestOrigin)) {
      throw new PublicRequestOriginError('public request host is not approved for Physio');
    }
    return requestOrigin;
  }

  const configured = exactOrigin(String(environment.APP_URL || ''), {
    production: Boolean(target),
  });
  if (!target && !isLoopbackHostname(new URL(configured).hostname)) {
    throw new PublicRequestOriginError('development APP_URL must be loopback');
  }
  if (productionPhysio && !PHYSIO_PUBLIC_ORIGIN_SET.has(configured)) {
    throw new PublicRequestOriginError('APP_URL is not approved for Physio');
  }
  return configured;
}

export function physioPublicOrigins() {
  return [...PHYSIO_PUBLIC_ORIGINS];
}

/**
 * Builds the server-owned password-reset target without string concatenation.
 * The token is treated as an opaque bounded value and is encoded only through
 * URLSearchParams; callers cannot select a return host through body/query data.
 */
export function buildPublicResetUrl({
  request = null,
  environment = process.env,
  token,
} = {}) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 4096
      || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new PublicRequestOriginError('password reset token is invalid');
  }
  const target = new URL('/reset-password', resolvePublicRequestOrigin({ request, environment }));
  target.searchParams.set('token', token);
  return target.href;
}
