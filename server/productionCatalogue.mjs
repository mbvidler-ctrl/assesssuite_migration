import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

import { createEntityRepository } from './db.mjs';
import { buildRuntimeAssessmentCatalogue } from './runtimeCatalogue.mjs';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));

const PRODUCTION_EXERCISE_CATALOGUE = Object.freeze([
  Object.freeze({ name: 'Sit to Stand', description: 'Client rises from a seated position to standing and returns to seated, controlling the descent.', category: 'Strength', target_muscles: ['quadriceps', 'gluteals'], equipment_needed: ['chair'], difficulty_level: 'Beginner', reps_range: '8-12', sets_range: '2-3', rest_period: '60 seconds', search_tags: ['functional', 'lower_limb'] }),
  Object.freeze({ name: 'Wall Push-Up', description: 'Client stands facing a wall, hands at shoulder height, and performs a push-up against the wall.', category: 'Strength', target_muscles: ['pectorals', 'triceps'], equipment_needed: [], difficulty_level: 'Beginner', reps_range: '10-15', sets_range: '2-3', rest_period: '45 seconds', search_tags: ['upper_limb', 'low_impact'] }),
  Object.freeze({ name: 'Seated Marching', description: 'Client alternately lifts each knee while seated, maintaining an upright posture.', category: 'Cardio', target_muscles: ['hip_flexors'], equipment_needed: ['chair'], difficulty_level: 'Beginner', reps_range: '20-30', sets_range: '2', rest_period: '30 seconds', search_tags: ['seated', 'cardio', 'low_impact'] }),
  Object.freeze({ name: 'Single-Leg Balance', description: 'Client stands unsupported on one leg for as long as safely tolerated, progressing to eyes closed.', category: 'Balance', target_muscles: ['ankle_stabilisers', 'gluteus_medius'], equipment_needed: [], difficulty_level: 'Intermediate', duration_range: '10-30 seconds per side', rest_period: '30 seconds', search_tags: ['balance', 'falls_prevention'] }),
]);

function treatmentProtocolCatalogue() {
  const directory = path.join(serverDirectory, 'data-import');
  const files = fs.readdirSync(directory)
    .filter((name) => /^treatmentprotocol-part-\d+\.jsonl$/.test(name))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
  if (files.length === 0) throw new Error('Production treatment protocol catalogue is missing');
  const protocols = [];
  const names = new Set();
  for (const file of files) {
    for (const [lineIndex, line] of fs.readFileSync(path.join(directory, file), 'utf8')
      .split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${lineIndex + 1}: invalid treatment protocol JSON (${error.message})`);
      }
      if (!record?.condition_name || record.is_deleted === true || names.has(record.condition_name)) continue;
      names.add(record.condition_name);
      protocols.push(record);
    }
  }
  if (protocols.length === 0) throw new Error('Production treatment protocol catalogue is empty');
  return protocols;
}

function recordData(record) {
  const {
    id: _id,
    created_date: _createdDate,
    updated_date: _updatedDate,
    created_by: _createdBy,
    ...data
  } = record || {};
  return data;
}

function indexUnique(records, keyField, label) {
  const indexed = new Map();
  for (const record of records) {
    const key = record?.[keyField];
    if (typeof key !== 'string' || key.trim() === '') continue;
    if (indexed.has(key)) {
      throw new Error(`${label} contains duplicate ${keyField}: ${key}`);
    }
    indexed.set(key, record);
  }
  return indexed;
}

function seedCatalogue({ repository, entityName, keyField, records, reconcileExisting = false }) {
  const existing = repository.listAll();
  const existingByKey = indexUnique(existing, keyField, `Persisted ${entityName} catalogue`);
  const incomingByKey = indexUnique(records, keyField, `Bundled ${entityName} catalogue`);
  if (incomingByKey.size !== records.length) {
    throw new Error(`Bundled ${entityName} catalogue contains a record without ${keyField}`);
  }

  let inserted = 0;
  let reconciled = 0;
  let retained = 0;
  for (const record of records) {
    const persisted = existingByKey.get(record[keyField]);
    if (!persisted) {
      repository.create(record, null);
      inserted += 1;
      continue;
    }
    if (reconcileExisting && !isDeepStrictEqual(recordData(persisted), record)) {
      repository.replace(persisted.id, record);
      reconciled += 1;
      continue;
    }
    retained += 1;
  }
  return Object.freeze({ inserted, reconciled, retained });
}

export function runProductionCatalogueSeed({ db, entityNames, environment = process.env }) {
  if (!db || !(entityNames instanceof Set)) {
    throw new TypeError('production catalogue seed requires an open database and entity-name set');
  }
  const assessmentCatalogue = buildRuntimeAssessmentCatalogue(environment).assessments;
  const canonicalPhysioAssessmentCatalogue = assessmentCatalogue.length > 0
    && assessmentCatalogue.every((record) => (
      typeof record?.canonical_id === 'string' && record.canonical_id.trim() !== ''
    ));
  const catalogues = [
    ['Assessment', canonicalPhysioAssessmentCatalogue ? 'canonical_id' : 'name', assessmentCatalogue,
      canonicalPhysioAssessmentCatalogue],
    ['Exercise', 'name', PRODUCTION_EXERCISE_CATALOGUE, false],
    ['TreatmentProtocol', 'condition_name', treatmentProtocolCatalogue(), false],
  ];

  db.exec('BEGIN IMMEDIATE');
  try {
    const results = {};
    for (const [entityName, keyField, records, reconcileExisting] of catalogues) {
      if (!entityNames.has(entityName)) {
        throw new Error(`production catalogue entity is unavailable: ${entityName}`);
      }
      const repository = createEntityRepository(db, entityName);
      results[entityName] = seedCatalogue({
        repository,
        entityName,
        keyField,
        records,
        reconcileExisting,
      });
    }
    db.exec('COMMIT');
    return Object.freeze({
      assessment_count: assessmentCatalogue.length,
      exercise_count: PRODUCTION_EXERCISE_CATALOGUE.length,
      treatment_protocol_count: treatmentProtocolCatalogue().length,
      assessment_inserted: results.Assessment.inserted,
      assessment_reconciled: results.Assessment.reconciled,
      assessment_retained: results.Assessment.retained,
      treatment_protocol_inserted: results.TreatmentProtocol.inserted,
      treatment_protocol_retained: results.TreatmentProtocol.retained,
    });
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* preserve the seed failure */ }
    throw error;
  }
}
