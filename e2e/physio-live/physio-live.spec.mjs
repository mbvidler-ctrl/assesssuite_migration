import { expect, test } from '@playwright/test';

import {
  PHYSIO_CANARY_AUDIO_EXPECTED_MARKER,
  readAndValidatePhysioCanaryAudioFixture,
} from '../../scripts/physio-exact-image-canary-fixture.mjs';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../../server/uploadRegistry.mjs';
import { pdfFixture } from '../../server/tests/support/synthetic-fixtures.mjs';
import { REFERRAL_EXTRACTION_SCHEMA } from '../../src/lib/referralExtractionSchema.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
import {
  PHYSIO_LIVE_QA_CLEANUP_CONTRACT_VERSION,
  PHYSIO_LIVE_QA_CLEANUP_OUTCOME,
  PHYSIO_LIVE_QA_TASK_IDS,
  resolvePhysioLiveQaConfiguration,
  sha256,
  writeProjectReceipt,
} from './live-qa-contract.mjs';

const live = resolvePhysioLiveQaConfiguration(process.env);
const apiRoot = `/api/apps/${live.appId}`;
const SYNTHETIC_EDIT_KEY = 'live_qa_clinician_edit';
const FORBIDDEN_PROVIDER_MARKERS = /mock|fake|placeholder|fallback|simulat/i;
const SYNTHETIC_CHILD_ENTITIES = Object.freeze([
  'SOAPNote',
  'SavedReport',
  'ClientReport',
  'ClientDocument',
  'ClientAssessment',
  'PhysioCareEpisode',
]);

const TASK_LABELS = Object.freeze({
  'physio.initial_assessment_summary.v1': 'Initial assessment summary',
  'physio.soap_note.v1': 'SOAP note',
  'physio.management_plan.v1': 'Management plan draft',
  'physio.progress_comparison.v1': 'Progress comparison',
  'physio.referrer_update.v1': 'Referrer update',
  'physio.discharge_summary.v1': 'Discharge summary',
});

function normaliseWords(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function responseJson(response, label, expectedStatus = 200) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new TypeError(`${label} returned non-JSON status ${response.status()}`);
  }
  expect(response.status(), `${label} returned status ${response.status()}`).toBe(expectedStatus);
  return body;
}

function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'X-App-Id': live.appId,
    ...extra,
  };
}

async function apiJson(request, token, method, route, body = undefined) {
  const response = await request.fetch(`${apiRoot}${route}`, {
    method,
    headers: authHeaders(token, body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { data: body }),
    timeout: 180_000,
  });
  return responseJson(response, `${method} ${route}`);
}

async function listEntity(request, token, entityName, query = {}) {
  const suffix = Object.keys(query).length
    ? `?q=${encodeURIComponent(JSON.stringify(query))}`
    : '';
  const body = await apiJson(request, token, 'GET', `/entities/${entityName}${suffix}`);
  expect(Array.isArray(body), `${entityName} collection must be an array`).toBe(true);
  return body;
}

async function deleteEntityRows(request, token, entityName, query) {
  const rows = await listEntity(request, token, entityName, query);
  for (const row of rows) {
    await apiJson(request, token, 'DELETE', `/entities/${entityName}/${encodeURIComponent(row.id)}`);
  }
  return rows.length;
}

async function removeSyntheticChildren(request, token, clientId) {
  for (const entityName of SYNTHETIC_CHILD_ENTITIES) {
    await deleteEntityRows(request, token, entityName, { client_id: clientId });
  }
  const terminalReadback = [];
  for (const entityName of SYNTHETIC_CHILD_ENTITIES) {
    const remaining = await listEntity(request, token, entityName, { client_id: clientId });
    expect(remaining).toEqual([]);
    terminalReadback.push({ entity_name: entityName, remaining_count: remaining.length });
  }
  return {
    childEntityCount: SYNTHETIC_CHILD_ENTITIES.length,
    childRowResidueCount: terminalReadback.reduce(
      (sum, entry) => sum + entry.remaining_count,
      0,
    ),
    terminalReadbackSha256: sha256(JSON.stringify(terminalReadback)),
  };
}

async function reconcileSyntheticClient(request, token, orgId, userEmail, cleanupLedger) {
  const active = await listEntity(request, token, 'Client', {
    org_id: orgId,
    qa_namespace: live.namespace,
    archived: false,
  });
  const archived = await listEntity(request, token, 'Client', {
    org_id: orgId,
    qa_namespace: live.namespace,
    archived: true,
  });
  const candidates = [...active, ...archived].sort((left, right) => (
    String(left.created_date || '').localeCompare(String(right.created_date || ''))
  ));
  expect(
    candidates.length,
    'the release-bound namespace must resolve to at most one synthetic client',
  ).toBeLessThanOrEqual(1);
  const payload = {
    org_id: orgId,
    qa_namespace: live.namespace,
    full_name: `Synthetic Physio QA ${live.namespace.slice(-6)}`,
    email: `${live.namespace}@example.test`,
    assigned_clinician_email: userEmail,
    date_of_birth: '1990-01-02',
    status: 'active',
    archived: false,
    archived_date: null,
  };
  let client;
  if (candidates.length > 0) {
    client = await apiJson(
      request,
      token,
      'PUT',
      `/entities/Client/${encodeURIComponent(candidates.at(-1).id)}`,
      payload,
    );
  } else {
    client = await apiJson(request, token, 'POST', '/entities/Client', payload);
  }
  cleanupLedger.clientId = client.id;
  await removeSyntheticChildren(request, token, client.id);
  return client;
}

async function fieldInput(page, label, index = 0) {
  return page.locator('label').filter({ hasText: new RegExp(`^${label}$`, 'i') })
    .nth(index).locator('..').locator('input, textarea, select').first();
}

async function verifyRuntime(request) {
  const liveResponse = await request.get('/api/health/live');
  const liveness = await responseJson(liveResponse, 'liveness');
  expect(liveness).toMatchObject({
    status: 'live',
    profession_id: live.professionId,
    app_id: live.appId,
  });

  const readyResponse = await request.get('/api/health/ready');
  const readiness = await responseJson(readyResponse, 'readiness');
  expect(readiness).toMatchObject({
    status: 'ready',
    ready: true,
    profession_id: live.professionId,
    app_id: live.appId,
    failures: [],
  });
  expect(Object.values(readiness.checks || {}).every(Boolean)).toBe(true);

  const versionResponse = await request.get('/api/version');
  const version = await responseJson(versionResponse, 'version');
  expect(version).toMatchObject({
    release_sha: live.applicationSha,
    profession_id: live.professionId,
    app_id: live.appId,
    catalogue: {
      count: live.catalogueCount,
      expected_count: live.catalogueCount,
      checksum: live.catalogueChecksum,
      expected_checksum: live.catalogueChecksum,
      ready: true,
    },
    database: { integrity: 'ok', schema_ready: true },
  });

  const capabilitiesResponse = await request.get('/api/capabilities');
  const capabilities = await responseJson(capabilitiesResponse, 'capabilities');
  expect(capabilities.required_dependencies_ready).toBe(true);
  expect(capabilities.capabilities?.general_clinical_llm).toMatchObject({
    enabled: false,
    ready: true,
    status: 'disabled',
  });
  for (const name of [
    'physio_ai_tasks',
    'transcription',
    'document_extraction',
    'transactional_email',
    'payments',
  ]) {
    expect(capabilities.capabilities?.[name], `${name} must be release-ready`).toMatchObject({
      enabled: true,
      required: true,
      ready: true,
      status: 'ready',
    });
  }
}

async function loginThroughUi(page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(live.email);
  await page.getByLabel('Password', { exact: true }).fill(live.password);
  const loginResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST' && response.url().includes(`${apiRoot}/auth/login`)
  ));
  await page.getByRole('button', { name: 'Log in' }).click();
  const loginBody = await responseJson(await loginResponsePromise, 'normal browser login');
  expect(typeof loginBody.access_token).toBe('string');
  await page.waitForURL(/\/Dashboard(?:\?|$)/, { timeout: 60_000 });
  return loginBody.access_token;
}

async function verifyPublicEntry(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Assessment, documentation and outcomes in one clinical thread.',
  })).toBeVisible();
  await expect(page.getByText('236 canonical assessments', { exact: true })).toBeVisible();
  await expect(page.getByText('Six structured AI workflows', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create your account' })).toHaveAttribute('href', '/register');
  await expect(page.getByRole('link', { name: 'Sign in to your practice' })).toHaveAttribute('href', '/login');

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
}

async function completeZeroScoreAssessment(page, request, token, client) {
  await page.goto('/NewAssessment');
  await expect(page.getByRole('heading', { name: 'New Client Assessment' })).toBeVisible();
  await page.getByPlaceholder('Search for a client by name...').fill(client.full_name);
  await page.getByText(client.full_name, { exact: true }).last().click();
  await page.getByPlaceholder('Search assessments by name or tag...').fill('DASS-21');
  const dassLabel = page.locator('label').filter({ hasText: /DASS-21/i }).first();
  await expect(dassLabel).toBeVisible();
  await dassLabel.click();
  const assignmentResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().includes(`${apiRoot}/entities/ClientAssessment`)
  ));
  await page.getByRole('button', { name: 'Assign Assessments' }).click();
  expect((await assignmentResponsePromise).status()).toBe(200);
  await page.waitForURL(/\/ClientProfile\?id=/, { timeout: 60_000 });

  await page.getByText('Client Assessments', { exact: true }).click();
  await page.locator('div.cursor-pointer')
    .filter({ hasText: /Pending Assessments/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Start Test' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Start Test' }).click();
  await page.getByRole('button', { name: 'Start DASS-21 Assessment' }).first().click();
  await expect(page.getByRole('heading', { name: 'DASS-21', exact: true })).toBeVisible();

  const zeroOptions = page.getByRole('button', { name: /^0\./ });
  await expect(zeroOptions).toHaveCount(21);
  for (let index = 0; index < 21; index += 1) await zeroOptions.nth(index).click();
  await page.getByRole('button', { name: 'Save DASS-21' }).click();
  const saveResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot}/entities/ClientAssessment/`)
  ));
  await page.getByRole('button', { name: 'Save DASS-21 to Client Record' }).click();
  expect((await saveResponsePromise).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Save DASS-21 to Client Record' })).toBeHidden();

  const rows = await listEntity(request, token, 'ClientAssessment', { client_id: client.id });
  const completed = rows.find((row) => row.status === 'completed');
  expect(completed, 'completed DASS-21 row must exist').toBeTruthy();
  expect(completed.result_value).toBe(0);
  const reloaded = await apiJson(
    request,
    token,
    'GET',
    `/entities/ClientAssessment/${encodeURIComponent(completed.id)}`,
  );
  expect(reloaded.status).toBe('completed');
  expect(reloaded.result_value).toBe(0);
  return reloaded;
}

async function createAndReloadEpisode(page, request, token, client) {
  await page.goto(`/PhysioEpisodes?client_id=${encodeURIComponent(client.id)}`);
  await expect(page.getByRole('heading', { name: client.full_name })).toBeVisible();
  await page.getByPlaceholder('e.g. Right ACL rehabilitation').fill('Synthetic ankle rehabilitation episode');
  await page.getByPlaceholder('e.g. Right knee').fill('Right ankle');
  await page.getByText('Presenting problem', { exact: true }).locator('..').locator('textarea').fill(
    'Synthetic inversion injury with reduced walking tolerance.',
  );

  await page.getByRole('button', { name: 'Add goal' }).click();
  await (await fieldInput(page, 'Functional goal')).fill('Walk synthetic community distance without symptoms.');
  await page.getByRole('button', { name: 'Add measure' }).click();
  await page.getByLabel('Measure name').fill('DASS-21 total');
  await (await fieldInput(page, 'Baseline')).fill('0');
  await (await fieldInput(page, 'Current')).fill('0');
  await (await fieldInput(page, 'Unit')).fill('score');
  await page.getByRole('button', { name: 'Add encounter' }).click();
  await (await fieldInput(page, 'Clinical summary')).fill('Synthetic review encounter.');
  await (await fieldInput(page, 'Treatment delivered')).fill('Synthetic exercise review');
  await page.getByRole('button', { name: 'Prescribe program' }).click();
  await (await fieldInput(page, 'Program name')).fill('Synthetic ankle loading plan');
  await (await fieldInput(page, 'Dosage')).fill('Synthetic dosage only');

  const saveResponsePromise = page.waitForResponse((response) => (
    ['POST', 'PUT'].includes(response.request().method())
    && response.url().includes(`${apiRoot}/entities/PhysioCareEpisode`)
  ));
  await page.getByRole('button', { name: 'Start and save episode' }).click();
  const saved = await responseJson(await saveResponsePromise, 'care episode save');
  expect(saved.client_id).toBe(client.id);
  expect(saved.title).toBe('Synthetic ankle rehabilitation episode');
  await expect.poll(() => new URL(page.url()).searchParams.get('episode_id')).toBe(saved.id);

  const negativeAnswers = page.locator('[id^="physio_screen_"][id$="_no"]');
  await expect(negativeAnswers.first()).toBeVisible();
  const negativeCount = await negativeAnswers.count();
  expect(negativeCount).toBeGreaterThan(10);
  for (let index = 0; index < negativeCount; index += 1) {
    await negativeAnswers.nth(index).click();
  }
  await page.locator('#physio_screen_outcome_none').click();
  await page.locator('#physio_screen_clinical_reasoning').fill(
    'All synthetic red-flag questions answered negatively; proceed with routine objective examination.',
  );
  const redFlagWrite = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot}/entities/PhysioCareEpisode/${saved.id}`)
  ));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await redFlagWrite).status()).toBe(200);

  await expect(page.locator('#physio_subj_presenting_complaint')).toBeVisible();
  await page.locator('#physio_subj_presenting_complaint').fill('Right ankle pain with walking and loaded dorsiflexion.');
  await page.locator('#physio_subj_body_chart_area').fill('Right lateral ankle');
  await page.locator('#physio_subj_mechanism_of_onset').fill('Synthetic inversion mechanism.');
  await page.locator('#physio_subj_duration').fill('Three weeks');
  await page.locator('#physio_subj_patient_goals').fill('Return to symptom-free synthetic community walking.');
  const subjectiveWrite = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot}/entities/PhysioCareEpisode/${saved.id}`)
  ));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await subjectiveWrite).status()).toBe(200);

  await expect(page.locator('#physio_obj_observation_posture')).toBeVisible();
  await page.locator('#physio_obj_observation_posture').fill('Mild synthetic lateral ankle swelling.');
  await page.locator('#physio_obj_functional_tests').fill('Synthetic single-leg stance reproduces familiar symptoms.');
  await page.locator('#physio_obj_diagnosis_clinical_impression').fill('Synthetic load-related lateral ankle presentation.');
  const objectiveWrite = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot}/entities/PhysioCareEpisode/${saved.id}`)
  ));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await objectiveWrite).status()).toBe(200);

  for (const step of ['Red-flag screen', 'Subjective', 'Objective']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${step}\\s+Complete$`) })).toBeVisible();
  }

  await page.reload();
  await expect(page.getByRole('heading', { name: client.full_name })).toBeVisible();
  await expect(page.getByPlaceholder('e.g. Right ACL rehabilitation')).toHaveValue('Synthetic ankle rehabilitation episode');
  await expect(page.getByPlaceholder('e.g. Right knee')).toHaveValue('Right lateral ankle');
  const reloaded = await apiJson(
    request,
    token,
    'GET',
    `/entities/PhysioCareEpisode/${encodeURIComponent(saved.id)}`,
  );
  expect(reloaded.title).toBe(saved.title);
  expect(reloaded.goals).toHaveLength(1);
  expect(reloaded.outcome_measures).toHaveLength(1);
  expect(reloaded.encounters).toHaveLength(1);
  expect(reloaded.home_programs).toHaveLength(1);
  expect(reloaded.red_flag_screen?.physio_screen_summary?.outcome).toBe('no_red_flags');
  expect(reloaded.subjective_examination?.completion_status).toBe('complete');
  expect(reloaded.objective_examination?.completion_status).toBe('complete');
  expect(reloaded.initial_findings?.physiotherapy_diagnosis)
    .toBe('Synthetic load-related lateral ankle presentation.');
  return reloaded;
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function providerTaskReceipt(taskId, generation, persistenceReceiptSha256) {
  const provenance = generation?.provenance || {};
  const usage = provenance.usage || {};
  expect(generation?.task).toBe(taskId);
  expect(generation?.task_version).toMatch(new RegExp(`^${taskId.replaceAll('.', '\\.')}/schema-[0-9]+\\.[0-9]+\\.[0-9]+$`));
  expect(generation?.contract_version).toBe('physio-ai-task-contract/2.0.0');
  expect(generation?.output_state).toBe('ai_draft_unreviewed');
  expect(generation?.clinician_review_required).toBe(true);
  expect(provenance.receipt_contract_version).toBe('physio-ai-provider-receipt/1.0.0');
  expect(FORBIDDEN_PROVIDER_MARKERS.test(`${provenance.provider}\n${provenance.model}`)).toBe(false);
  expect(Number.isInteger(provenance.provider_status) && provenance.provider_status >= 200 && provenance.provider_status < 300).toBe(true);
  expect(typeof provenance.finish_reason === 'string' && provenance.finish_reason.length > 0).toBe(true);
  expect(provenance.provider_request_id_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(Number.isSafeInteger(usage.input_tokens) && usage.input_tokens > 0).toBe(true);
  expect(Number.isSafeInteger(usage.cached_input_tokens) && usage.cached_input_tokens >= 0).toBe(true);
  expect(usage.cached_input_tokens).toBeLessThanOrEqual(usage.input_tokens);
  expect(Number.isSafeInteger(usage.output_tokens) && usage.output_tokens > 0).toBe(true);
  expect(Number.isSafeInteger(usage.actual_cost_microusd) && usage.actual_cost_microusd >= 0).toBe(true);
  const validatedOutputReceiptSha256 = sha256(JSON.stringify({
    task_id: taskId,
    task_version: generation.task_version,
    task_contract_version: generation.contract_version,
    provider_receipt_contract_version: provenance.receipt_contract_version,
    output_sha256: sha256(JSON.stringify(generation.output)),
  }));
  return {
    status: 'PASS',
    task_id: taskId,
    task_version: generation.task_version,
    task_contract_version: generation.contract_version,
    provider_receipt_contract_version: provenance.receipt_contract_version,
    provider: provenance.provider,
    model: provenance.model,
    provider_status: provenance.provider_status,
    finish_reason: provenance.finish_reason,
    provider_request_id_hash: provenance.provider_request_id_hash,
    input_tokens: usage.input_tokens,
    cached_input_tokens: usage.cached_input_tokens,
    output_tokens: usage.output_tokens,
    actual_cost_microusd: usage.actual_cost_microusd,
    persistence_receipt_sha256: persistenceReceiptSha256,
    validated_output_receipt_sha256: validatedOutputReceiptSha256,
  };
}

async function runAllAiDrafts(page, request, token, episode) {
  await expect(page.getByText('Physiotherapy AI workspace', { exact: true })).toBeVisible();
  const taskReceipts = [];
  let downloadVerified = false;
  let printVerified = false;

  for (const taskId of PHYSIO_LIVE_QA_TASK_IDS) {
    const label = TASK_LABELS[taskId];
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
    const providerResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && response.url().includes(`${apiRoot}/functions/physioAiTask`)
    ));
    await page.getByRole('button', { name: `Generate ${label}` }).click();
    const generation = await responseJson(await providerResponsePromise, `${taskId} provider generation`);
    const draftEditor = page.getByLabel('Editable AI draft JSON');
    await expect(draftEditor).toBeVisible();
    const generatedDraft = JSON.parse(await draftEditor.inputValue());
    const editedDraft = { ...generatedDraft, [SYNTHETIC_EDIT_KEY]: live.namespace };
    await draftEditor.fill(JSON.stringify(editedDraft, null, 2));
    await draftEditor.blur();
    await expect(page.getByText('Clinician edited', { exact: true })).toBeVisible();

    const destination = taskId === 'physio.soap_note.v1' ? 'SOAP note' : 'report';
    await page.getByRole('button', { name: `Save as ${destination} draft` }).click();
    await expect(page.getByText('Draft saved to the clinical record', { exact: true })).toBeVisible();

    const persistedEpisode = await apiJson(
      request,
      token,
      'GET',
      `/entities/PhysioCareEpisode/${encodeURIComponent(episode.id)}`,
    );
    const aiDrafts = persistedEpisode.reporting?.ai_drafts || [];
    const persistedDraft = [...aiDrafts].reverse().find((entry) => entry.task_type === taskId);
    expect(persistedDraft?.output_state).toBe('clinician_edited_draft');
    expect(persistedDraft?.output?.[SYNTHETIC_EDIT_KEY]).toBe(live.namespace);
    expect(['SOAPNote', 'SavedReport']).toContain(persistedDraft?.linked_entity);
    const linked = await apiJson(
      request,
      token,
      'GET',
      `/entities/${persistedDraft.linked_entity}/${encodeURIComponent(persistedDraft.linked_record_id)}`,
    );
    expect(linked.ai_generation?.task_type).toBe(taskId);
    expect(linked.ai_generation?.provenance?.provider_request_id_hash)
      .toBe(generation.provenance?.provider_request_id_hash);
    const persistenceReceiptSha256 = sha256(JSON.stringify({
      task_id: taskId,
      episode_id: persistedEpisode.id,
      linked_entity: persistedDraft.linked_entity,
      linked_record_id: persistedDraft.linked_record_id,
      output_state: persistedDraft.output_state,
      provider_request_id_hash: generation.provenance?.provider_request_id_hash,
      edited_draft_sha256: sha256(JSON.stringify(persistedDraft.output)),
    }));
    taskReceipts.push(providerTaskReceipt(taskId, generation, persistenceReceiptSha256));

    if (!downloadVerified) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download JSON' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain(taskId);
      const exported = await readDownload(download);
      expect(exported.task_type).toBe(taskId);
      expect(exported.draft?.[SYNTHETIC_EDIT_KEY]).toBe(live.namespace);
      downloadVerified = true;
    }
    if (!printVerified) {
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', { name: 'Print draft' }).click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      await expect(popup.locator('pre')).toContainText(taskId);
      await expect(popup.locator('pre')).toContainText(live.namespace);
      await popup.waitForFunction(() => window.__physioLiveQaPrintInvoked === true);
      await popup.close();
      printVerified = true;
    }
  }

  expect(new Set(taskReceipts.map((receipt) => receipt.task_id)).size).toBe(6);
  const persistedEpisode = await apiJson(
    request,
    token,
    'GET',
    `/entities/PhysioCareEpisode/${encodeURIComponent(episode.id)}`,
  );
  expect(persistedEpisode.reporting?.ai_drafts).toHaveLength(6);
  expect((await listEntity(request, token, 'SOAPNote', { client_id: episode.client_id })).length).toBeGreaterThanOrEqual(1);
  expect((await listEntity(request, token, 'SavedReport', { client_id: episode.client_id }))).toHaveLength(5);
  return { taskReceipts, downloadVerified, printVerified };
}

async function uploadFixture(request, token, fields, file, cleanupLedger) {
  const response = await request.post(`${apiRoot}/integration-endpoints/Core/UploadFile`, {
    headers: authHeaders(token),
    multipart: {
      ...fields,
      file,
    },
    timeout: 180_000,
  });
  const body = await responseJson(response, `upload ${file.name}`);
  expect(body.upload_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(body.file_url).toBe(`/uploads/${body.upload_id}`);
  cleanupLedger.uploads.push({ upload_id: body.upload_id, file_url: body.file_url });
  return body;
}

function providerPathReceipt(feature, receipt, fixtureSha256, groundedOutputSha256) {
  expect(receipt?.contract_version).toBe('assesssuite-provider-call-receipt/1.0.0');
  expect(receipt?.feature).toBe(feature);
  expect(receipt?.provider).toBe('openai');
  expect(typeof receipt?.model === 'string' && receipt.model.length > 0).toBe(true);
  expect(FORBIDDEN_PROVIDER_MARKERS.test(`${receipt.provider}\n${receipt.model}`)).toBe(false);
  expect(receipt?.provider_request_id_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(
    (Number.isInteger(receipt?.provider_status)
      && receipt.provider_status >= 200
      && receipt.provider_status < 300)
    || receipt?.provider_status === '2xx',
  ).toBe(true);
  expect(Number.isSafeInteger(receipt?.usage?.actual_cost_microusd)).toBe(true);
  expect(receipt.usage.actual_cost_microusd).toBeGreaterThanOrEqual(0);
  if (feature === 'transcription') expect(receipt.usage.audio_seconds).toBeGreaterThan(0);
  if (feature === 'extraction') expect(receipt.usage.request_units).toBe(1);
  return {
    status: 'PASS',
    feature,
    simulated: false,
    provider_receipt_contract_version: receipt.contract_version,
    provider: receipt.provider,
    model: receipt.model,
    provider_status: receipt.provider_status,
    provider_request_id_hash: receipt.provider_request_id_hash,
    actual_cost_microusd: receipt.usage.actual_cost_microusd,
    usage_receipt_sha256: sha256(JSON.stringify(receipt.usage)),
    exact_image_canary_receipt_sha256: live.exactImageCanaryReceiptSha256,
    fixture_sha256: fixtureSha256,
    grounded_output_sha256: groundedOutputSha256,
  };
}

async function proveTranscriptionAndExtraction(request, token, orgId, cleanupLedger) {
  const audio = readAndValidatePhysioCanaryAudioFixture();
  const uploadedAudio = await uploadFixture(request, token, {
    org_id: orgId,
    purpose: 'audio-transcription',
  }, {
    name: 'synthetic-physio-live-qa.wav',
    mimeType: audio.mime,
    buffer: audio.bytes,
  }, cleanupLedger);
  const transcription = await apiJson(request, token, 'POST', '/functions/transcribeSession', {
    action: 'transcribe',
    audio_url: uploadedAudio.file_url,
    org_id: orgId,
  });
  expect(transcription.simulated).toBe(false);
  const transcriptWords = normaliseWords(transcription.transcript);
  for (const word of normaliseWords(PHYSIO_CANARY_AUDIO_EXPECTED_MARKER).split(' ')) {
    expect(transcriptWords).toContain(word);
  }
  expect(FORBIDDEN_PROVIDER_MARKERS.test(transcription.transcript)).toBe(false);
  const transcriptionReceipt = providerPathReceipt(
    'transcription',
    transcription.provider_receipt,
    sha256(audio.bytes),
    sha256(transcription.transcript),
  );

  const referralFixture = pdfFixture();
  const uploadedReferral = await uploadFixture(request, token, {
    org_id: orgId,
    purpose: 'referral-extraction',
    processing_authority_confirmed: 'true',
    processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    subject_age_confirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  }, {
    name: 'synthetic-physio-live-qa-referral.pdf',
    mimeType: 'application/pdf',
    buffer: referralFixture,
  }, cleanupLedger);
  const extraction = await apiJson(
    request,
    token,
    'POST',
    '/integration-endpoints/Core/ExtractDataFromUploadedFile',
    {
      org_id: orgId,
      file_urls: [uploadedReferral.file_url],
      json_schema: REFERRAL_EXTRACTION_SCHEMA,
      processing_authority_confirmed: true,
      processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    },
  );
  expect(extraction.status).toBe('success');
  expect(extraction.output?.full_name?.toLowerCase()).toBe('alex river');
  expect(extraction.output?.primary_condition).toMatch(/ankle sprain/i);
  expect(extraction.output?.comorbidities?.some((entry) => /asthma/i.test(String(entry)))).toBe(true);
  expect(FORBIDDEN_PROVIDER_MARKERS.test(JSON.stringify(extraction.output))).toBe(false);
  expect(extraction.provider_receipt?.schema_receipt_sha256).toMatch(/^[0-9a-f]{64}$/);
  const extractionReceipt = providerPathReceipt(
    'extraction',
    extraction.provider_receipt,
    sha256(referralFixture),
    sha256(JSON.stringify(extraction.output)),
  );

  await reconcileUploadCleanup(request, token, orgId, cleanupLedger);
  return {
    providerPaths: {
      transcription: transcriptionReceipt,
      extraction: extractionReceipt,
    },
    transcriptionRealAndGrounded: true,
    extractionRealAndGrounded: true,
    temporaryUploadsCancelled: true,
  };
}

async function dischargeAndReopen(page, request, token, episodeId) {
  const lifecycleReason = page.getByLabel('Lifecycle reason');
  await lifecycleReason.fill('Treatment goals achieved and discharge plan agreed.');
  const dischargeResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot}/entities/PhysioCareEpisode/${episodeId}`)
  ));
  await page.getByRole('button', { name: /Complete discharge/ }).click();
  const discharged = await responseJson(await dischargeResponsePromise, 'episode discharge');
  expect(discharged.status).toBe('discharged');
  expect(discharged.reporting?.discharge_status).toBe('completed');
  expect(discharged.status_history?.at(-1)?.from).toBe('active');
  expect(discharged.status_history?.at(-1)?.to).toBe('discharged');

  await lifecycleReason.fill('Symptoms recurred and a further treatment block was authorised.');
  const reopenResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot}/entities/PhysioCareEpisode/${episodeId}`)
  ));
  await page.getByRole('button', { name: /Reopen episode/ }).click();
  const reopened = await responseJson(await reopenResponsePromise, 'episode reopen');
  expect(reopened.status).toBe('active');
  expect(reopened.reporting?.discharge_status).toBe('not_ready');
  expect(reopened.reporting?.discharge_date).toBe('');
  expect(reopened.status_history?.at(-1)?.prior_discharge?.discharge_date).toBeTruthy();
  await page.reload();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  const readback = await apiJson(
    request,
    token,
    'GET',
    `/entities/PhysioCareEpisode/${encodeURIComponent(episodeId)}`,
  );
  expect(readback.status).toBe('active');
  expect(readback.reporting?.discharge_status).toBe('not_ready');
  expect(readback.status_history?.map((entry) => entry.to).slice(-2)).toEqual(['discharged', 'active']);
}

async function reconcileUploadCleanup(request, token, orgId, cleanupLedger) {
  const ids = cleanupLedger.uploads.map((entry) => entry?.upload_id).filter(Boolean);
  if (!token || !orgId || ids.length === 0) {
    cleanupLedger.uploadsReconciled = true;
    return;
  }
  expect(new Set(ids).size, 'temporary upload identifiers must be unique').toBe(ids.length);
  const cancellationResponse = await request.fetch(
    `${apiRoot}/integration-endpoints/Core/CancelTemporaryUploads`,
    {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      data: {
        org_id: orgId,
        upload_ids: ids,
      },
      timeout: 180_000,
    },
  );
  const cancellationHttpStatus = cancellationResponse.status();
  const cancellation = await responseJson(
    cancellationResponse,
    'CancelTemporaryUploads cleanup',
    200,
  );
  expect(Object.keys(cancellation).sort()).toEqual(['deleted', 'status']);
  expect(cancellation.status).toBe('success');
  expect(cancellation.deleted).toBe(ids.length);

  const terminalReadbacks = [];
  for (const uploaded of cleanupLedger.uploads) {
    const response = await request.get(uploaded.file_url, { headers: authHeaders(token) });
    terminalReadbacks.push({
      upload_id_sha256: sha256(uploaded.upload_id),
      http_status: response.status(),
    });
  }
  terminalReadbacks.sort((left, right) => (
    left.upload_id_sha256.localeCompare(right.upload_id_sha256)
  ));
  const residual = terminalReadbacks.filter((entry) => entry.http_status !== 404);
  expect(residual, 'cancelled uploads must be unavailable on terminal readback').toEqual([]);
  cleanupLedger.uploadCleanup = {
    cancelResponseHttpStatus: cancellationHttpStatus,
    cancelResponseStatus: cancellation.status,
    cancelResponseDeletedCount: cancellation.deleted,
    temporaryUploadCount: ids.length,
    temporaryUploadIdSetSha256: sha256(JSON.stringify(ids.map(sha256).sort())),
    terminalUploadHttpStatusesSha256: sha256(JSON.stringify(terminalReadbacks)),
    terminalUploadUnavailableCount: terminalReadbacks.length,
    uploadResidueCount: residual.length,
  };
  cleanupLedger.uploadsReconciled = true;
}

function combineFailures(primaryFailure, cleanupError) {
  if (!primaryFailure) return cleanupError;
  return new AggregateError(
    [primaryFailure, cleanupError],
    'Physio live QA failed and synthetic cleanup also failed',
  );
}

test('live Physio journey and provider evidence', async ({ page, request }, testInfo) => {
    const projectName = testInfo.project.name;
    const startedAt = new Date().toISOString();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.context().addInitScript(() => {
      window.print = () => { window.__physioLiveQaPrintInvoked = true; };
    });

    let token = '';
    let orgId = '';
    let client = null;
    const cleanupLedger = {
      clientId: null,
      clientCleanup: null,
      clientReconciled: false,
      uploads: [],
      uploadCleanup: null,
      uploadsReconciled: false,
    };
    let primaryFailure = null;
    let successEvidence = null;
    try {
      await verifyRuntime(request);
      await verifyPublicEntry(page);
      token = await loginThroughUi(page);
      const me = await apiJson(request, token, 'GET', '/entities/User/me');
      expect(me.email).toBe(live.email);
      expect(me.account_status).toBe('active');
      expect(me.profession).toBe('Physiotherapist');
      const memberships = await listEntity(request, token, 'OrganizationMember', { user_email: me.email });
      const membership = memberships.find((entry) => entry.is_primary) || memberships[0];
      expect(membership?.org_id).toBeTruthy();
      orgId = membership.org_id;
      client = await reconcileSyntheticClient(request, token, orgId, me.email, cleanupLedger);

      await completeZeroScoreAssessment(page, request, token, client);
      const episode = await createAndReloadEpisode(page, request, token, client);
      const ai = await runAllAiDrafts(page, request, token, episode);
      const providers = await proveTranscriptionAndExtraction(
        request,
        token,
        orgId,
        cleanupLedger,
      );
      await dischargeAndReopen(page, request, token, episode.id);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      successEvidence = { ai, providers, episode };
    } catch (error) {
      primaryFailure = error;
    } finally {
      if (token && orgId && !cleanupLedger.uploadsReconciled) {
        try {
          await reconcileUploadCleanup(request, token, orgId, cleanupLedger);
        } catch (cleanupError) {
          primaryFailure = combineFailures(primaryFailure, cleanupError);
        }
      }
      if (token && cleanupLedger.clientId) {
        try {
          const childCleanup = await removeSyntheticChildren(
            request,
            token,
            cleanupLedger.clientId,
          );
          const archived = await apiJson(
            request,
            token,
            'PUT',
            `/entities/Client/${encodeURIComponent(cleanupLedger.clientId)}`,
            { archived: true, archived_date: new Date().toISOString(), status: 'inactive' },
          );
          expect(archived.archived).toBe(true);
          const activeClients = await listEntity(request, token, 'Client', {
            org_id: orgId,
            qa_namespace: live.namespace,
            archived: false,
          });
          const archivedClients = await listEntity(request, token, 'Client', {
            org_id: orgId,
            qa_namespace: live.namespace,
            archived: true,
          });
          expect(activeClients).toEqual([]);
          expect(archivedClients).toHaveLength(1);
          expect(archivedClients[0].id).toBe(cleanupLedger.clientId);
          expect(archivedClients[0].archived).toBe(true);
          cleanupLedger.clientCleanup = {
            activeNamespaceClientCount: activeClients.length,
            archivedNamespaceClientCount: archivedClients.length,
            childEntityCount: childCleanup.childEntityCount,
            childRowResidueCount: childCleanup.childRowResidueCount,
            childrenTerminalReadbackSha256: childCleanup.terminalReadbackSha256,
          };
          cleanupLedger.clientReconciled = true;
        } catch (cleanupError) {
          primaryFailure = combineFailures(primaryFailure, cleanupError);
        }
      }
    }
    if (primaryFailure) throw primaryFailure;

    expect(cleanupLedger.clientReconciled).toBe(true);
    expect(cleanupLedger.uploadsReconciled).toBe(true);
    expect(cleanupLedger.clientCleanup).toBeTruthy();
    expect(cleanupLedger.uploadCleanup).toBeTruthy();
    const cleanup = {
      contract_version: PHYSIO_LIVE_QA_CLEANUP_CONTRACT_VERSION,
      result: 'PASS',
      outcome: PHYSIO_LIVE_QA_CLEANUP_OUTCOME,
      client_id_sha256: sha256(cleanupLedger.clientId),
      active_namespace_client_count: cleanupLedger.clientCleanup.activeNamespaceClientCount,
      archived_namespace_client_count: cleanupLedger.clientCleanup.archivedNamespaceClientCount,
      child_entity_count: cleanupLedger.clientCleanup.childEntityCount,
      child_row_residue_count: cleanupLedger.clientCleanup.childRowResidueCount,
      children_terminal_readback_sha256:
        cleanupLedger.clientCleanup.childrenTerminalReadbackSha256,
      temporary_upload_count: cleanupLedger.uploadCleanup.temporaryUploadCount,
      temporary_upload_id_set_sha256: cleanupLedger.uploadCleanup.temporaryUploadIdSetSha256,
      cancel_response_http_status: cleanupLedger.uploadCleanup.cancelResponseHttpStatus,
      cancel_response_status: cleanupLedger.uploadCleanup.cancelResponseStatus,
      cancel_response_deleted_count: cleanupLedger.uploadCleanup.cancelResponseDeletedCount,
      terminal_upload_http_status: 404,
      terminal_upload_http_statuses_sha256:
        cleanupLedger.uploadCleanup.terminalUploadHttpStatusesSha256,
      terminal_upload_unavailable_count:
        cleanupLedger.uploadCleanup.terminalUploadUnavailableCount,
      upload_residue_count: cleanupLedger.uploadCleanup.uploadResidueCount,
    };

    const receipt = {
      contract_version: live.contractVersion,
      result: 'PASS',
      application: live.application,
      application_sha: live.applicationSha,
      immutable_image: live.immutableImage,
      profession_id: live.professionId,
      app_id: live.appId,
      origin: live.origin,
      catalogue_count: live.catalogueCount,
      catalogue_checksum: live.catalogueChecksum,
      playwright_config_sha256: live.playwrightConfigSha256,
      qa_journey_manifest_sha256: live.journeyManifestSha256,
      expected_capabilities_manifest_sha256: live.capabilitiesManifestSha256,
      deploy_receipt_sha256: live.deployReceiptSha256,
      exact_image_canary_receipt_sha256: live.exactImageCanaryReceiptSha256,
      provider_cost_ceiling_microusd: live.providerCostCeilingMicrousd,
      synthetic_account_email_sha256: live.syntheticAccountEmailSha256,
      restart_receipt_sha256: live.restartReceiptSha256,
      dns_readback_manifest_sha256: live.dnsReadbackManifestSha256,
      tls_certificate_receipt_sha256: live.tlsCertificateReceiptSha256,
      prior_fly_qa_receipt_sha256: live.priorFlyQaReceiptSha256,
      self_service_provision_receipt_sha256: live.selfServiceProvisionReceiptSha256,
      self_service_provision_cleanup_ledger_sha256:
        live.selfServiceProvisionCleanupLedgerSha256,
      self_service_provision_contract_version: live.selfServiceProvisionContractVersion,
      self_service_payment_validation_receipt_sha256:
        live.selfServicePaymentValidationReceiptSha256,
      self_service_payment_validation_cleanup_ledger_sha256:
        live.selfServicePaymentValidationCleanupLedgerSha256,
      self_service_payment_validation_contract_version:
        live.selfServicePaymentValidationContractVersion,
      self_service_sequence_id: live.selfServiceSequenceId,
      sequence_id: live.sequenceId,
      acceptance_pass: live.acceptancePass,
      project: projectName,
      synthetic_namespace_sha256: sha256(live.namespace),
      tasks: successEvidence.ai.taskReceipts,
      provider_paths: successEvidence.providers.providerPaths,
      provider_call_count: 8,
      task_actual_cost_microusd: successEvidence.ai.taskReceipts
        .reduce((sum, task) => sum + task.actual_cost_microusd, 0),
      actual_provider_cost_microusd: [
        ...successEvidence.ai.taskReceipts,
        ...Object.values(successEvidence.providers.providerPaths),
      ].reduce((sum, providerCall) => sum + providerCall.actual_cost_microusd, 0),
      journey: {
        public_entry_verified: true,
        normal_login_verified: true,
        assessment_zero_score_persisted: true,
        episode_created_and_reloaded: true,
        structured_initial_assessment_persisted: true,
        episode_discharge_and_reopen_verified: true,
        download_verified: successEvidence.ai.downloadVerified,
        print_verified: successEvidence.ai.printVerified,
        transcription_real_and_grounded: successEvidence.providers.transcriptionRealAndGrounded,
        extraction_real_and_grounded: successEvidence.providers.extractionRealAndGrounded,
        temporary_uploads_cancelled: successEvidence.providers.temporaryUploadsCancelled,
        synthetic_client_archived_and_children_removed:
          cleanupLedger.clientReconciled && cleanupLedger.clientCleanup.childRowResidueCount === 0,
      },
      cleanup,
      cleanup_receipt_sha256: sha256(JSON.stringify(cleanup)),
      console_error_count: consoleErrors.length,
      page_error_count: pageErrors.length,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
    writeProjectReceipt(receipt, live);
  });
