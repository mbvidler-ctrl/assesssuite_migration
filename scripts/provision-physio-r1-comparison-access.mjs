import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { hashPassword, normaliseEmail } from '../server/auth.mjs';
import {
  createEntityRepository,
  createOutboxRepository,
  createSessionRepository,
  openDatabase,
} from '../server/db.mjs';
import { initEmail, resetEmail, sendEmail } from '../server/email.mjs';

const COMPARISON_URL = 'https://assesssuite-physio-r1.fly.dev';
const RESET_TTL_MS = 60 * 60 * 1000;

function parseArguments(argv) {
  const options = {
    apply: false,
    inspect: false,
    maxwellEmail: null,
    brentonEmail: null,
    organizationName: 'AssessSuite Physio',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--inspect') options.inspect = true;
    else if (argument === '--maxwell-email') options.maxwellEmail = argv[++index];
    else if (argument === '--brenton-email') options.brentonEmail = argv[++index];
    else if (argument === '--organization-name') options.organizationName = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.apply === options.inspect) throw new Error('Choose exactly one of --apply or --inspect.');
  options.maxwellEmail = normaliseEmail(options.maxwellEmail);
  options.brentonEmail = normaliseEmail(options.brentonEmail);
  if (!options.maxwellEmail || !options.brentonEmail || options.maxwellEmail === options.brentonEmail) {
    throw new Error('Distinct --maxwell-email and --brenton-email values are required.');
  }
  if (!options.organizationName?.trim() || options.organizationName.trim().length > 160) {
    throw new Error('--organization-name must be between 1 and 160 characters.');
  }
  options.organizationName = options.organizationName.trim();
  return options;
}

function assertComparisonEnvironment(environment) {
  const required = {
    NODE_ENV: 'production',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    ASSESSSUITE_DEPLOYMENT_VARIANT: 'physio-r1-comparison',
    ALLOW_OPEN_REGISTRATION: '0',
    PAYMENTS_ENABLED: '0',
    EXPECTED_APP_URL: COMPARISON_URL,
  };
  for (const [name, expected] of Object.entries(required)) {
    if (environment[name] !== expected) {
      throw new Error(`R1 comparison access requires ${name}=${expected}.`);
    }
  }
}

function oneByEmail(records, email, label) {
  const matches = records.filter((record) => normaliseEmail(record.email) === email);
  if (matches.length > 1) throw new Error(`Duplicate ${label} identity for ${email}.`);
  return matches[0] || null;
}

function oneMembership(records, orgId, email) {
  const matches = records.filter((record) => (
    record.org_id === orgId && normaliseEmail(record.user_email) === email
  ));
  if (matches.length > 1) throw new Error(`Duplicate R1 comparison membership for ${email}.`);
  return matches[0] || null;
}

function accessState({ user, membership }) {
  const active = Boolean(
    user?.account_status === 'active'
    && user?.subscription_status === 'active'
    && user?.role === 'admin'
    && membership?.role === 'owner',
  );
  const resetPending = Boolean(
    user?.reset_token
    && Date.parse(user.reset_token_expires || '') > Date.now()
    && user?.r1_comparison_access_sent_at,
  );
  return {
    account_status: user?.account_status || null,
    email_verified: user?.email_verified === true,
    membership_role: membership?.role || null,
    comparison_admin: user?.role === 'admin',
    access_state: active && user?.email_verified === true
      ? 'active'
      : active && resetPending
        ? 'activation-email-sent'
        : 'incomplete',
  };
}

export function inspectPhysioR1ComparisonAccess({
  maxwellEmail,
  brentonEmail,
  organizationName = 'AssessSuite Physio',
  environment = process.env,
} = {}) {
  assertComparisonEnvironment(environment);
  const opened = openDatabase();
  const { db } = opened;
  try {
    const users = createEntityRepository(db, 'User').listAll();
    const organizations = createEntityRepository(db, 'Organization').listAll();
    const memberships = createEntityRepository(db, 'OrganizationMember').listAll();
    const organization = organizations.find((record) => record.name === organizationName) || null;
    const targets = [
      ['maxwell', normaliseEmail(maxwellEmail)],
      ['brenton', normaliseEmail(brentonEmail)],
    ].map(([identity, email]) => {
      const user = oneByEmail(users, email, identity);
      const membership = organization ? oneMembership(memberships, organization.id, email) : null;
      return { identity, ...accessState({ user, membership }) };
    });
    return {
      contract_version: 'assesssuite-physio-r1-comparison-access/1.0.0',
      status: 'inspection',
      organization: organization
        ? { id: organization.id, name: organization.name, subscription_status: organization.subscription_status }
        : null,
      targets,
      all_access_paths_ready: targets.every((target) => target.access_state !== 'incomplete'),
    };
  } finally {
    db.close();
  }
}

export async function provisionPhysioR1ComparisonAccess({
  maxwellEmail,
  brentonEmail,
  organizationName = 'AssessSuite Physio',
  apply = false,
  environment = process.env,
  deliver = sendEmail,
} = {}) {
  assertComparisonEnvironment(environment);
  const maxwell = normaliseEmail(maxwellEmail);
  const brenton = normaliseEmail(brentonEmail);
  if (!maxwell || !brenton || maxwell === brenton) throw new Error('Two distinct comparison identities are required.');

  const opened = openDatabase();
  const { db } = opened;
  try {
    const users = createEntityRepository(db, 'User');
    const organizations = createEntityRepository(db, 'Organization');
    const memberships = createEntityRepository(db, 'OrganizationMember');
    const sessions = createSessionRepository(db);
    initEmail(createOutboxRepository(db, 'email'));

    const allUsers = users.listAll();
    const existingMaxwell = oneByEmail(allUsers, maxwell, 'Maxwell');
    if (!existingMaxwell || existingMaxwell.email_verified !== true) {
      throw new Error('The snapshot does not contain Maxwell\'s existing confirmed production identity.');
    }
    const existingBrenton = oneByEmail(allUsers, brenton, 'Brenton');
    const existingOrganizations = organizations.listAll();
    let organization = existingOrganizations.find((record) => record.name === organizationName) || null;
    if (!organization && existingOrganizations.length > 0) {
      throw new Error('The R1 snapshot contains a different organisation; refusing to invent a second tenant.');
    }
    if (!apply) {
      return {
        contract_version: 'assesssuite-physio-r1-comparison-access/1.0.0',
        status: 'dry-run',
        organization: organization?.name || organizationName,
        maxwell_existing_confirmed: true,
        brenton_existing: Boolean(existingBrenton),
        brenton_requires_activation_email: existingBrenton?.email_verified !== true,
      };
    }

    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    let brentonUser;
    try {
      if (!organization) {
        organization = organizations.create({ name: organizationName, subscription_status: 'active' }, 'r1-comparison-provisioner');
      } else if (organization.subscription_status !== 'active') {
        organization = organizations.update(organization.id, { subscription_status: 'active' });
      }

      const userFields = {
        role: 'admin',
        account_status: 'active',
        subscription_status: 'active',
        subscription_start_date: now,
        country: 'australia',
        profession: 'Physiotherapist',
        approved_by: 'r1-comparison-provisioner',
        approved_date: now,
      };
      const updatedMaxwell = users.update(existingMaxwell.id, userFields);
      sessions.removeForUser(updatedMaxwell.id);

      if (existingBrenton) {
        brentonUser = users.update(existingBrenton.id, userFields);
      } else {
        const passwordMaterial = hashPassword(randomBytes(48).toString('base64url'));
        brentonUser = users.create({
          email: brenton,
          full_name: 'Brenton Primmer',
          clinician_name: 'Brenton Primmer',
          email_verified: false,
          ...passwordMaterial,
          ...userFields,
        }, 'r1-comparison-provisioner');
      }
      sessions.removeForUser(brentonUser.id);

      const currentMemberships = memberships.listAll();
      for (const email of [maxwell, brenton]) {
        const fields = { org_id: organization.id, user_email: email, role: 'owner', is_primary: true };
        const existing = oneMembership(currentMemberships, organization.id, email);
        if (existing) memberships.update(existing.id, fields);
        else memberships.create(fields, 'r1-comparison-provisioner');
      }
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* preserve the original failure */ }
      throw error;
    }

    brentonUser = users.getById(brentonUser.id);
    const pendingResetAlreadyDelivered = Boolean(
      brentonUser.email_verified !== true
      && brentonUser.reset_token
      && Date.parse(brentonUser.reset_token_expires || '') > Date.now()
      && brentonUser.r1_comparison_access_sent_at,
    );
    let activationEmail = brentonUser.email_verified === true ? 'not-required' : 'already-sent';
    if (brentonUser.email_verified !== true && !pendingResetAlreadyDelivered) {
      const resetToken = randomUUID();
      const resetExpiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
      users.update(brentonUser.id, {
        reset_token: resetToken,
        reset_token_expires: resetExpiresAt,
        reset_last_request_at: now,
        r1_comparison_access_sent_at: null,
      });
      const resetTarget = new URL('/reset-password', COMPARISON_URL);
      resetTarget.searchParams.set('token', resetToken);
      const delivery = await deliver({
        to: brenton,
        ...resetEmail(resetTarget.toString()),
        idempotencyKey: `r1-comparison-${createHash('sha256').update(resetToken).digest('hex')}`,
      });
      if (delivery?.sent !== true) {
        users.update(brentonUser.id, {
          reset_token: null,
          reset_token_expires: null,
          reset_last_request_at: null,
          r1_comparison_access_sent_at: null,
        });
        throw new Error('Brenton comparison access email was not accepted by the configured provider.');
      }
      users.update(brentonUser.id, { r1_comparison_access_sent_at: new Date().toISOString() });
      activationEmail = 'sent';
    }

    return {
      contract_version: 'assesssuite-physio-r1-comparison-access/1.0.0',
      status: 'applied',
      organization: { id: organization.id, name: organization.name },
      maxwell: 'active-existing-identity',
      brenton: brentonUser.email_verified === true ? 'active-existing-identity' : 'activation-required',
      brenton_activation_email: activationEmail,
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
    ? Promise.resolve(inspectPhysioR1ComparisonAccess(options))
    : provisionPhysioR1ComparisonAccess(options);
  operation
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`R1 comparison access provisioning failed: ${error.message}\n`);
      process.exitCode = 1;
    });
}
