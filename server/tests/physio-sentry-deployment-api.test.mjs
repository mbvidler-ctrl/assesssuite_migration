import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSentryDeployment,
  listAllSentryDeployments,
} from '../../scripts/physio-sentry-deployment-api.mjs';

const url = 'https://sentry.io/api/0/organizations/unimatter/releases/physio-production%40' +
  `${'a'.repeat(40)}/deploys/`;
const token = 'sentry-test-token-that-is-long-enough';
const identity = {
  environment: 'physio-production',
  name: `assesssuite-physio-production-${'a'.repeat(12)}`,
  url: 'https://assesssuite-physio-production.fly.dev',
};

function response(body, { status = 200, link, requestId } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (link) headers.set('link', link);
  if (requestId) headers.set('x-sentry-request-id', requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

test('Sentry inventory exhaustively follows cursor pages and labels every GET request ID as inventory evidence', async () => {
  const calls = [];
  const first = `${url}?cursor=first`;
  const second = `${url}?cursor=second`;
  const result = await listAllSentryDeployments({
    url: first,
    token,
    expectedEnvironment: identity.environment,
    expectedName: identity.name,
    expectedUrl: identity.url,
    fetchImpl: async (requestUrl, options) => {
      calls.push({ requestUrl, options });
      if (requestUrl === first) return response([], {
        link: `<${second}>; rel="next"; results="true"`, requestId: 'inventory-one',
      });
      if (requestUrl === second) return response([{ id: 'deployment_1', ...identity }], {
        link: `<${second}>; rel="next"; results="false"`, requestId: 'inventory-two',
      });
      throw new Error(`unexpected URL ${requestUrl}`);
    },
  });
  assert.equal(result.page_count, 2);
  assert.equal(result.inventory_calls_attempted, 2);
  assert.equal(result.inventory_calls_confirmed, 2);
  assert.equal(result.exact_count, 1);
  assert.equal(result.pages.every((row) => 'inventory_x_sentry_request_id_sha256' in row), true);
  assert.equal(result.pages.some((row) => 'mutation_x_sentry_request_id_sha256' in row), false);
  assert.equal(calls.every((call) => call.options.method === 'GET'), true);
});

test('Sentry mutation captures the actual POST status body and request ID separately from inventory', async () => {
  const result = await createSentryDeployment({
    url,
    token,
    payload: identity,
    fetchImpl: async (requestUrl, options) => {
      assert.equal(requestUrl, url);
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body.toString()), identity);
      return response({ id: 'deployment_2', ...identity }, { status: 201, requestId: 'mutation-one' });
    },
  });
  assert.equal(result.http_status, 201);
  assert.equal(result.mutation_calls_attempted, 1);
  assert.equal(result.mutation_calls_confirmed, 1);
  assert.match(result.mutation_x_sentry_request_id_sha256, /^[0-9a-f]{64}$/);
  assert.equal('inventory_x_sentry_request_id_sha256' in result, false);
});

test('Sentry pagination rejects cross-origin next links loops and missing terminal relation', async () => {
  await assert.rejects(listAllSentryDeployments({ url, token, ...{
    expectedEnvironment: identity.environment, expectedName: identity.name, expectedUrl: identity.url,
  }, fetchImpl: async () => response([], {
    link: '<https://evil.example.invalid/cursor>; rel="next"; results="true"',
  }) }), /NEXT_URL_INVALID/);
  await assert.rejects(listAllSentryDeployments({ url, token, ...{
    expectedEnvironment: identity.environment, expectedName: identity.name, expectedUrl: identity.url,
  }, fetchImpl: async () => response([], {
    link: `<${url}>; rel="next"; results="true"`,
  }) }), /PAGINATION_LOOP/);
  await assert.rejects(listAllSentryDeployments({ url, token, ...{
    expectedEnvironment: identity.environment, expectedName: identity.name, expectedUrl: identity.url,
  }, fetchImpl: async () => response([], { link: '<x>; rel="previous"; results="false"' }) }),
  /LINK_INVALID/);
});

test('Sentry exhaustive inventory rejects duplicate deployment IDs across cursor pages', async () => {
  const first = `${url}?cursor=duplicate-first`;
  const second = `${url}?cursor=duplicate-second`;
  let calls = 0;
  await assert.rejects(listAllSentryDeployments({ url: first, token,
    expectedEnvironment: identity.environment, expectedName: identity.name, expectedUrl: identity.url,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return response([{ id: 'duplicate_deployment', ...identity }], {
        link: `<${second}>; rel="next"; results="true"`,
      });
      return response([{ id: 'duplicate_deployment', ...identity }], {
        link: `<${second}>; rel="next"; results="false"`,
      });
    },
  }), /DUPLICATE_DEPLOYMENT/);
  assert.equal(calls, 2);
});
