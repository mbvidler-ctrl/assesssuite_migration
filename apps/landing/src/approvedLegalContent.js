import terms from '../../../src/legal-content/02_practitioner_and_clinic_saas_terms.md?raw';
import privacy from '../../../src/legal-content/03_privacy_policy.md?raw';
import clinicalUseNotice from '../../../src/legal-content/04_clinical_use_and_professional_responsibility_notice.md?raw';
import aiNotice from '../../../src/legal-content/05_ai_and_automated_processing_transparency_notice.md?raw';
import collectionNotice from '../../../src/legal-content/06_practitioner_account_collection_notice.md?raw';
import acceptableUse from '../../../src/legal-content/07_acceptable_use_policy.md?raw';
import subscriptionTerms from '../../../src/legal-content/08_subscription_cancellation_and_refund_policy.md?raw';
import cookies from '../../../src/legal-content/10_cookie_analytics_and_tracking_notice.md?raw';
import dataProcessingSchedule from '../../../src/legal-content/11_data_processing_and_security_schedule.md?raw';
import subprocessors from '../../../src/legal-content/25_approved_subprocessor_and_cross_border_schedule_template.md?raw';

// Explicit raw imports are a security and publication boundary. Draft legal
// sources must never be added until their registry status and public route are
// independently approved.
const APPROVED_LANDING_LEGAL_CONTENT = Object.freeze({
  '02_practitioner_and_clinic_saas_terms.md': terms,
  '03_privacy_policy.md': privacy,
  '04_clinical_use_and_professional_responsibility_notice.md': clinicalUseNotice,
  '05_ai_and_automated_processing_transparency_notice.md': aiNotice,
  '06_practitioner_account_collection_notice.md': collectionNotice,
  '07_acceptable_use_policy.md': acceptableUse,
  '08_subscription_cancellation_and_refund_policy.md': subscriptionTerms,
  '10_cookie_analytics_and_tracking_notice.md': cookies,
  '11_data_processing_and_security_schedule.md': dataProcessingSchedule,
  '25_approved_subprocessor_and_cross_border_schedule_template.md': subprocessors,
});

export function loadApprovedLandingLegalContent(filename) {
  const content = APPROVED_LANDING_LEGAL_CONTENT[filename];
  if (!content) throw new Error(`Approved landing legal content not found: ${filename}`);
  return content;
}
