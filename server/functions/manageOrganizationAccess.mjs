import { createEntityRepository, createOrganizationAccessRepository } from '../db.mjs';
import {
  deliverOrganizationInvitation,
  invitationPublicView,
  normalizeAccessEmail,
  validateAccessEmail,
  validateAccessRole,
} from '../organizationAccess.mjs';

function fail(ctx, status, code, message) {
  return ctx.respond(status, { status: 'error', error: code, message });
}

function ownerContext(ctx) {
  const members = createEntityRepository(ctx.db, 'OrganizationMember');
  const ownerMemberships = members.listAll().filter((membership) => (
    normalizeAccessEmail(membership.user_email) === normalizeAccessEmail(ctx.user?.email)
    && membership.role === 'owner'
  ));
  const requestedOrgId = typeof ctx.body?.org_id === 'string' ? ctx.body.org_id.trim() : '';
  const membership = requestedOrgId
    ? ownerMemberships.find((row) => row.org_id === requestedOrgId)
    : ownerMemberships.find((row) => row.is_primary === true) || ownerMemberships[0];
  if (!membership) return null;
  const organizations = createEntityRepository(ctx.db, 'Organization');
  const organization = organizations.getById(membership.org_id);
  return organization ? { membership, organization, members } : null;
}

function memberPresentation(membership, user) {
  return {
    membership_id: membership.id,
    user_id: user?.id || null,
    email: normalizeAccessEmail(membership.user_email),
    full_name: user?.full_name || user?.clinician_name || null,
    role: membership.role,
    is_primary: membership.is_primary === true,
    account_status: user?.account_status || 'unavailable',
    email_verified: user?.email_verified === true,
    last_active: user?.last_active || null,
  };
}

function eventPresentation(event) {
  return {
    id: event.id,
    event_type: event.eventType,
    actor_email: event.actorEmail,
    subject_email: event.subjectEmail,
    prior_role: event.priorRole,
    next_role: event.nextRole,
    created_at: event.createdAt,
  };
}

function activeOwnerCount(memberships, usersByEmail) {
  return memberships.filter((membership) => (
    membership.role === 'owner'
    && usersByEmail.get(normalizeAccessEmail(membership.user_email))?.account_status === 'active'
  )).length;
}

export default async function manageOrganizationAccess(ctx) {
  if (!ctx.db || !ctx.sessions || !ctx.user) {
    return fail(ctx, 503, 'access_management_unavailable', 'Access management is temporarily unavailable.');
  }
  if (ctx.user.account_status !== 'active') {
    return fail(ctx, 403, 'active_owner_required', 'An active practice owner account is required.');
  }
  const owner = ownerContext(ctx);
  if (!owner) {
    return fail(ctx, 403, 'owner_access_required', 'Practice owner access is required.');
  }

  const action = typeof ctx.body?.action === 'string' ? ctx.body.action : 'list';
  const access = createOrganizationAccessRepository(ctx.db);
  const users = createEntityRepository(ctx.db, 'User');
  const allUsersByEmail = new Map(
    users.listAll().map((user) => [normalizeAccessEmail(user.email), user]),
  );
  const orgMemberships = owner.members.listAll().filter((row) => row.org_id === owner.organization.id);

  if (action === 'list') {
    return ctx.respond(200, {
      status: 'success',
      organization: { id: owner.organization.id, name: owner.organization.name },
      members: orgMemberships.map((membership) => (
        memberPresentation(membership, allUsersByEmail.get(normalizeAccessEmail(membership.user_email)))
      )),
      invitations: access.listInvitations(owner.organization.id).map((invitation) => (
        invitationPublicView(invitation)
      )),
      events: access.listEvents(owner.organization.id, 100).map(eventPresentation),
    });
  }

  if (action === 'invite') {
    const email = validateAccessEmail(ctx.body?.email);
    const role = validateAccessRole(ctx.body?.role);
    if (!email || !role) return fail(ctx, 400, 'invalid_invitation', 'Enter a valid email and organisation role.');
    if (orgMemberships.some((row) => normalizeAccessEmail(row.user_email) === email)) {
      return fail(ctx, 409, 'already_a_member', 'This person already has access to the practice.');
    }
    const pending = access.findPendingInvitation(owner.organization.id, email);
    const result = await deliverOrganizationInvitation({
      accessRepository: access,
      organization: owner.organization,
      actor: ctx.user,
      email,
      role,
      request: ctx.request,
      existingInvitation: pending,
      eventType: pending ? 'invitation_resent' : 'invitation_sent',
    });
    return result.ok
      ? ctx.respond(200, { status: 'success', ...result })
      : fail(ctx, result.status, result.code, result.message);
  }

  if (action === 'resend') {
    const invitation = access.getInvitationById(String(ctx.body?.invitation_id || ''));
    if (!invitation || invitation.orgId !== owner.organization.id
        || !['pending', 'expired'].includes(invitationPublicView(invitation).status)) {
      return fail(ctx, 404, 'invitation_not_resendable', 'This invitation cannot be resent.');
    }
    const result = await deliverOrganizationInvitation({
      accessRepository: access,
      organization: owner.organization,
      actor: ctx.user,
      email: invitation.email,
      role: invitation.role,
      request: ctx.request,
      existingInvitation: invitation,
      eventType: 'invitation_resent',
    });
    return result.ok
      ? ctx.respond(200, { status: 'success', ...result })
      : fail(ctx, result.status, result.code, result.message);
  }

  if (action === 'revoke') {
    const invitation = access.getInvitationById(String(ctx.body?.invitation_id || ''));
    if (!invitation || invitation.orgId !== owner.organization.id || invitation.status !== 'pending') {
      return fail(ctx, 404, 'invitation_not_found', 'The pending invitation was not found.');
    }
    const observedAt = new Date().toISOString();
    ctx.db.exec('BEGIN IMMEDIATE');
    try {
      access.updateInvitation(invitation.id, {
        token_hash: null,
        status: 'revoked',
        revoked_at: observedAt,
      });
      access.recordEvent({
        orgId: owner.organization.id,
        eventType: 'invitation_revoked',
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        subjectEmail: invitation.email,
        invitationId: invitation.id,
        priorRole: invitation.role,
        createdAt: observedAt,
      });
      ctx.db.exec('COMMIT');
    } catch (error) {
      try { ctx.db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
    return ctx.respond(200, { status: 'success' });
  }

  const membership = orgMemberships.find((row) => row.id === String(ctx.body?.membership_id || ''));
  if (!membership) return fail(ctx, 404, 'member_not_found', 'The practice member was not found.');
  const subjectEmail = normalizeAccessEmail(membership.user_email);
  const subject = allUsersByEmail.get(subjectEmail);
  if (!subject) return fail(ctx, 409, 'member_account_missing', 'The member account is unavailable.');

  if (action === 'change_role') {
    const nextRole = validateAccessRole(ctx.body?.role);
    if (!nextRole) return fail(ctx, 400, 'invalid_role', 'Select a valid organisation role.');
    if (membership.role === 'owner' && nextRole !== 'owner'
        && activeOwnerCount(orgMemberships, allUsersByEmail) <= 1) {
      return fail(ctx, 409, 'last_owner_required', 'The practice must retain at least one active owner.');
    }
    const observedAt = new Date().toISOString();
    ctx.db.exec('BEGIN IMMEDIATE');
    try {
      owner.members.update(membership.id, { role: nextRole });
      access.recordEvent({
        orgId: owner.organization.id,
        eventType: 'member_role_changed',
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        subjectUserId: subject.id,
        subjectEmail,
        priorRole: membership.role,
        nextRole,
        createdAt: observedAt,
      });
      ctx.db.exec('COMMIT');
    } catch (error) {
      try { ctx.db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
    return ctx.respond(200, { status: 'success' });
  }

  if (action === 'suspend') {
    if (subject.id === ctx.user.id) {
      return fail(ctx, 409, 'self_suspension_forbidden', 'Use another owner to suspend your own access.');
    }
    if (membership.role === 'owner' && activeOwnerCount(orgMemberships, allUsersByEmail) <= 1) {
      return fail(ctx, 409, 'last_owner_required', 'The practice must retain at least one active owner.');
    }
    const observedAt = new Date().toISOString();
    ctx.db.exec('BEGIN IMMEDIATE');
    try {
      users.update(subject.id, { account_status: 'suspended', suspended_at: observedAt, suspended_by: ctx.user.email });
      ctx.sessions.removeForUser(subject.id);
      access.recordEvent({
        orgId: owner.organization.id,
        eventType: 'member_suspended',
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        subjectUserId: subject.id,
        subjectEmail,
        priorRole: membership.role,
        nextRole: membership.role,
        createdAt: observedAt,
      });
      ctx.db.exec('COMMIT');
    } catch (error) {
      try { ctx.db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
    return ctx.respond(200, { status: 'success' });
  }

  if (action === 'reinstate') {
    const observedAt = new Date().toISOString();
    ctx.db.exec('BEGIN IMMEDIATE');
    try {
      users.update(subject.id, {
        account_status: 'active',
        subscription_status: 'active',
        subscription_start_date: subject.subscription_start_date || observedAt,
        access_entitlement: 'organisation',
        suspended_at: null,
        suspended_by: null,
      });
      access.recordEvent({
        orgId: owner.organization.id,
        eventType: 'member_reinstated',
        actorUserId: ctx.user.id,
        actorEmail: ctx.user.email,
        subjectUserId: subject.id,
        subjectEmail,
        priorRole: membership.role,
        nextRole: membership.role,
        createdAt: observedAt,
      });
      ctx.db.exec('COMMIT');
    } catch (error) {
      try { ctx.db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
    return ctx.respond(200, { status: 'success' });
  }

  return fail(ctx, 400, 'unknown_access_action', 'The requested access action is not supported.');
}
