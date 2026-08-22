import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTestStore,
  loginAdmin,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const PHYSIO_RUNTIME = Object.freeze({
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  APP_URL: 'https://physio.app.assesssuite.com',
  OUTBOUND_EMAIL_ENABLED: '0',
});

const route = (server, suffix) => `/api/apps/${server.appId}${suffix}`;

async function create(server, token, entity, body) {
  const result = await requestJson(server, route(server, `/entities/${entity}`), {
    method: 'POST',
    token,
    body,
  });
  assert.equal(result.status, 200, result.text);
  return result.body;
}

async function update(server, token, entity, id, body, expectedStatus = 200) {
  const result = await requestJson(server, route(server, `/entities/${entity}/${id}`), {
    method: 'PUT',
    token,
    body,
  });
  assert.equal(result.status, expectedStatus, result.text);
  return result.body;
}

test('care-episode lifecycle is atomic, append-only, restart-durable and stale-write safe', {
  timeout: 45_000,
  concurrency: false,
}, async () => {
  const store = createTestStore('assesssuite-physio-lifecycle-');
  let server;
  try {
    server = await startTestServer(PHYSIO_RUNTIME, { store, selftest: false });
    let token = await loginAdmin(server);
    const organization = await create(server, token, 'Organization', { name: 'Lifecycle Practice' });
    const client = await create(server, token, 'Client', {
      org_id: organization.id,
      full_name: 'Lifecycle Patient',
      status: 'active',
    });
    const otherClient = await create(server, token, 'Client', {
      org_id: organization.id,
      full_name: 'Other Patient',
      status: 'active',
    });

    const rejectedHistory = await requestJson(
      server,
      route(server, '/entities/PhysioCareEpisode'),
      {
        method: 'POST',
        token,
        body: {
          org_id: organization.id,
          client_id: client.id,
          episode_number: 1,
          status: 'active',
          episode_start_date: '2026-08-22',
          status_history: [],
        },
      },
    );
    assert.equal(rejectedHistory.status, 403, rejectedHistory.text);

    const episode = await create(server, token, 'PhysioCareEpisode', {
      schema_version: 2,
      org_id: organization.id,
      client_id: client.id,
      episode_number: 1,
      status: 'active',
      episode_start_date: '2026-08-22',
      reporting: { discharge_status: 'ready', discharge_outcome: 'Goals achieved' },
    });
    assert.equal(episode.schema_version, 3);
    assert.equal(episode.status_history.length, 1);
    assert.equal(episode.status_history[0].from, null);
    assert.equal(episode.status_history[0].to, 'active');

    await update(server, token, 'PhysioCareEpisode', episode.id, { status: 'discharged' }, 409);
    await update(server, token, 'PhysioCareEpisode', episode.id, {
      client_id: otherClient.id,
      status: 'discharged',
      lifecycle_transition: {
        from: 'active',
        to: 'discharged',
        reason: 'Wrong patient',
        expected_updated_date: episode.updated_date,
      },
    }, 409);

    const discharged = await update(server, token, 'PhysioCareEpisode', episode.id, {
      status: 'discharged',
      reporting: { discharge_outcome: 'Goals achieved' },
      lifecycle_transition: {
        from: 'active',
        to: 'discharged',
        reason: 'Treatment goals achieved',
        expected_updated_date: episode.updated_date,
      },
    });
    assert.equal(discharged.status, 'discharged');
    assert.equal(discharged.reporting.discharge_status, 'completed');
    assert.match(discharged.reporting.discharge_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(discharged.status_history.map((entry) => entry.to), ['active', 'discharged']);
    assert.equal(discharged.status_history[1].actor_email, 'admin@local.test');

    await update(server, token, 'PhysioCareEpisode', episode.id, {
      status: 'discharged',
      lifecycle_transition: {
        from: 'active',
        to: 'discharged',
        reason: 'Stale duplicate transition',
        expected_updated_date: episode.updated_date,
      },
    }, 409);
    await update(server, token, 'PhysioCareEpisode', episode.id, {
      status_history: [],
    }, 403);

    const bulk = await requestJson(server, route(server, '/entities/PhysioCareEpisode/bulk'), {
      method: 'PUT',
      token,
      body: [{ id: episode.id, status: 'active' }],
    });
    assert.equal(bulk.status, 405, bulk.text);
    const updateMany = await requestJson(server, route(server, '/entities/PhysioCareEpisode/update-many'), {
      method: 'PATCH',
      token,
      body: { query: { id: episode.id }, data: { status: 'active' } },
    });
    assert.equal(updateMany.status, 405, updateMany.text);

    await server.stop();
    server = await startTestServer(PHYSIO_RUNTIME, { store, selftest: false });
    token = await loginAdmin(server);
    const afterDischargeRestart = await requestJson(
      server,
      route(server, `/entities/PhysioCareEpisode/${episode.id}`),
      { token },
    );
    assert.equal(afterDischargeRestart.status, 200, afterDischargeRestart.text);
    assert.equal(afterDischargeRestart.body.status, 'discharged');
    assert.equal(afterDischargeRestart.body.status_history.length, 2);

    const reopened = await update(server, token, 'PhysioCareEpisode', episode.id, {
      status: 'active',
      lifecycle_transition: {
        from: 'discharged',
        to: 'active',
        reason: 'Symptoms recurred and further care was authorised',
        expected_updated_date: afterDischargeRestart.body.updated_date,
      },
    });
    assert.equal(reopened.status, 'active');
    assert.equal(reopened.reporting.discharge_status, 'not_ready');
    assert.equal(reopened.reporting.discharge_date, '');
    assert.equal(reopened.reporting.discharge_outcome, '');
    assert.equal(reopened.status_history.length, 3);
    assert.equal(
      reopened.status_history[2].prior_discharge.discharge_date,
      discharged.reporting.discharge_date,
    );
    assert.equal(reopened.status_history[2].prior_discharge.discharge_outcome, 'Goals achieved');

    await update(server, token, 'PhysioCareEpisode', episode.id, {
      reporting: { discharge_status: 'completed', discharge_date: '2026-08-22' },
    }, 409);

    await server.stop();
    server = await startTestServer(PHYSIO_RUNTIME, { store, selftest: false });
    token = await loginAdmin(server);
    const finalReadback = await requestJson(
      server,
      route(server, `/entities/PhysioCareEpisode/${episode.id}`),
      { token },
    );
    assert.equal(finalReadback.status, 200, finalReadback.text);
    assert.equal(finalReadback.body.status, 'active');
    assert.deepEqual(
      finalReadback.body.status_history.map(({ sequence, from, to }) => ({ sequence, from, to })),
      [
        { sequence: 1, from: null, to: 'active' },
        { sequence: 2, from: 'active', to: 'discharged' },
        { sequence: 3, from: 'discharged', to: 'active' },
      ],
    );
  } finally {
    await server?.stop().catch(() => {});
    store.cleanup();
  }
});
