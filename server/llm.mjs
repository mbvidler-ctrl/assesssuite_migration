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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL_FAST = process.env.OPENAI_MODEL_FAST || 'gpt-4.1-mini';
const MODEL_QUALITY = process.env.OPENAI_MODEL_QUALITY || 'gpt-4.1';

export function llmEnabled() {
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
    // Medicare (10-11 digits), DVA/NDIS/provider numbers (7+ digit or alnum runs)
    .replace(/\b\d{9,11}\b/g, () => bump('[REDACTED_ID]'))
    .replace(/\b(?:DVA|NDIS|MRN|URN|PRV|AEP)[-\s]?[A-Z0-9]{3,}\b/gi, () => bump('[REDACTED_ID]'))
    // Dates of birth (dd/mm/yyyy, yyyy-mm-dd)
    .replace(/\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, () => bump('[REDACTED_DATE]'));
  return { text, redactions: n };
}

function pickModel(prompt, schema) {
  const long = typeof prompt === 'string' && prompt.length > 1800;
  const wide = schema && schema.properties && Object.keys(schema.properties).length > 6;
  return long || wide ? MODEL_QUALITY : MODEL_FAST;
}

async function callOpenAI({ messages, model, json }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// Main entry. Returns the value InvokeLLM call sites expect:
//   - schema present -> a parsed object matching the schema
//   - otherwise      -> a string; the prompt's own wording drives whether that
//                       string is prose or JSON (the few call sites that want
//                       JSON say so in the prompt and JSON.parse the result).
// Throws on any failure so the caller can fall back to the mock.
export async function invokeLLM({ prompt, schema }) {
  const { text: safePrompt } = deidentify(String(prompt ?? ''));

  const system = [
    'You are a clinical documentation assistant for an allied-health (exercise physiology) platform used in Australia.',
    'Write in Australian English, in a professional clinical register. Be specific, evidence-informed and concise.',
    'You are a decision-support tool: never diagnose; frame interpretation as clinical decision support.',
    'Only state clinical facts you are confident are correct; do not fabricate citations, DOIs or statistics.',
    'Follow the output format the user asks for exactly. Never emit placeholder text such as "Mock ... value".',
    schema ? 'Respond with a single valid JSON object and nothing else.' : 'Honour the prompt: if it asks for JSON, return only a JSON object; otherwise return prose.',
  ].join(' ');

  const userContent = schema
    ? `${safePrompt}\n\nReturn a JSON object that conforms to this JSON schema ` +
      `(match the property names and types exactly; fill every property with real, ` +
      `clinically appropriate content — never placeholder text):\n${JSON.stringify(schema)}`
    : safePrompt;

  const content = await callOpenAI({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    model: pickModel(prompt, schema),
    json: Boolean(schema),
  });

  return schema ? JSON.parse(content) : content;
}
