import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

const ORPHAN_REPORTS = [
  'PDFFormFiller',
  'DVAPatientCarePlan',
  'GPSummary',
  'PrivateHealthProgressReport',
  'PrivateHealthInitialAssessment',
  'CustomReportGenerator',
  'Form32Generator',
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walkSource(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSource(absolute));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function extractArrowBody(source, declaration) {
  const declarationIndex = source.indexOf(declaration);
  assert.ok(declarationIndex >= 0, `missing ${declaration}`);
  const arrowIndex = source.indexOf('=>', declarationIndex);
  const bodyStart = source.indexOf('{', arrowIndex);
  assert.ok(arrowIndex >= 0 && bodyStart >= 0, `${declaration} must be an arrow function with a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  assert.fail(`could not close ${declaration}`);
}

function assertGuardBefore(body, marker, name) {
  const guard = body.search(/if\s*\(\s*!ai\.canTrigger\s*\)\s*\{/);
  const markerIndex = body.indexOf(marker);
  assert.ok(guard >= 0, `${name} must fail closed when ai.canTrigger is false`);
  assert.ok(markerIndex >= 0, `${name} must contain ${marker}`);
  assert.ok(guard < markerIndex, `${name} capability guard must precede ${marker}`);
  assert.match(body.slice(guard, markerIndex), /return(?:\s+null)?;/, `${name} guard must return before transport use`);
}

test('L01 the seven authorised orphan report generators are absent from the import graph', () => {
  for (const report of ORPHAN_REPORTS) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, 'src', 'components', 'reports', `${report}.jsx`)),
      false,
      `${report}.jsx must remain deleted`,
    );
  }

  const importPattern = /(?:import|export)\s[\s\S]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  const forbidden = new Set(ORPHAN_REPORTS);
  const inbound = [];
  for (const absolute of walkSource(path.join(repoRoot, 'src'))) {
    const source = fs.readFileSync(absolute, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] || match[2];
      const stem = path.basename(specifier).replace(/\.(?:js|jsx|mjs|ts|tsx)$/, '');
      if (forbidden.has(stem)) inbound.push(`${path.relative(repoRoot, absolute)} -> ${specifier}`);
    }
  }
  assert.deepEqual(inbound, [], `orphan report import(s) remain:\n${inbound.join('\n')}`);

  const reportsPage = read('src/pages/Reports.jsx');
  const savedReports = read('src/components/client/SavedReports.jsx');
  assert.match(reportsPage, /UnifiedReportWizard/);
  assert.match(savedReports, /UnifiedReportWizard/);
  assert.match(savedReports, /entities\.SavedReport\.filter/);
  assert.match(savedReports, /entities\.ClientReport\.filter/);
});

test('L02 every AssessmentAudit InvokeLLM action fails closed in its own handler', () => {
  const source = read('src/pages/AssessmentAudit.jsx');
  assert.equal((source.match(/\.InvokeLLM\s*\(/g) || []).length, 2, 'expected the two bounded legacy generation calls');

  for (const declaration of ['const generateTestRunnerCode', 'const generateTextFields']) {
    assertGuardBefore(extractArrowBody(source, declaration), 'InvokeLLM', declaration);
  }
  assertGuardBefore(extractArrowBody(source, 'const applyFix'), 'generateTestRunnerCode', 'const applyFix');
  assertGuardBefore(extractArrowBody(source, 'const generateAllFixes'), 'applyFix', 'const generateAllFixes');
});

test('L03 AssessmentAudit preserves deterministic audit and manual review while disabling generation affordances', () => {
  const source = read('src/pages/AssessmentAudit.jsx');
  const runAudit = extractArrowBody(source, 'const runAudit');
  assert.match(runAudit, /runComplianceChecks/);
  assert.doesNotMatch(runAudit, /InvokeLLM|ai\.canTrigger/);
  assert.match(source, /Run deterministic compliance checks/);
  assert.match(source, /disabled=\{generatingFixes \|\| !ai\.canTrigger\}/);
  assert.match(source, /disabled=\{isFixing \|\| !aiAvailable\}/);
  assert.match(source, /AI drafting unavailable/);
  assert.match(source, /onApproveFix/);
  assert.match(source, /onRejectFix/);
  assert.match(source, /exportResults/);
});

test('L04 ClientConditions preserves condition CRUD without the obsolete generic suggestion surface', () => {
  const source = read('src/pages/ClientConditions.jsx');
  assert.match(source, /ClientCondition\.filter/);
  assert.match(source, /ClientCondition\.create/);
  assert.match(source, /ClientCondition\.update/);
  assert.match(source, /ClientCondition\.delete/);
  assert.doesNotMatch(
    source,
    /InvokeLLM|useAiCapability|AIDisclosureNote|suggestionState|generateAssessmentSuggestions|Assessment Suggestions/,
  );
  assert.match(read('src/pages/ClientProfile.jsx'), /AssessmentRecommendations/);
});
