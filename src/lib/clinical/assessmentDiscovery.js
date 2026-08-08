// Deterministic assessment discovery for clinician review.
//
// This module deliberately performs no network or model calls. It ranks only
// from catalogue metadata already available in the application, excludes
// assessments already attached to the client, and exposes the reason for each
// match. The result is decision support for a clinician, not a diagnosis or a
// direction to administer a test.

export const ASSESSMENT_DISCOVERY_MAX_RESULTS = 25;

export const ASSESSMENT_DISCOVERY_STATUS = Object.freeze({
  READY: 'ready',
  NO_CONDITIONS: 'no_conditions',
  CATALOGUE_UNAVAILABLE: 'catalogue_unavailable',
  EMPTY_CATALOGUE: 'empty_catalogue',
  UNSUPPORTED_CATALOGUE: 'unsupported_catalogue',
  NO_AVAILABLE_ASSESSMENTS: 'no_available_assessments',
  NO_MATCHES: 'no_matches',
});

const FIELD_DEFINITIONS = Object.freeze([
  { key: 'conditions_indicated', label: 'catalogue indication', weight: 100 },
  { key: 'search_tags', label: 'catalogue search tag', weight: 75 },
  { key: 'name', label: 'assessment name', weight: 55 },
  { key: 'description', label: 'catalogue description', weight: 35 },
  { key: 'category', label: 'catalogue category', weight: 25 },
]);

// These aliases are lexical equivalences only. They do not infer a new
// diagnosis or clinical relationship.
const PHRASE_ALIASES = new Map([
  ['chronic obstructive pulmonary disease', 'copd'],
  ['high blood pressure', 'hypertension'],
  ['dyslipidaemia', 'dyslipidemia'],
  ['high cholesterol', 'dyslipidemia'],
  ['glucose intolerance', 'hyperglycemia'],
  ['high blood sugar', 'hyperglycemia'],
  ['nicotine use', 'smoking'],
  ['fall prevention', 'fall risk'],
  ['falls prevention', 'fall risk'],
  ['falls risk', 'fall risk'],
  ['risk of falls', 'fall risk'],
  ['post surgical', 'post surgery'],
  ['post operative', 'post surgery'],
  ['postoperative', 'post surgery'],
  ['paediatric', 'pediatric'],
]);

const TOKEN_ALIASES = new Map([
  ['falls', 'fall'],
  ['falling', 'fall'],
  ['risks', 'risk'],
  ['smoker', 'smoking'],
  ['smokers', 'smoking'],
  ['musculoskeletal', 'musculoskeletal'],
]);

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'client',
  'clients',
  'condition',
  'conditions',
  'high',
  'issue',
  'issues',
  'low',
  'of',
  'or',
  'recent',
  'stage',
  'the',
  'to',
  'use',
  'with',
  'without',
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_\u2010-\u2015-]+/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(token) {
  return TOKEN_ALIASES.get(token) || token;
}

function meaningfulTokens(normalized) {
  return Array.from(new Set(
    normalized
      .split(' ')
      .map(normalizeToken)
      .filter((token) => token.length > 1 && !/^\d+$/.test(token) && !STOP_WORDS.has(token)),
  ));
}

function phraseVariants(value) {
  if (typeof value !== 'string' || value.trim() === '') return [];
  const rawVariants = [value, ...value.split(/[\/;,|()]|\s+-\s+/g)];
  const seen = new Set();
  const variants = [];

  for (const raw of rawVariants) {
    const normalized = normalizeText(raw);
    if (!normalized) continue;
    const canonical = PHRASE_ALIASES.get(normalized) || normalized;
    const key = `${normalized}|${canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push({
      raw: raw.trim(),
      normalized,
      canonical,
      tokens: meaningfulTokens(canonical),
    });
  }

  return variants;
}

function stringValues(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim() !== '');
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

function conditionName(condition) {
  if (typeof condition === 'string') return condition.trim();
  if (!condition || typeof condition !== 'object') return '';
  const value = condition.name ?? condition.condition_name ?? condition.label;
  return typeof value === 'string' ? value.trim() : '';
}

function prepareConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  const seen = new Set();
  const prepared = [];

  for (const condition of conditions) {
    const label = conditionName(condition);
    const normalizedLabel = normalizeText(label);
    if (!normalizedLabel || seen.has(normalizedLabel)) continue;
    const variants = phraseVariants(label).filter((variant) => variant.tokens.length > 0);
    if (variants.length === 0) continue;
    seen.add(normalizedLabel);
    prepared.push({ label, variants });
  }

  return prepared;
}

function comparePhrases(conditionPhrase, fieldPhrase) {
  if (conditionPhrase.canonical === fieldPhrase.canonical) return 40;
  if (conditionPhrase.normalized === fieldPhrase.normalized) return 40;

  const conditionTokens = new Set(conditionPhrase.tokens);
  const fieldTokens = new Set(fieldPhrase.tokens);
  if (conditionTokens.size === 0 || fieldTokens.size === 0) return null;

  let intersection = 0;
  for (const token of conditionTokens) {
    if (fieldTokens.has(token)) intersection += 1;
  }
  if (intersection === 0) return null;

  const smallerSize = Math.min(conditionTokens.size, fieldTokens.size);
  const coverage = intersection / smallerSize;
  const singleSpecificToken = smallerSize === 1
    && [...conditionTokens].some((token) => fieldTokens.has(token) && token.length >= 4);
  const sufficientlySpecific = singleSpecificToken || (intersection >= 2 && coverage >= 0.5);
  if (!sufficientlySpecific) return null;

  return 10 + (intersection * 5) + Math.round(coverage * 10);
}

function bestFieldEvidence(condition, assessment, field) {
  const fieldVariants = stringValues(assessment[field.key]).flatMap(phraseVariants);
  let best = null;

  for (const conditionPhrase of condition.variants) {
    for (const fieldPhrase of fieldVariants) {
      const quality = comparePhrases(conditionPhrase, fieldPhrase);
      if (quality === null) continue;
      const candidate = {
        score: field.weight + quality,
        condition: condition.label,
        field: field.key,
        fieldLabel: field.label,
        matchedTerm: fieldPhrase.raw || fieldPhrase.normalized,
      };
      if (!best || candidate.score > best.score) best = candidate;
    }
  }

  return best;
}

function rankAssessment(assessment, conditions) {
  const evidence = [];

  for (const condition of conditions) {
    let bestForCondition = null;
    for (const field of FIELD_DEFINITIONS) {
      const candidate = bestFieldEvidence(condition, assessment, field);
      if (!candidate) continue;
      if (!bestForCondition || candidate.score > bestForCondition.score) bestForCondition = candidate;
    }
    if (bestForCondition) evidence.push(bestForCondition);
  }

  if (evidence.length === 0) return null;
  evidence.sort((left, right) => right.score - left.score || left.condition.localeCompare(right.condition));
  const score = evidence.reduce((sum, item) => sum + item.score, 0);
  return { score, evidence };
}

function isSearchableAssessment(assessment) {
  return FIELD_DEFINITIONS.some((field) => stringValues(assessment?.[field.key]).length > 0);
}

function normalizedLimit(limit) {
  const numeric = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : ASSESSMENT_DISCOVERY_MAX_RESULTS;
  return Math.min(Math.max(numeric, 1), ASSESSMENT_DISCOVERY_MAX_RESULTS);
}

function emptyResult(status, counts = {}) {
  return {
    status,
    recommendations: [],
    resultLimit: ASSESSMENT_DISCOVERY_MAX_RESULTS,
    catalogueCount: counts.catalogueCount || 0,
    availableCount: counts.availableCount || 0,
    searchableCount: counts.searchableCount || 0,
    matchCount: 0,
  };
}

/**
 * Rank catalogue assessments from recorded condition and APSS labels.
 * Results are always deterministic and never exceed 25, even if a caller
 * requests a larger page.
 *
 * @param {{
 *   conditions?: any[],
 *   assessments?: any[],
 *   existingAssessmentIds?: any[],
 *   limit?: number,
 * }} [options]
 */
export function discoverAssessments(options = {}) {
  const {
    conditions,
    assessments,
    existingAssessmentIds = [],
    limit = ASSESSMENT_DISCOVERY_MAX_RESULTS,
  } = options;
  const preparedConditions = prepareConditions(conditions);
  if (preparedConditions.length === 0) {
    return emptyResult(ASSESSMENT_DISCOVERY_STATUS.NO_CONDITIONS, {
      catalogueCount: Array.isArray(assessments) ? assessments.length : 0,
    });
  }

  if (!Array.isArray(assessments)) {
    return emptyResult(ASSESSMENT_DISCOVERY_STATUS.CATALOGUE_UNAVAILABLE);
  }
  if (assessments.length === 0) {
    return emptyResult(ASSESSMENT_DISCOVERY_STATUS.EMPTY_CATALOGUE);
  }

  const existingIds = new Set(
    (Array.isArray(existingAssessmentIds) ? existingAssessmentIds : [])
      .filter((id) => id !== null && id !== undefined)
      .map(String),
  );
  const validAssessments = assessments.filter((assessment) => {
    if (!assessment || typeof assessment !== 'object') return false;
    if (assessment.id === null || assessment.id === undefined || String(assessment.id).trim() === '') return false;
    if (assessment.is_deleted === true || assessment.deleted_date) return false;
    return true;
  });
  const availableAssessments = validAssessments.filter((assessment) => !existingIds.has(String(assessment.id)));
  const counts = {
    catalogueCount: assessments.length,
    availableCount: availableAssessments.length,
  };

  if (validAssessments.length > 0 && availableAssessments.length === 0) {
    return emptyResult(ASSESSMENT_DISCOVERY_STATUS.NO_AVAILABLE_ASSESSMENTS, counts);
  }

  const searchableAssessments = availableAssessments.filter(isSearchableAssessment);
  counts.searchableCount = searchableAssessments.length;
  if (searchableAssessments.length === 0) {
    return emptyResult(ASSESSMENT_DISCOVERY_STATUS.UNSUPPORTED_CATALOGUE, counts);
  }

  const ranked = searchableAssessments
    .map((assessment) => {
      const ranking = rankAssessment(assessment, preparedConditions);
      return ranking ? { assessment, ...ranking } : null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.evidence.length !== left.evidence.length) return right.evidence.length - left.evidence.length;
      const nameOrder = normalizeText(left.assessment.name).localeCompare(normalizeText(right.assessment.name));
      if (nameOrder !== 0) return nameOrder;
      return String(left.assessment.id).localeCompare(String(right.assessment.id));
    });

  if (ranked.length === 0) {
    return emptyResult(ASSESSMENT_DISCOVERY_STATUS.NO_MATCHES, counts);
  }

  const cappedLimit = normalizedLimit(limit);
  const recommendations = ranked.slice(0, cappedLimit).map(({ assessment, evidence }) => {
    const primary = evidence[0];
    return {
      ...assessment,
      reason: `${primary.fieldLabel} matches ${primary.condition}: ${primary.matchedTerm}.`,
      match_basis: evidence.map(({ condition, field, fieldLabel, matchedTerm }) => ({
        condition,
        field,
        field_label: fieldLabel,
        matched_term: matchedTerm,
      })),
    };
  });

  return {
    status: ASSESSMENT_DISCOVERY_STATUS.READY,
    recommendations,
    resultLimit: ASSESSMENT_DISCOVERY_MAX_RESULTS,
    catalogueCount: assessments.length,
    availableCount: availableAssessments.length,
    searchableCount: searchableAssessments.length,
    matchCount: ranked.length,
  };
}

export function assessmentDiscoveryStatusMessage(status) {
  switch (status) {
    case ASSESSMENT_DISCOVERY_STATUS.NO_CONDITIONS:
      return 'Record a condition or complete the clinical risk review to see catalogue suggestions.';
    case ASSESSMENT_DISCOVERY_STATUS.CATALOGUE_UNAVAILABLE:
      return 'The assessment catalogue is not available yet. Refresh the client profile and try again.';
    case ASSESSMENT_DISCOVERY_STATUS.EMPTY_CATALOGUE:
      return 'The assessment catalogue is empty. Ask an administrator to restore the catalogue.';
    case ASSESSMENT_DISCOVERY_STATUS.UNSUPPORTED_CATALOGUE:
      return 'Available catalogue records do not contain searchable assessment metadata.';
    case ASSESSMENT_DISCOVERY_STATUS.NO_AVAILABLE_ASSESSMENTS:
      return 'Every searchable assessment is already recorded for this client.';
    case ASSESSMENT_DISCOVERY_STATUS.NO_MATCHES:
      return 'No catalogue metadata matched the recorded conditions. Browse the full assessment library to choose manually.';
    default:
      return '';
  }
}
