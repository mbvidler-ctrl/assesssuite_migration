import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isInitialClinicalReleaseEligible,
  resolveClinicalReleasePolicy,
  validateInitialReleaseProfileUpdate,
} from '../clinicalRelease.mjs';
import {
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

async function activateAs(server, adminToken, user, profession) {
  const result = await requestJson(server, `/api/apps/${server.appId}/entities/User/${user.id}`, {
    method: 'PUT',
    token: adminToken,
    body: {
      account_status: 'active',
      country: 'australia',
      profession,
    },
  });
  assert.equal(result.status, 200, result.text);
}

async function invokePhysioAdmissionProbe(server, user, orgId, careEpisodeId = 'admission-probe-episode') {
  return requestJson(server, `/api/apps/${server.appId}/functions/physioAiTask`, {
    method: 'POST',
    token: user.token,
    body: {
      task: 'physio.initial_assessment_summary.v1',
      org_id: orgId,
      care_episode_id: careEpisodeId,
      generation_request_id: 'profession-admission-probe-0001',
      context: { clinician_context: 'Synthetic admission boundary probe' },
    },
  });
}

async function createPhysioAdmissionEpisode(server, adminToken, orgId) {
  const client = await requestJson(server, `/api/apps/${server.appId}/entities/Client`, {
    method: 'POST', token: adminToken,
    body: { org_id: orgId, full_name: 'Synthetic admission probe patient' },
  });
  assert.equal(client.status, 200, client.text);
  const episode = await requestJson(server, `/api/apps/${server.appId}/entities/PhysioCareEpisode`, {
    method: 'POST', token: adminToken,
    body: {
      schema_version: 3,
      org_id: orgId,
      client_id: client.body.id,
      episode_number: 1,
      status: 'active',
      episode_start_date: '2026-08-22',
    },
  });
  assert.equal(episode.status, 200, episode.text);
  return episode.body.id;
}

async function invokeEpAdmissionProbe(server, user) {
  return requestJson(server, `/api/apps/${server.appId}/integration-endpoints/Core/InvokeLLM`, {
    method: 'POST',
    token: user.token,
    body: { prompt: 'Synthetic admission boundary probe' },
  });
}

test('clinical release policy is derived exactly from the validated active profession manifest', () => {
  const ep = resolveClinicalReleasePolicy({});
  assert.equal(ep.professionId, 'exercise-physiology');
  assert.equal(ep.appId, 'local-assesssuite');
  assert.equal(ep.releaseCountry, 'australia');
  assert.deepEqual(ep.releaseProfessions, ['Exercise Physiologist', 'Gym Management', 'Clinic Management']);
  assert.equal(ep.publicProfession.id, 'exercise-physiology');
  assert.ok(ep.publicProfession.lexicon);

  const physio = resolveClinicalReleasePolicy({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });
  assert.equal(physio.professionId, 'physio');
  assert.equal(physio.appId, 'local-assesssuite-physio');
  assert.deepEqual(physio.releaseProfessions, ['Physiotherapist', 'Clinic Management']);
  assert.equal(physio.publicProfession.id, 'physio');
  assert.equal(physio.publicProfession.lexicon.client, 'patient');

  assert.equal(
    isInitialClinicalReleaseEligible(
      { country: 'australia', profession: 'Physiotherapist' },
      physio,
    ),
    true,
  );
  assert.equal(
    isInitialClinicalReleaseEligible(
      { country: 'australia', profession: 'Exercise Physiologist' },
      physio,
    ),
    false,
  );
  assert.equal(
    isInitialClinicalReleaseEligible(
      { country: 'Australia', profession: 'Physiotherapist' },
      physio,
    ),
    false,
  );

  assert.deepEqual(
    validateInitialReleaseProfileUpdate(
      { country: 'australia', profession: 'Physiotherapist' },
      physio,
    ),
    { ok: true },
  );
  assert.equal(
    validateInitialReleaseProfileUpdate({ profession: 'Exercise Physiologist' }, physio).ok,
    false,
  );
  assert.throws(
    () => resolveClinicalReleasePolicy({
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite',
    }),
    /does not match PROFESSION="physio"/,
  );
});

test('explicit Physio server admits Physio profiles and function calls while rejecting EP profiles', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
  });
  try {
    const publicSettings = await requestJson(
      server,
      `/api/apps/public/prod/public-settings/by-id/${server.appId}`,
    );
    assert.equal(publicSettings.status, 200, publicSettings.text);
    assert.equal(publicSettings.body?.public_settings?.profession?.id, 'physio');
    assert.equal(publicSettings.body?.public_settings?.profession?.lexicon?.client, 'patient');

    const adminToken = await loginAdmin(server);
    const physiotherapist = await registerUser(server, 'manifest-physio@example.test');
    await activateAs(server, adminToken, physiotherapist, 'Physiotherapist');
    const physioOrg = await createOrganizationForUser(server, adminToken, physiotherapist);
    const careEpisodeId = await createPhysioAdmissionEpisode(server, adminToken, physioOrg.id);
    const admitted = await invokePhysioAdmissionProbe(server, physiotherapist, physioOrg.id, careEpisodeId);
    assert.equal(admitted.status, 503, admitted.text);
    assert.equal(admitted.body?.code, 'ai_provider_unconfigured');
    assert.doesNotMatch(admitted.text, /clinical access is not approved/i);

    const rejectedProfileUpdate = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      method: 'PUT',
      token: physiotherapist.token,
      body: { profession: 'Exercise Physiologist' },
    });
    assert.equal(rejectedProfileUpdate.status, 403, rejectedProfileUpdate.text);

    const exercisePhysiologist = await registerUser(server, 'manifest-ep-on-physio@example.test');
    await activateAs(server, adminToken, exercisePhysiologist, 'Exercise Physiologist');
    const epOrg = await createOrganizationForUser(server, adminToken, exercisePhysiologist);
    const rejected = await invokePhysioAdmissionProbe(server, exercisePhysiologist, epOrg.id);
    assert.equal(rejected.status, 403, rejected.text);
    assert.match(rejected.body?.error || '', /clinical access is not approved/i);
  } finally {
    await server.stop();
  }
});

test('Physio server rejects every caller-selected foreign app identity before route handling', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });
  try {
    assert.equal(server.appId, 'local-assesssuite-physio');
    const correct = await requestJson(
      server,
      `/api/apps/public/prod/public-settings/by-id/${server.appId}`,
    );
    assert.equal(correct.status, 200, correct.text);
    assert.equal(correct.body?.id, server.appId);

    for (const foreignAppId of ['local-assesssuite', 'totally-foreign-app']) {
      const publicSettings = await requestJson(
        server,
        `/api/apps/public/prod/public-settings/by-id/${foreignAppId}`,
      );
      assert.equal(publicSettings.status, 404, publicSettings.text);

      const login = await requestJson(server, `/api/apps/${foreignAppId}/auth/login`, {
        method: 'POST',
        body: { email: 'admin@local.test', password: 'change-me-local' },
      });
      assert.equal(login.status, 404, login.text);
      assert.equal(Object.hasOwn(login.body || {}, 'access_token'), false);

      const entity = await requestJson(server, `/api/apps/${foreignAppId}/entities/Assessment`);
      assert.equal(entity.status, 404, entity.text);

      const fn = await requestJson(server, `/api/apps/${foreignAppId}/functions/createCheckoutSession`, {
        method: 'POST', body: {},
      });
      assert.equal(fn.status, 404, fn.text);

      const integration = await requestJson(
        server,
        `/api/apps/${foreignAppId}/integration-endpoints/Core/InvokeLLM`,
        { method: 'POST', body: {} },
      );
      assert.equal(integration.status, 404, integration.text);

      const invite = await requestJson(
        server,
        `/api/apps/${foreignAppId}/runtime/users/invite-user`,
        { method: 'POST', body: {} },
      );
      assert.equal(invite.status, 404, invite.text);
    }

    const wrongHeader = await requestJson(server, '/api/health/live', {
      headers: { 'X-App-Id': 'local-assesssuite' },
    });
    assert.equal(wrongHeader.status, 404, wrongHeader.text);

    const adminToken = await loginAdmin(server);
    const correctEntity = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/Assessment`,
      { token: adminToken },
    );
    assert.equal(correctEntity.status, 200, correctEntity.text);
  } finally {
    await server.stop();
  }
});

test('absent PROFESSION preserves the EP server admission boundary and rejects Physio profiles', async () => {
  const server = await startTestServer({
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
  });
  try {
    const publicSettings = await requestJson(
      server,
      `/api/apps/public/prod/public-settings/by-id/${server.appId}`,
    );
    assert.equal(publicSettings.status, 200, publicSettings.text);
    assert.equal(publicSettings.body?.public_settings?.profession?.id, 'exercise-physiology');
    assert.equal(publicSettings.body?.public_settings?.profession?.lexicon?.client, 'client');

    const adminToken = await loginAdmin(server);
    const exercisePhysiologist = await registerUser(server, 'manifest-default-ep@example.test');
    await activateAs(server, adminToken, exercisePhysiologist, 'Exercise Physiologist');
    const epOrg = await createOrganizationForUser(server, adminToken, exercisePhysiologist);
    const unavailablePhysioTask = await invokePhysioAdmissionProbe(server, exercisePhysiologist, epOrg.id);
    assert.equal(unavailablePhysioTask.status, 404, unavailablePhysioTask.text);
    assert.equal(unavailablePhysioTask.body?.message, 'function not found');
    const admitted = await invokeEpAdmissionProbe(server, exercisePhysiologist);
    assert.equal(admitted.status, 503, admitted.text);
    assert.equal(admitted.body?.code, 'ai_provider_unconfigured');

    const physiotherapist = await registerUser(server, 'manifest-physio-on-ep@example.test');
    await activateAs(server, adminToken, physiotherapist, 'Physiotherapist');
    await createOrganizationForUser(server, adminToken, physiotherapist);
    const rejected = await invokeEpAdmissionProbe(server, physiotherapist);
    assert.equal(rejected.status, 403, rejected.text);
    assert.equal(rejected.body?.code, 'clinical_release_unavailable');
    assert.match(rejected.body?.error || '', /AI generation is not approved/i);
  } finally {
    await server.stop();
  }
});

test('server bootstrap fails closed on explicit profession/app identity mismatch', async () => {
  await assert.rejects(
    () => startTestServer({
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite',
    }),
    /does not match PROFESSION="physio"/,
  );
});
