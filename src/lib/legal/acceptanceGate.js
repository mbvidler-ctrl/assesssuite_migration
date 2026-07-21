import {
  CONTRACT_BUNDLE_IDS,
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
  fingerprint,
  isLegalDocumentPublicationApproved,
} from './documentRegistry.js';
import { effectiveLegalContent } from './effectiveContent.js';
import { resolveLegalConsentAudience } from './consentAudience.js';

function matchesCurrentReceipt(event, required, orgId) {
  return event?.org_id === orgId
    && event?.suite_version === required.suiteVersion
    && event?.event_type === required.eventType
    && event?.document_id === required.documentId
    && event?.document_title === required.documentTitle
    && event?.document_fingerprint === required.documentFingerprint;
}

/**
 * Build the exact document-bound receipts required by the server gate.
 * `readContent` is injected so the browser can use Vite's eager legal-content
 * loader while Node assurance tests can read the same controlled files.
 *
 * @param {object} params
 * @param {boolean} params.ownerBundle
 * @param {{status?: string, effective_date?: string|null}} [params.legalSettings]
 * @param {(filename: string) => string} params.readContent
 */
export function currentLegalReceiptRequirements({
  ownerBundle,
  legalSettings = {},
  readContent,
}) {
  if (typeof readContent !== 'function') {
    throw new Error('A legal content reader is required.');
  }
  const documentIds = ownerBundle
    ? [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]
    : [...PRACTITIONER_NOTICE_IDS];
  const status = legalSettings?.status === 'effective' ? 'effective' : 'rc';
  const effectiveDate = legalSettings?.effective_date || null;

  return documentIds.map((documentId) => {
    const document = LEGAL_DOCUMENTS[documentId];
    if (!document?.eventType || !isLegalDocumentPublicationApproved(document)) {
      throw new Error(`Mandatory legal document is unavailable: ${documentId}`);
    }
    const raw = readContent(document.file);
    const presented = effectiveLegalContent(raw, { status, effectiveDate });
    return {
      eventType: document.eventType,
      suiteVersion: SUITE_VERSION,
      documentId,
      documentTitle: document.title,
      documentFingerprint: fingerprint(presented),
    };
  });
}

/**
 * Browser-side parity check for server/index.mjs hasCurrentLegalAcceptance.
 * Any missing context or content-loader failure is fail-closed.
 *
 * @param {object} params
 * @param {Array<Record<string, any>>} params.events
 * @param {string} params.orgId
 * @param {boolean} params.ownerBundle
 * @param {{status?: string, effective_date?: string|null}} [params.legalSettings]
 * @param {(filename: string) => string} params.readContent
 */
export function hasCurrentLegalAcceptance({
  events,
  orgId,
  ownerBundle,
  legalSettings,
  readContent,
}) {
  if (!Array.isArray(events) || !orgId) return false;

  let requirements;
  try {
    requirements = currentLegalReceiptRequirements({
      ownerBundle: ownerBundle === true,
      legalSettings,
      readContent,
    });
  } catch {
    return false;
  }

  return requirements.every((required) => (
    events.some((event) => matchesCurrentReceipt(event, required, orgId))
  ));
}

/**
 * Exact acceptance status for the practice selected by a referral workflow.
 * A receipt for another membership never satisfies this check. The status
 * includes missing document IDs so the UI can route to a precise re-acceptance
 * screen without weakening the server's independent extraction gate.
 */
export function selectedOrganizationLegalAcceptanceStatus({
  events,
  memberships,
  orgId,
  legalSettings,
  readContent,
}) {
  const audience = resolveLegalConsentAudience(memberships, orgId);
  if (!orgId || audience.willCreateOrganization || audience.orgId !== orgId) {
    return {
      accepted: false,
      orgId: orgId || null,
      ownerBundle: false,
      missingDocumentIds: [],
      reason: 'membership_missing',
    };
  }

  let requirements;
  try {
    requirements = currentLegalReceiptRequirements({
      ownerBundle: audience.ownerBundle,
      legalSettings,
      readContent,
    });
  } catch {
    return {
      accepted: false,
      orgId,
      ownerBundle: audience.ownerBundle,
      missingDocumentIds: [],
      reason: 'legal_content_unavailable',
    };
  }

  const safeEvents = Array.isArray(events) ? events : [];
  const missingDocumentIds = requirements
    .filter((required) => !safeEvents.some((event) => matchesCurrentReceipt(event, required, orgId)))
    .map((required) => required.documentId);
  return {
    accepted: missingDocumentIds.length === 0,
    orgId,
    ownerBundle: audience.ownerBundle,
    missingDocumentIds,
    reason: missingDocumentIds.length === 0 ? null : 'acceptance_required',
  };
}
