import assert from 'node:assert/strict';
import test from 'node:test';

import {
  integrationCredentialKeyConfigured,
  openIntegrationCredentials,
  sealIntegrationCredentials,
} from '../integrations/credentialVault.mjs';
import { createHalaxyClient, HalaxyApiError } from '../integrations/halaxy.mjs';

const KEY = Buffer.alloc(32, 17).toString('base64');

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/fhir+json', ...headers },
  });
}

test('integration credential vault encrypts secrets and binds them to organisation and provider', () => {
  const environment = { ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY: KEY };
  const credentials = { client_id: 'client-1234', client_secret: 'secret-do-not-leak' };
  const scope = { orgId: 'org-a', providerId: 'halaxy' };
  const envelope = sealIntegrationCredentials(credentials, scope, { environment });

  assert.equal(integrationCredentialKeyConfigured(environment), true);
  assert.doesNotMatch(envelope, /client-1234|secret-do-not-leak/);
  assert.deepEqual(openIntegrationCredentials(envelope, scope, { environment }), credentials);
  assert.throws(
    () => openIntegrationCredentials(envelope, { orgId: 'org-b', providerId: 'halaxy' }, { environment }),
    (error) => error?.code === 'integration_credentials_unreadable',
  );
  assert.equal(integrationCredentialKeyConfigured({}), false);
});

test('Halaxy client proves OAuth and Patient permission without returning patient records', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/oauth/token')) {
      return jsonResponse({ token_type: 'Bearer', expires_in: 900, access_token: 'halaxy-token' });
    }
    return jsonResponse(
      { resourceType: 'Bundle', type: 'searchset', total: 24, entry: [{ resource: { id: 'not-returned' } }] },
      200,
      { 'x-ratelimit-limit': '500', 'x-ratelimit-remaining': '498' },
    );
  };
  const result = await createHalaxyClient({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    region: 'au',
    fetchImpl,
  }).testConnection();

  assert.deepEqual(result, {
    connected: true,
    region: 'au',
    fhirVersion: 'R4B',
    patientReadAvailable: true,
    visiblePatientCount: 24,
    rateLimit: { limit: 500, remaining: 498 },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://au-api.halaxy.com/main/oauth/token');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    grant_type: 'client_credentials',
    client_id: 'client-id',
    client_secret: 'client-secret',
  });
  assert.equal(calls[1].url, 'https://au-api.halaxy.com/main/Patient?_count=1&_summary=count');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer halaxy-token');
  assert.equal(JSON.stringify(result).includes('not-returned'), false);
});

test('Halaxy authorization and rate-limit failures are explicit and never simulated', async () => {
  const unauthorized = createHalaxyClient({
    clientId: 'client-id',
    clientSecret: 'wrong-secret',
    fetchImpl: async () => jsonResponse({ issue: [{ diagnostics: 'unauthorized' }] }, 401),
  });
  await assert.rejects(
    () => unauthorized.testConnection(),
    (error) => error instanceof HalaxyApiError
      && error.code === 'halaxy_authorization_failed'
      && error.httpStatus === 422,
  );

  let call = 0;
  const limited = createHalaxyClient({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async () => {
      call += 1;
      if (call === 1) return jsonResponse({ access_token: 'token', expires_in: 900 });
      return jsonResponse({ issue: [] }, 429, { 'retry-after': '11' });
    },
  });
  await assert.rejects(
    () => limited.testConnection(),
    (error) => error instanceof HalaxyApiError
      && error.code === 'halaxy_rate_limited'
      && error.retryAfter === '11',
  );
});
