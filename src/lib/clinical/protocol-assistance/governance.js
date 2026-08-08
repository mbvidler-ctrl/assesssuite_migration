import {
  normaliseProfession,
  normaliseProtocolText,
  normaliseScope,
} from './normalise.js';

export const PROTOCOL_SUPPORT_STATUS = Object.freeze({
  SUPPORTED: 'supported',
  UNSUPPORTED: 'unsupported',
});

const RIGHTS_STATUSES = new Set([
  'internal_original',
  'licensed',
  'open',
  'owned',
  'permission',
  'public_domain',
]);

const APPROVED_STATUSES = new Set(['active', 'approved', 'reviewed']);

function issue(field, code, message) {
  return Object.freeze({ field, code, message });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function asNonEmptyStrings(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.filter(isNonEmptyString).map((item) => item.trim());
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normaliseDateOption(value) {
  return isIsoDate(value) ? value : currentIsoDate();
}

function sourceIsTraceable(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;

  const hasDescription = ['title', 'citation', 'name'].some((key) => isNonEmptyString(source[key]));
  const hasLocator = ['url', 'doi', 'reference_id', 'source_id'].some((key) => isNonEmptyString(source[key]));
  return hasDescription && hasLocator;
}

function extractScopeValues(scope) {
  if (isNonEmptyString(scope)) return [scope];
  if (Array.isArray(scope)) return scope.flatMap(extractScopeValues);
  if (!scope || typeof scope !== 'object') return [];

  return [
    ...asNonEmptyStrings(scope.code),
    ...asNonEmptyStrings(scope.codes),
    ...asNonEmptyStrings(scope.domain),
    ...asNonEmptyStrings(scope.domains),
    ...asNonEmptyStrings(scope.statement),
  ];
}

function managementTargetValue(target) {
  if (isNonEmptyString(target)) return target.trim();
  if (!target || typeof target !== 'object' || Array.isArray(target)) return '';

  return ['label', 'name', 'code', 'domain']
    .map((key) => target[key])
    .find(isNonEmptyString)
    ?.trim() || '';
}

function rightsBasis(rights) {
  if (!rights || typeof rights !== 'object' || Array.isArray(rights)) return '';
  return ['licence', 'license', 'notice', 'holder', 'terms', 'url']
    .map((key) => rights[key])
    .find(isNonEmptyString)
    ?.trim() || '';
}

function getGovernance(record) {
  const nested = record?.governance;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? { ...record, ...nested }
    : record;
}

function supportStatusOf(record, governance) {
  if (record?.supported === false || governance?.supported === false) {
    return PROTOCOL_SUPPORT_STATUS.UNSUPPORTED;
  }

  const raw = governance?.support_status ?? record?.support_status;
  return normaliseProtocolText(raw) === PROTOCOL_SUPPORT_STATUS.UNSUPPORTED
    ? PROTOCOL_SUPPORT_STATUS.UNSUPPORTED
    : PROTOCOL_SUPPORT_STATUS.SUPPORTED;
}

/**
 * Validate the minimum release-governance metadata for a reviewed protocol.
 * Legacy Base44 rows are not silently grandfathered: a missing field blocks
 * the card until it is deliberately enriched and reviewed.
 */
export function validateProtocolGovernance(record, options = {}) {
  const errors = [];
  const warnings = [];
  const governance = getGovernance(record);
  const conditionName = isNonEmptyString(record?.condition_name)
    ? record.condition_name.trim()
    : '';
  const aliases = asNonEmptyStrings(record?.aliases);
  const supportStatus = supportStatusOf(record, governance);

  if (!conditionName) {
    errors.push(issue('condition_name', 'required', 'A catalogue condition name is required.'));
  }

  if (supportStatus === PROTOCOL_SUPPORT_STATUS.UNSUPPORTED) {
    const reason = governance?.unsupported_reason ?? record?.unsupported_reason;
    if (!isNonEmptyString(reason)) {
      errors.push(issue(
        'unsupported_reason',
        'required',
        'An explicit reason is required for an unsupported catalogue topic.',
      ));
    }

    return Object.freeze({
      ok: errors.length === 0,
      kind: PROTOCOL_SUPPORT_STATUS.UNSUPPORTED,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      conditionName,
      normalisedConditionName: normaliseProtocolText(conditionName),
      aliases: Object.freeze(aliases),
      normalisedAliases: Object.freeze(aliases.map(normaliseProtocolText).filter(Boolean)),
      unsupportedReason: isNonEmptyString(reason) ? reason.trim() : '',
      record,
    });
  }

  const professions = asNonEmptyStrings(governance?.profession).map(normaliseProfession).filter(Boolean);
  if (professions.length === 0) {
    errors.push(issue('profession', 'required', 'At least one authorised profession is required.'));
  }

  const scopeValues = extractScopeValues(governance?.scope);
  const scopes = scopeValues.map(normaliseScope).filter(Boolean);
  if (scopes.length === 0) {
    errors.push(issue('scope', 'required', 'A bounded professional scope is required.'));
  }

  const sources = Array.isArray(governance?.source)
    ? governance.source
    : governance?.source == null
      ? []
      : [governance.source];
  if (sources.length === 0 || !sources.every(sourceIsTraceable)) {
    errors.push(issue(
      'source',
      'traceable_source_required',
      'Each protocol requires at least one traceable source with a description and locator.',
    ));
  }

  const reviewer = governance?.reviewer;
  if (!reviewer || typeof reviewer !== 'object' || Array.isArray(reviewer)) {
    errors.push(issue('reviewer', 'required', 'A named reviewer record is required.'));
  } else {
    if (!isNonEmptyString(reviewer.name)) {
      errors.push(issue('reviewer.name', 'required', 'Reviewer name is required.'));
    }
    if (!isNonEmptyString(reviewer.credentials)) {
      errors.push(issue('reviewer.credentials', 'required', 'Reviewer credentials are required.'));
    }
    if (!isIsoDate(reviewer.reviewed_at)) {
      errors.push(issue('reviewer.reviewed_at', 'invalid_date', 'Review date must be an ISO date.'));
    }
  }

  const version = governance?.version;
  if (!isNonEmptyString(version)) {
    errors.push(issue('version', 'required', 'A controlled protocol version is required.'));
  }

  const expiry = governance?.expiry;
  if (!isIsoDate(expiry)) {
    errors.push(issue('expiry', 'invalid_date', 'Expiry must be a valid ISO date.'));
  } else if (expiry < normaliseDateOption(options.asOf)) {
    errors.push(issue('expiry', 'expired', 'The protocol review period has expired.'));
  }

  const rights = governance?.rights;
  const rightsStatus = normaliseProtocolText(rights?.status).replace(/\s+/g, '_');
  if (!rights || typeof rights !== 'object' || Array.isArray(rights)) {
    errors.push(issue('rights', 'required', 'Rights metadata is required.'));
  } else if (!RIGHTS_STATUSES.has(rightsStatus)) {
    errors.push(issue('rights.status', 'unverified', 'Rights status is absent or not an approved value.'));
  } else if (!rightsBasis(rights)) {
    errors.push(issue('rights.basis', 'required', 'Rights metadata requires a licence, holder, notice, terms or URL.'));
  }

  const managementTarget = managementTargetValue(governance?.management_target);
  if (!managementTarget) {
    errors.push(issue(
      'management_target',
      'required',
      'The bounded functional or risk-management target is required.',
    ));
  }

  const approvalStatus = governance?.approval_status;
  if (approvalStatus != null) {
    const normalisedApprovalStatus = normaliseProtocolText(approvalStatus).replace(/\s+/g, '_');
    if (!APPROVED_STATUSES.has(normalisedApprovalStatus)) {
      errors.push(issue('approval_status', 'not_approved', 'The protocol is not approved for catalogue use.'));
    }
  }

  if (isIsoDate(expiry)) {
    const expiryTime = Date.parse(`${expiry}T00:00:00.000Z`);
    const asOf = normaliseDateOption(options.asOf);
    const asOfTime = Date.parse(`${asOf}T00:00:00.000Z`);
    const daysRemaining = Math.floor((expiryTime - asOfTime) / 86_400_000);
    if (daysRemaining >= 0 && daysRemaining <= 30) {
      warnings.push(issue('expiry', 'review_due', 'The protocol review period expires within 30 days.'));
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    kind: PROTOCOL_SUPPORT_STATUS.SUPPORTED,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    conditionName,
    normalisedConditionName: normaliseProtocolText(conditionName),
    aliases: Object.freeze(aliases),
    normalisedAliases: Object.freeze(aliases.map(normaliseProtocolText).filter(Boolean)),
    metadata: Object.freeze({
      professions: Object.freeze([...new Set(professions)]),
      scopes: Object.freeze([...new Set(scopes)]),
      sources: Object.freeze(sources),
      reviewer,
      version: isNonEmptyString(version) ? version.trim() : '',
      expiry: isIsoDate(expiry) ? expiry : '',
      rights,
      managementTarget,
      approvalStatus: isNonEmptyString(approvalStatus) ? approvalStatus.trim() : 'reviewed',
    }),
    record,
  });
}

export function isProtocolAvailableTo(validation, { profession, scope }) {
  if (!validation?.ok || validation.kind !== PROTOCOL_SUPPORT_STATUS.SUPPORTED) return false;
  const requestedProfession = normaliseProfession(profession);
  const requestedScope = normaliseScope(scope);
  if (!requestedProfession || !requestedScope) return false;

  return validation.metadata.professions.includes(requestedProfession)
    && validation.metadata.scopes.includes(requestedScope);
}
