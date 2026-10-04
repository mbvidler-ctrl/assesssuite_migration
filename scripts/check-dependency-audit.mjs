// Fail-closed dependency vulnerability audit.
//
// Equivalent to `npm audit --audit-level=moderate` except that advisories in
// the reviewed allowlist below do not fail the gate. Every allowlist entry
// must name the advisory, the reason no compliant fix exists, and the human
// authorisation. Any advisory not listed here — including a new advisory on
// an already-listed package — still fails the gate. Any error obtaining or
// parsing the audit report fails the gate.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALLOWLISTED_ADVISORIES = new Map([
  [
    'GHSA-vfj7-8cjw-p6xm',
    {
      packages: ['braces'],
      installedVersion: '3.0.3',
      expiresAt: '2026-10-18T00:00:00Z',
      reason:
        'No patched braces release exists on 2026-10-04. Tailwind 3 tooling installs ' +
        'braces in the production image; inspected HTTP startup and request paths ' +
        'do not invoke it. Installed-package risk remains. This exact-version ' +
        'exception expires automatically; remove it when the dependency is fixed ' +
        'or eliminated. See docs/security/20261004-braces-temporary-exception.md.',
      authorised:
        'Maxwell Vidler, 2026-10-04, mission UM-AUTO-20261004-ASSESSSUITE-UPLOAD-MAINTENANCE: ' +
        '"Ok, go ahead with option 1. If it fails, move immediately to option 2. Execute autonomously."',
    },
  ],
  [
    'GHSA-qwww-vcr4-c8h2',
    {
      packages: ['react-router', 'react-router-dom'],
      reason:
        'react-router RSC-mode CSRF. The only fixed release (react-router 8.3.0) requires ' +
        'React >= 19.2.7; this application is a React 18 Vite SPA that does not enable RSC ' +
        'mode, so the vulnerable surface is not reachable. react-router-dom has no fixed ' +
        'release. Remove this entry with the React 19 / react-router 8 migration.',
      authorised:
        'Maxwell Vidler, 2026-07-28, mission UM-AUTO-20260728-ASSESSSUITE-LANDSCAPE-CTA-LIVE-FIX (option A)',
    },
  ],
]);

const FAILING_SEVERITIES = new Set(['moderate', 'high', 'critical']);
const KNOWN_SEVERITIES = new Set(['info', 'low', ...FAILING_SEVERITIES]);
const GHSA_PATTERN = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validateTemporaryException = ({ packageName, entry, exception, lockfile, readInstalledPackage, now }) => {
  // Existing separately authorised exceptions retain their original policy.
  if (exception.expiresAt === undefined && exception.installedVersion === undefined) return null;

  const deadline = exception.expiresAt;
  const version = exception.installedVersion;
  if (
    typeof deadline !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(deadline) ||
    !Number.isFinite(Date.parse(deadline)) ||
    new Date(deadline).toISOString() !== deadline.replace('Z', '.000Z')
  ) return 'temporary exception has an invalid UTC expiry';
  if (!Number.isFinite(now)) return 'temporary exception has no valid current time';
  if (now >= Date.parse(deadline)) return `temporary exception expired at ${deadline}`;
  if (typeof version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)) {
    return 'temporary exception has an invalid exact installed version';
  }
  if (!isRecord(lockfile?.packages) || ![2, 3].includes(lockfile?.lockfileVersion)) {
    return 'temporary exception requires an understood package-lock inventory';
  }

  const isPackageNode = (node) =>
    typeof node === 'string' &&
    !node.includes('\\') &&
    node.split('/').every((part) => part && part !== '.' && part !== '..') &&
    (node === `node_modules/${packageName}` || node.endsWith(`/node_modules/${packageName}`));
  const nodes = entry.nodes;
  const lockedNodes = Object.keys(lockfile.packages).filter(isPackageNode).sort();
  if (
    !Array.isArray(nodes) || nodes.length === 0 || !nodes.every(isPackageNode) ||
    new Set(nodes).size !== nodes.length ||
    JSON.stringify([...nodes].sort()) !== JSON.stringify(lockedNodes)
  ) return 'audit nodes do not match the complete locked package inventory';
  if (typeof readInstalledPackage !== 'function') return 'installed package versions could not be verified';

  for (const node of nodes) {
    const locked = lockfile.packages[node];
    if (locked?.version !== version || locked?.link || (locked?.name && locked.name !== packageName)) {
      return `${node}: locked package is not exactly ${packageName}@${version}`;
    }
    let installed;
    try {
      installed = readInstalledPackage(node);
    } catch {
      return `${node}: installed package metadata could not be read`;
    }
    if (installed?.name !== packageName || installed?.version !== version) {
      return `${node}: installed package is not exactly ${packageName}@${version}`;
    }
  }
  return null;
};

// Pure evaluation permits synthetic policy tests without network access or a
// clock/environment override in the executable gate.
export const evaluateDependencyAudit = (report, {
  lockfile,
  readInstalledPackage,
  now = Date.now(),
  allowlistedAdvisories = ALLOWLISTED_ADVISORIES,
} = {}) => {
  if (report?.error) {
    throw new Error(`npm audit reported an error: ${report.error.summary ?? report.error.code ?? 'unknown'}`);
  }
  const vulnerabilities = report?.vulnerabilities;
  if (!isRecord(vulnerabilities)) throw new Error('npm audit output has no vulnerability map');

  const blocking = [];
  const allowlisted = [];
  const resolvesToSevereAdvisory = (packageName, visited = new Set()) => {
    if (visited.has(packageName)) return false;
    const nextVisited = new Set(visited).add(packageName);
    const entry = vulnerabilities[packageName];
    return Array.isArray(entry?.via) && entry.via.some((via) =>
      typeof via === 'string'
        ? resolvesToSevereAdvisory(via, nextVisited)
        : isRecord(via) && FAILING_SEVERITIES.has(via.severity));
  };
  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    if (!KNOWN_SEVERITIES.has(entry?.severity)) {
      blocking.push(`${packageName}: finding severity not understood — failing closed`);
      continue;
    }
    if (!FAILING_SEVERITIES.has(entry?.severity)) continue;
    if (!Array.isArray(entry.via) || entry.via.length === 0) {
      blocking.push(`${packageName}: ${entry.severity} advisory shape not understood — failing closed`);
      continue;
    }
    if (!resolvesToSevereAdvisory(packageName)) {
      blocking.push(`${packageName}: no severe direct advisory resolves from the finding — failing closed`);
    }

    // Transitive strings must resolve to another finding. Direct advisory
    // objects are checked in their own package entry, including all new ids.
    for (const via of entry.via) {
      if (typeof via === 'string') {
        if (!isRecord(vulnerabilities[via])) {
          blocking.push(`${packageName}: unresolved transitive advisory ${via}`);
        }
        continue;
      }
      if (!isRecord(via) || !KNOWN_SEVERITIES.has(via.severity)) {
        blocking.push(`${packageName}: advisory shape not understood — failing closed`);
        continue;
      }
      if (!FAILING_SEVERITIES.has(via.severity)) continue;
      const id = `${via.url ?? ''} ${via.title ?? ''}`.match(GHSA_PATTERN)?.[0];
      if (!id) {
        blocking.push(`${packageName}: advisory without a recognisable GHSA id (${via.title ?? 'untitled'})`);
        continue;
      }
      const exception = allowlistedAdvisories.get(id);
      if (exception?.packages.includes(packageName)) {
        const rejection = validateTemporaryException({
          packageName, entry, exception, lockfile, readInstalledPackage, now,
        });
        if (rejection) blocking.push(`${packageName}: ${id}: ${rejection}`);
        else allowlisted.push({ id, packageName, exception });
      } else {
        blocking.push(`${packageName}: ${id} (${entry.severity})`);
      }
    }
  }
  return { blocking, allowlisted };
};

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

const runAuditGate = () => {
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
  if (![0, 1].includes(result.status)) fail(`npm audit exited unexpectedly (${result.status})`);

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    fail('npm audit produced unparseable output');
  }
  let evaluation;
  try {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const lockfile = JSON.parse(readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
    evaluation = evaluateDependencyAudit(report, {
      lockfile,
      readInstalledPackage: (node) => JSON.parse(readFileSync(path.join(repoRoot, node, 'package.json'), 'utf8')),
    });
  } catch (error) {
    fail(error.message);
  }
  const { blocking, allowlisted } = evaluation;

  if (blocking.length > 0) {
    console.error('Blocking advisories (moderate or above, not allowlisted):');
    for (const line of blocking) console.error(`  - ${line}`);
    process.exit(1);
  }

  if (allowlisted.length > 0) {
    console.log('Allowlisted advisories accepted under reviewed exception:');
    for (const { packageName, id, exception } of allowlisted) {
      console.log(`  - ${packageName}: ${id}`);
      console.log(`  ${id}: ${exception.authorised}`);
      if (exception.expiresAt) console.log(`  ${id}: exact installed version ${exception.installedVersion}; expires ${exception.expiresAt}`);
    }
  }
  console.log('Dependency audit gate passed.');
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runAuditGate();
}
