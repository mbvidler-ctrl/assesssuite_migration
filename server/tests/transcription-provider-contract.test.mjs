import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

async function withEnvironment(overrides, operation) {
  const previous = Object.fromEntries(
    Object.keys(overrides).map((name) => [name, process.env[name]]),
  );
  try {
    for (const [name, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return await operation();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function makeApiUsage({ reserve, settle, transcriptionCost = 321, chatCost = 654 } = {}) {
  return {
    estimates: { transcriptionMicrousd: 600, soapMicrousd: 900 },
    reserve: reserve || (async () => ({ id: 'usage-reservation' })),
    settle: settle || (async () => {}),
    calculateTranscriptionCostMicrousd: () => transcriptionCost,
    calculateChatCostMicrousd: () => chatCost,
  };
}

test('transcription provider, admission and browser-source contracts', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-transcription-'));
  const goodWav = path.join(tempDir, 'recording.wav');
  const unknown = path.join(tempDir, 'recording.txt');
  const tooLarge = path.join(tempDir, 'oversize.wav');
  fs.writeFileSync(goodWav, Buffer.from('synthetic-wave-audio'));
  fs.writeFileSync(unknown, Buffer.from('synthetic-unknown-audio'));
  fs.writeFileSync(tooLarge, Buffer.alloc(1));
  fs.truncateSync(tooLarge, MAX_AUDIO_BYTES + 1);

  const previousUploadsDir = process.env.UPLOADS_DIR;
  process.env.UPLOADS_DIR = tempDir;
  const moduleUrl = pathToFileURL(path.join(repoRoot, 'server', 'functions', 'transcribeSession.mjs'));
  moduleUrl.searchParams.set('contract', `${Date.now()}`);
  const transcriptionModule = await import(moduleUrl.href);
  let resolvedFile = goodWav;
  transcriptionModule.configureUploadResolver(({ audioUrl, user, orgId }) => {
    assert.equal(audioUrl, '/uploads/recording.wav');
    assert.equal(user.id, 'user-1');
    assert.equal(orgId, 'org-1');
    return resolvedFile;
  });

  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const invoke = (body, apiUsage) => transcriptionModule.default({
    body: { org_id: 'org-1', ...body },
    user: { id: 'user-1', email: 'clinician@example.test' },
    ...(apiUsage ? { apiUsage } : {}),
    respond: (status, responseBody) => ({ status, body: responseBody }),
  });

  await t.test('switch-off refusal is coded and makes no provider call', async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; throw new Error('must not fetch'); };
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '0', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        const result = await invoke({ action: 'transcribe', audio_url: '/uploads/recording.wav' });
        assert.equal(result.status, 403);
        assert.equal(result.body.code, 'transcription_disabled');
        assert.equal(fetched, false);
      },
    );
  });

  await t.test('production missing-key posture fails closed without a mock', async () => {
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '1', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: undefined },
      async () => {
        resolvedFile = goodWav;
        const result = await invoke({ action: 'transcribe', audio_url: '/uploads/recording.wav' });
        assert.equal(result.status, 503);
        assert.equal(result.body.code, 'transcription_provider_unconfigured');
        assert.equal(result.body.transcript, undefined);
        assert.equal(result.body.simulated, undefined);
      },
    );
  });

  await t.test('SELFTEST stays offline and labels its transcript', async () => {
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: undefined, SELFTEST: '1', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        resolvedFile = goodWav;
        const result = await invoke({ action: 'transcribe', audio_url: '/uploads/recording.wav' });
        assert.equal(result.status, 200);
        assert.equal(result.body.simulated, true);
        assert.match(result.body.transcript, /fallback transcript/i);
      },
    );
  });

  await t.test('unsupported MIME and the 20 MiB boundary reject before admission', async () => {
    let reservations = 0;
    const apiUsage = makeApiUsage({
      reserve: async () => { reservations += 1; return { id: 'unexpected' }; },
    });
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '1', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        resolvedFile = unknown;
        const unsupported = await invoke(
          { action: 'transcribe', audio_url: '/uploads/recording.wav' },
          apiUsage,
        );
        assert.equal(unsupported.status, 415);
        assert.equal(unsupported.body.code, 'unsupported_audio_type');

        resolvedFile = tooLarge;
        const oversized = await invoke(
          { action: 'transcribe', audio_url: '/uploads/recording.wav' },
          apiUsage,
        );
        assert.equal(oversized.status, 413);
        assert.equal(oversized.body.code, 'audio_too_large');
        assert.equal(reservations, 0);
      },
    );
  });

  await t.test('cap refusal carries reset metadata and prevents provider egress', async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; throw new Error('must not fetch'); };
    const capError = new Error('internal cap text');
    capError.httpStatus = 429;
    capError.code = 'api_usage_cap_reached';
    capError.publicMessage = 'Daily AI usage limit reached. Try again after the reset time.';
    capError.resetsAt = '2026-08-13T00:00:00.000Z';
    capError.retryAfterSeconds = 3600;
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '1', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        resolvedFile = goodWav;
        const result = await invoke(
          { action: 'transcribe', audio_url: '/uploads/recording.wav' },
          makeApiUsage({ reserve: async () => { throw capError; } }),
        );
        assert.equal(result.status, 429);
        assert.equal(result.body.code, 'api_usage_cap_reached');
        assert.equal(result.body.resets_at, capError.resetsAt);
        assert.equal(result.body.retry_after_seconds, 3600);
        assert.equal(fetched, false);
      },
    );
  });

  await t.test('missing usage admission fails closed before provider egress', async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; throw new Error('must not fetch'); };
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '1', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        resolvedFile = goodWav;
        const result = await invoke({ action: 'transcribe', audio_url: '/uploads/recording.wav' });
        assert.equal(result.status, 503);
        assert.equal(result.body.code, 'api_usage_unavailable');
        assert.equal(fetched, false);
      },
    );
  });

  await t.test('real transcription pins whisper-1 and settles actual duration cost', async () => {
    let providerRequest = null;
    let reservation = null;
    let settlement = null;
    globalThis.fetch = async (url, options) => {
      providerRequest = { url: String(url), options };
      return new Response(JSON.stringify({
        text: 'Contact clinician@example.test after the session.',
        duration: 37.5,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'req_whisper_contract' },
      });
    };
    const apiUsage = makeApiUsage({
      reserve: async (request) => { reservation = request; return { id: 'usage-real-transcription' }; },
      settle: async (value) => { settlement = value; },
      transcriptionCost: 777,
    });
    await withEnvironment(
      {
        TRANSCRIPTION_ENABLED: '1',
        SELFTEST: '0',
        LLM_REQUIRED: '1',
        OPENAI_API_KEY: 'synthetic-key',
        OPENAI_TRANSCRIBE_MODEL: 'must-not-override-the-pin',
      },
      async () => {
        resolvedFile = goodWav;
        const result = await invoke(
          { action: 'transcribe', audio_url: '/uploads/recording.wav' },
          apiUsage,
        );
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.simulated, false);
        assert.match(result.body.transcript, /\[REDACTED_EMAIL\]/);
        assert.equal(providerRequest.url, 'https://api.openai.com/v1/audio/transcriptions');
        assert.equal(providerRequest.options.body.get('model'), 'whisper-1');
        assert.equal(providerRequest.options.body.get('response_format'), 'verbose_json');
        assert.equal(providerRequest.options.body.get('file').type, 'audio/wav');
        assert.deepEqual(reservation, {
          feature: 'transcription',
          model: 'whisper-1',
          estimatedCostMicrousd: 600,
        });
        assert.deepEqual(settlement, {
          reservationId: 'usage-real-transcription',
          status: 'succeeded',
          audioSeconds: 37.5,
          providerRequestId: 'req_whisper_contract',
          actualCostMicrousd: 777,
        });
      },
    );
  });

  await t.test('provider failure settles the reservation as failed', async () => {
    let settlement = null;
    globalThis.fetch = async () => new Response('provider unavailable', { status: 503 });
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '1', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        resolvedFile = goodWav;
        const result = await invoke(
          { action: 'transcribe', audio_url: '/uploads/recording.wav' },
          makeApiUsage({ settle: async (value) => { settlement = value; } }),
        );
        assert.equal(result.status, 502);
        assert.equal(result.body.code, 'transcription_provider_failed');
        assert.deepEqual(settlement, { reservationId: 'usage-reservation', status: 'failed' });
      },
    );
  });

  await t.test('SOAP dissection reserves its selected model and settles token usage', async () => {
    let providerBody = null;
    let reservation = null;
    let settlement = null;
    globalThis.fetch = async (_url, options) => {
      providerBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        id: 'req_chat_contract',
        model: providerBody.model,
        usage: { prompt_tokens: 120, completion_tokens: 45 },
        choices: [{ message: { content: JSON.stringify({
          success: true,
          subjective: 'Client reports improvement.',
          objective: 'Movement reassessed.',
          assessment: 'Progressing as expected.',
          plan: 'Continue the programme.',
        }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const apiUsage = makeApiUsage({
      reserve: async (request) => { reservation = request; return { id: 'usage-soap' }; },
      settle: async (value) => { settlement = value; },
      chatCost: 888,
    });
    await withEnvironment(
      { TRANSCRIPTION_ENABLED: '1', SELFTEST: '0', LLM_REQUIRED: '1', OPENAI_API_KEY: 'synthetic-key' },
      async () => {
        const result = await invoke(
          { action: 'dissect_to_soap', transcript: 'Client reports less pain and completed exercise.' },
          apiUsage,
        );
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.simulated, false);
        assert.equal(reservation.feature, 'soap_dissection');
        assert.equal(reservation.model, providerBody.model);
        assert.equal(reservation.estimatedCostMicrousd, 900);
        assert.deepEqual(settlement, {
          reservationId: 'usage-soap',
          status: 'succeeded',
          inputTokens: 120,
          cachedInputTokens: 0,
          outputTokens: 45,
          providerRequestId: 'req_chat_contract',
          actualCostMicrousd: 888,
        });
      },
    );
  });

  await t.test('SOAPNoteModal records supported MIME formats and client size guard', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'src', 'components', 'calendar', 'SOAPNoteModal.jsx'),
      'utf8',
    );
    assert.match(source, /audio\/webm;codecs=opus/);
    assert.match(source, /audio\/mp4/);
    assert.match(source, /MAX_TRANSCRIPTION_AUDIO_BYTES = 20 \* 1024 \* 1024/);
    assert.match(source, /useAiCapability\('transcription'\)/);
    assert.doesNotMatch(source, /appPublicSettings\?\.public_settings\?\.transcription_enabled/);
  });
});
