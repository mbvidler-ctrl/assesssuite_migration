import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDependencyAudit } from '../../scripts/check-dependency-audit.mjs';

const bracesId = 'GHSA-vfj7-8cjw-p6xm';
const expiry = '2026-10-18T00:00:00Z';
const reportFor = (id = bracesId, packageName = 'braces') => ({
  vulnerabilities: {
    [packageName]: {
      severity: 'high',
      nodes: [`node_modules/${packageName}`],
      via: [{ name: packageName, severity: 'high', url: `https://github.com/advisories/${id}` }],
    },
  },
});
const options = (overrides = {}) => ({
  now: Date.parse('2026-10-04T00:00:00Z'),
  lockfile: { lockfileVersion: 3, packages: { 'node_modules/braces': { version: '3.0.3' } } },
  readInstalledPackage: () => ({ name: 'braces', version: '3.0.3' }),
  ...overrides,
});
const assertBlocked = (report, config, reason) => {
  const result = evaluateDependencyAudit(report, config);
  assert.equal(result.allowlisted.length, 0);
  assert.ok(result.blocking.length > 0);
  if (reason) assert.match(result.blocking.join('\n'), reason);
};

test('the authorised braces advisory accepts only verified installed 3.0.3 before the UTC deadline', () => {
  const result = evaluateDependencyAudit(reportFor(), options({ now: Date.parse(expiry) - 1 }));
  assert.deepEqual(result.blocking, []);
  assert.equal(result.allowlisted.length, 1);
  assert.equal(result.allowlisted[0].exception.installedVersion, '3.0.3');
  assert.equal(result.allowlisted[0].exception.expiresAt, expiry);
  assert.match(result.allowlisted[0].exception.authorised, /Maxwell Vidler, 2026-10-04/);
});

test('the exception fails at the exact deadline and afterwards', () => {
  for (const now of [Date.parse(expiry), Date.parse(expiry) + 1, Date.parse('2027-01-01T00:00:00Z')]) {
    assertBlocked(reportFor(), options({ now }), /expired at 2026-10-18T00:00:00Z/);
  }
});

test('unknown or invalid current time cannot extend the exception', () => {
  for (const now of [NaN, Infinity, '2026-10-04T00:00:00Z']) {
    assertBlocked(reportFor(), options({ now }), /no valid current time/);
  }
});

test('malformed or missing policy deadline and version fail closed', () => {
  const policy = { packages: ['braces'], installedVersion: '3.0.3', expiresAt: expiry };
  for (const expiresAt of [undefined, '', '2026-10-18', '2026-10-18T00:00:00+00:00', '2026-02-30T00:00:00Z']) {
    assertBlocked(reportFor(), options({
      allowlistedAdvisories: new Map([[bracesId, { ...policy, expiresAt }]]),
    }), /invalid UTC expiry/);
  }
  for (const installedVersion of [undefined, '', '^3.0.3', '3.0.3+patch', '03.0.3', '3.00.3', 3]) {
    assertBlocked(reportFor(), options({
      allowlistedAdvisories: new Map([[bracesId, { ...policy, installedVersion }]]),
    }), /invalid exact installed version/);
  }
});

test('the actual installed package must match both identity and exact reviewed version', () => {
  for (const installed of [null, {}, { name: 'braces', version: '3.0.2' }, { name: 'braces', version: '3.0.4' }, { name: 'another-package', version: '3.0.3' }]) {
    assertBlocked(reportFor(), options({ readInstalledPackage: () => installed }), /installed package is not exactly braces@3.0.3/);
  }
  assertBlocked(reportFor(), options({ readInstalledPackage: () => { throw new Error('missing'); } }), /metadata could not be read/);
  assertBlocked(reportFor(), options({ readInstalledPackage: undefined }), /versions could not be verified/);
});

test('lockfile mismatch, alias or missing inventory cannot authorise an installed package', () => {
  for (const locked of [{ version: '3.0.2' }, {}, { version: '3.0.3', link: true }, { version: '3.0.3', name: 'another-package' }]) {
    assertBlocked(reportFor(), options({
      lockfile: { lockfileVersion: 3, packages: { 'node_modules/braces': locked } },
    }), /locked package is not exactly/);
  }
  for (const lockfile of [undefined, {}, { lockfileVersion: 1, packages: {} }, { lockfileVersion: 3, packages: [] }]) {
    assertBlocked(reportFor(), options({ lockfile }), /understood package-lock inventory/);
  }
});

test('every installed lockfile copy must appear in the audit and have the reviewed version', () => {
  const lockfile = {
    lockfileVersion: 3,
    packages: {
      'node_modules/braces': { version: '3.0.3' },
      'node_modules/example/node_modules/braces': { version: '3.0.3' },
    },
  };
  assertBlocked(reportFor(), options({ lockfile }), /complete locked package inventory/);
  const report = reportFor();
  report.vulnerabilities.braces.nodes.push('node_modules/example/node_modules/braces');
  assert.deepEqual(evaluateDependencyAudit(report, options({ lockfile })).blocking, []);
  lockfile.packages['node_modules/example/node_modules/braces'].version = '3.0.2';
  assertBlocked(report, options({ lockfile }), /locked package is not exactly/);
});

test('unknown, duplicate or unsafe audit node metadata fails closed', () => {
  for (const nodes of [undefined, [], ['node_modules/braces', 'node_modules/braces'], ['../node_modules/braces'], ['node_modules\\braces'], ['node_modules/unknown']]) {
    const report = reportFor();
    report.vulnerabilities.braces.nodes = nodes;
    assertBlocked(report, options(), /complete locked package inventory/);
  }
});

test('a new advisory on braces and the known advisory on another package remain blocked', () => {
  assertBlocked(reportFor('GHSA-aaaa-bbbb-cccc'), options(), /GHSA-aaaa-bbbb-cccc/);
  assertBlocked(reportFor(bracesId, 'another-package'), options(), /another-package/);
  const report = reportFor();
  report.vulnerabilities.braces.via.push({ severity: 'moderate', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' });
  const result = evaluateDependencyAudit(report, options());
  assert.equal(result.allowlisted.length, 1);
  assert.match(result.blocking.join('\n'), /GHSA-aaaa-bbbb-cccc/);
});

test('all three original blocking severities remain enforced for unrelated packages', () => {
  for (const severity of ['moderate', 'high', 'critical']) {
    const report = reportFor('GHSA-aaaa-bbbb-cccc', 'axios');
    report.vulnerabilities.axios.severity = severity;
    report.vulnerabilities.axios.via[0].severity = severity;
    assertBlocked(report, options(), new RegExp(severity));
  }
});

test('the separately authorised react-router exception retains its existing policy', () => {
  for (const packageName of ['react-router', 'react-router-dom']) {
    const result = evaluateDependencyAudit(reportFor('GHSA-qwww-vcr4-c8h2', packageName), {
      now: Date.parse('2027-01-01T00:00:00Z'),
    });
    assert.deepEqual(result.blocking, []);
    assert.equal(result.allowlisted.length, 1);
    assert.equal(result.allowlisted[0].exception.expiresAt, undefined);
  }
});

test('transitive findings resolve to their direct advisory without extending the package exception', () => {
  const report = reportFor();
  report.vulnerabilities.tailwindcss = { severity: 'high', via: ['braces'] };
  assert.deepEqual(evaluateDependencyAudit(report, options()).blocking, []);
  report.vulnerabilities.tailwindcss.via.push('missing-package');
  assert.match(evaluateDependencyAudit(report, options()).blocking.join('\n'), /unresolved transitive advisory/);
  assertBlocked({ vulnerabilities: {
    first: { severity: 'high', via: ['second'] },
    second: { severity: 'high', via: ['first'] },
  } }, options(), /no severe direct advisory/);
});

test('unrecognised or empty severe advisory metadata and audit errors fail closed', () => {
  for (const via of [undefined, [], [null], [{}], [{ severity: 'high', title: 'No advisory id' }], [{ severity: 'low' }], [{ severity: 'unknown' }]]) {
    const report = reportFor();
    report.vulnerabilities.braces.via = via;
    assertBlocked(report, options());
  }
  for (const report of [{}, { vulnerabilities: [] }, { error: { code: 'ENOAUDIT' } }]) {
    assert.throws(() => evaluateDependencyAudit(report, options()));
  }
});

test('unknown severity cannot hide alongside an accepted advisory and normal low/info findings stay nonblocking', () => {
  const report = reportFor();
  report.vulnerabilities.braces.via.push({ severity: 'unknown', url: `https://github.com/advisories/${bracesId}` });
  assert.match(evaluateDependencyAudit(report, options()).blocking.join('\n'), /advisory shape not understood/);
  for (const severity of [undefined, 'unknown']) {
    const invalid = reportFor();
    invalid.vulnerabilities.braces.severity = severity;
    assertBlocked(invalid, options(), /finding severity not understood/);
  }
  for (const severity of ['low', 'info']) {
    const lowReport = reportFor('GHSA-aaaa-bbbb-cccc', 'example');
    lowReport.vulnerabilities.example.severity = severity;
    lowReport.vulnerabilities.example.via[0].severity = severity;
    assert.deepEqual(evaluateDependencyAudit(lowReport, options()).blocking, []);
  }
});
