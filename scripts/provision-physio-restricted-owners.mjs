import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createEntityRepository,
  createOrganizationAccessRepository,
  createOutboxRepository,
  createSessionRepository,
  openDatabase,
} from '../server/db.mjs';
import { initEmail } from '../server/email.mjs';
import {
  deliverOrganizationInvitation,
  normalizeAccessEmail,
  validateAccessEmail,
} from '../server/organizationAccess.mjs';
import { assertPhysioProductionPosture } from '../server/productionPosture.mjs';

function parseArguments(argv) {
  const result = {
    ownerEmails: [],
    organizationName: 'AssessSuite Physio Restricted Launch',
    apply: false,
    inspect: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') result.apply = true;
    else if (argument === '--inspect') result.inspect = true;
    else if (argument === '--owner-email') result.ownerEmails.push(argv[++index]);
    else if (argument === '--organization-name') result.organizationName = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  result.ownerEmails = [...new Set(result.ownerEmails.map(validateAccessEmail))];
  if (result.apply && result.inspect) throw new Error('--apply and --inspect are mutually exclusive.');
  if (result.ownerEmails.some((email) => !email) || result.ownerEmails.length < 2) {
    throw new Error('At least two distinct valid --owner-email values are required.');
  }
  if (typeof result.organizationName !== 'string' || !result.organizationName.trim()
      || result.organizationName.trim().length > 160) {
    throw new Error('--organization-name must be between 1 and 160 characters.');
  }
  result.organizationName = result.organizationName.trim();
  return result;
}

function publicUser(user) {
  return {
    id: user.id,
    email: normalizeAccessEmail(user.email),
    account_status: user.account_status,
    email_verified: user.email_verified === true,
  };
}

export function inspectPhysioRestrictedOwners({
  ownerEmails,
  organizationName,
  environment = process.env,
} = {}) {
  assertPhysioProductionPosture(environment);
  if (environment.PROFESSION !== 'physio' || environment.ALLOW_OPEN_REGISTRATION !== '0') {
    throw new Error('Restricted owner inspection requires the invitation-only Physio production target.');
  }
  const opened = openDatabase();
  const { db } = opened;
  try {
    const users = createEntityRepository(db, 'User').listAll();
    const organizations = createEntityRepository(db, 'Organization').listAll();
    const memberships = createEntityRepository(db, 'OrganizationMember').listAll();
    const access = createOrganizationAccessRepository(db);
    const organization = organizations.find((row) => row.name === organizationName) || null;
    const usersByEmail = new Map(users.map((user) => [normalizeAccessEmail(user.email), user]));
    const organizationMemberships = organization
      ? memberships.filter((membership) => membership.org_id === organization.id)
      : [];
    const invitations = organization ? access.listInvitations(organization.id) : [];
    const now = Date.now();
    const targets = ownerEmails.map((email) => {
      const user = usersByEmail.get(email) || null;
      const membership = organizationMemberships.find((row) => (
        normalizeAccessEmail(row.user_email) === email
      )) || null;
      const invitation = invitations.find((row) => (
        normalizeAccessEmail(row.email) === email
        && row.role === 'owner'
        && row.status === 'pending'
        && Boolean(row.sentAt)
        && Date.parse(row.expiresAt || '') > now
      )) || null;
      const activeOwner = Boolean(
        user?.email_verified === true
        && user?.account_status === 'active'
        && user?.subscription_status === 'active'
        && membership?.role === 'owner',
      );
      return {
        email,
        state: activeOwner ? 'active-owner' : invitation ? 'invited-owner' : 'missing',
        user_id: user?.id || null,
        email_verified: user?.email_verified === true,
        account_status: user?.account_status || null,
        membership_role: membership?.role || null,
        invitation_id: invitation?.id || null,
        invitation_expires_at: invitation?.expiresAt || null,
      };
    });
    return {
      status: 'inspection',
      organization: organization
        ? { id: organization.id, name: organization.name, subscription_status: organization.subscription_status }
        : null,
      organization_count: organizations.length,
      targets,
      all_targets_accounted_for: targets.every(({ state }) => (
        state === 'active-owner' || state === 'invited-owner'
      )),
      access_event_count: organization ? access.listEvents(organization.id, 250).length : 0,
    };
  } finally {
    db.close();
  }
}

export async function provisionPhysioRestrictedOwners({
  ownerEmails,
  organizationName,
  apply,
  environment = process.env,
} = {}) {
  assertPhysioProductionPosture(environment);
  if (environment.PROFESSION !== 'physio' || environment.ALLOW_OPEN_REGISTRATION !== '0') {
    throw new Error('Restricted owner provisioning requires the invitation-only Physio production target.');
  }
  const opened = openDatabase();
  const { db } = opened;
  try {
    const users = createEntityRepository(db, 'User');
    const organizations = createEntityRepository(db, 'Organization');
    const memberships = createEntityRepository(db, 'OrganizationMember');
    const access = createOrganizationAccessRepository(db);
    const sessions = createSessionRepository(db);
    initEmail(createOutboxRepository(db, 'email'));

    const allOrganizations = organizations.listAll();
    let organization = allOrganizations.find((row) => row.name === organizationName) || null;
    if (!organization && allOrganizations.length > 0) {
      throw new Error('A different production organisation already exists; pass its exact name rather than creating another tenant.');
    }
    const usersByEmail = new Map(users.listAll().map((user) => [normalizeAccessEmail(user.email), user]));
    const preview = ownerEmails.map((email) => {
      const user = usersByEmail.get(email);
      return {
        email,
        operation: user?.email_verified === true ? 'activate-existing-owner' : 'send-owner-invitation',
        existing_user: Boolean(user),
      };
    });
    if (!apply) {
      return { status: 'dry-run', organization: organization?.name || organizationName, owners: preview };
    }

    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!organization) {
        organization = organizations.create({
          name: organizationName,
          subscription_status: 'active',
        }, 'restricted-production-provisioner');
      } else if (organization.subscription_status !== 'active') {
        organization = organizations.update(organization.id, { subscription_status: 'active' });
      }

      for (const email of ownerEmails) {
        const user = usersByEmail.get(email);
        if (!user || user.email_verified !== true) continue;
        const priorMembership = memberships.listAll().find((membership) => (
          membership.org_id === organization.id
          && normalizeAccessEmail(membership.user_email) === email
        ));
        const alreadyProvisioned = priorMembership?.role === 'owner'
          && user.account_status === 'active'
          && user.subscription_status === 'active';
        users.update(user.id, {
          account_status: 'active',
          subscription_status: 'active',
          subscription_start_date: user.subscription_start_date || now,
          access_entitlement: 'organisation',
          approved_by: 'restricted-production-provisioner',
          approved_date: now,
        });
        const memberFields = { org_id: organization.id, user_email: email, role: 'owner', is_primary: true };
        if (priorMembership) memberships.update(priorMembership.id, memberFields);
        else memberships.create(memberFields, 'restricted-production-provisioner');
        sessions.removeForUser(user.id);
        if (!alreadyProvisioned) {
          access.recordEvent({
            orgId: organization.id,
            eventType: 'owner_provisioned',
            actorUserId: user.id,
            actorEmail: email,
            subjectUserId: user.id,
            subjectEmail: email,
            nextRole: 'owner',
            createdAt: now,
            metadata: { source: 'restricted-production-provisioner' },
          });
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }

    const refreshedUsers = new Map(users.listAll().map((user) => [normalizeAccessEmail(user.email), user]));
    const actor = ownerEmails.map((email) => refreshedUsers.get(email)).find((user) => (
      user?.email_verified === true && user?.account_status === 'active'
    ));
    if (!actor) throw new Error('No confirmed owner identity was available to issue the remaining invitations.');

    const invitations = [];
    for (const email of ownerEmails) {
      const user = refreshedUsers.get(email);
      if (user?.email_verified === true) continue;
      const existing = access.findPendingInvitation(organization.id, email);
      if (existing) {
        invitations.push({ email, status: 'already-pending', expires_at: existing.expiresAt });
        continue;
      }
      const delivery = await deliverOrganizationInvitation({
        accessRepository: access,
        organization,
        actor,
        email,
        role: 'owner',
      });
      if (!delivery.ok) throw new Error(`${delivery.code}: ${delivery.message}`);
      invitations.push({ email, status: 'sent', expires_at: delivery.invitation.expires_at });
    }

    const finalUsers = users.listAll().filter((user) => ownerEmails.includes(normalizeAccessEmail(user.email)));
    return {
      status: 'applied',
      organization: { id: organization.id, name: organization.name },
      active_owners: finalUsers.filter((user) => user.account_status === 'active').map(publicUser),
      invitations,
    };
  } finally {
    db.close();
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const options = parseArguments(process.argv.slice(2));
  const operation = options.inspect
    ? Promise.resolve(inspectPhysioRestrictedOwners(options))
    : provisionPhysioRestrictedOwners(options);
  operation
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`restricted owner provisioning failed: ${error.message}\n`);
      process.exitCode = 1;
    });
}
