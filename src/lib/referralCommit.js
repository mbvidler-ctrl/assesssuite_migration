import { REFERRAL_CLIENT_FIELDS } from './referralReview.js';

export const REFERRAL_REVIEW_COMMIT_VERSION = 'referral-review-commit-v2026-07-21.1';

const FUNCTION_NAME = 'commitReviewedReferral';
const REVIEWED_CLIENT_FIELDS = new Set(REFERRAL_CLIENT_FIELDS);
const UNCONFIRMED_COMMIT_DETAILS = 'The save result could not be confirmed. Retry this same review; AssessSuite will safely return the original result if it was already saved.';

function commitFailureStatus(error) {
  const candidates = [
    error?.status,
    error?.response?.status,
    error?.originalError?.response?.status,
  ];
  for (const candidate of candidates) {
    const status = Number(candidate);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  return null;
}

function isUncertainCommitFailure(error) {
  const status = commitFailureStatus(error);
  return status === null || status >= 500;
}

function unconfirmedCommitError() {
  return Object.assign(
    new Error('The reviewed referral save result could not be confirmed.'),
    {
      data: {
        code: 'unconfirmed_referral_commit_result',
        details: UNCONFIRMED_COMMIT_DETAILS,
      },
    },
  );
}

/**
 * @typedef {object} ReviewedReferralCommitPayload
 * @property {string} idempotency_key
 * @property {string} org_id
 * @property {'create'|'update'} operation
 * @property {string|null} client_id
 * @property {true} review_confirmed
 * @property {string} review_version
 * @property {Record<string, any>} client
 * @property {Array<{condition_name: any, condition_type: any, medication?: any, notes?: any}>} conditions
 * @property {string[]} upload_ids
 * @property {[]} historical_assessments
 */

/**
 * Create the client-generated key for one reviewed extraction. Callers retain
 * this value across retries and replace it only when that review is abandoned
 * or a new extraction is opened.
 */
export function createReferralCommitIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('A secure referral commit identifier could not be created.');
  }
  return globalThis.crypto.randomUUID();
}

/**
 * Build the narrow server contract from practitioner-reviewed values only.
 * Historical assessment scanning remains deliberately disabled for this
 * release, so callers cannot accidentally stage provider-derived results.
 *
 * @param {{
 *   idempotencyKey: string,
 *   orgId: string,
 *   operation: 'create'|'update',
 *   clientId?: string|null,
 *   client?: Record<string, any>,
 *   conditions?: Array<Record<string, any>>,
 *   uploadIds?: string[],
 * }} input
 * @returns {ReviewedReferralCommitPayload}
 */
export function buildReviewedReferralCommitPayload({
  idempotencyKey,
  orgId,
  operation,
  clientId = null,
  client,
  conditions = [],
  uploadIds,
}) {
  return {
    idempotency_key: idempotencyKey,
    org_id: orgId,
    operation,
    client_id: operation === 'update' ? clientId : null,
    review_confirmed: true,
    review_version: REFERRAL_REVIEW_COMMIT_VERSION,
    client: Object.fromEntries(
      Object.entries(client || {}).filter(([field]) => REVIEWED_CLIENT_FIELDS.has(field)),
    ),
    conditions: conditions.map((condition) => ({
      condition_name: condition.condition_name,
      condition_type: condition.condition_type,
      ...(condition.medication ? { medication: condition.medication } : {}),
      ...(condition.notes ? { notes: condition.notes } : {}),
    })),
    upload_ids: [...(uploadIds || [])],
    historical_assessments: [],
  };
}

/**
 * Invoke the atomic server boundary and unwrap the installed SDK envelope.
 *
 * @param {any} base44Client
 * @param {ReviewedReferralCommitPayload} payload
 * @returns {Promise<{status: 'success', operation: 'create'|'update', client_id: string, counts?: Record<string, number>}>}
 */
export async function commitReviewedReferral(base44Client, payload) {
  let response;
  try {
    response = await base44Client.functions.invoke(FUNCTION_NAME, payload);
  } catch (error) {
    if (!isUncertainCommitFailure(error)) throw error;
    // A response can be lost after the atomic transaction commits. Repeating
    // the exact payload and key is a receipt lookup, not a second clinical
    // write, and resolves the common uncertain-transport case before the UI
    // makes any claim about persistence.
    try {
      response = await base44Client.functions.invoke(FUNCTION_NAME, payload);
    } catch (reconciliationError) {
      // A second uncertain failure cannot distinguish a committed receipt from
      // a request that never arrived. Replace every upstream detail with the
      // controlled unconfirmed-result contract so the UI never makes a false
      // claim about whether clinical data changed.
      if (isUncertainCommitFailure(reconciliationError)) {
        throw unconfirmedCommitError();
      }
      throw reconciliationError;
    }
  }
  const result = response?.data ?? response;
  if (
    result?.status !== 'success'
    || !['create', 'update'].includes(result.operation)
    || typeof result.client_id !== 'string'
    || !result.client_id
  ) {
    const error = unconfirmedCommitError();
    error.data.code = 'invalid_referral_commit_response';
    throw error;
  }
  return result;
}
