// Real language-model adapter for the demo's InvokeLLM integration, shipped as
// ONE unit with a de-identification middleware (engagement election E6).
//
// Behaviour:
//   - When OPENAI_API_KEY is set, InvokeLLM calls OpenAI. Every prompt is passed
//     through deidentify() before egress. Structured requests (a response schema
//     or JSON keys embedded in the prompt) return a parsed object / JSON string
//     so existing call sites are unchanged; plain requests return prose.
//   - When the key is absent OR a call fails, the caller falls back to the
//     deterministic mock (which carries an explicit "simulation" label). The
//     real path never carries that label — real output is real.
//
// No client/patient data reaches this module in the demo (synthetic data only);
// the de-identification pass is nonetheless a standing control so the same code
// protects real data if the platform is ever run against it.

import {
  PHYSIO_MODEL_FAST,
  PHYSIO_MODEL_QUALITY,
} from './productionPosture.mjs';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const PHYSIO_PRODUCTION = process.env.NODE_ENV === 'production'
  && process.env.PROFESSION === 'physio';
export const MODEL_FAST = PHYSIO_PRODUCTION
  ? PHYSIO_MODEL_FAST
  : process.env.OPENAI_MODEL_FAST || 'gpt-4.1-mini';
export const MODEL_QUALITY = PHYSIO_PRODUCTION
  ? PHYSIO_MODEL_QUALITY
  : process.env.OPENAI_MODEL_QUALITY || 'gpt-4.1';

export function resolveMaxCompletionTokens(environment = process.env) {
  const parsed = Number(environment.GENERAL_CLINICAL_LLM_MAX_OUTPUT_UNITS);
  if (!Number.isSafeInteger(parsed) || parsed < 128) return 32_768;
  // Preserve GPT-4.1's pre-cap report capacity. Configuration may lower this
  // ceiling for an incident response, but cannot exceed the model's reviewed
  // maximum output window.
  return Math.min(parsed, 32_768);
}

// Test-only provider override (mirrors server/documentExtraction.mjs's
// DOCUMENT_EXTRACTION_TEST_BASE_URL). Honoured ONLY when SELFTEST==='1'
// (forbidden during production bootstrap — server/productionBootstrap.mjs),
// the supplied URL resolves to a loopback http:// address, AND OPENAI_API_KEY
// itself is an obviously synthetic/test value (the shipped suites' own
// convention — see server/tests/clinical-ai-feature-matrix.test.mjs — is a
// key beginning "synthetic-"). The key check matters just as much as the
// loopback check: without it, a shell-exported real OPENAI_API_KEY that
// happens to be present when a test wires this override would still be
// transmitted, in plaintext, to whatever is listening on that loopback URL.
function resolveChatTestBaseUrl() {
  if (process.env.SELFTEST !== '1') return null;
  const raw = process.env.OPENAI_CHAT_TEST_BASE_URL;
  if (!raw) return null;
  if (!/^synthetic-/.test(process.env.OPENAI_API_KEY || '')) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);
  if (!loopback || parsed.protocol !== 'http:') return null;
  return parsed.href;
}

function resolveChatTestTimeoutMs() {
  const raw = Number(process.env.OPENAI_CHAT_TEST_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return 500;
  return Math.min(5_000, Math.max(50, Math.floor(raw)));
}

export function llmEnabled() {
  // SELFTEST must always use the deterministic mock, even if a key is
  // present in the inherited environment (defence in depth — .env.local is
  // already skipped under SELFTEST, but a shell-exported key would
  // otherwise leak real calls into test runs) — except when a validated
  // loopback OPENAI_CHAT_TEST_BASE_URL has been explicitly wired, which
  // lets tests exercise the real code path against a fake local provider
  // (see resolveChatTestBaseUrl()).
  if (process.env.SELFTEST === '1' && !resolveChatTestBaseUrl()) return false;
  return Boolean(process.env.OPENAI_API_KEY);
}

// --- De-identification middleware -----------------------------------------
// Pattern-based redaction of anything that could identify a person, applied to
// every prompt before it leaves the machine. Names in the demo are fictional
// synthetic data; pattern redaction covers the structured identifiers that
// carry real-world risk (contact details, scheme and provider numbers, dates
// of birth). Returns { text, redactions }.
export function deidentify(input) {
  if (typeof input !== 'string' || !input) return { text: input, redactions: 0 };
  let n = 0;
  const bump = (s) => { n += 1; return s; };
  let text = input
    // Email addresses
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, () => bump('[REDACTED_EMAIL]'))
    // Australian phone numbers (mobile / landline, spaced or not)
    .replace(/(?:\+?61|0)[\s-]?[2-478](?:[\s-]?\d){8}/g, () => bump('[REDACTED_PHONE]'))
    // Medicare / DVA / NDIS / member / account numbers — any run of 7+ digits,
    // optionally spaced or hyphenated.
    .replace(/\b\d[\d\s-]{5,}\d\b/g, (m) => (/\d{7,}/.test(m.replace(/[\s-]/g, '')) ? bump('[REDACTED_ID]') : m))
    .replace(/\b\d{7,}\b/g, () => bump('[REDACTED_ID]'))
    .replace(/\b(?:DVA|NDIS|MRN|URN|PRV|AEP)[-\s]?[A-Z0-9]{3,}\b/gi, () => bump('[REDACTED_ID]'))
    // Dates of birth (dd/mm/yyyy, yyyy-mm-dd)
    .replace(/\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, () => bump('[REDACTED_DATE]'));
  return { text, redactions: n };
}

export function pickModel(prompt, schema) {
  const long = typeof prompt === 'string' && prompt.length > 1800;
  const wide = schema && schema.properties && Object.keys(schema.properties).length > 6;
  return long || wide ? MODEL_QUALITY : MODEL_FAST;
}

async function callOpenAI({ messages, model, json }) {
  const controller = new AbortController();
  const testBaseUrl = resolveChatTestBaseUrl();
  const url = testBaseUrl || OPENAI_URL;
  const timer = setTimeout(() => controller.abort(), testBaseUrl ? resolveChatTestTimeoutMs() : 45000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_completion_tokens: resolveMaxCompletionTokens(),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const providerModel = typeof data.model === 'string' && data.model ? data.model : null;
    if (PHYSIO_PRODUCTION && providerModel !== model) {
      throw new Error('OpenAI provider model did not match the pinned Physio production snapshot.');
    }
    const inputTokens = (
      Number.isSafeInteger(data.usage?.prompt_tokens) && data.usage.prompt_tokens >= 0
        ? data.usage.prompt_tokens
        : null
    );
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: providerModel || model,
      modelFromProvider: Boolean(providerModel),
      finishReason:
        typeof data.choices?.[0]?.finish_reason === 'string' && data.choices[0].finish_reason
          ? data.choices[0].finish_reason
          : null,
      providerStatus: res.status,
      usage: {
        inputTokens,
        cachedInputTokens:
          inputTokens === null
            ? null
            : Number.isSafeInteger(data.usage?.prompt_tokens_details?.cached_tokens) &&
                data.usage.prompt_tokens_details.cached_tokens >= 0
              ? data.usage.prompt_tokens_details.cached_tokens
              : 0,
        outputTokens: Number.isSafeInteger(data.usage?.completion_tokens) && data.usage.completion_tokens >= 0
          ? data.usage.completion_tokens
          : null,
      },
      providerRequestId: typeof data.id === 'string' && data.id ? data.id : null,
      providerHttpRequestId: res.headers.get('x-request-id') || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Usage-aware provider entry. `value` retains the HTTP InvokeLLM contract:
// schema requests contain a parsed object; other requests contain a string.
// The server routes settle the accompanying usage metadata before returning
// that bare value to the client. Throws on any provider/parse failure.
export async function invokeLLMWithUsage({ prompt, schema, systemInstructions = null }) {
  const { text: safePrompt } = deidentify(String(prompt ?? ''));

  const defaultSystemInstructions = [
    'You are a clinical documentation assistant for an allied-health (exercise physiology) platform used in Australia.',
    'Write in Australian English, in a professional clinical register. Be specific, evidence-informed and concise.',
    'You are a decision-support tool: never diagnose; frame interpretation as clinical decision support.',
    'Only state clinical facts you are confident are correct; do not fabricate citations, DOIs or statistics.',
    'Follow the output format the user asks for exactly. Never emit placeholder text such as "Mock ... value".',
  ];
  const selectedSystemInstructions = Array.isArray(systemInstructions) && systemInstructions.length > 0
    ? systemInstructions
    : defaultSystemInstructions;
  const system = [
    ...selectedSystemInstructions.map((instruction) => String(instruction).trim()).filter(Boolean),
    schema ? 'Respond with a single valid JSON object and nothing else.' : 'Honour the prompt: if it asks for JSON, return only a JSON object; otherwise return prose.',
  ].join(' ');

  const userContent = schema
    ? `${safePrompt}\n\nReturn a JSON object that conforms to this JSON schema ` +
      `(match the property names and types exactly; fill every property with real, ` +
      `clinically appropriate content — never placeholder text):\n${JSON.stringify(schema)}`
    : safePrompt;

  const generated = await callOpenAI({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    model: pickModel(prompt, schema),
    json: Boolean(schema),
  });

  return {
    value: schema ? JSON.parse(generated.content) : generated.content,
    provider: 'openai',
    model: generated.model,
    modelFromProvider: generated.modelFromProvider,
    finishReason: generated.finishReason,
    providerStatus: generated.providerStatus,
    usage: generated.usage,
    providerRequestId: generated.providerRequestId,
    providerHttpRequestId: generated.providerHttpRequestId,
  };
}
