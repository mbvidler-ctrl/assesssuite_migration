const MAX_PROTOCOL_QUERY_LENGTH = 160;

const QUERY_KEYS = Object.freeze([
  'query',
  'condition_name',
  'conditionName',
  'name',
  'label',
  'value',
]);

const PROFESSION_ALIASES = new Map([
  ['aep', 'accredited_exercise_physiologist'],
  ['accredited exercise physiologist', 'accredited_exercise_physiologist'],
  ['exercise physiologist', 'accredited_exercise_physiologist'],
  ['ep', 'accredited_exercise_physiologist'],
  ['physio', 'physiotherapist'],
  ['physical therapist', 'physiotherapist'],
  ['physiotherapist', 'physiotherapist'],
]);

const SCOPE_ALIASES = new Map([
  ['aep', 'exercise_physiology'],
  ['ep', 'exercise_physiology'],
  ['exercise physiology', 'exercise_physiology'],
  ['physio', 'physiotherapy'],
  ['physiotherapy', 'physiotherapy'],
]);

/**
 * Convert human-entered catalogue text to a conservative comparison key.
 *
 * This deliberately does not stem words or apply fuzzy edit-distance rules:
 * approximate clinical-topic matching can turn a spelling error into the
 * wrong management card. Curated aliases are the supported synonym seam.
 */
export function normaliseProtocolText(value) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLocaleLowerCase('en-AU')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractQueryValue(input) {
  if (typeof input === 'string') {
    return { raw: input, source: 'free_text' };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { raw: '', source: 'invalid' };
  }

  for (const key of QUERY_KEYS) {
    if (typeof input[key] === 'string') {
      return { raw: input[key], source: 'preset' };
    }
  }

  return { raw: '', source: 'invalid' };
}

/**
 * Normalise either an autocomplete/preset object or a free-text value through
 * one path so Enter and click selection cannot diverge.
 */
export function normaliseProtocolQuery(input) {
  const extracted = extractQueryValue(input);
  const raw = extracted.raw.trim();
  const normalised = normaliseProtocolText(raw);

  if (!raw) {
    return Object.freeze({
      valid: false,
      code: 'query_required',
      raw: '',
      normalised: '',
      tokens: Object.freeze([]),
      source: extracted.source,
    });
  }

  if (raw.length > MAX_PROTOCOL_QUERY_LENGTH) {
    return Object.freeze({
      valid: false,
      code: 'query_too_long',
      raw,
      normalised,
      tokens: Object.freeze(normalised.split(' ').filter(Boolean)),
      source: extracted.source,
    });
  }

  if (normalised.length < 2) {
    return Object.freeze({
      valid: false,
      code: 'query_too_short',
      raw,
      normalised,
      tokens: Object.freeze(normalised ? [normalised] : []),
      source: extracted.source,
    });
  }

  return Object.freeze({
    valid: true,
    code: null,
    raw,
    normalised,
    tokens: Object.freeze(normalised.split(' ').filter(Boolean)),
    source: extracted.source,
  });
}

function normaliseCode(value) {
  return normaliseProtocolText(value).replace(/\s+/g, '_');
}

export function normaliseProfession(value) {
  const text = normaliseProtocolText(value);
  return PROFESSION_ALIASES.get(text) || normaliseCode(value);
}

export function normaliseScope(value) {
  const text = normaliseProtocolText(value);
  return SCOPE_ALIASES.get(text) || normaliseCode(value);
}

export { MAX_PROTOCOL_QUERY_LENGTH };
