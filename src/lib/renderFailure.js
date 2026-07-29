// Pure logic behind src/components/system/RootErrorBoundary.jsx, split out
// so it is genuinely testable offline: node --test cannot import a .jsx file,
// and React 18's server renderToString does not run error boundaries, so no
// jsdom/react-dom-server path exists to exercise the boundary directly.

export const MAX_RENDER_FAILURE_MESSAGE = 200;
export const INITIAL_RENDER_FAILURE_STATE = Object.freeze({ failure: null, resetToken: 0 });

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Runs of 7+ digits, optionally separated by single spaces or hyphens
// (e.g. a phone number or a record/reference id).
const LONG_DIGIT_RUN_PATTERN = /\d(?:[ -]?\d){6,}/g;
const DATE_DDMMYYYY_PATTERN = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
const DATE_YYYYMMDD_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;

/**
 * Deliberately a small local copy of the three highest-risk patterns from
 * server/llm.mjs's deidentify() — server code must never be imported into
 * the browser bundle, so this is a narrower, console-log-only guard, not a
 * substitute for the server-side de-identification applied before any
 * provider egress.
 */
export function redactRenderFailureText(text) {
  return String(text)
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(DATE_DDMMYYYY_PATTERN, '[REDACTED_DATE]')
    .replace(DATE_YYYYMMDD_PATTERN, '[REDACTED_DATE]')
    .replace(LONG_DIGIT_RUN_PATTERN, '[REDACTED_ID]');
}

export function describeRenderFailure(error) {
  const isErrorInstance = error instanceof Error;
  const name = isErrorInstance && typeof error.name === 'string' && error.name ? error.name : 'Error';
  const rawMessage = isErrorInstance ? error.message : (error ?? '');
  const redacted = redactRenderFailureText(String(rawMessage ?? ''));
  const message = redacted.length > MAX_RENDER_FAILURE_MESSAGE
    ? `${redacted.slice(0, MAX_RENDER_FAILURE_MESSAGE)}…`
    : redacted;
  return { name, message };
}

export function nextRenderFailureState(error) {
  return { failure: describeRenderFailure(error) };
}

export function clearRenderFailureState(previous) {
  return { failure: null, resetToken: (previous?.resetToken ?? 0) + 1 };
}
