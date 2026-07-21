import assert from 'node:assert/strict';
import test from 'node:test';

import { findReferralClientMatches } from '../../src/lib/referralReview.js';

test('referral matching is token-bound and tenant-bound rather than substring-based', () => {
  const clients = [
    {
      id: 'joanne-same-dob',
      org_id: 'org-reviewed',
      full_name: 'Joanne Smith',
      date_of_birth: '1987-04-03',
    },
    {
      id: 'legitimate-ann-match',
      org_id: 'org-reviewed',
      full_name: 'Ann Marie Smith',
      date_of_birth: '03/04/1987',
    },
    {
      id: 'other-tenant-ann',
      org_id: 'org-other',
      full_name: 'Ann Smith',
      date_of_birth: '1987-04-03',
    },
  ];

  const matches = findReferralClientMatches({
    full_name: 'Ann Smith',
    date_of_birth: '1987-04-03',
  }, clients, 'org-reviewed');

  assert.deepEqual(matches.map((client) => client.id), ['legitimate-ann-match']);
});
