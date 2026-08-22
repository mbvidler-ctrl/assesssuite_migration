// Frozen, wholly synthetic speech fixture for the exact-image provider canary.
// The content is deliberately non-clinical and contains no person identifier.
// Workflow logs must use only the byte count and SHA-256, never the marker.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHYSIO_CANARY_AUDIO_FIXTURE_CONTRACT =
  'assesssuite-physio-synthetic-audio-fixture/1.0.0';
export const PHYSIO_CANARY_AUDIO_RELATIVE_PATH =
  'server/tests/fixtures/physio-exact-image-canary/synthetic-physio-canary.wav';
export const PHYSIO_CANARY_AUDIO_EXPECTED_MARKER =
  'synthetic physio canary orange river cedar';
export const PHYSIO_CANARY_AUDIO_SHA256 =
  '8f6d93b8df7927bb5d4c03778a05e247edeb30f80ee82ef1233deffad6cc1d02';
export const PHYSIO_CANARY_AUDIO_BYTES = 162_506;
export const PHYSIO_CANARY_AUDIO_MIME = 'audio/wav';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function physioCanaryAudioPath(repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)) {
  return path.resolve(repoRoot, PHYSIO_CANARY_AUDIO_RELATIVE_PATH);
}

export function readAndValidatePhysioCanaryAudioFixture(repoRoot) {
  const root = path.resolve(repoRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const resolved = physioCanaryAudioPath(root);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TypeError('Physio canary audio fixture escapes the repository');
  }
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== PHYSIO_CANARY_AUDIO_BYTES) {
    throw new TypeError('Physio canary audio fixture byte count differs');
  }
  const bytes = fs.readFileSync(resolved);
  if (sha256(bytes) !== PHYSIO_CANARY_AUDIO_SHA256 ||
      bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      bytes.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new TypeError('Physio canary audio fixture content differs');
  }
  return Object.freeze({
    contract: PHYSIO_CANARY_AUDIO_FIXTURE_CONTRACT,
    path: resolved,
    relativePath: PHYSIO_CANARY_AUDIO_RELATIVE_PATH,
    expectedMarker: PHYSIO_CANARY_AUDIO_EXPECTED_MARKER,
    sha256: PHYSIO_CANARY_AUDIO_SHA256,
    byteLength: PHYSIO_CANARY_AUDIO_BYTES,
    mime: PHYSIO_CANARY_AUDIO_MIME,
    bytes,
  });
}
