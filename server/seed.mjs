// Idempotent synthetic seed script for the local Base44 shim.
//
// Run: node server/seed.mjs
// Honours the exact same env conventions server/index.mjs and server/db.mjs
// already define — there is no separate "DB env var" in this codebase, so
// this seeder deliberately does not invent one (out of scope: "do NOT modify
// existing server/*.mjs beyond adding a seed entry point"). It shares
// server/db.mjs's openDatabase(), which:
//   - writes to server/data/app.db by default (same file the main server
//     reads/writes on PORT 8787 unless SELFTEST=1), or
//   - writes to a freshly-recreated server/data/selftest.db when
//     SELFTEST=1 is set in the environment (identical switch the main
//     server already honours).
//
// Dual entry point: this file is both directly runnable (`node
// server/seed.mjs`, which opens its own db handle via openDatabase() and
// seeds it — the normal path) AND importable as a module exporting
// `runSeed({ db, entityNames })`, which seeds an ALREADY-OPEN db handle
// without calling openDatabase() again. The second form exists because
// SELFTEST=1's openDatabase() unconditionally deletes and recreates the
// database file on every call (see server/db.mjs) — exactly the same
// Windows EPERM hazard already documented in server/functions/index.mjs's
// init(db, entityNames) pattern (a second independent DatabaseSync handle to
// a file the first process still holds open fails to delete it). scripts/
// smoke.mjs therefore starts the shim first (which opens+wipes+bootstraps
// the throwaway selftest.db), then calls this module's runSeed() against
// that same running process's db handle — never spawning this file as a
// second process against a SELFTEST db.
//
// Idempotency: every created record is looked up first by a stable natural
// key (email for Users, name for Organizations, a dedicated _seed_key for
// Clients — see seedClientCluster below). Re-running this script against a
// database that already contains the seed data is a no-op that reports what
// already existed.
//
// SYNTHETIC DATA ONLY. No real client, clinician, or organisation data of any
// kind is used or referenced.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { openDatabase, createEntityRepository } from './db.mjs';
import { hashPassword } from './auth.mjs';
import { buildDass21Payload } from '../src/lib/clinical/dass21.js';
import {
  CONTRACT_BUNDLE_IDS,
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
  fingerprint as legalContentFingerprint,
  isLegalDocumentPublicationApproved,
} from '../src/lib/legal/documentRegistry.js';
import { effectiveLegalContent } from '../src/lib/legal/effectiveContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

/**
 * Loads de-identified catalogue records imported from the client's live
 * application (JSON Lines under server/data-import/, one object per line;
 * authorised content-only import per mission UM-AUTO-20260707 Amendment 3).
 * Returns [] when the directory or files are absent, so the seed degrades to
 * the built-in synthetic catalogue with no import present.
 */
function loadImportedCatalogue(prefix) {
  const dir = path.join(__dirname, 'data-import');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.startsWith(prefix) || !file.endsWith('.jsonl')) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (rec && rec.is_deleted !== true) out.push(rec);
      } catch {
        /* skip malformed line */
      }
    }
  }
  return out;
}

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'SeedDemo!2026';

// ---------------------------------------------------------------------------
// Pure helpers (no db access) — dates, funding sub-structures, catalogues.
// ---------------------------------------------------------------------------

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoDateTime(year, month, day, hour = 9, minute = 0) {
  return `${isoDate(year, month, day)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

/**
 * Builds the funding-source-specific sub-structure for a Client record,
 * per the funding_source enum and its dependent fields in the captured
 * schema (docs/source-capture/20260702-live-entity-schemas.json).
 */
function fundingFields(fundingSource) {
  switch (fundingSource) {
    case 'dva':
      return {
        funding_source: 'dva',
        dva_card_number: 'DVA-SEED-00123',
        dva_card_type: 'gold',
        dva_file_number: 'QX123456',
        dva_accepted_conditions: 'Lumbar spine condition, hearing loss',
        dva_card_expiry: isoDate(2028, 6, 30),
        dva_veteran_status: 'Former Australian Army, 11 years service',
      };
    case 'ndis':
      return {
        funding_source: 'ndis',
        ndis_number: '430000123',
        ndis_goals: 'Improve independent mobility around the home and community access',
        ndis_functional_impact: 'Reduced lower-limb strength and balance affecting transfers',
        ndis_support_recommendations: 'Weekly exercise physiology, home exercise programme review',
        ndis_assistive_tech: 'Four-wheel walker',
        ndis_risk_factors: 'Fall risk on uneven surfaces',
      };
    case 'private_health':
      return {
        funding_source: 'private_health',
        private_health_fund_name: 'Seed Demo Health Fund',
        private_health_fund_number: 'PHF-SEED-98765',
        private_health_irn: '1',
      };
    case 'workcover_qld':
      return {
        funding_source: 'workcover_qld',
        workcover_claim_number: 'WC-SEED-2026-0042',
        workcover_date_of_injury: isoDate(2025, 11, 3),
        workcover_injury_description: 'Lumbar strain lifting a stock crate at work',
        workcover_work_capacity: 'modified',
        workcover_workplace_tasks: 'No lifting over 5kg; alternate sitting/standing',
        workcover_rtw_planning: 'Graduated return over six weeks with modified duties',
      };
    case 'medicare':
      return {
        funding_source: 'medicare',
        medicare_number: '2950123451',
        medicare_irn: '2',
        medicare_expiry: isoDate(2029, 4, 30),
        medicare_referral_type: 'epc',
        medicare_item_number: '10953',
      };
    default:
      return { funding_source: fundingSource || 'self_funded' };
  }
}

const CONDITION_NAMES = [
  'Type 2 Diabetes Mellitus',
  'Chronic Low Back Pain',
  'Osteoarthritis - Right Knee',
  'Post-Traumatic Stress Disorder',
  'Chronic Obstructive Pulmonary Disease',
  'Hypertension',
  'Major Depressive Disorder',
  'Lumbar Disc Prolapse',
];

const CATALOGUE_ASSESSMENTS = [
  {
    name: 'Timed Up and Go',
    category: 'geriatric',
    description: 'Measures functional mobility and fall risk via time to rise, walk 3m, turn, and sit.',
    instructions: 'Client rises from a standard armchair, walks 3 metres, turns, walks back, and sits down. Time from "go" to seated is recorded.',
    scoring_system: 'Lower time (seconds) indicates better functional mobility.',
    unit_of_measure: 'seconds',
    equipment_needed: 'Standard armchair, stopwatch, 3m marked walkway',
    contraindications: 'Acute lower-limb injury preventing weight-bearing',
    conditions_indicated: ['falls_risk', 'geriatric_deconditioning'],
    search_tags: ['tug', 'mobility', 'falls'],
    is_questionnaire: false,
    has_test_runner: true,
    results_add_to_soap: true,
    has_normatives: true,
    has_instructions: true,
    has_references: true,
    // Lower time is better (functional mobility). Values are SYNTHETIC examples
    // for demonstration only — real norms must be sourced and cleared in the
    // clinical-claims audit register before production use.
    normative_direction: 'lower_better',
    normative_source: 'SYNTHETIC example data — not clinically verified (see docs/qa/20260705-clinical-claims-audit-register.md)',
    normative_data: [
      { age_min: 60, age_max: 69, gender: 'both', mean: 8.5, std_dev: 1.8, percentile_25: 7.2, percentile_75: 9.8 },
      { age_min: 70, age_max: 79, gender: 'both', mean: 9.2, std_dev: 2.2, percentile_25: 7.6, percentile_75: 10.8,
        clinical_inference: { below_average: 'A slower time in this range may indicate elevated falls risk; further balance assessment may be warranted. (Illustrative curated example — clinician review required.)' } },
      { age_min: 80, age_max: 99, gender: 'both', mean: 11.5, std_dev: 3.0, percentile_25: 9.0, percentile_75: 13.5 },
    ],
  },
  {
    name: 'Six-Minute Walk Test',
    category: 'cardio_pulmonary',
    description: 'Measures the distance walked in six minutes as a proxy for functional exercise capacity.',
    instructions: 'Client walks as far as possible along a flat 30m course for six minutes, with standardised encouragement.',
    scoring_system: 'Total distance walked (metres) compared to normative predicted distance.',
    unit_of_measure: 'metres',
    equipment_needed: '30m flat corridor, cones, stopwatch, pulse oximeter',
    contraindications: 'Unstable angina, recent myocardial infarction',
    conditions_indicated: ['copd', 'cardiac_rehabilitation'],
    search_tags: ['6mwt', 'endurance', 'cardiopulmonary'],
    is_questionnaire: false,
    has_test_runner: true,
    results_add_to_soap: true,
    has_normatives: true,
    has_instructions: true,
    has_references: true,
    // Greater distance is better (functional exercise capacity). SYNTHETIC.
    normative_direction: 'higher_better',
    normative_source: 'SYNTHETIC example data — not clinically verified (see docs/qa/20260705-clinical-claims-audit-register.md)',
    normative_data: [
      { age_min: 40, age_max: 59, gender: 'both', mean: 560, std_dev: 90, percentile_25: 500, percentile_75: 620 },
      { age_min: 60, age_max: 79, gender: 'both', mean: 480, std_dev: 100, percentile_25: 410, percentile_75: 550 },
    ],
  },
  {
    name: 'DASS-21',
    category: 'mental_health',
    description: 'Twenty-one item questionnaire measuring depression, anxiety, and stress symptom severity.',
    instructions: 'Client self-completes 21 items on a 0-3 severity scale referenced to the past week.',
    scoring_system: 'Subscale raw scores multiplied by two, compared against severity bands.',
    unit_of_measure: 'score',
    equipment_needed: 'Printed or digital questionnaire',
    contraindications: 'None specific; clinical judgement where acute distress is present',
    conditions_indicated: ['depression', 'anxiety', 'chronic_pain'],
    search_tags: ['dass21', 'mental_health', 'questionnaire'],
    is_questionnaire: true,
    has_test_runner: true,
    results_add_to_soap: true,
    has_normatives: false,
    has_instructions: true,
    has_references: true,
    questions: [
      { question_text: 'I found it hard to wind down', question_type: 'scale', options: [{ label: 'Never', value: 0 }, { label: 'Sometimes', value: 1 }, { label: 'Often', value: 2 }, { label: 'Almost always', value: 3 }], reverse_scored: false },
      { question_text: 'I was aware of dryness of my mouth', question_type: 'scale', options: [{ label: 'Never', value: 0 }, { label: 'Sometimes', value: 1 }, { label: 'Often', value: 2 }, { label: 'Almost always', value: 3 }], reverse_scored: false },
    ],
  },
  {
    name: '30-Second Sit to Stand',
    category: 'musculoskeletal',
    description: 'Counts the number of full stands from a seated position in thirty seconds, as a proxy for lower-limb strength.',
    instructions: 'Client crosses arms over chest and stands fully then sits, repeating for thirty seconds; count each full stand.',
    scoring_system: 'Higher repetition count indicates greater lower-limb strength.',
    unit_of_measure: 'repetitions',
    equipment_needed: 'Standard chair without arms, stopwatch',
    contraindications: 'Unstable hip or knee replacement, uncontrolled hypertension',
    conditions_indicated: ['sarcopenia', 'post_surgical_deconditioning'],
    search_tags: ['sit_to_stand', 'strength', 'lower_limb'],
    is_questionnaire: false,
    has_test_runner: true,
    results_add_to_soap: true,
    has_normatives: true,
    has_instructions: true,
    has_references: true,
    // Higher repetition count is better (lower-limb strength). SYNTHETIC.
    normative_direction: 'higher_better',
    normative_source: 'SYNTHETIC example data — not clinically verified (see docs/qa/20260705-clinical-claims-audit-register.md)',
    normative_data: [
      { age_min: 60, age_max: 69, gender: 'both', mean: 14, std_dev: 3.5, percentile_25: 12, percentile_75: 17,
        clinical_inference: { below_average: 'A result below the 25th percentile may indicate reduced lower-limb strength; consider a targeted strengthening programme and clinical review. (Illustrative curated example — clinician review required.)' } },
      { age_min: 70, age_max: 79, gender: 'both', mean: 12, std_dev: 3.0, percentile_25: 10, percentile_75: 15 },
    ],
  },
];

const CATALOGUE_EXERCISES = [
  {
    name: 'Sit to Stand',
    description: 'Client rises from a seated position to standing and returns to seated, controlling the descent.',
    category: 'Strength',
    target_muscles: ['quadriceps', 'gluteals'],
    equipment_needed: ['chair'],
    difficulty_level: 'Beginner',
    reps_range: '8-12',
    sets_range: '2-3',
    rest_period: '60 seconds',
    search_tags: ['functional', 'lower_limb'],
  },
  {
    name: 'Wall Push-Up',
    description: 'Client stands facing a wall, hands at shoulder height, and performs a push-up against the wall.',
    category: 'Strength',
    target_muscles: ['pectorals', 'triceps'],
    equipment_needed: [],
    difficulty_level: 'Beginner',
    reps_range: '10-15',
    sets_range: '2-3',
    rest_period: '45 seconds',
    search_tags: ['upper_limb', 'low_impact'],
  },
  {
    name: 'Seated Marching',
    description: 'Client alternately lifts each knee while seated, maintaining an upright posture.',
    category: 'Cardio',
    target_muscles: ['hip_flexors'],
    equipment_needed: ['chair'],
    difficulty_level: 'Beginner',
    reps_range: '20-30',
    sets_range: '2',
    rest_period: '30 seconds',
    search_tags: ['seated', 'cardio', 'low_impact'],
  },
  {
    name: 'Single-Leg Balance',
    description: 'Client stands unsupported on one leg for as long as safely tolerated, progressing to eyes closed.',
    category: 'Balance',
    target_muscles: ['ankle_stabilisers', 'gluteus_medius'],
    equipment_needed: [],
    difficulty_level: 'Intermediate',
    duration_range: '10-30 seconds per side',
    rest_period: '30 seconds',
    search_tags: ['balance', 'falls_prevention'],
  },
];

function buildCredentialsMarkdown({ adminEmail, adminPassword, seedPassword, users }) {
  const lines = [];
  lines.push('# Seeded demo credentials (synthetic)');
  lines.push('');
  lines.push('Generated by `server/seed.mjs`. All accounts below are synthetic demo');
  lines.push('accounts created for local development and QA against the shim server —');
  lines.push('no real clinician, client, or organisation data is used anywhere in this');
  lines.push('file or in the underlying seed dataset. Safe to commit.');
  lines.push('');
  lines.push('## Admin');
  lines.push('');
  lines.push('| Email | Password |');
  lines.push('|---|---|');
  lines.push(`| ${adminEmail} | ${adminPassword} |`);
  lines.push('');
  lines.push('## Clinicians');
  lines.push('');
  lines.push('| Organisation | Role | Email | Password |');
  lines.push('|---|---|---|---|');
  for (const u of users) {
    lines.push(`| ${u.org} | ${u.role} | ${u.email} | ${seedPassword} |`);
  }
  lines.push('');
  lines.push(
    'Passwords are set via the same scrypt hash path `server/auth.mjs` uses for ' +
      'register/login (`hashPassword` / `verifyPassword`), so these accounts log in ' +
      'through the normal `/auth/login` endpoint exactly as any other user would.',
  );
  lines.push('');
  lines.push(
    'Re-run with `SEED_PASSWORD=<value> node server/seed.mjs` to set a different ' +
      'clinician password on a fresh database (re-running against an existing database ' +
      'is a no-op for already-created users — their original password is retained).',
  );
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// runSeed — the reusable, db-handle-taking entry point.
// ---------------------------------------------------------------------------

/**
 * Seeds the given already-open db handle with the full synthetic dataset.
 * Idempotent: safe to call repeatedly against the same database. Returns the
 * seed log (array of message strings) for callers (e.g. scripts/smoke.mjs)
 * that want to assert on or display it, alongside the key created records.
 */
/**
 * Catalogue seeding core — shared verbatim between the full synthetic demo
 * seed (runSeed) and the production catalogue-only seed (runCatalogueSeed),
 * so the two paths can never drift. Seeds Assessment / Exercise /
 * TreatmentProtocol ONLY (only if each table is empty); creates no
 * organisations, users, clients or acceptances; writes no files.
 */
function seedCataloguesCore({ entityNames, repoFor, note, seedCatalogue }) {
  // Merge the built-in synthetic definitions (which the demo client clusters
  // and the DASS-21 per-question exemplar depend on) with the imported live
  // catalogue. Synthetic names win on collision so those wired shapes are
  // preserved; every other imported assessment is added.
  const syntheticNames = new Set(CATALOGUE_ASSESSMENTS.map((a) => a.name));
  const importedAssessments = loadImportedCatalogue('assessment-part')
    .filter((a) => a && a.name && !syntheticNames.has(a.name));
  const mergedAssessments = [...CATALOGUE_ASSESSMENTS, ...importedAssessments];
  note(`Assessment catalogue: ${CATALOGUE_ASSESSMENTS.length} synthetic + ${importedAssessments.length} imported = ${mergedAssessments.length}`);
  const assessmentCatalogue = seedCatalogue('Assessment', mergedAssessments);
  seedCatalogue('Exercise', CATALOGUE_EXERCISES);

  // Treatment protocols: the client-authorised live export. The
  // TreatmentProtocols page does a cache lookup by condition_name and only
  // calls the model on a miss — seeding these makes matched conditions render
  // instantly and avoids per-condition model spend. Deduplicated on
  // condition_name (the app's lookup key; first occurrence wins).
  if (entityNames.has('TreatmentProtocol')) {
    const seenProtocol = new Set();
    const importedProtocols = loadImportedCatalogue('treatmentprotocol-part').filter((p) => {
      if (!p || !p.condition_name || seenProtocol.has(p.condition_name)) return false;
      seenProtocol.add(p.condition_name);
      return true;
    });
    note(`TreatmentProtocol catalogue: ${importedProtocols.length} imported (deduped on condition_name)`);
    seedCatalogue('TreatmentProtocol', importedProtocols);
  }
  return assessmentCatalogue;
}

/**
 * Production seed: catalogues only. No synthetic organisations, users,
 * clients, acceptances, or credential files — the launch database starts
 * clean (Brenton's confirmed launch-data position, 12 July 2026), with the
 * admin bootstrapped separately by server/index.mjs from ADMIN_EMAIL /
 * ADMIN_PASSWORD. Idempotent: only-if-empty per catalogue table.
 */
export function runCatalogueSeed({ db, entityNames }) {
  function note(message) {
    // eslint-disable-next-line no-console
    console.log(`[seed:catalogue] ${message}`);
  }
  const repoCache = new Map();
  function repoFor(entityName) {
    if (!entityNames.has(entityName)) {
      throw new Error(`seed-catalogue: entity ${entityName} is not in the captured schema set`);
    }
    if (!repoCache.has(entityName)) {
      repoCache.set(entityName, createEntityRepository(db, entityName));
    }
    return repoCache.get(entityName);
  }
  function seedCatalogue(entityName, items) {
    const repo = repoFor(entityName);
    const existingCount = repo.listAll().length;
    if (existingCount > 0) {
      note(`${entityName} catalogue already has ${existingCount} row(s) — leaving as-is`);
      return repo.listAll();
    }
    const created = items.map((item) => repo.create(item, null));
    note(`${entityName} catalogue seeded with ${created.length} row(s)`);
    return created;
  }
  seedCataloguesCore({ entityNames, repoFor, note, seedCatalogue });
  note('Catalogue-only seed complete (no synthetic tenants, users, or clients).');
}

export function runSeed({ db, entityNames }) {
  const log = [];
  function note(message) {
    log.push(message);
    // eslint-disable-next-line no-console
    console.log(`[seed] ${message}`);
  }

  const repoCache = new Map();
  function repoFor(entityName) {
    if (!entityNames.has(entityName)) {
      throw new Error(`seed.mjs: entity ${entityName} is not in the captured schema set`);
    }
    if (!repoCache.has(entityName)) {
      repoCache.set(entityName, createEntityRepository(db, entityName));
    }
    return repoCache.get(entityName);
  }

  function findOne(entityName, predicate) {
    return repoFor(entityName).listAll().find(predicate) || null;
  }

  function findOrCreate(entityName, predicate, data, createdBy) {
    const existing = findOne(entityName, predicate);
    if (existing) return { record: existing, created: false };
    const record = repoFor(entityName).create(data, createdBy ?? null);
    return { record, created: true };
  }

  // -------------------------------------------------------------------------
  // Organisations
  // -------------------------------------------------------------------------

  function seedOrganisation(name) {
    const { record, created } = findOrCreate(
      'Organization',
      (o) => o.name === name,
      { name, subscription_status: 'active' },
    );
    note(`Organization "${name}" ${created ? 'created' : 'already present'} (id ${record.id})`);
    return record;
  }

  // -------------------------------------------------------------------------
  // Users (clinicians) — created via the same hash path server/auth.mjs uses,
  // matching how the register/login flow stores password_hash + salt.
  // -------------------------------------------------------------------------

  function seedUser({
    email, full_name, clinician_name, qualifications, registration_number,
    clinic_name, clinic_address, clinic_phone, clinic_email, profession, country, provider_number,
  }) {
    const { password_hash, salt } = hashPassword(SEED_PASSWORD);
    const { record, created } = findOrCreate(
      'User',
      (u) => u.email === email,
      {
        email,
        full_name,
        role: 'user',
        account_status: 'active',
        subscription_status: 'active',
        email_verified: true,
        password_hash,
        salt,
        clinician_name,
        qualifications,
        registration_number,
        clinic_name,
        clinic_address,
        clinic_phone,
        clinic_email,
        profession,
        country,
        provider_number,
        last_active: new Date().toISOString(),
      },
      email,
    );
    note(`User "${email}" ${created ? 'created' : 'already present'} (id ${record.id})`);
    return record;
  }

  function seedOrgMember(org, user, role) {
    const { record, created } = findOrCreate(
      'OrganizationMember',
      (m) => m.org_id === org.id && m.user_email === user.email,
      { org_id: org.id, user_email: user.email, role, is_primary: true },
      user.email,
    );
    note(
      `OrganizationMember ${user.email} -> ${org.name} (${role}) ${created ? 'created' : 'already present'}`,
    );
    return record;
  }

  // Demo acceptance fixtures are derived from the same registry and exact
  // runtime presentation transform as production. Owners receive the full
  // eight-document bundle; clinicians receive the three practitioner notices.
  function seedLegalAcceptance(org, user, role) {
    const documentIds = role === 'owner'
      ? [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]
      : [...PRACTITIONER_NOTICE_IDS];
    for (const documentId of documentIds) {
      const document = LEGAL_DOCUMENTS[documentId];
      if (!isLegalDocumentPublicationApproved(document)) {
        throw new Error(`Mandatory legal document is not approved for publication: ${documentId}`);
      }
      const raw = fs.readFileSync(path.join(repoRoot, 'src', 'legal-content', document.file), 'utf8');
      const displayed = effectiveLegalContent(raw, {
        status: process.env.LEGAL_STATUS === 'effective' ? 'effective' : 'rc',
        effectiveDate: process.env.LEGAL_EFFECTIVE_DATE || null,
      });
      const documentFingerprint = legalContentFingerprint(displayed);
      findOrCreate(
        'LegalAcceptanceEvent',
        (e) => e.org_id === org.id && e.user_email === user.email
          && e.event_type === document.eventType
          && e.suite_version === SUITE_VERSION
          && e.document_id === documentId
          && e.document_fingerprint === documentFingerprint,
        {
          event_type: document.eventType,
          user_email: user.email,
          org_id: org.id,
          suite_version: SUITE_VERSION,
          actor_capacity: role === 'owner' ? 'practice owner' : 'invited clinician',
          document_id: documentId,
          document_title: document.title,
          document_fingerprint: documentFingerprint,
          session_context: null,
          user_agent: 'server-derived-seed-fixture',
          ip_address: 'not-collected-local-shim',
        },
        user.email,
      );
    }
    note(`LegalAcceptanceEvent (${documentIds.length}-document bundle) seeded for ${user.email}`);
  }

  // -------------------------------------------------------------------------
  // Assessment / Exercise catalogues (only seeded if the tables are empty,
  // per the task brief — "if none exist").
  // -------------------------------------------------------------------------

  function seedCatalogue(entityName, items) {
    const repo = repoFor(entityName);
    const existingCount = repo.listAll().length;
    if (existingCount > 0) {
      note(`${entityName} catalogue already has ${existingCount} row(s) — leaving as-is`);
      return repo.listAll();
    }
    const created = items.map((item) => repo.create(item, null));
    note(`${entityName} catalogue seeded with ${created.length} row(s)`);
    return created;
  }

  // -------------------------------------------------------------------------
  // Client + related-record cluster generation
  // -------------------------------------------------------------------------

  /**
   * Seeds one Client and its cluster of related records
   * (ClientCondition x1-2, ClientAssessment x1-2, SOAPNote x1-2, Appointment
   * x1, ClientReport x1, SavedReport x1), stamping org_id / client_id /
   * created_by throughout.
   */
  function seedClientCluster({
    org,
    clinician,
    fullName,
    dob,
    gender,
    fundingSource,
    assessmentCatalogue,
    seedYear,
    seedMonth,
    seedDay,
    conditionNames,
    seedKey,
  }) {
    // Idempotency key: normally org_id + full_name + date_of_birth is a
    // sufficient natural key, but the deliberate G7 near-duplicate client
    // shares exactly that triple with its sibling by design. `seedKey` (an
    // internal-only field, never surfaced in the app UI, harmless extra JSON
    // on the Client blob) disambiguates the two so re-running this script
    // stays idempotent without collapsing the intentional duplicate down to
    // one record.
    const effectiveSeedKey = seedKey || `${org.id}:${fullName}:${dob}`;
    const { record: client, created } = findOrCreate(
      'Client',
      (c) => c._seed_key === effectiveSeedKey,
      {
        org_id: org.id,
        assigned_clinician_email: clinician.email,
        full_name: fullName,
        date_of_birth: dob,
        gender,
        _seed_key: effectiveSeedKey,
        phone: '07 3000 0000',
        email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example-seed.test`,
        address: '1 Seed Street, Demo QLD 4000',
        emergency_contact_name: 'Seed Emergency Contact',
        emergency_contact_phone: '0400 000 000',
        referral_source: 'gp',
        referral_source_name: 'Dr Seed Referrer',
        referral_reason: 'Functional decline requiring exercise physiology review',
        referral_date: isoDate(seedYear, seedMonth, seedDay),
        client_goals: 'Improve function and independence with daily activities',
        consent_confirmed: true,
        privacy_consent: true,
        assessment_consent: true,
        pricing_explained: true,
        cancellation_policy_agreed: true,
        consent_date: isoDateTime(seedYear, seedMonth, seedDay),
        ...fundingFields(fundingSource),
      },
      clinician.email,
    );
    note(`Client "${fullName}" (${org.name}) ${created ? 'created' : 'already present'} (id ${client.id})`);

    if (!created) {
      // Idempotent short-circuit: related records were created alongside
      // this client on a prior run; do not duplicate them.
      return client;
    }

    // --- ClientConditions (1-2) ---
    const conditionsForClient = conditionNames.slice(0, conditionNames.length > 1 ? 2 : 1);
    conditionsForClient.forEach((conditionName, idx) => {
      repoFor('ClientCondition').create(
        {
          org_id: org.id,
          client_id: client.id,
          condition_type: idx === 0 ? 'primary' : 'comorbidity',
          condition_name: conditionName,
          medication: idx === 0 ? 'Metformin 500mg BD' : 'Panadol Osteo PRN',
          diagnosis_date: isoDate(seedYear - 1, seedMonth, seedDay),
          pain_level: idx === 0 ? 4 : 2,
          is_active: true,
        },
        clinician.email,
      );
    });
    note(`  -> ${conditionsForClient.length} ClientCondition row(s)`);

    // --- Appointment (1) ---
    const appointment = repoFor('Appointment').create(
      {
        org_id: org.id,
        title: `Initial consultation - ${fullName}`,
        client_id: client.id,
        start_time: isoDateTime(seedYear, seedMonth, seedDay, 10, 0),
        end_time: isoDateTime(seedYear, seedMonth, seedDay, 11, 0),
        notes: 'Initial exercise physiology assessment and goal-setting.',
        status: 'completed',
      },
      clinician.email,
    );
    note(`  -> Appointment (id ${appointment.id})`);

    // --- Payment (1, against the appointment) ---
    // Payment is a local-addition entity (server/local-entity-schemas.json):
    // Finances.jsx lists payments by appointment membership and reads
    // amount/status/payment_date/payment_method.
    repoFor('Payment').create(
      {
        org_id: org.id,
        client_id: client.id,
        appointment_id: appointment.id,
        amount: 145.0,
        status: 'processed',
        payment_date: isoDate(seedYear, seedMonth, seedDay),
        payment_method: 'card',
      },
      clinician.email,
    );
    note('  -> Payment (1)');

    // --- ClientAssessments (1-2), referencing real Assessment ids when present ---
    const assessmentsToUse = assessmentCatalogue.slice(0, 2);
    const clientAssessments = assessmentsToUse.map((assessment, idx) =>
      repoFor('ClientAssessment').create(
        {
          org_id: org.id,
          client_id: client.id,
          assessment_id: assessment.id,
          appointment_id: appointment.id,
          status: 'completed',
          result_value: idx === 0 ? 12.4 : 320,
          assessment_date: isoDate(seedYear, seedMonth, seedDay),
          notes: 'Administered per protocol during the initial consultation.',
          normative_comparison: idx === 0 ? 'average' : 'below_average',
          percentile: idx === 0 ? 55 : 30,
          is_flagged: idx === 1,
          source: 'live',
        },
        clinician.email,
      ),
    );
    // A thorough DASS-21 completed assessment (totals + all 21 individual
    // answers) so the completed view and SOAP objective can be exercised
    // end to end. Built via the shared payload builder (single source).
    const dassAssessment = assessmentCatalogue.find((a) => a.name === 'DASS-21');
    if (dassAssessment) {
      const dassRawScores = { 0: 2, 1: 1, 2: 3, 3: 0, 4: 2, 5: 1, 6: 0, 7: 2, 8: 1, 9: 3, 10: 2, 11: 2, 12: 3, 13: 1, 14: 0, 15: 2, 16: 2, 17: 1, 18: 0, 19: 1, 20: 3 };
      const dassPayload = buildDass21Payload(dassRawScores, 'DASS-21 completed during the intake evaluation.');
      const dassCA = repoFor('ClientAssessment').create(
        {
          org_id: org.id,
          client_id: client.id,
          assessment_id: dassAssessment.id,
          appointment_id: appointment.id,
          status: 'completed',
          result_value: dassPayload.result_value,
          assessment_date: isoDate(seedYear, seedMonth, seedDay),
          notes: dassPayload.notes,
          additional_data: dassPayload.additional_data,
          source: 'live',
        },
        clinician.email,
      );
      clientAssessments.push(dassCA);
    }
    note(`  -> ${clientAssessments.length} ClientAssessment row(s)`);

    // --- SOAPNotes (1-2) ---
    const soapCount = conditionsForClient.length > 1 ? 2 : 1;
    for (let i = 0; i < soapCount; i += 1) {
      repoFor('SOAPNote').create(
        {
          org_id: org.id,
          client_id: client.id,
          appointment_id: appointment.id,
          note_date: isoDateTime(seedYear, seedMonth, seedDay + i, 10, 30),
          note_name: `Session ${i + 1}`,
          subjective: 'Client reports good adherence to the prescribed home exercise programme and improved tolerance to daily activities over the past week.',
          objective: 'Observed improved tolerance to prescribed exercises during session.',
          assessment: 'Client progressing towards functional goals as expected.',
          plan: 'Continue current programme; review in two weeks.',
          status: i === 0 ? 'published' : 'draft',
          history: [
            { timestamp: isoDateTime(seedYear, seedMonth, seedDay + i, 10, 30), user_email: clinician.email, action: 'created' },
          ],
        },
        clinician.email,
      );
    }
    note(`  -> ${soapCount} SOAPNote row(s)`);

    // --- ClientReport (1): an initial assessment report (legacy entity), a
    // distinct report from the GP Summary below so the client profile shows two
    // realistic, non-duplicate reports. ---
    const firstName = (fullName || 'The client').split(' ')[0];
    repoFor('ClientReport').create(
      {
        org_id: org.id,
        client_id: client.id,
        report_type: 'initial_assessment',
        report_name: `Initial Assessment Report - ${fullName}`,
        report_date: isoDate(seedYear, seedMonth, seedDay),
        report_data: {
          summary: `Initial exercise physiology assessment documenting ${firstName}'s baseline functional capacity, presenting conditions, and agreed goals for the programme.`,
          assessments_included: clientAssessments.map((ca) => ca.id),
        },
        html_content: `<h2>Initial Assessment Report</h2><p>${fullName} attended for an initial exercise physiology assessment. Baseline functional testing was completed and management goals were established. Findings and the proposed exercise programme are documented below.</p>`,
        notes: 'Initial assessment.',
      },
      clinician.email,
    );
    note('  -> 1 ClientReport row');

    // --- SavedReport (1): a finalised GP Summary produced by the report wizard. ---
    repoFor('SavedReport').create(
      {
        org_id: org.id,
        client_id: client.id,
        report_type: 'gp_summary',
        report_name: `GP Summary - ${fullName}`,
        report_date: isoDate(seedYear, seedMonth, seedDay),
        date_range_start: isoDate(seedYear, seedMonth, seedDay),
        date_range_end: isoDate(seedYear, seedMonth, seedDay),
        assessment_ids: clientAssessments.map((ca) => ca.id),
        section_content: {
          summary: `${firstName} was reviewed for exercise physiology management. Baseline assessments were within the expected range for the presenting conditions, and a progressive exercise programme has been commenced with clear functional goals.`,
        },
        active_sections: ['summary'],
        report_html: `<h2>GP Summary</h2><p>Thank you for referring ${fullName}. Following an exercise physiology assessment, a progressive programme has been commenced targeting the agreed functional goals. Baseline outcome measures and recommendations are summarised below; further updates will follow at review.</p>`,
        status: 'final',
      },
      clinician.email,
    );
    note('  -> 1 SavedReport row');

    return client;
  }

  // -------------------------------------------------------------------------
  // Orchestration
  // -------------------------------------------------------------------------

  note('Starting synthetic seed run (idempotent).');

  // Bootstrap admin: server/index.mjs creates this on first boot of the real
  // server. When this seeder runs standalone against a database the server
  // has never started against, no admin user exists yet. Per the task's
  // "keep the bootstrap admin" directive, create it here too, idempotently,
  // using the exact same env-driven credentials the server bootstrap uses,
  // so a seed-then-serve or serve-then-seed ordering both converge on one
  // admin account.
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local.test';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-local';
  {
    // A minimal profile is set so the admin lands on the admin surfaces rather
    // than the profile-setup wizard (Layout gates on clinician_name before the
    // admin check). Admins skip the subscription gate, but subscription_status is
    // set active for good measure.
    const adminProfile = {
      full_name: 'Local Administrator',
      clinician_name: 'Local Administrator',
      profession: 'Exercise Physiologist',
      country: 'australia',
      role: 'admin',
      account_status: 'active',
      subscription_status: 'active',
      email_verified: true,
    };
    const existingAdmin = findOne('User', (u) => u.role === 'admin');
    if (!existingAdmin) {
      const { password_hash, salt } = hashPassword(ADMIN_PASSWORD);
      const admin = repoFor('User').create(
        { email: ADMIN_EMAIL, ...adminProfile, password_hash, salt },
        ADMIN_EMAIL,
      );
      note(`Bootstrap admin created: ${admin.email} (id ${admin.id})`);
    } else if (!existingAdmin.clinician_name) {
      repoFor('User').update(existingAdmin.id, {
        clinician_name: adminProfile.clinician_name,
        profession: adminProfile.profession,
        subscription_status: 'active',
      });
      note(`Bootstrap admin profile backfilled: ${existingAdmin.email}`);
    } else {
      note(`Bootstrap admin already present: ${existingAdmin.email} (id ${existingAdmin.id})`);
    }
  }

  // --- Organisations ---
  const orgAlpha = seedOrganisation('Org Alpha');
  const orgBeta = seedOrganisation('Org Beta');

  // --- Users: one owner + one additional clinician per org ---
  const alphaOwner = seedUser({
    email: 'owner@org-alpha.seed.test',
    full_name: 'Priya Chandran',
    clinician_name: 'Priya Chandran',
    qualifications: 'BExSc, AEP',
    registration_number: 'AEP-ALPHA-001',
    clinic_name: 'Org Alpha Exercise Physiology',
    clinic_address: '10 Alpha Street, Demo QLD 4000',
    clinic_phone: '07 3111 1111',
    clinic_email: 'reception@org-alpha.seed.test',
    profession: 'Exercise Physiologist',
    country: 'australia',
    provider_number: 'PRV-ALPHA-001',
  });
  const alphaClinician = seedUser({
    email: 'clinician@org-alpha.seed.test',
    full_name: 'Daniel Whitfield',
    clinician_name: 'Daniel Whitfield',
    qualifications: 'BExSc (Hons), AEP',
    registration_number: 'AEP-ALPHA-002',
    clinic_name: 'Org Alpha Exercise Physiology',
    clinic_address: '10 Alpha Street, Demo QLD 4000',
    clinic_phone: '07 3111 1111',
    clinic_email: 'reception@org-alpha.seed.test',
    profession: 'Exercise Physiologist',
    country: 'australia',
    provider_number: 'PRV-ALPHA-002',
  });
  const betaOwner = seedUser({
    email: 'owner@org-beta.seed.test',
    full_name: 'Marcus Delacroix',
    clinician_name: 'Marcus Delacroix',
    qualifications: 'BAppSc (ExSpSc), AEP',
    registration_number: 'AEP-BETA-001',
    clinic_name: 'Org Beta Allied Health',
    clinic_address: '25 Beta Avenue, Demo QLD 4101',
    clinic_phone: '07 3222 2222',
    clinic_email: 'reception@org-beta.seed.test',
    profession: 'Exercise Physiologist',
    country: 'australia',
    provider_number: 'PRV-BETA-001',
  });
  const betaClinician = seedUser({
    email: 'clinician@org-beta.seed.test',
    full_name: 'Aroha Ngata',
    clinician_name: 'Aroha Ngata',
    qualifications: 'BExSc, AEP',
    registration_number: 'AEP-BETA-002',
    clinic_name: 'Org Beta Allied Health',
    clinic_address: '25 Beta Avenue, Demo QLD 4101',
    clinic_phone: '07 3222 2222',
    clinic_email: 'reception@org-beta.seed.test',
    profession: 'Exercise Physiologist',
    country: 'australia',
    provider_number: 'PRV-BETA-002',
  });

  // --- OrganizationMember links ---
  seedOrgMember(orgAlpha, alphaOwner, 'owner');
  seedOrgMember(orgAlpha, alphaClinician, 'clinician');
  seedOrgMember(orgBeta, betaOwner, 'owner');
  seedOrgMember(orgBeta, betaClinician, 'clinician');

  // --- Legal acceptance (mandatory practitioner notices) ---
  seedLegalAcceptance(orgAlpha, alphaOwner, 'owner');
  seedLegalAcceptance(orgAlpha, alphaClinician, 'clinician');
  seedLegalAcceptance(orgBeta, betaOwner, 'owner');
  seedLegalAcceptance(orgBeta, betaClinician, 'clinician');

  // --- Catalogues (only if empty) --- shared core with the production
  // catalogue-only seed (runCatalogueSeed) so the two paths cannot drift.
  const assessmentCatalogue = seedCataloguesCore({ entityNames, repoFor, note, seedCatalogue });

  // --- Org Alpha clients (4, incl. one deliberate near-duplicate pair for G7) ---
  const graceEllington = seedClientCluster({
    org: orgAlpha,
    clinician: alphaOwner,
    fullName: 'Grace Ellington',
    dob: isoDate(1958, 3, 14),
    gender: 'female',
    fundingSource: 'dva',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 5,
    seedDay: 4,
    conditionNames: [CONDITION_NAMES[0], CONDITION_NAMES[1]],
  });
  const tobiasFerreira = seedClientCluster({
    org: orgAlpha,
    clinician: alphaClinician,
    fullName: 'Tobias Ferreira',
    dob: isoDate(1990, 11, 2),
    gender: 'male',
    fundingSource: 'ndis',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 5,
    seedDay: 11,
    conditionNames: [CONDITION_NAMES[2]],
  });
  const simoneOkafor = seedClientCluster({
    org: orgAlpha,
    clinician: alphaOwner,
    fullName: 'Simone Okafor',
    dob: isoDate(1975, 7, 22),
    gender: 'female',
    fundingSource: 'private_health',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 5,
    seedDay: 18,
    conditionNames: [CONDITION_NAMES[3], CONDITION_NAMES[4]],
  });
  // Deliberate near-duplicate within Org Alpha (same name + DOB) to exercise
  // G7 duplicate-detection testing — a second client record sharing exactly
  // the full_name and date_of_birth of "Grace Ellington", created later and
  // by the other clinician, as a real front-desk duplicate-entry scenario
  // would occur.
  const graceEllingtonDuplicate = seedClientCluster({
    org: orgAlpha,
    clinician: alphaClinician,
    fullName: 'Grace Ellington',
    dob: isoDate(1958, 3, 14),
    gender: 'female',
    fundingSource: 'dva',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 6,
    seedDay: 9,
    conditionNames: [CONDITION_NAMES[0]],
    seedKey: `${orgAlpha.id}:Grace Ellington:1958-03-14:duplicate-2`,
  });

  // --- Org Beta clients (3) ---
  const harrietNguyenBaxter = seedClientCluster({
    org: orgBeta,
    clinician: betaOwner,
    fullName: 'Harriet Nguyen-Baxter',
    dob: isoDate(1962, 9, 30),
    gender: 'female',
    fundingSource: 'dva',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 4,
    seedDay: 27,
    conditionNames: [CONDITION_NAMES[5], CONDITION_NAMES[6]],
  });
  const callumAshworth = seedClientCluster({
    org: orgBeta,
    clinician: betaClinician,
    fullName: 'Callum Ashworth',
    dob: isoDate(1988, 1, 17),
    gender: 'male',
    fundingSource: 'ndis',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 5,
    seedDay: 6,
    conditionNames: [CONDITION_NAMES[7]],
  });
  const rosalindMeiklejohn = seedClientCluster({
    org: orgBeta,
    clinician: betaOwner,
    fullName: 'Rosalind Meiklejohn',
    dob: isoDate(1970, 12, 5),
    gender: 'female',
    fundingSource: 'private_health',
    assessmentCatalogue,
    seedYear: 2026,
    seedMonth: 5,
    seedDay: 20,
    conditionNames: [CONDITION_NAMES[2], CONDITION_NAMES[5]],
  });

  // --- Credentials record (synthetic, safe to commit) ---
  const credentialsPath = path.join(repoRoot, 'scripts', 'seed-credentials.md');
  const credentialsContent = buildCredentialsMarkdown({
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    seedPassword: SEED_PASSWORD,
    users: [
      { org: 'Org Alpha', role: 'owner', email: alphaOwner.email },
      { org: 'Org Alpha', role: 'clinician', email: alphaClinician.email },
      { org: 'Org Beta', role: 'owner', email: betaOwner.email },
      { org: 'Org Beta', role: 'clinician', email: betaClinician.email },
    ],
  });
  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
  fs.writeFileSync(credentialsPath, credentialsContent, 'utf8');
  note(`Wrote seeded credentials to ${path.relative(repoRoot, credentialsPath)}`);

  const port = Number(process.env.PORT) || 8787;
  note(`Synthetic seed run complete. Data is in place for a shim server on PORT ${port} (start with: node server/index.mjs).`);

  return {
    log,
    admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    organisations: { orgAlpha, orgBeta },
    users: { alphaOwner, alphaClinician, betaOwner, betaClinician },
    clients: {
      graceEllington,
      tobiasFerreira,
      simoneOkafor,
      graceEllingtonDuplicate,
      harrietNguyenBaxter,
      callumAshworth,
      rosalindMeiklejohn,
    },
    assessmentCatalogue,
  };
}

// ---------------------------------------------------------------------------
// Standalone entry point: `node server/seed.mjs` opens its own db handle.
// ---------------------------------------------------------------------------

function isMainModule() {
  if (!process.argv[1]) return false;
  // pathToFileURL handles Windows drive-letter paths and separators
  // correctly, unlike manual string concatenation against import.meta.url.
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const { db, entityNames } = openDatabase();
  runSeed({ db, entityNames });
}
