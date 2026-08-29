import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PHYSIO_RUNTIME_TREE_CONTRACT_VERSION,
  buildPhysioRuntimeTree,
} from '../../scripts/build-physio-runtime-tree.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('runtime tree is an exact Physio-only regular-file closure', (t) => {
  const outputRoot = fs.mkdtempSync(path.join(repoRoot, '.physio-runtime-tree-test-'));
  fs.rmSync(outputRoot, { recursive: true, force: true });
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  const priorNodeEnv = process.env.NODE_ENV;
  const priorProfession = process.env.PROFESSION;
  const priorAppId = process.env.DEFAULT_APP_ID;
  process.env.NODE_ENV = 'production';
  process.env.PROFESSION = 'physio';
  process.env.DEFAULT_APP_ID = 'local-assesssuite-physio';
  t.after(() => {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    if (priorProfession === undefined) delete process.env.PROFESSION;
    else process.env.PROFESSION = priorProfession;
    if (priorAppId === undefined) delete process.env.DEFAULT_APP_ID;
    else process.env.DEFAULT_APP_ID = priorAppId;
  });

  const manifest = buildPhysioRuntimeTree({ outputRoot });
  assert.equal(manifest.contract_version, PHYSIO_RUNTIME_TREE_CONTRACT_VERSION);
  assert.equal(manifest.profession_id, 'physio');
  assert.equal(manifest.app_id, 'local-assesssuite-physio');
  assert.equal(manifest.file_count, manifest.files.length);

  const paths = manifest.files.map((entry) => entry.path);
  assert.deepEqual(paths, [...paths].sort());
  assert.equal(new Set(paths).size, paths.length);
  const catalogueShards = fs.readdirSync(path.join(repoRoot, 'server', 'data-import'))
    .filter((name) => /^(?:physiotherapy-assessment|treatmentprotocol)-part-\d+\.jsonl$/.test(name))
    .map((name) => `server/data-import/${name}`)
    .sort();
  assert.ok(catalogueShards.length > 0, 'the Physio runtime must have source catalogue shards');
  for (const shard of catalogueShards) {
    assert.ok(paths.includes(shard), `runtime closure omitted catalogue shard ${shard}`);
  }
  for (const required of [
    'server/productionBootstrap.mjs',
    'server/index.mjs',
    'server/functions/index.mjs',
    'server/functions/transcribeSession.mjs',
    'scripts/provision-physio-r1-comparison-access.mjs',
    'scripts/physio-exact-image-canary.mjs',
    'server/tests/fixtures/physio-exact-image-canary/synthetic-physio-canary.wav',
    'packages/profession-config/professions/physiotherapy.mjs',
    'dist/index.html',
  ]) assert.ok(paths.includes(required), `missing ${required}`);

  for (const forbidden of [
    /^server\/mocks(?:\/|$)/,
    /^server\/selftest\.mjs$/,
    /^server\/tests\/(?!fixtures\/physio-exact-image-canary\/synthetic-physio-canary\.wav$)/,
    /^server\/functions\/epMaintenanceRegistry\.mjs$/,
    /^src\/(?:pages|components)(?:\/|$)/,
    /^packages\/profession-config\/professions\/exercise-physiology\.mjs$/,
    /^(?:e2e|\.github)(?:\/|$)/,
    /\.map$/,
  ]) assert.equal(paths.some((entry) => forbidden.test(entry)), false, `forbidden ${forbidden}`);

  const actualFiles = [];
  const pending = [outputRoot];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile()) actualFiles.push(path.relative(outputRoot, absolute).replaceAll('\\', '/'));
      else assert.fail(`unexpected runtime tree entry ${absolute}`);
    }
  }
  assert.deepEqual(
    actualFiles.sort(),
    [...paths, 'physio-runtime-manifest.json'].sort(),
  );
});
