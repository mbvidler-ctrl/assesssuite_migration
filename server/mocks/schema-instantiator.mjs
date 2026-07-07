// Deterministic JSON Schema instantiator used by the InvokeLLM and
// ExtractDataFromUploadedFile mocks. Given a (small, non-recursive-schema
// vocabulary) JSON Schema object, produces a plausible value honouring
// `required`, `enum`, and `type`, with string properties carrying
// contextual placeholder text that incorporates the property name so a
// human reviewing mock output can immediately see which field produced it.

/**
 * Converts a snake_case or camelCase property name into a short human
 * phrase for placeholder text, e.g. "assessment_id" -> "assessment id".
 */
function humanise(name) {
  return String(name)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

let counter = 0;
/** Monotonic counter folded into placeholder values for light variety across an array. */
function nextSeed() {
  counter += 1;
  return counter;
}

function placeholderString(propName, propSchema) {
  if (Array.isArray(propSchema?.enum) && propSchema.enum.length > 0) {
    return propSchema.enum[0];
  }
  if (propSchema?.format === 'date-time') {
    return new Date().toISOString();
  }
  if (propSchema?.format === 'date' || /date/i.test(propName)) {
    return new Date().toISOString().slice(0, 10);
  }
  const label = humanise(propName);
  const description = propSchema?.description ? ` (${propSchema.description})` : '';
  return `Mock ${label} value${description}`;
}

function placeholderNumber(propName) {
  // Small, plausible, deterministic-per-call value; varies slightly per
  // property so arrays of numeric fields are not all identical.
  return 10 + (nextSeed() % 40);
}

function placeholderBoolean() {
  return true;
}

/**
 * Instantiates a single schema node into a plausible mock value.
 * Supports: object (with properties/required), array (with items), string
 * (with enum/format), number/integer, boolean. Falls back to null for
 * unrecognised node shapes rather than guessing wildly.
 */
export function instantiateSchema(schema, propName = 'value') {
  if (!schema || typeof schema !== 'object') return null;

  switch (schema.type) {
    case 'object': {
      const result = {};
      const properties = schema.properties || {};
      const required = new Set(schema.required || Object.keys(properties));
      for (const [key, propSchema] of Object.entries(properties)) {
        // Instantiate every declared property (not only required ones) so
        // consumers that optimistically read optional fields still see a
        // value; the contract only mandates that required fields honour
        // their type, not that optional fields be omitted.
        if (required.has(key) || true) {
          result[key] = instantiateSchema(propSchema, key);
        }
      }
      return result;
    }
    case 'array': {
      const itemSchema = schema.items || { type: 'string' };
      const count = 1 + (nextSeed() % 2); // 1-2 items, per the contract.
      return Array.from({ length: count }, () => instantiateSchema(itemSchema, propName));
    }
    case 'string':
      return placeholderString(propName, schema);
    case 'number':
    case 'integer':
      return placeholderNumber(propName);
    case 'boolean':
      return placeholderBoolean();
    default:
      // Untyped schema node (e.g. {} for a free-form object): return a
      // small placeholder object so downstream `.foo` access does not throw.
      if (schema.properties) return instantiateSchema({ ...schema, type: 'object' }, propName);
      if (schema.enum) return schema.enum[0];
      return `Mock ${humanise(propName)} value`;
  }
}

/**
 * Extracts a flat set of key -> description pairs from a JSON object literal
 * embedded in a free-text LLM prompt (used when InvokeLLM is called without
 * response_json_schema, but the prompt itself asks for a JSON-shaped
 * response by example, e.g. PrivateHealthInitialAssessment.jsx). Looks for
 * the first `{ ... }` block in the prompt containing quoted-string keys and
 * parses it as JSON; returns null if no such block is found or it does not
 * parse.
 */
export function extractJsonKeysFromPrompt(prompt) {
  if (typeof prompt !== 'string') return null;
  // A prompt that asks for plain text is a prose request even when it embeds
  // JSON as context data (the report section generators stringify client
  // context into the prompt). Do not mistake that context for a response spec.
  if (/plain text|no\s+json|not\s+json/i.test(prompt)) return null;
  // Only treat the prompt as asking for a JSON-shaped response when it says so
  // explicitly; otherwise incidental embedded JSON (context) false-positives.
  const cue = /(structure your response as json|response as json|respond(?:ing)?\s+(?:with|in)\s+json|return\s+(?:the\s+)?(?:response|content|a|an)?\s*(?:as\s+)?json|as json with keys|format[^.]*as json)/i;
  const cueMatch = cue.exec(prompt);
  if (!cueMatch) return null;
  // Parse the first balanced {...} object appearing after the cue (the spec),
  // tolerating trailing prose after it.
  const region = prompt.slice(cueMatch.index);
  const obj = firstBalancedObject(region);
  if (!obj) return null;
  try {
    const parsed = JSON.parse(obj);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed);
    }
  } catch {
    // Not valid JSON — treat as prose.
  }
  return null;
}

/** Returns the substring of the first brace-balanced {...} object in `s`, or null. */
function firstBalancedObject(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}
