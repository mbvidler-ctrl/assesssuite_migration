/**
 * Small process-local fixed-window limiter for low-volume public endpoints.
 * The key store is bounded and fails closed for unseen keys at capacity, so a
 * key-spray cannot turn the limiter itself into an unbounded-memory sink.
 */
export function createFixedWindowRateLimiter({ limit, windowMs, maxKeys = 10_000 }) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be a positive integer');
  if (!Number.isFinite(windowMs) || windowMs < 1) throw new TypeError('windowMs must be positive');
  if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new TypeError('maxKeys must be a positive integer');

  const windows = new Map();

  function consume(rawKey, nowMs = Date.now()) {
    const key = String(rawKey || 'unknown').slice(0, 320);
    let state = windows.get(key);
    if (state && state.resetAtMs <= nowMs) {
      windows.delete(key);
      state = null;
    }

    if (!state && windows.size >= maxKeys) {
      for (const [candidateKey, candidate] of windows) {
        if (candidate.resetAtMs <= nowMs) windows.delete(candidateKey);
      }
      if (windows.size >= maxKeys) {
        return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000), reason: 'capacity' };
      }
    }

    if (!state) {
      state = { count: 0, resetAtMs: nowMs + windowMs };
      windows.set(key, state);
    }
    if (state.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((state.resetAtMs - nowMs) / 1000)),
        reason: 'limit',
      };
    }
    state.count += 1;
    return {
      allowed: true,
      remaining: limit - state.count,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAtMs - nowMs) / 1000)),
    };
  }

  return { consume };
}
