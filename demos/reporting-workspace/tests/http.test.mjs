import assert from 'node:assert/strict';
import test from 'node:test';

import { startTestApi } from './support.mjs';

test('the API refuses anonymous callers and unknown routes with explicit envelopes', async () => {
  const api = await startTestApi();
  try {
    const anonymous = await api.call('/api/reporting/requests');
    assert.equal(anonymous.status, 401);
    assert.deepEqual(anonymous.body, { error: 'Authentication is required.', code: 'authentication_required' });
    const identities = await api.call('/api/demo/identities');
    assert.equal(identities.status, 200);
    assert.deepEqual(identities.body.identities.map((entry) => entry.key).sort(), ['admin', 'inactive', 'other', 'senior', 'treating']);
    const unknownIdentity = await api.call('/api/demo/session', { method: 'POST', body: { identity_key: 'ghost' } });
    assert.equal(unknownIdentity.status, 404);
    const treating = await api.login('treating');
    const unknownRoute = await api.call('/api/reporting/nothing', { token: treating.token });
    assert.equal(unknownRoute.status, 404);
    const badJson = await api.call('/api/reporting/requests', { method: 'POST', token: treating.token, body: '{not json', raw: true });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.code, 'invalid_json');
    const inactive = await api.login('inactive');
    const suspended = await api.call('/api/reporting/requests', { token: inactive.token });
    assert.equal(suspended.status, 403);
    assert.equal(suspended.body.code, 'account_inactive');
    const unknownCommand = await api.call(`/api/reporting/requests/${api.seeded.updateRequestId}/commands/applyAiSectionDraft`, { method: 'POST', token: treating.token, body: {} });
    assert.equal(unknownCommand.status, 404, 'the internal command is not reachable over HTTP');
  } finally {
    await api.stop();
  }
});

test('the seeded workspace shows the synthetic patient with an approved report and visible gaps elsewhere', async () => {
  const api = await startTestApi();
  try {
    const treating = await api.login('treating');
    const list = (await api.call('/api/reporting/requests', { token: treating.token })).body.requests;
    assert.deepEqual(list.map((entry) => [entry.client_display_name, entry.report_type, entry.status, entry.is_overdue]), [
      ['Synthetic Patient B (left shoulder)', 'PHYSIO_PROGRESS_REPORT', 'requested', true],
      ['Synthetic Patient A (right knee)', 'PHYSIO_PROGRESS_REPORT', 'approved', false],
      ['Synthetic Patient A (right knee)', 'PHYSIO_REFERRER_UPDATE', 'draft', false],
    ]);
    const episodes = (await api.call('/api/reporting/episodes', { token: treating.token })).body.episodes;
    assert.deepEqual(episodes.map((entry) => [entry.id, entry.request_count, entry.approved_request_count]), [
      ['episode-synthetic-knee-1', 2, 1],
      ['episode-synthetic-shoulder-1', 1, 0],
    ]);
    const workspace = (await api.call('/api/reporting/episodes/episode-synthetic-shoulder-1', { token: treating.token })).body;
    assert.equal(workspace.client.synthetic, true);
    assert.equal(workspace.completeness_by_type.PHYSIO_PROGRESS_REPORT.summary.missing, 6);
    assert.equal(workspace.evidence.length, 8);
    const detail = (await api.call(`/api/reporting/requests/${api.seeded.progressRequestId}`, { token: treating.token })).body;
    assert.equal(detail.summary.status, 'approved');
    assert.equal(detail.snapshots.length, 1);
    assert.equal(detail.staleness.is_stale, false);
    assert.equal(detail.ai_drafting.state, 'unavailable');
    assert.equal(detail.permissions.can_approve, false);
    assert.equal(detail.current_revision.sections.find((section) => section.key === 'functional_change').origin, 'ai_assisted');
    assert.equal(detail.request.export_events.length, 1);
  } finally {
    await api.stop();
  }
});

test('snapshot documents are byte-identical on every read and isolated by organisation', async () => {
  const api = await startTestApi();
  try {
    const treating = await api.login('treating');
    const other = await api.login('other');
    const detail = (await api.call(`/api/reporting/requests/${api.seeded.progressRequestId}`, { token: treating.token })).body;
    const snapshotId = detail.snapshots[0].id;
    const first = await api.call(`/api/reporting/snapshots/${snapshotId}/document`, { token: treating.token });
    const second = await api.call(`/api/reporting/snapshots/${snapshotId}/document`, { token: treating.token });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(first.text, second.text);
    assert.ok(first.text.includes('SYNTHETIC DEMONSTRATION DATA'));
    assert.ok(first.text.includes('AI-assisted draft, clinician reviewed'));
    const meta = (await api.call(`/api/reporting/snapshots/${snapshotId}`, { token: treating.token })).body;
    assert.equal('rendered_html' in meta, false);
    assert.equal(meta.approved_by_name, 'Synthetic Senior Physiotherapist');
    assert.equal((await api.call(`/api/reporting/snapshots/${snapshotId}`, { token: other.token })).status, 403);
    assert.equal((await api.call(`/api/reporting/requests/${api.seeded.progressRequestId}`, { token: other.token })).status, 403);
    assert.equal((await api.call('/api/reporting/episodes/episode-synthetic-knee-1', { token: other.token })).status, 404);
    assert.equal((await api.call('/api/reporting/requests', { token: other.token })).body.requests.length, 0);
  } finally {
    await api.stop();
  }
});

test('the full request lifecycle runs over HTTP with role admission and staleness detection', async () => {
  const api = await startTestApi();
  try {
    const treating = await api.login('treating');
    const senior = await api.login('senior');
    const admin = await api.login('admin');
    const created = await api.call('/api/reporting/requests', {
      method: 'POST',
      token: admin.token,
      body: {
        physio_care_episode_id: 'episode-synthetic-knee-1',
        report_type: 'PHYSIO_REFERRER_UPDATE',
        purpose: 'Administrator-raised request',
        recipient: { name: 'Dr Synthetic Referrer', role: 'referring_gp' },
        clinical_questions: ['Fit to run?'],
        owner_user_id: 'user-synthetic-treating',
        due_date: '2026-09-30',
        command_id: 'http-create-0001',
      },
    });
    assert.equal(created.status, 201, created.text);
    const requestId = created.body.request_id;
    const replay = await api.call('/api/reporting/requests', { method: 'POST', token: admin.token, body: {
      physio_care_episode_id: 'episode-synthetic-knee-1', report_type: 'PHYSIO_REFERRER_UPDATE', purpose: 'Administrator-raised request',
      recipient: { name: 'Dr Synthetic Referrer', role: 'referring_gp' }, clinical_questions: ['Fit to run?'], owner_user_id: 'user-synthetic-treating', due_date: '2026-09-30', command_id: 'http-create-0001',
    } });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(replay.body.request_id, requestId);

    const foreignEpisode = await api.call('/api/reporting/requests', { method: 'POST', token: admin.token, body: { physio_care_episode_id: 'episode-synthetic-other-1', report_type: 'PHYSIO_REFERRER_UPDATE', purpose: 'x', recipient: { name: 'r', role: 'referring_gp' }, owner_user_id: 'user-synthetic-treating', due_date: '2026-09-30' } });
    assert.equal(foreignEpisode.status, 404);
    const foreignOwner = await api.call('/api/reporting/requests', { method: 'POST', token: admin.token, body: { physio_care_episode_id: 'episode-synthetic-knee-1', report_type: 'PHYSIO_REFERRER_UPDATE', purpose: 'x', recipient: { name: 'r', role: 'referring_gp' }, owner_user_id: 'user-synthetic-other', due_date: '2026-09-30' } });
    assert.equal(foreignOwner.body.code, 'owner_not_member');

    let version = created.body.version;
    const command = async (name, token, body = {}) => {
      const response = await api.call(`/api/reporting/requests/${requestId}/commands/${name}`, { method: 'POST', token, body: { expected_version: version, ...body } });
      if (response.status === 200 && !response.body.replayed) version = response.body.version;
      return response;
    };
    assert.equal((await command('assembleEvidence', admin.token)).body.code, 'clinical_role_required');
    assert.equal((await command('assembleEvidence', treating.token)).status, 200);
    assert.equal((await command('startDraft', treating.token)).status, 200);
    const stale = await command('startDraft', treating.token, { expected_version: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'request_changed');
    assert.equal((await command('saveDraft', treating.token, { sections: [{ key: 'clinical_functional_update', text: 'Update.' }, { key: 'current_plan', text: 'Plan.' }] })).status, 200);
    assert.equal((await command('submitForReview', treating.token)).status, 200);
    assert.equal((await command('approve', treating.token)).body.code, 'approval_not_permitted');

    // A goal change is not staleness for a referrer update: goals are not among its pinned categories.
    const goalChange = await api.call('/api/demo/simulate-source-change', { method: 'POST', token: treating.token, body: { episode_id: 'episode-synthetic-knee-1', change: 'achieve_first_goal' } });
    assert.equal(goalChange.status, 200, goalChange.text);
    assert.equal((await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body.staleness.is_stale, false);
    const simulated = await api.call('/api/demo/simulate-source-change', { method: 'POST', token: treating.token, body: { episode_id: 'episode-synthetic-knee-1', change: 'add_reassessment' } });
    assert.equal(simulated.status, 200, simulated.text);
    const detail = (await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body;
    assert.equal(detail.staleness.is_stale, true);
    assert.deepEqual(detail.staleness.added.map((entry) => entry.source_id), [`measurement:${simulated.body.record.id}`]);
    const refused = await command('approve', senior.token);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'sources_changed');
    assert.equal((await command('refreshSources', treating.token)).status, 200);
    assert.equal((await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body.summary.status, 'draft');
    assert.equal((await command('saveDraft', treating.token, { sections: [{ key: 'clinical_functional_update', text: 'Update after refresh.' }] })).status, 200);
    assert.equal((await command('submitForReview', treating.token)).status, 200);
    const approved = await command('approve', senior.token, { approval_note: 'Approved over HTTP.' });
    assert.equal(approved.status, 200, approved.text);
    assert.ok(approved.body.snapshot_id);
    const preview = await api.call(`/api/reporting/requests/${requestId}/preview`, { token: treating.token });
    assert.equal(preview.status, 200);
    const document = await api.call(`/api/reporting/snapshots/${approved.body.snapshot_id}/document`, { token: treating.token });
    assert.ok(document.text.includes('Update after refresh.'));
    assert.ok(document.text.includes(`(${simulated.body.record.assessment_date.split('-').reverse().join('/')})`), 'the refreshed outcome table carries the new measurement date');
    assert.equal((await command('saveDraft', treating.token, { sections: [] })).body.code, 'approved_snapshot_immutable');
    assert.equal((await command('recordDelivery', admin.token, { channel: 'secure_message' })).status, 200);
    assert.equal((await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body.summary.status, 'sent');
    const amendment = await command('openAmendment', treating.token, { reason: 'Recipient name corrected' });
    assert.equal(amendment.status, 200, amendment.text);
    assert.equal((await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body.summary.status, 'amendment_in_progress');
    const aiRefused = await api.call(`/api/reporting/requests/${requestId}/ai/draft-section`, { method: 'POST', token: treating.token, body: { expected_version: version, section_key: 'current_plan' } });
    assert.equal(aiRefused.status, 503);
    assert.equal(aiRefused.body.code, 'ai_drafting_unavailable');
    const untouched = (await api.call(`/api/reporting/requests/${requestId}`, { token: treating.token })).body;
    assert.equal(untouched.request.version, version, 'a refused AI request changes nothing');
  } finally {
    await api.stop();
  }
});
