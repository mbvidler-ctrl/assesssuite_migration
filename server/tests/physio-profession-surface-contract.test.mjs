import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getProfession, toPublicProfession } from '../../packages/profession-config/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('profession manifests explicitly admit navigation routes and report surfaces', () => {
  const ep = getProfession('exercise-physiology');
  const physio = getProfession('physio');

  assert.ok(ep.navigation.primaryPages.includes('Nutrition'));
  assert.ok(ep.navigation.primaryPages.includes('FundingForms'));
  assert.ok(!ep.navigation.allowedPages.includes('PhysioEpisodes'));
  assert.deepEqual(ep.reports.allowedRegions, ['*']);
  assert.deepEqual(ep.reports.allowedTypeIds, ['*']);

  assert.ok(physio.navigation.primaryPages.includes('PhysioEpisodes'));
  assert.ok(physio.navigation.primaryPages.includes('Reports'));
  assert.ok(!physio.navigation.primaryPages.includes('Nutrition'));
  assert.ok(!physio.navigation.primaryPages.includes('FundingForms'));
  assert.ok(!physio.navigation.allowedPages.includes('Nutrition'));
  assert.ok(!physio.navigation.allowedPages.includes('FundingForms'));
  assert.deepEqual(physio.reports.allowedRegions, ['australia']);
  assert.deepEqual(physio.reports.allowedTypeIds, [
    'physio_initial_assessment',
    'physio_progress_report',
    'physio_referrer_update',
    'physio_discharge_summary',
    'custom_report',
  ]);
});

test('public profession projection carries isolated navigation and report policy copies', () => {
  const publicPhysio = toPublicProfession('physio');
  assert.deepEqual(publicPhysio.navigation.allowedPages, getProfession('physio').navigation.allowedPages);
  assert.deepEqual(publicPhysio.reports.allowedTypeIds, getProfession('physio').reports.allowedTypeIds);
  publicPhysio.navigation.allowedPages.push('Nutrition');
  publicPhysio.reports.allowedTypeIds.push('ep_exercise_prescription');
  assert.ok(!getProfession('physio').navigation.allowedPages.includes('Nutrition'));
  assert.ok(!getProfession('physio').reports.allowedTypeIds.includes('ep_exercise_prescription'));
});

test('Layout composes navigation from the active manifest and denies unadmitted direct routes', () => {
  const layout = read('src', 'Layout.jsx');
  assert.match(layout, /activeProfession\.navigation\.primaryPages\.map/);
  assert.match(layout, /activeProfession\.navigation\.allowedPages\.map/);
  assert.match(layout, /const requestedPage = pathPage \|\|/);
  assert.match(layout, /isProfessionRouteDenied\(location\.pathname, currentPageName\)/);
  assert.match(layout, /return <Navigate to=\{createPageUrl\("Dashboard"\)\} replace/);
  assert.doesNotMatch(layout, /activeProfession\.features\.careEpisodes\s*\?/);
});

test('the production route graph is composed per vertical before bundling', () => {
  const pages = read('src', 'pages.config.js');
  const layout = read('src', 'Layout.jsx');
  const brandAssets = read('src', 'brandAssets.js');

  assert.match(pages, /const PHYSIO_PAGES = \{[\s\S]*"PhysioEpisodes": PhysioEpisodes/);
  assert.match(pages, /const EP_PAGES = \{[\s\S]*"AssessmentAudit": AssessmentAudit/);
  assert.match(pages, /import\.meta\.env\.VITE_PROFESSION === 'physio'[\s\S]*\? PHYSIO_PAGES[\s\S]*: EP_PAGES/);
  assert.doesNotMatch(
    pages.slice(pages.indexOf('const PHYSIO_PAGES'), pages.indexOf('const EP_PAGES')),
    /AssessmentAudit|ClientConditions|FundingForms|Nutrition/,
  );
  assert.match(layout, /assessmentAuditAvailable = import\.meta\.env\.VITE_PROFESSION === 'exercise-physiology'/);
  assert.match(brandAssets, /assesssuite-logo-header\.png/);
  assert.doesNotMatch(layout, /media\.base44\.com/);
});

test('Physio Reports exposes only initial, progress, referrer, discharge and custom templates', () => {
  const reports = read('src', 'pages', 'Reports.jsx');
  const wizard = read('src', 'components', 'reports', 'UnifiedReportWizard.jsx');

  assert.match(reports, /filterAllowedReportTypes/);
  assert.match(reports, /availableRegionOptions/);
  assert.match(reports, /isReportTypeAllowed\(reportTypeId\)/);
  assert.match(wizard, /isReportTemplateAllowed\(preselectedReportType\)/);
  assert.match(wizard, /!matchedKey && !allReportTemplatesAllowed/);

  for (const key of [
    'physio_initial_assessment',
    'physio_progress_report',
    'physio_referrer_update',
    'physio_discharge_summary',
  ]) {
    assert.ok(reports.includes(`${key}:`), `Reports page is missing ${key}`);
    assert.ok(wizard.includes(`${key}:`), `report wizard is missing ${key}`);
  }
});

test('Physio report entry points do not import the retired raw-LLM report dispatcher', () => {
  const reports = read('src', 'pages', 'Reports.jsx');
  const wizard = read('src', 'components', 'reports', 'UnifiedReportWizard.jsx');
  const activeEntryGraph = `${reports}\n${wizard}`;

  for (const retiredModule of [
    'PDFFormFiller',
    'Form32Generator',
    'PrivateHealthProgressReport',
    'DVAPatientCarePlan',
    'PrivateHealthInitialAssessment',
    'GPSummary',
  ]) {
    assert.doesNotMatch(
      activeEntryGraph,
      new RegExp(`(?:from\\s+["'][^"']*${retiredModule}|<${retiredModule}\\b)`),
      `${retiredModule} must remain outside the active report entry graph`,
    );
  }
});

test('the Physio live library shows its canonical rows while preserving the existing EP branch', () => {
  const library = read('src', 'components', 'assessments', 'AssessmentLibraryModal.jsx');
  assert.match(library, /base44\.entities\.Assessment\.list\(\)/);
  assert.match(library, /filter\(\(assessment\) => !assessment\.is_deleted\)/);
  assert.match(library, /if \(buildTimeProfession\.id === 'physio'\)/);
  assert.match(library, /setAssessments\(active\.sort/);
  assert.match(library, /searchAssessments\(\{ assessments: list, query: searchTerm \}\)/);
  assert.match(library, /Preserve the current EP surface exactly/);
  assert.match(library, /const byName = new Map\(\)/);

  const newAssessment = read('src', 'pages', 'NewAssessment.jsx');
  assert.match(newAssessment, /buildTimeProfession\.id === 'physio'/);
  assert.match(newAssessment, /searchAssessments\(\{ assessments, query: assessmentSearchTerm \}\)/);

  const libraryPage = read('src', 'pages', 'AssessmentLibrary.jsx');
  assert.match(libraryPage, /if \(buildTimeProfession\.id === 'physio'\)/);
  assert.match(libraryPage, /setAssessments\(active\)/);
  assert.match(libraryPage, /setAssessments\(active\);\s*setIsLoading\(false\);\s*return;/);
  assert.match(libraryPage, /searchAssessments\(\{ assessments: filtered, query: searchTerm \}\)/);
  assert.match(libraryPage, /Preserve the existing EP library behaviour/);
  const physioReturn = libraryPage.indexOf("setAssessments(active);");
  const legacyDelete = libraryPage.indexOf('base44.entities.Assessment.delete');
  assert.ok(physioReturn >= 0 && legacyDelete > physioReturn, 'Physio must return before legacy deletion');

  const clientAssessments = read('src', 'components', 'client', 'ClientAssessments.jsx');
  assert.match(clientAssessments, /buildTimeProfession\.id !== 'physio'/);
  assert.match(clientAssessments, /assessment\.name\?\.toLowerCase\(\)\.includes\('ymca'\)/);
});
