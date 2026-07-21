import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { profileSetupRedirectForUser } from '../../src/lib/profileSetupAccess.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('ProfileSetup repeats the payment-before-profile route gate before membership work', () => {
  assert.equal(profileSetupRedirectForUser(null), '/Login');
  assert.equal(profileSetupRedirectForUser({ role: 'admin' }), '/Dashboard');
  assert.equal(profileSetupRedirectForUser({ account_status: 'deactivated' }), '/AccountDeactivated');
  assert.equal(profileSetupRedirectForUser({ account_status: 'suspended' }), '/PendingApproval');
  assert.equal(profileSetupRedirectForUser({ account_status: 'rejected' }), '/PendingApproval');
  assert.equal(profileSetupRedirectForUser({ account_status: 'pending' }), '/PaymentRequired');
  assert.equal(
    profileSetupRedirectForUser({ account_status: 'active', subscription_status: 'inactive' }),
    '/PaymentRequired',
  );
  assert.equal(
    profileSetupRedirectForUser({ account_status: 'active', subscription_status: 'active' }),
    null,
  );

  const source = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'ProfileSetup.jsx'), 'utf8');
  const guardIndex = source.indexOf('profileSetupRedirectForUser(currentUser)');
  const membershipIndex = source.indexOf('OrganizationMember.filter');
  const profileMutationIndex = source.indexOf('base44.auth.updateMe');
  assert.ok(guardIndex >= 0, 'ProfileSetup must invoke the local route guard');
  assert.ok(membershipIndex > guardIndex, 'membership lookup must occur after the payment gate');
  assert.ok(profileMutationIndex > guardIndex, 'profile mutation must occur after the payment gate');
});
