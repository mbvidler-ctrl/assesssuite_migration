import { APPROVED_LANDING_LEGAL_PATHS } from './approvedLegalDocuments.js';

const PRODUCTION_HOSTS = new Set(['assesssuite.com', 'www.assesssuite.com']);
const PUBLIC_LEGAL_PATHS = new Set(APPROVED_LANDING_LEGAL_PATHS);

function isApprovedPublicPath(pathname) {
  if (pathname === '/') return true;
  const canonicalPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return PUBLIC_LEGAL_PATHS.has(canonicalPath);
}

/**
 * Fail-closed Vercel Web Analytics filter. Only public marketing/legal paths on
 * the production hosts are measured. Query strings and fragments are removed
 * from the measured page URL. Vercel may separately process the browser's
 * external referrer as disclosed in the public analytics notice.
 */
export function sanitiseAnalyticsEvent(event, currentOrigin = window.location.origin) {
  try {
    if (event?.type !== 'pageview') return null;
    const url = new URL(event?.url || '/', currentOrigin);
    if (url.protocol !== 'https:' || !PRODUCTION_HOSTS.has(url.hostname) || !isApprovedPublicPath(url.pathname)) {
      return null;
    }

    return {
      ...event,
      url: `${url.origin}${url.pathname}`,
    };
  } catch {
    return null;
  }
}
