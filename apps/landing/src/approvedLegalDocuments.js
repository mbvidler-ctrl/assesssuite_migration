import { isLegalDocumentPublicationApproved } from '../../../src/lib/legal/documentRegistry.js';

// Landing-only allowlist. Keep this explicit: importing the platform's
// LEGAL_DOCUMENTS object here would also bundle non-public draft metadata.
export const APPROVED_LANDING_LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({
    title: 'AssessSuite Practitioner and Clinic SaaS Terms',
    slug: 'terms',
    file: '02_practitioner_and_clinic_saas_terms.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH RC-2026.07.19 — CONTROLLED REVISION 2026-07-21.1',
    publicRoute: true,
  }),
  privacy: Object.freeze({
    title: 'AssessSuite Privacy Policy',
    slug: 'privacy',
    file: '03_privacy_policy.md',
    releaseStatus: 'APPROVED FOR PUBLICATION WITH RC-2026.07.19 — CONTROLLED REVISION 2026-08-04.1; BOUNDED PUBLIC-SITE VERCEL WEB ANALYTICS AND FIRST-PARTY AGGREGATE MEASUREMENT',
    publicRoute: true,
  }),
  'clinical-use-notice': Object.freeze({
    title: 'AssessSuite Clinical Use and Professional Responsibility Notice',
    slug: 'clinical-use-notice',
    file: '04_clinical_use_and_professional_responsibility_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
  }),
  'ai-notice': Object.freeze({
    title: 'AssessSuite AI and Automated Processing Transparency Notice',
    slug: 'ai-notice',
    file: '05_ai_and_automated_processing_transparency_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION WITH RC-2026.07.19 — CONTROLLED REVISION 2026-07-21.2; FUNCTION-SPECIFIC ACTIVATION GATES APPLY',
    publicRoute: true,
  }),
  'collection-notice': Object.freeze({
    title: 'AssessSuite Practitioner Account Collection Notice',
    slug: 'collection-notice',
    file: '06_practitioner_account_collection_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACKNOWLEDGEMENT WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
  }),
  aup: Object.freeze({
    title: 'AssessSuite Acceptable Use Policy',
    slug: 'acceptable-use',
    file: '07_acceptable_use_policy.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
  }),
  subscription: Object.freeze({
    title: 'AssessSuite Subscription, Cancellation and Refund Policy',
    slug: 'subscription-terms',
    file: '08_subscription_cancellation_and_refund_policy.md',
    releaseStatus: 'APPROVED FOR PUBLICATION AND ACCEPTANCE WITH THE 19 JULY 2026 RELEASE',
    publicRoute: true,
  }),
  cookies: Object.freeze({
    title: 'AssessSuite Cookie, Analytics and Tracking Notice',
    slug: 'cookies',
    file: '10_cookie_analytics_and_tracking_notice.md',
    releaseStatus: 'APPROVED FOR PUBLICATION — CONTROLLED REVISION 2026-08-04.1; VERCEL WEB ANALYTICS ENABLED ON BOUNDED PUBLIC ROUTES; FIRST-PARTY AGGREGATE MEASUREMENT ACTIVE',
    effectiveDate: '4 August 2026',
    publicRoute: true,
  }),
  dpa: Object.freeze({
    title: 'AssessSuite Data Processing and Security Schedule',
    slug: 'data-processing-schedule',
    file: '11_data_processing_and_security_schedule.md',
    releaseStatus: 'APPROVED FOR PUBLICATION WITH RC-2026.07.19 — CONTROLLED REVISION 2026-07-21.1; PROCESSING ACTIVATION GATES APPLY',
    publicRoute: true,
  }),
  subprocessors: Object.freeze({
    title: 'AssessSuite Approved Subprocessor and Cross-Border Data Schedule',
    slug: 'subprocessors',
    file: '25_approved_subprocessor_and_cross_border_schedule_template.md',
    releaseStatus: 'PUBLIC SCHEDULE — CONTROLLED REVISION 2026-08-04.1; CURRENT PROVIDERS AND ACTIVATION CONDITIONS LISTED',
    publicRoute: true,
  }),
});

export const APPROVED_LANDING_LEGAL_PATHS = Object.freeze(
  Object.values(APPROVED_LANDING_LEGAL_DOCUMENTS)
    .filter((doc) => doc.publicRoute && isLegalDocumentPublicationApproved(doc))
    .map((doc) => `/legal/${doc.slug}`),
);

export function getApprovedLandingLegalDocumentBySlug(slug) {
  const doc = Object.values(APPROVED_LANDING_LEGAL_DOCUMENTS)
    .find((candidate) => candidate.slug === slug);
  return doc?.publicRoute && isLegalDocumentPublicationApproved(doc) ? doc : null;
}
