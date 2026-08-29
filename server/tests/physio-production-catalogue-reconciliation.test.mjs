import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createEntityRepository } from '../db.mjs';
import { runProductionCatalogueSeed } from '../productionCatalogue.mjs';
import { buildRuntimeAssessmentCatalogue } from '../runtimeCatalogue.mjs';
import { catalogueChecksum } from '../runtimeStatus.mjs';

const catalogueEntities = new Set(['Assessment', 'Exercise', 'TreatmentProtocol']);

function createEntityTable(db, entityName) {
  db.exec(`
    CREATE TABLE entity_${entityName} (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT
    )
  `);
}

function createFixtureDatabase() {
  const db = new DatabaseSync(':memory:');
  for (const entityName of [
    ...catalogueEntities,
    'Organization',
    'User',
    'Client',
    'ClientAssessment',
  ]) createEntityTable(db, entityName);
  return db;
}

function rawRows(db, entityName) {
  return db.prepare(`SELECT * FROM entity_${entityName} ORDER BY id`).all();
}

test('R3 startup reconciles stale Physio canonical definitions in place without changing clinical data', () => {
  const db = createFixtureDatabase();
  try {
    const assessmentRepository = createEntityRepository(db, 'Assessment');
    const current = buildRuntimeAssessmentCatalogue({ PROFESSION: 'physio' }).assessments;
    const persistedIds = new Map();
    for (const [index, assessment] of current.entries()) {
      const staleR1Definition = {
        ...structuredClone(assessment),
        description: `Persisted Revision 1 definition ${index}`,
      };
      const persisted = assessmentRepository.create(staleR1Definition, 'historic-bootstrap');
      persistedIds.set(assessment.canonical_id, persisted.id);
    }

    const organization = createEntityRepository(db, 'Organization').create({ name: 'Existing Physio' }, 'owner-1');
    const user = createEntityRepository(db, 'User').create({ email: 'clinician@example.test', org_id: organization.id }, 'owner-1');
    const client = createEntityRepository(db, 'Client').create({ full_name: 'Existing Client', org_id: organization.id }, user.id);
    const firstAssessmentId = persistedIds.get(current[0].canonical_id);
    createEntityRepository(db, 'ClientAssessment').create({
      org_id: organization.id,
      client_id: client.id,
      assessment_id: firstAssessmentId,
      status: 'completed',
      result_value: 42,
    }, user.id);
    const protectedBefore = Object.fromEntries(
      ['Organization', 'User', 'Client', 'ClientAssessment'].map((name) => [name, rawRows(db, name)]),
    );

    const result = runProductionCatalogueSeed({
      db,
      entityNames: catalogueEntities,
      environment: { PROFESSION: 'physio' },
    });

    assert.equal(result.assessment_count, 236);
    assert.equal(result.assessment_inserted, 0);
    assert.equal(result.assessment_reconciled, 236);
    assert.equal(result.assessment_retained, 0);
    const reconciled = assessmentRepository.listAll();
    assert.equal(reconciled.length, current.length);
    assert.equal(catalogueChecksum(reconciled.map(({ id, created_date, updated_date, created_by, ...data }) => data)), catalogueChecksum(current));
    for (const assessment of reconciled) {
      assert.equal(assessment.id, persistedIds.get(assessment.canonical_id));
    }
    for (const [entityName, before] of Object.entries(protectedBefore)) {
      assert.deepEqual(rawRows(db, entityName), before, entityName);
    }
    assert.equal(
      createEntityRepository(db, 'ClientAssessment').listAll()[0].assessment_id,
      firstAssessmentId,
    );

    const fullDatabaseBeforeSecondRun = Object.fromEntries(
      [...catalogueEntities, 'Organization', 'User', 'Client', 'ClientAssessment']
        .map((name) => [name, rawRows(db, name)]),
    );
    const second = runProductionCatalogueSeed({
      db,
      entityNames: catalogueEntities,
      environment: { PROFESSION: 'physio' },
    });
    assert.equal(second.assessment_inserted, 0);
    assert.equal(second.assessment_reconciled, 0);
    assert.equal(second.assessment_retained, 236);
    for (const [entityName, before] of Object.entries(fullDatabaseBeforeSecondRun)) {
      assert.deepEqual(rawRows(db, entityName), before, `${entityName} idempotency`);
    }
  } finally {
    db.close();
  }
});

test('Physio reconciliation neither claims nor removes non-canonical custom assessments', () => {
  const db = createFixtureDatabase();
  try {
    const repository = createEntityRepository(db, 'Assessment');
    runProductionCatalogueSeed({
      db,
      entityNames: catalogueEntities,
      environment: { PROFESSION: 'physio' },
    });
    const custom = repository.create({
      name: 'Organisation-specific functional screen',
      description: 'Locally maintained assessment',
      org_id: 'org-custom',
    }, 'owner-custom');
    const customBefore = db.prepare('SELECT * FROM entity_Assessment WHERE id = ?').get(custom.id);

    const result = runProductionCatalogueSeed({
      db,
      entityNames: catalogueEntities,
      environment: { PROFESSION: 'physio' },
    });

    assert.equal(result.assessment_reconciled, 0);
    assert.equal(repository.listAll().length, 237);
    assert.deepEqual(db.prepare('SELECT * FROM entity_Assessment WHERE id = ?').get(custom.id), customBefore);
  } finally {
    db.close();
  }
});

test('EP name-keyed catalogue retains its historical insert-only startup behavior', () => {
  const db = createFixtureDatabase();
  try {
    const repository = createEntityRepository(db, 'Assessment');
    const ep = buildRuntimeAssessmentCatalogue({}).assessments;
    const historic = repository.create({
      ...structuredClone(ep[0]),
      description: 'Existing EP-managed definition',
    }, 'existing-ep-owner');
    const historicBefore = db.prepare('SELECT * FROM entity_Assessment WHERE id = ?').get(historic.id);

    const result = runProductionCatalogueSeed({
      db,
      entityNames: catalogueEntities,
      environment: {},
    });

    assert.equal(result.assessment_reconciled, 0);
    assert.equal(repository.listAll().length, ep.length);
    assert.deepEqual(db.prepare('SELECT * FROM entity_Assessment WHERE id = ?').get(historic.id), historicBefore);
  } finally {
    db.close();
  }
});
