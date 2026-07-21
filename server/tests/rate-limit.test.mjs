import assert from 'node:assert/strict';
import test from 'node:test';

import { createFixedWindowRateLimiter } from '../rateLimit.mjs';

test('fixed-window limiter enforces a bounded window and resets deterministically', () => {
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1_000, maxKeys: 10 });
  assert.equal(limiter.consume('client-a', 1_000).allowed, true);
  assert.equal(limiter.consume('client-a', 1_001).allowed, true);
  assert.deepEqual(limiter.consume('client-a', 1_002), {
    allowed: false,
    retryAfterSeconds: 1,
    reason: 'limit',
  });
  assert.equal(limiter.consume('client-a', 2_000).allowed, true);
});

test('fixed-window limiter fails closed at key capacity without evicting a live key', () => {
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1_000, maxKeys: 1 });
  assert.equal(limiter.consume('client-a', 1_000).allowed, true);
  assert.equal(limiter.consume('client-b', 1_001).allowed, false);
  assert.equal(limiter.consume('client-a', 1_002).allowed, true);
  assert.equal(limiter.consume('client-b', 2_001).allowed, true);
});
