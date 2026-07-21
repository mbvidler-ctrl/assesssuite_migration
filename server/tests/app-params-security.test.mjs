import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'app-params.js'), 'utf8');

test('browser API origin cannot be overridden by server_url query or persisted storage', () => {
  assert.doesNotMatch(source, /getAppParamValue\(["']server_url["']/);
  assert.match(source, /window\.localStorage\.removeItem\(['"]base44_server_url['"]\)/);
  assert.match(source, /return origin;/);
});

test('cross-port backend configuration is confined to localhost development', () => {
  assert.match(source, /isLocalhostOrigin\(origin\)\s*&&\s*isLocalhostOrigin\(configured\)/);
  assert.doesNotMatch(source, /return\s+configured;\s*\n\s*}\s*\n\s*const getAppParams/);
});
