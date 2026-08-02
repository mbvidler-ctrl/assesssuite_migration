import assert from 'node:assert/strict';
import test from 'node:test';

import { checkEmailDns, main } from '../../scripts/check-email-dns.mjs';

function resolverWith({ txt = {}, mx = {}, errors = {} } = {}) {
  return {
    async resolveTxt(name) {
      if (errors[name]) throw errors[name];
      if (!(name in txt)) throw Object.assign(new Error(`no TXT for ${name}`), { code: 'ENODATA' });
      return txt[name];
    },
    async resolveMx(name) {
      if (errors[name]) throw errors[name];
      if (!(name in mx)) throw Object.assign(new Error(`no MX for ${name}`), { code: 'ENODATA' });
      return mx[name];
    },
  };
}

const passingRecords = {
  txt: {
    '_dmarc.assesssuite.com': [['v=DMARC1; p=none']],
    'send.assesssuite.com': [['v=spf1 include:amazonses.com ~all']],
    'resend._domainkey.assesssuite.com': [['p=synthetic-public-key']],
  },
  mx: {
    'send.assesssuite.com': [{ priority: 10, exchange: 'feedback-smtp.ap-southeast-2.amazonses.com' }],
  },
};

test('email DNS gate passes all required Resend records', async () => {
  const report = await checkEmailDns('AssessSuite.com.', resolverWith(passingRecords));
  assert.equal(report.domain, 'assesssuite.com');
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map(({ id, ok }) => [id, ok]), [
    ['dmarc', true],
    ['send-spf', true],
    ['send-mx', true],
    ['resend-dkim', true],
  ]);
});

test('email DNS gate fails when multiple DMARC records are published', async () => {
  const records = structuredClone(passingRecords);
  records.txt['_dmarc.assesssuite.com'] = [
    ['v=DMARC1; p=none'],
    ['v=DMARC1; p=reject'],
  ];
  const report = await checkEmailDns('assesssuite.com', resolverWith(records));
  assert.equal(report.ok, false);
  assert.deepEqual(report.checks.find(({ id }) => id === 'dmarc'), {
    id: 'dmarc',
    name: '_dmarc.assesssuite.com',
    ok: false,
    detail: 'found 2 DMARC record(s); exactly 1 required',
  });
});

test('email DNS gate reports each missing or malformed required record', async () => {
  const report = await checkEmailDns('example.test', resolverWith({
    txt: {
      '_dmarc.example.test': [['unrelated=value']],
      'send.example.test': [['v=spf1 -all']],
    },
    mx: { 'send.example.test': [] },
  }));
  assert.equal(report.ok, false);
  assert.deepEqual(report.checks.map(({ id, ok }) => [id, ok]), [
    ['dmarc', false],
    ['send-spf', false],
    ['send-mx', false],
    ['resend-dkim', false],
  ]);
});

test('email DNS gate fails closed on DNS resolver errors', async () => {
  const timeout = Object.assign(new Error('query timed out'), { code: 'ETIMEOUT' });
  const report = await checkEmailDns('assesssuite.com', resolverWith({
    ...passingRecords,
    errors: { 'send.assesssuite.com': timeout },
  }));
  assert.equal(report.ok, false);
  assert.match(report.checks.find(({ id }) => id === 'send-spf').detail, /^ETIMEOUT:/);
  assert.match(report.checks.find(({ id }) => id === 'send-mx').detail, /^ETIMEOUT:/);
});

test('CLI domain configuration uses EMAIL_DOMAIN and returns a failing exit code', async () => {
  const messages = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message) => messages.push(message);
  console.error = (message) => messages.push(message);
  try {
    const status = await main(['node', 'check-email-dns.mjs'], { EMAIL_DOMAIN: 'example.test' }, resolverWith());
    assert.equal(status, 1);
    assert.match(messages[0], /^\[email-dns\] FAIL - example\.test$/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});
