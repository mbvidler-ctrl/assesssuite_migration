import { findPotentialDuplicates } from './clientDuplicates.js';

const REFERRAL_CLIENT_FIELDS = Object.freeze([
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'email',
  'address',
  'referral_source',
  'referral_source_name',
  'referral_source_address',
  'referral_source_email',
  'referral_provider_number',
  'referral_reason',
  'referral_date',
  'funding_source',
  'medicare_number',
  'medicare_irn',
  'medicare_referral_type',
  'dva_card_number',
  'dva_card_type',
  'dva_file_number',
  'dva_accepted_conditions',
  'ndis_number',
  'ndis_goals',
  'private_health_fund_name',
  'private_health_fund_number',
  'workcover_claim_number',
  'workcover_date_of_injury',
  'workcover_injury_description',
  'primary_gp_name',
  'primary_gp_clinic_name',
  'primary_gp_address',
  'primary_gp_phone',
  'primary_gp_email',
  'primary_gp_provider_number',
  'client_goals',
]);

function cleanScalar(value) {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Convert a provider list value into the line-oriented representation used by
 * the mandatory review UI. Commas remain intact because medication names and
 * condition descriptions can legitimately contain them.
 */
export function formatReferralReviewList(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim())
      .join('\n');
  }
  return typeof value === 'string' ? value : '';
}

/** Return one reviewed condition or medication per non-empty line. */
export function parseReferralReviewList(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/);
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const clean = item.trim();
    const key = clean.toLocaleLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
  }
  return normalized;
}

/**
 * Normalise provider output before presenting it. Arrays become editable
 * line-oriented text, while every other extracted key remains available to
 * the controlled review form.
 */
export function prepareReferralReviewData(output) {
  const source = output && typeof output === 'object' && !Array.isArray(output) ? output : {};
  return {
    ...source,
    comorbidities: formatReferralReviewList(source.comorbidities),
    medications: formatReferralReviewList(source.medications),
  };
}

/**
 * Select only fields that belong on the Client record. Conditions,
 * medications and the medical-history narrative are persisted through
 * ClientCondition rows so downstream clinical views can display them.
 */
export function buildReferralClientData(reviewData) {
  const source = reviewData && typeof reviewData === 'object' ? reviewData : {};
  return Object.fromEntries(
    REFERRAL_CLIENT_FIELDS.flatMap((field) => {
      const value = cleanScalar(source[field]);
      return value === undefined || value === null || value === '' ? [] : [[field, value]];
    }),
  );
}

/** Build ClientCondition rows exclusively from the final reviewed values. */
export function buildReferralConditionData(reviewData) {
  const source = reviewData && typeof reviewData === 'object' ? reviewData : {};
  const conditions = [];
  const primaryCondition = cleanScalar(source.primary_condition);
  if (typeof primaryCondition === 'string' && primaryCondition) {
    conditions.push({
      condition_name: primaryCondition,
      condition_type: 'primary',
    });
  }
  for (const conditionName of parseReferralReviewList(source.comorbidities)) {
    conditions.push({
      condition_name: conditionName,
      condition_type: 'comorbidity',
    });
  }
  for (const medication of parseReferralReviewList(source.medications)) {
    conditions.push({
      condition_name: 'Medication',
      condition_type: 'comorbidity',
      medication,
    });
  }
  const medicalHistory = cleanScalar(source.medical_history);
  if (typeof medicalHistory === 'string' && medicalHistory) {
    conditions.push({
      condition_name: 'Relevant medical history',
      condition_type: 'comorbidity',
      notes: medicalHistory,
    });
  }
  return conditions;
}

/**
 * Suggest duplicates only within the selected practice. Name and date of birth
 * must both match; this remains a review aid and never auto-selects a client.
 */
export function findReferralClientMatches(reviewData, clients, orgId) {
  if (!orgId || !Array.isArray(clients)) return [];
  const tenantClients = clients.filter((client) => client?.org_id === orgId);
  return findPotentialDuplicates(reviewData, tenantClients);
}

export { REFERRAL_CLIENT_FIELDS };
