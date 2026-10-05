// Admission checks for the reporting workflow.
//
// A principal is the resolved identity of the caller: user id, display name,
// role, approval capability, account status and organisation memberships.
// The checks are pure and throw WorkflowError so the HTTP layer can map them
// to status codes. Role names mirror the live application's vocabulary
// (owner/clinician memberships, active account status) without depending on
// its modules.

import { WorkflowError } from './util.mjs';

export const ROLES = Object.freeze({
  clinician: 'clinician',
  seniorClinician: 'senior_clinician',
  practiceAdmin: 'practice_admin',
});

export const CLINICAL_ROLES = Object.freeze([ROLES.clinician, ROLES.seniorClinician]);

export function assertAuthenticated(principal) {
  if (!principal || typeof principal.user_id !== 'string' || !principal.user_id) {
    throw new WorkflowError(401, 'authentication_required', 'Authentication is required.');
  }
  return principal;
}

export function assertActive(principal) {
  assertAuthenticated(principal);
  if (principal.account_status !== 'active') {
    throw new WorkflowError(403, 'account_inactive', 'This account is not active.');
  }
  return principal;
}

export function assertOrgMember(principal, orgId) {
  assertActive(principal);
  if (typeof orgId !== 'string' || !orgId) {
    throw new WorkflowError(400, 'organization_required', 'A valid organisation is required.');
  }
  const memberships = Array.isArray(principal.org_ids) ? principal.org_ids : [];
  if (!memberships.includes(orgId)) {
    throw new WorkflowError(403, 'organization_access_denied', 'You do not have access to this organisation.');
  }
  return principal;
}

export function assertCanRequest(principal, orgId) {
  return assertOrgMember(principal, orgId);
}

export function assertCanAuthor(principal, orgId) {
  assertOrgMember(principal, orgId);
  if (!CLINICAL_ROLES.includes(principal.role)) {
    throw new WorkflowError(403, 'clinical_role_required', 'Only a clinician may author or edit clinical report content.');
  }
  return principal;
}

export function assertCanApprove(principal, orgId) {
  assertCanAuthor(principal, orgId);
  if (principal.can_approve_reports !== true) {
    throw new WorkflowError(403, 'approval_not_permitted', 'Your role does not permit approving reports.');
  }
  return principal;
}

export function assertEpisodeAccess({ episode, orgId, clientId = null }) {
  if (!episode || episode.org_id !== orgId) {
    throw new WorkflowError(404, 'care_episode_not_found', 'The care episode was not found in this organisation.');
  }
  if (clientId && episode.client_id !== clientId) {
    throw new WorkflowError(409, 'care_episode_patient_mismatch', 'The care episode does not belong to the selected patient.');
  }
  return episode;
}

export function assertRequestAccess({ request, principal }) {
  if (!request) {
    throw new WorkflowError(404, 'request_not_found', 'The report request was not found.');
  }
  assertOrgMember(principal, request.org_id);
  return request;
}
