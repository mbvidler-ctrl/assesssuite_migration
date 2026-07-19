// Single source of truth for every legal instrument served by the app.
//
// This exists to fix a real defect: the previous LegalAcceptanceModal hardcoded
// its own version string ("2.1.0") independently of the record it wrote,
// which drifted and caused an infinite re-acceptance loop (see the note in the
// old Layout.jsx). Every acceptance check and every content page must read
// version/title/status from here — never re-declare it locally.
//
// Content source: controlled copies of the AssessSuite policy suite
// (Unimatter/02_Client_and_Venture_Matters/AssessSuite/work-product/
// policy-suite-20260711/), current version RC-2026.07.19, under
// src/legal-content/.
// Do not hand-edit the copied .md files independently of that source — if the
// suite changes, re-copy the file and bump SUITE_VERSION below.

export const SUITE_VERSION = 'RC-2026.07.19';
export const SUPERSEDED_SUITE_VERSIONS = Object.freeze(['RC-2026.07.11']);
export const SUITE_PUBLICATION_AUTHORITY =
  'Mission UM-AUTO-20260719-ASSESSSUITE-REFERRAL-SIGNUP-RELEASE, activated by Maxwell Vidler on 19 July 2026';

// Production clinical access requires SUITE_VERSION only. The superseded
// identifier is exported for audit and the compatibility-only rollback image;
// it must not weaken the normal release gate. That rollback accepts both
// versions only while document extraction is disabled.

// Matches doc 00's release-candidate boundary. This is deliberately verbatim
// from the suite's own header line for each instrument, not paraphrased.
export const SUITE_STATUS_BANNER =
  'RC-2026.07.19 — EFFECTIVE ONLY WHEN THE VERIFIED DEPLOYMENT RECORDS AN EFFECTIVE DATE. Function-specific activation gates continue to apply.';

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
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
    eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
  },
  privacy: {
    title: 'AssessSuite Privacy Policy',
    slug: 'privacy',
    file: '03_privacy_policy.md',
    releaseStatus: 'APPROVED FOR PUBLICATION WITH RC-2026.07.19 — FUNCTION-SPECIFIC ACTIVATION GATES APPLY',
    publicRoute: true,
  },
  'clinical-use-notice': {
    title: 'AssessSuite Clinical Use and Professional Responsibility Notice',
    slug: 'clinical-use-notice',
    file: '04_clinical_use_and_professional_responsibility_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
    eventType: EVENT_TYPES.PROFESSIONAL_USE_ACKNOWLEDGEMENT,
  },
  'ai-notice': {
    title: 'AssessSuite AI and Automated Processing Transparency Notice',
    slug: 'ai-notice',
    file: '05_ai_and_automated_processing_transparency_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION WITH RC-2026.07.19 — FUNCTION-SPECIFIC ACTIVATION GATES APPLY',
    publicRoute: true,
    eventType: EVENT_TYPES.AI_TRANSPARENCY_CONSENT,
  },
  'collection-notice': {
    title: 'AssessSuite Practitioner Account Collection Notice',
    slug: 'collection-notice',
    file: '06_practitioner_account_collection_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACKNOWLEDGEMENT WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
    eventType: EVENT_TYPES.COLLECTION_NOTICE_ACKNOWLEDGEMENT,
  },
  aup: {
    title: 'AssessSuite Acceptable Use Policy',
    slug: 'acceptable-use',
    file: '07_acceptable_use_policy.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
    eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
  },
  subscription: {
    title: 'AssessSuite Subscription, Cancellation and Refund Policy',
    slug: 'subscription-terms',
    file: '08_subscription_cancellation_and_refund_policy.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
    eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
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
    releaseStatus: 'APPROVED FOR PUBLICATION WITH RC-2026.07.19 — PROCESSING ACTIVATION GATES APPLY',
    publicRoute: true,
    eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
  },
  subprocessors: {
    title: 'AssessSuite Approved Subprocessor and Cross-Border Data Schedule',
    slug: 'subprocessors',
    file: '25_approved_subprocessor_and_cross_border_schedule_template.md',
    releaseStatus: 'PUBLIC SCHEDULE — CURRENT PROVIDERS AND ACTIVATION CONDITIONS LISTED',
    publicRoute: true,
    eventType: EVENT_TYPES.CONTRACT_ACCEPTANCE,
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

export function isLegalDocumentPublicationApproved(doc) {
  return Boolean(
    doc &&
    /^(APPROVED FOR PUBLICATION|PUBLIC SCHEDULE)/.test(doc.releaseStatus || '') &&
    !/(?:DRAFT|NOT APPROVED)/.test(doc.releaseStatus || ''),
  );
}

// Synchronous SHA-256 keeps browser and server acceptance receipts identical
// without a runtime dependency or an asynchronous UI race.
export function fingerprint(text) {
  const bytes = new TextEncoder().encode(String(text));
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Uint32Array(64);
  const rotateRight = (value, count) => (value >>> count) | (value << (32 - count));

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return `sha256-${hash.map((value) => value.toString(16).padStart(8, '0')).join('')}`;
}
