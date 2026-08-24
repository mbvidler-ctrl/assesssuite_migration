import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createPageUrl } from '../../src/utils/index.ts';

const readSource = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('page URLs normalize only the pathname and preserve case-sensitive query and fragment data', () => {
  assert.equal(
    createPageUrl('Test Runner?clientAssessmentId=ABC&careEpisodeId=DEF#proof'),
    '/test-runner?clientAssessmentId=ABC&careEpisodeId=DEF#proof',
  );
  assert.equal(createPageUrl('Client Profile?id=CaseSensitive'), '/client-profile?id=CaseSensitive');
});

test('appointment-launched assessment returns to and reopens the exact appointment', async () => {
  const [appointmentModal, calendar] = await Promise.all([
    readSource('src/components/calendar/AppointmentModal.jsx'),
    readSource('src/pages/Calendar.jsx'),
  ]);

  assert.match(appointmentModal, /Calendar\?openAppointmentId=\$\{appointment\.id\}/);
  assert.match(calendar, /searchParams\.get\("openAppointmentId"\)/);
  assert.match(calendar, /events\.find\(\(event\) => event\.id === openAppointmentId\)/);
  assert.match(calendar, /setModalInfo\(\{ isOpen: true, event: eventToOpen \}\)/);
  assert.match(calendar, /newParams\.delete\("openAppointmentId"\)/);
});

test('runner completion preserves the exact Physio episode or EP client return identity', async () => {
  const [assessmentLibrary, testRunner] = await Promise.all([
    readSource('src/pages/AssessmentLibrary.jsx'),
    readSource('src/pages/TestRunner.jsx'),
  ]);

  assert.match(assessmentLibrary, /runnerParams\.set\('careEpisodeId', careEpisodeId\)/);
  assert.match(testRunner, /PhysioEpisodes\?client_id=\$\{clientAssessment\.client_id\}&episode_id=\$\{careEpisodeId\}/);
  assert.match(testRunner, /ClientProfile\?id=\$\{clientAssessment\.client_id\}/);
  assert.doesNotMatch(testRunner, /ClientProfile\?clientId=/);
});
