import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { openDatabase } from '../db.mjs';
import { buildSyntheticDemoContent, runSeed } from '../seed.mjs';

const expectedEpProfiles = {
  alphaOwner: {
    qualifications: 'BExSc, AEP',
    registration_number: 'AEP-ALPHA-001',
    clinic_name: 'Org Alpha Exercise Physiology',
  },
  alphaClinician: {
    qualifications: 'BExSc (Hons), AEP',
    registration_number: 'AEP-ALPHA-002',
    clinic_name: 'Org Alpha Exercise Physiology',
  },
  betaOwner: {
    qualifications: 'BAppSc (ExSpSc), AEP',
    registration_number: 'AEP-BETA-001',
    clinic_name: 'Org Beta Allied Health',
  },
  betaClinician: {
    qualifications: 'BExSc, AEP',
    registration_number: 'AEP-BETA-002',
    clinic_name: 'Org Beta Allied Health',
  },
};

test('default and explicit EP synthetic fixtures retain their established profile and clinical copy', () => {
  const expected = {
    professionId: 'exercise-physiology',
    practitionerProfession: 'Exercise Physiologist',
    referralReason: 'Functional decline requiring exercise physiology review',
    ndisSupportRecommendations: 'Weekly exercise physiology, home exercise programme review',
    appointmentNotes: 'Initial exercise physiology assessment and goal-setting.',
    assessmentPhrase: 'exercise physiology assessment',
    assessmentPhraseWithArticle: 'an exercise physiology assessment',
    managementPhrase: 'exercise physiology management',
    programmePhrase: 'exercise programme',
    userProfiles: expectedEpProfiles,
  };
  assert.deepEqual(buildSyntheticDemoContent({}), expected);
  assert.deepEqual(buildSyntheticDemoContent({ PROFESSION: 'exercise-physiology' }), expected);
});

test('Physio synthetic fixtures use Physio credentials and discipline wording throughout', () => {
  const physio = buildSyntheticDemoContent({ PROFESSION: 'physio' });
  assert.equal(physio.professionId, 'physio');
  assert.equal(physio.practitionerProfession, 'Physiotherapist');
  assert.equal(physio.referralReason, 'Functional decline requiring physiotherapy review');
  assert.equal(physio.ndisSupportRecommendations, 'Weekly physiotherapy, home exercise programme review');
  assert.equal(physio.appointmentNotes, 'Initial physiotherapy assessment and goal-setting.');
  assert.equal(physio.assessmentPhraseWithArticle, 'a physiotherapy assessment');
  assert.equal(physio.managementPhrase, 'physiotherapy management');
  assert.equal(physio.programmePhrase, 'management plan');
  assert.deepEqual(Object.values(physio.userProfiles).map((profile) => profile.registration_number), [
    'PHY0001234567',
    'PHY0001234568',
    'PHY0001234569',
    'PHY0001234570',
  ]);
  assert.doesNotMatch(JSON.stringify(physio), /Exercise Physiolog|\bAEP\b|BExSc/);
});

test('full Physio synthetic seed persists only Physio profile, referral and demo-report wording', (t) => {
  t.mock.method(console, 'log', () => {});
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-seed-'));
  const databasePath = path.join(temporaryDirectory, 'physio-seed-proof.db');
  assert.ok(path.resolve(databasePath).startsWith(path.resolve(os.tmpdir()) + path.sep));

  const environmentKeys = [
    'SELFTEST',
    'NODE_ENV',
    'ASSESSSUITE_DB_PATH',
    'ASSESSSUITE_DB_PATH_ACK',
    'PROFESSION',
    'DEFAULT_APP_ID',
  ];
  const previousEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    SELFTEST: '1',
    NODE_ENV: 'test',
    ASSESSSUITE_DB_PATH: databasePath,
    ASSESSSUITE_DB_PATH_ACK: 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });

  let db;
  try {
    const opened = openDatabase();
    db = opened.db;
    const seeded = runSeed({ db, entityNames: opened.entityNames });
    assert.equal(seeded.users.alphaOwner.profession, 'Physiotherapist');
    assert.equal(seeded.users.alphaOwner.qualifications, 'Bachelor of Physiotherapy (Honours)');
    assert.equal(seeded.users.alphaOwner.registration_number, 'PHY0001234567');
    assert.equal(seeded.users.alphaOwner.clinic_name, 'Org Alpha Physiotherapy');
    assert.equal(seeded.clients.graceEllington.referral_reason, 'Functional decline requiring physiotherapy review');

    const persistedDemoJson = [
      'User',
      'Client',
      'Appointment',
      'ClientReport',
      'SavedReport',
    ].flatMap((entityName) => (
      db.prepare(`SELECT data FROM entity_${entityName}`).all().map(({ data }) => data)
    )).join('\n');
    assert.match(persistedDemoJson, /Initial physiotherapy assessment and goal-setting/);
    assert.match(persistedDemoJson, /Following a physiotherapy assessment, a progressive management plan/);
    assert.doesNotMatch(persistedDemoJson, /Exercise Physiolog|exercise physiolog|\bAEP\b|BExSc/);
  } finally {
    db?.close();
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const resolvedTemporaryDirectory = path.resolve(temporaryDirectory);
    assert.ok(resolvedTemporaryDirectory.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolvedTemporaryDirectory, { recursive: true, force: true });
  }
});
