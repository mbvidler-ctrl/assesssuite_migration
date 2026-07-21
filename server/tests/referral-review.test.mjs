import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewedReferralCommitPayload,
  commitReviewedReferral,
  createReferralCommitIdempotencyKey,
  REFERRAL_REVIEW_COMMIT_VERSION as CLIENT_REVIEW_VERSION,
} from '../../src/lib/referralCommit.js';
import { REFERRAL_REVIEW_COMMIT_VERSION as SERVER_REVIEW_VERSION } from '../referralCommit.mjs';

test('review commit payload is narrow, version-locked and disables historical scanning', () => {
  const conditions = [
    {
      condition_name: 'Reviewed condition',
      condition_type: 'primary',
    },
    {
      condition_name: 'Relevant medical history',
      condition_type: 'comorbidity',
      notes: 'must be retained on the reviewed client instead',
    },
  ];
  const payload = buildReviewedReferralCommitPayload({
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
    orgId: 'org-reviewed',
    operation: 'create',
    client: {
      full_name: 'Reviewed Person',
      date_of_birth: '1987-04-03',
      gender: 'other',
      medical_history: 'must never become an undeclared Client field',
      org_id: 'attacker-controlled-org',
      assigned_clinician_email: 'attacker@example.test',
      consent_confirmed: true,
      archived: true,
    },
    conditions,
    uploadIds: ['00000000-0000-4000-8000-000000000002'],
  });

  assert.equal(CLIENT_REVIEW_VERSION, SERVER_REVIEW_VERSION);
  assert.deepEqual(payload, {
    idempotency_key: '00000000-0000-4000-8000-000000000001',
    org_id: 'org-reviewed',
    operation: 'create',
    client_id: null,
    review_confirmed: true,
    review_version: SERVER_REVIEW_VERSION,
    client: {
      full_name: 'Reviewed Person',
      date_of_birth: '1987-04-03',
      gender: 'other',
    },
    conditions: [
      {
        condition_name: 'Reviewed condition',
        condition_type: 'primary',
      },
      {
        condition_name: 'Relevant medical history',
        condition_type: 'comorbidity',
        notes: 'must be retained on the reviewed client instead',
      },
    ],
    upload_ids: ['00000000-0000-4000-8000-000000000002'],
    historical_assessments: [],
  });
  assert.equal('medical_history' in payload.client, false);
  assert.equal(payload.conditions[1].notes, 'must be retained on the reviewed client instead');
});

test('atomic helper unwraps the installed SDK envelope and rejects an invalid success body', async () => {
  const expected = {
    status: 'success',
    operation: 'update',
    client_id: 'client-reviewed',
    counts: {
      conditions_created: 0,
      documents_retained: 1,
      historical_assessments_created: 0,
    },
  };
  const calls = [];
  const sdk = {
    functions: {
      async invoke(name, payload) {
        calls.push({ name, payload });
        return { data: expected };
      },
    },
  };
  const payload = { operation: 'update' };
  assert.equal(await commitReviewedReferral(sdk, payload), expected);
  assert.deepEqual(calls, [{ name: 'commitReviewedReferral', payload }]);

  sdk.functions.invoke = async () => ({ data: { status: 'success' } });
  await assert.rejects(
    () => commitReviewedReferral(sdk, payload),
    (error) => error?.data?.code === 'invalid_referral_commit_response',
  );
});

test('atomic helper reconciles an uncertain response once with the exact same key', async () => {
  const payload = {
    idempotency_key: '00000000-0000-4000-8000-000000000099',
    operation: 'create',
  };
  const expected = { status: 'success', operation: 'create', client_id: 'client-reconciled' };
  const calls = [];
  const sdk = {
    functions: {
      async invoke(name, body) {
        calls.push({ name, body });
        if (calls.length === 1) throw new Error('synthetic response loss');
        return { data: expected };
      },
    },
  };

  assert.equal(await commitReviewedReferral(sdk, payload), expected);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'commitReviewedReferral');
  assert.equal(calls[1].name, 'commitReviewedReferral');
  assert.equal(calls[0].body, payload);
  assert.equal(calls[1].body, payload);
});

test('a second uncertain response cannot override the truthful unconfirmed-result contract', async () => {
  const payload = {
    idempotency_key: '00000000-0000-4000-8000-000000000098',
    operation: 'create',
  };
  const calls = [];
  const misleadingUpstream = Object.assign(new Error('synthetic second response loss'), {
    status: 500,
    data: {
      code: 'referral_commit_failed',
      details: 'The referral could not be saved. No client data was changed.',
    },
  });
  const sdk = {
    functions: {
      async invoke(name, body) {
        calls.push({ name, body });
        if (calls.length === 1) throw new Error('synthetic first response loss');
        throw misleadingUpstream;
      },
    },
  };

  await assert.rejects(
    () => commitReviewedReferral(sdk, payload),
    (error) => (
      error?.data?.code === 'unconfirmed_referral_commit_result'
      && error?.data?.details === 'The save result could not be confirmed. Retry this same review; AssessSuite will safely return the original result if it was already saved.'
      && !JSON.stringify(error).includes('No client data was changed')
    ),
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body, payload);
  assert.equal(calls[1].body, payload);
});

test('atomic helper does not retry a deterministic client refusal', async () => {
  let calls = 0;
  const refusal = Object.assign(new Error('synthetic refusal'), { status: 409 });
  const sdk = { functions: { async invoke() { calls += 1; throw refusal; } } };
  await assert.rejects(() => commitReviewedReferral(sdk, { operation: 'create' }), refusal);
  assert.equal(calls, 1);
});

test('review commit idempotency keys are secure UUIDs and rotate between reviews', () => {
  const first = createReferralCommitIdempotencyKey();
  const second = createReferralCommitIdempotencyKey();
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(second, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(first, second);
});
