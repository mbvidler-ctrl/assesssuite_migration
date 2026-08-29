import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getProfession,
  toPublicProfession,
} from '../../packages/profession-config/index.mjs';
import { publicCapabilities } from '../capabilities.mjs';
import { PHYSIO_AI_TASK_IDS } from '../physioAiTasks.mjs';
import {
  loginAdmin,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('Physio manifest exposes its six versioned tasks and every operational shared AI surface', () => {
  const ep = getProfession('exercise-physiology');
  const physio = getProfession('physio');

  assert.equal(ep.features.legacyGeneralClinicalLlm, true);
  assert.deepEqual(ep.features.aiTaskIds, []);
  assert.deepEqual(ep.features.disabledCoreIntegrationIds, []);
  assert.equal(physio.features.legacyGeneralClinicalLlm, true);
  assert.deepEqual(physio.features.aiTaskIds, PHYSIO_AI_TASK_IDS);
  assert.deepEqual(physio.features.disabledCoreIntegrationIds, ['SendSMS', 'GenerateImage']);
  assert.ok(!physio.navigation.allowedPages.includes('AssessmentAudit'));
  assert.ok(!physio.navigation.allowedPages.includes('ClientConditions'));
  assert.ok(ep.navigation.allowedPages.includes('AssessmentAudit'));
  assert.ok(ep.navigation.allowedPages.includes('ClientConditions'));

  const projection = toPublicProfession(physio);
  projection.features.aiTaskIds.push('physio.unregistered.v1');
  projection.features.disabledCoreIntegrationIds.push('SendEmail');
  assert.deepEqual(getProfession('physio').features.aiTaskIds, PHYSIO_AI_TASK_IDS);
  assert.deepEqual(
    getProfession('physio').features.disabledCoreIntegrationIds,
    ['SendSMS', 'GenerateImage'],
  );
});

test('explicit target composition publishes both shared and Physio-native AI posture', () => {
  const capabilities = publicCapabilities(
    { GENERAL_CLINICAL_LLM_ENABLED: '1', LLM_REQUIRED: '1' },
    { professionId: 'physio', legacyGeneralClinicalLlmAllowed: true },
  );

  assert.deepEqual(capabilities.general_clinical_llm, {
    available: false,
    reason: 'unconfigured',
  });
  assert.deepEqual(capabilities.physio_ai_tasks, {
    available: false,
    reason: 'unconfigured',
  });
});

test('every Physio-reachable shared AI surface retains its provider gate and real invocation path', () => {
  const layout = read('src', 'Layout.jsx');
  const treatmentProtocols = read('src', 'pages', 'TreatmentProtocols.jsx');
  const clientProfile = read('src', 'pages', 'ClientProfile.jsx');
  const calendar = read('src', 'pages', 'Calendar.jsx');
  const appointmentModal = read('src', 'components', 'calendar', 'AppointmentModal.jsx');
  const newAssessment = read('src', 'pages', 'NewAssessment.jsx');
  const assessmentLibrary = read('src', 'pages', 'AssessmentLibrary.jsx');
  const testRunner = read('src', 'pages', 'TestRunner.jsx');
  const reports = read('src', 'pages', 'Reports.jsx');
  const reportEditor = read('src', 'components', 'reports', 'wizard-steps', 'SectionEditor.jsx');
  const recommendations = read('src', 'components', 'client', 'AssessmentRecommendations.jsx');
  const medicationAlerts = read('src', 'components', 'client', 'MedicationAlerts.jsx');
  const soap = read('src', 'components', 'calendar', 'SOAPNoteModal.jsx');
  const workspace = read('src', 'components', 'physio', 'PhysioAiWorkspace.jsx');

  assert.match(layout, /activeAllowedPages\.has\("assessmentaudit"\)/);
  assert.match(treatmentProtocols, /legacyProtocolAiAllowed\s*=\s*activeProfession\.features\.legacyGeneralClinicalLlm === true/);
  assert.match(treatmentProtocols, /legacyProtocolAiAllowed && normalizedSearchTerm/);
  assert.match(clientProfile, /legacyNutritionSurfaceAllowed && \(/);
  assert.match(clientProfile, /careEpisodeWorkflow \? \(/);
  assert.match(clientProfile, /PhysioEpisodes\?client_id=/);
  assert.match(calendar, /activeProfession\.features\.careEpisodes === true/);
  assert.match(calendar, /navigate\(createPageUrl\(`PhysioEpisodes\?client_id=/);
  assert.match(calendar, /activeProfession\.features\.careEpisodes !== true && soapNoteModal\.isOpen/);
  assert.match(appointmentModal, /careEpisodeWorkflow \? 'Open Care Episodes' : 'Open SOAP Note'/);
  assert.match(treatmentProtocols, /activeProfession\.features\.careEpisodes !== true && \(/);
  assert.match(newAssessment, /buildTimeProfession\.id === 'physio' && !careEpisodeId/);
  assert.match(assessmentLibrary, /buildTimeProfession\.id === 'physio' && !careEpisodeId/);
  assert.match(testRunner, /buildTimeProfession\.id === 'physio' && \(/);
  assert.match(reports, /activeProfession\.id === 'physio' && !careEpisodeId/);
  assert.match(recommendations, /if \(!legacyRecommendationAiAllowed\)/);
  assert.match(recommendations, /if \(!ai\.canTrigger\)/);
  assert.match(medicationAlerts, /if \(!legacyMedicationAiAllowed\)/);
  assert.match(medicationAlerts, /if \(!ai\.canTrigger\)/);
  assert.equal((reportEditor.match(/if \(!legacyReportAiAllowed\)/g) || []).length, 3);
  assert.match(reportEditor, /legacyReportAiAllowed && !isSignatureSection/);
  assert.match(
    soap,
    /sharedSectionAiAllowed\s*=\s*activeProfession\.features\.legacyGeneralClinicalLlm === true/,
  );
  assert.match(soap, /!isLocked && sharedSectionAiAllowed/);
  assert.equal((soap.match(/sharedSectionAiAllowed && \(/g) || []).length, 2);
  assert.match(soap, /!isLocked && sharedTranscriptDissectionAllowed/);
  assert.match(workspace, /useAiCapability\('physio_ai_tasks'\)/);
  assert.match(workspace, /functions\.invoke\('physioAiTask'/);
});

test('Physio server runs Core.InvokeLLM when the shared clinical AI capability is enabled', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    TRANSCRIPTION_ENABLED: '1',
    LLM_REQUIRED: '0',
  });
  try {
    const token = await loginAdmin(server);
    const settings = await requestJson(
      server,
      `/api/apps/public/prod/public-settings/by-id/${server.appId}`,
      { token },
    );
    assert.equal(settings.status, 200, settings.text);
    assert.deepEqual(settings.body?.public_settings?.capabilities?.general_clinical_llm, {
      available: true,
      reason: 'available',
    });
    assert.deepEqual(settings.body?.public_settings?.capabilities?.physio_ai_tasks, {
      available: false,
      reason: 'unconfigured',
    });

    const response = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token, body: { prompt: 'Return a concise physiotherapy test response.' } },
    );
    assert.equal(response.status, 200, response.text);
    assert.ok(response.text.length > 0);

    const missingEpisode = await requestJson(
      server,
      `/api/apps/${server.appId}/functions/transcribeSession`,
      {
        method: 'POST',
        token,
        body: {
          action: 'transcribe',
          audio_url: '/api/files/not-reached.webm',
          org_id: 'org-not-reached',
        },
      },
    );
    assert.equal(missingEpisode.status, 400, missingEpisode.text);
    assert.equal(missingEpisode.body?.code, 'care_episode_required');
  } finally {
    await server.stop();
  }
});

test('Physio server preserves both real transcription and the EP-compatible transcript-to-SOAP tool', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    TRANSCRIPTION_ENABLED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
  });
  try {
    const token = await loginAdmin(server);
    const response = await requestJson(
      server,
      `/api/apps/${server.appId}/functions/transcribeSession`,
      {
        method: 'POST',
        token,
        body: {
          action: 'dissect_to_soap',
          transcript: 'The client reports improving shoulder function and reduced pain.',
        },
      },
    );
    assert.equal(response.status, 200, response.text);
    assert.equal(response.body?.success, true);
  } finally {
    await server.stop();
  }
});

test('EP server does not expose the Physio task function', async () => {
  const server = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '1' });
  try {
    const token = await loginAdmin(server);
    const response = await requestJson(
      server,
      `/api/apps/${server.appId}/functions/physioAiTask`,
      {
        method: 'POST',
        token,
        body: {
          task: 'physio.soap_note.v1',
          org_id: 'org-not-reachable',
          context: {},
        },
      },
    );
    assert.equal(response.status, 404, response.text);
    assert.equal(response.body?.message, 'function not found');
  } finally {
    await server.stop();
  }
});

test('Physio server does not expose absent SMS or placeholder image endpoints', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });
  try {
    const token = await loginAdmin(server);
    for (const endpointName of ['SendSMS', 'GenerateImage']) {
      const response = await requestJson(
        server,
        `/api/apps/${server.appId}/integration-endpoints/Core/${endpointName}`,
        {
          method: 'POST',
          token,
          body: endpointName === 'SendSMS'
            ? { to: '+61000000000', body: 'must not be accepted' }
            : { prompt: 'must not return a placeholder image' },
        },
      );
      assert.equal(response.status, 404, `${endpointName}: ${response.text}`);
      assert.equal(response.body?.message, `integration endpoint ${endpointName} not found`);
    }
  } finally {
    await server.stop();
  }
});
