import fs from 'node:fs';
import path from 'node:path';
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
export function runProductionCatalogueSeed({ db, entityNames, environment = process.env }) {
  if (!db || !(entityNames instanceof Set)) {
    throw new TypeError('production catalogue seed requires an open database and entity-name set');
  }
  const assessmentCatalogue = buildRuntimeAssessmentCatalogue(environment).assessments;
  const catalogues = [
    ['Assessment', 'name', assessmentCatalogue],
    ['Exercise', 'name', PRODUCTION_EXERCISE_CATALOGUE],
    ['TreatmentProtocol', 'condition_name', treatmentProtocolCatalogue()],
  ];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [entityName, keyField, records] of catalogues) {
      if (!entityNames.has(entityName)) {
        throw new Error(`production catalogue entity is unavailable: ${entityName}`);
      }
      const repository = createEntityRepository(db, entityName);
      const existing = repository.listAll();
      const existingKeys = new Set(existing.map((record) => record?.[keyField]).filter(Boolean));
      for (const record of records) {
        if (!existingKeys.has(record[keyField])) repository.create(record, null);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* preserve the seed failure */ }
    throw error;
  }
  return Object.freeze({
    assessment_count: assessmentCatalogue.length,
    exercise_count: PRODUCTION_EXERCISE_CATALOGUE.length,
  });
}
