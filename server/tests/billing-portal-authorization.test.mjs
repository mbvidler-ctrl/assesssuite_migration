import assert from 'node:assert/strict';
import test from 'node:test';

import createPortalSession from '../functions/createPortalSession.mjs';

function responder() {
  return (status, body) => ({ status, body });
}

test('billing portal refuses caller-supplied customer identifiers when the session has no linked customer', async () => {
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error('fetch must not be reached');
  };
  try {
    const response = await createPortalSession({
      user: { id: 'user-a' },
      body: {
        stripeCustomerId: 'cus_victim',
        subscriptionId: 'sub_victim',
        flow: 'subscription_update',
      },
      respond: responder(),
    });
    assert.equal(response.status, 400);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('billing portal uses only authenticated-user identifiers and an allowlisted flow', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    PROFESSION: process.env.PROFESSION,
    DEFAULT_APP_ID: process.env.DEFAULT_APP_ID,
    APP_URL: process.env.APP_URL,
    EXPECTED_APP_URL: process.env.EXPECTED_APP_URL,
    PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SELFTEST: process.env.SELFTEST,
    PARITY_ASSURANCE_MODE: process.env.PARITY_ASSURANCE_MODE,
  };
  const requests = [];

  process.env.NODE_ENV = 'production';
  process.env.PROFESSION = 'exercise-physiology';
  process.env.DEFAULT_APP_ID = 'local-assesssuite';
  process.env.PAYMENTS_ENABLED = '1';
  process.env.STRIPE_SECRET_KEY = 'synthetic_test_key';
  process.env.APP_URL = 'https://app.assesssuite.com';
  process.env.EXPECTED_APP_URL = 'https://app.assesssuite.com';
  delete process.env.SELFTEST;
  delete process.env.PARITY_ASSURANCE_MODE;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ url: 'https://billing.example.test/session' }),
    };
  };

  try {
    const response = await createPortalSession({
      user: {
        id: 'user-a',
        stripe_customer_id: 'cus_owned',
        stripe_subscription_id: 'sub_owned',
      },
      body: {
        stripeCustomerId: 'cus_victim',
        subscriptionId: 'sub_victim',
        flow: 'subscription_update',
      },
      request: {
        headers: {
          host: 'app.assesssuite.com',
          'x-forwarded-host': 'app.assesssuite.com',
          'x-forwarded-proto': 'https',
          'fly-forwarded-proto': 'https',
          origin: 'https://app.assesssuite.com',
        },
      },
      respond: responder(),
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 1);
    const form = new URLSearchParams(requests[0].options.body);
    assert.equal(form.get('customer'), 'cus_owned');
    assert.equal(form.get('return_url'), 'https://app.assesssuite.com/MyProfile');
    assert.equal(form.get('flow_data[subscription_update][subscription]'), 'sub_owned');
    assert.equal(form.has('cus_victim'), false);
    assert.equal(form.has('sub_victim'), false);

    requests.length = 0;
    await createPortalSession({
      user: { id: 'user-a', stripe_customer_id: 'cus_owned' },
      body: { flow: 'attacker_chosen_flow' },
      request: {
        headers: {
          host: 'app.assesssuite.com',
          'x-forwarded-host': 'app.assesssuite.com',
          'x-forwarded-proto': 'https',
          'fly-forwarded-proto': 'https',
          origin: 'https://app.assesssuite.com',
        },
      },
      respond: responder(),
    });
    const rejectedFlowForm = new URLSearchParams(requests[0].options.body);
    assert.equal(rejectedFlowForm.has('flow_data[type]'), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
