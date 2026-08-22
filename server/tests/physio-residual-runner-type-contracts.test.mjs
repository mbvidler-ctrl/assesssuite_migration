import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const RUNNER_FILES = Object.freeze([
  'StorkTestRunner.jsx',
  'TenMeterWalkRunner.jsx',
  'TrailMakingTestTMTPartsAandBRunner.jsx',
  'Astrand6MinuteCycleTestRunner.jsx',
  'BoxAndBlockRunner.jsx',
  'CycleProtocolRunner.jsx',
  'FunctionalReachRunner.jsx',
  'IncrementalShuttleWalkTestISWTRunner.jsx',
  'ISWTRunner.jsx',
  'OneRMRunner.jsx',
  'ThirtySecondChairStandTestRunner.jsx',
  'VerticalJumpTestSargentJumpRunner.jsx',
]);

function source(filename) {
  return fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
}

test('residual type-contract batch is bounded to the exact twelve non-active runner sources', () => {
  assert.equal(RUNNER_FILES.length, 12);
  assert.equal(new Set(RUNNER_FILES).size, 12);
  for (const filename of RUNNER_FILES) {
    assert.ok(source(filename).length > 500, `${filename} must remain a substantive production runner`);
  }
});

test('Stork and 1RM state shapes retain every field rendered and persisted by their production UI', () => {
  const stork = source('StorkTestRunner.jsx');
  assert.match(stork, /result:\s*initialData\?\.result\s*\|\|\s*["']["']/);
  assert.match(stork, /result:\s*data\.result/);
  assert.match(stork, /disabled=\{!data\.result\}/);

  const oneRm = source('OneRMRunner.jsx');
  assert.ok((oneRm.match(/custom_exercise:\s*["']["']/g) || []).length >= 2, 'initial and reset state must both declare custom_exercise');
  assert.match(oneRm, /currentExercise\.exercise_name === ["']Other["']\s*\?\s*currentExercise\.custom_exercise\.trim\(\)/s);
  assert.match(oneRm, /exercise_name:\s*exerciseName/);
  assert.match(oneRm, /setCurrentExercise\(\{\.\.\.currentExercise, custom_exercise: e\.target\.value\}\)/);
  assert.doesNotMatch(oneRm, /custom_exercise[^\n]*onChange[^\n]*exercise_name:/s);
});

test('numeric runner calculations keep numeric values numeric through calculation and persistence', () => {
  const tenMetre = source('TenMeterWalkRunner.jsx');
  assert.match(tenMetre, /return Number\(avgSpeed\.toFixed\(2\)\)/);
  assert.match(tenMetre, /return Number\(\(sum \/ trials\.length\)\.toFixed\(2\)\)/);
  assert.match(tenMetre, /result_value:\s*avgSpeed/);
  assert.doesNotMatch(tenMetre, /parseFloat\(avg(?:Speed|Time)\)/);

  const reach = source('FunctionalReachRunner.jsx');
  assert.match(reach, /return Number\(\(sum \/ trials\.length\)\.toFixed\(1\)\)/);
  assert.match(reach, /result_value:\s*avgReach/);
  assert.doesNotMatch(reach, /parseFloat\(avgReach\)/);

  const astrand = source('Astrand6MinuteCycleTestRunner.jsx');
  assert.match(astrand, /const avgHeartRate = Number\(heartRate\)/);
  assert.match(astrand, /const workloadWatts = Number\(workload\)/);
  assert.doesNotMatch(astrand, /heartRate\.reduce\(/);

  const cycle = source('CycleProtocolRunner.jsx');
  assert.match(cycle, /220 - Number\(age \|\| 30\)/);
  assert.match(cycle, /Number\(weight \|\| 70\)/);
});

test('DOM, date and Web Audio contracts use their actual browser and JavaScript types', () => {
  const trail = source('TrailMakingTestTMTPartsAandBRunner.jsx');
  assert.match(trail, /e\.currentTarget\.style\.display/);
  assert.match(trail, /new Date\(client\.date_of_birth\)\.getTime\(\)/);
  assert.match(trail, /Number\.isNaN\(Number\(n\)\)/);

  for (const filename of [
    'BoxAndBlockRunner.jsx',
    'ThirtySecondChairStandTestRunner.jsx',
    'VerticalJumpTestSargentJumpRunner.jsx',
  ]) {
    const runner = source(filename);
    assert.match(runner, /Date\.now\(\) - new Date\(client\.date_of_birth\)\.getTime\(\)/, filename);
  }

  for (const filename of ['IncrementalShuttleWalkTestISWTRunner.jsx', 'ISWTRunner.jsx']) {
    const runner = source(filename);
    assert.match(runner, /webkitAudioContext\?: typeof AudioContext/);
    assert.match(runner, /if \(!AudioContextConstructor\) throw new Error\(["']Web Audio API is unavailable in this browser["']\)/);
    assert.match(runner, /new AudioContextConstructor\(\)/);
    assert.doesNotMatch(runner, /window\.AudioContext \|\| window\.webkitAudioContext/);
  }
});
