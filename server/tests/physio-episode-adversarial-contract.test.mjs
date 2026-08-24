import assert from 'node:assert/strict';
import test from 'node:test';

import { PHYSIO_AI_INTERNAL_RECEIPT } from '../physioAiTasks.mjs';
import { createPhysioAiTaskHandler } from '../functions/physioAiTask.mjs';
import {
  loginAdmin,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

function entityRoute(server, entityName) {
  return `/api/apps/${server.appId}/entities/${entityName}`;
}

async function createEntity(server, token, entityName, body) {
  const response = await requestJson(server, entityRoute(server, entityName), {
    method: 'POST',
    token,
    body,
  });
  assert.equal(response.status, 200, response.text);
  return response.body;
}

test('even an admin cannot use a legacy-import marker to create an unassigned Physio clinical child', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });
  try {
    const token = await loginAdmin(server);
    const organization = await createEntity(server, token, 'Organization', {
      name: 'Legacy bypass adversarial practice',
    });
    const client = await createEntity(server, token, 'Client', {
      org_id: organization.id,
      full_name: 'Legacy bypass adversarial patient',
    });
    const common = {
      org_id: organization.id,
      client_id: client.id,
      _legacy_unassigned_import: true,
    };
    const bodies = {
      ClientAssessment: {
        ...common,
        assessment_id: 'legacy-bypass-denial',
        status: 'completed',
        result_value: 0,
        assessment_date: '2026-08-22',
      },
      SOAPNote: {
        ...common,
        note_date: '2026-08-22T09:00:00.000Z',
        subjective: 'Legacy bypass denial',
      },
      SavedReport: {
        ...common,
        report_type: 'gp_summary',
        report_name: 'Legacy bypass denial',
        report_date: '2026-08-22',
      },
      ClientReport: {
        ...common,
        report_type: 'gp_summary',
        report_name: 'Legacy bypass denial',
        report_date: '2026-08-22',
      },
      ClientDocument: {
        ...common,
        document_type: 'other',
        file_url: '/api/files/legacy-bypass-denial',
        file_name: 'legacy-bypass-denial.txt',
      },
    };

    for (const [entityName, body] of Object.entries(bodies)) {
      const single = await requestJson(server, entityRoute(server, entityName), {
        method: 'POST',
        token,
        body,
      });
      assert.equal(single.status >= 400, true, `${entityName} single: ${single.text}`);

      const bulk = await requestJson(server, `${entityRoute(server, entityName)}/bulk`, {
        method: 'POST',
        token,
        body: [body],
      });
      assert.equal(bulk.status >= 400, true, `${entityName} bulk: ${bulk.text}`);

      const rows = await requestJson(
        server,
        `${entityRoute(server, entityName)}?q=${encodeURIComponent(JSON.stringify({
          client_id: client.id,
        }))}`,
        { token },
      );
      assert.equal(rows.status, 200, rows.text);
      assert.deepEqual(rows.body, [], `${entityName} retained a forbidden unassigned row`);
    }
  } finally {
    await server.stop();
  }
});

test('an exact retry while a Physio AI generation is pending never invokes a second provider call', async () => {
  let generation = null;
  let runCalls = 0;
  let releaseProvider;
  let markRunStarted;
  const runStarted = new Promise((resolve) => { markRunStarted = resolve; });
  const providerRelease = new Promise((resolve) => { releaseProvider = resolve; });
  const store = {
    acquire(candidate) {
      if (generation) return { generation, created: false };
      generation = {
        id: 'generation-pending-adversarial-1',
        ...candidate,
        status: 'pending',
        publicResponse: null,
        createdAt: new Date().toISOString(),
      };
      return { generation, created: true };
    },
    markSucceeded(id, result) {
      assert.equal(id, generation.id);
      Object.assign(generation, result, { status: 'succeeded' });
      return generation;
    },
    markFailed(id, errorCode) {
      assert.equal(id, generation.id);
      Object.assign(generation, { status: 'failed', errorCode });
      return generation;
    },
  };
  const handler = createPhysioAiTaskHandler({
    run: async (request) => {
      runCalls += 1;
      markRunStarted();
      await providerRelease;
      const result = {
        task: request.task,
        output_state: 'ai_draft_unreviewed',
        output: { presenting_problem_summary: 'Pending-generation adversarial proof.' },
        provenance: { provider_request_id_hash: 'a'.repeat(64) },
      };
      Object.defineProperty(result, PHYSIO_AI_INTERNAL_RECEIPT, {
        value: {
          usageReservationId: 'usage-pending-adversarial-1',
          providerResponseId: 'provider-pending-adversarial-1',
          providerHttpRequestId: 'request-pending-adversarial-1',
        },
      });
      return result;
    },
  });
  const episode = {
    id: 'episode-pending-adversarial-1',
    org_id: 'org-pending-adversarial-1',
    client_id: 'client-pending-adversarial-1',
    status: 'active',
    updated_date: '2026-08-22T06:00:00.000Z',
  };
  const entities = {
    OrganizationMember: { filter: async () => [{ org_id: episode.org_id }] },
    PhysioCareEpisode: { filter: async () => [episode] },
    Client: { filter: async () => [{ id: episode.client_id, org_id: episode.org_id }] },
    ClientAssessment: { filter: async () => [] },
    SOAPNote: { filter: async () => [] },
    SavedReport: { filter: async () => [] },
    ClientReport: { filter: async () => [] },
    ClientDocument: { filter: async () => [] },
  };
  const request = {
    user: { id: 'user-pending-adversarial-1', email: 'pending@example.test', role: 'user' },
    body: {
      task: 'physio.initial_assessment_summary.v1',
      org_id: episode.org_id,
      care_episode_id: episode.id,
      generation_request_id: 'pending-generation-request-0001',
      context: {},
    },
    entities,
    physioAiGenerations: store,
    apiUsage: {},
    respond: (status, body) => ({ status, body }),
  };

  const first = handler(request);
  await runStarted;
  const retry = await handler(request);
  assert.equal(retry.status, 409);
  assert.equal(retry.body.code, 'generation_in_progress');
  assert.equal(runCalls, 1, 'a pending exact retry must not call the provider twice');
  releaseProvider();
  const completed = await first;
  assert.equal(completed.status, 200);
  assert.equal(completed.body.generation_id, generation.id);
  assert.equal(runCalls, 1);
});
