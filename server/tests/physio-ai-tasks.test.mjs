import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import {
  PHYSIO_AI_CONTRACT_VERSION,
  PHYSIO_AI_INTERNAL_RECEIPT,
  PHYSIO_AI_RECEIPT_CONTRACT_VERSION,
  PHYSIO_AI_TASK_IDS,
  PHYSIO_AI_TASKS,
  PhysioAiTaskError,
  createPhysioAiTaskRunner,
  preparePhysioClinicalContext,
  validatePhysioTaskOutput,
} from '../physioAiTasks.mjs';
import { createPhysioAiTaskHandler } from '../functions/physioAiTask.mjs';
import { llmEnabled } from '../llm.mjs';
import { startFakeOpenAIChat } from './support/fake-openai-chat.mjs';
import {
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const EXPECTED_TASKS = [
  'physio.initial_assessment_summary.v1',
  'physio.soap_note.v1',
  'physio.management_plan.v1',
  'physio.progress_comparison.v1',
  'physio.referrer_update.v1',
  'physio.discharge_summary.v1',
];

function valueForSchema(schema, key = 'field') {
  if (schema?.type === 'object') {
    return Object.fromEntries(
      Object.entries(schema.properties || {}).map(([childKey, childSchema]) => [
        childKey,
        valueForSchema(childSchema, childKey),
      ]),
    );
  }
  if (schema?.type === 'array') return [valueForSchema(schema.items, key)];
  if (schema?.type === 'string') return `Provider content for ${key}`;
  throw new Error(`unsupported test schema type: ${schema?.type}`);
}

function providerGeneration(taskId, overrides = {}) {
  return {
    value: valueForSchema(PHYSIO_AI_TASKS[taskId].schema),
    provider: 'receipt-provider',
    model: 'receipt-model-2026-08-21',
    modelFromProvider: true,
    finishReason: 'stop',
    providerStatus: 200,
    usage: { inputTokens: 101, cachedInputTokens: 11, outputTokens: 43 },
    providerRequestId: 'provider-request-real-receipt',
    providerHttpRequestId: 'provider-http-request-real-receipt',
    ...overrides,
  };
}

function usageDouble(events = []) {
  return {
    estimateChatMicrousd(input) {
      events.push(['estimate', input]);
      return 1_500;
    },
    async reserve(input) {
      events.push(['reserve', input]);
      return { id: 'usage-reservation-1' };
    },
    calculateChatCostMicrousd(input) {
      events.push(['calculate', input]);
      return 327;
    },
    async settle(input) {
      events.push(['settle', input]);
      return { id: input.reservationId, status: input.status };
    },
  };
}

function generationStoreDouble() {
  const rows = new Map();
  let sequence = 0;
  const keyFor = (orgId, idempotencyKey) => `${orgId}\u0000${idempotencyKey}`;
  return {
    rows,
    acquire(candidate) {
      const key = keyFor(candidate.orgId, candidate.idempotencyKey);
      const existing = rows.get(key);
      if (existing) return { generation: existing, created: false };
      const generation = {
        id: `generation-${++sequence}`,
        ...candidate,
        status: 'pending',
        publicResponse: null,
      };
      rows.set(key, generation);
      return { generation, created: true };
    },
    markSucceeded(id, result) {
      const generation = [...rows.values()].find((row) => row.id === id);
      Object.assign(generation, result, { status: 'succeeded' });
      return generation;
    },
    markFailed(id, errorCode) {
      const generation = [...rows.values()].find((row) => row.id === id);
      if (generation?.status === 'pending') Object.assign(generation, { status: 'failed', errorCode });
      return generation;
    },
  };
}

test('the server owns exactly six versioned Physio task schemas and every complete draft validates', () => {
  assert.deepEqual(PHYSIO_AI_TASK_IDS, EXPECTED_TASKS);
  assert.match(PHYSIO_AI_CONTRACT_VERSION, /^physio-ai-task-contract\/\d+\.\d+\.\d+$/);
  assert.equal(PHYSIO_AI_RECEIPT_CONTRACT_VERSION, 'physio-ai-provider-receipt/1.0.0');
  for (const taskId of EXPECTED_TASKS) {
    const contract = PHYSIO_AI_TASKS[taskId];
    assert.ok(contract.label);
    assert.ok(contract.purpose);
    assert.ok(contract.version);
    assert.equal(contract.schema.type, 'object');
    assert.equal(contract.schema.additionalProperties, false);
    assert.doesNotThrow(() => validatePhysioTaskOutput(taskId, valueForSchema(contract.schema)));
  }
});

test('normal clinical context is accepted without synthetic-only switches and direct identifier fields are removed', () => {
  const prepared = preparePhysioClinicalContext({
    client: {
      first_name: 'Identifier Canary',
      name: 'Second Identifier Canary',
      client_id: 'client-private-id',
      functional_limitations: ['Difficulty walking beyond 400 metres'],
    },
    care_episode: {
      body_region: 'lumbar spine',
      current_irritability: 'moderate',
      exercises: [{ name: 'Sit to stand', dosage: 'Three sets of eight' }],
    },
  });
  assert.equal(prepared.client.first_name, undefined);
  assert.equal(prepared.client.name, undefined);
  assert.equal(prepared.client.client_id, undefined);
  assert.deepEqual(prepared.client.functional_limitations, ['Difficulty walking beyond 400 metres']);
  assert.equal(prepared.care_episode.body_region, 'lumbar spine');
  assert.equal(prepared.care_episode.exercises[0].name, 'Sit to stand');
});

test('successful generation is provider-receipted, usage-settled and contains no raw provider request id', async () => {
  const events = [];
  let invocation;
  const taskId = 'physio.progress_comparison.v1';
  const run = createPhysioAiTaskRunner({
    featureEnabled: () => true,
    providerAvailable: () => true,
    providerSelector: () => 'receipt-provider',
    modelSelector: () => 'gpt-4.1',
    now: () => new Date('2026-08-21T02:03:04.000Z'),
    invoke: async (input) => {
      events.push(['invoke']);
      invocation = input;
      return providerGeneration(taskId);
    },
  });
  const result = await run({
    task: taskId,
    orgId: 'org-real-workflow',
    context: {
      client: { full_name: 'Direct Identifier Canary', function: 'Walking tolerance improved from 5 to 12 minutes.' },
      review: { baseline_score: 32, current_score: 21, unit: 'points' },
    },
  }, { apiUsage: usageDouble(events) });

  assert.deepEqual(events.map(([name]) => name), ['estimate', 'reserve', 'invoke', 'calculate', 'settle']);
  assert.equal(events.find(([name]) => name === 'reserve')[1].provider, 'receipt-provider');
  assert.equal(events.at(-1)[1].status, 'succeeded');
  assert.equal(events.at(-1)[1].providerRequestId, 'provider-request-real-receipt');
  assert.equal(events.at(-1)[1].inputTokens, 101);
  assert.equal(events.at(-1)[1].cachedInputTokens, 11);
  assert.equal(events.at(-1)[1].outputTokens, 43);
  assert.match(invocation.systemInstructions.join(' '), /Australian physiotherapy service/);
  assert.doesNotMatch(invocation.systemInstructions.join(' '), /exercise physiology/i);
  assert.doesNotMatch(invocation.prompt, /Direct Identifier Canary/);
  assert.match(invocation.prompt, /Walking tolerance improved/);
  assert.equal(result.task, taskId);
  assert.equal(result.output_state, 'ai_draft_unreviewed');
  assert.equal(result.provenance.provider, 'receipt-provider');
  assert.equal(result.provenance.model, 'receipt-model-2026-08-21');
  assert.equal(result.provenance.receipt_contract_version, PHYSIO_AI_RECEIPT_CONTRACT_VERSION);
  assert.equal(result.provenance.generated_at, '2026-08-21T02:03:04.000Z');
  assert.equal(
    result.provenance.provider_request_id_hash,
    createHash('sha256').update('provider-request-real-receipt').digest('hex'),
  );
  assert.equal(
    result.provenance.provider_http_request_id_hash,
    createHash('sha256').update('provider-http-request-real-receipt').digest('hex'),
  );
  assert.equal(result.provenance.output_schema_receipt.result, 'valid');
  assert.match(result.provenance.output_schema_receipt.schema_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.provenance.usage.actual_cost_microusd, 327);
  assert.doesNotMatch(JSON.stringify(result), /provider-request-real-receipt/);
  assert.doesNotMatch(JSON.stringify(result), /provider-http-request-real-receipt/);
});

test('feature-off and provider-unconfigured postures fail before usage reservation or egress', async () => {
  for (const posture of [
    { featureEnabled: () => false, providerAvailable: () => true, code: 'ai_capability_disabled' },
    { featureEnabled: () => true, providerAvailable: () => false, code: 'ai_provider_unconfigured' },
  ]) {
    let invoked = false;
    let reserved = false;
    const run = createPhysioAiTaskRunner({
      ...posture,
      invoke: async () => { invoked = true; },
    });
    await assert.rejects(
      () => run(
        { task: 'physio.soap_note.v1', orgId: 'org-1', context: { encounter: { symptom_change: 'Improved' } } },
        { apiUsage: { ...usageDouble(), reserve: async () => { reserved = true; } } },
      ),
      (error) => error instanceof PhysioAiTaskError && error.status === 503 && error.code === posture.code,
    );
    assert.equal(invoked, false);
    assert.equal(reserved, false);
  }
});

test('provider errors, malformed drafts and every partial receipt shape settle failed and never return fallback content', async () => {
  const cases = [
    async () => { throw new Error('PRIVATE_PROVIDER_FAILURE_CANARY'); },
    async () => providerGeneration('physio.soap_note.v1', { value: { subjective: 'Incomplete' } }),
    async () => providerGeneration('physio.soap_note.v1', { provider: null }),
    async () => providerGeneration('physio.soap_note.v1', { provider: 'different-provider' }),
    async () => providerGeneration('physio.soap_note.v1', { model: null }),
    async () => providerGeneration('physio.soap_note.v1', { modelFromProvider: false }),
    async () => providerGeneration('physio.soap_note.v1', { providerRequestId: null }),
    async () => providerGeneration('physio.soap_note.v1', { providerHttpRequestId: null }),
    async () => providerGeneration('physio.soap_note.v1', { finishReason: null }),
    async () => providerGeneration('physio.soap_note.v1', { providerStatus: null }),
    async () => providerGeneration('physio.soap_note.v1', { usage: null }),
    async () => providerGeneration('physio.soap_note.v1', {
      usage: { inputTokens: 101, cachedInputTokens: 11, outputTokens: null },
    }),
  ];
  for (const invoke of cases) {
    const events = [];
    const run = createPhysioAiTaskRunner({
      featureEnabled: () => true,
      providerAvailable: () => true,
      providerSelector: () => 'receipt-provider',
      modelSelector: () => 'gpt-4.1',
      invoke,
    });
    await assert.rejects(
      () => run(
        { task: 'physio.soap_note.v1', orgId: 'org-1', context: { encounter: { symptom_change: 'Improved' } } },
        { apiUsage: usageDouble(events) },
      ),
      (error) => {
        assert.ok(error instanceof PhysioAiTaskError);
        assert.equal(error.status, 502);
        assert.equal(error.code, 'ai_provider_failed');
        assert.doesNotMatch(error.message, /PRIVATE_PROVIDER_FAILURE_CANARY/);
        return true;
      },
    );
    const settlement = events.find(([name]) => name === 'settle');
    assert.equal(settlement?.[1]?.status, 'failed');
    assert.equal(events.some(([name]) => name === 'calculate'), false);
  }
});

test('the loopback fake-provider carve-out is test-scoped, synthetic-key-only and loopback-only', () => {
  const keys = ['SELFTEST', 'OPENAI_API_KEY', 'OPENAI_CHAT_TEST_BASE_URL'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.SELFTEST = '1';
    process.env.OPENAI_API_KEY = 'placeholder-non-synthetic-key';
    process.env.OPENAI_CHAT_TEST_BASE_URL = 'http://127.0.0.1:45678/v1/chat/completions';
    assert.equal(llmEnabled(), false, 'a non-synthetic key cannot activate the self-test adapter');

    process.env.OPENAI_API_KEY = 'synthetic-physio-receipt-proof';
    process.env.OPENAI_CHAT_TEST_BASE_URL = 'https://provider.example.test/v1/chat/completions';
    assert.equal(llmEnabled(), false, 'a non-loopback URL cannot activate the self-test adapter');

    process.env.OPENAI_CHAT_TEST_BASE_URL = 'http://127.0.0.1:45678/v1/chat/completions';
    assert.equal(llmEnabled(), true, 'the explicit self-test + synthetic key + loopback conjunction is required');
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test('the function handler requires authentication and organisation membership before invoking the task runner', async () => {
  let runCalls = 0;
  let runRequest;
  const physioAiGenerations = generationStoreDouble();
  const handler = createPhysioAiTaskHandler({
    run: async (request) => {
      runCalls += 1;
      runRequest = request;
      const result = {
        task: request.task,
        orgId: request.orgId,
        output_state: 'ai_draft_unreviewed',
        output: { ok: true },
        provenance: { provider_request_id_hash: 'a'.repeat(64) },
      };
      Object.defineProperty(result, PHYSIO_AI_INTERNAL_RECEIPT, {
        value: {
          usageReservationId: 'usage-reservation-handler-1',
          providerResponseId: 'provider-response-handler-1',
          providerHttpRequestId: 'provider-http-request-handler-1',
        },
      });
      return result;
    },
  });
  const respond = (status, body) => ({ status, body });
  const episode = {
    id: 'episode-1',
    org_id: 'org-1',
    client_id: 'client-1',
    status: 'active',
    presenting_problem: 'Lumbar pain',
  };
  const client = {
    id: 'client-1',
    org_id: 'org-1',
    full_name: 'PRIVATE PATIENT NAME',
    primary_condition: 'Lumbar pain',
  };
  const assessment = {
    id: 'assessment-1',
    org_id: 'org-1',
    client_id: 'client-1',
    physio_care_episode_id: 'episode-1',
    assessment_id: 'canonical-assessment',
    result_value: 0,
    notes: 'EPISODE_ONE_GATEWAY_CANARY',
  };
  const entities = (overrides = {}) => ({
    OrganizationMember: { filter: async () => [{ org_id: 'org-1' }] },
    PhysioCareEpisode: { filter: async () => [episode] },
    Client: { filter: async () => [client] },
    ClientAssessment: { filter: async () => [assessment] },
    SOAPNote: { filter: async () => [] },
    SavedReport: { filter: async () => [] },
    ClientReport: { filter: async () => [] },
    ClientDocument: { filter: async () => [] },
    ...overrides,
  });
  const base = {
    body: {
      task: 'physio.initial_assessment_summary.v1',
      org_id: 'org-1',
      care_episode_id: 'episode-1',
      generation_request_id: 'handler-generation-0001',
      context: { clinician_context: 'Include the recorded work demands.' },
    },
    respond,
    apiUsage: {},
    physioAiGenerations,
    entities: entities({ OrganizationMember: { filter: async () => [] } }),
  };

  const anonymous = await handler({ ...base, user: null });
  assert.equal(anonymous.status, 401);
  const outsider = await handler({ ...base, user: { id: 'u1', email: 'outside@example.test', role: 'user' } });
  assert.equal(outsider.status, 403);
  assert.equal(runCalls, 0);

  const member = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    entities: entities(),
  });
  assert.equal(member.status, 200);
  assert.equal(member.body.care_episode_id, 'episode-1');
  assert.equal(member.body.generation_id, 'generation-1');
  assert.equal(runCalls, 1);
  assert.equal(runRequest.context.assessment_records.length, 1);
  assert.equal(runRequest.context.assessment_records[0].result_value, 0);
  assert.equal(runRequest.context.assessment_records[0].notes, 'EPISODE_ONE_GATEWAY_CANARY');
  assert.equal(runRequest.context.assessment_records[0].physio_care_episode_id, undefined);
  assert.equal(runRequest.context.client_profile.full_name, undefined);
  assert.equal(runRequest.context.clinician_context, 'Include the recorded work demands.');

  const replay = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    entities: entities(),
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.generation_id, member.body.generation_id);
  assert.equal(runCalls, 1, 'an exact retry must read back the durable generation');

  const conflictingReplay = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    body: { ...base.body, context: { clinician_context: 'Different canonical request.' } },
    entities: entities(),
  });
  assert.equal(conflictingReplay.status, 409);
  assert.equal(conflictingReplay.body.code, 'generation_request_conflict');
  assert.equal(runCalls, 1);

  const missingEpisode = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    body: { ...base.body, care_episode_id: undefined },
    entities: entities(),
  });
  assert.equal(missingEpisode.status, 400);
  assert.equal(missingEpisode.body.code, 'care_episode_required');

  const callerInjection = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    body: {
      ...base.body,
      context: { assessment_records: [{ notes: 'CALLER_CROSS_EPISODE_CANARY' }] },
    },
    entities: entities(),
  });
  assert.equal(callerInjection.status, 400);
  assert.equal(callerInjection.body.code, 'caller_clinical_context_forbidden');

  const mismatchedLoadedRecord = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    body: { ...base.body, generation_request_id: 'handler-mismatch-record-0001' },
    entities: entities({
      ClientAssessment: {
        filter: async () => [{
          ...assessment,
          id: 'assessment-episode-2',
          physio_care_episode_id: 'episode-2',
          notes: 'EPISODE_TWO_GATEWAY_CANARY',
        }],
      },
    }),
  });
  assert.equal(mismatchedLoadedRecord.status, 409);
  assert.equal(mismatchedLoadedRecord.body.code, 'care_episode_context_mismatch');

  const mismatchedPatient = await handler({
    ...base,
    user: { id: 'u2', email: 'member@example.test', role: 'user' },
    body: { ...base.body, generation_request_id: 'handler-mismatch-patient-0001' },
    entities: entities({
      Client: {
        filter: async () => [{ ...client, id: 'client-2', full_name: 'OTHER PATIENT' }],
      },
    }),
  });
  assert.equal(mismatchedPatient.status, 409);
  assert.equal(mismatchedPatient.body.code, 'care_episode_patient_mismatch');
  assert.equal(runCalls, 1, 'no rejected context may reach the task runner');
});

test('versioned Physio function reaches the real adapter with legacy general AI off and never falls back', async () => {
  const fakeChat = await startFakeOpenAIChat();
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    LLM_REQUIRED: '0',
    OPENAI_API_KEY: 'synthetic-physio-provider-proof-key',
    OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
  });
  try {
    const route = `/api/apps/${server.appId}/functions/physioAiTask`;
    const anonymous = await requestJson(server, route, {
      method: 'POST',
      body: {
        task: 'physio.initial_assessment_summary.v1',
        org_id: 'org-not-authorised',
        care_episode_id: 'episode-not-authorised',
        context: {},
      },
    });
    assert.equal(anonymous.status, 401, anonymous.text);
    assert.equal(fakeChat.calls.length, 0);

    const adminToken = await loginAdmin(server);
    const clinician = await registerUser(server, 'physio-ai-clinician@example.test');
    const activation = await requestJson(server, `/api/apps/${server.appId}/entities/User/${clinician.id}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        account_status: 'active',
        country: 'australia',
        profession: 'Physiotherapist',
      },
    });
    assert.equal(activation.status, 200, activation.text);
    const organization = await createOrganizationForUser(server, adminToken, clinician);
    const legalAcceptance = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      {
        method: 'POST', token: clinician.token,
        body: { org_id: organization.id, marketing_opt_in: false },
      },
    );
    assert.equal(legalAcceptance.status, 200, legalAcceptance.text);
    const createEntity = async (entityName, body) => {
      const response = await requestJson(server, `/api/apps/${server.appId}/entities/${entityName}`, {
        method: 'POST', token: adminToken, body,
      });
      assert.equal(response.status, 200, response.text);
      return response.body;
    };
    const patient = await createEntity('Client', {
      org_id: organization.id,
      full_name: 'PROVIDER_IDENTIFIER_CANARY',
      primary_condition: 'Standing is limited to ten minutes.',
    });
    const episodeOne = await createEntity('PhysioCareEpisode', {
      schema_version: 3,
      org_id: organization.id,
      client_id: patient.id,
      episode_number: 1,
      status: 'active',
      episode_start_date: '2026-08-01',
      presenting_problem: 'Mechanical lumbar pain',
    });
    const episodeTwo = await createEntity('PhysioCareEpisode', {
      schema_version: 3,
      org_id: organization.id,
      client_id: patient.id,
      episode_number: 2,
      status: 'active',
      episode_start_date: '2026-08-15',
      presenting_problem: 'Separate shoulder episode',
    });
    await createEntity('ClientAssessment', {
      org_id: organization.id,
      client_id: patient.id,
      physio_care_episode_id: episodeOne.id,
      assessment_id: 'patient-specific-functional-scale',
      status: 'completed',
      result_value: 0,
      notes: 'EPISODE_ONE_PROVIDER_CONTEXT_CANARY',
      assessment_date: '2026-08-02',
    });
    await createEntity('ClientAssessment', {
      org_id: organization.id,
      client_id: patient.id,
      physio_care_episode_id: episodeTwo.id,
      assessment_id: 'separate-episode-assessment',
      status: 'completed',
      result_value: 99,
      notes: 'EPISODE_TWO_PROVIDER_CONTEXT_CANARY',
      assessment_date: '2026-08-16',
    });
    const requestBody = {
      task: 'physio.initial_assessment_summary.v1',
      org_id: organization.id,
      care_episode_id: episodeOne.id,
      generation_request_id: 'physio-ai-e2e-generation-0001',
      context: {
        clinician_context: 'Contact identifier-canary@example.test only after clinician review.',
      },
    };
    const callerInjection = await requestJson(server, route, {
      method: 'POST', token: clinician.token,
      body: {
        ...requestBody,
        context: {
          clinician_context: 'Legitimate free text',
          assessment_records: [{ notes: 'CALLER_CROSS_EPISODE_CANARY' }],
        },
      },
    });
    assert.equal(callerInjection.status, 400, callerInjection.text);
    assert.equal(callerInjection.body?.code, 'caller_clinical_context_forbidden');
    assert.equal(fakeChat.calls.length, 0);

    const success = await requestJson(server, route, {
      method: 'POST', token: clinician.token, body: requestBody,
    });
    assert.equal(success.status, 200, success.text);
    assert.equal(success.body?.task, 'physio.initial_assessment_summary.v1');
    assert.equal(success.body?.care_episode_id, episodeOne.id);
    assert.match(success.body?.generation_id || '', /^[0-9a-f-]{36}$/i);
    assert.equal(success.body?.output_state, 'ai_draft_unreviewed');
    assert.equal(success.body?.provenance?.provider, 'openai');
    assert.equal(success.body?.provenance?.receipt_contract_version, PHYSIO_AI_RECEIPT_CONTRACT_VERSION);
    assert.equal(success.body?.provenance?.finish_reason, 'stop');
    assert.equal(success.body?.provenance?.output_schema_receipt?.result, 'valid');
    assert.match(success.body?.provenance?.output_schema_receipt?.schema_sha256 || '', /^[0-9a-f]{64}$/);
    assert.equal(success.body?.provenance?.usage?.input_tokens, 100);
    assert.equal(success.body?.provenance?.usage?.cached_input_tokens, 20);
    assert.equal(success.body?.provenance?.usage?.output_tokens, 30);
    assert.equal(
      success.body?.provenance?.provider_request_id_hash,
      createHash('sha256').update('chatcmpl_synthetic_assurance').digest('hex'),
    );
    assert.equal(
      success.body?.provenance?.provider_http_request_id_hash,
      createHash('sha256').update('req_synthetic_assurance').digest('hex'),
    );
    assert.doesNotMatch(success.text, /chatcmpl_synthetic_assurance/);
    assert.doesNotMatch(success.text, /Mock|placeholder/i);
    assert.equal(fakeChat.calls.length, 1);
    assert.match(fakeChat.calls[0].systemContent, /Australian physiotherapy service/);
    assert.doesNotMatch(fakeChat.calls[0].systemContent, /exercise physiology/i);
    assert.doesNotMatch(fakeChat.calls[0].userContent, /PROVIDER_IDENTIFIER_CANARY/);
    assert.match(fakeChat.calls[0].userContent, /EPISODE_ONE_PROVIDER_CONTEXT_CANARY/);
    assert.match(fakeChat.calls[0].userContent, /"result_value": 0/);
    assert.doesNotMatch(fakeChat.calls[0].userContent, /EPISODE_TWO_PROVIDER_CONTEXT_CANARY/);
    assert.doesNotMatch(fakeChat.calls[0].userContent, /CALLER_CROSS_EPISODE_CANARY/);
    assert.doesNotMatch(fakeChat.calls[0].userContent, /identifier-canary@example\.test/);
    assert.match(fakeChat.calls[0].userContent, /\[REDACTED_EMAIL\]/);

    const privateGenerationRoute = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/PhysioAIGeneration`,
      { token: clinician.token },
    );
    assert.equal(privateGenerationRoute.status, 404, privateGenerationRoute.text);

    const replay = await requestJson(server, route, {
      method: 'POST', token: clinician.token, body: requestBody,
    });
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.body?.generation_id, success.body?.generation_id);
    assert.equal(fakeChat.calls.length, 1, 'an exact retry must read back without a second provider call');

    const conflictingReplay = await requestJson(server, route, {
      method: 'POST', token: clinician.token,
      body: {
        ...requestBody,
        context: { clinician_context: 'A different canonical request.' },
      },
    });
    assert.equal(conflictingReplay.status, 409, conflictingReplay.text);
    assert.equal(conflictingReplay.body?.code, 'generation_request_conflict');
    assert.equal(fakeChat.calls.length, 1);

    const forgedGenericDraft = await requestJson(server, `/api/apps/${server.appId}/entities/SavedReport`, {
      method: 'POST',
      token: clinician.token,
      body: {
        org_id: organization.id,
        client_id: patient.id,
        physio_care_episode_id: episodeOne.id,
        report_type: 'CUSTOM_REPORT',
        report_name: 'FORGED_GENERATION_BINDING_DENIAL',
        report_date: '2026-08-22',
        ai_generation: {
          generation_id: success.body.generation_id,
          task_type: 'physio.discharge_summary.v1',
          provenance: success.body.provenance,
        },
      },
    });
    assert.equal(forgedGenericDraft.status, 403, forgedGenericDraft.text);
    const ordinarySoap = await createEntity('SOAPNote', {
      org_id: organization.id,
      client_id: patient.id,
      physio_care_episode_id: episodeOne.id,
      note_date: '2026-08-22T09:00:00.000Z',
      subjective: 'Ordinary non-AI note',
    });
    const forgedAiMetadata = {
      generation_id: success.body.generation_id,
      task_type: requestBody.task,
      provenance: success.body.provenance,
    };
    for (const [label, forged] of [
      ['single update', await requestJson(server, `/api/apps/${server.appId}/entities/SOAPNote/${ordinarySoap.id}`, {
        method: 'PUT', token: clinician.token, body: { ai_generation: forgedAiMetadata },
      })],
      ['bulk create', await requestJson(server, `/api/apps/${server.appId}/entities/SOAPNote/bulk`, {
        method: 'POST', token: clinician.token,
        body: [{
          org_id: organization.id,
          client_id: patient.id,
          physio_care_episode_id: episodeOne.id,
          note_date: '2026-08-22T10:00:00.000Z',
          ai_generation: forgedAiMetadata,
        }],
      })],
      ['bulk update', await requestJson(server, `/api/apps/${server.appId}/entities/SOAPNote/bulk`, {
        method: 'PUT', token: clinician.token,
        body: [{ id: ordinarySoap.id, ai_generation: forgedAiMetadata }],
      })],
      ['update many', await requestJson(server, `/api/apps/${server.appId}/entities/SOAPNote/update-many`, {
        method: 'PATCH', token: clinician.token,
        body: { query: { id: ordinarySoap.id }, data: { ai_generation: forgedAiMetadata } },
      })],
    ]) {
      assert.equal(forged.status, 403, `${label}: ${forged.text}`);
    }

    const saveRoute = `/api/apps/${server.appId}/functions/savePhysioAiGeneration`;
    const saveBody = {
      generation_id: success.body.generation_id,
      edited_output: success.body.output,
      save_request_id: 'physio-ai-e2e-save-0001',
      expected_episode_updated_date: episodeOne.updated_date,
    };
    const attemptedBindingOverride = await requestJson(server, saveRoute, {
      method: 'POST', token: clinician.token,
      body: {
        ...saveBody,
        org_id: 'org-forged',
        care_episode_id: episodeTwo.id,
        task: 'physio.soap_note.v1',
      },
    });
    assert.equal(attemptedBindingOverride.status, 400, attemptedBindingOverride.text);
    assert.equal(attemptedBindingOverride.body?.code, 'unknown_parameters');
    const crossUserSave = await requestJson(server, saveRoute, {
      method: 'POST', token: adminToken, body: saveBody,
    });
    assert.equal(crossUserSave.status, 403, crossUserSave.text);
    assert.equal(crossUserSave.body?.code, 'generation_user_mismatch');
    const wrongEpisodeVersion = await requestJson(server, saveRoute, {
      method: 'POST', token: clinician.token,
      body: { ...saveBody, expected_episode_updated_date: '1900-01-01T00:00:00.000Z' },
    });
    assert.equal(wrongEpisodeVersion.status, 409, wrongEpisodeVersion.text);
    assert.equal(wrongEpisodeVersion.body?.code, 'generation_episode_version_mismatch');
    // Treat the first successful response as lost. An exact retry must read
    // back the one committed link and never create a second clinical row.
    const committedBeforeResponseLoss = await requestJson(server, saveRoute, {
      method: 'POST', token: clinician.token, body: saveBody,
    });
    assert.equal(committedBeforeResponseLoss.status, 200, committedBeforeResponseLoss.text);
    const savedDraftReplay = await requestJson(server, saveRoute, {
      method: 'POST', token: clinician.token, body: saveBody,
    });
    assert.equal(savedDraftReplay.status, 200, savedDraftReplay.text);
    assert.equal(savedDraftReplay.body?.replayed, true);
    assert.equal(savedDraftReplay.body?.linked_entity, 'SavedReport');
    assert.equal(savedDraftReplay.body?.linked_record?.id, committedBeforeResponseLoss.body?.linked_record?.id);
    assert.equal(savedDraftReplay.body?.linked_record?.physio_care_episode_id, episodeOne.id);
    assert.equal(savedDraftReplay.body?.linked_record?.ai_generation?.generation_id, success.body.generation_id);
    assert.equal(savedDraftReplay.body?.linked_record?.ai_generation?.task_type, requestBody.task);
    assert.equal(savedDraftReplay.body?.care_episode?.reporting?.latest_ai_draft?.generation_id, success.body.generation_id);
    const editedReport = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/SavedReport/${savedDraftReplay.body.linked_record.id}`,
      {
        method: 'PUT', token: clinician.token,
        body: {
          section_content: {
            ...savedDraftReplay.body.linked_record.section_content,
            synthetic_clinician_edit: 'PHYSIO_CANARY_CLINICIAN_EDIT_VERIFIED',
          },
          expected_updated_date: savedDraftReplay.body.linked_record.updated_date,
        },
      },
    );
    assert.equal(editedReport.status, 200, editedReport.text);
    assert.equal(
      editedReport.body?.section_content?.synthetic_clinician_edit,
      'PHYSIO_CANARY_CLINICIAN_EDIT_VERIFIED',
    );
    const saveConflict = await requestJson(server, saveRoute, {
      method: 'POST', token: clinician.token,
      body: {
        ...saveBody,
        edited_output: {
          ...saveBody.edited_output,
          presenting_problem_summary:
            `${saveBody.edited_output.presenting_problem_summary} conflicting edit`,
        },
      },
    });
    assert.equal(saveConflict.status, 409, saveConflict.text);
    assert.equal(saveConflict.body?.code, 'save_request_conflict');
    assert.equal(fakeChat.calls.length, 1, 'saving or replaying a review must never call the provider');

    const db = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const succeeded = db.prepare(`
        SELECT id, status, feature, input_tokens, cached_input_tokens, output_tokens, provider_request_id_hash
        FROM api_usage_reservation
        ORDER BY created_at ASC
      `).all();
      assert.equal(succeeded.length, 1);
      assert.equal(succeeded[0].status, 'succeeded');
      assert.equal(succeeded[0].feature, 'invoke_llm');
      assert.equal(succeeded[0].input_tokens, 100);
      assert.equal(succeeded[0].cached_input_tokens, 20);
      assert.equal(succeeded[0].output_tokens, 30);
      assert.equal(succeeded[0].provider_request_id_hash, success.body.provenance.provider_request_id_hash);
      const generations = db.prepare(`
        SELECT id, org_id, client_id, care_episode_id, task_id, status, review_status,
               usage_reservation_id, provider_response_id, provider_http_request_id,
               provider_request_id_hash, public_response_json, linked_entity, linked_record_id
        FROM physio_ai_generation
      `).all();
      const linkedRows = db.prepare(`
        SELECT COUNT(*) AS count
        FROM entity_SavedReport
        WHERE json_extract(data, '$.ai_generation.generation_id') = ?
      `).get(success.body.generation_id);
      assert.equal(Number(linkedRows.count), 1, 'response-loss replay must not duplicate the clinical record');
      assert.equal(generations.length, 1);
      assert.equal(generations[0].id, success.body.generation_id);
      assert.equal(generations[0].org_id, organization.id);
      assert.equal(generations[0].client_id, patient.id);
      assert.equal(generations[0].care_episode_id, episodeOne.id);
      assert.equal(generations[0].task_id, requestBody.task);
      assert.equal(generations[0].status, 'succeeded');
      assert.equal(generations[0].review_status, 'saved');
      assert.equal(generations[0].usage_reservation_id, succeeded[0].id);
      assert.equal(generations[0].provider_response_id, 'chatcmpl_synthetic_assurance');
      assert.equal(generations[0].provider_http_request_id, 'req_synthetic_assurance');
      assert.equal(generations[0].provider_request_id_hash, success.body.provenance.provider_request_id_hash);
      assert.equal(generations[0].linked_entity, 'SavedReport');
      assert.equal(generations[0].linked_record_id, savedDraftReplay.body.linked_record.id);
      assert.equal(JSON.parse(generations[0].public_response_json).generation_id, success.body.generation_id);
    } finally {
      db.close();
    }

    const staleGenerationRequest = {
      ...requestBody,
      care_episode_id: episodeTwo.id,
      generation_request_id: 'physio-ai-e2e-stale-episode-0001',
    };
    const staleGeneration = await requestJson(server, route, {
      method: 'POST', token: clinician.token, body: staleGenerationRequest,
    });
    assert.equal(staleGeneration.status, 200, staleGeneration.text);
    const changedEpisodeTwo = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/PhysioCareEpisode/${episodeTwo.id}`,
      {
        method: 'PUT', token: adminToken,
        body: {
          expected_updated_date: episodeTwo.updated_date,
          presenting_complaint: 'Changed after the AI generation completed',
        },
      },
    );
    assert.equal(changedEpisodeTwo.status, 200, changedEpisodeTwo.text);
    const staleSave = await requestJson(server, saveRoute, {
      method: 'POST', token: clinician.token,
      body: {
        generation_id: staleGeneration.body.generation_id,
        edited_output: staleGeneration.body.output,
        save_request_id: 'physio-ai-e2e-stale-save-0001',
        expected_episode_updated_date: changedEpisodeTwo.body.updated_date,
      },
    });
    assert.equal(staleSave.status, 409, staleSave.text);
    assert.equal(staleSave.body?.code, 'generation_episode_version_mismatch');
    const staleCheckDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const linkedRows = staleCheckDb.prepare(`
        SELECT COUNT(*) AS count
        FROM entity_SavedReport
        WHERE json_extract(data, '$.ai_generation.generation_id') = ?
      `).get(staleGeneration.body.generation_id);
      assert.equal(Number(linkedRows.count), 0, 'stale generation must not create a linked clinical record');
    } finally {
      staleCheckDb.close();
    }
    assert.equal(fakeChat.calls.length, 2, 'the denied save must not call the provider');

    fakeChat.reset();
    fakeChat.setMode('provider-500');
    const failed = await requestJson(server, route, {
      method: 'POST', token: clinician.token,
      body: {
        ...requestBody,
        task: 'physio.soap_note.v1',
        generation_request_id: 'physio-ai-e2e-fault-0001',
      },
    });
    assert.equal(failed.status, 502, failed.text);
    assert.equal(failed.body?.code, 'ai_provider_failed');
    assert.equal(failed.body?.output, undefined);
    assert.doesNotMatch(failed.text, /FAKE_CHAT_PROVIDER_PRIVATE_BODY_CANARY/);
    assert.doesNotMatch(failed.text, /Mock|placeholder/i);
    assert.equal(fakeChat.calls.length, 1);

    const dbAfterFailure = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const statuses = dbAfterFailure.prepare('SELECT status FROM api_usage_reservation ORDER BY created_at ASC').all();
      assert.deepEqual(statuses.map((row) => row.status), ['succeeded', 'succeeded', 'failed']);
      const generationStatuses = dbAfterFailure.prepare(
        'SELECT status FROM physio_ai_generation ORDER BY created_at ASC',
      ).all();
      assert.deepEqual(generationStatuses.map((row) => row.status), ['succeeded', 'succeeded', 'failed']);
    } finally {
      dbAfterFailure.close();
    }
  } finally {
    await server.stop();
    await fakeChat.stop();
  }
});
