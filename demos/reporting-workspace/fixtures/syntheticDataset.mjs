// Synthetic fixture dataset for the reporting-workflow demo.
//
// EVERY record here is invented for demonstration and testing. No real
// patient, clinician, organisation or clinical event is described. Names are
// prefixed "Synthetic" and each Client row carries synthetic: true so the
// rendered documents carry a visible banner.
//
// The dataset deliberately contains two materially different care episodes:
//   - Episode A (knee): complete examinations, goals with targets, repeated
//     measures, encounters, a home program with recorded adherence, published
//     notes and an AI-assisted prior draft. Most requirements are present.
//   - Episode B (shoulder): a partial examination, one baseline-only measure,
//     no goals, no home program and no notes. Most requirements are missing
//     or unknown.
// The two fixtures make the completeness assessment and the rendered output
// change with the source context, which the tests assert.

export const SYNTHETIC_NOW = '2026-09-06T02:00:00.000Z';

export const ORGANIZATION = Object.freeze({
  id: 'org-synthetic-physio',
  name: 'Synthetic Physiotherapy Practice (demo)',
  subscription_status: 'active',
  synthetic: true,
});

export const USERS = Object.freeze([
  Object.freeze({
    id: 'user-synthetic-treating',
    key: 'treating',
    email: 'synthetic-treating@example.test',
    full_name: 'Synthetic Treating Physiotherapist',
    role: 'clinician',
    membership_role: 'clinician',
    can_approve_reports: false,
    account_status: 'active',
    profession: 'Physiotherapist',
  }),
  Object.freeze({
    id: 'user-synthetic-senior',
    key: 'senior',
    email: 'synthetic-senior@example.test',
    full_name: 'Synthetic Senior Physiotherapist',
    role: 'senior_clinician',
    membership_role: 'owner',
    can_approve_reports: true,
    account_status: 'active',
    profession: 'Physiotherapist',
  }),
  Object.freeze({
    id: 'user-synthetic-admin',
    key: 'admin',
    email: 'synthetic-admin@example.test',
    full_name: 'Synthetic Practice Administrator',
    role: 'practice_admin',
    membership_role: 'admin',
    can_approve_reports: false,
    account_status: 'active',
    profession: 'Practice administration',
  }),
  Object.freeze({
    id: 'user-synthetic-inactive',
    key: 'inactive',
    email: 'synthetic-inactive@example.test',
    full_name: 'Synthetic Suspended Clinician',
    role: 'clinician',
    membership_role: 'clinician',
    can_approve_reports: false,
    account_status: 'suspended',
    profession: 'Physiotherapist',
  }),
]);

export const OTHER_ORGANIZATION = Object.freeze({
  id: 'org-synthetic-other',
  name: 'Synthetic Other Practice (demo, isolation control)',
  subscription_status: 'active',
  synthetic: true,
});

export const OTHER_ORG_USER = Object.freeze({
  id: 'user-synthetic-other',
  key: 'other',
  email: 'synthetic-other@example.test',
  full_name: 'Synthetic Clinician (other practice)',
  role: 'senior_clinician',
  membership_role: 'owner',
  can_approve_reports: true,
  account_status: 'active',
  profession: 'Physiotherapist',
});

export const CATALOGUE = Object.freeze([
  Object.freeze({ id: 'asmt-nprs', name: 'Numeric Pain Rating Scale (NPRS)', unit_of_measure: '/10', normative_direction: 'lower_better', scoring_version: 'nprs-1.0', category: 'pain' }),
  Object.freeze({ id: 'asmt-lefs', name: 'Lower Extremity Functional Scale (LEFS)', unit_of_measure: '/80', normative_direction: 'higher_better', scoring_version: 'lefs-1.0', category: 'function' }),
  Object.freeze({ id: 'asmt-stair', name: 'Timed stair climb (12 steps)', unit_of_measure: 's', normative_direction: 'lower_better', scoring_version: 'stair-1.0', category: 'function' }),
  Object.freeze({ id: 'asmt-quickdash', name: 'QuickDASH', unit_of_measure: '/100', normative_direction: 'lower_better', scoring_version: 'quickdash-1.0', category: 'function' }),
]);

function withStamps(record, createdAt, updatedAt = createdAt, createdBy = 'synthetic-seed') {
  return { ...record, created_date: createdAt, updated_date: updatedAt, created_by: createdBy };
}

export function buildDataset() {
  const orgId = ORGANIZATION.id;

  const clientA = withStamps({
    id: 'client-synthetic-knee',
    org_id: orgId,
    full_name: 'Synthetic Patient A (right knee)',
    referral_source: 'gp',
    referral_source_name: 'Dr Synthetic Referrer',
    referral_reason: 'Right anterior knee pain limiting stairs and running',
    funding_source: 'private_health',
    synthetic: true,
    is_archived: false,
  }, '2026-07-01T00:00:00.000Z');

  const clientB = withStamps({
    id: 'client-synthetic-shoulder',
    org_id: orgId,
    full_name: 'Synthetic Patient B (left shoulder)',
    referral_source: 'self_referral',
    referral_source_name: '',
    referral_reason: 'Left shoulder pain with overhead reaching',
    funding_source: 'self_funded',
    synthetic: true,
    is_archived: false,
  }, '2026-08-20T00:00:00.000Z');

  const clientOther = withStamps({
    id: 'client-synthetic-other',
    org_id: OTHER_ORGANIZATION.id,
    full_name: 'Synthetic Patient (other practice)',
    referral_source: 'gp',
    referral_reason: 'Isolation control record',
    funding_source: 'self_funded',
    synthetic: true,
    is_archived: false,
  }, '2026-08-01T00:00:00.000Z');

  const episodeA = withStamps({
    id: 'episode-synthetic-knee-1',
    schema_version: 3,
    org_id: orgId,
    client_id: clientA.id,
    primary_practitioner_id: 'user-synthetic-treating',
    episode_number: 1,
    title: 'Synthetic right knee rehabilitation',
    status: 'active',
    status_history: [
      { sequence: 1, from: null, to: 'active', reason: 'Episode commenced', occurred_at: '2026-07-06T01:00:00.000Z', actor_user_id: 'user-synthetic-treating', actor_email: 'synthetic-treating@example.test' },
    ],
    presenting_problem: 'Gradual-onset right anterior knee pain affecting stairs, squatting and running',
    body_region: 'Right knee',
    onset_date: '2026-06-10',
    episode_start_date: '2026-07-06',
    target_discharge_date: '2026-10-05',
    referral: {
      source: 'gp',
      referrer_name: 'Dr Synthetic Referrer',
      referrer_provider_number: 'SYN000001',
      referral_date: '2026-07-01',
      reason: 'Right anterior knee pain limiting stairs and running; please assess and manage, report at 8 weeks',
      funding_source: 'private_health',
      approved_sessions: 10,
      sessions_used: 5,
    },
    red_flag_screen: {
      physio_screen_outcome: 'no_red_flags',
      physio_screen_clinical_reasoning: 'All structured red-flag questions answered negatively; routine examination appropriate.',
      physio_screen_escalation_disposition: 'none',
      physio_screen_activity_restriction: '',
      physio_screen_summary: {
        schema_version: 1,
        completion_status: 'complete',
        recorded_at: '2026-07-06T01:10:00.000Z',
        responses: [],
        finding_count: 0,
        finding_keys: [],
        outcome: 'no_red_flags',
        clinical_reasoning: 'All structured red-flag questions answered negatively; routine examination appropriate.',
        escalation: null,
      },
    },
    subjective_examination: {
      completion_status: 'complete',
      recorded_at: '2026-07-06T01:20:00.000Z',
      physio_subj_presenting_complaint: 'Right anterior knee pain on stairs and loaded knee flexion',
      physio_subj_body_chart_area: 'Right anterior knee, peripatellar',
      physio_subj_mechanism_of_onset: 'Gradual onset after increased running volume over four weeks',
      physio_subj_duration: 'Four weeks at initial assessment',
      physio_subj_aggravating_factors: 'Descending stairs, prolonged sitting, running beyond 2 km',
      physio_subj_easing_factors: 'Rest, walking on flat ground',
      physio_subj_current_pain: 6,
      physio_subj_worst_pain_last_week: 8,
      physio_subj_patient_goals: 'Return to pain-free stairs and five-kilometre running',
      physio_subj_occupation_and_functional_demands: 'Office-based; recreational runner three times per week',
    },
    objective_examination: {
      completion_status: 'complete',
      recorded_at: '2026-07-06T01:40:00.000Z',
      physio_obj_observation_posture: 'Mild dynamic knee valgus during single-leg squat on the right',
      physio_obj_functional_tests: 'Step-down test reproduces familiar anterior knee pain; single-leg squat 8 repetitions before pain',
      physio_obj_palpation_findings: 'Tenderness over the medial patellar facet; no effusion',
      physio_obj_special_tests: [{ name: 'Patellar grind', result: 'positive, familiar pain' }, { name: 'Lachman', result: 'negative' }],
      physio_obj_diagnosis_clinical_impression: 'Load-related patellofemoral pain presentation without mechanical instability',
    },
    initial_findings: {
      subjective_summary: 'Four-week history of load-related right anterior knee pain in a recreational runner.',
      objective_summary: 'Pain reproduced on step-down and patellar grind; dynamic valgus on single-leg squat; no instability.',
      physiotherapy_diagnosis: 'Patellofemoral pain (load-related)',
      red_flag_status: 'clear',
      precautions: 'Avoid running volume increases greater than 10 percent per week during rehabilitation.',
    },
    goals: [
      { id: 'goal-knee-stairs', description: 'Descend a full flight of stairs without pain', baseline: 'NPRS 6/10 descending stairs', target: 'NPRS 0-1/10 descending stairs', target_date: '2026-09-15', status: 'in_progress' },
      { id: 'goal-knee-run', description: 'Run five kilometres continuously without next-day flare', baseline: 'Running ceased', target: '5 km continuous, NPRS 2/10 or less', target_date: '2026-10-05', status: 'in_progress' },
    ],
    outcome_measures: [],
    encounters: [
      { id: 'enc-knee-1', date: '2026-07-06T01:00:00.000Z', type: 'initial', summary: 'Initial assessment and education', treatments: ['Load management education', 'Isometric quadriceps loading'], response: 'Tolerated well', next_plan: 'Commence graded loading; review in one week', soap_note_id: 'note-knee-1' },
      { id: 'enc-knee-2', date: '2026-07-13T01:00:00.000Z', type: 'treatment', summary: 'Progressed loading', treatments: ['Split squat progression', 'Hip abductor strengthening'], response: 'Mild post-session soreness settling within 24 hours', next_plan: 'Continue; add step-down control work', soap_note_id: 'note-knee-2' },
      { id: 'enc-knee-3', date: '2026-07-27T01:00:00.000Z', type: 'treatment', summary: 'Step-down control and return-to-run planning', treatments: ['Eccentric step-down', 'Walk-run interval plan'], response: 'Stairs improving; running not yet resumed', next_plan: 'Commence walk-run programme', soap_note_id: '' },
      { id: 'enc-knee-4', date: '2026-08-24T01:00:00.000Z', type: 'reassessment', summary: 'Reassessment at seven weeks', treatments: ['Reassessment of NPRS and LEFS', 'Running progression review'], response: 'Improved function; residual pain on long descents', next_plan: 'Progress running; report to referrer', soap_note_id: 'note-knee-3' },
    ],
    management_protocols: [
      { id: 'proto-knee-pfp', condition_name: 'Patellofemoral pain', category: 'knee', status: 'current', source: 'reviewed_protocol', source_protocol_id: 'protocol-synthetic-pfp', added_date: '2026-07-06', review_date: '2026-09-06', clinical_adaptation: 'Emphasis on hip abductor strengthening given observed dynamic valgus.', summary: 'Graded loading with hip and quadriceps strengthening and education on load management.', evidence_count: 3, dropped_paths: [], protocol_data: { overview: { functional_impact: 'Graded loading with hip and quadriceps strengthening and education on load management.' } } },
    ],
    home_programs: [
      { id: 'hp-knee-1', name: 'Knee loading programme (phase 2)', status: 'current', prescribed_date: '2026-07-13', review_date: '2026-09-06', dosage: 'Three sessions per week, three sets of eight to twelve repetitions', adherence: 'Patient reports completing five of six sessions per fortnight (self-report, 24 August 2026)', instructions: 'Split squats, side-lying hip abduction, step-downs with control.' },
    ],
    reporting: {
      progress_report_status: 'due',
      referrer_update_due: '2026-09-01',
      discharge_status: 'not_ready',
      discharge_date: '',
      discharge_outcome: '',
      report_id: '',
      report_ids: [],
      ai_drafts: [],
    },
  }, '2026-07-06T01:00:00.000Z', '2026-08-24T02:00:00.000Z', 'synthetic-treating@example.test');

  const episodeB = withStamps({
    id: 'episode-synthetic-shoulder-1',
    schema_version: 3,
    org_id: orgId,
    client_id: clientB.id,
    primary_practitioner_id: 'user-synthetic-treating',
    episode_number: 1,
    title: 'Synthetic left shoulder assessment',
    status: 'active',
    status_history: [
      { sequence: 1, from: null, to: 'active', reason: 'Episode commenced', occurred_at: '2026-08-25T01:00:00.000Z', actor_user_id: 'user-synthetic-treating', actor_email: 'synthetic-treating@example.test' },
    ],
    presenting_problem: 'Left shoulder pain with overhead reaching, two months',
    body_region: 'Left shoulder',
    onset_date: '2026-06-25',
    episode_start_date: '2026-08-25',
    target_discharge_date: '',
    referral: {
      source: 'self_referral',
      referrer_name: '',
      referral_date: '',
      reason: '',
      funding_source: 'self_funded',
    },
    red_flag_screen: {
      physio_screen_outcome: 'no_red_flags',
      physio_screen_summary: {
        schema_version: 1,
        completion_status: 'draft',
        recorded_at: '2026-08-25T01:10:00.000Z',
        responses: [],
        finding_count: 0,
        finding_keys: [],
        outcome: 'no_red_flags',
        clinical_reasoning: null,
        escalation: null,
      },
    },
    subjective_examination: {
      completion_status: 'complete',
      recorded_at: '2026-08-25T01:20:00.000Z',
      physio_subj_presenting_complaint: 'Left shoulder pain with overhead reaching and lying on the left side',
      physio_subj_body_chart_area: 'Left anterolateral shoulder',
      physio_subj_mechanism_of_onset: 'Insidious onset following a period of overhead painting',
      physio_subj_duration: 'Two months',
      physio_subj_aggravating_factors: 'Overhead reaching, lying on the left side',
      physio_subj_easing_factors: 'Arm supported at the side',
      physio_subj_current_pain: 4,
      physio_subj_worst_pain_last_week: 7,
      physio_subj_patient_goals: 'Reach overhead cupboards without pain',
      physio_subj_occupation_and_functional_demands: 'Retail; frequent overhead shelf stocking',
    },
    objective_examination: {
      completion_status: 'draft',
      recorded_at: '2026-08-25T01:40:00.000Z',
      physio_obj_observation_posture: 'Protracted left scapula at rest',
      physio_obj_functional_tests: '',
      physio_obj_palpation_findings: '',
      physio_obj_special_tests: [],
      physio_obj_diagnosis_clinical_impression: '',
    },
    initial_findings: {
      subjective_summary: '',
      objective_summary: '',
      physiotherapy_diagnosis: '',
      red_flag_status: 'not_recorded',
      precautions: '',
    },
    goals: [],
    outcome_measures: [],
    encounters: [
      { id: 'enc-shoulder-1', date: '2026-08-25T01:00:00.000Z', type: 'initial', summary: 'Initial assessment (objective examination incomplete; patient time-limited)', treatments: [], response: '', next_plan: '', soap_note_id: '' },
    ],
    management_protocols: [],
    home_programs: [],
    reporting: {
      progress_report_status: 'not_due',
      referrer_update_due: '',
      discharge_status: 'not_ready',
      discharge_date: '',
      discharge_outcome: '',
      report_id: '',
      report_ids: [],
      ai_drafts: [],
    },
  }, '2026-08-25T01:00:00.000Z', '2026-08-25T02:00:00.000Z', 'synthetic-treating@example.test');

  const episodeOther = withStamps({
    id: 'episode-synthetic-other-1',
    schema_version: 3,
    org_id: OTHER_ORGANIZATION.id,
    client_id: clientOther.id,
    primary_practitioner_id: OTHER_ORG_USER.id,
    episode_number: 1,
    title: 'Synthetic isolation-control episode',
    status: 'active',
    status_history: [],
    presenting_problem: 'Isolation control',
    body_region: '',
    episode_start_date: '2026-08-01',
    referral: { source: 'gp', referrer_name: 'Dr Synthetic Other', referral_date: '2026-08-01', reason: 'Isolation control', funding_source: 'self_funded' },
    red_flag_screen: {},
    subjective_examination: {},
    objective_examination: {},
    initial_findings: {},
    goals: [],
    outcome_measures: [],
    encounters: [],
    management_protocols: [],
    home_programs: [],
    reporting: {},
  }, '2026-08-01T01:00:00.000Z');

  const assessment = (id, clientId, episodeId, assessmentId, date, value, extra = {}) => withStamps({
    id,
    org_id: orgId,
    client_id: clientId,
    physio_care_episode_id: episodeId,
    assessment_id: assessmentId,
    status: 'completed',
    result_value: value,
    assessment_date: date,
    source: 'live',
    notes: '',
    ...extra,
  }, `${date}T02:00:00.000Z`, `${date}T02:00:00.000Z`, 'synthetic-treating@example.test');

  const assessments = [
    assessment('ca-knee-nprs-1', clientA.id, episodeA.id, 'asmt-nprs', '2026-07-06', 6),
    assessment('ca-knee-lefs-1', clientA.id, episodeA.id, 'asmt-lefs', '2026-07-06', 46),
    assessment('ca-knee-stair-1', clientA.id, episodeA.id, 'asmt-stair', '2026-07-06', 14.2),
    assessment('ca-knee-nprs-2', clientA.id, episodeA.id, 'asmt-nprs', '2026-08-24', 3),
    assessment('ca-knee-lefs-2', clientA.id, episodeA.id, 'asmt-lefs', '2026-08-24', 63),
    assessment('ca-shoulder-quickdash-1', clientB.id, episodeB.id, 'asmt-quickdash', '2026-08-25', 43.2),
  ];

  const note = (id, clientId, episodeId, date, status, fields) => withStamps({
    id,
    org_id: orgId,
    client_id: clientId,
    physio_care_episode_id: episodeId,
    note_date: `${date}T01:00:00.000Z`,
    status,
    practitioner_id: 'user-synthetic-treating',
    ...fields,
  }, `${date}T01:30:00.000Z`, `${date}T01:30:00.000Z`, 'synthetic-treating@example.test');

  const soapNotes = [
    note('note-knee-1', clientA.id, episodeA.id, '2026-07-06', 'published', {
      subjective: 'Right anterior knee pain on stairs; four-week history; running ceased.',
      objective: 'Step-down reproduces pain; dynamic valgus single-leg squat; no effusion.',
      assessment: 'Load-related patellofemoral pain presentation.',
      plan: 'Load management education, isometric quadriceps loading; review in one week.',
    }),
    note('note-knee-2', clientA.id, episodeA.id, '2026-07-13', 'published', {
      subjective: 'Stairs slightly easier; soreness after home programme settling within a day.',
      objective: 'Split squat 3 x 8 tolerated; hip abduction strength improving.',
      assessment: 'Progressing as expected.',
      plan: 'Progress loading; add eccentric step-down control.',
    }),
    note('note-knee-3', clientA.id, episodeA.id, '2026-08-24', 'draft', {
      subjective: 'Descending stairs mostly pain-free; long descents still provoke mild pain; walk-run programme commenced.',
      objective: 'NPRS 3/10; LEFS 63/80; single-leg squat 15 repetitions before pain.',
      assessment: 'Meaningful improvement in pain and function; residual load sensitivity on long descents.',
      plan: 'Progress running intervals; report to referrer at eight weeks.',
    }),
  ];

  const savedReports = [
    withStamps({
      id: 'report-knee-ai-referrer-draft',
      org_id: orgId,
      client_id: clientA.id,
      physio_care_episode_id: episodeA.id,
      report_type: 'PHYSIO_REFERRER_UPDATE',
      report_name: 'Referrer update — AI-assisted draft',
      report_date: '2026-08-24',
      assessment_ids: ['ca-knee-nprs-1', 'ca-knee-lefs-1', 'ca-knee-nprs-2', 'ca-knee-lefs-2'],
      section_content: {
        'Clinical and functional update': 'Synthetic AI-assisted draft: since commencing graded loading the patient reports improved stair descent with residual discomfort on long descents; recorded pain and function scores improved between the initial and seven-week reassessment (see pinned measures). Running has recommenced on a walk-run programme.',
        'Current plan for clinician confirmation': 'Synthetic AI-assisted draft: continue the graded running progression and hip and quadriceps strengthening with reassessment at twelve weeks; clinician to confirm.',
        'Limitations and uncertainties': 'Synthetic AI-assisted draft: adherence is self-reported; the timed stair climb has a baseline only.',
      },
      active_sections: ['Clinical and functional update', 'Current plan for clinician confirmation', 'Limitations and uncertainties'],
      report_html: '',
      status: 'draft',
      revision_number: 1,
      revision_history: [],
      ai_generation: {
        generation_id: 'gen-synthetic-0001',
        task_type: 'physio.referrer_update.v1',
        source_output_state: 'ai_draft_unreviewed',
        care_episode_id: episodeA.id,
        source_output_sha256: 'a'.repeat(64),
        provenance_sha256: 'b'.repeat(64),
        provenance: {
          receipt_contract_version: 'physio-ai-provider-receipt/1.0.0',
          generated_at: '2026-08-24T03:00:00.000Z',
          provider: 'synthetic-provider',
          model: 'synthetic-model-2026-08',
          finish_reason: 'stop',
        },
        reviewed_by: 'user-synthetic-treating',
        reviewed_at: '2026-08-24T03:10:00.000Z',
      },
    }, '2026-08-24T03:10:00.000Z', '2026-08-24T03:10:00.000Z', 'synthetic-treating@example.test'),
  ];

  const documents = [
    withStamps({
      id: 'doc-knee-referral',
      org_id: orgId,
      client_id: clientA.id,
      physio_care_episode_id: episodeA.id,
      document_type: 'referral',
      file_name: 'synthetic-referral-letter.pdf',
      file_url: '',
      notes: 'Synthetic referral letter placeholder; no file content is stored in the demo.',
    }, '2026-07-01T00:00:00.000Z'),
  ];

  return {
    organizations: [ORGANIZATION, OTHER_ORGANIZATION],
    users: [...USERS, OTHER_ORG_USER],
    memberships: [
      ...USERS.map((user) => ({ id: `member-${user.key}`, org_id: orgId, user_email: user.email, user_id: user.id, role: user.membership_role, is_primary: true })),
      { id: 'member-other', org_id: OTHER_ORGANIZATION.id, user_email: OTHER_ORG_USER.email, user_id: OTHER_ORG_USER.id, role: 'owner', is_primary: true },
    ],
    clients: [clientA, clientB, clientOther],
    episodes: [episodeA, episodeB, episodeOther],
    catalogue: [...CATALOGUE],
    assessments,
    soapNotes,
    savedReports,
    documents,
  };
}

/** Context bundle for one episode, as the service layer would load it. */
export function episodeContext(dataset, episodeId) {
  const episode = dataset.episodes.find((entry) => entry.id === episodeId);
  if (!episode) throw new Error(`unknown fixture episode ${episodeId}`);
  const scoped = (rows) => rows.filter((row) => row.physio_care_episode_id === episodeId);
  return {
    client: dataset.clients.find((entry) => entry.id === episode.client_id),
    episode,
    assessments: scoped(dataset.assessments),
    catalogue: dataset.catalogue,
    soapNotes: scoped(dataset.soapNotes),
    savedReports: scoped(dataset.savedReports),
    documents: scoped(dataset.documents),
  };
}

export function principalFor(user, dataset = null) {
  const orgIds = dataset
    ? dataset.memberships.filter((entry) => entry.user_id === user.id).map((entry) => entry.org_id)
    : [ORGANIZATION.id];
  return {
    user_id: user.id,
    display_name: user.full_name,
    email: user.email,
    role: user.role,
    can_approve_reports: user.can_approve_reports === true,
    account_status: user.account_status,
    org_id: orgIds[0] || null,
    org_ids: orgIds,
  };
}
