// Fake OpenAI chat/completions provider, loopback-only, for exercising
// server/llm.mjs's real-model code path under test (see
// OPENAI_CHAT_TEST_BASE_URL in server/llm.mjs). A sibling to fake-openai.mjs,
// not an extension of it: that file is tightly coupled to the Responses API
// and the referral extraction schema, whereas chat/completions has a
// different envelope and different failure surface.

import http from 'node:http';

function extractTrailingSchema(userContent) {
  const marker = 'Return a JSON object that conforms to this JSON schema';
  const idx = typeof userContent === 'string' ? userContent.lastIndexOf(marker) : -1;
  if (idx === -1) return null;
  const braceStart = userContent.indexOf('{', idx);
  if (braceStart === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = braceStart; i < userContent.length; i++) {
    const c = userContent[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) {
      try { return JSON.parse(userContent.slice(braceStart, i + 1)); } catch { return null; }
    } }
  }
  return null;
}

function syntheticValueFor(schema, key) {
  if (!schema || typeof schema !== 'object') return `Synthetic chat-provider ${key} value`;
  switch (schema.type) {
    case 'object': {
      const out = {};
      for (const [k, v] of Object.entries(schema.properties || {})) out[k] = syntheticValueFor(v, k);
      return out;
    }
    case 'array':
      return [syntheticValueFor(schema.items || { type: 'string' }, key)];
    case 'string':
      return `Synthetic chat-provider ${key.replace(/_/g, ' ')} value`;
    case 'number':
    case 'integer':
      return 7;
    case 'boolean':
      return true;
    default:
      return `Synthetic chat-provider ${key} value`;
  }
}

export async function startFakeOpenAIChat() {
  let mode = 'semantic';
  const calls = [];
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'FAKE_CHAT_PROVIDER_MALFORMED_REQUEST_CANARY' } }));
      return;
    }
    const jsonMode = payload?.response_format?.type === 'json_object';
    const userMessage = Array.isArray(payload.messages) ? payload.messages.find((m) => m.role === 'user') : null;
    const systemMessage = Array.isArray(payload.messages) ? payload.messages.find((m) => m.role === 'system') : null;
    calls.push({
      model: payload.model,
      temperature: payload.temperature,
      maxCompletionTokens: payload.max_completion_tokens,
      jsonMode,
      hasTools: Object.hasOwn(payload, 'tools'),
      hasResponseFormat: Object.hasOwn(payload, 'response_format'),
      messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
      systemContent: systemMessage?.content || '',
      userContent: userMessage?.content || '',
    });

    if (mode === 'timeout') {
      const timer = setTimeout(() => { if (!res.destroyed) res.writeHead(504).end(); }, 5_000);
      timer.unref();
      req.on('close', () => clearTimeout(timer));
      return;
    }
    if (mode === 'provider-500' || mode === 'provider-400') {
      res.writeHead(mode === 'provider-500' ? 500 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'FAKE_CHAT_PROVIDER_PRIVATE_BODY_CANARY' } }));
      return;
    }
    if (mode === 'empty-choices') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [] }));
      return;
    }
    if (mode === 'malformed-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{not-json' } }] }));
      return;
    }

    let content;
    if (jsonMode) {
      const schema = extractTrailingSchema(userMessage?.content) || { type: 'object', properties: {} };
      content = JSON.stringify(syntheticValueFor(schema, 'root'));
    } else {
      const promptTail = String(userMessage?.content || '').slice(-60).replace(/\s+/g, ' ');
      content = `SYNTHETIC_CHAT_PROVIDER_RESPONSE for: "${promptTail}"`;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'x-request-id': 'req_synthetic_assurance',
    });
    res.end(JSON.stringify({
      id: 'chatcmpl_synthetic_assurance',
      object: 'chat.completion',
      model: payload.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 30,
        total_tokens: 130,
        prompt_tokens_details: { cached_tokens: 20 },
      },
    }));
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1/chat/completions`,
    calls,
    setMode(next) { mode = next; },
    reset() { mode = 'semantic'; calls.length = 0; },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
