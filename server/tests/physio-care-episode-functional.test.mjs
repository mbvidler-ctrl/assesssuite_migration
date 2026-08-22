import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  completeDischarge,
  createEpisodeDraft,
  deriveEncounters,
  deriveOutcomeMeasures,
  normalizeEpisode,
  prepareEpisodePayload,
  reopenEpisode,
} from '../../src/lib/physio/careEpisode.js';
import {
  createEntityRepository,
  loadEntityNames,
  loadOrgScopedEntities,
  openDatabase,
} from '../db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('PhysioCareEpisode is registered and inherits fail-closed organisation scoping', () => {
  assert.ok(loadEntityNames().includes('PhysioCareEpisode'));
  assert.ok(loadOrgScopedEntities().has('PhysioCareEpisode'));
});

test('care episode schema captures the full persisted care cycle', () => {
  const schema = JSON.parse(read('base44', 'entities', 'PhysioCareEpisode.jsonc'));
  const requiredGroups = [
    'referral',
    'red_flag_screen',
    'subjective_examination',
    'objective_examination',
    'initial_findings',
    'goals',
    'outcome_measures',
    'encounters',
    'home_programs',
    'reporting',
    'status_history',
  ];
  for (const group of requiredGroups) {
    assert.ok(schema.properties[group], `missing ${group}`);
  }
  assert.deepEqual(schema.required, [
    'schema_version',
    'org_id',
    'client_id',
    'episode_number',
    'status',
    'status_history',
    'episode_start_date',
  ]);
});

test('existing databases migrate forward by creating a durable care-episode table', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-'));
  const dbPath = path.join(tempRoot, 'physio-contract.db');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ASSESSSUITE_DB_PATH: process.env.ASSESSSUITE_DB_PATH,
    ASSESSSUITE_DB_PATH_ACK: process.env.ASSESSSUITE_DB_PATH_ACK,
  };

  process.env.NODE_ENV = 'test';
  process.env.ASSESSSUITE_DB_PATH = dbPath;
  process.env.ASSESSSUITE_DB_PATH_ACK =
    'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

  let db;
  try {
    ({ db } = openDatabase());
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entity_PhysioCareEpisode'")
      .get();
    assert.equal(table?.name, 'entity_PhysioCareEpisode');

    const repository = createEntityRepository(db, 'PhysioCareEpisode');
    const created = repository.create({
      schema_version: 3,
      org_id: 'org-physio-a',
      client_id: 'client-1',
      episode_number: 1,
      status: 'active',
      episode_start_date: '2026-08-21',
      subjective_examination: { completion_status: 'complete' },
    }, 'physio@example.test');

    assert.equal(repository.getById(created.id).org_id, 'org-physio-a');
    const updated = repository.update(created.id, {
      reporting: { discharge_status: 'planning' },
    });
    assert.equal(updated.reporting.discharge_status, 'planning');
  } finally {
    db?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('outcome derivation keeps the complete assessment set and longitudinal links', () => {
  const catalogue = Array.from({ length: 12 }, (_, index) => ({
    id: `assessment-${index + 1}`,
    name: `Measure ${index + 1}`,
    unit_of_measure: 'points',
  }));
  const records = catalogue.flatMap((assessment, index) => [
    {
      id: `baseline-${index}`,
      assessment_id: assessment.id,
      assessment_date: '2026-01-01',
      status: 'completed',
      result_value: index,
    },
    {
      id: `review-${index}`,
      assessment_id: assessment.id,
      assessment_date: '2026-02-01',
      status: 'completed',
      result_value: index + 2,
    },
  ]);

  const outcomes = deriveOutcomeMeasures(records, catalogue, (prefix) => `${prefix}-fixed`);
  assert.equal(outcomes.length, 12, 'the episode must not truncate an extensive library to eight measures');
  assert.deepEqual(outcomes[0].client_assessment_ids, ['baseline-0', 'review-0']);
  assert.equal(outcomes[0].baseline_value, 0);
  assert.equal(outcomes[0].current_value, 2);
});

test('episode creation, payload preparation and discharge preserve lifecycle invariants', () => {
  const draft = createEpisodeDraft({
    client: {
      id: 'client-1',
      referral_reason: 'Return to running',
      referral_source: 'gp',
      funding_source: 'private_health',
    },
    episodeNumber: 3,
    orgId: 'org-1',
    primaryPractitionerId: 'physio-user-1',
    now: new Date('2026-08-21T01:00:00.000Z'),
  });

  assert.equal(draft.schema_version, 3);
  assert.equal(draft.episode_number, 3);
  assert.equal(draft.primary_practitioner_id, 'physio-user-1');
  assert.equal(draft.initial_findings.red_flag_status, 'not_recorded');

  const payload = prepareEpisodePayload({
    ...draft,
    id: 'sdk-id',
    created_date: 'ignored',
    updated_date: '2026-08-21T23:59:00.000Z',
    referral: { ...draft.referral, approved_sessions: '6', sessions_used: '2' },
  }, {
    orgId: 'org-1',
    clientId: 'client-1',
    now: new Date('2026-08-22T01:00:00.000Z'),
  });

  assert.equal('id' in payload, false);
  assert.equal(payload.expected_updated_date, '2026-08-21T23:59:00.000Z');
  assert.equal(payload.referral.approved_sessions, 6);
  assert.equal(payload.referral.sessions_used, 2);

  const persisted = {
    ...payload,
    id: 'episode-1',
    updated_date: '2026-08-22T01:00:00.000Z',
  };
  const discharged = completeDischarge(persisted, {
    reason: 'Treatment goals achieved',
    dischargeDate: '2026-09-30',
  });
  assert.equal(discharged.status, 'discharged');
  assert.equal(discharged.reporting.discharge_status, 'completed');
  assert.equal(discharged.reporting.discharge_date, '2026-09-30');
  assert.deepEqual(discharged.lifecycle_transition, {
    from: 'active',
    to: 'discharged',
    reason: 'Treatment goals achieved',
    expected_updated_date: '2026-08-22T01:00:00.000Z',
  });

  const reopened = reopenEpisode({
    ...discharged,
    updated_date: '2026-09-30T01:00:00.000Z',
  }, { reason: 'Symptoms recurred' });
  assert.equal(reopened.status, 'active');
  assert.equal(reopened.reporting.discharge_status, 'not_ready');
  assert.equal(reopened.reporting.discharge_date, '');
  assert.equal(reopened.lifecycle_transition.from, 'discharged');
});

test('normalisation and encounter derivation provide stable nested identifiers without truncation', () => {
  let sequence = 0;
  const normalized = normalizeEpisode({
    goals: [{ description: 'Walk 2 km' }],
    outcome_measures: [],
    encounters: [],
    home_programs: [],
  }, (prefix) => `${prefix}-${++sequence}`);
  assert.equal(normalized.goals[0].id, 'goal-1');

  const notes = Array.from({ length: 15 }, (_, index) => ({
    id: `note-${index}`,
    note_date: `2026-08-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
    assessment: `Review ${index}`,
  }));
  const encounters = deriveEncounters(notes, (prefix) => `${prefix}-${++sequence}`);
  assert.equal(encounters.length, 15);
  assert.equal(encounters.at(-1).type, 'initial');
});
