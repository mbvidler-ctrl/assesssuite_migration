import assert from 'node:assert/strict';
import test from 'node:test';

import { AI_SECTION_TAG, AI_REPORT_DISCLOSURE_SENTENCE } from '../../../src/lib/clinical/aiProvenance.js';
import { buildEvidenceCatalogue } from '../domain/evidence.mjs';
import { detectSourceChanges } from '../domain/sourceSet.mjs';
import { escapeHtml, sha256Canonical } from '../domain/util.mjs';
import * as workflow from '../domain/workflow.mjs';
import { episodeContext } from '../fixtures/syntheticDataset.mjs';
import { KNEE, SYNTHETIC_NOW, catalogueFor, createKneeRequest, deterministicIds, driveToApproved, fixtures } from './support.mjs';

function rejects(fn, status, code) {
  assert.throws(fn, (error) => {
    assert.equal(error.status, status, `${error.code}: ${error.message}`);
    assert.equal(error.code, code);
    return true;
  });
}

test('an output request retains its metadata and episode association', () => {
  const { principals } = fixtures();
  const request = createKneeRequest({ actor: principals.treating, idFactory: deterministicIds() });
  assert.equal(request.status, 'requested');
  assert.equal(request.version, 1);
  assert.equal(request.physio_care_episode_id, KNEE);
  assert.equal(request.client_id, 'client-synthetic-knee');
  assert.equal(request.report_type, 'PHYSIO_PROGRESS_REPORT');
  assert.equal(request.template_version, 'physio-progress-report/1.0.0');
  assert.deepEqual(request.recipient, { name: 'Dr Synthetic Referrer', role: 'referring_gp', organisation: 'Synthetic Medical Centre', channel: 'not_specified' });
  assert.deepEqual(request.clinical_questions, ['Has function improved since baseline?', 'Is further treatment indicated?']);
  assert.equal(request.due_date, '2026-09-12');
  assert.equal(request.owner_user_id, principals.treating.user_id);
  assert.equal(request.required_evidence.length, 10);
  assert.deepEqual(request.history.map((entry) => entry.event), ['request_created']);
});

test('creation validates report type, recipient role, due date and unknown parameters', () => {
  const { principals } = fixtures();
  const ctx = { now: SYNTHETIC_NOW, idFactory: deterministicIds(), actor: principals.treating };
  const base = {
    org_id: 'org-synthetic-physio', client_id: 'client-synthetic-knee', physio_care_episode_id: KNEE,
    report_type: 'PHYSIO_PROGRESS_REPORT', purpose: 'Purpose', recipient: { name: 'R', role: 'referring_gp' },
    owner_user_id: principals.treating.user_id, due_date: '2026-09-12',
  };
  rejects(() => workflow.createOutputRequest({ ...base, report_type: 'GP_SUMMARY_LETTER' }, ctx), 400, 'unsupported_report_type');
  rejects(() => workflow.createOutputRequest({ ...base, recipient: { name: 'R', role: 'wizard' } }, ctx), 400, 'invalid_request');
  rejects(() => workflow.createOutputRequest({ ...base, due_date: 'next week' }, ctx), 400, 'invalid_request');
  rejects(() => workflow.createOutputRequest({ ...base, surprise: true }, ctx), 400, 'unknown_parameters');
  rejects(() => workflow.createOutputRequest({ ...base, required_evidence: ['imaging'] }, ctx), 400, 'invalid_request');
});

test('optimistic concurrency and command idempotency protect every mutation', () => {
  const { dataset, principals } = fixtures();
  const idFactory = deterministicIds();
  const catalogue = catalogueFor(dataset, KNEE);
  const ctx = { now: SYNTHETIC_NOW, idFactory, actor: principals.treating, catalogue };
  const request = createKneeRequest({ actor: principals.treating, idFactory });
  rejects(() => workflow.assembleEvidence(request, {}, ctx), 400, 'expected_version_required');
  rejects(() => workflow.assembleEvidence(request, { expected_version: 99 }, ctx), 409, 'request_changed');
  const first = workflow.assembleEvidence(request, { expected_version: 1, command_id: 'cmd-assemble-1' }, ctx);
  assert.equal(first.replayed, false);
  assert.equal(first.request.version, 2);
  const replay = workflow.assembleEvidence(first.request, { expected_version: 1, command_id: 'cmd-assemble-1' }, ctx);
  assert.equal(replay.replayed, true);
  assert.equal(replay.request.version, 2);
  rejects(() => workflow.assembleEvidence(first.request, { expected_version: 2, command_id: 'cmd-assemble-1', source_ids: ['referral:episode-synthetic-knee-1'] }, ctx), 409, 'command_conflict');
  assert.equal(request.version, 1, 'the input request is never mutated');
});

test('facts sections cannot be edited as free text and review requires content', () => {
  const { dataset, principals } = fixtures();
  const { drafted, ctx } = driveToApproved({ dataset, principals });
  const draft = drafted;
  rejects(() => workflow.saveDraft(draft, { expected_version: draft.version, sections: [{ key: 'outcome_measures', text: 'tampered' }] }, ctx(principals.treating)), 400, 'facts_not_editable');
  rejects(() => workflow.saveDraft(draft, { expected_version: draft.version, sections: [{ key: 'no_such_section', text: 'x' }] }, ctx(principals.treating)), 400, 'unknown_section');
  rejects(() => workflow.saveDraft(draft, { expected_version: draft.version, sections: [{ key: 'functional_change', review_state: 'reviewed' }] }, ctx(principals.treating)), 400, 'invalid_request');
  rejects(() => workflow.saveDraft(draft, { expected_version: draft.version, sections: [{ key: 'functional_change', review_state: 'not_applicable' }] }, ctx(principals.treating)), 400, 'not_applicable_reason_required');
  rejects(() => workflow.submitForReview(draft, { expected_version: draft.version }, ctx(principals.treating)), 409, 'draft_incomplete');
});

test('approval freezes an immutable snapshot with a source manifest and provenance', () => {
  const { dataset, principals } = fixtures();
  const { request, snapshot, submitted } = driveToApproved({ dataset, principals });
  assert.equal(request.status, 'approved');
  assert.equal(request.current_snapshot_id, snapshot.id);
  assert.equal(snapshot.approved_by_user_id, principals.senior.user_id);
  assert.match(snapshot.content_sha256, /^[0-9a-f]{64}$/);
  assert.equal(snapshot.document_sha256, sha256Canonical(snapshot.rendered_html));
  assert.equal(snapshot.manifest_sha256, request.source_sets[0].manifest_sha256);
  assert.equal(snapshot.source_set.items.length, 24);
  assert.ok(snapshot.rendered_html.includes('APPROVED'));
  assert.ok(snapshot.rendered_html.includes(snapshot.content_sha256));
  assert.ok(snapshot.rendered_html.includes('Synthetic Senior Physiotherapist'));
  assert.deepEqual(request.snapshot_chain, [{ snapshot_id: snapshot.id, sequence: 1, approved_at: request.history.at(-1).occurred_at, supersedes_snapshot_id: null, superseded_by_snapshot_id: null, superseded_at: null, supersession_reason: null }]);
  assert.equal(submitted.status, 'needs_review', 'prior states are untouched');

  const frozen = structuredClone(snapshot);
  const ctxAuthor = { now: '2026-09-07T00:00:00.000Z', idFactory: deterministicIds('late-'), actor: principals.treating };
  rejects(() => workflow.saveDraft(request, { expected_version: request.version, sections: [{ key: 'clinical_interpretation', text: 'edited' }] }, ctxAuthor), 409, 'approved_snapshot_immutable');
  rejects(() => workflow.refreshSources(request, { expected_version: request.version }, { ...ctxAuthor, catalogue: catalogueFor(dataset, KNEE) }), 409, 'approved_snapshot_immutable');
  rejects(() => workflow.importAiDraftSection(request, { expected_version: request.version, section_key: 'functional_change', source_id: 'saved_report:report-knee-ai-referrer-draft', field: 'Clinical and functional update' }, ctxAuthor), 409, 'approved_snapshot_immutable');
  rejects(() => workflow.cancel(request, { expected_version: request.version, reason: 'x' }, ctxAuthor), 409, 'approved_snapshot_immutable');
  assert.deepEqual(snapshot, frozen);
});

test('a later source change never alters the existing draft or snapshot without an explicit refresh', () => {
  const { dataset, principals } = fixtures();
  const { saved, snapshot, ctx } = driveToApproved({ dataset, principals });
  const context = episodeContext(dataset, KNEE);
  const changed = structuredClone(context);
  changed.episode.goals[0].status = 'achieved';
  changed.episode.updated_date = '2026-09-07T00:00:00.000Z';
  changed.assessments.push({ ...context.assessments[0], id: 'ca-knee-nprs-late', assessment_date: '2026-09-07', result_value: 1, updated_date: '2026-09-07T00:00:00.000Z' });
  const laterCatalogue = buildEvidenceCatalogue(changed);

  const draftBefore = structuredClone(saved);
  const snapshotBefore = structuredClone(snapshot);
  const staleness = detectSourceChanges({ sourceSet: saved.source_sets[0], catalogue: laterCatalogue, reportTypeId: saved.report_type });
  assert.equal(staleness.is_stale, true);
  assert.deepEqual(saved, draftBefore);
  assert.deepEqual(snapshot, snapshotBefore);
  assert.equal(snapshot.source_set.items.find((entry) => entry.source_id === 'goal:episode-synthetic-knee-1:goal-knee-stairs').content.status, 'in_progress');

  // A draft still under review cannot be approved against changed sources without acknowledgement.
  let request = saved;
  ({ request } = workflow.submitForReview(request, { expected_version: request.version }, ctx(principals.treating)));
  rejects(() => workflow.approve(request, { expected_version: request.version }, ctx(principals.senior, { catalogue: laterCatalogue })), 409, 'sources_changed');
  const acknowledged = workflow.approve(request, { expected_version: request.version, acknowledge_stale_sources: true }, ctx(principals.senior, { catalogue: laterCatalogue }));
  assert.equal(acknowledged.snapshot.stale_sources_acknowledged, true);
  assert.equal(acknowledged.snapshot.staleness_at_approval.changed.length, 1);
  assert.equal(acknowledged.snapshot.staleness_at_approval.added.length, 1);
  assert.ok(acknowledged.snapshot.rendered_html.includes('approved this document as at its pinned sources'));

  // The explicit refresh creates a new source set and revision, carrying narrative forward for review.
  rejects(() => workflow.refreshSources(saved, { expected_version: saved.version }, ctx(principals.treating, { catalogue: catalogueFor(dataset, KNEE) })), 409, 'sources_unchanged');
  const refreshed = workflow.refreshSources(saved, { expected_version: saved.version }, ctx(principals.treating, { catalogue: laterCatalogue })).request;
  assert.equal(refreshed.source_sets.length, 2);
  assert.equal(refreshed.source_sets[1].version, 2);
  assert.notEqual(refreshed.source_sets[1].manifest_sha256, refreshed.source_sets[0].manifest_sha256);
  const revision = refreshed.draft_revisions.at(-1);
  assert.equal(revision.source_set_version, 2);
  assert.deepEqual(revision.refresh_diff.changed.map((entry) => entry.source_id), ['goal:episode-synthetic-knee-1:goal-knee-stairs']);
  assert.deepEqual(revision.refresh_diff.added.map((entry) => entry.source_id), ['measurement:ca-knee-nprs-late']);
  const carried = revision.sections.find((section) => section.key === 'clinical_interpretation');
  assert.equal(carried.text, 'Synthetic interpretation narrative.');
  assert.equal(carried.review_state, 'in_progress');
  assert.match(carried.refresh_note, /Carried forward from source set version 1/);
  const goalsTable = revision.sections.find((section) => section.key === 'goal_progress').blocks[0];
  assert.equal(goalsTable.rows[0][4], 'achieved');
  const outcomeTable = revision.sections.find((section) => section.key === 'outcome_measures').blocks[0];
  assert.equal(outcomeTable.rows[1][2], '1 /10 (07/09/2026)');
});

test('an amendment creates a linked successor snapshot and preserves the original', () => {
  const { dataset, principals } = fixtures();
  const { request: approved, snapshot: original, catalogue, ctx } = driveToApproved({ dataset, principals });
  const originalCopy = structuredClone(original);
  rejects(() => workflow.openAmendment(approved, { expected_version: approved.version, reason: '' }, ctx(principals.treating, { snapshot: original })), 400, 'invalid_request');
  let request = workflow.openAmendment(approved, { expected_version: approved.version, reason: 'Correct the recommendation wording' }, ctx(principals.treating, { snapshot: original })).request;
  assert.equal(request.status, 'amendment_in_progress');
  const amendmentRevision = request.draft_revisions.at(-1);
  assert.equal(amendmentRevision.based_on_snapshot_id, original.id);
  assert.equal(amendmentRevision.amendment.supersedes_snapshot_id, original.id);
  assert.equal(amendmentRevision.sections.find((section) => section.key === 'recommendations_plan').text, 'Synthetic recommendations narrative.');

  ({ request } = workflow.saveDraft(request, { expected_version: request.version, sections: [{ key: 'recommendations_plan', text: 'Corrected synthetic recommendation.' }] }, ctx(principals.treating)));
  assert.equal(request.status, 'amendment_in_progress');
  ({ request } = workflow.submitForReview(request, { expected_version: request.version }, ctx(principals.treating)));
  const successor = workflow.approve(request, { expected_version: request.version }, ctx(principals.senior, { catalogue }));
  assert.equal(successor.request.status, 'approved');
  assert.equal(successor.snapshot.supersedes_snapshot_id, original.id);
  assert.equal(successor.snapshot.sequence, 2);
  assert.ok(successor.snapshot.rendered_html.includes('APPROVED — AMENDED OUTPUT'));
  assert.ok(successor.snapshot.rendered_html.includes('Corrected synthetic recommendation.'));
  assert.equal(successor.request.current_snapshot_id, successor.snapshot.id);
  assert.deepEqual(successor.request.snapshot_ids, [original.id, successor.snapshot.id]);
  const chain = successor.request.snapshot_chain;
  assert.equal(chain[0].superseded_by_snapshot_id, successor.snapshot.id);
  assert.equal(chain[0].supersession_reason, 'Correct the recommendation wording');
  assert.equal(chain[1].supersedes_snapshot_id, original.id);
  assert.deepEqual(original, originalCopy, 'the original snapshot object is untouched');
  assert.notEqual(successor.snapshot.content_sha256, original.content_sha256);
});

test('an imported AI-assisted draft stays labelled and cannot be approved before clinician review', () => {
  const { dataset, principals } = fixtures();
  const { drafted, catalogue, ctx } = driveToApproved({ dataset, principals });
  let request = drafted;
  rejects(() => workflow.importAiDraftSection(request, { expected_version: request.version, section_key: 'outcome_measures', source_id: 'saved_report:report-knee-ai-referrer-draft', field: 'Clinical and functional update' }, ctx(principals.treating)), 400, 'ai_not_allowed_for_section');
  rejects(() => workflow.importAiDraftSection(request, { expected_version: request.version, section_key: 'functional_change', source_id: 'soap_note:note-knee-1', field: 'subjective' }, ctx(principals.treating)), 400, 'source_not_ai_draft');
  rejects(() => workflow.importAiDraftSection(request, { expected_version: request.version, section_key: 'functional_change', source_id: 'saved_report:report-knee-ai-referrer-draft', field: 'Missing field' }, ctx(principals.treating)), 400, 'ai_draft_field_missing');
  ({ request } = workflow.importAiDraftSection(request, { expected_version: request.version, section_key: 'functional_change', source_id: 'saved_report:report-knee-ai-referrer-draft', field: 'Clinical and functional update' }, ctx(principals.treating)));
  const imported = request.draft_revisions.at(-1).sections.find((section) => section.key === 'functional_change');
  assert.equal(imported.origin, 'ai_assisted');
  assert.equal(imported.review_state, 'in_progress');
  assert.equal(imported.ai_attribution.generation_id, 'gen-synthetic-0001');
  assert.equal(imported.ai_attribution.task_type, 'physio.referrer_update.v1');
  assert.match(imported.text, /Synthetic AI-assisted draft/);

  ({ request } = workflow.saveDraft(request, { expected_version: request.version, sections: [
    { key: 'clinical_interpretation', text: 'Interpretation.' },
    { key: 'recommendations_plan', text: 'Plan.' },
  ] }, ctx(principals.treating)));
  ({ request } = workflow.submitForReview(request, { expected_version: request.version }, ctx(principals.treating)));
  rejects(() => workflow.approve(request, { expected_version: request.version }, ctx(principals.senior, { catalogue })), 409, 'ai_sections_unreviewed');

  ({ request } = workflow.saveDraft(request, { expected_version: request.version, sections: [{ key: 'functional_change', text: `${imported.text} Edited by the clinician.`, review_state: 'reviewed' }] }, ctx(principals.treating)));
  assert.equal(request.status, 'draft', 'editing during review returns the request to draft');
  const reviewed = request.draft_revisions.at(-1).sections.find((section) => section.key === 'functional_change');
  assert.equal(reviewed.review_state, 'reviewed');
  assert.equal(reviewed.ai_attribution.edited_after_import, true);
  ({ request } = workflow.submitForReview(request, { expected_version: request.version }, ctx(principals.treating)));
  const { snapshot } = workflow.approve(request, { expected_version: request.version }, ctx(principals.senior, { catalogue }));
  assert.ok(snapshot.rendered_html.includes(`${AI_SECTION_TAG}, clinician reviewed`));
  assert.ok(snapshot.rendered_html.includes(escapeHtml(AI_REPORT_DISCLOSURE_SENTENCE)), 'the disclosure sentence is rendered (HTML-escaped)');
  assert.ok(snapshot.rendered_html.includes('gen-synthetic-0001'));
  assert.equal(snapshot.document_model.ai_disclosure, true);
});

test('delivery is only ever recorded manually and exports are logged', () => {
  const { dataset, principals } = fixtures();
  const { request: approved, snapshot, ctx } = driveToApproved({ dataset, principals });
  rejects(() => workflow.recordDelivery(approved, { expected_version: approved.version, channel: 'secure_message', integration: 'sendgrid' }, ctx(principals.admin)), 400, 'unknown_parameters');
  const sent = workflow.recordDelivery(approved, { expected_version: approved.version, channel: 'secure_message', recipient_note: 'Sent via the practice portal.' }, ctx(principals.admin)).request;
  assert.equal(sent.status, 'sent');
  assert.equal(sent.delivery_events[0].status, 'recorded_manually');
  assert.equal(sent.delivery_events[0].integration, 'none');
  assert.equal(sent.delivery_events[0].snapshot_id, snapshot.id);
  const exported = workflow.recordExport(sent, { snapshot_id: snapshot.id, format: 'print' }, ctx(principals.treating)).request;
  assert.equal(exported.export_events.length, 1);
  assert.equal(exported.version, sent.version, 'export logging does not bump the concurrency version');
  rejects(() => workflow.recordExport(sent, { snapshot_id: 'snap-nope', format: 'print' }, ctx(principals.treating)), 404, 'snapshot_not_found');
  const history = exported.history.map((entry) => entry.sequence);
  assert.deepEqual(history, history.map((_, index) => index + 1));
});

test('cancellation is possible before approval and keeps the history', () => {
  const { dataset, principals } = fixtures();
  const { drafted, ctx } = driveToApproved({ dataset, principals });
  const cancelled = workflow.cancel(drafted, { expected_version: drafted.version, reason: 'Recipient no longer requires the report' }, ctx(principals.admin)).request;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellation.from_status, 'draft');
  assert.equal(cancelled.history.at(-1).event, 'cancelled');
  rejects(() => workflow.saveDraft(cancelled, { expected_version: cancelled.version, sections: [] }, ctx(principals.treating)), 409, 'invalid_status_transition');
});
