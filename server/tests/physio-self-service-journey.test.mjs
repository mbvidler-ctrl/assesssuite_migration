import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { MOCK_CHECKOUT_PRICE_ID } from '../mocks/stripe.mjs';
import {
  loginAdmin,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const PHYSIO_RUNTIME = Object.freeze({
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  APP_URL: 'https://physio.app.assesssuite.com',
  STRIPE_TRIAL_PERIOD_DAYS: '30',
  OUTBOUND_EMAIL_ENABLED: '0',
});

const EMAIL = 'synthetic-physio-self-service@example.test';
const INITIAL_PASSWORD = 'Synthetic-Physio-Password-1!';
const REPLACEMENT_PASSWORD = 'Synthetic-Physio-Password-2!';

function appRoute(server, suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function me(server, token) {
  return requestJson(server, appRoute(server, '/entities/User/me'), { token });
}

test('public Physio self-service reaches an entitled, recoverable clinical account', { timeout: 30_000 }, async () => {
  const server = await startTestServer(PHYSIO_RUNTIME);
  let database;
  try {
    const version = await requestJson(server, '/api/version');
    assert.equal(version.status, 200, version.text);
    assert.equal(version.body?.profession_id, 'physio');
    assert.equal(version.body?.app_id, 'local-assesssuite-physio');

    const registration = await requestJson(server, appRoute(server, '/auth/register'), {
      method: 'POST',
      body: {
        email: EMAIL,
        password: INITIAL_PASSWORD,
        full_name: 'Synthetic Physio Owner',
      },
    });
    assert.equal(registration.status, 200, registration.text);
    assert.equal(registration.body?.otp_required, true);
    assert.equal(typeof registration.body?.user_id, 'string');

    const unverifiedLogin = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: EMAIL, password: INITIAL_PASSWORD },
    });
    assert.equal(unverifiedLogin.status, 403, unverifiedLogin.text);
    assert.match(unverifiedLogin.body?.message || '', /verify your email/i);

    const verification = await requestJson(server, appRoute(server, '/auth/verify-otp'), {
      method: 'POST',
      body: { email: EMAIL, otp_code: '000000' },
    });
    assert.equal(verification.status, 200, verification.text);
    const firstToken = verification.body?.access_token;
    assert.equal(typeof firstToken, 'string');

    const pending = await me(server, firstToken);
    assert.equal(pending.status, 200, pending.text);
    assert.equal(pending.body?.account_status, 'pending');
    assert.notEqual(pending.body?.subscription_status, 'active');
    assert.equal(pending.body?.full_name, 'Synthetic Physio Owner');

    const prematureClinicalRead = await requestJson(
      server,
      appRoute(server, '/entities/PhysioCareEpisode'),
      { token: firstToken },
    );
    assert.equal(prematureClinicalRead.status, 403, prematureClinicalRead.text);

    const checkout = await requestJson(server, appRoute(server, '/functions/createCheckoutSession'), {
      method: 'POST',
      token: firstToken,
      body: { plan: 'monthly' },
    });
    assert.equal(checkout.status, 200, checkout.text);
    assert.match(checkout.body?.url || '', /^\/mock-stripe\/checkout\/mock_cs_/);

    const adminToken = await loginAdmin(server);
    const checkoutCompletion = await requestJson(
      server,
      appRoute(server, '/functions/stripeWebhook'),
      {
        method: 'POST',
        token: adminToken,
        body: {
          id: 'evt_physioselfservicecheckout',
          created: 1_800_000_000,
          livemode: false,
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'subscription',
              payment_status: 'paid',
              customer: 'mock_cus_physio_self_service',
              subscription: 'mock_sub_physio_self_service',
              client_reference_id: registration.body.user_id,
              customer_email: EMAIL,
              metadata: {
                userId: registration.body.user_id,
                userEmail: EMAIL,
                priceId: MOCK_CHECKOUT_PRICE_ID,
                appId: server.appId,
                professionId: 'physio',
              },
            },
          },
        },
      },
    );
    assert.equal(checkoutCompletion.status, 200, checkoutCompletion.text);
    assert.equal(checkoutCompletion.body?.received, true);

    const activated = await me(server, firstToken);
    assert.equal(activated.status, 200, activated.text);
    assert.equal(activated.body?.account_status, 'active');
    assert.equal(activated.body?.subscription_status, 'active');
    assert.equal(activated.body?.stripe_subscription_id, 'mock_sub_physio_self_service');

    const profile = await requestJson(server, appRoute(server, '/entities/User/me'), {
      method: 'PUT',
      token: firstToken,
      body: {
        clinician_name: 'Synthetic Physio Owner',
        country: 'australia',
        profession: 'Physiotherapist',
        qualifications: 'Synthetic BPhty',
        registration_number: 'SYN-PHYSIO-001',
        clinic_name: 'Synthetic Physio Practice',
        clinic_address: '1 Synthetic Street, Sydney NSW',
        clinic_phone: '0200000000',
        clinic_email: EMAIL,
      },
    });
    assert.equal(profile.status, 200, profile.text);
    assert.equal(profile.body?.profession, 'Physiotherapist');
    assert.equal(profile.body?.country, 'australia');

    const founder = await requestJson(
      server,
      appRoute(server, '/integration-endpoints/Core/EnsureFounderOrganization'),
      {
        method: 'POST',
        token: firstToken,
        body: { clinic_name: 'Synthetic Physio Practice' },
      },
    );
    assert.equal(founder.status, 200, founder.text);
    assert.equal(founder.body?.name, 'Synthetic Physio Practice');
    assert.equal(typeof founder.body?.id, 'string');

    const beforeAcceptance = await requestJson(
      server,
      `${appRoute(server, '/entities/Client')}?q=${encodeURIComponent(JSON.stringify({
        org_id: founder.body.id,
      }))}`,
      { token: firstToken },
    );
    assert.equal(beforeAcceptance.status, 403, beforeAcceptance.text);
    assert.match(beforeAcceptance.body?.message || '', /legal acceptance/i);

    const acceptance = await requestJson(
      server,
      appRoute(server, '/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: firstToken,
        body: { org_id: founder.body.id, marketing_opt_in: false },
      },
    );
    assert.equal(acceptance.status, 200, acceptance.text);
    assert.equal(acceptance.body?.owner_bundle, true);
    assert.equal(acceptance.body?.recorded, 8);

    const client = await requestJson(server, appRoute(server, '/entities/Client'), {
      method: 'POST',
      token: firstToken,
      body: {
        org_id: founder.body.id,
        full_name: 'Synthetic Physio Client',
        status: 'active',
      },
    });
    assert.equal(client.status, 200, client.text);

    const episode = await requestJson(server, appRoute(server, '/entities/PhysioCareEpisode'), {
      method: 'POST',
      token: firstToken,
      body: {
        schema_version: 2,
        org_id: founder.body.id,
        client_id: client.body.id,
        episode_number: 1,
        status: 'active',
        episode_start_date: '2026-08-22',
      },
    });
    assert.equal(episode.status, 200, episode.text);
    assert.equal(episode.body?.client_id, client.body.id);

    const secondEmail = 'synthetic-physio-second-practice@example.test';
    const secondRegistration = await requestJson(server, appRoute(server, '/auth/register'), {
      method: 'POST',
      body: {
        email: secondEmail,
        password: INITIAL_PASSWORD,
        full_name: 'Synthetic Second Physio',
      },
    });
    assert.equal(secondRegistration.status, 200, secondRegistration.text);
    const secondVerification = await requestJson(server, appRoute(server, '/auth/verify-otp'), {
      method: 'POST',
      body: { email: secondEmail, otp_code: '000000' },
    });
    assert.equal(secondVerification.status, 200, secondVerification.text);
    const secondToken = secondVerification.body?.access_token;

    const secondActivation = await requestJson(
      server,
      appRoute(server, `/entities/User/${secondRegistration.body.user_id}`),
      {
        method: 'PUT',
        token: adminToken,
        body: {
          account_status: 'active',
          subscription_status: 'active',
          clinician_name: 'Synthetic Second Physio',
          country: 'australia',
          profession: 'Physiotherapist',
        },
      },
    );
    assert.equal(secondActivation.status, 200, secondActivation.text);

    const secondOrganization = await requestJson(server, appRoute(server, '/entities/Organization'), {
      method: 'POST',
      token: adminToken,
      body: { name: 'Synthetic Second Physio Practice' },
    });
    assert.equal(secondOrganization.status, 200, secondOrganization.text);
    const secondMembership = await requestJson(
      server,
      appRoute(server, '/entities/OrganizationMember'),
      {
        method: 'POST',
        token: adminToken,
        body: {
          org_id: secondOrganization.body.id,
          user_email: secondEmail,
          role: 'owner',
          is_primary: true,
        },
      },
    );
    assert.equal(secondMembership.status, 200, secondMembership.text);
    const secondAcceptance = await requestJson(
      server,
      appRoute(server, '/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: secondToken,
        body: { org_id: secondOrganization.body.id, marketing_opt_in: false },
      },
    );
    assert.equal(secondAcceptance.status, 200, secondAcceptance.text);

    const secondPracticeEpisodes = await requestJson(
      server,
      `${appRoute(server, '/entities/PhysioCareEpisode')}?q=${encodeURIComponent(JSON.stringify({
        org_id: secondOrganization.body.id,
      }))}`,
      { token: secondToken },
    );
    assert.equal(secondPracticeEpisodes.status, 200, secondPracticeEpisodes.text);
    assert.deepEqual(secondPracticeEpisodes.body, []);

    const crossPracticeRead = await requestJson(
      server,
      appRoute(server, `/entities/PhysioCareEpisode/${episode.body.id}`),
      { token: secondToken },
    );
    assert.equal(crossPracticeRead.status, 404, crossPracticeRead.text);
    const crossPracticeWrite = await requestJson(
      server,
      appRoute(server, `/entities/PhysioCareEpisode/${episode.body.id}`),
      {
        method: 'PUT',
        token: secondToken,
        body: { title: 'Cross-practice overwrite must fail' },
      },
    );
    assert.equal(crossPracticeWrite.status, 404, crossPracticeWrite.text);

    const resetRequest = await requestJson(server, appRoute(server, '/auth/reset-password-request'), {
      method: 'POST',
      body: { email: EMAIL },
    });
    assert.equal(resetRequest.status, 200, resetRequest.text);
    assert.deepEqual(resetRequest.body, { status: 'accepted' });

    database = new DatabaseSync(server.dbPath);
    const storedUser = database
      .prepare('SELECT data FROM entity_User WHERE id = ?')
      .get(registration.body.user_id);
    const resetToken = JSON.parse(storedUser.data).reset_token;
    assert.match(resetToken, /^[0-9a-f-]{36}$/i);

    const reset = await requestJson(server, appRoute(server, '/auth/reset-password'), {
      method: 'POST',
      body: { reset_token: resetToken, new_password: REPLACEMENT_PASSWORD },
    });
    assert.equal(reset.status, 200, reset.text);
    assert.deepEqual(reset.body, { status: 'reset' });

    const consumedToken = await requestJson(server, appRoute(server, '/auth/reset-password'), {
      method: 'POST',
      body: { reset_token: resetToken, new_password: INITIAL_PASSWORD },
    });
    assert.equal(consumedToken.status, 400, consumedToken.text);

    const invalidatedSession = await me(server, firstToken);
    assert.equal(invalidatedSession.status, 401, invalidatedSession.text);

    const oldPassword = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: EMAIL, password: INITIAL_PASSWORD },
    });
    assert.equal(oldPassword.status, 401, oldPassword.text);

    const recoveredLogin = await requestJson(server, appRoute(server, '/auth/login'), {
      method: 'POST',
      body: { email: EMAIL, password: REPLACEMENT_PASSWORD },
    });
    assert.equal(recoveredLogin.status, 200, recoveredLogin.text);
    assert.equal(typeof recoveredLogin.body?.access_token, 'string');

    const recoveredEpisode = await requestJson(
      server,
      appRoute(server, `/entities/PhysioCareEpisode/${episode.body.id}`),
      { token: recoveredLogin.body.access_token },
    );
    assert.equal(recoveredEpisode.status, 200, recoveredEpisode.text);
    assert.equal(recoveredEpisode.body?.id, episode.body.id);
  } finally {
    database?.close();
    await server.stop();
  }
});
