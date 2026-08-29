import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getProfession,
  toPublicProfession,
  validateProfession,
} from '../../packages/profession-config/index.mjs';
import { applyProfessionLegalContent } from '../../src/lib/legal/professionContent.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

test('both profession manifests provide validated clinical writing language', () => {
  const ep = getProfession('exercise-physiology');
  const physio = getProfession('physio');

  assert.equal(ep.disciplineName, 'Exercise Physiology');
  assert.equal(ep.clinicalPromptRole, 'Accredited Exercise Physiologist (AEP)');
  assert.equal(physio.disciplineName, 'Physiotherapy');
  assert.equal(physio.clinicalPromptRole, 'Registered Physiotherapist');

  assert.equal(toPublicProfession(ep).disciplineName, ep.disciplineName);
  assert.equal(toPublicProfession(ep).clinicalPromptRole, ep.clinicalPromptRole);
  assert.equal(toPublicProfession(physio).disciplineName, physio.disciplineName);
  assert.equal(toPublicProfession(physio).clinicalPromptRole, physio.clinicalPromptRole);

  const invalid = JSON.parse(JSON.stringify(physio));
  invalid.clinicalPromptRole = '';
  assert.throws(
    () => validateProfession(invalid),
    /profession\.clinicalPromptRole must be a non-empty, trimmed string/,
  );
});

test('Physio-exposed SOAP and report paths compose terminology from the active manifest', () => {
  const sources = {
    soap: readSource('src/components/calendar/SOAPNoteModal.jsx'),
    sectionEditor: readSource('src/components/reports/wizard-steps/SectionEditor.jsx'),
    reports: readSource('src/pages/Reports.jsx'),
    reportGeneration: readSource('src/lib/reports/reportContentGeneration.js'),
    nutritionPlan: readSource('src/components/client/NutritionPlanCreator.jsx'),
    nutritionTab: readSource('src/components/client/NutritionTab.jsx'),
    medicationAlerts: readSource('src/components/client/MedicationAlerts.jsx'),
    conditions: readSource('src/pages/ClientConditions.jsx'),
  };

  for (const [name, source] of Object.entries(sources).filter(([name]) => name !== 'reportGeneration')) {
    assert.match(
      source,
      /buildTimeProfession as activeProfession/,
      `${name} must bind to the validated build-time profession`,
    );
  }

  assert.match(sources.reportGeneration, /import \{ getProfession \}/);
  assert.match(sources.reportGeneration, /import\.meta\.env\?\.VITE_PROFESSION/);
  assert.match(sources.reportGeneration, /return getProfession\(professionId\.trim\(\)\)/);
  assert.match(
    sources.reportGeneration,
    /const activeProfession = resolveReportProfession\(professionId\)/,
  );

  assert.match(sources.soap, /activeProfession\.clinicalPromptRole/g);
  assert.match(sources.sectionEditor, /activeProfession\.clinicalPromptRole/);
  assert.match(sources.reports, /activeProfession\.disciplineName\.toLowerCase\(\)/);
  assert.match(sources.reportGeneration, /activeProfession\.clinicalPromptRole/);
  assert.match(sources.nutritionPlan, /activeProfession\.clinicalPromptRole/);
  assert.match(sources.nutritionTab, /activeProfession\.disciplineName/);
  assert.match(sources.medicationAlerts, /activeProfession\.clinicalPromptRole/);
  assert.match(sources.conditions, /activeProfession\.clinicalPromptRole/);

  const exposedSource = Object.values(sources).join('\n');
  for (const epOnlyLiteral of [
    'You are a clinical exercise physiologist',
    'You are an expert Exercise Physiologist (AEP)',
    'HSE-funded exercise physiology programme',
  ]) {
    assert.equal(
      exposedSource.includes(epOnlyLiteral),
      false,
      `Physio-exposed source must not hard-code: ${epOnlyLiteral}`,
    );
  }
});

test('shared server AI and transcription defaults resolve the active profession at runtime', () => {
  const llm = readSource('server/llm.mjs');
  const transcription = readSource('server/functions/transcribeSession.mjs');

  assert.match(llm, /resolveActiveProfessionContract\(process\.env\)\.profession/);
  assert.match(llm, /activeProfession\.clinicalPromptRole/);
  assert.match(transcription, /resolveActiveProfessionContract\(process\.env\)\.profession/);
  assert.match(transcription, /activeProfession\.clinicalPromptRole/);
  assert.doesNotMatch(llm, /allied-health \(exercise physiology\) platform/i);
  assert.doesNotMatch(transcription, /allied-health \(exercise physiology\) practice/i);
});

test('Physio routes use native funding and recovery-nutrition workspaces', () => {
  const routes = readSource('src/pages.config.js');
  assert.match(routes, /const PHYSIO_PAGES = \{[\s\S]*"FundingForms": PhysioFundingForms/);
  assert.match(routes, /const PHYSIO_PAGES = \{[\s\S]*"Nutrition": PhysioNutrition/);
  assert.match(routes, /const EP_PAGES = \{[\s\S]*"FundingForms": FundingForms/);
  assert.match(routes, /const EP_PAGES = \{[\s\S]*"Nutrition": Nutrition/);
});

test('Physio assessment catalogue does not present EP identity as Physio guidance', () => {
  const assessments = readSource('server/data-import/physiotherapy-assessment-part-0.jsonl')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const userFacingFields = [
    'name',
    'description',
    'instructions',
    'equipment_needed',
    'contraindications',
    'scoring_system',
  ];
  const epIdentity = /exercise physiolog|accredited exercise|\bAEPs?\b/i;

  for (const assessment of assessments) {
    for (const field of userFacingFields) {
      assert.doesNotMatch(
        String(assessment[field] ?? ''),
        epIdentity,
        `${assessment.name}.${field} must use Physio-native language`,
      );
    }
  }
});

test('Physio legal presentation removes EP identity and obsolete clinical-function blocks', () => {
  const legalFiles = fs.readdirSync(path.join(repositoryRoot, 'src', 'legal-content'))
    .filter((filename) => filename.endsWith('.md'));
  const physioLegalSuite = legalFiles.map((filename) => applyProfessionLegalContent(
    readSource(path.join('src', 'legal-content', filename)),
    'physio',
  )).join('\n');

  for (const forbidden of [
    /AssessSuite Clinical/,
    /Exercise Physiolog/,
    /\bESSA\b/,
    /\bAEPs?\b/,
    /RC-2026\.07\.19 does not approve general clinical text generation/,
    /The Finances or patient-service payment module is excluded from the initial Service/,
  ]) {
    assert.doesNotMatch(physioLegalSuite, forbidden);
  }
  assert.match(physioLegalSuite, /AssessSuite Physio/);
  assert.match(physioLegalSuite, /Physiotherapy Board of Australia through Ahpra/);
  assert.match(physioLegalSuite, /clinical AI, assessment interpretation and recommendation/);
  assert.match(physioLegalSuite, /audio transcription/);
  assert.match(physioLegalSuite, /finance and billing functions/);
});

test('active language renders distinct EP and Physio author identities without changing capability', () => {
  const ep = toPublicProfession('exercise-physiology');
  const physio = toPublicProfession('physio');
  const soapLead = (profession) => `You are the treating ${profession.clinicalPromptRole} writing a SOAP note assessment section.`;
  const reportLead = (profession) => `You are acting as an expert ${profession.clinicalPromptRole} writing the report.`;

  assert.equal(
    soapLead(ep),
    'You are the treating Accredited Exercise Physiologist (AEP) writing a SOAP note assessment section.',
  );
  assert.equal(
    soapLead(physio),
    'You are the treating Registered Physiotherapist writing a SOAP note assessment section.',
  );
  assert.equal(
    reportLead(ep),
    'You are acting as an expert Accredited Exercise Physiologist (AEP) writing the report.',
  );
  assert.equal(
    reportLead(physio),
    'You are acting as an expert Registered Physiotherapist writing the report.',
  );
  assert.equal(ep.disciplineName.toLowerCase(), 'exercise physiology');
  assert.equal(physio.disciplineName.toLowerCase(), 'physiotherapy');
});
