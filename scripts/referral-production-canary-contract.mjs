// Fixed, content-free metadata contract shared by the production canary and
// its standalone output firewall. This module intentionally has no server,
// database, SDK or provider imports.

export const CANARY_SCHEMA_VERSION = 'assesssuite.isolated-referral-production-canary.v2';
export const CANARY_NAME = 'installed-sdk-referral-journey';
export const SYNTHETIC_REFERRAL_FILENAME = 'AssessSuite_Demo_GP_Referral(1).pdf';
export const REQUIRED_CANARY_ACKNOWLEDGEMENT =
  'I_ACKNOWLEDGE_ISOLATED_SYNTHETIC_REFERRAL_PRODUCTION_CANARY';

export const CHECK_NAMES = Object.freeze([
  'gates_accepted',
  'temporary_paths_isolated',
  'installed_sdk_authenticated',
  'primary_organisation_resolved',
  'requested_filename_registered',
  'age_attestation_provenance_recorded',
  'upload_registered',
  'real_provider_mode',
  'extraction_provider_contacted',
  'canonical_schema_verified',
  'extraction_grounded',
  'provider_policy_enforced',
  'no_client_before_review',
  'reviewed_client_created',
  'document_retained',
  'upload_bound',
  'temporary_storage_removed',
]);

export const FAILURE_STAGES = Object.freeze([
  'gate',
  'start_isolated_server',
  'authenticate',
  'legal_acceptance',
  'sdk_authentication',
  'organisation_resolution',
  'upload',
  'extraction',
  'audit_verification',
  'review_persistence',
  'retention_verification',
  'cleanup',
]);
