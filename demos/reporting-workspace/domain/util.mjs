// Shared utilities for the reporting-workflow demo domain.
//
// Everything here is deterministic and side-effect free. Hashing uses
// node:crypto, so this module is server-side only; browser code imports the
// dependency-free modules (reportTypes.mjs, states.mjs) instead.

import { createHash } from 'node:crypto';

export class WorkflowError extends Error {
  constructor(status, code, message, detail = undefined) {
    super(message);
    this.name = 'WorkflowError';
    this.status = status;
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

export function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Canonical JSON: object keys sorted recursively, arrays preserved in order. */
export function canonicalJson(value) {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function sha256Canonical(value) {
  return sha256Hex(canonicalJson(value));
}

export function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

export function dateOnly(value) {
  if (!value) return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}

/**
 * Deterministic dd/MM/yyyy formatting from an ISO date or date-time string.
 * Parses the string components directly so the output does not depend on the
 * host time zone (a Date-based formatter can shift a date-only value by a day).
 */
export function formatDateDisplay(value) {
  const day = dateOnly(value);
  if (!day) return '';
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

/** Deterministic dd/MM/yyyy HH:mm (UTC) from an ISO date-time string. */
export function formatDateTimeDisplay(value) {
  const text = String(value || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
  if (!match) return formatDateDisplay(text);
  const [, year, month, date, hours, minutes] = match;
  return `${date}/${month}/${year} ${hours}:${minutes} UTC`;
}

/** Remove C0 control characters except tab, line feed and carriage return, and DEL. */
function stripControlCharacters(value) {
  let output = '';
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) continue;
    output += character;
  }
  return output;
}

export function trimmedString(value, { max = 4000 } = {}) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return '';
  const normalised = stripControlCharacters(value).trim();
  return normalised.length > max ? normalised.slice(0, max) : normalised;
}

export function requireString(value, name, { max = 4000, min = 1 } = {}) {
  if (typeof value !== 'string') {
    throw new WorkflowError(400, 'invalid_request', `${name} must be text.`);
  }
  const normalised = trimmedString(value, { max: max + 1 });
  if (normalised.length < min) {
    throw new WorkflowError(400, 'invalid_request', `${name} is required.`);
  }
  if (normalised.length > max) {
    throw new WorkflowError(413, 'invalid_request', `${name} exceeds the ${max}-character limit.`);
  }
  return normalised;
}

export function optionalString(value, name, { max = 4000 } = {}) {
  if (value === undefined || value === null || value === '') return '';
  return requireString(value, name, { max, min: 0 });
}

export function requireDate(value, name) {
  const day = dateOnly(value);
  if (!day || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    throw new WorkflowError(400, 'invalid_request', `${name} must be a YYYY-MM-DD date.`);
  }
  return day;
}

export function requireStringArray(value, name, { maxItems = 20, maxLength = 1000 } = {}) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new WorkflowError(400, 'invalid_request', `${name} must be a list.`);
  }
  if (value.length > maxItems) {
    throw new WorkflowError(413, 'invalid_request', `${name} exceeds the ${maxItems}-item limit.`);
  }
  return value
    .map((entry, index) => requireString(entry, `${name}[${index}]`, { max: maxLength, min: 0 }))
    .filter((entry) => entry.length > 0);
}

export function assertKnownKeys(body, allowed, label = 'request') {
  if (!isPlainObject(body)) {
    throw new WorkflowError(400, 'invalid_request', `The ${label} body must be an object.`);
  }
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new WorkflowError(
      400,
      'unknown_parameters',
      `Unknown ${label} parameter${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`,
    );
  }
  return body;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toFiniteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function sortBy(items, keyFn) {
  return [...items].sort((a, b) => {
    const left = keyFn(a);
    const right = keyFn(b);
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}
