import assert from 'node:assert/strict';
import test from 'node:test';

const UPLOAD_ID = '00000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-07-21T00:00:00.000Z');

async function loadFreshFileAccess(label) {
  const moduleUrl = new URL('../fileAccess.mjs', import.meta.url);
  moduleUrl.searchParams.set('test', label);
  return import(moduleUrl.href);
}

function accessToken(issued) {
  return new URL(issued.fileUrl, 'http://assesssuite.test').searchParams.get('access_token');
}

test('one user cannot evict another user\'s active signed-file grant', async () => {
  const { issueFileAccessUrl, verifyFileAccessToken } = await loadFreshFileAccess('cross-user-eviction');
  const victim = issueFileAccessUrl({
    uploadId: UPLOAD_ID,
    orgId: 'org-victim',
    userId: 'user-victim',
    now: NOW,
  });
  const attackerFirst = issueFileAccessUrl({
    uploadId: UPLOAD_ID,
    orgId: 'org-attacker',
    userId: 'user-attacker',
    now: NOW,
  });
  let attackerLatest = attackerFirst;
  for (let index = 1; index < 10_000; index += 1) {
    attackerLatest = issueFileAccessUrl({
      uploadId: UPLOAD_ID,
      orgId: 'org-attacker',
      userId: 'user-attacker',
      now: NOW,
    });
  }

  assert.ok(verifyFileAccessToken(accessToken(victim), { uploadId: UPLOAD_ID, now: NOW }));
  assert.equal(verifyFileAccessToken(accessToken(attackerFirst), { uploadId: UPLOAD_ID, now: NOW }), null);
  assert.ok(verifyFileAccessToken(accessToken(attackerLatest), { uploadId: UPLOAD_ID, now: NOW }));
});

test('global signed-file grant capacity fails closed without evicting live grants', async () => {
  const { issueFileAccessUrl, verifyFileAccessToken } = await loadFreshFileAccess('global-capacity');
  let earliestGrant;
  for (let userIndex = 0; userIndex < 100; userIndex += 1) {
    for (let grantIndex = 0; grantIndex < 100; grantIndex += 1) {
      const issued = issueFileAccessUrl({
        uploadId: UPLOAD_ID,
        orgId: `org-${userIndex}`,
        userId: `user-${userIndex}`,
        now: NOW,
      });
      if (!earliestGrant) earliestGrant = issued;
    }
  }

  assert.throws(
    () => issueFileAccessUrl({
      uploadId: UPLOAD_ID,
      orgId: 'org-overflow',
      userId: 'user-overflow',
      now: NOW,
    }),
    (error) => {
      assert.equal(error.name, 'FileAccessGrantCapacityError');
      assert.equal(error.httpStatus, 503);
      assert.equal(error.code, 'file_access_capacity_exhausted');
      assert.equal(error.publicMessage, 'Temporary file access is currently unavailable.');
      return true;
    },
  );
  assert.ok(verifyFileAccessToken(accessToken(earliestGrant), { uploadId: UPLOAD_ID, now: NOW }));
});

test('normal issuance, binding, and expiry behavior remains intact', async () => {
  const { issueFileAccessUrl, verifyFileAccessToken } = await loadFreshFileAccess('normal-behavior');
  const issued = issueFileAccessUrl({
    uploadId: UPLOAD_ID,
    orgId: 'org-normal',
    userId: 'user-normal',
    now: NOW,
  });
  const token = accessToken(issued);

  assert.deepEqual(verifyFileAccessToken(token, { uploadId: UPLOAD_ID, now: NOW }), {
    uploadId: UPLOAD_ID,
    orgId: 'org-normal',
    userId: 'user-normal',
    expiresAt: issued.expiresAt,
  });
  assert.equal(verifyFileAccessToken(token, {
    uploadId: '00000000-0000-4000-8000-000000000002',
    now: NOW,
  }), null);

  const afterMaximumTtl = new Date(NOW.getTime() + 301_000);
  assert.equal(verifyFileAccessToken(token, { uploadId: UPLOAD_ID, now: afterMaximumTtl }), null);
  const replacement = issueFileAccessUrl({
    uploadId: UPLOAD_ID,
    orgId: 'org-normal',
    userId: 'user-normal',
    now: afterMaximumTtl,
  });
  assert.ok(verifyFileAccessToken(accessToken(replacement), {
    uploadId: UPLOAD_ID,
    now: afterMaximumTtl,
  }));
});
