import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceCatalogue } from '../domain/evidence.mjs';
import { buildDocumentModel, generateFactSections, outcomeComparisonRows, renderDocumentHtml } from '../domain/render.mjs';
import { detectSourceChanges, pinSourceSet, sourceSetManifest } from '../domain/sourceSet.mjs';
import { episodeContext } from '../fixtures/syntheticDataset.mjs';
import { KNEE, SHOULDER, SYNTHETIC_NOW, catalogueFor, createKneeRequest, deterministicIds, fixtures } from './support.mjs';

function pin(catalogue, reportTypeId = 'PHYSIO_PROGRESS_REPORT', extra = {}) {
  return pinSourceSet({ catalogue, reportTypeId, version: 1, id: 'src-test', createdAt: SYNTHETIC_NOW, createdBy: 'user-synthetic-treating', ...extra });
}

test('a SourceSet pins stable, inspectable references and a manifest hash', () => {
  const { dataset } = fixtures();
  const catalogue = catalogueFor(dataset, KNEE);
  const first = pin(catalogue);
  const second = pin(catalogue);
  assert.equal(first.manifest_sha256, second.manifest_sha256);
  assert.deepEqual(first.items, second.items);
  assert.equal(first.items.length, 24);
  assert.deepEqual(first.items.map((entry) => entry.source_id), [...first.items.map((entry) => entry.source_id)].sort());
  assert.deepEqual(first.measure_definitions.map((definition) => definition.assessment_id), ['asmt-lefs', 'asmt-nprs', 'asmt-stair']);
  const manifest = sourceSetManifest(first);
  assert.equal(manifest.items.every((entry) => !('content' in entry)), true);
  assert.equal(manifest.manifest_sha256, first.manifest_sha256);
  assert.throws(() => pin(catalogue, 'PHYSIO_PROGRESS_REPORT', { sourceIds: ['goal:nope'] }), (error) => error.code === 'unknown_source');
});

test('an explicit selection pins only the chosen sources and records the rule', () => {
  const { dataset } = fixtures();
  const catalogue = catalogueFor(dataset, KNEE);
  const chosen = ['referral:episode-synthetic-knee-1', 'measurement:ca-knee-nprs-1', 'measurement:ca-knee-nprs-2'];
  const set = pin(catalogue, 'PHYSIO_PROGRESS_REPORT', { sourceIds: chosen });
  assert.deepEqual(set.selection.source_ids, [...chosen].sort());
  assert.match(set.selection.rules[0], /Explicit clinician selection/);
  assert.notEqual(set.manifest_sha256, pin(catalogue).manifest_sha256);
});

test('detectSourceChanges reports changed, added and removed sources without mutating anything', () => {
  const { dataset } = fixtures();
  const context = episodeContext(dataset, KNEE);
  const catalogue = buildEvidenceCatalogue(context);
  const set = pin(catalogue);
  assert.equal(detectSourceChanges({ sourceSet: set, catalogue, reportTypeId: 'PHYSIO_PROGRESS_REPORT' }).is_stale, false);

  const changedContext = structuredClone(context);
  changedContext.episode.goals[0].status = 'achieved';
  changedContext.episode.updated_date = '2026-09-05T00:00:00.000Z';
  changedContext.assessments.push({ ...context.assessments[0], id: 'ca-knee-nprs-3', assessment_date: '2026-09-05', result_value: 2 });
  changedContext.soapNotes = changedContext.soapNotes.filter((note) => note.id !== 'note-knee-3');
  const changes = detectSourceChanges({ sourceSet: set, catalogue: buildEvidenceCatalogue(changedContext), reportTypeId: 'PHYSIO_PROGRESS_REPORT' });
  assert.equal(changes.is_stale, true);
  assert.deepEqual(changes.changed.map((entry) => entry.source_id), ['goal:episode-synthetic-knee-1:goal-knee-stairs']);
  assert.deepEqual(changes.added.map((entry) => entry.source_id), ['measurement:ca-knee-nprs-3']);
  assert.deepEqual(changes.removed.map((entry) => entry.source_id), ['soap_note:note-knee-3']);
  assert.equal(set.items.find((entry) => entry.source_id === 'goal:episode-synthetic-knee-1:goal-knee-stairs').content.status, 'in_progress');
});

test('outcome rows are computed from pinned structured data and change with the fixture', () => {
  const { dataset } = fixtures();
  const knee = outcomeComparisonRows(pin(catalogueFor(dataset, KNEE)));
  assert.deepEqual(knee.map((row) => [row.name, row.baseline_value, row.latest_value, row.change, row.interpretation]), [
    ['Lower Extremity Functional Scale (LEFS)', 46, 63, 17, 'Improved'],
    ['Numeric Pain Rating Scale (NPRS)', 6, 3, -3, 'Improved'],
    ['Timed stair climb (12 steps)', 14.2, null, null, 'Baseline only — no comparison available'],
  ]);
  assert.deepEqual(knee[0].source_refs, ['measurement:ca-knee-lefs-1', 'measurement:ca-knee-lefs-2']);
  const shoulder = outcomeComparisonRows(pin(catalogueFor(dataset, SHOULDER)));
  assert.deepEqual(shoulder.map((row) => [row.name, row.baseline_value, row.has_comparison]), [['QuickDASH', 43.2, false]]);
});

test('fact sections are generated deterministically and differ between fixtures', () => {
  const { dataset, principals } = fixtures();
  const request = createKneeRequest({ actor: principals.treating, idFactory: deterministicIds() });
  const kneeSet = pin(catalogueFor(dataset, KNEE));
  const first = generateFactSections({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', sourceSet: kneeSet, request, completeness: null });
  const second = generateFactSections({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', sourceSet: kneeSet, request, completeness: null });
  assert.deepEqual(first, second);
  const table = first.outcome_measures.blocks.find((block) => block.type === 'table');
  assert.deepEqual(table.rows[1], ['Numeric Pain Rating Scale (NPRS)', '6 /10 (06/07/2026)', '3 /10 (24/08/2026)', '-3 /10', 'Improved']);
  const goals = first.goal_progress.blocks.find((block) => block.type === 'table');
  assert.equal(goals.rows.length, 2);
  const shoulderSet = pin(catalogueFor(dataset, SHOULDER));
  const shoulder = generateFactSections({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', sourceSet: shoulderSet, request, completeness: null });
  assert.notDeepEqual(shoulder.outcome_measures, first.outcome_measures);
  assert.equal(shoulder.goal_progress.blocks[0].type, 'notice');
  assert.match(shoulder.goal_progress.blocks[0].text, /No goals are recorded/);
});

test('the renderer is a pure function of the document model and escapes narrative text', () => {
  const { dataset, principals } = fixtures();
  const request = createKneeRequest({ actor: principals.treating, idFactory: deterministicIds() });
  const sourceSet = pin(catalogueFor(dataset, KNEE));
  const facts = generateFactSections({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', sourceSet, request, completeness: null });
  const sections = [
    { key: 'referral_question', kind: 'facts', origin: 'facts', review_state: 'reviewed', blocks: facts.referral_question.blocks, source_refs: facts.referral_question.source_refs },
    { key: 'baseline_findings', kind: 'facts', origin: 'facts', review_state: 'reviewed', blocks: facts.baseline_findings.blocks, source_refs: facts.baseline_findings.source_refs },
    { key: 'outcome_measures', kind: 'facts', origin: 'facts', review_state: 'reviewed', blocks: facts.outcome_measures.blocks, source_refs: facts.outcome_measures.source_refs },
    { key: 'goal_progress', kind: 'facts', origin: 'facts', review_state: 'reviewed', blocks: facts.goal_progress.blocks, source_refs: facts.goal_progress.source_refs },
    { key: 'management_delivered', kind: 'facts', origin: 'facts', review_state: 'reviewed', blocks: facts.management_delivered.blocks, source_refs: facts.management_delivered.source_refs },
    { key: 'functional_change', kind: 'narrative', origin: 'clinician', review_state: 'in_progress', text: 'Narrative with <script>alert(1)</script> markup', source_refs: [] },
    { key: 'clinical_interpretation', kind: 'narrative', origin: 'clinician', review_state: 'in_progress', text: 'Interpretation', source_refs: [] },
    { key: 'recommendations_plan', kind: 'narrative', origin: 'clinician', review_state: 'in_progress', text: 'Plan', source_refs: [] },
    { key: 'limitations_provenance', kind: 'facts', origin: 'facts', review_state: 'reviewed', blocks: facts.limitations_provenance.blocks, source_refs: [] },
  ];
  const model = buildDocumentModel({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', request, sections, sourceSet, completeness: null, meta: { synthetic: true } });
  const html = renderDocumentHtml(model);
  assert.equal(html, renderDocumentHtml(structuredClone(model)));
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('SYNTHETIC DEMONSTRATION DATA'));
  assert.ok(html.includes('DRAFT — NOT APPROVED'));
  assert.ok(html.includes(sourceSet.manifest_sha256));
  assert.equal(html.includes('AI-assisted draft, clinician reviewed'), false);
  assert.equal(html.includes('NOT YET REVIEWED'), false);
  assert.equal(html.includes('class="disclosure"'), false, 'no AI disclosure when no section is AI-assisted');
});
