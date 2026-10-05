// Seed the demo store with the synthetic dataset and drive the reporting
// workflow through its own commands so that the seeded reports carry real
// provenance rather than hand-written rows.
//
// After seeding:
//   - Synthetic Patient A (right knee) holds one APPROVED progress report
//     (snapshot, source manifest and an imported, reviewed AI-assisted
//     section) and one referrer update in DRAFT.
//   - Synthetic Patient B (left shoulder) holds one progress report in the
//     REQUESTED state, showing the evidence gaps before any draft exists.

import { buildDataset, SYNTHETIC_NOW } from '../fixtures/syntheticDataset.mjs';
import { createReportingService } from './service.mjs';

function deterministicIdFactory(prefix = '') {
  let counter = 0;
  return (kind) => `${prefix}${kind}-${String(++counter).padStart(4, '0')}`;
}

function tickingClock(start = SYNTHETIC_NOW, stepMs = 60_000) {
  let current = Date.parse(start);
  return () => {
    current += stepMs;
    return new Date(current).toISOString();
  };
}

export function seedDemoStore(store, { clock = tickingClock(), idFactory = deterministicIdFactory('seed-') } = {}) {
  const dataset = buildDataset();
  store.transaction(() => {
    for (const organization of dataset.organizations) store.repo('Organization').create(organization, 'synthetic-seed', { now: SYNTHETIC_NOW, id: organization.id });
    for (const user of dataset.users) store.repo('User').create(user, 'synthetic-seed', { now: SYNTHETIC_NOW, id: user.id });
    for (const membership of dataset.memberships) store.repo('OrganizationMember').create(membership, 'synthetic-seed', { now: SYNTHETIC_NOW, id: membership.id });
    for (const client of dataset.clients) store.repo('Client').create(client, 'synthetic-seed', { id: client.id });
    for (const episode of dataset.episodes) store.repo('PhysioCareEpisode').create(episode, 'synthetic-seed', { id: episode.id });
    for (const definition of dataset.catalogue) store.repo('Assessment').create(definition, 'synthetic-seed', { now: SYNTHETIC_NOW, id: definition.id });
    for (const row of dataset.assessments) store.repo('ClientAssessment').create(row, 'synthetic-seed', { id: row.id });
    for (const note of dataset.soapNotes) store.repo('SOAPNote').create(note, 'synthetic-seed', { id: note.id });
    for (const report of dataset.savedReports) store.repo('SavedReport').create(report, 'synthetic-seed', { id: report.id });
    for (const document of dataset.documents) store.repo('ClientDocument').create(document, 'synthetic-seed', { id: document.id });
  });

  const service = createReportingService({ store, clock, idFactory, synthetic: true });
  const treating = service.resolvePrincipal(store.sessions.create('user-synthetic-treating', { now: SYNTHETIC_NOW }));
  const senior = service.resolvePrincipal(store.sessions.create('user-synthetic-senior', { now: SYNTHETIC_NOW }));

  // Patient A: approved eight-week progress report.
  const progress = service.createRequest(treating, {
    physio_care_episode_id: 'episode-synthetic-knee-1',
    report_type: 'PHYSIO_PROGRESS_REPORT',
    purpose: 'Eight-week progress report requested by the referrer',
    recipient: { name: 'Dr Synthetic Referrer', role: 'referring_gp', organisation: 'Synthetic Medical Centre', channel: 'secure_message' },
    clinical_questions: ['Has pain and function improved since the initial assessment?', 'Is further physiotherapy indicated, and for how long?'],
    owner_user_id: 'user-synthetic-treating',
    due_date: '2026-09-04',
  }).request;
  let version = progress.version;
  const run = (principal, command, payload = {}) => {
    const result = service.runCommand(principal, progress.id, command, { expected_version: version, ...payload });
    version = result.request.version;
    return result;
  };
  run(treating, 'assembleEvidence');
  run(treating, 'startDraft');
  run(treating, 'importAiDraftSection', { section_key: 'functional_change', source_id: 'saved_report:report-knee-ai-referrer-draft', field: 'Clinical and functional update' });
  run(treating, 'saveDraft', {
    sections: [
      { key: 'functional_change', text: 'Since commencing graded loading the patient reports that descending a full flight of stairs is mostly pain-free, with residual discomfort only on long descents. Recorded pain (NPRS) and function (LEFS) scores improved between the initial assessment and the seven-week reassessment, as tabulated above. Running has recommenced on a walk-run programme; the five-kilometre goal remains in progress. (Synthetic demonstration text; AI-assisted draft edited by the treating clinician.)', review_state: 'reviewed' },
      { key: 'clinical_interpretation', text: 'The pattern of improvement is consistent with a load-related patellofemoral presentation responding to graded loading and hip strengthening. The timed stair climb has a baseline only, so no change can be stated for that measure. Adherence is self-reported. (Synthetic demonstration text authored by the treating clinician.)' },
      { key: 'recommendations_plan', text: 'Continue the graded running progression and strengthening programme for a further four weeks, then reassess NPRS, LEFS and the timed stair climb. No further investigation is recommended at this stage. (Synthetic demonstration text authored by the treating clinician.)' },
    ],
    review_note: 'Draft prepared for senior review.',
  });
  run(treating, 'submitForReview', { note: 'Ready for approval.' });
  const approved = run(senior, 'approve', { approval_note: 'Reviewed against the pinned sources; approved for release to the referrer.' });
  service.runCommand(treating, progress.id, 'recordExport', { snapshot_id: approved.snapshot.id, format: 'print' });

  // Patient A: referrer update in draft.
  const update = service.createRequest(treating, {
    physio_care_episode_id: 'episode-synthetic-knee-1',
    report_type: 'PHYSIO_REFERRER_UPDATE',
    purpose: 'Brief update before the referrer review appointment',
    recipient: { name: 'Dr Synthetic Referrer', role: 'referring_gp', organisation: 'Synthetic Medical Centre', channel: 'secure_message' },
    clinical_questions: ['Is the patient fit to resume running?'],
    owner_user_id: 'user-synthetic-treating',
    due_date: '2026-09-20',
  }).request;
  let updateVersion = update.version;
  const runUpdate = (principal, command, payload = {}) => {
    const result = service.runCommand(principal, update.id, command, { expected_version: updateVersion, ...payload });
    updateVersion = result.request.version;
    return result;
  };
  runUpdate(treating, 'assembleEvidence');
  runUpdate(treating, 'startDraft');

  // Patient B: request with visible gaps, no draft yet.
  service.createRequest(treating, {
    physio_care_episode_id: 'episode-synthetic-shoulder-1',
    report_type: 'PHYSIO_PROGRESS_REPORT',
    purpose: 'Progress report requested by the patient for an employer',
    recipient: { name: 'Synthetic Employer Rehabilitation Coordinator', role: 'employer_rehab_provider', organisation: 'Synthetic Retail Group', channel: 'email' },
    clinical_questions: ['Can the patient safely perform overhead shelf stocking?'],
    owner_user_id: 'user-synthetic-treating',
    due_date: '2026-09-02',
  });

  store.meta.set('seeded_at', SYNTHETIC_NOW);
  store.meta.set('seed_version', 'reporting-demo-seed/1.0.0');
  return { dataset, progressRequestId: progress.id, updateRequestId: update.id };
}
