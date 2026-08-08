import {
  isProtocolAvailableTo,
  PROTOCOL_SUPPORT_STATUS,
  validateProtocolGovernance,
} from './governance.js';
import {
  normaliseProfession,
  normaliseProtocolQuery,
  normaliseProtocolText,
  normaliseScope,
} from './normalise.js';

export const PROTOCOL_SEARCH_STATE = Object.freeze({
  MATCHES: 'matches',
  INVALID_QUERY: 'invalid_query',
  NO_MATCH: 'no_match',
  UNSUPPORTED: 'unsupported',
  CATALOGUE_BLOCKED: 'catalogue_blocked',
});

export const DEFAULT_PROTOCOL_RESULT_LIMIT = 10;
export const MAX_PROTOCOL_RESULT_LIMIT = 25;
export const MAX_PROTOCOL_CATALOGUE_SIZE = 25_000;

function boundedLimit(value) {
  const parsed = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : DEFAULT_PROTOCOL_RESULT_LIMIT;
  return Math.min(MAX_PROTOCOL_RESULT_LIMIT, Math.max(1, parsed));
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function stableRecordId(validation) {
  const record = validation.record;
  const explicit = record?.id ?? record?.source_id ?? record?.protocol_id;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return `protocol:${validation.normalisedConditionName}:${validation.metadata?.version || 'unsupported'}`;
}

function textMatch(query, validation) {
  const fields = [
    { value: validation.normalisedConditionName, source: 'condition_name', offset: 0 },
    ...validation.normalisedAliases.map((value) => ({ value, source: 'alias', offset: 1 })),
  ];

  let best = null;
  for (const field of fields) {
    let tier = null;
    if (field.value === query.normalised) {
      tier = 0;
    } else if (field.value.startsWith(`${query.normalised} `)) {
      tier = 2;
    } else {
      const fieldTokens = field.value.split(' ').filter(Boolean);
      const everyQueryTokenMatches = query.tokens.every((queryToken) => (
        fieldTokens.some((fieldToken) => fieldToken.startsWith(queryToken))
      ));
      if (everyQueryTokenMatches) {
        tier = 4;
      } else if (field.value.includes(query.normalised)) {
        tier = 6;
      }
    }

    if (tier == null) continue;
    const candidate = {
      rank: tier + field.offset,
      kind: ['exact_name', 'exact_alias', 'prefix_name', 'prefix_alias', 'token_name', 'token_alias', 'substring_name', 'substring_alias'][tier + field.offset],
      matchedOn: field.source,
    };
    if (!best || candidate.rank < best.rank) best = candidate;
  }
  return best;
}

function sortCandidates(left, right) {
  return left.match.rank - right.match.rank
    || compareText(left.validation.normalisedConditionName, right.validation.normalisedConditionName)
    || compareText(left.validation.metadata?.version || '', right.validation.metadata?.version || '')
    || compareText(left.id, right.id);
}

function summariseInvalid(validation) {
  return Object.freeze({
    id: stableRecordId(validation),
    condition_name: validation.conditionName,
    issues: Object.freeze(validation.errors.map(({ field, code }) => Object.freeze({ field, code }))),
  });
}

function publicMatch(candidate) {
  const validation = candidate.validation;
  return Object.freeze({
    id: candidate.id,
    condition_name: validation.conditionName,
    category: typeof validation.record?.category === 'string' ? validation.record.category : 'general',
    match: Object.freeze({
      kind: candidate.match.kind,
      matched_on: candidate.match.matchedOn,
    }),
    governance: validation.metadata,
    protocol: validation.record,
  });
}

function baseResponse(state, query, catalogue) {
  return {
    state,
    query,
    catalogue: Object.freeze({
      received: catalogue.received,
      valid: catalogue.valid,
      unsupported: catalogue.unsupported,
      invalid: catalogue.invalid,
    }),
  };
}

/**
 * Deterministic, catalogue-only protocol discovery.
 *
 * The API intentionally accepts no client record or clinical narrative. It
 * returns reviewed catalogue cards only; it never creates or adapts treatment
 * advice. Callers must derive profession and scope from authenticated server
 * context rather than trusting browser claims.
 *
 * @param {{
 *   query?: unknown,
 *   catalogue?: any[],
 *   profession?: unknown,
 *   scope?: unknown,
 *   limit?: number,
 *   asOf?: unknown,
 * }} [options]
 */
export function searchProtocolCatalogue({
  query: queryInput,
  catalogue,
  profession,
  scope,
  limit = DEFAULT_PROTOCOL_RESULT_LIMIT,
  asOf,
} = {}) {
  const query = normaliseProtocolQuery(queryInput);
  const requestedProfession = normaliseProfession(profession);
  const requestedScope = normaliseScope(scope);

  if (!query.valid) {
    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.INVALID_QUERY, query, {
        received: Array.isArray(catalogue) ? catalogue.length : 0,
        valid: 0,
        unsupported: 0,
        invalid: 0,
      }),
      code: query.code,
      matches: Object.freeze([]),
    });
  }

  if (!requestedProfession || !requestedScope) {
    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.INVALID_QUERY, query, {
        received: Array.isArray(catalogue) ? catalogue.length : 0,
        valid: 0,
        unsupported: 0,
        invalid: 0,
      }),
      code: !requestedProfession ? 'profession_required' : 'scope_required',
      matches: Object.freeze([]),
    });
  }

  if (!Array.isArray(catalogue)) {
    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED, query, {
        received: 0,
        valid: 0,
        unsupported: 0,
        invalid: 0,
      }),
      code: 'catalogue_unavailable',
      matches: Object.freeze([]),
    });
  }

  if (catalogue.length > MAX_PROTOCOL_CATALOGUE_SIZE) {
    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED, query, {
        received: catalogue.length,
        valid: 0,
        unsupported: 0,
        invalid: 0,
      }),
      code: 'catalogue_limit_exceeded',
      matches: Object.freeze([]),
    });
  }

  const validated = catalogue.map((record) => validateProtocolGovernance(record, { asOf }));
  const summary = {
    received: catalogue.length,
    valid: validated.filter((entry) => entry.ok && entry.kind === PROTOCOL_SUPPORT_STATUS.SUPPORTED).length,
    unsupported: validated.filter((entry) => entry.ok && entry.kind === PROTOCOL_SUPPORT_STATUS.UNSUPPORTED).length,
    invalid: validated.filter((entry) => !entry.ok).length,
  };

  const matching = validated
    .map((validation) => ({
      validation,
      id: stableRecordId(validation),
      match: textMatch(query, validation),
    }))
    .filter((candidate) => candidate.match)
    .sort(sortCandidates);

  const eligible = matching.filter(({ validation }) => isProtocolAvailableTo(validation, {
    profession: requestedProfession,
    scope: requestedScope,
  }));

  if (eligible.length > 0) {
    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.MATCHES, query, summary),
      code: null,
      matches: Object.freeze(eligible.slice(0, boundedLimit(limit)).map(publicMatch)),
    });
  }

  const explicitlyUnsupported = matching.filter(({ validation }) => (
    validation.ok && validation.kind === PROTOCOL_SUPPORT_STATUS.UNSUPPORTED
  ));
  const outOfScope = matching.filter(({ validation }) => (
    validation.ok
    && validation.kind === PROTOCOL_SUPPORT_STATUS.SUPPORTED
    && !isProtocolAvailableTo(validation, { profession: requestedProfession, scope: requestedScope })
  ));

  if (explicitlyUnsupported.length > 0 || outOfScope.length > 0) {
    const reasons = [
      ...explicitlyUnsupported.map(({ validation }) => Object.freeze({
        condition_name: validation.conditionName,
        code: 'explicitly_unsupported',
        reason: 'unsupportedReason' in validation
          ? validation.unsupportedReason
          : 'The catalogue explicitly marks this topic as unsupported.',
      })),
      ...outOfScope.map(({ validation }) => Object.freeze({
        condition_name: validation.conditionName,
        code: (
          'metadata' in validation
          && validation.metadata.professions.includes(requestedProfession)
        )
          ? 'scope_out_of_bounds'
          : 'profession_out_of_bounds',
        reason: 'No approved catalogue card is available for the authenticated professional context.',
      })),
    ];

    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.UNSUPPORTED, query, summary),
      code: reasons[0].code,
      reasons: Object.freeze(reasons.slice(0, boundedLimit(limit))),
      matches: Object.freeze([]),
    });
  }

  const blocked = matching.filter(({ validation }) => !validation.ok);
  if (blocked.length > 0) {
    return Object.freeze({
      ...baseResponse(PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED, query, summary),
      code: 'matching_catalogue_entry_failed_governance',
      blocked: Object.freeze(blocked.slice(0, boundedLimit(limit)).map(({ validation }) => summariseInvalid(validation))),
      matches: Object.freeze([]),
    });
  }

  return Object.freeze({
    ...baseResponse(PROTOCOL_SEARCH_STATE.NO_MATCH, query, summary),
    code: 'no_reviewed_match',
    matches: Object.freeze([]),
  });
}

/** Return all field-level migration defects without making any item searchable. */
export function auditProtocolCatalogue(catalogue, options = {}) {
  if (!Array.isArray(catalogue)) {
    return Object.freeze({ ok: false, code: 'catalogue_unavailable', entries: Object.freeze([]) });
  }

  const entries = catalogue.map((record) => validateProtocolGovernance(record, options));
  return Object.freeze({
    ok: entries.every((entry) => entry.ok),
    code: entries.every((entry) => entry.ok) ? null : 'catalogue_governance_incomplete',
    entries: Object.freeze(entries),
  });
}

export function protocolCatalogueKey(record) {
  return normaliseProtocolText(record?.condition_name);
}
