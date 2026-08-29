import { createHash, randomBytes } from 'node:crypto';

import { capabilityEnabled } from './capabilityFlags.mjs';
import { inviteEmail, sendEmail } from './email.mjs';
import { buildPublicInvitationUrl } from './publicRequestOrigin.mjs';

export const ORGANIZATION_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ORGANIZATION_ACCESS_ROLES = Object.freeze(['owner', 'admin', 'clinician']);

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

export function normalizeAccessEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateAccessEmail(value) {
  const email = normalizeAccessEmail(value);
  return email.length > 0
    && email.length <= 254
    && !CONTROL_CHARACTERS.test(email)
    && EMAIL_PATTERN.test(email)
    ? email
    : null;
}

export function validateAccessRole(value) {
  return ORGANIZATION_ACCESS_ROLES.includes(value) ? value : null;
}

export function createInvitationSecret() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function invitationPublicView(invitation, now = Date.now()) {
  const expiresAt = Date.parse(invitation.expiresAt || '');
  const status = invitation.status === 'pending'
    && (!Number.isFinite(expiresAt) || expiresAt <= now)
    ? 'expired'
    : invitation.status;
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status,
    invited_by_email: invitation.invitedByEmail,
    created_at: invitation.createdAt,
    sent_at: invitation.sentAt,
    expires_at: invitation.expiresAt,
    accepted_at: invitation.acceptedAt,
    revoked_at: invitation.revokedAt,
  };
}

function restoredInvitationPatch(invitation) {
  return {
    role: invitation.role,
    token_hash: invitation.tokenHash,
    status: invitation.status,
    sent_at: invitation.sentAt,
    expires_at: invitation.expiresAt,
    accepted_at: invitation.acceptedAt,
    revoked_at: invitation.revokedAt,
    provider_message_id: invitation.providerMessageId,
  };
}

/**
 * Creates or rotates one invitation and confirms real provider acceptance in
 * production. A provider failure restores the previous pending invitation (or
 * removes a newly-created one), so the access page never advertises an email
 * that was not accepted for delivery.
 */
export async function deliverOrganizationInvitation({
  accessRepository,
  organization,
  actor,
  email,
  role,
  request = null,
  existingInvitation = null,
  eventType = 'invitation_sent',
  now = () => Date.now(),
}) {
  const validEmail = validateAccessEmail(email);
  const validRole = validateAccessRole(role);
  if (!validEmail || !validRole) {
    return { ok: false, status: 400, code: 'invalid_invitation', message: 'Enter a valid email and organisation role.' };
  }
  const observedAt = Number(now());
  if (!Number.isFinite(observedAt)) throw new Error('invitation clock returned an invalid value');
  const createdAt = new Date(observedAt).toISOString();
  const expiresAt = new Date(observedAt + ORGANIZATION_INVITATION_TTL_MS).toISOString();
  const { token, tokenHash } = createInvitationSecret();
  const prior = existingInvitation || null;
  let invitation;

  if (prior) {
    invitation = accessRepository.updateInvitation(prior.id, {
      role: validRole,
      token_hash: tokenHash,
      status: 'pending',
      sent_at: null,
      expires_at: expiresAt,
      accepted_at: null,
      revoked_at: null,
      provider_message_id: null,
    });
  } else {
    invitation = accessRepository.createInvitation({
      orgId: organization.id,
      email: validEmail,
      role: validRole,
      tokenHash,
      status: 'pending',
      invitedByUserId: actor.id,
      invitedByEmail: actor.email,
      createdAt,
      expiresAt,
    });
  }

  let link;
  try {
    link = buildPublicInvitationUrl({ request, token });
  } catch (error) {
    if (prior) accessRepository.updateInvitation(prior.id, restoredInvitationPatch(prior));
    else accessRepository.removeInvitation(invitation.id);
    throw error;
  }

  const message = inviteEmail({
    role: validRole,
    link,
    expiresAt,
    inviterName: actor.full_name || actor.clinician_name || actor.email,
    organizationName: organization.name,
  });
  const delivery = await sendEmail({
    to: validEmail,
    ...message,
    idempotencyKey: `organization-invitation:${invitation.id}:${tokenHash.slice(0, 24)}`,
  });
  const confirmedDeliveryRequired = process.env.NODE_ENV === 'production'
    || capabilityEnabled('OUTBOUND_EMAIL_ENABLED');
  if (confirmedDeliveryRequired && delivery?.sent !== true) {
    if (prior) accessRepository.updateInvitation(prior.id, restoredInvitationPatch(prior));
    else accessRepository.removeInvitation(invitation.id);
    return {
      ok: false,
      status: 502,
      code: 'invite_delivery_failed',
      message: 'The invitation email provider did not confirm delivery. No invitation was issued.',
    };
  }

  invitation = accessRepository.updateInvitation(invitation.id, {
    sent_at: createdAt,
    provider_message_id: delivery?.providerId || null,
  });
  accessRepository.recordEvent({
    orgId: organization.id,
    eventType,
    actorUserId: actor.id,
    actorEmail: actor.email,
    subjectEmail: validEmail,
    invitationId: invitation.id,
    nextRole: validRole,
    createdAt,
    metadata: { delivery: delivery?.sent === true ? 'provider-confirmed' : 'test-outbox' },
  });

  return {
    ok: true,
    invitation: invitationPublicView(invitation, observedAt),
    ...(process.env.SELFTEST === '1' ? { test_token: token } : {}),
  };
}
