import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCanApprove, assertCanAuthor, assertCanRequest, assertEpisodeAccess, assertOrgMember } from '../domain/admission.mjs';
import { REPORT_DRAFT_SECTION_TASK, buildSectionDraftInput, createSectionDraftTask, validateTaskOutput } from '../domain/aiTasks.mjs';
import { pinSourceSet } from '../domain/sourceSet.mjs';
import { KNEE, SYNTHETIC_NOW, catalogueFor, createKneeRequest, deterministicIds, fixtures, startTestApi } from './support.mjs';

function rejects(fn, status, code) {
  assert.throws(fn, (error) => {
    assert.equal(error.status, status, `${error.code}: ${error.message}`);
    assert.equal(error.code, code);
    return true;
  });
}

test('admission checks fail closed for anonymous, inactive, foreign and non-clinical callers', () => {
  const { principals } = fixtures();
  const org = 'org-synthetic-physio';
  rejects(() => assertOrgMember(null, org), 401, 'authentication_required');
  rejects(() => assertOrgMember(principals.inactive, org), 403, 'account_inactive');
  rejects(() => assertOrgMember(principals.other, org), 403, 'organization_access_denied');
  rejects(() => assertCanRequest(principals.treating, ''), 400, 'organization_required');
  assert.equal(assertCanRequest(principals.admin, org), principals.admin);
  rejects(() => assertCanAuthor(principals.admin, org), 403, 'clinical_role_required');
  assert.equal(assertCanAuthor(principals.treating, org), principals.treating);
  rejects(() => assertCanApprove(principals.treating, org), 403, 'approval_not_permitted');
  rejects(() => assertCanApprove(principals.admin, org), 403, 'clinical_role_required');
  assert.equal(assertCanApprove(principals.senior, org), principals.senior);
  rejects(() => assertEpisodeAccess({ episode: { org_id: 'org-synthetic-other' }, orgId: org }), 404, 'care_episode_not_found');
  rejects(() => assertEpisodeAccess({ episode: { org_id: org, client_id: 'a' }, orgId: org, clientId: 'b' }), 409, 'care_episode_patient_mismatch');
});

test('the named task input is server-owned, bounded and stripped of identity', () => {
  const { dataset, principals } = fixtures();
  const request = createKneeRequest({ actor: principals.treating, idFactory: deterministicIds() });
  const sourceSet = pinSourceSet({ catalogue: catalogueFor(dataset, KNEE), reportTypeId: 'PHYSIO_PROGRESS_REPORT', version: 1, id: 'src-1', createdAt: SYNTHETIC_NOW, createdBy: 'u' });
  const input = buildSectionDraftInput({ request, sourceSet, sectionKey: 'functional_change' });
  assert.equal(input.task, REPORT_DRAFT_SECTION_TASK.id);
  assert.equal(input.sources.some((entry) => entry.category === 'client_summary'), false);
  const serialised = JSON.stringify(input);
  assert.equal(serialised.includes('Synthetic Patient A'), false);
  assert.equal(serialised.includes('Dr Synthetic Referrer'), false);
  assert.ok(input.sources.every((entry) => Object.keys(entry).sort().join(',') === 'category,content,recorded_at,source_id'));
  rejects(() => buildSectionDraftInput({ request, sourceSet, sectionKey: 'outcome_measures' }), 400, 'ai_not_allowed_for_section');
});

test('the closed output schema rejects extra, missing and oversized fields', () => {
  const valid = { draft_text: 'Draft.', claims: [{ text: 'Claim', source_ids: ['measurement:ca-knee-nprs-1'] }], uncertainties: [], clinician_review_questions: [] };
  assert.deepEqual(validateTaskOutput(valid), valid);
  rejects(() => validateTaskOutput({ ...valid, recommendation_to_approve: true }), 422, 'ai_output_schema_invalid');
  rejects(() => validateTaskOutput({ draft_text: 'Draft.' }), 422, 'ai_output_schema_invalid');
  rejects(() => validateTaskOutput({ ...valid, draft_text: 'x'.repeat(6001) }), 422, 'ai_output_schema_invalid');
  rejects(() => validateTaskOutput({ ...valid, claims: [{ text: 'Claim', source_ids: [] }] }), 422, 'ai_output_schema_invalid');
  rejects(() => validateTaskOutput({ ...valid, draft_text: '   ' }), 422, 'ai_output_schema_invalid');
});

test('without an adapter the task fails closed and never fabricates a draft', async () => {
  const { dataset, principals } = fixtures();
  const request = createKneeRequest({ actor: principals.treating, idFactory: deterministicIds() });
  const sourceSet = pinSourceSet({ catalogue: catalogueFor(dataset, KNEE), reportTypeId: 'PHYSIO_PROGRESS_REPORT', version: 1, id: 'src-1', createdAt: SYNTHETIC_NOW, createdBy: 'u' });
  const task = createSectionDraftTask();
  await assert.rejects(task({ request, sourceSet, sectionKey: 'functional_change' }), (error) => error.status === 503 && error.code === 'ai_drafting_unavailable');
});

test('with an adapter the task validates the receipt, the schema and the cited sources', async () => {
  const { dataset, principals } = fixtures();
  const request = createKneeRequest({ actor: principals.treating, idFactory: deterministicIds() });
  const sourceSet = pinSourceSet({ catalogue: catalogueFor(dataset, KNEE), reportTypeId: 'PHYSIO_PROGRESS_REPORT', version: 1, id: 'src-1', createdAt: SYNTHETIC_NOW, createdBy: 'u' });
  const good = async () => ({ receipt: { provider: 'fake', model: 'fake-model', finish_reason: 'stop' }, output: { draft_text: 'Synthetic adapter draft.', claims: [{ text: 'Pain improved', source_ids: ['measurement:ca-knee-nprs-1', 'measurement:ca-knee-nprs-2'] }], uncertainties: ['Adherence self-reported'], clinician_review_questions: ['Confirm running plan'] } });
  const generation = await createSectionDraftTask({ adapter: good, now: () => SYNTHETIC_NOW, idFactory: deterministicIds() })({ request, sourceSet, sectionKey: 'functional_change' });
  assert.equal(generation.output_state, 'ai_draft_unreviewed');
  assert.equal(generation.clinician_review_required, true);
  assert.equal(generation.provenance.model, 'fake-model');
  assert.match(generation.provenance.input_sha256, /^[0-9a-f]{64}$/);

  const extraField = async () => ({ receipt: { provider: 'fake', model: 'm', finish_reason: 'stop' }, output: { draft_text: 'x', claims: [], uncertainties: [], clinician_review_questions: [], approved: true } });
  await assert.rejects(createSectionDraftTask({ adapter: extraField })({ request, sourceSet, sectionKey: 'functional_change' }), (error) => error.code === 'ai_output_schema_invalid');
  const unpinned = async () => ({ receipt: { provider: 'fake', model: 'm', finish_reason: 'stop' }, output: { draft_text: 'x', claims: [{ text: 'c', source_ids: ['measurement:not-pinned'] }], uncertainties: [], clinician_review_questions: [] } });
  await assert.rejects(createSectionDraftTask({ adapter: unpinned })({ request, sourceSet, sectionKey: 'functional_change' }), (error) => error.code === 'ai_claim_source_not_pinned');
  const truncated = async () => ({ receipt: { provider: 'fake', model: 'm', finish_reason: 'length' }, output: { draft_text: 'x', claims: [], uncertainties: [], clinician_review_questions: [] } });
  await assert.rejects(createSectionDraftTask({ adapter: truncated })({ request, sourceSet, sectionKey: 'functional_change' }), (error) => error.code === 'ai_provider_receipt_incomplete');
});

test('over the API a generated section is applied as an unreviewed AI-assisted draft that blocks approval until reviewed', async () => {
  const adapter = async () => ({ receipt: { provider: 'fake', model: 'fake-model', finish_reason: 'stop' }, output: { draft_text: 'Synthetic adapter update.', claims: [{ text: 'Pain improved', source_ids: ['measurement:ca-knee-nprs-2'] }], uncertainties: [], clinician_review_questions: [] } });
  const api = await startTestApi({ aiAdapter: adapter });
  try {
    const treating = await api.login('treating');
    const senior = await api.login('senior');
    const requestId = api.seeded.updateRequestId;
    let detail = (await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body;
    assert.equal(detail.ai_drafting.state, 'configured');
    const drafted = await api.call(`/api/reporting/requests/${requestId}/ai/draft-section`, { method: 'POST', token: treating.token, body: { expected_version: detail.request.version, section_key: 'clinical_functional_update' } });
    assert.equal(drafted.status, 200, drafted.text);
    detail = (await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body;
    const section = detail.current_revision.sections.find((entry) => entry.key === 'clinical_functional_update');
    assert.equal(section.origin, 'ai_assisted');
    assert.equal(section.review_state, 'in_progress');
    assert.equal(section.ai_attribution.model, 'fake-model');
    assert.deepEqual(section.source_refs, ['measurement:ca-knee-nprs-2']);

    const save = await api.call(`/api/reporting/requests/${requestId}/commands/saveDraft`, { method: 'POST', token: treating.token, body: { expected_version: detail.request.version, sections: [{ key: 'current_plan', text: 'Synthetic plan.' }] } });
    assert.equal(save.status, 200, save.text);
    const submit = await api.call(`/api/reporting/requests/${requestId}/commands/submitForReview`, { method: 'POST', token: treating.token, body: { expected_version: save.body.version } });
    assert.equal(submit.status, 200, submit.text);
    const blocked = await api.call(`/api/reporting/requests/${requestId}/commands/approve`, { method: 'POST', token: senior.token, body: { expected_version: submit.body.version } });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'ai_sections_unreviewed');

    const adminAttempt = await api.call(`/api/reporting/requests/${requestId}/ai/draft-section`, { method: 'POST', token: (await api.login('admin')).token, body: { expected_version: submit.body.version, section_key: 'current_plan' } });
    assert.equal(adminAttempt.status, 403);
    assert.equal(adminAttempt.body.code, 'clinical_role_required');
  } finally {
    await api.stop();
  }
});
