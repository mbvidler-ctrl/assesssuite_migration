import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error('Usage: --base <file> --candidate <file>');
    values[key.slice(2)] = value;
  }
  const fileMode = values.base && values.candidate;
  const directoryMode = values['base-dir'] && values['candidate-dir'];
  if (fileMode === directoryMode) {
    throw new Error('Use either --base/--candidate files or --base-dir/--candidate-dir directories.');
  }
  return values;
}

function runTypecheck(directory) {
  const resolvedDirectory = path.resolve(directory);
  const tsc = path.join(resolvedDirectory, 'node_modules', 'typescript', 'bin', 'tsc');
  const result = spawnSync(process.execPath, [tsc, '-p', './jsconfig.json'], {
    cwd: resolvedDirectory,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error || result.signal) throw result.error || new Error(`Typecheck terminated by ${result.signal}`);
  return { text: `${result.stdout || ''}\n${result.stderr || ''}`, status: result.status };
}

function errorMultiset(text) {
  text = text.replace(/\u001b\[[0-9;]*m/g, '');
  const errors = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(.*?)(?:\(\d+,\d+\))?: error (TS\d+): (.*)$/.exec(line.trim());
    if (!match) continue;
    const source = match[1].replaceAll('\\', '/').replace(/^.*?\/(src|server|scripts)\//, '$1/');
    const fingerprint = `${source}|${match[2]}|${match[3]}`;
    errors.set(fingerprint, (errors.get(fingerprint) || 0) + 1);
  }
  return errors;
}

function count(multiset) {
  return [...multiset.values()].reduce((total, value) => total + value, 0);
}

const args = parseArgs(process.argv.slice(2));
const baseResult = args.base
  ? { text: fs.readFileSync(path.resolve(args.base), 'utf8'), status: null }
  : runTypecheck(args['base-dir']);
const candidateResult = args.candidate
  ? { text: fs.readFileSync(path.resolve(args.candidate), 'utf8'), status: null }
  : runTypecheck(args['candidate-dir']);
const baseline = errorMultiset(baseResult.text);
const candidate = errorMultiset(candidateResult.text);
const referenceResult = args['reference-dir'] ? runTypecheck(args['reference-dir']) : baseResult;
const reference = errorMultiset(referenceResult.text);
const introduced = [];
for (const [fingerprint, occurrences] of candidate) {
  const excess = occurrences - (reference.get(fingerprint) || 0);
  if (excess > 0) introduced.push({ fingerprint, excess });
}

const baseCount = count(baseline);
const candidateCount = count(candidate);
if (baseCount === 0) throw new Error('The recorded production base unexpectedly has no TypeScript errors.');
if (candidateResult.status !== null && candidateResult.status !== 0 && candidateCount === 0) {
  throw new Error(`Candidate typecheck failed without parseable TypeScript diagnostics (exit ${candidateResult.status}).`);
}
if (candidateCount > baseCount || introduced.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    baseCount,
    referenceCount: count(reference),
    candidateCount,
    introduced: introduced.slice(0, 50),
  }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  baseCount,
  referenceCount: count(reference),
  candidateCount,
  improvement: baseCount - candidateCount,
}));
