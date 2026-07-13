// Single source of truth for every legal instrument served by the app.
//
// This exists to fix a real defect: the previous LegalAcceptanceModal hardcoded
// its own version string ("2.1.0") independently of the record it wrote,
// which drifted and caused an infinite re-acceptance loop (see the note in the
// old Layout.jsx). Every acceptance check and every content page must read
// version/title/status from here — never re-declare it locally.
//
// Content source: verbatim copies of the approved AssessSuite policy suite
// (Unimatter/02_Client_and_Venture_Matters/AssessSuite/work-product/
// policy-suite-20260711/), version RC-2026.07.11, under src/legal-content/.
// Do not hand-edit the copied .md files independently of that source — if the
// suite changes, re-copy the file and bump SUITE_VERSION below.

export const SUITE_VERSION = 'RC-2026.07.11';

// Matches doc 00's release-candidate boundary. This is deliberately verbatim
// from the suite's own header line for each instrument, not paraphrased.
export const SUITE_STATUS_BANNER =
  'RELEASE CANDIDATE — NOT APPROVED, EFFECTIVE OR PUBLISHED. This document is shown for release-readiness review and testing only.';

// event types written to LegalAcceptanceEvent — see server/local-entity-schemas.json
export const EVENT_TYPES = {
  CONTRACT_ACCEPTANCE: 'contract_acceptance',
  COLLECTION_NOTICE_ACKNOWLEDGEMENT: 'collection_notice_acknowledgement',
  PROFESSIONAL_USE_ACKNOWLEDGEMENT: 'professional_use_acknowledgement',
  AI_TRANSPARENCY_CONSENT: 'ai_transparency_consent',
  MARKETING_CONSENT: 'marketing_consent',
  RECORDING_CONSENT: 'recording_consent',
};

// id -> { title, slug, file, releaseStatus, publicRoute, eventType }
// publicRoute: true if this should be reachable, logged out, at /legal/<slug>.
// eventType: the LegalAcceptanceEvent type this document is bound to when
// shown as part of an acceptance flow (undefined for pure-reference docs).
export const LEGAL_DOCUMENTS = {
  terms: {
    title: 'AssessSuite Practitioner and Clinic SaaS Terms',
    slug: 'terms',
    file: '02_practitioner_and_clinic_saas_terms.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
    eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
  },
  privacy: {
    title: 'AssessSuite Privacy Policy',
    slug: 'privacy',
    file: '03_privacy_policy.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
  },
  'clinical-use-notice': {
    title: 'AssessSuite Clinical Use and Professional Responsibility Notice',
    slug: 'clinical-use-notice',
    file: '04_clinical_use_and_professional_responsibility_notice.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
    eventType: EVENT_TYPES.PROFESSIONAL_USE_ACKNOWLEDGEMENT,
  },
  'ai-notice': {
    title: 'AssessSuite AI and Automated Processing Transparency Notice',
    slug: 'ai-notice',
    file: '05_ai_and_automated_processing_transparency_notice.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
    eventType: EVENT_TYPES.AI_TRANSPARENCY_CONSENT,
  },
  'collection-notice': {
    title: 'AssessSuite Practitioner Account Collection Notice',
    slug: 'collection-notice',
    file: '06_practitioner_account_collection_notice.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
    eventType: EVENT_TYPES.COLLECTION_NOTICE_ACKNOWLEDGEMENT,
  },
  aup: {
    title: 'AssessSuite Acceptable Use Policy',
    slug: 'acceptable-use',
    file: '07_acceptable_use_policy.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
  },
  subscription: {
    title: 'AssessSuite Subscription, Cancellation and Refund Policy',
    slug: 'subscription-terms',
    file: '08_subscription_cancellation_and_refund_policy.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
  },
  'website-terms': {
    title: 'AssessSuite Website Terms of Use',
    slug: 'website-terms',
    file: '09_website_terms_of_use.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
  },
  cookies: {
    title: 'AssessSuite Cookie, Analytics and Tracking Notice',
    slug: 'cookies',
    file: '10_cookie_analytics_and_tracking_notice.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
  },
  dpa: {
    title: 'AssessSuite Data Processing and Security Schedule',
    slug: 'data-processing-schedule',
    file: '11_data_processing_and_security_schedule.md',
    releaseStatus: 'DRAFT — NOT APPROVED FOR PUBLICATION, ACCEPTANCE OR RELIANCE',
    publicRoute: true,
  },
  subprocessors: {
    title: 'AssessSuite Approved Subprocessor and Cross-Border Data Schedule',
    slug: 'subprocessors',
    file: '25_approved_subprocessor_and_cross_border_schedule_template.md',
    releaseStatus: 'DRAFT PUBLIC TEMPLATE — NO PROVIDER IS APPROVED BY THIS DOCUMENT',
    publicRoute: true,
  },
  'vulnerability-disclosure': {
    title: 'AssessSuite Vulnerability Disclosure Policy',
    slug: 'vulnerability-disclosure',
    file: '28_vulnerability_disclosure_policy.md',
    releaseStatus: 'DRAFT — NO SECURITY CHANNEL OR SAFE-HARBOUR PROGRAM IS YET APPROVED',
    publicRoute: true,
  },
};

// Every mandatory-separation notice a clinician must individually
// acknowledge/consent to at first login, in display order. Excludes the
// contract (terms) — that is bound once, at practice-agreement time, by the
// org owner only.
export const PRACTITIONER_NOTICE_IDS = ['collection-notice', 'clinical-use-notice', 'ai-notice'];

// Documents referenced (by title/version, not re-accepted) from the practice
// agreement step's contract-acceptance bundle. Order matters for display.
export const CONTRACT_BUNDLE_IDS = ['terms', 'dpa', 'aup', 'subscription', 'subprocessors'];

export function getLegalDocument(id) {
  const doc = LEGAL_DOCUMENTS[id];
  if (!doc) throw new Error(`Unknown legal document id: ${id}`);
  return doc;
}

export function getLegalDocumentBySlug(slug) {
  return Object.values(LEGAL_DOCUMENTS).find((d) => d.slug === slug) || null;
}

// A lightweight, non-cryptographic content fingerprint — good enough to prove
// "this exact text was shown", without pulling in a hashing dependency. Not a
// security control; do not use for anything requiring collision resistance.
export function fingerprint(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return `fnv-${(hash >>> 0).toString(16)}-${text.length}`;
}
