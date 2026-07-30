// Capability-flag manifest generator, checker and operator report.
//
// Rebuilds the machine manifest (docs/deployment/flag-manifest.json) and the
// operator page (docs/deployment/capability-manifest.md) from
// server/capabilityFlags.mjs, and audits the registry against every peer
// artefact that must agree with it: the server chokepoint (raw
// process.env/environment reads outside the registry), the client
// (InvokeLLM) call-site surface, fly.production.toml, fly.rollback.
// production.toml, .env.example, server/productionBootstrap.mjs's parity
// `required` map, and scripts/check-production-secrets.mjs's
// FORBIDDEN_OPAQUE_OVERRIDES list. The last two files are read by narrow
// regex over their known block shapes — never imported, never modified.
//
// Zero dependencies beyond node:fs, node:path and node:url.
//
// The heuristic behind unregistered_capability/registry_bypass is
// deliberately narrow: it flags only names ending in `_ENABLED`, plus the
// explicit CAPABILITY_LIKE_NAMES list below, read as `process.env.NAME` or
// `environment.NAME`. Generic operational variables (LEGAL_STATUS, APP_URL,
// PORT, SELFTEST, PARITY_ASSURANCE_MODE, OPENAI_*, ...) are ignored by
// construction — a noisy gate is a disabled gate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CAPABILITY_FLAGS, CAPABILITY_FLAG_NAMES } from '../server/capabilityFlags.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(scriptDir, '..');

const CAPABILITY_LIKE_NAMES = ['ALLOW_OPEN_REGISTRATION', 'LLM_REQUIRED', 'UPLOAD_AUDIT_LEGAL_HOLD'];

// Files inside server/ that legitimately hold flag names as DATA (object
// keys mutated dynamically, e.g. `environment[name]`) rather than as a gate
// read (`process.env.NAME` / `environment.NAME`). Cross-checked by
// parity_map_drift instead of being refactored.
const ALLOWLISTED_DATA_FILES = ['server/productionBootstrap.mjs', 'scripts/check-production-secrets.mjs'];

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', 'e2e']);

const GENERATED_MANIFEST_BANNER =
  'Generated from server/capabilityFlags.mjs by scripts/flag-manifest.mjs. Do not edit by hand. Regenerate: npm run flags:write';

// ---------------------------------------------------------------------------
// Filesystem walking (zero deps: fs.readdirSync recursive, Node >= 20.1)
// ---------------------------------------------------------------------------

function toPosix(relPath) {
  return relPath.split(path.sep).join('/');
}

function walkFiles(root, { extensions = null } = {}) {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const entryDir = entry.parentPath || entry.path || root;
    const relFromRoot = path.relative(root, path.join(entryDir, entry.name));
    const segments = relFromRoot.split(path.sep);
    if (segments.some((segment) => SKIP_DIR_NAMES.has(segment))) continue;
    if (extensions && !extensions.some((ext) => entry.name.endsWith(ext))) continue;
    files.push(path.join(entryDir, entry.name));
  }
  return files.sort();
}

// ---------------------------------------------------------------------------
// Client surface discovery
// ---------------------------------------------------------------------------

/**
 * Walks a client detector's roots and counts marker call sites per file.
 * Returns [{ path, callSites }] sorted by path, POSIX-normalised and
 * repo-relative. Files with zero matches, and files listed in
 * spec.exclude[].path, are dropped.
 */
export function discoverSurfaces(spec, repoRoot) {
  if (!spec) return [];
  const excludeSet = new Set((spec.exclude || []).map((entry) => entry.path));
  const markerPattern = new RegExp('\\b' + spec.marker + '\\s*\\(', 'g');
  const results = [];
  for (const root of spec.roots) {
    const absoluteRoot = path.join(repoRoot, root);
    for (const file of walkFiles(absoluteRoot, { extensions: spec.extensions })) {
      const relPath = toPosix(path.relative(repoRoot, file));
      if (excludeSet.has(relPath)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const matches = text.match(markerPattern);
      const callSites = matches ? matches.length : 0;
      if (callSites === 0) continue;
      results.push({ path: relPath, callSites });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------
// Config / peer-file parsing (zero deps; narrow, self-documenting)
// ---------------------------------------------------------------------------

/** Parses a Fly.io TOML [env] block. Map<NAME, unquoted value>. */
export function parseFlyEnv(text) {
  const values = new Map();
  let section = 'root';
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[\[?([^\]]+)\]\]?$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (section !== 'env') continue;
    const assignment = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!assignment) continue;
    const key = assignment[1];
    if (values.has(key)) throw new Error(`[env] repeats ${key}`);
    let value = assignment[2].trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values.set(key, value);
  }
  return values;
}

/** Parses top-level `NAME=value` assignments from a dotenv-style file. Map<NAME, literal RHS>. */
export function parseDotenvAssignments(text) {
  const values = new Map();
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const assignment = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!assignment) continue;
    values.set(assignment[1], assignment[2]);
  }
  return values;
}

/** Lifts the literal string array assigned to FORBIDDEN_OPAQUE_OVERRIDES from check-production-secrets.mjs's source, by regex over its known block shape. Never imports the script. */
export function parseForbiddenOpaqueOverrides(text) {
  const match = String(text).match(/FORBIDDEN_OPAQUE_OVERRIDES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return null;
  const names = [...match[1].matchAll(/'([A-Za-z0-9_]+)'|"([A-Za-z0-9_]+)"/g)].map((m) => m[1] || m[2]);
  return names;
}

/** Lifts the literal `required = { NAME: 'value', ... }` parity map from productionBootstrap.mjs's source, by regex over its known block shape. Never imports the script. */
export function parseProductionBootstrapRequired(text) {
  const match = String(text).match(/const required = \{([\s\S]*?)\n {2}\};/);
  if (!match) return null;
  const required = new Map();
  for (const entryMatch of match[1].matchAll(/([A-Za-z0-9_]+):\s*'([^']*)'/g)) {
    required.set(entryMatch[1], entryMatch[2]);
  }
  return required;
}

// ---------------------------------------------------------------------------
// Server chokepoint scan
// ---------------------------------------------------------------------------

const ENV_READ_PATTERN = /\b(?:process\.env|environment)\.([A-Za-z0-9_]+)/g;

/**
 * Scans one server source file's text for raw `process.env.NAME` /
 * `environment.NAME` reads. Returns [{ name, line }].
 */
export function scanRawEnvironmentReads(text) {
  const hits = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((lineText, index) => {
    for (const match of lineText.matchAll(ENV_READ_PATTERN)) {
      hits.push({ name: match[1], line: index + 1 });
    }
  });
  return hits;
}

function isCapabilityLikeName(name) {
  return /_ENABLED$/.test(name) || CAPABILITY_LIKE_NAMES.includes(name);
}

function collectServerSources(repoRoot) {
  const serverRoot = path.join(repoRoot, 'server');
  const files = walkFiles(serverRoot, { extensions: ['.mjs'] });
  const sources = [];
  for (const file of files) {
    const relPath = toPosix(path.relative(repoRoot, file));
    if (relPath.startsWith('server/tests/')) continue;
    if (relPath === 'server/capabilityFlags.mjs') continue;
    if (ALLOWLISTED_DATA_FILES.includes(relPath)) continue;
    sources.push({ file: relPath, text: fs.readFileSync(file, 'utf8') });
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Notice hygiene (light — full grammar/trigger logic lives in
// scripts/check-flag-impact.mjs; this is a basic sanity pass over whatever
// notices currently exist on disk).
// ---------------------------------------------------------------------------

const NOTICE_FENCE = /^<!--capability-notice\n([\s\S]*?)\ncapability-notice-->/;
const NOTICE_REQUIRED_HEADINGS = [
  '## User-visible effect',
  '## Surfaces affected',
  '## Detection and monitoring',
  '## Restoration criteria',
];

function readNoticeFiles(repoRoot) {
  const noticesDir = path.join(repoRoot, 'docs', 'deployment', 'notices');
  if (!fs.existsSync(noticesDir)) return [];
  return fs.readdirSync(noticesDir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md' && name !== 'TEMPLATE.md')
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(noticesDir, name), 'utf8') }));
}

function auditNotice(name, text, registryNames) {
  const findings = [];
  const fenceMatch = text.match(NOTICE_FENCE);
  if (!fenceMatch) {
    findings.push({ kind: 'notice_malformed', notice: name, message: `${name}: missing the capability-notice HTML-comment fence.` });
    return findings;
  }
  const fields = new Map();
  for (const rawLine of fenceMatch[1].split('\n')) {
    const fieldMatch = rawLine.match(/^([a-z_]+):\s*(.*)$/);
    if (fieldMatch) fields.set(fieldMatch[1], fieldMatch[2].trim());
  }
  const noticeId = fields.get('notice_id');
  const stem = name.replace(/\.md$/, '');
  if (noticeId !== stem) {
    findings.push({ kind: 'notice_malformed', notice: name, message: `${name}: notice_id "${noticeId}" does not match the filename stem "${stem}".` });
  }
  const flagsField = fields.get('flags') || '';
  for (const flagName of flagsField.split(',').map((value) => value.trim()).filter(Boolean)) {
    if (!registryNames.includes(flagName)) {
      findings.push({ kind: 'notice_unknown_flag', notice: name, flag: flagName, message: `${name}: "flags:" names "${flagName}", which is not in server/capabilityFlags.mjs.` });
    }
  }
  for (const heading of NOTICE_REQUIRED_HEADINGS) {
    const headingIndex = text.indexOf(heading);
    if (headingIndex === -1) {
      findings.push({ kind: 'notice_malformed', notice: name, message: `${name}: missing required heading "${heading}".` });
      continue;
    }
    const nextHeadingIndex = text.indexOf('\n## ', headingIndex + heading.length);
    const body = text.slice(headingIndex + heading.length, nextHeadingIndex === -1 ? undefined : nextHeadingIndex).trim();
    if (!body) {
      findings.push({ kind: 'notice_malformed', notice: name, message: `${name}: heading "${heading}" has no content.` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// The audit itself — pure, given already-gathered inputs.
// ---------------------------------------------------------------------------

/**
 * Pure audit over already-gathered inputs — no filesystem access.
 *   registry: CAPABILITY_FLAGS-shaped array
 *   serverSources: [{ file, text }] — server/**\/*.mjs, chokepoint-scan set
 *   clientSources: { [flagName]: [{ path, callSites }] } — discovered surfaces
 *   configs: { production: Map|null, rollback: Map|null, envExample: Map|null }
 *   peerLists: { forbiddenOpaqueOverrides: string[]|null, productionBootstrapRequired: Map|null }
 *   notices: [{ name, text }] (optional)
 */
export function auditSources({ registry, serverSources, clientSources, configs, peerLists, notices = [] }) {
  const findings = [];
  const registryNames = registry.map((flag) => flag.name);
  const byName = new Map(registry.map((flag) => [flag.name, flag]));

  // --- chokepoint: unregistered_capability / registry_bypass ---
  for (const source of serverSources) {
    for (const hit of scanRawEnvironmentReads(source.text)) {
      if (byName.has(hit.name)) {
        findings.push({
          kind: 'registry_bypass',
          file: source.file,
          line: hit.line,
          name: hit.name,
          message: `${source.file}:${hit.line}: raw read of registered flag "${hit.name}" outside server/capabilityFlags.mjs. Route it through capabilityEnabled()/capabilityConfigured().`,
        });
      } else if (isCapabilityLikeName(hit.name)) {
        findings.push({
          kind: 'unregistered_capability',
          file: source.file,
          line: hit.line,
          name: hit.name,
          message: `${source.file}:${hit.line}: "${hit.name}" looks like a capability switch but is absent from server/capabilityFlags.mjs. Register it and regenerate the manifests (npm run flags:write).`,
        });
      }
    }
  }

  // --- registry_impure ---
  const registrySelfText = serverSources.find((source) => source.file === 'server/capabilityFlags.mjs')?.text;
  // registrySelfText is intentionally not populated by collectServerSources
  // (which excludes capabilityFlags.mjs from the chokepoint set); callers
  // that want registry_impure checked pass it explicitly via peerLists.
  if (peerLists?.registrySource !== undefined) {
    const text = peerLists.registrySource;
    if (/^\s*import\s/m.test(text) || /\brequire\(/.test(text)) {
      findings.push({ kind: 'registry_impure', message: 'server/capabilityFlags.mjs must have zero imports/requires.' });
    }
  }
  void registrySelfText;

  // --- client surfaces: unrecorded / stale / count drift ---
  for (const flag of registry) {
    if (!flag.clientDetector) continue;
    const discovered = new Map((clientSources?.[flag.name] || []).map((surface) => [surface.path, surface.callSites]));
    const declared = new Map(flag.clientSurfaces.map((surface) => [surface.path, surface.callSites]));
    for (const [surfacePath, callSites] of discovered) {
      if (!declared.has(surfacePath)) {
        findings.push({ kind: 'unrecorded_client_surface', flag: flag.name, path: surfacePath, callSites, message: `${flag.name}: "${surfacePath}" calls ${flag.clientDetector.marker}(${callSites}x) but is not in clientSurfaces. Run npm run flags:write and describe its userVisibleWhenOff.` });
      }
    }
    for (const [surfacePath, callSites] of declared) {
      if (!discovered.has(surfacePath)) {
        findings.push({ kind: 'stale_client_surface', flag: flag.name, path: surfacePath, callSites, message: `${flag.name}: "${surfacePath}" is declared in clientSurfaces but the detector no longer finds it. Remove it and regenerate.` });
      }
    }
    for (const [surfacePath, declaredCount] of declared) {
      const discoveredCount = discovered.get(surfacePath);
      if (discoveredCount !== undefined && discoveredCount !== declaredCount) {
        findings.push({ kind: 'call_site_count_drift', flag: flag.name, path: surfacePath, declared: declaredCount, discovered: discoveredCount, message: `${flag.name}: "${surfacePath}" declares ${declaredCount} call site(s) but the detector found ${discoveredCount}. Run npm run flags:write.` });
      }
    }
  }

  // --- missing_detector_note ---
  for (const flag of registry) {
    if (!flag.clientDetector && (!flag.detectorNote || !flag.detectorNote.trim())) {
      findings.push({ kind: 'missing_detector_note', flag: flag.name, message: `${flag.name}: clientDetector is null but detectorNote is empty. Record why no client surface is tracked.` });
    }
  }

  // --- config_value_drift ---
  for (const [configKey, parsed] of [['production', configs?.production], ['rollback', configs?.rollback]]) {
    if (parsed === null || parsed === undefined) continue;
    for (const flag of registry) {
      const expected = flag.values[configKey];
      const actual = parsed.has(flag.name) ? parsed.get(flag.name) : null;
      if (expected !== actual) {
        findings.push({ kind: 'config_value_drift', flag: flag.name, config: configKey, expected, actual, message: `${flag.name}: values.${configKey} is ${JSON.stringify(expected)} but the config file has ${JSON.stringify(actual)}.` });
      }
    }
  }

  // --- env_example_drift ---
  if (configs?.envExample) {
    for (const flag of registry) {
      const expected = flag.values.envExample;
      const actual = configs.envExample.has(flag.name) ? configs.envExample.get(flag.name) : null;
      if (expected !== actual) {
        findings.push({ kind: 'env_example_drift', flag: flag.name, expected, actual, message: `${flag.name}: values.envExample is ${JSON.stringify(expected)} but .env.example has ${JSON.stringify(actual)}.` });
      }
    }
  }

  // --- parity_map_drift ---
  if (peerLists?.productionBootstrapRequired === null) {
    findings.push({ kind: 'parity_map_drift', message: 'Could not locate the `required = { ... }` block in server/productionBootstrap.mjs.' });
  } else if (peerLists?.productionBootstrapRequired) {
    const required = peerLists.productionBootstrapRequired;
    for (const flag of registry) {
      const expected = flag.values.parity;
      const actual = required.has(flag.name) ? required.get(flag.name) : null;
      if (expected !== actual) {
        findings.push({ kind: 'parity_map_drift', flag: flag.name, expected, actual, message: `${flag.name}: values.parity is ${JSON.stringify(expected)} but productionBootstrap.mjs's required map has ${JSON.stringify(actual)}.` });
      }
    }
  }

  // --- override_guard_gap (set equality, both directions) ---
  if (peerLists?.forbiddenOpaqueOverrides === null) {
    findings.push({ kind: 'override_guard_gap', message: 'Could not locate FORBIDDEN_OPAQUE_OVERRIDES in scripts/check-production-secrets.mjs.' });
  } else if (peerLists?.forbiddenOpaqueOverrides) {
    const scriptSet = new Set(peerLists.forbiddenOpaqueOverrides.filter((name) => registryNames.includes(name)));
    const registrySet = new Set(registry.filter((flag) => flag.opaqueOverrideForbidden).map((flag) => flag.name));
    for (const name of scriptSet) {
      if (!registrySet.has(name)) {
        findings.push({ kind: 'override_guard_gap', flag: name, message: `"${name}" is in FORBIDDEN_OPAQUE_OVERRIDES but the registry does not mark opaqueOverrideForbidden: true.` });
      }
    }
    for (const name of registrySet) {
      if (!scriptSet.has(name)) {
        findings.push({ kind: 'override_guard_gap', flag: name, message: `"${name}" is marked opaqueOverrideForbidden: true but is absent from FORBIDDEN_OPAQUE_OVERRIDES.` });
      }
    }
  }

  // --- notice hygiene ---
  for (const notice of notices) {
    findings.push(...auditNotice(notice.name, notice.text, registryNames));
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Manifest assembly and rendering
// ---------------------------------------------------------------------------

function sortedFlagsForManifest() {
  return [...CAPABILITY_FLAGS].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildManifest({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const flags = sortedFlagsForManifest().map((flag) => {
    const clientSurfaces = flag.clientDetector
      ? discoverSurfaces(flag.clientDetector, repoRoot)
      : [...flag.clientSurfaces].map((surface) => ({ path: surface.path, callSites: surface.callSites }));
    // Merge discovered counts with the hand-written prose, keyed by path.
    const prose = new Map(flag.clientSurfaces.map((surface) => [surface.path, surface]));
    const mergedSurfaces = clientSurfaces
      .map((surface) => {
        const described = prose.get(surface.path);
        return described
          ? { ...described, callSites: surface.callSites }
          : { path: surface.path, callSites: surface.callSites, label: null, failureMode: null, userVisibleWhenOff: null };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
    return {
      name: flag.name,
      kind: flag.kind,
      selftest: flag.selftest,
      selftestMock: flag.selftestMock,
      forcedOffUnder: flag.forcedOffUnder,
      noticeRequired: flag.noticeRequired,
      capabilityReducing: flag.capabilityReducing,
      reducesAvailabilityWhen: flag.reducesAvailabilityWhen,
      owner: flag.owner,
      ownerName: flag.ownerName,
      ownerSummary: flag.ownerSummary,
      whenOff: flag.whenOff,
      values: flag.values,
      serverGates: flag.serverGates,
      reportedVia: flag.reportedVia,
      clientDetector: flag.clientDetector,
      detectorNote: flag.detectorNote,
      clientSurfaces: mergedSurfaces,
      totalCallSites: mergedSurfaces.reduce((sum, surface) => sum + surface.callSites, 0),
      opaqueOverrideForbidden: flag.opaqueOverrideForbidden,
      overrideNote: flag.overrideNote,
      caveats: flag.caveats,
      documentedIn: flag.documentedIn,
    };
  });
  return {
    _generated: GENERATED_MANIFEST_BANNER,
    flagCount: flags.length,
    flags,
  };
}

export function renderManifestJson(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const FAILURE_MODE_PROSE = {
  'hard-error': 'an error message where the text should be',
  'inline-card-error': 'red error text inside the card, on every view',
  'silent-fallback': '**no error at all — the feature quietly degrades**',
  'unlabelled-mock': '**placeholder text is returned as if it were real**',
  'feature-hidden': 'the feature is unreachable',
  'disabled-with-notice': 'the control stays visible but is disabled and labelled as unavailable',
  'labelled-fallback': 'a non-AI substitute runs and is labelled as such',
};

function renderNoticeHistory(repoRoot) {
  const notices = readNoticeFiles(repoRoot);
  if (notices.length === 0) return '_No notices recorded yet._\n';
  const rows = notices
    .slice()
    .sort((a, b) => b.name.localeCompare(a.name))
    .map((notice) => `- [\`${notice.name}\`](notices/${notice.name})`);
  return `${rows.join('\n')}\n`;
}

export function renderOperatorManifest(manifest, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const lines = [];
  lines.push('<!-- GENERATED — Generated from server/capabilityFlags.mjs by scripts/flag-manifest.mjs. Do not edit by hand. Regenerate: npm run flags:write -->');
  lines.push('');
  lines.push('# AssessSuite production capability switches');
  lines.push('');
  lines.push('## What this page is for');
  lines.push('');
  lines.push(
    'This page lists every runtime switch that changes what the AssessSuite production ' +
    'deployment can do, in plain English. It is generated directly from the engineering ' +
    'registry (server/capabilityFlags.mjs), so it cannot drift silently out of date the way a ' +
    'hand-maintained runbook can. Read the "At a glance" table for the current posture, and the ' +
    'per-capability sections below it for exactly what a clinician or client sees when a switch ' +
    'is off.',
  );
  lines.push('');
  lines.push('## At a glance');
  lines.push('');
  lines.push('| Capability | Switch | Production now | Rollback config | Self-test bypass | What the clinic loses when it is off |');
  lines.push('|---|---|---|---|---|---|');
  for (const flag of manifest.flags) {
    const bypass = flag.selftest === 'strict' ? 'none' : flag.selftest === 'implied-on' ? 'SELFTEST=1 treats it as on' : 'SELFTEST/parity assurance force it off';
    lines.push(`| ${flag.ownerName} | \`${flag.name}\` | ${flag.values.production === null ? '(absent)' : `\`${flag.values.production}\``} | ${flag.values.rollback === null ? '(absent)' : `\`${flag.values.rollback}\``} | ${bypass} | ${flag.whenOff} |`);
  }
  lines.push('');
  lines.push('## What a rollback would change today');
  lines.push('');
  lines.push('| Capability | Switch | Production | Rollback |');
  lines.push('|---|---|---|---|');
  for (const flag of manifest.flags) {
    if (flag.values.production !== flag.values.rollback) {
      lines.push(`| ${flag.ownerName} | \`${flag.name}\` | \`${flag.values.production}\` | \`${flag.values.rollback}\` |`);
    }
  }
  lines.push('');
  lines.push('## Per-capability detail');
  lines.push('');
  for (const flag of manifest.flags) {
    lines.push(`### ${flag.ownerName} (\`${flag.name}\`)`);
    lines.push('');
    lines.push(flag.ownerSummary);
    lines.push('');
    lines.push(`**When off:** ${flag.whenOff}`);
    lines.push('');
    if (flag.serverGates.length > 0) {
      lines.push('**Server gates:**');
      lines.push('');
      lines.push('| File | Route | Effect when off |');
      lines.push('|---|---|---|');
      for (const gate of flag.serverGates) {
        lines.push(`| \`${gate.file}\` | ${gate.route} | ${gate.effectWhenOff} |`);
      }
      lines.push('');
    }
    if (flag.clientSurfaces.length > 0) {
      lines.push(`**Client surfaces (${flag.totalCallSites} call site(s) across ${flag.clientSurfaces.length} file(s)):**`);
      lines.push('');
      lines.push('| File | Call sites | What the clinic sees | Detail |');
      lines.push('|---|---|---|---|');
      for (const surface of flag.clientSurfaces) {
        const prose = FAILURE_MODE_PROSE[surface.failureMode] || surface.failureMode || '(undescribed)';
        lines.push(`| \`${surface.path}\` | ${surface.callSites} | ${prose} | ${surface.userVisibleWhenOff || ''} |`);
      }
      lines.push('');
    } else if (flag.clientDetector === null) {
      lines.push(`_No client-side detector: ${flag.detectorNote}_`);
      lines.push('');
    }
    if (flag.reportedVia) {
      lines.push(`**Reported to the browser via:** ${flag.reportedVia}`);
      lines.push('');
    }
    if (flag.caveats.length > 0) {
      lines.push('**Caveats:**');
      lines.push('');
      for (const caveat of flag.caveats) lines.push(`- ${caveat}`);
      lines.push('');
    }
  }
  lines.push('## Change history');
  lines.push('');
  lines.push(renderNoticeHistory(repoRoot).trimEnd());
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// check() — rebuild in memory, compare to disk, run the audit.
// ---------------------------------------------------------------------------

function gatherAuditInputs(repoRoot) {
  const manifest = buildManifest({ repoRoot });
  const clientSources = {};
  for (const flag of CAPABILITY_FLAGS) {
    if (flag.clientDetector) clientSources[flag.name] = discoverSurfaces(flag.clientDetector, repoRoot);
  }
  const readOrNull = (relPath) => {
    const absolute = path.join(repoRoot, relPath);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
  };
  const productionText = readOrNull('fly.production.toml');
  const rollbackText = readOrNull('fly.rollback.production.toml');
  const envExampleText = readOrNull('.env.example');
  const bootstrapText = readOrNull('server/productionBootstrap.mjs');
  const secretsScriptText = readOrNull('scripts/check-production-secrets.mjs');
  const registrySource = readOrNull('server/capabilityFlags.mjs');

  return {
    manifest,
    registry: CAPABILITY_FLAGS,
    serverSources: collectServerSources(repoRoot),
    clientSources,
    configs: {
      production: productionText === null ? null : parseFlyEnv(productionText),
      rollback: rollbackText === null ? null : parseFlyEnv(rollbackText),
      envExample: envExampleText === null ? null : parseDotenvAssignments(envExampleText),
    },
    peerLists: {
      forbiddenOpaqueOverrides: secretsScriptText === null ? null : parseForbiddenOpaqueOverrides(secretsScriptText),
      productionBootstrapRequired: bootstrapText === null ? null : parseProductionBootstrapRequired(bootstrapText),
      registrySource,
    },
    notices: readNoticeFiles(repoRoot),
  };
}

function runCheck({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  let inputs;
  try {
    inputs = gatherAuditInputs(repoRoot);
  } catch (error) {
    return { ok: false, exitCode: 2, findings: [{ kind: 'unreadable_input', message: error.message }] };
  }
  const findings = auditSources(inputs);

  const manifestPath = path.join(repoRoot, 'docs', 'deployment', 'flag-manifest.json');
  const operatorPath = path.join(repoRoot, 'docs', 'deployment', 'capability-manifest.md');
  const expectedJson = renderManifestJson(inputs.manifest);
  const expectedMd = renderOperatorManifest(inputs.manifest, { repoRoot });

  const actualJson = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : null;
  const actualMd = fs.existsSync(operatorPath) ? fs.readFileSync(operatorPath, 'utf8') : null;

  if (actualJson !== expectedJson) {
    findings.push({ kind: 'manifest_stale', file: 'docs/deployment/flag-manifest.json', message: 'docs/deployment/flag-manifest.json is stale. Run: npm run flags:write' });
  }
  if (actualMd !== expectedMd) {
    findings.push({ kind: 'manifest_stale', file: 'docs/deployment/capability-manifest.md', message: 'docs/deployment/capability-manifest.md is stale. Run: npm run flags:write' });
  }

  return { ok: findings.length === 0, exitCode: findings.length === 0 ? 0 : 1, findings, manifest: inputs.manifest };
}

function runWrite({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const inputs = gatherAuditInputs(repoRoot);
  const missingProse = [];
  for (const flag of inputs.manifest.flags) {
    for (const surface of flag.clientSurfaces) {
      if (!surface.userVisibleWhenOff) {
        missingProse.push(`${flag.name}: "${surface.path}" has no userVisibleWhenOff prose in server/capabilityFlags.mjs.`);
      }
    }
  }
  if (missingProse.length > 0) {
    return { ok: false, exitCode: 2, findings: missingProse.map((message) => ({ kind: 'missing_surface_prose', message })) };
  }
  const manifestPath = path.join(repoRoot, 'docs', 'deployment', 'flag-manifest.json');
  const operatorPath = path.join(repoRoot, 'docs', 'deployment', 'capability-manifest.md');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, renderManifestJson(inputs.manifest));
  fs.writeFileSync(operatorPath, renderOperatorManifest(inputs.manifest, { repoRoot }));
  return runCheck({ repoRoot });
}

function runReport({ repoRoot = DEFAULT_REPO_ROOT, configPath = 'fly.production.toml', comparePath = 'fly.rollback.production.toml' } = {}) {
  const manifest = buildManifest({ repoRoot });
  const configured = fs.existsSync(path.join(repoRoot, configPath)) ? parseFlyEnv(fs.readFileSync(path.join(repoRoot, configPath), 'utf8')) : new Map();
  const compare = fs.existsSync(path.join(repoRoot, comparePath)) ? parseFlyEnv(fs.readFileSync(path.join(repoRoot, comparePath), 'utf8')) : new Map();
  const lines = [];
  lines.push(`Capability report — ${configPath} vs ${comparePath}`);
  lines.push('');
  for (const flag of manifest.flags) {
    const now = configured.has(flag.name) ? configured.get(flag.name) : '(absent)';
    const other = compare.has(flag.name) ? compare.get(flag.name) : '(absent)';
    const marker = now === other ? '  ' : '->';
    lines.push(`${marker} ${flag.name.padEnd(38)} now=${String(now).padEnd(10)} compare=${other}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const mode = args.find((value) => !value.startsWith('--')) || 'check';

  if (mode === 'check') {
    const result = runCheck({});
    if (asJson) {
      console.log(JSON.stringify({ findings: result.findings }, null, 2));
    } else if (result.ok) {
      console.log(`Flag manifest check passed (${CAPABILITY_FLAG_NAMES.length} flags).`);
    } else {
      console.error(`Flag manifest check found ${result.findings.length} issue(s):`);
      for (const finding of result.findings) console.error(`  [${finding.kind}] ${finding.message}`);
    }
    process.exit(result.exitCode);
  } else if (mode === 'write') {
    const result = runWrite({});
    if (asJson) {
      console.log(JSON.stringify({ findings: result.findings }, null, 2));
    } else if (result.ok) {
      console.log('Regenerated docs/deployment/flag-manifest.json and docs/deployment/capability-manifest.md.');
    } else {
      console.error(`Refused to write; ${result.findings.length} issue(s):`);
      for (const finding of result.findings) console.error(`  [${finding.kind}] ${finding.message}`);
    }
    process.exit(result.exitCode);
  } else if (mode === 'report') {
    const configIndex = args.indexOf('--config');
    const compareIndex = args.indexOf('--compare');
    console.log(runReport({
      configPath: configIndex !== -1 ? args[configIndex + 1] : undefined,
      comparePath: compareIndex !== -1 ? args[compareIndex + 1] : undefined,
    }));
    process.exit(0);
  } else {
    console.error(`Usage: node scripts/flag-manifest.mjs [check|write|report] [--json] [--config <path>] [--compare <path>]`);
    process.exit(2);
  }
}
