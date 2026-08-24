import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  resolveRegisteredAssessmentScorer,
  validateAndScoreRegisteredAssessment,
} from '../../src/lib/clinical/assessmentScorerRegistry.js';
import {
  buildTudsFixture,
  TUDS_RUNNER_SPEC,
  validateAndScoreTuds,
} from '../../src/lib/clinical/tuds.js';

const CONTEXT = Object.freeze({
  assessmentName: 'Timed Up and Down Stairs (TUDS)',
  assessmentDate: '2026-08-22',
});

test('TUDS shared spec retains the source-backed 14-step protocol fields', () => {
  assert.equal(TUDS_RUNNER_SPEC.runnerKey, 'tuds');
  assert.equal(TUDS_RUNNER_SPEC.scoringKey, 'timed-up-and-down-stairs');
  assert.equal(TUDS_RUNNER_SPEC.fields.find(({ key }) => key === 'num_stairs').default, 14);
  const trials = TUDS_RUNNER_SPEC.fields.find(({ key }) => key === 'trials');
  assert.equal(trials.minItems, 1);
  assert.equal(trials.maxItems, 10);
  assert.deepEqual(trials.items.map(({ key }) => key), ['trial', 'time', 'timestamp']);
  assert.equal(TUDS_RUNNER_SPEC.scoring.method, 'arithmetic-mean-and-minimum');
  assert.equal(TUDS_RUNNER_SPEC.scoring.version, 'tuds-time-v1');
  assert.equal(resolveRegisteredAssessmentScorer('timed-up-and-down-stairs').runnerSpec, TUDS_RUNNER_SPEC);
});

test('TUDS validates trials and scores the exact average and best time without invented bands', () => {
  const payload = validateAndScoreTuds(buildTudsFixture(), CONTEXT);
  assert.equal(payload.status, 'completed');
  assert.equal(payload.result_value, 12.1);
  assert.equal(payload.additional_data.average_time, 12.1);
  assert.equal(payload.additional_data.best_time, 11.8);
  assert.equal(payload.additional_data.num_stairs, 14);
  assert.equal(payload.additional_data.scoring_key, 'timed-up-and-down-stairs');
  assert.equal('interpretation' in payload.additional_data, false);
  assert.doesNotMatch(payload.additional_data.soap_text, /excellent|good|moderate|limited|fall risk/i);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});

test('TUDS production registry invokes the same scorer and rejects invalid inputs', () => {
  const fixture = buildTudsFixture();
  assert.deepEqual(
    validateAndScoreRegisteredAssessment('timed-up-and-down-stairs', fixture, CONTEXT),
    validateAndScoreTuds(fixture, CONTEXT),
  );
  assert.throws(() => validateAndScoreTuds({ ...fixture, trials: [] }, CONTEXT), /At least one/);
  assert.throws(() => validateAndScoreTuds({ ...fixture, trials: [0] }, CONTEXT), /0\.01/);
  assert.throws(() => validateAndScoreTuds({ ...fixture, num_stairs: 14.5 }, CONTEXT), /whole number/);
  assert.throws(() => validateAndScoreTuds({ ...fixture, handrail_use: 'unknown' }, CONTEXT), /not a permitted choice/);
});

test('TUDS rendered runner calls the shared scorer and has no hard-coded severity thresholds', () => {
  const source = fs.readFileSync(
    new URL('../../src/components/assessments/TUDSRunner.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /validateAndScoreTuds\(/);
  assert.match(source, /useState\("14"\)/);
  assert.doesNotMatch(source, /Excellent functional mobility|Good functional mobility|Limited functional mobility/);
  assert.doesNotMatch(source, /avgTime\s*<\s*(8|12|15)/);
});
