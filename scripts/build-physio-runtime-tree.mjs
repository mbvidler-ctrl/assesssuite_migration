import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

export const PHYSIO_RUNTIME_TREE_CONTRACT_VERSION =
  'assesssuite-physio-runtime-tree/1.0.0';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = Object.freeze(['.mjs', '.js', '.cjs', '.json']);
const runtimeRoots = Object.freeze([
  'server/productionBootstrap.mjs',
  'server/index.mjs',
  'server/functions/index.mjs',
  'server/functions/transcribeSession.mjs',
  'scripts/physio-exact-image-canary.mjs',
]);
const fixedResources = Object.freeze([
  'docs/source-capture/20260702-live-entity-schemas.json',
  'server/local-entity-schemas.json',
  'server/data-import/physiotherapy-assessment-part-0.jsonl',
  'server/data-import/treatmentprotocol-part-0.jsonl',
  'server/tests/fixtures/physio-exact-image-canary/synthetic-physio-canary.wav',
  'package.json',
  'package-lock.json',
]);
const forbiddenPaths = Object.freeze([
  /^server\/mocks(?:\/|$)/,
  /^server\/selftest\.mjs$/,
  /^server\/tests\/(?!fixtures\/physio-exact-image-canary\/synthetic-physio-canary\.wav$)/,
  /^server\/functions\/epMaintenanceRegistry\.mjs$/,
  /^src\/(?:pages|components)(?:\/|$)/,
  /^(?:e2e|\.github)(?:\/|$)/,
  /\.map$/,
]);
const forbiddenSource = Object.freeze([
  /(?:from|import\s*\()\s*['"][^'"]*\/mocks\//,
  /\bfunction\s+(?:mockTranscript|mockSoap|createMock[A-Za-z0-9_]*)\b/,
  /\b(?:mockTranscript|mockSoap)\s*\(/,
]);
const forbiddenOutputMarker =
  /SYNTHETIC_CHAT_PROVIDER_RESPONSE|local InvokeLLM mock|\[Fallback transcript|Simulated SOAP note[^\n]{0,80}placeholder/i;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function relativePath(absolute) {
  const relative = path.relative(repositoryRoot, absolute).replaceAll('\\', '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Physio runtime dependency escaped the repository: ${absolute}`);
  }
  return relative;
}

function sourceModuleSpecifiers(file) {
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.JS,
  );
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return specifiers;
}

function resolveLocalModule(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [base, ...sourceExtensions.map((extension) => `${base}${extension}`),
      ...sourceExtensions.map((extension) => path.join(base, `index${extension}`))];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) throw new Error(`Unresolved local runtime import ${specifier} from ${relativePath(importer)}`);
  relativePath(resolved);
  return resolved;
}

function dependencyClosure() {
  const pending = runtimeRoots.map((entry) => path.join(repositoryRoot, entry));
  const files = new Set();
  while (pending.length) {
    const file = pending.pop();
    const relative = relativePath(file);
    if (files.has(relative)) continue;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Required Physio runtime root is missing: ${relative}`);
    }
    files.add(relative);
    if (!/\.(?:mjs|js|cjs)$/.test(relative)) continue;
    for (const specifier of sourceModuleSpecifiers(file)) {
      const resolved = resolveLocalModule(file, specifier);
      if (resolved) pending.push(resolved);
    }
  }
  for (const resource of fixedResources) files.add(resource);

  const registry = fs.readFileSync(path.join(repositoryRoot, 'src/lib/legal/documentRegistry.js'), 'utf8');
  for (const match of registry.matchAll(/\bfile:\s*['"]([^'"]+\.md)['"]/g)) {
    files.add(`src/legal-content/${match[1]}`);
  }
  return files;
}

function copyFile(relative, outputRoot) {
  if (forbiddenPaths.some((pattern) => pattern.test(relative))) {
    throw new Error(`Forbidden path entered the Physio runtime closure: ${relative}`);
  }
  const source = path.join(repositoryRoot, relative);
  const stat = fs.lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Physio runtime input is not a regular file: ${relative}`);
  }
  if (/\.(?:mjs|js|cjs|jsx)$/.test(relative)) {
    const text = fs.readFileSync(source, 'utf8');
    if (relative !== 'scripts/physio-exact-image-canary.mjs'
        && (forbiddenSource.some((pattern) => pattern.test(text))
          || forbiddenOutputMarker.test(text))) {
      throw new Error(`Forbidden provider/test implementation entered runtime source: ${relative}`);
    }
  }
  const target = path.join(outputRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
}

function copyDist(outputRoot, files) {
  const root = path.join(repositoryRoot, 'dist');
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Physio dist contains a symlink');
      if (entry.isDirectory()) {
        pending.push(source);
      } else if (entry.isFile() && !entry.name.endsWith('.map')) {
        const relative = relativePath(source);
        copyFile(relative, outputRoot);
        files.add(relative);
      }
    }
  }
}

export function buildPhysioRuntimeTree({ outputRoot }) {
  const output = path.resolve(outputRoot || '');
  const relativeOutput = path.relative(repositoryRoot, output);
  if (!outputRoot || !relativeOutput || relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput)) {
    throw new Error('Physio runtime output must be a dedicated directory inside the repository');
  }
  if (fs.existsSync(output)) throw new Error('Physio runtime output already exists');
  fs.mkdirSync(output, { recursive: false });
  const files = dependencyClosure();
  for (const relative of [...files].sort()) copyFile(relative, output);
  copyDist(output, files);

  const entries = [...files].sort().map((relative) => {
    const target = path.join(output, relative);
    const stat = fs.lstatSync(target);
    return Object.freeze({ path: relative, bytes: stat.size, sha256: sha256(fs.readFileSync(target)) });
  });
  const manifestCore = Object.freeze({
    contract_version: PHYSIO_RUNTIME_TREE_CONTRACT_VERSION,
    profession_id: 'physio',
    app_id: 'local-assesssuite-physio',
    file_count: entries.length,
    files: entries,
  });
  const manifest = Object.freeze({
    ...manifestCore,
    manifest_sha256: sha256(canonicalJson(manifestCore)),
  });
  fs.writeFileSync(
    path.join(output, 'physio-runtime-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx', mode: 0o444 },
  );
  return manifest;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = buildPhysioRuntimeTree({ outputRoot: option('--output') });
  process.stdout.write(`${JSON.stringify({
    contract_version: manifest.contract_version,
    file_count: manifest.file_count,
    manifest_sha256: manifest.manifest_sha256,
  })}\n`);
}
