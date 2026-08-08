import { createHash } from 'node:crypto';

import { CoreContractError } from './errors.mjs';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_NODES = 50_000;

function normalizeJsonValue(value, state, depth) {
  state.nodes += 1;
  if (state.nodes > state.maxNodes) {
    throw new CoreContractError('CORE_JSON_TOO_LARGE', 'JSON value exceeds the node limit');
  }
  if (depth > state.maxDepth) {
    throw new CoreContractError('CORE_JSON_TOO_DEEP', 'JSON value exceeds the depth limit');
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CoreContractError('CORE_INVALID_JSON', 'JSON numbers must be finite');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') {
    throw new CoreContractError('CORE_INVALID_JSON', 'Value must be JSON-compatible');
  }
  if (state.seen.has(value)) {
    throw new CoreContractError('CORE_INVALID_JSON', 'JSON value must not contain cycles');
  }
  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeJsonValue(item, state, depth + 1));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new CoreContractError('CORE_INVALID_JSON', 'JSON objects must use a plain prototype');
    }
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new CoreContractError('CORE_INVALID_JSON_KEY', 'JSON contains a forbidden key');
      }
      normalized[key] = normalizeJsonValue(value[key], state, depth + 1);
    }
    return normalized;
  } finally {
    state.seen.delete(value);
  }
}

/** Returns a detached JSON value with object keys in canonical order. */
export function normalizeJson(value, { maxDepth = DEFAULT_MAX_DEPTH, maxNodes = DEFAULT_MAX_NODES } = {}) {
  return normalizeJsonValue(
    value,
    { maxDepth, maxNodes, nodes: 0, seen: new WeakSet() },
    0,
  );
}

export function canonicalJson(value, limits) {
  return JSON.stringify(normalizeJson(value, limits));
}

export function sha256CanonicalJson(value, limits) {
  return `sha256:${createHash('sha256').update(canonicalJson(value, limits)).digest('hex')}`;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
