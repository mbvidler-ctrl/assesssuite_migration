import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  appendAiDraftToEpisode,
  buildAiSavedReportDraftPayload,
  buildAiSoapNoteDraftPayload,
  createAiDraftExportEnvelope,
  createAiDraftRecord,
  parseAiDraftJson,
  PHYSIO_AI_DRAFT_TASK_IDS,
  physioAiDraftDestination,
} from '../../src/lib/physio/aiDraft.js';
import { PHYSIO_AI_TASK_IDS } from '../physioAiTasks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const provenance = Object.freeze({
  receipt_contract_version: 'physio-ai-provider-receipt/1.0.0',
  generated_at: '2026-08-22T00:00:00.000Z',
  provider: 'openai',
  model: 'synthetic-contract-model',
  provider_request_id_hash: 'abc123',
  usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 50, actual_cost_microusd: 8 },
});

test('all six physiotherapy AI task selections have a durable clinical-record destination', () => {
  assert.deepEqual(PHYSIO_AI_DRAFT_TASK_IDS, [
    'physio.initial_assessment_summary.v1',
    'physio.soap_note.v1',
    'physio.management_plan.v1',
    'physio.progress_comparison.v1',
    'physio.referrer_update.v1',
    'physio.discharge_summary.v1',
  ]);
  assert.deepEqual(PHYSIO_AI_DRAFT_TASK_IDS, PHYSIO_AI_TASK_IDS);
  for (const taskType of PHYSIO_AI_DRAFT_TASK_IDS) {
    assert.equal(
      physioAiDraftDestination(taskType),
      taskType === 'physio.soap_note.v1' ? 'soap_note' : 'saved_report',
    );
  }
});

test('edited JSON must remain a structured object before any clinical-record or export action', () => {
  assert.deepEqual(parseAiDraftJson('{"summary":"clinician edited"}'), { summary: 'clinician edited' });
  assert.throws(() => parseAiDraftJson('{broken'), /valid JSON/);
  assert.throws(() => parseAiDraftJson('["not", "an", "object"]'), /structured JSON object/);
});

test('saved AI draft retains output, immutable generation provenance and linked-record identity', () => {
  const record = createAiDraftRecord({
    generationId: 'generation-1',
    taskType: 'physio.progress_comparison.v1',
    draft: { comparison_summary: 'Edited comparison' },
    provenance,
    wasEdited: true,
    savedBy: 'user-1',
    linkedRecord: { entity: 'SavedReport', id: 'report-1' },
    now: new Date('2026-08-22T01:00:00.000Z'),
    idFactory: () => 'ai-draft-1',
  });
  provenance.usage.output_tokens = 999;
  assert.equal(record.output_state, 'clinician_edited_draft');
  assert.equal(record.generation_id, 'generation-1');
  assert.equal(record.source_output_state, 'ai_draft_unreviewed');
  assert.equal(record.generated_at, '2026-08-22T00:00:00.000Z');
  assert.equal(record.linked_entity, 'SavedReport');
  assert.equal(record.linked_record_id, 'report-1');
  assert.equal(record.provenance.usage.output_tokens, 50);

  const episode = appendAiDraftToEpisode({ id: 'episode-1', reporting: {} }, record);
  assert.deepEqual(episode.reporting.ai_drafts, [record]);
  assert.equal(episode.reporting.latest_ai_draft.id, 'ai-draft-1');
});

test('SOAP output creates a draft note while every other AI task creates an editable saved report', () => {
  const soap = buildAiSoapNoteDraftPayload({
    generationId: 'generation-1',
    orgId: 'org-1',
    clientId: 'client-1',
    careEpisodeId: 'episode-1',
    draft: {
      subjective: 'Subjective edited',
      objective: 'Objective edited',
      assessment_for_clinician_review: 'Assessment edited',
      plan_for_clinician_confirmation: 'Plan edited',
      unresolved_safety_questions: ['Confirm symptom behaviour'],
      omissions_or_uncertainties: [],
    },
    provenance,
    outputState: 'ai_draft_unreviewed',
    now: new Date('2026-08-22T02:00:00.000Z'),
  });
  assert.equal(soap.status, 'draft');
  assert.equal(soap.subjective, 'Subjective edited');
  assert.equal(soap.physio_care_episode_id, 'episode-1');
  assert.equal(soap.ai_generation.generation_id, 'generation-1');
  assert.deepEqual(soap.ai_generation.provenance, provenance);

  for (const taskType of PHYSIO_AI_DRAFT_TASK_IDS.filter((id) => id !== 'physio.soap_note.v1')) {
    const report = buildAiSavedReportDraftPayload({
      generationId: `generation-${taskType}`,
      orgId: 'org-1',
      clientId: 'client-1',
      careEpisodeId: 'episode-1',
      taskType,
      taskLabel: taskType,
      draft: { clinician_editable_section: `Edited ${taskType}` },
      provenance,
      outputState: 'ai_draft_unreviewed',
      assessmentIds: ['assessment-1', 'assessment-1'],
      now: new Date('2026-08-22T02:00:00.000Z'),
    });
    assert.equal(report.status, 'draft');
    assert.equal(report.physio_care_episode_id, 'episode-1');
    assert.deepEqual(report.assessment_ids, ['assessment-1']);
    assert.equal(report.ai_generation.generation_id, `generation-${taskType}`);
    assert.match(report.report_html, /AI generation provenance/);
    assert.deepEqual(report.ai_generation.provenance, provenance);
  }
});

test('export envelope includes the edited content and the exact provider receipt', () => {
  const envelope = createAiDraftExportEnvelope({
    taskType: 'physio.discharge_summary.v1',
    draft: { episode_summary: 'Clinician edited discharge summary' },
    provenance,
    outputState: 'ai_draft_unreviewed',
  });
  assert.equal(envelope.export_type, 'assesssuite_physio_ai_draft');
  assert.equal(envelope.draft.episode_summary, 'Clinician edited discharge summary');
  assert.deepEqual(envelope.provenance, provenance);
});

test('workspace exposes edit, explicit save, download and print without automatic persistence', () => {
  const component = read('src', 'components', 'physio', 'PhysioAiWorkspace.jsx');
  const page = read('src', 'pages', 'PhysioEpisodes.jsx');
  const schema = read('base44', 'entities', 'PhysioCareEpisode.jsonc');

  for (const required of [
    'Editable AI draft JSON',
    'Save as SOAP note draft',
    'Save as report draft',
    'Copy edited JSON',
    'Download JSON',
    'Print draft',
    'onSaveDraft',
  ]) assert.ok(component.includes(required), `missing ${required}`);

  assert.match(page, /saveAiDraftToClinicalRecord/);
  assert.match(page, /base44\.functions\.invoke\('savePhysioAiGeneration'/);
  assert.doesNotMatch(page, /base44\.entities\.SOAPNote\.create/);
  assert.doesNotMatch(page, /base44\.entities\.SavedReport\.create/);
  assert.match(page, /generation_id: generationId/);
  assert.match(page, /expected_episode_updated_date: careEpisodeUpdatedDate/);
  assert.doesNotMatch(page, /episodeBeforeAiSave/);
  assert.match(component, /careEpisodeSnapshot: JSON\.stringify\(careEpisode\)/);
  assert.doesNotMatch(page, /onDraftGenerated=/);
  assert.match(schema, /"ai_drafts"/);
  assert.match(schema, /"generation_id"/);
  assert.match(schema, /"linked_record_id"/);
  assert.match(component, /payload\?\.care_episode_id !== requestedCareEpisodeId/);
  assert.match(component, /generation_request_id: generationRequestId/);
  assert.match(component, /generationId: result\.generation_id/);
  assert.match(component, /careEpisodeId: result\.care_episode_id/);
  assert.match(page, /careEpisodeId !== draft\?\.id/);
});
