// Capability-flag blast-radius diff gate.
//
// Given a base and a head state of docs/deployment/flag-manifest.json (plus
// the changed-file list and raw diff text for a candidate change), decides
// whether the change touches production capability in a way that requires a
// notice under docs/deployment/notices/ (see that directory's README.md for
// the grammar), and — for a capability-reducing change — that the notice
// carries a real owner acknowledgement.
//
// Fail-closed: any input this script cannot resolve (a missing git ref, an
// unreadable manifest, an unreadable notice referenced by the changed-file
// list) exits 2. It never exits 0 on an input it could not evaluate.
//
// Zero dependencies beyond node:fs, node:path, node:url and
// node:child_process (git, via execFileSync — no network).
//
// Wired into .github/workflows/ci.yml (pull_request only, contents: read, no
// secrets) and runnable locally via `npm run check:flag-impact`. It is
// deliberately NOT part of the production release corridor yet — see
// docs/deployment/notices/README.md's "Enforcement" section for the future
// release-corridor hook and its prerequisite.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(scriptDir, '..');

const WATCHED_CONFIG_FILES = [
  'fly.production.toml',
  'fly.rollback.production.toml',
  '.env.example',
];

const LIVE_DIFF_PATHSPEC = [
  ...WATCHED_CONFIG_FILES,
  '.github/workflows',
];
const GIT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

function isWatchedDiffFile(filePath) {
  if (WATCHED_CONFIG_FILES.includes(filePath)) return true;
  return /^\.github\/workflows\/.+\.ya?ml$/.test(filePath);
}

// ---------------------------------------------------------------------------
// Notice grammar (docs/deployment/notices/README.md)
// ---------------------------------------------------------------------------

const NOTICE_FENCE = /^<!--capability-notice\n([\s\S]*?)\ncapability-notice-->/;
const NOTICE_REQUIRED_FIELDS = [
  'notice_id', 'date', 'flags', 'direction', 'release',
  'surfaces_affected', 'owner_acknowledgement', 'expected_duration',
];
const NOTICE_DIRECTIONS = new Set(['reduces', 'restores', 'neutral']);
const NOTICE_REQUIRED_HEADINGS = [
  '## User-visible effect',
  '## Surfaces affected',
  '## Detection and monitoring',
  '## Restoration criteria',
];

const normalizeEol = (text) => String(text).replaceAll('\r\n', '\n');

/**
 * Parses one capability notice. Returns { ok: true, fields } or
 * { ok: false, errors: string[] }. fileName is the bare filename
 * (e.g. "20260721-general-clinical-llm-disabled.md"), used to check the
 * notice_id/date-vs-filename rules.
 */
export function parseNotice(fileName, text) {
  const errors = [];
  const source = normalizeEol(text);
  const fenceMatch = source.match(NOTICE_FENCE);
  if (!fenceMatch) {
    return { ok: false, errors: [`${fileName}: missing the <!--capability-notice ... capability-notice--> fence.`] };
  }
  const fields = {};
  for (const rawLine of fenceMatch[1].split('\n')) {
    const fieldMatch = rawLine.match(/^([a-z_]+):\s*(.*)$/);
    if (fieldMatch) fields[fieldMatch[1]] = fieldMatch[2].trim();
  }
  for (const key of NOTICE_REQUIRED_FIELDS) {
    if (!(key in fields) || fields[key] === '') {
      errors.push(`${fileName}: missing required field "${key}:".`);
    }
  }
  const stem = fileName.replace(/\.md$/, '');
  if (fields.notice_id !== undefined && fields.notice_id !== stem) {
    errors.push(`${fileName}: notice_id "${fields.notice_id}" does not match the filename stem "${stem}".`);
  }
  const filenameDatePrefix = fileName.match(/^(\d{8})-/)?.[1];
  const fieldDateCompact = fields.date ? fields.date.replaceAll('-', '') : undefined;
  if (filenameDatePrefix && fieldDateCompact !== filenameDatePrefix) {
    errors.push(`${fileName}: date "${fields.date}" does not match the filename prefix "${filenameDatePrefix}".`);
  }
  if (fields.direction !== undefined && !NOTICE_DIRECTIONS.has(fields.direction)) {
    errors.push(`${fileName}: direction "${fields.direction}" is not one of reduces|restores|neutral.`);
  }
  for (const heading of NOTICE_REQUIRED_HEADINGS) {
    const headingIndex = source.indexOf(heading);
    if (headingIndex === -1) {
      errors.push(`${fileName}: missing required heading "${heading}".`);
      continue;
    }
    const nextHeadingIndex = source.indexOf('\n## ', headingIndex + heading.length);
    const body = source.slice(headingIndex + heading.length, nextHeadingIndex === -1 ? undefined : nextHeadingIndex).trim();
    if (!body) errors.push(`${fileName}: heading "${heading}" has no content.`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      ...fields,
      flags: (fields.flags || '').split(',').map((value) => value.trim()).filter(Boolean),
    },
  };
}

// ---------------------------------------------------------------------------
// Manifest diffing
// ---------------------------------------------------------------------------

function flagMap(manifest) {
  return new Map((manifest?.flags || []).map((flag) => [flag.name, flag]));
}

/**
 * 'reducing' | 'restoring' | 'none'. `after === undefined` represents a
 * removed flag: reducing only if it was previously "on" ('1').
 */
export function classifyRegistryChange(before, after) {
  if (after === undefined) return before === '1' ? 'reducing' : 'none';
  if (before === after) return 'none';
  if (after === '1') return 'restoring';
  if (before === '1') return 'reducing';
  return 'none';
}

/**
 * Compares a base and head flag-manifest.json (as parsed objects). Returns
 * an array of change records covering T1 (production/rollback value drift),
 * T2 (flag added/removed) and T3 (client surface lost, call sites fallen to
 * zero, or a server-gate route removed).
 */
export function diffManifests(baseManifest, headManifest) {
  const base = flagMap(baseManifest);
  const head = flagMap(headManifest);
  const names = new Set([...base.keys(), ...head.keys()]);
  const changes = [];

  for (const name of [...names].sort()) {
    const beforeFlag = base.get(name);
    const afterFlag = head.get(name);

    if (!afterFlag) {
      changes.push({
        flag: name, kind: 'flag_removed',
        classification: classifyRegistryChange(beforeFlag.values?.production ?? null, undefined),
        detail: `"${name}" was removed from the registry.`,
      });
      continue;
    }
    if (!beforeFlag) {
      changes.push({
        flag: name, kind: 'flag_added',
        classification: 'none',
        detail: `"${name}" is a new registered flag.`,
      });
      continue;
    }

    if (beforeFlag.values?.production !== afterFlag.values?.production) {
      changes.push({
        flag: name, kind: 'production_value',
        before: beforeFlag.values?.production ?? null, after: afterFlag.values?.production ?? null,
        classification: classifyRegistryChange(beforeFlag.values?.production ?? null, afterFlag.values?.production ?? null),
        detail: `"${name}" production value moved from ${JSON.stringify(beforeFlag.values?.production ?? null)} to ${JSON.stringify(afterFlag.values?.production ?? null)}.`,
      });
    }
    if (beforeFlag.values?.rollback !== afterFlag.values?.rollback) {
      changes.push({
        flag: name, kind: 'rollback_value',
        before: beforeFlag.values?.rollback ?? null, after: afterFlag.values?.rollback ?? null,
        classification: 'none',
        detail: `"${name}" rollback value moved from ${JSON.stringify(beforeFlag.values?.rollback ?? null)} to ${JSON.stringify(afterFlag.values?.rollback ?? null)}.`,
      });
    }

    const beforeSurfaces = new Map((beforeFlag.clientSurfaces || []).map((surface) => [surface.path, surface.callSites]));
    const afterSurfaces = new Map((afterFlag.clientSurfaces || []).map((surface) => [surface.path, surface.callSites]));
    for (const [surfacePath, callSites] of beforeSurfaces) {
      if (!afterSurfaces.has(surfacePath)) {
        changes.push({
          flag: name, kind: 'client_surface_removed', path: surfacePath, classification: 'reducing',
          detail: `"${name}": client surface "${surfacePath}" (${callSites} call site(s)) was removed.`,
        });
      } else if (afterSurfaces.get(surfacePath) === 0 && callSites > 0) {
        changes.push({
          flag: name, kind: 'call_sites_zero', path: surfacePath, classification: 'reducing',
          detail: `"${name}": client surface "${surfacePath}" fell to 0 call sites.`,
        });
      }
    }

    const beforeGates = new Set((beforeFlag.serverGates || []).map((gate) => `${gate.file}::${gate.route}`));
    const afterGates = new Set((afterFlag.serverGates || []).map((gate) => `${gate.file}::${gate.route}`));
    for (const gateKey of beforeGates) {
      if (!afterGates.has(gateKey)) {
        changes.push({
          flag: name, kind: 'server_gate_removed', gate: gateKey, classification: 'reducing',
          detail: `"${name}": server gate "${gateKey}" was removed.`,
        });
      }
    }
  }
  return changes;
}

function scanDiffForWatchedAssignments(diffText, registryNames) {
  const triggers = [];
  let currentFile = '';
  for (const rawLine of String(diffText || '').split(/\r?\n/)) {
    if (rawLine.startsWith('+++ b/') || rawLine.startsWith('+++ ')) {
      currentFile = rawLine.replace(/^\+\+\+ (?:b\/)?/, '').trim();
      continue;
    }
    if (rawLine.startsWith('---')) continue;
    if (!/^[+-]/.test(rawLine)) continue;
    if (!isWatchedDiffFile(currentFile)) continue;
    for (const name of registryNames) {
      const pattern = new RegExp(`^[+-]\\s*(?:#\\s*)?${name}\\s*[:=]`);
      if (pattern.test(rawLine)) {
        triggers.push({ flag: name, file: currentFile, line: rawLine });
      }
    }
  }
  return triggers;
}

// ---------------------------------------------------------------------------
// The gate itself
// ---------------------------------------------------------------------------

function skeletonFor(triggeringFlags, direction) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = triggeringFlags.map((name) => name.toLowerCase().replaceAll('_', '-')).join('-and-');
  return [
    '<!--capability-notice',
    `notice_id: ${date.replaceAll('-', '')}-${slug}`,
    `date: ${date}`,
    `flags: ${triggeringFlags.join(',')}`,
    `direction: ${direction}`,
    'release: <vNN>',
    'surfaces_affected: <count>',
    'owner_acknowledgement: <verbatim authorisation and date, or NOT OBTAINED>',
    'expected_duration: <text>',
    'capability-notice-->',
    '',
    '# <Title>',
    '',
    '## User-visible effect',
    '',
    '<what changes, in Australian English, for a non-engineer>',
    '',
    '## Surfaces affected',
    '',
    '<server gates and client call sites this touches>',
    '',
    '## Detection and monitoring',
    '',
    '<how this would be noticed if it went wrong>',
    '',
    '## Restoration criteria',
    '',
    '<what has to be true before/after this>',
  ].join('\n');
}

/**
 * Pure evaluator. notices: [{ path, text }] for every notice file present
 * in changedFiles (docs/deployment/notices/*.md, excluding README/TEMPLATE).
 * manifestCheckOk: optional — result of a live `flags:check` run, used only
 * to satisfy R5 when the manifest itself was not part of the changed set.
 */
export function evaluateFlagImpact({
  baseManifest,
  headManifest,
  changedFiles = [],
  diffText = '',
  notices = [],
  manifestCheckOk = false,
}) {
  const registryNames = (headManifest?.flags || []).map((flag) => flag.name);
  const changes = diffManifests(baseManifest, headManifest);
  const configTriggers = scanDiffForWatchedAssignments(diffText, registryNames);

  const triggeringFlags = new Set([
    ...changes.map((change) => change.flag),
    ...configTriggers.map((trigger) => trigger.flag),
  ]);

  if (triggeringFlags.size === 0) {
    return { triggered: false, ok: true, unmet: [], triggeringFlags: [], summary: 'No capability-flag changes detected.' };
  }

  const unmet = [];
  const reducingFlags = new Set([
    ...changes.filter((change) => change.classification === 'reducing').map((change) => change.flag),
  ]);

  const changedNoticePaths = changedFiles.filter(
    (filePath) => /^docs\/deployment\/notices\/.+\.md$/.test(filePath)
      && !filePath.endsWith('/README.md') && !filePath.endsWith('/TEMPLATE.md'),
  );

  // R1
  if (changedNoticePaths.length === 0) {
    unmet.push(
      `R1: no capability notice under docs/deployment/notices/ is part of this change, but ${[...triggeringFlags].join(', ')} triggered the gate.`,
    );
  }

  // R2/R3/R4 — parse each changed notice, union their flags, check direction/ack for reducing flags.
  const coveredFlags = new Set();
  const parsedNotices = [];
  for (const noticePath of changedNoticePaths) {
    const noticeName = path.basename(noticePath);
    const record = notices.find((entry) => entry.path === noticePath);
    if (!record) {
      unmet.push(`R3: "${noticePath}" is a changed file but its content was not supplied to the gate.`);
      continue;
    }
    const parsed = parseNotice(noticeName, record.text);
    if (!parsed.ok) {
      unmet.push(...parsed.errors.map((message) => `R3: ${message}`));
      continue;
    }
    parsedNotices.push({ path: noticePath, ...parsed });
    for (const flagName of parsed.fields.flags) coveredFlags.add(flagName);
  }

  if (changedNoticePaths.length > 0) {
    for (const flagName of triggeringFlags) {
      if (!coveredFlags.has(flagName)) {
        unmet.push(`R2: "${flagName}" triggered the gate but no changed notice's "flags:" field names it.`);
      }
    }
  }

  for (const flagName of reducingFlags) {
    const covering = parsedNotices.filter((notice) => notice.fields.flags.includes(flagName));
    if (covering.length === 0) continue; // already reported by R1/R2
    const satisfied = covering.some(
      (notice) => notice.fields.direction === 'reduces'
        && notice.fields.owner_acknowledgement
        && notice.fields.owner_acknowledgement !== 'TBC',
    );
    if (!satisfied) {
      unmet.push(`R4: "${flagName}" is a capability-reducing change; its covering notice must have direction: reduces and a real owner_acknowledgement (not empty, not "TBC").`);
    }
  }

  // R5
  const gateFiles = new Set();
  for (const flag of headManifest?.flags || []) {
    for (const gate of flag.serverGates || []) gateFiles.add(gate.file);
  }
  const touchedGateFile = changedFiles.some((filePath) => gateFiles.has(filePath));
  const touchedToml = changedFiles.some((filePath) => filePath === 'fly.production.toml' || filePath === 'fly.rollback.production.toml');
  if ((touchedGateFile || touchedToml)) {
    const manifestChanged = changedFiles.includes('docs/deployment/flag-manifest.json');
    if (!manifestChanged && !manifestCheckOk) {
      unmet.push('R5: a server gate file or a Fly config changed without docs/deployment/flag-manifest.json changing, and flags:check did not confirm the manifest is still current. Run npm run flags:write.');
    }
  }

  const ok = unmet.length === 0;
  const directionForSkeleton = reducingFlags.size > 0 ? 'reduces' : 'restores';
  const summaryLines = [...triggeringFlags].sort().map((flagName) => {
    const before = headManifest?.flags?.find((flag) => flag.name === flagName);
    const relevantChanges = changes.filter((change) => change.flag === flagName);
    const surfaces = before?.totalCallSites ?? 0;
    const valueChange = relevantChanges.find((change) => change.kind === 'production_value');
    const beforeAfter = valueChange ? `${JSON.stringify(valueChange.before)} -> ${JSON.stringify(valueChange.after)}` : '(surface/gate change)';
    return `  ${flagName}: ${beforeAfter}, ${surfaces} surface call site(s) at head — ${relevantChanges.map((change) => change.detail).join(' ')}`;
  });

  return {
    triggered: true,
    ok,
    unmet,
    triggeringFlags: [...triggeringFlags].sort(),
    summary: ok
      ? `Capability impact summary:\n${summaryLines.join('\n')}`
      : null,
    skeleton: ok ? null : skeletonFor([...triggeringFlags].sort(), directionForSkeleton),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`${label} not found: ${filePath}`), { exitCode: 2 });
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw Object.assign(new Error(`${label} is not valid JSON: ${filePath} (${error.message})`), { exitCode: 2 });
  }
}

function readNoticesForChangedFiles(changedFiles, notesDir) {
  const notices = [];
  for (const filePath of changedFiles) {
    if (!/^docs\/deployment\/notices\/.+\.md$/.test(filePath)) continue;
    if (filePath.endsWith('/README.md') || filePath.endsWith('/TEMPLATE.md')) continue;
    const basename = path.basename(filePath);
    const onDisk = path.join(notesDir, basename);
    if (fs.existsSync(onDisk)) {
      notices.push({ path: filePath, text: fs.readFileSync(onDisk, 'utf8') });
    }
  }
  return notices;
}

function runOffline(args, repoRoot) {
  const get = (flag) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const baseManifestPath = get('--base-manifest');
  const headManifestPath = get('--head-manifest');
  const changedFilesPath = get('--changed-files');
  const diffPath = get('--diff');
  const notesDir = get('--notices-dir') || path.join(repoRoot, 'docs', 'deployment', 'notices');
  const manifestCheckOk = args.includes('--manifest-check-ok');

  if (!baseManifestPath || !headManifestPath) {
    throw Object.assign(new Error('Offline mode requires --base-manifest and --head-manifest.'), { exitCode: 2 });
  }
  const baseManifest = readJson(baseManifestPath, 'base manifest');
  const headManifest = readJson(headManifestPath, 'head manifest');
  const changedFiles = changedFilesPath && fs.existsSync(changedFilesPath)
    ? fs.readFileSync(changedFilesPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const diffText = diffPath && fs.existsSync(diffPath) ? fs.readFileSync(diffPath, 'utf8') : '';
  const notices = readNoticesForChangedFiles(changedFiles, notesDir);

  return evaluateFlagImpact({ baseManifest, headManifest, changedFiles, diffText, notices, manifestCheckOk });
}

function runGit(repoRoot, gitArgs) {
  return execFileSync('git', gitArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
}

function runLive(args, repoRoot) {
  const baseIndex = args.indexOf('--base');
  const base = baseIndex === -1 ? undefined : args[baseIndex + 1];
  if (!base) {
    throw Object.assign(new Error('Usage: node scripts/check-flag-impact.mjs --base <git-ref>'), { exitCode: 2 });
  }
  let baseManifestText;
  try {
    baseManifestText = runGit(repoRoot, ['show', `${base}:docs/deployment/flag-manifest.json`]);
  } catch (error) {
    throw Object.assign(new Error(`Could not read docs/deployment/flag-manifest.json at "${base}": ${String(error.message).split('\n')[0]}`), { exitCode: 2 });
  }
  const headManifestPath = path.join(repoRoot, 'docs', 'deployment', 'flag-manifest.json');
  const headManifest = readJson(headManifestPath, 'head manifest');
  const baseManifest = JSON.parse(baseManifestText);
  const changedFiles = runGit(repoRoot, ['diff', '--name-only', `${base}...HEAD`])
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const diffText = runGit(repoRoot, [
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    `${base}...HEAD`,
    '--',
    ...LIVE_DIFF_PATHSPEC,
  ]);
  const notesDir = path.join(repoRoot, 'docs', 'deployment', 'notices');
  const notices = readNoticesForChangedFiles(changedFiles, notesDir);

  return evaluateFlagImpact({ baseManifest, headManifest, changedFiles, diffText, notices, manifestCheckOk: false });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const repoRoot = DEFAULT_REPO_ROOT;
  try {
    const result = args.includes('--base-manifest') ? runOffline(args, repoRoot) : runLive(args, repoRoot);
    if (!result.triggered) {
      console.log(result.summary);
      process.exit(0);
    }
    if (result.ok) {
      console.log(result.summary);
      process.exit(0);
    }
    console.error('Capability-flag impact gate failed:');
    for (const message of result.unmet) console.error(`  - ${message}`);
    console.error('');
    console.error('Paste this into a new file under docs/deployment/notices/ and fill it in:');
    console.error('');
    console.error(result.skeleton);
    process.exit(1);
  } catch (error) {
    console.error(`check-flag-impact: ${error.message}`);
    process.exit(error.exitCode || 2);
  }
}
