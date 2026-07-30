// Admission control for the general clinical InvokeLLM endpoint.
//
// Mirrors the document-extraction admission discipline
// (server/integrations.mjs acquireExtractionSlot / boundedConcurrency) for
// the one other endpoint that spends a real provider API key: a bounded
// per-account and global concurrency cap, a per-account fixed-window rate
// limit, and a prompt/schema size ceiling. Kept in its own zero-dependency
// module (only server/rateLimit.mjs) so it can be unit-tested without
// importing the much larger server/integrations.mjs.
//
// All numeric settings below are read raw from process.env — none of these
// names end in `_ENABLED`, and none are capability/posture switches, so they
// are outside the scope of server/capabilityFlags.mjs's registry chokepoint
// (see scripts/flag-manifest.mjs's isCapabilityLikeName). This is the same
// treatment DOCUMENT_EXTRACTION_MAX_CONCURRENCY and its siblings already
// receive in server/integrations.mjs's boundedConcurrency().

import { createFixedWindowRateLimiter } from './rateLimit.mjs';

export class LlmAccessError extends Error {
  constructor(httpStatus, code, message) {
    super(message);
    this.name = 'LlmAccessError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.publicMessage = message;
  }
}

/**
 * Integer parse of environment[name]; a non-integer value or a value below
 * `min` falls back to `fallback` (never fails open past the bound), while a
 * value above `max` is clamped down to `max`. Same discipline as
 * server/integrations.mjs's boundedConcurrency, generalised to a
 * caller-supplied minimum.
 */
export function boundedSetting(environment, name, fallback, min, max) {
  const parsed = Number(environment ? environment[name] : undefined);
  if (!Number.isInteger(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

export const GENERAL_LLM_LIMITS = Object.freeze({
  globalConcurrency: { env: 'GENERAL_CLINICAL_LLM_MAX_CONCURRENCY', fallback: 4, min: 1, max: 8 },
  userConcurrency: { env: 'GENERAL_CLINICAL_LLM_USER_CONCURRENCY', fallback: 2, min: 1, max: 4 },
  userBurst: { env: 'GENERAL_CLINICAL_LLM_USER_BURST_LIMIT', fallback: 10, min: 1, max: 60 }, // per 60s
  userHourly: { env: 'GENERAL_CLINICAL_LLM_USER_HOURLY_LIMIT', fallback: 60, min: 1, max: 600 }, // per 3600s
  globalWindow: { env: 'GENERAL_CLINICAL_LLM_GLOBAL_LIMIT', fallback: 240, min: 1, max: 2000 }, // per 60s
  maxPromptChars: { env: 'GENERAL_CLINICAL_LLM_MAX_PROMPT_CHARS', fallback: 32_000, min: 2_000, max: 200_000 },
});

// Not env-tunable: a response schema this large is always a caller mistake,
// not a legitimate clinical request shape.
export const MAX_RESPONSE_SCHEMA_CHARS = 20_000;

function boundedFromSpec(environment, spec) {
  return boundedSetting(environment, spec.env, spec.fallback, spec.min, spec.max);
}

/**
 * Process-local concurrency admission: a global slot count and a per-account
 * slot count, exactly the shape of acquireExtractionSlot but without the org
 * dimension (InvokeLLM callers never send org_id — see server/integrations.mjs
 * handleInvokeLLM). acquire(userKey) either reserves a slot and returns an
 * idempotent release() function, or throws LlmAccessError(429, 'llm_busy').
 */
export function createGeneralLlmAdmission({ globalMax, userMax }) {
  let activeGlobal = 0;
  const activeByUser = new Map();

  function acquire(userKey) {
    if (activeGlobal >= globalMax || (activeByUser.get(userKey) || 0) >= userMax) {
      throw new LlmAccessError(429, 'llm_busy', 'AI generation is busy. Please try again shortly.');
    }
    activeGlobal += 1;
    activeByUser.set(userKey, (activeByUser.get(userKey) || 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeGlobal = Math.max(0, activeGlobal - 1);
      const userCount = Math.max(0, (activeByUser.get(userKey) || 1) - 1);
      if (userCount === 0) activeByUser.delete(userKey);
      else activeByUser.set(userKey, userCount);
    };
  }

  function active() {
    return { global: activeGlobal, users: new Map(activeByUser) };
  }

  return { acquire, active };
}

/**
 * Per-account fixed-window throttling with a global ceiling of last resort.
 * consume(userKey, nowMs) checks burst, then hourly, then the shared global
 * window, in that order — the per-user limiters are checked FIRST so one
 * account cannot silently burn the global window and lock out every other
 * clinician.
 */
export function createGeneralLlmThrottle(environment = process.env) {
  const burstLimiter = createFixedWindowRateLimiter({
    limit: boundedFromSpec(environment, GENERAL_LLM_LIMITS.userBurst),
    windowMs: 60_000,
    maxKeys: 5_000,
  });
  const hourlyLimiter = createFixedWindowRateLimiter({
    limit: boundedFromSpec(environment, GENERAL_LLM_LIMITS.userHourly),
    windowMs: 3_600_000,
    maxKeys: 5_000,
  });
  const globalLimiter = createFixedWindowRateLimiter({
    limit: boundedFromSpec(environment, GENERAL_LLM_LIMITS.globalWindow),
    windowMs: 60_000,
    maxKeys: 1,
  });

  function consume(userKey, nowMs = Date.now()) {
    for (const limiter of [burstLimiter, hourlyLimiter]) {
      const result = limiter.consume(userKey, nowMs);
      if (!result.allowed) {
        throw new LlmAccessError(
          429,
          'llm_rate_limited',
          `Too many AI generation requests. Try again in about ${result.retryAfterSeconds} seconds.`,
        );
      }
    }
    const globalResult = globalLimiter.consume('global', nowMs);
    if (!globalResult.allowed) {
      throw new LlmAccessError(
        429,
        'llm_rate_limited',
        `Too many AI generation requests. Try again in about ${globalResult.retryAfterSeconds} seconds.`,
      );
    }
  }

  return { burst: burstLimiter, hourly: hourlyLimiter, global: globalLimiter, consume };
}

/**
 * Prompt/schema size ceiling, checked before the rate limiter is consumed so
 * a junk-sized request is rejected without burning the caller's window.
 */
export function assertPromptWithinLimits({ prompt, schema }, environment = process.env) {
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    throw new LlmAccessError(400, 'prompt_required', 'Enter a prompt for AI generation.');
  }
  const maxPromptChars = boundedFromSpec(environment, GENERAL_LLM_LIMITS.maxPromptChars);
  if (prompt.length > maxPromptChars) {
    throw new LlmAccessError(413, 'prompt_too_large', 'This AI request is too long. Shorten the content and try again.');
  }
  if (schema) {
    let serialized;
    try {
      serialized = JSON.stringify(schema);
    } catch {
      throw new LlmAccessError(413, 'response_schema_too_large', 'The requested response format is too large.');
    }
    if (typeof serialized === 'string' && serialized.length > MAX_RESPONSE_SCHEMA_CHARS) {
      throw new LlmAccessError(413, 'response_schema_too_large', 'The requested response format is too large.');
    }
  }
}
