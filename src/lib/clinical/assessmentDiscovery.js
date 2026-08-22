export const MAX_ASSESSMENT_RECOMMENDATIONS = 5;

const FIELD_SPECS = Object.freeze([
  { key: 'conditions_indicated', label: 'catalogue indication', weight: 400 },
  { key: 'target_conditions', label: 'target condition', weight: 390 },
  { key: 'indications', label: 'catalogue indication', weight: 390 },
  { key: 'search_tags', label: 'search tag', weight: 300 },
  { key: 'name', label: 'assessment name', weight: 250 },
  { key: 'description', label: 'catalogue description', weight: 150 },
  { key: 'category', label: 'catalogue category', weight: 60 },
]);

const CLINICAL_CONCEPTS = Object.freeze([
  {
    key: 'copd',
    label: 'COPD',
    aliases: [
      'copd',
      'chronic obstructive pulmonary disease',
      'chronic obstructive lung disease',
      'chronic airflow limitation',
    ],
  },
  {
    key: 'osteoarthritis',
    label: 'osteoarthritis',
    aliases: [
      'osteoarthritis',
      'osteo arthritis',
      'oa',
      'degenerative joint disease',
      'degenerative arthritis',
    ],
  },
  {
    key: 'hypertension',
    label: 'hypertension / high blood pressure',
    aliases: [
      'hypertension',
      'high blood pressure',
      'high bp',
      'elevated blood pressure',
      'blood pressure',
      'bp',
    ],
  },
  {
    key: 'dyslipidaemia',
    label: 'dyslipidaemia / high cholesterol',
    aliases: [
      'dyslipidaemia',
      'dyslipidemia',
      'hyperlipidaemia',
      'hyperlipidemia',
      'hypercholesterolaemia',
      'hypercholesterolemia',
      'high cholesterol',
      'cholesterol',
      'blood lipids',
      'lipid profile',
      'lipids',
      'lipid',
    ],
  },
]);

const NON_SPECIFIC_TOKENS = new Set([
  'and',
  'condition',
  'conditions',
  'disease',
  'disorder',
  'issue',
  'issues',
  'left',
  'recent',
  'right',
  'stage',
  'syndrome',
  'the',
  'type',
  'unspecified',
  'with',
  'without',
]);

const BROAD_SINGLE_TOKENS = new Set([
  'acute',
  'chronic',
  'function',
  'functional',
  'high',
  'history',
  'injury',
  'low',
  'mobility',
  'pain',
  'rehabilitation',
  'risk',
  'strength',
]);

const HYPERTENSION_QUALIFIERS = new Set([
  'gestational',
  'intracranial',
  'ocular',
  'portal',
  'pulmonary',
  'renovascular',
]);

const BODY_REGION_ALIASES = Object.freeze([
  { key: 'ankle', aliases: ['ankle'] },
  { key: 'cervical', aliases: ['cervical', 'neck'] },
  { key: 'elbow', aliases: ['elbow'] },
  { key: 'foot', aliases: ['foot', 'feet'] },
  { key: 'hand', aliases: ['hand', 'finger', 'thumb'] },
  { key: 'hip', aliases: ['hip'] },
  { key: 'knee', aliases: ['knee', 'patella', 'patellofemoral'] },
  { key: 'lumbar', aliases: ['lumbar', 'low back', 'lower back'] },
  { key: 'shoulder', aliases: ['shoulder'] },
  { key: 'thoracic', aliases: ['thoracic', 'upper back'] },
  { key: 'wrist', aliases: ['wrist'] },
]);

const ASSESSMENT_SEARCH_FIELDS = Object.freeze([
  'canonical_id',
  'id',
  'name',
  'aliases',
  'search_tags',
  'source_variants',
  'description',
  'category',
  'instructions',
  'conditions_indicated',
  'target_conditions',
  'indications',
]);

export function normalizeClinicalText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function searchableValues(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((entry) => searchableValues(entry, depth + 1));
  if (typeof value !== 'object') return [];
  return Object.values(value).flatMap((entry) => searchableValues(entry, depth + 1));
}

/**
 * Searches the complete canonical catalogue through one deterministic
 * production path. Record order is preserved; identity/deduplication remains
 * the registry's responsibility rather than a UI-side name heuristic.
 */
export function searchAssessments({ assessments = [], query = '' } = {}) {
  if (!Array.isArray(assessments)) return [];
  const normalizedQuery = normalizeClinicalText(query);
  if (!normalizedQuery) return [...assessments];
  return assessments.filter((assessment) => ASSESSMENT_SEARCH_FIELDS.some((field) => (
    searchableValues(assessment?.[field]).some((value) => (
      normalizeClinicalText(value).includes(normalizedQuery)
    ))
  )));
}

function containsPhrase(normalizedText, normalizedPhrase) {
  if (!normalizedText || !normalizedPhrase) return false;
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}

const NORMALIZED_CONCEPTS = CLINICAL_CONCEPTS.map((concept) => ({
  ...concept,
  aliases: concept.aliases.map(normalizeClinicalText),
}));

const NORMALIZED_BODY_REGIONS = BODY_REGION_ALIASES.map((region) => ({
  ...region,
  aliases: region.aliases.map(normalizeClinicalText),
}));

function conceptsFor(normalizedText) {
  const concepts = new Map();
  for (const concept of NORMALIZED_CONCEPTS) {
    const alias = concept.aliases.find((candidate) => containsPhrase(normalizedText, candidate));
    if (alias) concepts.set(concept.key, { ...concept, matchedAlias: alias });
  }
  return concepts;
}

function bodyRegionsFor(normalizedText) {
  const regions = new Set();
  for (const region of NORMALIZED_BODY_REGIONS) {
    if (region.aliases.some((alias) => containsPhrase(normalizedText, alias))) {
      regions.add(region.key);
    }
  }
  return regions;
}

function hasBodyRegionConflict(condition, field) {
  if (condition.bodyRegions.size === 0 || field.bodyRegions.size === 0) return false;
  return ![...condition.bodyRegions].some((region) => field.bodyRegions.has(region));
}

function isQualifiedHypertension(normalizedText) {
  const qualifierTerms = normalizedText.split(' ');
  const hasQualifier = qualifierTerms.some((term) => HYPERTENSION_QUALIFIERS.has(term));
  if (!hasQualifier) return false;
  return containsPhrase(normalizedText, 'hypertension')
    || containsPhrase(normalizedText, 'high blood pressure');
}

function meaningfulTokens(normalizedText) {
  return [...new Set(normalizedText
    .split(' ')
    .filter((token) => token.length >= 3 || token === 'oa' || token === 'bp')
    .filter((token) => !NON_SPECIFIC_TOKENS.has(token)))];
}

function preparePhrase(value) {
  const raw = String(value ?? '').trim();
  const normalized = normalizeClinicalText(raw);
  return {
    raw,
    normalized,
    concepts: conceptsFor(normalized),
    bodyRegions: bodyRegionsFor(normalized),
    meaningfulTokens: meaningfulTokens(normalized),
    qualifiedHypertension: isQualifiedHypertension(normalized),
  };
}

function comparePhrases(condition, field) {
  if (!condition.normalized || !field.normalized) return null;
  if (hasBodyRegionConflict(condition, field)) return null;

  // Generic systemic hypertension is not the same condition as pulmonary,
  // portal, intracranial or other explicitly qualified hypertension.
  if (
    condition.concepts.has('hypertension')
    && !condition.qualifiedHypertension
    && field.qualifiedHypertension
  ) {
    return null;
  }

  if (condition.normalized === field.normalized) {
    return {
      quality: 120,
      matchedTerm: field.raw || condition.raw,
    };
  }

  for (const [conceptKey, conditionConcept] of condition.concepts) {
    const fieldConcept = field.concepts.get(conceptKey);
    if (!fieldConcept) continue;

    const regionBonus = condition.bodyRegions.size > 0 && field.bodyRegions.size > 0 ? 12 : 0;
    return {
      quality: 104 + regionBonus,
      matchedTerm: conditionConcept.label,
    };
  }

  const fieldTokens = new Set(field.meaningfulTokens);
  const overlap = condition.meaningfulTokens.filter((token) => fieldTokens.has(token));
  if (overlap.length === 0) return null;

  const allConditionTokensMatch = overlap.length === condition.meaningfulTokens.length;
  if (condition.meaningfulTokens.length >= 2 && allConditionTokensMatch) {
    return {
      quality: 92,
      matchedTerm: overlap.join(' '),
    };
  }

  if (overlap.length >= 2) {
    return {
      quality: 74 + Math.round((overlap.length / condition.meaningfulTokens.length) * 10),
      matchedTerm: overlap.join(' '),
    };
  }

  const [singleToken] = overlap;
  if (!BROAD_SINGLE_TOKENS.has(singleToken)) {
    return {
      quality: 62,
      matchedTerm: singleToken,
    };
  }

  return null;
}

function valuesForField(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => valuesForField(item));
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  return [];
}

function conditionName(condition) {
  if (typeof condition === 'string') return condition;
  if (!condition || typeof condition !== 'object') return '';
  return condition.name || condition.condition_name || condition.label || '';
}

function prepareConditions(conditions) {
  const unique = new Map();
  for (const condition of Array.isArray(conditions) ? conditions : []) {
    const name = String(conditionName(condition)).trim();
    const prepared = preparePhrase(name);
    if (!prepared.normalized || unique.has(prepared.normalized)) continue;
    unique.set(prepared.normalized, { ...prepared, name });
  }
  return [...unique.values()];
}

function existingIdSet(existingAssessmentIds) {
  const ids = new Set();
  if (!existingAssessmentIds || typeof existingAssessmentIds[Symbol.iterator] !== 'function') return ids;

  for (const entry of existingAssessmentIds) {
    const id = entry && typeof entry === 'object'
      ? entry.assessment_id ?? entry.id
      : entry;
    if (id !== undefined && id !== null) ids.add(String(id));
  }
  return ids;
}

function reasonFor(match) {
  const condition = match.condition.name;
  const term = match.comparison.matchedTerm;
  if (match.field.key === 'conditions_indicated' || match.field.key === 'indications') {
    return `Matched ${condition} to the catalogue indication “${term}”.`;
  }
  if (match.field.key === 'target_conditions') {
    return `Matched ${condition} to the assessment's target condition “${term}”.`;
  }
  if (match.field.key === 'search_tags') {
    return `Matched ${condition} to the catalogue search tag “${term}”.`;
  }
  if (match.field.key === 'name') {
    return `Matched ${condition} because the assessment name references “${term}”.`;
  }
  if (match.field.key === 'description') {
    return `Matched ${condition} because the catalogue description references “${term}”.`;
  }
  return `Matched ${condition} through the catalogue category “${term}”.`;
}

function matchAssessment(assessment, conditions, index) {
  const matches = [];

  for (const field of FIELD_SPECS) {
    for (const value of valuesForField(assessment?.[field.key])) {
      const preparedField = preparePhrase(value);
      for (const condition of conditions) {
        const comparison = comparePhrases(condition, preparedField);
        if (!comparison) continue;
        matches.push({
          condition,
          comparison,
          field,
          // An exact canonical assessment-name query is an identity lookup,
          // not merely another clinical-text signal. Keep it ahead of broad
          // indication/tag matches when ranking the full catalogue.
          score: field.weight
            + comparison.quality
            + (field.key === 'name' && comparison.quality === 120 ? 1000 : 0),
        });
      }
    }
  }

  if (matches.length === 0) return null;
  matches.sort((left, right) => (
    right.score - left.score
    || right.field.weight - left.field.weight
    || left.condition.normalized.localeCompare(right.condition.normalized)
  ));

  const best = matches[0];
  const matchedConditionCount = new Set(matches.map((match) => match.condition.normalized)).size;
  return {
    assessment,
    index,
    nameKey: normalizeClinicalText(assessment?.name),
    idKey: normalizeClinicalText(assessment?.id),
    reason: reasonFor(best),
    score: best.score + Math.min(24, Math.max(0, matchedConditionCount - 1) * 8),
    fieldWeight: best.field.weight,
  };
}

/**
 * Finds condition-relevant assessments without a network request.
 *
 * Every catalogue row is considered, but the returned list is always capped
 * at five. Selection and ordering depend only on the supplied records, not on
 * catalogue order or provider output.
 */
export function discoverAssessments({
  conditions = [],
  assessments = [],
  existingAssessmentIds = [],
  limit = MAX_ASSESSMENT_RECOMMENDATIONS,
} = {}) {
  const preparedConditions = prepareConditions(conditions);
  if (preparedConditions.length === 0 || !Array.isArray(assessments)) return [];

  const excludedIds = existingIdSet(existingAssessmentIds);
  const requestedLimit = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : MAX_ASSESSMENT_RECOMMENDATIONS;
  const boundedLimit = Math.min(MAX_ASSESSMENT_RECOMMENDATIONS, Math.max(0, requestedLimit));
  if (boundedLimit === 0) return [];

  const ranked = assessments
    .map((assessment, index) => {
      const id = assessment?.id;
      if (id !== undefined && id !== null && excludedIds.has(String(id))) return null;
      return matchAssessment(assessment, preparedConditions, index);
    })
    .filter(Boolean)
    .sort((left, right) => (
      right.score - left.score
      || right.fieldWeight - left.fieldWeight
      || left.nameKey.localeCompare(right.nameKey)
      || left.idKey.localeCompare(right.idKey)
      || left.index - right.index
    ));

  return ranked.slice(0, boundedLimit).map(({ assessment, reason }) => ({
    ...assessment,
    reason,
  }));
}
