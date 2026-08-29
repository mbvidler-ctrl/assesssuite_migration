// Report content quality and compatibility contract.
// Pure/offline: exercises prompt/context helpers and pins the legacy report
// lifecycle surfaces that must remain available after content improvements.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  REPORT_PROMPT_LIMITS,
  buildPriorReportContext,
  buildReportAssessmentSummary,
  buildReportBatchSchema,
  buildReportDraftPrompt,
  buildSoapReportContext,
  limitReportText,
  normaliseReportSectionOutput,
  normaliseReportAssessments,
  resolveReportFormProfile,
  validateReportBatchResponse,
} from '../../src/lib/reports/reportContentGeneration.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

function readSource(...segments) {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

test('recorded zero results and available classifications survive report normalisation', () => {
  const assessments = normaliseReportAssessments([
    {
      name: 'Timed balance test',
      assessment_date: '2026-08-10',
      result_value: 0,
      unit_of_measure: 'seconds',
      normative_comparison: 'below_average',
      additional_data: { interpretation: 'Unable to maintain the test position' },
    },
    {
      name: 'Walk test',
      assessment_date: '2026-08-11',
      result_value: 420,
      additional_data: { classification: 'Within expected range', units: 'm' },
    },
  ]);

  assert.equal(assessments[0].name, 'Walk test', 'newest result should be first');
  assert.equal(assessments[0].classification, 'Within expected range');
  assert.equal(assessments[1].result, 0);
  assert.equal(assessments[1].classification, 'Unable to maintain the test position');

  const summary = buildReportAssessmentSummary(assessments);
  assert.match(summary, /Timed balance test \| 2026-08-10 \| 0 seconds/);
  assert.doesNotMatch(summary, /Timed balance test[^\n]*Not recorded/);
});

test('prior report context includes clinical strings and ignores blob metadata safely', () => {
  const reports = [{
    report_name: 'Progress report',
    report_date: '2026-08-01',
    section_content: {
      Background: '  Documented clinical history.  ',
      Background_ai_drafted: true,
      'Provider Signature': 'Clinician Name',
      'Provider Signature_signature': 'data:image/png;base64,example',
      Background_attachments: [{ name: 'scan.pdf' }],
      Empty: '   ',
    },
  }];

  let context;
  assert.doesNotThrow(() => { context = buildPriorReportContext(reports); });
  assert.match(context, /Background: Documented clinical history\./);
  assert.doesNotMatch(context, /ai_drafted|Clinician Name|base64|scan\.pdf/);
  assert.doesNotThrow(() => buildPriorReportContext([{ section_content: ['not', 'a', 'map'] }]));
});

test('prior-report and SOAP context budgets are newest-first and deterministic', () => {
  const reports = [3, 1, 7, 2, 6, 4, 5].map((day) => ({
    report_name: `Report ${day}`,
    report_date: `2026-08-0${day}`,
    section_content: { Background: `Recorded ${day}` },
  }));
  const prior = buildPriorReportContext(reports);
  assert.equal((prior.match(/^--- Report/gm) || []).length, REPORT_PROMPT_LIMITS.priorReports);
  assert.ok(prior.indexOf('Report 7') < prior.indexOf('Report 6'));
  assert.doesNotMatch(prior, /Report 1|Report 2/);

  const oversizedPrior = buildPriorReportContext([{
    report_name: 'Long report',
    report_date: '2026-08-12',
    section_content: Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`Section ${index}`, 'x'.repeat(500)]),
    ),
  }]);
  assert.ok(oversizedPrior.length <= REPORT_PROMPT_LIMITS.priorContextCharacters);

  const soapNotes = Array.from({ length: 12 }, (_, index) => ({
    note_date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    subjective: `note-${index + 1} ${'x'.repeat(1_000)}`,
    objective: 'x'.repeat(1_000),
    assessment: 'x'.repeat(1_000),
    plan: 'x'.repeat(1_000),
  }));
  const soap = buildSoapReportContext(soapNotes);
  assert.ok(soap.length <= REPORT_PROMPT_LIMITS.soapContextCharacters);
  assert.match(soap, /^\[2026-08-12\]/);
  assert.doesNotMatch(soap, /\[2026-08-01\]/);
  assert.equal(limitReportText('x'.repeat(100), 20).length, 20);
});

test('whole-report schema contains every draftable section exactly once', () => {
  const schema = buildReportBatchSchema([
    'Background',
    'Provider Signature',
    'Attachments',
    'Recommendations',
    'Background',
  ]);

  assert.deepEqual(Object.keys(schema.properties), ['Background', 'Recommendations']);
  assert.deepEqual(schema.required, ['Background', 'Recommendations']);
  assert.deepEqual(schema.properties.Background, { type: 'string', minLength: 1 });
  assert.equal(schema.additionalProperties, false);
});

test('whole-report prompt coordinates sections, constrains facts and avoids outcome-table duplication', () => {
  const prompt = buildReportDraftPrompt({
    reportTitle: 'Progress Report',
    clientContext: { assessments: [{ name: '6MWT', result: 400, unit: 'm' }] },
    assessmentSummary: '6MWT | 2026-08-01 | 400 m | — | —',
    sections: ['Outcome Summary', 'Recommendations'],
    sectionGuidance: {
      'Outcome Summary': { prompt: 'Interpret measured change.' },
      Recommendations: { prompt: 'Give supported next steps.' },
    },
    outcomeSection: 'Outcome Summary',
  });

  assert.match(prompt, /only factual sources/i);
  assert.match(prompt, /including a measured value of 0/i);
  assert.match(prompt, /Not documented in the available record\./);
  assert.match(prompt, /Plan the allocation of facts before writing/i);
  assert.match(prompt, /do not recreate the table or repeat its row values/i);
  assert.match(prompt, /Return one JSON string property for each exact section name/i);
});

test('named funding forms add a field-specific audience and omission profile', () => {
  const profile = resolveReportFormProfile('workcover_pmp');
  assert.equal(profile.label, 'Queensland Provider Management Plan');
  assert.match(profile.purpose, /measurable goals/);

  const prompt = buildReportDraftPrompt({
    professionId: 'physio',
    reportTypeKey: 'workcover_pmp',
    reportTitle: 'Provider Management Plan',
    clientContext: { funding: 'workcover_qld' },
    assessmentSummary: 'No assessment results available.',
    sections: ['Current Functional Status'],
    sectionGuidance: { 'Current Functional Status': { prompt: 'Write max 120 words. Use recorded function.' } },
  });
  assert.match(prompt, /FORM-SPECIFIC OUTPUT PROFILE/);
  assert.match(prompt, /claims manager and treating team/);
  assert.match(prompt, /Not documented in the available record\./);
  assert.match(prompt, /short field-ready answers/i);
});

test('section output is mechanically de-padded and fitted to its form word limit', () => {
  const facts = Array.from({ length: 30 }, (_, index) => `fact${index + 1}`).join(' ');
  const verbose = `## Clinical Summary\nThis report aims to provide an update. ${facts}\nPlease do not hesitate to contact us.`;
  const fitted = normaliseReportSectionOutput(verbose, {
    section: 'Clinical Summary',
    guidance: { maxWords: 12 },
  });
  assert.doesNotMatch(fitted, /Clinical Summary|This report aims|do not hesitate/i);
  assert.ok(fitted.split(/\s+/).length <= 12, fitted);
});

test('word fitting never cuts data-bearing table rows or labelled form domains', () => {
  const table = [
    'Test | Result | Norm | Interpretation',
    '--- | --- | --- | ---',
    ...Array.from({ length: 18 }, (_, index) => `Test ${index + 1} | ${index + 1} units | Recorded norm ${index + 1} | Recorded interpretation ${index + 1}`),
  ].join('\n');
  const fittedTable = normaliseReportSectionOutput(table, {
    section: 'Objective / Assessment Findings',
    guidance: { maxWords: 40 },
  });
  assert.match(fittedTable, /Test 18 \| 18 units/);

  const domains = [
    'Daily Activities', 'Self-Care', 'Communication', 'Social & Community Participation',
    'Learning', 'Home Living', 'Health & Wellbeing',
  ].map((domain) => `${domain}: ${Array.from({ length: 12 }, (_, index) => `recorded${index + 1}`).join(' ')}`).join('\n');
  const fittedDomains = normaliseReportSectionOutput(domains, {
    section: 'Functional Capacity Assessment Results (across 7 NDIS domains)',
    guidance: { maxWords: 30 },
  });
  assert.match(fittedDomains, /Health & Wellbeing:/);
});

test('whole-report prompt remains below the endpoint ceiling with oversized free text', () => {
  const huge = 'x'.repeat(20_000);
  const sections = Array.from({ length: 12 }, (_, index) => `Section ${index + 1}`);
  const prompt = buildReportDraftPrompt({
    reportTitle: 'Large progress report',
    clientContext: { goals: huge, conditions: [{ notes: huge }], assessments: [{ notes: huge }] },
    assessmentSummary: huge,
    priorReportContext: huge,
    soapContext: huge,
    sections,
    sectionGuidance: Object.fromEntries(sections.map((section) => [section, { prompt: huge }])),
    meta: { label: 'large', ai_instruction: huge },
  });

  assert.ok(prompt.length < 30_000, `bounded prompt was ${prompt.length} characters`);
  assert.match(prompt, /CLINICAL WRITING RULES/);
  assert.match(prompt, /OUTPUT REQUIREMENT/);
});

test('whole-report response is atomic and rejects missing or empty sections', () => {
  assert.deepEqual(
    validateReportBatchResponse(
      { Background: '  Recorded background. ', Recommendations: '1. Continue documented plan.' },
      ['Background', 'Recommendations'],
    ),
    { Background: 'Recorded background.', Recommendations: '1. Continue documented plan.' },
  );
  assert.throws(
    () => validateReportBatchResponse({ Background: 'Recorded background.' }, ['Background', 'Recommendations']),
    /Recommendations/,
  );
  assert.throws(
    () => validateReportBatchResponse({ Background: '', Recommendations: 'Present' }, ['Background', 'Recommendations']),
    /Background/,
  );
});

test('Generate All makes one schema-backed model call while single Generate and Tidy remain', () => {
  const editor = readSource('src', 'components', 'reports', 'wizard-steps', 'SectionEditor.jsx');
  const start = editor.indexOf('  const handleGenerateAll = async () => {');
  const end = editor.indexOf('  const completedSections =', start);
  assert.ok(start >= 0 && end > start, 'Generate All function must remain present');
  const generateAll = editor.slice(start, end);

  assert.equal((generateAll.match(/InvokeLLM\s*\(/g) || []).length, 1);
  assert.match(generateAll, /response_json_schema: buildReportBatchSchema/);
  assert.match(generateAll, /validateReportBatchResponse/);
  assert.match(editor, /const handleGenerate = async \(\) =>/);
  assert.match(editor, /const handleTidy = async \(\) =>/);
  assert.match(editor, /normaliseReportSectionOutput\(response/);
  assert.ok((editor.match(/buildReportDraftPrompt\(\{/g) || []).length >= 2);
  assert.match(editor, /\[`\$\{activeSection\}_ai_drafted`\]: true/);
});

test('legacy report templates, lifecycle, editor and export composition remain intact', () => {
  const wizard = readSource('src', 'components', 'reports', 'UnifiedReportWizard.jsx');
  const editor = readSource('src', 'components', 'reports', 'wizard-steps', 'SectionEditor.jsx');
  const review = readSource('src', 'components', 'reports', 'wizard-steps', 'ReviewExport.jsx');
  const templateStart = wizard.indexOf('const REPORT_TEMPLATES = {');
  const templateEnd = wizard.indexOf('\n};', templateStart);
  const templateBlock = templateStart >= 0 && templateEnd > templateStart
    ? wizard.slice(templateStart, templateEnd)
    : null;

  assert.ok(templateBlock, 'report template catalogue must remain parseable');
  assert.equal((templateBlock.match(/^  [a-z0-9_]+: \{/gm) || []).length, 128);
  for (const physioTemplate of [
    'physio_initial_assessment',
    'physio_progress_report',
    'physio_referrer_update',
    'physio_discharge_summary',
  ]) {
    assert.match(templateBlock, new RegExp(`^  ${physioTemplate}: \\{`, 'm'));
  }
  assert.match(wizard, /status: "final"/);
  assert.match(wizard, /SavedReport\.update\(/);
  assert.match(wizard, /SavedReport\.create\(/);
  assert.match(wizard, /win\.print\(\)/);
  assert.match(wizard, /outcomeComparisonHtml\(outcomeAssessments\)/);
  assert.match(wizard, /class="lh"/);
  assert.match(wizard, /class="signoff"/);
  assert.match(wizard, /class="sig-area"/);
  assert.match(wizard, /class="footer"/);
  assert.match(wizard, /clientAssessments=\{getOutcomeAssessments\(\)\}/);
  assert.match(wizard, /text\?\.trim\(\) \? renderRichText\(text\) : ''/);
  assert.match(editor, /<Textarea/);
  assert.match(editor, /\[activeSection\]: e\.target\.value/);
  assert.match(review, /splitReportHtml\(reportHtml\)/);
  assert.match(review, /recomposeReportHtml\(editParts, editableBody\)/);
  assert.match(review, /outcomeTableHtml/);
});
