import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPublicResetUrl,
  physioPublicOrigins,
  resolvePublicRequestOrigin,
} from '../publicRequestOrigin.mjs';

const PHYSIO = Object.freeze({
  NODE_ENV: 'production',
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  APP_URL: 'https://physio.app.assesssuite.com',
});

for (const origin of physioPublicOrigins()) {
  test(`admits the exact Physio public origin ${origin}`, () => {
    const host = new URL(origin).host;
    assert.equal(resolvePublicRequestOrigin({
      request: { headers: {
        host,
        origin,
        'x-forwarded-host': host,
        'x-forwarded-proto': 'https',
        'fly-forwarded-proto': 'https',
      } },
      environment: PHYSIO,
    }), origin);
  });
}

test('rejects foreign, split, downgraded and comma-joined request metadata', () => {
  for (const headers of [
    { host: 'attacker.invalid', origin: 'https://attacker.invalid' },
    { host: 'physio.app.assesssuite.com', 'x-forwarded-host': 'assesssuite-physio-production.fly.dev' },
    { host: 'physio.app.assesssuite.com', origin: 'https://assesssuite-physio-production.fly.dev' },
    { host: 'physio.app.assesssuite.com', 'x-forwarded-proto': 'http' },
    { host: 'physio.app.assesssuite.com,attacker.invalid' },
  ]) {
    assert.throws(() => resolvePublicRequestOrigin({ request: { headers }, environment: PHYSIO }));
  }
});

test('uses only a validated APP_URL when no request metadata exists', () => {
  assert.equal(resolvePublicRequestOrigin({ environment: PHYSIO }), PHYSIO.APP_URL);
  assert.throws(() => resolvePublicRequestOrigin({
    environment: { ...PHYSIO, APP_URL: 'https://attacker.invalid' },
  }));
});

test('permits explicit HTTP only for exact loopback development hosts', () => {
  const environment = {
    NODE_ENV: 'development',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    APP_URL: 'http://localhost:5173',
  };
  assert.equal(resolvePublicRequestOrigin({
    request: { headers: {
      host: 'localhost:5173',
      origin: 'http://localhost:5173',
      'x-forwarded-host': 'localhost:5173',
      'x-forwarded-proto': 'http',
    } },
    environment,
  }), 'http://localhost:5173');
  assert.throws(() => resolvePublicRequestOrigin({
    request: { headers: {
      host: 'example.test:5173',
      'x-forwarded-host': 'example.test:5173',
      'x-forwarded-proto': 'http',
    } },
    environment,
  }));
  assert.throws(() => resolvePublicRequestOrigin({
    request: { headers: {
      host: 'example.test',
      'x-forwarded-host': 'example.test',
      'x-forwarded-proto': 'https',
    } },
    environment,
  }));
  assert.throws(() => resolvePublicRequestOrigin({
    environment: { ...environment, APP_URL: 'https://example.test' },
  }));
});

test('EP production ignores hostile request routing metadata and requires its exact configured target', () => {
  const environment = {
    NODE_ENV: 'production',
    PROFESSION: 'exercise-physiology',
    DEFAULT_APP_ID: 'local-assesssuite',
    APP_URL: 'https://app.assesssuite.com',
  };
  assert.equal(resolvePublicRequestOrigin({
    request: { headers: {
      host: 'attacker.invalid',
      origin: 'https://attacker.invalid',
      'x-forwarded-host': 'attacker.invalid',
      'x-forwarded-proto': 'https',
    } },
    environment,
  }), environment.APP_URL);
  for (const invalid of [
    { APP_URL: '' },
    { APP_URL: 'https://attacker.invalid' },
    { APP_URL: 'http://app.assesssuite.com' },
    { DEFAULT_APP_ID: 'local-assesssuite-physio' },
  ]) {
    assert.throws(() => resolvePublicRequestOrigin({
      request: { headers: { host: 'app.assesssuite.com' } },
      environment: { ...environment, ...invalid },
    }));
  }
});

test('builds a bounded encoded reset URL on the resolved server-owned origin', () => {
  const token = 'opaque/fixture-token+with?reserved=characters';
  const target = new URL(buildPublicResetUrl({ environment: PHYSIO, token }));
  assert.equal(target.origin, PHYSIO.APP_URL);
  assert.equal(target.pathname, '/reset-password');
  assert.equal(target.searchParams.get('token'), token);
  assert.throws(() => buildPublicResetUrl({ environment: PHYSIO, token: 'too-short' }));
});
