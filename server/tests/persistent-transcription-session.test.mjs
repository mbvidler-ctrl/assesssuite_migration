import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  activateUser,
  createOrganizationForUser,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

function route(server, suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function invoke(server, token, functionName, body) {
  return requestJson(server, route(server, `/functions/${functionName}`), {
    method: 'POST', token, body,
  });
}

test('persistent transcription survives bounded segment upload, transcription and recovery', async () => {
  const server = await startTestServer({
    PROFESSION: 'exercise-physiology',
    DEFAULT_APP_ID: 'local-assesssuite',
    TRANSCRIPTION_ENABLED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '0',
  });
  try {
    const user = await registerUser(server, 'persistent-transcription@example.test');
    const admin = await requestJson(server, route(server, '/auth/login'), {
      method: 'POST', body: { email: 'admin@local.test', password: 'change-me-local' },
    });
    await activateUser(server, admin.body.access_token, user.id, 'Exercise Physiologist');
    const org = await createOrganizationForUser(server, admin.body.access_token, user, 'clinician');
    const acceptance = await requestJson(
      server,
      route(server, '/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: user.token,
        body: { org_id: org.id, marketing_opt_in: false },
      },
    );
    assert.equal(acceptance.status, 200, acceptance.text);

    const created = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'create', org_id: org.id, label: 'Persistent session contract',
    });
    assert.equal(created.status, 200, created.text);
    const sessionId = created.body.session.id;
    assert.equal(created.body.session.status, 'recording');

    const duplicate = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'create', org_id: org.id, label: 'Must not replace active session',
    });
    assert.equal(duplicate.status, 409, duplicate.text);
    assert.equal(duplicate.body.active_session.id, sessionId);

    const form = new FormData();
    form.append('org_id', org.id);
    form.append('purpose', 'audio-transcription');
    form.append('file', new Blob([Buffer.from([0x1a, 0x45, 0xdf, 0xa3])], { type: 'audio/webm' }), 'persistent-part-0.webm');
    const uploadResponse = await fetch(`${server.baseUrl}${route(server, '/integration-endpoints/Core/UploadFile')}`, {
      method: 'POST',
      headers: { 'X-App-Id': server.appId, Authorization: `Bearer ${user.token}` },
      body: form,
    });
    const upload = await uploadResponse.json();
    assert.equal(uploadResponse.status, 200, JSON.stringify(upload));
    assert.match(upload.file_url, /^\/uploads\//);
    assert.ok(upload.upload_id);

    const appended = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'append_segment',
      org_id: org.id,
      session_id: sessionId,
      sequence: 0,
      upload_id: upload.upload_id,
      audio_url: upload.file_url,
      duration_seconds: 30,
    });
    assert.equal(appended.status, 200, appended.text);
    assert.equal(appended.body.segment.status, 'uploaded');

    const transcribed = await invoke(server, user.token, 'transcribeSession', {
      action: 'transcribe_segment',
      org_id: org.id,
      persistent_session_id: sessionId,
      sequence: 0,
      audio_url: upload.file_url,
    });
    assert.equal(transcribed.status, 200, transcribed.text);
    assert.equal(transcribed.body.simulated, true);
    assert.match(transcribed.body.session_transcript, /fallback transcript/i);

    const recovered = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'recover', org_id: org.id,
    });
    assert.equal(recovered.status, 200, recovered.text);
    assert.equal(recovered.body.active_session.id, sessionId);
    assert.equal(recovered.body.active_session.segments[0].status, 'ready');
    assert.match(recovered.body.active_session.transcript, /fallback transcript/i);

    const paused = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'pause', org_id: org.id, session_id: sessionId,
    });
    assert.equal(paused.body.session.status, 'paused');
    const resumed = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'resume', org_id: org.id, session_id: sessionId,
    });
    assert.equal(resumed.body.session.status, 'recording');
    const finished = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'finish', org_id: org.id, session_id: sessionId,
    });
    assert.equal(finished.body.session.status, 'ready');

    const attachedAfterCompletion = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'attach', org_id: org.id, session_id: sessionId,
      client_id: null, appointment_id: null, care_episode_id: null,
      label: 'Completed consultation attached after review',
    });
    assert.equal(attachedAfterCompletion.status, 200, attachedAfterCompletion.text);
    assert.equal(attachedAfterCompletion.body.session.status, 'ready');
    assert.equal(attachedAfterCompletion.body.session.label, 'Completed consultation attached after review');

    const discarded = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'discard', org_id: org.id, session_id: sessionId,
    });
    assert.equal(discarded.status, 200, discarded.text);
    assert.equal(discarded.body.session.status, 'discarded');
    assert.equal(discarded.body.session.transcript, '');
    const attachDiscarded = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'attach', org_id: org.id, session_id: sessionId,
      client_id: null, appointment_id: null, care_episode_id: null,
      label: 'Must remain discarded',
    });
    assert.equal(attachDiscarded.status, 409, attachDiscarded.text);
    assert.equal(attachDiscarded.body.error, 'transcription_session_discarded');
    const afterDiscard = await invoke(server, user.token, 'manageTranscriptionSession', {
      action: 'recover', org_id: org.id,
    });
    assert.equal(afterDiscard.body.active_session, null);

    const auditDb = new DatabaseSync(server.dbPath, { readOnly: true });
    const uploadState = auditDb.prepare(`
      SELECT lifecycle_state, bound_at, bound_entity_type, bound_entity_id
      FROM upload_registry WHERE id = ?
    `).get(upload.upload_id);
    assert.ok(['expired', 'deleted'].includes(uploadState.lifecycle_state));
    assert.equal(uploadState.bound_at, null);
    assert.equal(uploadState.bound_entity_type, null);
    assert.equal(uploadState.bound_entity_id, null);
    auditDb.close();

    const dbBytes = fs.readFileSync(server.dbPath);
    assert.equal(dbBytes.includes(Buffer.from('persistent-part-0.webm')), false, 'database stores the governed URL, not file bytes');
  } finally {
    await server.stop();
  }
});

test('persistent recorder is mounted above navigation and retains the legacy SOAP recorder', () => {
  const app = fs.readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../../src/Layout.jsx', import.meta.url), 'utf8');
  const provider = fs.readFileSync(new URL('../../src/lib/transcription/PersistentTranscriptionContext.jsx', import.meta.url), 'utf8');
  const dock = fs.readFileSync(new URL('../../src/components/transcription/PersistentTranscriptionDock.jsx', import.meta.url), 'utf8');
  const functionSource = fs.readFileSync(new URL('../functions/transcribeSession.mjs', import.meta.url), 'utf8');
  const soap = fs.readFileSync(new URL('../../src/components/calendar/SOAPNoteModal.jsx', import.meta.url), 'utf8');

  assert.match(app, /<PersistentTranscriptionProvider>[\s\S]*<Router>/);
  assert.match(layout, /<PersistentTranscriptionDock\s*\/>/);
  assert.match(provider, /CHUNK_TIMESLICE_MS = 5 \* 1000/);
  assert.match(provider, /PART_DURATION_MS = 4 \* 60 \* 1000/);
  assert.match(provider, /saveLocalTranscriptionChunk/);
  assert.match(provider, /transcribe_segment/);
  assert.match(provider, /MIN_RECORDING_STORAGE_BYTES = 64 \* 1024 \* 1024/);
  assert.match(provider, /window\.addEventListener\('online', retryWhenOnline\)/);
  assert.match(provider, /window\.addEventListener\('pagehide', checkpointBufferedAudio\)/);
  assert.match(provider, /retryInFlightRef\.current/);
  assert.match(provider, /requestPersistence = !storagePersistenceRequestedRef\.current/);
  assert.match(provider, /preparedStream = await prepareCaptureStream\(\)[\s\S]*action: 'create'/,
    'storage and microphone preflight must precede durable session creation');
  assert.match(provider, /await beginCapture\(preparedStream\);[\s\S]*openDock\(\)/,
    'a successful start must reveal the persistent dock');
  assert.match(provider, /action: 'discard'[\s\S]*deleteLocalTranscriptionSession\(createdSession\.id\)/,
    'post-create capture failure must clean up the server and local session');
  assert.match(provider, /phase: recorderRef\.current\?\.state === 'recording' \? 'recording' : 'recoverable'/);
  assert.match(dock, /const open = expanded;/, 'an active recording remains collapsible while capture continues');
  assert.match(dock, /z-40 h-12 w-12/, 'the collapsed mobile control stays compact and behind modal controls');
  assert.match(dock, /aria-label="Collapse transcription"/, 'active sessions retain an accessible collapse control');
  assert.match(functionSource, /patient_facing_summary/);
  assert.match(functionSource, /referrer_update/);
  assert.match(functionSource, /home_program_actions/);
  assert.match(functionSource, /unresolved_clinical_questions/);
  assert.match(functionSource, /session\.status === 'ready' && session\.artifacts/);
  assert.match(functionSource, /replayed: true/);
  assert.match(dock, /Patient summary/);
  assert.match(dock, /Referrer update/);
  assert.match(dock, /Home programme/);
  assert.match(soap, /usePersistentTranscription/);
  assert.match(soap, /Start persistent transcription/);
  assert.match(soap, /await persistentTranscription\.start\(\{/);
  assert.match(soap, /recordingConsentMode === 'persistent'/);
  assert.match(soap, /const \[isRecording, setIsRecording\] = useState\(false\)/, 'legacy note recorder remains available');
});
