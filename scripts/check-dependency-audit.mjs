// Fail-closed dependency vulnerability audit.
//
// Equivalent to `npm audit --audit-level=moderate` except that advisories in
// the reviewed allowlist below do not fail the gate. Every allowlist entry
// must name the advisory, the reason no compliant fix exists, and the human
// authorisation. Any advisory not listed here — including a new advisory on
// an already-listed package — still fails the gate. Any error obtaining or
// parsing the audit report fails the gate.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// No advisory is currently excepted. React Router 7.18.2 supplied the 7.x
// backport for the former RSC-mode exception, so the exception was removed
// instead of being extended.
const ALLOWLISTED_ADVISORIES = new Map();

const FAILING_SEVERITIES = new Set(['moderate', 'high', 'critical']);
const GHSA_PATTERN = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/;

const fail = (message) => {
  console.error(`Dependency audit gate failed: ${message}`);
  process.exit(1);
};

const resolveNpmCli = () => {
  const invokedNpm = process.env.npm_execpath;
  if (
    invokedNpm &&
    path.basename(invokedNpm).toLowerCase() === 'npm-cli.js' &&
    existsSync(invokedNpm)
  ) {
    return invokedNpm;
  }

  const nodeDirectory = path.dirname(process.execPath);
  const bundledNpm =
    process.platform === 'win32'
      ? path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : path.join(nodeDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return existsSync(bundledNpm) ? bundledNpm : null;
};

const npmCli = resolveNpmCli();
if (!npmCli) {
  fail('could not resolve the npm CLI paired with the current Node installation');
}

// Run npm's JavaScript entry point with the current Node executable. This
// avoids Windows .cmd shell semantics while retaining argument-array safety.
const result = spawnSync(process.execPath, [npmCli, 'audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (result.error || result.signal) {
  fail(`npm audit did not run (${result.error?.message ?? `signal ${result.signal}`})`);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  fail('npm audit produced unparseable output');
}
if (report.error) {
  fail(`npm audit reported an error: ${report.error.summary ?? report.error.code ?? 'unknown'}`);
}
const vulnerabilities = report.vulnerabilities;
if (!vulnerabilities || typeof vulnerabilities !== 'object') {
  fail('npm audit output has no vulnerability map');
}

const blocking = [];
const allowlisted = [];
for (const [packageName, entry] of Object.entries(vulnerabilities)) {
  if (!FAILING_SEVERITIES.has(entry?.severity)) continue;

  // Direct advisories carry objects in `via`; purely transitive findings
  // carry only package-name strings and are rooted in another entry that has
  // the direct advisory objects, so evaluating every entry covers the chain.
  const advisoryIds = [];
  let hasDirectAdvisory = false;
  for (const via of Array.isArray(entry.via) ? entry.via : []) {
    if (typeof via !== 'object' || via === null) continue;
    hasDirectAdvisory = true;
    if (!FAILING_SEVERITIES.has(via.severity)) continue;
    const id = `${via.url ?? ''} ${via.title ?? ''}`.match(GHSA_PATTERN)?.[0];
    if (!id) {
      blocking.push(`${packageName}: advisory without a recognisable GHSA id (${via.title ?? 'untitled'})`);
      continue;
    }
    advisoryIds.push(id);
  }

  for (const id of advisoryIds) {
    const exception = ALLOWLISTED_ADVISORIES.get(id);
    if (exception?.packages.includes(packageName)) {
      allowlisted.push(`${packageName}: ${id}`);
    } else {
      blocking.push(`${packageName}: ${id} (${entry.severity})`);
    }
  }
  if (hasDirectAdvisory && advisoryIds.length === 0 && blocking.length === 0) {
    blocking.push(`${packageName}: ${entry.severity} advisory shape not understood — failing closed`);
  }
}

if (blocking.length > 0) {
  console.error('Blocking advisories (moderate or above, not allowlisted):');
  for (const line of blocking) console.error(`  - ${line}`);
  process.exit(1);
}

if (allowlisted.length > 0) {
  console.log('Allowlisted advisories accepted under reviewed exception:');
  for (const line of allowlisted) console.log(`  - ${line}`);
  for (const [id, meta] of ALLOWLISTED_ADVISORIES) {
    console.log(`  ${id}: ${meta.authorised}`);
  }
}
console.log('Dependency audit gate passed.');
