import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (name) => fs.readFileSync(path.join(repoRoot, name), 'utf8');

test('Physio image is an immutable, fail-closed target build', () => {
  const dockerfile = read('Dockerfile.physio');
  assert.match(dockerfile, /^FROM node:24-slim@sha256:[0-9a-f]{64} AS build-base$/m);
  assert.match(dockerfile, /^FROM build-base AS build-runtime$/m);
  assert.match(dockerfile, /^FROM scratch AS sourcemap-evidence$/m);
  assert.match(dockerfile, /^FROM node:24-slim@sha256:[0-9a-f]{64} AS runtime$/m);
  assert.match(dockerfile, /PROFESSION=physio/);
  assert.match(dockerfile, /DEFAULT_APP_ID=local-assesssuite-physio/);
  assert.match(dockerfile, /VITE_BASE44_APP_ID=local-assesssuite-physio/);
  assert.match(dockerfile, /VITE_SENTRY_ENVIRONMENT=physio-production/);
  assert.match(dockerfile, /RUN npm run catalogue:physio:check/);
  assert.match(dockerfile, /RUN npm run build:physio/);
  assert.doesNotMatch(dockerfile, /RUN npm run build\s*$/m);
  assert.equal((dockerfile.match(/RUN npm run build:physio/g) || []).length, 1);
  assert.match(
    dockerfile,
    /RUN NODE_ENV=production node scripts\/build-physio-runtime-tree\.mjs --output \/app\/\.physio-runtime/,
  );
  assert.match(dockerfile, /npm prune --omit=dev/);
  assert.match(dockerfile, /COPY --from=build-runtime \/app\/node_modules \.\/node_modules/);
  assert.match(dockerfile, /COPY --from=build-runtime \/app\/\.physio-runtime\/ \.\//);
  assert.doesNotMatch(dockerfile, /COPY --from=build-runtime \/app\/(?:server|src|packages|scripts|dist)(?:\s|\/)/);
  assert.doesNotMatch(dockerfile, /COPY --from=build(?:-runtime)? \/app \/app/);
  assert.doesNotMatch(dockerfile, /COPY --from=build-runtime .*Dockerfile|fly\.physio\.production\.toml/);
  assert.match(
    dockerfile,
    /CMD \["sh", "-c", "node server\/productionBootstrap\.mjs && exec node server\/index\.mjs"\]/,
  );
});

test('Physio runtime tree builder enforces the exact pruned source boundary', () => {
  const builder = read('scripts/build-physio-runtime-tree.mjs');
  for (const requiredRoot of [
    'server/productionBootstrap.mjs',
    'server/index.mjs',
    'server/functions/index.mjs',
    'server/functions/transcribeSession.mjs',
    'scripts/provision-physio-r1-comparison-access.mjs',
    'scripts/physio-exact-image-canary.mjs',
  ]) {
    assert.match(builder, new RegExp(requiredRoot.replace(/[./]/g, '\\$&')));
  }
  assert.match(builder, /physio-runtime-tree\/1\.0\.0/);
  assert.match(builder, /server\\\/mocks/);
  assert.match(builder, /server\\\/selftest/);
  assert.match(builder, /epMaintenanceRegistry/);
  assert.ok(builder.includes('/^src\\/(?:pages|components)'));
  assert.match(builder, /\.map\$/);
  assert.match(builder, /isSymbolicLink\(\)/);
  assert.match(builder, /COPYFILE_EXCL/);
  assert.match(builder, /manifest_sha256/);
});

test('Physio Fly topology is isolated from EP and exposes required real capabilities', () => {
  const physio = read('fly.physio.production.toml');
  const ep = read('fly.production.toml');
  assert.match(physio, /^app = "assesssuite-physio-production"$/m);
  assert.match(physio, /^primary_region = "syd"$/m);
  assert.match(physio, /^\s*dockerfile = "Dockerfile\.physio"$/m);
  assert.match(physio, /^\s*PROFESSION = "physio"$/m);
  assert.match(physio, /^\s*DEFAULT_APP_ID = "local-assesssuite-physio"$/m);
  assert.match(physio, /^\s*EXPECTED_APP_URL = "https:\/\/physio\.app\.assesssuite\.com"$/m);
  assert.match(physio, /^\s*UPLOADS_DIR = "\/app\/server\/data\/physio-uploads"$/m);
  assert.match(physio, /^\s*source = "assesssuite_physio_data"$/m);
  assert.match(physio, /^\s*LLM_REQUIRED = "1"$/m);
  assert.match(physio, /^\s*GENERAL_CLINICAL_LLM_ENABLED = "1"$/m);
  assert.match(physio, /^\s*TRANSCRIPTION_ENABLED = "1"$/m);
  assert.match(physio, /^\s*DOCUMENT_EXTRACTION_ENABLED = "1"$/m);
  assert.match(physio, /^\s*PAYMENTS_ENABLED = "1"$/m);
  assert.match(physio, /^\s*OUTBOUND_EMAIL_ENABLED = "1"$/m);
  assert.match(physio, /^\s*OUTBOUND_SMS_ENABLED = "0"$/m);
  assert.doesNotMatch(physio, /ASSESSSUITE_DB_PATH/);
  assert.doesNotMatch(physio, /assesssuite_data_r12/);
  assert.doesNotMatch(physio, /(?:sk_(?:live|test)|whsec_|OPENAI_API_KEY\s*=|STRIPE_SECRET_KEY\s*=|RESEND_API_KEY\s*=)/);

  assert.match(ep, /^app = "assesssuite-production"$/m);
  assert.match(ep, /^\s*source = "assesssuite_data_r12"$/m);
  assert.doesNotMatch(ep, /assesssuite-physio-production|assesssuite_physio_data/);
});
