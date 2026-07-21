import http from 'node:http';
import { detectFixtureProfile } from './synthetic-fixtures.mjs';
import {
  CANONICAL_REFERRAL_PROFILE_UNDER_13,
  canonicalProviderProfile,
  detectCanonicalReferralFixtureProfile,
} from './syntheticReferralFixtures.mjs';
import { REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS } from '../../../src/lib/referralExtractionSchema.js';

function responseEnvelope(output) {
  const text = JSON.stringify(output);
  return {
    id: 'resp_synthetic_assurance',
    object: 'response',
    status: 'completed',
    output_text: text,
    output: [{
      id: 'msg_synthetic_assurance',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text, annotations: [] }],
    }],
    usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
  };
}

function decodedProviderInput(payload) {
  const serialised = JSON.stringify(payload);
  const decoded = [serialised];
  for (const match of serialised.matchAll(/data:(?:application\/pdf|image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)/g)) {
    decoded.push(Buffer.from(match[1], 'base64').toString('latin1'));
  }
  for (const match of serialised.matchAll(/"file_data":"([A-Za-z0-9+/=]+)"/g)) {
    decoded.push(Buffer.from(match[1], 'base64').toString('latin1'));
  }
  return decoded.join('\n');
}

export async function startFakeOpenAI() {
  let mode = 'semantic';
  let modeSequence = [];
  let beforeRespond = null;
  const calls = [];
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/responses')) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let payload = null;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'FAKE_PROVIDER_MALFORMED_REQUEST_CANARY' } }));
      return;
    }
    const providerSchema = payload?.text?.format?.schema;
    const schemaPropertyNames = Object.keys(providerSchema?.properties || {});
    const canonicalSchema =
      JSON.stringify(schemaPropertyNames) === JSON.stringify(REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
    calls.push({
      route: req.url,
      store: payload.store,
      hasTools: Object.hasOwn(payload, 'tools'),
      hasBackground: Object.hasOwn(payload, 'background'),
      background: payload.background,
      promptCacheRetention: payload.prompt_cache_retention,
      schemaPropertyNames,
      schemaPropertyCount: schemaPropertyNames.length,
      schemaRequired: Array.isArray(providerSchema?.required) ? [...providerSchema.required] : null,
      schemaAdditionalProperties: providerSchema?.additionalProperties,
      input: decodedProviderInput(payload),
    });
    if (beforeRespond) await beforeRespond({ payload, call: calls.at(-1) });
    const responseMode = modeSequence.length > 0 ? modeSequence.shift() : mode;

    if (responseMode === 'timeout') {
      const timer = setTimeout(() => {
        if (!res.destroyed) res.writeHead(504).end();
      }, 5_000);
      timer.unref();
      req.on('close', () => clearTimeout(timer));
      return;
    }
    if (responseMode === 'provider-400' || responseMode === 'provider-500') {
      const status = responseMode === 'provider-400' ? 400 : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'FAKE_PROVIDER_PRIVATE_BODY_CANARY' } }));
      return;
    }
    if (responseMode === 'empty') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...responseEnvelope({}), output: [], output_text: '' }));
      return;
    }
    if (responseMode === 'placeholder') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const output = canonicalSchema
        ? canonicalProviderProfile({ full_name: 'Mock Patient', primary_condition: 'placeholder' })
        : { full_name: 'Mock Patient', date_of_birth: null, diagnoses: ['placeholder'], referrer: null, phone: null };
      res.end(JSON.stringify(responseEnvelope(output)));
      return;
    }
    if (responseMode === 'missing-value-sentinels') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const output = canonicalSchema
        ? canonicalProviderProfile({
            full_name: 'Alex River',
            date_of_birth: 'N/A',
            comorbidities: ['not provided'],
            referral_source_name: 'Not specified',
          })
        : { full_name: 'Alex River', date_of_birth: 'N/A', diagnoses: ['not provided'], referrer: 'Not specified', phone: null };
      res.end(JSON.stringify(responseEnvelope(output)));
      return;
    }
    if (responseMode === 'missing-fields') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const output = canonicalSchema
        ? canonicalProviderProfile({ full_name: 'Alex River', comorbidities: [] })
        : { full_name: 'Alex River', date_of_birth: null, diagnoses: [], referrer: null, phone: null };
      res.end(JSON.stringify(responseEnvelope(output)));
      return;
    }
    if (responseMode === 'malformed') {
      const envelope = responseEnvelope({});
      envelope.output_text = '{not-json';
      envelope.output[0].content[0].text = '{not-json';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(envelope));
      return;
    }
    if (responseMode === 'schema-invalid') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const output = canonicalSchema
        ? {
            ...canonicalProviderProfile({}),
            full_name: 42,
            date_of_birth: 'not-a-date',
            comorbidities: 'ankle sprain',
          }
        : { full_name: 42, date_of_birth: 'not-a-date', diagnoses: 'ankle sprain', referrer: null, phone: null };
      res.end(JSON.stringify(responseEnvelope(output)));
      return;
    }
    if (responseMode === 'under-13') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const output = canonicalSchema
        ? canonicalProviderProfile(CANONICAL_REFERRAL_PROFILE_UNDER_13)
        : {
            full_name: CANONICAL_REFERRAL_PROFILE_UNDER_13.full_name,
            date_of_birth: CANONICAL_REFERRAL_PROFILE_UNDER_13.date_of_birth,
            diagnoses: ['ankle sprain'],
            referrer: 'Dr Synthetic',
            phone: null,
          };
      res.end(JSON.stringify(responseEnvelope(output)));
      return;
    }
    if (responseMode === 'refusal') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'resp_refusal', object: 'response', status: 'completed',
        output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'Cannot process.' }] }],
      }));
      return;
    }

    const decodedInput = decodedProviderInput(payload);
    const output = canonicalSchema
      ? canonicalProviderProfile(detectCanonicalReferralFixtureProfile(decodedInput))
      : detectFixtureProfile(decodedInput);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseEnvelope(output)));
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1/responses`,
    calls,
    setMode(next) { mode = next; modeSequence = []; },
    setModeSequence(next) {
      modeSequence = Array.isArray(next) ? [...next] : [];
    },
    setBeforeRespond(next) { beforeRespond = typeof next === 'function' ? next : null; },
    reset() { mode = 'semantic'; modeSequence = []; beforeRespond = null; calls.length = 0; },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
